<script setup>
import { computed, onMounted, ref, watch } from "vue"
import { productosApi } from "../services/productosApi"

// =========================
// Utils
// =========================
function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
}

function unwrapPage(data) {
  if (Array.isArray(data)) {
    return { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1 }
  }
  const content = data?.content ?? data?.items ?? data?.data ?? []
  return {
    content: Array.isArray(content) ? content : [],
    page: Number(data?.page ?? data?.number ?? 0),
    size: Number(data?.size ?? data?.pageSize ?? 10),
    totalElements: Number(
      data?.totalElements ?? data?.total ?? (Array.isArray(content) ? content.length : 0)
    ),
    totalPages: Number(data?.totalPages ?? data?.pages ?? 1),
  }
}

function mapProducto(row) {
  return {
    id: row?.productoId ?? row?.id ?? row?.producto_id ?? null,
    nombre: row?.nombre ?? "",
    codigoProducto: row?.codigoProducto ?? row?.codigo ?? row?.codigo_producto ?? null,
    categoria: row?.categoria ?? null,

    stockActual: Number(row?.stockActual ?? row?.stock_actual ?? 0),
    stockMinimo: row?.stockMinimo ?? row?.stock_minimo ?? null,
    stockMaximo: row?.stockMaximo ?? row?.stock_maximo ?? null,

    precioCosto: Number(row?.precioCosto ?? row?.precio_costo ?? 0),
    precioVenta: Number(row?.precioVenta ?? row?.precio_venta ?? 0),
    precioMayorista: row?.precioMayorista ?? row?.precio_mayorista ?? null,
  }
}

function toNumber(v) {
  const x = Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(x) ? x : NaN
}

// =========================
// State
// =========================
const loading = ref(false)
const saving = ref(false)
const error = ref("")
const ok = ref("")

// filtros
const q = ref("")
const onlyLowStock = ref(false)

// paginación
const page = ref(0)
const size = ref(10)
const totalElements = ref(0)
const totalPages = ref(1)

// data
const rows = ref([])

// =========================
// Form create
// =========================
const nombre = ref("")
const codigoProducto = ref("")
const categoria = ref("")
const stockMinimo = ref(0)
const stockMaximo = ref(0)
const stockInicial = ref(0)
const precioCosto = ref("")
const precioVenta = ref("")
const precioMayorista = ref("")

function resetForm() {
  nombre.value = ""
  codigoProducto.value = ""
  categoria.value = ""
  stockMinimo.value = 0
  stockMaximo.value = 0
  stockInicial.value = 0
  precioCosto.value = ""
  precioVenta.value = ""
  precioMayorista.value = ""
}

// =========================
// Fetch
// =========================
async function fetchAll() {
  loading.value = true
  error.value = ""
  ok.value = ""

  try {
    const { data } = await productosApi.list({
      page: page.value,
      size: size.value,
      search: q.value?.trim() || null,
    })

    const p = unwrapPage(data)

    rows.value = p.content.map(mapProducto)
    totalElements.value = p.totalElements
    totalPages.value = p.totalPages
    page.value = p.page
    size.value = p.size
  } catch (e) {
    rows.value = []
    totalElements.value = 0
    totalPages.value = 1
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error cargando productos."
  } finally {
    loading.value = false
  }
}

// filtered sobre la página actual
const filtered = computed(() => {
  const arr = rows.value
  if (!onlyLowStock.value) return arr
  return arr.filter((p) => p.stockMinimo != null && p.stockActual <= p.stockMinimo)
})

const canPrev = computed(() => page.value > 0)
const canNext = computed(() => page.value < totalPages.value - 1)

function prevPage() {
  if (!canPrev.value) return
  page.value--
}
function nextPage() {
  if (!canNext.value) return
  page.value++
}

// cuando cambian page/size → recarga
watch(page, () => fetchAll())
watch(size, () => {
  page.value = 0
  fetchAll()
})

// debounce de búsqueda
let t = null
watch(q, () => {
  clearTimeout(t)
  t = setTimeout(() => {
    page.value = 0
    fetchAll()
  }, 250)
})

// =========================
// Create
// =========================
async function create() {
  error.value = ""
  ok.value = ""

  if (!nombre.value.trim()) return (error.value = "Nombre es obligatorio.")

  const pc = toNumber(precioCosto.value)
  const pv = toNumber(precioVenta.value)
  const pm = precioMayorista.value?.trim() ? toNumber(precioMayorista.value) : null

  if (!Number.isFinite(pc) || pc <= 0) return (error.value = "Precio costo inválido.")
  if (!Number.isFinite(pv) || pv <= 0) return (error.value = "Precio venta inválido.")
  if (pm !== null && (!Number.isFinite(pm) || pm <= 0)) return (error.value = "Precio mayorista inválido.")

  saving.value = true
  try {
    await productosApi.create({
      nombre: nombre.value.trim(),
      codigoProducto: codigoProducto.value?.trim() || null,
      categoria: categoria.value?.trim() || null,
      stockMinimo: Number(stockMinimo.value ?? 0),
      stockMaximo: Number(stockMaximo.value ?? 0),
      stockInicial: Number(stockInicial.value ?? 0),
      precioCosto: pc,
      precioVenta: pv,
      precioMayorista: pm,
    })

    ok.value = "Producto creado ✅"
    resetForm()
    page.value = 0
    await fetchAll()
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error creando producto."
  } finally {
    saving.value = false
  }
}

