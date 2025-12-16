import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError, IPublicClientApplication, AccountInfo } from '@azure/msal-browser';
import { apiRequest } from '@/config/authConfig';

/**
 * Authentication provider for API client
 * Provides access tokens and user context for API requests
 */
export class AuthProvider {
  private msalInstance: IPublicClientApplication;
  private accounts: AccountInfo[];

  constructor(msalInstance: IPublicClientApplication, accounts: AccountInfo[]) {
    this.msalInstance = msalInstance;
    this.accounts = accounts;
  }

  /**
   * Get authentication headers for API requests
   * Attempts silent token acquisition first, falls back to interactive if needed
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.accounts || this.accounts.length === 0) {
      return {}; // Return empty headers if not authenticated
    }

    try {
      // Get access token silently using API scopes
      const response = await this.msalInstance.acquireTokenSilent({
        ...apiRequest,
        account: this.accounts[0],
      });

      return {
        'Authorization': `Bearer ${response.accessToken}`,
        'X-User-ID': this.accounts[0].homeAccountId,
        'X-User-Principal': this.accounts[0].username,
      };
    } catch (error) {
      // If silent acquisition fails due to interaction required, try popup
      if (error instanceof InteractionRequiredAuthError) {
        console.warn('Silent token acquisition failed, attempting interactive login...');
        try {
          const response = await this.msalInstance.acquireTokenPopup({
            ...apiRequest,
            account: this.accounts[0],
          });

          return {
            'Authorization': `Bearer ${response.accessToken}`,
            'X-User-ID': this.accounts[0].homeAccountId,
            'X-User-Principal': this.accounts[0].username,
          };
        } catch (popupError) {
          console.error('Interactive token acquisition failed:', popupError);
          return {};
        }
      }

      console.warn('Failed to acquire access token:', error);
      return {};
    }
  }

  /**
   * Get current user information for API context
   */
  getUserContext() {
    if (!this.accounts || this.accounts.length === 0) {
      return null;
    }

    const account = this.accounts[0];
    return {
      userId: account.homeAccountId,
      username: account.username,
      name: account.name,
    };
  }
}

/**
 * Hook to create auth provider from MSAL context
 */
export const useAuthProvider = () => {
  const { instance, accounts } = useMsal();

  return new AuthProvider(instance, accounts);
};
