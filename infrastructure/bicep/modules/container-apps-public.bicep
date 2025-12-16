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

@description('Log Analytics Workspace ID')
param logAnalyticsWorkspaceId string

@description('Azure Container Registry name')
param acrName string

@description('Storage account name for Function App')
param storageAccountName string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Key Vault name')
param keyVaultName string

@description('Azure OpenAI endpoint')
param openaiEndpoint string = ''

@description('Document Intelligence endpoint')
param documentIntelligenceEndpoint string

@description('Content Understanding endpoint')
param contentUnderstandingEndpoint string

@description('Azure Tenant ID')
param tenantId string = subscription().tenantId

@description('Azure AD Client ID for MSAL (Frontend app registration)')
param azureAdClientId string = ''

@description('Azure AD API Client ID (Backend API app registration)')
param azureAdApiClientId string = ''

@description('Container image tag for UI')
param uiImageTag string = 'latest'

@description('Container image tag for API')
param apiImageTag string = 'latest'

// ============================================================================
// AZURE OPENAI REALTIME API PARAMETERS (UI)
// ============================================================================
@description('Azure OpenAI Realtime deployment name')
param azureOpenAIRealtimeDeployment string = 'gpt-realtime'

@description('Azure OpenAI Realtime API version')
param azureOpenAIRealtimeApiVersion string = '2025-04-01-preview'

@description('Azure OpenAI resource name for Realtime API')
param azureOpenAIResourceName string = ''

@description('Azure OpenAI WebRTC region')
param azureOpenAIWebRTCRegion string = 'eastus2'

@secure()
@description('Azure OpenAI Realtime API Key')
param azureOpenAIRealtimeKey string = ''

// ============================================================================
// AGENT CONFIGURATION PARAMETERS
// ============================================================================
@description('Extended Assessment OpenAI Deployment')
param extendedAssessmentDeployment string = 'gpt-5.2'

@description('Agent Model Deployment')
param agentModelDeployment string = 'gpt-5.2'

// ============================================================================
// SMART BAND CONFIGURATION
// ============================================================================
@description('Band Service URL for Smart Band integration')
param bandServiceUrl string = ''

@description('Enable Smart Band integration')
param enableSmartBand bool = false

var containerAppsEnvName = '${appName}-${environment}-cae-${uniqueSuffix}'
var uiAppName = '${appName}-${environment}-ui-${uniqueSuffix}'
var apiAppName = '${appName}-${environment}-api-${uniqueSuffix}'

// Get Log Analytics workspace reference
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: last(split(logAnalyticsWorkspaceId, '/'))
}

// NOTE: Storage account is accessed via managed identity using RBAC roles
// No need to reference it here since we don't use connection strings

// Reference existing Azure Container Registry (deployed separately before container apps)
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

// Container Apps Environment (Public - no VNet)
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
    zoneRedundant: false
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// UI Container App (React Frontend)
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
        external: true
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
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'openai-realtime-key'
          value: azureOpenAIRealtimeKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'ui'
          image: '${acr.properties.loginServer}/bhs-ui:${uiImageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            // API Configuration
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
            // Voice Recording Configuration
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
              httpGet: {
                path: '/health'
                port: 80
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
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

// API Container App (Function App)
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
        external: true
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
          ]
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          allowCredentials: true
          maxAge: 86400
        }
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
        // NOTE: No storage connection string - using managed identity with RBAC instead
        // Required roles: Storage Blob/Table/Queue Data Contributor
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${acr.properties.loginServer}/bhs-api:${apiImageTag}'
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
            // Using __accountName suffix enables DefaultAzureCredential
            // Service URIs are required for Durable Functions extension
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
              #disable-next-line no-hardcoded-env-urls
              value: 'https://${keyVaultName}.vault.azure.net/'
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
              value: documentIntelligenceEndpoint
            }
            {
              name: 'DSM5_EXTRACTION_METHOD'
              value: 'CONTENT_UNDERSTANDING'
            }
            // Azure OpenAI Configuration
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
              value: '2024-05-01-preview'
            }
            {
              name: 'AZURE_OPENAI_ENABLED'
              value: 'true'
            }
            // Extended Assessment OpenAI Configuration
            {
              name: 'EXTENDED_ASSESSMENT_OPENAI_ENDPOINT'
              value: openaiEndpoint
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
              value: documentIntelligenceEndpoint
            }
            // Content Understanding
            {
              name: 'AZURE_CONTENT_UNDERSTANDING_ENDPOINT'
              value: contentUnderstandingEndpoint
            }
            // Kintsugi Configuration
            {
              name: 'KINTSUGI_BASE_URL'
              value: 'https://api.kintsugihealth.com/v2'
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
            // Note: KINTSUGI_API_KEY should be retrieved from Key Vault via managed identity
            // Azure Speech Configuration
            // NOTE: Uses AIServices endpoint with managed identity (disableLocalAuth=true)
            // No AZURE_SPEECH_KEY needed - uses DefaultAzureCredential
            // Requires Cognitive Services User role on the AIServices resource
            {
              name: 'AZURE_SPEECH_REGION'
              value: 'eastus2'
            }
            {
              name: 'AZURE_SPEECH_ENDPOINT'
              value: contentUnderstandingEndpoint
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
              value: openaiEndpoint
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
            // CORS Configuration
            {
              name: 'ALLOWED_ORIGINS'
              value: 'https://${uiAppName}.${containerAppsEnv.properties.defaultDomain}'
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

// Outputs
output containerAppsEnvId string = containerAppsEnv.id
output containerAppsEnvName string = containerAppsEnv.name
output containerAppsEnvDefaultDomain string = containerAppsEnv.properties.defaultDomain
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output uiAppName string = uiContainerApp.name
output uiAppUrl string = 'https://${uiContainerApp.properties.configuration.ingress.fqdn}'
output uiAppPrincipalId string = uiContainerApp.identity.principalId
output apiAppName string = apiContainerApp.name
output apiAppUrl string = 'https://${apiContainerApp.properties.configuration.ingress.fqdn}'
output apiAppPrincipalId string = apiContainerApp.identity.principalId
