import axios from "axios"
import { getSession, clearSession } from "../auth/session"

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
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

  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status

    if (status === 401) {
      try { clearSession() } catch {}

      if (!String(window.location.pathname || "").startsWith("/login")) {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.href = `/login?redirect=${redirect}`
      }
    }

    return Promise.reject(err)
  }
)

export default http