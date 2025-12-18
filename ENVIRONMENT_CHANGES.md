# Three-Environment Setup - Summary of Changes

## Overview

Successfully reorganized the Behavioral Health System to support three distinct environments:
- **Local**: Offline mode with local models and infrastructure
- **Development**: Azure development resources with Managed Identity
- **Production**: Azure production resources with Managed Identity

## Files Created

### Docker Compose Files
- ✅ `docker-compose.development.yml` - Development environment with Azure resources
- ✅ Updated `docker-compose.local.yml` - Now purely offline with Azurite, Ollama, mock services
- ✅ Existing `docker-compose.prod.yml` - Production (already uses Managed Identity)

### Dockerfiles
- ✅ `BehavioralHealthSystem.Functions/Dockerfile.development`
- ✅ `BehavioralHealthSystem.Web/Dockerfile.development`
- ✅ Existing `Dockerfile.local` and `Dockerfile.prod` remain

### Function Settings
- ✅ `BehavioralHealthSystem.Functions/local.settings.development.json` - Dev Azure resources
- ✅ Updated `BehavioralHealthSystem.Functions/local.settings.json` - Now offline-only
- ✅ Updated `BehavioralHealthSystem.Functions/local.settings.json.template` - Offline template
- ✅ Updated `BehavioralHealthSystem.Functions/local.settings.json.example` - Guidance file
- ✅ Existing `local.settings.production.json` remains

### Web Environment Files
- ✅ `BehavioralHealthSystem.Web/.env.local` - Local offline configuration
- ✅ `BehavioralHealthSystem.Web/.env.development` - Development environment
- ✅ Need to create `.env.production` (user should add based on their prod setup)

### Infrastructure
- ✅ `infrastructure/bicep/parameters/development.parameters.json` - Development Bicep params
- ✅ Existing `dev.parameters.json` and `prod.parameters.json` remain

### Scripts
- ✅ `scripts/run-environment.ps1` - New unified environment runner
- ✅ Updated `scripts/build-and-push-containers.ps1` - Now supports all three environments
- ✅ `scripts/mock-services/index.html` - Mock Kintsugi API for local mode

### Documentation
- ✅ `ENVIRONMENTS.md` - Comprehensive environment configuration guide
- ✅ `ENVIRONMENT_SETUP.md` - Quick setup reference (templates for env vars)
- ✅ Updated `README.md` - Added environment overview section

## Key Changes

### Local Environment (Offline Mode)
**Before**: Mixed online/offline, had Azure API keys
**After**: Completely offline
- Uses Azurite for storage
- Uses Ollama for local LLM (optional)
- Mock Kintsugi API
- No authentication
- No Azure services

### Development Environment
**New**: Full Azure integration with dev resources
- Managed Identity (no API keys in code)
- Separate dev Azure resources
- Key Vault for third-party secrets (Kintsugi)
- Full monitoring with App Insights

### Production Environment
**Before**: Had API keys
**After**: Managed Identity
- No API keys in code
- Key Vault for secrets
- Production-grade security

## Environment Variables

### Local (.env.local)
```bash
VITE_API_BASE_URL=http://localhost:7071/api
VITE_ENABLE_AUTH=false
VITE_OFFLINE_MODE=true
```

### Development (.env.development)
```bash
VITE_API_BASE_URL=https://{dev-app}.azurewebsites.net/api
VITE_AZURE_CLIENT_ID={dev-client-id}
VITE_ENABLE_AUTH=true
```

### Production (.env.production)
```bash
VITE_API_BASE_URL=https://{prod-app}.azurewebsites.net/api
VITE_AZURE_CLIENT_ID={prod-client-id}
VITE_ENABLE_AUTH=true
```

## Usage Examples

### Running Locally (Offline)
```powershell
.\scripts\run-environment.ps1 -Environment local
# OR
docker-compose -f docker-compose.local.yml up --build
```

### Running Development
```powershell
# Set environment variables first
$env:STORAGE_ACCOUNT_NAME = "your-dev-storage"
# ... etc

.\scripts\run-environment.ps1 -Environment development
# OR
docker-compose -f docker-compose.development.yml up --build
```

### Building for Production
```powershell
.\scripts\build-and-push-containers.ps1 -Environment production -Tag "v1.0.0"
```

## Migration Guide

### For Existing Developers

1. **Local Development**:
   ```powershell
   # Copy the template
   cp BehavioralHealthSystem.Functions/local.settings.json.template `
      BehavioralHealthSystem.Functions/local.settings.json
   
   # Run offline
   .\scripts\run-environment.ps1 -Environment local
   ```

2. **Development with Azure**:
   - Use `local.settings.development.json` (already configured)
   - Set environment variables for your Azure resources
   - Run: `.\scripts\run-environment.ps1 -Environment development`

3. **Production**:
   - Update your production deployment to use Managed Identity
   - Remove API keys from configuration
   - Use Key Vault for third-party secrets

## Infrastructure Separation

### Development Infrastructure
- Separate Azure resources from production
- File: `infrastructure/bicep/parameters/development.parameters.json`
- Deploy: `az deployment sub create ... --parameters development.parameters.json`

### Production Infrastructure
- Dedicated production resources
- File: `infrastructure/bicep/parameters/prod.parameters.json`
- Deploy: `az deployment sub create ... --parameters prod.parameters.json`

## Benefits

1. **Clear Separation**: Each environment has distinct purpose and configuration
2. **Security**: Managed Identity in Azure environments (no keys in code)
3. **Offline Development**: Can develop without Azure subscription
4. **Cost Savings**: Local mode has zero Azure costs
5. **Best Practices**: Follows Azure and container best practices
6. **Flexibility**: Easy to switch between environments

## Next Steps

1. ✅ Test local environment: `.\scripts\run-environment.ps1 -Environment local`
2. ⬜ Set up development Azure resources
3. ⬜ Deploy development infrastructure with Bicep
4. ⬜ Test development environment
5. ⬜ Update production to use Managed Identity
6. ⬜ Remove old API keys from Key Vault (if applicable)

## Files to Review/Update

### Optional Updates
- `.gitignore` - Ensure `local.settings.json` and `.env.local` are ignored (already should be)
- CI/CD pipelines - Update to use new environment structure
- Any custom scripts that reference old file names

### Deprecated/Old Files
These files are now superseded but kept for backward compatibility:
- `infrastructure/bicep/parameters/dev.parameters.json` (use `development.parameters.json` instead)

## Troubleshooting

See [ENVIRONMENTS.md](ENVIRONMENTS.md) for detailed troubleshooting guide.

### Common Issues

**Local Mode**:
- Azurite not starting → `docker-compose down -v` then retry
- Ollama models missing → `docker exec -it bhs-ollama ollama pull gpt-4o-mini`

**Development Mode**:
- Managed Identity fails → Check `az login` and RBAC permissions
- Missing env vars → Check all required variables are set

**Production Mode**:
- Same as development, plus ensure production RBAC is configured

---

**Documentation**: See [ENVIRONMENTS.md](ENVIRONMENTS.md) for complete guide
