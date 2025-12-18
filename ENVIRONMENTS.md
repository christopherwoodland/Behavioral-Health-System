# Three-Environment Configuration Guide

This document describes the three-environment setup for the Behavioral Health System (BHS).

## Overview

The BHS application supports three distinct environments:

| Environment | Purpose | Infrastructure | Authentication |
|------------|---------|----------------|----------------|
| **Local** | Offline development | Local computer (Azurite, Ollama) | None |
| **Development** | Azure dev/test | Azure resources (dev) | Managed Identity |
| **Production** | Production deployment | Azure resources (prod) | Managed Identity |

## Environment Details

### 1. LOCAL Environment (Offline Mode)

**Purpose**: Run the application completely offline for development without any Azure dependencies.

**Infrastructure**:
- **Azurite**: Azure Storage emulator
- **Ollama**: Local LLM server (optional)
- **Mock Kintsugi**: Simple mock API for testing

**Configuration Files**:
- `docker-compose.local.yml`
- `BehavioralHealthSystem.Functions/local.settings.json`
- `BehavioralHealthSystem.Web/.env.local`

**Quick Start**:
```powershell
# Copy template
cp BehavioralHealthSystem.Functions/local.settings.json.template BehavioralHealthSystem.Functions/local.settings.json

# Run with docker-compose
docker-compose -f docker-compose.local.yml up --build

# OR use the helper script
.\scripts\run-environment.ps1 -Environment local
```

**Services**:
- Web UI: http://localhost:5173
- API: http://localhost:7071
- Azurite Blob: http://localhost:10000
- Ollama: http://localhost:11434

**Features**:
- ✅ No Azure account required
- ✅ No API keys needed
- ✅ Fast startup
- ✅ Completely offline
- ❌ Limited AI capabilities
- ❌ No real Kintsugi integration

---

### 2. DEVELOPMENT Environment

**Purpose**: Test with Azure services in a development subscription using Managed Identity (no API keys).

**Infrastructure**:
- **Azure Storage**: Development storage account
- **Azure OpenAI**: Development instance
- **Azure App Insights**: Development monitoring
- **Key Vault**: For third-party secrets (Kintsugi)
- **Managed Identity**: No API keys in code

**Configuration Files**:
- `docker-compose.development.yml`
- `BehavioralHealthSystem.Functions/local.settings.development.json`
- `BehavioralHealthSystem.Web/.env.development`
- `infrastructure/bicep/parameters/development.parameters.json`

**Quick Start**:
```powershell
# Set environment variables (replace with your dev resources)
$env:STORAGE_ACCOUNT_NAME = "your-dev-storage"
$env:AZURE_OPENAI_ENDPOINT = "https://your-dev-openai.openai.azure.com/"
$env:APPLICATIONINSIGHTS_CONNECTION_STRING = "InstrumentationKey=..."
$env:KINTSUGI_API_KEY = "your-key"
$env:AZURE_TENANT_ID = "your-tenant-id"
$env:AZURE_CLIENT_ID = "your-client-id"

# Run with docker-compose
docker-compose -f docker-compose.development.yml up --build

# OR use the helper script
.\scripts\run-environment.ps1 -Environment development
```

**Bicep Deployment**:
```powershell
# Deploy development infrastructure
az deployment sub create \
  --location eastus2 \
  --template-file infrastructure/bicep/main-public-containerized.bicep \
  --parameters infrastructure/bicep/parameters/development.parameters.json
```

**Features**:
- ✅ Full Azure integration
- ✅ Managed Identity (secure)
- ✅ Real AI models
- ✅ Real Kintsugi API
- ✅ Monitoring & diagnostics
- ❌ Requires Azure subscription
- ❌ Costs money (dev tier)

---

### 3. PRODUCTION Environment

**Purpose**: Production deployment with full Azure services and Managed Identity.

**Infrastructure**:
- **Azure Storage**: Production storage account
- **Azure OpenAI**: Production instance
- **Azure App Insights**: Production monitoring
- **Key Vault**: For third-party secrets (Kintsugi)
- **Managed Identity**: No API keys in code
- **Azure Container Apps**: Production hosting

**Configuration Files**:
- `docker-compose.prod.yml`
- `BehavioralHealthSystem.Functions/local.settings.production.json`
- `BehavioralHealthSystem.Web/.env.production`
- `infrastructure/bicep/parameters/prod.parameters.json`

