<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { getSession, isAdmin, getShift } from "../auth/session"

import { clientesApi } from "../services/clientesApi"
import { productosApi } from "../services/productosApi"
import { ventasApi } from "../services/ventasApi"
import { cajaApi } from "../services/cajaApi"
import { movimientosCajaApi } from "../services/movimientosCajaApi"
import { metodosPagoApi } from "../services/metodopagoService"
import Pager from "../components/Pager.vue"

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
  const x = Number(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, ""))
  return Number.isFinite(x) ? x : NaN
}
function formatDateTime(v) {
  if (!v) return "-"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function safeId(x) {
  const n = Number(x ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
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

const page = ref(0)
const size = ref(10)
const totalElements = ref(0)
const totalPages = ref(1)

// =========================
// Métodos de pago
// =========================
const metodosPago = ref([])
const metodosLoaded = ref(false)

function normalizeMetodoPago(x) {
  return {
    id: safeId(x?.metodoPagoId ?? x?.id),
    nombre: String(x?.nombre ?? x?.name ?? x?.descripcion ?? "SIN NOMBRE"),
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
  const mid = safeId(id)
  const m = metodosPago.value.find((x) => Number(x.id) === mid)
  return m?.nombre ?? (mid ? `#${mid}` : "-")
}

// =========================
// Productos cache (para nombres en detalle venta)
// =========================
const productosById = ref(new Map())
const productosLoaded = ref(false)

function unwrapPage(data) {
  if (Array.isArray(data)) {
    return {
      content: data,
      page: 0,
      size: data.length || 10,
      totalElements: data.length,
      totalPages: 1,
    }
  }

  return {
    content: Array.isArray(data?.content) ? data.content : [],
    page: Number(data?.page ?? data?.number ?? 0),
    size: Number(data?.size ?? 10),
    totalElements: Number(data?.totalElements ?? data?.total ?? 0),
    totalPages: Number(data?.totalPages ?? 1),
  }
}

async function fetchProductosOnce() {
  if (productosLoaded.value) return
  try {
    const { data } = await productosApi.list({ page: 0, size: 1000, search: "" })
    const arr = unwrapPage(data).content
    const m = new Map()
    for (const p of arr) {
      const id = safeId(p?.productoId ?? p?.id)
      if (id) m.set(id, String(p?.nombre ?? `Prod #${id}`))
    }
    productosById.value = m
  } catch {
    productosById.value = new Map()
  } finally {
    productosLoaded.value = true
  }
}


// =========================
// Cache clientes (para mostrar nombre)
// =========================
const clientes = ref([])
const clientesLoaded = ref(false)

function mapCliente(c) {
  return {
    id: safeId(c?.clienteId ?? c?.id),
    nombre: c?.nombre ?? "",
    apellido: c?.apellido ?? "",
    dni: c?.dni ?? null,
    activo: c?.activo ?? true,
  }
}

const clienteById = computed(() => {
  const m = new Map()
  for (const c of clientes.value) {
    const id = safeId(c.id)
    if (id) m.set(id, c)
  }
  return m
})


function clienteTxtById(clienteId) {
  const cid = safeId(clienteId)
  if (!cid) return "Mostrador"

  const c = clienteById.value.get(cid)
  if (!c) return `Cliente #${cid}`

  const nombre = `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim()
  const dni = c.dni ? `DNI ${c.dni}` : null
  return [nombre || `Cliente #${cid}`, dni].filter(Boolean).join(" · ")
}

function pickClienteIdFromVenta(venta) {
  const v = venta ?? {}

  const raw =
    v.clienteId ??
    v.cliente_id ??
    v.clienteID ??
    v.cliente?.clienteId ??
    v.cliente?.id ??
    v.cliente?.cliente_id ??
    v.clienteIdStr ?? // por si viene raro
    null

  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

// =========================
// Cache ventas → info (cliente + items + total)
// =========================
const ventaInfoCache = ref({})
// { [ventaId]: { clienteId, clienteTxt, total, itemsTxt } }

async function hydrateVentaInfoFromVentaId(ventaId) {
  const vid = safeId(ventaId)
  if (!vid) return
  if (ventaInfoCache.value[vid]) return

  try {
    const { data } = await ventasApi.porId(vid)

    // ✅ a veces el back devuelve { venta: {...} } o { ventaActualizada: {...} }
    const venta = data?.venta ?? data?.ventaActualizada ?? data ?? null

    const clienteId = pickClienteIdFromVenta(venta)

    const detalles =
      venta?.detallesVenta ??
      venta?.detalles ??
      venta?.items ??
      venta?.detalleVenta ??
      []

    const itemsTxt = Array.isArray(detalles)
      ? detalles
          .map((d) => {
            const cant = Number(d.cantidad ?? d.qty ?? 0) || 0
            const pid = safeId(d.productoId ?? d.producto_id)
            const nombre =
              d.productoNombre ??
              d.producto?.nombre ??
              d.nombreProducto ??
              productosById.value.get(pid) ??
              (pid ? `Prod #${pid}` : "Producto")

            return cant > 0 ? `${cant}× ${nombre}` : nombre
          })
          .filter(Boolean)
          .slice(0, 4)
          .join(" · ")
      : ""

    const total = Number(venta?.total ?? 0) || 0

    ventaInfoCache.value = {
  ...ventaInfoCache.value,
  [vid]: { clienteId, total, itemsTxt },
}
  } catch {
    ventaInfoCache.value = {
  ...ventaInfoCache.value,
  [vid]: { clienteId: null, total: 0, itemsTxt: "" },
}
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

    if (status === 404) {
      cajaCheck.value = { ok: false, error: "No hay caja ABIERTA para esa fecha/turno." }
    } else {
      cajaCheck.value = { ok: false, error: msg || "Error consultando caja (backend)." }
    }
  }
}
function onPageChange(newPage) {
  page.value = Number(newPage)
  refreshMovimientos()
}

function onSizeChange(newSize) {
  size.value = Number(newSize)
  page.value = 0
  refreshMovimientos()
}

function pickFecha(m) {
  if (!m) return null

  // 1) keys típicas (agregué muchas)
  const candidates = [
    m.fecha,
    m.fechaHora,
    m.fecha_hora,
    m.fechaMovimiento,
    m.fecha_movimiento,
    m.fechaCreacion,
    m.fecha_creacion,
    m.creadoEn,
    m.creado_en,
    m.createdAt,
    m.created_at,
    m.updatedAt,
    m.updated_at,
    m.timestamp,
  ].filter(Boolean)

  for (const c of candidates) {
    const iso = normalizeFecha(c)
    if (iso) return iso
  }

  // 2) fallback: buscar cualquier key que incluya "fecha" o "date" o "time"
  for (const [k, v] of Object.entries(m)) {
    const kk = k.toLowerCase()
    if (kk.includes("fecha") || kk.includes("date") || kk.includes("time")) {
      const iso = normalizeFecha(v)
      if (iso) return iso
    }
  }

  return null
}

function normalizeFecha(v) {
  if (!v) return null

  // string ISO o similar
  if (typeof v === "string") {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  // number timestamp
  if (typeof v === "number") {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  // objetos raros tipo { value: "..."} o { iso: "..."} o Kotlin serializado
  if (typeof v === "object") {
    const maybe =
      v.iso ??
      v.value ??
      v.dateTime ??
      v.datetime ??
      v.fecha ??
      v.timestamp ??
      null

    if (typeof maybe === "string" || typeof maybe === "number") {
      const d = new Date(maybe)
      return Number.isNaN(d.getTime()) ? null : d.toISOString()
    }

    // último fallback
    const s = String(v)
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  return null
}

async function refreshMovimientos() {
  movimientos.value = []
  resumen.value = { ingresos: 0, egresos: 0, saldo: 0 }
  totalElements.value = 0
  totalPages.value = 1

  if (!cajaAbierta.value?.cajaId) return

  await Promise.all([fetchClientesOnce(), fetchProductosOnce()])

  try {
    const { data } = await movimientosCajaApi.list({
      page: page.value,
      size: size.value,
      cajaId: cajaAbierta.value.cajaId,
      fecha: fecha.value,
      turno: turnoBE(turnoSel.value),
      userId: userIdInt.value,
    })

    const paged = unwrapPage(data)
    const arrRaw = paged.content

    page.value = paged.page
    size.value = paged.size
    totalElements.value = paged.totalElements
    totalPages.value = paged.totalPages

    const arr = arrRaw
      .map((m) => ({
        ...m,
        fecha: pickFecha(m),
        tipo: String(m.tipo ?? "").toUpperCase(),
        concepto: String(m.concepto ?? "").toUpperCase(),
        monto: Number(m.monto ?? m.importe ?? 0) || 0,
        ventaId: m.ventaId ?? m.venta_id ?? m.venta ?? null,
        metodoPagoId: m.metodoPagoId ?? m.metodo_pago_id ?? m.metodoId ?? null,
      }))
      .sort((a, b) => new Date(b.fecha ?? 0) - new Date(a.fecha ?? 0))

    movimientos.value = arr

    const ventaIds = [...new Set(arr.map((x) => safeId(x.ventaId)).filter((v) => v > 0))]
    for (const vid of ventaIds) await hydrateVentaInfoFromVentaId(vid)

    const ingresos = arr
      .filter((m) => m.tipo === "INGRESO")
      .reduce((a, m) => a + m.monto, 0)

    const egresos = arr
      .filter((m) => m.tipo === "EGRESO")
      .reduce((a, m) => a + m.monto, 0)

    const montoInicial = Number(
      cajaAbierta.value?.montoInicial ?? cajaAbierta.value?.monto_inicial ?? 0
    ) || 0

    resumen.value = {
      ingresos,
      egresos,
      saldo: montoInicial + ingresos - egresos,
    }
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
watch([fecha, turnoSel, admin], () => {
  page.value = 0
  refreshAll()
}, { immediate: true })

// escuchar cambios globales de caja
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
      cajaId: safeId(cajaAbierta.value.cajaId),
      userId: safeId(userIdInt.value),
      tipo: String(formTipo.value).toUpperCase(),
      concepto: String(formConcepto.value).toUpperCase(),
      descripcion: formDescripcion.value?.trim() || null,
      metodoPagoId: formMetodoPagoId.value ? safeId(formMetodoPagoId.value) : null,
      monto,
    }

    await movimientosCajaApi.crear(payload)

    okMsg.value = `Movimiento creado ✅ (${payload.tipo}/${payload.concepto}) $ ${formatMoney(payload.monto)}`
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

const kpiMovimientos = computed(() => movimientosFiltrados.value.length)
const kpiIngresosFiltrados = computed(() =>
  movimientosFiltrados.value.filter((m) => m.tipo === "INGRESO").reduce((a, m) => a + m.monto, 0)
)
const kpiEgresosFiltrados = computed(() =>
  movimientosFiltrados.value.filter((m) => m.tipo === "EGRESO").reduce((a, m) => a + m.monto, 0)
)
const kpiNetoFiltrado = computed(() => kpiIngresosFiltrados.value - kpiEgresosFiltrados.value)

function exportCSV() {
  const rows = movimientosFiltrados.value.map((m) => {
    const vid = safeId(m.ventaId)
    const info = vid ? ventaInfoCache.value[vid] : null

    return {
      id: m.movimientoCajaId ?? m.movimientoId ?? m.id ?? "",
      fecha: m.fecha ?? "",
      tipo: m.tipo ?? "",
      concepto: m.concepto ?? "",
      ventaId: vid ? String(vid) : "",
      cliente: info?.clienteId ? clienteTxtById(info.clienteId) : "Mostrador",
      items: info?.itemsTxt ?? "",
      totalVenta: info?.total ?? 0,
      descripcion: m.descripcion ?? "",
      metodo: m.metodoPagoId ? metodoNombreById(m.metodoPagoId) : "",
      monto: m.monto ?? 0,
    }
  })

  const header = Object.keys(
    rows[0] || {
      id: "",
      fecha: "",
      tipo: "",
      concepto: "",
      ventaId: "",
      cliente: "",
      items: "",
      totalVenta: 0,
      descripcion: "",
      metodo: "",
      monto: 0,
    }
  )

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

function rowClass(m) {
  if (m.tipo === "INGRESO") return "row-ingreso"
  if (m.tipo === "EGRESO") return "row-egreso"
  return ""
}
function signedMoney(m) {
  const sign = m.tipo === "EGRESO" ? "-" : "+"
  return `${sign}$ ${formatMoney(m.monto)}`
}
function clienteTxtTemplate(ventaId) {
  const vid = safeId(ventaId)
  if (!vid) return "-"
  const info = ventaInfoCache.value[vid]
  if (!info) return "Cargando…"
  return clienteTxtById(info.clienteId)
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
            <input v-model="fecha" type="date" class="form-control bg-dark text-white border-secondary" :disabled="!admin" />
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
            <input v-model="formMonto" class="form-control bg-dark text-white border-secondary" placeholder="Ej: 1500" />
          </div>

          <div class="col-12">
            <label class="form-label text-secondary">Descripción (opcional)</label>
            <input v-model="formDescripcion" class="form-control bg-dark text-white border-secondary" placeholder="Ej: compra insumos / retiro caja / aporte inicial" />
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
        <input
          v-model="filtroTexto"
          class="form-control bg-dark text-white border-secondary"
          placeholder="Buscar en descripción..."
        />
      </div>
    </div>

    <div v-if="totalesPorConcepto.length" class="mb-3">
      <div class="text-secondary small mb-2">Totales por concepto (filtrados de esta página)</div>
      <div class="d-flex flex-wrap gap-2">
        <span
          v-for="t in totalesPorConcepto"
          :key="t.concepto"
          class="badge bg-dark border border-secondary"
          style="padding: 8px 10px;"
        >
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
          <tr
            v-for="m in movimientosFiltrados"
            :key="m.movimientoCajaId ?? m.movimientoId ?? m.id"
            :class="rowClass(m)"
          >
            <td class="text-secondary">{{ m.movimientoCajaId ?? m.movimientoId ?? m.id ?? "-" }}</td>
            <td class="text-secondary">{{ formatDateTime(m.fecha) }}</td>

            <td class="text-secondary">
              <span v-if="m.ventaId">#{{ m.ventaId }}</span>
              <span v-else>-</span>
            </td>

            <td class="text-secondary">
              <span v-if="m.ventaId">
                {{ clienteTxtTemplate(m.ventaId) }}
                <div class="text-secondary small">
                  {{ ventaInfoCache[safeId(m.ventaId)]?.itemsTxt || "" }}
                </div>
              </span>
              <span v-else>-</span>
            </td>

            <td>
              <span class="badge" :class="m.tipo === 'INGRESO' ? 'bg-success' : 'bg-danger'">
                {{ m.tipo }}
              </span>
            </td>

            <td class="text-secondary">{{ m.concepto || "-" }}</td>
            <td class="text-secondary">{{ m.descripcion ?? "-" }}</td>

            <td class="text-secondary">
              {{ m.metodoPagoId ? metodoNombreById(m.metodoPagoId) : "-" }}
            </td>

            <td class="text-end fw-bold">{{ signedMoney(m) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
      <div class="text-secondary small">
        Ingresos: <b>$ {{ formatMoney(resumen.ingresos) }}</b> ·
        Egresos: <b>$ {{ formatMoney(resumen.egresos) }}</b> ·
        Saldo: <b>$ {{ formatMoney(resumen.saldo) }}</b>
      </div>

      <div class="text-secondary small">
        Total registros: <b>{{ totalElements }}</b>
      </div>
    </div>

    <div class="mt-3">
      <Pager
        :page="page"
        :size="size"
        :total-elements="totalElements"
        :total-pages="totalPages"
        @update:page="onPageChange"
        @update:size="onSizeChange"
      />
    </div>
  </div>
</div>

<div v-else class="text-secondary">
  Abrí una caja (o elegí un turno con caja ABIERTA) para ver movimientos.
</div>
  </div>
</template>

<style scoped>
.bg-panel { background: rgba(18, 22, 32, .92); }

.row-ingreso td { background: rgba(25, 135, 84, 0.08) !important; }
.row-egreso td { background: rgba(220, 53, 69, 0.08) !important; }

.table-dark.table-hover tbody tr:hover td { filter: brightness(1.05); }
</style>