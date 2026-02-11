<script setup>
import { computed, onMounted, ref } from "vue"
import { productosApi } from "../services/productosApi"
import { getSession } from "../auth/session"
import { mapProducto } from "../mappers/productos.js"

const session = getSession() ?? null
const userId = session?.userId ?? null

const items = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref("")
const ok = ref("")

// filtros
const q = ref("")
const onlyLowStock = ref(false)

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
}

function resetMsgs() {
  error.value = ""
  ok.value = ""
}

async function fetchAll() {
  loading.value = true
  resetMsgs()
  try {
    const { data } = await productosApi.list()
const arr = Array.isArray(data) ? data : []
console.log("RAW[0]:", arr[0])
console.log("MAP[0]:", mapProducto(arr[0]))
items.value = arr.map(mapProducto)

  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error cargando productos"
    items.value = []
  } finally {
    loading.value = false
  }
}

// =====================
// Form Crear
// =====================
const nombre = ref("")
const codigoProducto = ref("")
const categoria = ref("")
const stockMinimo = ref("")
const stockMaximo = ref("")
const stockInicial = ref("") // opcional
const precioCosto = ref("")
const precioVenta = ref("")
const precioMayorista = ref("")

function toNumOrNull(v) {
  const x = Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(x) ? x : null
}
function toIntOrNull(v) {
  const x = parseInt(String(v ?? "").replace(",", "."), 10)
  return Number.isFinite(x) ? x : null
}

function resetForm() {
  nombre.value = ""
  codigoProducto.value = ""
  categoria.value = ""
  stockMinimo.value = ""
  stockMaximo.value = ""
  stockInicial.value = ""
  precioCosto.value = ""
  precioVenta.value = ""
  precioMayorista.value = ""
}

async function create() {
  if (saving.value) return
  saving.value = true
  resetMsgs()

  try {
    const payload = {
      nombre: nombre.value.trim(),
      codigoProducto: codigoProducto.value.trim() || null,
      categoria: categoria.value.trim() || null,
      stockMinimo: toIntOrNull(stockMinimo.value),
      stockMaximo: toIntOrNull(stockMaximo.value),
      stockInicial: toIntOrNull(stockInicial.value),
      precioCosto: toNumOrNull(precioCosto.value),
      precioVenta: toNumOrNull(precioVenta.value),
      precioMayorista: toNumOrNull(precioMayorista.value),
      userId: Number(userId),
    }

    // validaciones “front” (el back valida igual)
    if (!payload.nombre) throw new Error("Ingresá el nombre.")
    if (payload.precioCosto == null || payload.precioCosto < 0) throw new Error("Precio costo inválido.")
    if (payload.precioVenta == null || payload.precioVenta <= 0) throw new Error("Precio venta inválido.")
    if (payload.precioMayorista != null && payload.precioMayorista <= 0) throw new Error("Precio mayorista inválido.")
    if (payload.stockMinimo != null && payload.stockMinimo < 0) throw new Error("Stock mínimo inválido.")
    if (payload.stockMaximo != null && payload.stockMaximo < 0) throw new Error("Stock máximo inválido.")
    if (payload.stockInicial != null && payload.stockInicial < 0) throw new Error("Stock inicial inválido.")
    if (payload.stockMaximo != null && payload.stockMinimo != null && payload.stockMinimo > payload.stockMaximo) {
      throw new Error("Stock mínimo no puede ser mayor que stock máximo.")
    }

    await productosApi.create(payload)

    ok.value = "Producto creado ✅"
    resetForm()
    await fetchAll()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error creando producto"
  } finally {
    saving.value = false
  }
}

// =====================
// Lista + helpers
// =====================
function isLowStock(p) {
  const min = p.stockMinimo ?? null
  if (min == null) return false
  return Number(p.stockActual ?? 0) <= Number(min)
}

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  return items.value
    .filter(p => {
      if (!term) return true
      return (
        p.nombre.toLowerCase().includes(term) ||
        String(p.codigoProducto ?? "").toLowerCase().includes(term) ||
        String(p.categoria ?? "").toLowerCase().includes(term)
      )
    })
    .filter(p => (onlyLowStock.value ? isLowStock(p) : true))
})

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
        <div class="d-flex align-items-center justify-content-between gap-2">
          <div class="text-secondary small">
            Total: <b>{{ filtered.length }}</b>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-outline-light" @click="fetchAll" :disabled="loading">
              Refrescar
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
              <label class="form-check-label text-secondary" for="low">
                Solo bajo stock
              </label>
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
            <input v-model="stockMinimo" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-6 col-md-1">
            <label class="form-label text-secondary">Max</label>
            <input v-model="stockMaximo" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-1">
            <label class="form-label text-secondary">Inicial</label>
            <input v-model="stockInicial" type="number" class="form-control bg-dark text-white border-secondary" />
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
            <button class="btn btn-outline-light w-100" @click="resetForm">
              Limpiar
            </button>
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
                    Min: {{ p.stockMinimo }} · Max: {{ p.stockMaximo ?? '-' }}
                  </div>
                </td>

                <td class="text-secondary">{{ p.codigoProducto || '-' }}</td>
                <td class="text-secondary">{{ p.categoria || '-' }}</td>

                <td class="fw-bold">
                  {{ p.stockActual }}
                  <span v-if="p.stockMinimo != null && p.stockActual <= p.stockMinimo"
                        class="badge text-bg-warning ms-2">
                    Bajo
                  </span>
                </td>

                <td class="text-secondary">$ {{ formatMoney(p.precioVenta) }}</td>
                <td class="text-secondary">
                  {{ p.precioMayorista != null ? '$ ' + formatMoney(p.precioMayorista) : '-' }}
                </td>
                <td class="text-secondary">$ {{ formatMoney(p.precioCosto) }}</td>
              </tr>

              <tr v-if="filtered.length === 0">
                <td colspan="8" class="text-secondary">
                  No hay productos para mostrar.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>
</template>




<style scoped>
.bg-panel{ background: rgba(18, 22, 32, .92); }
.btn-accent{ background: #6f5cff; border: none; }
.btn-accent:hover{ background: #5f4de6; }
</style>