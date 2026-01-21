// src/services/cajaStorage.js
export function makeCajaStorageKey(userId) {
  return `cajas_v1:${userId}`
}

export function makeKey(fechaStr, turno) {
  return `${fechaStr}|${turno}`
}

export function loadCajas(userId) {
  try {
    const raw = localStorage.getItem(makeCajaStorageKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveCajas(userId, obj) {
  localStorage.setItem(makeCajaStorageKey(userId), JSON.stringify(obj))
}

export function getCaja(userId, fechaStr, turno) {
  const cajas = loadCajas(userId)
  return cajas[makeKey(fechaStr, turno)] ?? null
}

export function setCaja(userId, fechaStr, turno, caja) {
  const cajas = loadCajas(userId)
  const next = { ...cajas, [makeKey(fechaStr, turno)]: caja }
  saveCajas(userId, next)
  return next
}

export function requireCajaAbierta(userId, fechaStr, turno) {
  const caja = getCaja(userId, fechaStr, turno)
  if (!caja) {
    return { ok: false, error: 'No hay caja creada para este turno. Abrí la caja para vender.' }
  }
  if (caja.estado !== 'ABIERTA') {
    return { ok: false, error: 'La caja está CERRADA. Abrí la caja para vender.' }
  }
  return { ok: true, caja }
}

// ✅ Suma (o resta) ventasTotal SOLO si la caja está ABIERTA
export function addToVentasTotal(userId, fechaStr, turno, delta) {
  const check = requireCajaAbierta(userId, fechaStr, turno)
  if (!check.ok) return check

  const caja = check.caja
  const ventas = Number(caja.ventasTotal ?? 0)
  const d = Number(delta ?? 0)

  const updated = {
    ...caja,
    ventasTotal: ventas + d
  }

  setCaja(userId, fechaStr, turno, updated)
  return { ok: true, caja: updated }
}
