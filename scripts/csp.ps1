<#
.SYNOPSIS
  Copy all blob containers (and blobs) from one Storage account to another using AzCopy v10.

.DESCRIPTION
  - Uses Azure CLI for authentication and container management (no Az PowerShell modules required)
  - Supports Microsoft Entra ID (RBAC) *or* SAS tokens.
  - Creates missing destination containers.
  - Logs AzCopy job IDs and writes a CSV summary.

.PARAMETERS
  -SourceSubId / -DestSubId     : Optional; for subscription context
  -SourceAccount / -DestAccount : Required. Storage account names (blob).
  -SourceRG / -DestRG           : Required for container management.
  -UseRBAC                      : Switch. If present, authenticate AzCopy with Entra ID (no SAS).
  -SourceSas / -DestSas         : If not using RBAC, provide SAS tokens that include at least rl (read, list) for source, and cw (create, write) for destination.
  -AzCopyPath                   : Optional full path to azcopy.exe if not in PATH.
  -Concurrency                  : Optional azcopy concurrency (default 64).

.NOTES
  Requires Azure CLI (az) to be installed and authenticated.
#>

param(
  [Parameter(Mandatory=$true)]  [string]$SourceAccount,
  [Parameter(Mandatory=$true)]  [string]$DestAccount,
  [Parameter(Mandatory=$true)]  [string]$SourceRG,
  [Parameter(Mandatory=$true)]  [string]$DestRG,
  [Parameter(Mandatory=$false)] [string]$SourceSubId,
  [Parameter(Mandatory=$false)] [string]$DestSubId,
  [switch]$UseRBAC,
  [Parameter(Mandatory=$false)] [string]$SourceSas,   # e.g. ?sv=... (no leading &)
  [Parameter(Mandatory=$false)] [string]$DestSas,     # e.g. ?sv=... (no leading &)
  [Parameter(Mandatory=$false)] [int]$Concurrency = 64,
  [Parameter(Mandatory=$false)] [string]$AzCopyPath
)

# -------------------- Helpers --------------------
function Write-Info   { param([string]$m) Write-Host "[INFO ] $m" -ForegroundColor Cyan }
function Write-Warn   { param([string]$m) Write-Host "[WARN ] $m" -ForegroundColor Yellow }
function Write-ErrorX { param([string]$m) Write-Host "[ERROR] $m" -ForegroundColor Red }

$ErrorActionPreference = 'Stop'
$startTime = Get-Date
$runId = (Get-Date -Format "yyyyMMdd-HHmmss")
$logDir = Join-Path -Path (Join-Path $PWD ".azcopy-logs") -ChildPath $runId
$null = New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$summaryCsv = Join-Path $logDir "container-copy-summary.csv"
"RunId,Time,Container,JobId,Status" | Out-File -FilePath $summaryCsv -Encoding UTF8

# Resolve azcopy
if ([string]::IsNullOrWhiteSpace($AzCopyPath)) {
  $AzCopyPath = (Get-Command azcopy -ErrorAction SilentlyContinue).Source
}
if (-not $AzCopyPath) {
  throw "AzCopy not found. Add it to PATH or pass -AzCopyPath."
}
Write-Info "Using AzCopy: $AzCopyPath"

# Set concurrency to improve throughput (tune as needed).
$env:AZCOPY_CONCURRENCY_VALUE = "$Concurrency"     # increases parallelism for server-side copy
# Optional: speed up small file handling
$env:AZCOPY_BUFFER_GB = "4"

# -------------------- Azure CLI check and login --------------------
# Check if Azure CLI is installed
$azCli = Get-Command az -ErrorAction SilentlyContinue
if (-not $azCli) {
  throw "Azure CLI (az) not found. Please install from: https://aka.ms/InstallAzureCLIDirect"
}

# Check if logged in
$accountCheck = az account show 2>$null
if (-not $accountCheck) {
  Write-Info "Not logged into Azure CLI. Running 'az login'..."
  az login
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI login failed."
  }
}

if ($UseRBAC) {
  # Set source subscription if provided
  if ($SourceSubId) {
    Write-Info "Setting source subscription: $SourceSubId"
    az account set --subscription $SourceSubId
  }

  # Login AzCopy with current Azure credentials
  Write-Info "Logging AzCopy into Microsoft Entra ID..."
  $loginOutput = & $AzCopyPath login 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Warn "AzCopy login may have issues. Output: $loginOutput"
  } else {
    Write-Info "AzCopy login complete."
  }
} else {
  if (-not $SourceSas -or -not $DestSas) {
    throw "When -UseRBAC is not set, you must provide both -SourceSas and -DestSas."
  }
  # Ensure SAS tokens start with ?
  if (-not $SourceSas.StartsWith("?")) { $SourceSas = "?$SourceSas" }
  if (-not $DestSas.StartsWith("?")) { $DestSas = "?$DestSas" }
}

