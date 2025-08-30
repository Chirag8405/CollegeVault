import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthResponse } from '@shared/api';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (userData: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<AuthResponse>;
  updateProfile: (updates: Partial<Pick<User, 'name' | 'email' | 'phone'>>) => Promise<AuthResponse>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResponse>;
  deleteAccount: () => Promise<AuthResponse>;
  logout: () => void;
  checkAuth: () => Promise<void>;
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
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  // Track active requests to prevent concurrent requests
  const activeRequests = new Set<string>();

  // Check for existing authentication on app start
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const storedToken = localStorage.getItem('authToken');

      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      // Verify token with server
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${storedToken}`,
          'Accept': 'application/json'
        }
      });

      const result = await parseResponse(response);

      if (result.success && result.user) {
        setUser(result.user);
        setToken(storedToken);
      } else {
        // Invalid token, clear storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
    } finally {
      setIsLoading(false);
    }
  };

  const parseResponse = async (response: Response): Promise<AuthResponse> => {
    try {
      const text = await response.text();
      const trimmed = text.trim();

      if (!trimmed) {
        return {
          success: response.ok,
          message: response.ok ? undefined : `Server error: ${response.status} ${response.statusText}`,
        } as AuthResponse;
      }

      try {
        const data = JSON.parse(trimmed) as AuthResponse;
        return data;
      } catch {
        // Not JSON; surface raw text
        return { success: response.ok, message: trimmed } as AuthResponse;
      }
    } catch (e) {
      return {
        success: false,
        message: 'Failed to process server response',
      };
    }
  };

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    const requestKey = `login-${email}`;

    // Prevent concurrent login requests for the same email
    if (activeRequests.has(requestKey)) {
      console.log('Login request already in progress for:', email);
      return {
        success: false,
        message: 'Login request already in progress. Please wait.'
      };
    }

    activeRequests.add(requestKey);

    try {
      console.log('Starting login for:', email);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      console.log('Login response status:', response.status);
      console.log('Login response headers:', Object.fromEntries(response.headers.entries()));

      // Use the new robust response parser
      const result = await parseResponse(response);
      console.log('Login result:', result);

      if (result.success && result.user && result.token) {
        setUser(result.user);
        setToken(result.token);

        // Store in localStorage
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('userData', JSON.stringify(result.user));

        // Show success toast
        toast({
          title: "Welcome back!",
          description: `Successfully logged in as ${result.user.name}`,
          variant: "default"
        });
      } else {
        // Show error toast for failed login
        toast({
          title: "Login Failed",
          description: result.message || "Invalid email or password",
          variant: "destructive"
        });
      }

      return result;
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error. Please try again.'
      };
    } finally {
      // Always clear the active request tracking
      activeRequests.delete(requestKey);
      console.log('Login request completed for:', email);
    }
  };

  const register = async (userData: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<AuthResponse> => {
    const requestKey = `register-${userData.email}`;

    // Prevent concurrent registration requests for the same email
    if (activeRequests.has(requestKey)) {
      console.log('Registration request already in progress for:', userData.email);
      return {
        success: false,
        message: 'Registration request already in progress. Please wait.'
      };
    }

    activeRequests.add(requestKey);

    try {
      console.log('Starting registration for:', userData.email);

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      console.log('Registration response status:', response.status);
      console.log('Registration response headers:', Object.fromEntries(response.headers.entries()));

      // Use the new robust response parser
      const result = await parseResponse(response);
      console.log('Registration result:', result);

      if (result.success && result.user && result.token) {
        setUser(result.user);
        setToken(result.token);

        // Store in localStorage
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('userData', JSON.stringify(result.user));

        // Show success toast
        toast({
          title: "Account Created!",
          description: `Welcome to College Vault, ${result.user.name}!`,
          variant: "default"
        });
      } else {
        // Show error toast for failed registration
        toast({
          title: "Registration Failed",
          description: result.message || "Unable to create account. Please try again.",
          variant: "destructive"
        });
      }

      return result;
    } catch (error) {
      console.error('Registration failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error. Please try again.'
      };
    } finally {
      // Always clear the active request tracking
      activeRequests.delete(requestKey);
      console.log('Registration request completed for:', userData.email);
    }
  };

  const logout = () => {
    const userName = user?.name || "User";
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');

    // Show logout toast
    toast({
      title: "Logged Out",
      description: `Goodbye ${userName}! Your session has been ended securely.`,
      variant: "default"
    });
  };

  const updateProfile: AuthContextType['updateProfile'] = async (updates) => {
    if (!token) return { success: false, message: 'Not authenticated' };
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      const result = await response.json();
      if (result.success && result.user) {
        setUser(result.user);
        localStorage.setItem('userData', JSON.stringify(result.user));
        toast({ title: 'Profile Updated', description: 'Your profile has been updated.' });
      } else {
        toast({ title: 'Update Failed', description: result.message || 'Could not update profile', variant: 'destructive' });
      }
      return result;
    } catch (e) {
      toast({ title: 'Network Error', description: 'Failed to update profile', variant: 'destructive' });
      return { success: false, message: 'Network error' };
    }
  };

  const changePassword: AuthContextType['changePassword'] = async (currentPassword, newPassword) => {
    if (!token) return { success: false, message: 'Not authenticated' };
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Password Changed', description: 'Your password was updated.' });
      } else {
        toast({ title: 'Change Failed', description: result.message || 'Could not change password', variant: 'destructive' });
      }
      return result;
    } catch (e) {
      toast({ title: 'Network Error', description: 'Failed to change password', variant: 'destructive' });
      return { success: false, message: 'Network error' };
    }
  };

  const deleteAccount: AuthContextType['deleteAccount'] = async () => {
    if (!token) return { success: false, message: 'Not authenticated' };
    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        logout();
      } else {
        toast({ title: 'Deletion Failed', description: result.message || 'Could not delete account', variant: 'destructive' });
      }
      return result;
    } catch (e) {
      toast({ title: 'Network Error', description: 'Failed to delete account', variant: 'destructive' });
      return { success: false, message: 'Network error' };
    }
  };

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    register,
    updateProfile,
    changePassword,
    deleteAccount,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
