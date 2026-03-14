#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy BHS application to AKS (development environment).

.DESCRIPTION
    End-to-end deployment script for the BHS AKS development environment.

    Steps performed:
      1.  Validate prerequisites (az, kubectl, kubelogin)
      2.  Validate Bicep template
      3.  What-if preview (optional)
      4.  Deploy Bicep infrastructure (main-aks.bicep)
      5.  Get AKS credentials via kubelogin
      6.  Create Workload Identity federated credential (UAMI → K8s ServiceAccount)
      7.  Patch Kubernetes manifests with real values from Bicep outputs
      8.  Apply all manifests (namespace → config → secrets → workloads → ingress)
      9.  Wait for rollouts

    Prerequisites:
      - az login (with Owner/Contributor + RBAC Admin on bhs-aks RG and
        Key Vault Secrets Officer on bhs-dev-kv-*)
      - kubectl installed
      - kubelogin installed (az aks install-cli or https://azure.github.io/kubelogin/)

.PARAMETER ParameterFile
    Path to the AKS dev parameters file.
    Default: ./parameters/aks-dev.parameters.json (relative to script directory)

.PARAMETER Location
    Azure region. Must match parameters file.  Default: eastus2

.PARAMETER SkipWhatIf
    Skip the what-if preview (useful in CI pipelines).

.PARAMETER SkipValidation
    Skip template validation.

.PARAMETER SkipInfra
    Skip Bicep deployment — useful if infrastructure already exists and you only
    want to re-apply Kubernetes manifests.

.PARAMETER SkipContainerBuild
    Skip building / pushing containers.  Use when images are already in ACR.

.EXAMPLE
    # Full deployment (infra + k8s manifests, no container build)
    .\Deploy-AKS.ps1

.EXAMPLE
    # Full deployment including building and pushing dev containers
    .\Deploy-AKS.ps1 -SkipContainerBuild:$false

.EXAMPLE
    # Re-apply k8s manifests only (infra already deployed)
    .\Deploy-AKS.ps1 -SkipInfra -SkipContainerBuild
#>
param(
    [string]$ParameterFile = "",

    [string]$Location = "eastus2",

    [switch]$SkipWhatIf,
    [switch]$SkipValidation,
    [switch]$SkipInfra,
    [switch]$SkipContainerBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Suppress az CLI version-upgrade warnings (they produce stderr which PowerShell
# treats as errors when $ErrorActionPreference = "Stop").
$env:AZURE_CORE_ONLY_SHOW_ERRORS = "true"

# ─── Paths ───────────────────────────────────────────────────────────────────
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$infraDir   = Resolve-Path (Join-Path $scriptDir "..")
$bicepDir   = Join-Path $infraDir "bicep"
$k8sDir     = Join-Path $infraDir "k8s\dev"
$templatePath  = Join-Path $bicepDir "main-aks.bicep"

if (-not $ParameterFile) {
    $ParameterFile = Join-Path $bicepDir "parameters\aks-dev.parameters.json"
}
$ParameterFile = Resolve-Path $ParameterFile

# Temp directory for patched manifests (never committed)
$tmpDir = Join-Path $scriptDir ".aks-deploy-tmp"
if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
New-Item -ItemType Directory -Path $tmpDir | Out-Null

$deploymentName = "bhs-aks-$(Get-Date -Format yyyyMMdd-HHmmss)"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  BHS AKS Deployment (Development)"                           -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Template:        $templatePath"
Write-Host "  Parameters:      $ParameterFile"
Write-Host "  Deployment name: $deploymentName"
Write-Host ""

# ─── 1. Prerequisites ────────────────────────────────────────────────────────
Write-Host "[*] Checking prerequisites..." -ForegroundColor Yellow

# Auto-extend PATH with the directories az aks install-cli uses
$azureKubectl   = Join-Path $env:USERPROFILE '.azure-kubectl'
$azureKubelogin = Join-Path $env:USERPROFILE '.azure-kubelogin'
foreach ($dir in @($azureKubectl, $azureKubelogin)) {
    if ((Test-Path $dir) -and ($env:PATH -notlike "*$dir*")) {
        $env:PATH += ";$dir"
    }
}

foreach ($tool in @('az', 'kubectl', 'kubelogin')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        if ($tool -eq 'kubelogin' -or $tool -eq 'kubectl') {
            Write-Host "[*] '$tool' not found -- installing via az aks install-cli..." -ForegroundColor Yellow
            az aks install-cli 2>$null
            # Re-extend PATH after install
            foreach ($dir in @($azureKubectl, $azureKubelogin)) {
                if ((Test-Path $dir) -and ($env:PATH -notlike "*$dir*")) {
                    $env:PATH += ";$dir"
                }
            }
            if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
                Write-Host "[ERROR] '$tool' still not found after install attempt. Please re-open the terminal and re-run." -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "[ERROR] '$tool' not found. Please install it and re-run." -ForegroundColor Red
            exit 1
        }
    }
}

$account = az account show --output json | ConvertFrom-Json
Write-Host "[OK] Azure account: $($account.user.name)" -ForegroundColor Green
Write-Host "[OK] Subscription:  $($account.name) ($($account.id))" -ForegroundColor Green

# Ensure Microsoft.OperationsManagement is registered (required for AKS monitoring add-on)
$omState = az provider show --namespace Microsoft.OperationsManagement --query registrationState --output tsv 2>$null
if ($omState -ne 'Registered') {
    Write-Host "[*] Registering Microsoft.OperationsManagement provider..." -ForegroundColor Yellow
    az provider register --namespace Microsoft.OperationsManagement --wait
    Write-Host "[OK] Microsoft.OperationsManagement registered." -ForegroundColor Green
}
Write-Host ""

# ─── 2. Load parameters ──────────────────────────────────────────────────────
Write-Host "[*] Loading parameters from $ParameterFile..."
$params = Get-Content $ParameterFile | ConvertFrom-Json
$rgName = $params.parameters.resourceGroupName.value
if (-not $rgName) { $rgName = "bhs-aks" }
$acrLoginServer = $params.parameters.acrLoginServer.value
$containerImageTag = $params.parameters.containerImageTag.value
$keyVaultUriFromParams = $params.parameters.keyVaultUri.value
$kvNameFromParams = ($keyVaultUriFromParams -replace 'https://', '' -replace '\.vault\.azure\.net.*', '')

Write-Host "[OK] Target resource group: $rgName" -ForegroundColor Green

# ─── 3. Build and push dev containers (optional) ─────────────────────────────
if (-not $SkipContainerBuild) {
    Write-Host "`n[*] Building and pushing dev containers..." -ForegroundColor Yellow
    $buildScript = Join-Path $scriptDir "Build-And-Push-Containers-Dev.ps1"
    if (Test-Path $buildScript) {
        & $buildScript -AcrLoginServer $acrLoginServer -ImageTag $containerImageTag
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Container build/push failed." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "[WARNING] Build script not found at $buildScript - skipping container build." -ForegroundColor Yellow
    }
} else {
    Write-Host "[*] Skipping container build (-SkipContainerBuild)." -ForegroundColor Gray
}

# ─── 3a. Ensure TLS certificate in Key Vault ─────────────────────────────────
# A self-signed certificate is generated once and stored in Key Vault.
# App Gateway pulls it by secret URI after deployment (added in Step 5b).
# This step is idempotent — if the cert already exists in KV it is reused.
Write-Host "`n[*] Ensuring TLS certificate in Key Vault '$kvNameFromParams'..." -ForegroundColor Yellow

$appGwFqdnForCert = "bhs-dev-bhs.${Location}.cloudapp.azure.com"
$certNameKv       = "bhs-dev-tls-cert"
$kvTlsCertSecretUri = "https://$kvNameFromParams.vault.azure.net/secrets/$certNameKv"

$existingCert = $false
try {
    az keyvault certificate show --vault-name $kvNameFromParams --name $certNameKv --query "id" -o tsv 2>&1 | Out-Null
    $existingCert = ($LASTEXITCODE -eq 0)
} catch {
    $errMsg = "$_"
    if (($errMsg -like '*Forbidden*') -or ($errMsg -like '*network access*') -or ($errMsg -like '*private link*')) {
        Write-Host "[OK] Key Vault is network-restricted - cert assumed present." -ForegroundColor Green
        $existingCert = $true
    }
}

if (-not $existingCert) {
    Write-Host "[*] Generating self-signed cert for $appGwFqdnForCert ..." -ForegroundColor Yellow

    $cert = New-SelfSignedCertificate `
        -DnsName $appGwFqdnForCert `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -KeyExportPolicy Exportable `
        -KeySpec KeyExchange `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm SHA256 `
        -NotAfter (Get-Date).AddYears(2) `
        -FriendlyName "BHS Dev TLS" `
        -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider"

    $pfxPath   = Join-Path $env:TEMP "bhs-dev-tls.pfx"
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rngBytes = [byte[]]::new(16); $rng.GetBytes($rngBytes)
    $pfxPwdStr = [System.Convert]::ToBase64String($rngBytes)
    $pfxPwd    = ConvertTo-SecureString -String $pfxPwdStr -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pfxPwd | Out-Null
    Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -ErrorAction SilentlyContinue

    az keyvault certificate import `
        --vault-name $kvNameFromParams `
        --name $certNameKv `
        --file $pfxPath `
        --password $pfxPwdStr `
        --output none
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to import TLS certificate to Key Vault." -ForegroundColor Red
        exit 1
    }
    Remove-Item $pfxPath -Force
    Write-Host "[OK] Certificate '$certNameKv' imported to Key Vault." -ForegroundColor Green
} else {
    Write-Host "[OK] Certificate '$certNameKv' already exists in Key Vault." -ForegroundColor Green
}

# ─── 4. Bicep infrastructure deployment ──────────────────────────────────────
if (-not $SkipInfra) {
    # 4a. Validate
    if (-not $SkipValidation) {
        Write-Host "`n[*] Validating Bicep template..." -ForegroundColor Yellow
        $validateResult = az deployment sub validate `
            --location $Location `
            --template-file $templatePath `
            --parameters "@$ParameterFile" `
            --output json 2>&1
        $validateExitCode = $LASTEXITCODE
        if ($validateExitCode -ne 0) {
            Write-Host "[ERROR] Template validation failed:`n$validateResult" -ForegroundColor Red
            exit 1
        }
        Write-Host "[OK] Template valid." -ForegroundColor Green
    }

    # 4b. What-if preview
    if (-not $SkipWhatIf) {
        Write-Host "`n[*] Running what-if preview (resource group: $rgName)..." -ForegroundColor Yellow
        Write-Host "------------------------------------------------------------"
        az deployment sub what-if `
            --location $Location `
            --template-file $templatePath `
            --parameters "@$ParameterFile" `
            --no-pretty-print
        Write-Host "------------------------------------------------------------"

        $approval = Read-Host "`nProceed with AKS deployment to '$rgName'? (yes/no)"
        if ($approval -ne "yes") {
            Write-Host "[INFO] Deployment cancelled." -ForegroundColor Yellow
            exit 0
        }
    }

    # 4c. Deploy
    Write-Host "`n[*] Deploying Bicep infrastructure (this takes 10-15 minutes)..." -ForegroundColor Yellow
    az deployment sub create `
        --name $deploymentName `
        --location $Location `
        --template-file $templatePath `
        --parameters "@$ParameterFile" `
        --output none

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Bicep deployment failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Bicep deployment complete." -ForegroundColor Green
} else {
    Write-Host "[*] Skipping Bicep infrastructure deployment (-SkipInfra)." -ForegroundColor Gray

    # Recover deployment name from most recent deployment if skipping infra
    $deploymentName = az deployment sub list `
        --query "[?starts_with(name,'bhs-aks-')].name | [0]" `
        --output tsv
    if (-not $deploymentName) {
        Write-Host "[ERROR] Cannot find a previous bhs-aks-* deployment. Run without -SkipInfra first." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Using existing deployment: $deploymentName" -ForegroundColor Green
}

# ─── 5. Collect Bicep outputs ────────────────────────────────────────────────
Write-Host "`n[*] Reading deployment outputs..." -ForegroundColor Yellow
$outputsJson = az deployment sub show `
    --name $deploymentName `
    --query "properties.outputs" `
    --output json
$outputs = $outputsJson | ConvertFrom-Json

$clusterName             = $outputs.clusterName.value
$oidcIssuerUrl           = $outputs.oidcIssuerUrl.value
$apiUamiClientId         = $outputs.apiWorkloadIdentityClientId.value
$apiUamiResourceId       = $outputs.apiWorkloadIdentityResourceId.value
$appGwPublicIp           = $outputs.appGatewayPublicIp.value
$appGwFqdn               = $outputs.appGatewayFqdn.value
$aksStorageAccount       = $outputs.aksStorageAccountName.value
$appInsightsConnStr      = $outputs.appInsightsConnectionString.value
$postgresHost            = $outputs.postgresHost.value
$postgresDatabase        = $outputs.postgresDatabase.value
$postgresUser            = $outputs.postgresUser.value
$azAdTenantId            = $outputs.azureAdTenantId.value
$azAdClientId            = $outputs.azureAdClientId.value
$azAdApiClientId         = $outputs.azureAdApiClientId.value
$acrLoginServer          = $outputs.acrLoginServer.value
$keyVaultUri             = $outputs.keyVaultUri.value
$openAiEndpoint          = $outputs.openAiEndpoint.value
$damImage                = $outputs.damImage.value
$containerImageTag       = $outputs.containerImageTag.value
$nodeResourceGroup       = $outputs.nodeResourceGroup.value
$keyVaultName            = ($keyVaultUri -replace 'https://', '' -replace '\.vault\.azure\.net.*', '')
# Derive the KV/UAMI tenant from the OIDC issuer URL — e.g.
# https://eastus2.oic.prod-aks.azure.com/<tenantId>/<clusterId>/
$kvTenantId              = ($oidcIssuerUrl -split '/')[3]
$appGwName               = $outputs.appGatewayName.value
$appGwTlsCertName        = $outputs.appGwTlsCertName.value

Write-Host "[OK] Cluster:        $clusterName  (RG: $rgName)" -ForegroundColor Green
Write-Host "[OK] OIDC Issuer:    $oidcIssuerUrl" -ForegroundColor Green
Write-Host "[OK] API UAMI:       $apiUamiClientId" -ForegroundColor Green
Write-Host "[OK] App Gateway IP: $appGwPublicIp  ($appGwFqdn)" -ForegroundColor Green
Write-Host "[OK] Storage:        $aksStorageAccount" -ForegroundColor Green

# ─── 5b. Add TLS certificate to App Gateway ───────────────────────────────────
# The cert was imported to Key Vault in step 3a.  Now we register it on the
# App Gateway so AGIC can reference it by name in the HTTPS listener.
Write-Host "`n[*] Configuring TLS certificate '$appGwTlsCertName' on App Gateway '$appGwName'..." -ForegroundColor Yellow

try { az network application-gateway ssl-cert show --gateway-name $appGwName --resource-group $rgName --name $appGwTlsCertName --query "name" -o tsv 2>&1 | Out-Null; $existingAppGwCert = ($LASTEXITCODE -eq 0) } catch { $existingAppGwCert = $false }

if (-not $existingAppGwCert) {
    if (-not $SkipInfra) {
        # New RBAC assignments need time to propagate before App Gateway can read KV
        Write-Host "[*] Waiting 60s for RBAC propagation before attaching cert to App Gateway..." -ForegroundColor Yellow
        Start-Sleep 60
    }
    $certAdded = $false
    for ($i = 1; $i -le 3; $i++) {
        az network application-gateway ssl-cert create `
            --gateway-name $appGwName `
            --resource-group $rgName `
            --name $appGwTlsCertName `
            --key-vault-secret-id $kvTlsCertSecretUri `
            --output none 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] TLS certificate registered on App Gateway." -ForegroundColor Green
            $certAdded = $true
            break
        } elseif ($i -lt 3) {
            Write-Host "[*] Attempt $i failed - waiting 30s and retrying..." -ForegroundColor Yellow
            Start-Sleep 30
        }
    }
    if (-not $certAdded) {
        Write-Host "[WARNING] Could not register TLS cert on App Gateway after 3 attempts." -ForegroundColor Yellow
        Write-Host "  Retry manually once RBAC has propagated (~5 min):"
        Write-Host "  az network application-gateway ssl-cert create --gateway-name $appGwName --resource-group $rgName --name $appGwTlsCertName --key-vault-secret-id $kvTlsCertSecretUri"
    }
} else {
    Write-Host "[OK] TLS certificate already registered on App Gateway." -ForegroundColor Green
}

# ─── 6. Get AKS credentials ──────────────────────────────────────────────────
Write-Host "`n[*] Getting AKS credentials..." -ForegroundColor Yellow
az aks get-credentials `
    --resource-group $rgName `
    --name $clusterName `
    --overwrite-existing `
    --output none

# Convert to kubelogin (Azure AD workload identity / managed identity token)
kubelogin convert-kubeconfig -l azurecli
Write-Host "[OK] kubectl context set to: $clusterName" -ForegroundColor Green

# ─── 7. Create Workload Identity federated credential ────────────────────────
# Bind the api UAMI to the bhs-api-sa Kubernetes ServiceAccount in the bhs namespace.
Write-Host "`n[*] Creating federated credential for api Workload Identity..." -ForegroundColor Yellow

$federatedCredName = "bhs-aks-dev-api-fedcred"
$subject = "system:serviceaccount:bhs:bhs-api-sa"

# Parse RG and identity name from the resource ID
# e.g. /subscriptions/.../resourceGroups/bhs-aks/providers/Microsoft.ManagedIdentity/userAssignedIdentities/bhs-dev-aks-api-identity
$uamiRg   = ($apiUamiResourceId -split '/')[4]
$uamiName = ($apiUamiResourceId -split '/')[-1]

# Remove existing federated credential if it exists (idempotent re-deploy)
$existingFedCred = az identity federated-credential list `
    --resource-group $uamiRg `
    --identity-name $uamiName `
    --query "[?name=='$federatedCredName'].name" `
    --output tsv 2>$null

if ($existingFedCred) {
    Write-Host "[*] Removing stale federated credential '$federatedCredName'..."
    az identity federated-credential delete `
        --resource-group $uamiRg `
        --identity-name $uamiName `
        --name $federatedCredName `
        --output none `
        --yes 2>$null
}

az identity federated-credential create `
    --resource-group $uamiRg `
    --identity-name $uamiName `
    --name $federatedCredName `
    --issuer $oidcIssuerUrl `
    --subject $subject `
    --audiences "api://AzureADTokenExchange" `
    --output none

Write-Host "[OK] Federated credential created." -ForegroundColor Green

# ─── 8. Patch and apply Kubernetes manifests ─────────────────────────────────
Write-Host "`n[*] Preparing Kubernetes manifests..." -ForegroundColor Yellow

# Copy all manifests to temp dir preserving directory structure
Copy-Item -Path "$k8sDir\*" -Destination $tmpDir -Recurse -Force

function Replace-InFile {
    param([string]$FilePath, [hashtable]$Replacements)
    $content = Get-Content $FilePath -Raw
    foreach ($key in $Replacements.Keys) {
        $content = $content -replace [regex]::Escape($key), $Replacements[$key]
    }
    Set-Content $FilePath -Value $content -NoNewline
}

# Common substitutions applied to every manifest
$commonSubs = @{
    "__AKS_STORAGE_ACCOUNT_NAME__" = $aksStorageAccount
    "__POSTGRES_HOST__"            = $postgresHost
    "__POSTGRES_DATABASE__"        = $postgresDatabase
    "__POSTGRES_USER__"            = $postgresUser
    "__AZURE_AD_TENANT_ID__"       = $azAdTenantId
    "__AZURE_AD_CLIENT_ID__"       = $azAdClientId
    "__AZURE_AD_API_CLIENT_ID__"   = $azAdApiClientId
    "__OPENAI_ENDPOINT__"          = $openAiEndpoint
    "__ACR_LOGIN_SERVER__"         = $acrLoginServer
    "__IMAGE_TAG__"                = $containerImageTag
    "__DAM_IMAGE__"                = $damImage
    "__UAMI_CLIENT_ID__"           = $apiUamiClientId
    "__KEY_VAULT_NAME__"           = $keyVaultName
    "__KEY_VAULT_TENANT_ID__"      = $kvTenantId
    "__APP_GATEWAY_FQDN__"         = $appGwFqdn
    "__APP_GW_TLS_CERT_NAME__"     = $appGwTlsCertName
}

# Apply substitutions to all YAML files in temp directory
Get-ChildItem $tmpDir -Filter "*.yaml" -Recurse | ForEach-Object {
    Replace-InFile -FilePath $_.FullName -Replacements $commonSubs
}

Write-Host "[OK] Manifests patched." -ForegroundColor Green

# Apply manifests in dependency order
Write-Host "`n[*] Applying Kubernetes manifests..." -ForegroundColor Yellow

# Namespace first
kubectl apply -f "$tmpDir\namespace.yaml"
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] namespace.yaml failed" -ForegroundColor Red; exit 1 }

# ServiceAccounts (workload identity must exist before CSI driver references it)
kubectl apply -f "$tmpDir\workload-identity.yaml"
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] workload-identity.yaml failed" -ForegroundColor Red; exit 1 }

# ConfigMaps
kubectl apply -f "$tmpDir\configmap.yaml"
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] configmap.yaml failed" -ForegroundColor Red; exit 1 }

# SecretProviderClass (CSI driver must be running before this works)
# Use apply; fall back to replace --force if the resource exists without last-applied annotation
try { kubectl apply -f "$tmpDir\secretproviderclass.yaml" 2>&1 | Out-Null; $spcOk = ($LASTEXITCODE -eq 0) } catch { $spcOk = $false }
if (-not $spcOk) {
    kubectl replace --force -f "$tmpDir\secretproviderclass.yaml"
    if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] secretproviderclass.yaml failed" -ForegroundColor Red; exit 1 }
}

# Services (before deployments so env refs resolve)
kubectl apply -f "$tmpDir\services\"
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] services failed" -ForegroundColor Red; exit 1 }

