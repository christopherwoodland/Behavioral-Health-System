/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync } from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Plugin to copy web.config to dist folder
    {
      name: 'copy-web-config',
      writeBundle() {
        try {
          copyFileSync('web.config', 'dist/web.config')
          console.log('✅ web.config copied to dist folder')
        } catch (error) {
          console.warn('⚠️ Could not copy web.config:', error)
        }
      }
    }
  ],
  css: {
    preprocessorOptions: {
      scss: {
        // Use modern Sass API instead of legacy API
        api: 'modern-compiler',
        // Silence deprecation warnings if needed
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    cors: true,
    proxy: {
      // Proxy requests to local Azurite blob storage to avoid CORS issues
      '/devstoreaccount1': {
        target: 'http://127.0.0.1:10000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Set chunk size warning limit (in KB)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Improved manual chunks for better code splitting
        manualChunks: (id) => {
          // Keep all React together to avoid version mismatches
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/scheduler')) {
            return 'react';
          }
          if (id.includes('node_modules/react-router')) {
            return 'router';
          }

          // Query and state management
          if (id.includes('@tanstack/react-query')) {
            return 'query';
          }

          // Azure SDK - split by service
          if (id.includes('@azure/storage-blob')) {
            return 'azure-storage';
          }
          if (id.includes('@azure/core') || id.includes('@azure/abort-controller') || id.includes('@azure/logger')) {
            return 'azure-core';
          }
          if (id.includes('@azure/msal')) {
            return 'azure-msal';
          }

          // FFmpeg (audio processing)
          if (id.includes('@ffmpeg/ffmpeg') || id.includes('@ffmpeg/util')) {
            return 'ffmpeg';
          }

          // UI Components - Material UI or similar
          if (id.includes('@mui') || id.includes('@emotion')) {
            return 'ui-components';
          }

          // Utilities and common libraries
          if (id.includes('node_modules/lodash') || id.includes('node_modules/date-fns')) {
            return 'utils';
          }

          // Markdown and syntax highlighting
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype')) {
            return 'markdown';
          }
          if (id.includes('prism') || id.includes('highlight')) {
            return 'syntax-highlight';
          }

          // Split remaining large node_modules
          if (id.includes('node_modules')) {
            // Group smaller packages together
            return 'vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  define: {
    global: 'globalThis',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './src/test/env.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
})
