/*
================================================================================
AKS PostgreSQL Private Endpoint Module
================================================================================
Creates a Private Endpoint and Private DNS Zone for the shared PostgreSQL
Flexible Server inside the AKS VNet, so AKS workloads can connect without
traversing the public internet.

NOTE: After this PE is deployed, disable public access on the PG server:
  az postgres flexible-server update \
    --resource-group <rg> --name <server> --public-access Disabled
================================================================================
*/

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Resource ID of the existing PostgreSQL Flexible Server')
param postgresServerId string

@description('Private endpoint subnet ID (in AKS VNet)')
param privateEndpointSubnetId string

@description('AKS VNet ID for DNS zone link')
param vnetId string

var serverName  = last(split(postgresServerId, '/'))
var peName      = '${serverName}-aks-pe'
var dnsZoneName = 'privatelink.postgres.database.azure.com'

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: dnsZoneName
  location: 'global'
  tags: tags
}

resource dnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: '${serverName}-aks-dns-link'
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
          privateLinkServiceId: postgresServerId
          groupIds: [ 'postgresqlServer' ]
        }
      }
    ]
  }
}

resource dnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: privateEndpoint
  name: 'postgres-dns-zone-group'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'postgres'
        properties: { privateDnsZoneId: privateDnsZone.id }
      }
    ]
  }
}
