import { http } from "./http"

export const metodosPagoApi = {
  list(params = {}) {
    return http.get("/metodos-pago", { params })
  },

  porId(id) {
    return http.get(`/metodos-pago/${id}`)
  },

  create(payload) {
    return http.post("/metodos-pago", payload)
  },

  update(id, payload) {
    return http.put(`/metodos-pago/${id}`, payload)
  },

  remove(id) {
    return http.delete(`/metodos-pago/${id}`)
  },
}