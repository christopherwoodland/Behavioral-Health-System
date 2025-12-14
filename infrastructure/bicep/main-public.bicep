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
}

/*
================================================================================
PUBLIC DEPLOYMENT ARCHITECTURE (No VNet / Private Endpoints)
================================================================================

This Bicep template deploys the complete Behavioral Health System infrastructure
with PUBLIC network access. All services are accessible over the internet.

DEPLOYED SERVICES:
├─ Security & Storage
│  ├─ Key Vault (public access, RBAC-enabled)
│  └─ Storage Account (public access for blob storage)
│
├─ Backend APIs
│  └─ Consumption Plan Function App
│     ├─ .NET 8 isolated runtime
│     ├─ Public endpoint
│     ├─ System-assigned managed identity
│     └─ RBAC for all service access
│
├─ Frontend UI
│  └─ App Service (Linux Node.js 20)
│     ├─ React application hosting
│     ├─ MSAL authentication configured
│     └─ CORS configured for API access
│
├─ AI & ML Services
│  ├─ Azure OpenAI (public endpoint)
│  ├─ Document Intelligence (public endpoint)
│  └─ Content Understanding / AI Services (public endpoint)
│
└─ Monitoring & Logging
   ├─ Application Insights
   └─ Log Analytics Workspace

NOT DEPLOYED (Compared to VNet version):
├─ VNet / Subnets
├─ Private Endpoints
├─ Private DNS Zones
└─ Container Apps (not needed without VNet)

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

// Deploy Azure OpenAI (Public)
module openai './modules/openai-public.bicep' = {
  scope: rg
  name: 'openai-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
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

// Deploy Function App (Public - no VNet integration)
module functionApp './modules/function-app-public.bicep' = {
  scope: rg
  name: 'functionapp-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    storageAccountName: storage.outputs.storageAccountName
    appInsightsConnectionString: appInsights.outputs.connectionString
    appInsightsInstrumentationKey: appInsights.outputs.instrumentationKey
    keyVaultName: keyVault.outputs.keyVaultName
    openaiEndpoint: openai.outputs.endpoint
    documentIntelligenceEndpoint: cognitive.outputs.documentIntelligenceEndpoint
    contentUnderstandingEndpoint: cognitive.outputs.contentUnderstandingEndpoint
    webAppUrl: webApp.outputs.webAppUrl
  }
}

// Deploy Web App for React UI
module webApp './modules/app-service-web.bicep' = {
  scope: rg
  name: 'webapp-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    functionAppUrl: 'https://${appName}-${environment}-func-${uniqueSuffix}.azurewebsites.net'
    enableVNetIntegration: false
  }
}

// Assign RBAC roles for managed identity authentication
module rbacAssignments './modules/rbac-assignments-public.bicep' = {
  scope: rg
  name: 'rbac-assignments'
  params: {
    functionAppPrincipalId: functionApp.outputs.principalId
    webAppPrincipalId: webApp.outputs.webAppPrincipalId
    openaiAccountName: openai.outputs.openaiAccountName
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
output functionAppName string = functionApp.outputs.functionAppName
output functionAppPrincipalId string = functionApp.outputs.principalId
output functionAppUrl string = functionApp.outputs.functionAppUrl
output webAppName string = webApp.outputs.webAppName
output webAppUrl string = webApp.outputs.webAppUrl
output webAppPrincipalId string = webApp.outputs.webAppPrincipalId
output openaiEndpoint string = openai.outputs.endpoint
output openaiAccountName string = openai.outputs.openaiAccountName
output documentIntelligenceEndpoint string = cognitive.outputs.documentIntelligenceEndpoint
output documentIntelligenceName string = cognitive.outputs.documentIntelligenceName
output contentUnderstandingEndpoint string = cognitive.outputs.contentUnderstandingEndpoint
output contentUnderstandingName string = cognitive.outputs.contentUnderstandingName
output appInsightsConnectionString string = appInsights.outputs.connectionString
