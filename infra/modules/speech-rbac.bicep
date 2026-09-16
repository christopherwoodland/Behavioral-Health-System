targetScope = 'resourceGroup'

@description('Name of the existing Azure AI Speech account.')
param speechAccountName string

@description('Object ID of the runtime managed identity.')
param principalId string

@description('Resource ID of the principal owner, used to make the assignment name deterministic.')
param principalResourceId string

var cognitiveServicesSpeechUserRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'f2dc8367-1007-4938-bd23-fe263f013447'
)

resource speechAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: speechAccountName
}

resource cognitiveServicesSpeechUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(speechAccount.id, principalResourceId, cognitiveServicesSpeechUserRoleDefinitionId)
  scope: speechAccount
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: cognitiveServicesSpeechUserRoleDefinitionId
  }
}

output assignedRoleDefinitionId string = cognitiveServicesSpeechUserRoleDefinitionId
