import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8082";

export const http = axios.create({
  baseURL,
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
