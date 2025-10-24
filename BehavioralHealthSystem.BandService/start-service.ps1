# Quick Start Script for Microsoft Band Service
# This script builds and runs the Band Service for development

Write-Host "🏃 Microsoft Band Service - Quick Start" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "BehavioralHealthSystem.BandService.csproj")) {
    Write-Host "❌ Error: Must run this script from the BandService directory" -ForegroundColor Red
    Write-Host "   Current directory: $PWD" -ForegroundColor Yellow
    Write-Host "   Expected: BehavioralHealthSystem.BandService" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Building Band Service..." -ForegroundColor Yellow
dotnet build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Check errors above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build successful!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Starting Band Service..." -ForegroundColor Cyan
Write-Host "   Service will run on: http://localhost:8765" -ForegroundColor White
Write-Host "   Swagger UI: http://localhost:8765/swagger" -ForegroundColor White
Write-Host ""
Write-Host "📋 Available endpoints:" -ForegroundColor Yellow
Write-Host "   GET  /api/band/health      - Health check" -ForegroundColor White
Write-Host "   GET  /api/band/status      - Device status" -ForegroundColor White
Write-Host "   POST /api/band/collect     - Collect sensor data" -ForegroundColor White
Write-Host "   GET  /api/band/device-info - Device information" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the service" -ForegroundColor Gray
Write-Host ""

# Run the service
dotnet run
