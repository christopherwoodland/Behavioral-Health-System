# BehavioralHealthSystem.Dam

Shared .NET 8 class library containing the DAM (Depression Assessment Model) HTTP client pipeline. This library encapsulates all communication with the Kintsugi Health DAM API and can be consumed by any .NET project via NuGet.

## Overview

This project was extracted from the Functions API to enable cross-project reuse — for example, running DAM evaluations in a separate evaluation harness without depending on the full Functions project.

## What's Included

| Class | Purpose |
|-------|---------|
| `ILocalDamModelService` | Interface for DAM session initiation and prediction submission |
| `LocalDamModelService` | HTTP client implementation with JSON normalization for multiple DAM response formats |
| `LocalDamModelOptions` | Configuration POCO (`BaseUrl`, `InitiatePath`, `PredictionPath`, `ApiKey`, `ModelId`, `TimeoutSeconds`) |
| `LocalDamWarmupHostedService` | `IHostedService` that polls the DAM `/health` endpoint at startup until the pipeline reports "loaded" |
| `DamServiceCollectionExtensions` | `AddDamServices(IConfiguration)` extension method for one-line DI registration |

## Dependencies

- **BehavioralHealthSystem.Helpers** — model types (`PredictionRequest`, `PredictionResponse`, `InitiateRequest`, `InitiateResponse`, `ActualScore`, `PredictError`) and `JsonSerializerOptionsFactory`, `RetryPolicies`
- **Microsoft.Extensions.Http.Polly** — retry policies with exponential backoff
- **Microsoft.Extensions.Hosting.Abstractions** — `IHostedService` for warmup

## NuGet Package

Published to **GitHub Packages** as `BehavioralHealthSystem.Dam`. The Helpers library is published alongside as `BehavioralHealthSystem.Helpers` (transitive dependency).

### Publishing

```powershell
# Set your GitHub PAT (needs write:packages scope)
$env:GITHUB_TOKEN = "<your-pat>"

# Pack and push both packages
.\scripts\publish-nuget-packages.ps1 -Version 1.0.0
```

### Consuming in Another Project

1. Add a `nuget.config` to the consuming project with the GitHub Packages source:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="github" value="https://nuget.pkg.github.com/christopherwoodland/index.json" />
  </packageSources>
  <packageSourceCredentials>
    <github>
      <add key="Username" value="christopherwoodland" />
      <add key="ClearTextPassword" value="%GITHUB_TOKEN%" />
    </github>
  </packageSourceCredentials>
</configuration>
```

2. Add the package reference:

```powershell
dotnet add package BehavioralHealthSystem.Dam --version 1.0.0 --source github
```

3. Register services in your `Program.cs`:

```csharp
using BehavioralHealthSystem.Dam.Services;

services.AddDamServices(configuration);
```

4. Inject `ILocalDamModelService` wherever you need to call the DAM API:

```csharp
public class MyEvaluationService(ILocalDamModelService damService)
{
    public async Task<PredictionResponse?> RunPrediction(PredictionRequest request)
    {
        return await damService.SubmitPredictionAsync(request);
    }
}
```

## Configuration

`AddDamServices` reads the following keys from `IConfiguration`:

| Key | Default | Purpose |
|-----|---------|---------|
| `LOCAL_DAM_BASE_URL` | `http://localhost:8000` | DAM model base URL |
| `LOCAL_DAM_INITIATE_PATH` | `initiate` | Session initiation endpoint |
| `LOCAL_DAM_PREDICTION_PATH` | `predict` | Prediction submission endpoint |
| `LOCAL_DAM_API_KEY` | — | Optional API key |
| `LOCAL_DAM_MODEL_ID` | `KintsugiHealth/dam` | Model identifier |
| `LOCAL_DAM_TIMEOUT_SECONDS` | `300` | HTTP request timeout |
| `LOCAL_DAM_WARMUP_ON_STARTUP` | `true` | Whether to poll `/health` on startup |
| `LOCAL_DAM_HEALTH_PATH` | `health` | Health endpoint path |
| `LOCAL_DAM_WARMUP_TIMEOUT_SECONDS` | `600` | Max warmup wait time |
| `LOCAL_DAM_WARMUP_POLL_SECONDS` | `5` | Poll interval during warmup |
