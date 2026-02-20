export function emitCajaChanged() {
  window.dispatchEvent(new Event("caja:changed"))
}

export function onCajaChanged(cb) {
  window.addEventListener("caja:changed", cb)
  return () => window.removeEventListener("caja:changed", cb)
}
