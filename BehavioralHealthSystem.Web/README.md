# BehavioralHealthSystem.Web

React/TypeScript single-page application providing the clinician and user-facing interface for the Behavioral Health System.

## Overview

This frontend delivers the complete clinical workflow — from audio upload and voice biomarker analysis through AI-generated risk assessments and DSM-5 condition evaluations. It communicates with the [Functions API](../BehavioralHealthSystem.Functions/README.md) backend for all server-side operations.

## Tech Stack

- **React 18** with TypeScript
- **Vite** — build tooling and dev server
- **TailwindCSS** + SASS — styling
- **React Router v6** — client-side routing
- **TanStack React Query** — server state management and caching
- **MSAL / Microsoft Entra ID** — authentication
- **FFmpeg.wasm** — client-side audio conversion to WAV
- **Three.js** — real-time voice activity visualization
- **Vitest** + **React Testing Library** — unit testing
- **Playwright** — end-to-end testing

## Key Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Overview of recent sessions, system health, and quick actions |
| **Upload & Analyze** | Audio file upload with the Kintsugi DAM prediction pipeline — upload → convert → predict |
| **Sessions** | Browse, search, and manage assessment sessions |
| **Session Detail** | Full session view with prediction results, risk assessment, transcription, and extended assessment |
| **Predictions** | View DAM prediction results — depression and anxiety scores with severity categories |
| **Control Panel** | Administrative panel (role-gated) for system management |

## Core Features

### Audio Upload & DAM Analysis
Upload voice recordings for analysis by the Kintsugi Health Depression & Anxiety Model. The frontend handles client-side audio conversion to WAV via FFmpeg.wasm before submitting to the backend pipeline.

### Transcription
Displays transcribed text from audio recordings processed by the Azure Speech Fast Transcription API. Includes AI-powered grammar correction for improved readability.

### Risk Assessment Display
Renders AI-generated risk assessments with color-coded severity levels (Low / Moderate / High / Critical), contributing factors, clinical recommendations, and confidence scores.

### Extended Assessment
Trigger and view extended multi-condition psychiatric evaluations powered by GPT-5/O3. Includes a DSM-5 condition selector for targeted analysis, per-condition results, and cross-condition differential diagnosis.

### Voice Activity Visualization
Real-time Three.js visualization of audio input during voice recording sessions.

### PHQ Assessments
Patient Health Questionnaire assessment workflow with progress tracking across sessions.

## Project Structure

```
src/
├── pages/          # Route-level page components
├── components/     # Reusable UI components
├── services/       # API clients and service layers
├── hooks/          # Custom React hooks (API, accessibility, feature flags)
├── contexts/       # React contexts (Auth, Theme)
├── types/          # TypeScript type definitions
├── config/         # Auth config, constants
├── styles/         # Global styles and theme
├── test/           # Test setup and cross-cutting test files
└── utils/          # Utility functions
```

## Quick Start

```powershell
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` by default.

### Environment Variables

Key `VITE_*` variables (set in `.env` or `.env.local`):

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Functions API base URL (default: `http://localhost:7071/api`) |
| `VITE_ENABLE_ENTRA_AUTH` | Enable Microsoft Entra ID authentication |
| `VITE_AZURE_TENANT_ID` | Entra ID tenant ID |
| `VITE_AZURE_CLIENT_ID` | Frontend SPA app registration client ID (`BHS Development UI`) |
| `VITE_AZURE_API_CLIENT_ID` | Backend API app registration client ID (`BHS Development API`). Used to acquire the API access token, which carries the `roles` claim. **Required for role-based access to work.** |
| `VITE_AZURE_AUTHORITY` | Entra ID authority URL (`https://login.microsoftonline.com/{tenantId}`) |
| `VITE_AZURE_REDIRECT_URI` | Auth redirect URI |
| `VITE_STORAGE_CONTAINER_NAME` | Azure Blob container for uploads |
| `VITE_ENABLE_DEBUG_LOGGING` | Enable verbose console logging |

#### Authentication / Authorization Model

The app uses a **two-app-registration** Entra ID model:

| Registration | Purpose |
|---|---|
| `BHS Development UI` | SPA app — hosts the redirect URIs, initiates login |
| `BHS Development API` | API app — exposes `access_as_user` scope, carries `roles` claim |

**How roles are resolved:** At sign-in, MSAL requests `api://{VITE_AZURE_API_CLIENT_ID}/access_as_user` alongside the standard Graph scopes. After login, `AuthContext` silently acquires an API access token and decodes its `roles` claim (assigned via the API enterprise app) to determine the user's role (`Admin` or `ControlPanel`).

**Consent:** The API app uses `preAuthorizedApplications` to pre-authorize the UI client — no user or admin consent dialog appears. Run `.\infrastructure\scripts\Setup-EntraID.ps1` to configure this.

## Testing

```powershell
# Run unit tests
npm run test

# Run with coverage
npx vitest run --coverage
```

## Accessibility

The frontend follows WCAG 2.1 guidelines with:
- Skip-to-content navigation
- ARIA landmarks, roles, and labels on all interactive elements
- Keyboard-navigable dialogs (`AccessibleDialog` component)
- Screen reader announcements for dynamic content
- Focus management and trap patterns
- Reduced-motion support
