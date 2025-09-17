// Test environment configuration

// Set up test environment variables
process.env.VITE_API_BASE = 'http://localhost:7071/api';

// Override Vite's import.meta.env for tests
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_BASE: 'http://localhost:7071/api',
    VITE_AZURE_BLOB_SAS_URL: '',
    VITE_STORAGE_CONTAINER_NAME: 'audio-uploads',
    VITE_POLL_INTERVAL_MS: '3000',
    VITE_ENABLE_FFMPEG_WORKER: 'false',
    VITE_ENABLE_DEBUG_LOGGING: 'false',
    MODE: 'test',
    DEV: false,
    PROD: false,
    SSR: false,
  },
  writable: true,
});