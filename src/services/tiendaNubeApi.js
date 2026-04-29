import { http } from "./http"

export const tiendaNubeApi = {
  // Sync productos TN → sistema (mapea por SKU)
  syncProductos() {
    return http.post("/tiendanube/sync-productos")
  },

  // Ventas online (filtra por turno ONLINE)
  ventasOnline(params = {}) {
    return http.get("/ventas", { params: { ...params, turno: "ONLINE" } })
  },

  // Caja online
  cajaOnline() {
    return http.get("/cajas/abierta", { params: { turno: "ONLINE" } })
  },
}