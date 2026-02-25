targetScope = 'subscription'

/*
================================================================================
LANDING ZONE INTEGRATION DEPLOYMENT
================================================================================

This Bicep template deploys the Behavioral Health System infrastructure
integrated with an EXISTING landing zone network topology.

ARCHITECTURE:
├─ Uses existing VNets in rg-demo-network-landing
│   ├─ vnet-demo-apps-paarq (Apps + Storage/KeyVault/ACR Private Endpoints)
│   ├─ vnet-ai-spoke-paarq (AI Services Private Endpoints)
│   └─ vnet-hub-01-paarq (Shared services, peered to spokes)
├─ Uses existing Private DNS Zones in rg-demo-network-landing
├─ Container Apps with internal VNet integration
├─ Azure Front Door Premium with Private Link for external access
├─ All PaaS services with Private Endpoints
└─ Public network access DISABLED on all services

PREREQUISITES:
├─ Landing zone VNets must exist with appropriate subnets
├─ VNet peering must be configured between spokes and hub
├─ Private DNS Zones must exist in landing zone RG
├─ Azure Front Door Premium must exist in shared RG
└─ Deployment identity needs Network Contributor on landing zone RG

================================================================================
*/

// ============================================================================
// PARAMETERS
// ============================================================================

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Azure region for resources')
param location string = 'eastus2'

@description('Application name prefix')
param appName string = 'bhs'

@description('Resource group name for BHS resources')
param resourceGroupName string = 'bhs'

@description('Override unique suffix for re-deployment with existing resources. Leave empty for auto-generated.')
param existingUniqueSuffix string = ''

@description('Tags to apply to all resources')
param tags object = {
  Application: 'Behavioral Health System'
  Environment: environment
  ManagedBy: 'Bicep'
  NetworkMode: 'LandingZone-Private'
  DeploymentMode: 'ContainerApps-FrontDoor'
}

// ============================================================================
// LANDING ZONE NETWORK PARAMETERS
// ============================================================================

@description('Landing zone resource group name')
param landingZoneResourceGroup string = 'rg-demo-network-landing'

@description('Apps VNet name in landing zone')
param appsVNetName string = 'vnet-demo-apps-paarq'

@description('AI Spoke VNet name in landing zone')
param aiSpokeVNetName string = 'vnet-ai-spoke-paarq'

@description('Private endpoints subnet name in apps VNet')
param privateEndpointsSubnetName string = 'snet-pe-17'

@description('AI services private endpoint subnet name in AI spoke VNet')
param aiServicesSubnetName string = 'snet-09'

@description('Container Apps subnet name (will be created if not exists)')
param containerAppsSubnetName string = 'snet-cae-19'

@description('Container Apps subnet address prefix')
param containerAppsSubnetPrefix string = '10.0.19.0/23'

// ============================================================================
// FRONT DOOR PARAMETERS
// ============================================================================

@description('Shared resource group containing Front Door')
param sharedResourceGroup string = 'shared'

@description('Existing Front Door profile name')
param frontDoorProfileName string = 'shared-fd-eastus2-001'

@description('Front Door endpoint name for BHS')
param frontDoorEndpointName string = 'bhs-dev'

// ============================================================================
// APPLICATION PARAMETERS
// ============================================================================

@description('Container image tag')
param containerImageTag string = 'latest'

@description('Azure AD Client ID for MSAL authentication')
param azureAdClientId string = ''

@description('Azure AD API Client ID')
param azureAdApiClientId string = ''

@description('Azure AD Tenant ID')
param azureAdTenantId string = subscription().tenantId

@description('Azure OpenAI Realtime deployment name')
param azureOpenAIRealtimeDeployment string = 'gpt-realtime'

@description('Azure OpenAI Realtime API version')
param azureOpenAIRealtimeApiVersion string = '2025-04-01-preview'

@description('Azure OpenAI resource name')
param azureOpenAIResourceName string = ''

@description('Azure OpenAI WebRTC region')
param azureOpenAIWebRTCRegion string = 'eastus2'

@description('Extended Assessment OpenAI Deployment')
param extendedAssessmentDeployment string = 'gpt-5.2'

@description('Agent Model Deployment')
param agentModelDeployment string = 'gpt-5.2'

@secure()
@description('Kintsugi API Key')
param kintsugiApiKey string = ''

@description('Kintsugi Base URL')
param kintsugiBaseUrl string = 'https://api.kintsugihealth.com/v2'

@description('Band Service URL')
param bandServiceUrl string = ''

@description('Enable Smart Band integration')
param enableSmartBand bool = false

// ============================================================================
// VARIABLES
// ============================================================================

