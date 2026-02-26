import { http } from "./http"

export const comprasApi = {
  list(params = {}) {
    const { page = 0, size = 10, search = "" } = params
    return http.get("/compras", { params: { page, size, search } })
  },
  create(payload) {
    return http.post("/compras", payload)
  },
  porId(id) {
    return http.get(`/compras/${id}`)
  },
}