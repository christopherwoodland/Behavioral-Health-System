# Behavioral Health System - Console Application

Command-line tool for DSM-5 data management and system administration.

## 🎯 Purpose

Console application for:
- Importing DSM-5 diagnostic criteria from JSON
- Processing DSM-5 PDF documents
- Managing diagnostic condition data
- Administrative tasks and utilities

## 🏗️ Project Structure

```
BehavioralHealthSystem.Console/
├── Services/             # Business logic services
├── Models/              # Data models
├── dsm/                 # DSM-5 source data files
├── Program.cs           # Application entry point
└── appsettings.json     # Configuration
```

## 🔧 Configuration

### appsettings.json

```json
{
  "AzureStorage": {
    "ConnectionString": "your-connection-string",
    "ContainerName": "dsm5-data"
  },
  "DSM5": {
    "DataPath": "./dsm",
    "ImportBatchSize": 100
  }
}
```

## 🏃 Running

### Import DSM-5 Data
```powershell
dotnet run -- import --file dsm/dsm5-conditions.json
```

### Process PDF
```powershell
dotnet run -- extract --pdf dsm/dsm5-manual.pdf --output conditions.json
```

### List Conditions
```powershell
dotnet run -- list --category "mood-disorders"
```

### Validate Data
```powershell
dotnet run -- validate --file dsm/dsm5-conditions.json
```

## 📦 Commands

### import
Import DSM-5 data from JSON file.

**Options:**
- `--file, -f` - Path to JSON file (required)
- `--batch-size, -b` - Batch size for import (default: 100)
- `--skip-validation` - Skip validation checks

### extract
Extract conditions from DSM-5 PDF.

**Options:**
- `--pdf, -p` - Path to PDF file (required)
- `--output, -o` - Output JSON file path
- `--sections, -s` - Specific sections to extract

### list
List available DSM-5 conditions.

**Options:**
- `--category, -c` - Filter by category
- `--search, -s` - Search term
- `--format, -f` - Output format (json, csv, table)

### validate
Validate DSM-5 data file.

**Options:**
- `--file, -f` - Path to JSON file (required)
- `--strict` - Enable strict validation mode

## 📊 DSM-5 Data Format

```json
{
  "conditions": [
    {
      "id": "296.23",
      "name": "Major Depressive Disorder",
      "category": "Mood Disorders",
      "diagnosticCriteria": [
        "Criterion A: ...",
        "Criterion B: ..."
      ],
      "specifiers": [],
      "differentialDiagnosis": []
    }
  ]
}
```

## 🔍 Features

- **Bulk Import** - Import large datasets efficiently
- **PDF Extraction** - Parse DSM-5 PDF documents
- **Data Validation** - Verify data integrity
- **Category Filtering** - Organize by diagnostic categories
- **Search** - Find conditions by name or criteria
- **Export** - Multiple output formats

## 🛠️ Dependencies

- **Azure.Storage.Blobs** - Azure Blob Storage integration
- **System.CommandLine** - CLI parsing
- **iText7** - PDF processing
- **Newtonsoft.Json** - JSON serialization

## 📝 Import Progress

The console app tracks import progress in `dsm5-import-progress.json`:

```json
{
  "lastImportDate": "2025-11-17T10:30:00Z",
  "totalConditions": 450,
  "successfulImports": 448,
  "failedImports": 2,
  "lastError": null
}
```

## 🧪 Testing

```powershell
# Dry run (no changes)
dotnet run -- import --file test-data.json --dry-run

# Validate before import
dotnet run -- validate --file dsm5-data.json
dotnet run -- import --file dsm5-data.json
```

## 📚 Additional Resources

- [Main README](../README.md) - Complete system documentation
- [DSM-5 Data Management](../README.md#-dsm-5-integration) - Data format details
- [Scripts Documentation](../scripts/README.md) - Automation scripts
