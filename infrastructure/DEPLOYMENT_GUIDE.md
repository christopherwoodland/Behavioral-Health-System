# 🚀 Complete Deployment Guide

Step-by-step guide for deploying the Behavioral Health System infrastructure and application.

## 📋 Pre-Deployment Checklist

- [ ] Azure subscription created
- [ ] Owner or Contributor role on subscription
- [ ] Azure CLI installed (v2.50+)
- [ ] PowerShell 5.1+ installed
- [ ] Bicep CLI installed (`az bicep install`)
- [ ] GitHub account created
- [ ] Required API keys/credentials obtained:
  - [ ] Kintsugi API key
  - [ ] Azure OpenAI endpoint
  - [ ] Document Intelligence credentials
  - [ ] Content Understanding credentials
  - [ ] Azure AD (Entra ID) tenant ID and client ID

## 🔧 Step 1: Prepare Your Environment

### Install Azure CLI

**Windows:**
```powershell
# Using Windows Package Manager
winget install Microsoft.AzureCLI

# Or using Chocolatey
choco install azure-cli
```

**Verify Installation:**
```powershell
az version
az account show
```

### Login to Azure

```powershell
# Interactive login
az login

# Or with device code (useful for restricted networks)
az login --use-device-code

# Set your subscription
az account set --subscription "your-subscription-id"
```

### Install Bicep CLI

```powershell
az bicep install
az bicep version
```

## 📦 Step 2: Deploy Infrastructure

### Navigate to Infrastructure Directory

```powershell
cd .\infrastructure\scripts
```

### Run Deployment Script

```powershell
.\Deploy-Infrastructure.ps1 `
    -Environment dev `
    -SubscriptionId "your-subscription-id" `
    -Location "eastus2" `
    -AppName "bhs"
```

**Parameters:**
- `-Environment`: dev, staging, or prod (default: dev)
- `-SubscriptionId`: Your Azure subscription ID
- `-Location`: Azure region (default: eastus2)
- `-AppName`: Application prefix (default: bhs)

**Expected Output:**
```
► Setting Azure subscription to: 00000000-0000-0000-0000-000000000000
✓ Subscription set
✓ Azure CLI is installed
✓ Detected IP: 203.0.113.42
✓ Template and parameters files found
✓ Templates validated
✓ Resource group created
► Deploying infrastructure to Azure...
► This may take 10-15 minutes. Please be patient...

╔════════════════════════════════════════════════════════════════╗
║             DEPLOYMENT COMPLETED SUCCESSFULLY                 ║
╚════════════════════════════════════════════════════════════════╝

📋 Deployment Information:
   Environment: dev
   Resource Group: bhs-dev-rg
   Location: eastus2

🔑 Key Vault:
   Name: bhs-dev-kv-xxxxx
   URI: https://bhs-dev-kv-xxxxx.vault.azure.net/

📦 Storage Account:
   Name: bhsdevstgxxxxx

⚙️  Azure Functions:
   Name: bhs-dev-func-xxxxx
   URL: https://bhs-dev-func-xxxxx.azurewebsites.net
   Principal ID: 00000000-0000-0000-0000-000000000000

🌐 Static Web App:
   Name: bhs-dev-web
   URL: https://xxxx.azurestaticapps.net

🤖 Azure OpenAI:
   Endpoint: https://bhs-dev-openai-xxxxx.openai.azure.com/

📄 Document Intelligence:
   Endpoint: https://bhs-dev-docintel-xxxxx.cognitiveservices.azure.com/
```

**Save the Output** - You'll need these values in the next steps!

## 🔐 Step 3: Configure Secrets

### Run Secrets Configuration Script

```powershell
.\Configure-Secrets.ps1 `
    -KeyVaultName "bhs-dev-kv-xxxxx" `
    -SubscriptionId "your-subscription-id" `
    -Environment dev
```

**When Prompted, Enter:**

1. **Kintsugi API Key**
   - Get from Kintsugi Health
   - Format: `REDACTED_KINTSUGI_API_KEY`

2. **Azure OpenAI Endpoint**
   - Example: `https://openai-sesame-eastus-001.openai.azure.com/`
   - Get from Azure Portal → OpenAI → Overview

3. **Document Intelligence Endpoint**
   - Example: `https://doc-intel-behavioral-health.cognitiveservices.azure.com/`
   - Get from Azure Portal → Document Intelligence → Overview

4. **Content Understanding Endpoint**
   - Example: `https://csaifcontentunderstanding.services.ai.azure.com/`
   - Get from Azure Portal → AI Services → Overview

5. **GPT Realtime Endpoint**
   - Usually same as Azure OpenAI endpoint

6. **Azure Client ID**
   - Get from Azure AD App Registration (should be: `63e9b3fd-de9d-4083-879c-9c13f3aac54d`)

