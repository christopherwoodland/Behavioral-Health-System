# Behavioral Health System - React Frontend

Modern React frontend with real-time voice interaction, PHQ assessments, and AI-powered mental health screening.

## 🏗️ Project Structure

```
BehavioralHealthSystem.Web/
├── src/
│   ├── components/        # React components
│   ├── contexts/          # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page components
│   ├── services/         # API and business logic
│   ├── styles/           # CSS and styling
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── public/               # Static assets
└── index.html           # HTML entry point
```

## 🚀 Key Features

- **Real-Time Voice AI** - Azure OpenAI Realtime API with GPT-4o
- **Voice Activity Detection** - Smart speech detection
- **PHQ-2/PHQ-9 Assessments** - Depression screening tools
- **Session Management** - Persistent user sessions
- **Chat Transcripts** - Real-time conversation logging
- **Biometric Data Collection** - Progressive health metrics capture
- **DSM-5 Integration** - Diagnostic criteria lookup
- **Responsive Design** - Mobile-first interface
- **Accessibility** - WCAG 2.1 AA compliant

## 🔧 Configuration

### .env.local

```env
VITE_API_BASE_URL=http://localhost:7071/api
VITE_AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com
VITE_AZURE_OPENAI_API_KEY=your-key
VITE_AZURE_OPENAI_DEPLOYMENT=gpt-4o-realtime-preview
VITE_ENABLE_AGENT_MODE=true
VITE_ENABLE_DEBUG_LOGGING=false
```

## 🏃 Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 🧪 Testing

```bash
# Unit tests (Vitest)
npm test

# E2E tests (Playwright)
npm run test:e2e

# Coverage report
npm run test:coverage
```

## 📦 Key Dependencies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Vitest** - Unit testing
- **Playwright** - E2E testing
- **Testing Library** - Component testing

## 🎨 Component Library

### Core Components
- `AgentVoiceChat` - Real-time voice interaction
- `PhqAssessmentForm` - PHQ questionnaires
- `SessionsList` - User session management
- `BiometricDataForm` - Health metrics collection
- `AudioRecorder` - Session recording

### Context Providers
- `AuthContext` - Authentication state
- `ThemeContext` - Dark/light mode
- `SessionContext` - Session management

## 🔐 Security

- Environment variable configuration
- API key protection
- CORS handling
- XSS protection
- Content Security Policy

## 📊 State Management

- React Context API for global state
- Local state with useState/useReducer
- Session storage for persistence
- IndexedDB for offline support

## 🎯 API Integration

All API calls are centralized in `src/services/`:

- `api.ts` - Base API client
- `phqAssessmentService.ts` - PHQ assessments
- `chatTranscriptService.ts` - Conversation logging
- `biometricDataService.ts` - Health metrics
- `dsm5Service.ts` - DSM-5 diagnostic data
- `sessionVoiceRecordingService.ts` - Audio recording
- `azureOpenAIRealtimeService.ts` - Real-time AI

## 🌐 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## ♿ Accessibility

- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- Color contrast compliance
- Focus management

## 📚 Additional Resources

- [Main README](../README.md) - Complete system documentation
- [Component Documentation](../README.md#-frontend-components) - Detailed component specs
- [API Reference](../README.md#-api-reference) - Backend endpoints
