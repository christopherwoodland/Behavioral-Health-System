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

@description('Private endpoint subnet ID')
param privateEndpointSubnetId string

@description('Blob Private DNS Zone ID')
param blobPrivateDnsZoneId string

@description('Queue Private DNS Zone ID')
param queuePrivateDnsZoneId string

@description('Table Private DNS Zone ID')
param tablePrivateDnsZoneId string

var storageAccountName = '${appName}${environment}stg${uniqueSuffix}'
var blobPrivateEndpointName = '${storageAccountName}-blob-pe'
var queuePrivateEndpointName = '${storageAccountName}-queue-pe'
var tablePrivateEndpointName = '${storageAccountName}-table-pe'

// Storage Account (Private access, managed identity auth)
// NOTE: allowSharedKeyAccess is false - use RBAC roles for all access
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
      defaultAction: 'Deny'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Disabled'
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

// Queue Service
resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {}
}

// Table Service
resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {}
}

// ============================================================================
// STORAGE CONTAINERS (matching public deployment)
// ============================================================================

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

// Session Data Container
resource sessionDataContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'session-data'
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

// Azure WebJobs Hosts Container (for Functions runtime)
resource webjobsHostsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'azure-webjobs-hosts'
  properties: {
    publicAccess: 'None'
  }
}

// ============================================================================
// PRIVATE ENDPOINTS
// ============================================================================

// Private Endpoint for Blob Storage
resource blobPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: blobPrivateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: blobPrivateEndpointName
        properties: {
          privateLinkServiceId: storageAccount.id
          groupIds: [
            'blob'
          ]
        }
      }
    ]
  }
}

resource blobDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: blobPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'blob-dns-config'
        properties: {
          privateDnsZoneId: blobPrivateDnsZoneId
        }
      }
    ]
  }
}

// Private Endpoint for Queue Storage
resource queuePrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: queuePrivateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: queuePrivateEndpointName
        properties: {
          privateLinkServiceId: storageAccount.id
          groupIds: [
            'queue'
          ]
        }
      }
    ]
  }
}

resource queueDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: queuePrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'queue-dns-config'
        properties: {
          privateDnsZoneId: queuePrivateDnsZoneId
        }
      }
    ]
  }
}

// Private Endpoint for Table Storage
resource tablePrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: tablePrivateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: tablePrivateEndpointName
        properties: {
          privateLinkServiceId: storageAccount.id
          groupIds: [
            'table'
          ]
        }
      }
    ]
  }
}

resource tableDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: tablePrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'table-dns-config'
        properties: {
          privateDnsZoneId: tablePrivateDnsZoneId
        }
      }
    ]
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================
output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output primaryBlobEndpoint string = storageAccount.properties.primaryEndpoints.blob
output primaryQueueEndpoint string = storageAccount.properties.primaryEndpoints.queue
output primaryTableEndpoint string = storageAccount.properties.primaryEndpoints.table
