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

**Azure Container Apps**: Connects to **Azure Database for PostgreSQL Flexible Server** (`bhs-dev-postgres2`, Burstable B1ms, v16) via private endpoint (inside AKS VNet). Authentication uses **Microsoft Entra ID managed identity** (passwordless) — the AKS UAMI for the api pod maps to a PostgreSQL role `bhs-api-dam`.

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
| `VITE_AZURE_CLIENT_ID` | Frontend SPA app registration client ID (`BHS Development UI`) |
| `VITE_AZURE_API_CLIENT_ID` | Backend API app registration client ID (`BHS Development API`) — used to acquire the API access token that carries the `roles` claim. **Required for role-based access.** |
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

### Azure Database for PostgreSQL Flexible Server (Dev)

The AKS development environment uses **Azure Database for PostgreSQL Flexible Server** for session persistence.  The server lives in the **`bhs-aks`** resource group alongside the AKS cluster, connected via private endpoint (no public access).

| Property | Value |
|----------|-------|
| Server name | `bhs-dev-postgres2` |
| Host | `bhs-dev-postgres2.postgres.database.azure.com` |
| Resource Group | `bhs-aks` |
| Tier | Burstable B1ms |
| Version | PostgreSQL 16 |
| Storage | 32 GB |
| Database | `bhs_dev` |
| Authentication | **Microsoft Entra ID** (managed identity) — passwordless |
| MI PG Role | `bhs-api-dam` (mapped to AKS UAMI for the api workload) |
| Admin user | `bhs_admin` |
| SSL | Required |
| Access | Private endpoint only (no public network access) |

> The server was created by PITR-restoring `bhs-dev-postgres` (from the former `bhs-development-local-dam-public` RG, which has been deleted) and moving it into `bhs-aks` so all AKS infrastructure is co-located in one resource group.

```powershell
# Re-provision from scratch (only needed if full teardown occurred)
# 1. Create the Flexible Server
az postgres flexible-server create `
  --name bhs-dev-postgres2 `
  --resource-group bhs-aks `
  --location eastus2 `
  --tier Burstable `
  --sku-name Standard_B1ms `
  --storage-size 32 `
  --version 16 `
  --admin-user bhs_admin `
  --admin-password "<password>" `
  --public-access None `
  --yes

# 2. Create the application database
az postgres flexible-server db create `
  --server-name bhs-dev-postgres2 `
  -g bhs-aks `
  --database-name bhs_dev

# 3. Enable Entra ID auth
az postgres flexible-server update `
  --name bhs-dev-postgres2 `
  -g bhs-aks `
  --active-directory-auth Enabled `
  --password-auth Enabled

az postgres flexible-server microsoft-entra-admin create `
  --server-name bhs-dev-postgres2 `
  -g bhs-aks `
  --display-name "<your-display-name>" `
  --object-id "<your-entra-object-id>" `
  --type User

# 4. Create the private endpoint (AKS private-ep subnet)
$pgId = az postgres flexible-server show -g bhs-aks -n bhs-dev-postgres2 --query id -o tsv
az network private-endpoint create `
  --name bhs-dev-postgres2-aks-pe `
  --resource-group bhs-aks `
  --vnet-name bhs-dev-aks-vnet `
  --subnet private-ep-subnet `
  --private-connection-resource-id $pgId `
  --group-id postgresqlServer `
  --connection-name bhs-dev-postgres2-aks-conn

# 5. Add DNS A-record to the private DNS zone
$peNicId = az network private-endpoint show -g bhs-aks -n bhs-dev-postgres2-aks-pe --query 'networkInterfaces[0].id' -o tsv
$peIp    = az network nic show --ids $peNicId --query 'ipConfigurations[0].privateIPAddress' -o tsv
az network private-dns record-set a add-record `
  -g bhs-aks `
  -z privatelink.postgres.database.azure.com `
  -n bhs-dev-postgres2 `
  -a $peIp

# 6. Fix the pgaadauth role (UAMI OID)
.\infrastructure\scripts\Fix-PostgresRole.ps1
```

---

### AKS Deployment (Development)

> **New deployment path** — runs in the `bhs-aks` resource group alongside the existing Container Apps deployment.  The Container Apps path remains untouched.

#### Architecture

