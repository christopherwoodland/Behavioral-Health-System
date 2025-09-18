import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { config } from '@/config/constants';
import { createAppError, getUserId } from '@/utils';

export interface UploadProgress {
  progress: number;
  stage: 'preparing' | 'uploading' | 'completed';
  message: string;
}

export interface UploadResult {
  url: string;
  fileName: string;
  size: number;
}

export class AzureBlobService {
  private containerClient: ContainerClient | null = null;
  private sasUrl: string;

  constructor(sasUrl?: string) {
    this.sasUrl = sasUrl || config.azure.blobSasUrl;
    
    if (!this.sasUrl) {
      throw createAppError(
        'AZURE_CONFIG_ERROR',
        'Azure Blob Storage SAS URL not configured'
      );
    }
  }

  private getContainerClient(): ContainerClient {
    if (!this.containerClient) {
      try {
        const blobServiceClient = new BlobServiceClient(this.sasUrl);
        this.containerClient = blobServiceClient.getContainerClient(config.azure.containerName);
      } catch (error) {
        throw createAppError(
          'AZURE_CLIENT_ERROR',
          'Failed to initialize Azure Blob Storage client',
          { originalError: error }
        );
      }
    }
    
    return this.containerClient;
  }

  async uploadFile(
    file: File,
    fileName?: string,
    onProgress?: (progress: UploadProgress) => void,
    userId?: string
  ): Promise<UploadResult> {
    try {
      onProgress?.({
        progress: 0,
        stage: 'preparing',
        message: 'Preparing upload...',
      });

      const containerClient = this.getContainerClient();
      // When userId is provided, create proper folder structure with custom filename or generated filename
      let blobName: string;
      if (userId) {
        const effectiveUserId = userId;
        if (fileName) {
          // Use custom filename (includes metadata user ID) within user folder structure
          blobName = `users/${effectiveUserId}/audio/${fileName}`;
        } else {
          // Generate filename with timestamp and random ID
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const randomId = Math.random().toString(36).substring(2, 8);
          const extension = file.name.split('.').pop() || 'wav';
          blobName = `users/${effectiveUserId}/audio/${timestamp}-${randomId}.${extension}`;
        }
      } else {
        // Fallback to original logic when no userId provided
        blobName = fileName || this.generateBlobName(file.name);
      }
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Upload with progress tracking
      onProgress?.({
        progress: 10,
        stage: 'uploading',
        message: 'Starting upload...',
      });

      await blockBlobClient.uploadData(file, {
        blobHTTPHeaders: {
          blobContentType: file.type,
        },
        onProgress: (uploadProgress) => {
          const progressPercent = uploadProgress.loadedBytes && file.size 
            ? Math.round((uploadProgress.loadedBytes / file.size) * 90) + 10
            : 50;
            
          onProgress?.({
            progress: progressPercent,
            stage: 'uploading',
            message: `Uploading... ${progressPercent}%`,
          });
        },
      });

      // Get the URL for the uploaded blob
      const blobUrl = blockBlobClient.url;

      onProgress?.({
        progress: 100,
        stage: 'completed',
        message: 'Upload completed',
      });

      return {
        url: blobUrl,
        fileName: blobName,
        size: file.size,
      };

    } catch (error) {
      throw createAppError(
        'UPLOAD_ERROR',
        'Failed to upload file to Azure Blob Storage',
        { 
          originalError: error,
          fileName: file.name,
          fileSize: file.size
        }
      );
    }
  }

  private generateBlobName(originalFileName: string, userId?: string): string {
    // Get user ID for data isolation
    const effectiveUserId = userId || getUserId();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = originalFileName.split('.').pop() || 'wav';
    
    // Include user ID in the path for data isolation
    return `users/${effectiveUserId}/audio/${timestamp}-${randomId}.${extension}`;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const containerClient = this.getContainerClient();
      
      // Try to get container properties to test connection
      await containerClient.getProperties();
      
      return {
        success: true,
        message: 'Azure Blob Storage connection successful',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to connect to Azure Blob Storage. Please check your SAS URL configuration.',
      };
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const containerClient = this.getContainerClient();
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      
      await blockBlobClient.deleteIfExists();
    } catch (error) {
      throw createAppError(
        'DELETE_ERROR',
        'Failed to delete file from Azure Blob Storage',
        { originalError: error, fileName }
      );
    }
  }

  /**
   * List all files for a specific user
   */
  async listUserFiles(userId?: string): Promise<string[]> {
    try {
      const effectiveUserId = userId || getUserId();
      const containerClient = this.getContainerClient();
      const userPrefix = `users/${effectiveUserId}/`;
      
      const blobs: string[] = [];
      for await (const blob of containerClient.listBlobsFlat({ prefix: userPrefix })) {
        blobs.push(blob.name);
      }
      
      return blobs;
    } catch (error) {
      throw createAppError(
        'LIST_ERROR',
        'Failed to list user files from Azure Blob Storage',
        { originalError: error, userId }
      );
    }
  }

  /**
   * Delete all files for a specific user (for GDPR compliance)
   */
  async deleteUserData(userId?: string): Promise<number> {
    try {
      const effectiveUserId = userId || getUserId();
      const userFiles = await this.listUserFiles(effectiveUserId);
      
      let deletedCount = 0;
      for (const fileName of userFiles) {
        await this.deleteFile(fileName);
        deletedCount++;
      }
      
      return deletedCount;
    } catch (error) {
      throw createAppError(
        'DELETE_USER_DATA_ERROR',
        'Failed to delete user data from Azure Blob Storage',
        { originalError: error, userId }
      );
    }
  }

  /**
   * Get storage usage for a specific user
   */
  async getUserStorageUsage(userId?: string): Promise<{ fileCount: number; totalSizeBytes: number }> {
    try {
      const effectiveUserId = userId || getUserId();
      const containerClient = this.getContainerClient();
      const userPrefix = `users/${effectiveUserId}/`;
      
      let fileCount = 0;
      let totalSizeBytes = 0;
      
      for await (const blob of containerClient.listBlobsFlat({ prefix: userPrefix })) {
        fileCount++;
        totalSizeBytes += blob.properties.contentLength || 0;
      }
      
      return { fileCount, totalSizeBytes };
    } catch (error) {
      throw createAppError(
        'STORAGE_USAGE_ERROR',
        'Failed to get user storage usage from Azure Blob Storage',
        { originalError: error, userId }
      );
    }
  }
}

// Singleton instance
let blobServiceInstance: AzureBlobService | null = null;

export const getBlobService = (sasUrl?: string): AzureBlobService => {
  if (!blobServiceInstance || (sasUrl && sasUrl !== blobServiceInstance['sasUrl'])) {
    blobServiceInstance = new AzureBlobService(sasUrl);
  }
  return blobServiceInstance;
};

// Check if Azure Blob Storage is properly configured
export const isAzureBlobConfigured = (): boolean => {
  return Boolean(config.azure.blobSasUrl && config.azure.containerName);
};

// Convenience function for the Upload & Analyze page with user isolation
export const uploadToAzureBlob = async (
  file: File | Blob,
  fileName: string,
  onProgress?: (progress: number) => void,
  userId?: string
): Promise<string> => {
  const blobService = getBlobService();
  
  // Convert Blob to File if needed
  const fileToUpload = file instanceof File ? file : new File([file], fileName, { type: file.type });
  
  const result = await blobService.uploadFile(
    fileToUpload,
    fileName,
    onProgress ? (progress) => onProgress(progress.progress) : undefined,
    userId
  );

  return result.url;
};
