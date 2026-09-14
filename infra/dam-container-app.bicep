targetScope = 'resourceGroup'

@description('Azure region for the DAM Container App.')
param location string = resourceGroup().location

@description('Base name used for DAM resources.')
param namePrefix string = 'bhs-dam'

@description('Immutable image tag previously built in the DAM registry.')
param imageTag string

@secure()
@description('API key required by the DAM initiate and predict endpoints.')
param apiKey string

var registryName = replace('${namePrefix}${uniqueString(subscription().id, resourceGroup().id)}', '-', '')

resource registry 'Microsoft.ContainerRegistry/registries@2023-06-01-preview' existing = {
  name: registryName
}

resource environment 'Microsoft.App/managedEnvironments@2024-10-02-preview' existing = {
  name: '${namePrefix}-env'
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: '${namePrefix}-pull'
}

resource app 'Microsoft.App/containerApps@2025-01-01' = {
  name: namePrefix
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
        targetPort: 8000
        transport: 'auto'
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: pullIdentity.id
        }
      ]
      secrets: [
        {
          name: 'dam-api-key'
          value: apiKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'dam'
          image: '${registry.properties.loginServer}/bhs-dam:${imageTag}'
          env: [
            {
              name: 'DAM_API_KEY'
              secretRef: 'dam-api-key'
            }
            {
              name: 'DAM_MOCK_MODE'
              value: 'false'
            }
            {
              name: 'DAM_MODEL_PATH'
              value: '/models'
            }
            {
              name: 'DAM_PRELOAD_ON_STARTUP'
              value: 'true'
            }
            {
              name: 'HF_HUB_OFFLINE'
              value: '1'
            }
            {
              name: 'TRANSFORMERS_OFFLINE'
              value: '1'
            }
            {
              name: 'UVICORN_WORKERS'
              value: '1'
            }
          ]
          resources: {
            cpu: json('2.0')
            memory: '4Gi'
          }
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/health'
                port: 8000
                scheme: 'HTTP'
              }
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 90
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8000
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
                port: 8000
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
        maxReplicas: 1
      }
    }
  }
}

output appName string = app.name
output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
