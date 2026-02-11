import { http } from "./http";

export const productosApi = {
  list: () => http.get("/productos"),
  create: (payload) => http.post("/productos", payload),
};

