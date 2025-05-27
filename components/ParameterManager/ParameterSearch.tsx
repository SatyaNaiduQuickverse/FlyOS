// components/ParameterManager/ParameterSearch.tsx - UPDATED VERSION
import React, { useState, useCallback, useMemo } from 'react';
import { Search, X, Filter, Tag } from 'lucide-react';
import { ParameterCategory } from './types';

interface ParameterSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  parameterData: ParameterCategory[];
}

interface SearchSuggestion {
  text: string;
  type: 'parameter' | 'category' | 'subcategory';
  category?: string;
  subcategory?: string;
}

const ParameterSearch: React.FC<ParameterSearchProps> = ({
  searchQuery,
  onSearchChange,
  parameterData
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'modified' | 'category'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Generate search suggestions
  const suggestions = useMemo((): SearchSuggestion[] => {
    if (!searchQuery || searchQuery.length < 2) return [];

    const allSuggestions: SearchSuggestion[] = [];
    const query = searchQuery.toLowerCase();

    parameterData.forEach(category => {
      // Category matches
      if (category.name.toLowerCase().includes(query)) {
        allSuggestions.push({
          text: category.name,
          type: 'category'
        });
      }

      category.subcategories.forEach(subcategory => {
        // Subcategory matches
        if (subcategory.name.toLowerCase().includes(query)) {
          allSuggestions.push({
            text: subcategory.name,
            type: 'subcategory',
            category: category.name
          });
        }

        // Parameter matches
        subcategory.parameters.forEach(parameter => {
          if (
            parameter.name.toLowerCase().includes(query) ||
            parameter.description?.toLowerCase().includes(query)
          ) {
            allSuggestions.push({
              text: parameter.name,
              type: 'parameter',
              category: category.name,
              subcategory: subcategory.name
            });
          }
        });
      });
    });

    // Remove duplicates and limit results
    const uniqueSuggestions = allSuggestions
      .filter((suggestion, index, self) => 
        index === self.findIndex(s => s.text === suggestion.text && s.type === suggestion.type)
      )
      .slice(0, 8);

    return uniqueSuggestions;
  }, [searchQuery, parameterData]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    onSearchChange(suggestion.text);
    setShowSuggestions(false);
  }, [onSearchChange]);

  // Clear search
  const clearSearch = useCallback(() => {
    onSearchChange('');
    setShowSuggestions(false);
  }, [onSearchChange]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    if (searchQuery.length >= 2) {
      setShowSuggestions(true);
    }
  }, [searchQuery]);

  // Handle input blur with delay to allow suggestion clicks
  const handleBlur = useCallback(() => {
    setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  // Get search stats
  const searchStats = useMemo(() => {
    if (!searchQuery) return null;

    let totalParams = 0;
    let matchingParams = 0;
    let matchingCategories = 0;

    parameterData.forEach(category => {
      let categoryHasMatch = false;
      
      category.subcategories.forEach(subcategory => {
        subcategory.parameters.forEach(parameter => {
          totalParams++;
          
          const matches = 
            parameter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            parameter.description?.toLowerCase().includes(searchQuery.toLowerCase());
          
          if (matches) {
            matchingParams++;
            categoryHasMatch = true;
          }
        });
      });
      
      if (categoryHasMatch) {
        matchingCategories++;
      }
    });

    return {
      totalParams,
      matchingParams,
      matchingCategories
    };
  }, [searchQuery, parameterData]);

  return (
    <div className="space-y-4 flex-1 relative z-20">
      
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search parameters by name or description..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-[1000] max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.text}-${index}`}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-2 border-b border-gray-700 last:border-b-0"
              >
                <div className="flex items-center gap-2 flex-1">
                  {suggestion.type === 'parameter' && <Tag className="h-3 w-3 text-blue-400" />}
                  {suggestion.type === 'category' && <Filter className="h-3 w-3 text-green-400" />}
                  {suggestion.type === 'subcategory' && <Filter className="h-3 w-3 text-yellow-400" />}
                  
                  <div className="flex-1">
                    <div className="text-sm text-white">{suggestion.text}</div>
                    {suggestion.category && (
                      <div className="text-xs text-gray-400">
                        {suggestion.category}
                        {suggestion.subcategory && ` → ${suggestion.subcategory}`}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-500 capitalize">
                    {suggestion.type}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-400">Filter:</span>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              selectedFilter === 'all'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          
          <button
            onClick={() => setSelectedFilter('modified')}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              selectedFilter === 'modified'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            Modified Only
          </button>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-300 hover:bg-gray-700"
          >
            <option value="">All Categories</option>
            {parameterData.map(category => (
              <option key={category.name} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Search Tips */}
      {!searchQuery && (
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-400 mb-2">Quick search tips:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-500">
            <div>• Type parameter names (e.g., "ATC_RAT")</div>
            <div>• Search descriptions (e.g., "GPS")</div>
            <div>• Category names (e.g., "Flight Control")</div>
            <div>• Use filters to narrow results</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParameterSearch;