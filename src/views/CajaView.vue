<script setup>
import { computed, ref, onMounted, watch } from "vue"
import { RouterLink } from "vue-router"
import { getSession } from "../auth/session"
import { emitCajaChanged } from "../ui/cajaEvents"
import { cajaApi } from "../services/cajaApi"
import { movimientosCajaApi } from "../services/movimientosCajaApi"
import { getTurnoOperativo, setTurnoOperativo } from "../ui/turnoOperativo"

// =========================
// Session
// =========================
const session = getSession() ?? null
const userId = Number(session?.userId ?? 0)
const permissions = Array.isArray(session?.permissions) ? session.permissions : []

function hasPermission(permission) {
  if (permissions.includes("admin:all")) return true
  return permissions.includes(permission)
}

const canViewCaja = computed(() => hasPermission("caja:ver"))
const canAbrirCajaPerm = computed(() => hasPermission("caja:abrir"))
const canCerrarCajaPerm = computed(() => hasPermission("caja:cerrar"))
const canCrearMovimientoPerm = computed(() => hasPermission("movimientos_caja:crear"))
const isAdmin = computed(() => permissions.includes("admin:all"))

// =========================
// Helpers
// =========================
function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function toMoneyNumber(v) {
  const x = Number(String(v ?? "").replace(",", ".").replace(/[^\d.-]/g, ""))
  return Number.isFinite(x) ? x : NaN
}

function safeDateLabel(v) {
  if (!v) return "—"
  try {
    const text = String(v).includes("T") ? String(v) : `${v}T00:00:00`
    return new Date(text).toLocaleString("es-AR")
  } catch {
    return String(v)
  }
}

function tipoPorConcepto(concepto) {
  if (concepto === "GASTO" || concepto === "RETIRO") return "EGRESO"
  if (concepto === "APORTE") return "INGRESO"
  return "EGRESO"
}

function badgeTipoClass(tipo) {
  return String(tipo || "").toUpperCase() === "INGRESO"
    ? "text-bg-success"
    : "text-bg-danger"
}

// =========================
// Turno
// =========================
const selectedTurno = ref(getTurnoOperativo())

// =========================
// UI State
// =========================
const loading = ref(false)
const errorMsg = ref("")
const okMsg = ref("")
const infoMsg = ref("")

const caja = ref(null)
const saldoActual = ref(0)
const movimientos = ref([])

const abrirMontoInicial = ref("")
const montoContado = ref("")

const showMovModal = ref(false)
const movForm = ref({
  concepto: "GASTO",
  tipoManual: "EGRESO",
  monto: "",
  descripcion: "",
})

function tipoMovimientoParaForm() {
  if (movForm.value.concepto === "AJUSTE") return movForm.value.tipoManual
  return tipoPorConcepto(movForm.value.concepto)
}

// =========================
// Derived
// =========================
const movimientosOrdenados = computed(() => {
  const arr = Array.isArray(movimientos.value) ? [...movimientos.value] : []
  arr.sort((a, b) => {
    const da = new Date(a?.fecha ?? 0).getTime()
    const db = new Date(b?.fecha ?? 0).getTime()
    return db - da
  })
  return arr
})

const ultimosMovs = computed(() => movimientosOrdenados.value.slice(0, 12))

const kpiIngresos = computed(() => {
  return movimientosOrdenados.value
    .filter((m) => String(m?.tipo || "").toUpperCase() === "INGRESO")
    .reduce((acc, m) => acc + Number(m?.monto ?? 0), 0)
})

const kpiEgresos = computed(() => {
  return movimientosOrdenados.value
    .filter((m) => String(m?.tipo || "").toUpperCase() === "EGRESO")
    .reduce((acc, m) => acc + Number(m?.monto ?? 0), 0)
})

const kpiVentas = computed(() => {
  return movimientosOrdenados.value
    .filter((m) => String(m?.concepto || "").toUpperCase() === "VENTA")
    .reduce((acc, m) => acc + Number(m?.monto ?? 0), 0)
})

