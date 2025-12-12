# 🏗️ Behavioral Health System - Infrastructure as Code

Complete infrastructure deployment using Bicep and PowerShell for the Behavioral Health System with enterprise-grade security, networking, and managed identities.

## 📋 Overview

This infrastructure solution deploys a **production-ready, secure Azure environment** featuring:

### 🔒 Security Features
- **Managed Identity** for all services (no API keys in code)
- **Private Endpoints** for all Azure services
- **Virtual Network** with secure subnets
- **Private DNS zones** for private endpoint resolution
- **Key Vault** for secrets management
- **Network Security Groups** with restrictive rules
- **RBAC** for fine-grained access control

### 🌐 Networking Architecture
```
┌─────────────────────────────────────────────────────┐
│              Virtual Network (10.0.0.0/16)           │
├──────────────────┬──────────────────────────────────┤
│  App Subnet      │  Private Endpoint Subnet         │
│  (10.0.1.0/24)   │  (10.0.2.0/24)                   │
│                  │                                   │
│ • Function App   │ • Key Vault PE                    │
│ • VNet Integration│ • Storage PE                      │
│                  │ • OpenAI PE                       │
│                  │ • Cognitive Services PE           │
└──────────────────┴──────────────────────────────────┘
                       ↓
        Private DNS Zones & Private Link
                       ↓
        ┌─────────────────────────────────┐
        │    Azure Resources              │
        │  (Accessible only via PE/VNet)  │
        └─────────────────────────────────┘
```

### 📦 Services Deployed
- **Azure Functions** - Serverless backend with VNet integration
- **Static Web App** - React frontend hosting
- **Key Vault** - Secrets and configuration management
- **Storage Account** - Blob storage for DSM-5 data, conversations, voice
- **Azure OpenAI** - GPT-4 and GPT-4o Realtime models
- **Document Intelligence** - PDF and document analysis
- **Content Understanding** - AI-powered content extraction
- **Application Insights** - Monitoring and diagnostics
- **Log Analytics Workspace** - Centralized logging

## 📁 File Structure

```
infrastructure/
├── bicep/                          # Bicep Infrastructure as Code
│   ├── main.bicep                 # Main orchestration template
│   ├── modules/                   # Reusable modules
│   │   ├── networking.bicep       # VNet, subnets, NSGs
│   │   ├── keyvault.bicep        # Key Vault with private endpoint
│   │   ├── storage.bicep         # Storage with private endpoint
│   │   ├── app-insights.bicep    # Application Insights & Log Analytics
│   │   ├── openai.bicep          # Azure OpenAI with private endpoint
│   │   ├── cognitive.bicep       # Document Intelligence & Content Understanding
│   │   ├── function-app.bicep    # Function App with VNet integration
│   │   ├── static-web-app.bicep  # Static Web App for React frontend
│   │   └── private-dns.bicep     # Private DNS zones
│   └── parameters/               # Parameter files for each environment
│       ├── dev.parameters.json    # Development environment
│       └── prod.parameters.json   # Production environment
└── scripts/                       # PowerShell deployment scripts
    ├── Deploy-Infrastructure.ps1      # Main deployment script
    ├── Configure-Secrets.ps1          # Populate Key Vault
    ├── Configure-Permissions.ps1      # Set up RBAC
    ├── Setup-LocalDev.ps1            # Configure local development
    └── Teardown-Infrastructure.ps1    # Clean up resources
```

## 🚀 Quick Start

### Prerequisites
- Azure CLI 2.50+
- PowerShell 5.1+ (or PowerShell Core 7.0+)
- Bicep CLI 0.15+
- An Azure subscription with appropriate permissions
- GitHub account (for Static Web App CI/CD)

### Installation

