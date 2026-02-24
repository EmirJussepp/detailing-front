import { ref } from "vue"
import { getSession } from "../auth/session"
import { cajaApi } from "../services/cajaApi"

export function useCajaAbierta() {
  const session = getSession() ?? null
  const userId = Number(session?.userId ?? 1)

  const caja = ref(null)

  async function fetchCajaAbierta() {
    const turnos = ["MANIANA", "TARDE"]

    for (const turno of turnos) {
      try {
        const { data } = await cajaApi.abierta({ userId, turno })
        if (data?.cajaId) {
          caja.value = data
          return data
        }
      } catch (e) {
        if (e?.response?.status !== 404) throw e
      }
    }

    caja.value = null
    return null
  }

  return { userId, caja, fetchCajaAbierta }
}