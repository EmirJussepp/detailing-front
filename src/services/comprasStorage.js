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

    return { productId, name, qty, unitCost, subtotal: qty * unitCost }
  })

  const total = normItems.reduce((acc, it) => acc + Number(it.subtotal ?? 0), 0)
  if (!Number.isFinite(total) || total <= 0) throw new Error('Total inválido')

  let pagadoAhora = 0
  if (condicion === 'CUENTA') {
    pagadoAhora = toNumberMoney(payload?.pagadoAhora)
    if (!Number.isFinite(pagadoAhora) || pagadoAhora < 0) throw new Error('Pagado ahora inválido')
    if (pagadoAhora > total) throw new Error('Pagado ahora no puede ser mayor al total')
  }

  const pagadoAhoraMethod =
    String(payload?.pagadoAhoraMethod ?? 'TRANSFERENCIA').trim() || 'TRANSFERENCIA'

  const saldoPendiente =
    condicion === 'CUENTA' ? Math.round((total - pagadoAhora) * 100) / 100 : 0

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

  // 2) crear compra con ID (CLAVE!)
  const compraId = uid()

  const compra = {
    id: compraId, // ✅ IMPORTANTÍSIMO
    fechaStr,
    proveedorId,
    proveedorNombre,
    items: normItems,
    total,
    notes: String(payload?.notes ?? '').trim(),

    condicion,
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

  // 4) ✅ pago automático si es CUENTA y pagó algo ahora
  if (condicion === 'CUENTA' && Number(pagadoAhora) > 0) {
    try {
      addPago({
        proveedorId,
        proveedorNombre,
        amount: pagadoAhora,
        method: pagadoAhoraMethod,
        notes: compra.notes ? `AUTO: ${compra.notes}` : `AUTO: compra ${compraId}`,
        refCompraId: compraId,
        refFechaStr: fechaStr,
        origin: 'AUTO_COMPRA'
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

  // 3) ✅ borrar pago auto asociado
  if (target.condicion === 'CUENTA' && Number(target.pagadoAhora ?? 0) > 0) {
    removePagosByRefCompra(target.id)
  }

  return { ok: true, removed: target }
}
