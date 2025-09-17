import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/AuthGuards';
import { ApiAuthInitializer } from '@/components/auth/ApiAuthInitializer';
import { Layout } from '@/components/layout/Layout';
import { msalConfig } from '@/config/authConfig';
import { APP_ROLES } from '@/config/authConfig';

// Page components
import { Dashboard } from '@/pages/Dashboard';
import { UploadAnalyze, Sessions, SessionDetail, Predictions, ControlPanel, SystemHealth, NotFound } from '@/pages';

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

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ApiAuthInitializer>
              <Router>
                <Layout>
                  <Routes>
                  {/* Control Panel route - accessible to both Admin and Control Panel roles */}
                  <Route 
                    path="/" 
                    element={
                      <ProtectedRoute requireRoles={[APP_ROLES.ADMIN, APP_ROLES.CONTROL_PANEL]}>
                        <Dashboard />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Admin-only routes */}
                  <Route 
                    path="/upload" 
                    element={
                      <ProtectedRoute requireRoles={[APP_ROLES.ADMIN]}>
                        <UploadAnalyze />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/sessions" 
                    element={
                      <ProtectedRoute requireRoles={[APP_ROLES.ADMIN]}>
                        <Sessions />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/sessions/:sessionId" 
                    element={
                      <ProtectedRoute requireRoles={[APP_ROLES.ADMIN]}>
                        <SessionDetail />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/predictions" 
                    element={
                      <ProtectedRoute requireRoles={[APP_ROLES.ADMIN]}>
                        <Predictions />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/summary" 
                    element={
                      <ProtectedRoute requireRoles={[APP_ROLES.ADMIN, APP_ROLES.CONTROL_PANEL]}>
                        <ControlPanel />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/health" 
                    element={
                      <ProtectedRoute requireRoles={[APP_ROLES.ADMIN]}>
                        <SystemHealth />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* 404 page */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            </Router>
            </ApiAuthInitializer>
          </AuthProvider>
        </ThemeProvider>
        
        {/* React Query DevTools (only in development) */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </MsalProvider>
  );
}

export default App;
