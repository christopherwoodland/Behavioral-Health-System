import { fileGroupService } from '../fileGroupService';
import { apiService } from '../api';
import type { FileGroup, CreateFileGroupRequest, FileGroupResponse, FileGroupListResponse } from '../../types';

// Mock the API service
jest.mock('../api');

const mockApiService = apiService as jest.Mocked<typeof apiService>;

describe('FileGroupService', () => {
  const mockUserId = 'test-user-id';
  
  const mockFileGroups: FileGroup[] = [
    {
      groupId: 'group-1',
      groupName: 'Test Group 1',
      description: 'First test group',
      createdBy: mockUserId,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      sessionCount: 5,
      status: 'active'
    },
    {
      groupId: 'group-2',
      groupName: 'Test Group 2',
      description: 'Second test group',
      createdBy: mockUserId,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      sessionCount: 3,
      status: 'active'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserGroups', () => {
    it('fetches user groups successfully', async () => {
      const mockResponse: FileGroupListResponse = {
        success: true,
        fileGroups: mockFileGroups,
        count: mockFileGroups.length
      };

      mockApiService.get.mockResolvedValue(mockResponse);

      const result = await fileGroupService.getUserGroups(mockUserId);

      expect(mockApiService.get).toHaveBeenCalledWith(`/api/file-groups/user/${mockUserId}`);
      expect(result).toEqual(mockFileGroups);
    });

    it('returns empty array when API call fails', async () => {
      mockApiService.get.mockRejectedValue(new Error('API Error'));

      const result = await fileGroupService.getUserGroups(mockUserId);

      expect(result).toEqual([]);
    });

    it('returns empty array when response is not successful', async () => {
      const mockResponse: FileGroupListResponse = {
        success: false,
        fileGroups: [],
        count: 0
      };

      mockApiService.get.mockResolvedValue(mockResponse);

      const result = await fileGroupService.getUserGroups(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('createGroup', () => {
    const groupName = 'New Test Group';
    const description = 'New group description';

    it('creates a group successfully', async () => {
      const newGroup: FileGroup = {
        groupId: 'new-group-id',
        groupName,
        description,
        createdBy: mockUserId,
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
        sessionCount: 0,
        status: 'active'
      };

      const mockResponse: FileGroupResponse = {
        success: true,
        message: 'Group created successfully',
        fileGroup: newGroup
      };

      mockApiService.post.mockResolvedValue(mockResponse);

      const result = await fileGroupService.createGroup(mockUserId, groupName, description);

      const expectedRequest: CreateFileGroupRequest = {
        groupName,
        description,
        createdBy: mockUserId
      };

      expect(mockApiService.post).toHaveBeenCalledWith('/api/file-groups', expectedRequest);
      expect(result).toBe('new-group-id');
    });

    it('throws error when group creation fails', async () => {
      const mockResponse: FileGroupResponse = {
        success: false,
        message: 'Group name already exists'
      };

      mockApiService.post.mockResolvedValue(mockResponse);

      await expect(fileGroupService.createGroup(mockUserId, groupName, description))
        .rejects.toThrow('Group name already exists');
    });

    it('throws error when API call fails', async () => {
      mockApiService.post.mockRejectedValue(new Error('Network error'));

      await expect(fileGroupService.createGroup(mockUserId, groupName, description))
        .rejects.toThrow('Network error');
    });

    it('creates group without description', async () => {
      const newGroup: FileGroup = {
        groupId: 'new-group-id',
        groupName,
        createdBy: mockUserId,
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
        sessionCount: 0,
        status: 'active'
      };

      const mockResponse: FileGroupResponse = {
        success: true,
        message: 'Group created successfully',
        fileGroup: newGroup
      };

      mockApiService.post.mockResolvedValue(mockResponse);

      const result = await fileGroupService.createGroup(mockUserId, groupName);

      const expectedRequest: CreateFileGroupRequest = {
        groupName,
        createdBy: mockUserId
      };

      expect(mockApiService.post).toHaveBeenCalledWith('/api/file-groups', expectedRequest);
      expect(result).toBe('new-group-id');
    });
  });

  describe('deleteGroup', () => {
    const groupId = 'group-to-delete';

    it('deletes a group successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Group deleted successfully'
      };

      mockApiService.delete.mockResolvedValue(mockResponse);

      await expect(fileGroupService.deleteGroup(groupId)).resolves.not.toThrow();

      expect(mockApiService.delete).toHaveBeenCalledWith(`/api/file-groups/${groupId}`);
    });

    it('throws error when deletion fails', async () => {
      const mockResponse = {
        success: false,
        message: 'Group not found'
      };

      mockApiService.delete.mockResolvedValue(mockResponse);

      await expect(fileGroupService.deleteGroup(groupId))
        .rejects.toThrow('Group not found');
    });

    it('throws error when API call fails', async () => {
      mockApiService.delete.mockRejectedValue(new Error('Network error'));

      await expect(fileGroupService.deleteGroup(groupId))
        .rejects.toThrow('Network error');
    });
  });

  describe('validateGroupName', () => {
    const groupName = 'Test Group Name';

    it('validates group name successfully when name is available', async () => {
      const mockResponse = {
        isValid: true,
        message: 'Group name is available'
      };

      mockApiService.post.mockResolvedValue(mockResponse);

      const result = await fileGroupService.validateGroupName(mockUserId, groupName);

      expect(mockApiService.post).toHaveBeenCalledWith('/api/file-groups/validate-name', {
        groupName,
        userId: mockUserId
      });
      expect(result).toEqual({
        isValid: true,
        message: 'Group name is available'
      });
    });

    it('validates group name and finds it unavailable', async () => {
      const mockResponse = {
        isValid: false,
        message: 'Group name already exists'
      };

      mockApiService.post.mockResolvedValue(mockResponse);

      const result = await fileGroupService.validateGroupName(mockUserId, groupName);

      expect(result).toEqual({
        isValid: false,
        message: 'Group name already exists'
      });
    });

    it('returns invalid when validation API call fails', async () => {
      mockApiService.post.mockRejectedValue(new Error('Validation service unavailable'));

      const result = await fileGroupService.validateGroupName(mockUserId, groupName);

      expect(result).toEqual({
        isValid: false,
        message: 'Unable to validate group name. Please try again.'
      });
    });

    it('validates empty group name as invalid', async () => {
      const result = await fileGroupService.validateGroupName(mockUserId, '');

      expect(result).toEqual({
        isValid: false,
        message: 'Group name cannot be empty'
      });
      
      // Should not make API call for empty name
      expect(mockApiService.post).not.toHaveBeenCalled();
    });

    it('validates whitespace-only group name as invalid', async () => {
      const result = await fileGroupService.validateGroupName(mockUserId, '   ');

      expect(result).toEqual({
        isValid: false,
        message: 'Group name cannot be empty'
      });
      
      // Should not make API call for whitespace-only name
      expect(mockApiService.post).not.toHaveBeenCalled();
    });

    it('validates extremely long group name as invalid', async () => {
      const longName = 'A'.repeat(256); // Assuming 255 character limit
      
      const result = await fileGroupService.validateGroupName(mockUserId, longName);

      expect(result).toEqual({
        isValid: false,
        message: 'Group name is too long (maximum 255 characters)'
      });
      
      // Should not make API call for overly long name
      expect(mockApiService.post).not.toHaveBeenCalled();
    });

    it('validates group name with special characters', async () => {
      const specialCharName = 'Test<script>alert("xss")</script>';
      
      const result = await fileGroupService.validateGroupName(mockUserId, specialCharName);

      expect(result).toEqual({
        isValid: false,
        message: 'Group name contains invalid characters'
      });
      
      // Should not make API call for names with special characters
      expect(mockApiService.post).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles malformed API responses gracefully', async () => {
      // Test with malformed response for getUserGroups
      mockApiService.get.mockResolvedValue({ unexpected: 'structure' });

      const result = await fileGroupService.getUserGroups(mockUserId);
      expect(result).toEqual([]);
    });

    it('handles null and undefined user IDs', async () => {
      const result1 = await fileGroupService.getUserGroups('');
      const result2 = await fileGroupService.getUserGroups(null as any);
      const result3 = await fileGroupService.getUserGroups(undefined as any);

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(result3).toEqual([]);
      
      // Should not make API calls for invalid user IDs
      expect(mockApiService.get).not.toHaveBeenCalled();
    });

    it('handles concurrent operations correctly', async () => {
      const mockResponse: FileGroupListResponse = {
        success: true,
        fileGroups: mockFileGroups,
        count: mockFileGroups.length
      };

      mockApiService.get.mockResolvedValue(mockResponse);

      // Simulate concurrent calls
      const promises = [
        fileGroupService.getUserGroups(mockUserId),
        fileGroupService.getUserGroups(mockUserId),
        fileGroupService.getUserGroups(mockUserId)
      ];

      const results = await Promise.all(promises);

      // All should return the same result
      results.forEach(result => {
        expect(result).toEqual(mockFileGroups);
      });

      // Should have made 3 separate API calls
      expect(mockApiService.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('Input sanitization', () => {
    it('trims whitespace from group names during validation', async () => {
      const nameWithSpaces = '  Test Group  ';
      const mockResponse = {
        isValid: true,
        message: 'Group name is available'
      };

      mockApiService.post.mockResolvedValue(mockResponse);

      await fileGroupService.validateGroupName(mockUserId, nameWithSpaces);

      expect(mockApiService.post).toHaveBeenCalledWith('/api/file-groups/validate-name', {
        groupName: 'Test Group', // Should be trimmed
        userId: mockUserId
      });
    });

    it('handles Unicode characters in group names', async () => {
      const unicodeName = 'Test Group 测试组 🏥';
      const mockResponse = {
        isValid: true,
        message: 'Group name is available'
      };

      mockApiService.post.mockResolvedValue(mockResponse);

      const result = await fileGroupService.validateGroupName(mockUserId, unicodeName);

      expect(result.isValid).toBe(true);
      expect(mockApiService.post).toHaveBeenCalledWith('/api/file-groups/validate-name', {
        groupName: unicodeName,
        userId: mockUserId
      });
    });
  });
});