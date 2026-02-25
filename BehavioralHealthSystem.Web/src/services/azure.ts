import { config } from '@/config/constants';
import { createAppError, getUserId } from '@/utils';
import { getApiAuthHeaders } from './api';

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

/**
 * Upload audio file via backend API (uses managed identity)
 * This replaces direct Azure Blob Storage uploads with SAS URLs
 * Includes Entra ID authentication headers when available
 */
export const uploadToAzureBlob = async (
  file: File | Blob,
  fileName: string,
  onProgress?: (progress: number) => void,
  userId?: string
): Promise<string> => {
  const effectiveUserId = userId || getUserId();

  // Generate session ID if not embedded in fileName
  const sessionId = extractSessionId(fileName) || `session-${Date.now()}`;

  onProgress?.(10);

  // Convert Blob to File if needed
  const fileToUpload = file instanceof File
    ? file
    : new File([file], fileName, { type: file.type || 'audio/wav' });

  // Validate file has content
  if (fileToUpload.size === 0) {
    console.error('🔴 uploadToAzureBlob: File is empty!', {
      originalType: file instanceof File ? 'File' : 'Blob',
      originalSize: file.size,
      fileName,
      fileType: fileToUpload.type
    });
    throw createAppError(
      'UPLOAD_ERROR',
      'Cannot upload empty file. Audio conversion may have failed.',
      { fileName, fileSize: 0 }
    );
  }

  console.log('🟢 uploadToAzureBlob: Uploading file', {
    fileName,
    fileSize: fileToUpload.size,
    fileType: fileToUpload.type,
    userId: effectiveUserId,
    sessionId
  });

  onProgress?.(20);

  // Build upload URL with query parameters
  const uploadUrl = new URL(`${config.api.baseUrl}/upload-audio`);
  uploadUrl.searchParams.set('userId', effectiveUserId);
  uploadUrl.searchParams.set('sessionId', sessionId);
  uploadUrl.searchParams.set('fileName', fileName);

  onProgress?.(30);

  try {
    // Get authentication headers (Entra ID token if authenticated)
    const authHeaders = await getApiAuthHeaders();

    const response = await fetch(uploadUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': fileToUpload.type || 'audio/wav',
        ...authHeaders,
      },
      body: fileToUpload,
    });

    onProgress?.(80);

    if (!response.ok) {
      const errorText = await response.text();
      throw createAppError(
        'UPLOAD_ERROR',
        `Failed to upload audio: ${response.statusText}`,
        { status: response.status, details: errorText }
      );
    }

    const result = await response.json();

    console.log('🟢 uploadToAzureBlob: Upload completed', {
      blobPath: result.blobPath,
      blobUrl: result.blobUrl || result.url,
      fileName: result.fileName,
      userId: effectiveUserId,
      sessionId
    });

    onProgress?.(100);

    return result.url || result.blobUrl;
  } catch (error) {
    if ((error as Record<string, unknown>)?.code === 'UPLOAD_ERROR') {
      throw error;
    }
    throw createAppError(
      'UPLOAD_ERROR',
      'Failed to upload audio file',
      { originalError: error }
    );
  }
};

/**
 * Extract session ID from filename if present
 * Format: userId_sessionId_timestamp.wav
 */
const extractSessionId = (fileName: string): string | null => {
  const parts = fileName.split('_');
  if (parts.length >= 2) {
    return parts[1]; // Return sessionId portion
  }
  return null;
};

// Check if backend API is configured for uploads
export const isAzureBlobConfigured = (): boolean => {
  return Boolean(config.api.baseUrl);
};
