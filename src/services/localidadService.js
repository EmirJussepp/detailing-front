import { http } from "./http"

export const localidadApi = {
  list() {
    return http.get("/localidades")
  },

  porId(id) {
    return http.get(`/localidades/${id}`)
  },

  create(payload) {
    return http.post("/localidades", payload)
  },

  update(id, payload) {
    return http.put(`/localidades/${id}`, payload)
  },

  remove(id) {
    return http.delete(`/localidades/${id}`)
  },
}