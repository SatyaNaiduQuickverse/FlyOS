// components/ParameterManager/ChangesModal.tsx - NEW COMPONENT
import React from 'react';
import { FileText, X, RefreshCw, Save } from 'lucide-react';
import { Parameter } from './types';
import { PARAMETER_CATEGORIES } from './parameterData';

interface ChangesModalProps {
  modifiedParameters: Parameter[];
  onClose: () => void;
  onResetAllChanges: () => void;
  onUploadToDrone: () => void;
  onUpdateParameter: (paramName: string, newValue: string | number) => void;
  onResetParameter: (paramName: string) => void;
  isControlEnabled: boolean;
}

const ChangesModal: React.FC<ChangesModalProps> = ({
  modifiedParameters,
  onClose,
  onResetAllChanges,
  onUploadToDrone,
  onUpdateParameter,
  onResetParameter,
  isControlEnabled
}) => {
  // Format parameter value display
  const formatValue = (value: string | number, type?: string): string => {
    if (typeof value === 'number') {
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

  // Validate parameter input
  const validateInput = (value: string, parameter: Parameter): boolean => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return false;
    
    if (parameter.range) {
      return numValue >= parameter.range[0] && numValue <= parameter.range[1];
    }
    return true;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[99999]">
      <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl relative z-[100000]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-amber-400" />
            <h3 className="text-lg font-medium text-white">Parameter Changes</h3>
            <span className="bg-amber-500/20 text-amber-300 text-sm px-2 py-1 rounded">
              {modifiedParameters.length} modified
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {modifiedParameters.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No parameter changes</p>
              <p className="text-sm mt-2">Modified parameters will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {modifiedParameters.map((param, index) => {
                // Find the original parameter to show before/after
                const originalParam = PARAMETER_CATEGORIES
                  .flatMap(cat => cat.subcategories)
                  .flatMap(sub => sub.parameters)
                  .find(p => p.name === param.name);
                
                return (
                  <div key={`${param.name}-${index}`} className="bg-gray-800/50 p-4 rounded-lg border border-amber-500/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 mr-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-white text-sm">{param.name}</span>
                          {param.type && (
                            <span className="text-xs bg-gray-700/50 text-gray-400 px-1 py-0.5 rounded">
                              {param.type}
                            </span>
                          )}
                          <span className="text-xs bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded">
                            MODIFIED
                          </span>
                        </div>
                        
                        {param.description && (
                          <div className="text-xs text-gray-400 mb-3">
                            {param.description}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">Original:</span>
                            <span className="bg-gray-700/50 px-2 py-1 rounded text-gray-300">
                              {formatValue(originalParam?.value || originalParam?.default || 0, param.type)}
                            </span>
                          </div>
                          <span className="text-gray-500">→</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">New:</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={param.value}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '' || validateInput(value, param)) {
                                    onUpdateParameter(param.name, parseFloat(value) || 0);
                                  }
                                }}
                                disabled={!isControlEnabled}
                                className={`w-24 px-2 py-1 text-sm bg-amber-500/10 border rounded text-amber-300 ${
                                  !isControlEnabled 
                                    ? 'border-gray-700 cursor-not-allowed opacity-50'
                                    : 'border-amber-500/30 hover:border-amber-500/50 focus:border-amber-500 focus:outline-none'
                                }`}
                                step={param.type === 'FLOAT' ? 'any' : '1'}
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {param.range && (
                            <span>Range: {param.range[0]} - {param.range[1]}</span>
                          )}
                          {param.unit && (
                            <span>Unit: {param.unit}</span>
                          )}
                          {param.default !== undefined && (
                            <span>Default: {formatValue(param.default, param.type)}</span>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => onResetParameter(param.name)}
                        className="text-xs text-gray-400 hover:text-gray-300 bg-gray-700/50 hover:bg-gray-700 px-2 py-1 rounded transition-colors flex items-center gap-1"
                        title="Reset to original value"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reset
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-800">
          <div className="flex gap-2">
            <button
              onClick={onResetAllChanges}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              Reset All Changes
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onUploadToDrone();
              }}
              disabled={!isControlEnabled}
              className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                isControlEnabled 
                  ? 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300'
                  : 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save className="h-4 w-4" />
              Upload Changes to Drone
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangesModal;