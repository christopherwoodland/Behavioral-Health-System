@description('Azure region for resources')
param location string

@description('Application name prefix')
param appName string

@description('Environment name')
param environment string

@description('Resource tags')
param tags object

@description('Function App URL for CORS')
param functionAppUrl string

var staticWebAppName = '${appName}-${environment}-web'
// NOTE: login.microsoftonline.com is the standard Azure AD endpoint and is not cloud-specific.
// It's safe to hardcode in application configuration and environment variables.
#disable-next-line no-hardcoded-env-urls
var authorityEndpoint = 'https://login.microsoftonline.com/'

// Static Web App (for React frontend)
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    provider: 'GitHub'
    branch: 'main'
    repositoryUrl: ''
    buildProperties: {
      appLocation: 'BehavioralHealthSystem.Web'
      apiLocation: ''
      outputLocation: 'dist'
      appBuildCommand: 'npm run build'
      skipGithubActionWorkflowGeneration: false
    }
  }
}

// Static Web App config for environment variables
resource staticWebAppConfig 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    VITE_API_BASE_URL: functionAppUrl
    VITE_ENABLE_ENTRA_AUTH: 'true'
    VITE_AZURE_CLIENT_ID: '63e9b3fd-de9d-4083-879c-9c13f3aac54d'
    VITE_AZURE_TENANT_ID: '3d6eb90f-fb5d-4624-99d7-1b8c4e077d07'
    VITE_AZURE_AUTHORITY: '${authorityEndpoint}3d6eb90f-fb5d-4624-99d7-1b8c4e077d07'
  }
}

output staticWebAppName string = staticWebApp.name
output staticWebAppId string = staticWebApp.id
output defaultHostname string = staticWebApp.properties.defaultHostname
