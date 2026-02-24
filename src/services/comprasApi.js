import { http } from "./http"

export const comprasApi = {
  create(payload) {
    return http.post("/compras", payload)
  },
  porId(id) {
    return http.get(`/compras/${id}`)
  },
}