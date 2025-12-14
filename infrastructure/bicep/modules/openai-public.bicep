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

var openaiAccountName = '${appName}-${environment}-openai-${uniqueSuffix}'

// Azure OpenAI (Public access enabled)
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
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
  }
}

output openaiAccountName string = openaiAccount.name
output openaiAccountId string = openaiAccount.id
output endpoint string = openaiAccount.properties.endpoint
