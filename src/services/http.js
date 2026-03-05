import axios from "axios"
import { getSession } from "../auth/session"

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8082",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
})

http.interceptors.request.use((config) => {
  const s = getSession()
  const token = s?.token

  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }

  console.log("➡️", config.method?.toUpperCase(), config.baseURL + config.url, config.data ?? "")
  return config
})

http.interceptors.response.use(
  (res) => {
    console.log("✅", res.config.url, res.status, res.data)
    return res
  },
  (err) => {
    console.error("❌", err.config?.url, err.response?.status, err.response?.data || err.message)
    return Promise.reject(err)
  }
)

export default http