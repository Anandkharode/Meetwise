import axios from 'axios';

export const TOKEN_KEY = 'meeting_action_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  },
);

export function getApiError(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map((item) => item.msg || item.message).filter(Boolean).join(' ');
  }
  return data?.message || error?.message || fallback;
}

export default api;
