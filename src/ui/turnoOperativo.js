const KEY = "turno_operativo"

export function getTurnoOperativo() {
  const raw = localStorage.getItem(KEY)
  if (raw === "MANIANA" || raw === "TARDE") return raw
  return "MANIANA"
}

export function setTurnoOperativo(turno) {
  const value = turno === "TARDE" ? "TARDE" : "MANIANA"
  localStorage.setItem(KEY, value)
  window.dispatchEvent(
    new CustomEvent("turno:changed", {
      detail: { turno: value },
    })
  )
}

export function turnoLabel(turno) {
  return turno === "TARDE" ? "TARDE" : "MAÑANA"
}