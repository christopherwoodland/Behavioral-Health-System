# DSM-5 PDF Extraction Test Script
# Tests the new DSM-5 administration functions

param(
    [string]$FunctionBaseUrl = "http://localhost:7071",
    [string]$PdfUrl = "https://dn790004.ca.archive.org/0/items/APA-DSM-5/DSM5.pdf",
    [string]$PageRanges = "123-124",
    [string]$FunctionKey = "default"
)

Write-Host "=== DSM-5 PDF Extraction Test ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check DSM-5 data status
Write-Host "1. Checking DSM-5 data status..." -ForegroundColor Yellow
try {
    $statusResponse = Invoke-RestMethod -Uri "$FunctionBaseUrl/api/dsm5-admin/data-status" -Method GET -ErrorAction Stop
    Write-Host "[SUCCESS] DSM-5 Data Status:" -ForegroundColor Green
    $statusResponse | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "[ERROR] Getting data status: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Extract and validate DSM-5 data from PDF
Write-Host "2. Testing DSM-5 PDF extraction (pages $PageRanges)..." -ForegroundColor Yellow
try {
    $extractionBody = @{
        pdfUrl = $PdfUrl
        pageRanges = $PageRanges
        autoUpload = $false
    } | ConvertTo-Json

    $extractionResponse = Invoke-RestMethod -Uri "$FunctionBaseUrl/api/dsm5-admin/validate-extraction?code=$FunctionKey" -Method POST -ContentType "application/json" -Body $extractionBody -ErrorAction Stop
    
    Write-Host "[SUCCESS] DSM-5 Extraction:" -ForegroundColor Green
    $extractionResponse | ConvertTo-Json -Depth 3 | Write-Host
} catch {
    Write-Host "[ERROR] DSM-5 extraction: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorDetails = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorDetails)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 3: Get available DSM-5 conditions (if any were uploaded)
Write-Host "3. Getting available DSM-5 conditions..." -ForegroundColor Yellow
try {
    $conditionsResponse = Invoke-RestMethod -Uri "$FunctionBaseUrl/api/dsm5-admin/conditions" -Method GET -ErrorAction Stop
    Write-Host "[SUCCESS] Available Conditions:" -ForegroundColor Green
    $conditionsResponse | ConvertTo-Json -Depth 2 | Write-Host
} catch {
    Write-Host "[ERROR] Getting conditions: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Test extraction with auto-upload (small page range)
Write-Host "4. Testing extraction with auto-upload..." -ForegroundColor Yellow
try {
    $uploadBody = @{
        pdfUrl = $PdfUrl
        pageRanges = "123-123"  # Just one page for testing
        autoUpload = $true
    } | ConvertTo-Json

    $uploadResponse = Invoke-RestMethod -Uri "$FunctionBaseUrl/api/dsm5-admin/validate-extraction?code=$FunctionKey" -Method POST -ContentType "application/json" -Body $uploadBody -ErrorAction Stop
    
    Write-Host "[SUCCESS] Extraction with Auto-Upload:" -ForegroundColor Green
    $uploadResponse | ConvertTo-Json -Depth 3 | Write-Host
} catch {
    Write-Host "[ERROR] Extraction with upload: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

Write-Host "=== DSM-5 Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Review extraction results and adjust parsing logic if needed" -ForegroundColor Gray
Write-Host "2. Configure Azure Document Intelligence and Blob Storage connections" -ForegroundColor Gray
Write-Host "3. Process full DSM-5 PDF for complete condition catalog" -ForegroundColor Gray
Write-Host "4. Integrate with extended assessment system" -ForegroundColor Gray