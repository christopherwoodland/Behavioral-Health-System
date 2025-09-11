import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Layout } from '@/components/layout/Layout';

// Page components
import { Dashboard } from '@/pages/Dashboard';
import { UploadAnalyze, Sessions, SessionDetail, Predictions, SystemHealth, NotFound } from '@/pages';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors except 408 (timeout)
        if (error && typeof error === 'object' && 'code' in error) {
          const errorCode = (error as any).code;
          if (errorCode?.startsWith('HTTP_4') && errorCode !== 'HTTP_408') {
            return false;
          }
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
          <Layout>
            <Routes>
              {/* Main routes */}
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload" element={<UploadAnalyze />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/sessions/:sessionId" element={<SessionDetail />} />
              <Route path="/predictions" element={<Predictions />} />
              <Route path="/health" element={<SystemHealth />} />
              
              {/* 404 page */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </Router>
      </ThemeProvider>
      
      {/* React Query DevTools (only in development) */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
