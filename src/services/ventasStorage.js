// src/services/ventasStorage.js
export function makeVentasStorageKey(userId) {
  return `ventas_v1:${userId}`
}

export function makeKey(fechaStr, turno) {
  return `${fechaStr}|${turno}`
}

export function loadVentas(userId) {
  try {
    const raw = localStorage.getItem(makeVentasStorageKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveVentas(userId, obj) {
  localStorage.setItem(makeVentasStorageKey(userId), JSON.stringify(obj))
}

export function listVentasBucket(userId, fechaStr, turno) {
  const all = loadVentas(userId)
  return all[makeKey(fechaStr, turno)] ?? []
}

export function addVenta(userId, fechaStr, turno, venta) {
  const all = loadVentas(userId)
  const k = makeKey(fechaStr, turno)
  const prev = all[k] ?? []
  const next = { ...all, [k]: [venta, ...prev] } // newest first
  saveVentas(userId, next)
  return next
}

export function removeVenta(userId, fechaStr, turno, ventaId) {
  const all = loadVentas(userId)
  const k = makeKey(fechaStr, turno)
  const prev = all[k] ?? []
  const found = prev.find(v => v.id === ventaId) ?? null
  const filtered = prev.filter(v => v.id !== ventaId)
  const next = { ...all, [k]: filtered }
  saveVentas(userId, next)
  return { next, removed: found }
}
