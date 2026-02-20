// src/services/authService.js
import { usuariosApi } from "./usuariosService"
import { setSession } from "../auth/session"

const ADMIN_EMAILS = new Set([
  "admin@demo.com",
  "maniana@demo.com", // si querés alguno como admin temporal, agregalo
])

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase()
}

// Modo transición: login por email (sin password real)
export async function login({ email, shift }) {
  const e = normalizeEmail(email)
  if (!e) throw new Error("Ingresá tu email")

  const { data } = await usuariosApi.list()
  const users = Array.isArray(data) ? data : []

  const user = users.find(u => normalizeEmail(u.email) === e)
  if (!user) throw new Error("Usuario no encontrado")

  // ⚠️ Hoy el back NO manda roleId en GET /usuarios. Esto es temporal.
  const isAdmin = ADMIN_EMAILS.has(e)

  const session = {
    userId: user.userId,
    email: user.email,
    name: user.name ?? null,

    // temporal hasta que venga roleId
    roleId: isAdmin ? 1 : 2,
    roleName: isAdmin ? "ADMIN" : "CASHIER",
    role: isAdmin ? "ADMIN" : "CASHIER",

    shift: shift || "MAÑANA",
  }

  setSession(session)
  return session
}

export function logout() {
  localStorage.removeItem("session_v1")
}
