<script setup>
import { ref, computed, onMounted } from "vue"
import { getSession } from "../auth/session"
import { movimientosStockApi } from "../services/movimientosCajaApi"
import { usuariosApi } from "../services/usuariosService"
import Pager from "../components/Pager.vue"

const session = getSession() ?? null
const permissions = Array.isArray(session?.permissions) ? session.permissions : []

function hasPermission(p) {
  return permissions.includes("admin:all") || permissions.includes(p)
}

const canView  = computed(() => hasPermission("movimientos_stock:ver"))
const isAdmin  = computed(() => permissions.includes("admin:all"))

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(v) {
  if (!v) return "—"
  try {
    const s = String(v).includes("T") ? String(v) : `${v}T00:00:00`
    return new Date(s).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch { return String(v) }
}

function formatHora(v) {
  if (!v) return "—"
  try {
    const s = String(v).includes("T") ? String(v) : `${v}T00:00:00`
    return new Date(s).toLocaleTimeString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit", minute: "2-digit",
    })
  } catch { return String(v) }
}

function turnoDeHora(fechaStr) {
  try {
    const s = String(fechaStr).includes("T") ? String(fechaStr) : `${fechaStr}T00:00:00`
    const h = new Date(s).getHours()
    return h < 14 ? "Mañana" : "Tarde"
  } catch { return "—" }
}

function badgeTipoClass(tipo) {
  return String(tipo || "").toUpperCase() === "ENTRADA" ? "badge-soft-success" : "badge-soft-danger"
}

function badgeMotivoClass(motivo) {
  const m = String(motivo || "").toUpperCase()
  if (m === "COMPRA")     return "badge-soft-info"
  if (m === "VENTA")      return "badge-soft-warning"
  if (m === "DEVOLUCION") return "badge-soft-neutral"
  return "badge-soft-neutral"
}

// ── Historial paginado ────────────────────────────────────────────────────────
const loading      = ref(false)
const errorMsg     = ref("")
const rows         = ref([])
const page         = ref(0)
const size         = ref(20)
const totalElements = ref(0)
const totalPages   = ref(1)

const filtroTipo      = ref("")
const filtroMotivo    = ref("")
const filtroProductoId = ref("")

async function load() {
  if (!canView.value) { errorMsg.value = "Sin permisos para ver movimientos de stock."; return }
  loading.value = true
  errorMsg.value = ""
  try {
    const params = { page: page.value, size: size.value }
    if (filtroTipo.value)       params.tipo      = filtroTipo.value
    if (filtroMotivo.value)     params.motivo    = filtroMotivo.value
    if (filtroProductoId.value) params.productoId = Number(filtroProductoId.value)
    const { data } = await movimientosStockApi.list(params)
    rows.value = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : []
    totalElements.value = Number(data?.totalElements ?? rows.value.length)
    totalPages.value    = Math.max(1, Number(data?.totalPages ?? 1))
  } catch (e) {
    errorMsg.value = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Error cargando movimientos."
  } finally { loading.value = false }
}

function aplicarFiltros() { page.value = 0; load() }
function limpiarFiltros()  { filtroTipo.value = ""; filtroMotivo.value = ""; filtroProductoId.value = ""; page.value = 0; load() }
function onPageChange(n)   { page.value = Number(n ?? 0); load() }

// ── Auditoría de hoy (admin) ──────────────────────────────────────────────────
const auditoriaMovs   = ref([])
const usuariosMap     = ref(new Map())
const loadingAuditoria = ref(false)

const hoy = new Date().toISOString().slice(0, 10)

const auditoriaHoy = computed(() => {
  return auditoriaMovs.value.filter(m => String(m.fecha ?? "").slice(0, 10) === hoy)
})

const auditoriaMañana = computed(() => auditoriaHoy.value.filter(m => turnoDeHora(m.fecha) === "Mañana"))
const auditoriaTarde  = computed(() => auditoriaHoy.value.filter(m => turnoDeHora(m.fecha) === "Tarde"))

// KPIs de hoy sobre TODOS los movimientos (no solo AJUSTE)
const todosHoy = computed(() => auditoriaMovs.value)  // recargamos con motivo vacío

const kpiAjustesHoy  = computed(() => auditoriaHoy.value.length)
const kpiEntradasHoy = computed(() => auditoriaHoy.value.filter(m => m.tipoMovimiento === "ENTRADA").reduce((s, m) => s + Number(m.cantidad ?? 0), 0))
const kpiSalidasHoy  = computed(() => auditoriaHoy.value.filter(m => m.tipoMovimiento === "SALIDA").reduce((s, m) => s + Number(m.cantidad ?? 0), 0))

function empleadaNombre(m) {
  const uid = m.userId ?? m.user_id ?? null
  if (!uid) return "—"
  return usuariosMap.value.get(Number(uid)) ?? `Usuario #${uid}`
}

