// components/ParameterManager/ImportExport.tsx - COMPLETE VERSION (FIXED)
import React, { useState, useCallback } from 'react';
import { Upload, Download, X, CheckCircle, AlertTriangle, FileText, Filter, Save } from 'lucide-react';
import { ParameterCategory, ImportOptions, ExportOptions, ParameterFile, ValidationResult } from './types';

interface ImportExportProps {
  parameterData: ParameterCategory[];
  onImportParameters: (parameters: any[]) => void;
  onExportParameters: (format: 'txt' | 'parm') => void;
  onUploadToDrone: () => void;
  droneId: string;
  isControlEnabled: boolean;
}

const ImportExport: React.FC<ImportExportProps> = ({
  parameterData,
  onImportParameters,
  onExportParameters,
  onUploadToDrone,
  droneId,
  isControlEnabled
}) => {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ParameterFile | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    categories: [],
    replaceExisting: true,
    validateRanges: true
  });
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'txt',
    categories: [],
    modifiedOnly: false
  });
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Parse parameter file content
  const parseParameterFile = useCallback((content: string, filename: string): ParameterFile | null => {
    try {
      const lines = content.split('\n').filter(line => line.trim());
      const parameters: any[] = [];
      let format: 'txt' | 'parm' = filename.endsWith('.parm') ? 'parm' : 'txt';

      for (const line of lines) {
        // Skip comments and empty lines
        if (line.startsWith('#') || line.startsWith('//') || !line.trim()) {
          continue;
        }

        // Parse different formats
        let match;
        if (format === 'parm') {
          // .parm format: PARAM_NAME,VALUE
          match = line.match(/^([A-Z_][A-Z0-9_]*),(.+)$/);
          if (match) {
            parameters.push({
              name: match[1].trim(),
              value: parseFloat(match[2].trim()) || match[2].trim()
            });
          }
        } else {
          // .txt format: PARAM_NAME    VALUE
          match = line.match(/^([A-Z_][A-Z0-9_]*)\s+(.+)$/);
          if (match) {
            parameters.push({
              name: match[1].trim(),
              value: parseFloat(match[2].trim()) || match[2].trim()
            });
          }
        }
      }

      return {
        name: filename,
        content,
        format,
        parameterCount: parameters.length
      };
    } catch (error) {
      console.error('Error parsing parameter file:', error);
      return null;
    }
  }, []);

  // Validate imported parameters
  const validateParameters = useCallback((file: ParameterFile): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!file) {
      return { isValid: false, errors: ['Invalid file'], warnings: [] };
    }

    if (file.parameterCount === 0) {
      errors.push('No valid parameters found in file');
    }

    if (file.parameterCount < 10) {
      warnings.push(`Only ${file.parameterCount} parameters found - this seems low`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsedFile = parseParameterFile(content, file.name);
      
      if (parsedFile) {
        setSelectedFile(parsedFile);
        const validation = validateParameters(parsedFile);
        setValidationResult(validation);
      } else {
        setValidationResult({
          isValid: false,
          errors: ['Failed to parse parameter file'],
          warnings: []
        });
      }
    };
    reader.readAsText(file);
  }, [parseParameterFile, validateParameters]);

  // Handle import
  const handleImport = useCallback(() => {
    if (!selectedFile || !validationResult?.isValid) return;

    setIsProcessing(true);
    
    // Parse parameters from file content
    const lines = selectedFile.content.split('\n');
    const parameters: any[] = [];
    
    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;
      
      const match = selectedFile.format === 'parm' 
        ? line.match(/^([A-Z_][A-Z0-9_]*),(.+)$/)
        : line.match(/^([A-Z_][A-Z0-9_]*)\s+(.+)$/);
      
      if (match) {
        parameters.push({
          name: match[1].trim(),
          value: parseFloat(match[2].trim()) || match[2].trim()
        });
      }
    }

    setTimeout(() => {
      onImportParameters(parameters);
      setIsProcessing(false);
      setImportModalOpen(false);
      setSelectedFile(null);
      setValidationResult(null);
    }, 1000);
  }, [selectedFile, validationResult, onImportParameters]);

  // Handle export with loading state
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onExportParameters(exportOptions.format);
      setExportModalOpen(false);
    } finally {
      setIsExporting(false);
    }
  }, [exportOptions, onExportParameters]);

  // Get available categories
  const availableCategories = parameterData.map(cat => cat.name);

  return (
    <React.Fragment>
      {/* Import/Export Buttons - Fixed Size */}
      <div className="flex gap-2">
        <button
          onClick={() => setImportModalOpen(true)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 flex items-center gap-2 transition-colors text-sm"
        >
          <Upload className="h-4 w-4" />
          Import
        </button>
        
        <button
          onClick={() => setExportModalOpen(true)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 flex items-center gap-2 transition-colors text-sm"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
        
        <button
          onClick={onUploadToDrone}
          disabled={!isControlEnabled}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm ${
            isControlEnabled 
              ? 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300'
              : 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Save className="h-4 w-4" />
          Upload to Drone
        </button>
      </div>

      {/* Import Modal - Complete Version */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 w-full max-w-2xl max-h-[80vh] overflow-y-auto mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-400" />
                Import Parameters
              </h3>
              <button
                onClick={() => {
                  setImportModalOpen(false);
                  setSelectedFile(null);
                  setValidationResult(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* File Selection */}
              <div>
                <label className="block text-sm text-gray-300 mb-3">
                  Select Parameter File (.txt or .parm)
                </label>
                <input
                  type="file"
                  accept=".txt,.parm"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-500/20 file:text-blue-300 hover:file:bg-blue-500/30 file:cursor-pointer"
                />
              </div>

              {/* File Info & Validation */}
              {selectedFile && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">{selectedFile.name}</span>
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                      {selectedFile.format.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    Parameters found: <span className="text-white">{selectedFile.parameterCount}</span>
                  </div>

                  {/* Validation Results */}
                  {validationResult && (
                    <div className="mt-3 space-y-2">
                      {validationResult.isValid ? (
                        <div className="flex items-center gap-2 text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">File validation passed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-400">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">Validation failed</span>
                        </div>
                      )}

                      {validationResult.errors.length > 0 && (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                          <div className="text-sm font-medium text-red-300 mb-2">Errors:</div>
                          {validationResult.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-400">• {error}</div>
                          ))}
                        </div>
                      )}

                      {validationResult.warnings.length > 0 && (
                        <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                          <div className="text-sm font-medium text-amber-300 mb-2">Warnings:</div>
                          {validationResult.warnings.map((warning, index) => (
                            <div key={index} className="text-sm text-amber-400">• {warning}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Import Options */}
              {selectedFile && validationResult?.isValid && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm font-medium text-gray-300 mb-4">Import Options</h4>
                  
                  <div className="space-y-4">
                    {/* Category Selection */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Import specific categories (leave empty for all):
                      </label>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                        {availableCategories.map(category => (
                          <label key={category} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={importOptions.categories.includes(category)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setImportOptions(prev => ({
                                    ...prev,
                                    categories: [...prev.categories, category]
                                  }));
                                } else {
                                  setImportOptions(prev => ({
                                    ...prev,
                                    categories: prev.categories.filter(c => c !== category)
                                  }));
                                }
                              }}
                              className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500"
                            />
                            <span className="text-gray-300">{category}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Replace Existing */}
                    <label className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={importOptions.replaceExisting}
                        onChange={(e) => setImportOptions(prev => ({
                          ...prev,
                          replaceExisting: e.target.checked
                        }))}
                        className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500"
                      />
                      <span className="text-gray-300">Replace existing parameter values</span>
                    </label>

                    {/* Validate Ranges */}
                    <label className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={importOptions.validateRanges}
                        onChange={(e) => setImportOptions(prev => ({
                          ...prev,
                          validateRanges: e.target.checked
                        }))}
                        className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500"
                      />
                      <span className="text-gray-300">Validate parameter ranges</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setImportModalOpen(false);
                    setSelectedFile(null);
                    setValidationResult(null);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selectedFile || !validationResult?.isValid || isProcessing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProcessing ? (
                    <React.Fragment>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Importing...
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <Upload className="h-4 w-4" />
                      Import Parameters
                    </React.Fragment>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal - Complete Version */}
      {exportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-400" />
                Export Parameters
              </h3>
              <button
                onClick={() => setExportModalOpen(false)}
                className="text-gray-400 hover:text-white"
                disabled={isExporting}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 160px)' }}>
              {/* Export Format */}
              <div>
                <label className="block text-sm text-gray-300 mb-3">Export Format</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="format"
                      value="txt"
                      checked={exportOptions.format === 'txt'}
                      onChange={(e) => setExportOptions(prev => ({
                        ...prev,
                        format: e.target.value as 'txt' | 'parm'
                      }))}
                      className="mr-2"
                      disabled={isExporting}
                    />
                    <span className="text-gray-300">.txt (Mission Planner)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="format"
                      value="parm"
                      checked={exportOptions.format === 'parm'}
                      onChange={(e) => setExportOptions(prev => ({
                        ...prev,
                        format: e.target.value as 'txt' | 'parm'
                      }))}
                      className="mr-2"
                      disabled={isExporting}
                    />
                    <span className="text-gray-300">.parm (ArduPilot)</span>
                  </label>
                </div>
              </div>

              {/* Category Selection */}
              <div className="mt-6">
                <label className="block text-sm text-gray-300 mb-3">
                  Categories to Export (leave empty for all):
                </label>
                <div className="max-h-32 overflow-y-auto bg-gray-800/30 p-3 rounded-lg space-y-2">
                  {availableCategories.map(category => (
                    <label key={category} className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={exportOptions.categories?.includes(category) || false}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExportOptions(prev => ({
                              ...prev,
                              categories: [...(prev.categories || []), category]
                            }));
                          } else {
                            setExportOptions(prev => ({
                              ...prev,
                              categories: (prev.categories || []).filter(c => c !== category)
                            }));
                          }
                        }}
                        className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500"
                        disabled={isExporting}
                      />
                      <span className="text-gray-300">{category}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Modified Only */}
              <div className="mt-6">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={exportOptions.modifiedOnly || false}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      modifiedOnly: e.target.checked
                    }))}
                    className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500"
                    disabled={isExporting}
                  />
                  <span className="text-gray-300">Export only modified parameters</span>
                </label>
              </div>
            </div>

            {/* Action Buttons - Fixed at Bottom */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800 bg-gray-900">
              <button
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExporting ? (
                  <React.Fragment>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Exporting...
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <Download className="h-4 w-4" />
                    Export as {exportOptions.format.toUpperCase()}
                  </React.Fragment>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
};

export default ImportExport;