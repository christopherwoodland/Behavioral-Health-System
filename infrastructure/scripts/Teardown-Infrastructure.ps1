<#
.SYNOPSIS
Removes all infrastructure resources for the Behavioral Health System.

.DESCRIPTION
WARNING: This script permanently deletes all Azure resources in the specified resource group.
Use with caution in production environments.

.PARAMETER ResourceGroupName
The name of the resource group to delete.

.PARAMETER SubscriptionId
The Azure subscription ID.

.PARAMETER Force
If specified, skips confirmation prompt.

.EXAMPLE
.\Teardown-Infrastructure.ps1 -ResourceGroupName "bhs-dev-rg" -SubscriptionId "00000000-0000-0000-0000-000000000000"

.EXAMPLE
.\Teardown-Infrastructure.ps1 -ResourceGroupName "bhs-dev-rg" -SubscriptionId "00000000-0000-0000-0000-000000000000" -Force
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $false)]
    [switch]$Force
)

# Set error action preference
$ErrorActionPreference = 'Stop'

# Colors for output
$Red = 'Red'
$Yellow = 'Yellow'
$Green = 'Green'

function Write-Status {
    param(
        [string]$Message,
        [string]$Color = 'Cyan'
    )
    Write-Host "► $Message" -ForegroundColor $Color
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor $Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor $Green
}

try {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor $Red
    Write-Host "║                        ⚠️  WARNING ⚠️                          ║" -ForegroundColor $Red
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor $Red
    Write-Host ""

    Write-Warning "This script will PERMANENTLY DELETE all resources in:"
    Write-Warning "Resource Group: $ResourceGroupName"
    Write-Warning "Subscription: $SubscriptionId"
    Write-Host ""
    Write-Warning "This action cannot be undone!"
    Write-Host ""

    if (-not $Force) {
        $confirmation = Read-Host "Type 'yes' to confirm deletion"
        if ($confirmation -ne 'yes') {
            Write-Host "✓ Operation cancelled" -ForegroundColor $Green
            exit 0
        }
    }

    # Set subscription
    Write-Status "Setting subscription to: $SubscriptionId"
    az account set --subscription $SubscriptionId

    # Delete resource group
    Write-Status "Deleting resource group: $ResourceGroupName"
    Write-Warning "This may take several minutes..."

    az group delete `
        --name $ResourceGroupName `
        --yes `
        --no-wait

    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor $Green
    Write-Host "║            DELETION INITIATED SUCCESSFULLY                    ║" -ForegroundColor $Green
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor $Green
    Write-Host ""

    Write-Success "Resource group deletion has been initiated"
    Write-Host "The deletion is running in the background. You can monitor it with:"
    Write-Host "  az group show --name $ResourceGroupName"
    Write-Host ""
}
catch {
    Write-Host "✗ An error occurred: $_" -ForegroundColor $Red
    exit 1
}
