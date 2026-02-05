import { http } from "./http";

export const movimientosCajaApi = {
  porCajaId(cajaId) {
    return http.get(`/movimientos-caja/caja/${cajaId}`);
  },
  porVentaId(ventaId) {
    return http.get(`/movimientos-caja/venta/${ventaId}`);
  },
  porCompraId(compraId) {
    return http.get(`/movimientos-caja/compra/${compraId}`);
  },
  list() {
    return http.get("/movimientos-caja");
  },
};
