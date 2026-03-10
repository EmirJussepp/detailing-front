export function emitCajaChanged() {
  window.dispatchEvent(new Event("caja:changed"))
}