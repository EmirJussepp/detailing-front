import { http } from "./http"

export const clientesApi = {
  list(params = {}) {
    const page = Number(params.page ?? 0)
    const size = Number(params.size ?? 50)

    const termRaw = params.search ?? params.q ?? ""
    const term = String(termRaw ?? "").trim()

    const qp = { page, size }
    if (term) {
      qp.search = term
      qp.q = term
    }

    return http.get("/clientes", { params: qp })
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

  estadoCuenta(clienteId) {
    return http.get(`/clientes/${clienteId}/estado-cuenta`)
  },

  update(id, payload) {
  return http.put(`/clientes/${id}`, payload)
},
}