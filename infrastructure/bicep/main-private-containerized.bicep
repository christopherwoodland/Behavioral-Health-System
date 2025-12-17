targetScope = 'subscription'

@description('Environment name (dev, staging, prod)')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'prod'

@description('Azure region for resources')
param location string = 'eastus2'

@description('Application name prefix')
param appName string = 'bhs'

@description('Optional custom resource group name (defaults to appName-environment-private)')
param resourceGroupName string = ''

@description('Tags to apply to all resources')
param tags object = {
  Application: 'Behavioral Health System'
  Environment: environment
  ManagedBy: 'Bicep'
  NetworkMode: 'Private'
  DeploymentMode: 'ContainerApps-PrivateLink'
}

@description('Azure OpenAI endpoint (optional - AI Services endpoint used if not specified)')
param openaiEndpoint string = ''

@description('Container image tag')
param containerImageTag string = 'latest'

@description('Azure AD Client ID for MSAL authentication')
param azureAdClientId string = ''

@description('Azure AD API Client ID (Backend API app registration - defaults to same as frontend)')
param azureAdApiClientId string = ''

@description('Azure AD Tenant ID for Entra ID authentication (defaults to subscription tenant)')
param azureAdTenantId string = subscription().tenantId

// ============================================================================
// AZURE OPENAI REALTIME API PARAMETERS (UI)
// ============================================================================
@description('Azure OpenAI Realtime deployment name')
param azureOpenAIRealtimeDeployment string = 'gpt-realtime'

@description('Azure OpenAI Realtime API version')
param azureOpenAIRealtimeApiVersion string = '2025-04-01-preview'

@description('Azure OpenAI resource name for Realtime API')
param azureOpenAIResourceName string = ''

@description('Azure OpenAI WebRTC region')
param azureOpenAIWebRTCRegion string = 'eastus2'

@secure()
@description('Azure OpenAI Realtime API Key')
param azureOpenAIRealtimeKey string = ''

// ============================================================================
// AGENT CONFIGURATION PARAMETERS
// ============================================================================
@description('Extended Assessment OpenAI Deployment')
param extendedAssessmentDeployment string = 'gpt-5.2'

@description('Agent Model Deployment')
param agentModelDeployment string = 'gpt-5.2'

// ============================================================================
// SMART BAND CONFIGURATION
// ============================================================================
@description('Band Service URL for Smart Band integration')
param bandServiceUrl string = ''

@description('Enable Smart Band integration')
param enableSmartBand bool = false

// ============================================================================
// KINTSUGI API CONFIGURATION
// ============================================================================
@secure()
@description('Kintsugi API Key (stored in Key Vault)')
param kintsugiApiKey string = ''

@description('Kintsugi Base URL')
param kintsugiBaseUrl string = 'https://api.kintsugihealth.com/v2'

/*
================================================================================
PRIVATE CONTAINERIZED DEPLOYMENT ARCHITECTURE (VNet + Private Endpoints)
================================================================================

This Bicep template deploys the complete Behavioral Health System infrastructure
with PRIVATE network access using Azure Container Apps with VNet integration.

SECURITY FEATURES:
├─ All PaaS services have Private Endpoints
├─ Container Apps Environment with VNet integration
├─ Private DNS Zones for all services
├─ Network isolation with NSG rules
├─ Managed Identity authentication (no shared keys)
├─ RBAC-based access control

DEPLOYED SERVICES:
├─ Networking
│  ├─ Virtual Network (10.0.0.0/16)
│  │  ├─ container-apps-subnet (10.0.4.0/23) - Container Apps Environment
│  │  └─ private-endpoints-subnet (10.0.2.0/24) - All Private Endpoints
│  ├─ Network Security Groups
│  └─ Private DNS Zones (blob, vault, cognitiveservices, azurecr)
│
├─ Container Infrastructure
│  ├─ Azure Container Registry (Premium - for Private Endpoints)
│  │  └─ Private Endpoint
│  └─ Container Apps Environment (VNet Integrated)
│     ├─ UI Container App (React + Nginx)
│     └─ API Container App (.NET 8 Functions)
│
├─ Security & Storage
│  ├─ Key Vault (Private Endpoint, RBAC-enabled)
│  └─ Storage Account (Private Endpoint, Managed Identity auth)
│
├─ AI & ML Services
│  └─ Azure AI Services (multi-service account with Private Endpoint)
│     ├─ Azure OpenAI
│     ├─ Document Intelligence
│     ├─ Speech Services
│     └─ Content Understanding
│
└─ Monitoring & Logging
   ├─ Application Insights
   └─ Log Analytics Workspace

PRIVATE DNS ZONES CREATED:
├─ privatelink.blob.core.windows.net
├─ privatelink.queue.core.windows.net
├─ privatelink.table.core.windows.net
├─ privatelink.vaultcore.azure.net
├─ privatelink.cognitiveservices.azure.com
└─ privatelink.azurecr.io

================================================================================
*/