# -------------------- List containers using Azure CLI --------------------
Write-Info "Listing containers in source account '$SourceAccount'..."

# List all containers in source using Azure CLI
$containersJson = az storage container list `
  --account-name $SourceAccount `
  --auth-mode login `
  --output json 2>$null

if ($LASTEXITCODE -ne 0 -or -not $containersJson) {
  Write-Warn "Failed to list containers with RBAC. Trying with account key..."
  $srcKeyJson = az storage account keys list `
    --account-name $SourceAccount `
    --resource-group $SourceRG `
    --output json
  $srcKey = ($srcKeyJson | ConvertFrom-Json)[0].value

  $containersJson = az storage container list `
    --account-name $SourceAccount `
    --account-key $srcKey `
    --output json
}

$containers = $containersJson | ConvertFrom-Json
if (-not $containers -or $containers.Count -eq 0) {
  Write-Warn "No containers found in source account '$SourceAccount'."
  return
}

Write-Info "Found $($containers.Count) containers in source. Starting copy loop..."

# Switch to destination subscription if different
if ($DestSubId -and ($DestSubId -ne $SourceSubId)) {
  Write-Info "Switching to destination subscription: $DestSubId"
  az account set --subscription $DestSubId
}

# -------------------- Copy loop --------------------
foreach ($c in $containers) {
  $name = $c.name

  # Check if destination container exists
  $destContainerCheck = az storage container exists `
    --account-name $DestAccount `
    --name $name `
    --auth-mode login `
    --output json 2>$null

  $exists = ($destContainerCheck | ConvertFrom-Json).exists

  if (-not $exists) {
    Write-Info "Creating destination container '$name'..."
    $publicAccess = if ($c.properties.publicAccess) { $c.properties.publicAccess } else { "off" }

    az storage container create `
      --account-name $DestAccount `
      --name $name `
      --public-access $publicAccess `
      --auth-mode login `
      --output none 2>$null

    if ($LASTEXITCODE -ne 0) {
      Write-Warn "Failed to create container with RBAC, trying with account key..."
      $dstKeyJson = az storage account keys list `
        --account-name $DestAccount `
        --resource-group $DestRG `
        --output json
      $dstKey = ($dstKeyJson | ConvertFrom-Json)[0].value

      az storage container create `
        --account-name $DestAccount `
        --name $name `
        --public-access $publicAccess `
        --account-key $dstKey `
        --output none
    }
  }

  # Compose source & destination URLs
  $srcUrl = "https://$SourceAccount.blob.core.windows.net/$name"
  $dstUrl = "https://$DestAccount.blob.core.windows.net/$name"

  if (-not $UseRBAC) {
    # Append SAS if provided (no leading & expected)
    $srcUrl = "$srcUrl$SourceSas"
    $dstUrl = "$dstUrl$DestSas"
  }

  Write-Info "Copying '$name'  =>  '$DestAccount/$name' (recursive)..."

  $jobLogDir = Join-Path $logDir $name
  $null = New-Item -ItemType Directory -Path $jobLogDir -Force | Out-Null

  $azcopyArgs = @(
    'copy', $srcUrl, $dstUrl,
    '--recursive=true',
    '--check-length=true',
    '--overwrite=ifSourceNewer',
    '--log-level=INFO',
    '--output-level=essential'
  )

  # Redirect output to log file
  $logFile = Join-Path $jobLogDir "azcopy-$name.log"

  # Kick off AzCopy with output redirection
  $proc = Start-Process -FilePath $AzCopyPath -ArgumentList $azcopyArgs -NoNewWindow -PassThru -Wait -RedirectStandardOutput $logFile -RedirectStandardError "$logFile.err"

  # Parse jobId from log (best-effort)
  $jobId = ""
  if (Test-Path $logFile) {
    $jobIdMatch = Select-String -Path $logFile -Pattern 'Job .* has started' -ErrorAction SilentlyContinue | Select-Object -Last 1
    if ($jobIdMatch -and $jobIdMatch.Line -match 'Job\s+([0-9a-f\-]+)\s+has started') {
      $jobId = $Matches[1]
    }
  }

  # Check exit code
  if ($proc.ExitCode -eq 0) {
    Write-Info "Completed container '$name'."
    "$runId,$(Get-Date),$name,$jobId,Success" | Out-File -FilePath $summaryCsv -Append -Encoding UTF8
  } else {
    Write-ErrorX "AzCopy failed for container '$name' (exit $($proc.ExitCode)). See $jobLogDir."
    "$runId,$(Get-Date),$name,$jobId,Failed($($proc.ExitCode))" | Out-File -FilePath $summaryCsv -Append -Encoding UTF8
  }
}

Write-Info "All done. Summary: $summaryCsv"
Write-Info "Logs: $logDir"
``
