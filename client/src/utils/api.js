import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ? `${import.meta.env.VITE_BACKEND_URL}/api` : '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token from localStorage as fallback (for non-cookie browsers)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && !config.url?.includes('/admin')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Attach admin token
api.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem('adminToken');
  if (adminToken && config.url?.includes('/admin')) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default api;
