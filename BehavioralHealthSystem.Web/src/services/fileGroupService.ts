import { createAppError } from '@/utils';
import { config } from '@/config/constants';
import type { 
  FileGroup, 
  CreateFileGroupRequest, 
  FileGroupResponse, 
  FileGroupListResponse 
} from '@/types';

// Base API client for FileGroup operations
class FileGroupApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      throw createAppError(
        `HTTP_${response.status}`,
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
        }
      );
    }

    return response.json();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      // Handle trailing/leading slashes to avoid double slashes
      const baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const url = `${baseUrl}${cleanEndpoint}`;
      
      const defaultHeaders = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      const response = await fetch(url, {
        ...options,
        headers: defaultHeaders,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw AppError
      }
      
      throw createAppError(
        'UNKNOWN_ERROR',
        'An unexpected error occurred',
        { originalError: error }
      );
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create API client instance
const apiClient = new FileGroupApiClient(config.api.baseUrl);

/**
 * Service for managing file groups
 * Uses backend API with localStorage fallback for offline support
 */
class FileGroupService {
  private readonly STORAGE_KEY = 'behavioral-health-file-groups';
  
  /**
   * Get all file groups for the current user
   */
  async getFileGroups(userId?: string): Promise<FileGroupListResponse> {
    try {
      if (!userId) {
        // Fallback to localStorage if no userId provided
        return this.getFileGroupsFromLocalStorage();
      }

      const response = await apiClient.get<{ success: boolean; count: number; fileGroups: FileGroup[] }>(
        `filegroups/users/${userId}`
      );
      
      return {
        success: response.success,
        fileGroups: response.fileGroups || [],
        count: response.count || 0
      };
    } catch (error) {
      console.error('Error getting file groups from API, falling back to localStorage:', error);
      return this.getFileGroupsFromLocalStorage();
    }
  }
  
  /**
   * Get a specific file group by ID
   */
  async getFileGroup(groupId: string): Promise<FileGroup | null> {
    try {
      const response = await apiClient.get<{ success: boolean; message: string; fileGroup?: FileGroup }>(
        `filegroups/${groupId}`
      );
      
      return response.fileGroup || null;
    } catch (error) {
      console.error('Error getting file group from API, falling back to localStorage:', error);
      // Fallback to localStorage
      const localResponse = await this.getFileGroupsFromLocalStorage();
      return localResponse.fileGroups.find(g => g.groupId === groupId) || null;
    }
  }
  
  /**
   * Create a new file group
   */
  async createFileGroup(request: CreateFileGroupRequest, userId: string): Promise<FileGroupResponse> {
    try {
      const apiRequest = {
        groupName: request.groupName,
        description: request.description,
        createdBy: userId
      };

      const response = await apiClient.post<{ success: boolean; message: string; fileGroup?: FileGroup }>(
        'filegroups',
        apiRequest
      );
      
      if (response.success && response.fileGroup) {
        // Also save to localStorage for offline access
        this.saveToLocalStorage(response.fileGroup);
        
        return {
          success: true,
          message: response.message,
          fileGroup: response.fileGroup
        };
      } else {
        throw new Error(response.message || 'Failed to create file group');
      }
    } catch (error) {
      console.error('Error creating file group via API, falling back to localStorage:', error);
      // Fallback to localStorage
      return this.createFileGroupInLocalStorage(request, userId);
    }
  }
  
  /**
   * Update an existing file group
   */
  async updateFileGroup(groupId: string, updates: Partial<CreateFileGroupRequest>): Promise<FileGroupResponse> {
    try {
      // First get the current group to merge updates
      const currentGroup = await this.getFileGroup(groupId);
      if (!currentGroup) {
        return {
          success: false,
          message: 'File group not found'
        };
      }

      const updatedGroup: FileGroup = {
        ...currentGroup,
        groupName: updates.groupName?.trim() || currentGroup.groupName,
        description: updates.description?.trim() || currentGroup.description,
        updatedAt: new Date().toISOString()
      };

      await apiClient.put<{ success: boolean; message: string }>(
        `filegroups/${groupId}`,
        updatedGroup
      );
      
      // Update localStorage as well
      this.updateInLocalStorage(updatedGroup);
      
      return {
        success: true,
        message: 'File group updated successfully',
        fileGroup: updatedGroup
      };
    } catch (error) {
      console.error('Error updating file group via API, falling back to localStorage:', error);
      // Fallback to localStorage
      return this.updateFileGroupInLocalStorage(groupId, updates);
    }
  }
  
  /**
   * Archive a file group (soft delete)
   */
  async archiveFileGroup(groupId: string): Promise<FileGroupResponse> {
    try {
      const response = await apiClient.delete<{ success: boolean; message: string }>(
        `filegroups/${groupId}`
      );
      
      if (response.success) {
        // Archive in localStorage as well
        this.archiveInLocalStorage(groupId);
        
        return {
          success: true,
          message: response.message
        };
      } else {
        throw new Error(response.message || 'Failed to archive file group');
      }
    } catch (error) {
      console.error('Error archiving file group via API, falling back to localStorage:', error);
      // Fallback to localStorage
      return this.archiveFileGroupInLocalStorage(groupId);
    }
  }
  
  /**
   * Delete a file group and all associated sessions (hard delete)
   */
  async deleteFileGroup(groupId: string): Promise<FileGroupResponse> {
    try {
      const response = await apiClient.delete<{ success: boolean; message: string }>(
        `filegroups/${groupId}/delete`
      );
      
      if (response.success) {
        // Delete from localStorage as well
        this.deleteFromLocalStorage(groupId);
        
        return {
          success: true,
          message: response.message
        };
      } else {
        throw new Error(response.message || 'Failed to delete file group');
      }
    } catch (error) {
      console.error('Error deleting file group via API, falling back to localStorage:', error);
      // Fallback to localStorage
      return this.deleteFileGroupInLocalStorage(groupId);
    }
  }
  
  /**
   * Update session count for a group (called when sessions are added/removed)
   */
  async updateGroupSessionCount(groupId: string, count: number): Promise<void> {
    try {
      // Update locally first for immediate UI feedback
      this.updateSessionCountInLocalStorage(groupId, count);
      
      // TODO: When backend supports session count updates, call API here
      // For now, the backend calculates this dynamically
    } catch (error) {
      console.error('Failed to update group session count:', error);
    }
  }
  
  /**
   * Search file groups by name or description
   */
  async searchFileGroups(query: string, userId?: string): Promise<FileGroup[]> {
    try {
      if (!userId) {
        // Fallback to local search
        const localResponse = await this.getFileGroupsFromLocalStorage();
        return this.filterGroupsByQuery(localResponse.fileGroups, query);
      }

      const response = await apiClient.get<{ success: boolean; count: number; fileGroups: FileGroup[] }>(
        `filegroups/users/${userId}/search?q=${encodeURIComponent(query)}`
      );
      
      return response.fileGroups || [];
    } catch (error) {
      console.error('Error searching file groups via API, falling back to localStorage:', error);
      // Fallback to local search
      const localResponse = await this.getFileGroupsFromLocalStorage();
      return this.filterGroupsByQuery(localResponse.fileGroups, query);
    }
  }
  
  /**
   * Get groups with their session counts (for dashboard/summary views)
   */
  async getGroupsWithStats(userId?: string): Promise<FileGroup[]> {
    const response = await this.getFileGroups(userId);
    return response.fileGroups;
  }

  // Helper method to filter groups by search query
  private filterGroupsByQuery(groups: FileGroup[], query: string): FileGroup[] {
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
      return groups;
    }
    
    return groups.filter(group => 
      group.groupName.toLowerCase().includes(searchTerm) ||
      (group.description && group.description.toLowerCase().includes(searchTerm))
    );
  }

  // Fallback localStorage methods for backward compatibility and offline support
  private getFileGroupsFromLocalStorage(): FileGroupListResponse {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const groups: FileGroup[] = stored ? JSON.parse(stored) : [];
      
      const activeGroups = groups.filter(g => g.status === 'active').sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      return {
        success: true,
        fileGroups: activeGroups,
        count: activeGroups.length
      };
    } catch (error) {
      console.error('Failed to load file groups from localStorage:', error);
      return {
        success: false,
        fileGroups: [],
        count: 0
      };
    }
  }

  private createFileGroupInLocalStorage(request: CreateFileGroupRequest, userId: string): FileGroupResponse {
    try {
      const newGroup: FileGroup = {
        groupId: `group-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        groupName: request.groupName.trim(),
        description: request.description?.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        sessionCount: 0,
        status: 'active'
      };
      
      this.saveToLocalStorage(newGroup);
      
      return {
        success: true,
        message: 'File group created successfully',
        fileGroup: newGroup
      };
    } catch (error) {
      console.error('Failed to create file group in localStorage:', error);
      return {
        success: false,
        message: 'Failed to create file group'
      };
    }
  }

  private updateFileGroupInLocalStorage(groupId: string, updates: Partial<CreateFileGroupRequest>): FileGroupResponse {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const groups: FileGroup[] = stored ? JSON.parse(stored) : [];
      
      const groupIndex = groups.findIndex(g => g.groupId === groupId);
      if (groupIndex === -1) {
        return {
          success: false,
          message: 'File group not found'
        };
      }
      
      if (updates.groupName) {
        groups[groupIndex].groupName = updates.groupName.trim();
      }
      if (updates.description !== undefined) {
        groups[groupIndex].description = updates.description?.trim();
      }
      groups[groupIndex].updatedAt = new Date().toISOString();
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups));
      
      return {
        success: true,
        message: 'File group updated successfully',
        fileGroup: groups[groupIndex]
      };
    } catch (error) {
      console.error('Failed to update file group in localStorage:', error);
      return {
        success: false,
        message: 'Failed to update file group'
      };
    }
  }

  private archiveFileGroupInLocalStorage(groupId: string): FileGroupResponse {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const groups: FileGroup[] = stored ? JSON.parse(stored) : [];
      
      const groupIndex = groups.findIndex(g => g.groupId === groupId);
      if (groupIndex === -1) {
        return {
          success: false,
          message: 'File group not found'
        };
      }
      
      groups[groupIndex].status = 'archived';
      groups[groupIndex].updatedAt = new Date().toISOString();
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups));
      
      return {
        success: true,
        message: 'File group archived successfully',
        fileGroup: groups[groupIndex]
      };
    } catch (error) {
      console.error('Failed to archive file group in localStorage:', error);
      return {
        success: false,
        message: 'Failed to archive file group'
      };
    }
  }

  private saveToLocalStorage(group: FileGroup): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const groups: FileGroup[] = stored ? JSON.parse(stored) : [];
      
      // Check if group already exists and update, otherwise add
      const existingIndex = groups.findIndex(g => g.groupId === group.groupId);
      if (existingIndex >= 0) {
        groups[existingIndex] = group;
      } else {
        groups.push(group);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups));
    } catch (error) {
      console.error('Error saving file group to localStorage:', error);
    }
  }

  private updateInLocalStorage(updatedGroup: FileGroup): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const groups: FileGroup[] = stored ? JSON.parse(stored) : [];
      
      const groupIndex = groups.findIndex(g => g.groupId === updatedGroup.groupId);
      if (groupIndex >= 0) {
        groups[groupIndex] = { ...updatedGroup, updatedAt: new Date().toISOString() };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups));
      }
    } catch (error) {
      console.error('Error updating file group in localStorage:', error);
    }
  }

  private archiveInLocalStorage(groupId: string): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const groups: FileGroup[] = stored ? JSON.parse(stored) : [];
      
      const groupIndex = groups.findIndex(g => g.groupId === groupId);
      if (groupIndex >= 0) {
        groups[groupIndex].status = 'archived';
        groups[groupIndex].updatedAt = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups));
      }
    } catch (error) {
      console.error('Error archiving file group in localStorage:', error);
    }
  }

  private updateSessionCountInLocalStorage(groupId: string, count: number): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const groups: FileGroup[] = stored ? JSON.parse(stored) : [];
      
      const groupIndex = groups.findIndex(g => g.groupId === groupId);
      if (groupIndex >= 0) {
        groups[groupIndex].sessionCount = Math.max(0, count);
        groups[groupIndex].updatedAt = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups));
      }
    } catch (error) {
      console.error('Failed to update group session count in localStorage:', error);
    }
  }

  private deleteFileGroupInLocalStorage(groupId: string): FileGroupResponse {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const groups: FileGroup[] = stored ? JSON.parse(stored) : [];
      
      const groupIndex = groups.findIndex(g => g.groupId === groupId);
      if (groupIndex === -1) {
        return {
          success: false,
          message: 'File group not found'
        };
      }
      
      // Remove the group completely (hard delete)
      groups.splice(groupIndex, 1);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups));
      
      return {
        success: true,
        message: 'File group and associated sessions deleted successfully'
      };
    } catch (error) {
      console.error('Failed to delete file group in localStorage:', error);
      return {
        success: false,
        message: 'Failed to delete file group'
      };
    }
  }

  private deleteFromLocalStorage(groupId: string): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const groups: FileGroup[] = stored ? JSON.parse(stored) : [];
      
      const groupIndex = groups.findIndex(g => g.groupId === groupId);
      if (groupIndex >= 0) {
        groups.splice(groupIndex, 1);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups));
      }
    } catch (error) {
      console.error('Error deleting file group from localStorage:', error);
    }
  }
}

// Export singleton instance
export const fileGroupService = new FileGroupService();
export default fileGroupService;