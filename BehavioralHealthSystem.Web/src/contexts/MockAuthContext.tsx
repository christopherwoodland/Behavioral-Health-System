import React, { ReactNode } from 'react';
import { UserInfo, AuthContext } from '@/contexts/AuthContext';
import { Logger } from '@/utils/logger';

const log = Logger.create('MockAuth');

// Mock user for non-authenticated mode
const mockUser: UserInfo = {
  id: 'mock-user-id',
  email: 'anonymous@localhost',
  name: 'Anonymous User',
  roles: ['Admin'], // Give admin role for unrestricted access
  primaryRole: 'Admin',
  groups: [],
  preferredUsername: 'anonymous',
};

interface MockAuthProviderProps {
  children: ReactNode;
}

export const MockAuthProvider: React.FC<MockAuthProviderProps> = ({ children }) => {
  const mockAuthValue = {
    // User state - always "authenticated" with mock user
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,

    // Authentication methods (no-ops)
    login: async () => {
      log.debug('Mock login called - no action taken');
    },
    logout: async () => {
      log.debug('Mock logout called - no action taken');
    },
    clearError: () => {
      log.debug('Mock clearError called - no action taken');
    },

    // Authorization helpers (always return true for unrestricted access)
    hasRole: () => true,
    hasAnyRole: () => true,
    isAdmin: () => true,
    canAccessControlPanel: () => true,
  };

  return (
    <AuthContext.Provider value={mockAuthValue}>
      {children}
    </AuthContext.Provider>
  );
};
