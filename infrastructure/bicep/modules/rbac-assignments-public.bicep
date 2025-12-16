@description('Function App Principal ID')
param functionAppPrincipalId string

@description('Web App Principal ID (optional)')
param webAppPrincipalId string = ''

@description('Document Intelligence Account Name')
param documentIntelligenceName string

@description('Content Understanding Account Name')
param contentUnderstandingName string

@description('Storage Account Name')
param storageAccountName string

@description('Key Vault Name')
param keyVaultName string

// Built-in Azure RBAC role IDs
// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
var cognitiveServicesUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908' // Cognitive Services User
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe' // Storage Blob Data Contributor
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3' // Storage Table Data Contributor (Durable Functions)
var storageQueueDataContributorRoleId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88' // Storage Queue Data Contributor (Durable Functions)
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User

// Get existing resources
resource documentIntelligenceAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: documentIntelligenceName
}

resource contentUnderstandingAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: contentUnderstandingName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// ============================================
// FUNCTION APP ROLE ASSIGNMENTS
// ============================================

// Assign Cognitive Services User role to Function App for Document Intelligence
resource documentIntelligenceRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(documentIntelligenceAccount.id, functionAppPrincipalId, cognitiveServicesUserRoleId)
  scope: documentIntelligenceAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Cognitive Services User role to Function App for Content Understanding
resource contentUnderstandingRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(contentUnderstandingAccount.id, functionAppPrincipalId, cognitiveServicesUserRoleId)
  scope: contentUnderstandingAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Storage Blob Data Contributor role to Function App for Storage Account
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionAppPrincipalId, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Storage Table Data Contributor role to Function App (required for Durable Functions)
resource storageTableRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionAppPrincipalId, storageTableDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRoleId)
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Storage Queue Data Contributor role to Function App (required for Durable Functions)
resource storageQueueRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionAppPrincipalId, storageQueueDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributorRoleId)
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Key Vault Secrets User role to Function App for Key Vault
resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionAppPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================
// WEB APP ROLE ASSIGNMENTS (OPTIONAL)
// ============================================

// Assign Key Vault Secrets User role to Web App (if principal ID provided)
resource webAppKeyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(webAppPrincipalId)) {
  name: guid(keyVault.id, webAppPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: webAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output documentIntelligenceRoleAssignmentId string = documentIntelligenceRoleAssignment.id
output contentUnderstandingRoleAssignmentId string = contentUnderstandingRoleAssignment.id
output storageRoleAssignmentId string = storageRoleAssignment.id
output keyVaultRoleAssignmentId string = keyVaultRoleAssignment.id
