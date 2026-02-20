import { http } from "./http"

export const cuentaCorrienteApi = {
  estadoCuenta(clienteId) {
    return http.get(`/clientes/${clienteId}/estado-cuenta`)
  },
  deuda(clienteId) {
    return http.get(`/clientes/${clienteId}/deuda`)
  },
}