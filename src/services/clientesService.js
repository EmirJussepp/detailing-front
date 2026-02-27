// src/services/clientesService.js
import { http } from "./http"

export const clientesApi = {
  // ✅ lista (puede ser paginada o array)
  list(params = {}) {
    const { page = 0, size = 50, search = "" } = params
    return http.get("/clientes", { params: { page, size, search } })
  },

  create(payload) {
    return http.post("/clientes", payload)
  },

  // ✅ si tu back lo tiene así:
  getByDni(dni) {
    return http.get(`/clientes/dni/${encodeURIComponent(dni)}`)
  },

  // ✅ alternativo (si tu back lo tiene con query):
  // getByDni(dni) {
  //   return http.get("/clientes/buscar", { params: { dni } })
  // },

  deuda(clienteId) {
    return http.get(`/clientes/${clienteId}/deuda`)
  },

  estadoCuenta(clienteId) {
    return http.get(`/clientes/${clienteId}/estado-cuenta`)
  },
}