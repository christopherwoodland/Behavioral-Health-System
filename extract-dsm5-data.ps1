# DSM-5 PDF Extraction Test Script
# Tests the new DSM-5 administration functions

param(
    [string]$FunctionBaseUrl = "http://localhost:7071",
    [string]$PdfUrl = "https://nam06.safelinks.protection.outlook.com/?url=https%3A%2F%2Fdn790004.ca.archive.org%2F0%2Fitems%2FAPA-DSM-5%2FDSM5.pdf&data=05%7C02%7Ccwoodland%40microsoft.com%7Ca70ee040834b4bc7731a08de010101b6%7C72f988bf86f141af91ab2d7cd011db47%7C1%7C0%7C638949301152507492%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=PFfJoAWz%2FCUsmWY6xfU4Q%2BRXnMn5HNURF2zA1oyOBhc%3D&reserved=0",
    [string]$PageRanges = "123-124",
    [string]$FunctionKey = "default"
)

Write-Host "=== DSM-5 PDF Extraction Test ===" -ForegroundColor Cyan

Write-Host ""    URL to the DSM-5 PDF document. Defaults to archive.org public PDF.



# Test 1: Check DSM-5 data status.PARAMETER PageRanges

Write-Host "1. Checking DSM-5 data status..." -ForegroundColor Yellow    Optional page ranges to process (e.g., "50-100", "123-150,200-250").

try {    If not specified, processes the entire PDF.

    $statusResponse = Invoke-RestMethod -Uri "$FunctionBaseUrl/api/dsm5-admin/data-status" -Method GET -ErrorAction Stop

    Write-Host "[SUCCESS] DSM-5 Data Status:" -ForegroundColor Green.PARAMETER DocumentIntelligenceEndpoint

    $statusResponse | ConvertTo-Json -Depth 5 | Write-Host    Azure AI Document Intelligence endpoint URL.

} catch {    If not specified, reads from local.settings.json.

    Write-Host "[ERROR] Getting data status: $($_.Exception.Message)" -ForegroundColor Red

}.PARAMETER DocumentIntelligenceKey

    Azure AI Document Intelligence API key.

Write-Host ""    If not specified, reads from local.settings.json.



# Test 2: Extract and validate DSM-5 data from PDF.PARAMETER StorageConnectionString

Write-Host "2. Testing DSM-5 PDF extraction (pages $PageRanges)..." -ForegroundColor Yellow    Azure Storage connection string.

try {    If not specified, reads from local.settings.json.

    $extractionBody = @{

        pdfUrl = $PdfUrl.PARAMETER ContainerName

        pageRanges = $PageRanges    Blob storage container name. Defaults to "dsm5-content".

        autoUpload = $false

    } | ConvertTo-Json.PARAMETER AutoUpload

    If specified, automatically uploads to blob storage if validation passes (≥70% success rate).

    $extractionResponse = Invoke-RestMethod -Uri "$FunctionBaseUrl/api/dsm5-admin/validate-extraction?code=$FunctionKey" -Method POST -ContentType "application/json" -Body $extractionBody -ErrorAction Stop    Otherwise, just extracts and validates without uploading.

    

    Write-Host "[SUCCESS] DSM-5 Extraction:" -ForegroundColor Green.PARAMETER SkipValidation

    $extractionResponse | ConvertTo-Json -Depth 3 | Write-Host    If specified, skips validation and uploads immediately.

} catch {

    Write-Host "[ERROR] DSM-5 extraction: $($_.Exception.Message)" -ForegroundColor Red.PARAMETER Force

    if ($_.Exception.Response) {    If specified, overwrites existing blob files without prompting.

        $errorDetails = $_.Exception.Response.GetResponseStream()

        $reader = New-Object System.IO.StreamReader($errorDetails).EXAMPLE

        $errorBody = $reader.ReadToEnd()    .\extract-dsm5-data.ps1

        Write-Host "Error details: $errorBody" -ForegroundColor Red    Extracts entire DSM-5 PDF using settings from local.settings.json, validates but does not upload.

    }

}.EXAMPLE

    .\extract-dsm5-data.ps1 -PageRanges "123-150" -AutoUpload

Write-Host ""    Extracts pages 123-150, validates, and uploads if success rate ≥70%.



# Test 3: Get available DSM-5 conditions (if any were uploaded).EXAMPLE

Write-Host "3. Getting available DSM-5 conditions..." -ForegroundColor Yellow    .\extract-dsm5-data.ps1 -AutoUpload -Force

