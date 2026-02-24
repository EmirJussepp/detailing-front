import { http } from "./http"

export const pagosProveedorApi = {
  create(payload) {
    return http.post("/pagos-proveedor", payload)
  },
  porCompra(compraId) {
    return http.get(`/pagos-proveedor/compra/${compraId}`)
  },
}