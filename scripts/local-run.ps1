# local-run.ps1
# This script builds and runs the .NET Azure Functions project and starts the frontend dev server.

param(
    [bool]$UseAzuriteStorage = $true
)

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
    $damHealthUrl = "http://localhost:8000/health"
    $useAzuriteForRun = $UseAzuriteStorage

    if ($UseAzuriteStorage) {
        $azuriteReachable = $false
        try {
            $azuriteReachable = Test-NetConnection -ComputerName "127.0.0.1" -Port 10000 -InformationLevel Quiet
        }
        catch {
            $azuriteReachable = $false
        }

        if (-not $azuriteReachable) {
            Write-Warning "Azurite is not reachable on 127.0.0.1:10000. Attempting to start azurite via docker compose..."
            try {
                docker compose -f docker-compose.local.yml up -d azurite | Out-Null
                Start-Sleep -Seconds 2
                $azuriteReachable = Test-NetConnection -ComputerName "127.0.0.1" -Port 10000 -InformationLevel Quiet
            }
            catch {
                $azuriteReachable = $false
            }
        }

        if (-not $azuriteReachable) {
            Write-Warning "Azurite is still unavailable. Functions will start without forced Azurite env overrides."
            $useAzuriteForRun = $false
        }

        if (-not $useAzuriteForRun) {
            throw "Azurite is required for local Functions startup, but it is not available and Docker-based startup failed. Start Docker Desktop or an Azurite service, then rerun this script."
        }
    }

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
    $damMockMode = $false
    try {
        Invoke-RestMethod -Uri $damHealthUrl -Method Get -TimeoutSec 3 -ErrorAction Stop | Out-Null
        Write-Host "Local DAM server is reachable at $damHealthUrl"
    }
    catch {
        $damMockMode = $true
        Write-Warning "Local DAM server is not reachable at $damHealthUrl. Enabling DAM_MOCK_MODE=true for this Functions run."
    }

    if ($useAzuriteForRun) {
        # Force local storage emulation for Durable Functions and blob-backed services.
        # This prevents local host startup failures when cloud storage DNS is unavailable.
        $azuriteConnection = "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;"
        $funcCommand = "set AzureWebJobsStorage=$azuriteConnection && set AZURE_STORAGE_CONNECTION_STRING=$azuriteConnection && set DSM5_STORAGE_ACCOUNT_NAME=devstoreaccount1 && set AZURE_STORAGE_ACCOUNT_NAME=devstoreaccount1 && set DAM_MOCK_MODE=$damMockMode && func start"
        Start-Process "cmd.exe" -ArgumentList "/c $funcCommand"
    }
    Pop-Location

    Write-Host "Installing npm dependencies for web project..."
    Push-Location $webPath
    npm install
    Pop-Location

    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed. Exiting."
        exit $LASTEXITCODE
    }

    Write-Host "Starting frontend dev server..."
    Push-Location $webPath
    # Use the standard dev npm script which runs Vite in development mode
    # This loads .env.development for configuration
    Start-Process "cmd.exe" -ArgumentList '/c npm run dev'
    Pop-Location

    Write-Host "All services started."
}
finally {
    # Return to original directory
    Pop-Location
}