const kpiPagosProveedor = computed(() => {
  return movimientosOrdenados.value
    .filter((m) => String(m?.concepto || "").toUpperCase() === "PAGO_PROVEEDOR")
    .reduce((acc, m) => acc + Number(m?.monto ?? 0), 0)
})

const contadoNum = computed(() => toMoneyNumber(montoContado.value))

const diferencia = computed(() => {
  const c = contadoNum.value
  if (!Number.isFinite(c)) return null
  return c - Number(saldoActual.value ?? 0)
})

const canAbrir = computed(() => {
  return canAbrirCajaPerm.value && !caja.value?.cajaId && !loading.value
})

const canCerrar = computed(() => {
  return canCerrarCajaPerm.value && !!caja.value?.cajaId && !loading.value
})

const puedeRegistrarMovimiento = computed(() => {
  return canCrearMovimientoPerm.value && !!caja.value?.cajaId && !loading.value
})

const esResponsableCaja = computed(() => {
  return Number(caja.value?.userId ?? 0) === userId
})

const cierreHint = computed(() => {
  if (!caja.value?.cajaId) return "No hay caja abierta."
  if (isAdmin.value) return "Como ADMIN podés cerrar cualquier caja."
  if (esResponsableCaja.value) return "Podés cerrar esta caja porque sos el responsable."
  return "Solo el responsable o un ADMIN pueden cerrar esta caja."
})

// =========================
// Data
// =========================
async function loadMovimientos() {
  if (!caja.value?.cajaId) {
    movimientos.value = []
    return
  }

  const { data } = await movimientosCajaApi.porCajaId(caja.value.cajaId)
  movimientos.value = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : Array.isArray(data?.items)
        ? data.items
        : []
}

async function refresh() {
  loading.value = true
  errorMsg.value = ""
  infoMsg.value = ""

  try {
    const { data } = await cajaApi.abierta({
      turno: selectedTurno.value,
    })

    caja.value = data ?? null

    if (!caja.value?.cajaId) {
      saldoActual.value = 0
      movimientos.value = []
      infoMsg.value = "No hay caja abierta para este turno."
      return
    }

    const { data: saldoDto } = await cajaApi.saldo(caja.value.cajaId)
    saldoActual.value = Number(saldoDto?.saldoActual ?? 0)

    try {
      await loadMovimientos()
    } catch {
      movimientos.value = []
    }
  } catch (e) {
    if (e?.response?.status === 404) {
      caja.value = null
      saldoActual.value = 0
      movimientos.value = []
      infoMsg.value = "No hay caja abierta para este turno."
    } else if (e?.response?.status === 403) {
      caja.value = null
      saldoActual.value = 0
      movimientos.value = []
      errorMsg.value = "No tenés permisos para ver Caja."
    } else {
      caja.value = null
      saldoActual.value = 0
      movimientos.value = []
      errorMsg.value =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Error consultando la caja."
    }
  } finally {
    loading.value = false
  }
}

// =========================
// Actions
// =========================
async function abrirCaja() {
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  const monto = toMoneyNumber(abrirMontoInicial.value)
  if (!Number.isFinite(monto) || monto < 0) {
    errorMsg.value = "Ingresá un monto inicial válido."
    return
  }

  try {
    await cajaApi.abrir({
      turno: selectedTurno.value,
      montoInicial: monto,
    })

    okMsg.value = "Caja abierta ✅"
    abrirMontoInicial.value = ""
    emitCajaChanged()
    await refresh()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error abriendo caja."
  }
}

