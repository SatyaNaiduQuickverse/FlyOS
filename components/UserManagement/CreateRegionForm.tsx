// components/UserManagement/CreateRegionForm.tsx - Fixed Dropdown Styling
import React, { useState, useEffect } from 'react';
import { Globe, Save, X, MapPin } from 'lucide-react';
import { UserRole } from '../../types/auth';
import { CreateRegionFormProps, RegionFormState } from './types';

const CreateRegionForm: React.FC<CreateRegionFormProps> = ({
  editingRegion,
  users,
  onCreateRegion,
  onUpdateRegion,
  onCancel,
  isLoading
}) => {
  const [formState, setFormState] = useState<RegionFormState>({
    id: `region-${String(Math.floor(Math.random() * 900) + 100)}`,
    name: '',
    area: '',
    commanderName: '',
    status: 'ACTIVE',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with editing region data
  useEffect(() => {
    if (editingRegion) {
      setFormState({
        id: editingRegion.id,
        name: editingRegion.name,
        area: editingRegion.area,
        commanderName: editingRegion.commanderName || '',
        status: editingRegion.status,
      });
    } else {
      setFormState({
        id: `region-${String(Math.floor(Math.random() * 900) + 100)}`,
        name: '',
        area: '',
        commanderName: '',
        status: 'ACTIVE',
      });
    }
  }, [editingRegion]);

  // Get available commanders (regional HQ users not assigned to other regions)
  const availableCommanders = users.filter(user => 
    user.role === UserRole.REGIONAL_HQ && 
    user.status === 'ACTIVE' &&
    (editingRegion ? (user.regionId === editingRegion.id || !user.regionId) : !user.regionId)
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));
    
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

    if (!formState.name.trim()) {
      newErrors.name = 'Region name is required';
    } else if (formState.name.length < 3) {
      newErrors.name = 'Region name must be at least 3 characters';
    }

    if (!formState.area.trim()) {
      newErrors.area = 'Area description is required';
    } else if (formState.area.length < 5) {
      newErrors.area = 'Area description must be at least 5 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const regionData = {
      id: formState.id,
      name: formState.name,
      area: formState.area,
      commanderName: formState.commanderName || null,
      status: formState.status,
    };

    if (editingRegion) {
      onUpdateRegion(regionData);
    } else {
      onCreateRegion(regionData);
    }
  };

  const getStatusDescription = (status: string): string => {
    switch(status) {
      case 'ACTIVE':
        return 'Region is operational and can be assigned users and drones';
      case 'INACTIVE':
        return 'Region is disabled and hidden from assignment dropdowns';
      default:
        return '';
    }
  };

  // Fixed dropdown styles
  const selectStyles = {
    backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")",
    backgroundPosition: 'right 0.5rem center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1.5em 1.5em'
  };

  return (
    <div className="p-6">
      <div className="bg-gradient-to-b from-gray-900/80 to-black/80 rounded-lg border border-gray-800 p-6 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-light tracking-wider text-blue-300 flex items-center gap-3">
            <Globe className="h-6 w-6 text-blue-400" />
            {editingRegion ? 'Edit Region' : 'Create New Region'}
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
            {/* Region ID (Read-only for editing) */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                REGION ID*
              </label>
              <input
                type="text"
                name="id"
                value={formState.id}
                readOnly={!!editingRegion}
                className={`bg-gray-800 rounded-lg px-4 py-3 text-white w-full border transition-all backdrop-blur-sm ${
                  editingRegion 
                    ? 'border-gray-600 bg-gray-700/50 cursor-not-allowed' 
                    : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
                placeholder="Auto-generated region ID"
              />
              <p className="text-xs text-gray-500">
                {editingRegion ? 'Region ID cannot be changed' : 'This ID will be used to identify the region in the system'}
              </p>
            </div>
            
            {/* Region Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                REGION NAME*
              </label>
              <input
                type="text"
                name="name"
                value={formState.name}
                onChange={handleInputChange}
                className={`bg-gray-800 rounded-lg px-4 py-3 text-white w-full border transition-all backdrop-blur-sm ${
                  errors.name 
                    ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20' 
                    : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
                placeholder="Enter region name (e.g., Eastern Region)"
                required
              />
              {errors.name && (
                <p className="text-red-400 text-xs mt-1">{errors.name}</p>
              )}
            </div>
            
            {/* Area Description */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                AREA DESCRIPTION*
              </label>
              <input
                type="text"
                name="area"
                value={formState.area}
                onChange={handleInputChange}
                className={`bg-gray-800 rounded-lg px-4 py-3 text-white w-full border transition-all backdrop-blur-sm ${
                  errors.area 
                    ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20' 
                    : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
                placeholder="Enter area description (e.g., Eastern Seaboard, Pacific Coast)"
                required
              />
              {errors.area && (
                <p className="text-red-400 text-xs mt-1">{errors.area}</p>
              )}
              <p className="text-xs text-gray-500">Describe the geographical area this region covers</p>
            </div>
            
            {/* Commander Assignment */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                REGIONAL COMMANDER
              </label>
              <select
                name="commanderName"
                value={formState.commanderName}
                onChange={handleInputChange}
                className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 w-full focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer pr-10"
                style={selectStyles}
              >
                <option value="">Select a commander (optional)</option>
                {availableCommanders.map(commander => (
                  <option key={commander.id} value={commander.fullName}>
                    {commander.fullName} (@{commander.username})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                {availableCommanders.length === 0 
                  ? 'No unassigned regional commanders available'
                  : `${availableCommanders.length} commander(s) available for assignment`
                }
              </p>
            </div>
            
            {/* Status */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                STATUS
              </label>
              <select
                name="status"
                value={formState.status}
                onChange={handleInputChange}
                className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 w-full focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer pr-10"
                style={selectStyles}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <p className="text-xs text-gray-500">{getStatusDescription(formState.status)}</p>
            </div>
          </div>

          {/* Region Preview */}
          <div className="mt-8 p-4 bg-gradient-to-r from-blue-900/10 to-indigo-900/10 rounded-lg border border-blue-500/20">
            <h4 className="text-sm font-medium text-blue-300 mb-3 tracking-wider flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              REGION PREVIEW
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Region:</span>
                <div className="text-white mt-1">{formState.name || 'Not specified'}</div>
              </div>
              <div>
                <span className="text-gray-400">Area:</span>
                <div className="text-white mt-1">{formState.area || 'Not specified'}</div>
              </div>
              <div>
                <span className="text-gray-400">Commander:</span>
                <div className="text-white mt-1">{formState.commanderName || 'Unassigned'}</div>
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
              {editingRegion ? 'Update Region' : 'Create Region'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRegionForm;