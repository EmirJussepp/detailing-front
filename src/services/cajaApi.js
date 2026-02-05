import { http } from "./http";

export const cajaApi = {
  abrir(payload) {
    return http.post("/cajas/abrir", payload);
  },
  abierta() {
    return http.get("/cajas/abierta");
  },
  porId(id) {
    return http.get(`/cajas/${id}`);
  },
  cerrar(id, payload) {
    return http.post(`/cajas/${id}/cerrar`, payload);
  },
};
