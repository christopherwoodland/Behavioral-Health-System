# Behavioral Health System - Web Application

A productio### Environment Variables

Create a `.env.local` file with:

```env
# Authentication Configuration
# Set to 'true' to enable Azure AD/Entra ID authentication
# Set to 'false' or leave unset to run without authentication (uses mock auth)
VITE_ENABLE_ENTRA_AUTH=true

# API Configuration
VITE_API_BASE=http://localhost:7071/api

# Azure AD Configuration (required when VITE_ENABLE_ENTRA_AUTH=true)
VITE_AZURE_CLIENT_ID=63e9b3fd-de9d-4083-879c-9c13f3aac54d
VITE_AZURE_TENANT_ID=3d6eb90f-fb5d-4624-99d7-1b8c4e077d07
VITE_AZURE_REDIRECT_URI=http://localhost:5173
VITE_AZURE_POST_LOGOUT_REDIRECT_URI=http://localhost:5173
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/3d6eb90f-fb5d-4624-99d7-1b8c4e077d07

# Azure AD Groups (if using groups instead of app roles)
VITE_AZURE_ADMIN_GROUP_ID=admin-group-object-id
VITE_AZURE_CONTROL_PANEL_GROUP_ID=control-panel-group-object-id

# Azure Blob Storage
VITE_AZURE_BLOB_SAS_URL=https://yourstorage.blob.core.windows.net/audio-uploads?sp=racw&st=...
VITE_STORAGE_CONTAINER_NAME=audio-uploads

# Polling Configuration
VITE_POLL_INTERVAL_MS=3000

# Feature Flags
VITE_ENABLE_FFMPEG_WORKER=true
VITE_ENABLE_DEBUG_LOGGING=false
``` React application for behavioral health analysis using audio files.

## 🚀 Features

- **WCAG 2.2 Level AA Compliant** - Full accessibility support with screen readers, keyboard navigation, and high contrast
- **Section 508 Compliant** - Meets government accessibility standards
- **Azure AD Authentication** - Microsoft identity platform integration with role-based access control
- **Real-time Communication** - SignalR-powered agent messaging with handoff capabilities
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices
- **Dark/Light Mode** - Automatic theme detection with manual toggle
- **Interactive Animations** - Brain icon hover animations for enhanced user engagement
- **Audio Processing** - Client-side audio conversion using FFmpeg.wasm
- **Azure Integration** - Direct upload to Azure Blob Storage with SAS tokens
- **Real-time Updates** - Polling for prediction results with progress tracking
- **Offline Support** - Progressive Web App capabilities
- **Session Re-run Functionality** - Smart re-analysis with optimized audio processing
- **Enhanced Modal System** - Improved information display replacing problematic tooltips
- **Streamlined Navigation** - Intuitive user flow with consistent design patterns

## 🛠️ Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** with custom accessibility-focused theme
- **React Router** for navigation
- **TanStack Query** for data fetching and caching
- **FFmpeg.wasm** for audio processing
- **Azure Storage Blob SDK** for file uploads
- **Jest + React Testing Library** for unit tests
- **Playwright** for E2E testing with accessibility validation

## 📋 Prerequisites

- Node.js 18+ and npm
- Azure Functions backend running (see main README)
- Azure Blob Storage with SAS URL configured

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env .env.local
   # Edit .env.local with your Azure configuration
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   ```
   http://localhost:3000
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file with:

```env
# API Configuration
VITE_API_BASE=http://localhost:7071/api

# Azure Blob Storage
VITE_AZURE_BLOB_SAS_URL=https://yourstorage.blob.core.windows.net/audio-uploads?sp=racw&st=...
VITE_STORAGE_CONTAINER_NAME=audio-uploads

# Polling Configuration
VITE_POLL_INTERVAL_MS=3000

# Feature Flags
VITE_ENABLE_FFMPEG_WORKER=true
VITE_ENABLE_DEBUG_LOGGING=false
```

### Azure Blob Storage Setup

1. Create a storage account and container
2. Generate a SAS URL with read, add, create, write permissions
3. Set the SAS URL in your environment variables

### Azure AD Authentication Setup

#### Conditional Authentication

The application supports conditional authentication, allowing you to run with or without Azure AD integration:

**With Authentication (Production/Secure Environment):**
```env
VITE_ENABLE_ENTRA_AUTH=true
```
- Full Azure AD authentication with role-based access control
- Requires Azure AD app registration and configuration
- Users must sign in to access the application

**Without Authentication (Development/Testing):**
```env
VITE_ENABLE_ENTRA_AUTH=false
# or leave the variable unset
```
- Uses mock authentication with a default admin user
- No Azure AD configuration required
- Useful for development, testing, or demo environments
- All authorization checks pass automatically

#### Full Azure AD Setup (when VITE_ENABLE_ENTRA_AUTH=true)

1. **Register application in Azure AD:**
   - Go to Azure Portal > Azure Active Directory > App registrations
   - Create new registration with redirect URI: `http://localhost:5173`
   - Note the Application (client) ID and Directory (tenant) ID

