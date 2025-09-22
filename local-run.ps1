# local-run.ps1
# This script builds and runs the .NET Azure Functions project and starts the frontend dev server.

# Set strict mode
Set-StrictMode -Version Latest

# Function to stop processes on a specific port
function Stop-ProcessOnPort {
    param([int]$Port)
    
    try {
        # Get processes listening on the specified port
        $processIds = @(netstat -ano | Select-String ":$Port " | ForEach-Object {
            $line = $_.Line.Trim() -split '\s+'
            if ($line.Length -ge 5 -and $line[1] -like "*:$Port") {
                $line[-1]  # Last element is the PID
            }
        } | Where-Object { $_ -and $_ -ne "0" } | Sort-Object -Unique)
        
        foreach ($processId in $processIds) {
            if ($processId -match '^\d+$') {
                Write-Host "Stopping process $processId using port $Port..."
                try {
                    Stop-Process -Id $processId -Force -ErrorAction Stop
                    Write-Host "Successfully stopped process $processId"
                } catch {
                    Write-Host "Failed to stop process $processId - it may have already stopped"
                }
            }
        }
        
        if ($processIds.Count -eq 0) {
            Write-Host "No processes found using port $Port"
        }
    } catch {
        Write-Host "Error checking port $Port : $($_.Exception.Message)"
    }
}

# Kill any existing processes on our target ports
Write-Host "Checking for existing processes on ports 5173 and 7071..."
Stop-ProcessOnPort -Port 5173
Stop-ProcessOnPort -Port 7071

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

# Paths
$functionsPath = "./BehavioralHealthSystem.Functions"
$webPath = "./BehavioralHealthSystem.Web"

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

Write-Host "Starting frontend dev server..."
Push-Location $webPath
Start-Process "cmd.exe" -ArgumentList '/c npm run dev'
Pop-Location

Write-Host "All services started."
