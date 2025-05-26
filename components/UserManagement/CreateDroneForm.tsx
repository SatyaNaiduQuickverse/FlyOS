// components/UserManagement/CreateDroneForm.tsx - Create Drone Form Component
import React, { useState } from 'react';
import { Plane as Drone, Save, X } from 'lucide-react';
import { UserRole } from '../../types/auth';
import { CreateDroneFormProps, DroneFormState } from './types';

const CreateDroneForm: React.FC<CreateDroneFormProps> = ({
  regions,
  users,
  onCreateDrone,
  onCancel,
  isLoading
}) => {
  const [formState, setFormState] = useState<DroneFormState>({
    id: `drone-${String(Math.floor(Math.random() * 900) + 100)}`,
    model: 'FlyOS-MQ7',
    status: 'STANDBY',
    regionId: null,
    operatorId: null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get operators filtered by selected region
  const availableOperators = users.filter(user => 
    user.role === UserRole.OPERATOR && 
    user.status === 'ACTIVE' &&
    (formState.regionId ? user.regionId === formState.regionId : true)
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormState(prev => ({
      ...prev,
      [name]: value === "" ? null : value
    }));
    
    // Clear region-dependent operator selection when region changes
    if (name === 'regionId') {
      setFormState(prev => ({
        ...prev,
        regionId: value === "" ? null : value,
        operatorId: null // Reset operator when region changes
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formState.id.trim()) {
      newErrors.id = 'Drone ID is required';
    } else if (formState.id.length < 3) {
      newErrors.id = 'Drone ID must be at least 3 characters';
    }

    if (!formState.model) {
      newErrors.model = 'Please select a drone model';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const droneData = {
      id: formState.id,
      model: formState.model,
      status: formState.status,
      regionId: formState.regionId,
      operatorId: formState.operatorId,
    };

    onCreateDrone(droneData);
  };

  const getStatusDescription = (status: string): string => {
    switch(status) {
      case 'ACTIVE':
        return 'Drone is operational and ready for missions';
      case 'STANDBY':
        return 'Drone is ready but not currently assigned';
      case 'MAINTENANCE':
        return 'Drone is undergoing maintenance or repairs';
      case 'OFFLINE':
        return 'Drone is not available or powered down';
      default:
        return '';
    }
  };

  return (
    <div className="p-6">
      <div className="bg-gradient-to-b from-gray-900/80 to-black/80 rounded-lg border border-gray-800 p-6 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-light tracking-wider text-blue-300 flex items-center gap-3">
            <Drone className="h-6 w-6 text-blue-400" />
            Create New Drone
          </h3>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Drone ID */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                DRONE ID*
              </label>
              <input
                type="text"
                name="id"
                value={formState.id}
                onChange={handleInputChange}
                className={`bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border transition-all backdrop-blur-sm ${
                  errors.id 
                    ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20' 
                    : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
                placeholder="Enter unique drone ID (e.g., drone-001)"
                required
              />
              {errors.id && (
                <p className="text-red-400 text-xs mt-1">{errors.id}</p>
              )}
              <p className="text-xs text-gray-500">This ID will be used to identify the drone in the system</p>
            </div>
            
            {/* Model */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                DRONE MODEL*
              </label>
              <select
                name="model"
                value={formState.model}
                onChange={handleInputChange}
                className={`bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border transition-all backdrop-blur-sm ${
                  errors.model 
                    ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20' 
                    : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
                required
              >
                <option value="FlyOS-MQ5">FlyOS-MQ5 (Light Reconnaissance)</option>
                <option value="FlyOS-MQ7">FlyOS-MQ7 (Medium Multi-Role)</option>
                <option value="FlyOS-MQ9">FlyOS-MQ9 (Heavy Long-Range)</option>
              </select>
              {errors.model && (
                <p className="text-red-400 text-xs mt-1">{errors.model}</p>
              )}
            </div>
            
            {/* Status */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                INITIAL STATUS
              </label>
              <select
                name="status"
                value={formState.status}
                onChange={handleInputChange}
                className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
              >
                <option value="STANDBY">Standby</option>
                <option value="ACTIVE">Active</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="OFFLINE">Offline</option>
              </select>
              <p className="text-xs text-gray-500">{getStatusDescription(formState.status)}</p>
            </div>
            
            {/* Region */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                ASSIGNED REGION
              </label>
              <select
                name="regionId"
                value={formState.regionId || ""}
                onChange={handleInputChange}
                className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
              >
                <option value="">Unassigned</option>
                {regions.filter(r => r.status === 'ACTIVE').map(region => (
                  <option key={region.id} value={region.id}>
                    {region.name} - {region.area}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                {formState.regionId 
                  ? `This drone will be deployed to ${regions.find(r => r.id === formState.regionId)?.name}`
                  : 'Drone can be assigned to any region later'
                }
              </p>
            </div>
            
            {/* Operator */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                ASSIGNED OPERATOR
              </label>
              <select
                name="operatorId"
                value={formState.operatorId || ""}
                onChange={handleInputChange}
                className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg px-4 py-3 text-white w-full border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                disabled={!formState.regionId}
              >
                <option value="">Unassigned</option>
                {availableOperators.map(operator => (
                  <option key={operator.id} value={operator.id}>
                    {operator.fullName} (@{operator.username}) - {regions.find(r => r.id === operator.regionId)?.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                {!formState.regionId 
                  ? 'Select a region first to see available operators'
                  : availableOperators.length === 0 
                    ? 'No operators available in selected region'
                    : `${availableOperators.length} operator(s) available in ${regions.find(r => r.id === formState.regionId)?.name}`
                }
              </p>
            </div>
          </div>

          {/* Drone Specifications Preview */}
          <div className="mt-8 p-4 bg-gradient-to-r from-blue-900/10 to-indigo-900/10 rounded-lg border border-blue-500/20">
            <h4 className="text-sm font-medium text-blue-300 mb-3 tracking-wider">DRONE SPECIFICATIONS PREVIEW</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Model:</span>
                <div className="text-white mt-1">{formState.model}</div>
              </div>
              <div>
                <span className="text-gray-400">Max Range:</span>
                <div className="text-white mt-1">
                  {formState.model === 'FlyOS-MQ5' ? '50 km' : 
                   formState.model === 'FlyOS-MQ7' ? '100 km' : '200 km'}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Flight Time:</span>
                <div className="text-white mt-1">
                  {formState.model === 'FlyOS-MQ5' ? '8 hours' : 
                   formState.model === 'FlyOS-MQ7' ? '12 hours' : '24 hours'}
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-lg border border-gray-600 hover:from-gray-600 hover:to-gray-700 transition-all tracking-wider font-light"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed tracking-wider font-light"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              Create Drone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDroneForm;
