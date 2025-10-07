/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AZURE_BLOB_SAS_URL: string;
  readonly VITE_STORAGE_CONTAINER_NAME: string;
  readonly VITE_POLL_INTERVAL_MS: string;
  readonly VITE_ENABLE_FFMPEG_WORKER: string;
  readonly VITE_ENABLE_DEBUG_LOGGING: string;
  readonly VITE_JOB_POLL_INTERVAL_MS: string;
  
  // Azure OpenAI Realtime API Configuration (Two-Step Authentication)
  readonly VITE_AZURE_OPENAI_RESOURCE_NAME: string;
  readonly VITE_AZURE_OPENAI_REALTIME_KEY: string;
  readonly VITE_AZURE_OPENAI_REALTIME_DEPLOYMENT: string;
  readonly VITE_AZURE_OPENAI_REALTIME_API_VERSION: string;
  readonly VITE_AZURE_OPENAI_WEBRTC_REGION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