async function cerrarCaja() {
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  if (!caja.value?.cajaId) {
    errorMsg.value = "No hay caja ABIERTA para cerrar."
    return
  }

  const contado = toMoneyNumber(montoContado.value)
  const hayContado = Number.isFinite(contado)

  try {
    if (hayContado) {
      const esperado = Number(saldoActual.value ?? 0)
      const diff = contado - esperado

      if (Math.abs(diff) >= 0.01) {
        await movimientosCajaApi.crear({
  cajaId: caja.value.cajaId,
  concepto: "AJUSTE",
  tipo: diff > 0 ? "INGRESO" : "EGRESO",
  monto: Math.abs(diff),
  descripcion: `Arqueo cierre (contado: ${contado} / esperado: ${esperado})`,
})
      }
    }

    await refresh()

    await cajaApi.cerrar(caja.value.cajaId, {
      montoContado: hayContado ? contado : null,
      observacion: hayContado ? "Cierre con arqueo" : "Cierre sin arqueo informado",
    })

    okMsg.value = hayContado
      ? `Caja cerrada ✅ (contado: $ ${formatMoney(contado)})`
      : "Caja cerrada ✅"

    montoContado.value = ""
    emitCajaChanged()
    await refresh()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error cerrando caja."
  }
}

async function crearMovimientoManual() {
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

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
  tipo: tipoMovimientoParaForm(),
  concepto: movForm.value.concepto,
  descripcion: movForm.value.descripcion?.trim() || null,
  monto,
})

    okMsg.value = "Movimiento registrado ✅"
    movForm.value = {
      concepto: "GASTO",
      tipoManual: "EGRESO",
      monto: "",
      descripcion: "",
    }

    showMovModal.value = false
    emitCajaChanged()
    await refresh()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error registrando movimiento."
  }
}

// =========================
// Lifecycle
// =========================
watch(selectedTurno, async (v) => {
  setTurnoOperativo(v)
  await refresh()
})

onMounted(async () => {
  selectedTurno.value = getTurnoOperativo()

  if (canViewCaja.value) {
    await refresh()
  } else {
    errorMsg.value = "No tenés permisos para acceder a Caja."
  }
})
</script>

<template>
  <div class="caja-page">
    <div class="d-flex align-items-start justify-content-between gap-3 mb-3 flex-wrap">
      <div>
        <h1 class="h4 mb-1">Caja (POS)</h1>

        <div class="text-secondary small">
          Usuario: <b>{{ userId }}</b> · Hoy: <b>{{ todayISO() }}</b>
        </div>

      <div class="d-flex gap-2 mt-2 flex-wrap align-items-end">
  <div>
    <label class="form-label text-secondary mb-1">Turno</label>

    <select
      v-model="selectedTurno"
      class="form-control bg-dark text-white border-secondary"
      :disabled="Boolean(caja?.cajaId) || loading"
    >
      <option value="MANIANA">MAÑANA</option>
      <option value="TARDE">TARDE</option>
    </select>

    <div class="text-secondary small mt-1" v-if="caja?.cajaId">
      Turno bloqueado mientras la caja está abierta.
    </div>
  </div>
