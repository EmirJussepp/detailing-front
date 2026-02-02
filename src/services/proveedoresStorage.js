// src/services/proveedoresStorage.js
import { getSession } from '../auth/session'

const NS = 'proveedores_v2'

// ===================== helpers =====================
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
  return (crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`)
}

function onlyDigits(s) {
  return String(s ?? '').replace(/\D/g, '')
}

function normalizeText(s) {
  return String(s ?? '').trim().toLowerCase()
}

function isValidEmail(s) {
  const x = String(s ?? '').trim()
  if (!x) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)
}

function buildDisplayName(p) {
  if (p.tipo === 'EMPRESA') return String(p.razonSocial ?? '').trim()
  return `${String(p.nombre ?? '').trim()} ${String(p.apellido ?? '').trim()}`.trim()
}

function buildDocKey(p) {
  // clave de unicidad “pro”
  if (p.tipo === 'EMPRESA') return `CUIT:${onlyDigits(p.cuit)}`
  return `${String(p.documentoTipo ?? 'DNI').trim().toUpperCase()}:${onlyDigits(p.documentoNro)}`
}

function validateProveedorForm(form, mode = 'create') {
  const tipo = form?.tipo === 'EMPRESA' ? 'EMPRESA' : 'PERSONA'

  if (tipo === 'EMPRESA') {
    const razonSocial = String(form?.razonSocial ?? '').trim()
    if (!razonSocial) throw new Error('La razón social es obligatoria')

    const cuit = onlyDigits(form?.cuit)
    if (!cuit || cuit.length < 11) throw new Error('CUIT inválido (mínimo 11 dígitos)')
  } else {
    const nombre = String(form?.nombre ?? '').trim()
    const apellido = String(form?.apellido ?? '').trim()
    if (!nombre) throw new Error('El nombre es obligatorio')
    if (!apellido) throw new Error('El apellido es obligatorio')

    const docTipo = String(form?.documentoTipo ?? 'DNI').trim().toUpperCase() || 'DNI'
    const docNro = onlyDigits(form?.documentoNro)
    if (!docNro) throw new Error(`${docTipo} inválido`)
  }

  if (!isValidEmail(form?.email)) throw new Error('Email inválido')
  return tipo
}

// ===================== API MOCK =====================

export function listProveedores({ includeInactive = false } = {}) {
  const list = load()
  const filtered = includeInactive ? list : list.filter(p => p.activo !== false)
  return [...filtered].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'es'))
}

export function getProveedorById(id) {
  return load().find(p => String(p.id) === String(id)) || null
}

export function createProveedor(form) {
  const tipo = validateProveedorForm(form, 'create')
  const list = load()

  // armamos “proveedor pro” (lo que tu UI consume SIEMPRE)
  const base = {
    id: uid(),
    tipo,
    // persona
    nombre: tipo === 'PERSONA' ? String(form?.nombre ?? '').trim() : null,
    apellido: tipo === 'PERSONA' ? String(form?.apellido ?? '').trim() : null,
    documentoTipo: tipo === 'PERSONA' ? (String(form?.documentoTipo ?? 'DNI').trim().toUpperCase() || 'DNI') : null,
    documentoNro: tipo === 'PERSONA' ? onlyDigits(form?.documentoNro) : null,

    // empresa
    razonSocial: tipo === 'EMPRESA' ? String(form?.razonSocial ?? '').trim() : null,
    cuit: tipo === 'EMPRESA' ? onlyDigits(form?.cuit) : null,

    // contacto
    telefono: String(form?.telefono ?? '').trim(),
    email: String(form?.email ?? '').trim(),
    direccion: String(form?.direccion ?? '').trim(),
    notas: String(form?.notas ?? '').trim(),

    activo: form?.activo !== false,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  base.displayName = buildDisplayName(base)
  base.docKey = buildDocKey(base) // clave interna
  base.documentoLabel =
    base.tipo === 'EMPRESA'
      ? `CUIT ${String(form?.cuit ?? '').trim()}`
      : `${base.documentoTipo} ${String(form?.documentoNro ?? '').trim()}`

  // unicidad pro:
  // - EMPRESA: CUIT único
  // - PERSONA: docTipo+docNro único
  const existsDoc = list.some(p => normalizeText(p.docKey) === normalizeText(base.docKey))
  if (existsDoc) throw new Error('Ya existe un proveedor con ese documento/CUIT')

  // adicional: nombre/razón social no repetida (soft)
  const existsName = list.some(p => normalizeText(p.displayName) === normalizeText(base.displayName))
  if (existsName) throw new Error('Ya existe un proveedor con ese nombre/razón social')

  list.push(base)
  save(list)
  return base
}

export function updateProveedor(id, patch) {
  const list = load()
  const idx = list.findIndex(p => String(p.id) === String(id))
  if (idx === -1) throw new Error('Proveedor no encontrado')

  // armamos “form merged”
  const prev = list[idx]
  const merged = {
    ...prev,
    ...patch,
    // asegurar strings limpias
    telefono: String(patch?.telefono ?? prev.telefono ?? '').trim(),
    email: String(patch?.email ?? prev.email ?? '').trim(),
    direccion: String(patch?.direccion ?? prev.direccion ?? '').trim(),
    notas: String(patch?.notas ?? prev.notas ?? '').trim(),
    activo: patch?.activo ?? prev.activo
  }

  // validar según tipo
  const tipo = validateProveedorForm(merged, 'edit')
  merged.tipo = tipo

  // normalizar campos por tipo
  if (tipo === 'EMPRESA') {
    merged.razonSocial = String(merged.razonSocial ?? '').trim()
    merged.cuit = onlyDigits(merged.cuit)

    merged.nombre = null
    merged.apellido = null
    merged.documentoTipo = null
    merged.documentoNro = null
  } else {
    merged.nombre = String(merged.nombre ?? '').trim()
    merged.apellido = String(merged.apellido ?? '').trim()
    merged.documentoTipo = (String(merged.documentoTipo ?? 'DNI').trim().toUpperCase() || 'DNI')
    merged.documentoNro = onlyDigits(merged.documentoNro)

    merged.razonSocial = null
    merged.cuit = null
  }

  merged.displayName = buildDisplayName(merged)
  merged.docKey = buildDocKey(merged)
  merged.documentoLabel =
    merged.tipo === 'EMPRESA'
      ? `CUIT ${String(patch?.cuit ?? prev.cuit ?? '').trim()}`
      : `${merged.documentoTipo} ${String(patch?.documentoNro ?? prev.documentoNro ?? '').trim()}`

  // validar unicidad contra otros
  const existsDoc = list.some(p => p.id !== id && normalizeText(p.docKey) === normalizeText(merged.docKey))
  if (existsDoc) throw new Error('Ya existe un proveedor con ese documento/CUIT')

  const existsName = list.some(p => p.id !== id && normalizeText(p.displayName) === normalizeText(merged.displayName))
  if (existsName) throw new Error('Ya existe un proveedor con ese nombre/razón social')

  merged.updatedAt = new Date().toISOString()

  list[idx] = merged
  save(list)
  return merged
}

export function setProveedorActivo(id, activo) {
  return updateProveedor(id, { activo: !!activo })
}