# Deployments
kubectl apply -f "$tmpDir\deployments\"
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] deployments failed" -ForegroundColor Red; exit 1 }

# HPA
kubectl apply -f "$tmpDir\hpa.yaml"
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] hpa.yaml failed" -ForegroundColor Red; exit 1 }

# Ingress last (AGIC picks it up and configures App Gateway)
kubectl apply -f "$tmpDir\ingress.yaml"
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] ingress.yaml failed" -ForegroundColor Red; exit 1 }

Write-Host "[OK] All manifests applied." -ForegroundColor Green

# ─── 9. Wait for rollouts ────────────────────────────────────────────────────
Write-Host "`n[*] Waiting for deployments to roll out..." -ForegroundColor Yellow
Write-Host "    (DAM can take several minutes to preload the model)"

foreach ($deploy in @('bhs-dam', 'bhs-api', 'bhs-web')) {
    Write-Host "[*] Waiting for $deploy..."
    kubectl rollout status deployment/$deploy -n bhs --timeout=600s
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARNING] $deploy rollout timed out - check pod logs:" -ForegroundColor Yellow
        Write-Host "    kubectl logs -n bhs -l app=$deploy --tail=50"
    } else {
        Write-Host "[OK] $deploy is ready." -ForegroundColor Green
    }
}

