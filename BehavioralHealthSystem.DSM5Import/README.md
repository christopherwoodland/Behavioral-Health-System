# BehavioralHealthSystem.DSM5Import

Command-line utility for importing DSM-5 diagnostic condition data into the Behavioral Health System.

## Overview

This CLI tool batch-imports DSM-5 (Diagnostic and Statistical Manual of Mental Disorders, Fifth Edition) condition data from split PDF files. It uses Azure Document Intelligence to extract structured content from each PDF and stores the results as JSON in Azure Blob Storage for use by the [Functions API](../BehavioralHealthSystem.Functions/README.md) extended assessment features.

The imported DSM-5 data powers the **Extended Risk Assessment** feature, enabling clinicians to select specific psychiatric conditions for in-depth AI evaluation.

> **Note:** When using the PostgreSQL storage backend (`STORAGE_BACKEND=PostgreSQL`), DSM-5 conditions are **auto-seeded** from bundled JSON files in `data/dsm5-data/conditions/` on first API start. This CLI tool is only needed for the initial PDF-to-JSON extraction or to update the source data.

## Tech Stack

- **.NET 8** console application
- **System.CommandLine** — CLI argument parsing
- **Azure Document Intelligence** — PDF content extraction
- **Azure Blob Storage** — structured data persistence
- Uses services from [Helpers library](../BehavioralHealthSystem.Helpers/README.md) (`DSM5DataService`, `AzureContentUnderstandingService`)

## Commands

### `import-dsm5`

Batch import DSM-5 conditions from a directory of PDF files.

```powershell
bhs import-dsm5 --directory ./dsm --pattern "*.pdf" --max-files 50
```

Options:
- `--directory` — Path to directory containing DSM-5 PDF files
- `--pattern` — File glob pattern (default: `*.pdf`)
- `--max-files` — Maximum number of files to process

### `import-status`

Display current import progress — shows how many conditions have been imported, any failures, and remaining files.

```powershell
bhs import-status
```

### `import-reset`

Reset import progress tracking to start fresh.

```powershell
bhs import-reset
```

## Project Structure

```
BehavioralHealthSystem.DSM5Import/
├── Program.cs                    # CLI entry point and command definitions
├── Services/                     # Import orchestration services
├── Models/                       # Import-specific models
├── dsm/                          # DSM-5 source PDF files
└── dsm5-import-progress.json     # Import progress tracking state
```

## How It Works

1. **Scan** — reads PDF files from the specified directory
2. **Extract** — sends each PDF to Azure Document Intelligence for structured content extraction
3. **Transform** — converts extracted content into DSM-5 condition data models
4. **Store** — persists structured JSON to Azure Blob Storage (`dsm5-data` container)
5. **Track** — updates `dsm5-import-progress.json` with per-file status

## Configuration

Requires the same Azure credentials and storage settings as the Functions project. See the [main README](../README.md) for environment configuration.
