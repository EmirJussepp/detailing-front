import { http } from "./http"

export const movimientosCajaApi = {
  list(params = {}) {
    return http.get("/movimientos-caja", { params })
  },

  crear(payload) {
    return http.post("/movimientos-caja", payload)
  },

  porCajaId(cajaId, params = {}) {
    return http.get(`/movimientos-caja/caja/${cajaId}`, { params })
  },
}