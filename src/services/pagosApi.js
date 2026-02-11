// src/services/pagosApi.js
import { http } from "./http";

export const pagosApi = {
  create(payload) {
    return http.post("/pagos", payload);
  },
  porId(id) {
    return http.get(`/pagos/${id}`);
  },
  porVentaId(ventaId) {
    return http.get(`/pagos/venta/${ventaId}`);
  },
};
