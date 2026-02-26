import { http } from "./http"

export const productosApi = {
  list(params = {}) {
    const { page = 0, size = 10, search = "" } = params
    return http.get("/productos", { params: { page, size, search } })
  },

  // ✅ existe en tu back
  porCodigo(codigoProducto) {
    return http.get(`/productos/codigo/${encodeURIComponent(codigoProducto)}`)
  },

  create(payload) {
    return http.post("/productos", payload)
  },

  // ✅ tu back usa PATCH
  update(id, payload) {
    return http.patch(`/productos/${id}`, payload)
  },
}