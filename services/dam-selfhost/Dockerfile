FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DAM_MODEL_REPO=https://huggingface.co/KintsugiHealth/dam

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r requirements.txt

RUN pip install huggingface_hub
RUN python - <<'PY'
from huggingface_hub import snapshot_download

snapshot_download(
    repo_id='KintsugiHealth/dam',
    local_dir='/opt/dam-model',
    local_dir_use_symlinks=False,
)
PY
RUN sed -i "s/^pytorch~=2\.6\.0$/torch~=2.6.0/" /opt/dam-model/requirements.txt
RUN sed -i "s/^torchaudio~=2\.7\.0$/torchaudio~=2.6.0/" /opt/dam-model/requirements.txt
RUN sed -i "s/^pysoundfile~=0\.13\.1$/soundfile~=0.13.1/" /opt/dam-model/requirements.txt
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu -r /opt/dam-model/requirements.txt
RUN python - <<'PY'
from pathlib import Path
import re

path = Path('/opt/dam-model/pipeline.py')
text = path.read_text(encoding='utf-8')
text = re.sub(
    r"torch\.load\(\s*checkpoint\s*,\s*map_location\s*=\s*device\s*\)",
    "torch.load(checkpoint, map_location=device, weights_only=False)",
    text,
)
path.write_text(text, encoding='utf-8')
PY

COPY app ./app

WORKDIR /app
ENV PYTHONPATH=/opt/dam-model:/app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
