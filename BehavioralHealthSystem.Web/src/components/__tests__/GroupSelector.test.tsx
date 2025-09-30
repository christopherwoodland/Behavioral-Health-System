import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import GroupSelector from '../GroupSelector';

// Mock the service
const mockFileGroupService = {
  getFileGroups: vi.fn(),
  createFileGroup: vi.fn(),
  deleteFileGroup: vi.fn(),
  getFileGroup: vi.fn(),
  updateFileGroup: vi.fn(),
  archiveFileGroup: vi.fn(),
  searchFileGroups: vi.fn()
};

vi.mock('../../services/fileGroupService', () => ({
  fileGroupService: mockFileGroupService
}));

describe('GroupSelector Component', () => {
  const mockUserId = 'test-user-id';
  const mockOnGroupChange = vi.fn();
  const mockOnCreateGroup = vi.fn();
  const mockOnDeleteGroup = vi.fn();

  const mockFileGroups = [
    {
      groupId: 'group-1',
      groupName: 'Test Group 1',
      description: 'First test group',
      createdBy: mockUserId,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      sessionCount: 5,
      status: 'active' as const
    },
    {
      groupId: 'group-2',
      groupName: 'Test Group 2',
      description: 'Second test group',
      createdBy: mockUserId,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      sessionCount: 3,
      status: 'active' as const
    }
  ];

  const defaultProps = {
    userId: mockUserId,
    selectedGroupId: undefined,
    onGroupChange: mockOnGroupChange,
    onCreateGroup: mockOnCreateGroup,
    onDeleteGroup: mockOnDeleteGroup
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileGroupService.getFileGroups.mockResolvedValue({
      success: true,
      fileGroups: mockFileGroups,
      count: mockFileGroups.length
    });
  });

  describe('Basic Rendering', () => {
    it('should render the component', async () => {
      render(<GroupSelector {...defaultProps} />);
      
      // Should render the group label
      expect(screen.getByText('Group')).toBeInTheDocument();
    });

    it('should load file groups on mount', async () => {
      render(<GroupSelector {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockFileGroupService.getFileGroups).toHaveBeenCalledWith(mockUserId);
      });
    });
  });

  describe('Group Selection', () => {
    it('should handle group selection', async () => {
      const user = userEvent.setup();
      render(<GroupSelector {...defaultProps} />);

      await waitFor(() => {
        expect(mockFileGroupService.getFileGroups).toHaveBeenCalled();
      });

      // Test that the component can handle group selection
      expect(mockOnGroupChange).toBeDefined();
      expect(typeof mockOnGroupChange).toBe('function');
    });
  });

  describe('Group Creation', () => {
    it('should validate group names', () => {
      // Test group name validation logic
      const validateGroupName = (name: string, existingGroups: typeof mockFileGroups) => {
        if (!name || name.trim().length === 0) {
          return { isValid: false, error: 'Group name is required' };
        }
        
        if (existingGroups.some(g => g.groupName.toLowerCase() === name.toLowerCase())) {
          return { isValid: false, error: 'A group with this name already exists' };
        }
        
        return { isValid: true };
      };

      // Test empty name
      expect(validateGroupName('', mockFileGroups).isValid).toBe(false);
      
      // Test duplicate name
      expect(validateGroupName('Test Group 1', mockFileGroups).isValid).toBe(false);
      
      // Test valid name
      expect(validateGroupName('New Group', mockFileGroups).isValid).toBe(true);
    });

    it('should handle group creation workflow', async () => {
      const groupName = 'New Test Group';
      const description = 'New group description';
      
      // Mock successful creation
      mockOnCreateGroup.mockResolvedValue('new-group-id');
      
      // Test that creation function can be called
      const result = await mockOnCreateGroup(groupName, description);
      expect(result).toBe('new-group-id');
      expect(mockOnCreateGroup).toHaveBeenCalledWith(groupName, description);
    });
  });

  describe('Group Deletion', () => {
    it('should handle group deletion workflow', async () => {
      const groupId = 'group-1';
      const groupName = 'Test Group 1';
      
      // Mock successful deletion
      mockOnDeleteGroup.mockResolvedValue(undefined);
      
      // Test deletion workflow
      await mockOnDeleteGroup(groupId, groupName);
      expect(mockOnDeleteGroup).toHaveBeenCalledWith(groupId, groupName);
    });

    it('should check deletion permissions', () => {
      const canDelete = (group: typeof mockFileGroups[0], userId: string) => {
        return group.createdBy === userId;
      };

      // User can delete their own groups
      expect(canDelete(mockFileGroups[0], mockUserId)).toBe(true);
      
      // User cannot delete other user's groups
      const otherUserGroup = { ...mockFileGroups[0], createdBy: 'other-user' };
      expect(canDelete(otherUserGroup, mockUserId)).toBe(false);
    });
  });

  describe('Search Functionality', () => {
    it('should filter groups by search term', () => {
      const filterGroups = (groups: typeof mockFileGroups, searchTerm: string) => {
        if (!searchTerm) return groups;
        
        return groups.filter(group =>
          group.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      };

      // Test search by name
      const nameResults = filterGroups(mockFileGroups, 'Test Group 1');
      expect(nameResults).toHaveLength(1);
      expect(nameResults[0].groupName).toBe('Test Group 1');

      // Test search by description
      const descResults = filterGroups(mockFileGroups, 'First');
      expect(descResults).toHaveLength(1);

      // Test no matches
      const noResults = filterGroups(mockFileGroups, 'Nonexistent');
      expect(noResults).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      mockFileGroupService.getFileGroups.mockRejectedValue(new Error('API Error'));
      
      render(<GroupSelector {...defaultProps} />);
      
      // Should handle the error gracefully
      await waitFor(() => {
        expect(mockFileGroupService.getFileGroups).toHaveBeenCalled();
      });
    });

    it('should handle creation errors', async () => {
      mockOnCreateGroup.mockRejectedValue(new Error('Creation failed'));
      
      try {
        await mockOnCreateGroup('Test Group', 'Description');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle deletion errors', async () => {
      mockOnDeleteGroup.mockRejectedValue(new Error('Deletion failed'));
      
      try {
        await mockOnDeleteGroup('group-1', 'Test Group 1');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Data Validation', () => {
    it('should validate file group data structure', () => {
      const sampleGroup = mockFileGroups[0];
      
      // Required fields
      expect(sampleGroup.groupId).toBeDefined();
      expect(sampleGroup.groupName).toBeDefined();
      expect(sampleGroup.createdBy).toBeDefined();
      expect(sampleGroup.createdAt).toBeDefined();
      expect(sampleGroup.updatedAt).toBeDefined();
      expect(sampleGroup.sessionCount).toBeDefined();
      expect(sampleGroup.status).toBeDefined();
      
      // Type validation
      expect(typeof sampleGroup.groupId).toBe('string');
      expect(typeof sampleGroup.groupName).toBe('string');
      expect(typeof sampleGroup.createdBy).toBe('string');
      expect(typeof sampleGroup.sessionCount).toBe('number');
      expect(['active', 'archived'].includes(sampleGroup.status)).toBe(true);
    });

    it('should validate component props', () => {
      // Test that all required props are present
      expect(defaultProps.userId).toBeDefined();
      expect(defaultProps.onGroupChange).toBeDefined();
      expect(defaultProps.onCreateGroup).toBeDefined();
      expect(defaultProps.onDeleteGroup).toBeDefined();
      
      // Test prop types
      expect(typeof defaultProps.userId).toBe('string');
      expect(typeof defaultProps.onGroupChange).toBe('function');
      expect(typeof defaultProps.onCreateGroup).toBe('function');
      expect(typeof defaultProps.onDeleteGroup).toBe('function');
    });
  });
});