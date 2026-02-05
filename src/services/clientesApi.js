import { http } from "./http";

export const clientesApi = {
  list() {
    return http.get("/clientes");
  },
  create(payload) {
    return http.post("/clientes", payload);
  },
  getByDni(dni) {
    return http.get(`/clientes/dni/${encodeURIComponent(dni)}`);
  },
  deuda(clienteId) {
    return http.get(`/clientes/${clienteId}/deuda`);
  },
  deudas() {
    return http.get("/clientes/deudas");
  },
};
