@description('Existing Front Door profile name')
param frontDoorProfileName string

@description('WAF policy name')
param policyName string

@description('Resource tags')
param tags object

@description('WAF mode - Detection or Prevention')
@allowed(['Detection', 'Prevention'])
param wafMode string = 'Detection'

@description('Front Door endpoint ID to associate WAF with')
param endpointId string

// Reference existing Front Door profile
resource frontDoorProfile 'Microsoft.Cdn/profiles@2023-05-01' existing = {
  name: frontDoorProfileName
}

// WAF Policy for Front Door Premium
resource wafPolicy 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2022-05-01' = {
  name: policyName
  location: 'global'
  tags: tags
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: wafMode
      requestBodyCheck: 'Enabled'
      customBlockResponseStatusCode: 403
      customBlockResponseBody: base64('{"error": "Access denied by WAF policy"}')
    }
    customRules: {
      rules: [
        {
          name: 'RateLimitRule'
          priority: 100
          enabledState: 'Enabled'
          ruleType: 'RateLimitRule'
          rateLimitDurationInMinutes: 1
          rateLimitThreshold: 1000
          matchConditions: [
            {
              matchVariable: 'RequestUri'
              operator: 'Contains'
              negateCondition: false
              matchValue: ['/api/']
              transforms: ['Lowercase']
            }
          ]
          action: 'Block'
        }
        {
          name: 'BlockSuspiciousUserAgents'
          priority: 200
          enabledState: 'Enabled'
          ruleType: 'MatchRule'
          matchConditions: [
            {
              matchVariable: 'RequestHeader'
              selector: 'User-Agent'
              operator: 'Contains'
              negateCondition: false
              matchValue: [
                'sqlmap'
                'nikto'
                'nmap'
                'masscan'
                'dirbuster'
                'gobuster'
              ]
              transforms: ['Lowercase']
            }
          ]
          action: 'Block'
        }
      ]
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
          ruleSetAction: 'Block'
          ruleGroupOverrides: []
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'
          ruleSetAction: 'Block'
          ruleGroupOverrides: []
        }
      ]
    }
  }
}

// Security Policy to link WAF to Front Door
resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2023-05-01' = {
  parent: frontDoorProfile
  name: '${policyName}-security'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: {
        id: wafPolicy.id
      }
      associations: [
        {
          domains: [
            {
              id: endpointId
            }
          ]
          patternsToMatch: [
            '/*'
          ]
        }
      ]
    }
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

output wafPolicyId string = wafPolicy.id
output wafPolicyName string = wafPolicy.name
output securityPolicyId string = securityPolicy.id
