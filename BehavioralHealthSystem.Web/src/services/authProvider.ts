import { useMsal } from '@azure/msal-react';
import { silentRequest } from '@/config/authConfig';

/**
 * Authentication provider for API client
 * Provides access tokens and user context for API requests
 */
export class AuthProvider {
  private msalInstance: any;
  private accounts: any;

  constructor(msalInstance: any, accounts: any) {
    this.msalInstance = msalInstance;
    this.accounts = accounts;
  }

  /**
   * Get authentication headers for API requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.accounts || this.accounts.length === 0) {
      return {}; // Return empty headers if not authenticated
    }

    try {
      // Get access token silently
      const response = await this.msalInstance.acquireTokenSilent({
        ...silentRequest,
        account: this.accounts[0],
      });

      return {
        'Authorization': `Bearer ${response.accessToken}`,
        'X-User-ID': this.accounts[0].homeAccountId,
        'X-User-Principal': this.accounts[0].username,
      };
    } catch (error) {
      console.warn('Failed to acquire access token silently:', error);
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