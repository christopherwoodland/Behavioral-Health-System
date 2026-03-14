/*
================================================================================
AKS Development Deployment — Main Entry Point
================================================================================
Orchestrates the full AKS infrastructure deployment for the BHS application.

Deployment topology (all scoped to `bhs-aks` resource group):
  ┌─ Monitoring ────── App Insights + Log Analytics
  ├─ Networking ────── VNet 10.0.16.0/20 + subnets + NSGs
  ├─ Storage ──────── AKS storage account + private endpoint + 5 containers
  ├─ App Gateway ──── WAF_v2 public-facing ingress shell (AGIC manages rules)
  ├─ AKS Cluster ──── Azure CNI Overlay, Workload Identity, OIDC, CSI driver
  └─ RBAC ─────────── Role assignments + api workload UAMI

  NOTE: This template references the existing ACR and Key Vault from the
  bhs-development resource group by their resource IDs (passed as parameters).
  No existing resources are modified by this deployment.

  After deployment, run Deploy-AKS.ps1 to:
    • federate the api UAMI to the Kubernetes ServiceAccount
    • apply all Kubernetes manifests
================================================================================
*/
targetScope = 'subscription'

// ─── Core ─────────────────────────────────────────────────────────────────────
@description('Environment name')
@allowed(['dev', 'development'])
param environment string = 'dev'

@description('Azure region')
param location string = 'eastus2'

@description('Application name prefix')
param appName string = 'bhs'

@description('Resource group name (defaults to appName-aks)')
param resourceGroupName string = ''

@description('Tags applied to all resources')
param tags object = {
  Application: 'Behavioral Health System'
  Environment: environment
  ManagedBy: 'Bicep'
  NetworkMode: 'Private'
  DeploymentMode: 'AKS'
}

// ─── Existing resource references ─────────────────────────────────────────────
@description('Resource group containing ACR, Key Vault, and Cognitive Services (e.g. bhs-development-public)')
param existingServicesResourceGroup string

@description('Existing ACR name (in existingServicesResourceGroup)')
param acrName string

@description('Existing ACR login server (e.g. bhsdevelopmentacr4znv2wxlxs4xq.azurecr.io)')
param acrLoginServer string

@description('Existing Key Vault name (in existingServicesResourceGroup)')
param keyVaultName string

@description('Existing Key Vault URI (e.g. https://bhs-dev-kv-xxxx.vault.azure.net/)')
param keyVaultUri string

// ─── Existing Cognitive Services ──────────────────────────────────────────────
@description('Existing Azure Speech account name (in existingServicesResourceGroup)')
param speechAccountName string = ''

@description('Existing Azure AI Services account name (in existingServicesResourceGroup)')
param aiServicesAccountName string = ''

@description('Existing Azure OpenAI endpoint')
param openAiEndpoint string = ''

// ─── Existing PostgreSQL ───────────────────────────────────────────────────────
@description('Existing PostgreSQL Flexible Server FQDN')
param postgresHost string

@description('PostgreSQL database name')
param postgresDatabase string = 'bhs_dev'

@description('PostgreSQL user for api/dam workload')
param postgresUser string = 'bhs-api-dam'

@description('Resource group containing the existing PostgreSQL Flexible Server')
param postgresServerResourceGroup string = 'bhs-development-local-dam-public'

// ─── Azure AD / Entra ─────────────────────────────────────────────────────────
@description('Azure AD tenant ID for Entra authentication')
param azureAdTenantId string = subscription().tenantId

@description('Azure AD Client ID (frontend MSAL app registration)')
param azureAdClientId string

@description('Azure AD API Client ID (backend app registration)')
param azureAdApiClientId string

// ─── DAM image ────────────────────────────────────────────────────────────────
@description('DAM container image (full reference including tag)')
param damImage string = 'bhsdevelopmentacr4znv2wxlxs4xq.azurecr.io/bhs-dam-selfhost:latest'

// ─── Container image tags ─────────────────────────────────────────────────────
@description('Tag for bhs-web and bhs-api images')
param containerImageTag string = 'development'

// ─── Compute ─────────────────────────────────────────────────────────────────
var uniqueSuffix = uniqueString(subscription().subscriptionId, appName, environment)
var rgName = !empty(resourceGroupName) ? resourceGroupName : '${appName}-aks'

// Derived resource IDs for cross-RG private endpoints
var postgresServerName = split(postgresHost, '.')[0]
var keyVaultResourceId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${existingServicesResourceGroup}/providers/Microsoft.KeyVault/vaults/${keyVaultName}'
var postgresResourceId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${postgresServerResourceGroup}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${postgresServerName}'

// ─── Resource Group ───────────────────────────────────────────────────────────
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: rgName
  location: location
  tags: tags
}

// ─── Monitoring ───────────────────────────────────────────────────────────────
module appInsights './modules/app-insights.bicep' = {
  scope: rg
  name: 'aks-appinsights-deployment'
  params: {
    location: location
    appName: '${appName}-aks'
    environment: environment
    tags: tags
  }
}

// ─── Networking ──────────────────────────────────────────────────────────────
module networking './modules/aks-networking.bicep' = {
  scope: rg
  name: 'aks-networking-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    tags: tags
  }
}

// ─── Storage Account (AKS-dedicated) ─────────────────────────────────────────
module storage './modules/aks-storage.bicep' = {
  scope: rg
  name: 'aks-storage-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: networking.outputs.privateEndpointSubnetId
    vnetId: networking.outputs.vnetId
  }
}

