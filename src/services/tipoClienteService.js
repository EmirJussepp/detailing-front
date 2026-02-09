import { http } from "./http"

export const tipoClientesApi = {
  list() {
    return http.get("/tipoClientes")
  },
  create(payload) {
    return http.post("/tipoClientes", payload)
  },
}
