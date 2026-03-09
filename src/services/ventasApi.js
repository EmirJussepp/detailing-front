import { http } from "./http"

export const ventasApi = {
  list(params = {}) {
    return http.get("/ventas", { params })
  },

  create(payload) {
    return http.post("/ventas", payload)
  },

  porId(id) {
    return http.get(`/ventas/${id}`)
  },

  devolver(id, payload = {}) {
    return http.post(`/ventas/${id}/devolver`, payload)
  },
}