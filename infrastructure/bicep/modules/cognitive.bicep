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

var documentIntelligenceName = '${appName}-${environment}-docintel-${uniqueSuffix}'
var contentUnderstandingName = '${appName}-${environment}-content-${uniqueSuffix}'
var documentPrivateEndpointName = '${documentIntelligenceName}-pe'
var contentPrivateEndpointName = '${contentUnderstandingName}-pe'

// Document Intelligence
resource documentIntelligence 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: documentIntelligenceName
  location: location
  tags: tags
  sku: {
    name: 'S0'
  }
  kind: 'FormRecognizer'
  properties: {
    customSubDomainName: documentIntelligenceName
    networkAcls: {
      defaultAction: 'Deny'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Disabled'
  }
}

// Content Understanding (AI Services)
resource contentUnderstanding 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: contentUnderstandingName
  location: location
  tags: tags
  sku: {
    name: 'S0'
  }
  kind: 'AIServices'
  properties: {
    customSubDomainName: contentUnderstandingName
    networkAcls: {
      defaultAction: 'Deny'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Disabled'
  }
}

// Private Endpoint for Document Intelligence
resource documentPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: documentPrivateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: documentPrivateEndpointName
        properties: {
          privateLinkServiceId: documentIntelligence.id
          groupIds: [
            'account'
          ]
        }
      }
    ]
  }
}

// Private Endpoint for Content Understanding
resource contentPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: contentPrivateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: contentPrivateEndpointName
        properties: {
          privateLinkServiceId: contentUnderstanding.id
          groupIds: [
            'account'
          ]
        }
      }
    ]
  }
}

output documentIntelligenceName string = documentIntelligence.name
output documentIntelligenceId string = documentIntelligence.id
output documentIntelligenceEndpoint string = documentIntelligence.properties.endpoint
output contentUnderstandingName string = contentUnderstanding.name
output contentUnderstandingEndpoint string = contentUnderstanding.properties.endpoint
output documentPrivateEndpointName string = documentPrivateEndpoint.name
output contentPrivateEndpointName string = contentPrivateEndpoint.name
