@description('VNet name to add subnet to')
param vnetName string

@description('Subnet name for Container Apps')
param subnetName string

@description('Subnet address prefix (must be /23 or larger)')
param subnetAddressPrefix string

// Reference existing VNet
resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' existing = {
  name: vnetName
}

// Create Container Apps subnet with delegation
resource containerAppsSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-05-01' = {
  parent: vnet
  name: subnetName
  properties: {
    addressPrefix: subnetAddressPrefix
    delegations: [
      {
        name: 'Microsoft.App.environments'
        properties: {
          serviceName: 'Microsoft.App/environments'
        }
      }
    ]
    privateEndpointNetworkPolicies: 'Disabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

output subnetId string = containerAppsSubnet.id
output subnetName string = containerAppsSubnet.name
