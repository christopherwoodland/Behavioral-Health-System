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

@description('VNet ID')
param vnetId string

@description('App subnet ID for VNet integration')
param appSubnetId string

@description('Storage account name')
param storageAccountName string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Key Vault name')
param keyVaultName string

@description('Azure OpenAI endpoint')
param openaiEndpoint string

@description('Document Intelligence endpoint')
param documentIntelligenceEndpoint string

@description('Content Understanding endpoint')
param contentUnderstandingEndpoint string

var functionAppName = '${appName}-${environment}-func-${uniqueSuffix}'
var appServicePlanName = '${appName}-${environment}-asp-${uniqueSuffix}'

// App Service Plan (Consumption Y1 - pay-per-use serverless, available in all regions)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
  properties: {
    maximumElasticWorkerCount: 20
  }
}

// Function App
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
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
    siteConfig: {
      linuxFxVersion: 'DOTNET-ISOLATED|8.0'
      alwaysOn: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      use32BitWorkerProcess: false
      cors: {
        allowedOrigins: [
          'https://portal.azure.com'
        ]
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
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=listKeys(resourceId(\'Microsoft.Storage/storageAccounts\', storageAccountName), \'2021-09-01\').keys[0].value;EndpointSuffix=core.windows.net'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=listKeys(resourceId(\'Microsoft.Storage/storageAccounts\', storageAccountName), \'2021-09-01\').keys[0].value;EndpointSuffix=core.windows.net'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'KEY_VAULT_URI'
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
