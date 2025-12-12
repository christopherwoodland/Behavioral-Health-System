# BHS Infrastructure Deployment - Services Reference

## Overview

The automated deployment script deploys the complete Behavioral Health System backend infrastructure with secure VNet integration and private endpoints.

## Services Deployed ✅

### Backend APIs
- **Flex Consumption Function App (FC1)**
  - Runtime: .NET 8 (isolated)
  - VNet Integration: Enabled on dedicated app-subnet
  - Private Endpoint: Yes (on private-endpoint-subnet)
  - Managed Identity: System-assigned with Network Contributor RBAC
  - Auto-scaling: Up to 100 instances
  - Memory: 2048 MB per instance

### AI & ML Services
- **Azure OpenAI**
  - Model: GPT-4.1 deployment
  - Private Endpoint: Yes
  - Real-time API: GPT-realtime deployment
  
- **Document Intelligence**
  - Private Endpoint: Yes
  - Form processing capability
  
- **Content Understanding API**
  - Private Endpoint: Yes
  - Alternative to Document Intelligence for extraction

### Security & Storage
- **Key Vault**
  - Private Endpoint: Yes
  - Firewall: Restricted to deployment client IP
  - TLS 1.2 minimum
  
- **Storage Account**
  - Private Endpoint: Yes
  - Blob containers: conversations, dsm5-data, kintsugi, voice-recordings
  - Shared Key Access: Disabled
  - HTTPS only: Enabled

### Networking
- **Virtual Network (VNet)**
  - Address Space: 10.0.0.0/16
  - Region: eastus2
  
- **Subnets**
  - **app-subnet** (10.0.1.0/24)
    - Delegation: Microsoft.App/environments (for Function App VNet integration)
    - Service Endpoints: Storage, KeyVault, CognitiveServices
    
  - **private-endpoint-subnet** (10.0.2.0/24)
    - Non-delegated (required for private endpoints)
    - Hosts all service private endpoints
    
  - **container-apps-subnet** (10.0.4.0/23)
    - Reserved for future Container Apps deployment

### Monitoring & Logging
- **Application Insights**
  - Monitoring of Function App metrics
  - Performance tracking
  - Failure diagnostics
  
- **Log Analytics Workspace**
  - Central logging hub
  - Diagnostic settings connected

### Private DNS
- **Private DNS Zones** (linked to VNet)
  - `privatelink.azurewebsites.net` (Function App)
  - `privatelink.vaultcore.azure.net` (Key Vault)
  - `privatelink.blob.core.windows.net` (Storage)
  - `privatelink.cognitiveservices.azure.com` (AI services)
  - `privatelink.openai.azure.com` (OpenAI)

---

## Services NOT Deployed ❌

### Static Web App (React Frontend)
- **Status**: Commented out in `main.bicep`
- **Reason**: Temporarily disabled due to transient Azure CLI JSON parsing issues during long deployments
- **Network**: NOT VNet-integrated (Static Web App is a fully managed SaaS service)
- **Authentication**: MSAL (Microsoft Authentication Library)
- **To Deploy**: Uncomment the `staticWebApp` module in `infrastructure/bicep/main.bicep`

### Container Apps (GitHub Runners)
- **Status**: Commented out in `main.bicep`
- **Reason**: Deploy separately after core infrastructure is stable
- **When Ready**: Uncomment the `containerApps` module and redeploy
- **Purpose**: Self-hosted GitHub Actions runners for CI/CD

---

## VNet Integration Details

### Why Separate Subnets?

1. **app-subnet (delegated)**
   - Required for Function App to perform VNet integration
   - Delegation: `Microsoft.App/environments`
   - Cannot host private endpoints (Azure constraint)

2. **private-endpoint-subnet (non-delegated)**
   - All service private endpoints (Storage, KeyVault, OpenAI, etc.)
   - Required because delegated subnets cannot create private endpoints

### Data Flow

