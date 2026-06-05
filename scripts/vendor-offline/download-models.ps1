<#
.SYNOPSIS
    Downloads model artifacts needed for strict air-gap deployment.

.DESCRIPTION
    Run this script on an internet-connected machine. It downloads:
      1. Ollama models (gpt-oss-20b, phi-4, embeddings)
      2. Whisper model file (for local STT service)
      3. Piper voice files (for local TTS service)

    Copy the output folder to your air-gapped environment and mount/use
    these artifacts from local storage.

.PARAMETER OutputDir
    Target directory for model artifacts.

.PARAMETER OllamaModels
    List of Ollama model tags to pull.

.PARAMETER WhisperModel
    Whisper.cpp GGML model name.

.PARAMETER PiperVoice
    Piper voice name.

.PARAMETER SkipOllama
    Skip Ollama model pull.

.PARAMETER SkipWhisper
    Skip Whisper model download.

.PARAMETER SkipPiper
    Skip Piper voice download.
#>
[CmdletBinding()]
param(
    [string]$OutputDir = (Join-Path $PSScriptRoot '..\..\offline-models'),
    [string[]]$OllamaModels = @('gpt-oss:20b', 'phi4', 'nomic-embed-text'),
    [string]$WhisperModel = 'large-v3',
    [string]$PiperVoice = 'en_US-hfc_female-medium',
    [switch]$SkipOllama,
    [switch]$SkipWhisper,
    [switch]$SkipPiper
)

$ErrorActionPreference = 'Stop'
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host 'BHS Air-Gap Model Downloader' -ForegroundColor Cyan
Write-Host "Output: $OutputDir" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

function Get-OllamaModelNameForFile {
    param([Parameter(Mandatory = $true)][string]$Model)
    return ($Model -replace '[:/]', '_')
}

if (-not $SkipOllama) {
    $ollamaDir = Join-Path $OutputDir 'ollama'
    New-Item -ItemType Directory -Path $ollamaDir -Force | Out-Null

    Write-Host ''
    Write-Host '[1/3] Pulling Ollama models...' -ForegroundColor Yellow

    $ollamaCli = Get-Command ollama -ErrorAction SilentlyContinue
    if (-not $ollamaCli) {
        throw 'ollama CLI is required on the connected machine. Install Ollama and retry.'
    }

    $originalOllamaModels = $env:OLLAMA_MODELS
    $env:OLLAMA_MODELS = $ollamaDir

    try {
        foreach ($model in $OllamaModels) {
            Write-Host "  Pulling $model ..."
            ollama pull $model
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to pull Ollama model: $model"
            }
        }
    }
    finally {
        if ([string]::IsNullOrEmpty($originalOllamaModels)) {
            Remove-Item Env:OLLAMA_MODELS -ErrorAction SilentlyContinue
        }
        else {
            $env:OLLAMA_MODELS = $originalOllamaModels
        }
    }

    Write-Host '  [OK] Ollama model pull complete.' -ForegroundColor Green
}

if (-not $SkipWhisper) {
    $whisperDir = Join-Path $OutputDir 'whisper'
    New-Item -ItemType Directory -Path $whisperDir -Force | Out-Null

    Write-Host ''
    Write-Host "[2/3] Downloading Whisper model ($WhisperModel)..." -ForegroundColor Yellow

    $whisperFile = "ggml-$WhisperModel.bin"
    $whisperUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$whisperFile"
    $whisperDest = Join-Path $whisperDir $whisperFile

    if (Test-Path $whisperDest) {
        Write-Host "  Already downloaded: $whisperFile" -ForegroundColor DarkGreen
    }
    else {
        Invoke-WebRequest -Uri $whisperUrl -OutFile $whisperDest -UseBasicParsing
    }

    Write-Host '  [OK] Whisper download complete.' -ForegroundColor Green
}

if (-not $SkipPiper) {
    $piperDir = Join-Path $OutputDir 'piper'
    New-Item -ItemType Directory -Path $piperDir -Force | Out-Null

    Write-Host ''
    Write-Host "[3/3] Downloading Piper voice ($PiperVoice)..." -ForegroundColor Yellow

    # Supports voices in pattern: en_US-hfc_female-medium
    $parts = $PiperVoice.Split('-')
    if ($parts.Length -lt 3) {
        throw "Unexpected Piper voice format: $PiperVoice"
    }

    $locale = $parts[0]
    $voiceFamily = $parts[1]
    $quality = $parts[2]

    $piperBaseUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/$locale/$voiceFamily/$quality"
    $onnxName = "$PiperVoice.onnx"
    $jsonName = "$PiperVoice.onnx.json"

    $onnxPath = Join-Path $piperDir $onnxName
    $jsonPath = Join-Path $piperDir $jsonName

    if (-not (Test-Path $onnxPath)) {
        Invoke-WebRequest -Uri "$piperBaseUrl/$onnxName" -OutFile $onnxPath -UseBasicParsing
    }

    if (-not (Test-Path $jsonPath)) {
        Invoke-WebRequest -Uri "$piperBaseUrl/$jsonName" -OutFile $jsonPath -UseBasicParsing
    }

    Write-Host '  [OK] Piper download complete.' -ForegroundColor Green
}

$totalBytes = (Get-ChildItem -Path $OutputDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
$totalGb = [math]::Round($totalBytes / 1GB, 2)

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host "Model artifacts ready at: $OutputDir" -ForegroundColor Cyan
Write-Host "Total size: $totalGb GB" -ForegroundColor Cyan
Write-Host 'Next: transfer this folder into the air-gapped environment.' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
