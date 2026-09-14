<!-- markdownlint-disable MD060 -->

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
| `/api/health` | GET | Health check — returns system status, `airGapMode` flag, and `aiModel` name |
| `/api/feature-flags` | GET | Feature flag state for frontend |

### Kintsugi DAM (Depression & Anxiety Model)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions/initiate-selected` | POST | Initiate a DAM session with user metadata |
| `/api/predictions/submit-selected` | POST | Submit audio for DAM prediction |
| `/api/process-audio-upload` | POST | Full pipeline: upload → convert → predict via Semantic Kernel |
| `/api/audio-jobs` | POST | Upload raw audio and start the durable FFmpeg → DAM pipeline |
| `/api/audio-jobs/{jobId}` | GET | Get durable audio job status |
| `/api/audio-jobs/{jobId}/result` | GET | Get the completed DAM prediction |

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
| `/api/extended-assessment/status/{jobId}` | GET | Check assessment job status (includes progress %, current step message) |
| `/api/extended-assessment/result/{jobId}` | GET | Get completed assessment result |

> **Air-gap note**: In air-gap mode, the orchestrator displays contextual progress messages (e.g., "Air-gap mode: Limited to 2 of N selected conditions"). The simplified prompt and 5-minute timeout apply automatically when the endpoint resolves to a local model (port 11434, localhost, or host.docker.internal).

### Transcription

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transcribe` | POST | Transcribe audio via Azure Speech Fast Transcription API |

### Audio

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload-audio` | POST | Upload audio file to blob storage |
| `/api/download-audio/{blobName}` | GET | Download audio from blob storage |

### Asynchronous Audio Preprocessing

`POST /api/audio-jobs` is the long-running production path for audio classification. It accepts the original audio bytes as the request body, writes them to the private `audio-uploads` container, and returns `202 Accepted` before FFmpeg or DAM inference runs.

Required query parameters are `userId`, `sessionId`, and `fileName`. Supported file extensions are `.wav`, `.mp3`, `.mp4`, `.m4a`, `.aac`, `.flac`, `.ogg`, `.webm`, `.mkv`, `.avi`, and `.mov`. Requests require an Entra bearer token or `X-API-Key`. Poll with the same authenticated identity that created the job; another identity receives `404` even if it knows the job ID.

An optional `Idempotency-Key` header makes retries from the same authenticated identity with the same `userId`, `sessionId`, and `fileName` resolve to one job. Blob creation is conditional, so concurrent retries cannot overwrite the first committed audio. Reuse a key only for the same logical upload.

```powershell
curl.exe -X POST `
	"$env:FUNCTIONS_URL/api/audio-jobs?userId=user-1&sessionId=session-1&fileName=recording.webm" `
	-H "Authorization: Bearer $env:ACCESS_TOKEN" `
	-H "Idempotency-Key: session-1-recording" `
	-H "Content-Type: audio/webm" `
	--data-binary "@recording.webm"
```

```json
{
	"success": true,
	"jobId": "audio-0123456789abcdef0123456789abcdef",
	"status": "queued",
	"replayed": false,
	"statusUrl": "https://functions.example/api/audio-jobs/audio-0123456789abcdef0123456789abcdef",
	"resultUrl": "https://functions.example/api/audio-jobs/audio-0123456789abcdef0123456789abcdef/result"
}
```

Poll `statusUrl` until `status` is `succeeded` or `failed`, then call `resultUrl`. A pending result returns `202` with `Retry-After: 3`; a successful result returns the complete `AudioProcessingResult` and DAM scores.

The Durable orchestration stores identifiers and a one-way caller hash only. Audio bytes remain in Blob Storage and activity memory, never in Durable history. The activity reuses the existing pipeline to normalize audio to 44.1 kHz mono signed 16-bit PCM WAV, apply the configured high-pass, low-pass, and silence-removal filters, and submit base64 audio directly to DAM. The original upload remains in Blob Storage; the normalized WAV is held only in activity memory and is not persisted. The workflow does not ask DAM to fetch an arbitrary `audioFileUrl`.

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

```text
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

Local Durable Functions startup requires a reachable Azurite endpoint on `127.0.0.1:10000`.
The repo's local startup script tries to start Azurite via Docker Compose and will stop with a clear error if Docker Desktop is unavailable.

### Configuration

Key settings in `local.settings.json`:

| Setting | Purpose |
|---------|---------|
| `AzureWebJobsStorage` | Storage connection (or use MI-style account settings) |
| `LOCAL_DAM_BASE_URL` | Kintsugi DAM model endpoint |
| `LOCAL_DAM_MODEL_ID` | Model identifier (default: `KintsugiHealth/dam`) |
| `LOCAL_DAM_API_KEY` | DAM model API key |
| `LOCAL_DAM_MAX_RETRY_ATTEMPTS` | DAM attempts for network, 408, 429, and 5xx failures (default: `3`) |
| `LOCAL_DAM_RETRY_BASE_DELAY_MS` | Initial exponential retry delay (default: `1000`) |
| `LOCAL_DAM_USE_GPU` | Request GPU inference; set `false` for the deployed CPU service |
| `DAM_MOCK_MODE` | Mock prediction mode; keep `false` outside explicit tests |
| `AUDIO_JOB_MAX_UPLOAD_BYTES` | Maximum streamed audio upload size (default: `26214400`) |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint for risk assessments |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | GPT deployment name (default: `gpt-4o`) |
| `EXTENDED_ASSESSMENT_OPENAI_*` | Separate OpenAI config for GPT-5/O3 extended assessments |
| `AZURE_SPEECH_KEY` | Azure Speech service key for transcription |
| `AZURE_SPEECH_REGION` | Azure Speech region |

The deployed CPU DAM service can be configured without embedding its key in source:

```text
LOCAL_DAM_BASE_URL=https://bhs-dam.victorioussmoke-ce62b9bb.eastus.azurecontainerapps.io
LOCAL_DAM_API_KEY=<secret-backed setting>
LOCAL_DAM_USE_GPU=false
DAM_MOCK_MODE=false
```

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

```text
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
