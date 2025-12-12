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
    vnetId: networking.outputs.vnetId
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
    vnetId: networking.outputs.vnetId
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

// Deploy Azure OpenAI with Private Endpoint
module openai './modules/openai.bicep' = {
  scope: rg
  name: 'openai-deployment'
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    vnetId: networking.outputs.vnetId
    privateEndpointSubnetId: networking.outputs.privateEndpointSubnetId
  }
}

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
    vnetId: networking.outputs.vnetId
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
    vnetId: networking.outputs.vnetId
    appSubnetId: networking.outputs.appSubnetId
    storageAccountName: storage.outputs.storageAccountName
    appInsightsConnectionString: appInsights.outputs.connectionString
    keyVaultName: keyVault.outputs.keyVaultName
    openaiEndpoint: openai.outputs.endpoint
    documentIntelligenceEndpoint: cognitive.outputs.documentIntelligenceEndpoint
    contentUnderstandingEndpoint: cognitive.outputs.contentUnderstandingEndpoint
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

// Deploy Container Apps Environment for GitHub Runners (Temporarily disabled - deploy separately after main infrastructure)
// module containerApps './modules/container-apps.bicep' = {
//   scope: rg
//   name: 'containerapps-deployment'
//   params: {
//     location: location
//     appName: appName
//     environment: environment
//     uniqueSuffix: uniqueSuffix
//     tags: tags
//     vnetId: networking.outputs.vnetId
//     containerAppsSubnetId: networking.outputs.containerAppsSubnetId
//     logAnalyticsWorkspaceId: appInsights.outputs.logAnalyticsWorkspaceId
//   }
// }

// Deploy Private DNS Zones
module privateDns './modules/private-dns.bicep' = {
  scope: rg
  name: 'privatedns-deployment'
  params: {
    vnetId: networking.outputs.vnetId
    keyVaultName: keyVault.outputs.keyVaultName
    storageAccountName: storage.outputs.storageAccountName
    openaiAccountName: openai.outputs.openaiAccountName
    documentIntelligenceName: cognitive.outputs.documentIntelligenceName
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
// output containerAppsEnvName string = containerApps.outputs.containerAppsEnvName
// output githubRunnerAppName string = containerApps.outputs.githubRunnerAppName
// output staticWebAppName string = staticWebApp.outputs.staticWebAppName
// output staticWebAppUrl string = staticWebApp.outputs.defaultHostname
output openaiEndpoint string = openai.outputs.endpoint
output documentIntelligenceEndpoint string = cognitive.outputs.documentIntelligenceEndpoint
output appInsightsConnectionString string = appInsights.outputs.connectionString