2. **Configure authentication:**
   - Add platform configuration for Single-page application
   - Set redirect URIs for development and production
   - Enable ID tokens and access tokens

3. **Set up roles or groups:**
   - **App Roles:** Define custom roles in the app manifest
   - **Groups:** Create security groups and assign users
   - Configure group IDs in environment variables

4. **Update environment variables:**
   - Use the client ID, tenant ID, and authority URL
   - Set appropriate redirect URIs for your environment

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run accessibility tests
npm run test:a11y

# Generate coverage report
npm run test:coverage
```

### E2E Tests
```bash
# Run E2E tests
npm run e2e

# Run E2E tests with UI
npm run e2e:ui
```

## 🎨 Styling & Accessibility

### Theme Configuration

The application uses a custom Tailwind theme with:
- Pastel colors that meet WCAG contrast requirements
- Dark mode support with `class` strategy
- Custom utility classes for accessibility
- Consistent spacing and typography scale

### Accessibility Features

- **Keyboard Navigation:** Full keyboard support with visible focus indicators
- **Screen Reader Support:** Proper ARIA labels, live regions, and semantic HTML
- **High Contrast:** Colors meet WCAG 2.2 AA contrast ratios (4.5:1 minimum)
- **Zoom Support:** Layout remains functional up to 200% zoom
- **Motion Preferences:** Respects `prefers-reduced-motion`

## 🎨 UI/UX Enhancements

### Brain Icon Animation

The application features an interactive brain throb animation that activates on hover:

- **Location:** Header navigation and Microsoft sign-in page
- **Animation:** Custom CSS keyframe animation with realistic scaling pattern
- **Duration:** 1.5 seconds with smooth transitions
- **Pattern:** Scale progression (1.0 → 1.05 → 1.1 → 1.05 → 1.0) creates a "living brain" effect
- **Implementation:** Uses Tailwind CSS classes with custom `@keyframes brain-throb` animation

```css
@keyframes brain-throb {
  0% { transform: scale(1.0); }
  25% { transform: scale(1.05); }
  50% { transform: scale(1.1); }
  75% { transform: scale(1.05); }
  100% { transform: scale(1.0); }
}
```

This subtle animation enhances user engagement while maintaining accessibility standards.

## 🔄 Real-Time Communication System

The application features a comprehensive real-time communication system using SignalR for behavioral health agent interactions.

### Features

- **Real-time messaging** between users and behavioral health agents
- **Agent handoff** with seamless transitions between specialized agents  
- **Typing indicators** to show when agents are processing responses
- **Session management** with unique session IDs for each user interaction
- **Speech integration** with voice input/output capabilities
- **Crisis detection** and appropriate agent routing

### Architecture

#### Backend Components

**AgentCommunicationHub.cs** - SignalR hub handling real-time communication:
- `GET /api/negotiate` - SignalR connection negotiation
- `POST /api/sendagentmessage` - Send message from agent to client
- `POST /api/notifyagenthandoff` - Notify client of agent handoff
- `POST /api/notifyagenttyping` - Send typing indicators
- `POST /api/joinsession` - Join a communication session
- `POST /api/sendusermessage` - Process user messages

**RealtimeAgentOrchestrator.cs** - Processes user input and coordinates agent responses:
- Crisis detection and routing
- Confidence scoring for agent responses
- Mock agent simulation for development
- Session status tracking

#### Frontend Components

**signalRService.ts** - TypeScript service for SignalR client communication:
- Connection management with automatic reconnection
- Event handling for messages, handoffs, typing indicators
- Session management and status tracking
- Error handling and connection state monitoring

**useSignalR.ts** - React hook for managing SignalR state:
- Connection status tracking
- Real-time message collection
- Agent handoff notifications
- Typing indicators by agent
- Session status and participants

### Message Types

```typescript
interface UserMessage {
  content: string;
  timestamp: string;
  audioData?: string;
  metadata?: {
    speechConfidence?: number;
    voiceActivityLevel?: number;
    processingTime?: number;
  };
}

interface AgentMessage {
  agentName: string;
  content: string;
  timestamp: string;
  confidence?: number;
  suggestedActions?: string[];
}

interface AgentHandoffNotification {
  fromAgent: string;
  toAgent: string;
  reason: string;
  timestamp: string;
  userContext?: any;
}
```

### Configuration

#### Local Development
- SignalR connection uses default local endpoint: `http://localhost:7071/api`
- No Azure SignalR service required for local development
- CORS enabled for cross-origin requests

#### Production
- Set `AzureSignalRConnectionString` environment variable
- Configure Azure SignalR Service resource
- Update frontend `signalRService.ts` baseUrl if needed

### Session Flow

