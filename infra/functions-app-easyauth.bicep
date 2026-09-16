targetScope = 'resourceGroup'

@description('Azure region for the Function App resources.')
param location string = resourceGroup().location

@description('Name of the additive EasyAuth Function App and PostgreSQL role.')
param appName string = 'bhs-functions-easyauth'

@description('Name of the Linux Premium v3 App Service plan.')
param planName string = '${appName}-plan'

@description('Immutable Functions image tag already built in the existing registry.')
param imageTag string

@description('Microsoft Entra tenant that issues API access tokens.')
param tenantId string = '16b3c013-d300-468d-ac64-7eda0820b6d3'

@description('Microsoft Entra application/client ID accepted by EasyAuth.')
param entraClientId string = '687b082f-65b5-4d2f-ab94-8d1949ba1f87'

@description('Microsoft Entra client applications allowed to call the API.')
param allowedClientApplicationIds array = [
  '16bd4645-402e-44ba-9c6f-414af87f7d6e'
]

@secure()
@description('API key used by Functions when calling the deployed DAM service.')
param damApiKey string

@description('Existing DAM foundation resource prefix.')
param damNamePrefix string = 'bhs-dam'

@description('Repository name used for the Functions image.')
param imageRepository string = 'bhs-functions'

@description('Existing storage account name used for Functions host state and application blobs.')
param storageAccountName string = 'cwacstest001'

@description('Resource group containing the existing storage account.')
param storageResourceGroupName string = 'DefaultResourceGroup-CCAN'

@description('Subscription containing the existing storage account.')
param storageSubscriptionId string = subscription().subscriptionId

@description('PostgreSQL Flexible Server host name.')
param postgresHost string = 'bhs-postgres-sql.postgres.database.azure.com'

@description('PostgreSQL application database.')
param postgresDatabase string = 'bhs_dev'

@allowed([
  'BlobStorage'
  'PostgreSQL'
])
@description('Application persistence backend. BlobStorage is used during managed-identity bootstrap.')
param storageBackend string = 'PostgreSQL'

@description('Base URL of the deployed DAM service.')
param damBaseUrl string = 'https://bhs-dam.victorioussmoke-ce62b9bb.eastus.azurecontainerapps.io'

@description('Maximum accepted audio upload size in bytes.')
@minValue(1)
param audioJobMaxUploadBytes int = 26214400

@description('Resource group containing the existing Microsoft Foundry account.')
param foundryResourceGroupName string = 'integration'

@description('Name of the existing Microsoft Foundry account.')
param foundryAccountName string = 'cwoodland-0035-test-002-resource'

@description('Microsoft Foundry project endpoint used by the analysis agents.')
param foundryProjectEndpoint string = 'https://cwoodland-0035-test-002-resource.services.ai.azure.com/api/projects/cwoodland-0035-test-002'

@description('Resource group containing the existing Azure AI Speech account.')
param speechResourceGroupName string = 'integration'

@description('Name of the existing Azure AI Speech account.')
param speechAccountName string = 'bhs-transcription-eastus'

@description('Azure AI Speech custom endpoint used for managed-identity transcription.')
param speechEndpoint string = 'https://bhs-transcription-eastus.cognitiveservices.azure.com/'

@description('Existing Log Analytics workspace used by the application environment.')
param logAnalyticsWorkspaceName string = 'bhs-dam-logs'

@description('Browser origins allowed to call the Functions API.')
param allowedOrigins array = [
  'http://localhost:3000'
  'http://localhost:5173'
  'http://localhost:5174'
  'http://localhost:5175'
  'http://127.0.0.1:3000'
  'http://127.0.0.1:5173'
  'http://127.0.0.1:5174'
  'http://127.0.0.1:5175'
  'https://localhost:3000'
  'https://localhost:5173'
  'https://localhost:5174'
  'https://localhost:5175'
  'https://127.0.0.1:3000'
  'https://127.0.0.1:5173'
  'https://127.0.0.1:5174'
  'https://127.0.0.1:5175'
  'https://bhs-web.victorioussmoke-ce62b9bb.eastus.azurecontainerapps.io'
]

var registryName = replace('${damNamePrefix}${uniqueString(subscription().id, resourceGroup().id)}', '-', '')
var registryImage = '${registry.properties.loginServer}/${imageRepository}:${imageTag}'
var storageBlobUri = 'https://${storageAccountName}.blob.${az.environment().suffixes.storage}'
var storageQueueUri = 'https://${storageAccountName}.queue.${az.environment().suffixes.storage}'
var storageTableUri = 'https://${storageAccountName}.table.${az.environment().suffixes.storage}'
var monitoringMetricsPublisherRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '3913510d-42f4-4e42-8a64-420c390055eb'
)

