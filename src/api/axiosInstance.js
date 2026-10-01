import axios from 'axios';
import { API_BASE } from '../config/endpoints';
import store from '../store';
import { logout } from '../store/slices/authSlice';
import { enqueueSnackbar } from 'notistack';

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
  const requestBase = config.baseURL || API_BASE;
  if (typeof requestBase === 'string' && requestBase.includes('ngrok')) {
    config.headers['ngrok-skip-browser-warning'] = 'true';
  }
  return config;
});



function handleSessionTimeout() {
  store.dispatch(logout());
  sessionStorage.setItem(SESSION_TIMEOUT_FLAG, '1');
  window.location.href = '/login';
}


axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    
    // Ignore login requests
    if (requestUrl.includes('/auth/login')) {
      return Promise.reject(error);
    }

    if (status === 401) {
      handleSessionTimeout();
    } else if (status === 403) {
      enqueueSnackbar('You do not have permission to perform this action.', { variant: 'error' });
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
