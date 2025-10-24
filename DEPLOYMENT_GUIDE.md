# 🚀 Deployment Guide - Behavioral Health System

Complete guide for deploying the Behavioral Health System to Azure resource group `bhi-develop`.

## 📋 Prerequisites

Before deploying, ensure you have the following installed and configured:

### Required Tools

1. **Azure CLI** (version 2.50.0 or higher)
   ```powershell
   # Check if installed
   az --version
   
   # Install if needed: https://aka.ms/InstallAzureCLIDirect
   ```

2. **.NET 8 SDK**
   ```powershell
   # Check if installed
   dotnet --version
   # Should show 8.0.x or higher
   ```

3. **Azure Functions Core Tools v4**
   ```powershell
   # Check if installed
   func --version
   # Should show 4.x or higher
   
   # Install if needed
   npm install -g azure-functions-core-tools@4 --unsafe-perm true
   ```

4. **Node.js & npm** (version 18.x or higher)
   ```powershell
   # Check if installed
   node --version
   npm --version
   ```

5. **PowerShell** (version 5.1 or higher - already installed on Windows)

### Azure Account Setup

1. **Login to Azure**
   ```powershell
   az login
   ```
   This will open a browser window for authentication.

2. **Set Your Subscription** (if you have multiple)
   ```powershell
   # List available subscriptions
   az account list --output table
   
   # Set the subscription you want to use
   az account set --subscription "Your-Subscription-Name-or-ID"
   ```

3. **Verify Authentication**
   ```powershell
   az account show
   ```

### Required Information

Before running deployment, gather the following:

