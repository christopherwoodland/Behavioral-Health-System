# local-run.ps1
# This script builds and runs the .NET Azure Functions project and starts the frontend dev server.

# Set strict mode
Set-StrictMode -Version Latest

# Get script directory and navigate to solution root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SolutionRoot = Split-Path -Parent $ScriptDir
Push-Location $SolutionRoot

try {
    # Paths relative to solution root
    $functionsPath = "./BehavioralHealthSystem.Functions"
    $webPath = "./BehavioralHealthSystem.Web"

    Write-Host "Stopping existing processes..."

    # Kill existing Vite processes (frontend dev server)
    Write-Host "Killing existing Vite processes..."
    Get-Process | Where-Object { $_.ProcessName -eq "node" } | ForEach-Object {
        try {
            $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine -and ($cmdLine -like "*vite*" -or $cmdLine -like "*dev*" -or $cmdLine -like "*npm*run*dev*")) {
                Write-Host "Stopping Node.js process running Vite: $($_.Id)"
                Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            }
        }
        catch {
            # Ignore errors when checking command line
        }
    }

    # Kill existing Azure Functions processes
    Write-Host "Killing existing Azure Functions processes..."
    Get-Process | Where-Object {
        $_.ProcessName -eq "func" -or
        $_.ProcessName -eq "dotnet" -or
        $_.ProcessName -like "*Azure*" -or
        $_.ProcessName -like "*Function*"
    } | ForEach-Object {
        try {
            # For dotnet processes, check if they're running Azure Functions
            if ($_.ProcessName -eq "dotnet") {
                $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
                if ($cmdLine -and ($cmdLine -like "*func*" -or $cmdLine -like "*BehavioralHealthSystem.Functions*")) {
                    Write-Host "Stopping .NET process running Functions: $($_.Id)"
                    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
                }
            } else {
                Write-Host "Stopping Functions process: $($_.Id)"
                Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            }
        }
        catch {
            # Ignore errors when checking command line
        }
    }

    # Kill processes by common ports used by these services
    Write-Host "Killing processes using common development ports..."
    $commonPorts = @(3000, 5173, 7071, 7072, 4200, 8080)
    foreach ($port in $commonPorts) {
        try {
            $connections = netstat -ano | Select-String ":$port\s"
            foreach ($connection in $connections) {
                $processId = ($connection -split '\s+')[-1]
                if ($processId -and $processId -ne "0") {
                    Write-Host "Stopping process on port ${port}: $processId"
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                }
            }
        }
        catch {
            # Ignore errors when checking ports
        }
    }

    Write-Host "Process cleanup completed."

    # Wait a moment for processes to fully terminate
    Start-Sleep -Seconds 2

    Write-Host "Building .NET Azure Functions project..."
    dotnet build $functionsPath

    if ($LASTEXITCODE -ne 0) {
        Write-Error "dotnet build failed. Exiting."
        exit $LASTEXITCODE
    }


    Write-Host "Starting Azure Functions host..."
    Push-Location $functionsPath
    Start-Process "cmd.exe" -ArgumentList '/c func start'
    Pop-Location

    Write-Host "Installing npm dependencies for web project..."
    Push-Location $webPath
    npm install
    Pop-Location

    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed. Exiting."
        exit $LASTEXITCODE
    }

    Write-Host "Starting frontend dev server (using .env.localdev via dev:local command)..."
    Push-Location $webPath
    # Use the dev:local npm script which runs Vite with --mode localdev
    # This ensures .env.localdev is loaded instead of .env.development
    Start-Process "cmd.exe" -ArgumentList '/c npm run dev:local'
    Pop-Location

    Write-Host "All services started (Web using .env.localdev)."
}
finally {
    # Return to original directory
    Pop-Location
}
