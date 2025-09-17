import { useEffect } from 'react';
import { useAuthProvider } from '@/services/authProvider';
import { setApiAuthProvider } from '@/services/api';

/**
 * Component that initializes the API authentication provider
 * Must be used within MsalProvider context
 */
export const ApiAuthInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authProvider = useAuthProvider();

  useEffect(() => {
    // Set the auth provider for the API client
    setApiAuthProvider(authProvider);
  }, [authProvider]);

  return <>{children}</>;
};