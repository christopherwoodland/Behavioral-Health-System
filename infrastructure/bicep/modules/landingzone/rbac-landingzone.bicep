@description('Storage account name')
param storageAccountName string

@description('Key Vault name')
param keyVaultName string

@description('ACR name')
param acrName string

@description('AI Services name')
param aiServicesName string

@description('UI Container App principal ID')
param uiAppPrincipalId string

@description('API Container App principal ID')
param apiAppPrincipalId string

// Role Definition IDs
var storageBlobDataContributorRole = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var storageQueueDataContributorRole = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var storageTableDataContributorRole = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
var keyVaultSecretsUserRole = '4633458b-17de-408a-b874-0445c86b69e6'
var acrPullRole = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var cognitiveServicesUserRole = 'a97b65f3-24c7-4388-baec-2e87135dc908'
var cognitiveServicesOpenAIUserRole = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

// Reference existing resources
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource aiServices 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' existing = {
  name: aiServicesName
}

// ============================================================================
// UI APP RBAC ASSIGNMENTS
// ============================================================================

// UI App - Storage Blob Data Contributor
resource uiStorageBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, uiAppPrincipalId, storageBlobDataContributorRole)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRole)
    principalId: uiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// UI App - Key Vault Secrets User
resource uiKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, uiAppPrincipalId, keyVaultSecretsUserRole)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRole)
    principalId: uiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// UI App - ACR Pull
resource uiAcrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, uiAppPrincipalId, acrPullRole)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRole)
    principalId: uiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// API APP RBAC ASSIGNMENTS
// ============================================================================

// API App - Storage Blob Data Contributor
resource apiStorageBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, apiAppPrincipalId, storageBlobDataContributorRole)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRole)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// API App - Storage Queue Data Contributor
resource apiStorageQueueRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, apiAppPrincipalId, storageQueueDataContributorRole)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributorRole)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// API App - Storage Table Data Contributor
resource apiStorageTableRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, apiAppPrincipalId, storageTableDataContributorRole)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRole)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// API App - Key Vault Secrets User
resource apiKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, apiAppPrincipalId, keyVaultSecretsUserRole)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRole)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// API App - ACR Pull
resource apiAcrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, apiAppPrincipalId, acrPullRole)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRole)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// API App - Cognitive Services User
resource apiCognitiveServicesRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiServices.id, apiAppPrincipalId, cognitiveServicesUserRole)
  scope: aiServices
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRole)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// API App - Cognitive Services OpenAI User
resource apiOpenAIUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiServices.id, apiAppPrincipalId, cognitiveServicesOpenAIUserRole)
  scope: aiServices
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesOpenAIUserRole)
    principalId: apiAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}
