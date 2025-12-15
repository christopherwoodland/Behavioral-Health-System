import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  EventType,
  EventMessage,
  AccountInfo,
  InteractionStatus,
  PopupRequest,
  RedirectRequest
} from '@azure/msal-browser';
import {
  useMsal,
  useAccount,
  useIsAuthenticated,
  AuthenticatedTemplate as MsalAuthenticatedTemplate,
  UnauthenticatedTemplate as MsalUnauthenticatedTemplate
} from '@azure/msal-react';
import { loginRequest, ROLE_CLAIMS, APP_ROLES } from '@/config/authConfig';
import { setAuthenticatedUserId } from '@/utils';

// Define the default role for users without specific roles
const DEFAULT_ROLE = 'User';

// User information interface
export interface UserInfo {
  id: string;
  email: string;
  name: string;
  roles: string[];
  primaryRole: string;
  groups: string[];
  preferredUsername?: string;
  tenantId?: string;
}

// Authentication context interface
interface AuthContextType {
  // User state
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Authentication methods
  login: (request?: PopupRequest | RedirectRequest) => Promise<void>;
  logout: (request?: PopupRequest | RedirectRequest) => Promise<void>;
  clearError: () => void;

  // Authorization helpers
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isAdmin: () => boolean;
  canAccessControlPanel: () => boolean;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Export the context so MockAuthProvider can use the same one
export { AuthContext };

// Hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Extract user roles from account info based on group membership or token claims
 */
const extractUserRoles = (account: AccountInfo): string[] => {
  const claims = account.idTokenClaims as any;
  const roles: string[] = [];

  // Check for roles in token claims (preferred method)
  if (claims?.[ROLE_CLAIMS.APP_ROLES]) {
    const tokenRoles = Array.isArray(claims[ROLE_CLAIMS.APP_ROLES])
      ? claims[ROLE_CLAIMS.APP_ROLES]
      : [claims[ROLE_CLAIMS.APP_ROLES]];
    roles.push(...tokenRoles);
  }

  // Check for group-based roles (fallback)
  if (claims?.[ROLE_CLAIMS.GROUPS]) {
    const groups = Array.isArray(claims[ROLE_CLAIMS.GROUPS])
      ? claims[ROLE_CLAIMS.GROUPS]
      : [claims[ROLE_CLAIMS.GROUPS]];

    // Map group IDs to roles based on configuration
    groups.forEach((groupId: string) => {
      if (groupId === import.meta.env.VITE_AZURE_ADMIN_GROUP_ID) {
        roles.push(APP_ROLES.ADMIN);
      } else if (groupId === import.meta.env.VITE_AZURE_CONTROL_PANEL_GROUP_ID) {
        roles.push(APP_ROLES.CONTROL_PANEL);
      }
    });
  }

  // Remove duplicates and return
  return [...new Set(roles)];
};

/**
 * Get the primary role for a user (highest priority role)
 */
const getPrimaryRole = (roles: string[]): string => {
  // Admin has highest priority
  if (roles.includes(APP_ROLES.ADMIN)) {
    return APP_ROLES.ADMIN;
  }
  if (roles.includes(APP_ROLES.CONTROL_PANEL)) {
    return APP_ROLES.CONTROL_PANEL;
  }
  return DEFAULT_ROLE;
};

/**
 * Create UserInfo from account
 */
const createUserInfo = (account: AccountInfo | null): UserInfo | null => {
  if (!account) {
    return null;
  }

  const roles = extractUserRoles(account);
  const primaryRole = getPrimaryRole(roles);
  const claims = account.idTokenClaims as any;

  return {
    id: account.localAccountId || account.homeAccountId,
    email: account.username,
    name: account.name || account.username,
    roles,
    primaryRole,
    groups: claims?.[ROLE_CLAIMS.GROUPS] || [],
    preferredUsername: claims?.preferred_username,
    tenantId: account.tenantId,
  };
};

// Auth Provider Component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { instance, accounts, inProgress } = useMsal();
  const account = useAccount(accounts[0] || {});
  const isAuthenticated = useIsAuthenticated();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Update user info when account changes
  useEffect(() => {
    const userInfo = createUserInfo(account);
    setUser(userInfo);

    // Update the global user ID for API calls
    if (userInfo) {
      setAuthenticatedUserId(userInfo.id);
    } else {
      setAuthenticatedUserId(null);
    }
  }, [account]);

