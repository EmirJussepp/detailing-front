<script setup>
import { ref, onMounted, computed } from "vue"
import { tiendaNubeApi } from "../services/tiendaNubeApi"
import { getSession } from "../auth/session"

const session = getSession() ?? null
const permissions = Array.isArray(session?.permissions) ? session.permissions : []
const isAdmin = computed(() => permissions.includes("admin:all"))

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(v) {
  if (!v) return "—"
  try {
    const text = String(v).includes("T") ? String(v) : `${v}T00:00:00`
    return new Date(text).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch { return String(v) }
}

function unwrapArray(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  return []
}

// ── Estado ──────────────────────────────────────────────
const loading = ref(false)
const syncing = ref(false)
const errorMsg = ref("")
const okMsg = ref("")

const ventas = ref([])
const totalVentas = ref(0)
const totalImporte = ref(0)
const cajaOnline = ref(null)

// ── Carga de datos ───────────────────────────────────────
async function cargarDatos() {
  loading.value = true
  errorMsg.value = ""
  try {
    const [ventasRes, cajaRes] = await Promise.allSettled([
      tiendaNubeApi.ventasOnline({ size: 50, page: 0 }),
      tiendaNubeApi.cajaOnline(),
    ])

    if (ventasRes.status === "fulfilled") {
      const data = ventasRes.value?.data
      ventas.value = unwrapArray(data)
      totalVentas.value = data?.totalElements ?? ventas.value.length
      totalImporte.value = ventas.value.reduce((acc, v) => acc + Number(v.total ?? v.monto ?? 0), 0)
    } else {
      errorMsg.value = ventasRes.reason?.response?.data?.error
        ?? ventasRes.reason?.message
        ?? "No se pudieron cargar las ventas online."
    }

    if (cajaRes.status === "fulfilled") {
      cajaOnline.value = cajaRes.value?.data ?? null
    } else {
      cajaOnline.value = null
    }
  } catch (e) {
    errorMsg.value = e?.response?.data?.error ?? e?.message ?? "Error al cargar datos."
  } finally {
    loading.value = false
  }
}

// ── Sync productos ───────────────────────────────────────
async function syncProductos() {
  syncing.value = true
  errorMsg.value = ""
  okMsg.value = ""
  try {
    const res = await tiendaNubeApi.syncProductos()
    const data = res?.data
    const sincronizados = data?.sincronizados ?? data?.updated ?? "?"
    okMsg.value = `✅ Sync completado. ${sincronizados} productos actualizados.`
    await cargarDatos()
  } catch (e) {
    errorMsg.value = e?.response?.data?.error ?? e?.message ?? "Error al sincronizar productos."
  } finally {
    syncing.value = false
  }
}

onMounted(cargarDatos)
</script>

<template>
  <div class="tn-view">
    <!-- Header -->
    <div class="page-header">
      <div class="page-header__left">
        <div class="eyebrow">Tienda Nube</div>
        <h1 class="page-title">Panel Online</h1>
        <p class="page-sub">Ventas y sincronización con tu tienda online.</p>
      </div>
      <div class="page-header__actions">
        <button
          class="btn btn-primary btn-accent"
          :disabled="syncing"
          @click="syncProductos"
        >
          <span v-if="syncing">Sincronizando...</span>
          <span v-else>🔄 Sync Productos</span>
        </button>
        <button class="btn btn-outline" :disabled="loading" @click="cargarDatos">
          Actualizar
        </button>
      </div>
    </div>

    <!-- Mensajes -->
    <div v-if="okMsg" class="alert alert-success">{{ okMsg }}</div>
    <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>

    <!-- Cards resumen -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card__label">Total ventas online</div>
        <div class="stat-card__value">{{ totalVentas }}</div>
        <div class="stat-card__sub">pedidos registrados</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Facturado online</div>
        <div class="stat-card__value">$ {{ formatMoney(totalImporte) }}</div>
        <div class="stat-card__sub">acumulado histórico</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Caja Online</div>
        <div class="stat-card__value">
          <span class="badge badge-online">{{ cajaOnline ? 'ACTIVA' : 'NO ENCONTRADA' }}</span>
        </div>
        <div class="stat-card__sub">permanente · nunca se cierra</div>
      </div>
    </div>

    <!-- Tabla ventas -->
    <div class="panel">
      <div class="panel__header">
        <h2 class="panel__title">Últimas ventas de Tienda Nube</h2>
      </div>

      <div v-if="loading" class="empty-state">Cargando...</div>

      <div v-else-if="ventas.length === 0" class="empty-state">
        No hay ventas online registradas aún.
      </div>

      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Orden TN</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in ventas" :key="v.ventaId ?? v.id">
              <td>{{ v.ventaId ?? v.id }}</td>
              <td>{{ formatDateTime(v.fecha ?? v.createdAt) }}</td>
              <td>{{ v.clienteNombre ?? v.cliente?.nombre ?? "—" }}</td>
              <td>
                <span class="badge badge-tn" v-if="v.tiendaNubeOrderId">
                  #{{ v.tiendaNubeOrderId }}
                </span>
                <span v-else>—</span>
              </td>
              <td class="text-right td-num">$ {{ formatMoney(v.total ?? v.monto ?? 0) }}</td>
              <td>
                <span class="badge badge-online">ONLINE</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Info sync productos -->
    <div class="panel">
      <div class="panel__header">
        <h2 class="panel__title">Sincronización de productos</h2>
      </div>
      <div class="info-box">
        <p>
          El botón <strong>Sync Productos</strong> conecta los productos de tu sistema con los de Tienda Nube usando el <strong>SKU (código de producto)</strong> como clave de mapeo.
        </p>
        <p>
          Una vez sincronizados, cada venta que entre por Tienda Nube descontará automáticamente el stock del producto correspondiente.
        </p>
        <p>
          Para que funcione correctamente, el código de producto en tu sistema debe coincidir exactamente con el SKU del producto en Tienda Nube.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tn-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Header */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.page-header__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.eyebrow {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(201, 162, 39, 0.7);
  margin-bottom: 4px;
}
.page-title {
  font-size: 1.6rem;
  font-weight: 900;
  color: #fff;
  margin: 0 0 4px;
}
.page-sub {
  font-size: 0.875rem;
  color: rgba(255,255,255,0.5);
  margin: 0;
}

/* Alerts */
.alert {
  padding: 12px 16px;
  border-radius: 2px;
  font-size: 0.875rem;
  font-weight: 600;
}
.alert-success {
  background: rgba(34,197,94,0.10);
  border: 1px solid rgba(34,197,94,0.25);
  color: #7ee2ab;
}
.alert-danger {
  background: rgba(239,68,68,0.10);
  border: 1px solid rgba(239,68,68,0.22);
  color: #ff8d98;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.stat-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.07);
  border-top: 2px solid rgba(255,255,255,0.12);
  border-radius: 2px;
  padding: 14px 16px;
}
.stat-card__label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.70rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: rgba(255,255,255,0.45);
  margin-bottom: 8px;
}
.stat-card__value {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 1.5rem;
  font-weight: 600;
  color: #fff;
  letter-spacing: -0.01em;
  margin-bottom: 4px;
}
.stat-card__sub {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.35);
}

