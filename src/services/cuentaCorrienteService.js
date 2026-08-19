// src/services/cuentaCorrienteService.js
import { http } from "./http"

export const cuentaCorrienteApi = {
  deuda(clienteId) {
    return http.get(`/clientes/${clienteId}/deuda`)
  },

  estadoCuenta(clienteId, params = {}) {
    return http.get(`/clientes/${clienteId}/estado-cuenta`, { params })
  },

  // Lista de todos los clientes con deuda pendiente
  deudores() {
    return http.get(`/clientes/deudas`)
  },
}