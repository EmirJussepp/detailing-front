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

export function addPago(payload) {
  const proveedorId = String(payload?.proveedorId ?? '').trim()
  const proveedorNombre = String(payload?.proveedorNombre ?? '').trim()
  if (!proveedorId || !proveedorNombre) throw new Error('Proveedor inválido')

  const amount = toNumberMoney(payload?.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Monto inválido')

  const method = String(payload?.method ?? 'TRANSFERENCIA').trim() || 'TRANSFERENCIA'
  const notes = String(payload?.notes ?? '').trim()

  const refCompraId = payload?.refCompraId ? String(payload.refCompraId) : null
  const refFechaStr = payload?.refFechaStr ? String(payload.refFechaStr) : null
  const origin = payload?.origin ? String(payload.origin) : 'MANUAL'

  const pago = {
    id: uid(),
    proveedorId,
    proveedorNombre,
    amount,
    method,
    notes,
    refCompraId,
    refFechaStr,
    origin,
    createdAt: new Date().toISOString()
  }

  const all = loadAll()
  all.unshift(pago)
  saveAll(all)
  return pago
}

export function removePago(pagoId) {
  const all = loadAll()
  saveAll(all.filter(p => p.id !== pagoId))
}

export function removePagosByRefCompra(refCompraId) {
  const all = loadAll()
  const next = all.filter(p => String(p.refCompraId || '') !== String(refCompraId))
  saveAll(next)
  return { removedCount: all.length - next.length }
}