// ─── Application Gateway (WAF_v2 shell — AGIC manages routing) ───────────────
module appGateway './modules/aks-appgateway.bicep' = {
  scope: rg
  name: 'aks-appgateway-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    tags: tags
    appGwSubnetId: networking.outputs.appGwSubnetId
    wafMode: 'Detection'
  }
}

// ─── AKS Cluster ─────────────────────────────────────────────────────────────
module aksCluster './modules/aks-cluster.bicep' = {
  scope: rg
  name: 'aks-cluster-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    aksNodesSubnetId: networking.outputs.aksNodesSubnetId
    applicationGatewayId: appGateway.outputs.appGatewayId
    logAnalyticsWorkspaceId: appInsights.outputs.logAnalyticsWorkspaceId
  }
}

// ─── RBAC Assignments (bhs-aks RG) ────────────────────────────────────────────
module rbac './modules/aks-rbac.bicep' = {
  scope: rg
  name: 'aks-rbac-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    tags: tags
    clusterPrincipalId: aksCluster.outputs.clusterPrincipalId
    agicPrincipalId: aksCluster.outputs.agicPrincipalId
    vnetResourceId: networking.outputs.vnetId
    aksStorageAccountId: storage.outputs.storageAccountId
    appGatewayResourceId: appGateway.outputs.appGatewayId
  }
}

// ─── Cross-RG RBAC (bhs-development-public: ACR, KV, CogServices) ────────────
resource existingServicesRg 'Microsoft.Resources/resourceGroups@2023-07-01' existing = {
  name: existingServicesResourceGroup
}

module crossRgRbac './modules/aks-rbac-crossrg.bicep' = {
  scope: existingServicesRg
  name: 'aks-rbac-crossrg-deployment'
  params: {
    kubeletPrincipalId: aksCluster.outputs.kubeletPrincipalId
    apiWorkloadUAMIPrincipalId: rbac.outputs.apiWorkloadIdentityPrincipalId
    appGwUAMIPrincipalId: appGateway.outputs.appGwIdentityPrincipalId
    acrName: acrName
    keyVaultName: keyVaultName
    speechAccountName: speechAccountName
    aiServicesAccountName: aiServicesAccountName
  }
}

// ─── Key Vault Private Endpoint (AKS VNet) ────────────────────────────────────
module kvPrivateEndpoint './modules/aks-keyvault-pe.bicep' = {
  scope: rg
  name: 'aks-keyvault-pe-deployment'
  params: {
    location: location
    tags: tags
    keyVaultId: keyVaultResourceId
    privateEndpointSubnetId: networking.outputs.privateEndpointSubnetId
    vnetId: networking.outputs.vnetId
  }
}

// ─── PostgreSQL Private Endpoint (AKS VNet) ───────────────────────────────────
module postgresPrivateEndpoint './modules/aks-postgres-pe.bicep' = {
  scope: rg
  name: 'aks-postgres-pe-deployment'
  params: {
    location: location
    tags: tags
    postgresServerId: postgresResourceId
    privateEndpointSubnetId: networking.outputs.privateEndpointSubnetId
    vnetId: networking.outputs.vnetId
  }
}

// ─── Outputs ─────────────────────────────────────────────────────────────────
@description('AKS cluster name')
output clusterName string = aksCluster.outputs.clusterName

@description('AKS cluster resource group')
output clusterResourceGroup string = rgName

@description('AKS OIDC issuer URL (used for Workload Identity federated credential)')
output oidcIssuerUrl string = aksCluster.outputs.oidcIssuerUrl

@description('API workload UAMI client ID (set as azure.workload.identity/client-id annotation on ServiceAccount)')
output apiWorkloadIdentityClientId string = rbac.outputs.apiWorkloadIdentityClientId

@description('API workload UAMI resource ID')
output apiWorkloadIdentityResourceId string = rbac.outputs.apiWorkloadIdentityResourceId

@description('Application Gateway public IP address')
output appGatewayPublicIp string = appGateway.outputs.publicIpAddress

@description('Application Gateway public FQDN')
output appGatewayFqdn string = appGateway.outputs.publicIpFqdn

@description('AKS storage account name')
output aksStorageAccountName string = storage.outputs.storageAccountName

@description('Application Insights connection string')
output appInsightsConnectionString string = appInsights.outputs.connectionString

// Pass-through values for Deploy-AKS.ps1 to inject into ConfigMap
output postgresHost string = postgresHost
output postgresDatabase string = postgresDatabase
output postgresUser string = postgresUser
output azureAdTenantId string = azureAdTenantId
output azureAdClientId string = azureAdClientId
output azureAdApiClientId string = azureAdApiClientId
output acrLoginServer string = acrLoginServer
output keyVaultUri string = keyVaultUri
output openAiEndpoint string = openAiEndpoint
output damImage string = damImage
output containerImageTag string = containerImageTag
output nodeResourceGroup string = aksCluster.outputs.nodeResourceGroup
output kubeletPrincipalId string = aksCluster.outputs.kubeletPrincipalId

@description('Subscription tenant ID — used by CSI driver to authenticate to Key Vault')
output keyVaultTenantId string = subscription().tenantId

@description('Application Gateway resource name (used by Deploy-AKS.ps1 to attach TLS certificate)')
output appGatewayName string = appGateway.outputs.appGatewayName

@description('Name of the TLS certificate as registered on the App Gateway (referenced by AGIC Ingress ssl-certificate annotation)')
output appGwTlsCertName string = appGateway.outputs.tlsCertName
