/*
================================================================================
AKS Networking Module
================================================================================
Creates a VNet with subnets purpose-built for AKS + Application Gateway (AGIC):

  aks-nodes-subnet   10.0.16.0/22  — AKS system + user node pools
  appgw-subnet       10.0.20.0/24  — Application Gateway v2 (WAF_v2)
  private-ep-subnet  10.0.21.0/24  — Private Endpoints (Storage, KV, PG)

The address space (10.0.16.0/20) is deliberately separate from the existing
Container Apps VNet (10.0.0.0/16) so both can coexist in the same subscription
without overlap.
================================================================================
*/

@description('Azure region')
param location string

@description('App name prefix')
param appName string

@description('Environment name')
param environment string

@description('Resource tags')
param tags object

var vnetName = '${appName}-${environment}-aks-vnet'
var nsgNodeName = '${appName}-${environment}-aks-nodes-nsg'
var nsgAppGwName = '${appName}-${environment}-appgw-nsg'

// NSG for AKS node pools
resource nsgNodes 'Microsoft.Network/networkSecurityGroups@2023-05-01' = {
  name: nsgNodeName
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPSInbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: '10.0.20.0/24' // from AppGW subnet
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRanges: [ '80', '443' ]
        }
      }
      {
        name: 'AllowAzureLoadBalancer'
        properties: {
          priority: 200
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: 'AzureLoadBalancer'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
      {
        name: 'DenyAllInbound'
        properties: {
          priority: 4096
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

// NSG for Application Gateway subnet
resource nsgAppGw 'Microsoft.Network/networkSecurityGroups@2023-05-01' = {
  name: nsgAppGwName
  location: location
  tags: tags
  properties: {
    securityRules: [
      // Required for App Gateway v2 health probes and management
      {
        name: 'AllowGatewayManager'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: 'GatewayManager'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '65200-65535'
        }
      }
      {
        name: 'AllowHTTPInbound'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
      {
        name: 'AllowHTTPSInbound'
        properties: {
          priority: 120
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'AllowAzureLoadBalancer'
        properties: {
          priority: 130
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: 'AzureLoadBalancer'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

// VNet
resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.16.0/20'
      ]
    }
    subnets: [
      {
        name: 'aks-nodes-subnet'
        properties: {
          addressPrefix: '10.0.16.0/22'
          networkSecurityGroup: { id: nsgNodes.id }
          serviceEndpoints: [
            { service: 'Microsoft.ContainerRegistry' }
          ]
        }
      }
      {
        name: 'appgw-subnet'
        properties: {
          addressPrefix: '10.0.20.0/24'
          networkSecurityGroup: { id: nsgAppGw.id }
        }
      }
      {
        name: 'private-ep-subnet'
        properties: {
          addressPrefix: '10.0.21.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
          privateLinkServiceNetworkPolicies: 'Enabled'
        }
      }
    ]
  }
}

output vnetId string = vnet.id
output vnetName string = vnet.name
output aksNodesSubnetId string = vnet.properties.subnets[0].id
output appGwSubnetId string = vnet.properties.subnets[1].id
output privateEndpointSubnetId string = vnet.properties.subnets[2].id
