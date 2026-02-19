const LS_KEY = "session_v2"

export function setSession(session) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(session))
  } catch {}
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "null")
  } catch {
    return null
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {}
}

export function isAdmin() {
  const s = getSession()
  const roleId = Number(s?.roleId ?? 0)
  const roleName = String(s?.roleName ?? "").toUpperCase()
  return roleId === 1 || roleName === "ADMIN"
}

export function getShift() {
  const s = getSession()
  const t = String(s?.shift ?? "").toUpperCase()
  // tu back usa MANIANA/TARDE
  if (t === "MANIANA" || t === "MAÑANA") return "MANIANA"
  if (t === "TARDE") return "TARDE"
  return "MANIANA"
}
