import { http } from "./http"

export const ventasApi = {
  list(params = {}) {
    return http.get("/ventas", { params })
  },

  create(payload) {
    return http.post("/ventas", payload)
  },

  porId(id) {
    return http.get(`/ventas/${id}`)
  },

  porClienteId(clienteId) {
    return http.get("/ventas", { params: { clienteId } })
  },

  devolver(id, payload = {}) {
    return http.post(`/ventas/${id}/devolver`, payload)
  },

  devolverParcial(id, payload) {
    return http.post(`/ventas/${id}/devolver-parcial`, payload)
  },
  enviarComprobante(ventaId, payload) {
  return http.post(`/ventas/${ventaId}/comprobante`, payload)
},
}