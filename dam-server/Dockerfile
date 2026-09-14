# DAM (Depression & Anxiety Model) Self-Host Server
# Builds a local FastAPI server that implements the DAM prediction API contract.
#
# Build:   docker build -t bhs-dam-selfhost:local ./dam-server
# Run:     docker run -p 8000:8000 -e DAM_MOCK_MODE=true bhs-dam-selfhost:local
#
# For real inference, mount pre-downloaded model weights:
#   docker run -p 8000:8000 -v ./offline-models/dam:/models bhs-dam-selfhost:local

FROM python:3.11-slim AS base

# Prevents Python from buffering stdout/stderr
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Create non-root user
RUN groupadd -r dam && useradd -r -g dam -u 1000 dam

WORKDIR /app

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.6.0+cpu torchaudio==2.6.0+cpu \
    && pip install --no-cache-dir -r requirements.txt

# Create model and cache directories before switching away from root so model
# downloads do not need a copy-on-write ownership layer.
RUN mkdir -p /models /cache/huggingface && chown -R dam:dam /models /cache /app

USER dam

# Pin the public Apache-2.0 model artifacts and cache the Whisper backbone so
# runtime startup does not depend on access to Hugging Face.
ARG DAM_REVISION=df83a1e00101d9c06a5042b96b921eb94d5a2528
ENV HF_HOME=/cache/huggingface
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('KintsugiHealth/dam', revision='${DAM_REVISION}', local_dir='/models'); snapshot_download('openai/whisper-small.en')"

# Copy application source
COPY --chown=dam:dam app/ ./app/

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=10 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Default environment variables
ENV DAM_MOCK_MODE=false
ENV DAM_PRELOAD_ON_STARTUP=true
ENV DAM_PROCESS_START_METHOD=spawn
ENV DAM_MODEL_PATH=/models
ENV UVICORN_WORKERS=1

CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-2}"]
