// src/services/pagosProveedoresStorage.js
import { getSession } from '../auth/session'

const NS = 'pagos_proveedores_v1'

function key() {
  const s = getSession()
  if (!s?.userId) throw new Error('Sin sesión')
  return `${NS}:${s.userId}`
}

function loadAll() {
  const raw = localStorage.getItem(key())
  return raw ? JSON.parse(raw) : []
}

function saveAll(arr) {
  localStorage.setItem(key(), JSON.stringify(arr))
}

function uid() {
  return (crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`)
}

function toNumberMoney(n) {
  const x = Number(String(n ?? '').replace(',', '.'))
  return Number.isFinite(x) ? x : NaN
}

export function listPagosByProveedor(proveedorId) {
  const all = loadAll()
  return all
    .filter(p => String(p.proveedorId) === String(proveedorId))
    .sort((a, b) => (b.fecha || b.createdAt || '').localeCompare(a.fecha || a.createdAt || ''))
}

export function addPago({
  proveedorId,
  proveedorNombre,
  amount,
  method = 'TRANSFERENCIA',
  notes = '',
  refCompraId = null,
  refFechaStr = null,
  origin = 'MANUAL',

  // para alinearlo a SQL (si todavía no lo tenés, queda null)
  cajaId = null,
  metodoPagoId = null,
  fecha = null
}) {
  if (!proveedorId) throw new Error('Proveedor inválido')

  const a = toNumberMoney(amount)
  if (!Number.isFinite(a) || a <= 0) throw new Error('Monto de pago inválido')

  const s = getSession()
  if (!s?.userId) throw new Error('Sin sesión')

  const nowIso = new Date().toISOString()

  const pago = {
    id: uid(),

    // “FKs”
    proveedorId,
    refCompraId,   // compra_id (mock)
    cajaId,        // caja_id
    userId: s.userId,
    metodoPagoId,  // metodo_pago_id

    // datos
    proveedorNombre: proveedorNombre ?? '',
    amount: Math.round(a * 100) / 100,
    method, // string por ahora (después mapeás al id real)
    notes: String(notes ?? '').trim(),
    origin,

    // fechas
    fecha: fecha ?? nowIso,
    createdAt: nowIso,

    // aux
    refFechaStr
  }

  const prev = loadAll()
  const next = [pago, ...prev]
  saveAll(next)

  return pago
}

export function removePago(pagoId) {
  const all = loadAll()
  saveAll(all.filter(p => p.id !== pagoId))
}

// ✅ FIX: antes estaba roto (load/save no existían)
export function removePagosByRefCompra(refCompraId) {
  const prev = loadAll()
  const next = prev.filter(p => String(p.refCompraId) !== String(refCompraId))
  saveAll(next)
  return { ok: true, removed: prev.length - next.length }
}
import { aplicarPagoAutomaticoProveedor, aplicarPagoACompra } from './comprasStorage'

// ✅ Pago manual: o lo aplicás a una compra, o auto FIFO.
// Crea 1 pago por compra aplicada (como tu SQL con compra_id).
export function addPagoAplicado({
  proveedorId,
  proveedorNombre,
  amount,
  method = 'TRANSFERENCIA',
  notes = '',
  compraId = null,       // si viene, aplica a esa compra
  origin = 'MANUAL',
  cajaId = null,
  metodoPagoId = null
}) {
  // 1) validar monto (reuse addPago validations)
  const a = toNumberMoney(amount)
  if (!Number.isFinite(a) || a <= 0) throw new Error('Monto de pago inválido')

  // 2) aplicar a compras (actualiza saldoPendiente/estado)
  let aplicaciones = []
  let sobrante = 0

  if (compraId) {
    const res = aplicarPagoACompra({ compraId, monto: a })
    aplicaciones = [{ compraId, aplicado: res.aplicado }]
    sobrante = Math.round((a - res.aplicado) * 100) / 100
  } else {
    const res = aplicarPagoAutomaticoProveedor({ proveedorId, monto: a })
    aplicaciones = res.aplicaciones
    sobrante = res.sobrante
  }

  // 3) crear pagos (1 por compra aplicada)
  const pagosCreados = []
  for (const ap of aplicaciones) {
    if (ap.aplicado <= 0) continue
    pagosCreados.push(
      addPago({
        proveedorId,
        proveedorNombre,
        amount: ap.aplicado,
        method,
        notes,
        refCompraId: ap.compraId, // ✅ compra_id
        origin,
        cajaId,
        metodoPagoId
      })
    )
  }

  return { pagosCreados, sobrante }
}
