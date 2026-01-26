<!-- src/views/VentasView.vue -->
<script setup>
import { computed, ref, watch } from 'vue'
import { getSession, isAdmin, getShift } from '../auth/session'
import { requireCajaAbierta, addToVentasTotal } from '../services/cajaStorage'
import { listVentasBucket, addVenta, removeVenta } from '../services/ventasStorage'
import { listProductos, hasStock, applyStockDelta } from '../services/productosStorage'
import { listClientes } from '../services/clientesStorage'

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

function clamp(n, min, max) {
  const x = Number(n)
  if (!Number.isFinite(x)) return min
  return Math.min(max, Math.max(min, x))
}

const cajaCheck = ref({ ok: false, error: '' })
const ventas = ref([])

const productos = ref([]) // activos
const clientes = ref([])  // activos

const clienteSelId = ref('')
const clienteSel = computed(() => clientes.value.find(c => c.id === clienteSelId.value) ?? null)

function refresh() {
  okMsg.value = ''
  errorMsg.value = ''

  const check = requireCajaAbierta(userId, fecha.value, turnoSel.value)
  cajaCheck.value = check.ok ? { ok: true } : { ok: false, error: check.error }

  ventas.value = listVentasBucket(userId, fecha.value, turnoSel.value)
  productos.value = listProductos(userId).filter(p => p.activo)
  clientes.value = listClientes(userId).filter(c => c.activo)
}

watch([fecha, turnoSel, admin], refresh, { immediate: true })

const canSell = computed(() => cajaCheck.value?.ok === true)

// ======= Items (productos) con descuento por línea =======
const selProductoId = ref('')
const itemQty = ref('1')
const itemDiscountPct = ref('0') // % por línea

const selectedProducto = computed(() =>
  productos.value.find(p => p.id === selProductoId.value) ?? null
)

// item: {id, productId, name, price, cost, qty, discountPct, discountUnit, netUnit, subtotal, invalidReason}
const items = ref([])

function recalcItem(it) {
  const price = Number(it.price ?? 0)
  const cost = Number(it.cost ?? 0)

  const qtyRaw = Number(it.qty ?? 0)
  const qty = Number.isFinite(qtyRaw) ? qtyRaw : 0

  const discountPct = clamp(String(it.discountPct ?? 0).replace(',', '.'), 0, 100)

  const discountUnit = Math.round((price * discountPct) / 100)
  const netUnit = Math.max(0, price - discountUnit)
  const subtotal = netUnit * qty

  const invalidReason = netUnit < cost
    ? `Vende a pérdida: $${formatMoney(netUnit)} < costo $${formatMoney(cost)}`
    : ''

  return {
    ...it,
    qty,
    discountPct,
    discountUnit,
    netUnit,
    subtotal,
    invalidReason
  }
}

function addItem() {
  errorMsg.value = ''
  okMsg.value = ''

  if (!canSell.value) {
    errorMsg.value = cajaCheck.value?.error || 'Caja no disponible para vender.'
    return
  }

  const p = selectedProducto.value
  if (!p) return (errorMsg.value = 'Seleccioná un producto.')

  const qty = Math.floor(Number(String(itemQty.value).trim().replace(',', '.')))
  if (!Number.isFinite(qty) || qty <= 0) return (errorMsg.value = 'Cantidad inválida.')

  const discountPct = clamp(String(itemDiscountPct.value).replace(',', '.'), 0, 100)

  // Stock considerando lo ya cargado
  const already = items.value
    .filter(i => i.productId === p.id)
    .reduce((acc, i) => acc + Number(i.qty ?? 0), 0)

  const check = hasStock(userId, p.id, already + qty)
  if (!check.ok) return (errorMsg.value = check.error)

  const base = {
    id: ensureUUID(),
    productId: p.id,
    name: p.nombre,
    price: Number(p.precioVenta ?? 0),
    cost: Number(p.precioCosto ?? 0),
    qty,
    discountPct
  }

  items.value = [...items.value, recalcItem(base)]

  selProductoId.value = ''
  itemQty.value = '1'
  itemDiscountPct.value = '0'
}

function removeItem(itemId) {
  items.value = items.value.filter(i => i.id !== itemId)
}

function updateItemDiscount(itemId, pct) {
  const parsed = String(pct ?? '').replace(',', '.')
  items.value = items.value.map(it =>
    it.id === itemId ? recalcItem({ ...it, discountPct: parsed }) : it
  )
}

function groupQtyByProduct(itemsArr) {
  const map = new Map()
  for (const it of itemsArr) {
    const pid = it.productId
    const q = Number(it.qty ?? 0)
    map.set(pid, (map.get(pid) ?? 0) + q)
  }
  return map
}

function updateItemQty(itemId, qty) {
  errorMsg.value = ''

  const parsed = Number(String(qty ?? '').replace(',', '.'))
  const safe = Number.isFinite(parsed) ? parsed : 1
  const finalQty = safe <= 0 ? 1 : Math.floor(safe)

  const target = items.value.find(i => i.id === itemId)
  if (!target) return

  // Simular cómo quedaría el stock agrupado si aplico el cambio
  const simulated = items.value.map(i => (i.id === itemId ? { ...i, qty: finalQty } : i))
  const grouped = groupQtyByProduct(simulated)
  const want = grouped.get(target.productId) ?? 0

  const check = hasStock(userId, target.productId, want)
  if (!check.ok) {
    errorMsg.value = check.error
    return
  }

  items.value = items.value.map(it =>
    it.id === itemId ? recalcItem({ ...it, qty: finalQty }) : it
  )
}

function clearForm() {
  items.value = []
  paymentMethod.value = 'EFECTIVO'
  notes.value = ''
  clienteSelId.value = ''
  selProductoId.value = ''
  itemQty.value = '1'
  itemDiscountPct.value = '0'
}

const subtotalBase = computed(() =>
  items.value.reduce((acc, it) => acc + Number(it.price ?? 0) * Number(it.qty ?? 0), 0)
)

const descuentoTotal = computed(() =>
  items.value.reduce((acc, it) => acc + Number(it.discountUnit ?? 0) * Number(it.qty ?? 0), 0)
)

const totalCalc = computed(() =>
  items.value.reduce((acc, it) => acc + Number(it.subtotal ?? 0), 0)
)

const hasInvalidItems = computed(() => items.value.some(it => it.invalidReason))
const canRegister = computed(() => canSell.value && items.value.length > 0 && !hasInvalidItems.value)

