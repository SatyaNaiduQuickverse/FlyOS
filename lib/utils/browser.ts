// lib/utils/browser.ts - EXTENDED WITH MAVROS UTILITY FUNCTIONS

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

// NEW: MAVROS UTILITY FUNCTIONS
// ==============================

/**
 * Parse message type from MAVROS message content
 */
export const parseMessageType = (message: string): 'INFO' | 'WARN' | 'ERROR' | 'OTHER' => {
  const upperMessage = message.toUpperCase();
  
  if (upperMessage.includes('[ERROR]') || upperMessage.includes('ERROR:')) {
    return 'ERROR';
  } else if (upperMessage.includes('[WARN]') || upperMessage.includes('WARNING:')) {
    return 'WARN';
  } else if (upperMessage.includes('[INFO]') || upperMessage.includes('INFO:')) {
    return 'INFO';
  } else {
    return 'OTHER';
  }
};

/**
 * Parse severity level from message content
 */
export const parseSeverityLevel = (message: string): number => {
  const upperMessage = message.toUpperCase();
  
  if (upperMessage.includes('CRITICAL') || upperMessage.includes('FATAL')) {
    return 3; // Critical
  } else if (upperMessage.includes('ERROR')) {
    return 2; // Error
  } else if (upperMessage.includes('WARN')) {
    return 1; // Warning
  } else {
    return 0; // Info
  }
};

/**
 * Format timestamp for display
 */
export const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    return timestamp;
  }
};

/**
 * Format message with highlighting for important data
 */
export const formatMessage = (message: string): string => {
  let formatted = message;
  
  // Escape HTML first
  formatted = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Highlight numbers
  formatted = formatted.replace(/(\d+\.?\d*)/g, '<span class="text-blue-300 font-medium">$1</span>');
  
  // Highlight status words
  formatted = formatted.replace(/(connected|disconnected|armed|disarmed|takeoff|landing|mission)/gi, 
    '<span class="text-cyan-300 font-medium">$1</span>');
    
  // Highlight coordinates
  formatted = formatted.replace(/(lat|lng|lon|latitude|longitude):\s*([+-]?\d*\.?\d+)/gi,
    '$1: <span class="text-green-300 font-medium">$2</span>');
    
  // Highlight error/warning keywords
  formatted = formatted.replace(/(failed|error|warning|critical|fatal)/gi,
    '<span class="text-red-300 font-medium">$1</span>');
    
  return formatted;
};

/**
 * Get message type color class
 */
export const getMessageTypeColor = (type: string): string => {
  switch (type) {
    case 'ERROR': return 'text-red-400';
    case 'WARN': return 'text-yellow-400';
    case 'INFO': return 'text-gray-100';
    case 'OTHER': return 'text-green-400';
    default: return 'text-gray-300';
  }
};

/**
 * Get filter style for message type buttons
 */
export const getFilterStyle = (type: string, isActive: boolean): string => {
  if (!isActive) return 'bg-slate-800 text-gray-500 border-gray-700';
  
  switch (type) {
    case 'ERROR':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'WARN':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'INFO':
      return 'bg-gray-100/90 text-black border-gray-300/30';
    case 'OTHER':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    default:
      return 'bg-slate-800 text-gray-500 border-gray-700';
  }
};

/**
 * Export MAVROS logs to JSON
 */
export const exportMAVROSLogs = (logs: any[], droneId: string): void => {
  if (!isBrowser) return;
  
  try {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `mavros_logs_${droneId}_${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  } catch (error) {
    console.error('Error exporting MAVROS logs:', error);
  }
};

/**
 * Export MAVROS logs to CSV
 */
export const exportMAVROSLogsCSV = (logs: any[], droneId: string): void => {
  if (!isBrowser) return;
  
  try {
    const headers = ['timestamp', 'messageType', 'severityLevel', 'source', 'message'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        `"${log.timestamp}"`,
        `"${log.messageType}"`,
        log.severityLevel,
        `"${log.source}"`,
        `"${log.message.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');
    
    const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `mavros_logs_${droneId}_${new Date().toISOString()}.csv`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  } catch (error) {
    console.error('Error exporting MAVROS logs to CSV:', error);
  }
};