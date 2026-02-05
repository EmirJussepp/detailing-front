import { http } from "./http";

export const tipoClienteApi = {
  list: () => http.get("/tipoClientes"),
};
