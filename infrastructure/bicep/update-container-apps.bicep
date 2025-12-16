/*
================================================================================
UPDATE EXISTING CONTAINER APPS
================================================================================
This Bicep template updates EXISTING Container Apps with new environment
variables. It does NOT create new resources - it references existing ones.

Use this when you need to update env vars without full infrastructure deployment.

SECRETS: This template pulls secrets from Key Vault using managed identity.
Required Key Vault secrets:
  - openai-realtime-key     (UI: VITE_AZURE_OPENAI_REALTIME_KEY)
  - kintsugi-api-key        (API: Kintsugi API key)

NOTE: Azure Speech uses managed identity with Cognitive Services User role
      on the AIServices resource (no API key needed - disableLocalAuth=true)

PRE-REQUISITES:
1. Container Apps must have System-Assigned Managed Identity enabled
2. Managed Identities must have 'Key Vault Secrets User' role on Key Vault
3. Key Vault must allow access from Container Apps (firewall/private endpoint)

DEPLOY COMMAND:
az deployment group create \
  --resource-group bhs-development-public \
  --template-file update-container-apps.bicep
================================================================================
*/

targetScope = 'resourceGroup'

@description('Azure region for resources')
param location string = 'eastus2'

// ============================================================================
// EXISTING RESOURCE NAMES (hardcoded from your deployment)
// ============================================================================
@description('Existing Container Apps Environment name')
param containerAppsEnvName string = 'bhs-dev-cae-4exbxrzknexso'

@description('Existing UI Container App name')
param uiAppName string = 'bhs-dev-ui-4exbxrzknexso'

@description('Existing API Container App name')
param apiAppName string = 'bhs-dev-api-4exbxrzknexso'

@description('Existing Azure Container Registry name')
param acrName string = 'bhsdevelopmentacr4znv2wxlxs4xq'

@description('Existing Storage account name')
param storageAccountName string = 'bhsdevstg4exbxrzknexso'

@description('Existing Key Vault name')
param keyVaultName string = 'bhs-dev-kv-4exbxrzknexso'

@description('Existing Application Insights name')
param appInsightsName string = 'bhs-dev-appinsights'

// ============================================================================
// CONFIGURABLE PARAMETERS
// ============================================================================
@description('Container image tag for UI')
param uiImageTag string = 'latest'

@description('Container image tag for API')
param apiImageTag string = 'latest'

@description('Azure OpenAI endpoint')
param openaiEndpoint string = 'https://bhs-development-public-foundry-r.cognitiveservices.azure.com/'

@description('Document Intelligence endpoint')
param documentIntelligenceEndpoint string = 'https://bhs-development-public-foundry-r.cognitiveservices.azure.com/'

@description('Content Understanding endpoint')
param contentUnderstandingEndpoint string = 'https://bhs-development-public-foundry-r.cognitiveservices.azure.com/'

@description('Azure AD Client ID for MSAL')
param azureAdClientId string = '7d8eeaee-1790-43b3-93d5-0f9ed9f6e18b'

@description('Azure Tenant ID')
param tenantId string = '36584371-2a86-4e03-afee-c2ba00e5e30e'

// Azure OpenAI Realtime API Parameters (UI)
@description('Azure OpenAI Realtime deployment name')
param azureOpenAIRealtimeDeployment string = 'gpt-realtime'

@description('Azure OpenAI Realtime API version')
param azureOpenAIRealtimeApiVersion string = '2025-04-01-preview'

@description('Azure OpenAI resource name for Realtime API (from .env.local VITE_AZURE_OPENAI_REALTIME_RESOURCE_NAME)')
param azureOpenAIResourceName string = 'cwood-mgsuknv5-eastus2'

@description('Azure OpenAI WebRTC region')
param azureOpenAIWebRTCRegion string = 'eastus2'

// Agent Configuration
@description('Extended Assessment OpenAI Deployment')
param extendedAssessmentDeployment string = 'gpt-5.2'

@description('Agent Model Deployment')
param agentModelDeployment string = 'gpt-5.2'

// ============================================================================
// REFERENCE EXISTING RESOURCES
// ============================================================================
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: containerAppsEnvName
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appInsightsName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Key Vault URI for secret references
var keyVaultUri = 'https://${keyVaultName}.vault.azure.net/secrets'

// ============================================================================
// UI CONTAINER APP
// ============================================================================
resource uiContainerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: uiAppName
  location: location
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
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'openai-realtime-key'
          keyVaultUrl: '${keyVaultUri}/openai-realtime-key'
          identity: 'system'
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
              value: 'true'
            }
            {
              name: 'VITE_DEV_ENVIRONMENT_TEXT'
              value: 'Please be mindful when uploading content and avoid submitting any proprietary, confidential, or sensitive data. Only provide information that is safe and intended for shared or demonstration purposes.'
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

// ============================================================================
// API CONTAINER APP
// ============================================================================
resource apiContainerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: apiAppName
  location: location
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
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'storage-connection'
          keyVaultUrl: '${keyVaultUri}/storage-connection-string'
          identity: 'system'
        }
        {
          name: 'kintsugi-api-key'
          keyVaultUrl: '${keyVaultUri}/KintsugiApiKey'
          identity: 'system'
        }
        // NOTE: No speech-api-key secret - using managed identity with Cognitive Services User role
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
              value: appInsights.properties.ConnectionString
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
// ROLE ASSIGNMENTS (skipped if already exist - set createRoleAssignments=true for first deployment)
// ============================================================================

@description('Create role assignments - set to false if they already exist')
param createRoleAssignments bool = false

// Key Vault Secrets User role for UI Container App
resource uiKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (createRoleAssignments) {
  name: guid(keyVault.id, uiContainerApp.id, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    principalId: uiContainerApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalType: 'ServicePrincipal'
  }
}

// Key Vault Secrets User role for API Container App
resource apiKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (createRoleAssignments) {
  name: guid(keyVault.id, apiContainerApp.id, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    principalId: apiContainerApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalType: 'ServicePrincipal'
  }
}

// ACR Pull role for UI Container App
resource uiAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (createRoleAssignments) {
  name: guid(acr.id, uiContainerApp.id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: acr
  properties: {
    principalId: uiContainerApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalType: 'ServicePrincipal'
  }
}

// ACR Pull role for API Container App
resource apiAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (createRoleAssignments) {
  name: guid(acr.id, apiContainerApp.id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: acr
  properties: {
    principalId: apiContainerApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalType: 'ServicePrincipal'
  }
}

// Storage Blob Data Contributor role for API Container App
resource apiStorageBlobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (createRoleAssignments) {
  name: guid(storageAccount.id, apiContainerApp.id, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  scope: storageAccount
  properties: {
    principalId: apiContainerApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================
output uiAppUrl string = 'https://${uiContainerApp.properties.configuration.ingress.fqdn}'
output apiAppUrl string = 'https://${apiContainerApp.properties.configuration.ingress.fqdn}'
output uiAppPrincipalId string = uiContainerApp.identity.principalId
output apiAppPrincipalId string = apiContainerApp.identity.principalId
