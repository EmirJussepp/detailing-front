import axios from "axios"

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
})

http.interceptors.request.use((config) => {
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

// ✅ ESTO ES LO QUE TE FALTA
export default http
