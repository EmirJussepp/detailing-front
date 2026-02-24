<script setup>
import { computed, ref, onMounted, watch } from "vue"
import { RouterLink } from "vue-router"
import { getSession } from "../auth/session"
import { emitCajaChanged } from "../ui/cajaEvents"
import { cajaApi } from "../services/cajaApi"
import { movimientosCajaApi } from "../services/movimientosCajaApi"

// =========================
// Session
// =========================
const session = getSession() ?? null
const userId = Number(session?.userId ?? 1)

// =========================
// Helpers
// =========================
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
}

function toMoneyNumber(v) {
  const x = Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(x) ? x : NaN
}

function tipoPorConcepto(concepto) {
  if (concepto === "GASTO" || concepto === "RETIRO") return "EGRESO"
  if (concepto === "APORTE") return "INGRESO"
  return "EGRESO"
}

const movForm = ref({
  concepto: "GASTO",
  tipoManual: "EGRESO", // solo si concepto=AJUSTE
  monto: "",
  descripcion: "",
})

function tipoMovimientoParaForm() {
  if (movForm.value.concepto === "AJUSTE") return movForm.value.tipoManual
  return tipoPorConcepto(movForm.value.concepto)
}

// =========================
// Filtros (fecha / turno)
// =========================
const selectedFecha = ref(todayISO())

const turnoKey = `caja_turno_v1:${userId}`
const selectedTurno = ref("MANIANA") // BE: MANIANA | TARDE

// =========================
// Estado UI
// =========================
// arqueo
const montoContado = ref("")

const contadoNum = computed(() => toMoneyNumber(montoContado.value))
const diferencia = computed(() => {
  const c = contadoNum.value
  if (!Number.isFinite(c)) return null
  return c - Number(saldoActual.value ?? 0)
})
const loading = ref(false)
const errorMsg = ref("")
const okMsg = ref("")

const caja = ref(null)
const saldoActual = ref(0)
const movimientos = ref([])

// abrir
const abrirMontoInicial = ref("")

// modal movimientos
const showMovModal = ref(false)


const ultimosMovs = computed(() => movimientos.value.slice(0, 10))

// =========================
// Fetch
// =========================
async function loadMovimientos() {
  if (!caja.value?.cajaId) {
    movimientos.value = []
    return
  }
  const { data } = await movimientosCajaApi.porCajaId(caja.value.cajaId)
  movimientos.value = Array.isArray(data) ? data : []
}

async function refresh() {
  loading.value = true
  errorMsg.value = ""
  okMsg.value = ""

  const fetchAbierta = async (turno) => {
    const { data } = await cajaApi.abierta({ userId, turno })
    return data ?? null
  }

  try {
    // 1) Intento con el turno seleccionado
    let found = await fetchAbierta(selectedTurno.value)

    // 2) Si no hay (404), intento con el otro turno
    if (!found) {
      const otroTurno = selectedTurno.value === "MANIANA" ? "TARDE" : "MANIANA"
      try {
        found = await fetchAbierta(otroTurno)
        if (found?.cajaId) selectedTurno.value = found.turno // alinear UI
      } catch (e2) {
        // si también falla, lo dejamos en null (y abajo maneja)
      }
    }

    caja.value = found
    saldoActual.value = 0
    movimientos.value = []

    if (!caja.value?.cajaId) {
      errorMsg.value = "No hay caja ABIERTA."
      return
    }

    // alinear fecha/turno a lo real
    if (caja.value?.turno) selectedTurno.value = caja.value.turno
    if (caja.value?.fecha) selectedFecha.value = String(caja.value.fecha).slice(0, 10)

    const { data: saldoDto } = await cajaApi.saldo(caja.value.cajaId)
    saldoActual.value = Number(saldoDto?.saldoActual ?? 0)

    try {
      await loadMovimientos()
    } catch (_) {
      movimientos.value = []
    }
  } catch (e) {
    caja.value = null
    saldoActual.value = 0
    movimientos.value = []

    const status = e?.response?.status
    if (status === 404) {
      errorMsg.value = "No hay caja ABIERTA."
    } else {
      errorMsg.value =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.response?.data ||
        e?.message ||
        "Error consultando la caja."
    }
  } finally {
    loading.value = false
  }
}

