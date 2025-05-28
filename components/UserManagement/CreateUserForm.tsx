// components/UserManagement/CreateUserForm.tsx - Fixed Dropdown Styling
import React, { useState, useEffect } from 'react';
import { UserPlus, Save, X } from 'lucide-react';
import { UserRole } from '../../types/auth';
import { CreateUserFormProps, FormState } from './types';

const CreateUserForm: React.FC<CreateUserFormProps> = ({
  editingUser,
  regions,
  onCreateUser,
  onUpdateUser,
  onCancel,
  isLoading
}) => {
  const [formState, setFormState] = useState<FormState>({
    id: `user-${String(Math.floor(Math.random() * 900) + 100)}`,
    username: '',
    fullName: '',
    email: '',
    role: UserRole.REGIONAL_HQ,
    regionId: '',
    password: '',
    confirmPassword: '',
    status: 'ACTIVE',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with editing user data
  useEffect(() => {
    if (editingUser) {
      setFormState({
        id: editingUser.id,
        username: editingUser.username,
        fullName: editingUser.fullName,
        email: editingUser.email,
        role: editingUser.role,
        regionId: editingUser.regionId || '',
        password: '',
        confirmPassword: '',
        status: editingUser.status,
      });
    } else {
      setFormState({
        id: `user-${String(Math.floor(Math.random() * 900) + 100)}`,
        username: '',
        fullName: '',
        email: '',
        role: UserRole.REGIONAL_HQ,
        regionId: '',
        password: '',
        confirmPassword: '',
        status: 'ACTIVE',
      });
    }
  }, [editingUser]);

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

    if (!formState.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formState.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formState.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formState.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formState.role === UserRole.REGIONAL_HQ && !formState.regionId) {
      newErrors.regionId = 'Please select a region for Regional Commander';
    }

    if (!editingUser) {
      if (!formState.password) {
        newErrors.password = 'Password is required';
      } else if (formState.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }

      if (formState.password !== formState.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const userData = {
      username: formState.username,
      fullName: formState.fullName,
      email: formState.email,
      role: formState.role,
      regionId: formState.role === UserRole.REGIONAL_HQ ? formState.regionId : undefined,
      status: formState.status,
      ...((!editingUser && formState.password) && { password: formState.password })
    };

    if (editingUser) {
      onUpdateUser(userData);
    } else {
      onCreateUser(userData);
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
            <UserPlus className="h-6 w-6 text-blue-400" />
            {editingUser ? 'Edit User Account' : 'Create New User Account'}
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
            {/* Username */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                USERNAME*
              </label>
              <input
                type="text"
                name="username"
                value={formState.username}
                onChange={handleInputChange}
                className={`bg-gray-800 rounded-lg px-4 py-3 text-white w-full border transition-all backdrop-blur-sm ${
                  errors.username 
                    ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20' 
                    : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
                placeholder="Enter username"
                required
              />
              {errors.username && (
                <p className="text-red-400 text-xs mt-1">{errors.username}</p>
              )}
            </div>
            
            {/* Full Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                FULL NAME*
              </label>
              <input
                type="text"
                name="fullName"
                value={formState.fullName}
                onChange={handleInputChange}
                className={`bg-gray-800 rounded-lg px-4 py-3 text-white w-full border transition-all backdrop-blur-sm ${
                  errors.fullName 
                    ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20' 
                    : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
                placeholder="Enter full name"
                required
              />
              {errors.fullName && (
                <p className="text-red-400 text-xs mt-1">{errors.fullName}</p>
              )}
            </div>
            
            {/* Email */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                EMAIL ADDRESS*
              </label>
              <input
                type="email"
                name="email"
                value={formState.email}
                onChange={handleInputChange}
                className={`bg-gray-800 rounded-lg px-4 py-3 text-white w-full border transition-all backdrop-blur-sm ${
                  errors.email 
                    ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20' 
                    : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
                placeholder="Enter email address"
                required
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email}</p>
              )}
            </div>
            
            {/* Role */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400 tracking-wider">
                ROLE*
              </label>
              <select
                name="role"
                value={formState.role}
                onChange={handleInputChange}
                className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 w-full focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer pr-10"
                style={selectStyles}
                required
              >
                <option value={UserRole.REGIONAL_HQ}>Regional Commander</option>
                <option value={UserRole.OPERATOR}>Field Operator</option>
              </select>
            </div>
            
            {/* Region (only for Regional HQ) */}
            {formState.role === UserRole.REGIONAL_HQ && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-400 tracking-wider">
                  ASSIGNED REGION*
                </label>
                <select
                  name="regionId"
                  value={formState.regionId}
                  onChange={handleInputChange}
                  className={`bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 w-full focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer pr-10 ${
                    errors.regionId ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20' : ''
                  }`}
                  style={selectStyles}
                  required
                >
                  <option value="">Select a region</option>
                  {regions.filter(r => r.status === 'ACTIVE').map(region => (
                    <option key={region.id} value={region.id}>{region.name}</option>
                  ))}
                </select>
                {errors.regionId && (
                  <p className="text-red-400 text-xs mt-1">{errors.regionId}</p>
                )}
              </div>
            )}
            
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
            </div>
            
            {/* Password fields (only for new users) */}
            {!editingUser && (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400 tracking-wider">
                    PASSWORD*
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formState.password}
                    onChange={handleInputChange}
                    className={`bg-gray-800 rounded-lg px-4 py-3 text-white w-full border transition-all backdrop-blur-sm ${
                      errors.password 
                        ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20' 
                        : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                    placeholder="Enter password (min 8 characters)"
                    required
                  />
                  {errors.password && (
                    <p className="text-red-400 text-xs mt-1">{errors.password}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-400 tracking-wider">
                    CONFIRM PASSWORD*
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formState.confirmPassword}
                    onChange={handleInputChange}
                    className={`bg-gray-800 rounded-lg px-4 py-3 text-white w-full border transition-all backdrop-blur-sm ${
                      errors.confirmPassword 
                        ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20' 
                        : 'border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                    placeholder="Confirm password"
                    required
                  />
                  {errors.confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </>
            )}
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
              {editingUser ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserForm;