<!-- src/views/ComprasView.vue -->
<script setup>
import { computed, ref, watch } from 'vue'
import { getSession, isAdmin } from '../auth/session'
import { listProductos } from '../services/productosStorage'
import { listProveedores } from '../services/proveedoresStorage'
import { listComprasDia, registrarCompra, eliminarCompra } from '../services/comprasStorage'

const session = getSession()
const admin = computed(() => isAdmin())
const userId = session?.userId ?? 'anon'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

const fecha = ref(todayISO())
const errorMsg = ref('')
const okMsg = ref('')

const proveedores = ref([])
const productos = ref([])
const compras = ref([])

function refresh() {
  proveedores.value = listProveedores({ includeInactive: false })
  productos.value = listProductos(userId).filter(p => p.activo)
  compras.value = listComprasDia(fecha.value)
}

watch(fecha, refresh, { immediate: true })

// compra form
const proveedorId = ref('')
const proveedorSel = computed(() => proveedores.value.find(p => p.id === proveedorId.value) ?? null)

const condicion = ref('PAGADO') // PAGADO | CUENTA
const pagadoAhora = ref('0')
const pagadoAhoraMethod = ref('TRANSFERENCIA') // EFECTIVO | TRANSFERENCIA | DEBITO | OTRO

const selProductoId = ref('')
const qty = ref('1')
const unitCost = ref('0')
const notes = ref('')

const items = ref([])

