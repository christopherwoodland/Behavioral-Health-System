import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  EventType,
  EventMessage,
  AccountInfo,
  InteractionStatus,
  InteractionRequiredAuthError,
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
import { loginRequest, apiRequest, ROLE_CLAIMS, APP_ROLES } from '@/config/authConfig';
import { setAuthenticatedUserId } from '@/utils';
import { env } from '@/utils/env';
import { Logger } from '@/utils/logger';

const log = Logger.create('Auth');

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
      if (groupId === env.AZURE_ADMIN_GROUP_ID) {
        roles.push(APP_ROLES.ADMIN);
      } else if (groupId === env.AZURE_CONTROL_PANEL_GROUP_ID) {
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

  // Update user info when account changes; also enrich roles from API access token
  // (roles claim lives on the API app registration's enterprise app, not the frontend SPA's).
  useEffect(() => {
    if (!account) {
      setUser(null);
      setAuthenticatedUserId(null);
      return;
    }

    const userInfo = createUserInfo(account);
    setUser(userInfo);
    if (userInfo) setAuthenticatedUserId(userInfo.id);

    // Silently acquire API access token and merge its `roles` claim so that
    // role assignments made on the API enterprise app are honoured by the UI.
    if (inProgress === InteractionStatus.None) {
      instance.acquireTokenSilent({ ...apiRequest, account })
        .then(result => {
          try {
            const payload = result.accessToken.split('.')[1];
            const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
            const apiRoles: string[] = Array.isArray(decoded?.roles)
              ? decoded.roles
              : decoded?.roles ? [decoded.roles] : [];
            if (apiRoles.length > 0) {
              setUser(prev => {
                if (!prev) return prev;
                const merged = [...new Set([...prev.roles, ...apiRoles])];
                const primaryRole = merged.includes(APP_ROLES.ADMIN)
                  ? APP_ROLES.ADMIN
                  : merged.includes(APP_ROLES.CONTROL_PANEL)
                    ? APP_ROLES.CONTROL_PANEL
                    : prev.primaryRole;
                return { ...prev, roles: merged, primaryRole };
              });
            }
          } catch {
            // Ignore token decode errors — ID token roles already applied
          }
        })
        .catch((err) => {
          // If consent is needed, redirect to login with API scope included so user
          // is prompted once and the token (with roles) is then available silently.
          if (err instanceof InteractionRequiredAuthError && inProgress === InteractionStatus.None) {
            instance.loginRedirect({ ...loginRequest });
          }
          // Other failures (network, config) are ignored — roles default to empty
        });
    }
  }, [account, inProgress, instance]);

  // Update loading state based on MSAL interaction status
  useEffect(() => {
    setIsLoading(inProgress !== InteractionStatus.None);
  }, [inProgress]);

  // Handle MSAL events
  useEffect(() => {
    const callbackId = instance.addEventCallback((event: EventMessage) => {
      switch (event.eventType) {
        case EventType.LOGIN_SUCCESS:
          log.info('Login successful');
          setError(null);
          break;
        case EventType.LOGIN_FAILURE:
          log.error('Login failed', event.error);
          setError(event.error?.message || 'Login failed');
          break;
        case EventType.LOGOUT_SUCCESS:
          log.info('Logout successful');
          setUser(null);
          setError(null);
          break;
        case EventType.ACQUIRE_TOKEN_SUCCESS:
          log.debug('Token acquired successfully');
          setError(null);
          break;
        case EventType.ACQUIRE_TOKEN_FAILURE:
          log.error('Token acquisition failed', event.error);
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
      log.error('Login error', error);
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
      log.error('Logout error', error);
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
const isAuthEnabled = env.ENABLE_ENTRA_AUTH;

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
