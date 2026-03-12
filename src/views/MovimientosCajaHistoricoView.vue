<script setup>
import { computed, onMounted, ref, watch } from "vue"
import { getSession, isAdmin } from "../auth/session"
import { movimientosCajaApi } from "../services/movimientosCajaApi"
import { ventasApi } from "../services/ventasApi"
import { productosApi } from "../services/productosApi"
import { clientesApi } from "../services/clientesApi"
import { metodosPagoApi } from "../services/metodopagoService"
import Pager from "../components/Pager.vue"

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

function daysAgoISO(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDateTime(v) {
  if (!v) return "—"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function safeId(x) {
  const n = Number(x ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function normalizeFecha(v) {
  if (!v) return null

  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

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

    const d = new Date(String(v))
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  return null
}

function pickFecha(m) {
  if (!m) return null

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

  for (const [k, v] of Object.entries(m)) {
    const kk = k.toLowerCase()
    if (kk.includes("fecha") || kk.includes("date") || kk.includes("time")) {
      const iso = normalizeFecha(v)
      if (iso) return iso
    }
  }

  return null
}

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

  const content = data?.content ?? data?.items ?? data?.data ?? []

  return {
    content: Array.isArray(content) ? content : [],
    page: Number(data?.page ?? data?.number ?? 0),
    size: Number(data?.size ?? 10),
    totalElements: Number(
      data?.totalElements ??
        data?.total ??
        (Array.isArray(content) ? content.length : 0)
    ),
    totalPages: Number(data?.totalPages ?? data?.pages ?? 1),
  }
}

// =========================
// Session
// =========================
const session = getSession() ?? null
const admin = computed(() => Boolean(session && isAdmin()))

// =========================
// UI State
// =========================
const loading = ref(false)
const errorMsg = ref("")
const okMsg = ref("")
const infoMsg = ref("")

const page = ref(0)
const size = ref(20)
const totalElements = ref(0)
const totalPages = ref(1)

const movimientos = ref([])

// =========================
// Filtros
// =========================
const desde = ref(daysAgoISO(7))
const hasta = ref(todayISO())
const tipo = ref("TODOS")
const search = ref("")

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
    const arr = Array.isArray(data) ? data : unwrapPage(data).content
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
  return m?.nombre ?? "-"
}

async function fetchProductosOnce() {
  if (productosLoaded.value) return
  try {
    const { data } = await productosApi.list({ page: 0, size: 1000, search: "" })
    const arr = unwrapPage(data).content
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

function mapCliente(c) {
  return {
    id: safeId(c?.clienteId ?? c?.id),
    nombre: c?.nombre ?? "",
    apellido: c?.apellido ?? "",
    dni: c?.dni ?? null,
  }
}

async function fetchClientesOnce() {
  if (clientesLoaded.value) return
  try {
    const { data } = await clientesApi.list({ page: 0, size: 1000, search: "" })
    const arr = unwrapPage(data).content
    clientes.value = arr.map(mapCliente).filter((c) => c.id > 0)
  } catch {
    clientes.value = []
  } finally {
    clientesLoaded.value = true
  }
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

async function hydrateVentaInfoFromVentaId(ventaId) {
  const vid = safeId(ventaId)
  if (!vid) return
  if (ventaInfoCache.value[vid]) return

  try {
    const { data } = await ventasApi.porId(vid)
    const venta = data?.venta ?? data?.ventaActualizada ?? data ?? null

    const clienteId = pickClienteIdFromVenta(venta)
    const total = Number(venta?.total ?? 0) || 0

    const detalles =
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
        itemsTxt,
      },
    }
  } catch {
    ventaInfoCache.value = {
      ...ventaInfoCache.value,
      [vid]: {
        clienteId: null,
        total: 0,
        itemsTxt: "",
      },
    }
  }
}

// =========================
// Fetch histórico
// =========================
async function refreshHistorico() {
  if (!admin.value) {
    errorMsg.value = "Solo ADMIN puede ver el histórico de movimientos."
    movimientos.value = []
    return
  }

  loading.value = true
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  try {
    await Promise.all([
      fetchMetodosPagoOnce(),
      fetchProductosOnce(),
      fetchClientesOnce(),
    ])

    const params = {
      page: page.value,
      size: size.value,
      desde: desde.value || undefined,
      hasta: hasta.value || undefined,
      search: search.value?.trim() || undefined,
      tipo: tipo.value !== "TODOS" ? tipo.value : undefined,
    }

    const { data } = await movimientosCajaApi.list(params)
    const paged = unwrapPage(data)

    page.value = paged.page
    size.value = paged.size
    totalElements.value = paged.totalElements
    totalPages.value = paged.totalPages

    const arr = paged.content
      .map((m) => ({
        ...m,
        fecha: pickFecha(m),
        tipo: String(m?.tipo ?? "").toUpperCase(),
        concepto: String(m?.concepto ?? "").toUpperCase(),
        monto: Number(m?.monto ?? m?.importe ?? 0) || 0,
        ventaId: m?.ventaId ?? m?.venta_id ?? m?.venta ?? null,
        metodoPagoId: m?.metodoPagoId ?? m?.metodo_pago_id ?? m?.metodoId ?? null,
      }))
      .sort((a, b) => new Date(b.fecha ?? 0) - new Date(a.fecha ?? 0))

    movimientos.value = arr

    const ventaIds = [...new Set(arr.map((x) => safeId(x.ventaId)).filter(Boolean))]
    for (const vid of ventaIds) {
      await hydrateVentaInfoFromVentaId(vid)
    }

    if (!arr.length) {
      infoMsg.value = "No hay movimientos para ese rango o filtro."
    }
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error cargando histórico de movimientos."
  } finally {
    loading.value = false
  }
}

// =========================
// KPIs
// =========================
const ingresos = computed(() =>
  movimientos.value
    .filter((m) => m.tipo === "INGRESO")
    .reduce((a, m) => a + Number(m.monto ?? 0), 0)
)

const egresos = computed(() =>
  movimientos.value
    .filter((m) => m.tipo === "EGRESO")
    .reduce((a, m) => a + Number(m.monto ?? 0), 0)
)

const neto = computed(() => ingresos.value - egresos.value)

const totalesPorConcepto = computed(() => {
  const map = new Map()

  for (const m of movimientos.value) {
    const key = m.concepto || "SIN_CONCEPTO"
    const signed = m.tipo === "EGRESO" ? -Number(m.monto ?? 0) : Number(m.monto ?? 0)
    map.set(key, (map.get(key) ?? 0) + signed)
  }

  return Array.from(map.entries())
    .map(([concepto, total]) => ({ concepto, total }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
})

// =========================
// UI helpers
// =========================
function signedMoney(m) {
  const sign = m.tipo === "EGRESO" ? "-" : "+"
  return `${sign}$ ${formatMoney(m.monto)}`
}

function rowClass(m) {
  if (m.tipo === "INGRESO") return "row-ingreso"
  if (m.tipo === "EGRESO") return "row-egreso"
  return ""
}

function clienteTxtTemplate(ventaId) {
  const vid = safeId(ventaId)
  if (!vid) return "—"

  const info = ventaInfoCache.value[vid]
  if (!info) return "Cargando…"

  return clienteTxtById(info.clienteId)
}

// =========================
// Export
// =========================
function exportCSV() {
  const rows = movimientos.value.map((m) => {
    const vid = safeId(m.ventaId)
    const info = vid ? ventaInfoCache.value[vid] : null

    return {
      fecha: m.fecha ?? "",
      tipo: m.tipo ?? "",
      concepto: m.concepto ?? "",
      venta: vid ? `#${vid}` : "",
      cliente: info?.clienteId ? clienteTxtById(info.clienteId) : "Mostrador",
      detalleVenta: info?.itemsTxt ?? "",
      metodo: m.metodoPagoId ? metodoNombreById(m.metodoPagoId) : "",
      descripcion: m.descripcion ?? "",
      monto: m.monto ?? 0,
    }
  })

  const header = Object.keys(
    rows[0] || {
      fecha: "",
      tipo: "",
      concepto: "",
      venta: "",
      cliente: "",
      detalleVenta: "",
      metodo: "",
      descripcion: "",
      monto: 0,
    }
  )

  const csv = [
    header.join(";"),
    ...rows.map((r) =>
      header.map((k) => `"${String(r[k] ?? "").replaceAll('"', '""')}"`).join(";")
    ),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `historico_movimientos_caja_${desde.value}_${hasta.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// =========================
// Events
// =========================
function onPageChange(newPage) {
  page.value = Number(newPage ?? 0)
  refreshHistorico()
}

function onSizeChange() {
  // pager minimalista
}

function aplicarFiltros() {
  page.value = 0
  refreshHistorico()
}

watch(tipo, () => {
  page.value = 0
  refreshHistorico()
})

onMounted(() => {
  refreshHistorico()
})
</script>

<template>
  <div class="historico-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Caja</p>
        <h1 class="page-title mb-1">Histórico de movimientos</h1>
        <p class="page-subtitle mb-0">
          Auditoría de ingresos y egresos con detalle de ventas asociadas.
        </p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="refreshHistorico" :disabled="loading">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>

        <button
          class="btn btn-outline-light"
          @click="exportCSV"
          :disabled="!movimientos.length"
        >
          Exportar CSV
        </button>
      </div>
    </section>

    <div v-if="errorMsg" class="alert alert-danger py-2 mb-3">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2 mb-3">{{ okMsg }}</div>
    <div v-if="infoMsg" class="alert alert-secondary py-2 mb-3">{{ infoMsg }}</div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Filtros</h2>
          <div class="helper-text">Consultá movimientos por rango, tipo o descripción.</div>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label field-label">Desde</label>
            <input v-model="desde" type="date" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label field-label">Hasta</label>
            <input v-model="hasta" type="date" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label field-label">Tipo</label>
            <select v-model="tipo" class="form-select app-input">
              <option value="TODOS">Todos</option>
              <option value="INGRESO">INGRESO</option>
              <option value="EGRESO">EGRESO</option>
            </select>
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label field-label">Buscar</label>
            <div class="d-flex gap-2">
              <input
                v-model="search"
                class="form-control app-input"
                placeholder="Descripción, venta o referencia..."
                @keyup.enter="aplicarFiltros"
              />
              <button class="btn btn-primary btn-accent" @click="aplicarFiltros">
                Filtrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3 mb-3" v-if="movimientos.length">
      <div class="col-6 col-md-3">
        <div class="kpi-card">
          <div class="kpi-label">Movimientos</div>
          <div class="kpi-value">{{ totalElements }}</div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div class="kpi-card">
          <div class="kpi-label">Ingresos</div>
          <div class="kpi-value text-success">$ {{ formatMoney(ingresos) }}</div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div class="kpi-card">
          <div class="kpi-label">Egresos</div>
          <div class="kpi-value text-danger">$ {{ formatMoney(egresos) }}</div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div class="kpi-card">
          <div class="kpi-label">Neto</div>
          <div class="kpi-value">$ {{ formatMoney(neto) }}</div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Resultados</h2>
          <div class="helper-text">
            {{ movimientos.length }} registro(s) en la página actual
          </div>
        </div>

        <div v-if="totalesPorConcepto.length" class="mb-3">
          <div class="helper-text mb-2">Totales por concepto</div>
          <div class="totales-wrap">
            <span
              v-for="t in totalesPorConcepto"
              :key="t.concepto"
              class="concept-chip"
            >
              {{ t.concepto }} · $ {{ formatMoney(t.total) }}
            </span>
          </div>
        </div>

        <div v-if="!movimientos.length" class="empty-block">
          <div class="empty-title">No hay movimientos para mostrar</div>
          <div class="helper-text">Probá cambiando el rango o los filtros.</div>
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
              <tr
                v-for="m in movimientos"
                :key="m.movimientoCajaId ?? m.movimientoId ?? m.id"
                :class="rowClass(m)"
              >
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
                      {{ ventaInfoCache[safeId(m.ventaId)]?.itemsTxt || "Sin detalle de productos" }}
                    </div>
                  </div>
                  <span v-else class="text-secondary">—</span>
                </td>

                <td>
                  <span
                    class="badge"
                    :class="m.tipo === 'INGRESO' ? 'badge-soft-success' : 'badge-soft-danger'"
                  >
                    {{ m.tipo }}
                  </span>
                </td>

                <td>
                  <span class="concept-chip">
                    {{ m.concepto || "—" }}
                  </span>
                </td>

                <td class="text-secondary">{{ m.descripcion ?? "—" }}</td>

                <td class="text-secondary">
                  {{ m.metodoPagoId ? metodoNombreById(m.metodoPagoId) : "—" }}
                </td>

                <td class="text-end fw-bold">{{ signedMoney(m) }}</td>
              </tr>
            </tbody>
          </table>
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
.historico-page {
  min-height: 100%;
}

.row-ingreso td {
  background: rgba(25, 135, 84, 0.08) !important;
}

.row-egreso td {
  background: rgba(220, 53, 69, 0.08) !important;
}

.mov-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mov-detail-main {
  color: #fff;
  font-weight: 600;
}

.mov-detail-sub {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.82rem;
}

.concept-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.82rem;
  font-weight: 600;
}

.totales-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 768px) {
  .mov-detail-main,
  .mov-detail-sub {
    white-space: normal;
  }
}
</style>