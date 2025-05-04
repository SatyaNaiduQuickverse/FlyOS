// components/DroneControl/DroneSettings.tsx
import React, { useState, ChangeEvent } from 'react';
import { Settings, Save, RefreshCw, Shield, AlertTriangle, Clock, Bluetooth, Wifi, Globe } from 'lucide-react';

interface DroneSettingsProps {
  isControlEnabled: boolean;
}

const DroneSettings: React.FC<DroneSettingsProps> = ({ isControlEnabled }) => {
  const [settings, setSettings] = useState({
    maxAltitude: 2000,
    maxSpeed: 120,
    returnToHomeAltitude: 100,
    geoFencingEnabled: true,
    geoFenceRadius: 5000,
    lowBatteryThreshold: 20,
    cameraQuality: 'high',
    transmissionPower: 'medium',
    autoCalibrateOnStartup: true,
    telemetryRate: 'normal',
    obstacleAvoidance: true,
    nightModeEnabled: false,
  });
  
  const [pendingChanges, setPendingChanges] = useState(false);
  
  // Create separate handlers for different input types
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
    setPendingChanges(true);
  };
  
  // Separate handler for checkboxes
  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: checked
    }));
    setPendingChanges(true);
  };
  
  const handleSaveSettings = () => {
    // This would be replaced with an actual API call
    console.log('Saving settings:', settings);
    
    // Simulate saving
    setTimeout(() => {
      setPendingChanges(false);
    }, 800);
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-light tracking-wider text-blue-300">DRONE SETTINGS</h3>
          </div>
          
          <div className="flex items-center gap-3">
            {pendingChanges && (
              <span className="text-amber-300 text-sm flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Unsaved changes
              </span>
            )}
            
            <button
              className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
              onClick={() => {
                // Reset to initial settings
                setSettings({
                  maxAltitude: 2000,
                  maxSpeed: 120,
                  returnToHomeAltitude: 100,
                  geoFencingEnabled: true,
                  geoFenceRadius: 5000,
                  lowBatteryThreshold: 20,
                  cameraQuality: 'high',
                  transmissionPower: 'medium',
                  autoCalibrateOnStartup: true,
                  telemetryRate: 'normal',
                  obstacleAvoidance: true,
                  nightModeEnabled: false,
                });
                setPendingChanges(true);
              }}
              disabled={!isControlEnabled}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            
            <button
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
                pendingChanges 
                  ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30' 
                  : 'bg-gray-800 border border-gray-700 text-gray-500'
              } ${!isControlEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handleSaveSettings}
              disabled={!pendingChanges || !isControlEnabled}
            >
              <Save className="h-4 w-4" />
              <span>Save Settings</span>
            </button>
          </div>
        </div>
        
        {/* Settings Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Flight Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-blue-300 flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4" />
              FLIGHT SETTINGS
            </h4>
            
            <div className="space-y-1">
              <label className="block text-sm text-gray-400">Maximum Altitude (meters)</label>
              <input 
                type="number"
                name="maxAltitude"
                value={settings.maxAltitude}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                disabled={!isControlEnabled}
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-sm text-gray-400">Maximum Speed (km/h)</label>
              <input 
                type="number"
                name="maxSpeed"
                value={settings.maxSpeed}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                disabled={!isControlEnabled}
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-sm text-gray-400">Return-to-Home Altitude (meters)</label>
              <input 
                type="number"
                name="returnToHomeAltitude"
                value={settings.returnToHomeAltitude}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                disabled={!isControlEnabled}
              />
            </div>
            
            <div className="flex items-start gap-2">
              <input 
                type="checkbox"
                id="geoFencingEnabled"
                name="geoFencingEnabled"
                checked={settings.geoFencingEnabled}
                onChange={handleCheckboxChange}
                className="mt-1 bg-gray-800 border border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                disabled={!isControlEnabled}
              />
              <div>
                <label htmlFor="geoFencingEnabled" className="block text-sm text-white">Enable Geo-Fencing</label>
                <p className="text-xs text-gray-400">Restrict drone movement to a defined area</p>
              </div>
            </div>
            
            {settings.geoFencingEnabled && (
              <div className="space-y-1 ml-6">
                <label className="block text-sm text-gray-400">Geo-Fence Radius (meters)</label>
                <input 
                  type="number"
                  name="geoFenceRadius"
                  value={settings.geoFenceRadius}
                  onChange={handleInputChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  disabled={!isControlEnabled}
                />
              </div>
            )}
            
            <div className="space-y-1">
              <label className="block text-sm text-gray-400">Low Battery Threshold (%)</label>
              <input 
                type="number"
                name="lowBatteryThreshold"
                value={settings.lowBatteryThreshold}
                onChange={handleInputChange}
                min="10"
                max="30"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                disabled={!isControlEnabled}
              />
              <p className="text-xs text-gray-500">Drone will return to home when battery reaches this level</p>
            </div>
          </div>
          
          {/* System Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-blue-300 flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4" />
              SYSTEM SETTINGS
            </h4>
            
            <div className="space-y-1">
              <label className="block text-sm text-gray-400">Camera Quality</label>
              <select
                name="cameraQuality"
                value={settings.cameraQuality}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                disabled={!isControlEnabled}
              >
                <option value="low">Low (720p)</option>
                <option value="medium">Medium (1080p)</option>
                <option value="high">High (4K)</option>
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="block text-sm text-gray-400">Transmission Power</label>
              <select
                name="transmissionPower"
                value={settings.transmissionPower}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                disabled={!isControlEnabled}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <p className="text-xs text-gray-500">Higher settings increase range but reduce battery life</p>
            </div>
            
            <div className="space-y-1">
              <label className="block text-sm text-gray-400">Telemetry Update Rate</label>
              <select
                name="telemetryRate"
                value={settings.telemetryRate}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                disabled={!isControlEnabled}
              >
                <option value="low">Low (1 Hz)</option>
                <option value="normal">Normal (5 Hz)</option>
                <option value="high">High (10 Hz)</option>
              </select>
            </div>
            
            <div className="flex items-start gap-2">
              <input 
                type="checkbox"
                id="autoCalibrateOnStartup"
                name="autoCalibrateOnStartup"
                checked={settings.autoCalibrateOnStartup}
                onChange={handleCheckboxChange}
                className="mt-1 bg-gray-800 border border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                disabled={!isControlEnabled}
              />
              <div>
                <label htmlFor="autoCalibrateOnStartup" className="block text-sm text-white">Auto-Calibrate on Startup</label>
                <p className="text-xs text-gray-400">Performs sensor calibration automatically</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <input 
                type="checkbox"
                id="obstacleAvoidance"
                name="obstacleAvoidance"
                checked={settings.obstacleAvoidance}
                onChange={handleCheckboxChange}
                className="mt-1 bg-gray-800 border border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                disabled={!isControlEnabled}
              />
              <div>
                <label htmlFor="obstacleAvoidance" className="block text-sm text-white">Obstacle Avoidance</label>
                <p className="text-xs text-gray-400">Use sensors to avoid collisions</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <input 
                type="checkbox"
                id="nightModeEnabled"
                name="nightModeEnabled"
                checked={settings.nightModeEnabled}
                onChange={handleCheckboxChange}
                className="mt-1 bg-gray-800 border border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                disabled={!isControlEnabled}
              />
              <div>
                <label htmlFor="nightModeEnabled" className="block text-sm text-white">Night Mode</label>
                <p className="text-xs text-gray-400">Optimizes sensors and lighting for night operations</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Connectivity Status */}
      <div className="bg-gray-900/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-800">
        <h4 className="text-sm font-medium text-blue-300 flex items-center gap-2 mb-4">
          <Wifi className="h-4 w-4" />
          CONNECTIVITY STATUS
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/80 p-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-300">Network Connection</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-sm text-green-300">Connected</span>
            </div>
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bluetooth className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-300">Bluetooth Backup</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <span className="text-sm text-blue-300">Ready</span>
            </div>
          </div>
          
          <div className="bg-gray-800/80 p-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-300">Last Synchronized</span>
            </div>
            <span className="text-sm text-white">5 minutes ago</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DroneSettings;