/**
 * DSM-5 Data Service
 * Handles API calls for DSM-5 condition data, extraction, and administration
 */

import { config } from '@/config/constants';
import { createAppError } from '@/utils';
import type {
  DSM5ConditionData,
  DSM5DataStatus,
  DSM5ExtractionRequest,
  DSM5ExtractionResult,
  DSM5DataUploadRequest,
  DSM5UploadResult,
  DSM5ConditionsApiResponse,
  DSM5ConditionDetailsApiResponse,
  DSM5DataStatusApiResponse,
} from '@/types/dsm5Types';

class DSM5Service {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.api.baseUrl;
  }

  /**
   * Get DSM-5 data initialization status
   */
  async getDataStatus(): Promise<DSM5DataStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/dsm5-admin/data-status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: DSM5DataStatusApiResponse = await response.json();

      if (!data.success || !data.dataStatus) {
        throw new Error(data.message || data.error || 'Failed to fetch DSM-5 data status');
      }

      return {
        isInitialized: data.dataStatus.isInitialized,
        totalConditions: data.dataStatus.totalConditions,
        availableConditions: data.dataStatus.availableConditions,
        categories: data.dataStatus.categories,
        lastUpdated: data.dataStatus.lastUpdated,
        dataVersion: data.dataStatus.dataVersion,
        containerExists: data.dataStatus.storageInfo.containerExists,
        totalBlobSizeBytes: data.dataStatus.storageInfo.totalBlobSize,
        blobCount: data.dataStatus.storageInfo.blobCount,
      };
    } catch (error) {
      console.error('Error fetching DSM-5 data status:', error);
      throw createAppError(
        'DSM5_STATUS_ERROR',
        error instanceof Error ? error.message : 'Failed to fetch DSM-5 data status',
        { originalError: error }
      );
    }
  }

  /**
   * Get available DSM-5 conditions with optional filtering
   */
  async getAvailableConditions(options?: {
    category?: string;
    searchTerm?: string;
    includeDetails?: boolean;
  }): Promise<DSM5ConditionData[]> {
    try {
      const params = new URLSearchParams();
      if (options?.category) params.append('category', options.category);
      if (options?.searchTerm) params.append('searchTerm', options.searchTerm);
      if (options?.includeDetails !== undefined) {
        params.append('includeDetails', options.includeDetails.toString());
      }

      const url = `${this.baseUrl}/dsm5-admin/conditions${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: DSM5ConditionsApiResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch DSM-5 conditions');
      }

      return data.conditions;
    } catch (error) {
      console.error('Error fetching DSM-5 conditions:', error);
      throw createAppError(
        'DSM5_CONDITIONS_ERROR',
        error instanceof Error ? error.message : 'Failed to fetch DSM-5 conditions',
        { originalError: error }
      );
    }
  }

  /**
   * Get detailed information for a specific DSM-5 condition
   */
  async getConditionDetails(conditionId: string): Promise<DSM5ConditionData> {
    try {
      const response = await fetch(`${this.baseUrl}/dsm5-admin/conditions/${encodeURIComponent(conditionId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: DSM5ConditionDetailsApiResponse = await response.json();

      if (!data.success || !data.condition) {
        throw new Error(data.message || 'Failed to fetch condition details');
      }

      return data.condition;
    } catch (error) {
      console.error('Error fetching condition details:', error);
      throw createAppError(
        'DSM5_CONDITION_DETAILS_ERROR',
        error instanceof Error ? error.message : 'Failed to fetch condition details',
        { originalError: error }
      );
    }
  }

  /**
   * Validate and extract DSM-5 data from PDF
   */
  async validateExtraction(request: DSM5ExtractionRequest): Promise<DSM5ExtractionResult> {
    try {
      const response = await fetch(`${this.baseUrl}/dsm5-admin/validate-extraction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || data.error || 'Extraction validation failed');
      }

      return data.extractionResult;
    } catch (error) {
      console.error('Error validating extraction:', error);
      throw createAppError(
        'DSM5_EXTRACTION_ERROR',
        error instanceof Error ? error.message : 'Failed to validate extraction',
        { originalError: error }
      );
    }
  }

  /**
   * Upload DSM-5 condition data to storage
   */
  async uploadData(request: DSM5DataUploadRequest): Promise<DSM5UploadResult> {
    try {
      const response = await fetch(`${this.baseUrl}/dsm5-admin/upload-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || data.error || 'Data upload failed');
      }

      return data.uploadResult;
    } catch (error) {
      console.error('Error uploading DSM-5 data:', error);
      throw createAppError(
        'DSM5_UPLOAD_ERROR',
        error instanceof Error ? error.message : 'Failed to upload DSM-5 data',
        { originalError: error }
      );
    }
  }

  /**
   * Get all categories from available conditions
   */
  async getCategories(): Promise<string[]> {
    const status = await this.getDataStatus();
    return status.categories;
  }

  /**
   * Search conditions by name or code
   */
  async searchConditions(searchTerm: string): Promise<DSM5ConditionData[]> {
    return this.getAvailableConditions({ searchTerm, includeDetails: false });
  }

  /**
   * Get conditions by category
   */
  async getConditionsByCategory(category: string): Promise<DSM5ConditionData[]> {
    return this.getAvailableConditions({ category, includeDetails: false });
  }
}

// Export singleton instance
export const dsm5Service = new DSM5Service();
export default dsm5Service;
