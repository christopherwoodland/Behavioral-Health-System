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

@description('Azure AD Client ID for MSAL')
param azureAdClientId string = ''

@description('Container image tag for UI')
param uiImageTag string = 'latest'

@description('Container image tag for API')
param apiImageTag string = 'latest'

var containerAppsEnvName = '${appName}-${environment}-cae-${uniqueSuffix}'
var uiAppName = '${appName}-${environment}-ui-${uniqueSuffix}'
var apiAppName = '${appName}-${environment}-api-${uniqueSuffix}'

// Get Log Analytics workspace reference
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: last(split(logAnalyticsWorkspaceId, '/'))
}

// Get Storage Account reference
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

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
            {
              name: 'VITE_API_BASE_URL'
              value: 'https://${apiAppName}.${containerAppsEnv.properties.defaultDomain}/api'
            }
            {
              name: 'VITE_AZURE_CLIENT_ID'
              value: azureAdClientId
            }
            {
              name: 'VITE_AZURE_TENANT_ID'
              value: tenantId
            }
            {
              name: 'VITE_AZURE_REDIRECT_URI'
              value: 'https://${uiAppName}.${containerAppsEnv.properties.defaultDomain}'
            }
            {
              name: 'VITE_ENABLE_TRANSCRIPTION'
              value: 'true'
            }
            {
              name: 'VITE_ENABLE_KINTSUGI'
              value: 'true'
            }
            {
              name: 'VITE_ENABLE_FFMPEG_WORKER'
              value: 'true'
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
        {
          name: 'storage-connection'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
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
            {
              name: 'FUNCTIONS_WORKER_RUNTIME'
              value: 'dotnet-isolated'
            }
            {
              name: 'AzureWebJobsStorage'
              secretRef: 'storage-connection'
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
              value: tenantId
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
              name: 'DocumentIntelligenceEndpoint'
              value: documentIntelligenceEndpoint
            }
            {
              name: 'AZURE_CONTENT_UNDERSTANDING_ENDPOINT'
              value: contentUnderstandingEndpoint
            }
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
