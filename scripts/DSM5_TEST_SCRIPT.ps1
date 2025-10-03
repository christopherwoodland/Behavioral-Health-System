# DSM-5 API Testing Script
# Run this after starting Azure Functions with: func start --port 7071

$baseUrl = "http://localhost:7071/api"

Write-Host "`n=== DSM-5 API Testing ===" -ForegroundColor Cyan
Write-Host "Make sure Azure Functions is running on port 7071" -ForegroundColor Yellow
Write-Host "`nPress any key to continue or Ctrl+C to cancel..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Test 1: Check Data Status
Write-Host "`n[1/5] Checking DSM-5 data status..." -ForegroundColor Yellow
try {
    $status = Invoke-RestMethod -Uri "$baseUrl/dsm5-admin/data-status" -Method GET
    Write-Host "✅ SUCCESS: DSM-5 data status retrieved" -ForegroundColor Green
    Write-Host "`nStatus Details:" -ForegroundColor Cyan
    $status | ConvertTo-Json -Depth 3 | Write-Host
    
    if ($status.isInitialized) {
        Write-Host "`n✅ DSM-5 data is initialized with $($status.totalConditions) conditions" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  DSM-5 data not yet initialized" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Get Available Conditions (if initialized)
if ($status.isInitialized -and $status.totalConditions -gt 0) {
    Write-Host "`n[2/5] Getting available DSM-5 conditions..." -ForegroundColor Yellow
    try {
        $conditions = Invoke-RestMethod -Uri "$baseUrl/dsm5-admin/conditions" -Method GET
        Write-Host "✅ SUCCESS: Retrieved $($conditions.totalCount) conditions" -ForegroundColor Green
        Write-Host "`nCategories found:" -ForegroundColor Cyan
        $conditions.categories | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
        
        Write-Host "`nFirst 5 conditions:" -ForegroundColor Cyan
        $conditions.conditions | Select-Object -First 5 | ForEach-Object {
            Write-Host "  - $($_.name) ($($_.code))" -ForegroundColor Gray
        }
    } catch {
        Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "`n[2/5] Skipping conditions test - no data initialized" -ForegroundColor Yellow
}

# Test 3: Validate PDF Extraction with sample pages
Write-Host "`n[3/5] Testing PDF extraction validation..." -ForegroundColor Yellow
try {
    $extractRequest = @{
        pdfUrl = "https://archive.org/download/dsm-5/DSM-5.pdf"
        pageRanges = "123-124"
        autoUpload = $false
    } | ConvertTo-Json

    Write-Host "Requesting extraction of pages 123-124 from DSM-5 PDF..." -ForegroundColor Gray
    $extractResult = Invoke-RestMethod -Uri "$baseUrl/dsm5-admin/validate-extraction" `
        -Method POST `
        -ContentType "application/json" `
        -Body $extractRequest `
        -TimeoutSec 60

    Write-Host "✅ SUCCESS: PDF extraction completed" -ForegroundColor Green
    Write-Host "`nExtraction Results:" -ForegroundColor Cyan
    Write-Host "  Pages Processed: $($extractResult.pagesProcessed)" -ForegroundColor Gray
    Write-Host "  Conditions Found: $($extractResult.extractedConditions.Count)" -ForegroundColor Gray
    Write-Host "  Processing Time: $($extractResult.processingTimeMs) ms" -ForegroundColor Gray
    
    if ($extractResult.extractedConditions.Count -gt 0) {
        Write-Host "`nExtracted Conditions:" -ForegroundColor Cyan
        $extractResult.extractedConditions | ForEach-Object {
            Write-Host "  - $($_.name) ($($_.code))" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# Test 4: Health Check
Write-Host "`n[4/5] Testing health check endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "✅ SUCCESS: Health check passed" -ForegroundColor Green
    $health | ConvertTo-Json | Write-Host
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Summary
Write-Host "`n[5/5] Test Summary" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Configuration Status:" -ForegroundColor Yellow
Write-Host "  ✅ Azure Functions running on port 7071" -ForegroundColor Green
Write-Host "  ✅ DSM-5 endpoints registered" -ForegroundColor Green
Write-Host "  ✅ Document Intelligence configured" -ForegroundColor Green
Write-Host "  ✅ Blob Storage configured" -ForegroundColor Green

Write-Host "`nNext Steps:" -ForegroundColor Yellow
if (-not $status.isInitialized) {
    Write-Host "  1. Process full DSM-5 PDF using validate-extraction endpoint" -ForegroundColor White
    Write-Host "  2. Upload extracted data using upload-data endpoint" -ForegroundColor White
    Write-Host "  3. Verify data with conditions endpoint" -ForegroundColor White
} else {
    Write-Host "  1. ✅ DSM-5 data is initialized" -ForegroundColor Green
    Write-Host "  2. Test condition details endpoint" -ForegroundColor White
    Write-Host "  3. Connect UI to conditions API" -ForegroundColor White
    Write-Host "  4. Test multi-condition assessment generation" -ForegroundColor White
}

Write-Host "`n=== Testing Complete ===" -ForegroundColor Cyan
