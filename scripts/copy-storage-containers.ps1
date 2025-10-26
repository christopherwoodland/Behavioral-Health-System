<#
.SYNOPSIS
  Copy all blob containers (and blobs) from one Storage account to another using AzCopy v10.

.DESCRIPTION
  - Supports Microsoft Entra ID (RBAC) *or* SAS tokens.
  - Creates missing destination containers.
  - Logs AzCopy job IDs and writes a CSV summary.

.PARAMETERS
  -SourceSubId / -DestSubId     : Optional; for RBAC enumeration via Az modules
  -SourceAccount / -DestAccount : Required. Storage account names (blob).
  -SourceRG / -DestRG           : Optional; for creating containers via Az modules
  -UseRBAC                      : Switch. If present, authenticate AzCopy with Entra ID (no SAS).
  -SourceSas / -DestSas         : If not using RBAC, provide SAS tokens that include at least rl (read, list) for source, and cw (create, write) for destination.
  -AzCopyPath                   : Optional full path to azcopy.exe if not in PATH.
  -Concurrency                  : Optional azcopy concurrency (default 64).

.NOTES
  Author: You
#>

param(
  [Parameter(Mandatory=$true)]  [string]$SourceAccount,
  [Parameter(Mandatory=$true)]  [string]$DestAccount,
  [Parameter(Mandatory=$false)] [string]$SourceRG,
  [Parameter(Mandatory=$false)] [string]$DestRG,
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

# -------------------- Azure login (optional) --------------------
if ($UseRBAC) {
  # For enumeration (Get-AzStorageContainer) and to create missing containers we’ll use Az modules
  if ($SourceSubId) { Connect-AzAccount -UseDeviceAuthentication:$false | Out-Null; Select-AzSubscription -SubscriptionId $SourceSubId | Out-Null }
  else { Connect-AzAccount -UseDeviceAuthentication:$false | Out-Null }

  # If destination is in a different subscription/tenant, we’ll switch later as needed
  Write-Info "Logging AzCopy into Microsoft Entra ID..."
  & $AzCopyPath login | Out-Null    # uses your current Azure credentials (or device code flow)
  Write-Info "AzCopy login complete. (You can also use managed identity/service principal.)"
} else {
  if (-not $SourceSas -or -not $DestSas) {
    throw "When -UseRBAC is not set, you must provide both -SourceSas and -DestSas."
  }
}

# -------------------- Build contexts and list containers --------------------
# We’ll use Az.Storage to enumerate containers and to create them on destination when missing.
# This works whether you auth with RBAC or with account keys (RBAC recommended).
$srcCtx = $null
$dstCtx = $null

if ($UseRBAC) {
  # Get contexts using connected account (no keys/SAS required)
  if ($SourceRG) {
    $srcAcct = Get-AzStorageAccount -ResourceGroupName $SourceRG -Name $SourceAccount
    $srcCtx  = $srcAcct.Context
  } else {
    # fallback resolve by name (slower)
    $srcAcct = Get-AzStorageAccount | Where-Object { $_.StorageAccountName -eq $SourceAccount } | Select-Object -First 1
    $srcCtx  = $srcAcct.Context
  }

  if ($DestSubId -and ($DestSubId -ne $SourceSubId)) { Select-AzSubscription -SubscriptionId $DestSubId | Out-Null }
  if ($DestRG) {
    $dstAcct = Get-AzStorageAccount -ResourceGroupName $DestRG -Name $DestAccount
    $dstCtx  = $dstAcct.Context
  } else {
    $dstAcct = Get-AzStorageAccount | Where-Object { $_.StorageAccountName -eq $DestAccount } | Select-Object -First 1
    $dstCtx  = $dstAcct.Context
  }
} else {
  # If you prefer key-based context for container enumeration/creation
  $srcKey = (Get-AzStorageAccountKey -Name $SourceAccount -ResourceGroupName $SourceRG)[0].Value
  $dstKey = (Get-AzStorageAccountKey -Name $DestAccount -ResourceGroupName $DestRG)[0].Value
  $srcCtx = New-AzStorageContext -StorageAccountName $SourceAccount -StorageAccountKey $srcKey
  $dstCtx = New-AzStorageContext -StorageAccountName $DestAccount -StorageAccountKey $dstKey
}

# List all containers in source
$containers = Get-AzStorageContainer -Context $srcCtx
if (-not $containers) { Write-Warn "No containers found in source account '$SourceAccount'."; return }

Write-Info "Found $($containers.Count) containers in source. Starting copy loop..."

# -------------------- Copy loop --------------------
foreach ($c in $containers) {
  $name = $c.Name

  # Ensure destination container exists with same access level
  $destContainer = Get-AzStorageContainer -Context $dstCtx -Name $name -ErrorAction SilentlyContinue
  if (-not $destContainer) {
    Write-Info "Creating destination container '$name'..."
    $perm = if ($c.PublicAccess) { $c.PublicAccess } else { "Off" }
    New-AzStorageContainer -Context $dstCtx -Name $name -Permission $perm | Out-Null
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

  $args = @(
    'copy', $srcUrl, $dstUrl,
    '--recursive=true',
    '--check-length=true',
    '--overwrite=ifSourceNewer',
    '--log-level=INFO',
    "--output-level=Essential",
    "--log-file=$jobLogDir\azcopy-$name.log"
  )

  # Kick off AzCopy
  $proc = Start-Process -FilePath $AzCopyPath -ArgumentList $args -NoNewWindow -PassThru -Wait
  # Parse jobId from log (best-effort)
  $jobId = (Select-String -Path "$jobLogDir\azcopy-$name.log" -Pattern 'Job .* has started' -SimpleMatch | Select-Object -Last 1).Line
  if ($jobId -match 'Job\s+([0-9a-f\-]+)\s+has started') { $jobId = $Matches[1] } else { $jobId = "" }

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
