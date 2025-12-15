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

@description('App subnet ID for VNet integration')
param appSubnetId string

@description('Private endpoint subnet ID')
param privateEndpointSubnetId string

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

var functionAppName = '${appName}-${environment}-func-${uniqueSuffix}'
var appServicePlanName = '${appName}-${environment}-asp-${uniqueSuffix}'

// Get storage account key using resource ID
resource storageAccountResource 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

// App Service Plan (Flex Consumption - serverless with VNet integration, available in eastus)
resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

// Function App
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
    virtualNetworkSubnetId: appSubnetId
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageAccountResource.properties.primaryEndpoints.blob}function-app-deployment'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 100
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'dotnet-isolated'
        version: '8.0'
      }
    }
    siteConfig: {
      alwaysOn: false
      vnetRouteAllEnabled: true
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

// Private Endpoint for Function App
var privateEndpointName = '${functionAppName}-pe'
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: privateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: privateEndpointName
        properties: {
          privateLinkServiceId: functionApp.id
          groupIds: [
            'sites'
          ]
        }
      }
    ]
  }
}

output functionAppName string = functionApp.name
output functionAppId string = functionApp.id
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output principalId string = functionApp.identity.principalId
output privateEndpointName string = privateEndpoint.name
output privateEndpointId string = privateEndpoint.id
