import { http } from "./http"

export const cajaApi = {

  abierta(params) {
    return http.get("/cajas/abierta", { params })
  },

  abrir(payload) {
    return http.post("/cajas/abrir", payload)
  },

  cerrar(cajaId, payload = {}) {
    return http.post(`/cajas/${cajaId}/cerrar`, payload)
  },

  saldo(cajaId) {
    return http.get(`/cajas/${cajaId}/saldo`)
  },
    reporteCierre(turno) {
    return http.get("/cajas/reporte-cierre", {
      params: { turno }
    })
  }
  
}