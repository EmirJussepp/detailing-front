// src/services/comprasStorage.js
import { getSession } from '../auth/session'
import { applyStockDelta } from './productosStorage'
import { addPago, removePagosByRefCompra } from './pagosProveedoresStorage'

const NS = 'compras_v1'

function key() {
  const s = getSession()
  if (!s?.userId) throw new Error('Sin sesión')
  return `${NS}:${s.userId}`
}

function loadAll() {
  const raw = localStorage.getItem(key())
  return raw ? JSON.parse(raw) : {} // { [fechaStr]: Compra[] }
}

function saveAll(obj) {
  localStorage.setItem(key(), JSON.stringify(obj))
}

function uid() {
  return (crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`)
}

function toNumberMoney(n) {
  const x = Number(String(n ?? '').replace(',', '.'))
  return Number.isFinite(x) ? x : NaN
}

function safeInt(n) {
  const x = Math.floor(Number(String(n ?? '').replace(',', '.')))
  return Number.isFinite(x) ? x : NaN
}

function round2(n) {
  return Math.round(Number(n ?? 0) * 100) / 100
}

function calcEstado({ condicion, total, pagadoAhora, saldoPendiente }) {
  if (condicion === 'PAGADO') return 'PAGADA'
  // CUENTA
  if (round2(saldoPendiente) <= 0) return 'PAGADA'
  if (round2(pagadoAhora) > 0 && round2(pagadoAhora) < round2(total)) return 'PARCIAL'
  return 'PENDIENTE'
}

export function listComprasDia(fechaStr) {
  const all = loadAll()
  const arr = all[fechaStr] ?? []
  return [...arr].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export function listComprasAll() {
  const all = loadAll()
  const arr = []
  for (const fechaStr of Object.keys(all)) {
    const list = all[fechaStr] ?? []
    for (const c of list) arr.push(c)
  }
  return arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export function registrarCompra(payload) {
  const s = getSession()
  if (!s?.userId) throw new Error('Sin sesión')
  const userId = s.userId

  const fechaStr = String(payload?.fechaStr ?? '').trim()
  if (!fechaStr) throw new Error('Fecha inválida')

  const proveedorId = String(payload?.proveedorId ?? '').trim()
  const proveedorNombre = String(payload?.proveedorNombre ?? '').trim()
  if (!proveedorId || !proveedorNombre) throw new Error('Proveedor inválido')

  const condicion = (payload?.condicion === 'CUENTA') ? 'CUENTA' : 'PAGADO'

  const items = Array.isArray(payload?.items) ? payload.items : []
  if (items.length === 0) throw new Error('Agregá al menos 1 ítem')

  const normItems = items.map(it => {
    const productId = String(it?.productId ?? '').trim()
    const name = String(it?.name ?? '').trim()
    const qty = safeInt(it?.qty)
    const unitCost = toNumberMoney(it?.unitCost)

    if (!productId || !name) throw new Error('Ítem inválido (producto)')
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Cantidad inválida')
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error('Costo unitario inválido')

    return { productId, name, qty, unitCost, subtotal: round2(qty * unitCost) }
  })

  const total = round2(normItems.reduce((acc, it) => acc + Number(it.subtotal ?? 0), 0))
  if (!Number.isFinite(total) || total <= 0) throw new Error('Total inválido')

  let pagadoAhora = 0
  if (condicion === 'CUENTA') {
    pagadoAhora = toNumberMoney(payload?.pagadoAhora)
    if (!Number.isFinite(pagadoAhora) || pagadoAhora < 0) throw new Error('Pagado ahora inválido')
    if (pagadoAhora > total) throw new Error('Pagado ahora no puede ser mayor al total')
  } else {
    // contado: pagadoAhora es todo el total
    pagadoAhora = total
  }

  const pagadoAhoraMethod =
    String(payload?.pagadoAhoraMethod ?? 'TRANSFERENCIA').trim() || 'TRANSFERENCIA'

  // ✅ FIX: saldo pendiente real
  const saldoPendiente = condicion === 'CUENTA' ? round2(total - pagadoAhora) : 0

  // estado SQL-like
  const estado = calcEstado({ condicion, total, pagadoAhora, saldoPendiente })

  // 1) actualizar stock (sumar)
  const applied = []
  for (const it of normItems) {
    const res = applyStockDelta(userId, it.productId, +it.qty)
    if (!res.ok) {
      for (const a of applied) applyStockDelta(userId, a.productId, -a.delta)
      throw new Error(res.error ?? 'No se pudo actualizar stock')
    }
    applied.push({ productId: it.productId, delta: +it.qty })
  }

  // 2) crear compra
  const compraId = uid()
  const compra = {
    id: compraId,
    fechaStr,
    proveedorId,
    proveedorNombre, // snapshot (podés sacarlo más adelante)
    items: normItems,
    total,
    notes: String(payload?.notes ?? '').trim(),

    condicion,        // UX
    estado,           // ✅ SQL-like
    pagadoAhora,
    pagadoAhoraMethod,
    saldoPendiente,

    createdAt: new Date().toISOString()
  }

  // 3) persistir compra
  const all = loadAll()
  const prev = all[fechaStr] ?? []
  all[fechaStr] = [compra, ...prev]
  saveAll(all)

  // 4) ✅ pago automático:
  // - CUENTA: si pagó algo ahora
  // - PAGADO: siempre (contado) para que quede compatible con SQL
  const debeCrearPago =
    (condicion === 'CUENTA' && round2(pagadoAhora) > 0) ||
    (condicion === 'PAGADO' && round2(total) > 0)

  if (debeCrearPago) {
    try {
      addPago({
        proveedorId,
        proveedorNombre,
        amount: pagadoAhora,
        method: pagadoAhoraMethod,
        notes: compra.notes ? `AUTO: ${compra.notes}` : `AUTO: compra ${compraId}`,
        refCompraId: compraId,
        refFechaStr: fechaStr,
        origin: 'AUTO_COMPRA',

        // más adelante: cajaId/metodoPagoId reales
        cajaId: null,
        metodoPagoId: null
      })
    } catch (e) {
      // rollback: borrar compra + revertir stock
      const rbAll = loadAll()
      rbAll[fechaStr] = (rbAll[fechaStr] ?? []).filter(c => c.id !== compraId)
      saveAll(rbAll)

      for (const a of applied) applyStockDelta(userId, a.productId, -a.delta)

      throw new Error(e?.message || 'No se pudo generar el pago automático')
    }
  }

  return compra
}

export function eliminarCompra({ fechaStr, compraId }) {
  const s = getSession()
  if (!s?.userId) return { ok: false, error: 'Sin sesión' }
  const userId = s.userId

  const all = loadAll()
  const prev = all[fechaStr] ?? []
  const target = prev.find(c => c.id === compraId)
  if (!target) return { ok: false, error: 'Compra no encontrada' }

  // 1) revertir stock (-)
  const applied = []
  for (const it of (target.items ?? [])) {
    const res = applyStockDelta(userId, it.productId, -Number(it.qty ?? 0))
    if (!res.ok) {
      for (const a of applied) applyStockDelta(userId, a.productId, -a.delta)
      return { ok: false, error: res.error ?? 'No se pudo revertir stock' }
    }
    applied.push({ productId: it.productId, delta: -Number(it.qty ?? 0) })
  }

  // 2) borrar compra
  const next = prev.filter(c => c.id !== compraId)
  all[fechaStr] = next
  saveAll(all)

  // 3) ✅ borrar pagos asociados a la compra (contado o cuenta)
  removePagosByRefCompra(target.id)

  return { ok: true, removed: target }
}
// ✅ helpers para aplicar pagos a compras existentes

function calcEstadoFromSaldo({ condicion, total, saldoPendiente }) {
  if (condicion === 'PAGADO') return 'PAGADA'
  if (saldoPendiente <= 0) return 'PAGADA'
  if (saldoPendiente < total) return 'PARCIAL'
  return 'PENDIENTE'
}

export function getCompraById(compraId) {
  const all = loadAll()
  for (const fechaStr of Object.keys(all)) {
    const list = all[fechaStr] ?? []
    const idx = list.findIndex(c => String(c.id) === String(compraId))
    if (idx !== -1) return { fechaStr, compra: list[idx], idx }
  }
  return null
}

export function listComprasByProveedor(proveedorId) {
  return listComprasAll()
    .filter(c => String(c.proveedorId) === String(proveedorId))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')) // más vieja primero
}

export function listComprasPendientesProveedor(proveedorId) {
  return listComprasByProveedor(proveedorId).filter(c =>
    c.condicion === 'CUENTA' && Number(c.saldoPendiente ?? 0) > 0
  )
}

export function aplicarPagoACompra({ compraId, monto }) {
  const found = getCompraById(compraId)
  if (!found) throw new Error('Compra no encontrada')

  const { fechaStr, compra, idx } = found

  const m = Math.round(Number(monto ?? 0) * 100) / 100
  if (!Number.isFinite(m) || m <= 0) throw new Error('Monto inválido')

  const saldoPrev = Math.round(Number(compra.saldoPendiente ?? 0) * 100) / 100
  const aplicado = Math.min(m, saldoPrev)
  const saldoNuevo = Math.round((saldoPrev - aplicado) * 100) / 100

  const updated = {
    ...compra,
    saldoPendiente: saldoNuevo,
    estado: calcEstadoFromSaldo({
      condicion: compra.condicion,
      total: compra.total,
      saldoPendiente: saldoNuevo
    }),
    updatedAt: new Date().toISOString()
  }

  const all = loadAll()
  const list = [...(all[fechaStr] ?? [])]
  list[idx] = updated
  all[fechaStr] = list
  saveAll(all)

  return { aplicado, saldoNuevo, compra: updated }
}

// Auto: aplica monto a compras pendientes (FIFO)
export function aplicarPagoAutomaticoProveedor({ proveedorId, monto }) {
  let remaining = Math.round(Number(monto ?? 0) * 100) / 100
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error('Monto inválido')

  const pendientes = listComprasPendientesProveedor(proveedorId)
  const aplicaciones = []

  for (const c of pendientes) {
    if (remaining <= 0) break
    const res = aplicarPagoACompra({ compraId: c.id, monto: remaining })
    if (res.aplicado > 0) {
      aplicaciones.push({ compraId: c.id, aplicado: res.aplicado })
      remaining = Math.round((remaining - res.aplicado) * 100) / 100
    }
  }

  return { aplicaciones, sobrante: remaining }
}
