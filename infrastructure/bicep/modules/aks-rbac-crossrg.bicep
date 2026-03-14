/*
================================================================================
AKS Cross-RG RBAC Assignments (bhs-development-public resource group scope)
================================================================================
This module is deployed scoped to the bhs-development-public resource group
from main-aks.bicep. It grants the AKS identities access to shared services
that live in bhs-development-public.

Assignments:
  1. kubeletPrincipalId  → AcrPull on ACR  (image pulls from node pool)
  2. apiWorkloadUAMI     → Key Vault Secrets User   (CSI driver secret access)
  3. apiWorkloadUAMI     → Cognitive Services User  (Speech + DocIntel)
  4. apiWorkloadUAMI     → Cognitive Services OpenAI User  (Azure OpenAI)
  5. appGwUAMI           → Key Vault Secrets User   (App Gateway TLS cert)
================================================================================
*/

@description('AKS kubelet (node pool) managed identity principal ID')
param kubeletPrincipalId string

@description('API Workload Identity UAMI principal ID (from aks-rbac module output)')
param apiWorkloadUAMIPrincipalId string

@description('Name of the existing ACR in this resource group')
param acrName string

@description('Name of the existing Key Vault in this resource group')
param keyVaultName string

@description('Name of the Azure Speech Cognitive Services account in this resource group')
param speechAccountName string

@description('Name of the AI Services / Azure OpenAI account in this resource group')
param aiServicesAccountName string

@description('App Gateway managed identity principal ID (needs Key Vault Secrets User to pull TLS cert)')
param appGwUAMIPrincipalId string

// ─── Existing resources ───────────────────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource speechAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: speechAccountName
}

resource aiServicesAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: aiServicesAccountName
}

// ─── Built-in role definition IDs ────────────────────────────────────────────
var acrPullRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
var keyVaultSecretsUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
var cogServicesUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908')
var cogServicesOpenAiUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')

// ─── 1. AcrPull for kubelet identity ─────────────────────────────────────────
resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kubeletPrincipalId, acr.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: acrPullRoleId
    principalId: kubeletPrincipalId
    principalType: 'ServicePrincipal'
    description: 'Allow AKS node pool kubelet to pull images from ACR'
  }
}

// ─── 2. Key Vault Secrets User for api workload UAMI ─────────────────────────
resource kvSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(apiWorkloadUAMIPrincipalId, keyVault.id, 'kvSecretsUser')
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsUserRoleId
    principalId: apiWorkloadUAMIPrincipalId
    principalType: 'ServicePrincipal'
    description: 'Allow api workload to read Key Vault secrets (CSI driver)'
  }
}

// ─── 3. Cognitive Services User — Speech ─────────────────────────────────────
resource speechUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(apiWorkloadUAMIPrincipalId, speechAccount.id, 'cogServicesUser')
  scope: speechAccount
  properties: {
    roleDefinitionId: cogServicesUserRoleId
    principalId: apiWorkloadUAMIPrincipalId
    principalType: 'ServicePrincipal'
    description: 'Allow api workload to call Azure Speech service'
  }
}

// ─── 4. Cognitive Services User + OpenAI User — AIServices ───────────────────
resource aiServicesUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(apiWorkloadUAMIPrincipalId, aiServicesAccount.id, 'cogServicesUser')
  scope: aiServicesAccount
  properties: {
    roleDefinitionId: cogServicesUserRoleId
    principalId: apiWorkloadUAMIPrincipalId
    principalType: 'ServicePrincipal'
    description: 'Allow api workload to call Azure AI Services (DocIntel, Speech)'
  }
}

resource openAiUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(apiWorkloadUAMIPrincipalId, aiServicesAccount.id, 'cogOpenAiUser')
  scope: aiServicesAccount
  properties: {
    roleDefinitionId: cogServicesOpenAiUserRoleId
    principalId: apiWorkloadUAMIPrincipalId
    principalType: 'ServicePrincipal'
    description: 'Allow api workload to call Azure OpenAI service'
  }
}

// ─── 5. Key Vault Secrets User for App Gateway UAMI (TLS certificate access) ────────
resource appGwKvSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appGwUAMIPrincipalId, keyVault.id, 'kvSecretsUser-appgw')
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsUserRoleId
    principalId: appGwUAMIPrincipalId
    principalType: 'ServicePrincipal'
    description: 'Allow App Gateway to pull TLS certificate from Key Vault'
  }
}
