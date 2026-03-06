<script setup>
import { reactive, ref, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { setSession } from "../auth/session"
import { usuariosApi } from "../services/usuariosService"
import logo3byte from "../assets/img/logo3byte.png"
import { decodeJwt } from "../auth/jwt"

const router = useRouter()
const route = useRoute()

const form = reactive({
  email: "",
  password: "",        // ✅ AGREGADO
  remember: false,
  shift: "MAÑANA",
})

const loading = ref(false)
const errorMsg = ref("")

onMounted(() => {
  const savedEmail = localStorage.getItem("remember_email")
  if (savedEmail) {
    form.email = savedEmail
    form.remember = true
  }
})

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase()
}
function normalizeShift(v) {
  const t = String(v || "").toUpperCase()
  if (t === "MAÑANA" || t === "MANIANA") return "MANIANA"
  if (t === "TARDE") return "TARDE"
  return "MANIANA"
}

function validate() {
  errorMsg.value = ""
  const email = normalizeEmail(form.email)
  if (!email) return (errorMsg.value = "Ingresá tu email"), false
  if (!email.includes("@")) return (errorMsg.value = "Email inválido"), false

  // si estás usando login real, pedimos password
  if (!String(form.password || "").trim()) return (errorMsg.value = "Ingresá tu contraseña"), false
  return true
}

// Aliases demo -> emails reales
const ALIASES = {
  "maniana@demo.com": "juan.perez@example.com",
  "tarde@demo.com": "juan.montiel@example.com",
  "admin@demo.com": "juan.perez@example.com",
}

// fallback admin por email (solo si el back NO trae roles)
const ADMIN_EMAILS = new Set(["juan.perez@example.com"])

function toUpperRole(x) {
  return String(x || "").trim().toUpperCase()
}

function normalizeUser(u) {
  const userId = Number(u?.userId ?? u?.id ?? 0)
  const rolesFromArray = Array.isArray(u?.roles) ? u.roles.map(toUpperRole).filter(Boolean) : []

  const roleName = toUpperRole(u?.roleName ?? u?.role_name ?? "")
  const roleId = Number(u?.roleId ?? u?.role_id ?? 0) || null

  let roles = rolesFromArray
  if (!roles.length && roleName) roles = [roleName]
  if (!roles.length && roleId === 1) roles = ["ADMIN"]
  if (!roles.length && roleId === 2) roles = ["CASHIER"]

  return {
    userId,
    name: u?.name ?? u?.nombre ?? null,
    email: normalizeEmail(u?.email),
    roleId,
    roleName: roleName || null,
    roles,
  }
}

function resolveRoles(user) {
  if (Array.isArray(user?.roles) && user.roles.length) return user.roles
  if (ADMIN_EMAILS.has(user.email)) return ["ADMIN"]
  return ["CASHIER"]
}

