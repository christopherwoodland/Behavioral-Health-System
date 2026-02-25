import base64
import logging
import multiprocessing as mp
import os
import subprocess
import tempfile
import threading
import uuid
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from pipeline import Pipeline  # type: ignore
except Exception as ex:  # pragma: no cover
    raise RuntimeError(
        "DAM pipeline import failed. Ensure the DAM repository and dependencies are installed."
    ) from ex

logger = logging.getLogger("dam-selfhost")
logging.basicConfig(level=os.getenv("DAM_LOG_LEVEL", "INFO"))

app = FastAPI(title="DAM Self-Hosted API", version="1.0.0")
_pipeline: Pipeline | None = None
_pipeline_lock = threading.Lock()
_prediction_timeout_seconds = int(os.getenv("DAM_PREDICT_TIMEOUT_SECONDS", "300"))
_max_audio_seconds = float(os.getenv("DAM_MAX_AUDIO_SECONDS", "45"))
_mock_mode = os.getenv("DAM_MOCK_MODE", "false").strip().lower() == "true"
_preload_on_startup = os.getenv("DAM_PRELOAD_ON_STARTUP", "true").strip().lower() == "true"


def _get_pipeline() -> Pipeline:
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    with _pipeline_lock:
        if _pipeline is None:
            logger.info("Loading DAM pipeline...")
            _pipeline = Pipeline()
            logger.info("DAM pipeline loaded")

    return _pipeline


@app.on_event("startup")
async def preload_pipeline_on_startup() -> None:
    if _mock_mode:
        logger.info("Skipping DAM pipeline preload because DAM_MOCK_MODE is enabled")
        return

    if not _preload_on_startup:
        logger.info("DAM pipeline preload is disabled by DAM_PRELOAD_ON_STARTUP")
        return

    logger.info("Preloading DAM pipeline at startup")
    _get_pipeline()


class InitiateRequest(BaseModel):
    userId: str = ""
    isInitiated: bool = True
    metadata: dict[str, Any] | None = None
    modelId: str | None = None


class InitiateResponse(BaseModel):
    session_id: str


class PredictRequest(BaseModel):
    sessionId: str
    audioData: str | None = None
    audioFileUrl: str | None = None
    audioFileName: str = "audio.wav"
    modelId: str | None = None
    quantized: bool = True


class PredictResponse(BaseModel):
    session_id: str
    status: str = "submitted"
    provider: str = "dam-selfhost"
    model: str = "KintsugiHealth/dam"
    result: dict[str, Any] | None = None


def _write_temp_audio_from_base64(data: str, filename_hint: str) -> Path:
    suffix = Path(filename_hint).suffix or ".wav"
    raw = base64.b64decode(data)
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(raw)
        logger.info("Decoded base64 audio to temp file: path=%s bytes=%s", tmp.name, len(raw))
        return Path(tmp.name)


async def _download_audio(url: str, filename_hint: str) -> Path:
    suffix = Path(filename_hint).suffix or ".wav"
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        logger.info("Downloading audio from URL: %s", url)
        response = await client.get(url)
        response.raise_for_status()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(response.content)
            logger.info("Downloaded audio to temp file: path=%s bytes=%s", tmp.name, len(response.content))
            return Path(tmp.name)


def _trim_audio_duration(audio_path: Path, max_seconds: float) -> Path:
    if max_seconds <= 0:
        return audio_path

    with tempfile.NamedTemporaryFile(delete=False, suffix=audio_path.suffix or ".wav") as tmp:
        trimmed_path = Path(tmp.name)

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(audio_path),
        "-t",
        f"{max_seconds}",
        str(trimmed_path),
    ]

    logger.info("Trimming audio to max %.2f seconds: input=%s output=%s", max_seconds, audio_path, trimmed_path)

    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        logger.info("Audio trim completed: output=%s", trimmed_path)
        if result.stderr:
            logger.debug("ffmpeg trim stderr: %s", result.stderr.strip())
        return trimmed_path
    except subprocess.CalledProcessError as ex:
        logger.warning("Audio trim failed, using original file. error=%s", ex.stderr.strip() if ex.stderr else ex)
        try:
            trimmed_path.unlink(missing_ok=True)
        except Exception:
            logger.warning("Failed to cleanup trimmed temp file: %s", trimmed_path)
        return audio_path


def _run_prediction_worker(audio_path: str, quantized: bool, result_queue: mp.Queue) -> None:
    try:
        logger.info("Prediction worker started: pid=%s audio_path=%s quantized=%s", os.getpid(), audio_path, quantized)
        pipeline = _get_pipeline()
        result = pipeline.run_on_file(audio_path, quantize=quantized)
        if not isinstance(result, dict):
            result = {"raw": result}
        result_queue.put({"ok": True, "result": result})
        logger.info("Prediction worker completed successfully: pid=%s", os.getpid())
    except Exception as ex:  # pragma: no cover - this runs in subprocess
        result_queue.put({"ok": False, "error": str(ex)})


