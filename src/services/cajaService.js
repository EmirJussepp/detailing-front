import { http } from "./http"


export const cajaApi = {
  abrir(payload) {
    // POST /cajas/abrir
    return http.post("/cajas/abrir", payload);
  },
  obtenerAbierta() {
    // GET /cajas/abierta
    return http.get("/cajas/abierta");
  },
  obtenerPorId(id) {
    return http.get(`/cajas/${id}`);
  },
};
