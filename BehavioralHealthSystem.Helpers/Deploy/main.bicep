@description('Name of the Function App')
param functionAppName string

@description('Name of the Web App (optional)')
param webAppName string = ''

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Storage account name (auto-generated if not provided)')
param storageAccountName string = ''

@description('Application Insights name (auto-generated if not provided)')
param appInsightsName string = 'ai-${functionAppName}'

@description('App Service Plan name (auto-generated if not provided)')
param appServicePlanName string = 'asp-${functionAppName}'

@description('Environment for tagging')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Kintsugi API Key for the behavioral health service')
@secure()
param kintsugiApiKey string

@description('Azure OpenAI endpoint')
param azureOpenAIEndpoint string = ''

@description('Azure OpenAI API key')
@secure()
param azureOpenAIApiKey string = ''

// Variables
var storageAccountNameGenerated = 'st${uniqueString(resourceGroup().id)}'
var storageAccountNameClean = take(replace(toLower(storageAccountName != '' ? storageAccountName : storageAccountNameGenerated), '-', ''), 24)
var storageAccountNameFinal = length(storageAccountNameClean) < 3 ? 'st${uniqueString(resourceGroup().id)}' : storageAccountNameClean
var functionAppNameClean = toLower(functionAppName)
var webAppNameClean = toLower(webAppName)

// Storage Account for Function App
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountNameFinal
  location: location
  tags: {
    Environment: environment
    Project: 'BehavioralHealthSystem'
  }
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: {
    Environment: environment
    Project: 'BehavioralHealthSystem'
  }
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Request_Source: 'rest'
  }
}

// App Service Plan for Function App (Consumption)
resource functionAppServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  tags: {
    Environment: environment
    Project: 'BehavioralHealthSystem'
  }
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
  properties: {
    reserved: false
  }
}

// App Service Plan for Web App (Basic)
resource webAppServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = if (webAppName != '') {
  name: '${appServicePlanName}-web'
  location: location
  tags: {
    Environment: environment
    Project: 'BehavioralHealthSystem'
  }
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  kind: 'app'
  properties: {
    reserved: false
  }
}

// Function App
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppNameClean
  location: location
  tags: {
    Environment: environment
    Project: 'BehavioralHealthSystem'
  }
  kind: 'functionapp'
  properties: {
    serverFarmId: functionAppServicePlan.id
    siteConfig: {
      netFrameworkVersion: 'v8.0'
      use32BitWorkerProcess: false
      cors: {
        allowedOrigins: [
          '*'
        ]
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppNameClean)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'dotnet-isolated'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'KINTSUGI_API_KEY'
          value: kintsugiApiKey
        }
        {
          name: 'KINTSUGI_BASE_URL'
          value: 'https://api.kintsugihealth.com'
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: azureOpenAIEndpoint
        }
        {
          name: 'AZURE_OPENAI_API_KEY'
          value: azureOpenAIApiKey
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT'
          value: 'gpt-4o'
        }
        {
          name: 'AZURE_OPENAI_API_VERSION'
          value: '2024-02-01'
        }
        {
          name: 'KINTSUGI_AUTO_PROVIDE_CONSENT'
          value: 'false'
        }
        {
          name: 'EXTENDED_ASSESSMENT_OPENAI_ENDPOINT'
          value: azureOpenAIEndpoint
        }
        {
          name: 'EXTENDED_ASSESSMENT_OPENAI_API_KEY'
          value: azureOpenAIApiKey
        }
        {
          name: 'EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT'
          value: 'gpt-4o'
        }
        {
          name: 'EXTENDED_ASSESSMENT_OPENAI_API_VERSION'
          value: '2024-08-01-preview'
        }
        {
          name: 'DSM5_STORAGE_ACCOUNT_NAME'
          value: storageAccount.name
        }
        {
          name: 'DSM5_CONTAINER_NAME'
          value: 'dsm5-data'
        }
      ]
    }
    httpsOnly: true
  }
}

// Web App (optional)
resource webApp 'Microsoft.Web/sites@2023-01-01' = if (webAppName != '') {
  name: webAppNameClean
  location: location
  tags: {
    Environment: environment
    Project: 'BehavioralHealthSystem'
  }
  kind: 'app'
  properties: {
    serverFarmId: webAppServicePlan.id
    siteConfig: {
      netFrameworkVersion: 'v8.0'
      use32BitWorkerProcess: false
      appSettings: [
        {
          name: 'VITE_API_BASE_URL'
          value: 'https://${functionApp.properties.defaultHostName}/api'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
    httpsOnly: true
  }
}

// DSM-5 Storage Container
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource dsm5Container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'dsm5-data'
  properties: {
    publicAccess: 'None'
  }
}

// Outputs
output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output webAppName string = webAppName
output webAppUrl string = webAppName != '' ? 'https://${webAppNameClean}.azurewebsites.net' : ''
output storageAccountName string = storageAccount.name
output appInsightsName string = appInsights.name
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output resourceGroupName string = resourceGroup().name
