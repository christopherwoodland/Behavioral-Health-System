import React, { ReactNode, useState, useEffect } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { AuthProvider } from '@/contexts/AuthContext';
import { MockAuthProvider } from '@/contexts/MockAuthContext';
import { msalConfig } from '@/config/authConfig';
import { env } from '@/utils/env';
import { Logger } from '@/utils/logger';

const log = Logger.create('ConditionalAuth');

interface ConditionalAuthProviderProps {
  children: ReactNode;
}

// Create MSAL instance only if authentication is enabled
const isAuthEnabled = env.ENABLE_ENTRA_AUTH;

// Log authentication mode for debugging
log.info('Authentication mode', { mode: isAuthEnabled ? 'Entra ID enabled' : 'Mock authentication enabled' });
log.debug('VITE_ENABLE_ENTRA_AUTH', { value: env.ENABLE_ENTRA_AUTH });

const msalInstance = isAuthEnabled ? new PublicClientApplication(msalConfig) : null;

// Initialize MSAL and handle redirect promise
if (msalInstance) {
  msalInstance.initialize().then(() => {
    log.info('MSAL instance initialized successfully');
    return msalInstance.handleRedirectPromise();
  }).then(() => {
    log.debug('MSAL redirect promise handled');
  }).catch((error) => {
    log.error('MSAL initialization or redirect error', error);
  });
}

export const ConditionalAuthProvider: React.FC<ConditionalAuthProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(!isAuthEnabled);

  useEffect(() => {
    if (msalInstance) {
      msalInstance.initialize()
        .then(() => {
          log.info('MSAL provider ready');
          setIsInitialized(true);
        })
        .catch((error) => {
          log.error('MSAL failed to initialize', error);
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
