<script setup>
import { reactive, ref, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { setSession } from "../auth/session"
import { usuariosApi } from "../services/usuariosService"
import { tenant } from "../tenant.config"
import { decodeJwt } from "../auth/jwt"

const router = useRouter()
const route  = useRoute()

const form = reactive({
  email:    "",
  password: "",
  remember: false
})

const loading  = ref(false)
const errorMsg = ref("")

onMounted(() => {
  const savedEmail = localStorage.getItem("remember_email")
  if (savedEmail) {
    form.email    = savedEmail
    form.remember = true
  }
})

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase()
}

function validate() {
  errorMsg.value = ""
  const email = normalizeEmail(form.email)

  if (!email)              { errorMsg.value = "Ingresá tu email";       return false }
  if (!email.includes("@")){ errorMsg.value = "Email inválido";         return false }
  if (!String(form.password || "").trim()) {
    errorMsg.value = "Ingresá tu contraseña"
    return false
  }
  return true
}

async function onSubmit() {
  if (!validate()) return

  loading.value  = true
  errorMsg.value = ""

  try {
    const email = normalizeEmail(form.email)

    if (form.remember) {
      localStorage.setItem("remember_email", email)
    } else {
      localStorage.removeItem("remember_email")
    }

    const { data } = await usuariosApi.login({ email, password: form.password })

    const token = data?.token
    if (!token) throw new Error("Token no recibido")

    const payload     = decodeJwt(token) || {}
    const userId      = Number(payload?.userId ?? payload?.id ?? 0) || null
    const permissions = Array.isArray(payload?.permissions) ? payload.permissions : []
    const isAdmin     = permissions.includes("admin:all") || permissions.includes("usuarios:gestionar")
    const roleName    = isAdmin ? "ADMIN" : "EMPLEADO"

    setSession({ token, userId, email, role: roleName, permissions })

    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : null
    router.replace(redirect || { name: "dashboard" })

  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error   ||
      e?.response?.data?.message ||
      e?.message                 ||
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

        <div class="brand">
          <div class="brand-logo-wrap">
            <img class="brand-logo" :src="tenant.logo" :alt="tenant.nombre" />
          </div>
          <div class="brand-text">
            <div class="product-name">{{ tenant.nombre }}</div>
            <div class="product-sub">{{ tenant.rubro }}</div>
            <div class="product-powered">{{ tenant.developer.texto }}</div>
          </div>
        </div>

        <div class="title">
          <h1>{{ tenant.textos.loginTitulo }}</h1>
          <p>{{ tenant.textos.loginSub }}</p>
        </div>

        <div v-if="errorMsg" class="alert-dark">
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
            <input
              v-model="form.password"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
              :disabled="loading"
            />
          </div>

          <div class="row-options">
            <label class="remember">
              <input
                type="checkbox"
                v-model="form.remember"
                :disabled="loading"
              />
              <span>Recordarme</span>
            </label>
          </div>

          <button class="btn-primary" type="submit" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            {{ loading ? "Entrando…" : "Entrar" }}
          </button>

        </form>

        <div class="footer">
          <span class="chip">v1</span>
          <span class="muted">{{ tenant.developer.texto }}</span>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
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
  background: #0b0804;
  color: rgba(255, 255, 255, 0.92);
}

.login-container {
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
}

.login-card {
  width: 100%;
  border-radius: 6px;
  padding: 24px 22px;
  background: #111009;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-top: 1px solid rgba(201, 162, 39, 0.20);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.60);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.brand-logo-wrap {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(201, 162, 39, 0.28);
}

.brand-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-name {
  font-weight: 900;
  letter-spacing: 0.2px;
  font-size: 1.05rem;
  color: #fff;
}

.product-sub {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 1px;
}

.product-powered {
  font-size: 0.8rem;
  color: rgba(201, 162, 39, 0.75);
  font-weight: 600;
  margin-top: 2px;
}

.title h1 {
  margin: 6px 0 2px;
  font-size: 1.25rem;
  font-weight: 800;
}

.title p {
  margin: 0 0 12px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.95rem;
}

.alert-dark {
  padding: 10px 12px;
  border-radius: 4px;
  background: rgba(255, 80, 110, 0.10);
  border: 1px solid rgba(255, 80, 110, 0.22);
  border-left: 3px solid rgba(255, 80, 110, 0.60);
  color: rgba(255, 210, 220, 0.95);
  font-size: 0.88rem;
  margin-bottom: 10px;
}

.form {
  display: grid;
  gap: 12px;
}

.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.62);
}

.field input {
  width: 100%;
  height: 42px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.92);
  padding: 0 12px;
  font-family: inherit;
}

.field input::placeholder {
  color: rgba(255, 255, 255, 0.30);
}

.field input:focus {
  outline: none;
  border-color: rgba(201, 162, 39, 0.55);
  box-shadow: 0 0 0 4px rgba(201, 162, 39, 0.10);
}

.row-options {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  margin-top: 2px;
}

.remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.62);
}

.remember input {
  accent-color: #c9a227;
}

.btn-primary {
  height: 42px;
  border-radius: 6px;
  border: 1px solid rgba(201, 162, 39, 0.50);
  background: rgba(201, 162, 39, 0.16);
  color: rgba(255, 255, 255, 0.95);
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  cursor: pointer;
  margin-top: 6px;
  font-family: inherit;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.btn-primary:hover {
  background: rgba(201, 162, 39, 0.28);
  border-color: rgba(201, 162, 39, 0.70);
}

.btn-primary:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: rgba(255, 255, 255, 0.85);
  border-radius: 999px;
  margin-right: 8px;
  vertical-align: -2px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.chip {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  font-size: 0.78rem;
  margin-right: 6px;
  margin-top: 6px;
}

.footer {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.40);
  font-size: 0.85rem;
}

.muted {
  color: rgba(201, 162, 39, 0.55);
}

@media (max-width: 420px) {
  .login-bg   { padding: 16px; }
  .login-card { padding: 18px 16px; }
}
</style>