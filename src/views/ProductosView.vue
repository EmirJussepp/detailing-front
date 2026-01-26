<!-- src/views/ProductosView.vue -->
<script setup>
import { computed, ref, watch } from 'vue'
import { getSession } from '../auth/session'
import { listProductos, addProducto, updateProducto, removeProducto } from '../services/productosStorage'

const session = getSession()
const userId = session?.userId ?? 'anon'

function ensureUUID() {
  return (crypto?.randomUUID?.() ?? String(Date.now() + Math.random()))
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

function parseMoney(str) {
  const s = String(str ?? '').trim()
  if (!s) return NaN
  const normalized = s.replace(/\./g, '').replace(',', '.')
  return Number(normalized)
}

function clampInt(n, min, max) {
  const x = Math.floor(Number(String(n ?? '').replace(',', '.')))
  if (!Number.isFinite(x)) return min
  return Math.min(max, Math.max(min, x))
}

const productos = ref([])

function refresh() {
  productos.value = listProductos(userId)
}

watch(() => userId, refresh, { immediate: true })

const errorMsg = ref('')
const okMsg = ref('')

// ===== Crear =====
const nombre = ref('')
const categoria = ref('DETAILING')
const precioCosto = ref('')
const precioVenta = ref('')
const stockActual = ref('')

// ===== UI: búsqueda / filtro =====
const q = ref('')
const showInactivos = ref(false)

// ===== Edit inline =====
const editId = ref(null)
const editForm = ref({
  nombre: '',
  categoria: '',
  precioCosto: '',
  precioVenta: '',
  stockActual: ''
})

function resetMsgs() {
  errorMsg.value = ''
  okMsg.value = ''
}

function crearProducto() {
  resetMsgs()

  const n = nombre.value.trim()
  const cat = (categoria.value ?? '').trim() || 'DETAILING'
  const pc = parseMoney(precioCosto.value)
  const pv = parseMoney(precioVenta.value)
  const st = clampInt(stockActual.value, 0, 999999)

  if (!n) return (errorMsg.value = 'Ingresá el nombre del producto.')
  if (!Number.isFinite(pc) || pc < 0) return (errorMsg.value = 'Ingresá un precio costo válido (0 o más).')
  if (!Number.isFinite(pv) || pv <= 0) return (errorMsg.value = 'Ingresá un precio de venta válido (mayor a 0).')
  if (pc > pv) return (errorMsg.value = 'El costo no puede ser mayor que el precio de venta.')
  if (!Number.isFinite(st) || st < 0) return (errorMsg.value = 'Ingresá un stock válido (0 o más).')

  const nuevo = {
    id: ensureUUID(),
    nombre: n,
    categoria: cat,
    precioCosto: pc,
    precioVenta: pv,
    stockActual: st,
    activo: true,
    createdAt: new Date().toISOString()
  }

  addProducto(userId, nuevo)

  nombre.value = ''
  categoria.value = 'DETAILING'
  precioCosto.value = ''
  precioVenta.value = ''
  stockActual.value = ''

  okMsg.value = 'Producto creado ✅'
  refresh()
}

function toggleActivo(p) {
  resetMsgs()
  updateProducto(userId, p.id, { activo: !p.activo })
  okMsg.value = p.activo ? 'Producto desactivado.' : 'Producto activado.'
  refresh()
}

function ajustarStock(p, delta) {
  resetMsgs()

  const cur = Number(p.stockActual ?? 0)
  const next = cur + delta

  if (!Number.isFinite(next)) return (errorMsg.value = 'Stock inválido.')
  if (next < 0) return (errorMsg.value = 'No podés dejar stock negativo.')

  updateProducto(userId, p.id, { stockActual: next })
  okMsg.value = `Stock actualizado: ${p.nombre}`
  refresh()
}

function borrar(p) {
  resetMsgs()
  if (!confirm(`Eliminar "${p.nombre}"?`)) return
  removeProducto(userId, p.id)
  okMsg.value = 'Producto eliminado.'
  refresh()
}

// ====== Edit inline ======
function startEdit(p) {
  resetMsgs()
  editId.value = p.id
  editForm.value = {
    nombre: p.nombre ?? '',
    categoria: p.categoria ?? 'DETAILING',
    precioCosto: String(p.precioCosto ?? ''),
    precioVenta: String(p.precioVenta ?? ''),
    stockActual: String(p.stockActual ?? 0)
  }
}

function cancelEdit() {
  editId.value = null
}

function saveEdit(p) {
  resetMsgs()

  const n = editForm.value.nombre.trim()
  const cat = (editForm.value.categoria ?? '').trim() || 'DETAILING'
  const pc = parseMoney(editForm.value.precioCosto)
  const pv = parseMoney(editForm.value.precioVenta)
  const st = clampInt(editForm.value.stockActual, 0, 999999)

  if (!n) return (errorMsg.value = 'Nombre inválido.')
  if (!Number.isFinite(pc) || pc < 0) return (errorMsg.value = 'Costo inválido.')
  if (!Number.isFinite(pv) || pv <= 0) return (errorMsg.value = 'Venta inválida.')
  if (pc > pv) return (errorMsg.value = 'Costo no puede ser mayor que venta.')
  if (!Number.isFinite(st) || st < 0) return (errorMsg.value = 'Stock inválido.')

  updateProducto(userId, p.id, {
    nombre: n,
    categoria: cat,
    precioCosto: pc,
    precioVenta: pv,
    stockActual: st
  })

  okMsg.value = 'Producto actualizado ✅'
  editId.value = null
  refresh()
}

// ====== Derived ======
const activos = computed(() => productos.value.filter(p => p.activo))
const inactivos = computed(() => productos.value.filter(p => !p.activo))

const filteredActivos = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return activos.value
  return activos.value.filter(p =>
    String(p.nombre ?? '').toLowerCase().includes(s) ||
    String(p.categoria ?? '').toLowerCase().includes(s)
  )
})

