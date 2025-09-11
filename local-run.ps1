# local-run.ps1
# This script builds and runs the .NET Azure Functions project and starts the frontend dev server.

# Set strict mode
Set-StrictMode -Version Latest

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