# ─── Cleanup temp dir ────────────────────────────────────────────────────────
Remove-Item $tmpDir -Recurse -Force

# ─── Summary ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  AKS Deployment Complete!"                                   -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Application URL:  https://$appGwFqdn"                      -ForegroundColor Cyan
Write-Host "  HTTP (redirects): http://$appGwFqdn"                       -ForegroundColor Cyan
Write-Host "  Public IP:        $appGwPublicIp"                          -ForegroundColor Cyan
Write-Host ""
Write-Host "  Useful kubectl commands:"
Write-Host "    kubectl get pods -n bhs"
Write-Host "    kubectl get ingress -n bhs"
Write-Host "    kubectl logs -n bhs -l app=bhs-api --tail=100"
Write-Host "    kubectl logs -n bhs -l app=bhs-dam --tail=100"
Write-Host ""Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  Entra ID Setup Required (first deploy only)"                -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "  If this is a first deploy or the app registrations are new,"
Write-Host "  run Setup-EntraID.ps1 to configure the app registrations:"
Write-Host ""
Write-Host "    .\Setup-EntraID.ps1"
Write-Host "    # Or with role assignment:"
Write-Host "    .\Setup-EntraID.ps1 -AdminUserUpn you@contoso.com"
Write-Host ""
Write-Host "  This script is idempotent - safe to re-run at any time."
Write-Host "  It configures:"
Write-Host "    - identifierUris: adds api://$azAdApiClientId alongside friendly name"
Write-Host "    - access_as_user delegated scope on the API app"
Write-Host "    - Admin / ControlPanel app roles on both app registrations"
Write-Host "    - Pre-authorizes UI ($azAdClientId) on API so no consent prompt appears"
Write-Host "    - Ensures redirect URIs are under SPA platform (not Web platform)"
Write-Host ""
Write-Host "  Entra ID values used in this deployment:"
Write-Host "    Frontend app (UI)  : $azAdClientId"
Write-Host "    Backend app (API)  : $azAdApiClientId"
Write-Host "    Tenant             : $azAdTenantId"
Write-Host ""