<script setup>
import { computed, onMounted, ref } from "vue"
import { reportesApi } from "../services/reportesApi"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonthISO() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return Number.isFinite(num)
    ? num.toLocaleString("es-AR", { maximumFractionDigits: 0 })
    : "0"
}

function formatPct(n) {
  const num = Number(n ?? 0)
  return Number.isFinite(num)
    ? `${num.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`
    : "0%"
}

function pickErr(e, fallback = "Error") {
  return e?.response?.data?.error || e?.response?.data?.message || e?.response?.data || e?.message || fallback
}

const loading = ref(false)
const errorMsg = ref("")

const filtros = ref({
  desde: firstDayOfMonthISO(),
  hasta: todayISO(),
})

const dashboard = ref({
  facturacionMensual: [],
  productosMasVendidos: [],
  facturacionPorMetodo: [],
  totalVendido: 0,
  totalCobrado: 0,
  pendienteDeCobro: 0,
  cantidadVentas: 0,
  ticketPromedio: 0,
  crecimientoMensual: null,
  totalGanancia: 0,
  margenPorcentual: 0,
})

const gananciaTotalSolo = ref(0)

const cards = computed(() => [
  { label: "Total vendido", value: `$ ${formatMoney(dashboard.value.totalVendido)}` },
  { label: "Total cobrado", value: `$ ${formatMoney(dashboard.value.totalCobrado)}` },
  { label: "Pendiente de cobro", value: `$ ${formatMoney(dashboard.value.pendienteDeCobro)}` },
  { label: "Cantidad de ventas", value: dashboard.value.cantidadVentas },
  { label: "Ticket promedio", value: `$ ${formatMoney(dashboard.value.ticketPromedio)}` },
  { label: "Ganancia total", value: `$ ${formatMoney(dashboard.value.totalGanancia)}` },
  { label: "Margen porcentual", value: formatPct(dashboard.value.margenPorcentual) },
  {
    label: "Crecimiento mensual",
    value: dashboard.value.crecimientoMensual == null
      ? "-"
      : formatPct(dashboard.value.crecimientoMensual),
  },
])

async function refreshAll() {
  loading.value = true
  errorMsg.value = ""

  try {
    const params = {
      desde: filtros.value.desde || undefined,
      hasta: filtros.value.hasta || undefined,
    }

    const [dashboardRes, gananciaRes] = await Promise.all([
      reportesApi.dashboard(params),
      reportesApi.gananciaTotal(params),
    ])

    dashboard.value = {
      facturacionMensual: dashboardRes?.data?.facturacionMensual ?? [],
      productosMasVendidos: dashboardRes?.data?.productosMasVendidos ?? [],
      facturacionPorMetodo: dashboardRes?.data?.facturacionPorMetodo ?? [],
      totalVendido: Number(dashboardRes?.data?.totalVendido ?? 0),
      totalCobrado: Number(dashboardRes?.data?.totalCobrado ?? 0),
      pendienteDeCobro: Number(dashboardRes?.data?.pendienteDeCobro ?? 0),
      cantidadVentas: Number(dashboardRes?.data?.cantidadVentas ?? 0),
      ticketPromedio: Number(dashboardRes?.data?.ticketPromedio ?? 0),
      crecimientoMensual: dashboardRes?.data?.crecimientoMensual ?? null,
      totalGanancia: Number(dashboardRes?.data?.totalGanancia ?? 0),
      margenPorcentual: Number(dashboardRes?.data?.margenPorcentual ?? 0),
    }

    gananciaTotalSolo.value = Number(
      gananciaRes?.data?.totalGanancia ??
      gananciaRes?.data?.gananciaTotal ??
      gananciaRes?.data?.total ??
      0
    )
  } catch (e) {
    errorMsg.value = pickErr(e, "No se pudieron cargar los reportes.")
  } finally {
    loading.value = false
  }
}

onMounted(refreshAll)
</script>

