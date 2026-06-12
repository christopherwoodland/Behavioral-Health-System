#!/usr/bin/env bash
# Restores the solution using a local offline NuGet feed.
#
# Usage: ./scripts/vendor-offline/install-nuget-offline.sh [--solution PATH] [--feed-dir DIR] [--config PATH] [--cache-dir DIR]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SOLUTION_PATH="${REPO_ROOT}/BehavioralHealthSystem.sln"
FEED_DIR="${REPO_ROOT}/vendor/nuget-feed"
OFFLINE_CONFIG_PATH="${REPO_ROOT}/vendor/nuget.offline.config"
PACKAGE_CACHE_DIR="${REPO_ROOT}/vendor/nuget-cache-airgap"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --solution) SOLUTION_PATH="$2"; shift 2 ;;
        --feed-dir) FEED_DIR="$2"; shift 2 ;;
        --config) OFFLINE_CONFIG_PATH="$2"; shift 2 ;;
        --cache-dir) PACKAGE_CACHE_DIR="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--solution PATH] [--feed-dir DIR] [--config PATH] [--cache-dir DIR]"
            exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

if [[ ! -f "$SOLUTION_PATH" ]]; then
    echo "Solution not found: $SOLUTION_PATH" >&2
    exit 1
fi

if [[ ! -d "$FEED_DIR" ]]; then
    echo "Offline feed directory not found: $FEED_DIR" >&2
    exit 1
fi

PACKAGE_COUNT=$(find "$FEED_DIR" -maxdepth 1 -name '*.nupkg' -type f | wc -l | tr -d '[:space:]')
if [[ "$PACKAGE_COUNT" == "0" ]]; then
    echo "No .nupkg files found in offline feed: $FEED_DIR" >&2
    exit 1
fi

mkdir -p "$(dirname "$OFFLINE_CONFIG_PATH")" "$PACKAGE_CACHE_DIR"
cat > "$OFFLINE_CONFIG_PATH" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="offline" value="$FEED_DIR" />
  </packageSources>
</configuration>
EOF

echo "============================================================"
echo "BHS Offline NuGet Restore"
echo "Solution: $SOLUTION_PATH"
echo "Feed    : $FEED_DIR ($PACKAGE_COUNT packages)"
echo "Config  : $OFFLINE_CONFIG_PATH"
echo "Cache   : $PACKAGE_CACHE_DIR"
echo "============================================================"

dotnet nuget locals http-cache --clear > /dev/null
dotnet restore "$SOLUTION_PATH" --configfile "$OFFLINE_CONFIG_PATH" --packages "$PACKAGE_CACHE_DIR" --force

echo
echo "[OK] Offline NuGet restore completed successfully."
