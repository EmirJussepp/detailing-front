import { http } from "./http"

export const metodosPagoApi = {
  list(params = {}) {
    return http.get("/metodos-pago", { params })
  },

  create(payload) {
    return http.post("/metodos-pago", payload)
  },
}