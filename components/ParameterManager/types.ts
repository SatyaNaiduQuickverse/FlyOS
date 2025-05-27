// components/DroneControl/ParameterManager/types.ts

export interface Parameter {
  name: string;
  value: string | number;
  description?: string;
  unit?: string;
  range?: [number, number];
  default?: string | number;
  modified?: boolean;
  type?: 'FLOAT' | 'INT8' | 'INT16' | 'INT32';
}

export interface ParameterSubcategory {
  name: string;
  description: string;
  parameters: Parameter[];
  expanded?: boolean;
}

export interface ParameterCategory {
  name: string;
  description: string;
  subcategories: ParameterSubcategory[];
  expanded?: boolean;
}

export interface ParameterManagerProps {
  droneId: string;
  isControlEnabled: boolean;
}

export interface ImportOptions {
  categories: string[];
  replaceExisting: boolean;
  validateRanges: boolean;
}

export interface ExportOptions {
  format: 'txt' | 'parm';
  categories?: string[];
  modifiedOnly?: boolean;
}

export interface ParameterFile {
  name: string;
  content: string;
  format: 'txt' | 'parm';
  parameterCount: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ParameterUpdate {
  parameterName: string;
  oldValue: string | number;
  newValue: string | number;
  timestamp: Date;
}
