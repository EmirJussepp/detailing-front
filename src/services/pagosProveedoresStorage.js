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
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export function addPago({
  proveedorId,
  proveedorNombre,
  amount,
  method = 'TRANSFERENCIA',
  notes = '',
  refCompraId = null,
  refFechaStr = null,
  origin = 'MANUAL'
}) {
  if (!proveedorId) throw new Error('Proveedor inválido')

  const a = toNumberMoney(amount)
  if (!Number.isFinite(a) || a <= 0) {
    throw new Error('Monto de pago inválido')
  }

  const pago = {
    id: uid(),
    proveedorId,
    proveedorNombre: proveedorNombre ?? '',
    amount: Math.round(a * 100) / 100,
    method,
    notes: String(notes ?? '').trim(),
    refCompraId,
    refFechaStr,
    origin,
    createdAt: new Date().toISOString()
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

export function removePagosByRefCompra(refCompraId) {
  const prev = load()
  const next = prev.filter(p => p.refCompraId !== refCompraId)
  save(next)
  return { ok: true, removed: prev.length - next.length }
}


