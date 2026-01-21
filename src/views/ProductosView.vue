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

const productos = ref([])

function refresh() {
  productos.value = listProductos(userId)
}

watch(() => userId, refresh, { immediate: true })

const errorMsg = ref('')
const okMsg = ref('')

// Form
const nombre = ref('')
const categoria = ref('DETAILING')
const precioVenta = ref('')
const stockActual = ref('')

function crearProducto() {
  errorMsg.value = ''
  okMsg.value = ''

  const n = nombre.value.trim()
  const pv = parseMoney(precioVenta.value)
  const st = Number(String(stockActual.value).trim())

  if (!n) return (errorMsg.value = 'Ingresá el nombre del producto.')
  if (!Number.isFinite(pv) || pv <= 0) return (errorMsg.value = 'Ingresá un precio válido.')
  if (!Number.isFinite(st) || st < 0) return (errorMsg.value = 'Ingresá un stock válido (0 o más).')

  const nuevo = {
    id: ensureUUID(),
    nombre: n,
    categoria: categoria.value?.trim() || 'DETAILING',
    precioVenta: pv,
    stockActual: st,
    activo: true,
    createdAt: new Date().toISOString()
  }

  addProducto(userId, nuevo)
  nombre.value = ''
  precioVenta.value = ''
  stockActual.value = ''
  okMsg.value = 'Producto creado.'
  refresh()
}

function toggleActivo(p) {
  updateProducto(userId, p.id, { activo: !p.activo })
  refresh()
}

function ajustarStock(p, delta) {
  errorMsg.value = ''
  okMsg.value = ''

  const cur = Number(p.stockActual ?? 0)
  const next = cur + delta
  if (next < 0) {
    errorMsg.value = 'No podés dejar stock negativo.'
    return
  }

  updateProducto(userId, p.id, { stockActual: next })
  okMsg.value = `Stock actualizado: ${p.nombre}`
  refresh()
}

function borrar(p) {
  if (!confirm(`Eliminar "${p.nombre}"?`)) return
  removeProducto(userId, p.id)
  refresh()
}

const activos = computed(() => productos.value.filter(p => p.activo))
const inactivos = computed(() => productos.value.filter(p => !p.activo))
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
      <div>
        <h1 class="h4 mb-1">Productos</h1>
        <div class="text-secondary">Catálogo + stock (localStorage)</div>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <!-- Crear -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <h2 class="h6 mb-3">Nuevo producto</h2>

        <div class="row g-3">
          <div class="col-12 col-md-5">
            <label class="form-label text-secondary">Nombre</label>
            <input v-model="nombre" class="form-control bg-dark text-white border-secondary" placeholder="Ej: Cera 500ml / Shampoo 1L" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Categoría</label>
            <input v-model="categoria" class="form-control bg-dark text-white border-secondary" placeholder="DETAILING" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Precio venta</label>
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
      </div>
    </div>

    <!-- Listado activos -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 class="h6 mb-0">Activos</h2>
          <div class="text-secondary small">{{ activos.length }} productos</div>
        </div>

        <div v-if="activos.length === 0" class="text-secondary">
          No hay productos cargados.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th style="width: 240px;" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in activos" :key="p.id">
                <td class="fw-semibold">{{ p.nombre }}</td>
                <td class="text-secondary">{{ p.categoria }}</td>
                <td class="fw-bold">$ {{ formatMoney(p.precioVenta) }}</td>
                <td>
                  <span :class="Number(p.stockActual) <= 0 ? 'text-danger fw-bold' : 'text-secondary'">
                    {{ p.stockActual }}
                  </span>
                </td>
                <td class="text-end">
                  <div class="btn-group">
                    <button class="btn btn-sm btn-outline-light" @click="ajustarStock(p, -1)">-1</button>
                    <button class="btn btn-sm btn-outline-light" @click="ajustarStock(p, +1)">+1</button>
                    <button class="btn btn-sm btn-outline-light" @click="toggleActivo(p)">Desactivar</button>
                    <button class="btn btn-sm btn-outline-danger" @click="borrar(p)">Borrar</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-3">
          Próximo: Ventas selecciona producto + descuenta stock automáticamente.
        </div>
      </div>
    </div>

    <!-- Inactivos -->
    <div class="card bg-panel border-0 shadow-sm" v-if="inactivos.length">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 class="h6 mb-0">Inactivos</h2>
          <div class="text-secondary small">{{ inactivos.length }} productos</div>
        </div>

        <div class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th style="width: 160px;" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in inactivos" :key="p.id">
                <td class="fw-semibold">{{ p.nombre }}</td>
                <td class="text-secondary">{{ p.categoria }}</td>
                <td class="fw-bold">$ {{ formatMoney(p.precioVenta) }}</td>
                <td class="text-secondary">{{ p.stockActual }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-light" @click="toggleActivo(p)">Activar</button>
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