try {    Extracts entire PDF, uploads all results, overwrites existing files.

    $conditionsResponse = Invoke-RestMethod -Uri "$FunctionBaseUrl/api/dsm5-admin/conditions" -Method GET -ErrorAction Stop

    Write-Host "[SUCCESS] Available Conditions:" -ForegroundColor Green.EXAMPLE

    $conditionsResponse | ConvertTo-Json -Depth 2 | Write-Host    .\extract-dsm5-data.ps1 -PageRanges "50-100,200-250"

} catch {    Extracts specific page ranges for testing (pages 50-100 and 200-250).

    Write-Host "[ERROR] Getting conditions: $($_.Exception.Message)" -ForegroundColor Red#>

}

[CmdletBinding()]

Write-Host ""param(

    [string]$PdfUrl = "https://dn790004.ca.archive.org/0/items/APA-DSM-5/DSM5.pdf",

# Test 4: Test extraction with auto-upload (small page range)    

Write-Host "4. Testing extraction with auto-upload..." -ForegroundColor Yellow    [string]$PageRanges = "",

try {    

    $uploadBody = @{    [string]$DocumentIntelligenceEndpoint = "",

        pdfUrl = $PdfUrl    

        pageRanges = "123-123"  # Just one page for testing    [string]$DocumentIntelligenceKey = "",

        autoUpload = $true    

    } | ConvertTo-Json    [string]$StorageConnectionString = "",

    

    $uploadResponse = Invoke-RestMethod -Uri "$FunctionBaseUrl/api/dsm5-admin/validate-extraction?code=$FunctionKey" -Method POST -ContentType "application/json" -Body $uploadBody -ErrorAction Stop    [string]$ContainerName = "dsm5-content",

        

    Write-Host "[SUCCESS] Extraction with Auto-Upload:" -ForegroundColor Green    [switch]$AutoUpload,

    $uploadResponse | ConvertTo-Json -Depth 3 | Write-Host    

} catch {    [switch]$SkipValidation,

    Write-Host "[ERROR] Extraction with upload: $($_.Exception.Message)" -ForegroundColor Red    

}    [switch]$Force

)

Write-Host ""

# ============================================================================

Write-Host "=== DSM-5 Test Complete ===" -ForegroundColor Cyan# CONFIGURATION

Write-Host ""# ============================================================================

Write-Host "Next steps:" -ForegroundColor White

Write-Host "1. Review extraction results and adjust parsing logic if needed" -ForegroundColor Gray$ErrorActionPreference = "Stop"

Write-Host "2. Configure Azure Document Intelligence and Blob Storage connections" -ForegroundColor Gray$ProgressPreference = "SilentlyContinue"

Write-Host "3. Process full DSM-5 PDF for complete condition catalog" -ForegroundColor Gray

Write-Host "4. Integrate with extended assessment system" -ForegroundColor Gray$LocalSettingsPath = "BehavioralHealthSystem.Functions\local.settings.json"
$FunctionsProjectPath = "BehavioralHealthSystem.Functions\BehavioralHealthSystem.Functions.csproj"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-Banner {
    param([string]$Text)
    Write-Host ""
    Write-Host ("=" * 80) -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Text)
    Write-Host ""
    Write-Host ("─" * 80) -ForegroundColor DarkCyan
    Write-Host "  $Text" -ForegroundColor Yellow
    Write-Host ("─" * 80) -ForegroundColor DarkCyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "✅ $Text" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Text)
    Write-Host "⚠️  $Text" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Text)
    Write-Host "❌ $Text" -ForegroundColor Red
}

function Write-Info {
    param([string]$Text)
    Write-Host "ℹ️  $Text" -ForegroundColor Cyan
}

function Get-LocalSettings {
    if (-not (Test-Path $LocalSettingsPath)) {
        Write-Error "local.settings.json not found at: $LocalSettingsPath"
        throw "Configuration file not found"
    }
    
    $settings = Get-Content $LocalSettingsPath -Raw | ConvertFrom-Json
    return $settings.Values
}

function Get-ConfigValue {
    param(
        [string]$ParamValue,
        [string]$SettingName,
        [string]$DisplayName
    )
    
    if ($ParamValue) {
        Write-Info "$DisplayName provided via parameter"
        return $ParamValue
    }
    
    $settings = Get-LocalSettings
    $value = $settings.$SettingName
    
    if (-not $value) {
        Write-Error "$DisplayName not found in parameters or local.settings.json"
        throw "Missing configuration: $SettingName"
    }
    
    Write-Info "$DisplayName loaded from local.settings.json"
    return $value
}