**Quick Start**:
```powershell
# Set environment variables (replace with your prod resources)
$env:STORAGE_ACCOUNT_NAME = "your-prod-storage"
$env:AZURE_OPENAI_ENDPOINT = "https://your-prod-openai.openai.azure.com/"
$env:APPLICATIONINSIGHTS_CONNECTION_STRING = "InstrumentationKey=..."
$env:KINTSUGI_API_KEY = "your-key"
$env:AZURE_TENANT_ID = "your-tenant-id"
$env:AZURE_CLIENT_ID = "your-client-id"

# Build and push containers
.\scripts\build-and-push-containers.ps1 -Environment production -Tag "v1.0.0"

# Deploy to Azure
az deployment sub create \
  --location eastus2 \
  --template-file infrastructure/bicep/main-public-containerized.bicep \
  --parameters infrastructure/bicep/parameters/prod.parameters.json
```

**Features**:
- ✅ Production-grade security
- ✅ Managed Identity
- ✅ High availability
- ✅ Auto-scaling
- ✅ Full monitoring
- ❌ Requires Azure subscription
- ❌ Production costs

---

## File Structure

```
Behavioral-Health-System/
├── docker-compose.local.yml           # Local offline mode
├── docker-compose.development.yml     # Development with Azure
├── docker-compose.prod.yml           # Production
├── ENVIRONMENT_SETUP.md              # This file
│
├── BehavioralHealthSystem.Functions/
│   ├── Dockerfile.local              # Local build
│   ├── Dockerfile.development        # Development build
│   ├── Dockerfile.prod              # Production build
│   ├── local.settings.json          # Local (git-ignored)
│   ├── local.settings.json.template # Local template
│   ├── local.settings.development.json  # Development settings
│   └── local.settings.production.json   # Production settings
│
├── BehavioralHealthSystem.Web/
│   ├── Dockerfile.local             # Local build
│   ├── Dockerfile.development       # Development build
│   ├── Dockerfile.prod             # Production build
│   ├── .env.local                  # Local (git-ignored)
│   ├── .env.development            # Development
│   └── .env.production             # Production
│
├── infrastructure/bicep/
│   └── parameters/
│       ├── dev.parameters.json          # Legacy dev params
│       ├── development.parameters.json  # New development params
│       └── prod.parameters.json        # Production params
│
└── scripts/
    ├── run-environment.ps1         # Environment runner
    └── build-and-push-containers.ps1  # Build script (multi-env)
```

## Switching Between Environments

### Option 1: Using Helper Scripts (Recommended)

```powershell
# Run local
.\scripts\run-environment.ps1 -Environment local

# Run development
.\scripts\run-environment.ps1 -Environment development

# Run production
.\scripts\run-environment.ps1 -Environment production

# Stop any environment
.\scripts\run-environment.ps1 -Environment local -Down
```

### Option 2: Using Docker Compose Directly

```powershell
# Local
docker-compose -f docker-compose.local.yml up --build

# Development
docker-compose -f docker-compose.development.yml up --build

# Production
docker-compose -f docker-compose.prod.yml up --build
```

### Option 3: Azure Deployment

```powershell
# Build and push containers
.\scripts\build-and-push-containers.ps1 -Environment production

# Deploy infrastructure
az deployment sub create \
  --location eastus2 \
  --template-file infrastructure/bicep/main-public-containerized.bicep \
  --parameters infrastructure/bicep/parameters/prod.parameters.json
```

## Migration Notes

### From Old Setup

If you were using the old setup with hardcoded API keys:

1. **Local development**: Your old `local.settings.json` had Azure API keys. Now use the template for offline mode.
2. **Development**: Create new dev Azure resources and use Managed Identity.
3. **Production**: Update to use Managed Identity instead of API keys.

### Removed Files

The following files are now replaced:
- Old `local.settings.json` → Now three separate files for each environment
- Single docker-compose → Now three docker-compose files
- Hardcoded API keys → Managed Identity for Azure environments

## Best Practices

### Local Development
- Use for quick iterations
- No Azure costs
- Test basic functionality

### Development Environment
- Test full Azure integration
- Use separate dev resources
- Test with real AI models
- Validate before production

### Production Environment  
- Use CI/CD for deployments
- Tag container images with versions
- Monitor with App Insights
- Use separate Azure subscription if possible

## Troubleshooting

### Local Environment Issues

**Azurite not starting**:
```powershell
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up --build
```

**Ollama models not found**:
```powershell
# Pull models locally
docker exec -it bhs-ollama ollama pull gpt-4o-mini
```

### Development/Production Issues

**Managed Identity not working**:
- Ensure you're logged in: `az login`
- Check RBAC permissions on Azure resources
- Verify `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`

**Missing environment variables**:
- Check `.env` file exists
- Verify environment variables are set before running docker-compose

## See Also

- [README.md](README.md) - Main project documentation
- [infrastructure/DEPLOYMENT_GUIDE.md](infrastructure/DEPLOYMENT_GUIDE.md) - Deployment guide
- [BehavioralHealthSystem.Web/README.md](BehavioralHealthSystem.Web/README.md) - Web UI documentation
