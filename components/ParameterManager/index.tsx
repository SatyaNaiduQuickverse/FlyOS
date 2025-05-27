// components/ParameterManager/index.tsx - MAIN COMPONENT (UPDATED WITH FIXES)
import React, { useState, useCallback, useMemo } from 'react';
import { 
  Settings, AlertTriangle, CheckCircle, X
} from 'lucide-react';
import { Parameter, ParameterSubcategory, ParameterCategory } from './types';
import { PARAMETER_CATEGORIES } from './parameterData';
import ParameterSearch from './ParameterSearch';
import ParameterTree from './ParameterTree';
import ImportExport from './ImportExport';
import ChangesModal from './ChangesModal';

// Props interface
interface ParameterManagerProps {
  droneId: string;
  isControlEnabled: boolean;
}

const ParameterManager: React.FC<ParameterManagerProps> = ({ droneId, isControlEnabled }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Real ArduPilot parameter data from Google AI Studio
  const [parameterData, setParameterData] = useState<ParameterCategory[]>(PARAMETER_CATEGORIES);

  // Get all modified parameters
  const modifiedParameters = useMemo(() => {
    return parameterData
      .flatMap(cat => cat.subcategories)
      .flatMap(sub => sub.parameters)
      .filter(param => param.modified);
  }, [parameterData]);

  // Filter parameters based on search - show individual parameters when searching
  const filteredData = useMemo(() => {
    if (!searchQuery) return parameterData;
    
    // When searching, show individual parameters in a flattened structure
    const searchResults: ParameterCategory[] = [];
    const query = searchQuery.toLowerCase();
    
    parameterData.forEach(category => {
      category.subcategories.forEach(subcategory => {
        const matchingParams = subcategory.parameters.filter(param => 
          param.name.toLowerCase().includes(query) ||
          param.description?.toLowerCase().includes(query)
        );
        
        if (matchingParams.length > 0) {
          // Check if we already have a category for search results
          let searchCategory = searchResults.find(c => c.name === 'Search Results');
          
          if (!searchCategory) {
            searchCategory = {
              name: 'Search Results',
              description: `Parameters matching "${searchQuery}"`,
              expanded: true,
              subcategories: []
            };
            searchResults.push(searchCategory);
          }
          
          // Add subcategory with matching parameters
          searchCategory.subcategories.push({
            name: `${category.name} → ${subcategory.name}`,
            description: `${matchingParams.length} matching parameters`,
            expanded: true,
            parameters: matchingParams
          });
        }
      });
    });
    
    return searchResults;
  }, [parameterData, searchQuery]);

  // Toggle category expansion
  const handleToggleCategory = useCallback((categoryIndex: number) => {
    if (searchQuery) return; // Don't toggle during search
    
    setParameterData(prev => prev.map((cat, i) => 
      i === categoryIndex ? { ...cat, expanded: !cat.expanded } : cat
    ));
  }, [searchQuery]);

  // Toggle subcategory expansion
  const handleToggleSubcategory = useCallback((categoryIndex: number, subcategoryIndex: number) => {
    if (searchQuery) return; // Don't toggle during search
    
    setParameterData(prev => prev.map((cat, i) => 
      i === categoryIndex ? {
        ...cat,
        subcategories: cat.subcategories.map((sub, j) => 
          j === subcategoryIndex ? { ...sub, expanded: !sub.expanded } : sub
        )
      } : cat
    ));
  }, [searchQuery]);

  // Update parameter value - works with both normal and search modes
  const handleUpdateParameter = useCallback((categoryIndex: number, subcategoryIndex: number, paramIndex: number, newValue: string | number) => {
    if (searchQuery) {
      // When searching, we need to update the original data structure
      const searchResultParam = filteredData[categoryIndex]?.subcategories[subcategoryIndex]?.parameters[paramIndex];
      if (!searchResultParam) return;
      
      // Find and update in the original data
      setParameterData(prev => prev.map(cat => ({
        ...cat,
        subcategories: cat.subcategories.map(sub => ({
          ...sub,
          parameters: sub.parameters.map(param => 
            param.name === searchResultParam.name 
              ? { ...param, value: newValue, modified: true }
              : param
          )
        }))
      })));
    } else {
      // Normal category/subcategory update
      setParameterData(prev => prev.map((cat, i) => 
        i === categoryIndex ? {
          ...cat,
          subcategories: cat.subcategories.map((sub, j) => 
            j === subcategoryIndex ? {
              ...sub,
              parameters: sub.parameters.map((param, k) => 
                k === paramIndex ? { ...param, value: newValue, modified: true } : param
              )
            } : sub
          )
        } : cat
      ));
    }
    setHasUnsavedChanges(true);
  }, [searchQuery, filteredData]);

  // Handle parameter import
  const handleImportParameters = useCallback((parameters: any[]) => {
    let importedCount = 0;
    
    setParameterData(prev => {
      const newData = [...prev];
      
      parameters.forEach(({ name: paramName, value: paramValue }) => {
        // Find and update the parameter
        for (let catIndex = 0; catIndex < newData.length; catIndex++) {
          for (let subIndex = 0; subIndex < newData[catIndex].subcategories.length; subIndex++) {
            const paramIndex = newData[catIndex].subcategories[subIndex].parameters.findIndex(
              p => p.name === paramName
            );
            
            if (paramIndex !== -1) {
              const numValue = parseFloat(paramValue);
              newData[catIndex].subcategories[subIndex].parameters[paramIndex] = {
                ...newData[catIndex].subcategories[subIndex].parameters[paramIndex],
                value: isNaN(numValue) ? paramValue : numValue,
                modified: true
              };
              importedCount++;
              break;
            }
          }
        }
      });
      
      return newData;
    });
    
    setHasUnsavedChanges(true);
    setNotification({ 
      type: 'success', 
      message: `Imported ${importedCount} parameters` 
    });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Handle parameter export
  const handleExportParameters = useCallback((format: 'txt' | 'parm') => {
    const allParameters = parameterData
      .flatMap(cat => cat.subcategories)
      .flatMap(sub => sub.parameters);
    
    let content: string;
    
    if (format === 'parm') {
      content = allParameters.map(param => `${param.name},${param.value}`).join('\n');
    } else {
      content = allParameters.map(param => `${param.name}\t${param.value}`).join('\n');
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${droneId}_parameters.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    
    setNotification({ 
      type: 'success', 
      message: `Exported ${allParameters.length} parameters as ${format.toUpperCase()}` 
    });
    setTimeout(() => setNotification(null), 3000);
  }, [parameterData, droneId]);

  // Upload to drone
  const handleUploadToDrone = useCallback(() => {
    if (!isControlEnabled) {
      setNotification({ type: 'error', message: 'Control not enabled - cannot upload parameters' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    const modifiedParams = parameterData
      .flatMap(cat => cat.subcategories)
      .flatMap(sub => sub.parameters)
      .filter(param => param.modified);
    
    if (modifiedParams.length === 0) {
      setNotification({ type: 'error', message: 'No modified parameters to upload' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    console.log(`Uploading ${modifiedParams.length} modified parameters to drone ${droneId}:`, modifiedParams);
    
    setNotification({ 
      type: 'success', 
      message: `Parameter upload initiated: ${modifiedParams.length} parameters (placeholder)` 
    });
    setTimeout(() => setNotification(null), 3000);
  }, [droneId, isControlEnabled, parameterData]);

  // Reset all changes
  const handleResetAllChanges = useCallback(() => {
    setParameterData(PARAMETER_CATEGORIES);
    setHasUnsavedChanges(false);
    setNotification({ type: 'success', message: 'All changes have been reset' });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-light tracking-wider text-blue-300">PARAMETER MANAGEMENT</h3>
          </div>
          <div className="text-sm text-gray-400">
            Drone: <span className="text-blue-300">{droneId}</span>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="flex flex-col md:flex-row gap-4">
          <ParameterSearch 
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            parameterData={parameterData}
          />
          
          <ImportExport 
            parameterData={parameterData}
            onImportParameters={handleImportParameters}
            onExportParameters={handleExportParameters}
            onUploadToDrone={handleUploadToDrone}
            droneId={droneId}
            isControlEnabled={isControlEnabled}
          />
        </div>

        {/* Unsaved changes warning */}
        {hasUnsavedChanges && (
          <div className="mt-4 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg flex items-center justify-between text-amber-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">You have {modifiedParameters.length} unsaved parameter changes</span>
            </div>
            <button
              onClick={() => setShowChangesModal(true)}
              className="text-xs bg-amber-500/20 hover:bg-amber-500/30 px-2 py-1 rounded transition-colors"
            >
              View Changes
            </button>
          </div>
        )}

        {/* Search Stats */}
        {searchQuery && (
          <div className="mt-4 text-sm text-gray-400">
            Found {filteredData.reduce((total, cat) => 
              total + cat.subcategories.reduce((subTotal, sub) => subTotal + sub.parameters.length, 0), 0
            )} parameters matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Parameter Statistics */}
      <div className="bg-gray-900/80 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-light text-blue-400">
              {parameterData.reduce((total, cat) => 
                total + cat.subcategories.reduce((subTotal, sub) => subTotal + sub.parameters.length, 0), 0
              )}
            </div>
            <div className="text-sm text-gray-400 mt-1">Total Parameters</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-light text-amber-400">{modifiedParameters.length}</div>
            <div className="text-sm text-gray-400 mt-1">Modified</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-light text-green-400">{parameterData.length}</div>
            <div className="text-sm text-gray-400 mt-1">Categories</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-light text-purple-400">
              {parameterData.reduce((total, cat) => total + cat.subcategories.length, 0)}
            </div>
            <div className="text-sm text-gray-400 mt-1">Sections</div>
          </div>
        </div>
        
        {searchQuery && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="text-sm text-gray-400">
              Search Results: <span className="text-blue-300">
                {filteredData.reduce((total, cat) => 
                  total + cat.subcategories.reduce((subTotal, sub) => subTotal + sub.parameters.length, 0), 0
                )} parameters
              </span> matching "{searchQuery}"
            </div>
          </div>
        )}
      </div>

      {/* Parameter Tree */}
      <div className="relative z-0">
        <ParameterTree 
          filteredData={filteredData}
          onToggleCategory={handleToggleCategory}
          onToggleSubcategory={handleToggleSubcategory}
          onUpdateParameter={handleUpdateParameter}
          isControlEnabled={isControlEnabled}
          searchQuery={searchQuery}
          parameterData={parameterData}
          setParameterData={setParameterData}
        />
      </div>

      {/* Changes Modal */}
      {showChangesModal && (
        <ChangesModal
          modifiedParameters={modifiedParameters}
          onClose={() => setShowChangesModal(false)}
          onResetAllChanges={handleResetAllChanges}
          onUploadToDrone={handleUploadToDrone}
          onUpdateParameter={(paramName: string, newValue: string | number) => {
            // Update parameter by name
            setParameterData(prev => prev.map(cat => ({
              ...cat,
              subcategories: cat.subcategories.map(sub => ({
                ...sub,
                parameters: sub.parameters.map(param => 
                  param.name === paramName 
                    ? { ...param, value: newValue, modified: true }
                    : param
                )
              }))
            })));
            setHasUnsavedChanges(true);
          }}
          onResetParameter={(paramName: string) => {
            // Reset parameter by name
            const originalParam = PARAMETER_CATEGORIES
              .flatMap(cat => cat.subcategories)
              .flatMap(sub => sub.parameters)
              .find(p => p.name === paramName);
            
            if (originalParam) {
              setParameterData(prev => prev.map(cat => ({
                ...cat,
                subcategories: cat.subcategories.map(sub => ({
                  ...sub,
                  parameters: sub.parameters.map(param => 
                    param.name === paramName 
                      ? { ...param, value: originalParam.value || originalParam.default || 0, modified: false }
                      : param
                  )
                }))
              })));
              
              // Check if any parameters are still modified
              const stillModified = parameterData
                .flatMap(cat => cat.subcategories)
                .flatMap(sub => sub.parameters)
                .some(p => p.name !== paramName && p.modified);
              
              if (!stillModified) {
                setHasUnsavedChanges(false);
              }
            }
          }}
          isControlEnabled={isControlEnabled}
        />
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg border backdrop-blur-sm z-[100000] flex items-center gap-2 ${
          notification.type === 'success' 
            ? 'bg-green-900/80 border-green-500/30 text-green-300'
            : 'bg-red-900/80 border-red-500/30 text-red-300'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <span className="text-sm">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default ParameterManager;