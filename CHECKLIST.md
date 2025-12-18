# Environment Setup Checklist

Use this checklist to ensure your three-environment setup is complete and working.

## ✅ Local Environment (Offline Mode)

### Prerequisites
- [ ] Docker Desktop installed and running
- [ ] (Optional) Ollama installed for local LLM

### Setup
- [ ] Copy `local.settings.json.template` to `local.settings.json`
- [ ] Copy `.env.local` exists in `BehavioralHealthSystem.Web/`
- [ ] Review configuration - no API keys needed

### Test
```powershell
# Start local environment
.\scripts\run-environment.ps1 -Environment local

# Verify services
# - Web UI: http://localhost:5173 (should load)
# - API: http://localhost:7071/api/health (should return OK)
# - Azurite: Running (check Docker Desktop)
```

- [ ] Web UI loads at http://localhost:5173
- [ ] API health check returns 200 OK
- [ ] Azurite container is running
- [ ] Can create basic sessions (no Azure services)

### Cleanup
```powershell
.\scripts\run-environment.ps1 -Environment local -Down
```

---

## ✅ Development Environment (Azure Dev)

### Prerequisites
- [ ] Azure subscription with dev resources
- [ ] Azure CLI installed
- [ ] Logged in to Azure: `az login`

### Azure Resources Needed
- [ ] Development Storage Account (name: `________`)
- [ ] Development OpenAI instance (endpoint: `________`)
- [ ] Development App Insights (connection string: `________`)
- [ ] Key Vault for secrets (name: `________`)
- [ ] Managed Identity configured with RBAC permissions

### Infrastructure Deployment
```powershell
# Deploy development infrastructure
az deployment sub create \
  --location eastus2 \
  --template-file infrastructure/bicep/main-public-containerized.bicep \
  --parameters infrastructure/bicep/parameters/development.parameters.json
```

- [ ] Bicep deployment succeeded
- [ ] All Azure resources created
- [ ] Managed Identity has proper RBAC roles
- [ ] Key Vault secrets configured (Kintsugi API key)

### Configuration
- [ ] `local.settings.development.json` exists (already created)
- [ ] `.env.development` updated with your dev endpoints
- [ ] Environment variables set:

```powershell
$env:STORAGE_ACCOUNT_NAME = "your-dev-storage-account"
$env:AZURE_OPENAI_ENDPOINT = "https://your-dev-openai.openai.azure.com/"
$env:EXTENDED_ASSESSMENT_OPENAI_ENDPOINT = "https://your-dev-openai.openai.azure.com/"
$env:AZURE_CONTENT_UNDERSTANDING_ENDPOINT = "https://your-dev-content.services.ai.azure.com/"
$env:DOCUMENT_INTELLIGENCE_ENDPOINT = "https://your-dev-docintel.cognitiveservices.azure.com/"
$env:DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT = "https://your-dev-docintel.cognitiveservices.azure.com/"
$env:AZURE_SPEECH_ENDPOINT = "https://your-region.api.cognitive.microsoft.com"
$env:AZURE_SPEECH_REGION = "eastus2"
$env:AGENT_ENDPOINT = "https://your-dev-openai.openai.azure.com/"
$env:APPLICATIONINSIGHTS_CONNECTION_STRING = "InstrumentationKey=..."
$env:KINTSUGI_API_KEY = "your-api-key"
$env:AZURE_TENANT_ID = "your-tenant-id"
$env:AZURE_CLIENT_ID = "your-client-id"
$env:ENTRA_TENANT_ID = "your-tenant-id"
$env:ENTRA_CLIENT_ID = "your-client-id"
```

### Test
```powershell
# Start development environment
.\scripts\run-environment.ps1 -Environment development

# Verify Azure connectivity
# Check App Insights for logs
# Test Managed Identity authentication
```

- [ ] Containers start successfully
- [ ] Managed Identity authenticates to Azure services
- [ ] Can access Azure OpenAI
- [ ] Can access Storage Account
- [ ] App Insights receiving telemetry
- [ ] Kintsugi API integration works

### Cleanup
```powershell
.\scripts\run-environment.ps1 -Environment development -Down
```

---

## ✅ Production Environment

### Prerequisites
- [ ] Azure subscription (preferably separate from dev)
- [ ] Production Azure resources provisioned
- [ ] Azure Container Registry created
- [ ] CI/CD pipeline configured (optional)

### Azure Resources Needed
- [ ] Production Storage Account
- [ ] Production OpenAI instance
- [ ] Production App Insights
- [ ] Production Key Vault
- [ ] Azure Container Apps or App Service
- [ ] Managed Identity with production RBAC

