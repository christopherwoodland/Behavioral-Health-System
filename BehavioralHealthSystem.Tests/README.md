# BehavioralHealthSystem.Tests

Unit and integration test suite for the Behavioral Health System backend (.NET projects).

## Overview

This project contains MSTest-based tests covering the [Functions API](../BehavioralHealthSystem.Functions/README.md) and [Helpers library](../BehavioralHealthSystem.Helpers/README.md). Tests validate models, validators, services, configuration, and function endpoints.

> **Note:** Frontend (React) tests are located in the [Web project](../BehavioralHealthSystem.Web/README.md) and use Vitest.

## Tech Stack

- **.NET 8**
- **MSTest** — test framework
- **Moq** — mocking (where needed)

## Test Coverage

### Models
- `ActualScoreTests` — ground truth score model
- `InitiateRequestTests` / `InitiateResponseTests` — DAM session initiation contracts
- `PredictionRequestTests` / `PredictionResponseTests` / `PredictionResultTests` — DAM prediction models
- `PredictErrorTests` — prediction error structures
- `SessionDataTests` / `SessionPredictionModelsTests` — session data model
- `UserMetadataTests` / `UserBiometricDataTests` — user data models
- `ApiErrorResponseTests` / `StandardResponsesTests` — API response wrappers

### Validators
- `InitiateRequestValidatorTests` — session initiation validation rules
- `UserMetadataValidatorTests` — demographic data validation
- `UserBiometricDataValidatorTests` — biometric input validation
- `GenderEthnicityValidationTests` — gender/ethnicity field validation

### Services
- `ExceptionHandlingServiceTests` — error handling behavior
- `StructuredLoggingServiceTests` — logging patterns
- `UnitConversionHelperTests` — unit conversion accuracy
- `FeatureFlagsServiceTests` — feature flag logic

### Functions
- `HealthCheckFunctionTests` — health endpoint
- `RiskAssessmentFunctionsTests` — risk assessment endpoint behavior
- `SessionStorageFunctionsTests` — session CRUD endpoints
- `SaveChatTranscriptFunctionTests` — transcript persistence
- `AudioDownloadFunctionTests` — audio download endpoint
- `FeatureFlagsFunctionTests` — feature flags endpoint

### Configuration
- `AzureOpenAIOptionsTests` / `ExtendedAssessmentOpenAIOptionsTests` — OpenAI config validation
- `ApplicationConstantsTests` — constants integrity
- `RetryPoliciesTests` — Polly policy configuration
- `JsonSerializerOptionsFactoryTests` — serialization settings
- `KintsugiApiOptionsTests` — DAM API configuration
- `KintsugiApiServiceSerializationTests` / `KintsugiConsentSerializationTests` — serialization

### Other
- `SessionIdFunctionalityTests` — session ID generation and format

## Running Tests

```powershell
# Run all tests
dotnet test

# Run with verbose output
dotnet test --verbosity normal

# Run filtered tests
dotnet test --filter "FullyQualifiedName~RiskAssessment"

# Run with coverage
dotnet test /p:CollectCoverage=true
```
