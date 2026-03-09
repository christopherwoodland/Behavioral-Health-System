# Behavioral Health System

A multi-component platform for behavioral health screening and assessment. The system combines **voice biomarker analysis** (via Kintsugi Health ML models), **AI-powered risk assessments** (via Azure OpenAI), **audio transcription** (via Azure Speech), and **DSM-5 diagnostic evaluations** to support clinical behavioral health workflows.

---

## Key Features

### Kintsugi Health Integration (Depression & Anxiety Model)

This project integrates with [Kintsugi Health](https://huggingface.co/KintsugiHealth) for voice-based behavioral health analysis. Kintsugi Health provides machine learning models hosted on Hugging Face that analyze **vocal biomarkers** — acoustic patterns in a person's voice — to detect signs of depression, anxiety, and other mental health conditions from short speech samples.

- **Hugging Face**: <https://huggingface.co/KintsugiHealth>
- **Model**: Depression & Anxiety Model (DAM) — `KintsugiHealth/dam`
- **How it works**: A clinician or user uploads a short audio recording. The system initiates a DAM session with user metadata (age, gender, ethnicity), converts the audio to WAV format (16kHz, mono), and submits it to the model. The DAM returns **depression and anxiety scores** with severity categories and calibration status.
- **Pipeline**: The audio processing is orchestrated by a [Semantic Kernel pipeline](BehavioralHealthSystem.Agents/README.md) that runs three steps in sequence: **Fetch** (retrieve audio from blob storage) → **Convert** (ffmpeg WAV conversion) → **Predict** (DAM model submission).

### Audio Transcription

Converts uploaded voice recordings into text using the **Azure Speech Fast Transcription API**.

- **Supported formats**: WAV, MP3, OGG, FLAC natively; WebM/M4A/MP4 are converted server-side
- **Client-side pre-processing**: Audio is optionally pre-converted to WAV via FFmpeg.wasm in the browser
- **Grammar correction**: Transcribed text can be refined using Azure OpenAI-powered grammar correction for improved clinical readability
- **Feature-flagged**: Transcription can be enabled/disabled via the `ENABLE_TRANSCRIPTION` feature flag

### AI Risk Assessment

After a DAM prediction is obtained, the system can generate a **comprehensive clinical risk assessment** using Azure OpenAI (GPT-4o by default).

- **Input**: The service builds a detailed clinical prompt from all available session data — DAM prediction scores, transcribed text, user demographics, and biometric data
- **Output**: A structured assessment containing:
  - **Risk score** (1–10 scale)
  - **Severity level** (Low / Moderate / High / Critical)
  - **Key contributing factors** identified from the data
  - **Clinical recommendations** for follow-up
  - **Confidence score** reflecting data completeness
- **Display**: The frontend renders the assessment with color-coded severity indicators and expandable detail sections

### Extended Assessment (GPT-5/O3)

A deeper, multi-condition psychiatric evaluation powered by a **separate, more capable Azure OpenAI deployment** (GPT-5 or O3 models). This feature enables targeted DSM-5 condition analysis.

- **DSM-5 Condition Selection**: Clinicians select specific psychiatric conditions (e.g., Major Depressive Disorder, Generalized Anxiety Disorder, PTSD) for evaluation using the DSM-5 condition selector
- **Multi-Condition Analysis**: The system evaluates the patient against each selected condition, producing per-condition assessments with evidence-based reasoning
- **Cross-Condition Differential Diagnosis**: When multiple conditions are selected, the system provides differential diagnosis analysis highlighting overlapping symptoms and distinguishing features
- **Async Processing**: Extended assessments use Azure Durable Functions for orchestration — the clinician starts the assessment, receives a job ID, and polls for results — avoiding HTTP timeout issues with complex evaluations
- **DSM-5 Data**: Diagnostic criteria are imported from DSM-5 source PDFs using the [DSM-5 Import CLI](BehavioralHealthSystem.DSM5Import/README.md) and stored as structured JSON in Azure Blob Storage

### PHQ Assessments

Patient Health Questionnaire (PHQ) assessment workflow with:
- Standardized questionnaire administration
- Score calculation and severity mapping
- Progress tracking across multiple sessions over time

### PostgreSQL Storage Backend

Session data (sessions, file groups, biometric data) can be persisted to **PostgreSQL** instead of Azure Blob Storage. The storage backend is selected via the `STORAGE_BACKEND` environment variable.

| Mode | `STORAGE_BACKEND` | Description |
|------|-------------------|-------------|
| **BlobStorage** | `BlobStorage` (default) | Azure Blob Storage via Managed Identity |
| **PostgreSQL** | `PostgreSQL` | PostgreSQL database (local or managed) |
| **InMemory** | `InMemory` | In-memory only — data lost on restart |

**Local development**: Docker Compose includes a `db` service (postgres:16-alpine) with a named volume for persistence.

**Azure Container Apps**: Connects to **Azure Database for PostgreSQL Flexible Server** (`bhs-dev-postgres`, Burstable B1ms, v16) via public endpoint with SSL. Authentication uses **Microsoft Entra ID managed identity** (passwordless) — the Container App's system-assigned MI maps to a PostgreSQL role `bhs-api-dam`.

---

## Architecture

```
┌─────────────────────────┐
│   BehavioralHealthSystem.Web   │  React/TypeScript SPA
│   (Frontend)                   │  Audio upload, results display,
│                                │  clinical workflow UI
└────────────┬───────────────────┘
             │ HTTP API
┌────────────▼───────────────────┐
│   BehavioralHealthSystem.Functions  │  .NET 8 Azure Functions API
│   (Backend API)                     │  Sessions, predictions, risk
│                                     │  assessments, transcription
├─────────────────────────────────────┤
│  ├── BehavioralHealthSystem.Agents  │  Semantic Kernel audio pipeline
│  │   (Fetch → Convert → Predict)   │  (Fetch → Convert → DAM Predict)
│  │                                  │
│  ├── BehavioralHealthSystem.Dam     │  DAM pipeline client (NuGet)
│  │   (Shared DAM Library)           │  Session init, predict, warmup
│  │                                  │
│  └── BehavioralHealthSystem.Helpers │  Shared models, services,
│      (Shared Library)              │  validators, configuration
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  PostgreSQL (Storage Backend)        │  Session data persistence
│  Local: postgres:16 (Docker)         │  (configurable via STORAGE_BACKEND)
│  Azure: Flexible Server (v16, B1ms)  │
└──────────────────────────────────────┘
```

┌─────────────────────────────────────┐
│  BehavioralHealthSystem.DSM5Import  │  CLI tool for DSM-5 PDF import
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  BehavioralHealthSystem.Tests       │  MSTest backend test suite
└─────────────────────────────────────┘
```

### Project References

```
Functions ──references──► Helpers (models, services, validators)
Functions ──references──► Agents  (Semantic Kernel audio pipeline)
Functions ──references──► Dam     (DAM pipeline client)
Agents   ──references──► Helpers
Dam      ──references──► Helpers  (models, config, retry policies)
DSM5Import ─references──► Helpers (DSM5DataService, AzureContentUnderstandingService)
Tests    ──tests──► Functions, Helpers
```

## Projects

| Project | Description | README |
|---------|-------------|--------|
| **BehavioralHealthSystem.Web** | React/TypeScript SPA — clinical workflow UI | [README](BehavioralHealthSystem.Web/README.md) |
| **BehavioralHealthSystem.Functions** | .NET 8 Azure Functions API — all server-side operations | [README](BehavioralHealthSystem.Functions/README.md) |
| **BehavioralHealthSystem.Dam** | Shared DAM pipeline client — NuGet package for cross-project reuse | [README](BehavioralHealthSystem.Dam/README.md) |
| **BehavioralHealthSystem.Helpers** | Shared .NET library — models, services, validators, config | [README](BehavioralHealthSystem.Helpers/README.md) |
| **BehavioralHealthSystem.Agents** | Semantic Kernel audio processing pipeline | [README](BehavioralHealthSystem.Agents/README.md) |
| **BehavioralHealthSystem.DSM5Import** | CLI tool for DSM-5 diagnostic data import | [README](BehavioralHealthSystem.DSM5Import/README.md) |
| **BehavioralHealthSystem.Tests** | Backend unit and integration tests (MSTest) | [README](BehavioralHealthSystem.Tests/README.md) |
| **infrastructure/** | Azure Bicep templates and deployment scripts | — |

---

## Quick Start

### 1) Backend (Azure Functions API)

```powershell
cd BehavioralHealthSystem.Functions
dotnet build
func start
```

API runs at `http://localhost:7071`. See the [Functions README](BehavioralHealthSystem.Functions/README.md) for configuration details.

### 2) Frontend (React)

```powershell
cd BehavioralHealthSystem.Web
npm install
npm run dev
```

Dev server runs at `http://localhost:5173`. See the [Web README](BehavioralHealthSystem.Web/README.md) for environment variables.

### 3) Docker Compose

Docker Compose requires a `docker.env` file in the repository root containing Azure credentials, storage account names, and service endpoints. This file is **gitignored** and must be created locally.

```powershell
# 1. Create docker.env from the provided template
cp docker.env.example docker.env

# 2. Edit docker.env and fill in your Azure values
#    (tenant ID, client ID/secret, storage account, OpenAI endpoint, etc.)

# 3. Start the containers (choose your environment)
# Local — password-based PG auth with a local Docker PG container:
docker compose --env-file docker.env -f docker-compose.local.yml up -d --build

# Development — Managed Identity PG auth against Azure PG Flexible Server:
docker compose --env-file docker.env -f docker-compose.development.yml up -d --build
```

The `docker.env.example` template includes all required and optional variables with descriptions. Key variables you must set:

| Variable | Required | Purpose |
|----------|----------|---------|
| `AZURE_TENANT_ID` | Yes | Azure AD tenant for identity |
| `AZURE_CLIENT_ID` | Yes | Service principal client ID |
| `AZURE_CLIENT_SECRET` | Yes | Service principal secret |
| `STORAGE_ACCOUNT_NAME` | Yes | Azure Storage account for sessions and audio |
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint for risk assessments |
| `AZURE_SPEECH_ENDPOINT` | For transcription | Azure Speech endpoint |
| `EXTENDED_ASSESSMENT_OPENAI_ENDPOINT` | For extended assessments | GPT-5/O3 model endpoint |
| `POSTGRES_HOST` | Development only | Azure PG Flexible Server FQDN (e.g. `<server>.postgres.database.azure.com`) |
| `POSTGRES_PASSWORD` | Local only | PostgreSQL password for local Docker PG container |

> **Security**: Never commit `docker.env` to source control. It contains secrets and is excluded via `.gitignore`.

### Environment Switching

```powershell
.\scripts\docker-manage.ps1 -Action up -Environment local         # Local PG (password auth)
.\scripts\docker-manage.ps1 -Action up -Environment development    # Azure PG (Managed Identity)
.\scripts\docker-manage.ps1 -Action up -Environment production     # Production
.\scripts\docker-manage.ps1 -Action down -Environment local
.\scripts\docker-manage.ps1 -Action status
```

---

## Environment Model

| Environment | Description | PostgreSQL Auth | Docker Compose |
|-------------|-------------|-----------------|----------------|
| **Local** | Local dev with Docker PG container. Password-based auth. | Password | `docker-compose.local.yml` |
| **Development** | Azure-backed dev testing. Connects to Azure PG Flexible Server. | Managed Identity | `docker-compose.development.yml` |
| **Production** | Hardened Azure deployment with Managed Identity and RBAC. | Managed Identity | `docker-compose.prod.yml` |

---

## Configuration Reference

### Frontend (`VITE_*`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Functions API base URL |
| `VITE_ENABLE_ENTRA_AUTH` | Enable Microsoft Entra ID auth |
| `VITE_AZURE_TENANT_ID` | Entra ID tenant |
| `VITE_AZURE_CLIENT_ID` | Entra ID app client ID |
| `VITE_AZURE_AUTHORITY` | Entra ID authority URL |
| `VITE_AZURE_REDIRECT_URI` | Auth redirect URI |
| `VITE_STORAGE_CONTAINER_NAME` | Blob container for uploads |
| `VITE_ENABLE_DEBUG_LOGGING` | Verbose console logging |

### Backend (`local.settings.json` / container env)

| Variable | Purpose |
|----------|---------|
| `AzureWebJobsStorage` | Storage connection string (or MI-style account settings) |
| `LOCAL_DAM_BASE_URL` | Kintsugi DAM model endpoint |
| `LOCAL_DAM_MODEL_ID` | DAM model identifier (`KintsugiHealth/dam`) |
| `LOCAL_DAM_API_KEY` | DAM model API key |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint (risk assessments) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | GPT deployment name (default: `gpt-4o`) |
| `EXTENDED_ASSESSMENT_OPENAI_*` | Separate GPT-5/O3 config for extended assessments |
| `AZURE_SPEECH_KEY` | Azure Speech key (transcription) |
| `AZURE_SPEECH_REGION` | Azure Speech region |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` | Identity/auth settings |
| `STORAGE_BACKEND` | Storage mode: `BlobStorage` (default), `PostgreSQL`, or `InMemory` |
| `POSTGRES_HOST` | PostgreSQL hostname (e.g., add-on internal FQDN) |
| `POSTGRES_PORT` | PostgreSQL port (default: `5432`) |
| `POSTGRES_USERNAME` | PostgreSQL username (MI role name for Entra auth, e.g. `bhs-api-dam`) |
| `POSTGRES_PASSWORD` | PostgreSQL password (only for password auth; not needed with MI) |
| `POSTGRES_DATABASE` | PostgreSQL database name (default: `postgres`) |
| `POSTGRES_USE_MANAGED_IDENTITY` | Set to `true` to use Entra ID token auth (no password needed) |
| `POSTGRES_CONNECTION_STRING` | Alternative: full Npgsql connection string |
| `POSTGRES_URL` | Alternative: PostgreSQL URI format |

### Security

- Prefer **Managed Identity + RBAC** where possible
- Store secrets in **Azure Key Vault** or secure local env
- Never commit secrets to source control

---

## Testing

### Backend (.NET)

```powershell
cd BehavioralHealthSystem.Tests
dotnet test
```

See the [Tests README](BehavioralHealthSystem.Tests/README.md) for filtered and coverage runs.

### Frontend (Vitest)

```powershell
cd BehavioralHealthSystem.Web
npm run test
```

See the [Web README](BehavioralHealthSystem.Web/README.md) for details.

---

## Deployment

### Container Build and Push

```powershell
.\scripts\build-and-push-containers.ps1 -Environment production -Tag vX.Y.Z
```

### NuGet Package Publish

The **Dam** and **Helpers** libraries are published to [GitHub Packages](https://github.com/christopherwoodland/Behavioral-Health-System/packages) for consumption by external projects (e.g., evaluation harnesses).

```powershell
# Set your GitHub PAT (needs write:packages scope)
$env:GITHUB_TOKEN = "<your-pat>"

# Pack and push both packages
.\scripts\publish-nuget-packages.ps1 -Version 1.0.0

# Pack only (no push)
.\scripts\publish-nuget-packages.ps1 -PackOnly
```

See the [Dam README](BehavioralHealthSystem.Dam/README.md) for consuming the package in another project.

### Azure Bicep Deployment

```powershell
az deployment sub create --location eastus2 \
  --template-file infrastructure/bicep/main-public-containerized.bicep \
  --parameters infrastructure/bicep/parameters/development.parameters.json
```

### Infrastructure Runbook

```powershell
infrastructure/scripts/Deploy-Infrastructure.ps1
infrastructure/scripts/Configure-Secrets.ps1
infrastructure/scripts/Configure-Permissions.ps1
infrastructure/scripts/Setup-LocalDev.ps1
```

### Azure Database for PostgreSQL Flexible Server (Dev/Test)

The development environment uses **Azure Database for PostgreSQL Flexible Server** for session persistence.

| Property | Value |
|----------|-------|
| Server name | `bhs-dev-postgres` |
| Host | `bhs-dev-postgres.postgres.database.azure.com` |
| Tier | Burstable B1ms |
| Version | PostgreSQL 16 |
| Storage | 32 GB |
| Database | `bhs_dev` |
| Authentication | **Microsoft Entra ID** (managed identity) — passwordless |
| MI PG Role | `bhs-api-dam` (mapped to Container App system-assigned MI) |
| Admin user | `bhs_admin` (password auth available in parallel mode) |
| SSL | Required |
| Access | Public (Azure services firewall rule) |

```powershell
# 1. Create the Flexible Server
az postgres flexible-server create `
  --name bhs-dev-postgres `
  --resource-group bhs-development-local-dam-public `
  --location eastus2 `
  --tier Burstable `
  --sku-name Standard_B1ms `
  --storage-size 32 `
  --version 16 `
  --admin-user bhs_admin `
  --admin-password "<password>" `
  --public-access 0.0.0.0 `
  --yes

# 2. Create the application database
az postgres flexible-server db create `
  --server-name bhs-dev-postgres `
  -g bhs-development-local-dam-public `
  --database-name bhs_dev

# 3. Enable Entra ID auth on the PG server and set yourself as admin
az postgres flexible-server update `
  --name bhs-dev-postgres `
  -g bhs-development-local-dam-public `
  --active-directory-auth Enabled `
  --password-auth Enabled

az postgres flexible-server microsoft-entra-admin create `
  --server-name bhs-dev-postgres `
  -g bhs-development-local-dam-public `
  --display-name "<your-display-name>" `
  --object-id "<your-entra-object-id>" `
  --type User

# 4. Create the managed identity role in PostgreSQL
#    Run the setup script (requires psycopg2: pip install psycopg2-binary)
$env:PG_TOKEN = az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv
python scripts/setup-mi-postgres.py

# 5. Set PostgreSQL env vars on the API app (managed identity, no password)
az containerapp update `
  --name bhs-api-dam `
  -g bhs-development-local-dam-public `
  --set-env-vars `
    "STORAGE_BACKEND=PostgreSQL" `
    "POSTGRES_HOST=bhs-dev-postgres.postgres.database.azure.com" `
    "POSTGRES_PORT=5432" `
    "POSTGRES_USERNAME=bhs-api-dam" `
    "POSTGRES_DATABASE=bhs_dev" `
    "POSTGRES_USE_MANAGED_IDENTITY=true"

# 5. Grant storage roles to the app's managed identity
$principalId = az containerapp identity show `
  --name bhs-api-dam -g bhs-development-local-dam-public `
  --query "principalId" -o tsv
$storageId = az storage account show `
  --name bhsdevstg4exbxrzknexso -g bhs-development-public `
  --query "id" -o tsv

az role assignment create --assignee $principalId `
  --role "Storage Blob Data Contributor" --scope $storageId
az role assignment create --assignee $principalId `
  --role "Storage Queue Data Contributor" --scope $storageId
az role assignment create --assignee $principalId `
  --role "Storage Table Data Contributor" --scope $storageId
```

---

## Operational Checklist

Before release/deployment, verify:

- Docker images build successfully
- API and web health checks pass (`GET /api/health`)
- Storage auth works for session save and upload
- DAM predictions complete and render mapped categories correctly
- Unit tests pass (backend and frontend)
- Required environment variables and secrets are present

---

## Troubleshooting

### Known Issues

#### Container Apps PostgreSQL Add-on (Deprecated — Use Flexible Server)

The Container Apps PostgreSQL **add-on** was previously attempted but has two conflicting platform limitations:

1. **Service binding (`--bind`)** triggers a KEDA `ScaledObjectCheckFailed: Target resource doesn't exist` error.
2. **Without binding**, the add-on's TCP port is **not reachable** (`service.type` restricts network to bound apps only).
3. **TCP ingress** on regular Container Apps in this environment also fails (tested and confirmed — `pg_isready` returns "no response" even from inside the same environment).

**Resolution**: Migrated to **Azure Database for PostgreSQL Flexible Server** (`bhs-dev-postgres`), which provides reliable public-endpoint connectivity with SSL.

### Storage/Auth Failures

- If operations fail with `AADSTS7000222`, rotate `AZURE_CLIENT_SECRET`
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
