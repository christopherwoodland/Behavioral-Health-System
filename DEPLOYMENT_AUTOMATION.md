# BHS Infrastructure Deployment Automation Guide

## Overview

This guide describes the automated deployment process for the Behavioral Health System (BHS) infrastructure using the unified `Deploy-With-VNet-Integration.ps1` script. The script orchestrates the complete infrastructure deployment with VNet integration, provider registration, and automatic RBAC setup.

## Deployment Flow

The deployment script implements the following automation workflow:

```
1. Prerequisites Check
   ├─ Verify Azure CLI installed
   └─ Verify logged into Azure account
   
2. Provider Registration
   ├─ Register Microsoft.App provider (async)
   └─ Wait for registration to complete (up to 60 seconds)
   
3. Template Validation
   ├─ Validate Bicep template syntax
   └─ Validate parameters against template schema
   
4. What-If Preview
   ├─ Run what-if deployment to show planned changes
   ├─ Display resource changes to user
   └─ Prompt user for approval (yes/no)
   
5. Deployment Execution
   ├─ Deploy infrastructure at subscription scope
   ├─ Create resource groups, VNet, storage, AI services, etc.
   └─ Create Function App with VNet integration
   
6. Post-Deployment RBAC Setup
   ├─ Retrieve Function App managed identity Principal ID
   ├─ Retrieve VNet resource ID from deployment outputs
   └─ Grant Network Contributor role to enable VNet integration
   
7. Completion Summary
   └─ Display deployment summary with resource names and URLs
```

## Prerequisites

Before running the deployment script:

1. **Azure CLI** installed and working (`az --version`)
2. **Logged into Azure** with appropriate subscription access
3. **Parameter file** configured with correct values:
   - Environment (dev, staging, prod)
   - Azure region (default: eastus2)
   - Deployment client IP (for Key Vault firewall)
4. **Bicep files** validated and in place

## Manual Setup Steps (Automated by Script)

The following steps are automatically handled by the deployment script:

### 1. Microsoft.App Provider Registration
**What**: Register the Microsoft.App provider required for Azure Container Apps and related services.
**Why**: Function App VNet integration requires this provider to be active.
**How**: Script runs `az provider register --namespace Microsoft.App` and waits up to 60 seconds for registration.
**Manual command** (if needed):
```powershell
az provider register --namespace Microsoft.App
```

### 2. Subscription Context
**What**: Ensure you're deploying to the correct Azure subscription.
**Why**: Wrong subscription context could deploy to unintended resources.
**How**: Script displays logged-in account and subscription.
**Manual verification**:
```powershell
az account show
az account list --output table
az account set --subscription <subscription-id>  # To switch subscriptions
```

### 3. IP Firewall Configuration
**What**: Update `deploymentClientIP` in parameter file for Key Vault access.
**Why**: Key Vault firewall restricts access to authorized IPs during deployment.
**How**: Set in parameter file or pass as inline parameter.
**Current IP**: 71.244.164.53/32
**To find your IP**:
```powershell
(Invoke-WebRequest -Uri 'https://api.ipify.org?format=json' -UseBasicParsing).Content | ConvertFrom-Json | Select-Object -ExpandProperty ip
```

## Running the Deployment

### Basic Deployment (with What-If Preview and User Approval)

```powershell
cd c:\Users\cwoodland\dev\BehavioralHealthSystem\infrastructure\scripts

# Run deployment with what-if preview and approval prompt
.\Deploy-With-VNet-Integration.ps1 `
  -Environment dev `
  -ParameterFile ..\bicep\parameters\dev.parameters.json
```

### Skipping What-If Preview

```powershell
# Skip what-if preview and go directly to deployment
.\Deploy-With-VNet-Integration.ps1 `
  -Environment dev `
  -ParameterFile ..\bicep\parameters\dev.parameters.json `
  -SkipWhatIf
```

### Skipping Template Validation

```powershell
# Skip template validation (not recommended)
.\Deploy-With-VNet-Integration.ps1 `
  -Environment dev `
  -ParameterFile ..\bicep\parameters\dev.parameters.json `
  -SkipValidation
```

### Skipping Both (Emergency Mode)

