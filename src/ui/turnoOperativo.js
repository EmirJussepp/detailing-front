const LS_TURNO = "turno_operativo_v1"

export function getTurnoOperativo() {
  try {
    const t = String(localStorage.getItem(LS_TURNO) || "").toUpperCase()

    if (t === "MANIANA" || t === "MAÑANA") return "MANIANA"
    if (t === "TARDE") return "TARDE"

    return "MANIANA"
  } catch {
    return "MANIANA"
  }
}

export function setTurnoOperativo(turno) {
  try {
    localStorage.setItem(LS_TURNO, turno)
  } catch {}
}