import { http } from "./http";

export const productosApi = {
  list: () => http.get("/productos"),
};
