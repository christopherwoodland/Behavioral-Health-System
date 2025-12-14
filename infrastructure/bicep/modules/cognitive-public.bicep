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

var documentIntelligenceName = '${appName}-${environment}-docintel-${uniqueSuffix}'
var contentUnderstandingName = '${appName}-${environment}-content-${uniqueSuffix}'

// Document Intelligence (Public access enabled)
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
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
  }
}

// Content Understanding / AI Services (Public access enabled)
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
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
  }
}

output documentIntelligenceName string = documentIntelligence.name
output documentIntelligenceId string = documentIntelligence.id
output documentIntelligenceEndpoint string = documentIntelligence.properties.endpoint
output contentUnderstandingName string = contentUnderstanding.name
output contentUnderstandingEndpoint string = contentUnderstanding.properties.endpoint
