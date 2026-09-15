targetScope = 'resourceGroup'

@description('Name of the existing Microsoft Foundry account.')
param foundryAccountName string

@description('Object ID of the runtime managed identity.')
param principalId string

@description('Resource ID of the principal owner, used to make the assignment name deterministic.')
param principalResourceId string

var foundryAgentConsumerRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'eed3b665-ab3a-47b6-8f48-c9382fb1dad6')

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: foundryAccountName
}

resource foundryAgentConsumer 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundryAccount.id, principalResourceId, foundryAgentConsumerRoleDefinitionId)
  scope: foundryAccount
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: foundryAgentConsumerRoleDefinitionId
  }
}

output assignedRoleDefinitionId string = foundryAgentConsumerRoleDefinitionId
