import { http } from "./http"

export const localidadesApi = {
  list() {
    return http.get("/localidades")
  },
  create(payload) {
    return http.post("/localidades", payload)
  },
}
