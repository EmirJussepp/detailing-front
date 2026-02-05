import http from "./http";

export const movimientosCajaApi = {
  porCajaId(cajaId) {
    return http.get(`/movimientos-caja/caja/${cajaId}`);
  },
  porVentaId(ventaId) {
    return http.get(`/movimientos-caja/venta/${ventaId}`);
  },
};