```powershell
# Skip both validation and what-if (use with caution)
.\Deploy-With-VNet-Integration.ps1 `
  -Environment dev `
  -ParameterFile ..\bicep\parameters\dev.parameters.json `
  -SkipValidation `
  -SkipWhatIf
```

## What-If Preview

When you run the deployment without `-SkipWhatIf`, the script displays:

1. **Resource Changes** - Shows all resources that will be created, modified, or deleted
2. **Change Details** - For each resource, shows:
   - Operation type (Create, Modify, Delete)
   - Resource name
   - Resource type
   - Property changes (if modifying)

### Example Output

```
{
  "changes": [
    {
      "resourceId": "/subscriptions/.../resourceGroups/bhs-dev-rg",
      "changeType": "Create",
      "after": {
        "id": "/subscriptions/.../resourceGroups/bhs-dev-rg",
        "name": "bhs-dev-rg",
        "type": "Microsoft.Resources/resourceGroups",
        "location": "eastus2"
      }
    },
    {
      "resourceId": "/subscriptions/.../resourceGroups/bhs-dev-rg/providers/Microsoft.Network/virtualNetworks/bhs-dev-vnet",
      "changeType": "Create",
      "after": {
        "properties": {
          "addressSpace": {
            "addressPrefixes": ["10.0.0.0/16"]
          }
        }
      }
    }
  ]
}
```

**Review the changes and ensure they match your expectations before approving.**

## Deployment Execution Details

### Resource Groups Created

- **bhs-dev-rg** (Resource Group for all dev resources)

### VNet and Networking

- **bhs-dev-vnet** (10.0.0.0/16)
  - **app-subnet** (10.0.1.0/24) - Function App VNet integration
  - **private-endpoint-subnet** (10.0.2.0/24) - Private endpoints
  - **container-apps-subnet** (10.0.4.0/23) - Container Apps (future)

### Key Vault

- **bhsdev{uniqueSuffix}** - Stores API keys, connection strings
- **Firewall rule**: Limited to deployment client IP (71.244.164.53/32)

### Storage Account

- **bhsdev{uniqueSuffix}** - General purpose storage for deployment artifacts
- **Private endpoint**: VNet integrated

### AI Services

- **OpenAI** deployment with GPT-4 model
- **Document Intelligence** service for form processing
- **Application Insights** for logging and monitoring

### Function App

- **bhs-dev-func** - Flex Consumption (FC1) tier
- **Runtime**: .NET 8 (isolated)
- **VNet Integration**: Enabled for app-subnet
- **Private Endpoint**: For secure access to functions
- **System-Managed Identity**: For accessing Azure services
- **Post-Deployment RBAC**: Network Contributor role on VNet

### Private DNS

- Private DNS zones linked to VNet for all private endpoints:
  - `privatelink.vaultcore.azure.net` (Key Vault)
  - `privatelink.blob.core.windows.net` (Storage)
  - `privatelink.cognitiveservices.azure.com` (AI)
  - `privatelink.azurewebsites.net` (Function App)

## Post-Deployment Verification

After successful deployment, verify the setup:

### 1. Check Resource Group

```powershell
az group show --name bhs-dev-rg --query "name,location,tags"
```

### 2. Check VNet and Subnets

```powershell
az network vnet show --resource-group bhs-dev-rg --name bhs-dev-vnet --query "addressSpace,subnets[*].[name,addressPrefix]"
```

### 3. Check Function App

```powershell
az functionapp show --resource-group bhs-dev-rg --name bhs-dev-func --query "name,state,runtime"
```

### 4. Check VNet Integration Status

```powershell
az functionapp vnet-integration list --resource-group bhs-dev-rg --name bhs-dev-func
```

### 5. Check RBAC Role Assignment

```powershell
# Find the VNet ID
$vnetId = az network vnet show --resource-group bhs-dev-rg --name bhs-dev-vnet --query "id" -o tsv

# Check role assignments on VNet
az role assignment list --scope $vnetId --query "[*].[principalName,roleDefinitionName]"
```

### 6. Check Private Endpoints

```powershell
az network private-endpoint list --resource-group bhs-dev-rg --query "[*].[name,privateLinkServiceConnections[0].groupIds]"
```

