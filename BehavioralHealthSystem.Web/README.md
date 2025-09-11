# Behavioral Health System - Web Application

A production-grade, accessible React application for behavioral health analysis using audio files.

## 🚀 Features

- **WCAG 2.2 Level AA Compliant** - Full accessibility support with screen readers, keyboard navigation, and high contrast
- **Section 508 Compliant** - Meets government accessibility standards
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices
- **Dark/Light Mode** - Automatic theme detection with manual toggle
- **Audio Processing** - Client-side audio conversion using FFmpeg.wasm
- **Azure Integration** - Direct upload to Azure Blob Storage with SAS tokens
- **Real-time Updates** - Polling for prediction results with progress tracking
- **Offline Support** - Progressive Web App capabilities

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

## 🔍 Troubleshooting

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
