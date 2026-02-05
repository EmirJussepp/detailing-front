import http from "./http";

export const ventasApi = {
  create(command) {
    // POST /ventas
    return http.post("/ventas", command);
  },
  getById(id) {
    return http.get(`/ventas/${id}`);
  },
};
