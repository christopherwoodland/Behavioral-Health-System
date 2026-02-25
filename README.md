# Behavioral Health System

Unified documentation for this repository. This file consolidates all prior Markdown docs.

## Overview

Behavioral Health System is a multi-component platform for behavioral health workflows:

- `BehavioralHealthSystem.Web`: React/TypeScript frontend
- `BehavioralHealthSystem.Functions`: .NET 8 Azure Functions API
- `BehavioralHealthSystem.Helpers`: shared models/services/validators
- `BehavioralHealthSystem.Console`: DSM-5 data import and utility tooling
- `BehavioralHealthSystem.Tests`: unit and integration-style tests
- `services/dam-selfhost`: self-hosted DAM model wrapper for local inference
- `infrastructure`: Azure deployment and operations assets

## Repository Structure

- `BehavioralHealthSystem.sln`
- `BehavioralHealthSystem.Web/`
- `BehavioralHealthSystem.Functions/`
- `BehavioralHealthSystem.Helpers/`
- `BehavioralHealthSystem.Console/`
- `BehavioralHealthSystem.Tests/`
- `services/dam-selfhost/`
- `infrastructure/`
- `scripts/`

## Environment Model

The project supports three execution targets:

- **Local (offline-first)**
  - Dockerized stack for local development
  - Optional local DAM self-hosted model
- **Development (Azure-backed)**
  - Uses Azure resources and managed identity/service principal auth
- **Production (Azure-backed)**
  - Hardened Azure deployment path with MI/RBAC-first model

### Environment Switching

Use the environment runner scripts:

```powershell
.\scripts\run-environment.ps1 -Environment local
.\scripts\run-environment.ps1 -Environment development
.\scripts\run-environment.ps1 -Environment production
.\scripts\run-environment.ps1 -Environment local -Down
```

Direct compose options are also available:

```powershell
docker-compose -f docker-compose.local.yml up --build
docker-compose -f docker-compose.development.yml up --build
docker-compose -f docker-compose.prod.yml up --build
```

## Quick Start

### 1) Local Offline Run

```powershell
docker compose -f docker-compose.local.yml up -d --build
```

Typical local endpoints:

- Web: `http://localhost:5173`
- Functions API: `http://localhost:7071`
- Local DAM: `http://localhost:8000`
- Ollama: `http://localhost:11434`

### 2) Backend Local (Functions)

```powershell
cd BehavioralHealthSystem.Functions
dotnet build
func start
```

### 3) Frontend Local (Web)

```powershell
cd BehavioralHealthSystem.Web
npm install
npm run dev
```

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
- `VITE_AZURE_OPENAI_REALTIME_*`
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

## Local DAM Self-Hosted Service

Local DAM API contract:

- `GET /health`
- `POST /initiate`
- `POST /predict`

Run service:

```powershell
docker compose -f .\docker-compose.local.yml up -d --build dam-selfhost
```

Notes:

- First build is heavy (PyTorch/model dependencies)
- Used for local/offline scoring scenarios

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

## Agent Prompt Contract (Matron)

The Matron voice/agent behavior requires:

- Friendly onboarding and consent-aware interaction
- Collection/confirmation of caller nickname
- Optional demographics collection where applicable
- Correct metric conversion rules and safe phrasing
- Privacy-aware language
- Clear handoff/escalation to Tars when required

Prompt source is in the Functions prompts folder and is now represented here as policy-level guidance.

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
docker compose -f docker-compose.local.yml up -d --force-recreate api
```

### Local Runtime Checks

```powershell
curl http://localhost:7071/api/health
curl http://localhost:8000/health
```

### Useful Logs

```powershell
docker logs bhs-api --tail 200
docker logs bhs-dam-selfhost --tail 200
```

## Notes

This README is the single consolidated Markdown document for the repository.
