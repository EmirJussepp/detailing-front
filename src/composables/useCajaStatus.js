import { ref } from "vue"
import { getSession } from "../auth/session"
import { cajaApi } from "../services/cajaApi"

export function useCajaStatus() {
  const estado = ref("SIN_CAJA") // ABIERTA | CERRADA | SIN_CAJA
  const caja = ref(null)

  async function fetchStatus() {
    try {
      const session = getSession()
      const turno = session?.shift || "MAÑANA"

      const { data } = await cajaApi.getActiva(turno)

      if (!data) {
        estado.value = "SIN_CAJA"
        return
      }

      caja.value = data
      estado.value = data.estado || "SIN_CAJA"
    } catch (e) {
      estado.value = "SIN_CAJA"
    }
  }

  return {
    estado,
    caja,
    fetchStatus,
  }
}