```
Internet → [Function App Public IP] → Private Endpoint → Service Private IP
  ↓
  Function App (app-subnet)
  ↓
  Private Endpoint (private-endpoint-subnet)
  ↓
  Private DNS (resolves to private IPs)
  ↓
  Key Vault / Storage / OpenAI (no public internet exposure)
```

---

## Post-Deployment Tasks

### 1. Deploy Function App Code
```powershell
cd BehavioralHealthSystem.Functions
dotnet publish -c Release
az functionapp deployment source config-zip --resource-group bhs-dev --name bhs-dev-func-{suffix} --src bin/Release/net8.0/publish.zip
```

### 2. Configure Secrets in Key Vault
```powershell
# Set secrets needed by Function App
az keyvault secret set --vault-name bhs-dev-kv-{suffix} --name "kintsugi-api-key" --value "{your-key}"
az keyvault secret set --vault-name bhs-dev-kv-{suffix} --name "openai-api-key" --value "{your-key}"
```

### 3. Test VNet Integration
```powershell
# Verify Function App can access services via private endpoints
az functionapp config show --resource-group bhs-dev --name bhs-dev-func-{suffix} | jq '.virtualNetworkSubnetId'
```

### 4. Deploy Static Web App (Optional)
Edit `infrastructure/bicep/main.bicep`:
1. Find the commented `staticWebApp` module (around line 156)
2. Uncomment it
3. Re-run deployment: `.\Deploy-With-VNet-Integration.ps1`

### 5. Set Up CI/CD Pipeline
- GitHub Actions can access private endpoints from Function App
- Configure MSAL authentication in Static Web App

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Azure Subscription                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Virtual Network (10.0.0.0/16) - eastus2      │   │
│  │                                                      │   │
│  │  ┌─────────────────┐         ┌──────────────────┐  │   │
│  │  │  app-subnet     │         │private-endpoint │  │   │
│  │  │ (10.0.1.0/24)   │         │   (10.0.2.0/24) │  │   │
│  │  │ [Delegated]     │         │[Non-delegated]  │  │   │
│  │  │                 │         │                 │  │   │
│  │  │ ┌─────────────┐ │         │ ┌─────────────┐ │  │   │
│  │  │ │ Function    │ │         │ │   Private   │ │  │   │
│  │  │ │ App (FC1)   │ │         │ │ Endpoints:  │ │  │   │
│  │  │ │ .NET 8      │ │         │ │ • Storage   │ │  │   │
│  │  │ │             │ │         │ │ • KV        │ │  │   │
│  │  │ │ System ID   │ │         │ │ • OpenAI    │ │  │   │
│  │  │ └─────────────┘ │         │ │ • DocIntel  │ │  │   │
│  │  └─────────────────┘         │ └─────────────┘ │  │   │
│  │                              └──────────────────┘  │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │     Private DNS Zones                       │  │   │
│  │  │  • privatelink.azurewebsites.net            │  │   │
│  │  │  • privatelink.vaultcore.azure.net          │  │   │
│  │  │  • privatelink.blob.core.windows.net        │  │   │
│  │  │  • privatelink.cognitiveservices.azure.com  │  │   │
│  │  │  • privatelink.openai.azure.com             │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Monitoring                                      │   │
│  │  • Application Insights                         │   │
│  │  • Log Analytics Workspace                      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Key Points

- ✅ **Secure by Default**: All services use private endpoints, no public internet exposure for data
- ✅ **VNet Integrated**: Function App runs inside VNet with delegated subnet
- ✅ **Managed Identity**: System-assigned identity for accessing Azure services
- ✅ **Auto-Scaled**: Function App auto-scales from 0 to 100 instances
- ✅ **Monitoring**: Full observability with Application Insights and Log Analytics
- ❌ **No UI Deployed**: Static Web App is commented out (deploy separately)
- ❌ **No Container Apps**: GitHub runners deploy separately

---

## Related Documents

- `DEPLOYMENT_AUTOMATION.md` - Detailed deployment process and troubleshooting
- `infrastructure/bicep/main.bicep` - Bicep template with architecture notes
- `infrastructure/scripts/Deploy-With-VNet-Integration.ps1` - Automated deployment script
