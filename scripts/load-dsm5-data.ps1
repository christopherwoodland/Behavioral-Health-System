# DSM-5 Data Loading Script
# This script extracts DSM-5 conditions from the PDF and uploads them to Azure Storage

param(
    [Parameter(Mandatory=$false)]
    [string]$PdfPath = "C:\DSM5\dsm5.pdf",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiBaseUrl = "http://localhost:7071/api",
    
    [Parameter(Mandatory=$false)]
    [int[]]$PageRange = @(1, 991)  # Full DSM-5 manual range
)

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  DSM-5 Data Loading Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if PDF exists
if (-not (Test-Path $PdfPath)) {
    Write-Host "[ERROR] PDF file not found at: $PdfPath" -ForegroundColor Red
    Write-Host "Please provide the path to your DSM-5 PDF file." -ForegroundColor Yellow
    exit 1
}

Write-Host "[PDF] File: $PdfPath" -ForegroundColor Green
Write-Host "[API] URL: $ApiBaseUrl" -ForegroundColor Green
Write-Host "[PAGES] Range: $($PageRange[0]) to $($PageRange[1])" -ForegroundColor Green
Write-Host ""

# Step 1: Check system status
Write-Host "Step 1: Checking DSM-5 system status..." -ForegroundColor Cyan
try {
    $statusResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/dsm5-admin/data-status" -Method GET
    Write-Host "[SUCCESS] System Status:" -ForegroundColor Green
    $statusResponse | ConvertTo-Json -Depth 3
    Write-Host ""
}
catch {
    Write-Host "[ERROR] Cannot connect to API. Is the Functions host running?" -ForegroundColor Red
    Write-Host "   Run: cd BehavioralHealthSystem.Functions; func start --port 7071" -ForegroundColor Yellow
    exit 1
}

# Step 2: Extract and validate PDF data
Write-Host "Step 2: Extracting DSM-5 data from PDF..." -ForegroundColor Cyan
Write-Host "This may take several minutes..." -ForegroundColor Yellow

# Read PDF file as base64
$pdfBytes = [System.IO.File]::ReadAllBytes($PdfPath)
$pdfBase64 = [Convert]::ToBase64String($pdfBytes)

$extractRequest = @{
    pdfData = $pdfBase64
    startPage = $PageRange[0]
    endPage = $PageRange[1]
    extractConditionsOnly = $true
}

$extractRequestJson = $extractRequest | ConvertTo-Json

try {
    Write-Host "   [SENDING] PDF to Document Intelligence..." -ForegroundColor Gray
    $extractResponse = Invoke-RestMethod `
        -Uri "$ApiBaseUrl/dsm5-admin/validate-extraction" `
        -Method POST `
        -Body $extractRequestJson `
        -ContentType "application/json"
    
    if ($extractResponse.success) {
        Write-Host "[SUCCESS] Extraction successful!" -ForegroundColor Green
        Write-Host "   Conditions found: $($extractResponse.conditionsFound)" -ForegroundColor Green
        Write-Host "   Processing time: $($extractResponse.processingTimeMs)ms" -ForegroundColor Gray
        Write-Host ""
    }
    else {
        Write-Host "[ERROR] Extraction failed: $($extractResponse.message)" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "[ERROR] during extraction: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Upload extracted data to Azure Storage
Write-Host "Step 3: Uploading extracted data to Azure Storage..." -ForegroundColor Cyan

$uploadRequest = @{
    extractedData = $extractResponse.extractedData
    overwriteExisting = $true
}

$uploadRequestJson = $uploadRequest | ConvertTo-Json -Depth 10

try {
    $uploadResponse = Invoke-RestMethod `
        -Uri "$ApiBaseUrl/dsm5-admin/upload-data" `
        -Method POST `
        -Body $uploadRequestJson `
        -ContentType "application/json"
    
    if ($uploadResponse.success) {
        Write-Host "[SUCCESS] Upload successful!" -ForegroundColor Green
        Write-Host "   Conditions uploaded: $($uploadResponse.conditionsUploaded)" -ForegroundColor Green
        Write-Host "   Blob URL: $($uploadResponse.blobUrl)" -ForegroundColor Gray
        Write-Host ""
    }
    else {
        Write-Host "[ERROR] Upload failed: $($uploadResponse.message)" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "[ERROR] during upload: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Verify data is available
Write-Host "Step 4: Verifying DSM-5 conditions are available..." -ForegroundColor Cyan

try {
    $conditionsResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/dsm5-admin/conditions" -Method GET
    
    if ($conditionsResponse.success) {
        Write-Host "[SUCCESS] Verification successful!" -ForegroundColor Green
        Write-Host "   Total conditions: $($conditionsResponse.totalConditions)" -ForegroundColor Green
        Write-Host "   Categories: $($conditionsResponse.categories.Count)" -ForegroundColor Green
        Write-Host ""
        
        # Show first 5 conditions as sample
        Write-Host "Sample conditions:" -ForegroundColor Yellow
        $conditionsResponse.conditions | Select-Object -First 5 | ForEach-Object {
            Write-Host "   * $($_.name) ($($_.code))" -ForegroundColor Gray
        }
        Write-Host ""
    }
    else {
        Write-Host "[WARNING] Could not verify conditions" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "[WARNING] Verification failed: $_" -ForegroundColor Yellow
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] DSM-5 Data Loading Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Refresh your React app (Ctrl+F5)" -ForegroundColor White
Write-Host "2. Navigate to a session's Extended Risk Assessment" -ForegroundColor White
Write-Host "3. Select DSM-5 conditions from the dropdown" -ForegroundColor White
Write-Host "4. Run the extended assessment" -ForegroundColor White
Write-Host ""