// Unique suffix for globally unique resource names (use override if provided for re-deployments)
var uniqueSuffix = !empty(existingUniqueSuffix) ? existingUniqueSuffix : uniqueString(subscription().subscriptionId, resourceGroupName, environment)

// Existing Private DNS Zone IDs in landing zone
var blobDnsZoneId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/privateDnsZones/privatelink.blob.core.windows.net'
var queueDnsZoneId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/privateDnsZones/privatelink.queue.core.windows.net'
var tableDnsZoneId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/privateDnsZones/privatelink.table.core.windows.net'
var keyVaultDnsZoneId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/privateDnsZones/privatelink.vaultcore.azure.net'
var cognitiveServicesDnsZoneId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/privateDnsZones/privatelink.cognitiveservices.azure.com'
var acrDnsZoneId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/privateDnsZones/privatelink.azurecr.io'

// Subnet IDs - use full resource IDs with subscription
var privateEndpointsSubnetId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/virtualNetworks/${appsVNetName}/subnets/${privateEndpointsSubnetName}'
var aiServicesSubnetId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/virtualNetworks/${aiSpokeVNetName}/subnets/${aiServicesSubnetName}'
var containerAppsSubnetId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/virtualNetworks/${appsVNetName}/subnets/${containerAppsSubnetName}'

// ============================================================================
// RESOURCE GROUP
// ============================================================================

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// ============================================================================
// PREREQUISITE: CREATE CONTAINER APPS SUBNET IN LANDING ZONE
// ============================================================================

module containerAppsSubnet 'modules/landingzone/container-apps-subnet.bicep' = {
  name: 'containerAppsSubnet'
  scope: resourceGroup(landingZoneResourceGroup)
  params: {
    vnetName: appsVNetName
    subnetName: containerAppsSubnetName
    subnetAddressPrefix: containerAppsSubnetPrefix
  }
}

// ============================================================================
// PREREQUISITE: CREATE ACR PRIVATE DNS ZONE (if not exists)
// ============================================================================

module acrDnsZone 'modules/landingzone/acr-dns-zone.bicep' = {
  name: 'acrDnsZone'
  scope: resourceGroup(landingZoneResourceGroup)
  params: {
    vnetIds: [
      '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/virtualNetworks/${appsVNetName}'
      '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/virtualNetworks/${aiSpokeVNetName}'
      '/subscriptions/${subscription().subscriptionId}/resourceGroups/${landingZoneResourceGroup}/providers/Microsoft.Network/virtualNetworks/vnet-hub-01-paarq'
    ]
  }
}

// ============================================================================
// LOG ANALYTICS & APPLICATION INSIGHTS
// ============================================================================

module monitoring 'modules/app-insights.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    appName: appName
    environment: environment
    tags: tags
  }
}

// Expose app insights outputs for dependent modules
var appInsightsConnectionString = monitoring.outputs.connectionString

// ============================================================================
// STORAGE ACCOUNT (with Private Endpoints in Landing Zone)
// ============================================================================

module storage 'modules/landingzone/storage-landingzone.bicep' = {
  name: 'storage'
  scope: rg
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: privateEndpointsSubnetId
    blobPrivateDnsZoneId: blobDnsZoneId
    queuePrivateDnsZoneId: queueDnsZoneId
    tablePrivateDnsZoneId: tableDnsZoneId
    landingZoneResourceGroup: landingZoneResourceGroup
  }
  dependsOn: [containerAppsSubnet]
}

// ============================================================================
// KEY VAULT (with Private Endpoint in Landing Zone)
// ============================================================================

module keyVault 'modules/landingzone/keyvault-landingzone.bicep' = {
  name: 'keyVault'
  scope: rg
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: privateEndpointsSubnetId
    keyVaultPrivateDnsZoneId: keyVaultDnsZoneId
    landingZoneResourceGroup: landingZoneResourceGroup
    kintsugiApiKey: kintsugiApiKey
  }
  dependsOn: [containerAppsSubnet]
}

// ============================================================================
// AZURE CONTAINER REGISTRY (with Private Endpoint in Landing Zone)
// ============================================================================

module acr 'modules/landingzone/acr-landingzone.bicep' = {
  name: 'acr'
  scope: rg
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: privateEndpointsSubnetId
    acrPrivateDnsZoneId: acrDnsZoneId
    landingZoneResourceGroup: landingZoneResourceGroup
  }
  dependsOn: [acrDnsZone, containerAppsSubnet]
}

// ============================================================================
// AI SERVICES (with Private Endpoint in AI Spoke VNet)
// ============================================================================

module aiServices 'modules/landingzone/ai-services-landingzone.bicep' = {
  name: 'aiServices'
  scope: rg
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    privateEndpointSubnetId: aiServicesSubnetId
    cognitiveServicesPrivateDnsZoneId: cognitiveServicesDnsZoneId
    landingZoneResourceGroup: landingZoneResourceGroup
    deployModels: false  // Set to true if you have quota available; models can be deployed separately
  }
  dependsOn: [containerAppsSubnet]
}

