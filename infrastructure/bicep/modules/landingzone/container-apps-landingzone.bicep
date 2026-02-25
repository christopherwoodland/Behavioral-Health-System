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

@description('Container Apps subnet ID in landing zone')
param containerAppsSubnetId string

@description('Log Analytics Workspace ID')
param logAnalyticsWorkspaceId string

@description('Azure Container Registry name')
param acrName string

@description('Azure Container Registry login server')
param acrLoginServer string

@description('Storage account name')
param storageAccountName string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Key Vault name')
param keyVaultName string

@description('Key Vault URI')
param keyVaultUri string

@description('AI Services endpoint')
param aiServicesEndpoint string

@description('Azure Tenant ID')
param tenantId string = subscription().tenantId

@description('Azure AD Client ID for MSAL')
param azureAdClientId string = ''

@description('Azure AD API Client ID')
param azureAdApiClientId string = ''

@description('Container image tag for UI')
param uiImageTag string = 'latest'

@description('Container image tag for API')
param apiImageTag string = 'latest'

@description('Azure OpenAI Realtime deployment name')
param azureOpenAIRealtimeDeployment string = 'gpt-realtime'

@description('Azure OpenAI Realtime API version')
param azureOpenAIRealtimeApiVersion string = '2025-04-01-preview'

@description('Azure OpenAI resource name')
param azureOpenAIResourceName string = ''

@description('Azure OpenAI WebRTC region')
param azureOpenAIWebRTCRegion string = 'eastus2'

@description('Extended Assessment OpenAI Deployment')
param extendedAssessmentDeployment string = 'gpt-5.2'

@description('Agent Model Deployment')
param agentModelDeployment string = 'gpt-5.2'

@description('Kintsugi Base URL')
param kintsugiBaseUrl string = 'https://api.kintsugihealth.com/v2'

@description('Band Service URL')
param bandServiceUrl string = ''

@description('Enable Smart Band integration')
param enableSmartBand bool = false

@description('Use placeholder images from MCR instead of ACR (for initial deployment before pushing images)')
param usePlaceholderImages bool = true

var containerAppsEnvName = '${appName}-${environment}-cae-${uniqueSuffix}'
var uiAppName = '${appName}-${environment}-ui-${uniqueSuffix}'
var apiAppName = '${appName}-${environment}-api-${uniqueSuffix}'

// Image references - use ACR quickstart placeholder if real images not yet pushed
// Import placeholder first: az acr import --name <acr> --source mcr.microsoft.com/k8se/quickstart:latest --image bhs-quickstart:latest
var placeholderImage = '${acrLoginServer}/bhs-quickstart:latest'
var uiImage = usePlaceholderImages ? placeholderImage : '${acrLoginServer}/bhs-ui:${uiImageTag}'
var apiImage = usePlaceholderImages ? placeholderImage : '${acrLoginServer}/bhs-api:${apiImageTag}'

// Get Log Analytics workspace reference
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: last(split(logAnalyticsWorkspaceId, '/'))
}

