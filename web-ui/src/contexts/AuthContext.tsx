import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiConfig, getApiUrl } from '../config/api';
import { apiClient } from '../services/api';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check for stored token on init
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        // Sync with ApiClient
        apiClient.setAuthToken(storedToken);
      } catch (error) {
        console.error('Failed to parse stored user data');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');

    // Sync with ApiClient
    apiClient.clearAuth();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch(getApiUrl(apiConfig.endpoints.auth.signin), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();

      const userData: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      };

      setUser(userData);
      setToken(data.access_token);

      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('auth_user', JSON.stringify(userData));

      // Sync with ApiClient
      apiClient.setAuthToken(data.access_token);
    } catch (error: any) {
      throw new Error(error.message);
    }
    setLoading(false);
  };

  const signup = async (email: string, password: string, name?: string) => {
    setLoading(true);
    try {
      const response = await fetch(getApiUrl(apiConfig.endpoints.auth.signup), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Signup failed');
      }

      const data = await response.json();

      const userData: User = {
        id: data.user.id,
        email: data.user.email,
        name: name || data.user.name,
      };

      setUser(userData);
      setToken(data.access_token);

      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('auth_user', JSON.stringify(userData));

      // Sync with ApiClient
      apiClient.setAuthToken(data.access_token);
    } catch (error: any) {
      throw new Error(error.message);
    }
    setLoading(false);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAuthError(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');

    // Sync with ApiClient
    apiClient.clearAuth();
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const handleAuthError = () => {
    setAuthError('Your session has expired. Please sign in again.');
    logout();
  };

  // Set up auth error handler with API client
  useEffect(() => {
    apiClient.setAuthErrorHandler(handleAuthError);
  }, []);

  const value: AuthContextType = {
    user,
    token,
    login,
    signup,
    logout,
    isAuthenticated: !!user && !!token,
    loading,
    authError,
    clearAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};