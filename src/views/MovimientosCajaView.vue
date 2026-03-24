<script setup>
import { ref, computed, watch, onMounted } from "vue"
import { getSession } from "../auth/session"
import { cajaApi } from "../services/cajaApi"
import { movimientosCajaApi } from "../services/movimientosCajaApi"
import { ventasApi } from "../services/ventasApi"
import { productosApi } from "../services/productosApi"
import { clientesApi } from "../services/clientesApi"
import { metodosPagoApi } from "../services/metodopagoService"
import { getTurnoOperativo, setTurnoOperativo } from "../ui/turnoOperativo"
import Pager from "../components/Pager.vue"

const session = getSession() ?? null
const permissions = Array.isArray(session?.permissions) ? session.permissions : []

function hasPermission(permission) {
  if (permissions.includes("admin:all")) return true
  return permissions.includes(permission)
}

const isAdmin = computed(() => permissions.includes("admin:all"))
const canViewCaja = computed(() => hasPermission("caja:ver"))

const turnoSel = ref(getTurnoOperativo() || "MANIANA")

const loading = ref(false)
const errorMsg = ref("")
const infoMsg = ref("")

const caja = ref(null)
const movimientos = ref([])
const resumen = ref({
  ingresos: 0,
  egresos: 0,
  saldo: 0,
})

const filtroTipo = ref("TODOS")
const filtroConcepto = ref("TODOS")
const filtroTexto = ref("")

const page = ref(0)
const size = ref(10)
const totalElements = ref(0)
const totalPages = ref(1)

// =========================
// Caches auxiliares
// =========================
const metodosPago = ref([])
const metodosLoaded = ref(false)

const productosById = ref(new Map())
const productosLoaded = ref(false)

const clientes = ref([])
const clientesLoaded = ref(false)

const ventaInfoCache = ref({})

