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
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.response?.data ||
    e?.message ||
    fallback
  )
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
    value:
      dashboard.value.crecimientoMensual == null
        ? "—"
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
  <div class="reportes-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Reportes</p>
        <h1 class="page-title mb-1">Reportes</h1>
        <p class="page-subtitle mb-0">
          Panel de métricas, facturación, productos, métodos de pago y ganancias.
        </p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="refreshAll" :disabled="loading">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>
      </div>
    </section>

    <div v-if="errorMsg" class="alert alert-danger py-2 mb-3">
      {{ errorMsg }}
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Filtros</h2>
          <div class="helper-text">
            Ajustá el rango para recalcular los indicadores.
          </div>
        </div>

        <div class="filters-grid">
          <div>
            <label class="form-label field-label">Desde</label>
            <input
              v-model="filtros.desde"
              type="date"
              class="form-control app-input"
            />
          </div>

          <div>
            <label class="form-label field-label">Hasta</label>
            <input
              v-model="filtros.hasta"
              type="date"
              class="form-control app-input"
            />
          </div>

          <div class="filter-action">
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
            <div class="kpi-label">{{ c.label }}</div>
            <div class="kpi-value">{{ c.value }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Facturación mensual</h2>
          <div class="helper-text">Resumen agrupado por mes</div>
        </div>

        <div v-if="dashboard.facturacionMensual.length === 0" class="empty-block">
          <div class="empty-title">No hay datos para mostrar</div>
          <div class="helper-text">
            No hubo facturación mensual en el rango seleccionado.
          </div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th>Mes</th>
                <th class="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in dashboard.facturacionMensual" :key="item.mes">
                <td class="fw-semibold">{{ item.mes }}</td>
                <td class="text-end td-num fw-bold">$ {{ formatMoney(item.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Facturación por método de pago</h2>
          <div class="helper-text">Totales cobrados por cada método</div>
        </div>

        <div v-if="dashboard.facturacionPorMetodo.length === 0" class="empty-block">
          <div class="empty-title">No hay pagos registrados</div>
          <div class="helper-text">
            No hubo pagos para el período seleccionado.
          </div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th>Método</th>
                <th class="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in dashboard.facturacionPorMetodo" :key="item.metodo">
                <td class="fw-semibold">{{ item.metodo }}</td>
                <td class="text-end td-num fw-bold">$ {{ formatMoney(item.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Productos más vendidos</h2>
          <div class="helper-text">Ranking por cantidad y facturación</div>
        </div>

        <div v-if="dashboard.productosMasVendidos.length === 0" class="empty-block">
          <div class="empty-title">No hay productos vendidos</div>
          <div class="helper-text">
            No se encontraron ventas de productos en este período.
          </div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th class="text-end" style="width: 140px">Cantidad</th>
                <th class="text-end" style="width: 180px">Facturado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in dashboard.productosMasVendidos" :key="p.productoId">
                <td>
                  <div class="table-main">{{ p.nombre }}</div>
                </td>
                <td class="text-end td-num">{{ p.totalCantidad }}</td>
                <td class="text-end td-num fw-bold">$ {{ formatMoney(p.totalFacturado) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Ganancia total del período</h2>
          <div class="helper-text">Calculada a partir de las ventas del rango seleccionado</div>
        </div>

        <div class="kpi-value">
          $ {{ formatMoney(gananciaTotalSolo) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reportes-page {
  min-height: 100%;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}

.filter-action {
  min-width: 0;
}

.kpi-label {
  color: rgba(255,255,255,.62);
  font-size: .82rem;
  margin-bottom: 6px;
}

.kpi-value {
  color: #fff;
  font-weight: 800;
  font-size: 1.15rem;
}

.table-main {
  color: #fff;
  font-weight: 600;
}

.table-sub {
  color: rgba(255,255,255,.58);
  font-size: .82rem;
  margin-top: 2px;
}

.empty-block {
  padding: 14px 0;
}

.empty-title {
  color: #fff;
  font-weight: 700;
  margin-bottom: 4px;
}

@media (max-width: 992px) {
  .filters-grid {
    grid-template-columns: 1fr;
  }
}
</style>