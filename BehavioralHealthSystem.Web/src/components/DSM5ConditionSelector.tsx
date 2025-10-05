import React, { useState, useEffect } from 'react';
import { DSM5ConditionData } from '../types/dsm5Types';
import { dsm5Service } from '../services/dsm5Service';
import { createAppError } from '../utils';

interface DSM5ConditionSelectorProps {
  selectedConditions: string[];
  onSelectionChange: (selectedConditionIds: string[]) => void;
  maxSelections?: number;
  disabled?: boolean;
  className?: string;
}

interface DSM5ConditionCategory {
  category: string;
  conditions: DSM5ConditionData[];
}

export const DSM5ConditionSelector: React.FC<DSM5ConditionSelectorProps> = ({
  selectedConditions,
  onSelectionChange,
  maxSelections = 5,
  disabled = false,
  className = ''
}) => {
  const [availableConditions, setAvailableConditions] = useState<DSM5ConditionData[]>([]);
  const [categorizedConditions, setCategorizedConditions] = useState<DSM5ConditionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAvailableConditions();
  }, []);

  useEffect(() => {
    categorizeConditions();
  }, [availableConditions, searchTerm, selectedCategory]);

  const loadAvailableConditions = async () => {
    try {
      setLoading(true);
      setError(null);

      const conditions = await dsm5Service.getAvailableConditions({ 
        includeDetails: false 
      });
      
      setAvailableConditions(conditions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load DSM-5 conditions';
      const error = createAppError('DSM5_LOAD_ERROR', errorMessage);
      setError(error.message);
      console.error('Error loading DSM-5 conditions:', error);
    } finally {
      setLoading(false);
    }
  };

  const categorizeConditions = () => {
    let filteredConditions = availableConditions;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredConditions = filteredConditions.filter(condition =>
        condition.name.toLowerCase().includes(searchLower) ||
        condition.description.toLowerCase().includes(searchLower) ||
        condition.code.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filteredConditions = filteredConditions.filter(condition =>
        condition.category === selectedCategory
      );
    }

    // Group by category
    const categoryMap = new Map<string, DSM5ConditionData[]>();
    
    filteredConditions.forEach(condition => {
      const category = condition.category || 'Other';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(condition);
    });

    // Convert to array and sort
    const categorized = Array.from(categoryMap.entries())
      .map(([category, conditions]) => ({
        category,
        conditions: conditions.sort((a, b) => a.name.localeCompare(b.name))
      }))
      .sort((a, b) => a.category.localeCompare(b.category));

    setCategorizedConditions(categorized);

    // Auto-expand categories with few items or if searching
    if (searchTerm.trim() || categorized.length <= 3) {
      setExpandedCategories(new Set(categorized.map(c => c.category)));
    }
  };

  const handleConditionToggle = (conditionId: string) => {
    if (disabled) return;

    const newSelection = selectedConditions.includes(conditionId)
      ? selectedConditions.filter(id => id !== conditionId)
      : [...selectedConditions, conditionId];

    // Enforce max selections limit
    if (newSelection.length <= maxSelections) {
      onSelectionChange(newSelection);
    }
  };

  const handleCategoryToggle = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSelectAll = () => {
    if (disabled) return;
    
    const visibleConditions = categorizedConditions.flatMap(cat => cat.conditions);
    const allIds = visibleConditions.map(c => c.id);
    const limitedSelection = allIds.slice(0, maxSelections);
    onSelectionChange(limitedSelection);
  };

  const handleClearAll = () => {
    if (!disabled) {
      onSelectionChange([]);
    }
  };

  const getAvailableCategories = () => {
    const categories = [...new Set(availableConditions.map(c => c.category))].sort();
    return ['all', ...categories];
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading DSM-5 conditions...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error Loading Conditions</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={loadAvailableConditions}
                  className="bg-red-100 dark:bg-red-900/40 px-3 py-1 rounded text-sm text-red-800 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select Mental Health Conditions
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose up to {maxSelections} conditions for assessment ({selectedConditions.length}/{maxSelections} selected)
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleSelectAll}
            disabled={disabled || categorizedConditions.flatMap(c => c.conditions).length === 0}
            className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/60 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select All
          </button>
          <button
            onClick={handleClearAll}
            disabled={disabled || selectedConditions.length === 0}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search Conditions
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search by name, description, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Filter by Category
          </label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {getAvailableCategories().map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Conditions List */}
      <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
        {categorizedConditions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No conditions found matching your criteria.</p>
            <p className="text-sm mt-1">Try adjusting your search or category filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-600">
            {categorizedConditions.map(({ category, conditions }) => (
              <div key={category} className="bg-white dark:bg-gray-800">
                {/* Category Header */}
                <button
                  onClick={() => handleCategoryToggle(category)}
                  className="w-full px-4 py-3 text-left flex items-center justify-between bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{category}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{conditions.length} conditions</p>
                  </div>
                  <svg
                    className={`h-5 w-5 text-gray-500 transform transition-transform ${
                      expandedCategories.has(category) ? 'rotate-90' : ''
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Category Content */}
                {expandedCategories.has(category) && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {conditions.map(condition => (
                      <label
                        key={condition.id}
                        className={`flex items-start p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          disabled ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedConditions.includes(condition.id)}
                          onChange={() => handleConditionToggle(condition.id)}
                          disabled={disabled || (!selectedConditions.includes(condition.id) && selectedConditions.length >= maxSelections)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {condition.name}
                            </p>
                            <span className="ml-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                              {condition.code}
                            </span>
                          </div>
                          {condition.description && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {condition.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <span>Criteria: {condition.criteriaCount || 0}</span>
                            {condition.pageNumbers && condition.pageNumbers.length > 0 && (
                              <>
                                <span className="mx-2">•</span>
                                <span>Pages: {condition.pageNumbers.join(', ')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {selectedConditions.length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-400 mb-2">
            Selected Conditions ({selectedConditions.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedConditions.map(conditionId => {
              const condition = availableConditions.find(c => c.id === conditionId);
              return condition ? (
                <span
                  key={conditionId}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400"
                >
                  {condition.name}
                  {!disabled && (
                    <button
                      onClick={() => handleConditionToggle(conditionId)}
                      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      ×
                    </button>
                  )}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
};