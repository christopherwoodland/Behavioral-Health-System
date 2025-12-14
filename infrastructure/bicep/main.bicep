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

@description('Your IP address for Key Vault firewall (for initial setup)')
param deploymentClientIP string

@description('Optional custom resource group name (defaults to appName-environment-rg)')
param resourceGroupName string = ''

@description('Tags to apply to all resources')
param tags object = {
  Application: 'Behavioral Health System'
  Environment: environment
  ManagedBy: 'Bicep'
}

@description('Optional: deploy Container Apps resources (e.g., GitHub runners). Default false; core template does not deploy them when false or when module is disabled.')
param deployContainerApps bool = false

@description('Azure OpenAI endpoint (optional - configure manually after deployment)')
param openaiEndpoint string = ''

/*
================================================================================
DEPLOYMENT ARCHITECTURE
================================================================================

This Bicep template deploys the complete Behavioral Health System infrastructure
with the following services:

ACTIVE SERVICES (Deployed):
├─ Networking
│  └─ VNet (10.0.0.0/16) with delegated subnets for Function App and Web App
│
├─ Security & Storage
│  ├─ Key Vault (secrets/keys with private endpoint)
│  └─ Storage Account (blob storage with private endpoint)
│
├─ Backend APIs
│  └─ Flex Consumption Function App (FC1)
│     ├─ .NET 8 isolated runtime
│     ├─ VNet integration for secure network access
│     ├─ Private endpoint for secure Function invocation
│     ├─ System-assigned managed identity
│     └─ Automatic RBAC setup for Network Contributor role
│
├─ Frontend UI
│  └─ App Service (Web App)
│     ├─ Linux Node.js 20 runtime
│     ├─ VNet integration for secure network access
│     ├─ MSAL authentication configured
│     └─ System-assigned managed identity
│
├─ AI & ML Services
│  ├─ Azure OpenAI (GPT-4 models with private endpoint)
│  ├─ Document Intelligence (form processing with private endpoint)
│  └─ Content Understanding API (private endpoint)
│
├─ Monitoring & Logging
│  ├─ Application Insights (performance monitoring)
│  └─ Log Analytics Workspace
│
└─ Networking
   └─ Private DNS Zones (for all private endpoint resolutions)

OPTIONAL SERVICES (Deploy with flag):
└─ Container Apps (GitHub runners - deploy with -DeployContainerApps $true)

VNet SUBNETS:
- app-subnet (10.0.1.0/24)
  └─ Delegated to Microsoft.App/environments
  └─ Used for Function App VNet integration

- private-endpoint-subnet (10.0.2.0/24)
  └─ Used for all service private endpoints
  └─ Non-delegated (required for private endpoint creation)

- container-apps-subnet (10.0.4.0/23)
  └─ Reserved for Container Apps deployment

- webapp-subnet (10.0.6.0/24)
  └─ Delegated to Microsoft.Web/serverFarms
  └─ Used for Web App VNet integration

================================================================================
*/

// Generate unique suffix for globally unique names (includes deployment timestamp to avoid conflicts with soft-deleted resources)
var uniqueSuffix = uniqueString(subscription().subscriptionId, appName, environment, deployment().name)
var rgName = !empty(resourceGroupName) ? resourceGroupName : '${appName}-${environment}-rg'

// Create Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: rgName
  location: location
  tags: tags
}

// Deploy Networking (VNet, Subnets, NSGs)
module networking './modules/networking.bicep' = {
  scope: rg
  name: 'networking-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    tags: tags
  }
}

// Deploy Key Vault with Private Endpoint
module keyVault './modules/keyvault.bicep' = {
  scope: rg
  name: 'keyvault-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: networking.outputs.privateEndpointSubnetId
    deploymentClientIP: deploymentClientIP
  }
}

// Deploy Storage Account with Private Endpoint
module storage './modules/storage.bicep' = {
  scope: rg
  name: 'storage-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: networking.outputs.privateEndpointSubnetId
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

// NOTE: Azure OpenAI is NOT deployed by this template.
// Deploy OpenAI/AI Foundry Hub manually and provide the endpoint via parameter.

// Deploy Cognitive Services (Document Intelligence)
module cognitive './modules/cognitive.bicep' = {
  scope: rg
  name: 'cognitive-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: networking.outputs.privateEndpointSubnetId
  }
}

