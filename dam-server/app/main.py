"""
DAM Self-Host Server - FastAPI application entry point.

Endpoints:
  GET  /health    - Health/readiness check (reports model load status)
  POST /initiate  - Create a new prediction session
  POST /predict   - Submit audio for depression/anxiety scoring
"""

import os
import uuid
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.model import DamModel

logger = logging.getLogger("dam-server")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# Global model instance
_model: DamModel | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup if DAM_PRELOAD_ON_STARTUP is set."""
    global _model
    _model = DamModel()
    preload = os.environ.get("DAM_PRELOAD_ON_STARTUP", "true").lower() in ("true", "1", "yes")
    if preload:
        logger.info("Preloading DAM model on startup...")
        await _model.load()
        logger.info("DAM model loaded successfully.")
    yield
    # Cleanup
    _model = None


app = FastAPI(title="BHS DAM Self-Host", version="1.0.0", lifespan=lifespan)


# ---------- Request/Response Models ----------


class InitiateRequestBody(BaseModel):
    userId: str = ""
    isInitiated: bool = True
    metadata: dict | None = None
    modelId: str = "KintsugiHealth/dam"


class InitiateResponseBody(BaseModel):
    session_id: str


class PredictRequestBody(BaseModel):
    sessionId: str = ""
    audioData: str | None = None  # base64-encoded audio bytes
    audioFileUrl: str | None = None
    audioFileName: str = "audio.wav"
    modelId: str = "KintsugiHealth/dam"
    quantized: bool = True


class PredictResponseBody(BaseModel):
    session_id: str = ""
    status: str = "completed"
    predicted_score_depression: str = ""
    predicted_score_anxiety: str = ""
    predicted_score: str = ""
    model_category: str = "behavioral_health"
    model_granularity: str = "utterance"
    is_calibrated: bool = True
    provider: str = "KintsugiHealth"
    model: str = "dam"
    created_at: str = ""
    updated_at: str = ""


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    mock_mode: bool


# ---------- Endpoints ----------


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint. Returns model load status."""
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    return HealthResponse(
        status="healthy" if _model.is_loaded else "loading",
        model_loaded=_model.is_loaded,
        mock_mode=_model.mock_mode,
    )


@app.post("/initiate", response_model=InitiateResponseBody)
async def initiate(body: InitiateRequestBody):
    """Create a new prediction session."""
    session_id = uuid.uuid4().hex
    logger.info("Session initiated: %s (userId=%s, modelId=%s)", session_id, body.userId, body.modelId)
    return InitiateResponseBody(session_id=session_id)


@app.post("/predict", response_model=PredictResponseBody)
async def predict(body: PredictRequestBody):
    """Submit audio for depression/anxiety prediction."""
    if _model is None or not _model.is_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    session_id = body.sessionId or uuid.uuid4().hex

    # Decode audio from base64 or fetch from URL
    audio_bytes: bytes | None = None
    if body.audioData:
        import base64
        try:
            audio_bytes = base64.b64decode(body.audioData)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 audio data: {e}")
    elif body.audioFileUrl:
        import urllib.request
        try:
            with urllib.request.urlopen(body.audioFileUrl, timeout=30) as resp:
                audio_bytes = resp.read()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch audio from URL: {e}")

    if audio_bytes is None:
        raise HTTPException(status_code=400, detail="No audio data provided (audioData or audioFileUrl required)")

    logger.info("Running prediction for session %s (%d bytes audio)", session_id, len(audio_bytes))
    result = await _model.predict(audio_bytes, session_id)
    return result