// Container Apps Environment (VNet Integrated, INTERNAL)
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: containerAppsSubnetId
      internal: true // INTERNAL ONLY - accessible only via Private Link / VNet
    }
    zoneRedundant: false
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// UI Container App (React Frontend) - Internal ingress
resource uiContainerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: uiAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppsEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true // External to the environment, but environment is internal
        targetPort: 80
        transport: 'http'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          maxAge: 86400
        }
      }
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'openai-realtime-key'
          keyVaultUrl: '${keyVaultUri}secrets/openai-realtime-key'
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'ui'
          image: uiImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            // API Configuration - will be updated to Front Door endpoint
            {
              name: 'VITE_API_BASE_URL'
              value: 'https://${apiAppName}.${containerAppsEnv.properties.defaultDomain}/api'
            }
            {
              name: 'VITE_API_TIMEOUT_MS'
              value: '30000'
            }
            {
              name: 'VITE_API_MAX_RETRIES'
              value: '3'
            }
            {
              name: 'VITE_API_RETRY_DELAY_MS'
              value: '1000'
            }
            // Agent Voice Configuration
            {
              name: 'VITE_TARS_VOICE'
              value: 'echo'
            }
            {
              name: 'VITE_JEKYLL_VOICE'
              value: 'shimmer'
            }
            {
              name: 'VITE_JEKYLL_PHQ2_THRESHOLD'
              value: '1'
            }
            {
              name: 'VITE_MATRON_VOICE'
              value: 'coral'
            }
            // Azure AD / Entra ID Authentication
            {
              name: 'VITE_AZURE_CLIENT_ID'
              value: azureAdClientId
            }
            {
              name: 'VITE_AZURE_API_CLIENT_ID'
              value: azureAdApiClientId
            }
            {
              name: 'VITE_AZURE_TENANT_ID'
              value: tenantId
            }
            {
              name: 'VITE_AZURE_AUTHORITY'
              value: 'https://login.microsoftonline.com/${tenantId}'
            }
            {
              name: 'VITE_AZURE_REDIRECT_URI'
              value: 'https://${uiAppName}.${containerAppsEnv.properties.defaultDomain}'
            }
            {
              name: 'VITE_AZURE_POST_LOGOUT_REDIRECT_URI'
              value: 'https://${uiAppName}.${containerAppsEnv.properties.defaultDomain}'
            }
            {
              name: 'VITE_ENABLE_ENTRA_AUTH'
              value: 'true'
            }
            {
              name: 'VITE_AZURE_ADMIN_GROUP_ID'
              value: ''
            }
            {
              name: 'VITE_AZURE_CONTROL_PANEL_GROUP_ID'
              value: ''
            }
            // Azure Blob Storage
            {
              name: 'VITE_STORAGE_CONTAINER_NAME'
              value: 'audio-uploads'
            }
            // Azure OpenAI Realtime API Configuration
            {
              name: 'VITE_AZURE_OPENAI_REALTIME_DEPLOYMENT'
              value: azureOpenAIRealtimeDeployment
            }
            {
              name: 'VITE_AZURE_OPENAI_REALTIME_API_VERSION'
              value: azureOpenAIRealtimeApiVersion
            }
            {
              name: 'VITE_AZURE_OPENAI_REALTIME_RESOURCE_NAME'
              value: azureOpenAIResourceName
            }
            {
              name: 'VITE_AZURE_OPENAI_WEBRTC_REGION'
              value: azureOpenAIWebRTCRegion
            }
            {
              name: 'VITE_AZURE_OPENAI_REALTIME_KEY'
              secretRef: 'openai-realtime-key'
            }
            // Feature Flags
            {
              name: 'VITE_DEV_ENVIRONMENT'
              value: 'false'
            }
            {
              name: 'VITE_DEV_ENVIRONMENT_TEXT'
              value: ''
            }
            {
              name: 'VITE_AUTO_START_SESSION'
              value: 'false'
            }
            {
              name: 'VITE_ENABLE_DEBUG_LOGGING'
              value: 'false'
            }
            {
              name: 'VITE_ENABLE_VERBOSE_LOGGING'
              value: 'false'
            }
            {
              name: 'VITE_ENABLE_FFMPEG_WORKER'
              value: 'true'
            }
            {
              name: 'VITE_ENABLE_KINTSUGI'
              value: 'true'
            }
            {
              name: 'VITE_ENABLE_TRANSCRIPTION'
              value: 'true'
            }
            {
              name: 'VITE_ENABLE_AI_RISK_ASSESSMENT'
              value: 'false'
            }
            {
              name: 'VITE_AGENT_MODE_ENABLED'
              value: 'false'
            }
            {
              name: 'VITE_ENABLE_JEKYLL_AGENT'
              value: 'false'
            }
            {
              name: 'VITE_ENABLE_SESSION_VOICE_RECORDING'
              value: 'false'
            }
            // Biometric Data Service Configuration
            {
              name: 'VITE_BIOMETRIC_SAVE_DELAY_MS'
              value: '2000'
            }
            {
              name: 'VITE_MATRON_MAX_COLLECTION_ATTEMPTS'
              value: '2'
            }
            {
              name: 'VITE_AGENT_HANDOFF_DELAY_MS'
              value: '2000'
            }
            // Smart Band Integration Configuration
            {
              name: 'VITE_ENABLE_SMART_BAND'
              value: string(enableSmartBand)
            }
            {
              name: 'VITE_BAND_SERVICE_URL'
              value: bandServiceUrl
            }
            // Realtime API Advanced Configuration
            {
              name: 'VITE_REALTIME_MAX_RECONNECTION_ATTEMPTS'
              value: '3'
            }
            {
              name: 'VITE_REALTIME_RECONNECTION_DELAY_MS'
              value: '2000'
            }
            {
              name: 'VITE_REALTIME_DATA_CHANNEL_TIMEOUT_MS'
              value: '5000'
            }
            {
              name: 'VITE_INITIAL_GREETING_SESSION_DELAY_MS'
              value: '1500'
            }
            {
              name: 'VITE_INITIAL_GREETING_RESPONSE_DELAY_MS'
              value: '300'
            }
            // Polling Configuration
            {
              name: 'VITE_CONTROL_PANEL_REFRESH_INTERVAL'
              value: '60'
            }
            {
              name: 'VITE_JOB_POLL_INTERVAL_MS'
              value: '30000'
            }
            {
              name: 'VITE_POLL_INTERVAL_MS'
              value: '5000'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              tcpSocket: {
                port: 80
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              tcpSocket: {
                port: 80
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

// API Container App (Function App) - Internal ingress
resource apiContainerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: apiAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppsEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true // External to the environment, but environment is internal
        targetPort: 80
        transport: 'http'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
        corsPolicy: {
          allowedOrigins: [
            'https://${uiAppName}.${containerAppsEnv.properties.defaultDomain}'
            'https://portal.azure.com'
            '*' // Will be restricted to Front Door endpoint after deployment
          ]
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          allowCredentials: true
          maxAge: 86400
        }
      }
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'kintsugi-api-key'
          keyVaultUrl: '${keyVaultUri}secrets/KintsugiApiKey'
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: apiImage
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: [
            // Core Functions Configuration
            {
              name: 'FUNCTIONS_WORKER_RUNTIME'
              value: 'dotnet-isolated'
            }
            // Azure Storage configuration for managed identity
            {
              name: 'AzureWebJobsStorage__accountName'
              value: storageAccountName
            }
            {
              name: 'AzureWebJobsStorage__blobServiceUri'
              value: 'https://${storageAccountName}.blob.core.windows.net'
            }
            {
              name: 'AzureWebJobsStorage__queueServiceUri'
              value: 'https://${storageAccountName}.queue.core.windows.net'
            }
            {
              name: 'AzureWebJobsStorage__tableServiceUri'
              value: 'https://${storageAccountName}.table.core.windows.net'
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: appInsightsConnectionString
            }
            {
              name: 'KEY_VAULT_URI'
              value: keyVaultUri
            }
            // DSM5 Configuration
            {
              name: 'DSM5_STORAGE_ACCOUNT_NAME'
              value: storageAccountName
            }
            {
              name: 'DSM5_CONTAINER_NAME'
              value: 'dsm5-data'
            }
            {
              name: 'DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT'
              value: aiServicesEndpoint
            }
            {
              name: 'DSM5_EXTRACTION_METHOD'
              value: 'CONTENT_UNDERSTANDING'
            }
            // Azure OpenAI Configuration
            {
              name: 'AZURE_OPENAI_ENDPOINT'
              value: aiServicesEndpoint
            }
            {
              name: 'AZURE_OPENAI_DEPLOYMENT'
              value: 'gpt-4.1'
            }
            {
              name: 'AZURE_OPENAI_API_VERSION'
              value: '2024-05-01-preview'
            }
            {
              name: 'AZURE_OPENAI_ENABLED'
              value: 'true'
            }
            // Extended Assessment OpenAI Configuration
            {
              name: 'EXTENDED_ASSESSMENT_OPENAI_ENDPOINT'
              value: aiServicesEndpoint
            }
            {
              name: 'EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT'
              value: extendedAssessmentDeployment
            }
            {
              name: 'EXTENDED_ASSESSMENT_OPENAI_API_VERSION'
              value: '2024-05-01-preview'
            }
            {
              name: 'EXTENDED_ASSESSMENT_OPENAI_ENABLED'
              value: 'true'
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
            // Document Intelligence
            {
              name: 'DocumentIntelligenceEndpoint'
              value: aiServicesEndpoint
            }
            // Content Understanding
            {
              name: 'AZURE_CONTENT_UNDERSTANDING_ENDPOINT'
              value: aiServicesEndpoint
            }
            // Kintsugi Configuration
            {
              name: 'KINTSUGI_BASE_URL'
              value: kintsugiBaseUrl
            }
            {
              name: 'KINTSUGI_API_KEY'
              secretRef: 'kintsugi-api-key'
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
              name: 'KINTSUGI_AUTO_PROVIDE_CONSENT'
              value: 'false'
            }
            // Azure Speech Configuration
            {
              name: 'AZURE_SPEECH_REGION'
              value: location
            }
            {
              name: 'AZURE_SPEECH_ENDPOINT'
              value: aiServicesEndpoint
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
              name: 'AZURE_SPEECH_ENHANCED_MODE'
              value: 'false'
            }
            // Agent Configuration
            {
              name: 'AGENT_MODE_ENABLED'
              value: 'false'
            }
            {
              name: 'AGENT_ENDPOINT'
              value: aiServicesEndpoint
            }
            {
              name: 'AGENT_MODEL_DEPLOYMENT'
              value: agentModelDeployment
            }
            {
              name: 'AGENT_ENABLED'
              value: 'true'
            }
            {
              name: 'AGENT_SUPPORTS_TEMPERATURE'
              value: 'false'
            }
            {
              name: 'AGENT_SUPPORTS_MAX_TOKENS'
              value: 'false'
            }
            {
              name: 'AGENT_TIMEOUT_SECONDS'
              value: '60'
            }
            // Grammar Agent Configuration
            {
              name: 'GRAMMAR_AGENT_NAME'
              value: 'GrammarCorrectionAgent'
            }
            {
              name: 'GRAMMAR_AGENT_INCLUDE_EXPLANATIONS'
              value: 'false'
            }
            {
              name: 'GRAMMAR_AGENT_PRESERVE_FORMATTING'
              value: 'true'
            }
            {
              name: 'GRAMMAR_AGENT_SUGGEST_ALTERNATIVES'
              value: 'false'
            }
            // CORS Configuration - will be updated to Front Door endpoint
            {
              name: 'ALLOWED_ORIGINS'
              value: '*'
            }
            // Entra ID / Azure AD Authentication
            {
              name: 'ENTRA_TENANT_ID'
              value: tenantId
            }
            {
              name: 'ENTRA_CLIENT_ID'
              value: azureAdApiClientId
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 80
              }
              initialDelaySeconds: 30
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 80
              }
              initialDelaySeconds: 15
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

output containerAppsEnvironmentId string = containerAppsEnv.id
output containerAppsEnvironmentName string = containerAppsEnv.name
output containerAppsDefaultDomain string = containerAppsEnv.properties.defaultDomain
output containerAppsStaticIp string = containerAppsEnv.properties.staticIp
output uiAppName string = uiContainerApp.name
output uiAppFqdn string = uiContainerApp.properties.configuration.ingress.fqdn
output uiAppPrincipalId string = uiContainerApp.identity.principalId
output apiAppName string = apiContainerApp.name
output apiAppFqdn string = apiContainerApp.properties.configuration.ingress.fqdn
output apiAppPrincipalId string = apiContainerApp.identity.principalId
