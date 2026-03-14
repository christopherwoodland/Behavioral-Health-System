/*
================================================================================
AKS Cluster Module
================================================================================
Deploys an AKS cluster with:
  - Azure CNI Overlay networking (compatible with AGIC)
  - Workload Identity + OIDC issuer (replaces aad-pod-identity)
  - Secrets Store CSI Driver (Key Vault integration)
  - Application Gateway Ingress Controller (AGIC) add-on
  - System node pool: Standard_D2s_v3 (web + api workloads)
  - User node pool for DAM: Standard_D4s_v3 with taint (ML model, memory-intensive)
================================================================================
*/

@description('Azure region')
param location string

@description('App name prefix')
param appName string

@description('Environment name')
param environment string

@description('Unique suffix')
param uniqueSuffix string

@description('Resource tags')
param tags object

@description('AKS nodes subnet ID')
param aksNodesSubnetId string

@description('Application Gateway resource ID (created externally so AGIC add-on can reference it)')
param applicationGatewayId string

@description('Log Analytics Workspace ID for monitoring')
param logAnalyticsWorkspaceId string

var clusterName = '${appName}-${environment}-aks'
var dnsPrefix = '${appName}-${environment}-aks-${uniqueSuffix}'
var systemNodePoolName = 'system'
var damNodePoolName = 'dam'

resource aksCluster 'Microsoft.ContainerService/managedClusters@2024-02-01' = {
  name: clusterName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    dnsPrefix: dnsPrefix
    enableRBAC: true
    nodeResourceGroup: 'MC_${appName}-${environment}-aks_${clusterName}_${location}'

    // Workload Identity + OIDC (modern replacement for aad-pod-identity)
    oidcIssuerProfile: {
      enabled: true
    }
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }

    // Networking — Azure CNI Overlay (pods share node IPs via overlay, no VNet IP exhaustion)
    networkProfile: {
      networkPlugin: 'azure'
      networkPluginMode: 'overlay'
      networkPolicy: 'azure'
      outboundType: 'loadBalancer'
      podCidr: '192.168.0.0/16'
      serviceCidr: '10.100.0.0/16'
      dnsServiceIP: '10.100.0.10'
    }

    // System node pool — runs web, api, system components
    agentPoolProfiles: [
      {
        name: systemNodePoolName
        count: 2
        minCount: 1
        maxCount: 3
        vmSize: 'Standard_D2s_v3'
        osType: 'Linux'
        osDiskSizeGB: 128
        osDiskType: 'Managed'
        mode: 'System'
        vnetSubnetID: aksNodesSubnetId
        enableAutoScaling: true
        availabilityZones: [ '1', '3' ]
        nodeTaints: []
        nodeLabels: {
          workload: 'general'
        }
        upgradeSettings: {
          maxSurge: '1'
        }
      }
    ]

    // Add-ons
    addonProfiles: {
      // AGIC — Application Gateway Ingress Controller
      ingressApplicationGateway: {
        enabled: true
        config: {
          applicationGatewayId: applicationGatewayId
        }
      }
      // Azure Monitor (Container Insights)
      omsAgent: {
        enabled: true
        config: {
          logAnalyticsWorkspaceResourceID: logAnalyticsWorkspaceId
        }
      }
      // Azure Key Vault Secrets Store CSI Driver
      azureKeyvaultSecretsProvider: {
        enabled: true
        config: {
          enableSecretRotation: 'true'
          rotationPollInterval: '2m'
        }
      }
    }

    // API server — restrict to VNet + deployment client if needed
    apiServerAccessProfile: {
      enablePrivateCluster: false // set true for fully private; keeps dev accessible
    }

    autoUpgradeProfile: {
      upgradeChannel: 'patch'
    }
  }
}

// DAM node pool — dedicated for the DAM ML model (memory-heavy, isolated)
resource damNodePool 'Microsoft.ContainerService/managedClusters/agentPools@2024-02-01' = {
  parent: aksCluster
  name: damNodePoolName
  properties: {
    count: 1
    minCount: 1
    maxCount: 2
    vmSize: 'Standard_D4s_v3'
    osType: 'Linux'
    osDiskSizeGB: 128
    osDiskType: 'Managed'
    mode: 'User'
    vnetSubnetID: aksNodesSubnetId
    enableAutoScaling: true
    availabilityZones: [ '1', '3' ]
    // Taint keeps all other workloads off this node pool
    nodeTaints: [
      'workload=dam:NoSchedule'
    ]
    nodeLabels: {
      workload: 'dam'
    }
    upgradeSettings: {
      maxSurge: '1'
    }
  }
}

output clusterName string = aksCluster.name
output clusterPrincipalId string = aksCluster.identity.principalId
output kubeletPrincipalId string = aksCluster.properties.identityProfile.kubeletidentity.objectId
output oidcIssuerUrl string = aksCluster.properties.oidcIssuerProfile.issuerURL
output nodeResourceGroup string = aksCluster.properties.nodeResourceGroup
output agicPrincipalId string = aksCluster.properties.addonProfiles.ingressApplicationGateway.identity.objectId
