"""DAM model inference wrapper."""

import os
import logging
import asyncio
import io
import sys
from datetime import datetime, timezone

logger = logging.getLogger("dam-server.model")


class DamModel:
    """Wraps the DAM audio classification model."""

    def __init__(self):
        self.mock_mode = os.environ.get("DAM_MOCK_MODE", "false").lower() in ("true", "1", "yes")
        self.model_path = os.environ.get("DAM_MODEL_PATH", "/models")
        self.model_id = os.environ.get("DAM_MODEL_ID", "KintsugiHealth/dam")
        self._pipeline = None
        self._is_loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded

    async def load(self):
        """Load the model weights. In mock mode, this is a no-op."""
        if self.mock_mode:
            logger.info("Running in MOCK mode - no real model loaded")
            self._is_loaded = True
            return

        # Run blocking model load in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._load_sync)

    def _load_sync(self):
        """Synchronous model loading (runs in thread pool)."""
        import torch

        checkpoint = os.path.join(self.model_path, "dam3.1.ckpt")
        if not os.path.isfile(checkpoint):
            raise FileNotFoundError(f"DAM checkpoint not found: {checkpoint}")

        sys.path.insert(0, self.model_path)
        from pipeline import Pipeline

        device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        logger.info("Loading DAM model from %s on %s", checkpoint, device)
        self._pipeline = Pipeline(checkpoint=checkpoint, device=device)
        self._is_loaded = True

    async def predict(self, audio_bytes: bytes, session_id: str, quantized: bool = True) -> dict:
        """Run prediction on audio bytes. Returns DAM response dict."""
        if self.mock_mode:
            return self._mock_predict(session_id)

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._predict_sync, audio_bytes, session_id, quantized)

    def _predict_sync(self, audio_bytes: bytes, session_id: str, quantized: bool) -> dict:
        """Synchronous prediction (runs in thread pool)."""
        if self._pipeline is None:
            raise RuntimeError("DAM model is not loaded")

        scores = self._pipeline.run_on_file(io.BytesIO(audio_bytes), quantize=quantized)
        depression_score = self._score_value(scores["depression"])
        anxiety_score = self._score_value(scores["anxiety"])
        now = datetime.now(timezone.utc).isoformat()
        return {
            "session_id": session_id,
            "status": "completed",
            "predicted_score_depression": str(depression_score),
            "predicted_score_anxiety": str(anxiety_score),
            "predicted_score": str((depression_score + anxiety_score) / 2),
            "model_category": "behavioral_health",
            "model_granularity": "utterance",
            "is_calibrated": quantized,
            "provider": "KintsugiHealth",
            "model": self.model_id,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def _score_value(score):
        return score.item() if hasattr(score, "item") else score

    def _mock_predict(self, session_id: str) -> dict:
        """Return deterministic mock scores for testing."""
        # Use session_id hash for reproducible but varied mock scores
        hash_val = hash(session_id) % 1000
        depression = 0.3 + (hash_val % 40) / 100.0  # Range: 0.30 - 0.69
        anxiety = 0.25 + ((hash_val + 17) % 45) / 100.0  # Range: 0.25 - 0.69

        now = datetime.now(timezone.utc).isoformat()
        return {
            "session_id": session_id,
            "status": "completed",
            "predicted_score_depression": f"{depression:.4f}",
            "predicted_score_anxiety": f"{anxiety:.4f}",
            "predicted_score": f"{(depression + anxiety) / 2:.4f}",
            "model_category": "behavioral_health",
            "model_granularity": "utterance",
            "is_calibrated": True,
            "provider": "KintsugiHealth",
            "model": "dam-mock",
            "created_at": now,
            "updated_at": now,
        }
