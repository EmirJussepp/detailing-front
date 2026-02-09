import { http } from "./http"

export const metodosPagoApi = {
  list() {
    return http.get("/metodosPago")
  },
}