**Expected Output:**
```
╔════════════════════════════════════════════════════════════════╗
║         CONFIGURE KEY VAULT SECRETS                           ║
╚════════════════════════════════════════════════════════════════╝

► Enter your API credentials...

✓ Kintsugi API Key stored
✓ Azure OpenAI Endpoint stored
✓ Document Intelligence Endpoint stored
✓ Content Understanding Endpoint stored
✓ GPT Realtime Endpoint stored
✓ Azure Client ID stored

╔════════════════════════════════════════════════════════════════╗
║            KEY VAULT CONFIGURATION COMPLETED                  ║
╚════════════════════════════════════════════════════════════════╝

✓ All secrets have been securely stored in Key Vault
```

## 👥 Step 4: Configure RBAC Permissions

### Run Permissions Configuration Script

```powershell
.\Configure-Permissions.ps1 `
    -ResourceGroupName "bhs-dev-rg" `
    -FunctionAppPrincipalId "00000000-0000-0000-0000-000000000000" `
    -StorageAccountName "bhsdevstgxxxxx" `
    -KeyVaultName "bhs-dev-kv-xxxxx" `
    -SubscriptionId "your-subscription-id"
```

**Note:** Use the Principal ID from Step 2 output for `-FunctionAppPrincipalId`

**Expected Output:**
```
✓ Storage Blob Data Contributor role assigned
✓ Key Vault Secrets User role assigned
✓ Cognitive Services User role assigned for bhs-dev-openai-xxxxx
✓ Cognitive Services User role assigned for bhs-dev-docintel-xxxxx

╔════════════════════════════════════════════════════════════════╗
║            RBAC PERMISSIONS CONFIGURED SUCCESSFULLY           ║
╚════════════════════════════════════════════════════════════════╝

✓ Function App now has access to:
  • Storage Account (Blob Data Contributor)
  • Key Vault (Secrets User)
  • Azure OpenAI (Cognitive Services User)
  • Document Intelligence (Cognitive Services User)
```

## 💻 Step 5: Set Up Local Development

### Run Local Development Setup Script

```powershell
.\Setup-LocalDev.ps1 `
    -KeyVaultName "bhs-dev-kv-xxxxx" `
    -ResourceGroupName "bhs-dev-rg" `
    -SubscriptionId "your-subscription-id"
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════════╗
║         SETTING UP LOCAL DEVELOPMENT ENVIRONMENT              ║
╚════════════════════════════════════════════════════════════════╝

✓ Configuration Summary:
  • Function App local.settings.json configured with Key Vault reference
  • React frontend .env.local configured with API URL

📝 Next Steps:
  1. For Azure Functions development:
     • Run: az login --use-device-code
     • This enables local DefaultAzureCredential to access Key Vault
  
  2. For React frontend development:
     • Run: npm install
     • Run: npm run dev
  
  3. Start Azure Functions locally:
     • Run: func start
```

## 🔗 Step 6: Configure Static Web App (Frontend)

### Link GitHub Repository

1. Go to **Azure Portal** → **Static Web Apps** → **bhs-dev-web**
2. Click **Source control** → **Disconnect** (if needed)
3. Click **Source control** → **Connect**
4. Select **GitHub** organization
5. Select **BehavioralHealthSystem** repository
6. Select branch: **main** (or **develop**)
7. Configure build settings:
   - **Build Presets**: Custom
   - **App location**: `BehavioralHealthSystem.Web`
   - **API location**: (leave empty - using separate Function App)
   - **Output location**: `dist`
8. Click **Review + create**

### Verify Deployment

The GitHub Actions workflow should trigger automatically:
1. Check **Actions** tab in GitHub
2. Verify the workflow completes successfully
3. Access the app at the Static Web App URL from Step 2

## 🚀 Step 7: Deploy Azure Functions Backend

### From Local Machine (Development)

```powershell
# Navigate to Functions project
cd ..\BehavioralHealthSystem.Functions

# Install Azure Functions Core Tools (if needed)
# https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local

# Build the project
dotnet build

# Publish to Azure
func azure functionapp publish bhs-dev-func-xxxxx --build remote
```

### From CI/CD Pipeline (Production)

Create a GitHub Actions workflow file at `.github/workflows/deploy-functions.yml`:

```yaml
name: Deploy Azure Functions

on:
  push:
    branches:
      - main
    paths:
      - 'BehavioralHealthSystem.Functions/**'
      - 'BehavioralHealthSystem.Helpers/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0'
      
      - name: Build
        run: dotnet build BehavioralHealthSystem.Functions/BehavioralHealthSystem.Functions.csproj
      
      - name: Publish
        run: dotnet publish BehavioralHealthSystem.Functions/BehavioralHealthSystem.Functions.csproj -c Release -o ./publish
      
      - name: Deploy to Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: 'bhs-dev-func-xxxxx'
          package: './publish'
          publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

### Get Publish Profile

1. Azure Portal → Function App → **Deployment center**
2. Download the **Publish profile**
3. Go to GitHub → Repo → **Settings** → **Secrets and variables** → **Actions**
4. Create new secret: **AZURE_FUNCTIONAPP_PUBLISH_PROFILE**
5. Paste the publish profile content

## ✅ Step 8: Verify Everything Works

### Test Azure Functions Locally

```powershell
# Start Azure Functions
cd BehavioralHealthSystem.Functions
func start

