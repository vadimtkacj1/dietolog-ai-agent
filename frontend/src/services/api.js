import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  register: async (email, password, name, registrationCode) => {
    const response = await api.post('/auth/register', { 
      email, password, name, registration_code: registrationCode 
    });
    return response.data;
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

// Trainer Reminder Settings API
export const reminderSettingsAPI = {
  getSettings: async () => {
    const response = await api.get('/trainer/reminder-settings');
    return response.data;
  },
  
  updateSettings: async (settings) => {
    const response = await api.put('/trainer/reminder-settings', settings);
    return response.data;
  },
  
  initializeSettings: async () => {
    const response = await api.post('/trainer/reminder-settings/initialize');
    return response.data;
  }
};

// Trainer Analytics API
export const analyticsAPI = {
  getAnalytics: async () => {
    const response = await api.get('/trainer/analytics');
    return response.data;
  },
  
  getUsersAnalytics: async () => {
    const response = await api.get('/trainer/users-analytics');
    return response.data;
  },
  
  getUsers: async () => {
    const response = await api.get('/trainer/users');
    return response.data;
  }
};

// Trainer Config API
export const configAPI = {
  getConfig: async () => {
    const response = await api.get('/trainer/config');
    return response.data;
  },
  
  updateConfig: async (config) => {
    const response = await api.put('/trainer/config', config);
    return response.data;
  }
};

export default api;