function registrarVenta() {
  errorMsg.value = ''
  okMsg.value = ''

  const checkCaja = requireCajaAbierta(userId, fecha.value, turnoSel.value)
  if (!checkCaja.ok) return (errorMsg.value = checkCaja.error)

  if (items.value.length === 0) return (errorMsg.value = 'Agregá al menos 1 producto.')
  if (hasInvalidItems.value) return (errorMsg.value = 'Hay productos con venta a pérdida. Ajustá el descuento.')

  // Validación stock global
  const grouped = groupQtyByProduct(items.value)
  for (const [pid, qty] of grouped.entries()) {
    const check = hasStock(userId, pid, qty)
    if (!check.ok) return (errorMsg.value = check.error)
  }

  const total = Number(totalCalc.value)
  if (!Number.isFinite(total) || total <= 0) return (errorMsg.value = 'Total inválido.')

  // 1) descontar stock
  const appliedStock = []
  for (const [pid, qty] of grouped.entries()) {
    const res = applyStockDelta(userId, pid, -qty)
    if (!res.ok) {
      for (const a of appliedStock) applyStockDelta(userId, a.productId, -a.delta)
      errorMsg.value = res.error ?? 'No se pudo actualizar stock.'
      refresh()
      return
    }
    appliedStock.push({ productId: pid, delta: -qty })
  }

  // 2) persistir venta con cliente + descuentos por item (incluye cost para reportes)
  const venta = {
    id: ensureUUID(),
    date: fecha.value,
    shift: turnoSel.value,
    cashierUserId: userId,

    clientId: clienteSel.value?.id ?? null,
    clientNombre: clienteSel.value?.nombre ?? null,

    items: items.value.map(i => ({
      productId: i.productId,
      name: i.name,
      qty: i.qty,
      price: i.price,
      cost: i.cost,
      discountPct: i.discountPct,
      discountUnit: i.discountUnit,
      netUnit: i.netUnit,
      subtotal: i.subtotal
    })),

    subtotalBase: Number(subtotalBase.value),
    discountTotal: Number(descuentoTotal.value),

    total,
    paymentMethod: paymentMethod.value,
    notes: notes.value?.trim() ?? '',
    createdAt: new Date().toISOString()
  }

  addVenta(userId, fecha.value, turnoSel.value, venta)

  // 3) impactar caja
  const applyCaja = addToVentasTotal(userId, fecha.value, turnoSel.value, total)
  if (!applyCaja.ok) {
    removeVenta(userId, fecha.value, turnoSel.value, venta.id)
    for (const [pid, qty] of grouped.entries()) applyStockDelta(userId, pid, +qty)
    errorMsg.value = applyCaja.error ?? 'No se pudo impactar la venta en caja.'
    refresh()
    return
  }

  okMsg.value = 'Venta registrada ✅ (cliente + descuentos por producto) — Stock y Caja actualizados.'
  clearForm()
  refresh()
}

