<!-- src/views/VentasView.vue -->
<script setup>
import { computed, ref, watch } from 'vue'
import { getSession, isAdmin, getShift } from '../auth/session'
import { requireCajaAbierta, addToVentasTotal } from '../services/cajaStorage'
import { listVentasBucket, addVenta, removeVenta } from '../services/ventasStorage'
import { listProductos, hasStock, applyStockDelta } from '../services/productosStorage'

const session = getSession()
const admin = computed(() => isAdmin())
const userId = session?.userId ?? 'anon'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const fecha = ref(todayISO())
const turnoSel = ref(admin.value ? 'MAÑANA' : (getShift() ?? 'MAÑANA'))

const errorMsg = ref('')
const okMsg = ref('')

const paymentMethod = ref('EFECTIVO')
const notes = ref('')

function ensureUUID() {
  return (crypto?.randomUUID?.() ?? String(Date.now() + Math.random()))
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

const cajaCheck = ref({ ok: false, error: '' })
const ventas = ref([])

const productos = ref([]) // activos

function refresh() {
  okMsg.value = ''
  errorMsg.value = ''

  const check = requireCajaAbierta(userId, fecha.value, turnoSel.value)
  cajaCheck.value = check.ok ? { ok: true } : { ok: false, error: check.error }

  ventas.value = listVentasBucket(userId, fecha.value, turnoSel.value)
  productos.value = listProductos(userId).filter(p => p.activo)
}

watch([fecha, turnoSel, admin], refresh, { immediate: true })

const canSell = computed(() => cajaCheck.value?.ok === true)

// ======= ITEMS con productos =======
const selProductoId = ref('')
const itemQty = ref('1')

const items = ref([])
// item: { id, productId, name, price, qty, subtotal }

const selectedProducto = computed(() =>
  productos.value.find(p => p.id === selProductoId.value) ?? null
)

const totalCalc = computed(() =>
  items.value.reduce((acc, it) => acc + Number(it.subtotal ?? 0), 0)
)

function addItem() {
  errorMsg.value = ''
  okMsg.value = ''

  if (!canSell.value) {
    errorMsg.value = cajaCheck.value?.error || 'Caja no disponible para vender.'
    return
  }

  const p = selectedProducto.value
  if (!p) {
    errorMsg.value = 'Seleccioná un producto.'
    return
  }

  const qty = Number(String(itemQty.value).trim())
  if (!Number.isFinite(qty) || qty <= 0) {
    errorMsg.value = 'Ingresá una cantidad válida (mayor a 0).'
    return
  }

  // Validar stock (sumando si el producto ya está en items)
  const already = items.value
    .filter(i => i.productId === p.id)
    .reduce((acc, i) => acc + Number(i.qty ?? 0), 0)

  const check = hasStock(userId, p.id, already + qty)
  if (!check.ok) {
    errorMsg.value = check.error
    return
  }

  const price = Number(p.precioVenta ?? 0)
  const subtotal = price * qty

  items.value = [
    ...items.value,
    {
      id: ensureUUID(),
      productId: p.id,
      name: p.nombre,
      price,
      qty,
      subtotal
    }
  ]

  // reset mini-form
  selProductoId.value = ''
  itemQty.value = '1'
}

function removeItem(itemId) {
  items.value = items.value.filter(i => i.id !== itemId)
}

function clearForm() {
  items.value = []
  paymentMethod.value = 'EFECTIVO'
  notes.value = ''
  selProductoId.value = ''
  itemQty.value = '1'
}

function groupQtyByProduct(itemsArr) {
  const map = new Map()
  for (const it of itemsArr) {
    const pid = it.productId
    const q = Number(it.qty ?? 0)
    map.set(pid, (map.get(pid) ?? 0) + q)
  }
  return map // productId -> qty
}

function registrarVenta() {
  errorMsg.value = ''
  okMsg.value = ''

  const checkCaja = requireCajaAbierta(userId, fecha.value, turnoSel.value)
  if (!checkCaja.ok) {
    errorMsg.value = checkCaja.error
    return
  }

  if (items.value.length === 0) {
    errorMsg.value = 'Agregá al menos 1 producto a la venta.'
    return
  }

  // 1) validar stock global
  const grouped = groupQtyByProduct(items.value)
  for (const [pid, qty] of grouped.entries()) {
    const check = hasStock(userId, pid, qty)
    if (!check.ok) {
      errorMsg.value = check.error
      return
    }
  }

  const total = Number(totalCalc.value)
  if (!Number.isFinite(total) || total <= 0) {
    errorMsg.value = 'El total calculado es inválido.'
    return
  }

  // 2) descontar stock (primero)
  const appliedStock = [] // {productId, delta}
  for (const [pid, qty] of grouped.entries()) {
    const res = applyStockDelta(userId, pid, -qty)
    if (!res.ok) {
      // rollback stock parcial
      for (const a of appliedStock) applyStockDelta(userId, a.productId, -a.delta) // invierte
      errorMsg.value = res.error ?? 'No se pudo actualizar stock.'
      refresh()
      return
    }
    appliedStock.push({ productId: pid, delta: -qty })
  }

  // 3) persistir venta
  const venta = {
    id: ensureUUID(),
    date: fecha.value,
    shift: turnoSel.value,
    cashierUserId: userId,
    items: items.value.map(i => ({
      productId: i.productId,
      name: i.name,
      qty: i.qty,
      price: i.price,
      subtotal: i.subtotal
    })),
    subtotal: total,
    discount: 0,
    total,
    paymentMethod: paymentMethod.value,
    notes: notes.value?.trim() ?? '',
    createdAt: new Date().toISOString()
  }

  addVenta(userId, fecha.value, turnoSel.value, venta)

  // 4) impactar caja
  const applyCaja = addToVentasTotal(userId, fecha.value, turnoSel.value, total)
  if (!applyCaja.ok) {
    // rollback: borrar venta + devolver stock
    removeVenta(userId, fecha.value, turnoSel.value, venta.id)
    for (const [pid, qty] of grouped.entries()) applyStockDelta(userId, pid, +qty)

    errorMsg.value = applyCaja.error ?? 'No se pudo impactar la venta en caja.'
    refresh()
    return
  }

  okMsg.value = 'Venta registrada ✅ Stock y Caja actualizados.'
  clearForm()
  refresh()
}

function eliminarVenta(ventaId) {
  errorMsg.value = ''
  okMsg.value = ''

  const checkCaja = requireCajaAbierta(userId, fecha.value, turnoSel.value)
  if (!checkCaja.ok) {
    errorMsg.value = checkCaja.error
    return
  }

  const { removed } = removeVenta(userId, fecha.value, turnoSel.value, ventaId)
  if (!removed) {
    errorMsg.value = 'No se encontró la venta.'
    refresh()
    return
  }

  // 1) reponer stock según items
  const grouped = groupQtyByProduct(removed.items ?? [])
  const applied = []
  for (const [pid, qty] of grouped.entries()) {
    const res = applyStockDelta(userId, pid, +qty)
    if (!res.ok) {
      // rollback stock parcial
      for (const a of applied) applyStockDelta(userId, a.productId, -a.delta)
      // reinsertar venta para consistencia
      addVenta(userId, fecha.value, turnoSel.value, removed)
      errorMsg.value = res.error ?? 'No se pudo reponer stock.'
      refresh()
      return
    }
    applied.push({ productId: pid, delta: +qty })
  }

  // 2) restar caja
  const applyCaja = addToVentasTotal(userId, fecha.value, turnoSel.value, -Number(removed.total ?? 0))
  if (!applyCaja.ok) {
    // rollback: quitar stock repuesto + reinsertar venta
    for (const [pid, qty] of grouped.entries()) applyStockDelta(userId, pid, -qty)
    addVenta(userId, fecha.value, turnoSel.value, removed)

    errorMsg.value = applyCaja.error ?? 'No se pudo actualizar caja al eliminar.'
    refresh()
    return
  }

  okMsg.value = 'Venta eliminada ✅ Stock repuesto y Caja actualizada.'
  refresh()
}

const ventasTotalDelBucket = computed(() =>
  ventas.value.reduce((acc, v) => acc + Number(v.total ?? 0), 0)
)
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
      <div>
        <h1 class="h4 mb-1">Ventas</h1>
        <div class="text-secondary">
          <span v-if="admin">Vista ADMIN: podés elegir fecha y turno.</span>
          <span v-else>Vista CAJERO: solo tu turno ({{ turnoSel }}).</span>
        </div>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <!-- CONTROLES -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Fecha</label>
            <input v-model="fecha" type="date" class="form-control bg-dark text-white border-secondary" :disabled="!admin" />
          </div>

          <div class="col-12 col-md-3" v-if="admin">
            <label class="form-label text-secondary">Turno</label>
            <select v-model="turnoSel" class="form-select bg-dark text-white border-secondary">
              <option value="MAÑANA">MAÑANA</option>
              <option value="TARDE">TARDE</option>
            </select>
          </div>

          <div class="col-12 col-md-3" v-else>
            <label class="form-label text-secondary">Turno</label>
            <input class="form-control bg-dark text-white border-secondary" :value="turnoSel" disabled />
          </div>

          <div class="col-12 col-md-6">
            <div v-if="!canSell" class="alert alert-warning py-2 mb-0">
              {{ cajaCheck.error }}
            </div>
            <div v-else class="small text-secondary">
              Caja ABIERTA ✅ Podés registrar ventas.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- NUEVA VENTA (productos) -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <h2 class="h6 mb-3">Nueva venta — {{ turnoSel }}</h2>

        <div v-if="productos.length === 0" class="alert alert-info py-2">
          No hay productos activos. Andá a <b>Productos</b> y creá al menos 1.
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Producto</label>
            <select v-model="selProductoId" class="form-select bg-dark text-white border-secondary" :disabled="!canSell || productos.length === 0">
              <option value="" disabled>Seleccionar…</option>
              <option v-for="p in productos" :key="p.id" :value="p.id">
                {{ p.nombre }} — $ {{ formatMoney(p.precioVenta) }} (Stock: {{ p.stockActual }})
              </option>
            </select>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Cant.</label>
            <input v-model="itemQty" class="form-control bg-dark text-white border-secondary" placeholder="1" inputmode="numeric" :disabled="!canSell || !selProductoId" />
          </div>

          <div class="col-12 col-md-4 d-flex justify-content-md-end gap-2">
            <button class="btn btn-outline-light" @click="addItem" :disabled="!canSell || !selProductoId">
              Agregar producto
            </button>
            <button class="btn btn-outline-light" @click="clearForm" :disabled="!canSell">
              Limpiar
            </button>
          </div>
        </div>

        <!-- Items -->
        <div class="table-responsive mt-3" v-if="items.length > 0">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th style="width: 140px;">Precio</th>
                <th style="width: 90px;">Cant.</th>
                <th style="width: 160px;">Subtotal</th>
                <th style="width: 120px;" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in items" :key="it.id">
                <td class="fw-semibold">{{ it.name }}</td>
                <td class="text-secondary">$ {{ formatMoney(it.price) }}</td>
                <td class="text-secondary">{{ it.qty }}</td>
                <td class="fw-bold">$ {{ formatMoney(it.subtotal) }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-light" @click="removeItem(it.id)" :disabled="!canSell">
                    Quitar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary mt-3" v-else>
          Agregá productos para armar la venta.
        </div>

        <div class="row g-3 mt-3">
          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Método de pago</label>
            <select v-model="paymentMethod" class="form-select bg-dark text-white border-secondary" :disabled="!canSell">
              <option value="EFECTIVO">EFECTIVO</option>
              <option value="TRANSFERENCIA">TRANSFERENCIA</option>
              <option value="DEBITO">DÉBITO</option>
              <option value="CREDITO">CRÉDITO</option>
            </select>
          </div>

          <div class="col-12 col-md-8">
            <label class="form-label text-secondary">Notas (opcional)</label>
            <input v-model="notes" class="form-control bg-dark text-white border-secondary" placeholder="Ej: observaciones" :disabled="!canSell" />
          </div>
        </div>

        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
          <div class="fs-5 fw-bold">
            Total: $ {{ formatMoney(totalCalc) }}
          </div>

          <button class="btn btn-primary btn-accent" @click="registrarVenta" :disabled="!canSell || items.length === 0">
            Registrar venta
          </button>
        </div>

        <div class="text-secondary small mt-2">
          ✅ Descuenta stock y suma a <b>ventasTotal</b> del turno.
        </div>
      </div>
    </div>

    <!-- LISTADO -->
    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 class="h6 mb-0">Ventas del turno</h2>
          <div class="text-secondary small">
            Total listado: <b>$ {{ formatMoney(ventasTotalDelBucket) }}</b>
          </div>
        </div>

        <div v-if="ventas.length === 0" class="text-secondary">
          No hay ventas registradas en este turno.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 220px;">Fecha/Hora</th>
                <th>Total</th>
                <th>Pago</th>
                <th style="width: 320px;">Detalle</th>
                <th style="width: 140px;" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in ventas" :key="v.id">
                <td class="text-secondary">
                  {{ new Date(v.createdAt).toLocaleString('es-AR') }}
                </td>
                <td class="fw-bold">$ {{ formatMoney(v.total) }}</td>
                <td class="text-secondary">{{ v.paymentMethod }}</td>
                <td class="text-secondary">
                  <div v-if="v.items?.length">
                    <div v-for="(it, idx) in v.items.slice(0, 3)" :key="idx">
                      • {{ it.qty }} x {{ it.name }}
                    </div>
                    <div v-if="v.items.length > 3" class="text-secondary">
                      +{{ v.items.length - 3 }} más…
                    </div>
                  </div>
                  <div v-else>-</div>
                </td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-light" @click="eliminarVenta(v.id)" :disabled="!canSell">
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-3">
          Al eliminar: repone stock y resta caja automáticamente.
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
s