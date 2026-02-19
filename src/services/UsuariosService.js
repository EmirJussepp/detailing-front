import { http } from "./http"

export const usuariosApi = {
  list() {
    return http.get("/usuarios")
  },
  create(payload) {
    return http.post("/usuarios", payload)
  },
}
