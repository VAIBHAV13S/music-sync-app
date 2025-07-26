import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface User {
  id: string;
  username: string;
  displayName?: string;
  email: string;
  avatar?: string;
  bio?: string;
  favoriteGenres: string[];
  createdAt: number;
  lastLogin: number;
  isVerified: boolean;
  preferences: {
    theme: 'dark' | 'light';
    autoJoinRooms: boolean;
    notifications: boolean;
    privacy: {
      showOnlineStatus: boolean;
      allowDirectMessages: boolean;
      showListeningHistory: boolean;
    };
    security: {
      twoFactorEnabled: boolean;
      sessionTimeout: number;
      requirePasswordForSensitiveActions: boolean;
    };
  };
  profile: {
    totalListeningTime: number;
    joinedRooms: number;
    hostedRooms: number;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (emailOrUsername: string, password: string) => Promise<{ 
    success: boolean; 
    error?: string; 
    validationErrors?: string[];
  }>;
  register: (username: string, email: string, password: string) => Promise<{ 
    success: boolean; 
    error?: string; 
    validationErrors?: string[];
  }>;
  logout: (allDevices?: boolean) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ 
    success: boolean; 
    error?: string; 
  }>;
  refreshToken: () => Promise<boolean>;
  checkPasswordStrength: (password: string) => Promise<{
    score: number;
    feedback: string[];
    isStrong: boolean;
  }>;
  getUserSessions: () => Promise<any[]>;
  revokeSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Fix: Remove trailing slash if present
  const API_BASE_URL = (import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-refresh token before expiration
  useEffect(() => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken && !token) {
      refreshAuthToken();
    } else if (token) {
      fetchUserProfile();
      // Set up auto-refresh (every 25 minutes for 30-minute tokens)
      const interval = setInterval(refreshAuthToken, 25 * 60 * 1000);
      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const refreshAuthToken = async (): Promise<boolean> => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        setIsLoading(false);
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          refreshToken,
          userAgent: navigator.userAgent,
          ipAddress: 'client' // We'll get this from server
        })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('accessToken', data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.tokens.refreshToken);
        setToken(data.tokens.accessToken);
        if (!user) {
          await fetchUserProfile();
        }
        return true;
      } else {
        if (data.requiresReauth) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setToken(null);
          setUser(null);
          setError('Your session has expired. Please sign in again.');
        }
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setToken(null);
      setUser(null);
      setIsLoading(false);
      return false;
    }
  };

  const fetchUserProfile = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        clearError();
      } else {
        const errorData = await response.json();
        if (errorData.requiresRefresh) {
          await refreshAuthToken();
        } else {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setToken(null);
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      setError('Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (emailOrUsername: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ✅ Now this will be correct: https://music-sync-server-nz0r.onrender.com/api/auth/login
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          emailOrUsername, 
          password,
          userAgent: navigator.userAgent,
          ipAddress: 'client'
        })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('accessToken', data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.tokens.refreshToken);
        setToken(data.tokens.accessToken);
        setUser(data.user);
        clearError();
        return { success: true };
      } else {
        setError(data.error);
        return { 
          success: false, 
          error: data.error,
          validationErrors: data.validationErrors
        };
      }
    } catch (error) {
      const errorMessage = 'Login failed. Please check your connection and try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ✅ This will also be correct now
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('accessToken', data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.tokens.refreshToken);
        setToken(data.tokens.accessToken);
        setUser(data.user);
        clearError();
        return { success: true };
      } else {
        setError(data.error);
        return { 
          success: false, 
          error: data.error,
          validationErrors: data.validationErrors
        };
      }
    } catch (error) {
      const errorMessage = 'Registration failed. Please check your connection and try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (allDevices: boolean = false) => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            refreshToken,
            allDevices,
            userId: user?.id
          })
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setToken(null);
      setUser(null);
      clearError();
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        clearError();
        return { success: true };
      } else {
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = 'Profile update failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (data.success) {
        // Refresh tokens after password change
        await refreshAuthToken();
        clearError();
        return { success: true };
      } else {
        setError(data.error);
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = 'Password change failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const checkPasswordStrength = async (password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/check-password-strength`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        score: 0,
        feedback: ['Unable to check password strength'],
        isStrong: false
      };
    }
  };

  const getUserSessions = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) return [];

      const response = await fetch(`${API_BASE_URL}/api/auth/sessions`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        return data.sessions || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      return [];
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return { success: false, error: 'Failed to revoke session' };
    }
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    refreshToken: refreshAuthToken,
    checkPasswordStrength,
    getUserSessions,
    revokeSession,
    isLoading,
    isAuthenticated: !!user && !!token,
    error,
    clearError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};