/* Panel */
.panel {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 2px;
  overflow: hidden;
}
.panel__header {
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.panel__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

/* Table */
.table-wrap {
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.table th {
  padding: 8px 16px;
  text-align: left;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: rgba(255,255,255,0.40);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.85);
}
.table tbody tr:hover td {
  background: rgba(255,255,255,0.02);
}
.text-right { text-align: right; }

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 2px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge-online {
  background: rgba(201,162,39,0.12);
  border: 1px solid rgba(201,162,39,0.30);
  color: #e8c97a;
}
.badge-tn {
  background: rgba(99,102,241,0.12);
  border: 1px solid rgba(99,102,241,0.26);
  color: #a5b4fc;
}

/* Empty */
.empty-state {
  padding: 40px;
  text-align: center;
  color: rgba(255,255,255,0.3);
  font-size: 0.875rem;
}

/* Info box */
.info-box {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 0.875rem;
  color: rgba(255,255,255,0.6);
  line-height: 1.6;
}
.info-box p { margin: 0; }
.info-box strong { color: rgba(255,255,255,0.85); }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-radius: 2px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary {
  background: rgba(201,162,39,0.18);
  border-color: rgba(201,162,39,0.65);
  color: #e0c060;
}
.btn-primary:hover:not(:disabled) {
  background: rgba(201,162,39,0.28);
  border-color: #c9a227;
  color: #fff;
}
.btn-primary:hover:not(:disabled) { background: #dbb840; }
.btn-outline {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.7);
}
.btn-outline:hover:not(:disabled) {
  border-color: rgba(255,255,255,0.3);
  color: #fff;
}
</style>