// Generate unique suffix for globally unique names
var uniqueSuffix = uniqueString(subscription().subscriptionId, appName, environment, deployment().name)
var rgName = !empty(resourceGroupName) ? resourceGroupName : '${appName}-${environment}-private'

// Create Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: rgName
  location: location
  tags: tags
}

// ============================================================================
// NETWORKING
// ============================================================================
module networking './modules/networking-private.bicep' = {
  scope: rg
  name: 'networking-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    tags: tags
  }
}

// ============================================================================
// PRIVATE DNS ZONES
// ============================================================================
module privateDns './modules/private-dns-zones.bicep' = {
  scope: rg
  name: 'private-dns-deployment'
  params: {
    vnetId: networking.outputs.vnetId
    tags: tags
  }
}

// ============================================================================
// APPLICATION INSIGHTS & LOG ANALYTICS
// ============================================================================
module appInsights './modules/app-insights.bicep' = {
  scope: rg
  name: 'appinsights-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    tags: tags
  }
}

// ============================================================================
// STORAGE ACCOUNT WITH PRIVATE ENDPOINT
// ============================================================================
module storage './modules/storage-private.bicep' = {
  scope: rg
  name: 'storage-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: networking.outputs.privateEndpointsSubnetId
    blobPrivateDnsZoneId: privateDns.outputs.blobPrivateDnsZoneId
    queuePrivateDnsZoneId: privateDns.outputs.queuePrivateDnsZoneId
    tablePrivateDnsZoneId: privateDns.outputs.tablePrivateDnsZoneId
  }
}

// ============================================================================
// KEY VAULT WITH PRIVATE ENDPOINT
// ============================================================================
module keyVault './modules/keyvault-private.bicep' = {
  scope: rg
  name: 'keyvault-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: networking.outputs.privateEndpointsSubnetId
    vaultPrivateDnsZoneId: privateDns.outputs.vaultPrivateDnsZoneId
    kintsugiApiKey: kintsugiApiKey
    azureOpenAIRealtimeKey: azureOpenAIRealtimeKey
  }
}

// ============================================================================
// AZURE CONTAINER REGISTRY WITH PRIVATE ENDPOINT
// ============================================================================
module acr './modules/acr-private.bicep' = {
  scope: rg
  name: 'acr-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: networking.outputs.privateEndpointsSubnetId
    acrPrivateDnsZoneId: privateDns.outputs.acrPrivateDnsZoneId
  }
}

// ============================================================================
// AZURE AI SERVICES WITH PRIVATE ENDPOINT
// ============================================================================
module aiServices './modules/ai-services-private.bicep' = {
  scope: rg
  name: 'ai-services-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: networking.outputs.privateEndpointsSubnetId
    cognitivePrivateDnsZoneId: privateDns.outputs.cognitivePrivateDnsZoneId
  }
}

