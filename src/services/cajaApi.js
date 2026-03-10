import { http } from "./http"

export const cajaApi = {
  abierta({ userId, turno, fecha } = {}) {
    const params = {}
    if (userId != null) params.userId = userId
    if (turno) params.turno = turno
    if (fecha) params.fecha = fecha
    return http.get("/cajas/abierta", { params })
  },

  abrir(payload) {
    return http.post("/cajas/abrir", payload)
  },

  cerrar(cajaId, payload) {
    return http.post(`/cajas/${cajaId}/cerrar`, payload)
  },

  saldo(cajaId) {
    return http.get(`/cajas/${cajaId}/saldo`)
  },
}