</div>
      </div>

      <div class="d-flex gap-2 flex-wrap align-items-center">
        <button class="btn btn-sm btn-outline-light" @click="refresh" :disabled="loading || !canViewCaja">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>

        <RouterLink class="btn btn-sm btn-outline-light" to="/movimientos-caja">
          Movimientos
        </RouterLink>

        <RouterLink class="btn btn-sm btn-outline-light" to="/compras">
          Compras
        </RouterLink>

        <RouterLink class="btn btn-sm btn-primary btn-accent" to="/ventas">
          Ventas
        </RouterLink>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>
    <div v-if="infoMsg" class="alert alert-secondary py-2">{{ infoMsg }}</div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-lg-4">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-secondary small">Estado</div>

            <div v-if="caja?.cajaId" class="mt-2">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="badge text-bg-success">ABIERTA</span>
                <span class="badge text-bg-dark border">Turno {{ caja.turno }}</span>
              </div>

              <div class="text-secondary small mt-2">Caja ID: <b>{{ caja.cajaId }}</b></div>
              <div class="text-secondary small">Responsable: <b>{{ caja.userId }}</b></div>
              <div class="text-secondary small">
                Apertura: <b>{{ safeDateLabel(caja.apertura || caja.fecha) }}</b>
              </div>

              <div class="text-secondary small mt-2">
                {{ cierreHint }}
              </div>

              <hr class="border-secondary my-3" />

              <div class="d-flex justify-content-between">
                <div class="text-secondary small">Monto inicial</div>
                <div class="fw-bold">$ {{ formatMoney(caja.montoInicial) }}</div>
              </div>

              <div class="d-flex justify-content-between mt-2">
                <div class="text-secondary small">Saldo actual</div>
                <div class="fw-bold">$ {{ formatMoney(saldoActual) }}</div>
              </div>
            </div>

            <div v-else class="mt-2 text-secondary">
              No hay caja abierta para <b>{{ selectedTurno === "MANIANA" ? "MAÑANA" : "TARDE" }}</b>.
              <div class="text-secondary small mt-1">
                Abrí caja para comenzar a operar el turno.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-8">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between flex-wrap gap-2 align-items-center mb-2">
              <h2 class="h6 mb-0">Resumen del turno</h2>
              <div class="text-secondary small">Basado en movimientos de caja</div>
            </div>

            <div class="row g-2">
              <div class="col-6 col-md-3">
                <div class="kpi">
                  <div class="kpi-label">Ingresos</div>
                  <div class="kpi-value text-success">$ {{ formatMoney(kpiIngresos) }}</div>
                </div>
              </div>

              <div class="col-6 col-md-3">
                <div class="kpi">
                  <div class="kpi-label">Egresos</div>
                  <div class="kpi-value text-danger">$ {{ formatMoney(kpiEgresos) }}</div>
                </div>
              </div>

              <div class="col-6 col-md-3">
                <div class="kpi">
                  <div class="kpi-label">Ventas</div>
                  <div class="kpi-value">$ {{ formatMoney(kpiVentas) }}</div>
                </div>
              </div>

              <div class="col-6 col-md-3">
                <div class="kpi">
                  <div class="kpi-label">Pagos prov.</div>
                  <div class="kpi-value">$ {{ formatMoney(kpiPagosProveedor) }}</div>
                </div>
              </div>
            </div>

            <hr class="border-secondary my-3" />

            <h2 class="h6 mb-3">Operación del turno</h2>

            <div class="row g-3">
              <div class="col-12 col-md-6">
  <template v-if="!caja?.cajaId">
    <label class="form-label text-secondary">Monto inicial</label>
    <input
      v-model="abrirMontoInicial"
      class="form-control bg-dark text-white border-secondary"
      placeholder="Ej: 20000"
      inputmode="numeric"
      :disabled="loading || !canAbrirCajaPerm"
    />

    <button
      class="btn btn-primary btn-accent w-100 mt-2"
      @click="abrirCaja"
      :disabled="!canAbrir"
    >
      Abrir caja
    </button>

    <div class="text-secondary small mt-2">
      Se abrirá una única caja para el turno seleccionado.
    </div>
  </template>

  <template v-else>
    <label class="form-label text-secondary">Caja operativa</label>
    <div class="form-control bg-dark text-white border-secondary d-flex align-items-center">
      Caja abierta en turno {{ caja.turno === "MANIANA" ? "MAÑANA" : "TARDE" }}
    </div>

    <div class="text-secondary small mt-2">
      La apertura ya fue realizada. Podés seguir operando o cerrar la caja.
    </div>
  </template>
