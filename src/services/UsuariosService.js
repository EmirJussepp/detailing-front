import { http } from "./http"

export const usuariosApi = {
  login(payload) {
    return http.post("/auth/login", payload)
  },

  list() {
    return http.get("/usuarios")
  },

  create(payload) {
    return http.post("/usuarios", payload)
  },

  porId(id) {
    return http.get(`/usuarios/${id}`)
  },

  update(id, payload) {
    return http.patch(`/usuarios/editar/${id}`, payload)
  },

  delete(id) {
    return http.delete(`/usuarios/eliminar/${id}`)
  },
}