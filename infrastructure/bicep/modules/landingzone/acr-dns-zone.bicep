@description('VNet IDs to link the DNS zone to')
param vnetIds array

var dnsZoneName = 'privatelink.azurecr.io'

// Create ACR Private DNS Zone if it doesn't exist
resource acrDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: dnsZoneName
  location: 'global'
  properties: {}
}

// Link DNS zone to each VNet
resource vnetLinks 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = [for (vnetId, i) in vnetIds: {
  parent: acrDnsZone
  name: 'link-${i}'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}]

output dnsZoneId string = acrDnsZone.id
output dnsZoneName string = acrDnsZone.name
