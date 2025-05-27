// components/DroneControl/ParameterManager/index.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { 
  Settings, Search, Upload, Download, ChevronDown, ChevronRight,
  FileText, Filter, RefreshCw, AlertTriangle, CheckCircle, X, Save
} from 'lucide-react';

// Types
interface Parameter {
  name: string;
  value: string | number;
  description?: string;
  unit?: string;
  range?: [number, number];
  default?: string | number;
  modified?: boolean;
}

interface ParameterSubcategory {
  name: string;
  description: string;
  parameters: Parameter[];
  expanded?: boolean;
}

interface ParameterCategory {
  name: string;
  description: string;
  subcategories: ParameterSubcategory[];
  expanded?: boolean;
}

// Props interface to match drone control pattern
interface ParameterManagerProps {
  droneId: string;
  isControlEnabled: boolean;
}

const ParameterManager: React.FC<ParameterManagerProps> = ({ droneId, isControlEnabled }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Mock parameter data - will be replaced with actual data from Google AI Studio
  const [parameterData, setParameterData] = useState<ParameterCategory[]>([
    {
      name: "Flight Control & Navigation",
      description: "Core flight control, PIDs, and navigation systems",
      expanded: false,
      subcategories: [
        {
          name: "Attitude Control (PIDs)",
          description: "Roll, Pitch, Yaw rate and angle control parameters",
          expanded: false,
          parameters: [
            { name: "ATC_RAT_PIT_P", value: 0.135, description: "Pitch rate controller P gain", range: [0, 1], default: 0.135 },
            { name: "ATC_RAT_PIT_I", value: 0.135, description: "Pitch rate controller I gain", range: [0, 1], default: 0.135 },
            { name: "ATC_RAT_PIT_D", value: 0.0036, description: "Pitch rate controller D gain", range: [0, 0.01], default: 0.0036 },
            { name: "ATC_RAT_RLL_P", value: 0.135, description: "Roll rate controller P gain", range: [0, 1], default: 0.135 },
            { name: "ATC_RAT_RLL_I", value: 0.135, description: "Roll rate controller I gain", range: [0, 1], default: 0.135 },
            { name: "ATC_RAT_RLL_D", value: 0.0036, description: "Roll rate controller D gain", range: [0, 0.01], default: 0.0036 },
          ]
        },
        {
          name: "Position Control",
          description: "Horizontal and vertical position control parameters",
          expanded: false,
          parameters: [
            { name: "PSC_POSXY_P", value: 1, description: "Position control P gain", range: [0, 5], default: 1 },
            { name: "PSC_VELXY_P", value: 2, description: "Velocity control P gain", range: [0, 10], default: 2 },
            { name: "PSC_VELXY_I", value: 1, description: "Velocity control I gain", range: [0, 5], default: 1 },
          ]
        }
      ]
    },
    {
      name: "Sensors & Estimation", 
      description: "IMU, GPS, compass and sensor fusion parameters",
      expanded: false,
      subcategories: [
        {
          name: "GPS / GNSS",
          description: "GPS configuration and positioning parameters",
          expanded: false,
          parameters: [
            { name: "GPS_TYPE", value: 1, description: "GPS receiver type", range: [0, 5], default: 1 },
            { name: "GPS_AUTO_SWITCH", value: 1, description: "Auto switch between GPS receivers", range: [0, 1], default: 1 },
            { name: "GPS_HDOP_GOOD", value: 140, description: "GPS HDOP threshold for good fix", range: [100, 900], default: 140 },
          ]
        },
        {
          name: "IMU (Accelerometer & Gyroscope)",
          description: "Inertial measurement unit configuration",
          expanded: false,
          parameters: [
            { name: "INS_GYRO_FILTER", value: 20, description: "Gyro filter frequency", range: [0, 256], default: 20 },
            { name: "INS_ACCEL_FILTER", value: 20, description: "Accel filter frequency", range: [0, 256], default: 20 },
          ]
        }
      ]
    },
    {
      name: "Safety & Failsafe",
      description: "Arming checks, failsafe configuration, and geofencing", 
      expanded: false,
      subcategories: [
        {
          name: "Arming Checks",
          description: "Pre-flight safety checks and arming configuration",
          expanded: false,
          parameters: [
            { name: "ARMING_CHECK", value: 1, description: "Bitmask of arming checks", range: [0, 65535], default: 1 },
            { name: "ARMING_ACCTHRESH", value: 0.75, description: "Accelerometer error threshold", range: [0.25, 3], default: 0.75 },
          ]
        }
      ]
    }
  ]);

  // Filter parameters based on search
  const filteredData = useMemo(() => {
    if (!searchQuery) return parameterData;
    
    return parameterData.map(category => ({
      ...category,
      subcategories: category.subcategories.map(subcategory => ({
        ...subcategory,
        parameters: subcategory.parameters.filter(param => 
          param.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          param.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(subcategory => subcategory.parameters.length > 0)
    })).filter(category => category.subcategories.length > 0);
  }, [parameterData, searchQuery]);

  // Toggle category expansion
  const toggleCategory = useCallback((categoryIndex: number) => {
    setParameterData(prev => prev.map((cat, i) => 
      i === categoryIndex ? { ...cat, expanded: !cat.expanded } : cat
    ));
  }, []);

  // Toggle subcategory expansion
  const toggleSubcategory = useCallback((categoryIndex: number, subcategoryIndex: number) => {
    setParameterData(prev => prev.map((cat, i) => 
      i === categoryIndex ? {
        ...cat,
        subcategories: cat.subcategories.map((sub, j) => 
          j === subcategoryIndex ? { ...sub, expanded: !sub.expanded } : sub
        )
      } : cat
    ));
  }, []);

  // Update parameter value
  const updateParameter = useCallback((categoryIndex: number, subcategoryIndex: number, paramIndex: number, newValue: string | number) => {
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
    setHasUnsavedChanges(true);
  }, []);

  // File import handler
  const handleFileImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      // Parse parameter file and update values
      // This will be implemented with actual parameter parsing logic
      console.log('Importing parameter file:', content.substring(0, 100) + '...');
      setNotification({ type: 'success', message: `Imported ${file.name} successfully` });
      setTimeout(() => setNotification(null), 3000);
    };
    reader.readAsText(file);
    setImportModalOpen(false);
  }, []);

  // Export parameters
  const exportParameters = useCallback((format: 'txt' | 'parm') => {
    const paramString = parameterData
      .flatMap(cat => cat.subcategories)
      .flatMap(sub => sub.parameters)
      .map(param => `${param.name},${param.value}`)
      .join('\n');
    
    const blob = new Blob([paramString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${droneId}_parameters.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    
    setNotification({ type: 'success', message: `Parameters exported as ${format.toUpperCase()}` });
    setTimeout(() => setNotification(null), 3000);
  }, [parameterData, droneId]);

  // Upload to drone (placeholder)
  const uploadToDrone = useCallback(() => {
    if (!isControlEnabled) {
      setNotification({ type: 'error', message: 'Control not enabled - cannot upload parameters' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    // This will integrate with MAVROS later
    console.log('Upload to drone:', droneId);
    setNotification({ type: 'success', message: 'Parameter upload initiated (placeholder)' });
    setTimeout(() => setNotification(null), 3000);
  }, [droneId, isControlEnabled]);

  return (
    <div className="space-y-6">
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
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search parameters by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setImportModalOpen(true)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 flex items-center gap-2 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
            
            <button
              onClick={() => exportParameters('txt')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 flex items-center gap-2 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            
            <button
              onClick={uploadToDrone}
              disabled={!isControlEnabled}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                isControlEnabled 
                  ? 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300'
                  : 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save className="h-4 w-4" />
              Upload to Drone
            </button>
          </div>
        </div>

        {/* Unsaved changes warning */}
        {hasUnsavedChanges && (
          <div className="mt-4 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">You have unsaved parameter changes</span>
          </div>
        )}
      </div>

      {/* Parameter Tree */}
      <div className="bg-gray-900/80 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
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

        <div className="max-h-[600px] overflow-y-auto">
          {filteredData.map((category, categoryIndex) => (
            <div key={category.name} className="border-b border-gray-800 last:border-b-0">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(categoryIndex)}
                className="w-full p-4 text-left hover:bg-gray-800/50 flex items-center justify-between transition-colors"
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
                <div className="text-xs text-gray-500">
                  {category.subcategories.length} sections
                </div>
              </button>

              {/* Subcategories */}
              {category.expanded && (
                <div className="bg-gray-800/30">
                  {category.subcategories.map((subcategory, subcategoryIndex) => (
                    <div key={subcategory.name}>
                      {/* Subcategory Header */}
                      <button
                        onClick={() => toggleSubcategory(categoryIndex, subcategoryIndex)}
                        className="w-full p-3 pl-8 text-left hover:bg-gray-800/50 flex items-center justify-between transition-colors border-t border-gray-800/50"
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
                          {subcategory.parameters.map((parameter, paramIndex) => (
                            <div
                              key={parameter.name}
                              className={`p-3 pl-12 border-t border-gray-800/30 flex items-center justify-between hover:bg-gray-800/30 transition-colors ${
                                parameter.modified ? 'bg-amber-900/10 border-l-2 border-l-amber-500' : ''
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-mono text-white">{parameter.name}</span>
                                  {parameter.modified && (
                                    <span className="text-xs bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded">MODIFIED</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400 mt-1 truncate">{parameter.description}</div>
                                {parameter.range && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Range: {parameter.range[0]} - {parameter.range[1]}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 ml-4">
                                <input
                                  type="number"
                                  value={parameter.value}
                                  onChange={(e) => updateParameter(categoryIndex, subcategoryIndex, paramIndex, parseFloat(e.target.value) || 0)}
                                  disabled={!isControlEnabled}
                                  className={`w-24 px-2 py-1 text-sm bg-gray-800 border rounded text-white ${
                                    !isControlEnabled 
                                      ? 'border-gray-700 cursor-not-allowed opacity-50'
                                      : 'border-gray-600 hover:border-gray-500 focus:border-blue-500 focus:outline-none'
                                  }`}
                                  step="any"
                                />
                                <button
                                  onClick={() => updateParameter(categoryIndex, subcategoryIndex, paramIndex, parameter.default || 0)}
                                  disabled={!isControlEnabled}
                                  className="text-xs text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Reset to default"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">Import Parameters</h3>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Select Parameter File (.txt or .parm)
                </label>
                <input
                  type="file"
                  accept=".txt,.parm"
                  onChange={handleFileImport}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-500/20 file:text-blue-300 hover:file:bg-blue-500/30 file:cursor-pointer"
                />
              </div>
              
              <div className="text-xs text-gray-500">
                <p>• Upload .txt or .parm parameter files</p>
                <p>• Only matching parameters will be imported</p>
                <p>• You can select specific categories to import</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg border backdrop-blur-sm z-50 flex items-center gap-2 ${
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
