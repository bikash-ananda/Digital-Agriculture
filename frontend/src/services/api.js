import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.preserveAuthOnUnauthorized && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('da:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
