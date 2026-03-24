<script setup>
import { ref, computed, onMounted } from "vue"
import { getSession } from "../auth/session"
import { movimientosStockApi } from "../services/movimientosCajaApi"
import Pager from "../components/Pager.vue"

const session = getSession() ?? null
const permissions = Array.isArray(session?.permissions) ? session.permissions : []

function hasPermission(p) {
  if (permissions.includes("admin:all")) return true
  return permissions.includes(p)
}

const canView = computed(() => hasPermission("movimientos_stock:ver"))

const loading = ref(false)
const errorMsg = ref("")

const rows = ref([])
const page = ref(0)
const size = ref(15)
const totalElements = ref(0)
const totalPages = ref(1)

// Filtros
const filtroTipo = ref("")
const filtroMotivo = ref("")
const filtroProductoId = ref("")

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
    })
  } catch {
    return String(v)
  }
}

function badgeTipoClass(tipo) {
  return String(tipo || "").toUpperCase() === "ENTRADA"
    ? "badge-soft-success"
    : "badge-soft-danger"
}

function badgeMotivoClass(motivo) {
  const m = String(motivo || "").toUpperCase()
  if (m === "COMPRA") return "badge-soft-info"
  if (m === "VENTA") return "badge-soft-warning"
  if (m === "DEVOLUCION") return "badge-soft-neutral"
  return "badge-soft-neutral"
}

async function load() {
  if (!canView.value) {
    errorMsg.value = "Sin permisos para ver movimientos de stock."
    return
  }

  loading.value = true
  errorMsg.value = ""

  try {
    const params = {
      page: page.value,
      size: size.value,
    }

    if (filtroTipo.value) params.tipo = filtroTipo.value
    if (filtroMotivo.value) params.motivo = filtroMotivo.value
    if (filtroProductoId.value) params.productoId = Number(filtroProductoId.value)

    const { data } = await movimientosStockApi.list(params)

    rows.value = Array.isArray(data?.content)
      ? data.content
      : Array.isArray(data)
        ? data
        : []

    totalElements.value = Number(data?.totalElements ?? rows.value.length)
    totalPages.value = Math.max(1, Number(data?.totalPages ?? 1))
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error cargando movimientos de stock."
  } finally {
    loading.value = false
  }
}

function aplicarFiltros() {
  page.value = 0
  load()
}

function limpiarFiltros() {
  filtroTipo.value = ""
  filtroMotivo.value = ""
  filtroProductoId.value = ""
  page.value = 0
  load()
}

function onPageChange(newPage) {
  page.value = Number(newPage ?? 0)
  load()
}

onMounted(() => {
  load()
})
</script>

<template>
  <div class="movstock-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Inventario</p>
        <h1 class="page-title mb-1">Movimientos de Stock</h1>
        <p class="page-subtitle mb-0">
          Historial de entradas y salidas de productos.
        </p>
      </div>
      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="load" :disabled="loading">
          {{ loading ? "Cargando..." : "Actualizar" }}
        </button>
      </div>
    </section>

    <div v-if="errorMsg" class="alert alert-danger py-2 mb-3">{{ errorMsg }}</div>

    <!-- Filtros -->
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
            <input
              v-model="filtroProductoId"
              class="form-control app-input"
              placeholder="Ej: 42"
              inputmode="numeric"
            />
          </div>
        </div>

        <div class="d-flex gap-2">
          <button class="btn btn-primary btn-accent btn-sm" @click="aplicarFiltros" :disabled="loading">
            Buscar
          </button>
          <button class="btn btn-outline-light btn-sm" @click="limpiarFiltros" :disabled="loading">
            Limpiar
          </button>
        </div>
      </div>
    </div>

    <!-- Tabla -->
    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Resultados</h2>
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
                <th style="width: 160px">Fecha</th>
                <th>Producto</th>
                <th style="width: 100px">Código</th>
                <th style="width: 110px">Tipo</th>
                <th style="width: 130px">Motivo</th>
                <th style="width: 90px" class="text-end">Cantidad</th>
                <th style="width: 80px" class="text-center">Venta</th>
                <th style="width: 80px" class="text-center">Compra</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in rows" :key="m.movimientoId">
                <td class="text-secondary">{{ formatDateTime(m.fecha) }}</td>

                <!-- ✅ FIX: ahora muestra el nombre del producto gracias al JOIN en el backend -->
                <td class="fw-semibold">
                  {{ m.productoNombre ?? `Producto #${m.productoId}` }}
                </td>

                <td class="text-secondary">
                  {{ m.productoCodigo ?? "—" }}
                </td>

                <td>
                  <span class="badge" :class="badgeTipoClass(m.tipoMovimiento)">
                    {{ m.tipoMovimiento }}
                  </span>
                </td>

                <td>
                  <span class="badge" :class="badgeMotivoClass(m.motivo)">
                    {{ m.motivo }}
                  </span>
                </td>

                <td class="text-end fw-bold">
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
            :page="page"
            :size="size"
            :total-elements="totalElements"
            :total-pages="totalPages"
            :loading="loading"
            @update:page="onPageChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.movstock-page { min-height: 100%; }

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
</style>