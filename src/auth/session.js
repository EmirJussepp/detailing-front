export function getSession() {
  try {
    const raw = localStorage.getItem("session")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession(session) {
  localStorage.setItem("session", JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem("session")
  localStorage.removeItem("token")
}

export function isAdmin() {
  return getSession()?.role === "ADMIN"
}

export function getShift() {
  return getSession()?.shift // 'MAÑANA' | 'TARDE'
}
