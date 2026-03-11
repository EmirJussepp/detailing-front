<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue"
import { cajaApi } from "../services/cajaApi"
import Pager from "../components/Pager.vue"

// --- Estado ---
const admin = ref(true) // Cambiar según sesión real
const turnoSel = ref("MANIANA")
const loading = ref(false)
const errorMsg = ref("")
const okMsg = ref("")
const infoMsg = ref("")
const caja = ref<any>(null)
const cajaCerrada = ref(false)
const movimientos = ref<any[]>([])
const resumen = ref({ ingresos: 0, egresos: 0, saldo: 0 })

// --- Filtros ---
const filtroTipo = ref("TODOS")
const filtroConcepto = ref("TODOS")
const filtroTexto = ref("")

// --- Paginación ---
const page = ref(0)
const size = ref(10)
const totalElements = ref(0)
const totalPages = ref(1)

// --- KPIs ---
const kpiMovimientos = computed(() => movimientosFiltrados.value.length)
const kpiIngresosFiltrados = computed(() =>
  movimientosFiltrados.value
    .filter(m => m.tipo === "INGRESO")
    .reduce((acc, m) => acc + m.monto, 0)
)
const kpiEgresosFiltrados = computed(() =>
  movimientosFiltrados.value
    .filter(m => m.tipo === "EGRESO")
    .reduce((acc, m) => acc + m.monto, 0)
)
const kpiNetoFiltrado = computed(() =>
  kpiIngresosFiltrados.value - kpiEgresosFiltrados.value
)

const movimientosFiltrados = computed(() =>
  movimientos.value.filter(m => {
    const tipoOk = filtroTipo.value === "TODOS" || m.tipo === filtroTipo.value
    const conceptoOk = filtroConcepto.value === "TODOS" || m.concepto === filtroConcepto.value
    const textoOk =
      !filtroTexto.value ||
      (m.descripcion ?? "").toLowerCase().includes(filtroTexto.value.toLowerCase())
    return tipoOk && conceptoOk && textoOk
  })
)

