/*
================================================================================
AKS Storage Module
================================================================================
Creates a new Storage Account dedicated to the AKS deployment, with:
  - Public network access DISABLED — all sub-services via private endpoints
  - Private endpoints: blob, table, queue (each with its own DNS zone)
  - Managed Identity auth only (no shared keys)
  - Blob containers: audio-uploads, file-groups, dsm5-data, conversations,
    azure-webjobs-hosts (Durable Functions task hub)
================================================================================
*/

@description('Azure region')
param location string

@description('App name prefix')
param appName string

@description('Environment name')
param environment string

@description('Unique suffix for globally unique name')
param uniqueSuffix string

@description('Resource tags')
param tags object

@description('Private endpoint subnet ID')
param privateEndpointSubnetId string

@description('VNet ID for DNS zone link')
param vnetId string

var storageAccountName = '${appName}${environment}aksstg${take(uniqueSuffix, 12)}'
var blobPeName    = '${storageAccountName}-blob-pe'
var tablePeName   = '${storageAccountName}-table-pe'
var queuePeName   = '${storageAccountName}-queue-pe'
var blobDnsZone   = 'privatelink.blob.core.windows.net'
var tableDnsZone  = 'privatelink.table.core.windows.net'
var queueDnsZone  = 'privatelink.queue.core.windows.net'

// Storage Account
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
    allowSharedKeyAccess: false
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
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

// Required blob containers
resource containerAudioUploads 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'audio-uploads'
  properties: { publicAccess: 'None' }
}

resource containerFileGroups 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'file-groups'
  properties: { publicAccess: 'None' }
}

resource containerDsm5 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'dsm5-data'
  properties: { publicAccess: 'None' }
}

resource containerConversations 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'conversations'
  properties: { publicAccess: 'None' }
}

// Durable Functions task hub storage (azure-webjobs-hosts)
resource containerWebJobs 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'azure-webjobs-hosts'
  properties: { publicAccess: 'None' }
}

// ─── Private DNS Zones ────────────────────────────────────────────────────────

resource blobPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: blobDnsZone
  location: 'global'
  tags: tags
}

resource tablePrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: tableDnsZone
  location: 'global'
  tags: tags
}

resource queuePrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: queueDnsZone
  location: 'global'
  tags: tags
}

resource blobDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: blobPrivateDnsZone
  name: '${storageAccountName}-dns-link'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnetId }
    registrationEnabled: false
  }
}

resource tableDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: tablePrivateDnsZone
  name: '${storageAccountName}-table-dns-link'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnetId }
    registrationEnabled: false
  }
}

resource queueDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: queuePrivateDnsZone
  name: '${storageAccountName}-queue-dns-link'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnetId }
    registrationEnabled: false
  }
}

// ─── Private Endpoints ────────────────────────────────────────────────────────

resource blobPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: blobPeName
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: blobPeName
        properties: {
          privateLinkServiceId: storageAccount.id
          groupIds: [ 'blob' ]
        }
      }
    ]
  }
}

resource tablePrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: tablePeName
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: tablePeName
        properties: {
          privateLinkServiceId: storageAccount.id
          groupIds: [ 'table' ]
        }
      }
    ]
  }
}

resource queuePrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: queuePeName
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: queuePeName
        properties: {
          privateLinkServiceId: storageAccount.id
          groupIds: [ 'queue' ]
        }
      }
    ]
  }
}

// ─── DNS Zone Groups ──────────────────────────────────────────────────────────

resource blobDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: blobPrivateEndpoint
  name: 'blob-dns-zone-group'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'blob'
        properties: { privateDnsZoneId: blobPrivateDnsZone.id }
      }
    ]
  }
}

resource tableDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: tablePrivateEndpoint
  name: 'table-dns-zone-group'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'table'
        properties: { privateDnsZoneId: tablePrivateDnsZone.id }
      }
    ]
  }
}

resource queueDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: queuePrivateEndpoint
  name: 'queue-dns-zone-group'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'queue'
        properties: { privateDnsZoneId: queuePrivateDnsZone.id }
      }
    ]
  }
}

output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output storageAccountResourceId string = storageAccount.id
