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

@description('Key Vault Private DNS Zone ID')
param vaultPrivateDnsZoneId string

@secure()
@description('Kintsugi API Key to store in Key Vault')
param kintsugiApiKey string = ''

@secure()
@description('Azure OpenAI Realtime Key to store in Key Vault')
param azureOpenAIRealtimeKey string = ''

var keyVaultName = '${appName}-${environment}-kv-${uniqueSuffix}'
var privateEndpointName = '${keyVaultName}-pe'

// Key Vault (Private access, RBAC enabled)
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
      ipRules: []
      virtualNetworkRules: []
    }
    publicNetworkAccess: 'Disabled'
  }
}

// Store Kintsugi API Key if provided
resource kintsugiApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(kintsugiApiKey)) {
  parent: keyVault
  name: 'KintsugiApiKey'
  properties: {
    value: kintsugiApiKey
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

// Store Azure OpenAI Realtime Key if provided
resource openaiRealtimeKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(azureOpenAIRealtimeKey)) {
  parent: keyVault
  name: 'openai-realtime-key'
  properties: {
    value: azureOpenAIRealtimeKey
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

// Store Speech Region (static value)
resource speechRegionSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureSpeechRegion'
  properties: {
    value: location
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

// Private Endpoint for Key Vault
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: privateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: privateEndpointName
        properties: {
          privateLinkServiceId: keyVault.id
          groupIds: [
            'vault'
          ]
        }
      }
    ]
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'vault-dns-config'
        properties: {
          privateDnsZoneId: vaultPrivateDnsZoneId
        }
      }
    ]
  }
}

// Outputs
output keyVaultName string = keyVault.name
output keyVaultId string = keyVault.id
output keyVaultUri string = keyVault.properties.vaultUri
output privateEndpointId string = privateEndpoint.id
