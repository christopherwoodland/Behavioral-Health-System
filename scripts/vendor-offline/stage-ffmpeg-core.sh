#!/usr/bin/env bash
# Stages FFmpeg core browser assets into BehavioralHealthSystem.Web/public/ffmpeg-core.
#
# Usage: ./scripts/vendor-offline/stage-ffmpeg-core.sh [--version VERSION] [--destination-dir DIR] [--tarball PATH]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VERSION="0.12.6"
DESTINATION_DIR="${REPO_ROOT}/BehavioralHealthSystem.Web/public/ffmpeg-core"
TARBALL_PATH=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        --destination-dir) DESTINATION_DIR="$2"; shift 2 ;;
        --tarball) TARBALL_PATH="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--version VERSION] [--destination-dir DIR] [--tarball PATH]"
            exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

TEMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t bhs-ffmpeg-core)"
trap 'rm -rf "$TEMP_DIR"' EXIT

if [[ -z "$TARBALL_PATH" ]]; then
    echo "Downloading @ffmpeg/core@${VERSION} with npm pack..."
    npm pack "@ffmpeg/core@${VERSION}" --pack-destination "$TEMP_DIR" > /dev/null
    TARBALL_PATH="$(find "$TEMP_DIR" -maxdepth 1 -name '*.tgz' -type f | head -1)"
    if [[ -z "$TARBALL_PATH" ]]; then
        echo "Unable to find downloaded @ffmpeg/core tarball." >&2
        exit 1
    fi
else
    TARBALL_PATH="$(cd "$(dirname "$TARBALL_PATH")" && pwd)/$(basename "$TARBALL_PATH")"
    if [[ ! -f "$TARBALL_PATH" ]]; then
        echo "Tarball not found: $TARBALL_PATH" >&2
        exit 1
    fi
fi

EXTRACT_DIR="$TEMP_DIR/extract"
mkdir -p "$EXTRACT_DIR"
tar -xf "$TARBALL_PATH" -C "$EXTRACT_DIR"

ESM_DIR="$EXTRACT_DIR/package/dist/esm"
if [[ ! -d "$ESM_DIR" ]]; then
    echo "Expected dist/esm folder not found in package: $ESM_DIR" >&2
    exit 1
fi

mkdir -p "$DESTINATION_DIR"
for name in ffmpeg-core.js ffmpeg-core.wasm ffmpeg-core.worker.js; do
    if [[ -f "$ESM_DIR/$name" ]]; then
        cp "$ESM_DIR/$name" "$DESTINATION_DIR/$name"
    fi
done

if [[ ! -f "$DESTINATION_DIR/ffmpeg-core.js" || ! -f "$DESTINATION_DIR/ffmpeg-core.wasm" ]]; then
    echo "FFmpeg core staging incomplete. Required files missing (ffmpeg-core.js / ffmpeg-core.wasm)." >&2
    exit 1
fi

echo "[OK] FFmpeg core assets staged successfully."
echo "Destination: $DESTINATION_DIR"
