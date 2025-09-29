import React, { useState, useEffect } from 'react';
import { Plus, Users, Search, Calendar } from 'lucide-react';
import { fileGroupService } from '../services/fileGroupService';
import { useAuth } from '../contexts/AuthContext';
import { getUserId } from '../utils';
import type { FileGroup } from '../types';

interface GroupSelectorProps {
  selectedGroupId?: string;
  onGroupChange: (groupId: string | undefined) => void;
  onCreateGroup?: (groupName: string, description?: string) => Promise<string>;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

interface NewGroupData {
  name: string;
  description: string;
}

const GroupSelector: React.FC<GroupSelectorProps> = ({
  selectedGroupId,
  onGroupChange,
  onCreateGroup,
  className = '',
  disabled = false,
  required = false
}) => {
  const [groups, setGroups] = useState<FileGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newGroupData, setNewGroupData] = useState<NewGroupData>({
    name: '',
    description: ''
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  const { user } = useAuth();

  // Load existing groups
  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const userId = user?.id || getUserId();
      const response = await fileGroupService.getFileGroups(userId);
      if (response.success) {
        setGroups(response.fileGroups);
      }
    } catch (error) {
      console.error('Failed to load file groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupData.name.trim()) return;
    
    try {
      setCreateLoading(true);
      setCreateError(null); // Clear previous errors
      
      const userId = user?.id || getUserId();
      let createdGroupId: string;
      
      if (onCreateGroup) {
        // If onCreateGroup callback is provided, use it for creation
        try {
          createdGroupId = await onCreateGroup(newGroupData.name.trim(), newGroupData.description.trim() || undefined);
        } catch (error) {
          // Handle errors from the callback
          setCreateError(error instanceof Error ? error.message : 'Failed to create group');
          return;
        }
      } else {
        // If no callback provided, handle creation internally
        const response = await fileGroupService.createFileGroup({
          groupName: newGroupData.name.trim(),
          description: newGroupData.description.trim() || undefined,
          createdBy: userId
        }, userId);
        
        if (response.success && response.fileGroup) {
          createdGroupId = response.fileGroup.groupId;
        } else {
          setCreateError(response.message || 'Failed to create group');
          return;
        }
      }
      
      // Set the newly created group as selected
      onGroupChange(createdGroupId);
      
      // Reset form
      setNewGroupData({ name: '', description: '' });
      setShowCreateForm(false);
      
      // Reload groups to ensure UI is in sync
      await loadGroups();
      
    } catch (error) {
      console.error('Failed to create group:', error);
      setCreateError('Failed to create group. Please try again.');
    } finally {
      setCreateLoading(false);
    }
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
          {!loading && filteredGroups.length > 0 && (
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
                    value={newGroupData.name}
                    onChange={(e) => setNewGroupData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter group name..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    disabled={createLoading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newGroupData.description}
                    onChange={(e) => setNewGroupData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter group description..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    disabled={createLoading}
                  />
                </div>
                
                {/* Error Message */}
                {createError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm text-red-700 dark:text-red-300">{createError}</p>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={!newGroupData.name.trim() || createLoading}
                    className="btn btn--primary text-sm disabled:opacity-50"
                  >
                    {createLoading ? 'Creating...' : 'Create Group'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewGroupData({ name: '', description: '' });
                      setCreateError(null); // Clear error when cancelling
                    }}
                    disabled={createLoading}
                    className="btn btn--secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading && (
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
    </div>
  );
};

export default GroupSelector;