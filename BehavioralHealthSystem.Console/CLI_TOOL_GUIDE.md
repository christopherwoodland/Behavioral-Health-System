# Behavioral Health System - CLI Tool Guide

Command-line tool for administrative operations including DSM-5 data import.

## Overview

The `bhs` CLI tool provides administrative capabilities for the Behavioral Health System, including:
- **DSM-5 Import**: Extract diagnostic conditions from DSM-5 PDF and upload to Azure Storage
- More administrative commands coming soon...

## Installation

### Build from Source

```powershell
cd BehavioralHealthSystem.Console
dotnet build -c Release
```

The compiled executable will be at:
```
bin\Release\net8.0\bhs.exe
```

### Optional: Add to PATH

For easier access, add the build directory to your PATH or copy `bhs.exe` to a directory in your PATH.

## Prerequisites

### For DSM-5 Import

1. **Azure Functions Host Running**
   ```powershell
   cd BehavioralHealthSystem.Functions
   func start --port 7071
   ```

2. **DSM-5 PDF File**
   - Obtain the official DSM-5 manual PDF
   - Note the file path for the import command

3. **Azure Configuration**
   - Document Intelligence service configured in `local.settings.json`
   - Blob Storage connection string configured
   - See main README for setup instructions

## Commands

### import-dsm5

Import DSM-5 diagnostic conditions from PDF into Azure Storage.

**Usage:**
```powershell
bhs import-dsm5 [options]
```

**Options:**

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--pdf-path <path>` | `-p` | Path to DSM-5 PDF file | `C:\DSM5\dsm5.pdf` |
| `--api-url <url>` | `-u` | Base URL of Functions API | `http://localhost:7071/api` |
| `--start-page <number>` | | Starting page for extraction | `1` |
| `--end-page <number>` | | Ending page for extraction | `991` |
| `--verbose` | `-v` | Enable verbose logging | `false` |

**Examples:**

```powershell
# Basic usage with default settings
bhs import-dsm5

# Specify custom PDF path
bhs import-dsm5 --pdf-path "C:\Users\yourname\Documents\DSM5.pdf"

# Import with verbose logging
bhs import-dsm5 -p "C:\DSM5\dsm5.pdf" -v

# Import specific page range (for testing)
bhs import-dsm5 --start-page 50 --end-page 100

# Use different API endpoint (deployed environment)
bhs import-dsm5 --api-url "https://your-functions-app.azurewebsites.net/api"
```

**Process:**

The import-dsm5 command executes these steps:

1. **Validate Prerequisites**
   - Checks PDF file exists and is readable
   - Displays file size information

2. **Check System Status**
   - Verifies API connectivity
   - Checks DSM-5 service availability

3. **Extract PDF Data** (longest step)
   - Reads PDF file and encodes to base64
   - Sends to Azure Document Intelligence service
   - Extracts diagnostic conditions using AI
   - Reports conditions found and processing time

4. **Upload to Storage**
   - Uploads extracted data to Azure Blob Storage
   - Creates `conditions.json` in `dsm5-data` container
   - Reports upload success and blob URL

5. **Verify Availability**
   - Queries API to confirm conditions are accessible
   - Displays sample conditions
   - Reports total conditions and categories

**Expected Output:**

```
==================================================
  DSM-5 Data Import Tool
==================================================

PDF File: C:\DSM5\dsm5.pdf
API URL: http://localhost:7071/api
Page Range: 1 to 991

Step 1/5: Validating prerequisites
✓ PDF file found (42.18 MB)

Step 2/5: Checking DSM-5 system status
✓ API is accessible

Step 3/5: Extracting DSM-5 data from PDF
⚠ This may take several minutes depending on PDF size...
Sending PDF to Document Intelligence service...
✓ Extraction successful!
  Conditions found: 297
  Processing time: 185,234ms
  Total elapsed: 186.3s

Step 4/5: Uploading extracted data to Azure Storage
Uploading to blob storage...
✓ Upload successful!
  Conditions uploaded: 297

Step 5/5: Verifying DSM-5 conditions are available
✓ Verification successful!
  Total conditions: 297
  Categories: 14

Sample conditions:
  • Autism Spectrum Disorder (F84.0)
  • Major Depressive Disorder (F32.9)
  • Generalized Anxiety Disorder (F41.1)
  • Schizophrenia (F20.9)
  • Bipolar I Disorder (F31.9)

✓ DSM-5 data import completed successfully!

Next Steps:
  1. Refresh your React app (Ctrl+F5)
  2. Navigate to a session's Extended Risk Assessment
  3. Select DSM-5 conditions from the dropdown
  4. Run the extended assessment
```

## Troubleshooting

### "Cannot connect to API"

**Problem:** CLI cannot reach the Functions API endpoint.

**Solutions:**
- Ensure Functions host is running: `cd BehavioralHealthSystem.Functions && func start --port 7071`
- Check the port matches the `--api-url` parameter
- Verify `local.settings.json` is configured correctly
- Check firewall isn't blocking localhost connections

### "PDF file not found"

**Problem:** CLI cannot find the DSM-5 PDF file.

**Solutions:**
- Verify the file path is correct
- Use absolute path instead of relative path
- Check file permissions
- Ensure filename has correct extension (`.pdf`)

### "Extraction failed"

**Problem:** Document Intelligence service couldn't extract conditions.

**Solutions:**
- Verify `DSM5_DOCUMENT_INTELLIGENCE_KEY` is set in `local.settings.json`
- Check Azure Document Intelligence service is accessible
- Ensure PDF is not corrupted or password-protected
- Try a smaller page range first to test (e.g., `--start-page 1 --end-page 50`)

### "Upload failed"

**Problem:** Cannot upload to Azure Blob Storage.

**Solutions:**
- Verify `AzureWebJobsStorage` connection string in `local.settings.json`
- Check storage account has `dsm5-data` container
- Ensure storage account is accessible
- Verify authentication credentials

## Development

### Running in Debug Mode

```powershell
cd BehavioralHealthSystem.Console
dotnet run -- import-dsm5 --verbose
```

The `--` separates dotnet CLI args from your application args.

### Running with specific PDF

```powershell
dotnet run -- import-dsm5 --pdf-path "C:\Users\cwoodland\dev\BehavioralHealthSystem\DSM5.pdf" --verbose
```

## Architecture

### Key Components

- **System.CommandLine**: Modern command-line parsing framework
- **HttpClient**: API communication with Functions backend
- **JsonSerializer**: JSON serialization/deserialization
- **Progress Tracking**: Step-by-step status updates with colored output

### Design Principles

1. **Fail Fast**: Validates prerequisites before expensive operations
2. **Informative Output**: Clear status messages and progress indicators
3. **Verbose Mode**: Optional detailed logging for troubleshooting
4. **Error Handling**: Graceful error messages with actionable suggestions
5. **Timeout Management**: Long timeouts (10 minutes) for large PDF processing

## Related Documentation

- [DSM-5 Administration Guide](../DSM5_ADMINISTRATION_GUIDE.md)
- [Extended Risk Assessment Integration](../EXTENDED_RISK_ASSESSMENT_INTEGRATION.md)
- [Main README](../README.md)
