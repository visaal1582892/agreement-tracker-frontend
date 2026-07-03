import axios from 'axios';
import { API_BASE } from '../config/endpoints';
import store from '../store';
import { logout } from '../store/slices/authSlice';

export const SESSION_TIMEOUT_FLAG = 'sessionTimedOut';

const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function isSessionTimeoutError(error) {
  const status = error.response?.status;
  const token = localStorage.getItem('token');
  const requestUrl = error.config?.url || '';

  if (!token || requestUrl.includes('/auth/login')) {
    return false;
  }

  if (status === 401) {
    return true;
  }

  if (status === 403) {
    const message = (error.response?.data?.message || '').toLowerCase();
    const businessForbidden = message.includes('owner')
      || message.includes('permission')
      || message.includes('not authorized');
    if (businessForbidden) {
      return false;
    }
    return message.includes('access denied')
      || message.includes('forbidden')
      || message.includes('expired')
      || !message;
  }

  return false;
}

function handleSessionTimeout() {
  store.dispatch(logout());
  sessionStorage.setItem(SESSION_TIMEOUT_FLAG, '1');
  window.location.href = '/login';
}

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isSessionTimeoutError(error)) {
      handleSessionTimeout();
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