// =========================
// Acciones
// =========================


async function abrirCaja() {
  errorMsg.value = ""
  okMsg.value = ""

  const hoy = todayISO()
  if (selectedFecha.value !== hoy) {
    errorMsg.value = "Solo podés abrir caja para HOY. Cambiá la fecha a hoy."
    return
  }

  const monto = toMoneyNumber(abrirMontoInicial.value)
  if (!Number.isFinite(monto) || monto < 0) {
    errorMsg.value = "Ingresá un monto inicial válido."
    return
  }

  try {
    await cajaApi.abrir({
      turno: selectedTurno.value,
      montoInicial: monto,
      userId,
    })

    okMsg.value = "Caja abierta ✅"
    abrirMontoInicial.value = ""
    emitCajaChanged()
    await refresh()
  } catch (e) {
    const status = e?.response?.status
    if (status === 409) {
      errorMsg.value = e?.response?.data?.error || "Ya existe una caja ABIERTA para este usuario."
      return
    }

    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.response?.data ||
      e?.message ||
      "Error abriendo caja."
  }
}




async function cerrarCaja() {
  errorMsg.value = ""
  okMsg.value = ""

  if (!caja.value?.cajaId) {
    errorMsg.value = "No hay caja ABIERTA para cerrar."
    return
  }

  const contado = toMoneyNumber(montoContado.value)
  const hayContado = Number.isFinite(contado)

  try {
    // 1) si hay contado, genero AJUSTE si corresponde
    if (hayContado) {
      const esperado = Number(saldoActual.value ?? 0)
      const diff = contado - esperado

      if (Math.abs(diff) >= 0.01) {
        await movimientosCajaApi.crear({
          cajaId: caja.value.cajaId,
          userId,
          concepto: "AJUSTE",
          tipo: diff > 0 ? "INGRESO" : "EGRESO",
          monto: Math.abs(diff),
          descripcion: `Arqueo cierre (contado: ${contado} / esperado: ${esperado})`,
        })
      }
    }

    // 2) refresco para que el saldo muestre el ajuste antes de cerrar
    await refresh()

    // 3) cierro (back: CerrarCajaCommand solo usa userId)
    await cajaApi.cerrar(caja.value.cajaId, { userId })

    okMsg.value = hayContado
      ? `Caja cerrada ✅ (contado: $ ${formatMoney(contado)} / esperado: $ ${formatMoney(saldoActual.value)})`
      : `Caja cerrada ✅ (monto final auto: $ ${formatMoney(saldoActual.value)})`

    montoContado.value = ""
    emitCajaChanged()
    await refresh()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.response?.data ||
      e?.message ||
      "Error cerrando caja."
  }
}



async function crearMovimientoManual() {
  errorMsg.value = ""
  okMsg.value = ""

  if (!caja.value?.cajaId) {
    errorMsg.value = "Abrí una caja primero."
    return
  }

  const monto = toMoneyNumber(movForm.value.monto)
  if (!Number.isFinite(monto) || monto <= 0) {
    errorMsg.value = "Monto inválido."
    return
  }

  try {
    await movimientosCajaApi.crear({
      cajaId: caja.value.cajaId,
      userId,
     tipo: tipoMovimientoParaForm(),
      concepto: movForm.value.concepto,
      descripcion: movForm.value.descripcion?.trim() || null,
      monto,
    })

    okMsg.value = "Movimiento registrado ✅"
    movForm.value.monto = ""
    movForm.value.descripcion = ""
    showMovModal.value = false

    emitCajaChanged()
    await refresh()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.response?.data ||
      e?.message ||
      "Error registrando movimiento."
  }
}

// =========================
// Lifecycle
// =========================
onMounted(() => {
  const saved = localStorage.getItem(turnoKey)
  if (saved === "MANIANA" || saved === "TARDE") selectedTurno.value = saved
  refresh()
})