function uid() {
  return (crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`)
}

function addItem() {
  errorMsg.value = ''
  okMsg.value = ''

  const p = productos.value.find(x => x.id === selProductoId.value)
  if (!p) return (errorMsg.value = 'Seleccioná un producto.')

  const q = Math.floor(Number(String(qty.value).replace(',', '.')))
  if (!Number.isFinite(q) || q <= 0) return (errorMsg.value = 'Cantidad inválida.')

  const c = Number(String(unitCost.value).replace(',', '.'))
  if (!Number.isFinite(c) || c < 0) return (errorMsg.value = 'Costo unitario inválido.')

  items.value = [
    ...items.value,
    {
      id: uid(),
      productId: p.id,
      name: p.nombre,
      qty: q,
      unitCost: c,
      subtotal: q * c
    }
  ]

  selProductoId.value = ''
  qty.value = '1'
  unitCost.value = '0'
}

function removeItem(id) {
  items.value = items.value.filter(i => i.id !== id)
}

const totalCalc = computed(() =>
  items.value.reduce((acc, it) => acc + Number(it.subtotal ?? 0), 0)
)

function clearForm() {
  proveedorId.value = ''
  selProductoId.value = ''
  qty.value = '1'
  unitCost.value = '0'
  notes.value = ''
  items.value = []
  condicion.value = 'PAGADO'
  pagadoAhora.value = '0'
  pagadoAhoraMethod.value = 'TRANSFERENCIA'
}

function toastOk(msg) {
  okMsg.value = msg
  setTimeout(() => (okMsg.value = ''), 2200)
}

function registrar() {
  errorMsg.value = ''
  okMsg.value = ''

  try {
    const prov = proveedorSel.value
    if (!prov) return (errorMsg.value = 'Seleccioná un proveedor.')
    if (items.value.length === 0) return (errorMsg.value = 'Agregá al menos 1 ítem.')

    // ✅ ACÁ le pasás el método:
    const compra = registrarCompra({
      fechaStr: fecha.value,
      proveedorId: prov.id,
      proveedorNombre: prov.nombre,
      items: items.value,
      notes: notes.value,
      condicion: condicion.value,
      pagadoAhora: pagadoAhora.value,
      pagadoAhoraMethod: pagadoAhoraMethod.value
    })

    toastOk(`Compra registrada ✅ Stock actualizado (+) — Total $${formatMoney(compra.total)}`)
    clearForm()
    refresh()
  } catch (e) {
    errorMsg.value = e?.message || 'No se pudo registrar la compra.'
  }
}

function borrarCompra(c) {
  errorMsg.value = ''
  okMsg.value = ''

  if (!confirm(`Eliminar compra a "${c.proveedorNombre}" por $${formatMoney(c.total)}? (Revertirá stock)`)) return

  const res = eliminarCompra({ fechaStr: fecha.value, compraId: c.id })
  if (!res.ok) {
    errorMsg.value = res.error || 'No se pudo eliminar.'
    refresh()
    return
  }

  toastOk('Compra eliminada ✅ Stock revertido (-)')
  refresh()
}
</script>

<template>
  <div>
    <div class="mb-3">
      <h1 class="h4 mb-1">Compras</h1>
      <div class="text-secondary">Compras a proveedores → actualiza stock automáticamente (localStorage)</div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Fecha</label>
            <input v-model="fecha" type="date" class="form-control bg-dark text-white border-secondary" :disabled="!admin" />
            <div v-if="!admin" class="text-secondary small mt-1">CASHIER: fecha fija (hoy).</div>
          </div>

          <div class="col-12 col-md-5">
            <label class="form-label text-secondary">Proveedor</label>
            <select v-model="proveedorId" class="form-select bg-dark text-white border-secondary">
              <option value="">Seleccionar…</option>
              <option v-for="p in proveedores" :key="p.id" :value="p.id">
                {{ p.nombre }}
              </option>
            </select>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Condición</label>
            <select v-model="condicion" class="form-select bg-dark text-white border-secondary">
              <option value="PAGADO">PAGADO</option>
              <option value="CUENTA">A CUENTA</option>
            </select>
          </div>

          <div class="col-12 col-md-2" v-if="condicion === 'CUENTA'">
            <label class="form-label text-secondary">Pagado ahora</label>
            <input v-model="pagadoAhora" class="form-control bg-dark text-white border-secondary" inputmode="numeric" placeholder="0" />
          </div>

          <div class="col-12 col-md-3" v-if="condicion === 'CUENTA'">
            <label class="form-label text-secondary">Método pago</label>
            <select v-model="pagadoAhoraMethod" class="form-select bg-dark text-white border-secondary">
              <option value="EFECTIVO">EFECTIVO</option>
              <option value="TRANSFERENCIA">TRANSFERENCIA</option>
              <option value="DEBITO">DÉBITO</option>
              <option value="OTRO">OTRO</option>
            </select>
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Notas</label>
            <input v-model="notes" class="form-control bg-dark text-white border-secondary" placeholder="Factura, detalle..." />
          </div>
        </div>

        <hr class="border-secondary my-3" />

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Producto</label>
            <select v-model="selProductoId" class="form-select bg-dark text-white border-secondary">
              <option value="">Seleccionar…</option>
              <option v-for="p in productos" :key="p.id" :value="p.id">
                {{ p.nombre }} (Stock: {{ p.stockActual }})
              </option>
            </select>
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">Cant.</label>
            <input v-model="qty" class="form-control bg-dark text-white border-secondary" inputmode="numeric" />
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">Costo unit.</label>
            <input v-model="unitCost" class="form-control bg-dark text-white border-secondary" inputmode="numeric" />
          </div>

          <div class="col-12 col-md-2 d-flex justify-content-md-end">
            <button class="btn btn-outline-light w-100" @click="addItem" :disabled="!selProductoId">
              Agregar
            </button>
          </div>
        </div>

        <div class="table-responsive mt-3" v-if="items.length">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th style="width: 110px;">Cant.</th>
                <th style="width: 150px;">Costo unit.</th>
                <th style="width: 170px;">Subtotal</th>
                <th style="width: 120px;" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in items" :key="it.id">
                <td class="fw-semibold">{{ it.name }}</td>
                <td class="text-secondary">{{ it.qty }}</td>
                <td class="text-secondary">$ {{ formatMoney(it.unitCost) }}</td>
                <td class="fw-bold">$ {{ formatMoney(it.subtotal) }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-light" @click="removeItem(it.id)">Quitar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="text-secondary mt-3">Agregá ítems para armar la compra.</div>

        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
          <div class="text-secondary">
            Total: <b class="fs-5">$ {{ formatMoney(totalCalc) }}</b>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-outline-light" @click="clearForm">Limpiar</button>
            <button class="btn btn-primary btn-accent" @click="registrar" :disabled="!proveedorId || items.length === 0">
              Registrar compra
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 class="h6 mb-0">Compras del día</h2>
          <div class="text-secondary small">{{ compras.length }} compra(s)</div>
        </div>

        <div v-if="compras.length === 0" class="text-secondary">No hay compras registradas.</div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 220px;">Fecha/Hora</th>
                <th>Proveedor</th>
                <th>Total</th>
                <th style="width: 160px;">Condición</th>
                <th style="width: 180px;">Saldo pend.</th>
                <th style="width: 340px;">Detalle</th>
                <th style="width: 140px;" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in compras" :key="c.id">
                <td class="text-secondary">{{ new Date(c.createdAt).toLocaleString('es-AR') }}</td>
                <td class="text-secondary">{{ c.proveedorNombre }}</td>
                <td class="fw-bold">$ {{ formatMoney(c.total) }}</td>
                <td class="text-secondary">
                  <span class="badge" :class="c.condicion === 'CUENTA' ? 'text-bg-warning' : 'text-bg-success'">
                    {{ c.condicion }}
                  </span>
                </td>
                <td class="text-secondary">
                  $ {{ formatMoney(c.saldoPendiente ?? 0) }}
                </td>
                <td class="text-secondary">
                  <div v-for="(it, idx) in (c.items ?? []).slice(0, 3)" :key="idx">
                    • {{ it.qty }} x {{ it.name }} (${{ formatMoney(it.unitCost) }})
                  </div>
                  <div v-if="(c.items ?? []).length > 3" class="text-secondary">
                    +{{ (c.items ?? []).length - 3 }} más…
                  </div>
                </td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-light" @click="borrarCompra(c)">
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-3">
          Al eliminar: revierte stock automáticamente.
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