async function onSubmit() {
  if (!validate()) return

  loading.value = true
  errorMsg.value = ""

  try {
    const rawEmail = normalizeEmail(form.email)
    const email = normalizeEmail(ALIASES[rawEmail] ?? rawEmail)

    // remember email
    if (form.remember) localStorage.setItem("remember_email", rawEmail)
    else localStorage.removeItem("remember_email")

    // =========================
    // ✅ LOGIN REAL (JWT)
    // =========================
    try {
  const { data: loginResp } = await usuariosApi.login({ email, password: form.password })
  const token = loginResp?.token
  if (!token) throw new Error("Token no recibido")

      const payload = decodeJwt(token) || {}
const permissions = Array.isArray(payload?.permissions) ? payload.permissions : []
console.log("JWT payload:", payload)
console.log("JWT permissions:", permissions)
      const userId = Number(payload?.userId ?? payload?.id ?? 0) || null
      

      // Rol virtual (solo para UI). La verdad está en permissions.
      const isAdmin =
        permissions.includes("admin:all") ||
        permissions.includes("usuarios:gestionar") // buen proxy de admin

      const roleName = isAdmin ? "ADMIN" : "EMPLEADO"
      const roleId = isAdmin ? 1 : 2
      const roles = [roleName]

      setSession({
        token,
        userId,
        email,

        roles,
        roleName,
        roleId,
        role: roleName,

        permissions,
        shift: normalizeShift(form.shift),
      })

      const redirect = typeof route.query.redirect === "string" ? route.query.redirect : null
      router.replace(redirect || { name: "dashboard" })
      return
    } catch (eLoginReal) {
  errorMsg.value =
    eLoginReal?.response?.data?.error ||
    eLoginReal?.response?.data?.message ||
    eLoginReal?.message ||
    "Error en login"
  return
}
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error en login"
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-bg">
    <div class="login-container">
      <div class="login-card">
        <!-- Brand -->
        <div class="brand">
          <img class="brand-logo" :src="logo3byte" alt="3Byte" />
          <div class="brand-text">
            <div class="product-name">GestionaTuNegocio</div>
            <div class="product-sub">Powered by <span class="brand-3byte">3Byte</span></div>
          </div>
        </div>

        <div class="title">
          <h1>Iniciar sesión</h1>
          <p>Accedé al panel de gestión.</p>
        </div>

        <div v-if="errorMsg" class="alert-dark" role="alert">
          {{ errorMsg }}
        </div>

        <form @submit.prevent="onSubmit" class="form">
          <div class="field">
            <label>Email</label>
            <input
              v-model="form.email"
              type="email"
              placeholder="tu@email.com"
              autocomplete="email"
              :disabled="loading"
            />
          </div>
          <div class="field">
  <label>Contraseña</label>
  <input v-model="form.password" type="password" placeholder="••••••••" :disabled="loading" />
</div>

          <div class="row-options">
            <label class="remember">
              <input type="checkbox" v-model="form.remember" :disabled="loading" />
              <span>Recordarme</span>
            </label>

            <button type="button" class="linkish" disabled>¿Olvidaste tu contraseña?</button>
          </div>

          <button class="btn-primary" type="submit" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            {{ loading ? "Entrando…" : "Entrar" }}
          </button>

          <div class="demo-hint">
            <div class="text-secondary small mb-1">Tip:</div>
            <div class="text-secondary small">
              Ingresá un email que exista en tu tabla <b>usuarios</b>.
              (Opcional: <span class="chip">maniana@demo.com</span> <span class="chip">tarde@demo.com</span>)
            </div>
          </div>
        </form>

        <div class="footer">
          <span class="chip">v1</span>
          <span class="muted">UI Dark • 3Byte</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Tu mismo CSS (no lo toco) */
.login-bg {
  position: fixed;
  inset: 0;
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 24px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(900px 520px at 15% 10%, rgba(120, 92, 255, 0.10), transparent 60%),
    radial-gradient(900px 520px at 90% 85%, rgba(120, 92, 255, 0.07), transparent 62%),
    linear-gradient(180deg, #0e1117 0%, #0b0e14 100%);
  color: rgba(255, 255, 255, 0.92);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}
.login-container { width: 100%; max-width: 420px; position: relative; z-index: 1; }
.login-card {
  width: 100%;
  border-radius: 16px;
  padding: 22px 20px;
  background: rgba(15, 18, 30, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
}
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.brand-logo {
  width: 46px; height: 46px; border-radius: 12px; object-fit: contain;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px;
}
.product-name { font-weight: 800; letter-spacing: 0.2px; font-size: 1.05rem; }
.product-sub { font-size: 0.85rem; color: rgba(255, 255, 255, 0.55); }
.brand-3byte { color: rgba(170, 150, 255, 0.95); font-weight: 700; }
.title h1 { margin: 6px 0 2px; font-size: 1.25rem; font-weight: 800; }
.title p { margin: 0 0 12px; color: rgba(255, 255, 255, 0.55); font-size: 0.95rem; }
.alert-dark {
  padding: 10px 12px; border-radius: 12px;
  background: rgba(255, 80, 110, 0.12);
  border: 1px solid rgba(255, 80, 110, 0.22);
  color: rgba(255, 210, 220, 0.95);
  margin-bottom: 10px;
}
.form { display: grid; gap: 12px; }
.field label { display: block; margin-bottom: 6px; font-size: 0.8rem; color: rgba(255, 255, 255, 0.62); }
.field input {
  width: 100%; height: 44px; border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.92);
  padding: 0 12px;
}
.field input::placeholder { color: rgba(255, 255, 255, 0.35); }
.field input:focus {
  outline: none;
  border-color: rgba(170, 150, 255, 0.55);
  box-shadow: 0 0 0 4px rgba(170, 150, 255, 0.12);
}
.row-options { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 2px; }
.remember { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: rgba(255, 255, 255, 0.62); }
.remember input { accent-color: rgba(170, 150, 255, 0.95); }
.linkish { border: none; background: transparent; color: rgba(255, 255, 255, 0.35); font-size: 0.85rem; cursor: not-allowed; }
.btn-primary {
  height: 44px; border-radius: 12px;
  border: 1px solid rgba(170, 150, 255, 0.35);
  background: rgba(170, 150, 255, 0.14);
  color: rgba(255, 255, 255, 0.92);
  font-weight: 800; letter-spacing: 0.2px;
  cursor: pointer; margin-top: 6px;
}
.btn-primary:hover { background: rgba(170, 150, 255, 0.20); }
.btn-primary:disabled { opacity: 0.75; cursor: not-allowed; }
.spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.25);
  border-top-color: rgba(255,255,255,0.85);
  border-radius: 999px;
  margin-right: 8px; vertical-align: -2px;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.demo-hint { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); }
.chip {
  display: inline-block; padding: 4px 10px; border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.05);
  margin-right: 6px; margin-top: 6px;
}
.footer { margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; color: rgba(255, 255, 255, 0.45); font-size: 0.85rem; }
.muted { color: rgba(255,255,255,0.45); }
@media (max-width: 420px) {
  .login-bg { padding: 16px; }
  .login-card { padding: 18px 16px; }
}
</style>
