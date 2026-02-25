// src/services/comprasApi.js
import { http } from "./http"

export const comprasApi = {
  list() {
    return http.get("/compras")
  },
  create(payload) {
    return http.post("/compras", payload)
  },
  porId(id) {
    return http.get(`/compras/${id}`)
  },
}