<template>
  <div class="container-fluid py-3">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
      <div>
        <h1 class="h4 mb-1">Reportes</h1>
        <div class="text-secondary">
          Panel de métricas, facturación, productos, métodos de pago y ganancias.
        </div>
      </div>

      <button class="btn btn-outline-light" @click="refreshAll" :disabled="loading">
        {{ loading ? "Actualizando..." : "Refresh" }}
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Desde</label>
            <input
              v-model="filtros.desde"
              type="date"
              class="form-control bg-dark text-white border-secondary"
            />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Hasta</label>
            <input
              v-model="filtros.hasta"
              type="date"
              class="form-control bg-dark text-white border-secondary"
            />
          </div>

          <div class="col-12 col-md-3">
            <button class="btn btn-primary btn-accent w-100" @click="refreshAll" :disabled="loading">
              Aplicar filtros
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-md-6 col-xl-3" v-for="c in cards" :key="c.label">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-secondary small mb-2">{{ c.label }}</div>
            <div class="fs-4 fw-bold">{{ c.value }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <h2 class="h6 mb-3">Facturación mensual</h2>

        <div v-if="dashboard.facturacionMensual.length === 0" class="text-secondary">
          No hay datos para el período seleccionado.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Mes</th>
                <th class="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in dashboard.facturacionMensual" :key="item.mes">
                <td class="fw-semibold">{{ item.mes }}</td>
                <td class="text-end fw-bold">$ {{ formatMoney(item.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <h2 class="h6 mb-3">Facturación por método de pago</h2>

        <div v-if="dashboard.facturacionPorMetodo.length === 0" class="text-secondary">
          No hay pagos registrados en el período seleccionado.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Método</th>
                <th class="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in dashboard.facturacionPorMetodo" :key="item.metodo">
                <td class="fw-semibold">{{ item.metodo }}</td>
                <td class="text-end fw-bold">$ {{ formatMoney(item.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <h2 class="h6 mb-3">Productos más vendidos</h2>

        <div v-if="dashboard.productosMasVendidos.length === 0" class="text-secondary">
          No hay productos vendidos para mostrar.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>Producto</th>
                <th class="text-end">Cantidad</th>
                <th class="text-end">Facturado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in dashboard.productosMasVendidos" :key="p.productoId">
                <td class="text-secondary">{{ p.productoId }}</td>
                <td class="fw-semibold">{{ p.nombre }}</td>
                <td class="text-end">{{ p.totalCantidad }}</td>
                <td class="text-end fw-bold">$ {{ formatMoney(p.totalFacturado) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <h2 class="h6 mb-3">Chequeo rápido de ganancia total</h2>

        <div class="text-secondary small mb-2">
          Valor obtenido desde el endpoint de ganancia total.
        </div>

        <div class="fs-5 fw-bold">
          $ {{ formatMoney(gananciaTotalSolo) }}
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.bg-panel {
  background: rgba(18, 22, 32, 0.92);
}

.btn-accent {
  background: #6f5cff;
  border: none;
  color: #fff;
}

.btn-accent:hover {
  background: #5f4de6;
}

.card {
  border-radius: 16px;
}

.table > :not(caption) > * > * {
  background-color: transparent !important;
}

.table-dark {
  --bs-table-bg: transparent;
  --bs-table-striped-bg: rgba(255, 255, 255, 0.02);
  --bs-table-hover-bg: rgba(255, 255, 255, 0.04);
  --bs-table-border-color: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.form-control,
.form-select {
  border-radius: 12px;
}

.text-secondary {
  color: rgba(255, 255, 255, 0.68) !important;
}

code {
  color: #caa6ff;
  background: rgba(202, 166, 255, 0.08);
  padding: 2px 6px;
  border-radius: 8px;
}

.alert {
  border-radius: 14px;
}

.fs-4.fw-bold,
.fs-5.fw-bold {
  color: #fff;
}
</style>