```
Internet
  │
  ▼  (port 443 HTTPS / port 80 → 301 redirect to HTTPS)
Application Gateway v2 (WAF_v2) ── OWASP 3.2 + BotManager 1.0 (Detection mode for dev / Prevention for prod)
  │   SSL termination: self-signed cert stored in Key Vault
  │   /api/*  ──────────────────────────────────────────► bhs-api  (.NET 8 Functions)
  │   /*       ─────────────────────────────────────────► bhs-web  (Nginx / React SPA)
  │
  │                           (internal ClusterIP only)
  └────────────────────────────────────────────────────► bhs-dam  (Python FastAPI)
```

**Networking:** VNet `10.0.16.0/20` (non-overlapping with existing CA VNet `10.0.0.0/16`)
- `aks-nodes-subnet` `10.0.16.0/22` — AKS nodes (Azure CNI Overlay)
- `appgw-subnet` `10.0.20.0/24` — Application Gateway
- `private-ep-subnet` `10.0.21.0/24` — Storage private endpoint

**AKS Node Pools:**
| Pool | VM SKU | Count | Purpose |
|------|--------|-------|---------|
| system | Standard_D2s_v3 | 2 (autoscale 1–3) | web + api + system pods |
| damnodepool | Standard_D4s_v3 | 1 (autoscale 1–2) | DAM model (taint `workload=dam:NoSchedule`) |

**Identity:** Workload Identity + OIDC.  The `api` pod uses a User-Assigned Managed Identity (UAMI) federated to the `bhs-api-sa` Kubernetes ServiceAccount.  No secrets are stored in Kubernetes Secrets — all sensitive values come from Key Vault via the CSI Secrets Store driver.

#### Entra ID Setup (one-time per environment)

Before (or immediately after) deploying, run `Setup-EntraID.ps1` to configure the two Entra ID app registrations that power authentication and role-based access:

```powershell
# From: infrastructure/scripts/
.\ Setup-EntraID.ps1

# Also assign the Admin role to a user:
.\ Setup-EntraID.ps1 -AdminUserUpn you@contoso.com
```

This idempotent script handles:
- Creating `BHS Development UI` (SPA) and `BHS Development API` app registrations if absent
- Adding `api://{apiAppId}` as an `identifierUri` alongside `api://bhs-dev-api` — **required** to avoid `AADSTS500011`
- Exposing the `access_as_user` delegated scope on the API app
- Defining `Admin` and `ControlPanel` app roles on both registrations
- Pre-authorizing the UI client on the API (`preAuthorizedApplications`) so no consent dialog appears on Microsoft corporate tenants
- Ensuring redirect URIs are under the **SPA platform** (not Web platform) to avoid `AADSTS9002326`

The deploy script (`Deploy-AKS.ps1`) prints a reminder with the correct app IDs at the end of each run.

#### Prerequisites

```powershell
# Install kubectl + kubelogin (once — also adds them to user PATH permanently)
az aks install-cli

# If you installed kubelogin for the first time, re-open your terminal
# so the new PATH entries take effect.  The deploy script auto-adds the
# ~/.azure-kubelogin path within the current session to avoid this step.

# Register the OperationsManagement provider (one-time per subscription)
az provider register --namespace Microsoft.OperationsManagement --wait
# The deploy script checks and registers this automatically, but you can
# run it manually in advance to avoid the wait during deployment.

# Ensure you are logged into the right tenant
az login --tenant 16b3c013-d300-468d-ac64-7eda0820b6d3
az account set --subscription 6bf68138-6ea4-4272-a3db-78e737e132a6
```

Required Azure RBAC:
- `Owner` or `Contributor + User Access Administrator` on the `bhs-aks` resource group
- `Key Vault Secrets Officer` on `bhs-dev-kv-4exbxrzknexso`
- `AcrPush` on `bhsdevelopmentacr4znv2wxlxs4xq`

#### Quick Deploy

```powershell
# From: infrastructure/scripts/

# 1. Build and push dev images (optional — skip if images already in ACR)
.\Build-And-Push-Containers-Dev.ps1

# 2. Full AKS deployment (infra + k8s manifests)
.\Deploy-AKS.ps1

# Or skip the Bicep step if infrastructure already exists:
.\Deploy-AKS.ps1 -SkipInfra -SkipContainerBuild
```

#### Infrastructure Files

