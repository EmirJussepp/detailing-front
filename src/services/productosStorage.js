// src/services/productosStorage.js
export function makeProductosStorageKey(userId) {
  return `productos_v1:${userId}`
}

export function loadProductos(userId) {
  try {
    const raw = localStorage.getItem(makeProductosStorageKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveProductos(userId, arr) {
  localStorage.setItem(makeProductosStorageKey(userId), JSON.stringify(arr))
}

export function listProductos(userId) {
  return loadProductos(userId)
}

export function addProducto(userId, producto) {
  const prev = loadProductos(userId)
  const next = [producto, ...prev]
  saveProductos(userId, next)
  return next
}

export function updateProducto(userId, productoId, patch) {
  const prev = loadProductos(userId)
  const next = prev.map(p => (p.id === productoId ? { ...p, ...patch } : p))
  saveProductos(userId, next)
  return next
}

export function removeProducto(userId, productoId) {
  const prev = loadProductos(userId)
  const next = prev.filter(p => p.id !== productoId)
  saveProductos(userId, next)
  return next
}

export function getProducto(userId, productoId) {
  const prev = loadProductos(userId)
  return prev.find(p => p.id === productoId) ?? null
}

// ✅ Control de stock (para Ventas)
export function hasStock(userId, productoId, qty) {
  const p = getProducto(userId, productoId)
  if (!p) return { ok: false, error: 'Producto no encontrado.' }
  const stock = Number(p.stockActual ?? 0)
  const q = Number(qty ?? 0)
  if (!Number.isFinite(q) || q <= 0) return { ok: false, error: 'Cantidad inválida.' }
  if (stock < q) return { ok: false, error: `Stock insuficiente para "${p.nombre}". (Stock: ${stock})` }
  return { ok: true, producto: p }
}

export function applyStockDelta(userId, productoId, delta) {
  const p = getProducto(userId, productoId)
  if (!p) return { ok: false, error: 'Producto no encontrado.' }

  const stock = Number(p.stockActual ?? 0)
  const d = Number(delta ?? 0)
  const nextStock = stock + d

  if (!Number.isFinite(nextStock) || nextStock < 0) {
    return { ok: false, error: 'Stock resultante inválido.' }
  }

  const next = updateProducto(userId, productoId, { stockActual: nextStock })
  const updated = next.find(x => x.id === productoId) ?? null
  return { ok: true, producto: updated }
}
