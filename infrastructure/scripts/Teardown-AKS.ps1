#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Tear down the BHS AKS development environment.

.DESCRIPTION
    Removes all Kubernetes workloads and, optionally, the Azure resource group.

    Steps:
      1. Remove Kubernetes workloads from the bhs namespace
      2. Optionally delete the bhs-aks resource group (destroys all infrastructure)

    CAUTION: Deleting the resource group is irreversible.

.PARAMETER ResourceGroupName
    AKS resource group name.  Default: bhs-aks

.PARAMETER ClusterName
    AKS cluster name.  Default: discovered from resource group.

.PARAMETER DeleteResourceGroup
    If specified, deletes the entire bhs-aks resource group after removing
    Kubernetes workloads.  Requires explicit confirmation.

.PARAMETER SkipKubernetes
    Skip Kubernetes removal (execute only the resource group deletion).

.EXAMPLE
    # Remove only Kubernetes workloads, keep Azure infrastructure
    .\Teardown-AKS.ps1

.EXAMPLE
    # Full teardown including Azure resources (DESTRUCTIVE)
    .\Teardown-AKS.ps1 -DeleteResourceGroup
#>
param(
    [string]$ResourceGroupName = "bhs-aks",

    [string]$ClusterName = "",

    [switch]$DeleteResourceGroup,

    [switch]$SkipKubernetes
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Red
Write-Host "  BHS AKS Teardown"                                          -ForegroundColor Red
Write-Host "============================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  Resource Group:       $ResourceGroupName"
Write-Host "  Delete Resource Group: $DeleteResourceGroup"
Write-Host ""

if ($DeleteResourceGroup) {
    Write-Host "WARNING: This will permanently delete the '$ResourceGroupName' resource group" -ForegroundColor Red
    Write-Host "         and ALL resources within it (AKS cluster, storage account, VNet, etc.)." -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "Type the resource group name to confirm deletion"
    if ($confirm -ne $ResourceGroupName) {
        Write-Host "[INFO] Teardown cancelled — confirmation did not match." -ForegroundColor Yellow
        exit 0
    }
}

# Check prerequisites
Write-Host "[*] Checking prerequisites..." -ForegroundColor Yellow
foreach ($tool in @('az')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] '$tool' not found." -ForegroundColor Red
        exit 1
    }
}

$account = az account show --output json | ConvertFrom-Json
Write-Host "[OK] Azure account: $($account.user.name)" -ForegroundColor Green

# ─── Kubernetes workload removal ─────────────────────────────────────────────
if (-not $SkipKubernetes) {
    # Discover cluster name if not provided
    if (-not $ClusterName) {
        $ClusterName = az aks list `
            --resource-group $ResourceGroupName `
            --query "[0].name" `
            --output tsv 2>$null
    }

    if ($ClusterName) {
        Write-Host "`n[*] Getting AKS credentials for $ClusterName..." -ForegroundColor Yellow
        az aks get-credentials `
            --resource-group $ResourceGroupName `
            --name $ClusterName `
            --overwrite-existing `
            --output none

        if (Get-Command kubelogin -ErrorAction SilentlyContinue) {
            kubelogin convert-kubeconfig -l azurecli
        }

        Write-Host "[*] Deleting bhs namespace (removes all workloads)..." -ForegroundColor Yellow
        kubectl delete namespace bhs --ignore-not-found=true
        Write-Host "[OK] Kubernetes workloads removed." -ForegroundColor Green

        # Remove federated credential
        Write-Host "[*] Removing Workload Identity federated credentials..." -ForegroundColor Yellow
        $uamiName = "bhs-dev-aks-api-identity"
        $uamiId = az identity show `
            --resource-group $ResourceGroupName `
            --name $uamiName `
            --query id `
            --output tsv 2>$null

        if ($uamiId) {
            $fedCreds = az identity federated-credential list `
                --identity-resource-id $uamiId `
                --query "[].name" `
                --output tsv 2>$null
            foreach ($cred in $fedCreds) {
                az identity federated-credential delete `
                    --identity-resource-id $uamiId `
                    --name $cred `
                    --output none `
                    --yes 2>$null
                Write-Host "[OK] Removed federated credential: $cred" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "[WARNING] No AKS cluster found in '$ResourceGroupName' — skipping Kubernetes removal." -ForegroundColor Yellow
    }
}

# ─── Resource group deletion ─────────────────────────────────────────────────
if ($DeleteResourceGroup) {
    Write-Host "`n[*] Deleting resource group '$ResourceGroupName'..." -ForegroundColor Red
    Write-Host "    This will take several minutes..."
    az group delete `
        --name $ResourceGroupName `
        --yes `
        --output none

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Resource group '$ResourceGroupName' deleted." -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Resource group deletion failed." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n[INFO] Azure infrastructure preserved (resource group: $ResourceGroupName)." -ForegroundColor Cyan
    Write-Host "       To delete it, re-run with: -DeleteResourceGroup"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Teardown Complete"                                          -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
