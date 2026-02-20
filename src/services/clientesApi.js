// src/services/clientesApi.js
import { http } from "./http"

export const clientesApi = {
  list() {
    return http.get("/clientes")
  },
  create(payload) {
    return http.post("/clientes", payload)
  },
  getByDni(dni) {
    return http.get(`/clientes/dni/${encodeURIComponent(dni)}`)
  },

  // (si tu back lo tiene)
  deuda(clienteId) {
    return http.get(`/clientes/${clienteId}/deuda`)
  },
  deudas() {
    return http.get("/clientes/deudas")
  },

  // ✅ CUENTA CORRIENTE REAL (back)
  estadoCuenta(clienteId) {
    return http.get(`/clientes/${clienteId}/estado-cuenta`)
  },
}
