/*
================================================================================
AKS RBAC Assignments Module  (bhs-aks resource group scope)
================================================================================
Creates the api Workload Identity UAMI and assigns roles for resources that
live in the bhs-aks resource group:

  1. Create api UAMI (federated to api Kubernetes ServiceAccount post-deploy)
  2. clusterPrincipalId  → Network Contributor on VNet      (cluster-level routing)
  3. apiWorkloadUAMI     → Storage Blob Data Contributor    (AKS storage account - Durable Functions blobs)
  4. apiWorkloadUAMI     → Storage Table Data Contributor   (AKS storage account - Durable Functions task hub)
  5. apiWorkloadUAMI     → Storage Queue Data Contributor   (AKS storage account - Durable Functions queues)
  6. agicPrincipalId     → Reader on resource group         (AGIC reads RG resources)
  7. agicPrincipalId     → Contributor on App Gateway       (AGIC configures routing)
  8. agicPrincipalId     → Network Contributor on VNet      (AGIC subnet join for routing)

Cross-RG assignments (ACR, Key Vault, Cognitive Services) that target the
bhs-development-public resource group are handled in aks-rbac-crossrg.bicep,
which is deployed separately from main-aks.bicep.
================================================================================
*/

@description('Azure region')
param location string

@description('App name prefix')
param appName string

@description('Environment name')
param environment string

@description('Resource tags')
param tags object

// AKS-provided identity principals
@description('AKS cluster system-assigned principal ID (for network contributor)')
param clusterPrincipalId string

@description('AGIC managed identity principal ID (for App Gateway configuration)')
param agicPrincipalId string

@description('VNet resource ID (in bhs-aks RG)')
param vnetResourceId string

@description('AKS storage account resource ID (in bhs-aks RG, created by aks-storage module)')
param aksStorageAccountId string

@description('App Gateway resource ID (in bhs-aks RG, created by aks-appgateway module)')
param appGatewayResourceId string

// ─── User-Assigned Managed Identity for api workload ────────────────────────
// This UAMI is federated to the "api" Kubernetes ServiceAccount.
// The federated credential is created after AKS is provisioned (see Deploy-AKS.ps1).

resource apiWorkloadUAMI 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${appName}-${environment}-aks-api-identity'
  location: location
  tags: tags
}

// ─── Built-in role definition IDs ───────────────────────────────────────────
var networkContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4d97b98b-1d4f-4787-a291-c67834d212e7')
var storageBlobContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var storageTableContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3')
var storageQueueContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '974c5e8b-45b9-4653-ba55-5f855dd0fb88')
var readerRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'acdd72a7-3385-48ef-bd42-f606fba81ae7')
var contributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')

// Reference the existing AKS storage account for least-privilege role scoping
resource aksStorageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: last(split(aksStorageAccountId, '/'))
}

// ─── 1. Network Contributor for cluster identity (required for cluster networking) ──────────
resource networkContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(clusterPrincipalId, vnetResourceId, 'netcontrib')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: networkContributorRoleId
    principalId: clusterPrincipalId
    principalType: 'ServicePrincipal'
    description: 'Allow AKS cluster to manage VNet'
  }
}

// ─── 2. Storage Blob Data Contributor for api workload UAMI ─────────────────
// Required for: Azure Functions secrets (BlobStorageSecretsRepository), Durable Functions blob state
resource storageContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aksStorageAccountId, appName, environment, 'storageBlobContrib')
  scope: aksStorageAccount
  properties: {
    roleDefinitionId: storageBlobContributorRoleId
    principalId: apiWorkloadUAMI.properties.principalId
    principalType: 'ServicePrincipal'
    description: 'Allow api workload to read/write blobs in AKS storage account'
  }
}

// ─── 3. Storage Table Data Contributor for api workload UAMI ────────────────
// Required for: Durable Functions task hub (useTablePartitionManagement: true) and host lock lease
resource storageTableContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aksStorageAccountId, appName, environment, 'storageTableContrib')
  scope: aksStorageAccount
  properties: {
    roleDefinitionId: storageTableContributorRoleId
    principalId: apiWorkloadUAMI.properties.principalId
    principalType: 'ServicePrincipal'
    description: 'Allow api workload to read/write tables in AKS storage account (Durable Functions)'
  }
}

// ─── 4. Storage Queue Data Contributor for api workload UAMI ────────────────
// Required for: Durable Functions control queues and work-item queues
resource storageQueueContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aksStorageAccountId, appName, environment, 'storageQueueContrib')
  scope: aksStorageAccount
  properties: {
    roleDefinitionId: storageQueueContributorRoleId
    principalId: apiWorkloadUAMI.properties.principalId
    principalType: 'ServicePrincipal'
    description: 'Allow api workload to read/write queues in AKS storage account (Durable Functions)'
  }
}

// ─── AGIC role assignments ────────────────────────────────────────────────────
// The AGIC add-on identity needs these roles to configure the App Gateway.

// 5. Reader on the resource group (AGIC needs to enumerate resources)
resource agicReaderAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(agicPrincipalId, resourceGroup().id, 'reader')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: readerRoleId
    principalId: agicPrincipalId
    principalType: 'ServicePrincipal'
    description: 'Allow AGIC to read resource group resources'
  }
}

// 6. Contributor on the App Gateway (AGIC updates routing rules)
resource agicAppGwContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(agicPrincipalId, appGatewayResourceId, 'contrib')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: contributorRoleId
    principalId: agicPrincipalId
    principalType: 'ServicePrincipal'
    description: 'Allow AGIC to configure App Gateway routing rules'
  }
}

// 7. Network Contributor on VNet (AGIC needs subnet join action for routing)
resource agicNetworkContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(agicPrincipalId, vnetResourceId, 'netcontrib')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: networkContributorRoleId
    principalId: agicPrincipalId
    principalType: 'ServicePrincipal'
    description: 'Allow AGIC to manage VNet subnets (required for subnet join action)'
  }
}

output apiWorkloadIdentityClientId string = apiWorkloadUAMI.properties.clientId
output apiWorkloadIdentityPrincipalId string = apiWorkloadUAMI.properties.principalId
output apiWorkloadIdentityResourceId string = apiWorkloadUAMI.id
output apiWorkloadIdentityName string = apiWorkloadUAMI.name
