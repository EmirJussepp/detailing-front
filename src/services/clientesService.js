import { http } from "./http";

export const clientesApi = {
  list: () => http.get("/clientes"),
  create: (payload) => http.post("/clientes", payload),
  getByDni: (dni) => http.get(`/clientes/dni/${dni}`),
};
