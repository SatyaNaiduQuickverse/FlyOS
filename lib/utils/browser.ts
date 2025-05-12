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
  return localStorage.getItem(key) || defaultValue;
};

/**
 * Safely set an item in localStorage
 * @param key The key to set in localStorage
 * @param value The value to set
 */
export const setLocalStorageItem = (key: string, value: string): void => {
  if (!isBrowser) return;
  localStorage.setItem(key, value);
};

/**
 * Safely remove an item from localStorage
 * @param key The key to remove from localStorage
 */
export const removeLocalStorageItem = (key: string): void => {
  if (!isBrowser) return;
  localStorage.removeItem(key);
};
