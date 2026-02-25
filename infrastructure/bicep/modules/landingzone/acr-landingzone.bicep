@description('Azure region for resources')
param location string

@description('Application name prefix')
@minLength(2)
param appName string

@description('Environment name')
param environment string

@description('Unique suffix for global names')
param uniqueSuffix string

@description('Resource tags')
param tags object

@description('Private endpoint subnet ID in landing zone')
param privateEndpointSubnetId string

@description('ACR Private DNS Zone ID in landing zone')
param acrPrivateDnsZoneId string

@description('Landing zone resource group name')
param landingZoneResourceGroup string

var acrName = '${appName}${environment}acr${take(uniqueSuffix, 13)}'
var privateEndpointName = '${acrName}-pe'

// Azure Container Registry (Premium for Private Link support)
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Premium' // Required for Private Link
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Disabled'
    networkRuleBypassOptions: 'AzureServices'
    policies: {
      quarantinePolicy: {
        status: 'disabled'
      }
      trustPolicy: {
        type: 'Notary'
        status: 'disabled'
      }
      retentionPolicy: {
        days: 30
        status: 'enabled'
      }
    }
    encryption: {
      status: 'disabled'
    }
    dataEndpointEnabled: false
    zoneRedundancy: 'Disabled'
  }
}

// ============================================================================
// PRIVATE ENDPOINT (deployed to landing zone subnet)
// ============================================================================

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
          privateLinkServiceId: acr.id
          groupIds: ['registry']
        }
      }
    ]
  }
}

resource dnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'privatelink-azurecr-io'
        properties: {
          privateDnsZoneId: acrPrivateDnsZoneId
        }
      }
    ]
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

output acrName string = acr.name
output acrId string = acr.id
output acrLoginServer string = acr.properties.loginServer