| File | Purpose |
|------|---------|
| `infrastructure/bicep/main-aks.bicep` | Subscription-scoped entry point |
| `infrastructure/bicep/modules/aks-networking.bicep` | VNet + subnets + NSGs |
| `infrastructure/bicep/modules/aks-cluster.bicep` | AKS cluster (Azure CNI Overlay, OIDC, AGIC, CSI) |
| `infrastructure/bicep/modules/aks-appgateway.bicep` | Application Gateway v2 WAF_v2 |
| `infrastructure/bicep/modules/aks-storage.bicep` | AKS-dedicated storage account + private endpoint |
| `infrastructure/bicep/modules/aks-rbac.bicep` | In-RG RBAC + api UAMI |
| `infrastructure/bicep/modules/aks-rbac-crossrg.bicep` | Cross-RG RBAC (ACR, KV, CogServices) |
| `infrastructure/bicep/parameters/aks-dev.parameters.json` | Dev parameter values |

#### Kubernetes Manifests

All manifests live in `infrastructure/k8s/dev/`.  `Deploy-AKS.ps1` copies them to a temp directory, replaces `__PLACEHOLDER__` tokens with real values from Bicep outputs, and then applies them.

| Manifest | Purpose |
|----------|---------|
| `namespace.yaml` | `bhs` namespace |
| `configmap.yaml` | Non-sensitive env vars (api + web) |
| `secretproviderclass.yaml` | Key Vault CSI driver → K8s Secret sync |
| `workload-identity.yaml` | ServiceAccounts with Workload Identity annotations |
| `deployments/web.yaml` | Nginx/React frontend |
| `deployments/api.yaml` | .NET 8 Azure Functions backend |
| `deployments/dam.yaml` | Python FastAPI DAM model (DAM node pool) |
| `services/` | ClusterIP services for all three workloads |
| `ingress.yaml` | AGIC Ingress (path-based routing) |
| `hpa.yaml` | HPA for api and web |

#### Teardown

```powershell
# Remove Kubernetes workloads only (keep Azure infrastructure)
.\Teardown-AKS.ps1

# Complete teardown including Azure resources (DESTRUCTIVE)
.\Teardown-AKS.ps1 -DeleteResourceGroup
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


#### AGIC RBAC Requirements

The AGIC add-on provisions its own managed identity at cluster creation time. That identity requires three role assignments — these are now codified in `aks-rbac.bicep` but were missing from the original deployment:

| Role | Scope | Reason |
|------|-------|--------|
| Reader | Resource group | Enumerate resources (App GW, VNet, etc.) |
| Contributor | App Gateway resource | Push updated routing configuration |
| Network Contributor | VNet | `Microsoft.Network/virtualNetworks/subnets/join/action` |

If AGIC logs show `403 Forbidden` when calling ARM, check these role assignments:
```powershell
$agicOid = az aks show -n bhs-dev-aks -g bhs-aks --query "addonProfiles.ingressApplicationGateway.identity.objectId" -o tsv
az role assignment list --assignee $agicOid --all -o table
```

#### WAF Prevention Mode Blocks All Traffic

Azure Application Gateway WAF (`WAF_v2`) with `state: Enabled` + `mode: Prevention` returns **403 for all requests**, even when zero managed rules are attached. This is the platform's deny-by-default posture in Prevention mode.

- **Dev environments**: `mode: Detection` (logs violations, does not block) — set as the Bicep default via `wafMode` param
- **Production**: `mode: Prevention`

The `wafMode` parameter in `main-aks.bicep` controls this. Override at deploy time:
```powershell
az deployment sub create ... --parameters wafMode=Prevention
```

#### Key Vault Network Access

Key Vault must be reachable from AKS nodes via a VNet service endpoint. Required configuration:
- VNet service endpoint `Microsoft.KeyVault` on `aks-nodes-subnet`
- KV network rule allowing the AKS subnet
- `publicNetworkAccess: Enabled` with `defaultAction: Deny` (fully disabling public access breaks the CSI driver)

#### PostgreSQL Managed Identity OID

If the UAMI is recreated (e.g. full teardown and redeploy), the `bhs-api-dam` role in PostgreSQL retains a stale `pgaadauth` OID from the previous identity. Fix using:
```powershell
.\infrastructure\scripts\Fix-PostgresRole.ps1
```

#### PostgreSQL Database Name

The database name is `bhs_dev` (not `bhsdb`). The `POSTGRES_DATABASE` ConfigMap value and the Bicep `postgresDatabase` parameter default have both been updated.

#### HuggingFace Cache Permission (bhs-dam)

The DAM container downloads the Whisper model on first startup. It runs as `runAsUser: 1000` (non-root), so the default HuggingFace cache path `/.cache` is not writable. The `dam.yaml` deployment mounts an `emptyDir` volume at `/cache` and sets:
```yaml
env:
  - name: HF_HOME
    value: /cache/huggingface
  - name: TRANSFORMERS_CACHE
    value: /cache/huggingface/hub