watch(selectedTurno, (v) => localStorage.setItem(turnoKey, v))
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
      <div>
        <h1 class="h4 mb-1">Caja</h1>
        <div class="text-secondary small">
          User: <b>{{ userId }}</b>
        </div>

        <div class="d-flex gap-2 mt-2 flex-wrap align-items-end">
          <div>
            <label class="form-label text-secondary mb-1">Fecha</label>
            <input
              type="date"
              v-model="selectedFecha"
              class="form-control bg-dark text-white border-secondary"
              :disabled="loading"
            />
          </div>

          <div>
            <label class="form-label text-secondary mb-1">Turno</label>
            <select v-model="selectedTurno" class="form-control bg-dark text-white border-secondary" :disabled="Boolean(caja)">
              <option value="MANIANA">MAÑANA</option>
              <option value="TARDE">TARDE</option>
            </select>
          </div>
        </div>
      </div>

      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-light" @click="refresh" :disabled="loading">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>

        <RouterLink class="btn btn-sm btn-primary btn-accent" to="/caja/ventas">
          Ir a Ventas
        </RouterLink>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-lg-5">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-secondary small">Estado</div>

            <div v-if="caja?.cajaId" class="mt-2">
              <span class="badge text-bg-success">ABIERTA</span>
              <div class="text-secondary small mt-2">
                Caja ID: <b>{{ caja.cajaId }}</b>
              </div>

              <hr class="border-secondary my-3" />

              <div class="d-flex justify-content-between">
                <div class="text-secondary small">Monto inicial</div>
                <div class="fw-bold">$ {{ formatMoney(caja.montoInicial) }}</div>
              </div>

              <div class="d-flex justify-content-between mt-2">
                <div class="text-secondary small">Saldo actual (auto)</div>
                <div class="fw-bold">$ {{ formatMoney(saldoActual) }}</div>
              </div>
            </div>

            <div v-else class="mt-2 text-secondary">
              No hay caja abierta para esta fecha/turno.
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-7">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <h2 class="h6 mb-3">Acciones</h2>

            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label text-secondary">Monto inicial (abrir)</label>
                <input
                  v-model="abrirMontoInicial"
                  class="form-control bg-dark text-white border-secondary"
                  placeholder="Ej: 20000"
                  inputmode="numeric"
                  :disabled="loading"
                />
                <button
                  class="btn btn-primary btn-accent w-100 mt-2"
                  @click="abrirCaja"
                  :disabled="loading || !!caja?.cajaId"
                >
                  Abrir caja
                </button>
              </div>

              <div class="col-12 col-md-6">
  <label class="form-label text-secondary">Cierre / Arqueo</label>

  <div class="d-flex justify-content-between small text-secondary">
    <span>Esperado (auto)</span>
    <b>$ {{ formatMoney(saldoActual) }}</b>
  </div>

  <input
    v-model="montoContado"
    class="form-control bg-dark text-white border-secondary mt-2"
    placeholder="Contado (opcional) ej: 148000"
    inputmode="numeric"
    :disabled="loading || !caja?.cajaId"
  />

  <div class="d-flex justify-content-between small mt-2">
    <span class="text-secondary">Diferencia</span>

    <b
      v-if="diferencia !== null"
      :class="diferencia === 0 ? 'text-success' : (diferencia > 0 ? 'text-success' : 'text-danger')"
    >
      {{ diferencia > 0 ? "+" : "" }}$ {{ formatMoney(diferencia) }}
    </b>

    <span v-else class="text-secondary">—</span>
  </div>

  <button
    class="btn btn-outline-light w-100 mt-2"
    @click="cerrarCaja"
    :disabled="loading || !caja?.cajaId"
  >
    Cerrar caja
  </button>

  <div class="text-secondary small mt-2">
    Si cargás “Contado”, el sistema registra un AJUSTE automático si hay diferencia.
  </div>
