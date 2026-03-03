# BehavioralHealthSystem.Agents

Microsoft Semantic Kernel-based audio processing pipeline for the Behavioral Health System.

## Overview

This project implements a deterministic 3-step audio processing orchestration using Semantic Kernel native function plugins. Unlike typical LLM-routed agent patterns, this pipeline runs a **fixed sequence** — Fetch → Convert → Predict — without LLM decision-making, using Semantic Kernel as a structured plugin execution framework.

The pipeline is invoked by the [Functions API](../BehavioralHealthSystem.Functions/README.md) `AudioProcessingFunction` to process uploaded audio files through the full Kintsugi DAM prediction workflow.

## Tech Stack

- **.NET 8** class library
- **Microsoft Semantic Kernel 1.54.0** — plugin orchestration framework
- **Azure Blob Storage** — audio file retrieval
- References [Helpers library](../BehavioralHealthSystem.Helpers/README.md) for shared models

## Pipeline Architecture

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  1. FETCH        │ →  │  2. CONVERT      │ →  │  3. PREDICT      │
│  AudioRetrieval  │    │  AudioConversion │    │  DamPrediction   │
│  Plugin          │    │  Plugin          │    │  Plugin          │
├──────────────────┤    ├──────────────────┤    ├──────────────────┤
│ Download audio   │    │ Convert to WAV   │    │ Initiate DAM     │
│ from Azure Blob  │    │ via ffmpeg       │    │ session + submit │
│ Storage          │    │ (16kHz, mono)    │    │ audio for        │
│                  │    │                  │    │ prediction       │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

## Plugins

| Plugin | Step | Description |
|--------|------|-------------|
| `AudioRetrievalPlugin` | 1 | Fetches audio from Azure Blob Storage by blob name |
| `AudioConversionPlugin` | 2 | Converts audio to WAV format (16kHz, mono) via ffmpeg for DAM model compatibility |
| `DamPredictionPlugin` | 3 | Initiates a Kintsugi DAM session and submits the converted audio for depression/anxiety prediction |
| `LocalFileRetrievalPlugin` | Alt | Alternative to Step 1 — fetches audio from local filesystem (for development/testing) |

## Project Structure

```
BehavioralHealthSystem.Agents/
├── Services/              # AudioProcessingOrchestrator — sequential plugin runner
├── Plugins/               # Semantic Kernel native function plugins
├── Models/                # Pipeline data models (AudioFile, ConvertedAudio, etc.)
├── Interfaces/            # IAudioProcessingOrchestrator
└── DependencyInjection/   # AddAgentServices() registration extension
```

## Integration

The pipeline is registered in the Functions API via `AddAgentServices()` and invoked by the `AudioProcessingFunction`:

```
POST /api/process-audio-upload
  → AudioProcessingOrchestrator.ProcessAsync()
    → AudioRetrievalPlugin.FetchAudio()
    → AudioConversionPlugin.ConvertAudio()
    → DamPredictionPlugin.SubmitPrediction()
  → Returns PredictionResult
```

## Models

| Model | Purpose |
|-------|---------|
| `AudioFile` | Raw audio file data from blob storage |
| `ConvertedAudio` | WAV-converted audio ready for DAM submission |
| `AudioConversionOptions` | Conversion settings (sample rate, channels, format) |
| `AudioProcessingResult` | Full pipeline result including prediction output |
| `AudioConversionOnlyResult` | Result when only conversion is needed |