// Deploy Function App with VNet Integration
module functionApp './modules/function-app.bicep' = {
  scope: rg
  name: 'functionapp-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    appSubnetId: networking.outputs.appSubnetId
    privateEndpointSubnetId: networking.outputs.privateEndpointSubnetId
    storageAccountName: storage.outputs.storageAccountName
    appInsightsConnectionString: appInsights.outputs.connectionString
    appInsightsInstrumentationKey: appInsights.outputs.instrumentationKey
    keyVaultName: keyVault.outputs.keyVaultName
    openaiEndpoint: openaiEndpoint
    documentIntelligenceEndpoint: cognitive.outputs.documentIntelligenceEndpoint
    contentUnderstandingEndpoint: cognitive.outputs.contentUnderstandingEndpoint
  }
}

// Deploy Web App for React UI with VNet Integration
module webApp './modules/app-service-web.bicep' = {
  scope: rg
  name: 'webapp-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    functionAppUrl: functionApp.outputs.functionAppUrl
    enableVNetIntegration: true
    appSubnetId: networking.outputs.webappSubnetId
  }
}

// Deploy Static Web App for React Frontend
// NOTE: Temporarily disabled due to transient Azure CLI JSON parsing issues during long deployments.
// This will be deployed in a separate step after core infrastructure is stable.
/*
module staticWebApp './modules/static-web-app.bicep' = {
  scope: rg
  name: 'staticwebapp-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    tags: tags
    functionAppUrl: functionApp.outputs.functionAppUrl
  }
}
*/

// Deploy Container Apps Environment for GitHub Runners when enabled
module containerApps './modules/container-apps.bicep' = if (deployContainerApps) {
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
  }
}

// Deploy Private DNS Zones
module privateDns './modules/private-dns.bicep' = {
  scope: rg
  name: 'privatedns-deployment'
  params: {
    vnetId: networking.outputs.vnetId
    keyVaultName: keyVault.outputs.keyVaultName
    storageAccountName: storage.outputs.storageAccountName
    documentIntelligenceName: cognitive.outputs.documentIntelligenceName
    functionAppName: functionApp.outputs.functionAppName
  }
}

// Assign RBAC roles for managed identity authentication
module rbacAssignments './modules/rbac-assignments.bicep' = {
  scope: rg
  name: 'rbac-assignments'
  params: {
    functionAppPrincipalId: functionApp.outputs.principalId
    webAppPrincipalId: webApp.outputs.webAppPrincipalId
    documentIntelligenceName: cognitive.outputs.documentIntelligenceName
    storageAccountName: storage.outputs.storageAccountName
    keyVaultName: keyVault.outputs.keyVaultName
  }
  dependsOn: [
    functionApp
    webApp
    cognitive
    storage
    keyVault
  ]
}

// Outputs
output resourceGroupName string = rgName
output vnetId string = networking.outputs.vnetId
output keyVaultName string = keyVault.outputs.keyVaultName
output keyVaultUri string = keyVault.outputs.keyVaultUri
output storageAccountName string = storage.outputs.storageAccountName
output functionAppName string = functionApp.outputs.functionAppName
output functionAppPrincipalId string = functionApp.outputs.principalId
output functionAppUrl string = functionApp.outputs.functionAppUrl
output functionAppPrivateEndpointId string = functionApp.outputs.privateEndpointId
output webAppName string = webApp.outputs.webAppName
output webAppUrl string = webApp.outputs.webAppUrl
output webAppPrincipalId string = webApp.outputs.webAppPrincipalId
// Container Apps optional outputs (empty when not deployed)
output containerAppsEnvName string = deployContainerApps ? '${appName}-${environment}-cae-${uniqueSuffix}' : ''
output githubRunnerAppName string = deployContainerApps ? '${appName}-${environment}-runner-${uniqueSuffix}' : ''
output documentIntelligenceEndpoint string = cognitive.outputs.documentIntelligenceEndpoint
output documentIntelligenceName string = cognitive.outputs.documentIntelligenceName
output contentUnderstandingEndpoint string = cognitive.outputs.contentUnderstandingEndpoint
output contentUnderstandingName string = cognitive.outputs.contentUnderstandingName
output appInsightsConnectionString string = appInsights.outputs.connectionString
