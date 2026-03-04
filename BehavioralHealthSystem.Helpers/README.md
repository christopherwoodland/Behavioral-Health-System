# BehavioralHealthSystem.Helpers

Shared .NET 8 class library containing models, services, validators, and configuration used across the Behavioral Health System backend.

## Overview

This project defines the core data contracts and business logic shared by the [Functions API](../BehavioralHealthSystem.Functions/README.md), [Agents pipeline](../BehavioralHealthSystem.Agents/README.md), and [DSM-5 Import CLI](../BehavioralHealthSystem.DSM5Import/README.md). It centralizes models, storage services, AI integrations, validation rules, and configuration to ensure consistency across all backend components.

## Tech Stack

- **.NET 8** class library
- **Azure.AI.OpenAI** — risk assessment and grammar correction via GPT models
- **Azure Blob Storage** — session, file group, and assessment persistence
- **Azure Document Intelligence** — DSM-5 PDF content extraction
- **Azure Identity** — Managed Identity and credential management
- **FluentValidation** — request validation rules
- **Polly** — retry and resilience policies
- **IMemoryCache** — in-memory caching for job tracking

## Project Structure

```
BehavioralHealthSystem.Helpers/
├── Models/          # Data models and request/response contracts
├── Services/        # Business logic, storage, and AI service integrations
├── Validators/      # FluentValidation request validators
├── Configuration/   # Options classes, constants, retry policies
└── Deploy/          # ARM/Bicep deployment templates
```

## Models

### Core Session & Prediction Models

| Model | Purpose |
|-------|---------|
| `SessionData` | Central session model — holds predictions, risk assessments, transcription, audio metadata, DSM-5 conditions |
| `PredictionResult` | DAM output — depression/anxiety scores, model category, calibration status |
| `PredictionRequest` / `PredictionResponse` | DAM prediction submission contracts |
| `InitiateRequest` / `InitiateResponse` | Session initiation with user metadata |
| `UserMetadata` | Demographics — age, gender, ethnicity, race, weight |
| `ActualScore` | Ground truth scores for model calibration |

### Risk Assessment Models

| Model | Purpose |
|-------|---------|
| `RiskAssessment` | Standard assessment — risk score (1–10), severity level, key factors, recommendations |
| `ExtendedRiskAssessment` | Extended evaluation including schizophrenia screening |
| `MultiConditionExtendedRiskAssessment` | Multi-condition DSM-5 assessment with per-condition results and cross-condition differential diagnosis |
| `ExtendedAssessmentJob` | Async job tracking for long-running extended assessments |

### Other Models

| Model | Purpose |
|-------|---------|
| `DSM5Models` | DSM-5 diagnostic condition data structures |
| `FileGroup` | File group organization for sessions |
| `UserBiometricData` | Biometric data (height, weight, nickname) |
| `StandardResponses` | Standardized API response wrappers |
| `ApiErrorResponse` / `PredictError` | Error response contracts |

## Services

### AI & Assessment Services

| Service | Purpose |
|---------|---------|
| `RiskAssessmentService` | Generates risk assessments via Azure OpenAI — builds clinical prompts from session data, calls GPT, parses structured JSON |
| `GrammarCorrectionService` | AI-powered grammar correction for transcribed text |
| `ExtendedAssessmentJobService` | In-memory job tracking for async extended assessments |

### Storage Services

| Service | Purpose |
|---------|---------|
| `SessionStorageService` | Session CRUD in Azure Blob Storage |
| `FileGroupStorageService` | File group management in blob storage |
| `BiometricDataService` | User biometric data persistence |

### DSM-5 Data Services

| Service | Purpose |
|---------|---------|
| `DSM5DataService` | DSM-5 condition data management using Document Intelligence + Blob Storage |
| `AzureContentUnderstandingService` | Structured document extraction from DSM-5 PDFs |

### Infrastructure Services

| Service | Purpose |
|---------|---------|
| `ExceptionHandlingService` | Centralized exception handling with structured error responses |
| `StructuredLoggingService` | Structured logging patterns for observability |
| `UnitConversionHelper` | Imperial ↔ metric conversions |
| `BaseService` / `BaseHttpService` | Base classes for service implementations |

## Validators

| Validator | Purpose |
|-----------|---------|
| `InitiateRequestValidator` | Validates DAM session initiation requests |
| `UserMetadataValidator` | Validates user demographic data |
| `UserBiometricDataValidator` | Validates biometric inputs |

## Configuration

| Class | Purpose |
|-------|---------|
| `ApplicationConstants` | Centralized timeouts, limits, and magic number elimination |
| `AzureOpenAIOptions` | Standard Azure OpenAI configuration (endpoint, key, deployment) |
| `ExtendedAssessmentOpenAIOptions` | Separate GPT-5/O3 configuration for extended assessments |
| `RetryPolicies` | Polly retry and circuit-breaker policies |
| `JsonSerializerOptionsFactory` | Shared JSON serialization settings |

## Testing

Unit and integration tests covering all models, validators, and services are in the [Tests project](../BehavioralHealthSystem.Tests/README.md).
