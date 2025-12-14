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

@description('Storage account name')
param storageAccountName string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Application Insights instrumentation key')
param appInsightsInstrumentationKey string

@description('Key Vault name')
param keyVaultName string

@description('Azure OpenAI endpoint')
param openaiEndpoint string

@description('Document Intelligence endpoint')
param documentIntelligenceEndpoint string

@description('Content Understanding endpoint')
param contentUnderstandingEndpoint string

@description('Web App URL for CORS (optional)')
param webAppUrl string = ''

var functionAppName = '${appName}-${environment}-func-${uniqueSuffix}'
var appServicePlanName = '${appName}-${environment}-asp-${uniqueSuffix}'

// Get storage account resource
resource storageAccountResource 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

// App Service Plan (Consumption plan for public deployment - cost-effective)
resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true // Required for Linux
  }
}

// Function App (Public - no VNet integration or private endpoints)
resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    siteConfig: {
      linuxFxVersion: 'DOTNET-ISOLATED|8.0'
      alwaysOn: false // Consumption plan doesn't support AlwaysOn
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      use32BitWorkerProcess: false
      cors: {
        allowedOrigins: union([
          'https://portal.azure.com'
        ], !empty(webAppUrl) ? [webAppUrl] : [])
        supportCredentials: true
      }
      appSettings: [
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'dotnet-isolated'
        }
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${storageAccountResource.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'KEY_VAULT_URI'
          #disable-next-line no-hardcoded-env-urls
          value: 'https://${keyVaultName}.vault.azure.net/'
        }
        {
          name: 'AZURE_TENANT_ID'
          value: subscription().tenantId
        }
        {
          name: 'AZURE_CLIENT_ID'
          value: '63e9b3fd-de9d-4083-879c-9c13f3aac54d'
        }
        {
          name: 'DSM5_STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
        {
          name: 'DSM5_CONTAINER_NAME'
          value: 'dsm5-data'
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: openaiEndpoint
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT'
          value: 'gpt-4.1'
        }
        {
          name: 'AZURE_OPENAI_API_VERSION'
          value: '2024-12-01-preview'
        }
        {
          name: 'GPT_REALTIME_ENDPOINT'
          value: openaiEndpoint
        }
        {
          name: 'GPT_REALTIME_DEPLOYMENT'
          value: 'gpt-realtime'
        }
        {
          name: 'GPT_REALTIME_API_VERSION'
          value: '2025-04-01-preview'
        }
        {
          name: 'EXTENDED_ASSESSMENT_OPENAI_ENDPOINT'
          value: openaiEndpoint
        }
        {
          name: 'EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT'
          value: 'gpt-4.1'
        }
        {
          name: 'EXTENDED_ASSESSMENT_OPENAI_API_VERSION'
          value: '2024-12-01-preview'
        }
        {
          name: 'EXTENDED_ASSESSMENT_OPENAI_MAX_TOKENS'
          value: '4000'
        }
        {
          name: 'EXTENDED_ASSESSMENT_OPENAI_TEMPERATURE'
          value: '0.2'
        }
        {
          name: 'EXTENDED_ASSESSMENT_OPENAI_TIMEOUT_SECONDS'
          value: '120'
        }
        {
          name: 'EXTENDED_ASSESSMENT_USE_FALLBACK'
          value: 'false'
        }
        {
          name: 'DocumentIntelligenceEndpoint'
          value: documentIntelligenceEndpoint
        }
        {
          name: 'AZURE_CONTENT_UNDERSTANDING_ENDPOINT'
          value: contentUnderstandingEndpoint
        }
        {
          name: 'DSM5_EXTRACTION_METHOD'
          value: 'CONTENT_UNDERSTANDING'
        }
        {
          name: 'KINTSUGI_BASE_URL'
          value: 'https://api.kintsugihealth.com/v2'
        }
        {
          // Reference Kintsugi API key from Key Vault
          name: 'KINTSUGI_API_KEY'
          #disable-next-line no-hardcoded-env-urls
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/KintsugiApiKey/)'
        }
        {
          name: 'KINTSUGI_AUTO_PROVIDE_CONSENT'
          value: 'false'
        }
        {
          name: 'KINTSUGI_TIMEOUT_SECONDS'
          value: '300'
        }
        {
          name: 'KINTSUGI_MAX_RETRY_ATTEMPTS'
          value: '3'
        }
        {
          name: 'KINTSUGI_RETRY_DELAY_MS'
          value: '1000'
        }
        {
          // Reference Azure Speech key from Key Vault
          name: 'AZURE_SPEECH_KEY'
          #disable-next-line no-hardcoded-env-urls
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/AzureSpeechKey/)'
        }
        {
          name: 'AZURE_SPEECH_REGION'
          value: 'eastus2'
        }
        {
          name: 'AZURE_SPEECH_ENDPOINT'
          value: 'https://eastus2.api.cognitive.microsoft.com'
        }
        {
          name: 'AZURE_SPEECH_LOCALE'
          value: 'en-US'
        }
        {
          name: 'AZURE_SPEECH_API_VERSION'
          value: '2024-11-15'
        }
        {
          name: 'AGENT_MODE_ENABLED'
          value: 'true'
        }
        {
          name: 'AZURE_OPENAI_ENABLED'
          value: 'true'
        }
        {
          name: 'EXTENDED_ASSESSMENT_OPENAI_ENABLED'
          value: 'true'
        }
      ]
    }
  }
}

output functionAppName string = functionApp.name
output functionAppId string = functionApp.id
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output principalId string = functionApp.identity.principalId
