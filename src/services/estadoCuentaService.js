import { http } from "./http"

export const estadoCuentaApi = {
  // ✅ Endpoint “probable”. Si tu back usa otro, solo cambiás esta línea.
  porClienteId(clienteId) {
    return http.get(`/clientes/${clienteId}/estado-cuenta`)
  },
}