```
If this volume is missing, the pod will crash with `PermissionError: [Errno 13] Permission denied: '/.cache'`.

#### AGIC Reconciliation Trigger

If AGIC is running but the App Gateway config is stale (e.g. after an annotation change), force a reconciliation:
```powershell
kubectl annotate ingress bhs-ingress -n bhs reconcile-trigger="$(Get-Date -Format o)" --overwrite
```
Watch AGIC logs for `BEGIN AppGateway deployment` → `END AppGateway deployment` to confirm the push completed.

#### HTTPS / Self-Signed Certificate

The App Gateway uses a self-signed TLS certificate generated by `Deploy-AKS.ps1` and stored in Key Vault as `bhs-dev-tls-cert`. Browsers will warn "Your connection is not private" — this is expected for dev. Click **Advanced → Proceed** to bypass.

**Certificate flow:**
1. `Deploy-AKS.ps1` generates a self-signed PFX valid for `bhs-dev-bhs.eastus2.cloudapp.azure.com`
2. PFX is imported to Key Vault as certificate `bhs-dev-tls-cert`
3. App Gateway identity (`bhs-dev-appgw-identity`) has `Key Vault Secrets User` role to pull it
4. AGIC configures the HTTPS listener using cert name `bhs-dev-tls-cert` (from `ssl-certificate` annotation)
5. AGIC adds HTTP → HTTPS redirect (from `ssl-redirect: "true"` annotation)

**Entra redirect URI**: `https://bhs-dev-bhs.eastus2.cloudapp.azure.com` is included in the default redirect URI list in `Setup-EntraID.ps1` and must be registered under the **SPA platform** (not the Web platform). Run `Setup-EntraID.ps1` to apply this. The `VITE_AZURE_REDIRECT_URI` in the ConfigMap already uses `https://`.

#### Speech / Cognitive Services Endpoint

The `AZURE_SPEECH_ENDPOINT` in `configmap.yaml` **must** be a custom-subdomain URL such as `https://<name>.cognitiveservices.azure.com/`. The old regional endpoint format (`https://eastus2.api.cognitive.microsoft.com/`) does **not** support managed identity token authentication and returns `BadRequest: Please provide a custom subdomain`.

The AKS configmap template uses `__OPENAI_ENDPOINT__` for this value so it automatically resolves to the `bhs-development-public-foundry-r` AIServices resource endpoint (which supports both OpenAI and Speech). If you see 502 errors on `/api/transcribe-audio`, check:
```powershell
kubectl get configmap bhs-api-config -n bhs -o jsonpath='{.data.AZURE_SPEECH_ENDPOINT}'
# Must print: https://bhs-development-public-foundry-r.cognitiveservices.azure.com/
# Fix if wrong:
kubectl patch configmap bhs-api-config -n bhs --patch-file <(echo '{"data":{"AZURE_SPEECH_ENDPOINT":"https://bhs-development-public-foundry-r.cognitiveservices.azure.com/"}}')
kubectl rollout restart deployment/bhs-api -n bhs
```

**Renew cert** (2-year validity, re-run any time):
```powershell
# Delete the old cert then re-run Deploy-AKS.ps1 to regenerate
az keyvault certificate delete --vault-name <kv-name> --name bhs-dev-tls-cert
.\Deploy-AKS.ps1 -SkipInfra -SkipContainerBuild
```

---

#### Container Apps PostgreSQL Add-on (Deprecated — Use Flexible Server)

The Container Apps PostgreSQL **add-on** was previously attempted but has two conflicting platform limitations:

1. **Service binding (`--bind`)** triggers a KEDA `ScaledObjectCheckFailed: Target resource doesn't exist` error.
2. **Without binding**, the add-on's TCP port is **not reachable** (`service.type` restricts network to bound apps only).
3. **TCP ingress** on regular Container Apps in this environment also fails (tested and confirmed — `pg_isready` returns "no response" even from inside the same environment).

**Resolution**: Migrated to **Azure Database for PostgreSQL Flexible Server** (`bhs-dev-postgres2` in `bhs-aks`), connected via private endpoint inside the AKS VNet.

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