def _run_prediction_in_process(audio_path: str, quantized: bool) -> dict[str, Any]:
    logger.info("Running prediction in-process for memory-safe fallback")
    pipeline = _get_pipeline()
    result = pipeline.run_on_file(audio_path, quantize=quantized)
    if not isinstance(result, dict):
        result = {"raw": result}
    return result


def _run_prediction_isolated(audio_path: str, quantized: bool) -> dict[str, Any]:
    default_start_method = "spawn"
    configured_start_method = os.getenv("DAM_PROCESS_START_METHOD", default_start_method).strip().lower()
    if configured_start_method not in {"spawn", "fork"}:
        configured_start_method = default_start_method

    start_method = configured_start_method if os.name == "posix" else "spawn"
    context = mp.get_context(start_method)

    result_queue: mp.Queue = context.Queue()
    process = context.Process(
        target=_run_prediction_worker,
        args=(audio_path, quantized, result_queue),
        daemon=True,
    )

    process.start()
    logger.info(
        "Started isolated prediction process pid=%s timeout_s=%s start_method=%s quantized=%s",
        process.pid,
        _prediction_timeout_seconds,
        start_method,
        quantized,
    )
    process.join(_prediction_timeout_seconds)

    if process.is_alive():
        logger.error("Prediction process timed out; terminating pid=%s", process.pid)
        process.terminate()
        process.join(5)
        raise TimeoutError(f"DAM prediction timed out after {_prediction_timeout_seconds} seconds")

    payload: dict[str, Any] | None = None
    if not result_queue.empty():
        payload = result_queue.get()

    if process.exitcode not in (0, None) and payload is None:
        if process.exitcode in (-9, 137):
            raise RuntimeError("DAM prediction worker was terminated by the OS (possible memory pressure)")
        raise RuntimeError(f"DAM prediction worker exited unexpectedly with code {process.exitcode}")

    if not payload:
        raise RuntimeError("DAM prediction worker returned no result")

    if not payload.get("ok"):
        raise RuntimeError(payload.get("error", "DAM prediction worker failed"))

    result = payload.get("result")
    if not isinstance(result, dict):
        raise RuntimeError("DAM prediction worker returned invalid result payload")

    return result


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "pipeline": "loaded" if _pipeline is not None else "not_loaded"
    }


@app.post("/initiate", response_model=InitiateResponse)
async def initiate(_: InitiateRequest) -> InitiateResponse:
    return InitiateResponse(session_id=uuid.uuid4().hex)


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest) -> PredictResponse:
    if not request.audioData and not request.audioFileUrl:
        raise HTTPException(status_code=400, detail="Either audioData or audioFileUrl is required")

    if _mock_mode:
        logger.warning("DAM_MOCK_MODE enabled: returning mock prediction for session_id=%s", request.sessionId)
        return PredictResponse(
            session_id=request.sessionId,
            status="completed",
            result={
                "provider": "dam-selfhost-mock",
                "depression_score": 0.42,
                "confidence": 0.61,
                "note": "Mock DAM response for local development"
            },
        )

    audio_path: Path | None = None
    processed_audio_path: Path | None = None
    try:
        logger.info(
            "Predict request received: session_id=%s has_audio_data=%s has_audio_url=%s filename=%s quantized=%s model_id=%s",
            request.sessionId,
            bool(request.audioData),
            bool(request.audioFileUrl),
            request.audioFileName,
            request.quantized,
            request.modelId,
        )

        if request.audioData:
            audio_path = _write_temp_audio_from_base64(request.audioData, request.audioFileName)
        else:
            audio_path = await _download_audio(request.audioFileUrl or "", request.audioFileName)

        processed_audio_path = _trim_audio_duration(audio_path, _max_audio_seconds)

        try:
            result = _run_prediction_isolated(str(processed_audio_path), request.quantized)
        except RuntimeError as ex:
            if "possible memory pressure" not in str(ex):
                raise

            logger.warning("Prediction worker terminated under memory pressure. Falling back to in-process inference.")
            result = _run_prediction_in_process(str(processed_audio_path), request.quantized)

        logger.info("Predict request completed: session_id=%s", request.sessionId)

        return PredictResponse(
            session_id=request.sessionId,
            status="completed",
            result=result,
        )
    except HTTPException:
        raise
    except Exception as ex:
        logger.exception("DAM prediction failed")
        raise HTTPException(status_code=500, detail=f"DAM prediction failed: {ex}") from ex
    finally:
        if processed_audio_path and processed_audio_path != audio_path and processed_audio_path.exists():
            try:
                processed_audio_path.unlink(missing_ok=True)
            except Exception:
                logger.warning("Failed to clean processed temp audio file: %s", processed_audio_path)

        if audio_path and audio_path.exists():
            try:
                audio_path.unlink(missing_ok=True)
            except Exception:
                logger.warning("Failed to clean temp audio file: %s", audio_path)
