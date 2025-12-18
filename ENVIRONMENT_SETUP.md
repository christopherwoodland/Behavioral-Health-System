# Environment Variable Templates for BHS Deployment

## LOCAL ENVIRONMENT (.env.local)
# For offline development with local models and infrastructure
# Copy to BehavioralHealthSystem.Web/.env.local

```bash
VITE_API_BASE_URL=http://localhost:7071/api
VITE_ENABLE_AUTH=false
VITE_ENVIRONMENT=local
VITE_DEBUG_MODE=true
VITE_OFFLINE_MODE=true
```

## DEVELOPMENT ENVIRONMENT (.env.development)
# For development deployment to Azure with Managed Identity
# Copy to BehavioralHealthSystem.Web/.env.development and replace placeholders

```bash
VITE_API_BASE_URL=https://{your-dev-function-app}.azurewebsites.net/api
VITE_AZURE_CLIENT_ID={your-dev-client-id}
VITE_AZURE_TENANT_ID={your-dev-tenant-id}
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/{your-dev-tenant-id}
VITE_AZURE_REDIRECT_URI=https://{your-dev-web-app}.azurewebsites.net
VITE_ENABLE_AUTH=true
VITE_ENVIRONMENT=development
VITE_DEBUG_MODE=true
```

## PRODUCTION ENVIRONMENT (.env.production)
# For production deployment to Azure with Managed Identity
# Copy to BehavioralHealthSystem.Web/.env.production and replace placeholders

```bash
VITE_API_BASE_URL=https://{your-prod-function-app}.azurewebsites.net/api
VITE_AZURE_CLIENT_ID={your-prod-client-id}
VITE_AZURE_TENANT_ID={your-prod-tenant-id}
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/{your-prod-tenant-id}
VITE_AZURE_REDIRECT_URI=https://{your-prod-web-app}.azurewebsites.net
VITE_ENABLE_AUTH=true
VITE_ENVIRONMENT=production
VITE_DEBUG_MODE=false
```

## Docker Compose Environment Files

### docker-compose.local.yml
Uses local Azurite, Ollama, and mock services. No Azure resources needed.

### docker-compose.development.yml  
Uses Azure development resources with Managed Identity. Requires:
- Development Azure Storage Account
- Development Azure OpenAI
- Development App Insights
- Key Vault for secrets (Kintsugi API key)

### docker-compose.prod.yml
Uses Azure production resources with Managed Identity. Requires:
- Production Azure Storage Account
- Production Azure OpenAI
- Production App Insights
- Key Vault for secrets (Kintsugi API key)

## Running Each Environment

### Local (Offline)
```bash
docker-compose -f docker-compose.local.yml up --build
```

### Development (Azure Dev Resources)
```bash
# Set environment variables first
export STORAGE_ACCOUNT_NAME=your-dev-storage
export AZURE_OPENAI_ENDPOINT=https://your-dev-openai.openai.azure.com/
# ... etc
docker-compose -f docker-compose.development.yml up --build
```

### Production (Azure Prod Resources)
```bash
# Set environment variables first
export STORAGE_ACCOUNT_NAME=your-prod-storage
export AZURE_OPENAI_ENDPOINT=https://your-prod-openai.openai.azure.com/
# ... etc
docker-compose -f docker-compose.prod.yml up --build
```
