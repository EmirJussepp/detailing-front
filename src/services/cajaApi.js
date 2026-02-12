import { http } from "./http"

export const cajaApi = {
  abrir(payload) {
    return http.post("/cajas/abrir", payload)
  },

  abierta(params) {
    return http.get("/cajas/abierta", { params })
  },

  porId(id) {
    return http.get(`/cajas/${id}`)
  },

  cerrar(id, payload) {
    return http.post(`/cajas/${id}/cerrar`, payload)
  },

  saldo(cajaId) {
    return http.get(`/cajas/${cajaId}/saldo`)
  },
}
