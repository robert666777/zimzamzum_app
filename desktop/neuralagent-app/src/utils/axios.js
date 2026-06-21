import axios from "axios";
import constants from "./constants";

const instance = axios.create({
  baseURL: constants.BASE_URL,
  timeout: 60000,
});

// Add request interceptor to automatically add Authorization header
instance.interceptors.request.use(
  (config) => {
    try {
      // Get token from localStorage (persisted Redux state)
      const stored = localStorage.getItem('persist:root');
      if (stored) {
        const parsed = JSON.parse(stored);
        const accessToken = JSON.parse(parsed.accessToken || 'null');
        if (accessToken) {
          config.headers.Authorization = 'Bearer ' + accessToken;
        }
      }
    } catch (e) {
      console.warn('Failed to add auth token:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default instance;

export const API_KEY_HEADER = {
  headers: {
    'Authorization': 'Api-Key ' + constants.API_KEY,
  }
}