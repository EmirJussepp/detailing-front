<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue"
import { getSession, isAdmin, getShift } from "../auth/session"
import { clientesApi } from "../services/clientesService"
import { ventasApi } from "../services/ventasApi"

import { cajaApi } from "../services/cajaApi"
import { movimientosCajaApi } from "../services/movimientosCajaApi"
import { metodosPagoApi } from "../services/metodopagoService"

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
function turnoUI(t) {
  const s = String(t ?? "").toUpperCase()
  if (s === "MANIANA" || s === "MAÑANA") return "MAÑANA"
  if (s === "TARDE") return "TARDE"
  return "MAÑANA"
}
function turnoBE(t) {
  return turnoUI(t) === "MAÑANA" ? "MANIANA" : "TARDE"
}
function resolveUserId(sess) {
  const v = sess?.userId
  const n = Number(v)
  if (Number.isFinite(n) && n > 0) return n
  return 1
}
function toMoneyNumber(v) {
  const x = Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(x) ? x : NaN
}
function formatDateTime(v) {
  if (!v) return "-"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

// =========================
// Session / permisos
// =========================
const session = getSession() ?? null
const admin = computed(() => Boolean(session && isAdmin()))
const userIdInt = computed(() => resolveUserId(session))

// =========================
// Filtros (fecha/turno)
// =========================
const fecha = ref(todayISO())
const turnoSel = ref("MAÑANA")

watch(
  admin,
  (isAdm) => {
    turnoSel.value = turnoUI(isAdm ? "MAÑANA" : getShift())
  },
  { immediate: true }
)

// =========================
// Estado UI
// =========================
const errorMsg = ref("")
const okMsg = ref("")
const loading = ref(false)

const cajaCheck = ref({ ok: false, error: "" })
const cajaAbierta = ref(null)

const movimientos = ref([])
const resumen = ref({ ingresos: 0, egresos: 0, saldo: 0 })



// =========================
// Métodos de pago (cache)
// =========================
const metodosPago = ref([])
const metodosLoaded = ref(false)

function normalizeMetodoPago(x) {
  return {
    id: Number(x?.metodoPagoId ?? x?.id ?? 0),
    nombre: String(x?.nombre ?? x?.name ?? "SIN NOMBRE"),
  }
}

async function fetchMetodosPagoOnce() {
  if (metodosLoaded.value) return
  try {
    const { data } = await metodosPagoApi.list()
    const arr = Array.isArray(data) ? data : []
    metodosPago.value = arr.map(normalizeMetodoPago).filter((m) => m.id > 0)
  } catch {
    metodosPago.value = []
  } finally {
    metodosLoaded.value = true
  }
}

function metodoNombreById(id) {
  const m = metodosPago.value.find((x) => Number(x.id) === Number(id))
  return m?.nombre ?? String(id ?? "-")
}

// ---- cache pro ----
const clientes = ref([])
const clientesLoaded = ref(false)

const clienteById = computed(() => {
  const m = new Map()
  for (const c of clientes.value) {
    const id = Number(c.id ?? c.clienteId)
    if (id) m.set(id, c)
  }
  return m
})

const ventaClienteCache = ref(new Map())
// ventaId -> { clienteId, clienteTxt }

async function fetchClientesOnce() {
  if (clientesLoaded.value) return
  try {
    const { data } = await clientesApi.list()
    clientes.value = Array.isArray(data) ? data : []
  } catch {
    clientes.value = []
  } finally {
    clientesLoaded.value = true
  }
}

function clienteTxtById(clienteId) {
  if (!clienteId) return "Mostrador"
  const c = clienteById.value.get(Number(clienteId))
  if (!c) return `Cliente #${clienteId}`
  const nombre = `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim()
  const dni = c.dni ? `DNI ${c.dni}` : null
  return [nombre || `Cliente #${clienteId}`, dni].filter(Boolean).join(" · ")
}

async function hydrateClienteFromVentaId(ventaId) {
  const vid = Number(ventaId)
  if (!Number.isFinite(vid) || vid <= 0) return
  if (ventaClienteCache.value.has(vid)) return

  try {
    const { data } = await ventasApi.porId(vid)
    const venta = data ?? null
    const clienteId = venta?.clienteId ?? null
    const clienteTxt = clienteTxtById(clienteId)

    ventaClienteCache.value.set(vid, { clienteId, clienteTxt })
  } catch {
    // fallback
    ventaClienteCache.value.set(vid, { clienteId: null, clienteTxt: `Venta #${vid}` })
  }
}


// =========================
// Fetch caja + movimientos
// =========================
async function refreshCaja() {
  try {
    const { data } = await cajaApi.abierta({
      fecha: fecha.value,
      turno: turnoBE(turnoSel.value),
      userId: userIdInt.value,
    })
    cajaAbierta.value = data ?? null
    cajaCheck.value = { ok: true, error: "" }
  } catch (e) {
    const status = e?.response?.status
    const msg = e?.response?.data?.message || e?.response?.data?.error || ""
    cajaAbierta.value = null

    if (status === 404 && String(msg).toLowerCase().includes("no hay caja abierta")) {
      cajaCheck.value = { ok: false, error: "No hay caja ABIERTA para esa fecha/turno." }
    } else {
      cajaCheck.value = { ok: false, error: msg || "Error consultando caja (backend)." }
    }
  }
}

async function refreshMovimientos() {
  movimientos.value = []
  resumen.value = { ingresos: 0, egresos: 0, saldo: 0 }

  if (!cajaAbierta.value?.cajaId) return

  await fetchClientesOnce() // ✅ importante

  try {
    const { data } = await movimientosCajaApi.porCajaId(cajaAbierta.value.cajaId)
    const arrRaw = Array.isArray(data) ? data : []

    // normalizo + ordeno
    const arr = arrRaw
      .map((m) => ({
        ...m,
        tipo: String(m.tipo ?? "").toUpperCase(),
        concepto: String(m.concepto ?? "").toUpperCase(),
        monto: Number(m.monto ?? 0) || 0,
        ventaId: m.ventaId ?? null,
      }))
      .sort((a, b) => new Date(b.fecha ?? 0) - new Date(a.fecha ?? 0))

    movimientos.value = arr

    // ✅ hidratar cliente por ventaId (solo las ventas)
    const ventaIds = [...new Set(arr.map(x => Number(x.ventaId)).filter(v => v > 0))]
    for (const vid of ventaIds) {
      await hydrateClienteFromVentaId(vid)
    }

    const ingresos = arr.filter(m => m.tipo === "INGRESO").reduce((a, m) => a + m.monto, 0)
    const egresos = arr.filter(m => m.tipo === "EGRESO").reduce((a, m) => a + m.monto, 0)
    const montoInicial = Number(cajaAbierta.value?.montoInicial ?? 0) || 0
    resumen.value = { ingresos, egresos, saldo: montoInicial + ingresos - egresos }
  } catch (e) {
    console.log("refreshMovimientos error:", e?.response?.status, e?.response?.data || e?.message)
  }
}


async function refreshAll() {
  errorMsg.value = ""
  okMsg.value = ""
  loading.value = true
  try {
    await fetchMetodosPagoOnce()
    await refreshCaja()
    await refreshMovimientos()
  } finally {
    loading.value = false
  }
}

const canUse = computed(() => cajaCheck.value?.ok === true && Boolean(cajaAbierta.value?.cajaId))

watch([fecha, turnoSel, admin], refreshAll, { immediate: true })

// ✅ escuchar cambios globales de caja
function onCajaChanged() {
  refreshAll()
}
onMounted(() => window.addEventListener("caja:changed", onCajaChanged))
onBeforeUnmount(() => window.removeEventListener("caja:changed", onCajaChanged))

// =========================
// Crear movimiento manual
// =========================
const formTipo = ref("EGRESO")
const formConcepto = ref("GASTO")
const formDescripcion = ref("")
const formMetodoPagoId = ref("")
const formMonto = ref("")
const creando = ref(false)

const conceptos = ["VENTA", "PAGO_PROVEEDOR", "GASTO", "RETIRO", "APORTE", "DEVOLUCION", "AJUSTE"]

async function crearMovimiento() {
  if (creando.value) return
  creando.value = true
  errorMsg.value = ""
  okMsg.value = ""

  try {
    if (!canUse.value) throw new Error(cajaCheck.value?.error || "No hay caja ABIERTA.")
    const monto = toMoneyNumber(formMonto.value)
    if (!Number.isFinite(monto) || monto <= 0) throw new Error("Monto inválido.")

    const payload = {
      cajaId: Number(cajaAbierta.value.cajaId),
      userId: Number(userIdInt.value),
      tipo: String(formTipo.value).toUpperCase(),
      concepto: String(formConcepto.value).toUpperCase(),
      descripcion: formDescripcion.value?.trim() || null,
      metodoPagoId: formMetodoPagoId.value ? Number(formMetodoPagoId.value) : null,
      monto,
    }

    await movimientosCajaApi.crear(payload)

    okMsg.value = `Movimiento creado ✅ (${payload.tipo} / ${payload.concepto}) $ ${formatMoney(payload.monto)}`
    formDescripcion.value = ""
    formMonto.value = ""
    formMetodoPagoId.value = ""

    window.dispatchEvent(new Event("caja:changed"))
    await refreshMovimientos()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.response?.data ||
      e?.message ||
      "Error creando movimiento."
  } finally {
    creando.value = false
  }
}

// =========================
// Filtros PRO
// =========================
const filtroTipo = ref("TODOS")
const filtroConcepto = ref("TODOS")
const filtroTexto = ref("")

const movimientosFiltrados = computed(() => {
  const txt = filtroTexto.value.trim().toLowerCase()
  return movimientos.value.filter((m) => {
    if (filtroTipo.value !== "TODOS" && m.tipo !== filtroTipo.value) return false
    if (filtroConcepto.value !== "TODOS" && m.concepto !== filtroConcepto.value) return false
    if (txt) {
      const desc = String(m.descripcion ?? "").toLowerCase()
      if (!desc.includes(txt)) return false
    }
    return true
  })
})

// Totales por concepto
const totalesPorConcepto = computed(() => {
  const map = new Map()
  for (const m of movimientosFiltrados.value) {
    const key = m.concepto || "SIN_CONCEPTO"
    const signed = m.tipo === "EGRESO" ? -m.monto : m.monto
    map.set(key, (map.get(key) ?? 0) + signed)
  }
  return Array.from(map.entries())
    .map(([concepto, total]) => ({ concepto, total }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
})

// KPIs
const kpiMovimientos = computed(() => movimientosFiltrados.value.length)
const kpiIngresosFiltrados = computed(() => movimientosFiltrados.value.filter((m) => m.tipo === "INGRESO").reduce((a, m) => a + m.monto, 0))
const kpiEgresosFiltrados = computed(() => movimientosFiltrados.value.filter((m) => m.tipo === "EGRESO").reduce((a, m) => a + m.monto, 0))
const kpiNetoFiltrado = computed(() => kpiIngresosFiltrados.value - kpiEgresosFiltrados.value)

// Export CSV
function exportCSV() {
  const rows = movimientosFiltrados.value.map((m) => ({
    id: m.movimientoId ?? m.id ?? "",
    fecha: m.fecha ?? "",
    tipo: m.tipo ?? "",
    concepto: m.concepto ?? "",
    descripcion: m.descripcion ?? "",
    metodoPagoId: m.metodoPagoId ?? "",
    monto: m.monto ?? 0,
  }))

  const header = Object.keys(rows[0] || { id: "", fecha: "", tipo: "", concepto: "", descripcion: "", metodoPagoId: "", monto: 0 })
  const csv = [
    header.join(";"),
    ...rows.map((r) => header.map((k) => `"${String(r[k] ?? "").replaceAll('"', '""')}"`).join(";")),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `movimientos_caja_${fecha.value}_${turnoBE(turnoSel.value)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// UI tabla
function rowClass(m) {
  if (m.tipo === "INGRESO") return "row-ingreso"
  if (m.tipo === "EGRESO") return "row-egreso"
  return ""
}
function signedMoney(m) {
  const sign = m.tipo === "EGRESO" ? "-" : "+"
  return `${sign}$ ${formatMoney(m.monto)}`
}
</script>

<template>
  <div class="container py-4">
    <div class="mb-3 d-flex flex-wrap justify-content-between align-items-end gap-2">
      <div>
        <h1 class="h4 mb-1">Movimientos de Caja</h1>
        <div class="text-secondary">
          <span v-if="admin">Vista ADMIN: podés elegir fecha y turno.</span>
          <span v-else>Vista CAJERO: solo tu turno ({{ turnoSel }}).</span>
        </div>
      </div>

      <button class="btn btn-outline-light" @click="refreshAll" :disabled="loading">
        {{ loading ? "Actualizando..." : "Refresh" }}
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Fecha</label>
            <input v-model="fecha" type="date" class="form-control bg-dark text-white border-secondary"
              :disabled="!admin" />
          </div>

          <div class="col-12 col-md-3" v-if="admin">
            <label class="form-label text-secondary">Turno</label>
            <select v-model="turnoSel" class="form-select bg-dark text-white border-secondary">
              <option value="MAÑANA">MAÑANA</option>
              <option value="TARDE">TARDE</option>
            </select>
          </div>

          <div class="col-12 col-md-3" v-else>
            <label class="form-label text-secondary">Turno</label>
            <input class="form-control bg-dark text-white border-secondary" :value="turnoSel" disabled />
          </div>

          <div class="col-12 col-md-6">
            <div v-if="loading" class="text-secondary small">Cargando…</div>

            <div v-else-if="!canUse" class="alert alert-warning py-2 mb-0">
              {{ cajaCheck.error }}
            </div>

            <div v-else class="small text-secondary">
              Caja ABIERTA ✅
              <span class="ms-2">
                · Ingresos: <b>$ {{ formatMoney(resumen.ingresos) }}</b>
                · Egresos: <b>$ {{ formatMoney(resumen.egresos) }}</b>
                · Saldo: <b>$ {{ formatMoney(resumen.saldo) }}</b>
              </span>
              <span class="ms-2 text-secondary">· Caja #{{ cajaAbierta?.cajaId }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="row g-3 mb-4" v-if="canUse">
      <div class="col-12 col-md-3">
        <div class="card bg-panel border-0 shadow-sm">
          <div class="card-body">
            <div class="text-secondary small">Movimientos (filtrados)</div>
            <div class="fs-4 fw-bold">{{ kpiMovimientos }}</div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-3">
        <div class="card bg-panel border-0 shadow-sm">
          <div class="card-body">
            <div class="text-secondary small">Ingresos (filtrados)</div>
            <div class="fs-4 fw-bold">$ {{ formatMoney(kpiIngresosFiltrados) }}</div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-3">
        <div class="card bg-panel border-0 shadow-sm">
          <div class="card-body">
            <div class="text-secondary small">Egresos (filtrados)</div>
            <div class="fs-4 fw-bold">$ {{ formatMoney(kpiEgresosFiltrados) }}</div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-3">
        <div class="card bg-panel border-0 shadow-sm">
          <div class="card-body">
            <div class="text-secondary small">Neto (filtrado)</div>
            <div class="fs-4 fw-bold">$ {{ formatMoney(kpiNetoFiltrado) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Crear movimiento -->
    <div class="card bg-panel border-0 shadow-sm mb-4" v-if="canUse">
      <div class="card-body">
        <h2 class="h6 mb-3">Crear movimiento manual</h2>

        <div class="row g-3">
          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Tipo</label>
            <select v-model="formTipo" class="form-select bg-dark text-white border-secondary">
              <option value="INGRESO">INGRESO</option>
              <option value="EGRESO">EGRESO</option>
            </select>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Concepto</label>
            <select v-model="formConcepto" class="form-select bg-dark text-white border-secondary">
              <option v-for="c in conceptos" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Método de pago (opcional)</label>
            <select v-model="formMetodoPagoId" class="form-select bg-dark text-white border-secondary">
              <option value="">—</option>
              <option v-for="m in metodosPago" :key="m.id" :value="String(m.id)">{{ m.nombre }}</option>
            </select>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Monto</label>
            <input v-model="formMonto" class="form-control bg-dark text-white border-secondary"
              placeholder="Ej: 1500" />
          </div>

          <div class="col-12">
            <label class="form-label text-secondary">Descripción (opcional)</label>
            <input v-model="formDescripcion" class="form-control bg-dark text-white border-secondary"
              placeholder="Ej: compra insumos / retiro caja / aporte inicial" />
          </div>
        </div>

        <div class="d-flex justify-content-end mt-3">
          <button class="btn btn-primary btn-accent" @click="crearMovimiento" :disabled="creando">
            {{ creando ? "Guardando..." : "Crear movimiento" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Listado + filtros -->
    <div class="card bg-panel border-0 shadow-sm" v-if="canUse">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <h2 class="h6 mb-0">Movimientos del turno</h2>

          <div class="d-flex gap-2">
            <button class="btn btn-outline-light btn-sm" @click="exportCSV" :disabled="!movimientosFiltrados.length">
              Exportar CSV
            </button>
          </div>
        </div>

        <div class="row g-2 mb-3">
          <div class="col-md-3">
            <select v-model="filtroTipo" class="form-select bg-dark text-white border-secondary">
              <option value="TODOS">Todos</option>
              <option value="INGRESO">Solo ingresos</option>
              <option value="EGRESO">Solo egresos</option>
            </select>
          </div>

          <div class="col-md-3">
            <select v-model="filtroConcepto" class="form-select bg-dark text-white border-secondary">
              <option value="TODOS">Todos los conceptos</option>
              <option v-for="c in conceptos" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <div class="col-md-6">
            <input v-model="filtroTexto" class="form-control bg-dark text-white border-secondary"
              placeholder="Buscar en descripción..." />
          </div>
        </div>

        <div v-if="totalesPorConcepto.length" class="mb-3">
          <div class="text-secondary small mb-2">Totales por concepto (filtrados)</div>
          <div class="d-flex flex-wrap gap-2">
            <span v-for="t in totalesPorConcepto" :key="t.concepto" class="badge bg-dark border border-secondary"
              style="padding: 8px 10px;">
              <span class="text-secondary">{{ t.concepto }}</span>
              <span class="ms-2 fw-bold">$ {{ formatMoney(t.total) }}</span>
            </span>
          </div>
        </div>

        <div v-if="!movimientosFiltrados.length" class="text-secondary small">
          No hay movimientos con esos filtros.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
  <tr>
    <th style="width: 90px">ID</th>
    <th style="width: 170px">Fecha</th>
    <th style="width: 90px">Venta</th>
    <th style="width: 260px">Cliente</th>
    <th style="width: 110px">Tipo</th>
    <th style="width: 160px">Concepto</th>
    <th>Descripción</th>
    <th style="width: 160px">Método</th>
    <th style="width: 170px" class="text-end">Monto</th>
  </tr>
</thead>
<tbody>
  <tr v-for="m in movimientosFiltrados" :key="m.movimientoCajaId ?? m.movimientoId ?? m.id" :class="rowClass(m)">
    <!-- ID movimiento -->
    <td class="text-secondary">{{ m.movimientoCajaId ?? m.movimientoId ?? m.id ?? "-" }}</td>

    <!-- Fecha -->
    <td class="text-secondary">{{ formatDateTime(m.fecha) }}</td>

    <!-- Venta -->
    <td class="text-secondary">
      <span v-if="m.ventaId">#{{ m.ventaId }}</span>
      <span v-else>-</span>
    </td>

    <!-- Cliente -->
    <td class="text-secondary">
      <span v-if="m.ventaId">
        {{ ventaClienteCache.get(Number(m.ventaId))?.clienteTxt || "Cargando…" }}
      </span>
      <span v-else>-</span>
    </td>

    <!-- Tipo -->
    <td>
      <span class="badge" :class="m.tipo === 'INGRESO' ? 'bg-success' : 'bg-danger'">
        {{ m.tipo }}
      </span>
    </td>

    <!-- Concepto -->
    <td class="text-secondary">{{ m.concepto || "-" }}</td>

    <!-- Descripción -->
    <td class="text-secondary">{{ m.descripcion ?? "-" }}</td>

    <!-- Método -->
    <td class="text-secondary">
      {{ m.metodoPagoId ? metodoNombreById(m.metodoPagoId) : "-" }}
    </td>

    <!-- Monto -->
    <td class="text-end fw-bold">{{ signedMoney(m) }}</td>
  </tr>
</tbody>
          </table>
        </div>

        <div class="text-secondary small mt-2">
          Ingresos: <b>$ {{ formatMoney(resumen.ingresos) }}</b> ·
          Egresos: <b>$ {{ formatMoney(resumen.egresos) }}</b> ·
          Saldo: <b>$ {{ formatMoney(resumen.saldo) }}</b>
        </div>
      </div>
    </div>

    <div v-else class="text-secondary">
      Abrí una caja (o elegí un turno con caja ABIERTA) para ver movimientos.
    </div>
  </div>
</template>

<style scoped>
.bg-panel {
  background: rgba(18, 22, 32, .92);
}

.row-ingreso td {
  background: rgba(25, 135, 84, 0.08) !important;
}

.row-egreso td {
  background: rgba(220, 53, 69, 0.08) !important;
}

.table-dark.table-hover tbody tr:hover td {
  filter: brightness(1.05);
}
</style>