```powershell
# 1. Navigate to infrastructure directory
cd infrastructure/scripts

# 2. Deploy infrastructure (takes 10-15 minutes)
.\Deploy-Infrastructure.ps1 `
    -Environment dev `
    -SubscriptionId "your-subscription-id"

# 3. Configure secrets in Key Vault
.\Configure-Secrets.ps1 `
    -KeyVaultName "bhs-dev-kv-xxxxx" `
    -SubscriptionId "your-subscription-id"

# 4. Configure RBAC permissions
.\Configure-Permissions.ps1 `
    -ResourceGroupName "bhs-dev-rg" `
    -FunctionAppPrincipalId "xxxxx" `
    -StorageAccountName "bhsdevstg123" `
    -KeyVaultName "bhs-dev-kv-xxxxx" `
    -SubscriptionId "your-subscription-id"

# 5. Set up local development
.\Setup-LocalDev.ps1 `
    -KeyVaultName "bhs-dev-kv-xxxxx" `
    -ResourceGroupName "bhs-dev-rg" `
    -SubscriptionId "your-subscription-id"
```

## 🔑 Key Concepts

### Managed Identity

Function App uses **System-Assigned Managed Identity** to access Azure resources securely:

```csharp
// No connection strings or API keys in code
var credential = new DefaultAzureCredential();

// Automatically uses Managed Identity in Azure, Azure CLI credentials locally
var blobClient = new BlobServiceClient(
    new Uri($"https://{storageAccountName}.blob.core.windows.net"), 
    credential);

var secretClient = new SecretClient(
    new Uri("https://keyvault.vault.azure.net/"), 
    credential);
```

**Benefits:**
- ✅ No secrets in code
- ✅ Automatic credential rotation
- ✅ Audit trail of all access
- ✅ RBAC controls permissions

### Private Endpoints

All Azure services are accessible **only via private endpoints**, not the public internet:

- **Key Vault** - Secrets only accessible from VNet
- **Storage Account** - Blob storage only accessible from VNet
- **Azure OpenAI** - Accessible only from VNet
- **Document Intelligence** - Accessible only from VNet
- **Content Understanding** - Accessible only from VNet

### Private DNS Zones

Private DNS zones resolve service endpoints to private IPs:

```
keyvault.vault.azure.net       → 10.0.2.4 (Private Endpoint)
storageaccount.blob.core.windows.net  → 10.0.2.5 (Private Endpoint)
openai.openai.azure.com        → 10.0.2.6 (Private Endpoint)
```

### VNet Integration

Azure Functions integrates with the VNet to:
- Route all outbound traffic through the VNet
- Access private endpoints securely
- Maintain secure connectivity

## 📊 Parameters

### Environment Variables

Each environment has its own parameter file:

**dev.parameters.json**
```json
{
  "environment": "dev",
  "location": "eastus2",
  "appName": "bhs"
}
```

**prod.parameters.json**
```json
{
  "environment": "prod",
  "location": "eastus2",
  "appName": "bhs"
}
```

### Deployment Client IP

The script automatically detects your IP and adds it to Key Vault firewall for initial setup:

```powershell
# Auto-detected during deployment
$deploymentClientIP = (Invoke-WebRequest -Uri 'https://api.ipify.org?format=json').ip
```

## 🔐 Secrets Configuration

### Supported Secrets

The infrastructure creates these secret references in Key Vault:

```powershell
az keyvault secret set --vault-name <kv-name> --name "KintsugiApiKey" --value "<key>"
az keyvault secret set --vault-name <kv-name> --name "AzureOpenAIEndpoint" --value "https://xxx.openai.azure.com/"
az keyvault secret set --vault-name <kv-name> --name "DocumentIntelligenceEndpoint" --value "https://xxx.cognitiveservices.azure.com/"
az keyvault secret set --vault-name <kv-name> --name "ContentUnderstandingEndpoint" --value "https://xxx.services.ai.azure.com/"
az keyvault secret set --vault-name <kv-name> --name "AzureClientId" --value "63e9b3fd-de9d-4083-879c-9c13f3aac54d"
```

### Function App References

Function App automatically references secrets from Key Vault:

```json
"KEY_VAULT_URI": "https://kv-name.vault.azure.net/",
"AZURE_OPENAI_ENDPOINT": "@Microsoft.KeyVault(VaultName=kv-name;SecretName=AzureOpenAIEndpoint)"
```

