<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
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
// Bonus PRO: buscador inteligente
// =========================
const searchMode = ref("DNI") // DNI | NOMBRE
const searchInput = ref("")
const searching = ref(false)
const searchError = ref("")
const showSuggest = ref(false)
const suggestions = ref([]) // [{ id, label, cliente }]
let debounceTimer = null

function clienteLabel(c) {
  const full = `${c.nombre} ${c.apellido || ""}`.trim()
  const dni = c.dni ? ` · DNI ${c.dni}` : ""
  return `${full} (ID #${c.id})${dni}`
}

function buildSuggestionsByName(txt) {
  const t = txt.trim().toLowerCase()
  if (!t) return []

  const arr = clientesActivos.value
    .map(c => ({
      id: c.id,
      cliente: c,
      label: clienteLabel(c),
      blob: `${c.nombre} ${c.apellido} ${c.dni ?? ""}`.toLowerCase(),
    }))
    .filter(x => x.blob.includes(t))
    .slice(0, 8)

  return arr.map(x => ({ id: x.id, label: x.label, cliente: x.cliente }))
}

function selectCliente(c) {
  if (!c?.id) return
  clienteIdSel.value = String(c.id) // dispara watcher y carga cuenta
  showSuggest.value = false
  suggestions.value = []
  searchError.value = ""
  // opcional: limpiar el input después de seleccionar
  // searchInput.value = ""
}

async function searchByDni(dni) {
  const clean = String(dni || "").replace(/\D/g, "").trim()
  if (!clean) return

  searching.value = true
  searchError.value = ""

  try {
    const { data } = await clientesApi.getByDni(clean)
    const c = mapCliente(data)
    if (!c?.id) throw new Error("Cliente inválido")
    selectCliente(c)
    okMsg.value = `Cliente encontrado: ${c.nombre} ${c.apellido || ""}`.trim()
    setTimeout(() => (okMsg.value = ""), 1800)
  } catch (e) {
    searchError.value =
      e?.response?.data?.error ||
      "No se encontró cliente con ese DNI."
  } finally {
    searching.value = false
  }
}

function onSearchInput() {
  const v = searchInput.value
  searchError.value = ""

  if (!v.trim()) {
    showSuggest.value = false
    suggestions.value = []
    return
  }

  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    // Modo nombre/apellido: sugerencias 100% local
    if (searchMode.value === "NOMBRE") {
      suggestions.value = buildSuggestionsByName(v)
      showSuggest.value = suggestions.value.length > 0
      return
    }

    // Modo DNI: sugerencias local si matchea, y si no, intentamos endpoint SOLO si tiene muchos dígitos
    const clean = String(v).replace(/\D/g, "")

    // Tip: para no spamear 404, probamos recién con 7+ dígitos
    if (clean.length >= 7) {
      // primero tratamos local (por si ya cargaste clientes con dni)
      const local = buildSuggestionsByName(clean)
      if (local.length) {
        suggestions.value = local
        showSuggest.value = true
        return
      }

      // si no hay local, intentamos endpoint silencioso (sin mostrar error si falla)
      try {
        searching.value = true
        const { data } = await clientesApi.getByDni(clean)
        const c = mapCliente(data)
        if (c?.id) {
          suggestions.value = [{ id: c.id, label: clienteLabel(c), cliente: c }]
          showSuggest.value = true
        } else {
          suggestions.value = []
          showSuggest.value = false
        }
      } catch (_) {
        suggestions.value = []
        showSuggest.value = false
      } finally {
        searching.value = false
      }
    } else {
      suggestions.value = []
      showSuggest.value = false
    }
  }, 250)
}

async function doSearch() {
  const v = searchInput.value.trim()
  if (!v) return

  if (searchMode.value === "NOMBRE") {
    const list = buildSuggestionsByName(v)
    if (list.length === 1) {
      selectCliente(list[0].cliente)
    } else {
      suggestions.value = list
      showSuggest.value = list.length > 0
      if (!list.length) searchError.value = "No hay coincidencias."
    }
    return
  }

  await searchByDni(v)
}

function onGlobalClick(e) {
  const el = e.target
  if (!el?.closest?.(".cc-search")) {
    showSuggest.value = false
  }
}

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

  const debe = Number(x.debe ?? 0) || 0
  const haber = Number(x.haber ?? 0) || 0
  const saldo = x.saldo == null ? null : Number(x.saldo)

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
    ...rows.map(obj => header.map(k => `"${String(obj[k] ?? "").replaceAll('"', '""')}"`).join(";")).join(";")
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

  window.addEventListener("click", onGlobalClick)
})

onBeforeUnmount(() => {
  window.removeEventListener("click", onGlobalClick)
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

    <!-- Buscador PRO -->
    <div class="cc-search card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Buscar</label>
            <select v-model="searchMode" class="form-select bg-dark text-white border-secondary" :disabled="loading">
              <option value="DNI">Por DNI</option>
              <option value="NOMBRE">Por nombre/apellido</option>
            </select>
          </div>

          <div class="col-12 col-md-5" style="position: relative;">
            <label class="form-label text-secondary">
              {{ searchMode === "DNI" ? "DNI" : "Nombre / Apellido" }}
            </label>

            <input
              v-model="searchInput"
              class="form-control bg-dark text-white border-secondary"
              :placeholder="searchMode === 'DNI' ? 'Ej: 40111222' : 'Ej: Juan Pérez'"
              :inputmode="searchMode === 'DNI' ? 'numeric' : 'text'"
              @input="onSearchInput"
              @focus="onSearchInput"
              @keyup.enter="doSearch"
              :disabled="loading"
            />

            <!-- Dropdown sugerencias -->
            <div
              v-if="showSuggest"
              class="border border-secondary bg-dark rounded mt-1"
              style="position:absolute; z-index: 50; width: 100%; max-height: 260px; overflow:auto;"
            >
              <button
                v-for="s in suggestions"
                :key="s.id"
                class="btn btn-dark w-100 text-start border-0"
                type="button"
                @click="selectCliente(s.cliente)"
              >
                <div class="small text-white">{{ s.label }}</div>
              </button>
            </div>

            <div v-if="searchError" class="text-danger small mt-2">{{ searchError }}</div>
          </div>

          <div class="col-12 col-md-2 d-flex gap-2">
            <button class="btn btn-outline-light w-100" @click="doSearch" :disabled="loading || searching">
              {{ searching ? "Buscando..." : "Buscar" }}
            </button>
          </div>

          <div class="col-12 col-md-2">
            <button class="btn btn-outline-light w-100" @click="clienteIdSel && fetchCuenta(Number(clienteIdSel))" :disabled="loading || !clienteIdSel">
              {{ loading ? "Cargando..." : "Refrescar" }}
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

    <!-- Selector (lo dejé porque es útil siempre) -->
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
            <button class="btn btn-outline-light" @click="exportCSV" :disabled="!estadoFiltrado.length">
              Exportar CSV
            </button>
          </div>
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
          Saldo acumulado desde backend + export CSV + filtros + buscador PRO.
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