function Test-FunctionsProject {
    if (-not (Test-Path $FunctionsProjectPath)) {
        Write-Error "Functions project not found at: $FunctionsProjectPath"
        throw "Project file not found"
    }
    
    # Check for Azure.AI.FormRecognizer package
    $projectContent = Get-Content $FunctionsProjectPath -Raw
    if ($projectContent -notmatch "Azure\.AI\.FormRecognizer") {
        Write-Warning "Azure.AI.FormRecognizer package may not be installed"
        Write-Info "Run: dotnet add BehavioralHealthSystem.Functions package Azure.AI.FormRecognizer"
        
        $install = Read-Host "Install package now? (y/n)"
        if ($install -eq "y") {
            Push-Location "BehavioralHealthSystem.Functions"
            dotnet add package Azure.AI.FormRecognizer
            Pop-Location
            Write-Success "Package installed"
        } else {
            throw "Required package not installed"
        }
    }
    
    Write-Success "Functions project validated"
}

function Build-FunctionsProject {
    Write-Section "Building Functions Project"
    
    Push-Location "BehavioralHealthSystem.Functions"
    try {
        Write-Info "Running dotnet build..."
        $buildOutput = dotnet build --configuration Release 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Build failed"
            Write-Host $buildOutput
            throw "Build failed with exit code $LASTEXITCODE"
        }
        
        Write-Success "Build completed successfully"
    } finally {
        Pop-Location
    }
}

function Invoke-PdfExtraction {
    param(
        [string]$Endpoint,
        [string]$Key,
        [string]$Url,
        [string]$Pages
    )
    
    Write-Section "Extracting DSM-5 Data from PDF"
    
    $body = @{
        pdfUrl = $Url
        autoUpload = $false
    }
    
    if ($Pages) {
        $body.pageRanges = $Pages
        Write-Info "Processing page ranges: $Pages"
    } else {
        Write-Info "Processing entire PDF (~900 pages)"
        Write-Warning "This may take 1-5 minutes depending on Azure tier (Free: ~45 min with throttling)"
    }
    
    # Build Functions app if not already built
    $dllPath = "BehavioralHealthSystem.Functions\bin\Release\net8.0\BehavioralHealthSystem.Functions.dll"
    if (-not (Test-Path $dllPath)) {
        Build-FunctionsProject
    }
    
    Write-Info "Loading Functions assembly..."
    Add-Type -Path $dllPath
    
    # Load dependencies
    $helpersPath = "BehavioralHealthSystem.Helpers\bin\Release\net8.0\BehavioralHealthSystem.Helpers.dll"
    if (-not (Test-Path $helpersPath)) {
        Write-Info "Building Helpers project..."
        Push-Location "BehavioralHealthSystem.Helpers"
        dotnet build --configuration Release | Out-Null
        Pop-Location
    }
    Add-Type -Path $helpersPath
    
    Write-Info "Starting extraction..."
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    # Call extraction service directly
    try {
        # This would require instantiating the service and calling methods
        # For now, we'll use the HTTP endpoint approach which is simpler
        Write-Warning "Direct service invocation requires running Functions host"
        Write-Info "Using HTTP endpoint approach instead..."
        
        return $null
    } catch {
        Write-Error "Extraction failed: $($_.Exception.Message)"
        throw
    }
}

function Start-FunctionsHost {
    Write-Section "Starting Azure Functions Host"
    
    # Check if already running
    $funcProcess = Get-Process -Name "func" -ErrorAction SilentlyContinue
    if ($funcProcess) {
        Write-Info "Functions host already running (PID: $($funcProcess.Id))"
        return $true
    }
    
    Write-Info "Starting Functions host in background..."
    
    Push-Location "BehavioralHealthSystem.Functions"
    try {
        Start-Process -FilePath "func" -ArgumentList "start","--port","7071" -WindowStyle Hidden
        Start-Sleep -Seconds 10
        
        $funcProcess = Get-Process -Name "func" -ErrorAction SilentlyContinue
        if ($funcProcess) {
            Write-Success "Functions host started (PID: $($funcProcess.Id))"
            
            # Wait for host to be ready
            $maxWait = 30
            $waited = 0
            while ($waited -lt $maxWait) {
                $listening = netstat -ano | Select-String ":7071.*LISTENING"
                if ($listening) {
                    Write-Success "Functions host is listening on port 7071"
                    return $true
                }
                Start-Sleep -Seconds 2
                $waited += 2
            }
            
            Write-Warning "Functions host started but may not be fully initialized"
            return $true
        } else {
            Write-Error "Failed to start Functions host"
            return $false
        }
    } finally {
        Pop-Location
    }
}

