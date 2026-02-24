import { http } from "./http"

export const usuariosApi = {
  // ✅ login real (back: POST /auth/login)
  login(payload) {
    // payload: { email, password }
    return http.post("/auth/login", payload)
  },

  // ya lo usabas
  list() {
    return http.get("/usuarios")
  },

  // ✅ crear usuario (back: POST /usuarios)
  create(payload) {
    // payload: { email, password, nombre, roles: ["ADMIN"] o ["CASHIER"] }
    return http.post("/usuarios", payload)
  },
}