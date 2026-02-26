import { http } from "./http"

export const clientesApi = {
  list(params = {}) {
    const { page = 0, size = 10, search = "" } = params
    return http.get("/clientes", { params: { page, size, search } })
  },
  create(payload) {
    return http.post("/clientes", payload)
  },
  getByDni(dni) {
    return http.get(`/clientes/dni/${encodeURIComponent(dni)}`)
  },

  deuda(clienteId) {
    return http.get(`/clientes/${clienteId}/deuda`)
  },
  deudas() {
    return http.get("/clientes/deudas")
  },

  estadoCuenta(clienteId) {
    return http.get(`/clientes/${clienteId}/estado-cuenta`)
  },
}