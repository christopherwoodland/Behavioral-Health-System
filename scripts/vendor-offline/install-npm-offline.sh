#!/usr/bin/env bash
# Installs npm dependencies from vendored tarballs on an air-gapped machine.
#
# Usage: ./scripts/vendor-offline/install-npm-offline.sh [--project-dir DIR] [--tarball-dir DIR] [--cache-dir DIR]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PROJECT_DIR="${REPO_ROOT}/BehavioralHealthSystem.Web"
TARBALL_DIR="${REPO_ROOT}/vendor/npm-tarballs"
CACHE_DIR="${REPO_ROOT}/vendor/npm-cache-airgap"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --project-dir) PROJECT_DIR="$2"; shift 2 ;;
        --tarball-dir) TARBALL_DIR="$2"; shift 2 ;;
        --cache-dir) CACHE_DIR="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--project-dir DIR] [--tarball-dir DIR] [--cache-dir DIR]"
            exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

if [[ ! -f "$PROJECT_DIR/package-lock.json" ]]; then
    echo "package-lock.json not found at $PROJECT_DIR" >&2
    exit 1
fi

if [[ ! -d "$TARBALL_DIR" ]]; then
    echo "Tarball directory not found: $TARBALL_DIR" >&2
    exit 1
fi

mapfile -t TARBALLS < <(find "$TARBALL_DIR" -maxdepth 1 -name '*.tgz' -type f | sort)
if [[ ${#TARBALLS[@]} -eq 0 ]]; then
    echo "No .tgz tarballs found in $TARBALL_DIR" >&2
    exit 1
fi

mkdir -p "$CACHE_DIR"

echo "============================================================"
echo "BHS Offline npm Install"
echo "Project : $PROJECT_DIR"
echo "Tarballs: $TARBALL_DIR (${#TARBALLS[@]} files)"
echo "Cache   : $CACHE_DIR"
echo "============================================================"

for tgz in "${TARBALLS[@]}"; do
    npm cache add "$tgz" --cache "$CACHE_DIR"
done

(
    cd "$PROJECT_DIR"
    npm ci --offline --cache "$CACHE_DIR"
)

echo "[OK] Offline npm install completed."
