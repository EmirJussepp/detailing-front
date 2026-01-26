export function makeClientesStorageKey(userId) {
  return `clientes_v1:${userId}`
}

export function loadClientes(userId) {
  try {
    const raw = localStorage.getItem(makeClientesStorageKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveClientes(userId, arr) {
  localStorage.setItem(makeClientesStorageKey(userId), JSON.stringify(arr))
}

export function listClientes(userId) {
  return loadClientes(userId)
}

export function addCliente(userId, cliente) {
  const prev = loadClientes(userId)
  const next = [cliente, ...prev]
  saveClientes(userId, next)
  return next
}

export function updateCliente(userId, id, patch) {
  const prev = loadClientes(userId)
  const next = prev.map(c => (c.id === id ? { ...c, ...patch } : c))
  saveClientes(userId, next)
  return next
}

export function removeCliente(userId, id) {
  const prev = loadClientes(userId)
  const next = prev.filter(c => c.id !== id)
  saveClientes(userId, next)
  return next
}
