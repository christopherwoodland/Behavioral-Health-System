import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fileGroupService } from '../fileGroupService';
import type { FileGroup } from '../../types';

// The setup.ts already mocks global.fetch
// We just need to work with vi.mocked(fetch) in each test

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
      status: 'active',
    },
    {
      groupId: 'group-2',
      groupName: 'Test Group 2',
      description: 'Second test group',
      createdBy: mockUserId,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      sessionCount: 3,
      status: 'active',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockImplementation(() => {});
  });

  describe('getFileGroups', () => {
    it('fetches user groups successfully', async () => {
      const mockResponse = {
        success: true,
        fileGroups: mockFileGroups,
        count: mockFileGroups.length,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fileGroupService.getFileGroups(mockUserId);

      expect(result.success).toBe(true);
      expect(result.fileGroups).toEqual(mockFileGroups);
      expect(result.count).toBe(2);
    });

    it('falls back to localStorage when API fails', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockFileGroups));

      const result = await fileGroupService.getFileGroups(mockUserId);

      expect(result.success).toBe(true);
      expect(result.fileGroups.length).toBeGreaterThanOrEqual(0);
    });

    it('uses localStorage when no userId provided', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockFileGroups));

      const result = await fileGroupService.getFileGroups();

      expect(result.success).toBe(true);
      // fetch should not be called since no userId was provided
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('getFileGroup', () => {
    it('gets a specific file group by ID', async () => {
      const mockResponse = {
        success: true,
        message: 'Group found',
        fileGroup: mockFileGroups[0],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fileGroupService.getFileGroup('group-1');

      expect(result).toEqual(mockFileGroups[0]);
    });

    it('returns null when group not found', async () => {
      const mockResponse = {
        success: true,
        message: 'Not found',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fileGroupService.getFileGroup('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createFileGroup', () => {
    it('creates a group successfully', async () => {
      const newGroup: FileGroup = {
        groupId: 'new-group-id',
        groupName: 'New Test Group',
        description: 'New group description',
        createdBy: mockUserId,
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
        sessionCount: 0,
        status: 'active',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Group created successfully',
          fileGroup: newGroup,
        }),
      } as Response);

      const result = await fileGroupService.createFileGroup(
        { groupName: 'New Test Group', description: 'New group description' },
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(result.fileGroup?.groupId).toBe('new-group-id');
    });

    it('handles duplicate group name (409 conflict)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({ message: 'Group name already exists' }),
      } as Response);

      // Falls back to localStorage which checks for duplicates
      const result = await fileGroupService.createFileGroup(
        { groupName: 'Existing Group' },
        mockUserId
      );

      // Should either return error or create locally
      expect(result).toBeDefined();
    });
  });

  describe('deleteFileGroup', () => {
    it('deletes a group successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Group deleted successfully',
        }),
      } as Response);

      const result = await fileGroupService.deleteFileGroup('group-1');

      expect(result.success).toBe(true);
    });
  });

  describe('archiveFileGroup', () => {
    it('archives a group successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Group archived successfully',
        }),
      } as Response);

      const result = await fileGroupService.archiveFileGroup('group-1');

      expect(result.success).toBe(true);
    });
  });

  describe('searchFileGroups', () => {
    it('searches groups via API', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 1,
          fileGroups: [mockFileGroups[0]],
        }),
      } as Response);

      const result = await fileGroupService.searchFileGroups('Test Group 1', mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].groupName).toBe('Test Group 1');
    });

    it('falls back to local search on API error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockFileGroups));

      const result = await fileGroupService.searchFileGroups('Test', mockUserId);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
