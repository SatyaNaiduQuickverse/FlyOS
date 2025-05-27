// components/DroneControl/ParameterManager/ImportExport.tsx
import React, { useState, useCallback } from 'react';
import { Upload, Download, X, CheckCircle, AlertTriangle, FileText, Filter } from 'lucide-react';
import { ParameterCategory, ParameterFile, ImportOptions, ExportOptions, ValidationResult } from './types';

interface ImportExportProps {
  parameterData: ParameterCategory[];
  onImportParameters: (parameters: any[], options: ImportOptions) => void;
  onExportParameters: (options: ExportOptions) => void;
  droneId: string;
}

const ImportExport: React.FC<ImportExportProps> = ({
  parameterData,
  onImportParameters,
  onExportParameters,
  droneId
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

    // Additional validation would go here
    // - Check parameter names against known parameters
    // - Validate ranges
    // - Check for conflicts

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
      onImportParameters(parameters, importOptions);
      setIsProcessing(false);
      setImportModalOpen(false);
      setSelectedFile(null);
      setValidationResult(null);
    }, 1000);
  }, [selectedFile, validationResult, importOptions, onImportParameters]);

  // Handle export
  const handleExport = useCallback(() => {
    setIsProcessing(true);
    
    setTimeout(() => {
      onExportParameters(exportOptions);
      setIsProcessing(false);
      setExportModalOpen(false);
    }, 500);
  }, [exportOptions, onExportParameters]);

  // Get available categories
  const availableCategories = parameterData.map(cat => cat.name);

  return (
    <>
      {/* Import/Export Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setImportModalOpen(true)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 flex items-center gap-2 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Import
        </button>
        
        <button
          onClick={() => setExportModalOpen(true)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 flex items-center gap-2 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
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
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import Parameters
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-400" />
                Export Parameters
              </h3>
              <button
                onClick={() => setExportModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Export Format */}
              <div>
                <label className="block text-sm text-gray-300 mb-3">Export Format</label>
                <div className="flex gap-3">
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
                    />
                    <span className="text-gray-300">.parm (ArduPilot)</span>
                  </label>
                </div>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm text-gray-300 mb-3">
                  Categories to Export (leave empty for all):
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto bg-gray-800/30 p-3 rounded-lg">
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
                      />
                      <span className="text-gray-300">{category}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Modified Only */}
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={exportOptions.modifiedOnly || false}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    modifiedOnly: e.target.checked
                  }))}
                  className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500"
                />
                <span className="text-gray-300">Export only modified parameters</span>
              </label>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setExportModalOpen(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Export as {exportOptions.format.toUpperCase()}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportExport;
