import { http } from "./http"

export const authApi = {
  login(payload) {
    // payload: { email, password }
    return http.post("/auth/login", payload)
  },
}