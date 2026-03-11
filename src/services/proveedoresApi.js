import { http } from "./http"

export const proveedoresApi = {
  list(params = {}) {
    const {
      page = 1,
      size = 10,
      search = "",
    } = params

    return http.get("/proveedores", {
      params: { page, size, search },
    })
  },

  create(payload) {
    return http.post("/proveedores", payload)
  },

  update(id, payload) {
    return http.put(`/proveedores/${id}`, payload)
  },

  byId(id) {
    return http.get(`/proveedores/${id}`)
  },

  buscar({ dni, cuit }) {
    const params = new URLSearchParams()
    if (dni) params.set("dni", dni)
    if (cuit) params.set("cuit", cuit)
    return http.get(`/proveedores/buscar?${params.toString()}`)
  },

  deudaPorId(id) {
    return http.get(`/proveedores/${id}/deuda`)
  },

  deudas() {
    return http.get(`/proveedores/deudas`)
  },

  estadoCuenta(id) {
    return http.get(`/proveedores/${id}/estado-cuenta`)
  },
}