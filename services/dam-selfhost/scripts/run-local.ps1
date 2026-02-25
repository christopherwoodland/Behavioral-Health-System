param(
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

if ($Rebuild) {
    docker compose -f "$root\..\..\..\docker-compose.local.yml" build dam-selfhost
}

docker compose -f "$root\..\..\..\docker-compose.local.yml" up -d dam-selfhost
Write-Output "DAM self-hosted API should be available on http://localhost:8000"
