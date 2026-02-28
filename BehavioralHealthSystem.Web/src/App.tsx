import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ConditionalAuthProvider } from '@/components/auth/ConditionalAuthProvider';
import { ProtectedRoute } from '@/components/auth/AuthGuards';
import { RoleBasedRedirect } from '@/components/auth/RoleBasedRedirect';
import { ApiAuthInitializer } from '@/components/auth/ApiAuthInitializer';
import { Layout } from '@/components/layout/Layout';
import { APP_ROLES } from '@/config/authConfig';

// Page components
import { Dashboard } from '@/pages/Dashboard';
import { UploadAnalyze, Sessions, SessionDetail, Predictions, ControlPanel, AgentExperience, SystemHealth, NotFound } from '@/pages';
import GroupSessionsDetail from '@/pages/GroupSessionsDetail';
import DamTestBench from '@/pages/DamTestBench';

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
        <ConditionalAuthProvider>
          <ApiAuthInitializer>
            <Router>
              <Layout>
                <Routes>
                    {/* Control Panel route - accessible to both Admin and Control Panel roles */}
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute requireRoles={[APP_ROLES.ADMIN, APP_ROLES.CONTROL_PANEL]}>
                          <RoleBasedRedirect />
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
                      path="/groups/:groupId/sessions"
                      element={
                        <ProtectedRoute requireRoles={[APP_ROLES.ADMIN]}>
                          <GroupSessionsDetail />
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
                      path="/agent-experience"
                      element={
                        <ProtectedRoute requireRoles={[APP_ROLES.ADMIN, APP_ROLES.CONTROL_PANEL]}>
                          <AgentExperience />
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

                    {/* DAM test bench — URL-only, not in nav */}
                    <Route path="/dam-test" element={<DamTestBench />} />

                    {/* 404 page */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </Router>
            </ApiAuthInitializer>
          </ConditionalAuthProvider>
        </ThemeProvider>

        {/* React Query DevTools (only in development) */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
  );
}

export default App;
