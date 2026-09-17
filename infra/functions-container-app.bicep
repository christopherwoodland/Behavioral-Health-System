targetScope = 'resourceGroup'

@description('Azure region for the Functions Container App.')
param location string = resourceGroup().location

@description('Name of the Functions Container App and PostgreSQL managed-identity role.')
param appName string = 'bhs-functions'

@description('Immutable image tag already built in the existing registry.')
param imageTag string

@description('Microsoft Entra tenant used by API token validation and managed identity.')
param tenantId string

@description('Microsoft Entra application/client ID accepted by API token validation. Leave empty to use API-key authentication only.')
param entraClientId string = ''

@secure()
@description('API key used by Functions when calling the deployed DAM service.')
param damApiKey string

@secure()
@description('Optional API key accepted by the Functions API. Entra authentication remains available when configured.')
param functionsApiKey string = ''

@description('Base URL of the deployed DAM service.')
param damBaseUrl string = 'https://bhs-dam.victorioussmoke-ce62b9bb.eastus.azurecontainerapps.io'

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

@description('Maximum accepted audio upload size in bytes.')
@minValue(1)
param audioJobMaxUploadBytes int = 26214400

@description('Resource group containing the existing Microsoft Foundry account.')
param foundryResourceGroupName string = 'integration'

@description('Name of the existing Microsoft Foundry account.')
param foundryAccountName string = 'cwoodland-0035-test-002-resource'

@description('Microsoft Foundry project endpoint used by the analysis agents.')
param foundryProjectEndpoint string = 'https://cwoodland-0035-test-002-resource.services.ai.azure.com/api/projects/cwoodland-0035-test-002'

@description('Azure AI Speech custom endpoint used for managed-identity transcription.')
param speechEndpoint string = 'https://bhs-transcription-eastus.cognitiveservices.azure.com/'

@description('Comma-delimited browser origins allowed to call the Functions API.')
param allowedOrigins string = 'http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,https://localhost:3000,https://localhost:5173,https://localhost:5174,https://localhost:5175,https://127.0.0.1:3000,https://127.0.0.1:5173,https://127.0.0.1:5174,https://127.0.0.1:5175,https://bhs-web.victorioussmoke-ce62b9bb.eastus.azurecontainerapps.io'

var registryName = replace('${damNamePrefix}${uniqueString(subscription().id, resourceGroup().id)}', '-', '')
var storageBlobUri = 'https://${storageAccountName}.blob.${az.environment().suffixes.storage}'
var storageQueueUri = 'https://${storageAccountName}.queue.${az.environment().suffixes.storage}'
var storageTableUri = 'https://${storageAccountName}.table.${az.environment().suffixes.storage}'
var appSecrets = concat([
  {
    name: 'dam-api-key'
    value: damApiKey
  }
], empty(functionsApiKey) ? [] : [
  {
    name: 'functions-api-key'
    value: functionsApiKey
  }
])
var authenticationEnvironment = concat(empty(entraClientId) ? [] : [
  {
    name: 'ENTRA_CLIENT_ID'
    value: entraClientId
  }
], [
  {
    name: 'FUNCTIONS_API_KEY'
    secretRef: empty(functionsApiKey) ? 'dam-api-key' : 'functions-api-key'
  }
])

resource registry 'Microsoft.ContainerRegistry/registries@2023-06-01-preview' existing = {
  name: registryName
}

resource environment 'Microsoft.App/managedEnvironments@2024-10-02-preview' existing = {
  name: '${damNamePrefix}-env'
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: '${damNamePrefix}-pull'
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
  scope: resourceGroup(storageSubscriptionId, storageResourceGroupName)
}

resource app 'Microsoft.App/containerApps@2025-01-01' = {
  name: appName
  location: location
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${pullIdentity.id}': {}
    }
  }
  properties: {
    environmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        allowInsecure: false
        targetPort: 80
        transport: 'auto'
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: pullIdentity.id
        }
      ]
      secrets: appSecrets
    }
    template: {
      containers: [
        {
          name: 'functions'
          image: '${registry.properties.loginServer}/${imageRepository}:${imageTag}'
          env: concat([
            {
              name: 'ALLOWED_ORIGINS'
              value: allowedOrigins
            }
            {
              name: 'FOUNDRY_PROJECT_ENDPOINT'
              value: foundryProjectEndpoint
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
              value: '5'
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
              name: 'AZURE_FUNCTIONS_ENVIRONMENT'
              value: 'Production'
            }
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: 'Production'
            }
            {
              name: 'WEBSITE_HOSTNAME'
              value: '${appName}.${environment.properties.defaultDomain}'
            }
            {
              name: 'FUNCTIONS_WORKER_RUNTIME'
              value: 'dotnet-isolated'
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
              name: 'AZURE_STORAGE_ACCOUNT_NAME'
              value: storageAccountName
            }
            {
              name: 'AZURE_TENANT_ID'
              value: tenantId
            }
            {
              name: 'ENTRA_TENANT_ID'
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
              name: 'LOCAL_DAM_BASE_URL'
              value: damBaseUrl
            }
            {
              name: 'LOCAL_DAM_API_KEY'
              secretRef: 'dam-api-key'
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
              value: 'false'
            }
          ], authenticationEnvironment)
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/api/health'
                port: 80
                scheme: 'HTTP'
              }
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 90
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 80
                scheme: 'HTTP'
              }
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 80
                scheme: 'HTTP'
              }
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 6
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
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

output appName string = app.name
output appPrincipalId string = app.identity.principalId
output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output postgresRoleName string = app.name
output storageAccountId string = storage.id
