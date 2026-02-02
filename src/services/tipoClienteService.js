import { http } from "./http";

const BASE = "/tipoClientes";

export const tipoClienteApi = {
  list: () => http.get(BASE),
  create: (payload) => http.post(BASE, payload),
};
