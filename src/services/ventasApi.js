import { http } from "./http";

export const ventasApi = {
  create(command) {
    return http.post("/ventas", command);
  },
  getById(id) {
    return http.get(`/ventas/${id}`);
  },
};
