<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import Pager from "../components/Pager.vue"

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
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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
    size: Number(data?.size ?? data?.pageSize ?? 10),
    totalElements: Number(
      data?.totalElements ??
        data?.total ??
        (Array.isArray(content) ? content.length : 0)
    ),
    totalPages: Number(data?.totalPages ?? data?.pages ?? 1),
  }
}

function badgeOrigen(tipo) {
  const t = String(tipo || "").toUpperCase()
  if (t === "VENTA") return { text: "VENTA", cls: "badge badge-soft-primary" }
  if (t === "PAGO") return { text: "PAGO", cls: "badge badge-soft-success" }
  if (t === "NOTA_CREDITO" || t === "NC") return { text: "NC", cls: "badge badge-soft-warning" }
  return { text: t || "OTRO", cls: "badge badge-soft-secondary" }
}

function clampPage(p) {
  const n = Number(p)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

// =========================
// State
// =========================
const loading = ref(false)
const errorMsg = ref("")
const okMsg = ref("")

const clientes = ref([])
const clienteIdSel = ref("")

const deuda = ref(null)
const estado = ref([])

const page = ref(0)
const size = ref(10)
const totalElements = ref(0)
const totalPages = ref(1)

const filtroTexto = ref("")
const filtroTipo = ref("TODOS")
const filtroOrigen = ref("TODOS")

const expanded = ref(new Set())

const searchMode = ref("DNI")
const searchInput = ref("")
const searching = ref(false)
const searchError = ref("")
const showSuggest = ref(false)
const suggestions = ref([])

let debounceTimer = null
let requestSeq = 0
const bootstrapped = ref(false)

// =========================
// Expandible
// =========================
function toggleRow(key) {
  const s = new Set(expanded.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  expanded.value = s
}

// =========================
// Clientes
// =========================
function mapCliente(c) {
  return {
    id: Number(c?.clienteId ?? c?.id ?? 0),
    nombre: c?.nombre ?? "",
    apellido: c?.apellido ?? "",
    dni: c?.dni ?? null,
    activo: c?.activo ?? true,
  }
}

const clientesActivos = computed(() =>
  (clientes.value || []).filter((c) => c.activo !== false)
)

const clienteSel = computed(() => {
  const id = Number(clienteIdSel.value)
  return clientesActivos.value.find((c) => Number(c.id) === id) ?? null
})

const clienteTitulo = computed(() => {
  if (!clienteSel.value) return "Cuenta Corriente"
  const c = clienteSel.value
  const full = `${c.nombre} ${c.apellido || ""}`.trim()
  return `Cuenta Corriente · ${full} (ID #${c.id})`
})

// =========================
// Buscador
// =========================
function clienteLabel(c) {
  const full = `${c.nombre} ${c.apellido || ""}`.trim()
  const dni = c.dni ? ` · DNI ${c.dni}` : ""
  return `${full} (ID #${c.id})${dni}`
}

function buildSuggestions(txt) {
  const t = txt.trim().toLowerCase()
  if (!t) return []

  return clientesActivos.value
    .map((c) => ({
      id: c.id,
      cliente: c,
      label: clienteLabel(c),
      blob: `${c.nombre} ${c.apellido} ${c.dni ?? ""} ${c.id}`.toLowerCase(),
    }))
    .filter((x) => x.blob.includes(t))
    .slice(0, 8)
    .map((x) => ({ id: x.id, label: x.label, cliente: x.cliente }))
}

function selectCliente(c) {
  if (!c?.id) return
  clienteIdSel.value = String(c.id)
  showSuggest.value = false
  suggestions.value = []
  searchError.value = ""
  searchInput.value = clienteLabel(c)
}

async function searchByDni(dni) {
  const clean = String(dni || "").replace(/\D/g, "").trim()
  if (!clean) return

  const local = buildSuggestions(clean)
  if (local.length === 1) return selectCliente(local[0].cliente)

  if (local.length > 1) {
    suggestions.value = local
    showSuggest.value = true
    return
  }

  searching.value = true
  searchError.value = ""
  try {
    const { data } = await clientesApi.getByDni(clean)
    const c = mapCliente(data)
    if (!c?.id) throw new Error("Cliente inválido")

    selectCliente(c)
    okMsg.value = `Cliente encontrado: ${c.nombre} ${c.apellido || ""}`.trim()
    setTimeout(() => {
      if (okMsg.value.startsWith("Cliente encontrado:")) okMsg.value = ""
    }, 1800)
  } catch (e) {
    searchError.value =
      e?.response?.data?.error ||
      "No se encontró cliente con ese DNI (o el endpoint no existe)."
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
    if (searchMode.value === "NOMBRE") {
      suggestions.value = buildSuggestions(v)
      showSuggest.value = suggestions.value.length > 0
      return
    }

    const clean = String(v).replace(/\D/g, "")
    if (clean.length >= 7) {
      const local = buildSuggestions(clean)
      if (local.length) {
        suggestions.value = local
        showSuggest.value = true
        return
      }

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
      } catch {
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
    const list = buildSuggestions(v)
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
  if (!el?.closest?.(".cc-search")) showSuggest.value = false
}

// =========================
// Loaders
// =========================
async function fetchClientes() {
  const { data } = await clientesApi.list({ page: 0, size: 500 })
  const paged = unwrapPage(data)
  clientes.value = paged.content.map(mapCliente)
}

function setClienteFromQuery() {
  const q = route.query.clienteId
  if (!q) return
  clienteIdSel.value = String(q)
}

function pushQueryCliente() {
  if (!clienteIdSel.value) {
    const qq = { ...route.query }
    delete qq.clienteId
    router.replace({ query: qq })
    return
  }

  router.replace({
    query: {
      ...route.query,
      clienteId: String(clienteIdSel.value),
    },
  })
}

async function fetchCuenta(clienteId) {
  const currentReq = ++requestSeq

  loading.value = true
  errorMsg.value = ""
  okMsg.value = ""

  try {
    const [rDeuda, rEstado] = await Promise.all([
      cuentaCorrienteApi.deuda(clienteId),
      cuentaCorrienteApi.estadoCuenta(clienteId, {
        page: page.value,
        size: size.value,
      }),
    ])

    if (currentReq !== requestSeq) return

    deuda.value = rDeuda?.data ?? null

    const paged = unwrapPage(rEstado?.data)

    estado.value = paged.content
    page.value = clampPage(paged.page)
    size.value = Number(paged.size || 10)
    totalElements.value = Math.max(0, Number(paged.totalElements || 0))
    totalPages.value = Math.max(1, Number(paged.totalPages || 1))

    if (page.value > totalPages.value - 1) {
      page.value = Math.max(0, totalPages.value - 1)
    }

    expanded.value = new Set()
  } catch (e) {
    if (currentReq !== requestSeq) return

    deuda.value = null
    estado.value = []
    totalElements.value = 0
    totalPages.value = 1

    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.response?.data ||
      e?.message ||
      "Error cargando cuenta corriente."
  } finally {
    if (currentReq === requestSeq) {
      loading.value = false
    }
  }
}

// =========================
// Normalización UI
// =========================
function normalizeRow(x, idx) {
  const fecha = x.fecha ?? x.createdAt ?? x.created_at ?? null
  const debe = Number(x.debe ?? 0) || 0
  const haber = Number(x.haber ?? 0) || 0
  const saldo = x.saldo == null ? null : Number(x.saldo)

  const origen = String(x.tipo ?? "OTRO").toUpperCase()
  const ventaId = x.ventaId ?? null
  const pagoId = x.pagoId ?? null
  const comprobanteId = x.comprobanteId ?? null
  const items = Array.isArray(x.items) ? x.items : []

  let tipoMov = "OTRO"
  if (debe > 0) tipoMov = "DEBE"
  else if (haber > 0) tipoMov = "HABER"

  const idKey = ventaId ?? pagoId ?? comprobanteId ?? idx
  const key = `${origen}:${idKey}`

  const referencia =
    x.referencia ??
    x.ref ??
    x.descripcion ??
    x.detalle ??
    x.concepto ??
    (origen === "VENTA" && ventaId ? `Venta #${ventaId}` : null) ??
    (origen === "PAGO" && ventaId ? `Pago venta #${ventaId}` : null) ??
    (origen === "NOTA_CREDITO" && comprobanteId ? `NC #${comprobanteId}` : null) ??
    "-"

  return {
    fecha,
    referencia,
    debe,
    haber,
    saldo,
    tipoMov,
    origen,
    ventaId,
    pagoId,
    comprobanteId,
    items,
    key,
    raw: x,
  }
}

const estadoUI = computed(() =>
  (estado.value || []).map((x, idx) => normalizeRow(x, idx))
)

const estadoFiltrado = computed(() => {
  const txt = filtroTexto.value.trim().toLowerCase()

  return estadoUI.value.filter((r) => {
    if (filtroOrigen.value !== "TODOS" && r.origen !== filtroOrigen.value) return false
    if (filtroTipo.value !== "TODOS" && r.tipoMov !== filtroTipo.value) return false

    if (txt) {
      const blob = `${r.referencia ?? ""} ${r.origen ?? ""} ${r.ventaId ?? ""}`.toLowerCase()
      if (!blob.includes(txt)) return false
    }

    return true
  })
})

const totDebe = computed(() =>
  estadoUI.value.reduce((a, r) => a + Number(r.debe || 0), 0)
)

const totHaber = computed(() =>
  estadoUI.value.reduce((a, r) => a + Number(r.haber || 0), 0)
)

const saldoFinal = computed(() => {
  if (!estadoUI.value.length) return 0
  const last = estadoUI.value[estadoUI.value.length - 1]
  return Number(last.saldo ?? 0)
})

const pageInfoText = computed(() => {
  if (!totalElements.value) return "Sin registros"
  return `Página ${page.value + 1} de ${totalPages.value}`
})

// =========================
// Pager handlers
// =========================
function onPageChange(newPage) {
  const next = clampPage(newPage)
  const maxPage = Math.max(0, totalPages.value - 1)
  const safeNext = Math.min(next, maxPage)

  if (safeNext === page.value) return

  page.value = safeNext

  if (clienteIdSel.value) {
    fetchCuenta(Number(clienteIdSel.value))
  }
}

function onSizeChange(newSize) {
  const nextSize = Number(newSize)
  if (!Number.isFinite(nextSize) || nextSize <= 0) return

  const changed = nextSize !== size.value
  size.value = nextSize

  if (!clienteIdSel.value) return

  if (page.value !== 0) {
    page.value = 0
    fetchCuenta(Number(clienteIdSel.value))
    return
  }

  if (changed) {
    fetchCuenta(Number(clienteIdSel.value))
  }
}

// =========================
// Export
// =========================
function exportCSV() {
  const rows = estadoFiltrado.value.map((r) => ({
    fecha: r.fecha ?? "",
    origen: r.origen ?? "",
    referencia: r.referencia ?? "",
    debe: r.debe ?? 0,
    haber: r.haber ?? 0,
    saldo: r.saldo ?? "",
  }))

  const header = ["fecha", "origen", "referencia", "debe", "haber", "saldo"]
  const csvLines = [
    header.join(";"),
    ...rows.map((obj) =>
      header.map((k) => `"${String(obj[k] ?? "").replaceAll('"', '""')}"`).join(";")
    ),
  ]
  const csv = csvLines.join("\n")

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
  bootstrapped.value = true

  if (clienteIdSel.value) {
    await fetchCuenta(Number(clienteIdSel.value))
  }

  window.addEventListener("click", onGlobalClick)
})

onBeforeUnmount(() => {
  window.removeEventListener("click", onGlobalClick)
  clearTimeout(debounceTimer)
})

watch(clienteIdSel, async (v, oldV) => {
  if (!bootstrapped.value) return
  if (v === oldV) return

  pushQueryCliente()

  if (!v) {
    deuda.value = null
    estado.value = []
    totalElements.value = 0
    totalPages.value = 1
    page.value = 0
    expanded.value = new Set()
    return
  }

  page.value = 0
  await fetchCuenta(Number(v))
})
</script>

<template>
  <div class="container py-4 cc-view">
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div>
        <h1 class="h4 mb-1">{{ clienteTitulo }}</h1>
        <div class="text-secondary small">
          Historial + saldo acumulado + detalle expandible de ventas.
        </div>
      </div>

      <div v-if="clienteIdSel" class="text-secondary small">
        {{ pageInfoText }}
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <!-- Buscador -->
    <div class="cc-search card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Buscar</label>
            <select
              v-model="searchMode"
              class="form-select bg-dark text-white border-secondary"
              :disabled="loading"
            >
              <option value="DNI">Por DNI</option>
              <option value="NOMBRE">Por nombre/apellido</option>
            </select>
          </div>

          <div class="col-12 col-md-5 position-relative">
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

            <div
              v-if="showSuggest"
              class="suggest-box border border-secondary rounded mt-1"
            >
              <button
                v-for="s in suggestions"
                :key="s.id"
                class="btn btn-dark w-100 text-start border-0 suggestion-item"
                type="button"
                @click="selectCliente(s.cliente)"
              >
                <div class="small text-white">{{ s.label }}</div>
              </button>
            </div>

            <div v-if="searchError" class="text-danger small mt-2">{{ searchError }}</div>
          </div>

          <div class="col-12 col-md-2 d-flex gap-2">
            <button
              class="btn btn-outline-light w-100"
              @click="doSearch"
              :disabled="loading || searching"
            >
              {{ searching ? "Buscando..." : "Buscar" }}
            </button>
          </div>

          <div class="col-12 col-md-2">
            <button
              class="btn btn-outline-light w-100"
              @click="clienteIdSel && fetchCuenta(Number(clienteIdSel))"
              :disabled="loading || !clienteIdSel"
            >
              {{ loading ? "Cargando..." : "Refrescar" }}
            </button>
          </div>
        </div>

        <div class="text-secondary small mt-3" v-if="clienteIdSel">
          Totales página:
          Debe <b>$ {{ formatMoney(totDebe) }}</b> ·
          Haber <b>$ {{ formatMoney(totHaber) }}</b> ·
          Saldo final visible <b>$ {{ formatMoney(saldoFinal) }}</b>

          <span v-if="deuda?.deudaTotal != null" class="ms-2">
            · Deuda total: <b>$ {{ formatMoney(deuda.deudaTotal) }}</b>
          </span>
        </div>
      </div>
    </div>

    <!-- Selector -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-7">
            <label class="form-label text-secondary">Cliente</label>
            <select
              v-model="clienteIdSel"
              class="form-select bg-dark text-white border-secondary"
              :disabled="loading"
            >
              <option value="">Seleccionar…</option>
              <option v-for="c in clientesActivos" :key="c.id" :value="String(c.id)">
                #{{ c.id }} — {{ c.nombre }} {{ c.apellido || "" }} (DNI: {{ c.dni || "-" }})
              </option>
            </select>
          </div>

          <div class="col-12 col-md-5 d-flex justify-content-md-end gap-2">
            <button
              class="btn btn-outline-light"
              @click="exportCSV"
              :disabled="!estadoFiltrado.length"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card bg-panel border-0 shadow-sm mb-3" v-if="clienteIdSel">
      <div class="card-body">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-3">
            <select v-model="filtroOrigen" class="form-select bg-dark text-white border-secondary">
              <option value="TODOS">Todos los orígenes</option>
              <option value="VENTA">Ventas</option>
              <option value="PAGO">Pagos</option>
              <option value="NOTA_CREDITO">Notas de crédito</option>
            </select>
          </div>

          <div class="col-12 col-md-3">
            <select v-model="filtroTipo" class="form-select bg-dark text-white border-secondary">
              <option value="TODOS">Debe + Haber</option>
              <option value="DEBE">Solo Debe</option>
              <option value="HABER">Solo Haber</option>
            </select>
          </div>

          <div class="col-12 col-md-4">
            <input
              v-model="filtroTexto"
              class="form-control bg-dark text-white border-secondary"
              placeholder="Buscar por referencia / origen / id..."
            />
          </div>

          <div class="col-12 col-md-2 d-flex justify-content-md-end">
            <span class="text-secondary small">
              Mostrando: <b>{{ estadoFiltrado.length }}</b>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabla -->
    <div class="card bg-panel border-0 shadow-sm" v-if="clienteIdSel">
      <div class="card-body">
        <div v-if="loading" class="text-secondary">Cargando...</div>

        <div v-else-if="!estadoFiltrado.length" class="text-secondary">
          No hay movimientos para este cliente o no coinciden con los filtros.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr class="text-secondary">
                <th style="width: 170px">Fecha</th>
                <th style="width: 110px">Origen</th>
                <th>Referencia</th>
                <th style="width: 140px" class="text-end">Debe</th>
                <th style="width: 140px" class="text-end">Haber</th>
                <th style="width: 160px" class="text-end">Saldo</th>
                <th style="width: 70px" class="text-end">Ver</th>
              </tr>
            </thead>

            <tbody>
              <template v-for="r in estadoFiltrado" :key="r.key">
                <tr>
                  <td class="text-secondary">{{ formatDateTime(r.fecha) }}</td>

                  <td>
                    <span :class="badgeOrigen(r.origen).cls">
                      {{ badgeOrigen(r.origen).text }}
                    </span>
                  </td>

                  <td>
                    <div class="fw-semibold text-white">{{ r.referencia || "-" }}</div>
                    <div class="small text-secondary" v-if="r.ventaId">
                      Venta ID: #{{ r.ventaId }}
                    </div>
                  </td>

                  <td class="text-end" :class="r.debe > 0 ? 'text-danger fw-bold' : 'text-secondary'">
                    {{ r.debe > 0 ? "$ " + formatMoney(r.debe) : "-" }}
                  </td>

                  <td class="text-end" :class="r.haber > 0 ? 'text-success fw-bold' : 'text-secondary'">
                    {{ r.haber > 0 ? "$ " + formatMoney(r.haber) : "-" }}
                  </td>

                  <td class="text-end fw-bold">$ {{ formatMoney(r.saldo ?? 0) }}</td>

                  <td class="text-end">
                    <button
                      v-if="r.origen === 'VENTA'"
                      class="btn btn-sm btn-outline-light btn-expand"
                      type="button"
                      @click="toggleRow(r.key)"
                      :disabled="!r.items?.length"
                      :title="r.items?.length ? 'Ver detalle' : 'Sin items'"
                    >
                      {{ expanded.has(r.key) ? "−" : "+" }}
                    </button>
                  </td>
                </tr>

                <tr v-if="expanded.has(r.key)">
                  <td colspan="7" class="p-0">
                    <div class="cc-detail p-3 border-top border-secondary">
                      <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="text-white fw-semibold">Detalle de la venta</div>
                        <div class="text-secondary small">
                          Items: <b class="text-white">{{ r.items.length }}</b>
                        </div>
                      </div>

                      <div v-if="!r.items?.length" class="text-secondary small">
                        No hay items para mostrar.
                      </div>

                      <div v-else class="table-responsive">
                        <table class="table table-dark table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th style="width: 110px" class="text-end">Cantidad</th>
                              <th style="width: 160px" class="text-end">Precio</th>
                              <th style="width: 160px" class="text-end">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(it, i) in r.items" :key="i">
                              <td class="text-secondary">
                                <div class="text-white fw-semibold">
                                  {{ it.productoNombre || ("Producto #" + it.productoId) }}
                                </div>
                                <div class="small text-secondary">ID: #{{ it.productoId }}</div>
                              </td>

                              <td class="text-end text-white fw-semibold">
                                {{ it.cantidad ?? "-" }}
                              </td>

                              <td class="text-end text-secondary">
                                {{ it.precioUnitario != null ? "$ " + formatMoney(it.precioUnitario) : "-" }}
                              </td>

                              <td class="text-end text-white fw-semibold">
                                {{ it.subtotal != null ? "$ " + formatMoney(it.subtotal) : "-" }}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div class="text-secondary small mt-2">
                        Detalle expandible obtenido desde backend.
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div class="cc-footer d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
          <div class="text-secondary small">
            Total registros: <b>{{ totalElements }}</b>
          </div>

          <div class="text-secondary small">
            Página <b>{{ page + 1 }}</b> / <b>{{ totalPages }}</b>
          </div>
        </div>

        <div class="mt-3">
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

        <div class="text-secondary small mt-3">
          Cuenta corriente paginada con filtros visuales sobre la página actual.
        </div>
      </div>
    </div>

    <div v-else class="text-secondary">
      Elegí un cliente para ver su cuenta corriente.
    </div>
  </div>
</template>

<style scoped>
.cc-view {
  color: #e5e7eb;
}

.bg-panel {
  background: rgba(18, 22, 32, 0.92);
  backdrop-filter: blur(4px);
}

.cc-search .card-body,
.bg-panel .card-body {
  padding: 1rem;
}

.suggest-box {
  position: absolute;
  z-index: 50;
  width: 100%;
  max-height: 260px;
  overflow: auto;
  background: #111827;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.suggestion-item:hover {
  background: rgba(124, 58, 237, 0.16) !important;
}

.cc-detail {
  background: rgba(10, 12, 18, 0.82);
}

.badge-soft-primary {
  background: rgba(59, 130, 246, 0.18);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.35);
}

.badge-soft-success {
  background: rgba(34, 197, 94, 0.18);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.35);
}

.badge-soft-warning {
  background: rgba(245, 158, 11, 0.18);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.badge-soft-secondary {
  background: rgba(107, 114, 128, 0.18);
  color: #d1d5db;
  border: 1px solid rgba(107, 114, 128, 0.35);
}

.table td,
.table th {
  vertical-align: middle;
}

.table-dark.table-hover tbody tr:hover td {
  background: rgba(255, 255, 255, 0.03);
}

.btn-expand {
  min-width: 34px;
}

.cc-footer {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 0.75rem;
}
</style>