// components/ParameterManager/ParameterTree.tsx - UPDATED VERSION
import React from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { ParameterCategory, Parameter } from './types';
import { PARAMETER_CATEGORIES } from './parameterData';

interface ParameterTreeProps {
  filteredData: ParameterCategory[];
  onToggleCategory: (categoryIndex: number) => void;
  onToggleSubcategory: (categoryIndex: number, subcategoryIndex: number) => void;
  onUpdateParameter: (categoryIndex: number, subcategoryIndex: number, paramIndex: number, newValue: string | number) => void;
  isControlEnabled: boolean;
  searchQuery: string;
  parameterData: ParameterCategory[];
  setParameterData: React.Dispatch<React.SetStateAction<ParameterCategory[]>>;
}

const ParameterTree: React.FC<ParameterTreeProps> = ({
  filteredData,
  onToggleCategory,
  onToggleSubcategory,
  onUpdateParameter,
  isControlEnabled,
  searchQuery,
  parameterData,
  setParameterData
}) => {
  const resetToDefault = (
    categoryIndex: number, 
    subcategoryIndex: number, 
    paramIndex: number, 
    parameter: Parameter
  ) => {
    if (parameter.default !== undefined) {
      if (searchQuery) {
        // When searching, update the original data
        setParameterData(prev => prev.map(cat => ({
          ...cat,
          subcategories: cat.subcategories.map(sub => ({
            ...sub,
            parameters: sub.parameters.map(p => 
              p.name === parameter.name 
                ? { ...p, value: parameter.default as string | number, modified: false }
                : p
            )
          }))
        })));
      } else {
        onUpdateParameter(categoryIndex, subcategoryIndex, paramIndex, parameter.default);
      }
    }
  };

  const formatValue = (value: string | number, type?: string): string => {
    if (typeof value === 'number') {
      // Format based on parameter type
      switch (type) {
        case 'FLOAT':
          return value.toFixed(6).replace(/\.?0+$/, '');
        case 'INT8':
        case 'INT16':
        case 'INT32':
          return Math.round(value).toString();
        default:
          return value.toString();
      }
    }
    return value.toString();
  };

  const validateInput = (value: string, parameter: Parameter): boolean => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return false;
    
    if (parameter.range) {
      return numValue >= parameter.range[0] && numValue <= parameter.range[1];
    }
    return true;
  };

  return (
    <div className="bg-gray-900/80 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800 relative z-10">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-300">PARAMETER TREE</h4>
          <div className="text-xs text-gray-500">
            {filteredData.reduce((total, cat) => 
              total + cat.subcategories.reduce((subTotal, sub) => subTotal + sub.parameters.length, 0), 0
            )} parameters
          </div>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[800px]">
        {filteredData.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="text-lg mb-2">No parameters found</div>
            <div className="text-sm">Try adjusting your search terms</div>
          </div>
        ) : (
          filteredData.map((category, categoryIndex) => (
            <div key={category.name} className="border-b border-gray-800 last:border-b-0">
              {/* Category Header */}
              <button
                onClick={() => onToggleCategory(categoryIndex)}
                className="w-full p-4 text-left hover:bg-gray-800/50 flex items-center justify-between transition-colors"
                disabled={searchQuery.length > 0} // Disable toggle during search
              >
                <div className="flex items-center gap-3">
                  {category.expanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium text-white">{category.name}</div>
                    <div className="text-xs text-gray-400 mt-1">{category.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs text-gray-500">
                    {category.subcategories.reduce((total, sub) => total + sub.parameters.length, 0)} parameters
                  </div>
                  <div className="text-xs text-gray-500">
                    {category.subcategories.length} sections
                  </div>
                </div>
              </button>

              {/* Subcategories */}
              {category.expanded && (
                <div className="bg-gray-800/30">
                  {category.subcategories.map((subcategory, subcategoryIndex) => (
                    <div key={subcategory.name}>
                      {/* Subcategory Header */}
                      <button
                        onClick={() => onToggleSubcategory(categoryIndex, subcategoryIndex)}
                        className="w-full p-3 pl-8 text-left hover:bg-gray-800/50 flex items-center justify-between transition-colors border-t border-gray-800/50"
                        disabled={searchQuery.length > 0} // Disable toggle during search
                      >
                        <div className="flex items-center gap-3">
                          {subcategory.expanded ? (
                            <ChevronDown className="h-3 w-3 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-gray-500" />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-200">{subcategory.name}</div>
                            <div className="text-xs text-gray-500 mt-1">{subcategory.description}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {subcategory.parameters.length} params
                        </div>
                      </button>

                      {/* Parameters */}
                      {subcategory.expanded && (
                        <div className="bg-gray-900/50">
                          {subcategory.parameters.map((parameter, paramIndex) => {
                            const isModified = parameter.modified || false;
                            const hasValidRange = parameter.range !== undefined;
                            
                            return (
                              <div
                                key={parameter.name}
                                className={`p-3 pl-12 border-t border-gray-800/30 flex items-center justify-between hover:bg-gray-800/30 transition-colors ${
                                  isModified ? 'bg-amber-900/10 border-l-2 border-l-amber-500' : ''
                                }`}
                              >
                                <div className="flex-1 min-w-0 mr-4">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-mono text-white">{parameter.name}</span>
                                    {isModified && (
                                      <span className="text-xs bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded">
                                        MODIFIED
                                      </span>
                                    )}
                                    {parameter.type && (
                                      <span className="text-xs bg-gray-700/50 text-gray-400 px-1 py-0.5 rounded">
                                        {parameter.type}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {parameter.description && (
                                    <div className="text-xs text-gray-400 mb-1 truncate">
                                      {parameter.description}
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center gap-4 text-xs text-gray-500">
                                    {hasValidRange && (
                                      <span>Range: {parameter.range![0]} - {parameter.range![1]}</span>
                                    )}
                                    {parameter.default !== undefined && (
                                      <span>Default: {formatValue(parameter.default, parameter.type)}</span>
                                    )}
                                    {parameter.unit && (
                                      <span>Unit: {parameter.unit}</span>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={parameter.value}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '' || validateInput(value, parameter)) {
                                        onUpdateParameter(
                                          categoryIndex, 
                                          subcategoryIndex, 
                                          paramIndex, 
                                          parseFloat(value) || 0
                                        );
                                      }
                                    }}
                                    disabled={!isControlEnabled}
                                    className={`w-28 px-2 py-1 text-sm bg-gray-800 border rounded text-white ${
                                      !isControlEnabled 
                                        ? 'border-gray-700 cursor-not-allowed opacity-50'
                                        : 'border-gray-600 hover:border-gray-500 focus:border-blue-500 focus:outline-none'
                                    }`}
                                    step={parameter.type === 'FLOAT' ? 'any' : '1'}
                                    title={`Current: ${formatValue(parameter.value, parameter.type)}`}
                                  />
                                  
                                  {parameter.default !== undefined && (
                                    <button
                                      onClick={() => resetToDefault(categoryIndex, subcategoryIndex, paramIndex, parameter)}
                                      disabled={!isControlEnabled}
                                      className="text-xs text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed p-1"
                                      title={`Reset to default: ${formatValue(parameter.default, parameter.type)}`}
                                    >
                                      <RefreshCw className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ParameterTree;