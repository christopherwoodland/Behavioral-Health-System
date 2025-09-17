import { Configuration, PopupRequest, RedirectRequest } from '@azure/msal-browser';

/**
 * Azure AD B2C / Entra ID Configuration
 * 
 * Configure these values with your Azure AD tenant information:
 * - clientId: Application (client) ID from Azure AD app registration
 * - authority: Azure AD tenant authority URL
 * - redirectUri: Redirect URI configured in Azure AD app registration
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'your-client-id-here', 
    authority: import.meta.env.VITE_AZURE_AUTHORITY || `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: import.meta.env.VITE_AZURE_POST_LOGOUT_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage', // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case 0: // LogLevel.Error
            console.error('[MSAL Error]:', message);
            break;
          case 1: // LogLevel.Warning
            console.warn('[MSAL Warning]:', message);
            break;
          case 2: // LogLevel.Info
            console.info('[MSAL Info]:', message);
            break;
          case 3: // LogLevel.Verbose
            console.debug('[MSAL Verbose]:', message);
            break;
        }
      },
    },
  },
};

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 */
export const loginRequest: RedirectRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    'User.Read', // Microsoft Graph API scope for reading user profile
  ],
};

/**
 * An optional silentRequest object can be used to achieve silent SSO
 * between applications by providing a "login_hint" property.
 */
export const silentRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
  loginHint: 'example@domain.com', // Used for silent SSO
};

/**
 * Application roles for RBAC
 * These should match the app roles defined in your Azure AD app registration
 */
export const APP_ROLES = {
  ADMIN: 'Admin',
  CONTROL_PANEL: 'ControlPanel',
} as const;

/**
 * Claims that contain role information
 * Roles can be provided via app roles or group membership
 */
export const ROLE_CLAIMS = {
  APP_ROLES: 'roles', // App roles claim
  GROUPS: 'groups', // Group membership claim
} as const;

/**
 * Group IDs for role mapping (if using groups instead of app roles)
 * Configure these with your Azure AD group object IDs
 */
export const ROLE_GROUPS = {
  ADMIN_GROUP_ID: import.meta.env.VITE_AZURE_ADMIN_GROUP_ID || 'admin-group-id-here',
  CONTROL_PANEL_GROUP_ID: import.meta.env.VITE_AZURE_CONTROL_PANEL_GROUP_ID || 'control-panel-group-id-here',
} as const;

/**
 * Default user role when no specific role is assigned
 */
export const DEFAULT_ROLE = APP_ROLES.CONTROL_PANEL;

export type UserRole = typeof APP_ROLES[keyof typeof APP_ROLES];