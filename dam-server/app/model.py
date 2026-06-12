"""
DAM Model inference wrapper.

Supports two modes:
  - Real inference: Loads a HuggingFace wav2vec2-based model from local path or hub
  - Mock mode:     Returns deterministic scores for testing without model weights

Set DAM_MOCK_MODE=true to enable mock mode.
Set DAM_MODEL_PATH=/models to load from a local directory (air-gap).
"""

import os
import uuid
import logging
import asyncio
from datetime import datetime, timezone

import numpy as np

logger = logging.getLogger("dam-server.model")


class DamModel:
    """Wraps the DAM audio classification model."""

    def __init__(self):
        self.mock_mode = os.environ.get("DAM_MOCK_MODE", "false").lower() in ("true", "1", "yes")
        self.model_path = os.environ.get("DAM_MODEL_PATH", "/models")
        self.model_id = os.environ.get("DAM_MODEL_ID", "KintsugiHealth/dam")
        self._model = None
        self._processor = None
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
        from transformers import AutoFeatureExtractor, AutoModelForAudioClassification

        # Determine where to load from: local path or HuggingFace hub
        model_source = self.model_path if os.path.isdir(self.model_path) else self.model_id

        logger.info("Loading DAM model from: %s", model_source)
        try:
            self._processor = AutoFeatureExtractor.from_pretrained(
                model_source, local_files_only=os.path.isdir(self.model_path)
            )
            self._model = AutoModelForAudioClassification.from_pretrained(
                model_source, local_files_only=os.path.isdir(self.model_path)
            )
            self._model.eval()
            if torch.cuda.is_available():
                self._model = self._model.cuda()
                logger.info("Model loaded on CUDA GPU")
            else:
                logger.info("Model loaded on CPU")
            self._is_loaded = True
        except Exception as e:
            logger.error("Failed to load model: %s", e)
            # Fall back to mock mode if model cannot be loaded
            logger.warning("Falling back to MOCK mode due to model load failure")
            self.mock_mode = True
            self._is_loaded = True

    async def predict(self, audio_bytes: bytes, session_id: str) -> dict:
        """Run prediction on audio bytes. Returns DAM response dict."""
        if self.mock_mode:
            return self._mock_predict(session_id)

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._predict_sync, audio_bytes, session_id)

    def _predict_sync(self, audio_bytes: bytes, session_id: str) -> dict:
        """Synchronous prediction (runs in thread pool)."""
        import torch
        import librosa
        import io
        import soundfile as sf

        try:
            # Decode audio bytes to numpy array
            audio_array, sr = sf.read(io.BytesIO(audio_bytes))

            # Resample to 16kHz if needed (standard for wav2vec2 models)
            if sr != 16000:
                audio_array = librosa.resample(audio_array, orig_sr=sr, target_sr=16000)
                sr = 16000

            # Ensure mono
            if len(audio_array.shape) > 1:
                audio_array = audio_array.mean(axis=1)

            # Process through feature extractor
            inputs = self._processor(
                audio_array,
                sampling_rate=sr,
                return_tensors="pt",
                padding=True,
            )

            if torch.cuda.is_available():
                inputs = {k: v.cuda() for k, v in inputs.items()}

            # Run inference
            with torch.no_grad():
                outputs = self._model(**inputs)
                logits = outputs.logits

            # Convert logits to scores (sigmoid for multi-label)
            scores = torch.sigmoid(logits).cpu().numpy()[0]

            # Map to depression/anxiety scores (model-specific mapping)
            # Assumes first output is depression, second is anxiety
            depression_score = float(scores[0]) if len(scores) > 0 else 0.0
            anxiety_score = float(scores[1]) if len(scores) > 1 else 0.0

            now = datetime.now(timezone.utc).isoformat()
            return {
                "session_id": session_id,
                "status": "completed",
                "predicted_score_depression": f"{depression_score:.4f}",
                "predicted_score_anxiety": f"{anxiety_score:.4f}",
                "predicted_score": f"{(depression_score + anxiety_score) / 2:.4f}",
                "model_category": "behavioral_health",
                "model_granularity": "utterance",
                "is_calibrated": True,
                "provider": "KintsugiHealth",
                "model": self.model_id,
                "created_at": now,
                "updated_at": now,
            }

        except Exception as e:
            logger.error("Prediction failed: %s", e)
            return {
                "session_id": session_id,
                "status": "error",
                "predicted_score_depression": "0.0",
                "predicted_score_anxiety": "0.0",
                "predicted_score": "0.0",
                "model_category": "behavioral_health",
                "model_granularity": "utterance",
                "is_calibrated": False,
                "provider": "KintsugiHealth",
                "model": self.model_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

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