resource registry 'Microsoft.ContainerRegistry/registries@2023-06-01-preview' existing = {
  name: registryName
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: '${damNamePrefix}-pull'
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
  scope: resourceGroup(storageSubscriptionId, storageResourceGroupName)
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource plan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: planName
  location: location
  kind: 'linux'
  sku: {
    name: 'P0v3'
    tier: 'PremiumV3'
    size: 'P0v3'
    family: 'Pv3'
    capacity: 1
  }
  properties: {
    perSiteScaling: false
    reserved: true
    zoneRedundant: false
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    DisableLocalAuth: true
    IngestionMode: 'LogAnalytics'
    Request_Source: 'rest'
    RetentionInDays: 30
    WorkspaceResourceId: logs.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource app 'Microsoft.Web/sites@2024-11-01' = {
  name: appName
  location: location
  kind: 'functionapp,linux,container'
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${pullIdentity.id}': {}
    }
  }
  properties: {
    clientAffinityEnabled: false
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    serverFarmId: plan.id
    siteConfig: {
      acrUseManagedIdentityCreds: true
      acrUserManagedIdentityID: pullIdentity.properties.clientId
      alwaysOn: true
      cors: {
        allowedOrigins: allowedOrigins
        supportCredentials: true
      }
      ftpsState: 'Disabled'
      healthCheckPath: '/api/health'
      http20Enabled: true
      httpLoggingEnabled: true
      linuxFxVersion: 'DOCKER|${registryImage}'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      use32BitWorkerProcess: false
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_AUTHENTICATION_STRING'
          value: 'Authorization=AAD'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'AZURE_FUNCTIONS_ENVIRONMENT'
          value: 'Production'
        }
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: 'Production'
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
          name: 'WEBSITE_AAD_ENABLE_MISE'
          value: 'true'
        }
        {
          name: 'WEBSITE_AUTH_AAD_ALLOWED_TENANTS'
          value: tenantId
        }
        {
          name: 'WEBSITE_AUTH_AAD_REQUIRE_CLIENT_SERVICE_PRINCIPAL'
          value: 'true'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${registry.properties.loginServer}'
        }
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccountName
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: storageBlobUri
        }
        {
          name: 'AzureWebJobsStorage__queueServiceUri'
          value: storageQueueUri
        }
        {
          name: 'AzureWebJobsStorage__tableServiceUri'
          value: storageTableUri
        }
        {
          name: 'AzureFunctionsJobHost__extensions__durableTask__hubName'
          value: 'KintsugiHealthEasyAuthHub'
        }
        {
          name: 'ALLOWED_ORIGINS'
          value: join(allowedOrigins, ',')
        }
        {
          name: 'ENTRA_CLIENT_ID'
          value: entraClientId
        }
        {
          name: 'ENTRA_TENANT_ID'
          value: tenantId
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
        {
          name: 'AZURE_TENANT_ID'
          value: tenantId
        }
        {
          name: 'STORAGE_BACKEND'
          value: storageBackend
        }
        {
          name: 'POSTGRES_HOST'
          value: postgresHost
        }
        {
          name: 'POSTGRES_PORT'
          value: '5432'
        }
        {
          name: 'POSTGRES_USERNAME'
          value: appName
        }
        {
          name: 'POSTGRES_DATABASE'
          value: postgresDatabase
        }
        {
          name: 'POSTGRES_USE_MANAGED_IDENTITY'
          value: 'true'
        }
        {
          name: 'FOUNDRY_PROJECT_ENDPOINT'
          value: foundryProjectEndpoint
        }
        {
          name: 'FOUNDRY_QUICK_ANALYSIS_ENABLED'
          value: 'true'
        }
        {
          name: 'FOUNDRY_QUICK_ANALYSIS_AGENT_NAME'
          value: 'bhs-quick-analysis'
        }
        {
          name: 'FOUNDRY_QUICK_ANALYSIS_AGENT_VERSION'
          value: '4'
        }
        {
          name: 'FOUNDRY_DEEP_ANALYSIS_ENABLED'
          value: 'true'
        }
        {
          name: 'FOUNDRY_DEEP_ANALYSIS_AGENT_NAME'
          value: 'bhs-deep-analysis'
        }
        {
          name: 'FOUNDRY_DEEP_ANALYSIS_AGENT_VERSION'
          value: '4'
        }
        {
          name: 'AZURE_SPEECH_ENDPOINT'
          value: speechEndpoint
        }
        {
          name: 'AZURE_SPEECH_API_VERSION'
          value: '2025-10-15'
        }
        {
          name: 'AZURE_SPEECH_ENHANCED_MODE'
          value: 'true'
        }
        {
          name: 'AZURE_SPEECH_ENHANCED_MODEL'
          value: 'mai-transcribe-1.5'
        }
        {
          name: 'AZURE_SPEECH_TRANSCRIBE_STYLE'
          value: 'verbatim'
        }
        {
          name: 'AZURE_SPEECH_PHRASE_LIST_JSON'
          value: '[]'
        }
        {
          name: 'LOCAL_DAM_BASE_URL'
          value: damBaseUrl
        }
        {
          name: 'LOCAL_DAM_API_KEY'
          value: damApiKey
        }
        {
          name: 'LOCAL_DAM_MAX_RETRY_ATTEMPTS'
          value: '3'
        }
        {
          name: 'LOCAL_DAM_RETRY_BASE_DELAY_MS'
          value: '1000'
        }
        {
          name: 'LOCAL_DAM_USE_GPU'
          value: 'false'
        }
        {
          name: 'DAM_MOCK_MODE'
          value: 'false'
        }
        {
          name: 'LOCAL_DAM_WARMUP_ON_STARTUP'
          value: 'true'
        }
        {
          name: 'LOCAL_DAM_HEALTH_PATH'
          value: 'health'
        }
        {
          name: 'LOCAL_DAM_WARMUP_TIMEOUT_SECONDS'
          value: '600'
        }
        {
          name: 'AUDIO_JOB_MAX_UPLOAD_BYTES'
          value: string(audioJobMaxUploadBytes)
        }
        {
          name: 'FFMPEG_PATH'
          value: 'ffmpeg'
        }
        {
          name: 'FFMPEG_SAMPLE_RATE'
          value: '44100'
        }
        {
          name: 'FFMPEG_CHANNELS'
          value: '1'
        }
        {
          name: 'FFMPEG_MAX_DURATION_SECONDS'
          value: '30'
        }
        {
          name: 'FFMPEG_PROCESS_TIMEOUT_SECONDS'
          value: '120'
        }
        {
          name: 'FFMPEG_HIGHPASS_FREQUENCY'
          value: '80'
        }
        {
          name: 'FFMPEG_LOWPASS_FREQUENCY'
          value: '12000'
        }
        {
          name: 'FFMPEG_ENABLE_SILENCE_REMOVAL'
          value: 'true'
        }
        {
          name: 'FFMPEG_SILENCE_THRESHOLD_DB'
          value: '-50'
        }
        {
          name: 'FFMPEG_SILENCE_MIN_DURATION'
          value: '0.1'
        }
        {
          name: 'FFMPEG_SKIP_CLEAN_WAV'
          value: 'true'
        }
        {
          name: 'FFMPEG_USE_TMPFS'
          value: 'true'
        }
        {
          name: 'FFMPEG_USE_PIPE_MODE'
          value: 'true'
        }
      ]
    }
  }
}

