import React, { ReactNode, useState, useEffect } from 'react';
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

// Initialize MSAL and handle redirect promise
if (msalInstance) {
  msalInstance.initialize().then(() => {
    console.log('[MSAL] Instance initialized successfully');
    return msalInstance.handleRedirectPromise();
  }).then(() => {
    console.log('[MSAL] Redirect promise handled');
  }).catch((error) => {
    console.error('[MSAL] Initialization or redirect error:', error);
  });
}

export const ConditionalAuthProvider: React.FC<ConditionalAuthProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(!isAuthEnabled);

  useEffect(() => {
    if (msalInstance) {
      msalInstance.initialize()
        .then(() => {
          console.log('[MSAL] Provider ready');
          setIsInitialized(true);
        })
        .catch((error) => {
          console.error('[MSAL] Failed to initialize:', error);
          setIsInitialized(true); // Still render to show error
        });
    }
  }, []);

  if (!isInitialized) {
    return <div>Loading authentication...</div>;
  }
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