// ============================================================================
// CONTAINER APPS ENVIRONMENT & APPS (VNET INTEGRATED)
// ============================================================================
module containerApps './modules/container-apps-private.bicep' = {
  scope: rg
  name: 'containerapps-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    containerAppsSubnetId: networking.outputs.containerAppsSubnetId
    logAnalyticsWorkspaceId: appInsights.outputs.logAnalyticsWorkspaceId
    acrName: acr.outputs.acrName
    acrLoginServer: acr.outputs.acrLoginServer
    storageAccountName: storage.outputs.storageAccountName
    appInsightsConnectionString: appInsights.outputs.connectionString
    keyVaultName: keyVault.outputs.keyVaultName
    keyVaultUri: keyVault.outputs.keyVaultUri
    aiServicesEndpoint: aiServices.outputs.aiServicesEndpoint
    openaiEndpoint: !empty(openaiEndpoint) ? openaiEndpoint : aiServices.outputs.aiServicesEndpoint
    azureAdClientId: azureAdClientId
    azureAdApiClientId: !empty(azureAdApiClientId) ? azureAdApiClientId : azureAdClientId
    tenantId: azureAdTenantId
    uiImageTag: containerImageTag
    apiImageTag: containerImageTag
    // Azure OpenAI Realtime API parameters
    azureOpenAIRealtimeDeployment: azureOpenAIRealtimeDeployment
    azureOpenAIRealtimeApiVersion: azureOpenAIRealtimeApiVersion
    azureOpenAIResourceName: azureOpenAIResourceName
    azureOpenAIWebRTCRegion: azureOpenAIWebRTCRegion
    // Agent configuration
    extendedAssessmentDeployment: extendedAssessmentDeployment
    agentModelDeployment: agentModelDeployment
    // Kintsugi configuration
    kintsugiBaseUrl: kintsugiBaseUrl
    // Smart Band configuration
    bandServiceUrl: bandServiceUrl
    enableSmartBand: enableSmartBand
  }
}

// ============================================================================
// RBAC ASSIGNMENTS
// ============================================================================
module rbacAssignments './modules/rbac-assignments-private.bicep' = {
  scope: rg
  name: 'rbac-assignments'
  params: {
    uiAppPrincipalId: containerApps.outputs.uiAppPrincipalId
    apiAppPrincipalId: containerApps.outputs.apiAppPrincipalId
    aiServicesName: aiServices.outputs.aiServicesName
    storageAccountName: storage.outputs.storageAccountName
    keyVaultName: keyVault.outputs.keyVaultName
    acrName: acr.outputs.acrName
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================
output resourceGroupName string = rgName
output vnetName string = networking.outputs.vnetName
output vnetId string = networking.outputs.vnetId

// Storage
output storageAccountName string = storage.outputs.storageAccountName
output storageAccountId string = storage.outputs.storageAccountId

// Key Vault
output keyVaultName string = keyVault.outputs.keyVaultName
output keyVaultUri string = keyVault.outputs.keyVaultUri

// Container Registry
output acrName string = acr.outputs.acrName
output acrLoginServer string = acr.outputs.acrLoginServer

// AI Services
output aiServicesName string = aiServices.outputs.aiServicesName
output aiServicesEndpoint string = aiServices.outputs.aiServicesEndpoint

// Container Apps
output containerAppsEnvName string = containerApps.outputs.containerAppsEnvName
output uiAppName string = containerApps.outputs.uiAppName
output uiAppUrl string = containerApps.outputs.uiAppUrl
output uiAppPrincipalId string = containerApps.outputs.uiAppPrincipalId
output apiAppName string = containerApps.outputs.apiAppName
output apiAppUrl string = containerApps.outputs.apiAppUrl
output apiAppPrincipalId string = containerApps.outputs.apiAppPrincipalId

// Monitoring
output appInsightsConnectionString string = appInsights.outputs.connectionString
output logAnalyticsWorkspaceId string = appInsights.outputs.logAnalyticsWorkspaceId
