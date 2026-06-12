#!/usr/bin/env bash
# airgap-bootstrap.sh
# Creates an air-gap ready env file and validates local dependency endpoints.
#
# Usage: ./scripts/airgap-bootstrap.sh [options]
#   --input-env FILE          Input env file (default: ../docker.env.example)
#   --output-env FILE         Output env file (default: ../docker.env.airgap)
#   --openai-endpoint URL     Local OpenAI-compatible endpoint (default: http://host.docker.internal:11434/v1)
#   --api-base-url URL        API base URL (default: http://localhost:7071/api)
#   --dam-health-endpoint URL DAM health endpoint (default: http://localhost:8000/health)
#   --ollama-tags-endpoint URL Ollama tags endpoint (default: http://localhost:11434/api/tags)
#   --skip-checks             Skip endpoint connectivity checks

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default parameters
INPUT_ENV="${REPO_ROOT}/docker.env.example"
OUTPUT_ENV="${REPO_ROOT}/docker.env.airgap"
OPENAI_ENDPOINT="http://host.docker.internal:11434/v1"
API_BASE_URL="http://localhost:7071/api"
DAM_HEALTH_ENDPOINT="http://localhost:8000/health"
OLLAMA_TAGS_ENDPOINT="http://localhost:11434/api/tags"
SKIP_CHECKS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --input-env) INPUT_ENV="$2"; shift 2 ;;
        --output-env) OUTPUT_ENV="$2"; shift 2 ;;
        --openai-endpoint) OPENAI_ENDPOINT="$2"; shift 2 ;;
        --api-base-url) API_BASE_URL="$2"; shift 2 ;;
        --dam-health-endpoint) DAM_HEALTH_ENDPOINT="$2"; shift 2 ;;
        --ollama-tags-endpoint) OLLAMA_TAGS_ENDPOINT="$2"; shift 2 ;;
        --skip-checks) SKIP_CHECKS=true; shift ;;
        -h|--help)
            echo "Usage: $0 [--input-env FILE] [--output-env FILE] [--openai-endpoint URL]"
            echo "       [--api-base-url URL] [--dam-health-endpoint URL] [--skip-checks]"
            exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# Resolve to absolute paths
INPUT_ENV="$(cd "$(dirname "$INPUT_ENV")" && pwd)/$(basename "$INPUT_ENV")"

# --- Functions ---

read_env_file() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        echo "ERROR: Env file not found: $file" >&2
        exit 1
    fi
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip blank lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        echo "$line"
    done < "$file"
}

get_env_value() {
    local key="$1"
    local file="$2"
    local val
    val=$(grep -m1 "^${key}=" "$file" 2>/dev/null | cut -d'=' -f2-)
    echo "$val"
}

test_http_endpoint() {
    local name="$1"
    local url="$2"
    local timeout="${3:-5}"
    if curl -sf --max-time "$timeout" "$url" > /dev/null 2>&1; then
        echo -e "\033[32m[OK]\033[0m $name reachable: $url"
    else
        echo -e "\033[33m[WARN]\033[0m $name not reachable: $url"
    fi
}

# --- Main ---

echo "============================================================"
echo "BHS Air-Gap Bootstrap"
echo "Input env : $INPUT_ENV"
echo "Output env: $OUTPUT_ENV"
echo "============================================================"

# Read input env and build output
declare -A env_map

while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    env_map["$key"]="$value"
done < "$INPUT_ENV"

# Apply air-gap overrides
env_map[AIR_GAP_MODE]="true"
env_map[AIR_GAP_AUTH_BYPASS_APPROVED]="true"
env_map[VITE_AIR_GAP_MODE]="true"
env_map[VITE_ENABLE_TRANSCRIPTION]="false"
env_map[ENABLE_TRANSCRIPTION]="false"
env_map[VITE_ENABLE_AUTH]="false"
env_map[VITE_ENABLE_ENTRA_AUTH]="false"
env_map[VITE_API_BASE_URL]="$API_BASE_URL"
env_map[VITE_OFFLINE_MODE]="true"
env_map[VITE_FFMPEG_CORE_BASE_URL]="/ffmpeg-core"

env_map[AIR_GAP_OPENAI_ENDPOINT]="$OPENAI_ENDPOINT"
# Preserve existing API key if set
env_map[AIR_GAP_OPENAI_DEPLOYMENT]="${env_map[AIR_GAP_OPENAI_DEPLOYMENT]:-gpt-oss-20b}"

env_map[AIR_GAP_EXTENDED_OPENAI_ENDPOINT]="$OPENAI_ENDPOINT"
env_map[AIR_GAP_EXTENDED_OPENAI_DEPLOYMENT]="${env_map[AIR_GAP_EXTENDED_OPENAI_DEPLOYMENT]:-gpt-oss-20b}"

# Write output env file
mkdir -p "$(dirname "$OUTPUT_ENV")"
> "$OUTPUT_ENV"
for key in "${!env_map[@]}"; do
    echo "${key}=${env_map[$key]}" >> "$OUTPUT_ENV"
done

echo ""
echo "Air-gap env file written to: $OUTPUT_ENV"

# Endpoint checks
if [[ "$SKIP_CHECKS" != "true" ]]; then
    echo ""
    echo "Checking local endpoints..."
    test_http_endpoint "Ollama" "$OLLAMA_TAGS_ENDPOINT"
    test_http_endpoint "DAM health" "$DAM_HEALTH_ENDPOINT"
fi

echo ""
echo "Next steps:"
echo "  1) Stage FFmpeg core: ./scripts/vendor-offline/stage-ffmpeg-core.sh"
echo "  2) Start stack: docker compose --env-file $OUTPUT_ENV -f docker-compose.local.yml up -d --build"