// =========================
// Helpers
// =========================
function formatMoney(n) {
  return Number(n ?? 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDateTime(v) {
  if (!v) return "—"
  try {
    const text = String(v).includes("T") ? String(v) : `${v}T00:00:00`
    return new Date(text).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return String(v)
  }
}

function turnoLabel(turno) {
  return turno === "MANIANA" ? "MAÑANA" : "TARDE"
}

function badgeTipoClass(tipo) {
  return String(tipo || "").toUpperCase() === "INGRESO"
    ? "badge-soft-success"
    : "badge-soft-danger"
}

function signedMoney(m) {
  const monto = Number(m.monto ?? 0)
  const sign = m.tipo === "EGRESO" ? "-" : "+"
  return `${sign}$ ${formatMoney(monto)}`
}

function safeId(x) {
  const n = Number(x ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function unwrapPageArray(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
}

function normalizeMetodoPago(x) {
  return {
    id: safeId(x?.metodoPagoId ?? x?.id),
    nombre: String(x?.nombre ?? x?.name ?? x?.descripcion ?? "SIN NOMBRE"),
  }
}

function mapCliente(c) {
  return {
    id: safeId(c?.clienteId ?? c?.id),
    nombre: c?.nombre ?? "",
    apellido: c?.apellido ?? "",
    dni: c?.dni ?? null,
  }
}

function metodoNombreById(id) {
  const mid = safeId(id)
  const m = metodosPago.value.find((x) => Number(x.id) === mid)
  return m?.nombre ?? "-"
}

const clienteById = computed(() => {
  const map = new Map()
  for (const c of clientes.value) {
    map.set(Number(c.id), c)
  }
  return map
})

function clienteTxtById(clienteId) {
  const cid = safeId(clienteId)
  if (!cid) return "Mostrador"

  const c = clienteById.value.get(cid)
  if (!c) return `Cliente #${cid}`

  const full = `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim()
  const dni = c.dni ? `DNI ${c.dni}` : null
  return [full || `Cliente #${cid}`, dni].filter(Boolean).join(" · ")
}

function pickClienteIdFromVenta(venta) {
  const raw =
    venta?.clienteId ??
    venta?.cliente_id ??
    venta?.cliente?.clienteId ??
    venta?.cliente?.id ??
    venta?.cliente?.cliente_id ??
    null

  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function pickVentaIdFromMovimiento(m) {
  return safeId(m?.ventaId ?? m?.venta_id ?? m?.venta ?? 0)
}

async function fetchMetodosPagoOnce() {
  if (metodosLoaded.value) return
  try {
    const { data } = await metodosPagoApi.list()
    const arr = Array.isArray(data) ? data : unwrapPageArray(data)
    metodosPago.value = arr.map(normalizeMetodoPago).filter((m) => m.id > 0)
  } catch {
    metodosPago.value = []
  } finally {
    metodosLoaded.value = true
  }
}

async function fetchProductosOnce() {
  if (productosLoaded.value) return
  try {
    const { data } = await productosApi.list({ page: 0, size: 1000, search: "" })
    const arr = unwrapPageArray(data)
    const map = new Map()

    for (const p of arr) {
      const id = safeId(p?.productoId ?? p?.id)
      if (id) {
        map.set(id, String(p?.nombre ?? `Producto #${id}`))
      }
    }

    productosById.value = map
  } catch {
    productosById.value = new Map()
  } finally {
    productosLoaded.value = true
  }
}

async function fetchClientesOnce() {
  if (clientesLoaded.value) return
  try {
    const { data } = await clientesApi.list({ page: 0, size: 1000, search: "" })
    const arr = unwrapPageArray(data)
    clientes.value = arr.map(mapCliente).filter((c) => c.id > 0)
  } catch {
    clientes.value = []
  } finally {
    clientesLoaded.value = true
  }
}

async function hydrateVentaInfoFromVentaId(ventaId) {
  const vid = safeId(ventaId)
  if (!vid) return
  if (ventaInfoCache.value[vid]) return

  try {
    const { data } = await ventasApi.porId(vid)
    // DEBUG TEMPORAL — borrar después de confirmar
    console.log('[hydrate] venta', vid, JSON.stringify(data))
    const venta = data?.venta ?? data?.ventaActualizada ?? data ?? null

    const clienteId = pickClienteIdFromVenta(venta)
    const total = Number(venta?.total ?? 0) || 0
    const metodoPagoId =
      venta?.metodoPagoId ??
      venta?.metodo_pago_id ??
      venta?.metodoId ??
      null

    // ✅ FIX: el backend devuelve VentaConDetalles = { venta, detallesVenta }
    // detallesVenta está en data (raíz), NO dentro de data.venta
    const detalles =
      data?.detallesVenta ??
      data?.detalles ??
      venta?.detallesVenta ??
      venta?.detalles ??
      venta?.items ??
      venta?.detalleVenta ??
      []

    const itemsTxt = Array.isArray(detalles)
      ? detalles
          .map((d) => {
            const cant = Number(d?.cantidad ?? d?.qty ?? 0) || 0
            const pid = safeId(d?.productoId ?? d?.producto_id)
            const nombre =
              d?.productoNombre ??
              d?.producto?.nombre ??
              d?.nombreProducto ??
              productosById.value.get(pid) ??
              (pid ? `Producto #${pid}` : "Producto")

            return cant > 0 ? `${cant}× ${nombre}` : nombre
          })
          .filter(Boolean)
          .slice(0, 4)
          .join(" · ")
      : ""

    ventaInfoCache.value = {
      ...ventaInfoCache.value,
      [vid]: {
        clienteId,
        total,
        metodoPagoId,
        itemsTxt,
      },
    }
  } catch {
    ventaInfoCache.value = {
      ...ventaInfoCache.value,
      [vid]: {
        clienteId: null,
        total: 0,
        metodoPagoId: null,
        itemsTxt: "",
      },
    }
  }
}

function clienteTxtTemplate(ventaId) {
  const vid = safeId(ventaId)
  if (!vid) return "—"

  const info = ventaInfoCache.value[vid]
  if (!info) return "Cargando…"

  return clienteTxtById(info.clienteId)
}

function detalleVentaTemplate(ventaId) {
  const vid = safeId(ventaId)
  if (!vid) return "—"

  const info = ventaInfoCache.value[vid]
  // ✅ FIX: si el cache aún no tiene la venta, mostrar "Cargando…"
  if (info === undefined) return "Cargando…"
  // ✅ FIX: si itemsTxt es vacío puede ser que los detalles no traían nombre
  // (datos viejos). Mostramos "—" en lugar de "Sin detalle de productos"
  // para no confundir al usuario
  if (!info.itemsTxt) return "—"
  return info.itemsTxt
}

function metodoVentaTemplate(m) {
  const midMovimiento = safeId(m?.metodoPagoId)
  if (midMovimiento) return metodoNombreById(midMovimiento)

  const ventaId = pickVentaIdFromMovimiento(m)
  if (!ventaId) return "—"

  const info = ventaInfoCache.value[ventaId]
  const midVenta = safeId(info?.metodoPagoId)
  return midVenta ? metodoNombreById(midVenta) : "—"
}

// =========================
// Computeds
// =========================
const conceptosDisponibles = computed(() => {
  const uniques = new Set(
    movimientos.value.map((m) => String(m.concepto ?? "").trim()).filter(Boolean)
  )
  return Array.from(uniques).sort((a, b) => a.localeCompare(b))
})

const movimientosFiltrados = computed(() =>
  movimientos.value.filter((m) => {
    const tipoOk = filtroTipo.value === "TODOS" || m.tipo === filtroTipo.value
    const conceptoOk = filtroConcepto.value === "TODOS" || m.concepto === filtroConcepto.value

    const txt = filtroTexto.value.trim().toLowerCase()
    const textoOk =
      !txt ||
      String(m.descripcion ?? "").toLowerCase().includes(txt) ||
      String(m.concepto ?? "").toLowerCase().includes(txt) ||
      String(m.ventaId ?? "").toLowerCase().includes(txt)

    return tipoOk && conceptoOk && textoOk
  })
)

const kpiIngresos = computed(() =>
  movimientosFiltrados.value
    .filter((m) => m.tipo === "INGRESO")
    .reduce((a, m) => a + Number(m.monto ?? 0), 0)
)

const kpiEgresos = computed(() =>
  movimientosFiltrados.value
    .filter((m) => m.tipo === "EGRESO")
    .reduce((a, m) => a + Number(m.monto ?? 0), 0)
)
// Agregar después de kpiNeto
const kpiIngresosPorMetodo = computed(() => {
  const map = new Map()

  for (const m of movimientosFiltrados.value) {
    if (m.tipo !== "INGRESO") continue

    const midDirecto = safeId(m?.metodoPagoId)
    const ventaId = pickVentaIdFromMovimiento(m)
    const midVenta = ventaId ? safeId(ventaInfoCache.value[ventaId]?.metodoPagoId) : 0
    const mid = midDirecto || midVenta

    const nombre = mid ? metodoNombreById(mid) : "Sin método"
    map.set(nombre, (map.get(nombre) ?? 0) + Number(m.monto ?? 0))
  }

  return Array.from(map.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
})

const kpiEgresosPorMetodo = computed(() => {
  const map = new Map()

  for (const m of movimientosFiltrados.value) {
    if (m.tipo !== "EGRESO") continue

    const midDirecto = safeId(m?.metodoPagoId)
    const ventaId = pickVentaIdFromMovimiento(m)
    const midVenta = ventaId ? safeId(ventaInfoCache.value[ventaId]?.metodoPagoId) : 0
    const mid = midDirecto || midVenta

    const nombre = mid ? metodoNombreById(mid) : "Sin método"
    map.set(nombre, (map.get(nombre) ?? 0) + Number(m.monto ?? 0))
  }

  return Array.from(map.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
})

const kpiNeto = computed(() => kpiIngresos.value - kpiEgresos.value)

// =========================
// Fetch principal
// =========================
async function refreshCaja() {
  if (!canViewCaja.value) {
    errorMsg.value = "No tenés permisos para ver movimientos de caja."
    return
  }

  loading.value = true
  errorMsg.value = ""
  infoMsg.value = ""

  caja.value = null
  movimientos.value = []
  totalElements.value = 0
  totalPages.value = 1
  resumen.value = { ingresos: 0, egresos: 0, saldo: 0 }

  try {
    await Promise.all([
      fetchMetodosPagoOnce(),
      fetchProductosOnce(),
      fetchClientesOnce(),
    ])

    try {
      const { data } = await cajaApi.abierta({ turno: turnoSel.value })
      caja.value = data ?? null

      if (!caja.value?.cajaId) {
        infoMsg.value = `Todavía no hay caja abierta para el turno ${turnoLabel(turnoSel.value)}.`
        return
      }

      const movResp = await movimientosCajaApi.porCajaId(caja.value.cajaId, {
        page: page.value,
        size: size.value,
      })

      movimientos.value = Array.isArray(movResp.data?.content)
        ? movResp.data.content
        : Array.isArray(movResp.data)
          ? movResp.data
          : []

      movimientos.value = movimientos.value.map((m) => ({
        ...m,
        tipo: String(m?.tipo ?? "").toUpperCase(),
        concepto: String(m?.concepto ?? "").toUpperCase(),
        monto: Number(m?.monto ?? 0) || 0,
        ventaId: m?.ventaId ?? m?.venta_id ?? m?.venta ?? null,
        metodoPagoId: m?.metodoPagoId ?? m?.metodo_pago_id ?? m?.metodoId ?? null,
      }))

      totalElements.value = Number(movResp.data?.totalElements ?? movimientos.value.length ?? 0)
      totalPages.value = Math.max(1, Number(movResp.data?.totalPages ?? 1))

      const ingresos = movimientos.value
        .filter((m) => m.tipo === "INGRESO")
        .reduce((a, m) => a + Number(m.monto ?? 0), 0)

      const egresos = movimientos.value
        .filter((m) => m.tipo === "EGRESO")
        .reduce((a, m) => a + Number(m.monto ?? 0), 0)

      resumen.value = {
        ingresos,
        egresos,
        saldo: Number(caja.value?.montoInicial ?? 0) + ingresos - egresos,
      }

      const ventaIds = [
        ...new Set(movimientos.value.map((m) => pickVentaIdFromMovimiento(m)).filter(Boolean)),
      ]

      for (const vid of ventaIds) {
        await hydrateVentaInfoFromVentaId(vid)
      }

      return
    } catch (err) {
      if (err?.response?.status !== 404) {
        throw err
      }
    }

    // Si no hay caja abierta, intento traer el cierre del turno
    try {
      const { data } = await cajaApi.reporteCierre(turnoSel.value)
      const reporte = data ?? null

      caja.value = reporte?.caja ?? null
      movimientos.value = Array.isArray(reporte?.movimientos) ? reporte.movimientos : []

      movimientos.value = movimientos.value.map((m) => ({
        ...m,
        tipo: String(m?.tipo ?? "").toUpperCase(),
        concepto: String(m?.concepto ?? "").toUpperCase(),
        monto: Number(m?.monto ?? 0) || 0,
        ventaId: m?.ventaId ?? m?.venta_id ?? m?.venta ?? null,
        metodoPagoId: m?.metodoPagoId ?? m?.metodo_pago_id ?? m?.metodoId ?? null,
      }))

      totalElements.value = movimientos.value.length
      totalPages.value = 1

      resumen.value = {
        ingresos: Number(reporte?.ingresos ?? 0),
        egresos: Number(reporte?.egresos ?? 0),
        saldo: Number(reporte?.saldoFinal ?? 0),
      }

      const ventaIds = [
        ...new Set(movimientos.value.map((m) => pickVentaIdFromMovimiento(m)).filter(Boolean)),
      ]

      for (const vid of ventaIds) {
        await hydrateVentaInfoFromVentaId(vid)
      }

      infoMsg.value = `La caja del turno ${turnoLabel(turnoSel.value)} ya fue cerrada.`
    } catch {
      infoMsg.value = `Todavía no hay caja registrada para el turno ${turnoLabel(turnoSel.value)}.`
    }
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error cargando movimientos de caja."
  } finally {
    loading.value = false
  }
}

// =========================
// Export / pager
// =========================
function exportCSV() {
  const rows = [
    ["Fecha", "Venta", "Cliente", "Detalle venta", "Tipo", "Concepto", "Descripción", "Método", "Monto"],
    ...movimientosFiltrados.value.map((m) => [
      formatDateTime(m.fecha),
      m.ventaId ? `#${m.ventaId}` : "",
      m.ventaId ? clienteTxtTemplate(m.ventaId) : "",
      m.ventaId ? detalleVentaTemplate(m.ventaId) : "",
      m.tipo ?? "",
      m.concepto ?? "",
      m.descripcion ?? "",
      metodoVentaTemplate(m),
      String(m.monto ?? 0),
    ]),
  ]

  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";"))
    .join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  const a = document.createElement("a")
  a.href = url
  a.download = `movimientos_${turnoSel.value.toLowerCase()}.csv`
  a.click()

  URL.revokeObjectURL(url)
}

function onPageChange(newPage) {
  page.value = Number(newPage ?? 0)
  refreshCaja()
}

function onSizeChange() {
  // pager minimalista
}

// =========================
// Lifecycle
// =========================
watch(turnoSel, (v) => {
  setTurnoOperativo(v)
  page.value = 0
  refreshCaja()
})

onMounted(() => {
  refreshCaja()
})
</script>

<template>
  <div class="movimientos-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Caja</p>
        <h1 class="page-title mb-1">Movimientos del turno</h1>
        <p class="page-subtitle mb-0">
          Historial operativo con filtros, resumen y exportación.
        </p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="refreshCaja" :disabled="loading">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>
      </div>
    </section>

    <div v-if="errorMsg" class="alert alert-danger py-2 mb-3">
      {{ errorMsg }}
    </div>

    <div v-else-if="infoMsg" class="alert alert-secondary py-2 mb-3">
      {{ infoMsg }}
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="top-summary">
          <div class="top-summary-left">
            <div class="field-block">
              <label class="form-label field-label">Turno operativo</label>

              <select v-if="isAdmin" v-model="turnoSel" class="form-select app-input">
                <option value="MANIANA">MAÑANA</option>
                <option value="TARDE">TARDE</option>
              </select>

              <input
                v-else
                class="form-control app-input"
                :value="turnoLabel(turnoSel)"
                disabled
              />
            </div>

            <div class="status-box">
              <span class="badge" :class="caja ? 'badge-soft-success' : 'badge-soft-neutral'">
                {{ caja ? "ABIERTA" : "SIN CAJA" }}
              </span>
              <span class="status-meta">
                {{
                  caja
                    ? `Caja del turno ${turnoLabel(turnoSel)}`
                    : `Turno ${turnoLabel(turnoSel)} sin caja abierta`
                }}
              </span>
            </div>
          </div>

          <div class="top-summary-right">
            <div class="mini-stat">
              <span class="mini-stat-label">Movimientos</span>
              <strong class="mini-stat-value">{{ totalElements }}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3 mb-3">
  <div class="col-6 col-md-3">
    <div class="kpi-card">
      <div class="kpi-label">Ingresos</div>
      <div class="kpi-value text-success">$ {{ formatMoney(kpiIngresos) }}</div>
    </div>
  </div>

  <div class="col-6 col-md-3">
    <div class="kpi-card">
      <div class="kpi-label">Egresos</div>
      <div class="kpi-value text-danger">$ {{ formatMoney(kpiEgresos) }}</div>
    </div>
  </div>

  <div class="col-6 col-md-3">
    <div class="kpi-card">
      <div class="kpi-label">Neto</div>
      <div class="kpi-value">$ {{ formatMoney(kpiNeto) }}</div>
    </div>
  </div>

  <div class="col-6 col-md-3">
    <div class="kpi-card">
      <div class="kpi-label">Saldo</div>
      <div class="kpi-value">$ {{ formatMoney(resumen.saldo) }}</div>
    </div>
  </div>
</div>

<!-- Ingresos y egresos por método de pago -->
<div v-if="kpiIngresosPorMetodo.length || kpiEgresosPorMetodo.length" class="row g-3 mb-3">

  <div class="col-12" v-if="kpiIngresosPorMetodo.length">
    <div class="metodos-strip">
      <span class="metodos-strip-label">Ingresos por método</span>
      <div class="metodos-strip-items">
        <div v-for="item in kpiIngresosPorMetodo" :key="item.nombre" class="metodo-chip">
          <span class="metodo-chip-nombre">{{ item.nombre }}</span>
          <span class="metodo-chip-monto metodo-chip-monto--ingreso">$ {{ formatMoney(item.total) }}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="col-12" v-if="kpiEgresosPorMetodo.length">
    <div class="metodos-strip">
      <span class="metodos-strip-label">Egresos por método</span>
      <div class="metodos-strip-items">
        <div v-for="item in kpiEgresosPorMetodo" :key="item.nombre" class="metodo-chip">
          <span class="metodo-chip-nombre">{{ item.nombre }}</span>
          <span class="metodo-chip-monto text-danger metodo-chip-monto--egreso">$ {{ formatMoney(item.total) }}</span>
        </div>
      </div>
    </div>
  </div>

</div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Filtros</h2>
          <div class="helper-text">
            Mostrando {{ movimientosFiltrados.length }} de {{ totalElements }} movimiento(s)
          </div>
        </div>

        <div class="filters-bar">
          <div class="filters-grid">
            <div>
              <label class="form-label field-label">Tipo</label>
              <select v-model="filtroTipo" class="form-select app-input">
                <option value="TODOS">Todos</option>
                <option value="INGRESO">Ingresos</option>
                <option value="EGRESO">Egresos</option>
              </select>
            </div>

            <div>
              <label class="form-label field-label">Concepto</label>
              <select v-model="filtroConcepto" class="form-select app-input">
                <option value="TODOS">Todos los conceptos</option>
                <option v-for="c in conceptosDisponibles" :key="c" :value="c">
                  {{ c }}
                </option>
              </select>
            </div>

            <div class="filter-search">
              <label class="form-label field-label">Buscar</label>
              <input
                v-model="filtroTexto"
                class="form-control app-input"
                placeholder="Descripción, concepto o venta..."
              />
            </div>
          </div>

          <button
            class="btn btn-outline-light btn-sm"
            @click="exportCSV"
            :disabled="!movimientosFiltrados.length"
          >
            Exportar CSV
          </button>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Resultados</h2>
          <div class="helper-text">Movimientos de la caja abierta del turno seleccionado.</div>
        </div>

        <div v-if="!movimientosFiltrados.length" class="empty-block">
          <div class="empty-title">
            {{ caja ? "No hay movimientos para mostrar" : "No hay caja abierta para este turno" }}
          </div>
          <div class="helper-text">
            {{
              caja
                ? "Probá ajustar los filtros o revisar otro turno."
                : `Cuando abras la caja del turno ${turnoLabel(turnoSel)}, los movimientos aparecerán acá.`
            }}
          </div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th style="width: 170px">Fecha</th>
                <th style="width: 90px">Venta</th>
                <th style="width: 280px">Cliente</th>
                <th style="width: 300px">Detalle venta</th>
                <th style="width: 120px">Tipo</th>
                <th style="width: 160px">Concepto</th>
                <th>Descripción</th>
                <th style="width: 160px">Método</th>
                <th style="width: 170px" class="text-end">Monto</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="m in movimientosFiltrados" :key="m.movimientoCajaId ?? m.id">
                <td class="text-secondary">{{ formatDateTime(m.fecha) }}</td>

                <td class="text-secondary">
                  <span v-if="m.ventaId">#{{ m.ventaId }}</span>
                  <span v-else>—</span>
                </td>

                <td>
                  <div v-if="m.ventaId" class="mov-detail">
                    <div class="mov-detail-main">
                      {{ clienteTxtTemplate(m.ventaId) }}
                    </div>
                  </div>
                  <span v-else class="text-secondary">—</span>
                </td>

                <td>
                  <div v-if="m.ventaId" class="mov-detail">
                    <div class="mov-detail-sub">
                      {{ detalleVentaTemplate(m.ventaId) }}
                    </div>
                  </div>
                  <span v-else class="text-secondary">—</span>
                </td>

                <td>
                  <span class="badge" :class="badgeTipoClass(m.tipo)">
                    {{ m.tipo }}
                  </span>
                </td>

                <td>{{ m.concepto ?? "—" }}</td>
                <td class="text-secondary">{{ m.descripcion ?? "—" }}</td>
                <td class="text-secondary">{{ metodoVentaTemplate(m) }}</td>
                <td class="text-end fw-semibold">{{ signedMoney(m) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer-summary">
          <div class="helper-text">
            Total registros: <b>{{ totalElements }}</b>
          </div>
        </div>

        <div class="mt-3" v-if="movimientos.length">
          <Pager
            :page="page"
            :size="size"
            :total-elements="totalElements"
            :total-pages="totalPages"
            :loading="loading"
            @update:page="onPageChange"
            @update:size="onSizeChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.movimientos-page {
  min-height: 100%;
}

.top-summary {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.top-summary-left {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.top-summary-right {
  display: flex;
  align-items: center;
}

.field-block {
  min-width: 220px;
}

.status-box {
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.08);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.status-meta {
  color: rgba(255,255,255,.70);
  font-size: .92rem;
}

.mini-stat {
  min-width: 120px;
  text-align: right;
}

.mini-stat-label {
  display: block;
  color: rgba(255,255,255,.58);
  font-size: .8rem;
  margin-bottom: 2px;
}

.mini-stat-value {
  color: #fff;
  font-size: 1.25rem;
  font-weight: 800;
}

.filter-search {
  min-width: 0;
}

/* ── Ingresos por método de pago ── */
.metodos-strip {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 14px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.metodos-strip-label {
  color: rgba(255,255,255,.55);
  font-size: .8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
  white-space: nowrap;
}

.metodos-strip-items {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.metodo-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.11);
  border-radius: 10px;
  padding: 6px 14px;
}

.metodo-chip-nombre {
  color: rgba(255,255,255,.75);
  font-size: .85rem;
  font-weight: 600;
}

.metodo-chip-monto {
  color: #4ade80;
  font-size: .95rem;
  font-weight: 800;
}

@media (max-width: 992px) {
  .mini-stat {
    text-align: left;
  }
}

@media (max-width: 768px) {
  .top-summary { align-items: stretch; }
  .top-summary-left { width: 100%; align-items: stretch; }
  .field-block { width: 100%; }
  .status-box { width: 100%; }
  .top-summary-right { width: 100%; }
  .mini-stat { width: 100%; text-align: left; }
}
</style>