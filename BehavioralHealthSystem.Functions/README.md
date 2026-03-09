# BehavioralHealthSystem.Functions

.NET 8 Azure Functions v4 (isolated worker) API backend for the Behavioral Health System. Provides all server-side operations including session management, audio processing, DAM predictions, risk assessments, transcription, DSM-5 data management, and more.

## Overview

This project is the central API layer. The [React frontend](../BehavioralHealthSystem.Web/README.md) communicates with these endpoints for all clinical workflow operations. It references the shared [Helpers library](../BehavioralHealthSystem.Helpers/README.md) for models, validators, and services, the [Agents project](../BehavioralHealthSystem.Agents/README.md) for the Semantic Kernel audio processing pipeline, and the [Dam library](../BehavioralHealthSystem.Dam/README.md) for the DAM HTTP client pipeline.

## Tech Stack

- **.NET 8** — isolated worker process
- **Azure Functions v4** — serverless compute
- **Azure Blob Storage** — session data, audio files, transcripts, assessments
- **Azure Key Vault** — secrets management
- **Azure SignalR** — real-time communication
- **Azure Document Intelligence** — DSM-5 PDF extraction
- **Durable Functions** — long-running extended assessment orchestration
- **NAudio** — server-side audio processing
- **Polly** — retry and resilience policies
- **FluentValidation** — request validation
- **Application Insights** — observability and telemetry

## API Endpoints

### Health & System

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check — returns system status |
| `/api/feature-flags` | GET | Feature flag state for frontend |

### Kintsugi DAM (Depression & Anxiety Model)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions/initiate-selected` | POST | Initiate a DAM session with user metadata |
| `/api/predictions/submit-selected` | POST | Submit audio for DAM prediction |
| `/api/process-audio-upload` | POST | Full pipeline: upload → convert → predict via Semantic Kernel |

### Sessions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | POST | Create a new session |
| `/api/sessions/{id}` | GET | Get session by ID |
| `/api/sessions/{id}` | PUT | Update session data |
| `/api/sessions/{id}` | DELETE | Delete a session |
| `/api/sessions/user/{userId}` | GET | List sessions for a user |
| `/api/sessions/all` | GET | List all sessions (admin) |

### Risk Assessment

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/risk-assessment/generate` | POST | Generate AI risk assessment from session data |
| `/api/risk-assessment/{sessionId}` | GET | Retrieve existing risk assessment |

### Extended Assessment (GPT-5/O3)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/extended-assessment/start` | POST | Start async extended multi-condition assessment |
| `/api/extended-assessment/status/{jobId}` | GET | Check assessment job status |
| `/api/extended-assessment/result/{jobId}` | GET | Get completed assessment result |

### Transcription

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transcribe` | POST | Transcribe audio via Azure Speech Fast Transcription API |

### Audio

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload-audio` | POST | Upload audio file to blob storage |
| `/api/download-audio/{blobName}` | GET | Download audio from blob storage |

### DSM-5 Administration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/dsm5/*` | Various | DSM-5 condition CRUD, PDF extraction (API key protected) |

### Other

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/grammar/correct` | POST | AI grammar correction for transcribed text |
| `/api/chat-transcript` | POST | Save chat transcript |
| `/api/phq-assessment` | POST | Save PHQ assessment |
| `/api/file-groups/*` | Various | File group management |

## Project Structure

```
BehavioralHealthSystem.Functions/
├── Functions/       # Azure Function endpoint definitions
├── Services/        # Function-layer services (DAM client, auth, CORS, feature flags)
├── Prompts/         # AI prompt templates for risk assessments
├── Properties/      # Launch settings
├── Program.cs       # Host builder, DI registration
├── host.json        # Functions host configuration
└── local.settings.json  # Local development settings
```

## Quick Start

```powershell
# Build
dotnet build

# Run locally (requires Azurite for storage emulation)
cd bin/Debug/net8.0
func host start
```

The Functions host runs at `http://localhost:7071` by default.

### Configuration

Key settings in `local.settings.json`:

| Setting | Purpose |
|---------|---------|
| `AzureWebJobsStorage` | Storage connection (or use MI-style account settings) |
| `LOCAL_DAM_BASE_URL` | Kintsugi DAM model endpoint |
| `LOCAL_DAM_MODEL_ID` | Model identifier (default: `KintsugiHealth/dam`) |
| `LOCAL_DAM_API_KEY` | DAM model API key |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint for risk assessments |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | GPT deployment name (default: `gpt-4o`) |
| `EXTENDED_ASSESSMENT_OPENAI_*` | Separate OpenAI config for GPT-5/O3 extended assessments |
| `AZURE_SPEECH_KEY` | Azure Speech service key for transcription |
| `AZURE_SPEECH_REGION` | Azure Speech region |

#### PostgreSQL Configuration

| Setting | Purpose |
|---------|---------|
| `STORAGE_BACKEND` | Set to `PostgreSQL` to use PostgreSQL storage |
| `POSTGRES_HOST` | PostgreSQL server hostname |
| `POSTGRES_PORT` | PostgreSQL port (default: `5432`) |
| `POSTGRES_USERNAME` | PostgreSQL username or MI role name (e.g. `bhs-api-dam`) |
| `POSTGRES_PASSWORD` | PostgreSQL password (not needed with managed identity) |
| `POSTGRES_DATABASE` | Database name (default: `postgres`) |
| `POSTGRES_USE_MANAGED_IDENTITY` | Set to `true` for Entra ID token auth (Azure only) |
| `POSTGRES_CONNECTION_STRING` | Alternative: full Npgsql connection string |
| `POSTGRES_URL` | Alternative: URI format from Container Apps add-on |

### Authentication

- **Microsoft Entra ID** — JWT token validation for user-facing endpoints
- **API Key** — admin endpoints (DSM-5 management)

## Docker

Dockerfiles are provided for each environment:

```
Dockerfile.local         # Local image (password-based PG auth, local Docker PG container)
Dockerfile.development   # Development image (Managed Identity PG auth, Azure PG Flexible Server)
Dockerfile.prod          # Production image (Managed Identity PG auth, Azure PG Flexible Server)
```

## Testing

Backend tests are in the [Tests project](../BehavioralHealthSystem.Tests/README.md):

```powershell
cd ../BehavioralHealthSystem.Tests
dotnet test
```
