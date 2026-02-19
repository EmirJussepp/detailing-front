import { http } from "./http"

export const movimientosCajaApi = {
  porCajaId(cajaId) {
    return http.get(`/movimientos-caja/caja/${cajaId}`)
  },
  crear(payload) {
    return http.post(`/movimientos-caja`, payload)
  },
}
