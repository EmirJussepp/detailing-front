<script setup>
import { computed, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"

import { clientesApi } from "../services/clientesService"
import { cuentaCorrienteApi } from "../services/cuentaCorrienteService"

const route = useRoute()
const router = useRouter()

// =========================
// Helpers
// =========================
function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
}
function formatDateTime(v) {
  if (!v) return "-"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

// =========================
// State
// =========================
const loading = ref(false)
const errorMsg = ref("")
const okMsg = ref("")

const clientes = ref([])
const clienteIdSel = ref("") // string para select

const deuda = ref(null) // lo que devuelva el back
const estado = ref([])  // movimientos del estado-cuenta

// filtros pro
const filtroTexto = ref("")
const filtroTipo = ref("TODOS") // TODOS | DEBE | HABER

function mapCliente(c) {
  return {
    id: Number(c.clienteId ?? c.id),
    nombre: c.nombre ?? "",
    apellido: c.apellido ?? "",
    dni: c.dni ?? null,
    activo: c.activo ?? true,
  }
}

const clientesActivos = computed(() => (clientes.value || []).filter(c => c.activo !== false))

const clienteSel = computed(() => {
  const id = Number(clienteIdSel.value)
  return clientesActivos.value.find(c => Number(c.id) === id) ?? null
})

const clienteTitulo = computed(() => {
  if (!clienteSel.value) return "Cuenta Corriente"
  const c = clienteSel.value
  const full = `${c.nombre} ${c.apellido || ""}`.trim()
  return `Cuenta Corriente · ${full} (ID #${c.id})`
})

// =========================
// Loaders
// =========================
async function fetchClientes() {
  const { data } = await clientesApi.list()
  const arr = Array.isArray(data) ? data : []
  clientes.value = arr.map(mapCliente)
}

function setClienteFromQuery() {
  const q = route.query.clienteId
  if (!q) return
  clienteIdSel.value = String(q)
}

function pushQueryCliente() {
  if (!clienteIdSel.value) {
    router.replace({ query: { ...route.query, clienteId: undefined } })
    return
  }
  router.replace({ query: { ...route.query, clienteId: String(clienteIdSel.value) } })
}

async function fetchCuenta(clienteId) {
  loading.value = true
  errorMsg.value = ""
  okMsg.value = ""
  try {
    const [rDeuda, rEstado] = await Promise.all([
      cuentaCorrienteApi.deuda(clienteId),
      cuentaCorrienteApi.estadoCuenta(clienteId),
    ])

    deuda.value = rDeuda.data ?? null

    // el back suele devolver array de items ya con saldo acumulado
    const arr = Array.isArray(rEstado.data) ? rEstado.data : []
    estado.value = arr
  } catch (e) {
    deuda.value = null
    estado.value = []
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.response?.data ||
      e?.message ||
      "Error cargando cuenta corriente."
  } finally {
    loading.value = false
  }
}

// =========================
// Normalización UI (por si cambian nombres)
// =========================
function normalizeRow(x) {
  const fecha = x.fecha ?? x.createdAt ?? x.created_at ?? null
  const ref = x.referencia ?? x.ref ?? x.descripcion ?? x.detalle ?? x.concepto ?? null

  // suele venir debe/haber y saldo
  const debe = Number(x.debe ?? 0) || 0
  const haber = Number(x.haber ?? 0) || 0
  const saldo = x.saldo == null ? null : Number(x.saldo)

  // tipo UI (si tiene debe/haber)
  let tipo = "OTRO"
  if (debe > 0) tipo = "DEBE"
  else if (haber > 0) tipo = "HABER"

  return {
    fecha,
    referencia: ref,
    debe,
    haber,
    saldo,
    tipo,
    raw: x,
  }
}

const estadoUI = computed(() => (estado.value || []).map(normalizeRow))

const estadoFiltrado = computed(() => {
  const txt = filtroTexto.value.trim().toLowerCase()
  return estadoUI.value.filter(r => {
    if (filtroTipo.value !== "TODOS" && r.tipo !== filtroTipo.value) return false
    if (txt) {
      const blob = String(r.referencia ?? "").toLowerCase()
      if (!blob.includes(txt)) return false
    }
    return true
  })
})

const totDebe = computed(() => estadoUI.value.reduce((a, r) => a + Number(r.debe || 0), 0))
const totHaber = computed(() => estadoUI.value.reduce((a, r) => a + Number(r.haber || 0), 0))
const saldoFinal = computed(() => {
  if (!estadoUI.value.length) return 0
  const last = estadoUI.value[estadoUI.value.length - 1]
  return Number(last.saldo ?? 0)
})

function exportCSV() {
  const rows = estadoFiltrado.value.map(r => ({
    fecha: r.fecha ?? "",
    referencia: r.referencia ?? "",
    debe: r.debe ?? 0,
    haber: r.haber ?? 0,
    saldo: r.saldo ?? "",
  }))

  const header = ["fecha", "referencia", "debe", "haber", "saldo"]
  const csv = [
    header.join(";"),
    ...rows.map(obj => header.map(k => `"${String(obj[k] ?? "").replaceAll('"', '""')}"`).join(";")),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `cuenta_corriente_cliente_${clienteIdSel.value || "NA"}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// =========================
// Lifecycle
// =========================
onMounted(async () => {
  await fetchClientes()
  setClienteFromQuery()
  if (clienteIdSel.value) await fetchCuenta(Number(clienteIdSel.value))
})

watch(clienteIdSel, async (v) => {
  pushQueryCliente()
  if (!v) {
    deuda.value = null
    estado.value = []
    return
  }
  await fetchCuenta(Number(v))
})
</script>

<template>
  <div>
    <div class="mb-3">
      <h1 class="h4 mb-1">{{ clienteTitulo }}</h1>
      <div class="text-secondary">Historial + saldo acumulado (backend)</div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <!-- Toolbar -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Cliente</label>
            <select v-model="clienteIdSel" class="form-select bg-dark text-white border-secondary" :disabled="loading">
              <option value="">Seleccionar…</option>
              <option v-for="c in clientesActivos" :key="c.id" :value="String(c.id)">
                #{{ c.id }} — {{ c.nombre }} {{ c.apellido || "" }} (DNI: {{ c.dni || "-" }})
              </option>
            </select>
          </div>

          <div class="col-12 col-md-6 d-flex justify-content-md-end gap-2">
            <button class="btn btn-outline-light" @click="clienteIdSel && fetchCuenta(Number(clienteIdSel))" :disabled="loading || !clienteIdSel">
              {{ loading ? "Cargando..." : "Refrescar" }}
            </button>

            <button class="btn btn-outline-light" @click="exportCSV" :disabled="!estadoFiltrado.length">
              Exportar CSV
            </button>
          </div>
        </div>

        <div class="text-secondary small mt-3" v-if="clienteIdSel">
          Totales: Debe <b>$ {{ formatMoney(totDebe) }}</b> · Haber <b>$ {{ formatMoney(totHaber) }}</b> ·
          Saldo <b>$ {{ formatMoney(saldoFinal) }}</b>
          <span v-if="deuda?.deudaTotal != null" class="ms-2">
            · Deuda (endpoint /deuda): <b>$ {{ formatMoney(deuda.deudaTotal) }}</b>
          </span>
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card bg-panel border-0 shadow-sm mb-3" v-if="clienteIdSel">
      <div class="card-body">
        <div class="row g-2">
          <div class="col-12 col-md-3">
            <select v-model="filtroTipo" class="form-select bg-dark text-white border-secondary">
              <option value="TODOS">Todos</option>
              <option value="DEBE">Solo Debe</option>
              <option value="HABER">Solo Haber</option>
            </select>
          </div>
          <div class="col-12 col-md-9">
            <input v-model="filtroTexto" class="form-control bg-dark text-white border-secondary" placeholder="Buscar por referencia / detalle..." />
          </div>
        </div>
      </div>
    </div>

    <!-- Tabla -->
    <div class="card bg-panel border-0 shadow-sm" v-if="clienteIdSel">
      <div class="card-body">
        <div v-if="!estadoFiltrado.length" class="text-secondary">
          No hay movimientos para este cliente (o no matchean los filtros).
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 170px">Fecha</th>
                <th>Referencia</th>
                <th style="width: 140px" class="text-end">Debe</th>
                <th style="width: 140px" class="text-end">Haber</th>
                <th style="width: 160px" class="text-end">Saldo</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="(r, idx) in estadoFiltrado" :key="idx">
                <td class="text-secondary">{{ formatDateTime(r.fecha) }}</td>
                <td class="text-secondary">{{ r.referencia || "-" }}</td>
                <td class="text-end" :class="r.debe > 0 ? 'text-danger fw-bold' : 'text-secondary'">
                  {{ r.debe > 0 ? ("$ " + formatMoney(r.debe)) : "-" }}
                </td>
                <td class="text-end" :class="r.haber > 0 ? 'text-success fw-bold' : 'text-secondary'">
                  {{ r.haber > 0 ? ("$ " + formatMoney(r.haber)) : "-" }}
                </td>
                <td class="text-end fw-bold">$ {{ formatMoney(r.saldo ?? 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-2">
          Esto es “negocio real”: saldo acumulado, export CSV, filtros.
        </div>
      </div>
    </div>

    <div v-else class="text-secondary">
      Elegí un cliente para ver su cuenta corriente.
    </div>
  </div>
</template>

<style scoped>
.bg-panel{ background: rgba(18, 22, 32, .92); }
</style>