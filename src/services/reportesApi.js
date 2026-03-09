import { http } from "./http"

export const reportesApi = {
  dashboard(params = {}) {
    return http.get("/reportes/dashboard", { params })
  },

  productosMasVendidos(params = {}) {
    return http.get("/reportes/productos-mas-vendidos", { params })
  },

  facturacionMensual(params = {}) {
    return http.get("/reportes/facturacion-mensual", { params })
  },

  facturacionPorMetodo(params = {}) {
    return http.get("/reportes/metodo", { params })
  },

  gananciaTotal(params = {}) {
    return http.get("/reportes/ganancia-total", { params })
  },
}