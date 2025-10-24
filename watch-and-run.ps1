param(
    [int]$DebounceMs = 2000
)

Write-Host "🔍 Starting file watcher..." -ForegroundColor Cyan
Write-Host "Watching for changes in:" -ForegroundColor Yellow
Write-Host "  - BehavioralHealthSystem.Web/src/**/*" -ForegroundColor Gray
Write-Host "  - BehavioralHealthSystem.Functions/**/*.cs" -ForegroundColor Gray
Write-Host "  - BehavioralHealthSystem.Helpers/**/*.cs" -ForegroundColor Gray
Write-Host "  - BehavioralHealthSystem.Console/**/*.cs" -ForegroundColor Gray
Write-Host ""

$lastRun = Get-Date
$debounceTimer = $null

# Watch paths
$watchPaths = @(
    "BehavioralHealthSystem.Web\src",
    "BehavioralHealthSystem.Functions",
    "BehavioralHealthSystem.Helpers",
    "BehavioralHealthSystem.Console"
)

# File extensions to watch
$extensions = @("*.ts", "*.tsx", "*.js", "*.jsx", "*.cs", "*.json")

# Excluded directories
$excludeDirs = @("node_modules", "bin", "obj", ".git", "dist", "build", "TestResults")

function Start-LocalRun {
    $currentTime = Get-Date
    $timeSinceLastRun = ($currentTime - $script:lastRun).TotalMilliseconds

    if ($timeSinceLastRun -lt $DebounceMs) {
        Write-Host "⏳ Debouncing... (${timeSinceLastRun}ms since last change)" -ForegroundColor DarkGray
        return
    }

    $script:lastRun = $currentTime
    Write-Host ""
    Write-Host "🔄 Changes detected - Running local-run.ps1..." -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

    try {
        & "$PSScriptRoot\scripts\local-run.ps1"
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
        Write-Host "✅ local-run.ps1 completed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
        Write-Host "❌ Error running local-run.ps1: $_" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "👀 Watching for changes..." -ForegroundColor Cyan
}

# Create watchers
$watchers = @()

foreach ($path in $watchPaths) {
    $fullPath = Join-Path $PSScriptRoot $path

    if (Test-Path $fullPath) {
        foreach ($ext in $extensions) {
            $watcher = New-Object System.IO.FileSystemWatcher
            $watcher.Path = $fullPath
            $watcher.Filter = $ext
            $watcher.IncludeSubdirectories = $true
            $watcher.EnableRaisingEvents = $true

            # Event handler
            $action = {
                param($source, $e)

                # Check if file is in excluded directory
                $isExcluded = $false
                foreach ($exclude in $script:excludeDirs) {
                    if ($e.FullPath -like "*\$exclude\*") {
                        $isExcluded = $true
                        break
                    }
                }

                if (-not $isExcluded) {
                    $changeType = $e.ChangeType
                    $fileName = Split-Path $e.FullPath -Leaf
                    $relativePath = $e.FullPath.Replace("$PSScriptRoot\", "")

                    Write-Host "📝 $changeType`: $relativePath" -ForegroundColor Yellow

                    # Debounce: Cancel existing timer and start new one
                    if ($null -ne $script:debounceTimer) {
                        $script:debounceTimer.Stop()
                        $script:debounceTimer.Dispose()
                    }

                    $script:debounceTimer = New-Object System.Timers.Timer
                    $script:debounceTimer.Interval = $DebounceMs
                    $script:debounceTimer.AutoReset = $false

                    Register-ObjectEvent -InputObject $script:debounceTimer -EventName Elapsed -Action {
                        Start-LocalRun
                    } | Out-Null

                    $script:debounceTimer.Start()
                }
            }

            Register-ObjectEvent -InputObject $watcher -EventName Changed -Action $action | Out-Null
            Register-ObjectEvent -InputObject $watcher -EventName Created -Action $action | Out-Null
            Register-ObjectEvent -InputObject $watcher -EventName Deleted -Action $action | Out-Null
            Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action $action | Out-Null

            $watchers += $watcher
        }
    }
    else {
        Write-Host "⚠️  Path not found: $fullPath" -ForegroundColor Yellow
    }
}

Write-Host "👀 Watching for changes... (Press Ctrl+C to stop)" -ForegroundColor Cyan
Write-Host ""

# Run once on startup
Start-LocalRun

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    # Cleanup
    foreach ($watcher in $watchers) {
        $watcher.EnableRaisingEvents = $false
        $watcher.Dispose()
    }

    Get-EventSubscriber | Unregister-Event

    Write-Host ""
    Write-Host "🛑 File watcher stopped" -ForegroundColor Red
}