- ✅ **Kintsugi API Key** - Get from [Kintsugi Health Portal](https://api.kintsugihealth.com)
- ✅ **Azure OpenAI Endpoint** - Your Azure OpenAI resource endpoint
- ✅ **Azure OpenAI API Key** - Your Azure OpenAI API key
- ✅ **Azure AD/Entra ID Configuration** (for authentication):
  - Tenant ID
  - Client ID
  - Admin Group Object ID
  - Control Panel Group Object ID

---

## 🎯 Quick Deploy (Recommended)

The fastest way to deploy everything to `bhi-develop` resource group:

### Step 1: Navigate to Solution Root

```powershell
cd C:\Users\cwoodland\dev\BehavioralHealthSystem
```

### Step 2: Run Quick Deploy Script

```powershell
.\scripts\deploy-solution.ps1 `
  -FunctionAppName "bhi-develop-func" `
  -KintsugiApiKey "your-kintsugi-api-key-here" `
  -Location "East US" `
  -QuickDeploy
```

This will:
- ✅ Auto-generate resource group name: `rg-bhi-develop-func`
- ✅ Auto-generate web app name: `bhi-develop-func-web`
- ✅ Build the entire solution
- ✅ Deploy all Azure infrastructure (Function App, Storage, App Insights, Web App)
- ✅ Deploy Function App code
- ✅ Deploy Web App code
- ✅ Configure all environment variables

**Deployment Time:** ~10-15 minutes

---

## 🎨 Custom Deploy to `bhi-develop`

If you want to specify the exact resource group name:

### Step 1: Navigate to Solution Root

```powershell
cd C:\Users\cwoodland\dev\BehavioralHealthSystem
```

### Step 2: Run Custom Deploy

```powershell
.\scripts\deploy-solution.ps1 `
  -ResourceGroupName "bhi-develop" `
  -FunctionAppName "bhi-develop-func" `
  -WebAppName "bhi-develop-web" `
  -KintsugiApiKey "your-kintsugi-api-key-here" `
  -Location "East US"
```

### Step 3: (Optional) Add Azure OpenAI Configuration

If you want to include Azure OpenAI for extended risk assessment:

```powershell
.\scripts\deploy-solution.ps1 `
  -ResourceGroupName "bhi-develop" `
  -FunctionAppName "bhi-develop-func" `
  -WebAppName "bhi-develop-web" `
  -KintsugiApiKey "your-kintsugi-api-key-here" `
  -Location "East US" `
  -AzureOpenAIEndpoint "https://your-resource.cognitiveservices.azure.com" `
  -AzureOpenAIApiKey "your-azure-openai-key"
```

---

## 🔧 Infrastructure-Only Deploy

If you only want to create the Azure resources without deploying code:

```powershell
.\scripts\deploy-solution.ps1 `
  -ResourceGroupName "bhi-develop" `
  -FunctionAppName "bhi-develop-func" `
  -WebAppName "bhi-develop-web" `
  -KintsugiApiKey "your-kintsugi-api-key-here" `
  -Location "East US" `
  -DeployCode $false
```

Then deploy code separately:

```powershell
# Deploy Function App code
.\scripts\deploy-code-only.ps1 `
  -TargetFunctionAppName "bhi-develop-func" `
  -ResourceGroupName "bhi-develop"

# Deploy Web App
.\scripts\deploy-ui.ps1 `
  -DeploymentTarget "app-service" `
  -ResourceName "bhi-develop-web" `
  -ResourceGroupName "bhi-develop" `
  -FunctionAppName "bhi-develop-func"
```

---

## 📦 What Gets Deployed

The deployment creates the following Azure resources in your resource group:

### Core Resources

1. **Azure Function App** (`bhi-develop-func`)
   - Runtime: .NET 8 Isolated
   - Plan: Consumption (Y1)
   - API endpoints for session management, risk assessment, biometric data

2. **Azure App Service** (`bhi-develop-web`)
   - Runtime: Node.js
   - Plan: Basic (B1)
   - React SPA with Vite

3. **Azure Storage Account** (auto-generated name)
   - Used by Function App for state and triggers
   - Blob containers for session data, audio files, transcripts
   - DSM-5 data storage

4. **Application Insights** (`ai-bhi-develop-func`)
   - Monitoring and telemetry for both Function App and Web App
   - Log analytics workspace

5. **App Service Plans**
   - Consumption plan for Function App
   - Basic B1 plan for Web App

### Storage Containers Created

- `audio-uploads` - Voice recordings and audio files
- `sessions` - Session metadata and state
- `transcripts` - Chat transcripts and conversation logs
- `dsm5-data` - DSM-5 diagnostic criteria data
- `bio/users/{userId}` - Biometric data storage
- `bio/users/{userId}/smart-band-{timestamp}.json` - Smart Band sensor data

---

## ✅ Post-Deployment Verification

### 1. Verify Infrastructure Deployment

```powershell
# List all resources in the resource group
az resource list --resource-group bhi-develop --output table

# Check Function App status
az functionapp show --name bhi-develop-func --resource-group bhi-develop --query "state" --output tsv

# Check Web App status
az webapp show --name bhi-develop-web --resource-group bhi-develop --query "state" --output tsv
```

### 2. Test Function App Health Endpoint

```powershell
# Test health check
curl https://bhi-develop-func.azurewebsites.net/api/health

# Expected response:
# {
#   "status": "Healthy",
#   "timestamp": "2025-10-24T...",
#   "environment": "Production",
#   "dependencies": { ... }
# }
```

### 3. Test Kintsugi Integration

```powershell
# Test Kintsugi API connection
curl -X POST https://bhi-develop-func.azurewebsites.net/api/TestKintsugiConnection

# Expected response:
# {
#   "success": true,
#   "message": "Kintsugi API connection successful"
# }
```

### 4. Access Web Application

Open your browser and navigate to:
```
https://bhi-develop-web.azurewebsites.net
```

The web app should load and display the Behavioral Health System interface.

### 5. Check Application Insights

```powershell
# View recent logs
az monitor app-insights metrics show `
  --app ai-bhi-develop-func `
  --resource-group bhi-develop `
  --metrics requests/count
```

Or visit Azure Portal:
```
https://portal.azure.com/#resource/subscriptions/{your-subscription-id}/resourceGroups/bhi-develop/providers/Microsoft.Insights/components/ai-bhi-develop-func
```

---

## 🔐 Configure Authentication (Azure AD/Entra ID)

After deployment, configure Azure AD authentication:

### 1. Update Web App Environment Variables

```powershell
# Navigate to Web project
cd BehavioralHealthSystem.Web

# Create .env.production file
@"
VITE_API_BASE_URL=https://bhi-develop-func.azurewebsites.net/api
VITE_AZURE_TENANT_ID=your-tenant-id
VITE_AZURE_CLIENT_ID=your-client-id
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
VITE_AZURE_REDIRECT_URI=https://bhi-develop-web.azurewebsites.net
VITE_AZURE_POST_LOGOUT_REDIRECT_URI=https://bhi-develop-web.azurewebsites.net
VITE_AZURE_ADMIN_GROUP_ID=your-admin-group-id
VITE_AZURE_CONTROL_PANEL_GROUP_ID=your-control-panel-group-id
VITE_ENABLE_ENTRA_AUTH=true
"@ | Out-File -FilePath .env.production -Encoding UTF8
```

### 2. Redeploy Web App with Updated Config

```powershell
.\scripts\deploy-ui.ps1 `
  -DeploymentTarget "app-service" `
  -ResourceName "bhi-develop-web" `
  -ResourceGroupName "bhi-develop" `
  -FunctionAppName "bhi-develop-func"
```

---

## 🎤 Enable Smart Band Integration (Optional)

If you want to enable Microsoft Band sensor data collection:

### 1. Deploy Band Service

The Band Service runs as a local Windows Service. It cannot be deployed to Azure directly.

**For Development/Testing:**
```powershell
cd BehavioralHealthSystem.BandService
dotnet run
```

**For Production (Windows Server):**
```powershell
cd BehavioralHealthSystem.BandService
.\start-service.ps1
```

### 2. Configure Web App for Band Integration

Update your web app environment variables:

```powershell
# In BehavioralHealthSystem.Web/.env.production
VITE_ENABLE_SMART_BAND=true
VITE_BAND_SERVICE_URL=http://your-server-ip:8765
```

**Note:** The Band Service must be accessible from the client browser, not from Azure.

---

## 📊 Monitoring and Troubleshooting

### View Application Insights Logs

```powershell
# Open Application Insights in Azure Portal
az monitor app-insights component show `
  --app ai-bhi-develop-func `
  --resource-group bhi-develop
```

### View Function App Logs (Live)

```powershell
# Stream logs in real-time
func azure functionapp logstream bhi-develop-func --resource-group bhi-develop
```

### Check Function App Configuration

```powershell
# List all app settings
az functionapp config appsettings list `
  --name bhi-develop-func `
  --resource-group bhi-develop `
  --output table
```

### Common Issues

#### Issue: "Function app is not running"
```powershell
# Restart the function app
az functionapp restart --name bhi-develop-func --resource-group bhi-develop
```

#### Issue: "CORS errors when accessing API from web app"
```powershell
# Add CORS origin
az functionapp cors add `
  --name bhi-develop-func `
  --resource-group bhi-develop `
  --allowed-origins "https://bhi-develop-web.azurewebsites.net"
```

#### Issue: "Kintsugi API connection failed"
```powershell
# Update Kintsugi API key
az functionapp config appsettings set `
  --name bhi-develop-func `
  --resource-group bhi-develop `
  --settings "KINTSUGI_API_KEY=your-new-key"

# Restart after updating
az functionapp restart --name bhi-develop-func --resource-group bhi-develop
```

---

## 🔄 Update Existing Deployment

### Update Function App Code Only

```powershell
cd C:\Users\cwoodland\dev\BehavioralHealthSystem

.\scripts\deploy-code-only.ps1 `
  -TargetFunctionAppName "bhi-develop-func" `
  -ResourceGroupName "bhi-develop"
```

### Update Web App Code Only

```powershell
.\scripts\deploy-ui.ps1 `
  -DeploymentTarget "app-service" `
  -ResourceName "bhi-develop-web" `
  -ResourceGroupName "bhi-develop" `
  -FunctionAppName "bhi-develop-func"
```

### Update Environment Variables

```powershell
.\scripts\deploy-environment-variables.ps1 `
  -FunctionAppName "bhi-develop-func" `
  -ResourceGroupName "bhi-develop"
```

---

## 🗑️ Delete Deployment

To completely remove all resources:

```powershell
# Delete the entire resource group (WARNING: irreversible!)
az group delete --name bhi-develop --yes --no-wait

# Verify deletion
az group show --name bhi-develop
# Should show "Resource group 'bhi-develop' could not be found"
```

---

## 📚 Additional Resources

- **Azure Functions Documentation**: https://docs.microsoft.com/azure/azure-functions/
- **Azure App Service Documentation**: https://docs.microsoft.com/azure/app-service/
- **Application Insights Documentation**: https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview
- **Kintsugi Health API**: https://api.kintsugihealth.com/docs
- **Project README**: [README.md](./README.md)
- **Smart Band Integration**: [SMART_BAND_INTEGRATION.md](./SMART_BAND_INTEGRATION.md)

---

## 🆘 Getting Help

If you encounter issues during deployment:

1. **Check Prerequisites**: Ensure all required tools are installed and up-to-date
2. **Verify Azure Login**: Run `az account show` to confirm authentication
3. **Check Logs**: Use Application Insights or live log streaming
4. **Review Error Messages**: Deployment scripts provide detailed error information
5. **Check Resource Group**: Ensure you have permissions to create resources

For specific errors, check the [troubleshooting section](#monitoring-and-troubleshooting) above.

---

## ✨ Next Steps After Deployment

1. ✅ **Configure Azure AD Authentication** - Set up user authentication
2. ✅ **Upload DSM-5 Data** - Import diagnostic criteria (see BehavioralHealthSystem.Console)
3. ✅ **Set Up Monitoring Alerts** - Configure Application Insights alerts
4. ✅ **Configure Backup** - Set up Azure Backup for critical data
5. ✅ **Enable Auto-Scaling** - Configure scale-out rules for production load
6. ✅ **Set Up CI/CD** - Configure GitHub Actions for automated deployments
7. ✅ **Review Security** - Enable managed identity, configure network security

---

**Last Updated:** October 24, 2025
**Deployment Scripts Version:** 1.0
**Compatible with:** Azure CLI 2.50+, .NET 8, Node.js 18+