function Invoke-ExtractionEndpoint {
    param(
        [string]$Url,
        [string]$Pages,
        [bool]$Upload
    )
    
    Write-Section "Calling PDF Extraction Endpoint"
    
    $body = @{
        pdfUrl = $Url
        autoUpload = $Upload
    } | ConvertTo-Json
    
    if ($Pages) {
        $bodyObj = $body | ConvertFrom-Json
        $bodyObj | Add-Member -NotePropertyName "pageRanges" -NotePropertyValue $Pages
        $body = $bodyObj | ConvertTo-Json
    }
    
    $endpoint = "http://localhost:7071/api/admin/dsm5/extract-from-pdf?code=default"
    
    Write-Info "Endpoint: $endpoint"
    Write-Info "Request body: $body"
    
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        $result = Invoke-RestMethod `
            -Uri $endpoint `
            -Method Post `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec 600
        
        $stopwatch.Stop()
        Write-Success "Extraction completed in $($stopwatch.Elapsed.TotalSeconds) seconds"
        
        return $result
    } catch {
        $stopwatch.Stop()
        Write-Error "Extraction failed after $($stopwatch.Elapsed.TotalSeconds) seconds"
        Write-Error "Error: $($_.Exception.Message)"
        
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            if ($responseBody) {
                Write-Error "Response: $responseBody"
            }
        }
        
        throw
    }
}

function Show-ExtractionResults {
    param($Result)
    
    Write-Section "Extraction Results"
    
    Write-Host "📊 SUMMARY:" -ForegroundColor Yellow
    Write-Host "  Conditions extracted: $($Result.extractedCount)" -ForegroundColor White
    Write-Host "  Conditions uploaded:  $($Result.uploadedCount)" -ForegroundColor White
    Write-Host ""
    
    if ($Result.validation) {
        $validation = $Result.validation
        Write-Host "📋 VALIDATION:" -ForegroundColor Yellow
        Write-Host "  Success rate:     $($validation.successRate)%" -ForegroundColor White
        Write-Host "  Total conditions: $($validation.totalConditions)" -ForegroundColor White
        Write-Host "  Valid conditions: $($validation.validConditions)" -ForegroundColor White
        Write-Host "  Total issues:     $($validation.totalIssues)" -ForegroundColor White
        Write-Host ""
        
        if ($validation.issues -and $validation.issues.Count -gt 0) {
            Write-Host "⚠️  ISSUES FOUND:" -ForegroundColor Yellow
            
            $criticalIssues = $validation.issues | Where-Object { $_.severity -eq "Critical" }
            $errorIssues = $validation.issues | Where-Object { $_.severity -eq "Error" }
            $warningIssues = $validation.issues | Where-Object { $_.severity -eq "Warning" }
            
            if ($criticalIssues) {
                Write-Host "  🔴 Critical: $($criticalIssues.Count)" -ForegroundColor Red
                $criticalIssues | Select-Object -First 5 | ForEach-Object {
                    Write-Host "     - $($_.conditionName): $($_.description)" -ForegroundColor Red
                }
            }
            
            if ($errorIssues) {
                Write-Host "  🟠 Errors: $($errorIssues.Count)" -ForegroundColor DarkYellow
                $errorIssues | Select-Object -First 5 | ForEach-Object {
                    Write-Host "     - $($_.conditionName): $($_.description)" -ForegroundColor DarkYellow
                }
            }
            
            if ($warningIssues) {
                Write-Host "  🟡 Warnings: $($warningIssues.Count)" -ForegroundColor Yellow
            }
            
            Write-Host ""
        }
        
        if ($validation.successRate -ge 70) {
            Write-Success "Validation passed (≥70% success rate)"
        } else {
            Write-Warning "Validation success rate below threshold (70%)"
            Write-Info "Review issues and consider refining parsing logic"
        }
    }
    
    if ($Result.sampleConditions -and $Result.sampleConditions.Count -gt 0) {
        Write-Host ""
        Write-Host "📝 SAMPLE CONDITIONS (first 3):" -ForegroundColor Yellow
        $Result.sampleConditions | Select-Object -First 3 | ForEach-Object {
            Write-Host "  • $($_.name) ($($_.dsm5Code))" -ForegroundColor Cyan
            Write-Host "    Category: $($_.category)" -ForegroundColor Gray
            Write-Host "    Criteria count: $($_.criteria.Count)" -ForegroundColor Gray
            if ($_.icd10Codes) {
                Write-Host "    ICD-10: $($_.icd10Codes -join ', ')" -ForegroundColor Gray
            }
            Write-Host ""
        }
    }
}

# ============================================================================
# MAIN SCRIPT
# ============================================================================

try {
    Write-Banner "DSM-5 Data Extraction Tool"
    
    # Validate environment
    Write-Section "Validating Environment"
    
    if (-not (Test-Path $LocalSettingsPath)) {
        Write-Error "Not in BehavioralHealthSystem root directory"
        Write-Info "Please run this script from the repository root"
        exit 1
    }
    
    Test-FunctionsProject
    
    # Load configuration
    Write-Section "Loading Configuration"
    
    $endpoint = Get-ConfigValue $DocumentIntelligenceEndpoint "DocumentIntelligenceEndpoint" "Document Intelligence Endpoint"
    $key = Get-ConfigValue $DocumentIntelligenceKey "DocumentIntelligenceKey" "Document Intelligence Key"
    $connectionString = Get-ConfigValue $StorageConnectionString "AzureWebJobsStorage" "Storage Connection String"
    
    Write-Success "Configuration loaded"
    Write-Info "PDF URL: $PdfUrl"
    Write-Info "Container: $ContainerName"
    
    if ($PageRanges) {
        Write-Info "Page ranges: $PageRanges"
    } else {
        Write-Warning "Processing entire PDF (~900 pages)"
    }
    
    if ($AutoUpload) {
        Write-Info "Auto-upload: ENABLED (will upload if validation ≥70%)"
    } else {
        Write-Warning "Auto-upload: DISABLED (extract and validate only)"
    }
    
    # Start Functions host
    $hostStarted = Start-FunctionsHost
    if (-not $hostStarted) {
        Write-Error "Failed to start Functions host"
        Write-Info "Please start Functions host manually: cd BehavioralHealthSystem.Functions; func start"
        exit 1
    }
    
    # Wait a bit more to ensure host is fully ready
    Write-Info "Waiting for Functions host to fully initialize..."
    Start-Sleep -Seconds 5
    
    # Call extraction endpoint
    $result = Invoke-ExtractionEndpoint -Url $PdfUrl -Pages $PageRanges -Upload $AutoUpload.IsPresent
    
    # Show results
    Show-ExtractionResults $result
    
    # Summary
    Write-Banner "Extraction Complete"
    
    if ($result.uploadedCount -gt 0) {
        Write-Success "Successfully uploaded $($result.uploadedCount) conditions to blob storage"
        Write-Info "Container: $ContainerName"
        Write-Info "Files: dsm5-index.json, dsm5-categories.json, criteria/*.json"
    } elseif ($AutoUpload) {
        Write-Warning "No files uploaded (validation success rate below 70%)"
        Write-Info "Review validation issues and try again"
    } else {
        Write-Info "Extraction completed (auto-upload not enabled)"
        Write-Info "Run with -AutoUpload flag to upload results"
    }
    
    Write-Host ""
    Write-Info "Next steps:"
    if (-not $AutoUpload) {
        Write-Host "  1. Review validation results above" -ForegroundColor White
        Write-Host "  2. If satisfied, run again with -AutoUpload flag" -ForegroundColor White
        Write-Host "     Example: .\extract-dsm5-data.ps1 -AutoUpload" -ForegroundColor White
    } else {
        Write-Host "  1. Verify data in Azure Storage Explorer" -ForegroundColor White
        Write-Host "  2. Test API endpoints:" -ForegroundColor White
        Write-Host "     GET http://localhost:7071/api/dsm5/conditions" -ForegroundColor White
        Write-Host "  3. Proceed with Phase 2 (multi-condition backend integration)" -ForegroundColor White
    }
    
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Error "Script failed: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Stack trace:" -ForegroundColor Gray
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    Write-Host ""
    exit 1
} finally {
    # Cleanup
    if ($PSBoundParameters.ContainsKey('Debug') -and -not $Debug) {
        # Don't stop Functions host if user wants to debug
        $cleanup = Read-Host "Stop Functions host? (y/n)"
        if ($cleanup -eq "y") {
            $funcProcess = Get-Process -Name "func" -ErrorAction SilentlyContinue
            if ($funcProcess) {
                Stop-Process -Id $funcProcess.Id -Force
                Write-Success "Functions host stopped"
            }
        }
    }
}
