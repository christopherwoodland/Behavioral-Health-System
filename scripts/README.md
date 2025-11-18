# PowerShell Automation Scripts

This directory contains PowerShell scripts for deploying, managing, and maintaining the Behavioral Health System.

## 📋 Script Overview

| Script | Purpose | Use Case |
|--------|---------|----------|
| `deploy-solution.ps1` | Complete Azure deployment | Initial deployment or major updates |
| `deploy-code-only.ps1` | Deploy code without infrastructure | Quick code updates |
| `deploy-ui.ps1` | Deploy frontend only | UI-only updates |
| `local-run.ps1` | Run backend locally | Local development |
| `import-dsm5-data.ps1` | Import DSM-5 diagnostic data | Initial setup or data refresh |
| `check-dsm5-data.ps1` | Verify DSM-5 data status | Data validation |
| `delete-dsm5-data.ps1` | Remove DSM-5 data | Reset or cleanup |
| `extract-dsm5-conditions.ps1` | Extract conditions from PDF | DSM-5 data processing |
| `health-check.ps1` | System health validation | Monitoring |
| `monitor-resources.ps1` | Azure resource monitoring | Operations |
| `watch-and-run.ps1` | Auto-rebuild on changes | Active development |

## 🚀 Deployment Scripts

### deploy-solution.ps1
Complete Azure deployment including infrastructure and code.

**Usage:**
```powershell
.\scripts\deploy-solution.ps1 -SubscriptionId "your-sub-id" -ResourceGroup "rg-name" -Location "eastus"
```

### deploy-code-only.ps1
Deploy code updates without modifying infrastructure.

**Usage:**
```powershell
.\scripts\deploy-code-only.ps1 -SubscriptionId "your-sub-id" -ResourceGroup "rg-name"
```

### deploy-ui.ps1
Deploy frontend application only.

**Usage:**
```powershell
.\scripts\deploy-ui.ps1 -SubscriptionId "your-sub-id" -ResourceGroup "rg-name"
```

## 🔧 Development Scripts

### local-run.ps1
Start Azure Functions backend locally.

**Usage:**
```powershell
.\scripts\local-run.ps1
```

### watch-and-run.ps1
Auto-rebuild and restart on file changes.

**Usage:**
```powershell
.\scripts\watch-and-run.ps1
```

## 📊 DSM-5 Management Scripts

### import-dsm5-data.ps1
Import DSM-5 diagnostic criteria data.

**Usage:**
```powershell
.\scripts\import-dsm5-data.ps1 -FilePath "path\to\dsm5-data.json"
```

### check-dsm5-data.ps1
Verify DSM-5 data status and integrity.

**Usage:**
```powershell
.\scripts\check-dsm5-data.ps1
```

### delete-dsm5-data.ps1
Remove all DSM-5 data from storage.

**Usage:**
```powershell
.\scripts\delete-dsm5-data.ps1 -Confirm
```

## 🏥 Monitoring Scripts

### health-check.ps1
Validate system health and connectivity.

**Usage:**
```powershell
.\scripts\health-check.ps1
```

### monitor-resources.ps1
Monitor Azure resource usage and status.

**Usage:**
```powershell
.\scripts\monitor-resources.ps1 -SubscriptionId "your-sub-id" -ResourceGroup "rg-name"
```

## 📝 Prerequisites

- PowerShell 7.0 or later
- Azure CLI installed and authenticated
- Azure subscription with appropriate permissions
- .NET 8.0 SDK (for build scripts)
- Node.js 18+ (for UI deployment)

## ⚙️ Common Parameters

Most scripts support these common parameters:

- `-SubscriptionId`: Azure subscription ID
- `-ResourceGroup`: Azure resource group name
- `-Location`: Azure region (e.g., "eastus", "westus2")
- `-Verbose`: Enable detailed logging
- `-WhatIf`: Preview changes without execution

## 🔍 Troubleshooting

### Authentication Issues
```powershell
az login
az account set --subscription "your-sub-id"
```

### Script Execution Policy
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Missing Dependencies
```powershell
# Install Azure CLI
winget install Microsoft.AzureCLI

# Install .NET SDK
winget install Microsoft.DotNet.SDK.8

# Install Node.js
winget install OpenJS.NodeJS.LTS
```

## 📖 Additional Resources

- See main [README.md](../README.md) for complete documentation
- Deployment guide in main README
- Architecture diagrams in main README