  // Update loading state based on MSAL interaction status
  useEffect(() => {
    setIsLoading(inProgress !== InteractionStatus.None);
  }, [inProgress]);

  // Handle MSAL events
  useEffect(() => {
    const callbackId = instance.addEventCallback((event: EventMessage) => {
      switch (event.eventType) {
        case EventType.LOGIN_SUCCESS:
          console.log('[Auth] Login successful');
          setError(null);
          break;
        case EventType.LOGIN_FAILURE:
          console.error('[Auth] Login failed:', event.error);
          setError(event.error?.message || 'Login failed');
          break;
        case EventType.LOGOUT_SUCCESS:
          console.log('[Auth] Logout successful');
          setUser(null);
          setError(null);
          break;
        case EventType.ACQUIRE_TOKEN_SUCCESS:
          console.log('[Auth] Token acquired successfully');
          setError(null);
          break;
        case EventType.ACQUIRE_TOKEN_FAILURE:
          console.error('[Auth] Token acquisition failed:', event.error);
          setError(event.error?.message || 'Token acquisition failed');
          break;
      }
    });

    return () => {
      if (callbackId) {
        instance.removeEventCallback(callbackId);
      }
    };
  }, [instance]);

  // Authentication methods
  const login = async (request?: PopupRequest | RedirectRequest): Promise<void> => {
    try {
      setError(null);
      setIsLoading(true);

      const loginRequestWithDefaults = {
        ...loginRequest,
        ...request,
      };

      // Use redirect login (avoids COOP warnings with Azure AD)
      await instance.loginRedirect(loginRequestWithDefaults);
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (request?: PopupRequest | RedirectRequest): Promise<void> => {
    try {
      setError(null);
      setIsLoading(true);

      const logoutRequest = {
        account: account || undefined,
        ...request,
      };

      // Use redirect logout (avoids COOP warnings with Azure AD)
      await instance.logoutRedirect(logoutRequest);
    } catch (error: any) {
      console.error('[Auth] Logout error:', error);
      setError(error.message || 'Logout failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = (): void => {
    setError(null);
  };

  // Authorization helpers
  const hasRole = (role: string): boolean => {
    return user?.roles.includes(role) ?? false;
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return roles.some(role => hasRole(role));
  };

  const isAdmin = (): boolean => {
    return hasRole(APP_ROLES.ADMIN);
  };

  const canAccessControlPanel = (): boolean => {
    return hasAnyRole([APP_ROLES.ADMIN, APP_ROLES.CONTROL_PANEL]);
  };

  // Context value
  const contextValue: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    clearError,
    hasRole,
    hasAnyRole,
    isAdmin,
    canAccessControlPanel,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Conditional authentication templates
const isAuthEnabled = import.meta.env.VITE_ENABLE_ENTRA_AUTH === 'true';

interface AuthTemplateProps {
  children: ReactNode;
}

export const AuthenticatedTemplate: React.FC<AuthTemplateProps> = ({ children }) => {
  if (isAuthEnabled) {
    return <MsalAuthenticatedTemplate>{children}</MsalAuthenticatedTemplate>;
  } else {
    // In mock mode, always show authenticated content
    return <>{children}</>;
  }
};

export const UnauthenticatedTemplate: React.FC<AuthTemplateProps> = ({ children }) => {
  if (isAuthEnabled) {
    return <MsalUnauthenticatedTemplate>{children}</MsalUnauthenticatedTemplate>;
  } else {
    // In mock mode, never show unauthenticated content
    return null;
  }
};
