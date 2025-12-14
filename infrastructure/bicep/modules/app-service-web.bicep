@description('Azure region for resources')
param location string

@description('Application name prefix')
param appName string

@description('Environment name')
param environment string

@description('Unique suffix for global names')
param uniqueSuffix string

@description('Resource tags')
param tags object

@description('Function App URL for API backend')
param functionAppUrl string

@description('Optional: App Service Plan ID to share with existing plan. If empty, creates a new plan.')
param existingAppServicePlanId string = ''

@description('Enable VNet integration (only when subnet ID is provided)')
param enableVNetIntegration bool = false

@description('Optional: Subnet ID for VNet integration')
param appSubnetId string = ''

var webAppName = '${appName}-${environment}-web-${uniqueSuffix}'
var appServicePlanName = '${appName}-${environment}-web-asp-${uniqueSuffix}'
// NOTE: login.microsoftonline.com is the standard Azure AD endpoint
#disable-next-line no-hardcoded-env-urls
var authorityEndpoint = 'https://login.microsoftonline.com/'

// App Service Plan for Web App (create if not using existing plan)
resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = if (empty(existingAppServicePlanId)) {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'P1v2'
    tier: 'PremiumV2'
    capacity: 1
  }
  properties: {
    reserved: true // Required for Linux
  }
}

// Web App for React UI
resource webApp 'Microsoft.Web/sites@2024-04-01' = {
  name: webAppName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: empty(existingAppServicePlanId) ? appServicePlan.id : existingAppServicePlanId
    httpsOnly: true
    virtualNetworkSubnetId: enableVNetIntegration && !empty(appSubnetId) ? appSubnetId : null
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'VITE_API_BASE_URL'
          value: functionAppUrl
        }
        {
          name: 'VITE_ENABLE_ENTRA_AUTH'
          value: 'true'
        }
        {
          name: 'VITE_AZURE_CLIENT_ID'
          value: '63e9b3fd-de9d-4083-879c-9c13f3aac54d'
        }
        {
          name: 'VITE_AZURE_TENANT_ID'
          value: '3d6eb90f-fb5d-4624-99d7-1b8c4e077d07'
        }
        {
          name: 'VITE_AZURE_AUTHORITY'
          value: '${authorityEndpoint}3d6eb90f-fb5d-4624-99d7-1b8c4e077d07'
        }
      ]
      cors: {
        allowedOrigins: [
          'https://${webAppName}.azurewebsites.net'
        ]
        supportCredentials: true
      }
    }
  }
}

// Web app logging configuration
resource webAppLogs 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: webApp
  name: 'logs'
  properties: {
    applicationLogs: {
      fileSystem: {
        level: 'Information'
      }
    }
    httpLogs: {
      fileSystem: {
        enabled: true
        retentionInDays: 7
        retentionInMb: 35
      }
    }
    detailedErrorMessages: {
      enabled: true
    }
    failedRequestsTracing: {
      enabled: true
    }
  }
}

output webAppName string = webApp.name
output webAppId string = webApp.id
output webAppPrincipalId string = webApp.identity.principalId
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output defaultHostname string = webApp.properties.defaultHostName