### Infrastructure Deployment
```powershell
# Build and push production containers
.\scripts\build-and-push-containers.ps1 -Environment production -Tag "v1.0.0"

# Deploy production infrastructure
az deployment sub create \
  --location eastus2 \
  --template-file infrastructure/bicep/main-public-containerized.bicep \
  --parameters infrastructure/bicep/parameters/prod.parameters.json
```

- [ ] Container images built and pushed to ACR
- [ ] Production infrastructure deployed via Bicep
- [ ] All production resources created
- [ ] Managed Identity configured
- [ ] Key Vault secrets set
- [ ] RBAC permissions configured

### Configuration
- [ ] `.env.production` created from `.env.production.template`
- [ ] All production endpoints configured
- [ ] SSL/TLS certificates configured
- [ ] Custom domain configured (if applicable)

### Security Review
- [ ] No API keys in code or environment variables (Azure services)
- [ ] Kintsugi API key in Key Vault only
- [ ] Managed Identity used for all Azure services
- [ ] RBAC follows principle of least privilege
- [ ] Network security configured (VNet if applicable)
- [ ] App Insights configured for production monitoring

### Test
```powershell
# Test production deployment
# Access via production URL
# Monitor in App Insights
# Test all critical functionality
```

- [ ] Production URL accessible
- [ ] Authentication working (Entra ID)
- [ ] All API endpoints responding
- [ ] Voice interaction working
- [ ] Kintsugi integration working
- [ ] Monitoring and alerts configured
- [ ] Load testing completed
- [ ] Disaster recovery plan in place

---

## 📋 Migration from Old Setup

If you're migrating from the old single-environment setup:

### Backup
- [ ] Backup current `local.settings.json` (has API keys)
- [ ] Document current Azure resources
- [ ] Export current configuration

### Local Environment
- [ ] Remove Azure API keys from local setup
- [ ] Copy `local.settings.json.template` to `local.settings.json`
- [ ] Test local offline mode
- [ ] Verify no Azure dependencies

### Development Environment
- [ ] Create new development Azure resources (separate from prod)
- [ ] Configure Managed Identity
- [ ] Migrate API keys to Key Vault
- [ ] Test with development resources
- [ ] Update CI/CD for development deployments

### Production Environment
- [ ] Review current production setup
- [ ] Plan Managed Identity migration
- [ ] Update Key Vault secrets
- [ ] Remove hardcoded API keys
- [ ] Test production with Managed Identity
- [ ] Update production deployment process

### Cleanup Old Files
- [ ] Remove old local.settings.json with API keys
- [ ] Update .gitignore if needed
- [ ] Remove any old environment-specific scripts
- [ ] Archive old documentation

---

## 🔍 Verification Commands

### Check Docker Images
```powershell
docker images | Select-String "bhs"
# Should show: bhs-api:local, bhs-web:local, etc.
```

### Check Running Containers
```powershell
docker ps
# Should show containers when environment is running
```

### Check Azure Resources
```powershell
# List development resources
az resource list --tag Environment=development

# List production resources
az resource list --tag Environment=production
```

### Test API Endpoints
```powershell
# Local
Invoke-WebRequest http://localhost:7071/api/health

# Development (if running locally)
Invoke-WebRequest http://localhost:7071/api/health

# Production
Invoke-WebRequest https://your-prod-api.azurewebsites.net/api/health
```

---

## 📚 Additional Resources

- [ENVIRONMENTS.md](ENVIRONMENTS.md) - Complete environment guide
- [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) - Setup templates
- [ENVIRONMENT_CHANGES.md](ENVIRONMENT_CHANGES.md) - Summary of changes
- [README.md](README.md) - Main documentation
- [infrastructure/DEPLOYMENT_GUIDE.md](infrastructure/DEPLOYMENT_GUIDE.md) - Deployment details

---

## 🆘 Troubleshooting

### Local Environment Issues
**Problem**: Azurite won't start
```powershell
docker-compose -f docker-compose.local.yml down -v
docker volume prune
docker-compose -f docker-compose.local.yml up --build
```

**Problem**: Ollama models not found
```powershell
docker exec -it bhs-ollama ollama pull gpt-4o-mini
docker exec -it bhs-ollama ollama list
```

### Development Environment Issues
**Problem**: Managed Identity not working
- Check: `az login` (are you logged in?)
- Check: RBAC permissions on storage account
- Check: `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` are set
- Check: App Insights logs for auth errors

**Problem**: Missing environment variables
- Verify all required env vars are set
- Check `.env.development` file exists
- Ensure variables are exported before running docker-compose

### Production Environment Issues
**Problem**: Containers won't start
- Check ACR authentication
- Verify container image tags
- Check environment variables in Azure Portal
- Review container logs

**Problem**: Managed Identity permissions
- Check RBAC role assignments
- Verify system-assigned or user-assigned identity
- Check Key Vault access policies
- Review Azure AD audit logs

---

**Next**: Start with Local environment, then Development, then Production ✨
