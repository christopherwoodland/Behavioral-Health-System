# DAM Self-Hosted API

Self-hosted API wrapper for the Hugging Face Kintsugi DAM model (`KintsugiHealth/dam`) with endpoints compatible with the Function app local provider contract.

## Endpoints

- `GET /health`
- `POST /initiate` → returns `{ "session_id": "..." }`
- `POST /predict` → accepts `sessionId` plus `audioData` (base64) or `audioFileUrl`

## Run

```powershell
docker compose -f ../../docker-compose.local.yml up -d --build dam-selfhost
```

## Notes

- This uses the actual model repo from Hugging Face at container build time.
- First build is heavy (PyTorch/model dependencies).
- `predict` returns DAM output under `result` and includes `session_id`/`status` fields expected by the Functions local provider.
