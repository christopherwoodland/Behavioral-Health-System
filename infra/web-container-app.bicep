targetScope = 'resourceGroup'

@description('Azure region for the web Container App.')
param location string = resourceGroup().location

@description('Name of the web Container App.')
param appName string = 'bhs-web'

@description('Immutable image tag already built in the existing registry.')
param imageTag string

@description('Repository name used for the web image.')
param imageRepository string = 'bhs-web'

@description('Existing DAM foundation resource prefix.')
param damNamePrefix string = 'bhs-dam'

@description('Base URL of the deployed Functions API.')
param apiBaseUrl string = 'https://bhs-functions-easyauth.azurewebsites.net/api'

@description('Microsoft Entra tenant ID.')
param tenantId string = '16b3c013-d300-468d-ac64-7eda0820b6d3'

@description('Microsoft Entra SPA application client ID.')
param uiClientId string = '16bd4645-402e-44ba-9c6f-414af87f7d6e'

@description('Microsoft Entra API application client ID.')
param apiClientId string = '687b082f-65b5-4d2f-ab94-8d1949ba1f87'

var registryName = replace('${damNamePrefix}${uniqueString(subscription().id, resourceGroup().id)}', '-', '')
var webOrigin = 'https://${appName}.${environment.properties.defaultDomain}'

resource registry 'Microsoft.ContainerRegistry/registries@2023-06-01-preview' existing = {
  name: registryName
}

resource environment 'Microsoft.App/managedEnvironments@2024-10-02-preview' existing = {
  name: '${damNamePrefix}-env'
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: '${damNamePrefix}-pull'
}

resource app 'Microsoft.App/containerApps@2025-01-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
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
    }
    template: {
      containers: [
        {
          name: 'web'
          image: '${registry.properties.loginServer}/${imageRepository}:${imageTag}'
          env: [
            {
              name: 'VITE_API_BASE_URL'
              value: apiBaseUrl
            }
            {
              name: 'VITE_ENABLE_ENTRA_AUTH'
              value: 'true'
            }
            {
              name: 'VITE_AZURE_CLIENT_ID'
              value: uiClientId
            }
            {
              name: 'VITE_AZURE_API_CLIENT_ID'
              value: apiClientId
            }
            {
              name: 'VITE_AZURE_TENANT_ID'
              value: tenantId
            }
            {
              name: 'VITE_AZURE_AUTHORITY'
              value: '${az.environment().authentication.loginEndpoint}${tenantId}'
            }
            {
              name: 'VITE_AZURE_REDIRECT_URI'
              value: webOrigin
            }
            {
              name: 'VITE_AZURE_POST_LOGOUT_REDIRECT_URI'
              value: webOrigin
            }
            {
              name: 'VITE_AIR_GAP_MODE'
              value: 'false'
            }
            {
              name: 'VITE_STORAGE_CONTAINER_NAME'
              value: 'audio-uploads'
            }
            {
              name: 'VITE_ENABLE_DEBUG_LOGGING'
              value: 'false'
            }
            {
              name: 'VITE_ENABLE_TRANSCRIPTION'
              value: 'true'
            }
            {
              name: 'VITE_ENABLE_AI_RISK_ASSESSMENT'
              value: 'true'
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/health'
                port: 80
                scheme: 'HTTP'
              }
              periodSeconds: 5
              timeoutSeconds: 5
              failureThreshold: 30
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
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
                path: '/health'
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
        maxReplicas: 2
        rules: [
          {
            name: 'http-concurrency'
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

output appName string = app.name
output appUrl string = webOrigin
output appFqdn string = app.properties.configuration.ingress.fqdn
