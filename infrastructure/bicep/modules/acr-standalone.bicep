@description('Azure region for resources')
param location string

@description('Application name prefix')
@minLength(2)
param appName string

@description('Environment name')
@minLength(2)
param environment string

@description('Resource tags')
param tags object = {}

var uniqueSuffix = uniqueString(subscription().subscriptionId, appName, environment)
var acrNameRaw = replace('${appName}${environment}acr${uniqueSuffix}', '-', '')
// ACR names must be 5-50 characters, alphanumeric only
var acrName = substring(acrNameRaw, 0, min(length(acrNameRaw), 50))

// Azure Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  #disable-next-line BCP334
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
}

output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
