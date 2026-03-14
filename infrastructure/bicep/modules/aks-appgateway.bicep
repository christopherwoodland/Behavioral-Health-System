/*
================================================================================
Application Gateway v2 (WAF_v2) Module
================================================================================
Deploys an Application Gateway v2 in WAF_v2 SKU with:
  - Public IP for internet-facing traffic
  - User-Assigned Managed Identity (allows App Gateway to pull TLS cert from KV)
  - WAF policy: OWASP 3.2 + BotManager (mode configurable per environment)
  - HTTPS via self-signed certificate stored in Key Vault (added post-deploy by
    Deploy-AKS.ps1); AGIC configures the HTTPS listener + HTTP→HTTPS redirect
    based on the ssl-certificate / ssl-redirect Ingress annotations
  - Two backend pools: web (port 80) and api (port 80)
  - Path-based routing: /api/* → api pool, /* → web pool
  - AGIC manages backend pool members automatically — placeholder IPs are
    overwritten by the AGIC controller after AKS is deployed
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

@description('Application Gateway subnet ID')
param appGwSubnetId string

@description('WAF policy mode. Use Detection for dev/staging, Prevention for prod.')
@allowed(['Detection', 'Prevention'])
param wafMode string = 'Detection'

var appGwName = '${appName}-${environment}-appgw'
var publicIpName = '${appName}-${environment}-appgw-pip'
var wafPolicyName = '${appName}-${environment}-waf-policy'
var appGwIdentityName = '${appName}-${environment}-appgw-identity'
var tlsCertName = '${appName}-${environment}-tls-cert'

// Managed Identity — attached to App Gateway so it can pull the TLS certificate
// from Key Vault.  Key Vault Secrets User role is assigned in aks-rbac-crossrg.bicep.
resource appGwIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: appGwIdentityName
  location: location
  tags: tags
}

// Public IP (Standard SKU required for App Gateway v2)
resource publicIp 'Microsoft.Network/publicIPAddresses@2023-05-01' = {
  name: publicIpName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: {
      domainNameLabel: '${appName}-${environment}-bhs'
    }
  }
}

// WAF Policy
resource wafPolicy 'Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies@2023-05-01' = {
  name: wafPolicyName
  location: location
  tags: tags
  properties: {
    policySettings: {
      state: 'Enabled'
      mode: wafMode
      requestBodyCheck: true
      maxRequestBodySizeInKb: 128
      fileUploadLimitInMb: 100
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'OWASP'
          ruleSetVersion: '3.2'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'
        }
      ]
      exclusions: []
    }
    customRules: []
  }
}

// Application Gateway
resource appGateway 'Microsoft.Network/applicationGateways@2023-05-01' = {
  name: appGwName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${appGwIdentity.id}': {}
    }
  }
  properties: {
    sku: {
      name: 'WAF_v2'
      tier: 'WAF_v2'
    }
    autoscaleConfiguration: {
      minCapacity: 1
      maxCapacity: 3
    }
    firewallPolicy: {
      id: wafPolicy.id
    }
    gatewayIPConfigurations: [
      {
        name: 'appGwIpConfig'
        properties: {
          subnet: { id: appGwSubnetId }
        }
      }
    ]
    frontendIPConfigurations: [
      {
        name: 'appGwPublicFrontendIp'
        properties: {
          publicIPAddress: { id: publicIp.id }
        }
      }
    ]
    frontendPorts: [
      {
        name: 'port-80'
        properties: { port: 80 }
      }
      {
        name: 'port-443'
        properties: { port: 443 }
      }
    ]
    // Backend pools — AGIC will replace addresses with pod IPs
    backendAddressPools: [
      {
        name: 'web-backend-pool'
        properties: { backendAddresses: [] }
      }
      {
        name: 'api-backend-pool'
        properties: { backendAddresses: [] }
      }
    ]
    backendHttpSettingsCollection: [
      {
        name: 'web-http-settings'
        properties: {
          port: 80
          protocol: 'Http'
          cookieBasedAffinity: 'Disabled'
          requestTimeout: 30
          pickHostNameFromBackendAddress: false
          probe: { id: resourceId('Microsoft.Network/applicationGateways/probes', appGwName, 'web-health-probe') }
        }
      }
      {
        name: 'api-http-settings'
        properties: {
          port: 80
          protocol: 'Http'
          cookieBasedAffinity: 'Disabled'
          requestTimeout: 120 // API calls can be long (DAM, extended assessment)
          pickHostNameFromBackendAddress: false
          probe: { id: resourceId('Microsoft.Network/applicationGateways/probes', appGwName, 'api-health-probe') }
        }
      }
    ]
    probes: [
      {
        name: 'web-health-probe'
        properties: {
          protocol: 'Http'
          host: '127.0.0.1'
          path: '/'
          interval: 30
          timeout: 10
          unhealthyThreshold: 3
          pickHostNameFromBackendHttpSettings: false
          match: {
            statusCodes: [ '200-399' ]
          }
        }
      }
      {
        name: 'api-health-probe'
        properties: {
          protocol: 'Http'
          host: '127.0.0.1'
          path: '/api/health'
          interval: 30
          timeout: 10
          unhealthyThreshold: 3
          pickHostNameFromBackendHttpSettings: false
          match: {
            statusCodes: [ '200-399' ]
          }
        }
      }
    ]
    httpListeners: [
      {
        name: 'http-listener'
        properties: {
          frontendIPConfiguration: { id: resourceId('Microsoft.Network/applicationGateways/frontendIPConfigurations', appGwName, 'appGwPublicFrontendIp') }
          frontendPort: { id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', appGwName, 'port-80') }
          protocol: 'Http'
        }
      }
    ]
    // Path-based routing: /api/* → api, /* → web
    urlPathMaps: [
      {
        name: 'bhs-path-map'
        properties: {
          defaultBackendAddressPool: { id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', appGwName, 'web-backend-pool') }
          defaultBackendHttpSettings: { id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', appGwName, 'web-http-settings') }
          pathRules: [
            {
              name: 'api-path-rule'
              properties: {
                paths: [ '/api/*' ]
                backendAddressPool: { id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', appGwName, 'api-backend-pool') }
                backendHttpSettings: { id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', appGwName, 'api-http-settings') }
              }
            }
          ]
        }
      }
    ]
    requestRoutingRules: [
      {
        name: 'http-routing-rule'
        properties: {
          ruleType: 'PathBasedRouting'
          priority: 100
          httpListener: { id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGwName, 'http-listener') }
          urlPathMap: { id: resourceId('Microsoft.Network/applicationGateways/urlPathMaps', appGwName, 'bhs-path-map') }
        }
      }
    ]
  }
}

output appGatewayId string = appGateway.id
output appGatewayName string = appGateway.name
output publicIpAddress string = publicIp.properties.ipAddress
output publicIpFqdn string = publicIp.properties.dnsSettings.fqdn
output appGwIdentityPrincipalId string = appGwIdentity.properties.principalId
output appGwIdentityId string = appGwIdentity.id
output tlsCertName string = tlsCertName