# Test an endpoint (in another terminal)
curl http://localhost:7071/api/health
```

### Test Frontend Locally

```powershell
cd BehavioralHealthSystem.Web

# Install dependencies
npm install

# Login to Azure for development
az login --use-device-code

# Start development server
npm run dev

# Navigate to http://localhost:5173
```

### Test in Azure

1. **Access Static Web App**: https://[your-static-web-app].azurestaticapps.net
2. **Sign in with Azure AD**
3. **Try a feature** (e.g., start PHQ assessment)
4. **Check logs**: Azure Portal → Function App → **Log stream**

## 🔒 Step 9: Secure the Infrastructure

### Disable Key Vault Public Access (Optional - Production Only)

```powershell
# WARNING: Do this ONLY after all setup is complete
# Your local machine will lose access to Key Vault

az keyvault update `
    --name "bhs-dev-kv-xxxxx" `
    --resource-group "bhs-dev-rg" `
    --public-network-access "Disabled"

# To disable, you must deploy through private endpoints only
# Use Azure DevOps or GitHub Actions from within the VNet
```

### Enable Key Vault Soft Delete & Purge Protection

```powershell
# Already enabled by default in our Bicep template
# Verify:
az keyvault show --name "bhs-dev-kv-xxxxx" `
    --query "properties.{softDeleteEnabled:enableSoftDelete, purgeProtection:enablePurgeProtection}"
```

### Configure Key Vault Firewall (Recommended)

```powershell
# Add storage account to Key Vault firewall
az keyvault network-rule add `
    --name "bhs-dev-kv-xxxxx" `
    --resource-group "bhs-dev-rg" `
    --subnet "app-subnet" `
    --vnet-name "bhs-dev-vnet"
```

## 📊 Step 10: Set Up Monitoring

### Configure Application Insights Alerts

```powershell
# Create alert rule for high error rate
az monitor metrics alert create `
    --name "FunctionAppErrorRate" `
    --resource-group "bhs-dev-rg" `
    --scopes "/subscriptions/xxxxx/resourceGroups/bhs-dev-rg/providers/microsoft.insights/components/bhs-dev-appinsights" `
    --description "Alert when error rate exceeds 5%" `
    --condition "avg Exceptions/Server > 5" `
    --window-size 5m `
    --evaluation-frequency 1m
```

### View Logs

```powershell
# Stream Function App logs
func azure functionapp fetch-logs bhs-dev-func-xxxxx

# Or view in Azure Portal:
# Function App → Log stream
```

## 🎉 Deployment Complete!

Your infrastructure is now ready! Here's what you have:

### ✅ Deployed Resources
- ✓ Virtual Network with private subnets
- ✓ Key Vault for secrets management
- ✓ Storage Account with private endpoint
- ✓ Azure Functions with VNet integration
- ✓ Static Web App for frontend
- ✓ Azure OpenAI with private endpoint
- ✓ Document Intelligence with private endpoint
- ✓ Application Insights for monitoring

### ✅ Security Features
- ✓ Managed Identity (no API keys in code)
- ✓ Private Endpoints (services not exposed to internet)
- ✓ Private DNS Zones (secure DNS resolution)
- ✓ RBAC Permissions (fine-grained access control)
- ✓ Key Vault Secrets (encrypted storage)

### 🚀 Next Steps
1. Monitor logs in Application Insights
2. Set up alerts for critical errors
3. Configure auto-scaling if needed
4. Set up backup and disaster recovery
5. Plan for multi-region failover (if needed)

## 🆘 Troubleshooting

### Function App Can't Access Key Vault

```powershell
# Check Managed Identity
az functionapp identity show --name bhs-dev-func-xxxxx --resource-group bhs-dev-rg

# Check RBAC assignment
az role assignment list --assignee [principal-id] --resource-group bhs-dev-rg

# Check Key Vault firewall
az keyvault show --name bhs-dev-kv-xxxxx --query "properties.networkAcls"
```

### Static Web App Can't Call Functions

```powershell
# Check CORS configuration in Function App
az functionapp config show --name bhs-dev-func-xxxxx --resource-group bhs-dev-rg

# Check function app URL in .env file
cat BehavioralHealthSystem.Web/.env.local | grep VITE_API_BASE_URL
```

### Local Development Can't Access Key Vault

```powershell
# Login to Azure
az login --use-device-code

# Verify subscription
az account show

# Test Key Vault access
az keyvault secret list --vault-name bhs-dev-kv-xxxxx
```

---

**Estimated Total Deployment Time:** 30-45 minutes
**Estimated Monthly Cost:** $100-200 (dev), $500-1000 (prod)

For cost estimates, use [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/)
