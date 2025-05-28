// components/UI/CustomSelect.tsx - Reusable Dropdown Component
import React from 'react';

interface CustomSelectProps {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  name,
  value,
  onChange,
  children,
  className = '',
  required = false,
  disabled = false,
  error = false
}) => {
  const baseClasses = `
    bg-gray-800 text-white border rounded-lg px-4 py-3 w-full
    focus:outline-none focus:ring-2 focus:ring-blue-500/20 
    transition-all appearance-none cursor-pointer
    disabled:opacity-50 disabled:cursor-not-allowed
    pr-10
  `;

  const borderClass = error 
    ? 'border-red-500 focus:border-red-400' 
    : 'border-gray-700 focus:border-blue-500';

  return (
    <div className="relative">
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`${baseClasses} ${borderClass} ${className}`}
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")",
          backgroundPosition: 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.5em 1.5em'
        }}
      >
        {children}
      </select>
    </div>
  );
};

export default CustomSelect;