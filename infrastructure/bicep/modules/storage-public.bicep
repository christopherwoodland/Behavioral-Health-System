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

var storageAccountName = '${appName}${environment}stg${uniqueSuffix}'

// Storage Account (Public access enabled, managed identity auth)
// NOTE: allowSharedKeyAccess is false - use RBAC roles for all access
// Required RBAC roles for Container Apps:
//   - Storage Blob Data Contributor
//   - Storage Table Data Contributor
//   - Storage Queue Data Contributor
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false // Use managed identity with RBAC instead
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled' // Required for non-VNet deployments
  }
}

// Blob Service
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

// DSM-5 Data Container
resource dsm5Container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'dsm5-data'
  properties: {
    publicAccess: 'None'
  }
}

// Conversations Container
resource conversationsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'conversations'
  properties: {
    publicAccess: 'None'
  }
}

// Voice Recordings Container
resource voiceContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'voice-recordings'
  properties: {
    publicAccess: 'None'
  }
}

// Kintsugi Container
resource kintsugiContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'kintsugi'
  properties: {
    publicAccess: 'None'
  }
}

// Function App Deployment Container
resource functionDeployContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'function-app-deployment'
  properties: {
    publicAccess: 'None'
  }
}

// File Groups Container
resource fileGroupsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'file-groups'
  properties: {
    publicAccess: 'None'
  }
}

// Sessions Container
resource sessionsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'sessions'
  properties: {
    publicAccess: 'None'
  }
}

// Biometric Data Container
resource biometricDataContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'biometric-data'
  properties: {
    publicAccess: 'None'
  }
}

// Audio Uploads Container (for Kintsugi predictions)
resource audioUploadsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'audio-uploads'
  properties: {
    publicAccess: 'None'
  }
}

output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output primaryBlobEndpoint string = storageAccount.properties.primaryEndpoints.blob
