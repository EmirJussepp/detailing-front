import { http } from "./http"

export const usuariosApi = {

  // LOGIN
  login(payload) {
    return http.post("/auth/login", payload)
  },

  // LISTAR USUARIOS
  list() {
    return http.get("/usuarios")
  },

  // CREAR USUARIO
  create(payload) {
    return http.post("/usuarios", payload)
  },

  // OBTENER USUARIO POR ID (opcional)
  porId(id) {
    return http.get(`/usuarios/${id}`)
  },

  // ELIMINAR USUARIO (opcional)
  delete(id) {
    return http.delete(`/usuarios/${id}`)
  }

}