import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Set base URL for all axios requests
axios.defaults.baseURL = 'http://localhost:8000';
axios.defaults.headers.common['Content-Type'] = 'application/json';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  const fetchUserInfo = useCallback(async () => {
    try {
      console.log('Fetching user info with token:', token ? 'present' : 'missing');
      const response = await axios.get('/auth/me');
      console.log('User info fetched:', response.data);
      setUser(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      logout();
      return null;
    } finally {
      setLoading(false);
    }
  }, [logout, token]);

  useEffect(() => {
    if (token) {
      console.log('Setting authorization header with token');
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, [token, fetchUserInfo]);

  const login = async (email, password) => {
    try {
      const response = await axios.post('/auth/login', { email, password });
      const { access_token } = response.data;
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Fetch user info and return it
      const userResponse = await axios.get('/auth/me');
      const userData = userResponse.data;
      setUser(userData);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('Login failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const register = async (email, password, name, registrationCode) => {
    try {
      await axios.post('/auth/register', {
        email,
        password,
        name,
        registration_code: registrationCode
      });
      
      // Auto-login after registration
      await login(email, password);
      return { success: true };
    } catch (error) {
      console.error('Registration failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Registration failed' 
      };
    }
  };


  const updateUserInfo = useCallback(async () => {
    try {
      console.log('Updating user info...');
      const response = await axios.get('/auth/me');
      console.log('User info updated:', response.data);
      setUser(response.data);
      console.log('User state updated in context');
      return response.data;
    } catch (error) {
      console.error('Failed to update user info:', error);
      return null;
    }
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    fetchUserInfo,
    updateUserInfo,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isTrainer: user?.role === 'trainer'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