onMounted(fetchAll)
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-3">
      <h1 class="h4 mb-1">Productos</h1>
      <div class="text-secondary">Listar + Crear (Backend)</div>
    </div>

    <!-- Alerts -->
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="ok" class="alert alert-success py-2">{{ ok }}</div>

    <!-- Toolbar -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <div class="text-secondary small">
            Total: <b>{{ totalElements }}</b> · Mostrando: <b>{{ filtered.length }}</b>
          </div>

          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-light" @click="fetchAll" :disabled="loading">
              {{ loading ? "Cargando..." : "Refrescar" }}
            </button>

            <button class="btn btn-primary btn-accent" @click="create" :disabled="saving">
              {{ saving ? "Guardando..." : "+ Crear producto" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Buscar</label>
            <input
              v-model="q"
              class="form-control bg-dark text-white border-secondary"
              placeholder="nombre / código / categoría"
            />
          </div>

          <div class="col-12 col-md-3">
            <div class="form-check mt-4">
              <input class="form-check-input" type="checkbox" v-model="onlyLowStock" id="low" />
              <label class="form-check-label text-secondary" for="low">Solo bajo stock</label>
            </div>
          </div>

          <div class="col-12 col-md-3 text-secondary small">
            Tip: marcamos en amarillo los que están <b>bajo stock mínimo</b>.
          </div>
        </div>
      </div>
    </div>

    <!-- Nuevo producto -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <h2 class="h6 mb-3">Nuevo producto</h2>

        <div class="row g-3">
          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Nombre *</label>
            <input v-model="nombre" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Código</label>
            <input v-model="codigoProducto" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Categoría</label>
            <input v-model="categoria" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-6 col-md-1">
            <label class="form-label text-secondary">Min</label>
            <input v-model.number="stockMinimo" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-6 col-md-1">
            <label class="form-label text-secondary">Max</label>
            <input v-model.number="stockMaximo" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-1">
            <label class="form-label text-secondary">Inicial</label>
            <input v-model.number="stockInicial" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Precio costo *</label>
            <input v-model="precioCosto" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Precio venta *</label>
            <input v-model="precioVenta" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Precio mayorista</label>
            <input v-model="precioMayorista" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-3 d-flex align-items-end">
            <button class="btn btn-outline-light w-100" @click="resetForm">Limpiar</button>
          </div>
        </div>

        <div class="text-secondary small mt-2">
          El backend guarda <b>stock_actual</b> y registra movimiento inicial si corresponde.
        </div>
      </div>
    </div>

    <!-- Lista -->
    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>Producto</th>
                <th>Código</th>
                <th>Categoría</th>
                <th>Stock</th>
                <th>Venta</th>
                <th>Mayorista</th>
                <th>Costo</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="p in filtered"
                :key="p.id"
                :class="p.stockMinimo != null && p.stockActual <= p.stockMinimo ? 'table-warning' : ''"
              >
                <td class="text-secondary">{{ p.id }}</td>

                <td class="fw-semibold">
                  {{ p.nombre }}
                  <div class="text-secondary small" v-if="p.stockMinimo != null">
                    Min: {{ p.stockMinimo }} · Max: {{ p.stockMaximo ?? "-" }}
                  </div>
                </td>

                <td class="text-secondary">{{ p.codigoProducto || "-" }}</td>
                <td class="text-secondary">{{ p.categoria || "-" }}</td>

                <td class="fw-bold">
                  {{ p.stockActual }}
                  <span
                    v-if="p.stockMinimo != null && p.stockActual <= p.stockMinimo"
                    class="badge text-bg-warning ms-2"
                  >
                    Bajo
                  </span>
                </td>

                <td class="text-secondary">$ {{ formatMoney(p.precioVenta) }}</td>
                <td class="text-secondary">
                  {{ p.precioMayorista != null ? "$ " + formatMoney(p.precioMayorista) : "-" }}
                </td>
                <td class="text-secondary">$ {{ formatMoney(p.precioCosto) }}</td>
              </tr>

              <tr v-if="filtered.length === 0">
                <td colspan="8" class="text-secondary">No hay productos para mostrar.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ✅ paginator fuera del table -->
        <div class="d-flex justify-content-end align-items-center gap-2 mt-3 text-secondary small">
          <button class="btn btn-sm btn-outline-light" @click="prevPage" :disabled="loading || !canPrev">◀</button>
          <span>Página {{ page + 1 }} / {{ totalPages }}</span>
          <button class="btn btn-sm btn-outline-light" @click="nextPage" :disabled="loading || !canNext">▶</button>

          <select
            v-model.number="size"
            class="form-select form-select-sm bg-dark text-white border-secondary"
            style="width: 90px"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-panel { background: rgba(18, 22, 32, .92); }
.btn-accent { background: #6f5cff; border: none; }
.btn-accent:hover { background: #5f4de6; }
</style>