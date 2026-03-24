import { http } from "./http"

export const movimientosCajaApi = {
  list(params = {}) {
    return http.get("/movimientos-caja", { params })
  },

  // ✅ FIX: ahora el payload incluye metodoPagoId obligatorio
  crear(payload) {
    return http.post("/movimientos-caja", payload)
  },

  porCajaId(cajaId, params = {}) {
    return http.get(`/movimientos-caja/caja/${cajaId}`, { params })
  },

  historico(params = {}) {
    return http.get("/movimientos-caja/historico", { params })
  },
}

// ✅ NUEVO: API para movimientos de stock (con nombre de producto)
export const movimientosStockApi = {
  list(params = {}) {
    return http.get("/movimientos-stock", { params })
  },

  porProducto(productoId) {
    return http.get(`/movimientos-stock/producto/${productoId}`)
  },

  porVenta(ventaId) {
    return http.get(`/movimientos-stock/venta/${ventaId}`)
  },

  porCompra(compraId) {
    return http.get(`/movimientos-stock/compra/${compraId}`)
  },
}