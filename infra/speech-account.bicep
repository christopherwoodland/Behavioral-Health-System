targetScope = 'resourceGroup'

@description('Azure region that supports MAI-Transcribe.')
param location string = 'eastus'

@description('Name and custom subdomain of the Speech-only Azure AI account.')
param accountName string = 'bhs-transcription-eastus'

@description('Object ID of the Functions managed identity.')
param functionsPrincipalId string

@description('Resource ID of the Functions Container App, used to make the assignment name deterministic.')
param functionsResourceId string

var cognitiveServicesSpeechUserRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'f2dc8367-1007-4938-bd23-fe263f013447')

resource speechAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: accountName
  location: location
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: accountName
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
      ipRules: []
      virtualNetworkRules: []
    }
  }
}

resource cognitiveServicesSpeechUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(speechAccount.id, functionsResourceId, cognitiveServicesSpeechUserRoleDefinitionId)
  scope: speechAccount
  properties: {
    principalId: functionsPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: cognitiveServicesSpeechUserRoleDefinitionId
  }
}

output accountId string = speechAccount.id
output endpoint string = speechAccount.properties.endpoint
