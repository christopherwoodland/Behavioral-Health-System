/**
 * Biometric Data Service
 * Handles progressive saving of user biometric data during Matron agent interaction
 * Similar to chat transcript service pattern
 */

import { env } from '@/utils/env';

export interface BiometricData {
  userId: string;
  nickname?: string;
  weightKg?: number;
  heightCm?: number;
  gender?: string;
  pronoun?: string;
  lastResidence?: string;
  hobbies?: string[];
  likes?: string[];
  dislikes?: string[];
  additionalInfo?: string;
  timestamp: string;
  source: string;
  lastUpdated?: string;
}

class BiometricDataService {
  private currentData: BiometricData | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private readonly saveDelayMs = env.BIOMETRIC_SAVE_DELAY_MS;
  private readonly apiBaseUrl = env.API_BASE_URL;

  /**
   * Initialize a new biometric data collection session
   */
  initializeSession(userId: string): void {
    console.log('➕ Initializing biometric data session for user:', userId);

    this.currentData = {
      userId,
      timestamp: new Date().toISOString(),
      source: 'matron-agent-realtime-api'
    };
  }

  /**
   * Update a specific field in the biometric data
   * Triggers auto-save after delay
   */
  updateField(field: keyof BiometricData, value: any): void {
    if (!this.currentData) {
      console.warn('⚠️ No active biometric session. Call initializeSession first.');
      return;
    }

    console.log(`➕ Updating biometric field: ${field} =`, value);

    // Update the field
    (this.currentData as any)[field] = value;
    this.currentData.lastUpdated = new Date().toISOString();

    // Schedule auto-save
    this.scheduleSave();
  }

  /**
   * Update multiple fields at once
   */
  updateFields(updates: Partial<BiometricData>): void {
    if (!this.currentData) {
      console.warn('⚠️ No active biometric session. Call initializeSession first.');
      return;
    }

    console.log('➕ Updating multiple biometric fields:', Object.keys(updates));

    Object.assign(this.currentData, updates);
    this.currentData.lastUpdated = new Date().toISOString();

    // Schedule auto-save
    this.scheduleSave();
  }

  /**
   * Add an item to an array field (hobbies, likes, dislikes)
   */
  addToArrayField(field: 'hobbies' | 'likes' | 'dislikes', value: string): void {
    if (!this.currentData) {
      console.warn('⚠️ No active biometric session. Call initializeSession first.');
      return;
    }

    if (!this.currentData[field]) {
      this.currentData[field] = [];
    }

    this.currentData[field]!.push(value);
    this.currentData.lastUpdated = new Date().toISOString();

    console.log(`➕ Added "${value}" to ${field}. Current list:`, this.currentData[field]);

    // Schedule auto-save
    this.scheduleSave();
  }

  /**
   * Get current biometric data
   */
  getCurrentData(): BiometricData | null {
    return this.currentData ? { ...this.currentData } : null;
  }

  /**
   * Check if minimum required data is present (nickname)
   */
  hasMinimumData(): boolean {
    return this.currentData !== null && !!this.currentData.nickname;
  }

  /**
   * Schedule an auto-save after delay
   */
  private scheduleSave(): void {
    // Clear existing timer
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    // Schedule new save
    this.saveTimer = setTimeout(() => {
      this.saveDataImmediate();
    }, this.saveDelayMs);
  }

  /**
   * Save data immediately (called by timer or manually)
   */
  private async saveDataImmediate(): Promise<void> {
    if (!this.currentData) {
      console.warn('⚠️ No biometric data to save');
      return;
    }

    if (!this.hasMinimumData()) {
      console.warn('⚠️ Cannot save biometric data without nickname');
      return;
    }

    try {
      console.log('➕ Saving biometric data...', this.currentData);

      const response = await fetch(`${this.apiBaseUrl}/biometric`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.currentData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`Failed to save: ${errorData.error || response.statusText}`);
      }

      const savedData = await response.json();
      console.log('✅ Biometric data saved successfully:', savedData);

    } catch (error) {
      console.error('❌ Error saving biometric data:', error);
      // Don't throw - this is a background save
    }
  }

  /**
   * Force immediate save (useful before agent switch)
   */
  public async forceSave(): Promise<{ success: boolean; error?: string }> {
    if (!this.currentData) {
      return { success: false, error: 'No biometric data to save' };
    }

    if (!this.hasMinimumData()) {
      return { success: false, error: 'Cannot save without nickname' };
    }

    try {
      // Cancel scheduled save
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }

      await this.saveDataImmediate();
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Force save failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Clear current session data
   */
  clearSession(): void {
    console.log('➕ Clearing biometric data session');

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    this.currentData = null;
  }

  /**
   * Load existing biometric data for a user
   */
  async loadExistingData(userId: string): Promise<BiometricData | null> {
    try {
      console.log('➕ Loading existing biometric data for user:', userId);

      const response = await fetch(`${this.apiBaseUrl}/biometric/${userId}`);

      if (response.status === 404) {
        console.log('➕ No existing biometric data found');
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Loaded existing biometric data:', data);

      return data;

    } catch (error) {
      console.error('❌ Error loading biometric data:', error);
      return null;
    }
  }
}

// Export singleton instance
export const biometricDataService = new BiometricDataService();
