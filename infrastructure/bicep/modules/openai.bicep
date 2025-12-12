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

var openaiAccountName = '${appName}-${environment}-openai-${uniqueSuffix}'
var privateEndpointName = '${openaiAccountName}-pe'

// Azure AI Foundry Account (OpenAI without model deployments)
resource openaiAccount 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: openaiAccountName
  location: location
  tags: tags
  sku: {
    name: 'S0'
  }
  kind: 'OpenAI'
  properties: {
    customSubDomainName: openaiAccountName
    networkAcls: {
      defaultAction: 'Deny'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Disabled'
  }
}

// Private Endpoint for OpenAI
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
          privateLinkServiceId: openaiAccount.id
          groupIds: [
            'account'
          ]
        }
      }
    ]
  }
}

output openaiAccountName string = openaiAccount.name
output openaiAccountId string = openaiAccount.id
output endpoint string = openaiAccount.properties.endpoint
output privateEndpointName string = privateEndpoint.name
output privateEndpointId string = privateEndpoint.id