function eliminarVenta(ventaId) {
  errorMsg.value = ''
  okMsg.value = ''

  const checkCaja = requireCajaAbierta(userId, fecha.value, turnoSel.value)
  if (!checkCaja.ok) return (errorMsg.value = checkCaja.error)

  const { removed } = removeVenta(userId, fecha.value, turnoSel.value, ventaId)
  if (!removed) {
    errorMsg.value = 'No se encontró la venta.'
    refresh()
    return
  }

  // reponer stock
  const grouped = groupQtyByProduct(removed.items ?? [])
  const applied = []
  for (const [pid, qty] of grouped.entries()) {
    const res = applyStockDelta(userId, pid, +qty)
    if (!res.ok) {
      for (const a of applied) applyStockDelta(userId, a.productId, -a.delta)
      addVenta(userId, fecha.value, turnoSel.value, removed)
      errorMsg.value = res.error ?? 'No se pudo reponer stock.'
      refresh()
      return
    }
    applied.push({ productId: pid, delta: +qty })
  }

  // restar caja
  const applyCaja = addToVentasTotal(userId, fecha.value, turnoSel.value, -Number(removed.total ?? 0))
  if (!applyCaja.ok) {
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
    <div class="mb-3">
      <h1 class="h4 mb-1">Ventas</h1>
      <div class="text-secondary">
        <span v-if="admin">Vista ADMIN: podés elegir fecha y turno.</span>
        <span v-else>Vista CAJERO: solo tu turno ({{ turnoSel }}).</span>
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

    <!-- NUEVA VENTA -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <h2 class="h6 mb-3">Nueva venta</h2>

        <!-- Cliente -->
        <div class="row g-3 mb-3">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Cliente (opcional)</label>
            <select v-model="clienteSelId" class="form-select bg-dark text-white border-secondary" :disabled="!canSell || clientes.length === 0">
              <option value="">Sin cliente</option>
              <option v-for="c in clientes" :key="c.id" :value="c.id">
                {{ c.nombre }} ({{ c.tipo }}) — Desc sugerido: {{ c.descuentoPct ?? 0 }}%
              </option>
            </select>
          </div>

          <div class="col-12 col-md-6 d-flex align-items-end">
            <div class="text-secondary small">
              Tip: aunque el cliente tenga “desc sugerido”, el descuento real lo ponés por producto.
            </div>
          </div>
        </div>

        <!-- Agregar producto -->
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

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">Cant.</label>
            <input v-model="itemQty" class="form-control bg-dark text-white border-secondary" inputmode="numeric" :disabled="!canSell || !selProductoId" />
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">Desc %</label>
            <input v-model="itemDiscountPct" class="form-control bg-dark text-white border-secondary" inputmode="numeric" :disabled="!canSell || !selProductoId" />
          </div>

          <div class="col-12 col-md-2 d-flex justify-content-md-end">
            <button class="btn btn-outline-light w-100" @click="addItem" :disabled="!canSell || !selProductoId">
              Agregar
            </button>
          </div>
        </div>

        <!-- Items -->
        <div class="table-responsive mt-3" v-if="items.length">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th style="width: 120px;">Precio</th>
                <th style="width: 90px;">Cant.</th>
                <th style="width: 110px;">Desc %</th>
                <th style="width: 180px;">Unit. final</th>
                <th style="width: 150px;">Subtotal</th>
                <th style="width: 120px;" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in items" :key="it.id" :class="it.invalidReason ? 'table-danger' : ''">
                <td class="fw-semibold">{{ it.name }}</td>

                <td class="text-secondary">$ {{ formatMoney(it.price) }}</td>

                <td>
                  <input
                    class="form-control form-control-sm bg-dark text-white border-secondary"
                    :value="it.qty"
                    inputmode="numeric"
                    @input="updateItemQty(it.id, $event.target.value)"
                    :disabled="!canSell"
                  />
                </td>

                <td>
                  <input
                    class="form-control form-control-sm bg-dark text-white border-secondary"
                    :value="it.discountPct"
                    inputmode="numeric"
                    @input="updateItemDiscount(it.id, $event.target.value)"
                    :disabled="!canSell"
                  />
                </td>

                <td class="text-secondary">
                  $ {{ formatMoney(it.netUnit) }}
                  <div v-if="it.invalidReason" class="small text-danger fw-semibold mt-1">
                    {{ it.invalidReason }}
                  </div>
                </td>

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

        <div v-if="hasInvalidItems" class="alert alert-danger py-2 mt-3 mb-0">
          Hay ítems a pérdida. Ajustá el descuento para poder registrar la venta.
        </div>

        <!-- Totales -->
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
            <label class="form-label text-secondary">Notas</label>
            <input v-model="notes" class="form-control bg-dark text-white border-secondary" :disabled="!canSell" />
          </div>
        </div>

        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
          <div class="text-secondary">
            Subtotal: <b>$ {{ formatMoney(subtotalBase) }}</b> ·
            Descuento: <b>$ {{ formatMoney(descuentoTotal) }}</b> ·
            Total: <b class="fs-5">$ {{ formatMoney(totalCalc) }}</b>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-outline-light" @click="clearForm" :disabled="!canSell">Limpiar</button>
            <button class="btn btn-primary btn-accent" @click="registrarVenta" :disabled="!canRegister">
              Registrar venta
            </button>
          </div>
        </div>

        <div class="text-secondary small mt-2">
          ✅ Cliente opcional · ✅ Descuento por producto · ✅ Stock + Caja · ✅ Bloqueo a pérdida
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
                <th>Cliente</th>
                <th>Total</th>
                <th style="width: 320px;">Detalle</th>
                <th style="width: 140px;" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in ventas" :key="v.id">
                <td class="text-secondary">{{ new Date(v.createdAt).toLocaleString('es-AR') }}</td>
                <td class="text-secondary">{{ v.clientNombre ?? '—' }}</td>
                <td class="fw-bold">$ {{ formatMoney(v.total) }}</td>
                <td class="text-secondary">
                  <div v-for="(it, idx) in (v.items ?? []).slice(0, 3)" :key="idx">
                    • {{ it.qty }} x {{ it.name }} ({{ it.discountPct ?? 0 }}%)
                  </div>
                  <div v-if="(v.items ?? []).length > 3" class="text-secondary">
                    +{{ (v.items ?? []).length - 3 }} más…
                  </div>
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
