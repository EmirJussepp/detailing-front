import { http } from "./http";

const BASE = "/localidades";

export const localidadApi = {
  list: () => http.get(BASE),
  create: (payload) => http.post(BASE, payload),
};
