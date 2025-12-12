@description('VNet ID')
param vnetId string

@description('Key Vault name')
param keyVaultName string

@description('Storage account name')
param storageAccountName string

@description('OpenAI account name')
param openaiAccountName string

@description('Document Intelligence name')
param documentIntelligenceName string

@description('Function App name')
param functionAppName string

// Private DNS Zone for Key Vault
resource keyVaultDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
  properties: {}
}

// Virtual Network Link for Key Vault DNS
resource keyVaultDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: keyVaultDnsZone
  name: '${keyVaultDnsZone.name}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

// Private DNS Zone for Storage
resource storageDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.blob.core.windows.net'
  location: 'global'
  properties: {}
}

// Virtual Network Link for Storage DNS
resource storageDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: storageDnsZone
  name: '${storageDnsZone.name}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

// Private DNS Zone for OpenAI
resource openaiDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.openai.azure.com'
  location: 'global'
  properties: {}
}

// Virtual Network Link for OpenAI DNS
resource openaiDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: openaiDnsZone
  name: '${openaiDnsZone.name}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

// Private DNS Zone for Cognitive Services
resource cognitiveDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.cognitiveservices.azure.com'
  location: 'global'
  properties: {}
}

// Virtual Network Link for Cognitive Services DNS
resource cognitiveDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: cognitiveDnsZone
  name: '${cognitiveDnsZone.name}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

// Private DNS Zone for Function App
resource functionAppDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.azurewebsites.net'
  location: 'global'
  properties: {}
}

// Virtual Network Link for Function App DNS
resource functionAppDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: functionAppDnsZone
  name: '${functionAppDnsZone.name}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

// DNS A Record for Key Vault
resource keyVaultDnsRecord 'Microsoft.Network/privateDnsZones/A@2020-06-01' = {
  parent: keyVaultDnsZone
  name: keyVaultName
  properties: {
    ttl: 3600
    aRecords: [
      {
        ipv4Address: '10.0.2.4'
      }
    ]
  }
}

// DNS A Record for Storage
resource storageDnsRecord 'Microsoft.Network/privateDnsZones/A@2020-06-01' = {
  parent: storageDnsZone
  name: storageAccountName
  properties: {
    ttl: 3600
    aRecords: [
      {
        ipv4Address: '10.0.2.5'
      }
    ]
  }
}

// DNS A Record for OpenAI
resource openaiDnsRecord 'Microsoft.Network/privateDnsZones/A@2020-06-01' = {
  parent: openaiDnsZone
  name: openaiAccountName
  properties: {
    ttl: 3600
    aRecords: [
      {
        ipv4Address: '10.0.2.6'
      }
    ]
  }
}

// DNS A Record for Document Intelligence
resource documentDnsRecord 'Microsoft.Network/privateDnsZones/A@2020-06-01' = {
  parent: cognitiveDnsZone
  name: documentIntelligenceName
  properties: {
    ttl: 3600
    aRecords: [
      {
        ipv4Address: '10.0.2.7'
      }
    ]
  }
}

// DNS A Record for Function App
resource functionAppDnsRecord 'Microsoft.Network/privateDnsZones/A@2020-06-01' = {
  parent: functionAppDnsZone
  name: functionAppName
  properties: {
    ttl: 3600
    aRecords: [
      {
        ipv4Address: '10.0.1.4'
      }
    ]
  }
}

output keyVaultDnsZoneId string = keyVaultDnsZone.id
output storageDnsZoneId string = storageDnsZone.id
output openaiDnsZoneId string = openaiDnsZone.id
output cognitiveDnsZoneId string = cognitiveDnsZone.id
output functionAppDnsZoneId string = functionAppDnsZone.id
