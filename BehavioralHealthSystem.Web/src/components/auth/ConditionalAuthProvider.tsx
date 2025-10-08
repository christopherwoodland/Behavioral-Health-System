import React, { ReactNode } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { AuthProvider } from '@/contexts/AuthContext';
import { MockAuthProvider } from '@/contexts/MockAuthContext';
import { msalConfig } from '@/config/authConfig';

interface ConditionalAuthProviderProps {
  children: ReactNode;
}

// Create MSAL instance only if authentication is enabled
const isAuthEnabled = import.meta.env.VITE_ENABLE_ENTRA_AUTH === 'true';

// Log authentication mode for debugging
console.log('Authentication mode:', isAuthEnabled ? 'Entra ID enabled' : 'Mock authentication enabled');
console.log('VITE_ENABLE_ENTRA_AUTH:', import.meta.env.VITE_ENABLE_ENTRA_AUTH);

const msalInstance = isAuthEnabled ? new PublicClientApplication(msalConfig) : null;

// Handle redirect promise for redirect flow (required when using loginRedirect/logoutRedirect)
if (msalInstance) {
  msalInstance.handleRedirectPromise().catch((error) => {
    console.error('[MSAL] Redirect error:', error);
  });
}

export const ConditionalAuthProvider: React.FC<ConditionalAuthProviderProps> = ({ children }) => {
  if (isAuthEnabled && msalInstance) {
    // Use real Entra ID authentication with redirect flow
    return (
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </MsalProvider>
    );
  } else {
    // Use mock authentication (no login required)
    return (
      <MockAuthProvider>
        {children}
      </MockAuthProvider>
    );
  }
};