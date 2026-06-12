#!/usr/bin/env bash
# airgap-up.sh
# One-shot air-gap startup helper.
#
# Performs:
#   1) airgap-bootstrap (env generation)
#   2) optional offline dependency restore (NuGet + npm)
#   3) optional FFmpeg core staging
#   4) docker compose up using generated air-gap env file
#   5) database seeding
#
# Usage: ./scripts/airgap-up.sh [options]
#   --env-file FILE              Path to env file (default: ../docker.env.airgap)
#   --compose-file FILE          Path to compose file (default: ../docker-compose.local.yml)
#   --skip-bootstrap             Skip env file generation
#   --skip-dependency-restore    Skip offline NuGet/npm restore
#   --skip-ffmpeg-stage          Skip FFmpeg core staging
#   --allow-missing-ffmpeg       Don't fail if FFmpeg tarball is missing
#   --ffmpeg-tarball PATH        Explicit path to FFmpeg core tarball

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default parameters
ENV_FILE="${REPO_ROOT}/docker.env.airgap"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.local.yml"
SKIP_BOOTSTRAP=false
SKIP_DEPENDENCY_RESTORE=false
SKIP_FFMPEG_STAGE=false
ALLOW_MISSING_FFMPEG=false
FFMPEG_TARBALL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --env-file) ENV_FILE="$2"; shift 2 ;;
        --compose-file) COMPOSE_FILE="$2"; shift 2 ;;
        --skip-bootstrap) SKIP_BOOTSTRAP=true; shift ;;
        --skip-dependency-restore) SKIP_DEPENDENCY_RESTORE=true; shift ;;
        --skip-ffmpeg-stage) SKIP_FFMPEG_STAGE=true; shift ;;
        --allow-missing-ffmpeg) ALLOW_MISSING_FFMPEG=true; shift ;;
        --ffmpeg-tarball) FFMPEG_TARBALL="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--env-file FILE] [--compose-file FILE] [--skip-bootstrap]"
            echo "       [--skip-dependency-restore] [--skip-ffmpeg-stage] [--allow-missing-ffmpeg]"
            echo "       [--ffmpeg-tarball PATH]"
            exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

echo "============================================================"
echo " BHS Air-Gap Startup"
echo "============================================================"
echo ""

# Step 1: Bootstrap env file
if [[ "$SKIP_BOOTSTRAP" != "true" ]]; then
    echo "[1/4] Running air-gap bootstrap..."
    bash "${SCRIPT_DIR}/airgap-bootstrap.sh" --output-env "$ENV_FILE"
    echo ""
fi

# Step 2: Offline dependency restore
if [[ "$SKIP_DEPENDENCY_RESTORE" != "true" ]]; then
    echo "[2/4] Restoring offline dependencies..."

    if [[ -f "${SCRIPT_DIR}/vendor-offline/install-nuget-offline.sh" ]]; then
        bash "${SCRIPT_DIR}/vendor-offline/install-nuget-offline.sh"
    elif [[ -f "${SCRIPT_DIR}/vendor-offline/install-nuget-offline.ps1" ]]; then
        echo "  [WARN] NuGet offline restore script only available as .ps1 - skipping"
    fi

    if [[ -f "${SCRIPT_DIR}/vendor-offline/install-npm-offline.sh" ]]; then
        bash "${SCRIPT_DIR}/vendor-offline/install-npm-offline.sh"
    elif [[ -f "${SCRIPT_DIR}/vendor-offline/install-npm-offline.ps1" ]]; then
        echo "  [WARN] npm offline restore script only available as .ps1 - skipping"
    fi
    echo ""
fi

# Step 3: FFmpeg core staging
if [[ "$SKIP_FFMPEG_STAGE" != "true" ]]; then
    echo "[3/4] Staging FFmpeg core assets..."

    STAGE_SCRIPT="${SCRIPT_DIR}/vendor-offline/stage-ffmpeg-core.sh"
    STAGE_EXECUTED=false

    if [[ -z "$FFMPEG_TARBALL" ]]; then
        # Search for vendored tarball
        VENDORED_TARBALL=$(find "${REPO_ROOT}/vendor/npm-tarballs" -name 'core-*.tgz' -type f 2>/dev/null | head -1)
        if [[ -n "$VENDORED_TARBALL" ]]; then
            if [[ -f "$STAGE_SCRIPT" ]]; then
                bash "$STAGE_SCRIPT" --tarball "$VENDORED_TARBALL"
                STAGE_EXECUTED=true
            else
                echo "  [WARN] stage-ffmpeg-core.sh not found - skipping"
            fi
        else
            if [[ "$ALLOW_MISSING_FFMPEG" == "true" ]]; then
                echo "  [WARN] No vendored ffmpeg core tarball found. Skipping due to --allow-missing-ffmpeg."
            else
                echo "  [ERROR] No vendored ffmpeg core tarball found (vendor/npm-tarballs/core-*.tgz)." >&2
                echo "  Stage FFmpeg assets first or use --allow-missing-ffmpeg." >&2
                exit 1
            fi
        fi
    else
        if [[ -f "$STAGE_SCRIPT" ]]; then
            bash "$STAGE_SCRIPT" --tarball "$FFMPEG_TARBALL"
            STAGE_EXECUTED=true
        else
            echo "  [WARN] stage-ffmpeg-core.sh not found - skipping"
        fi
    fi

    if [[ "$STAGE_EXECUTED" == "true" ]] && [[ ${PIPESTATUS[0]:-0} -ne 0 ]]; then
        echo "  [ERROR] stage-ffmpeg-core failed" >&2
        exit 1
    fi
    echo ""
fi

# Step 4: Docker compose up
echo "[4/4] Starting Docker Compose stack..."
cd "$REPO_ROOT"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

if [[ $? -ne 0 ]]; then
    echo "[ERROR] docker compose up failed" >&2
    exit 1
fi

echo ""
echo -e "\033[32m[OK]\033[0m Air-gap stack is up."

# Seed reference data
echo ""
echo "[SEED] Seeding reference data..."
if [[ -f "${SCRIPT_DIR}/seed-database.sh" ]]; then
    bash "${SCRIPT_DIR}/seed-database.sh" --mode airgap || {
        echo "[WARN] Database seeding had issues. You can retry: ./scripts/seed-database.sh --mode airgap"
    }
elif [[ -f "${SCRIPT_DIR}/seed-database.ps1" ]]; then
    echo "[INFO] seed-database.sh not found; seeding requires PowerShell: ./scripts/seed-database.ps1 -Mode airgap"
fi
