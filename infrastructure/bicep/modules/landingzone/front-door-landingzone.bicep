@description('Existing Front Door profile name')
param frontDoorProfileName string

@description('Endpoint name for BHS')
param endpointName string

@description('Container Apps Environment ID')
param containerAppsEnvironmentId string

@description('UI App FQDN')
param uiAppFqdn string

@description('API App FQDN')
param apiAppFqdn string

@description('Resource tags')
param tags object

// Reference existing Front Door profile
resource frontDoorProfile 'Microsoft.Cdn/profiles@2023-05-01' existing = {
  name: frontDoorProfileName
}

// Create endpoint for BHS
resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-05-01' = {
  parent: frontDoorProfile
  name: endpointName
  location: 'global'
  tags: tags
  properties: {
    enabledState: 'Enabled'
  }
}

// Origin Group for UI
resource uiOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: frontDoorProfile
  name: '${endpointName}-ui-og'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/'
      probeRequestType: 'HEAD'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 100
    }
    sessionAffinityState: 'Disabled'
  }
}

// Origin Group for API
resource apiOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: frontDoorProfile
  name: '${endpointName}-api-og'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/api/health'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 100
    }
    sessionAffinityState: 'Disabled'
  }
}

// UI Origin (Private Link to Container Apps)
resource uiOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: uiOriginGroup
  name: '${endpointName}-ui-origin'
  properties: {
    hostName: uiAppFqdn
    httpPort: 80
    httpsPort: 443
    originHostHeader: uiAppFqdn
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    sharedPrivateLinkResource: {
      privateLink: {
        id: containerAppsEnvironmentId
      }
      privateLinkLocation: 'eastus2'
      groupId: 'managedEnvironments'
      requestMessage: 'Front Door Private Link to BHS UI Container App'
    }
  }
}

// API Origin (Private Link to Container Apps)
resource apiOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: apiOriginGroup
  name: '${endpointName}-api-origin'
  properties: {
    hostName: apiAppFqdn
    httpPort: 80
    httpsPort: 443
    originHostHeader: apiAppFqdn
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    sharedPrivateLinkResource: {
      privateLink: {
        id: containerAppsEnvironmentId
      }
      privateLinkLocation: 'eastus2'
      groupId: 'managedEnvironments'
      requestMessage: 'Front Door Private Link to BHS API Container App'
    }
  }
}

// Route for UI (default route)
resource uiRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: '${endpointName}-ui-route'
  properties: {
    customDomains: []
    originGroup: {
      id: uiOriginGroup.id
    }
    supportedProtocols: [
      'Http'
      'Https'
    ]
    patternsToMatch: [
      '/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
    cacheConfiguration: {
      compressionSettings: {
        isCompressionEnabled: true
        contentTypesToCompress: [
          'text/html'
          'text/css'
          'text/javascript'
          'application/javascript'
          'application/json'
          'application/xml'
          'image/svg+xml'
        ]
      }
      queryStringCachingBehavior: 'IgnoreQueryString'
    }
  }
  dependsOn: [uiOrigin]
}

// Route for API
resource apiRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: '${endpointName}-api-route'
  properties: {
    customDomains: []
    originGroup: {
      id: apiOriginGroup.id
    }
    supportedProtocols: [
      'Http'
      'Https'
    ]
    patternsToMatch: [
      '/api/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
    cacheConfiguration: {
      queryStringCachingBehavior: 'UseQueryString'
    }
  }
  dependsOn: [apiOrigin, uiRoute] // Ensure UI route is created first (catch-all)
}

// ============================================================================
// OUTPUTS
// ============================================================================

output frontDoorEndpoint string = 'https://${endpoint.properties.hostName}'
output endpointHostName string = endpoint.properties.hostName
output endpointId string = endpoint.id
output uiOriginGroupId string = uiOriginGroup.id
output apiOriginGroupId string = apiOriginGroup.id
