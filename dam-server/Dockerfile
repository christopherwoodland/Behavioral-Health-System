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
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/

# Create writable cache directory for HuggingFace models
RUN mkdir -p /cache/huggingface && chown -R dam:dam /cache /app
ENV HF_HOME=/cache/huggingface
ENV TRANSFORMERS_CACHE=/cache/huggingface/hub

# Switch to non-root user
USER dam

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=10 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Default environment variables
ENV DAM_MOCK_MODE=false
ENV DAM_PRELOAD_ON_STARTUP=true
ENV DAM_PROCESS_START_METHOD=spawn
ENV DAM_MODEL_PATH=/models
ENV UVICORN_WORKERS=2

CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-2}"]
