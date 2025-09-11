import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { config } from '@/config/constants';
import { createAppError } from '@/utils';

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
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      onProgress?.({
        progress: 0,
        stage: 'preparing',
        message: 'Preparing upload...',
      });

      const containerClient = this.getContainerClient();
      const blobName = fileName || this.generateBlobName(file.name);
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

  private generateBlobName(originalFileName: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = originalFileName.split('.').pop() || 'wav';
    
    return `audio/${timestamp}-${randomId}.${extension}`;
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

// Convenience function for the Upload & Analyze page
export const uploadToAzureBlob = async (
  file: File | Blob,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const blobService = getBlobService();
  
  // Convert Blob to File if needed
  const fileToUpload = file instanceof File ? file : new File([file], fileName, { type: file.type });
  
  const result = await blobService.uploadFile(
    fileToUpload,
    fileName,
    onProgress ? (progress) => onProgress(progress.progress) : undefined
  );

  return result.url;
};
