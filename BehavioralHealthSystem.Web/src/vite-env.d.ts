/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_AZURE_BLOB_SAS_URL: string;
  readonly VITE_STORAGE_CONTAINER_NAME: string;
  readonly VITE_POLL_INTERVAL_MS: string;
  readonly VITE_ENABLE_FFMPEG_WORKER: string;
  readonly VITE_ENABLE_DEBUG_LOGGING: string;
  readonly VITE_AZURE_SPEECH_ENDPOINT: string;
  readonly VITE_AZURE_SPEECH_API_KEY: string;
  readonly VITE_AZURE_SPEECH_MODEL: string;
  readonly VITE_AZURE_SPEECH_VOICE: string;
  readonly VITE_AGENT_NAME: string;
  readonly VITE_AGENT_ROLE: string;
  readonly VITE_AGENT_INSTRUCTIONS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
