/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_AZURE_BLOB_SAS_URL: string;
  readonly VITE_STORAGE_CONTAINER_NAME: string;
  readonly VITE_POLL_INTERVAL_MS: string;
  readonly VITE_ENABLE_FFMPEG_WORKER: string;
  readonly VITE_ENABLE_DEBUG_LOGGING: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