## Troubleshooting

### Issue: Provider Registration Timeout

**Problem**: Microsoft.App provider registration takes longer than 60 seconds.

**Solution**:
```powershell
# Check provider status manually
az provider show --namespace Microsoft.App --query "registrationState"

# Wait manually if needed and re-run with -SkipWhatIf
```

### Issue: What-If Shows Unexpected Changes

**Problem**: What-if displays changes you didn't anticipate.

**Solution**:
- Review the detailed changes carefully
- Check parameter file values match your expectations
- Verify existing resource names don't conflict
- Type `no` when prompted to cancel and investigate

### Issue: Deployment Fails - Insufficient Permissions

**Problem**: `AuthorizationFailed` error during deployment.

**Solution**:
```powershell
# Verify your role in the subscription
az role assignment list --assignee <your-user-id> --query "[*].roleDefinitionName"

# You need Owner or Contributor role
```

### Issue: VNet Integration Not Working

**Problem**: Function App fails to use VNet.

**Solution**:
```powershell
# Verify RBAC assignment was successful
$functionAppId = az functionapp identity show --resource-group bhs-dev-rg --name bhs-dev-func --query "principalId" -o tsv
$vnetId = az network vnet show --resource-group bhs-dev-rg --name bhs-dev-vnet --query "id" -o tsv
az role assignment list --scope $vnetId --assignee $functionAppId

# If missing, manually assign:
az role assignment create --assignee $functionAppId --role "Network Contributor" --scope $vnetId
```

### Issue: Key Vault Access Denied

**Problem**: During deployment or after, `403 Forbidden` accessing Key Vault.

**Solution**:
```powershell
# Check your current IP
$myIp = (Invoke-WebRequest -Uri 'https://api.ipify.org?format=json' -UseBasicParsing).Content | ConvertFrom-Json | Select-Object -ExpandProperty ip

# Update parameter file with correct IP
# Then redeploy or update Key Vault firewall manually:
az keyvault network-rule add --resource-group bhs-dev-rg --name bhsdev{uniqueSuffix} --ip-address "$myIp/32"
```

## Cleanup and Rollback

### Delete Entire Deployment

```powershell
# Delete the resource group (removes all resources)
az group delete --name bhs-dev-rg --yes
```

### Delete Specific Resources

```powershell
# Delete Function App only
az functionapp delete --resource-group bhs-dev-rg --name bhs-dev-func

# Delete VNet and all subnets
az network vnet delete --resource-group bhs-dev-rg --name bhs-dev-vnet
```

## Advanced: Deploying to Other Environments

### Deploy to Staging

```powershell
.\Deploy-With-VNet-Integration.ps1 `
  -Environment staging `
  -ParameterFile ..\bicep\parameters\staging.parameters.json
```

### Deploy to Production

```powershell
.\Deploy-With-VNet-Integration.ps1 `
  -Environment prod `
  -ParameterFile ..\bicep\parameters\prod.parameters.json
```

**Note**: Create staging and prod parameter files with appropriate values before deployment.

## Script Features Summary

| Feature | Status | Details |
|---------|--------|---------|
| Provider Registration | ✅ Automated | Registers Microsoft.App; waits up to 60s |
| Template Validation | ✅ Automated | Validates syntax and parameters |
| What-If Preview | ✅ Automated | Shows changes before deployment |
| User Approval | ✅ Automated | Prompts for yes/no confirmation |
| Deployment Execution | ✅ Automated | Deploys at subscription scope |
| RBAC Setup | ✅ Automated | Grants Network Contributor role |
| Error Handling | ✅ Automated | Stops on errors; clear messaging |
| Deployment Summary | ✅ Automated | Shows results and resource info |

## References

- [Azure Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview)
- [Azure Function App VNet Integration](https://learn.microsoft.com/en-us/azure/azure-functions/functions-networking-options)
- [Flex Consumption Plan](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan)
- [Azure CLI Deployment Documentation](https://learn.microsoft.com/en-us/cli/azure/deployment)
- [Private Endpoints in Azure](https://learn.microsoft.com/en-us/azure/private-link/private-endpoints-overview)
