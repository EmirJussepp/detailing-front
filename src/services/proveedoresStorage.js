// src/services/proveedoresStorage.js
import { getSession } from '../auth/session'


const NS = 'proveedores_v1'

function key() {
  const s = getSession()
  if (!s?.userId) throw new Error('Sin sesión')
  return `${NS}:${s.userId}`
}

function load() {
  const raw = localStorage.getItem(key())
  return raw ? JSON.parse(raw) : []
}

function save(list) {
  localStorage.setItem(key(), JSON.stringify(list))
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function listProveedores({ includeInactive = false } = {}) {
  const list = load()
  const filtered = includeInactive ? list : list.filter(p => p.activo !== false)
  // orden por nombre
  return filtered.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
}

export function getProveedorById(id) {
  return load().find(p => p.id === id) || null
}

export function createProveedor(payload) {
  const nombre = (payload?.nombre || '').trim()
  if (!nombre) throw new Error('El nombre es obligatorio')

  const list = load()
  const exists = list.some(p => (p.nombre || '').trim().toLowerCase() === nombre.toLowerCase())
  if (exists) throw new Error('Ya existe un proveedor con ese nombre')

  const now = new Date().toISOString()
  const nuevo = {
    id: uid(),
    nombre,
    telefono: (payload?.telefono || '').trim(),
    email: (payload?.email || '').trim(),
    direccion: (payload?.direccion || '').trim(),
    notas: (payload?.notas || '').trim(),
    activo: payload?.activo ?? true,
    createdAt: now,
    updatedAt: now,
  }

  list.push(nuevo)
  save(list)
  return nuevo
}

export function updateProveedor(id, patch) {
  const list = load()
  const idx = list.findIndex(p => p.id === id)
  if (idx === -1) throw new Error('Proveedor no encontrado')

  const nombre = (patch?.nombre ?? list[idx].nombre ?? '').trim()
  if (!nombre) throw new Error('El nombre es obligatorio')

  const exists = list.some(
    p => p.id !== id && (p.nombre || '').trim().toLowerCase() === nombre.toLowerCase()
  )
  if (exists) throw new Error('Ya existe un proveedor con ese nombre')

  const updated = {
    ...list[idx],
    ...patch,
    nombre,
    telefono: (patch?.telefono ?? list[idx].telefono ?? '').trim(),
    email: (patch?.email ?? list[idx].email ?? '').trim(),
    direccion: (patch?.direccion ?? list[idx].direccion ?? '').trim(),
    notas: (patch?.notas ?? list[idx].notas ?? '').trim(),
    updatedAt: new Date().toISOString(),
  }

  list[idx] = updated
  save(list)
  return updated
}

export function setProveedorActivo(id, activo) {
  return updateProveedor(id, { activo: !!activo })
}

export function deleteProveedorHard(id) {
  // 👇 no lo usaría en prod, pero útil en mock
  const list = load().filter(p => p.id !== id)
  save(list)
  return true
}
