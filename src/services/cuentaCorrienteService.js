// src/services/cuentaCorrienteService.js
import { http } from "./http"

export const cuentaCorrienteApi = {
  // ⚠️ algunos back devuelven { deudaTotal }, otros un número, etc.
  deuda(clienteId) {
    // preferido
    return http.get(`/clientes/${clienteId}/deuda`)
  },

  // movimientos
  estadoCuenta(clienteId) {
    // preferido
    return http.get(`/clientes/${clienteId}/estado-cuenta`)
  },
}