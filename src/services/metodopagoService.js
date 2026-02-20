import { http } from "./http"

export const metodosPagoApi = {
  list() {
    return http.get("/metodos-pago")
  },
  create(payload) {
    return http.post("/metodos-pago", payload)
  },
}
