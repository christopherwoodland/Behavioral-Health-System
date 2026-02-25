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

@description('Private endpoint subnet ID in AI spoke VNet')
param privateEndpointSubnetId string

@description('Cognitive Services Private DNS Zone ID in landing zone')
param cognitiveServicesPrivateDnsZoneId string

@description('Landing zone resource group name')
param landingZoneResourceGroup string

@description('Deploy AI model deployments (set to false if models already exist or quota is limited)')
param deployModels bool = true

var aiServicesName = '${appName}-${environment}-ai-${uniqueSuffix}'
var privateEndpointName = '${aiServicesName}-pe'

// AI Services (Multi-service Cognitive Services account)
resource aiServices 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: aiServicesName
  location: location
  tags: tags
  kind: 'AIServices'
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
      virtualNetworkRules: []
      ipRules: []
    }
    disableLocalAuth: false // Allow key-based auth for some services
  }
}

// ============================================================================
// MODEL DEPLOYMENTS (conditional - set deployModels=false if quota exhausted)
// ============================================================================

// GPT-4.1 deployment
resource gpt41Deployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = if (deployModels) {
  parent: aiServices
  name: 'gpt-4.1'
  sku: {
    name: 'DataZoneStandard'
    capacity: 15
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4.1'
      version: '2025-04-14'
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

// GPT-4.1-mini deployment
resource gpt41MiniDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = if (deployModels) {
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
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
  dependsOn: [gpt41Deployment]
}

// GPT-5-mini deployment
resource gpt5MiniDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = if (deployModels) {
  parent: aiServices
  name: 'gpt-5-mini'
  sku: {
    name: 'GlobalStandard'
    capacity: 500
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-5-mini'
      version: '2025-08-07'
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
  dependsOn: [gpt41MiniDeployment]
}

// GPT-5.2 deployment
resource gpt52Deployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = if (deployModels) {
  parent: aiServices
  name: 'gpt-5.2'
  sku: {
    name: 'DataZoneStandard'
    capacity: 9  // Limited by available quota (300 - 291 = 9)
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-5.2'
      version: '2025-12-11'
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
  dependsOn: [gpt5MiniDeployment]
}

// Model Router deployment
resource modelRouterDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = if (deployModels) {
  parent: aiServices
  name: 'model-router'
  sku: {
    name: 'DataZoneStandard'
    capacity: 15
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'model-router'
      version: '2025-11-18'
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
  dependsOn: [gpt52Deployment]
}

// Text embedding model
resource textEmbeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = if (deployModels) {
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
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
  dependsOn: [modelRouterDeployment]
}

// ============================================================================
// PRIVATE ENDPOINT (deployed to AI spoke subnet)
// ============================================================================

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
          groupIds: ['account']
        }
      }
    ]
  }
}

resource dnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink-cognitiveservices-azure-com'
        properties: {
          privateDnsZoneId: cognitiveServicesPrivateDnsZoneId
        }
      }
    ]
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

output aiServicesName string = aiServices.name
output aiServicesId string = aiServices.id
output aiServicesEndpoint string = aiServices.properties.endpoint
output aiServicesPrincipalId string = aiServices.identity.principalId