const filteredInactivos = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return inactivos.value
  return inactivos.value.filter(p =>
    String(p.nombre ?? '').toLowerCase().includes(s) ||
    String(p.categoria ?? '').toLowerCase().includes(s)
  )
})
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
      <div>
        <h1 class="h4 mb-1">Productos</h1>
        <div class="text-secondary">Catálogo + stock + costo (localStorage)</div>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <!-- Crear -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <h2 class="h6 mb-3">Nuevo producto</h2>

        <div class="row g-3">
          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Nombre</label>
            <input v-model="nombre" class="form-control bg-dark text-white border-secondary" placeholder="Ej: Cera 500ml / Shampoo 1L" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Categoría</label>
            <input v-model="categoria" class="form-control bg-dark text-white border-secondary" placeholder="DETAILING" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Costo</label>
            <input v-model="precioCosto" class="form-control bg-dark text-white border-secondary" placeholder="Ej: 9000" inputmode="numeric" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Venta</label>
            <input v-model="precioVenta" class="form-control bg-dark text-white border-secondary" placeholder="Ej: 18000" inputmode="numeric" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Stock</label>
            <input v-model="stockActual" class="form-control bg-dark text-white border-secondary" placeholder="Ej: 10" inputmode="numeric" />
          </div>

          <div class="col-12 d-flex justify-content-end">
            <button class="btn btn-primary btn-accent" @click="crearProducto">
              Crear producto
            </button>
          </div>
        </div>

        <div class="text-secondary small mt-2">
          El costo se usa para bloquear descuentos que te hagan vender a pérdida.
        </div>
      </div>
    </div>

    <!-- Buscador -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Buscar</label>
            <input v-model="q" class="form-control bg-dark text-white border-secondary" placeholder="Nombre o categoría..." />
          </div>

          <div class="col-12 col-md-6 d-flex justify-content-md-end align-items-end gap-2">
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="showInactivos" v-model="showInactivos" />
              <label class="form-check-label text-secondary" for="showInactivos">
                Mostrar inactivos
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Activos -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 class="h6 mb-0">Activos</h2>
          <div class="text-secondary small">{{ filteredActivos.length }} productos</div>
        </div>

        <div v-if="filteredActivos.length === 0" class="text-secondary">
          No hay productos activos.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Costo</th>
                <th>Venta</th>
                <th>Stock</th>
                <th style="width: 320px;" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in filteredActivos" :key="p.id">
                <!-- Nombre -->
                <td class="fw-semibold">
                  <div v-if="editId !== p.id">{{ p.nombre }}</div>
                  <input
                    v-else
                    v-model="editForm.nombre"
                    class="form-control form-control-sm bg-dark text-white border-secondary"
                  />
                </td>

                <!-- Categoria -->
                <td class="text-secondary">
                  <div v-if="editId !== p.id">{{ p.categoria }}</div>
                  <input
                    v-else
                    v-model="editForm.categoria"
                    class="form-control form-control-sm bg-dark text-white border-secondary"
                  />
                </td>

                <!-- Costo -->
                <td class="text-secondary">
                  <div v-if="editId !== p.id">$ {{ formatMoney(p.precioCosto) }}</div>
                  <input
                    v-else
                    v-model="editForm.precioCosto"
                    inputmode="numeric"
                    class="form-control form-control-sm bg-dark text-white border-secondary"
                  />
                </td>

                <!-- Venta -->
                <td class="fw-bold">
                  <div v-if="editId !== p.id">$ {{ formatMoney(p.precioVenta) }}</div>
                  <input
                    v-else
                    v-model="editForm.precioVenta"
                    inputmode="numeric"
                    class="form-control form-control-sm bg-dark text-white border-secondary"
                  />
                </td>

                <!-- Stock -->
                <td>
                  <div v-if="editId !== p.id">
                    <span :class="Number(p.stockActual) <= 0 ? 'text-danger fw-bold' : 'text-secondary'">
                      {{ p.stockActual }}
                    </span>
                  </div>
                  <input
                    v-else
                    v-model="editForm.stockActual"
                    inputmode="numeric"
                    class="form-control form-control-sm bg-dark text-white border-secondary"
                  />
                </td>

                <!-- Acciones -->
                <td class="text-end">
                  <div class="btn-group" v-if="editId !== p.id">
                    <button class="btn btn-sm btn-outline-light" @click="ajustarStock(p, -1)">-1</button>
                    <button class="btn btn-sm btn-outline-light" @click="ajustarStock(p, +1)">+1</button>
                    <button class="btn btn-sm btn-outline-light" @click="startEdit(p)">Editar</button>
                    <button class="btn btn-sm btn-outline-light" @click="toggleActivo(p)">Desactivar</button>
                    <button class="btn btn-sm btn-outline-danger" @click="borrar(p)">Borrar</button>
                  </div>

                  <div class="btn-group" v-else>
                    <button class="btn btn-sm btn-primary btn-accent" @click="saveEdit(p)">Guardar</button>
                    <button class="btn btn-sm btn-outline-light" @click="cancelEdit">Cancelar</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-3">
          Tip: editás en línea y guardás. El costo impacta el bloqueo de venta a pérdida en Ventas.
        </div>
      </div>
    </div>

    <!-- Inactivos -->
    <div class="card bg-panel border-0 shadow-sm" v-if="showInactivos">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 class="h6 mb-0">Inactivos</h2>
          <div class="text-secondary small">{{ filteredInactivos.length }} productos</div>
        </div>

        <div v-if="filteredInactivos.length === 0" class="text-secondary">
          No hay productos inactivos.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Costo</th>
                <th>Venta</th>
                <th>Stock</th>
                <th style="width: 180px;" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in filteredInactivos" :key="p.id">
                <td class="fw-semibold">{{ p.nombre }}</td>
                <td class="text-secondary">{{ p.categoria }}</td>
                <td class="text-secondary">$ {{ formatMoney(p.precioCosto) }}</td>
                <td class="fw-bold">$ {{ formatMoney(p.precioVenta) }}</td>
                <td class="text-secondary">{{ p.stockActual }}</td>
                <td class="text-end">
                  <div class="btn-group">
                    <button class="btn btn-sm btn-outline-light" @click="toggleActivo(p)">Activar</button>
                    <button class="btn btn-sm btn-outline-danger" @click="borrar(p)">Borrar</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-3">
          Los inactivos no aparecen en Ventas.
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
