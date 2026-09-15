targetScope = 'resourceGroup'

@description('Name of the existing storage account.')
param storageAccountName string

@description('Object ID of the runtime managed identity.')
param principalId string

@description('Resource ID of the principal owner, used to make assignment names deterministic.')
param principalResourceId string

var blobDataContributorRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var queueDataContributorRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '974c5e8b-45b9-4653-ba55-5f855dd0fb88')
var tableDataContributorRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3')

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource blobDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, principalResourceId, blobDataContributorRoleDefinitionId)
  scope: storage
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobDataContributorRoleDefinitionId
  }
}

resource queueDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, principalResourceId, queueDataContributorRoleDefinitionId)
  scope: storage
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: queueDataContributorRoleDefinitionId
  }
}

resource tableDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, principalResourceId, tableDataContributorRoleDefinitionId)
  scope: storage
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: tableDataContributorRoleDefinitionId
  }
}

output assignedRoleDefinitionIds array = [
  blobDataContributorRoleDefinitionId
  queueDataContributorRoleDefinitionId
  tableDataContributorRoleDefinitionId
]
