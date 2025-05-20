// lib/utils/browser.ts

/**
 * Safely check if code is running in browser environment
 */
export const isBrowser = typeof window !== 'undefined';

/**
 * Safely get an item from localStorage
 * @param key The key to get from localStorage
 * @param defaultValue Optional default value if key doesn't exist
 */
export const getLocalStorageItem = (key: string, defaultValue: string | null = null): string | null => {
  if (!isBrowser) return defaultValue;
  
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return defaultValue;
  }
};

/**
 * Safely set an item in localStorage
 * @param key The key to set in localStorage
 * @param value The value to set
 */
export const setLocalStorageItem = (key: string, value: string): void => {
  if (!isBrowser) return;
  
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error setting ${key} in localStorage:`, error);
  }
};

/**
 * Safely remove an item from localStorage
 * @param key The key to remove from localStorage
 */
export const removeLocalStorageItem = (key: string): void => {
  if (!isBrowser) return;
  
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing ${key} from localStorage:`, error);
  }
};

/**
 * Get all localStorage keys
 * @returns Array of localStorage keys
 */
export const getLocalStorageKeys = (): string[] => {
  if (!isBrowser) return [];
  
  try {
    return Object.keys(localStorage);
  } catch (error) {
    console.error('Error getting localStorage keys:', error);
    return [];
  }
};

/**
 * Check if localStorage is available and working
 * @returns true if localStorage is available, false otherwise
 */
export const isLocalStorageAvailable = (): boolean => {
  if (!isBrowser) return false;
  
  try {
    const testKey = '__test_key__';
    localStorage.setItem(testKey, testKey);
    const result = localStorage.getItem(testKey) === testKey;
    localStorage.removeItem(testKey);
    return result;
  } catch (error) {
    return false;
  }
};