async function fetchAuditoria() {
  if (!isAdmin.value) return
  loadingAuditoria.value = true
  try {
    const [movRes, usrRes] = await Promise.all([
      movimientosStockApi.list({ motivo: "AJUSTE", size: 500, page: 0 }),
      usuariosApi.list().catch(() => ({ data: [] })),
    ])
    const movs = Array.isArray(movRes.data?.content) ? movRes.data.content
      : Array.isArray(movRes.data) ? movRes.data : []
    auditoriaMovs.value = movs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

    const usrs = Array.isArray(usrRes.data) ? usrRes.data : (usrRes.data?.content ?? [])
    const m = new Map()
    for (const u of usrs) m.set(Number(u.userId ?? u.id ?? u.user_id), u.nombre ?? u.name ?? "—")
    usuariosMap.value = m
  } catch { errorMsg.value = "No se pudo cargar la auditoría de ajustes." }
  finally { loadingAuditoria.value = false }
}

onMounted(() => {
  load()
  if (isAdmin.value) fetchAuditoria()
})
</script>

<template>
  <div class="movstock-page">

    <!-- Hero -->
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Inventario</p>
        <h1 class="page-title mb-1">Movimientos de Stock</h1>
        <p class="page-subtitle mb-0">Historial completo de entradas y salidas de productos.</p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="load(); fetchAuditoria()" :disabled="loading || loadingAuditoria">
          {{ (loading || loadingAuditoria) ? "Cargando..." : "Actualizar" }}
        </button>
      </div>
    </section>

    <div v-if="errorMsg" class="alert alert-danger py-2 mb-3">{{ errorMsg }}</div>

    <!-- ── KPIs ajustes manuales de hoy (admin) ────────────────────────────── -->
    <div v-if="isAdmin" class="kpi-row mb-3">
      <div class="kpi-card">
        <div class="kpi-label">Ajustes manuales hoy</div>
        <div class="kpi-value">{{ loadingAuditoria ? "…" : kpiAjustesHoy }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Unidades ingresadas</div>
        <div class="kpi-value text-success">+{{ loadingAuditoria ? "…" : kpiEntradasHoy }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Unidades egresadas</div>
        <div class="kpi-value text-danger">-{{ loadingAuditoria ? "…" : kpiSalidasHoy }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Turno activo</div>
        <div class="kpi-value">{{ new Date().getHours() < 14 ? 'Mañana' : 'Tarde' }}</div>
      </div>
    </div>

    <!-- ── Actividad de ajustes por turno — hoy (admin) ───────────────────── -->
    <div v-if="isAdmin" class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Ajustes manuales — hoy</h2>
          <div class="helper-text">Solo movimientos de tipo AJUSTE</div>
        </div>

        <div v-if="loadingAuditoria" class="empty-block">
          <div class="helper-text">Cargando actividad...</div>
        </div>
        <div v-else-if="!auditoriaHoy.length" class="empty-block">
          <div class="empty-title">Sin ajustes hoy</div>
          <div class="helper-text">No se registraron ajustes manuales de stock en el día de hoy.</div>
        </div>

        <template v-else>
          <!-- Turno Mañana -->
          <template v-if="auditoriaMañana.length">
            <div class="turno-header mb-2">
              <span class="badge badge-soft-info">Turno Mañana</span>
              <span class="helper-text ms-2">{{ auditoriaMañana.length }} ajuste(s)</span>
            </div>
            <div class="table-responsive mb-4">
              <table class="table table-dark table-hover align-middle app-table mb-0">
                <thead>
                  <tr>
                    <th style="width:70px">Hora</th>
                    <th>Producto</th>
                    <th style="width:120px">Empleada</th>
                    <th style="width:100px" class="text-center">Tipo</th>
                    <th style="width:90px" class="text-end">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in auditoriaMañana" :key="m.movimientoId">
                    <td class="td-code text-secondary">{{ formatHora(m.fecha) }}</td>
                    <td class="fw-semibold">{{ m.productoNombre ?? `Producto #${m.productoId}` }}</td>
                    <td class="text-secondary">{{ empleadaNombre(m) }}</td>
                    <td class="text-center">
                      <span class="badge" :class="badgeTipoClass(m.tipoMovimiento)">{{ m.tipoMovimiento }}</span>
                    </td>
                    <td class="text-end td-num fw-bold" :class="m.tipoMovimiento === 'ENTRADA' ? 'text-success' : 'text-danger'">
                      {{ m.tipoMovimiento === 'ENTRADA' ? '+' : '-' }}{{ m.cantidad }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <!-- Turno Tarde -->
          <template v-if="auditoriaTarde.length">
            <div class="turno-header mb-2">
              <span class="badge badge-soft-warning">Turno Tarde</span>
              <span class="helper-text ms-2">{{ auditoriaTarde.length }} ajuste(s)</span>
            </div>
            <div class="table-responsive">
              <table class="table table-dark table-hover align-middle app-table mb-0">
                <thead>
                  <tr>
                    <th style="width:70px">Hora</th>
                    <th>Producto</th>
                    <th style="width:120px">Empleada</th>
                    <th style="width:100px" class="text-center">Tipo</th>
                    <th style="width:90px" class="text-end">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in auditoriaTarde" :key="m.movimientoId">
                    <td class="td-code text-secondary">{{ formatHora(m.fecha) }}</td>
                    <td class="fw-semibold">{{ m.productoNombre ?? `Producto #${m.productoId}` }}</td>
                    <td class="text-secondary">{{ empleadaNombre(m) }}</td>
                    <td class="text-center">
                      <span class="badge" :class="badgeTipoClass(m.tipoMovimiento)">{{ m.tipoMovimiento }}</span>
                    </td>
                    <td class="text-end td-num fw-bold" :class="m.tipoMovimiento === 'ENTRADA' ? 'text-success' : 'text-danger'">
                      {{ m.tipoMovimiento === 'ENTRADA' ? '+' : '-' }}{{ m.cantidad }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>
      </div>
    </div>

    <!-- ── Filtros + historial completo ───────────────────────────────────── -->
    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Filtros</h2>
        </div>
        <div class="filters-grid mb-3">
          <div>
            <label class="form-label field-label">Tipo</label>
            <select v-model="filtroTipo" class="form-select app-input">
              <option value="">Todos</option>
              <option value="ENTRADA">ENTRADA</option>
              <option value="SALIDA">SALIDA</option>
            </select>
          </div>
          <div>
            <label class="form-label field-label">Motivo</label>
            <select v-model="filtroMotivo" class="form-select app-input">
              <option value="">Todos</option>
              <option value="COMPRA">COMPRA</option>
              <option value="VENTA">VENTA</option>
              <option value="AJUSTE">AJUSTE</option>
              <option value="DEVOLUCION">DEVOLUCIÓN</option>
            </select>
          </div>
          <div>
            <label class="form-label field-label">ID de producto</label>
            <input v-model="filtroProductoId" class="form-control app-input" placeholder="Ej: 42" inputmode="numeric" />
          </div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-primary btn-accent btn-sm" @click="aplicarFiltros" :disabled="loading">Buscar</button>
          <button class="btn btn-outline-light btn-sm" @click="limpiarFiltros" :disabled="loading">Limpiar</button>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Historial completo</h2>
          <div class="helper-text">{{ totalElements }} movimiento(s)</div>
        </div>

        <div v-if="loading" class="empty-block">
          <div class="helper-text">Cargando...</div>
        </div>

        <div v-else-if="!rows.length" class="empty-block">
          <div class="empty-title">Sin movimientos</div>
          <div class="helper-text">Probá ajustando los filtros.</div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th style="width:160px">Fecha</th>
                <th>Producto</th>
                <th style="width:100px">Código</th>
                <th style="width:110px">Tipo</th>
                <th style="width:130px">Motivo</th>
                <th style="width:90px" class="text-end">Cantidad</th>
                <th style="width:80px" class="text-center">Venta</th>
                <th style="width:80px" class="text-center">Compra</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in rows" :key="m.movimientoId">
                <td>
                  <div class="text-secondary" style="font-size:0.82rem">{{ formatDateTime(m.fecha) }}</div>
                  <div v-if="isAdmin" class="helper-text" style="font-size:0.7rem;margin-top:2px">
                    Turno {{ turnoDeHora(m.fecha) }}
                  </div>
                </td>
                <td class="fw-semibold">{{ m.productoNombre ?? `Producto #${m.productoId}` }}</td>
                <td class="td-code text-secondary">{{ m.productoCodigo ?? "—" }}</td>
                <td>
                  <span class="badge" :class="badgeTipoClass(m.tipoMovimiento)">{{ m.tipoMovimiento }}</span>
                </td>
                <td>
                  <span class="badge" :class="badgeMotivoClass(m.motivo)">{{ m.motivo }}</span>
                </td>
                <td class="text-end td-num fw-bold">
                  <span :class="m.tipoMovimiento === 'ENTRADA' ? 'text-success' : 'text-danger'">
                    {{ m.tipoMovimiento === 'ENTRADA' ? '+' : '-' }}{{ m.cantidad }}
                  </span>
                </td>
                <td class="text-center text-secondary">
                  <span v-if="m.ventaId">#{{ m.ventaId }}</span>
                  <span v-else>—</span>
                </td>
                <td class="text-center text-secondary">
                  <span v-if="m.compraId">#{{ m.compraId }}</span>
                  <span v-else>—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-3" v-if="rows.length">
          <Pager
            :page="page" :size="size" :total-elements="totalElements"
            :total-pages="totalPages" :loading="loading"
            @update:page="onPageChange"
          />
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.movstock-page { min-height: 100%; }

.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.kpi-card {
  background: var(--app-bg-panel, #1a1a1a);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 2px;
  padding: 14px 18px;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.turno-header {
  display: flex;
  align-items: center;
}
</style>
