import { http } from "./http"

export const ventasApi = {
  list() {
    return http.get("/ventas")
  },
  create(payload) {
    return http.post("/ventas", payload)
  },
  porId(id) {
    return http.get(`/ventas/${id}`)
  },
}