</div>
              <div class="col-12 col-md-6">
                <label class="form-label text-secondary">Cierre / Arqueo</label>

                <div class="d-flex justify-content-between small text-secondary">
                  <span>Esperado</span>
                  <b>$ {{ formatMoney(saldoActual) }}</b>
                </div>

                <input
                  v-model="montoContado"
                  class="form-control bg-dark text-white border-secondary mt-2"
                  placeholder="Contado (opcional)"
                  inputmode="numeric"
                  :disabled="loading || !caja?.cajaId || !canCerrarCajaPerm"
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
                  :disabled="!canCerrar"
                >
                  Cerrar caja
                </button>

                <div class="text-secondary small mt-2">
                  Si cargás el contado y hay diferencia, se registra un <b>AJUSTE</b> automático antes del cierre.
                </div>
              </div>
            </div>

            <div class="d-flex gap-2 mt-3 flex-wrap">
              <button
                class="btn btn-sm btn-primary btn-accent"
                :disabled="!puedeRegistrarMovimiento"
                @click="showMovModal = true"
              >
                + Movimiento manual
              </button>

              <RouterLink
                class="btn btn-sm btn-outline-light"
                :class="{ disabled: !caja?.cajaId }"
                to="/movimientos-caja"
              >
                Ver historial completo
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm" v-if="caja?.cajaId">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3">
          <h2 class="h6 mb-0">Últimos movimientos</h2>
          <div class="text-secondary small">
            {{ ultimosMovs.length }} registro(s) recientes
          </div>
        </div>

        <div v-if="ultimosMovs.length === 0" class="text-secondary">
          No hay movimientos todavía.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 180px">Fecha</th>
                <th style="width: 110px">Tipo</th>
                <th style="width: 150px">Concepto</th>
                <th>Descripción</th>
                <th style="width: 140px" class="text-end">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in ultimosMovs" :key="m.movimientoCajaId ?? m.id">
                <td class="text-secondary">{{ safeDateLabel(m.fecha) }}</td>
                <td>
                  <span class="badge" :class="badgeTipoClass(m.tipo)">
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

        <div class="text-secondary small mt-2">
          Las ventas y pagos a proveedor deberían impactar caja automáticamente desde sus módulos.
        </div>
      </div>
    </div>

    <div v-if="showMovModal" class="modal-backdrop" @click.self="showMovModal = false">
      <div class="modal-card">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="fw-bold">Nuevo movimiento manual</div>
          <button class="btn btn-sm btn-outline-light" @click="showMovModal = false">X</button>
        </div>

        <div class="row g-2">
          <div class="col-12">
            <label class="form-label text-secondary">Concepto</label>
            <select v-model="movForm.concepto" class="form-control bg-dark text-white border-secondary">
              <option value="GASTO">GASTO (egreso)</option>
              <option value="RETIRO">RETIRO (egreso)</option>
              <option value="APORTE">APORTE (ingreso)</option>
              <option value="AJUSTE">AJUSTE</option>
            </select>
            <div class="text-secondary small mt-1">
              VENTA y PAGO_PROVEEDOR deben generarse automáticamente desde sus módulos.
            </div>
          </div>

          <div class="col-12" v-if="movForm.concepto === 'AJUSTE'">
            <label class="form-label text-secondary">Tipo de ajuste</label>
            <select v-model="movForm.tipoManual" class="form-control bg-dark text-white border-secondary">
              <option value="INGRESO">INGRESO (suma)</option>
              <option value="EGRESO">EGRESO (resta)</option>
            </select>
          </div>

          <div class="col-12">
            <label class="form-label text-secondary">Monto</label>
            <input
              v-model="movForm.monto"
              class="form-control bg-dark text-white border-secondary"
              inputmode="numeric"
            />
          </div>

          <div class="col-12">
            <label class="form-label text-secondary">Descripción</label>
            <input
              v-model="movForm.descripcion"
              class="form-control bg-dark text-white border-secondary"
              placeholder="Opcional"
            />
          </div>
        </div>

        <button class="btn btn-primary btn-accent w-100 mt-3" @click="crearMovimientoManual">
          Guardar movimiento
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.caja-page {
  min-height: 100%;
}

.bg-panel {
  background: rgba(18, 22, 32, 0.92);
}

.btn-accent {
  background: #6f5cff;
  border: none;
}

.btn-accent:hover {
  background: #5f4de6;
}

.kpi {
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(0,0,0,.15);
}

.kpi-label {
  color: rgba(255,255,255,.65);
  font-size: 12px;
}

.kpi-value {
  font-weight: 800;
  font-size: 16px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 999;
}

.modal-card {
  width: 100%;
  max-width: 520px;
  background: rgba(18, 22, 32, .98);
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 18px 60px rgba(0,0,0,.45);
}
</style>