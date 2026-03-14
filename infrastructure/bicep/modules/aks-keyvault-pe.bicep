/*
================================================================================
AKS Key Vault Private Endpoint Module
================================================================================
Creates a Private Endpoint and Private DNS Zone for the shared Key Vault
inside the AKS VNet so AKS workloads can reach Key Vault with no public
network access required.
================================================================================
*/

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Resource ID of the existing Key Vault')
param keyVaultId string

@description('Private endpoint subnet ID (in AKS VNet)')
param privateEndpointSubnetId string

@description('AKS VNet ID for DNS zone link')
param vnetId string

var kvName       = last(split(keyVaultId, '/'))
var peName       = '${kvName}-aks-pe'
var dnsZoneName  = 'privatelink.vaultcore.azure.net'

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: dnsZoneName
  location: 'global'
  tags: tags
}

resource dnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: '${kvName}-aks-dns-link'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnetId }
    registrationEnabled: false
  }
}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: peName
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: peName
        properties: {
          privateLinkServiceId: keyVaultId
          groupIds: [ 'vault' ]
        }
      }
    ]
  }
}

resource dnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: privateEndpoint
  name: 'kv-dns-zone-group'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'vault'
        properties: { privateDnsZoneId: privateDnsZone.id }
      }
    ]
  }
}