resource auth 'Microsoft.Web/sites/config@2024-11-01' = {
  parent: app
  name: 'authsettingsV2'
  properties: {
    globalValidation: {
      excludedPaths: [
        '/api/health'
        '/api/feature-flags'
        '/api/feature-flags/*'
      ]
      requireAuthentication: true
      unauthenticatedClientAction: 'Return401'
    }
    httpSettings: {
      requireHttps: true
      routes: {
        apiPrefix: '/.auth'
      }
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        isAutoProvisioned: false
        registration: {
          clientId: entraClientId
          openIdIssuer: '${az.environment().authentication.loginEndpoint}${tenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [
            entraClientId
            'api://${entraClientId}'
          ]
          defaultAuthorizationPolicy: {
            allowedApplications: allowedClientApplicationIds
          }
        }
      }
    }
    login: {
      preserveUrlFragmentsForLogins: false
      tokenStore: {
        enabled: false
      }
    }
    platform: {
      enabled: true
      runtimeVersion: '~1'
    }
  }
}

resource appInsightsPublisher 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appInsights.id, app.id, monitoringMetricsPublisherRoleDefinitionId)
  scope: appInsights
  properties: {
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: monitoringMetricsPublisherRoleDefinitionId
  }
}

module storageRbac 'modules/storage-rbac.bicep' = {
  name: '${appName}-storage-rbac'
  scope: resourceGroup(storageSubscriptionId, storageResourceGroupName)
  params: {
    principalId: app.identity.principalId
    principalResourceId: app.id
    storageAccountName: storageAccountName
  }
}

module foundryRbac 'modules/foundry-rbac.bicep' = {
  name: '${appName}-foundry-rbac'
  scope: resourceGroup(subscription().subscriptionId, foundryResourceGroupName)
  params: {
    foundryAccountName: foundryAccountName
    principalId: app.identity.principalId
    principalResourceId: app.id
  }
}

module speechRbac 'modules/speech-rbac.bicep' = {
  name: '${appName}-speech-rbac'
  scope: resourceGroup(subscription().subscriptionId, speechResourceGroupName)
  params: {
    principalId: app.identity.principalId
    principalResourceId: app.id
    speechAccountName: speechAccountName
  }
}

output appName string = app.name
output appInsightsResourceId string = appInsights.id
output appPrincipalId string = app.identity.principalId
output appResourceId string = app.id
output appUrl string = 'https://${app.properties.defaultHostName}'
output authConfigResourceId string = auth.id
output image string = registryImage
output postgresRoleName string = app.name
output storageAccountId string = storage.id
