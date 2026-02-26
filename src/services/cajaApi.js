import { http } from "./http"

export const cajaApi = {
  // ✅ turno opcional
  abierta({ userId, turno } = {}) {
    const params = {}
    if (userId != null) params.userId = userId
    if (turno) params.turno = turno
    return http.get("/cajas/abierta", { params })
  },

  abrir(payload) {
    return http.post("/cajas", payload)
  },

  cerrar(cajaId, payload) {
    return http.post(`/cajas/${cajaId}/cerrar`, payload)
  },

  saldo(cajaId) {
    return http.get(`/cajas/${cajaId}/saldo`)
  },
}