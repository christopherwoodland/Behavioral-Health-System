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

@description('Private endpoint subnet ID')
param privateEndpointSubnetId string

@description('Cognitive Services Private DNS Zone ID')
param cognitivePrivateDnsZoneId string

var aiServicesName = '${appName}-${environment}-ai-${uniqueSuffix}'
var privateEndpointName = '${aiServicesName}-pe'

// Azure AI Services (multi-service account)
// Includes: OpenAI, Document Intelligence, Speech, Content Understanding
resource aiServices 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: aiServicesName
  location: location
  tags: tags
  kind: 'AIServices' // Multi-service account
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: aiServicesName
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
      ipRules: []
      virtualNetworkRules: []
    }
    disableLocalAuth: false // Required for some services, use RBAC where possible
    apiProperties: {
      statisticsEnabled: false
    }
  }
}

// Private Endpoint for AI Services
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: privateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: privateEndpointName
        properties: {
          privateLinkServiceId: aiServices.id
          groupIds: [
            'account'
          ]
        }
      }
    ]
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'cognitive-dns-config'
        properties: {
          privateDnsZoneId: cognitivePrivateDnsZoneId
        }
      }
    ]
  }
}

// ============================================================================
// MODEL DEPLOYMENTS (matching public deployment)
// ============================================================================

// GPT-5.2 (o3) - Extended Assessment
resource gpt52Deployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: aiServices
  name: 'gpt-5.2'
  sku: {
    name: 'GlobalStandard'
    capacity: 291
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'o3'
      version: '2025-04-16'
    }
    raiPolicyName: 'Microsoft.DefaultV2'
  }
}

// GPT-4.1 - Primary model
resource gpt41Deployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: aiServices
  name: 'gpt-4.1'
  sku: {
    name: 'GlobalStandard'
    capacity: 151
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4.1'
      version: '2025-04-14'
    }
    raiPolicyName: 'Microsoft.DefaultV2'
  }
  dependsOn: [gpt52Deployment]
}

// GPT-4.1-mini - Lightweight model
resource gpt41MiniDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: aiServices
  name: 'gpt-4.1-mini'
  sku: {
    name: 'GlobalStandard'
    capacity: 50
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4.1-mini'
      version: '2025-04-14'
    }
    raiPolicyName: 'Microsoft.DefaultV2'
  }
  dependsOn: [gpt41Deployment]
}

// Text Embedding - for vector search
resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: aiServices
  name: 'text-embedding-3-small'
  sku: {
    name: 'Standard'
    capacity: 120
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-3-small'
      version: '1'
    }
    raiPolicyName: 'Microsoft.DefaultV2'
  }
  dependsOn: [gpt41MiniDeployment]
}

// Model Router - for routing requests
resource modelRouterDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: aiServices
  name: 'model-router'
  sku: {
    name: 'GlobalStandard'
    capacity: 150
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'model-router'
      version: '2025-03-01'
    }
    raiPolicyName: 'Microsoft.DefaultV2'
  }
  dependsOn: [embeddingDeployment]
}

// Outputs
output aiServicesName string = aiServices.name
output aiServicesId string = aiServices.id
output aiServicesEndpoint string = aiServices.properties.endpoint
output aiServicesPrincipalId string = aiServices.identity.principalId
output privateEndpointId string = privateEndpoint.id
