// lib/api/auth.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { User } from '../../types/auth';

// Base API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Extend InternalAxiosRequestConfig to include _retry property
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Configure axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important for cookies
  timeout: 10000, // 10 second timeout - optimized for time-sensitive operations
});

// Interface for API responses
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  token?: string; // Add token at top level for backward compatibility
  data?: T;
  [key: string]: unknown;
}

// Login response interface
interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  refreshToken: string;
  user: User;
  sessionId: string;
}

// Add request interceptor for token handling
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // Get token from localStorage for backwards compatibility
    const token = typeof window !== 'undefined' ? localStorage.getItem('flyos_token') : null;
    
    // If token exists, add to Authorization header
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (!error.config) {
      return Promise.reject(error);
    }

    // Cast to our extended config type with _retry property
    const originalRequest = error.config as ExtendedAxiosRequestConfig;
    
    // If error is 401 (Unauthorized) and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Mark as retrying to prevent infinite loop
      originalRequest._retry = true;
      
      try {
        // Try to refresh token
        const refreshResponse = await api.post<ApiResponse<{ token: string }>>('/auth/refresh');
        
        // Check for token in response (handle both patterns)
        const newToken = refreshResponse.data.token || refreshResponse.data.data?.token;
        
        if (refreshResponse.data.success && newToken) {
          // Store new token in localStorage for backward compatibility
          if (typeof window !== 'undefined') {
            localStorage.setItem('flyos_token', newToken);
          }
          
          // Update header and retry original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          
          return api(originalRequest);
        }
      } catch {
        // Failed to refresh token
        console.error('Token refresh failed');
        
        // Only redirect to login if we're in browser environment
        if (typeof window !== 'undefined') {
          // Keep current URL to redirect back after login
          const currentPath = window.location.pathname + window.location.search;
          localStorage.setItem('flyos_redirect_after_login', currentPath);
          
          // Redirect to login page
          window.location.href = '/auth/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API methods
export const authApi = {
  /**
   * Login with username and password
   */
  login: async (username: string, password: string): Promise<LoginResponse> => {
    try {
      const response = await api.post<LoginResponse>('/auth/login', { 
        username, 
        password 
      });
      
      // Store token in localStorage for backward compatibility
      if (typeof window !== 'undefined') {
        localStorage.setItem('flyos_token', response.data.token);
        localStorage.setItem('flyos_user', JSON.stringify(response.data.user));
        
        // Store session ID for logout tracking
        localStorage.setItem('flyos_session_id', response.data.sessionId);
      }
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.message || 'Authentication failed');
      }
      throw new Error('Authentication service unavailable');
    }
  },
  
  /**
   * Verify current token is valid
   */
  verifyToken: async (): Promise<User> => {
    try {
      const response = await api.get<ApiResponse<{ user: User }>>('/auth/verify');
      return response.data.data?.user as User;
    } catch {
      // Ignore variable to satisfy ESLint
      throw new Error('Invalid authentication session');
    }
  },
  
  /**
   * Refresh access token
   */
  refreshToken: async (): Promise<string> => {
    try {
      const response = await api.post<ApiResponse<{ token: string }>>('/auth/refresh');
      
      // Get token from response (handle both patterns)
      const newToken = response.data.token || response.data.data?.token;
      
      if (newToken && typeof window !== 'undefined') {
        localStorage.setItem('flyos_token', newToken);
      }
      
      return newToken || '';
    } catch {
      // Ignore variable to satisfy ESLint
      throw new Error('Failed to refresh token');
    }
  },
  
  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    try {
      // Get session ID from local storage if available
      const sessionId = typeof window !== 'undefined' ? 
        localStorage.getItem('flyos_session_id') : null;
      
      // Call logout endpoint
      await api.post('/auth/logout', { sessionId });
      
      // Clear local storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('flyos_token');
        localStorage.removeItem('flyos_user');
        localStorage.removeItem('flyos_session_id');
      }
    } catch (logoutError) {
      console.error('Logout error:', logoutError);
      
      // Still clear local storage even if API call fails
      if (typeof window !== 'undefined') {
        localStorage.removeItem('flyos_token');
        localStorage.removeItem('flyos_user');
        localStorage.removeItem('flyos_session_id');
      }
    }
  },
  
  /**
   * Get login history
   */
  getLoginHistory: async (page = 1, limit = 10, userId?: string) => {
    try {
      const params: Record<string, unknown> = { page, limit };
      if (userId) params.userId = userId;
      
      const response = await api.get('/auth/login-history', { params });
      return response.data;
    } catch {
      // Ignore variable to satisfy ESLint
      throw new Error('Failed to fetch login history');
    }
  }
};

export default api;
