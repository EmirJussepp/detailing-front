// src/services/comprasApi.js
import { http } from "./http"
export const comprasApi = {
  create: (payload) => http.post("/compras", payload),
  list: (params) => http.get("/compras", { params }),
  byId: (id) => http.get(`/compras/${id}`),
}