// --- Fetch unificado ---
async function refreshCaja() {
  loading.value = true
  errorMsg.value = ""
  caja.value = null
  movimientos.value = []
  resumen.value = { ingresos: 0, egresos: 0, saldo: 0 }

  try {
    let response

    // 🔹 Intentamos obtener la caja abierta primero
    try {
      response = await cajaApi.abierta({ turno: turnoSel.value })
      caja.value = response.data
      cajaCerrada.value = false
      movimientos.value = response.data.movimientos ?? []

      const ingresos = movimientos.value
        .filter((m: any) => m.tipo === "INGRESO")
        .reduce((acc, m) => acc + (m.monto ?? 0), 0)

      const egresos = movimientos.value
        .filter((m: any) => m.tipo === "EGRESO")
        .reduce((acc, m) => acc + (m.monto ?? 0), 0)

      resumen.value = {
        ingresos,
        egresos,
        saldo: (response.data.montoInicial ?? 0) + ingresos - egresos
      }

    } catch (err: any) {
      // 🔹 No hay caja abierta → intentamos la última caja cerrada
      if (err.response?.status === 404) {
        try {
          response = await cajaApi.reporteCierre(turnoSel.value)
          const reporte = response.data

          caja.value = reporte.caja
          cajaCerrada.value = true
          movimientos.value = reporte.movimientos ?? []

          resumen.value = {
            ingresos: reporte.ingresos ?? 0,
            egresos: reporte.egresos ?? 0,
            saldo: reporte.saldoFinal ?? 0
          }

        } catch (err2: any) {
          // 🔹 No hay caja abierta ni cerrada
          errorMsg.value = `No hay caja registrada para el turno "${turnoSel.value}".`
          caja.value = null
          movimientos.value = []
          resumen.value = { ingresos: 0, egresos: 0, saldo: 0 }
        }
      } else {
        throw err
      }
    }

  } catch (e: any) {
    // 🔹 Cualquier otro error inesperado
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error cargando caja"
    caja.value = null
    movimientos.value = []
    resumen.value = { ingresos: 0, egresos: 0, saldo: 0 }
  } finally {
    loading.value = false
  }
}
// --- Funciones utilitarias ---
function formatMoney(n: number) {
  return Number(n ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function signedMoney(m: any) {
  return (m.tipo === "EGRESO" ? "-" : "") + formatMoney(m.monto)
}

function rowClass(m: any) {
  return m.tipo === "INGRESO" ? "table-success" : "table-danger"
}

// --- Export CSV simple ---
function exportCSV() {
  const csv = [
    ["ID", "Fecha", "Tipo", "Concepto", "Descripción", "Monto"],
    ...movimientosFiltrados.value.map(m => [
      m.movimientoCajaId ?? m.id,
      m.fecha,
      m.tipo,
      m.concepto ?? "",
      m.descripcion ?? "",
      m.monto,
    ]),
  ]
    .map(r => r.join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `movimientos_${turnoSel.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

watch(turnoSel, refreshCaja, { immediate: true })
onMounted(refreshCaja)
</script>

<template>
  <div class="container py-4">
    <div class="mb-3 d-flex flex-wrap justify-content-between align-items-end gap-2">
      <div>
        <h1 class="h4 mb-1">Movimientos del turno</h1>
        <div class="text-secondary">
          <span v-if="admin">
            Vista operativa. Podés cambiar el turno para ver la caja actual.
          </span>
          <span v-else>
            Vista operativa de tu turno actual.
          </span>
        </div>
      </div>

      <button class="btn btn-outline-light" @click="refreshCaja" :disabled="loading">
        {{ loading ? "Actualizando..." : "Refresh" }}
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>

    <div v-if="caja">
      <div class="card bg-panel border-0 shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-3 align-items-end">
           <div class="col-12 col-md-3">
  <label class="form-label text-secondary">Turno</label>

  <!-- Si es admin, mostrar select -->
  <select
    v-if="admin"
    v-model="turnoSel"
    class="form-control bg-dark text-white border-secondary"
  >
    <option value="MANIANA">MAÑANA</option>
    <option value="TARDE">TARDE</option>
  </select>

  <!-- Si no es admin, mostrar input readonly -->
  <input
    v-else
    class="form-control bg-dark text-white border-secondary"
    :value="turnoSel"
    disabled
  />
</div>
            <div class="col-12 col-md-9">
              <div v-if="loading" class="text-secondary small">Cargando…</div>
              <div v-else class="small text-secondary">
                <div class="mb-1">Estado: <b>{{ cajaCerrada ? 'CERRADA' : 'ABIERTA' }}</b></div>
                <span>Caja #<b>{{ caja.cajaId }}</b></span>
                <span class="ms-2">Ingresos: <b>$ {{ formatMoney(resumen.ingresos) }}</b></span>
                <span class="ms-2">Egresos: <b>$ {{ formatMoney(resumen.egresos) }}</b></span>
                <span class="ms-2">Saldo: <b>$ {{ formatMoney(resumen.saldo) }}</b></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="row g-3 mb-4">
        <div class="col-12 col-md-3">
          <div class="card bg-panel border-0 shadow-sm">
            <div class="card-body">
              <div class="text-secondary small">Movimientos</div>
              <div class="fs-4 fw-bold">{{ kpiMovimientos }}</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card bg-panel border-0 shadow-sm">
            <div class="card-body">
              <div class="text-secondary small">Ingresos</div>
              <div class="fs-4 fw-bold">$ {{ formatMoney(kpiIngresosFiltrados) }}</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card bg-panel border-0 shadow-sm">
            <div class="card-body">
              <div class="text-secondary small">Egresos</div>
              <div class="fs-4 fw-bold">$ {{ formatMoney(kpiEgresosFiltrados) }}</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card bg-panel border-0 shadow-sm">
            <div class="card-body">
              <div class="text-secondary small">Neto</div>
              <div class="fs-4 fw-bold">$ {{ formatMoney(kpiNetoFiltrado) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filtros y export CSV -->
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="d-flex gap-2">
          <select v-model="filtroTipo" class="form-select bg-dark text-white border-secondary">
            <option value="TODOS">Todos</option>
            <option value="INGRESO">Solo ingresos</option>
            <option value="EGRESO">Solo egresos</option>
          </select>
          <select v-model="filtroConcepto" class="form-select bg-dark text-white border-secondary">
            <option value="TODOS">Todos los conceptos</option>
          </select>
          <input
            v-model="filtroTexto"
            class="form-control bg-dark text-white border-secondary"
            placeholder="Buscar descripción..."
          />
        </div>

        <button
          class="btn btn-outline-light btn-sm"
          @click="exportCSV"
          :disabled="!movimientosFiltrados.length"
        >
          Exportar CSV
        </button>
      </div>

      <!-- Tabla -->
      <div class="table-responsive">
        <table class="table table-dark table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Concepto</th>
              <th>Descripción</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in movimientosFiltrados" :key="m.movimientoCajaId ?? m.id" :class="rowClass(m)">
              <td>{{ m.movimientoCajaId ?? m.id }}</td>
              <td>{{ m.fecha }}</td>
              <td>{{ m.tipo }}</td>
              <td>{{ m.concepto ?? "-" }}</td>
              <td>{{ m.descripcion ?? "-" }}</td>
              <td class="text-end fw-bold">{{ signedMoney(m) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totales finales -->
      <div class="d-flex justify-content-between align-items-center gap-2 mt-3">
        <div class="text-secondary small">
          Ingresos: <b>$ {{ formatMoney(resumen.ingresos) }}</b> ·
          Egresos: <b>$ {{ formatMoney(resumen.egresos) }}</b> ·
          Saldo: <b>$ {{ formatMoney(resumen.saldo) }}</b>
        </div>
        <div class="text-secondary small">
          Total registros: <b>{{ totalElements }}</b>
        </div>
      </div>

      <!-- Paginador -->
      <div class="mt-3" v-if="movimientos.length">
        <Pager
          :page="page"
          :size="size"
          :total-elements="totalElements"
          :total-pages="totalPages"
          @update:page="page = $event"
          @update:size="size = $event"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-panel { background: rgba(18, 22, 32, .92); }
.btn-accent { background: #6f5cff; border: none; }
.btn-accent:hover { background: #5f4de6; }

.row-ingreso td { background: rgba(25, 135, 84, 0.08) !important; }
.row-egreso td { background: rgba(220, 53, 69, 0.08) !important; }

.table-dark.table-hover tbody tr:hover td { filter: brightness(1.05); }
</style>