</div>
            </div>

            <div class="d-flex gap-2 mt-3">
              <button
                class="btn btn-sm btn-primary btn-accent"
                :disabled="!caja?.cajaId"
                @click="showMovModal = true"
              >
                + Movimiento
              </button>
            </div>

            <div class="text-secondary small mt-3">
              Caja = dashboard por fecha/turno. Ventas = pantalla dedicada.
            </div>
          </div>
          <div class="text-secondary small mt-2">
  debug: loading={{ loading }} cajaId={{ caja?.cajaId ?? "null" }}
</div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm" v-if="caja?.cajaId">
      <div class="card-body">
        <h2 class="h6 mb-3">Últimos movimientos</h2>

        <div v-if="ultimosMovs.length === 0" class="text-secondary">
          No hay movimientos todavía.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 180px">Fecha</th>
                <th style="width: 110px">Tipo</th>
                <th style="width: 140px">Concepto</th>
                <th>Descripción</th>
                <th style="width: 140px" class="text-end">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in ultimosMovs" :key="m.movimientoCajaId ?? m.id">
                <td class="text-secondary">
                  {{ m.fecha ? new Date(m.fecha).toLocaleString("es-AR") : "—" }}
                </td>
                <td>
                  <span class="badge" :class="m.tipo === 'INGRESO' ? 'text-bg-success' : 'text-bg-danger'">
                    {{ m.tipo }}
                  </span>
                </td>
                <td class="text-secondary">{{ m.concepto ?? "—" }}</td>
                <td class="text-secondary">{{ m.descripcion ?? "—" }}</td>
                <td class="text-end fw-bold">$ {{ formatMoney(m.monto) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

   <!-- Modal movimiento -->
<div v-if="showMovModal" class="modal-backdrop" @click.self="showMovModal = false">
  <div class="modal-card">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div class="fw-bold">Nuevo movimiento</div>
      <button class="btn btn-sm btn-outline-light" @click="showMovModal = false">X</button>
    </div>

    <div class="row g-2">
      <!-- Concepto -->
      <div class="col-12">
        <label class="form-label text-secondary">Concepto</label>
        <select v-model="movForm.concepto" class="form-control bg-dark text-white border-secondary">
          <option value="GASTO">GASTO (egreso)</option>
          <option value="RETIRO">RETIRO (egreso)</option>
          <option value="APORTE">APORTE (ingreso)</option>
          <option value="AJUSTE">AJUSTE</option>
        </select>
      </div>

      <!-- Tipo de ajuste (solo si concepto = AJUSTE) -->
      <div class="col-12" v-if="movForm.concepto === 'AJUSTE'">
        <label class="form-label text-secondary">Tipo de ajuste</label>
        <select v-model="movForm.tipoManual" class="form-control bg-dark text-white border-secondary">
          <option value="INGRESO">INGRESO (suma)</option>
          <option value="EGRESO">EGRESO (resta)</option>
        </select>
      </div>

      <!-- Monto -->
      <div class="col-12">
        <label class="form-label text-secondary">Monto</label>
        <input
          v-model="movForm.monto"
          class="form-control bg-dark text-white border-secondary"
          inputmode="numeric"
        />
      </div>

      <!-- Descripción -->
      <div class="col-12">
        <label class="form-label text-secondary">Descripción</label>
        <input v-model="movForm.descripcion" class="form-control bg-dark text-white border-secondary" />
      </div>
    </div>

    <button class="btn btn-primary btn-accent w-100 mt-3" @click="crearMovimientoManual">
      Guardar
    </button>

    <div class="text-secondary small mt-2">
      Nota: ventas/pagos de proveedor generan movimientos automáticos.
    </div>
  </div>
</div>
  </div>
</template>

<style scoped>
.bg-panel{ background: rgba(18, 22, 32, .92); }
.btn-accent{ background: #6f5cff; border: none; }
.btn-accent:hover{ background: #5f4de6; }

.modal-backdrop{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 18px;
  z-index: 999;
}
.modal-card{
  width: 100%;
  max-width: 520px;
  background: rgba(18, 22, 32, .98);
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 18px 60px rgba(0,0,0,.45);
}
</style>