// ============================================================================
// CONTAINER APPS ENVIRONMENT (Internal, VNet Integrated)
// ============================================================================

module containerApps 'modules/landingzone/container-apps-landingzone.bicep' = {
  name: 'containerApps'
  scope: rg
  params: {
    location: location
    appName: appName
    environment: environment
    uniqueSuffix: uniqueSuffix
    tags: tags
    containerAppsSubnetId: containerAppsSubnetId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    acrName: acr.outputs.acrName
    acrLoginServer: acr.outputs.acrLoginServer
    storageAccountName: storage.outputs.storageAccountName
    appInsightsConnectionString: appInsightsConnectionString
    keyVaultName: keyVault.outputs.keyVaultName
    keyVaultUri: keyVault.outputs.keyVaultUri
    aiServicesEndpoint: aiServices.outputs.aiServicesEndpoint
    tenantId: azureAdTenantId
    azureAdClientId: azureAdClientId
    azureAdApiClientId: azureAdApiClientId
    uiImageTag: containerImageTag
    apiImageTag: containerImageTag
    azureOpenAIRealtimeDeployment: azureOpenAIRealtimeDeployment
    azureOpenAIRealtimeApiVersion: azureOpenAIRealtimeApiVersion
    azureOpenAIResourceName: azureOpenAIResourceName
    azureOpenAIWebRTCRegion: azureOpenAIWebRTCRegion
    extendedAssessmentDeployment: extendedAssessmentDeployment
    agentModelDeployment: agentModelDeployment
    kintsugiBaseUrl: kintsugiBaseUrl
    bandServiceUrl: bandServiceUrl
    enableSmartBand: enableSmartBand
  }
  dependsOn: [containerAppsSubnet]
}

// ============================================================================
// FRONT DOOR CONFIGURATION (Private Link to Container Apps)
// ============================================================================

module frontDoor 'modules/landingzone/front-door-landingzone.bicep' = {
  name: 'frontDoor'
  scope: resourceGroup(sharedResourceGroup)
  params: {
    frontDoorProfileName: frontDoorProfileName
    endpointName: frontDoorEndpointName
    containerAppsEnvironmentId: containerApps.outputs.containerAppsEnvironmentId
    uiAppFqdn: containerApps.outputs.uiAppFqdn
    apiAppFqdn: containerApps.outputs.apiAppFqdn
    tags: tags
  }
}

// ============================================================================
// WAF POLICY
// ============================================================================

module wafPolicy 'modules/landingzone/waf-policy.bicep' = {
  name: 'wafPolicy'
  scope: resourceGroup(sharedResourceGroup)
  params: {
    frontDoorProfileName: frontDoorProfileName
    policyName: 'wafpolicy-bhs-${environment}'
    endpointId: frontDoor.outputs.endpointId
    tags: tags
  }
}

// ============================================================================
// RBAC ASSIGNMENTS
// ============================================================================

module rbac 'modules/landingzone/rbac-landingzone.bicep' = {
  name: 'rbac'
  scope: rg
  params: {
    storageAccountName: storage.outputs.storageAccountName
    keyVaultName: keyVault.outputs.keyVaultName
    acrName: acr.outputs.acrName
    aiServicesName: aiServices.outputs.aiServicesName
    uiAppPrincipalId: containerApps.outputs.uiAppPrincipalId
    apiAppPrincipalId: containerApps.outputs.apiAppPrincipalId
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

output resourceGroupName string = rg.name
output storageAccountName string = storage.outputs.storageAccountName
output keyVaultName string = keyVault.outputs.keyVaultName
output keyVaultUri string = keyVault.outputs.keyVaultUri
output acrName string = acr.outputs.acrName
output acrLoginServer string = acr.outputs.acrLoginServer
output aiServicesName string = aiServices.outputs.aiServicesName
output aiServicesEndpoint string = aiServices.outputs.aiServicesEndpoint
output containerAppsEnvironmentName string = containerApps.outputs.containerAppsEnvironmentName
output uiAppName string = containerApps.outputs.uiAppName
output apiAppName string = containerApps.outputs.apiAppName
output uiAppFqdn string = containerApps.outputs.uiAppFqdn
output apiAppFqdn string = containerApps.outputs.apiAppFqdn
output frontDoorEndpoint string = frontDoor.outputs.frontDoorEndpoint
output logAnalyticsWorkspaceId string = monitoring.outputs.logAnalyticsWorkspaceId
output appInsightsConnectionString string = appInsightsConnectionString
