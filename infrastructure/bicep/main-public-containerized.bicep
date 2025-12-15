targetScope = 'subscription'

@description('Environment name (dev, staging, prod)')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'dev'

@description('Azure region for resources')
param location string = 'eastus2'

@description('Application name prefix')
param appName string = 'bhs'

@description('Optional custom resource group name (defaults to appName-environment-rg)')
param resourceGroupName string = ''

@description('Tags to apply to all resources')
param tags object = {
  Application: 'Behavioral Health System'
  Environment: environment
  ManagedBy: 'Bicep'
  NetworkMode: 'Public'
  DeploymentMode: 'ContainerApps'
}

@description('Azure OpenAI endpoint (optional - configure manually after deployment)')
param openaiEndpoint string = ''

@description('Container image tag')
param containerImageTag string = 'latest'

@description('Azure AD Client ID for MSAL authentication')
param azureAdClientId string = ''

@description('Azure Container Registry name (must be pre-deployed with images)')
param acrName string

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

/*
================================================================================
PUBLIC CONTAINERIZED DEPLOYMENT ARCHITECTURE (No VNet / Private Endpoints)
================================================================================

This Bicep template deploys the complete Behavioral Health System infrastructure
with PUBLIC network access using Azure Container Apps for hosting.

DEPLOYED SERVICES:
├─ Container Infrastructure
│  ├─ Azure Container Registry (ACR)
│  └─ Container Apps Environment
│     ├─ UI Container App (React + Nginx)
│     └─ API Container App (.NET 8 Functions)
│
├─ Security & Storage
│  ├─ Key Vault (public access, RBAC-enabled)
│  └─ Storage Account (public access for blob storage)
│
├─ AI & ML Services
│  ├─ Azure OpenAI (public endpoint - deploy separately)
│  ├─ Document Intelligence (public endpoint)
│  └─ Content Understanding / AI Services (public endpoint)
│
└─ Monitoring & Logging
   ├─ Application Insights
   └─ Log Analytics Workspace

CONTAINER IMAGES REQUIRED:
├─ bhs-ui:latest    - React frontend with Nginx
└─ bhs-api:latest   - .NET 8 isolated Functions

DIFFERENCES FROM APP SERVICE VERSION:
├─ Uses Container Apps instead of App Service Web + Function App
├─ Requires pre-built container images in ACR
├─ Auto-scaling with HTTP-based rules
└─ Environment variables injected at container runtime

================================================================================
*/

// Generate unique suffix for globally unique names
var uniqueSuffix = uniqueString(subscription().subscriptionId, appName, environment, deployment().name)
var rgName = !empty(resourceGroupName) ? resourceGroupName : '${appName}-${environment}-rg'

// Create Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: rgName
  location: location
  tags: tags
}

// Deploy Key Vault (Public)
module keyVault './modules/keyvault-public.bicep' = {
  scope: rg
  name: 'keyvault-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
  }
}

// Deploy Storage Account (Public)
module storage './modules/storage-public.bicep' = {
  scope: rg
  name: 'storage-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
  }
}

// Deploy Application Insights
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

// Deploy Cognitive Services (Public)
module cognitive './modules/cognitive-public.bicep' = {
  scope: rg
  name: 'cognitive-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
  }
}

// Deploy Container Apps (UI + API)
module containerApps './modules/container-apps-public.bicep' = {
  scope: rg
  name: 'containerapps-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    logAnalyticsWorkspaceId: appInsights.outputs.logAnalyticsWorkspaceId
    acrName: acrName
    storageAccountName: storage.outputs.storageAccountName
    appInsightsConnectionString: appInsights.outputs.connectionString
    keyVaultName: keyVault.outputs.keyVaultName
    openaiEndpoint: openaiEndpoint
    documentIntelligenceEndpoint: cognitive.outputs.documentIntelligenceEndpoint
    contentUnderstandingEndpoint: cognitive.outputs.contentUnderstandingEndpoint
    azureAdClientId: azureAdClientId
    uiImageTag: containerImageTag
    apiImageTag: containerImageTag
    // Azure OpenAI Realtime API parameters
    azureOpenAIRealtimeDeployment: azureOpenAIRealtimeDeployment
    azureOpenAIRealtimeApiVersion: azureOpenAIRealtimeApiVersion
    azureOpenAIResourceName: azureOpenAIResourceName
    azureOpenAIWebRTCRegion: azureOpenAIWebRTCRegion
    azureOpenAIRealtimeKey: azureOpenAIRealtimeKey
    // Agent configuration
    extendedAssessmentDeployment: extendedAssessmentDeployment
    agentModelDeployment: agentModelDeployment
    // Smart Band configuration
    bandServiceUrl: bandServiceUrl
    enableSmartBand: enableSmartBand
  }
}

// Assign RBAC roles for Container Apps managed identities
module rbacAssignments './modules/rbac-assignments-containerapp.bicep' = {
  scope: rg
  name: 'rbac-assignments'
  params: {
    uiAppPrincipalId: containerApps.outputs.uiAppPrincipalId
    apiAppPrincipalId: containerApps.outputs.apiAppPrincipalId
    documentIntelligenceName: cognitive.outputs.documentIntelligenceName
    contentUnderstandingName: cognitive.outputs.contentUnderstandingName
    storageAccountName: storage.outputs.storageAccountName
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// Outputs
output resourceGroupName string = rgName
output keyVaultName string = keyVault.outputs.keyVaultName
output keyVaultUri string = keyVault.outputs.keyVaultUri
output storageAccountName string = storage.outputs.storageAccountName
output acrName string = containerApps.outputs.acrName
output acrLoginServer string = containerApps.outputs.acrLoginServer
output containerAppsEnvName string = containerApps.outputs.containerAppsEnvName
output uiAppName string = containerApps.outputs.uiAppName
output uiAppUrl string = containerApps.outputs.uiAppUrl
output uiAppPrincipalId string = containerApps.outputs.uiAppPrincipalId
output apiAppName string = containerApps.outputs.apiAppName
output apiAppUrl string = containerApps.outputs.apiAppUrl
output apiAppPrincipalId string = containerApps.outputs.apiAppPrincipalId
output documentIntelligenceEndpoint string = cognitive.outputs.documentIntelligenceEndpoint
output documentIntelligenceName string = cognitive.outputs.documentIntelligenceName
output contentUnderstandingEndpoint string = cognitive.outputs.contentUnderstandingEndpoint
output contentUnderstandingName string = cognitive.outputs.contentUnderstandingName
output appInsightsConnectionString string = appInsights.outputs.connectionString
