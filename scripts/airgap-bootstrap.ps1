<#
.SYNOPSIS
    Creates an air-gap ready env file and validates local dependency endpoints.

.DESCRIPTION
    This script does not modify source code. It creates docker.env.airgap from
    docker.env.example (or an existing env file), applies air-gap overrides,
    and optionally checks local model/service endpoints.
#>
[CmdletBinding()]
param(
    [string]$InputEnvFile = (Join-Path $PSScriptRoot '..\docker.env.example'),
    [string]$OutputEnvFile = (Join-Path $PSScriptRoot '..\docker.env.airgap'),
    [string]$OpenAiEndpoint = 'http://host.docker.internal:11434/v1',
    [string]$DamHealthEndpoint = 'http://localhost:8000/health',
    [string]$OllamaTagsEndpoint = 'http://localhost:11434/api/tags',
    [switch]$SkipChecks
)

$ErrorActionPreference = 'Stop'

function Read-EnvFile {
    param([string]$Path)
    $map = [ordered]@{}

    if (-not (Test-Path $Path)) {
        throw "Env file not found: $Path"
    }

    $lines = Get-Content -Path $Path
    foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line.TrimStart().StartsWith('#')) { continue }

        $idx = $line.IndexOf('=')
        if ($idx -lt 1) { continue }

        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1)
        $map[$key] = $value
    }

    return $map
}

function Save-EnvFile {
    param(
        [hashtable]$Map,
        [string]$Path
    )

    $dir = Split-Path -Parent $Path
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $lines = @()
    foreach ($key in $Map.Keys) {
        $lines += "$key=$($Map[$key])"
    }

    Set-Content -Path $Path -Value $lines -Encoding UTF8
}

function Test-HttpEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSec = 5
    )

    try {
        Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing | Out-Null
        Write-Host "[OK] $Name reachable: $Url" -ForegroundColor Green
    }
    catch {
        Write-Warning "$Name not reachable: $Url"
    }
}

$InputEnvFile = [System.IO.Path]::GetFullPath($InputEnvFile)
$OutputEnvFile = [System.IO.Path]::GetFullPath($OutputEnvFile)

$envMap = Read-EnvFile -Path $InputEnvFile

$envMap['AIR_GAP_MODE'] = 'true'
$envMap['VITE_AIR_GAP_MODE'] = 'true'
$envMap['VITE_ENABLE_ENTRA_AUTH'] = 'false'
$envMap['VITE_OFFLINE_MODE'] = 'true'
$envMap['VITE_FFMPEG_CORE_BASE_URL'] = '/ffmpeg-core'

$envMap['AIR_GAP_OPENAI_ENDPOINT'] = $OpenAiEndpoint
$envMap['AIR_GAP_OPENAI_API_KEY'] = $envMap['AIR_GAP_OPENAI_API_KEY']
$envMap['AIR_GAP_OPENAI_DEPLOYMENT'] = if ($envMap.Contains('AIR_GAP_OPENAI_DEPLOYMENT')) { $envMap['AIR_GAP_OPENAI_DEPLOYMENT'] } else { 'gpt-oss-20b' }

$envMap['AIR_GAP_EXTENDED_OPENAI_ENDPOINT'] = $OpenAiEndpoint
$envMap['AIR_GAP_EXTENDED_OPENAI_API_KEY'] = $envMap['AIR_GAP_EXTENDED_OPENAI_API_KEY']
$envMap['AIR_GAP_EXTENDED_OPENAI_DEPLOYMENT'] = if ($envMap.Contains('AIR_GAP_EXTENDED_OPENAI_DEPLOYMENT')) { $envMap['AIR_GAP_EXTENDED_OPENAI_DEPLOYMENT'] } else { 'gpt-oss-20b' }

Save-EnvFile -Map $envMap -Path $OutputEnvFile

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host 'BHS Air-Gap Bootstrap' -ForegroundColor Cyan
Write-Host "Input env : $InputEnvFile" -ForegroundColor Cyan
Write-Host "Output env: $OutputEnvFile" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if (-not $SkipChecks) {
    Write-Host ''
    Write-Host 'Checking local endpoints...' -ForegroundColor Yellow
    Test-HttpEndpoint -Name 'Ollama' -Url $OllamaTagsEndpoint
    Test-HttpEndpoint -Name 'DAM health' -Url $DamHealthEndpoint
}

Write-Host ''
Write-Host 'Next steps:' -ForegroundColor White
Write-Host "  1) Stage FFmpeg core: .\scripts\vendor-offline\stage-ffmpeg-core.ps1" -ForegroundColor DarkGray
Write-Host "  2) Start stack: docker compose --env-file $OutputEnvFile -f docker-compose.local.yml up -d --build" -ForegroundColor DarkGray