1. **Connection:** Frontend establishes SignalR connection on load
2. **Session Join:** Generates unique session ID and joins session
3. **Messaging:** User sends messages through SignalR to backend
4. **Processing:** RealtimeAgentOrchestrator processes message through agent system
5. **Response:** Agents send responses back through SignalR hub
6. **Handoff:** System automatically handles agent transitions with notifications

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── layout/         # Layout components (Header, Footer)
│   ├── ui/             # Basic UI components (Button, Input)
│   └── features/       # Feature-specific components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API and external service integrations
├── contexts/           # React contexts (Theme, etc.)
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── config/             # Configuration and constants
└── test/               # Test utilities and setup
```

## 🔧 Development

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Building for Production

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 🚀 Deployment

### Build Process

The application builds to static files that can be deployed to any web server:

1. **Azure Static Web Apps** (recommended)
2. **Netlify** with environment variable support
3. **Vercel** with API route proxying
4. **AWS S3 + CloudFront**
5. **GitHub Pages** (with API backend elsewhere)c

### Environment Configuration

For production deployment, ensure these environment variables are set:
- `VITE_API_BASE` - Your production API endpoint
- `VITE_AZURE_BLOB_SAS_URL` - Production blob storage SAS URL
- Other configuration variables as needed

## 🎯 Usage

### Navigation & Dashboard Features

The application includes several UI improvements for better user experience:

- **Streamlined Navigation:** Clean header navigation with Dashboard, Upload, Sessions, and Predictions
- **Quick Actions Dashboard:** Four-column responsive grid layout for admin functions
- **Role-Based Access:** System Health and Agent Experience features require appropriate permissions
- **Coming Soon Features:** Agent Experience functionality is disabled with visual overlay indication
- **Consistent Button Styling:** System Health button matches View Summary styling (black text on white background)
- **Real-time Agent Communication:** SignalR-powered messaging system with typing indicators and agent handoffs

### Audio Upload Workflow

1. **Select Audio File** - Choose WAV, MP3, M4A, AAC, or FLAC files
2. **Automatic Conversion** - Files are converted to mono 44.1kHz WAV using FFmpeg
3. **Cloud Upload** - Converted files are uploaded to Azure Blob Storage
4. **Analysis Request** - API call initiates behavioral health analysis
5. **Real-time Updates** - Progress tracking with accessibility announcements
6. **Results Display** - View prediction results with detailed metrics

### Accessibility Features in Use

- **Screen Reader Announcements** for all major state changes
- **Progress Updates** announced during file processing
- **Error Messages** with clear remediation steps
- **Keyboard Shortcuts** for common actions
- **Focus Management** between page transitions

## � Latest Features & Enhancements

### Session Re-run Functionality

The application now includes sophisticated session re-run capabilities:

- **🔁 Smart Re-run System** - Re-analyze previous sessions with navigation-based workflow
- **⚡ Audio Processing Optimization** - Skip redundant audio conversion for existing files
- **📱 Dual Access Points** - Re-run from both Sessions list and Session Detail pages
- **🎯 Pre-filled Data** - Session information automatically populated on re-run
- **🔄 Optimized Performance** - Intelligent file handling reduces processing time

### Enhanced UI/UX Improvements

Recent interface enhancements for better user experience:

- **📱 Improved Modal System** - Replaced problematic tooltips with accessible modal dialogs
- **🧠 Interactive Brain Animation** - Custom CSS keyframe animation with realistic throb effect
- **📊 Enhanced Session Views** - Detailed session information with consistent styling
- **🎨 Unified Design Language** - Consistent button styling and component patterns
- **⚡ Responsive Interactions** - Smooth transitions and hover effects

### Technical Optimizations

- **📁 File Upload Intelligence** - Conditional audio processing based on file state
- **🔄 Navigation-Based Workflow** - Uses React Router state for efficient data transfer
- **🎯 Error Prevention** - Robust handling of edge cases during re-run operations
- **♿ Accessibility Focus** - All new features maintain WCAG 2.2 Level AA compliance

## �🔍 Troubleshooting

### Common Issues

1. **FFmpeg Loading Errors:**
   - Check internet connection (CDN dependency)
   - Verify SharedArrayBuffer support
   - Try disabling FFmpeg worker in .env

2. **Azure Upload Failures:**
   - Verify SAS URL permissions and expiration
   - Check CORS settings on storage account
   - Confirm container exists and is accessible

3. **API Connection Issues:**
   - Ensure backend is running on correct port
   - Verify CORS configuration
   - Check network connectivity

### Performance Optimization

- **Code Splitting:** Automatic chunking for faster loading
- **Image Optimization:** Use appropriate formats and sizes  
- **Caching:** TanStack Query handles intelligent caching
- **Bundle Analysis:** Use `npm run build -- --analyze`

## 📚 Additional Resources

- [React Accessibility Guide](https://reactjs.org/docs/accessibility.html)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [Section 508 Standards](https://www.section508.gov/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TanStack Query Guide](https://tanstack.com/query/latest)

## 🤝 Contributing

1. Follow the established code style and patterns
2. Add unit tests for new components
3. Ensure accessibility compliance
4. Update documentation as needed
5. Test with screen readers and keyboard navigation

## 📄 License

This project is part of the Behavioral Health System licensed under the MIT License.

---

**🌟 This application prioritizes accessibility and user experience while maintaining high performance and reliability. 🌟**
