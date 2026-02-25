# Enable-StoragePublicAccess.ps1
# This runbook runs daily to enable public network access on the BHS storage account
# and set default action to Allow for browser-based uploads

# Connect using Managed Identity
Connect-AzAccount -Identity

# Set variables
$resourceGroupName = "bhs-development-public"
$storageAccountName = "bhsdevstg4exbxrzknexso"

Write-Output "Starting storage account network configuration update..."
Write-Output "Resource Group: $resourceGroupName"
Write-Output "Storage Account: $storageAccountName"
Write-Output "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')"

try {
    # Update storage account network settings
    $storageAccount = Set-AzStorageAccount `
        -ResourceGroupName $resourceGroupName `
        -Name $storageAccountName `
        -PublicNetworkAccess Enabled

    Write-Output "Public network access enabled successfully."

    # Set default action to Allow
    Update-AzStorageAccountNetworkRuleSet `
        -ResourceGroupName $resourceGroupName `
        -Name $storageAccountName `
        -DefaultAction Allow `
        -Bypass AzureServices

    Write-Output "Default action set to Allow successfully."
    Write-Output "Storage account network configuration updated successfully!"
}
catch {
    Write-Error "Failed to update storage account: $_"
    throw
}
