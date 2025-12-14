@description('UI Container App principal ID')
param uiAppPrincipalId string

@description('API Container App principal ID')
param apiAppPrincipalId string

@description('Document Intelligence resource name')
param documentIntelligenceName string

@description('Content Understanding resource name')
param contentUnderstandingName string

@description('Storage account name')
param storageAccountName string

@description('Key Vault name')
param keyVaultName string

// Role Definition IDs
// Built-in role definitions: https://docs.microsoft.com/en-us/azure/role-based-access-control/built-in-roles
var cognitiveServicesUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908'
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var storageQueueDataContributorRoleId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

// Reference existing resources
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource documentIntelligence 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' existing = {
  name: documentIntelligenceName
}

resource contentUnderstanding 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' existing = {
  name: contentUnderstandingName
}

// ============================================
// API Container App RBAC Assignments
// ============================================

// API App -> Storage Blob Data Contributor
resource apiStorageBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, apiAppPrincipalId, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// API App -> Storage Queue Data Contributor
resource apiStorageQueueRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, apiAppPrincipalId, storageQueueDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributorRoleId)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// API App -> Storage Table Data Contributor
resource apiStorageTableRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, apiAppPrincipalId, storageTableDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRoleId)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// API App -> Key Vault Secrets User
resource apiKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, apiAppPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// API App -> Document Intelligence Cognitive Services User
resource apiDocIntelRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(documentIntelligence.id, apiAppPrincipalId, cognitiveServicesUserRoleId)
  scope: documentIntelligence
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// API App -> Content Understanding Cognitive Services User
resource apiContentRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(contentUnderstanding.id, apiAppPrincipalId, cognitiveServicesUserRoleId)
  scope: contentUnderstanding
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================
// UI Container App RBAC Assignments (minimal)
// ============================================

// UI App -> Storage Blob Data Contributor (for serving any blob content if needed)
resource uiStorageBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, uiAppPrincipalId, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: uiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}