## 📈 Scaling & Performance

### Function App Tier

Deployed with **Elastic Premium Plan (EP1)**:
- VNet integration support
- Auto-scaling up to 20 workers
- Always-on capability
- Suitable for prod and high-traffic scenarios

### Storage Account

**Standard LRS** (Locally Redundant Storage):
- Cost-effective for most scenarios
- 99.9% durability within a single region
- Can upgrade to GRS (Geo-Redundant) for prod

### Cognitive Services

**S0 Standard Tier**:
- Shared multi-tenant deployment
- Suitable for dev/test
- Upgrade to dedicated if needed

## 🔄 CI/CD Integration

### GitHub Actions (Static Web App)

Static Web App automatically deploys React frontend via GitHub Actions:

```yaml
# Auto-generated workflow for Static Web App
- Builds: npm run build
- Output: dist/
- Auto-deploys on push to main branch
```

Configure repository:
1. Link GitHub repo in Static Web App settings
2. Select branch (e.g., main)
3. Specify build output folder (dist)

### Azure Functions Deployment

Deploy Function App via Azure DevOps or GitHub Actions:

```powershell
func azure functionapp publish <function-app-name>
```

## 📊 Monitoring & Diagnostics

### Application Insights

Monitor Function App with:
```powershell
# View logs
az monitor app-insights query --app <app-insights-name> \
  --analytics-query "traces | take 10"

# View performance metrics
az monitor app-insights metrics show --app <app-insights-name>
```

### Key Vault Audit

Track all secret access:
```powershell
az monitor activity-log list --resource-group <rg-name> \
  --query "[?resourceType=='Microsoft.KeyVault/vaults']"
```

## 🧹 Cleanup

Delete all resources:

```powershell
.\Teardown-Infrastructure.ps1 `
    -ResourceGroupName "bhs-dev-rg" `
    -SubscriptionId "your-subscription-id" `
    -Force
```

**WARNING:** This permanently deletes all resources!

## 🛠️ Troubleshooting

### Deployment Fails

```powershell
# Check resource group creation
az group show --name bhs-dev-rg

# Validate templates before deployment
az bicep build --file main.bicep

# Check deployment errors
az deployment group show --resource-group bhs-dev-rg --query "properties.error"
```

### Key Vault Access Issues

```powershell
# Verify RBAC assignment
az role assignment list --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<kv-name>

# Check Network ACLs
az keyvault show --name <kv-name> --query "properties.networkAcls"
```

### Function App Can't Access Storage

```powershell
# Verify Managed Identity
az functionapp identity show --name <app-name> --resource-group <rg>

# Check RBAC roles
az role assignment list --assignee <principal-id>

# Test storage access
az storage account show --name <storage-name> --resource-group <rg>
```

## 📚 Additional Resources

- [Azure Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)
- [Managed Identity Documentation](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/)
- [Private Endpoints Documentation](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-overview)
- [Key Vault Best Practices](https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices)
- [Azure Functions VNet Integration](https://learn.microsoft.com/en-us/azure/azure-functions/functions-create-vnet)

## 💡 Best Practices

### Security
✅ Always use Managed Identity instead of connection strings/keys
✅ Keep Key Vault publicly accessible during development (behind firewall), disable after setup
✅ Regularly audit Key Vault access logs
✅ Use RBAC for all access control
✅ Enable soft delete on Key Vault

### Cost Optimization
✅ Use App Service Plans for non-prod (cheaper than Elastic Premium)
✅ Monitor usage and scale appropriately
✅ Delete unused resources promptly
✅ Use Standard tier storage for most scenarios

### Operations
✅ Use consistent naming conventions
✅ Apply tags to all resources for cost tracking
✅ Set up alerts in Application Insights
✅ Document custom parameters
✅ Version control all infrastructure code

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Azure documentation links
3. Check deployment logs in Azure portal
4. Open an issue in the repository

---

**Last Updated:** December 2024
**Bicep Version:** 0.15+
**Azure CLI Version:** 2.50+
