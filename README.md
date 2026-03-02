# Behavioral Health System

Unified documentation for this repository. This file consolidates all prior Markdown docs.

## Overview

Behavioral Health System is a multi-component platform for behavioral health workflows.

### Kintsugi Health Integration

This project integrates with [Kintsugi Health](https://huggingface.co/KintsugiHealth) for voice-based behavioral health analysis. Kintsugi Health provides machine learning models hosted on Hugging Face that analyze vocal biomarkers to detect signs of depression, anxiety, and other mental health conditions from short speech samples.

- **Hugging Face**: <https://huggingface.co/KintsugiHealth>
- **Purpose**: Voice biomarker analysis for behavioral health screening
- **Integration**: Audio upload and prediction endpoints in the Functions API

### Components

- `BehavioralHealthSystem.Web`: React/TypeScript frontend
- `BehavioralHealthSystem.Functions`: .NET 8 Azure Functions API
- `BehavioralHealthSystem.Helpers`: shared models/services/validators
- `BehavioralHealthSystem.DSM5Import`: DSM-5 data import CLI tooling
- `BehavioralHealthSystem.Tests`: unit and integration-style tests
- `infrastructure`: Azure deployment and operations assets

## Repository Structure

- `BehavioralHealthSystem.sln`
- `BehavioralHealthSystem.Web/`
- `BehavioralHealthSystem.Functions/`
- `BehavioralHealthSystem.Helpers/`
- `BehavioralHealthSystem.DSM5Import/`
- `BehavioralHealthSystem.Tests/`
- `infrastructure/`
- `scripts/`

## Environment Model

The project supports two environments:

- **Development**
  - Used for both local development and Azure-backed dev testing
  - Local run uses optional Ollama (local LLM)
  - Docker-based run uses `docker-compose.development.yml`
- **Production**
  - Hardened Azure deployment with Managed Identity and RBAC
  - Uses `docker-compose.prod.yml`

### Environment Switching

Use the Docker management script:

```powershell
.\scripts\docker-manage.ps1 -Action up -Environment development
.\scripts\docker-manage.ps1 -Action up -Environment production
.\scripts\docker-manage.ps1 -Action down -Environment development
.\scripts\docker-manage.ps1 -Action status
```

## Quick Start

### 1) Backend Local (Functions)

```powershell
cd BehavioralHealthSystem.Functions
dotnet build
func start
```

### 2) Frontend Local (Web)

```powershell
cd BehavioralHealthSystem.Web
npm install
npm run dev
```

### 3) Docker Compose (Development)

```powershell
docker compose -f docker-compose.development.yml up -d --build
```

Typical endpoints:

- Web: `http://localhost:5173`
- Functions API: `http://localhost:7071`

## Configuration Reference

### Frontend (`VITE_*`)

Common keys:

- `VITE_API_BASE_URL`
- `VITE_ENABLE_ENTRA_AUTH` (or legacy auth flags)
- `VITE_AZURE_TENANT_ID`
- `VITE_AZURE_CLIENT_ID`
- `VITE_AZURE_AUTHORITY`
- `VITE_AZURE_REDIRECT_URI`
- `VITE_AZURE_POST_LOGOUT_REDIRECT_URI`
- `VITE_STORAGE_CONTAINER_NAME`
- `VITE_ENABLE_DEBUG_LOGGING`

### Backend (`local.settings.json` / container env)

Common keys:

- `AzureWebJobsStorage` (connection string) **or** MI-style account settings
- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_ACCOUNT_NAME`
- `DSM5_STORAGE_ACCOUNT_NAME`
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET` (if using service principal)
- `KINTSUGI_*`
- `LOCAL_DAM_*`
- `AZURE_OPENAI_*`
- `EXTENDED_ASSESSMENT_OPENAI_*`
- `AZURE_SPEECH_*`

### Security Baseline

- Prefer **Managed Identity + RBAC** where possible
- Store secrets in Key Vault or secure local env
- Never commit secrets to source control

## Core API Areas

Primary route groups in Functions include:

- Session management (`/api/sessions`)
- Prediction submission (`/api/predictions/*`)
- Local DAM provider endpoints (`/api/predictions/submit-selected`, etc.)
- Audio upload (`/api/upload-audio`)
- Health checks (`/api/health`)

## Testing

### .NET Tests

```powershell
cd BehavioralHealthSystem.Tests
dotnet test
```

Coverage / filtered examples:

```powershell
dotnet test --filter "FullyQualifiedName~RiskAssessment"
dotnet test /p:CollectCoverage=true
```

### Frontend Tests

```powershell
cd BehavioralHealthSystem.Web
npm run test
```

## DSM-5 Import Console

Console utility supports DSM-5 content import and status workflows.

Typical commands:

```powershell
bhs import-dsm5
bhs import-status
bhs import-reset
```

Use this path for ingestion/re-ingestion and import progress management.

## Deployment

### Container Build and Push

```powershell
.\scripts\build-and-push-containers.ps1 -Environment production -Tag vX.Y.Z
```

### Azure Bicep Deployment

```powershell
az deployment sub create --location eastus2 --template-file infrastructure/bicep/main-public-containerized.bicep --parameters infrastructure/bicep/parameters/development.parameters.json
az deployment sub create --location eastus2 --template-file infrastructure/bicep/main-public-containerized.bicep --parameters infrastructure/bicep/parameters/prod.parameters.json
```

### Infrastructure Runbook Sequence

```powershell
infrastructure/scripts/Deploy-Infrastructure.ps1
infrastructure/scripts/Configure-Secrets.ps1
infrastructure/scripts/Configure-Permissions.ps1
infrastructure/scripts/Setup-LocalDev.ps1
```

## Operational Checklist

Before release/deployment, verify:

- Docker images build successfully
- API and web health checks pass
- Storage auth works for session save and upload
- Predictions complete and render mapped categories correctly
- Unit tests pass
- Required environment variables and secrets are present

## Frontend Styling Conventions

CSS/style architecture follows ordered, modular imports and shared style conventions. Keep style layering consistent and avoid ad hoc overrides that break global tokens.

## Helpers Contract Notes

Shared helpers define core model and validator contracts used across web/functions/tests.

Implementation guidance:

- Preserve shared schema compatibility between Functions and Web
- Keep validation rules centralized
- Ensure evidence payloads remain list-based where required by existing contracts

## Contributor Automation Notes

Repository includes contributor chatmode/automation guidance for Azure function code generation and deployment workflows. Follow phased planning, status tracking, and best-practice checks when using automation-assisted deployment.

## Troubleshooting

### Storage/Auth Failures

- If endpoint is reachable but operations fail with `AADSTS7000222`, rotate `AZURE_CLIENT_SECRET`
- Confirm `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` in runtime env
- Recreate API container after env changes:

```powershell
docker compose -f docker-compose.development.yml up -d --force-recreate api
```

### Local Runtime Checks

```powershell
curl http://localhost:7071/api/health
```

### Useful Logs

```powershell
docker logs bhs-api --tail 200
```

## Notes

This README is the single consolidated Markdown document for the repository.
