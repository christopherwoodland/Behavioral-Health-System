import React, { useState, useEffect } from 'react';
import { Plus, Users, Search, Calendar, Trash2 } from 'lucide-react';
import { fileGroupService } from '../services/fileGroupService';
import { useAuth } from '../contexts/AuthContext';
import { getUserId } from '../utils';
import { useLoadingState, useFieldState, useConfirmDialog } from '../utils/ui';
import { validateGroupName } from '../utils/validation';
import type { FileGroup } from '../types';

interface GroupSelectorProps {
  selectedGroupId?: string;
  onGroupChange: (groupId: string | undefined) => void;
  onCreateGroup?: (groupName: string, description?: string) => Promise<string>;
  onDeleteGroup?: (groupId: string, groupName: string) => Promise<void>;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  showDeleteButton?: boolean;
}

const GroupSelector: React.FC<GroupSelectorProps> = ({
  selectedGroupId,
  onGroupChange,
  onCreateGroup,
  onDeleteGroup,
  className = '',
  disabled = false,
  required = false,
  showDeleteButton = false
}) => {
  const [groups, setGroups] = useState<FileGroup[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Use utility hooks for state management
  const loadingState = useLoadingState();
  const createLoadingState = useLoadingState();
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  
  // Form field states with validation
  const groupName = useFieldState('', (value) => {
    const existingNames = groups.map(g => g.groupName);
    const validation = validateGroupName(value, existingNames);
    return validation.isValid ? undefined : validation.error;
  });
  
  const groupDescription = useFieldState('');
  
  // Confirmation dialog for delete operations
  const confirmDialog = useConfirmDialog();
  
  const { user } = useAuth();

  // Load existing groups
  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      loadingState.setLoading(true);
      const userId = user?.id || getUserId();
      const response = await fileGroupService.getFileGroups(userId);
      if (response.success) {
        setGroups(response.fileGroups);
      }
    } catch (error) {
      console.error('Failed to load file groups:', error);
    } finally {
      loadingState.resetLoading();
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.value.trim() || !groupName.validate()) return;
    
    try {
      createLoadingState.setLoading(true);
      
      const userId = user?.id || getUserId();
      let createdGroupId: string;
      
      if (onCreateGroup) {
        // If onCreateGroup callback is provided, use it for creation
        try {
          createdGroupId = await onCreateGroup(groupName.value.trim(), groupDescription.value.trim() || undefined);
        } catch (error) {
          // Handle errors from the callback - this will be shown in the field error
          groupName.setValue(groupName.value); // This will trigger validation and show error
          return;
        }
      } else {
        // If no callback provided, handle creation internally
        const response = await fileGroupService.createFileGroup({
          groupName: groupName.value.trim(),
          description: groupDescription.value.trim() || undefined,
          createdBy: userId
        }, userId);
        
        if (response.success && response.fileGroup) {
          createdGroupId = response.fileGroup.groupId;
        } else {
          // Set error on the field
          groupName.setValue(groupName.value); // This will trigger validation
          return;
        }
      }
      
      // Set the newly created group as selected
      onGroupChange(createdGroupId);
      
      // Reset form
      groupName.reset();
      groupDescription.reset();
      setShowCreateForm(false);
      
      // Reload groups to ensure UI is in sync
      await loadGroups();
      
    } catch (error) {
      console.error('Failed to create group:', error);
      groupName.setValue(groupName.value); // This will trigger validation and potentially show error
    } finally {
      createLoadingState.resetLoading();
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!onDeleteGroup) return;
    
    try {
      setDeleteLoading(groupId);
      await onDeleteGroup(groupId, groupName);
      
      // If the deleted group was selected, clear the selection
      if (selectedGroupId === groupId) {
        onGroupChange(undefined);
      }
      
      // Reload groups to ensure UI is in sync
      await loadGroups();
      
    } catch (error) {
      console.error('Failed to delete group:', error);
      // Could add error handling here if needed
    } finally {
      setDeleteLoading(null);
    }
  };

  const showDeleteConfirmation = (groupId: string, groupName: string) => {
    confirmDialog.showConfirm(
      `Are you sure you want to delete the group "${groupName}"? This action cannot be undone.`,
      () => handleDeleteGroup(groupId, groupName),
      {
        title: 'Delete Group',
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    );
  };

  const filteredGroups = groups.filter(group =>
    group.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedGroup = groups.find(g => g.groupId === selectedGroupId);

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          File Group {required && <span className="text-red-500">*</span>}
        </label>
        
        {/* Group Selection */}
        <div className="space-y-3">
          {/* No Group Option */}
          <label className="flex items-center space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
            <input
              type="radio"
              name="group-selection"
              value=""
              checked={!selectedGroupId}
              onChange={() => onGroupChange(undefined)}
              disabled={disabled}
              className="text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">No Group</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Process files individually without grouping</div>
            </div>
          </label>

          {/* Existing Groups */}
          {!loadingState.isLoading && filteredGroups.length > 0 && (
            <div className="space-y-2">
              {/* Search for existing groups */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search existing groups..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  disabled={disabled}
                />
              </div>

              {filteredGroups.map(group => (
                <label
                  key={group.groupId}
                  className="flex items-start space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <input
                    type="radio"
                    name="group-selection"
                    value={group.groupId}
                    checked={selectedGroupId === group.groupId}
                    onChange={() => onGroupChange(group.groupId)}
                    disabled={disabled}
                    className="text-blue-600 focus:ring-blue-500 mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {group.groupName}
                      </div>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {group.sessionCount} session{group.sessionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {group.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {group.description}
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-xs text-gray-400 dark:text-gray-500 mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  {/* Delete Button */}
                  {showDeleteButton && onDeleteGroup && (
                    <div className="flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          showDeleteConfirmation(group.groupId, group.groupName);
                        }}
                        disabled={disabled || deleteLoading === group.groupId}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                        title={`Delete group "${group.groupName}"`}
                      >
                        {deleteLoading === group.groupId ? (
                          <div className="w-4 h-4 animate-spin border-2 border-red-500 border-t-transparent rounded-full" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </label>
              ))}
            </div>
          )}

          {/* Create New Group */}
          {!showCreateForm ? (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              disabled={disabled}
              className="flex items-center space-x-2 w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Group</span>
            </button>
          ) : (
            <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Group Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={groupName.value}
                    onChange={(e) => groupName.setValue(e.target.value)}
                    onBlur={() => groupName.setTouched()}
                    placeholder="Enter group name..."
                    className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${
                      groupName.touched && groupName.error 
                        ? 'border-red-300 dark:border-red-600' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    disabled={createLoadingState.isLoading}
                  />
                  {groupName.touched && groupName.error && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{groupName.error}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={groupDescription.value}
                    onChange={(e) => groupDescription.setValue(e.target.value)}
                    placeholder="Enter group description..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    disabled={createLoadingState.isLoading}
                  />
                </div>
                
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={!groupName.isValid || createLoadingState.isLoading}
                    className="btn btn--primary text-sm disabled:opacity-50"
                  >
                    {createLoadingState.isLoading ? 'Creating...' : 'Create Group'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      groupName.reset();
                      groupDescription.reset();
                    }}
                    disabled={createLoadingState.isLoading}
                    className="btn btn--secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {loadingState.isLoading && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              Loading groups...
            </div>
          )}
        </div>

        {/* Selected Group Summary */}
        {selectedGroup && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
              <Users className="w-4 h-4" />
              <span className="font-medium">Selected: {selectedGroup.groupName}</span>
            </div>
            {selectedGroup.description && (
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {selectedGroup.description}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {confirmDialog.config.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {confirmDialog.config.message}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={confirmDialog.handleCancel}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {confirmDialog.config.cancelText}
              </button>
              <button
                onClick={confirmDialog.handleConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                {confirmDialog.config.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupSelector;