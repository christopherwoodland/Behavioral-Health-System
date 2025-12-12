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

@description('VNet ID for integration')
param vnetId string

@description('Container Apps subnet ID')
param containerAppsSubnetId string

@description('Log Analytics Workspace ID')
param logAnalyticsWorkspaceId string

var containerAppsEnvName = '${appName}-${environment}-cae-${uniqueSuffix}'
var githubRunnerAppName = '${appName}-${environment}-runner-${uniqueSuffix}'

// Container Apps Environment
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppsEnvName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalyticsWorkspaceId, '2022-10-01').customerId
        sharedKey: listKeys(logAnalyticsWorkspaceId, '2022-10-01').primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: containerAppsSubnetId
      internal: true
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// GitHub Runner Container App (placeholder - requires PAT token)
resource githubRunnerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: githubRunnerAppName
  location: location
  tags: tags
  properties: {
    environmentId: containerAppsEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: [
        // Add GitHub PAT as secret later via Azure CLI or Portal
        // {
        //   name: 'github-pat'
        //   value: '<your-github-pat-token>'
        // }
      ]
      registries: []
    }
    template: {
      containers: [
        {
          name: 'github-runner'
          // Using myoung34's GitHub runner image - most popular community image
          image: 'myoung34/github-runner:latest'
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: [
            {
              name: 'REPO_URL'
              value: 'https://github.com/christopherwoodland/BehavioralHealthSystem'
            }
            {
              name: 'RUNNER_SCOPE'
              value: 'repo'
            }
            {
              name: 'LABELS'
              value: 'azure,container-apps,self-hosted'
            }
            // {
            //   name: 'ACCESS_TOKEN'
            //   secretRef: 'github-pat'
            // }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [
          {
            name: 'github-runner-scaling'
            custom: {
              type: 'github-runner'
              metadata: {
                owner: 'christopherwoodland'
                repos: 'BehavioralHealthSystem'
                targetWorkflowQueueLength: '1'
              }
            }
          }
        ]
      }
    }
  }
}

output containerAppsEnvId string = containerAppsEnv.id
output containerAppsEnvName string = containerAppsEnv.name
output githubRunnerAppId string = githubRunnerApp.id
output githubRunnerAppName string = githubRunnerApp.name
output githubRunnerAppUrl string = githubRunnerApp.properties.configuration.ingress.fqdn
