<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { setSession } from '../auth/session'
import logo3byte from '../assets/img/logo3byte.png'

const router = useRouter()

const form = reactive({
  email: '',
  password: '',
  remember: false
})

const loading = ref(false)
const errorMsg = ref('')
const showPassword = ref(false)

onMounted(() => {
  const savedEmail = localStorage.getItem('remember_email')
  if (savedEmail) {
    form.email = savedEmail
    form.remember = true
  }
})

function validate() {
  errorMsg.value = ''
  if (!form.email.trim()) return (errorMsg.value = 'Ingresá tu email')
  if (!form.password.trim()) return (errorMsg.value = 'Ingresá tu contraseña')
  if (!form.email.includes('@')) return (errorMsg.value = 'Email inválido')
  if (form.password.length < 6) return (errorMsg.value = 'La contraseña debe tener al menos 6 caracteres')
  return true
}

async function onSubmit() {
  if (!validate()) return

  try {
    loading.value = true

    // ✅ Login simulado (mock)
    await new Promise((r) => setTimeout(r, 500))

    // Recordarme email
    const email = form.email.trim().toLowerCase()
    if (form.remember) localStorage.setItem('remember_email', email)
    else localStorage.removeItem('remember_email')

    // ✅ Mock de roles/turnos para probar:
    // - maniana@demo.com -> CASHIER MAÑANA
    // - tarde@demo.com   -> CASHIER TARDE
    // - admin@demo.com   -> ADMIN
    let role = 'CASHIER'
    let shift = 'MAÑANA'

    if (email.includes('tarde')) shift = 'TARDE'
    if (email.includes('admin')) role = 'ADMIN'

    const session = {
      token: 'mock-token',
      role,        // CASHIER | ADMIN
      shift,       // MAÑANA | TARDE (solo para CASHIER)
      userId: email
    }

    setSession(session)

    // (compatibilidad si te quedó código viejo revisando token)
    localStorage.setItem('token', 'mock-token')

    router.push({ name: 'dashboard' })
  } catch (e) {
    errorMsg.value = 'Error al iniciar sesión'
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

            <div class="password-wrap">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="current-password"
                :disabled="loading"
              />
              <button type="button" class="toggle" @click="showPassword = !showPassword" :disabled="loading">
                {{ showPassword ? 'Ocultar' : 'Ver' }}
              </button>
            </div>
          </div>

          <div class="row-options">
            <label class="remember">
              <input type="checkbox" v-model="form.remember" :disabled="loading" />
              <span>Recordarme</span>
            </label>

            <button type="button" class="linkish" disabled>
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button class="btn-primary" type="submit" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            {{ loading ? 'Entrando…' : 'Entrar' }}
          </button>

          <div class="demo-hint">
            <div class="text-secondary small mb-1">Usuarios demo:</div>
            <div class="small">
              <span class="chip">maniana@demo.com</span>
              <span class="chip">tarde@demo.com</span>
              <span class="chip">admin@demo.com</span>
            </div>
            <div class="text-secondary small mt-1">Contraseña: cualquiera (mín. 6)</div>
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

.login-container {
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
}

.login-card {
  width: 100%;
  border-radius: 16px;
  padding: 22px 20px;
  background: rgba(15, 18, 30, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
}

/* Brand */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.brand-logo {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  object-fit: contain;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px;
}

.product-name {
  font-weight: 800;
  letter-spacing: 0.2px;
  font-size: 1.05rem;
}

.product-sub {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.55);
}

.brand-3byte {
  color: rgba(170, 150, 255, 0.95);
  font-weight: 700;
}

/* Title */
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

/* Alert */
.alert-dark {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 80, 110, 0.12);
  border: 1px solid rgba(255, 80, 110, 0.22);
  color: rgba(255, 210, 220, 0.95);
  margin-bottom: 10px;
}

/* Form */
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
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.92);
  padding: 0 12px;
}

.field input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.field input:focus {
  outline: none;
  border-color: rgba(170, 150, 255, 0.55);
  box-shadow: 0 0 0 4px rgba(170, 150, 255, 0.12);
}

.password-wrap {
  position: relative;
}

.toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: rgba(170, 150, 255, 0.95);
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 4px 6px;
}

.row-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  accent-color: rgba(170, 150, 255, 0.95);
}

.linkish {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.85rem;
  cursor: not-allowed;
}

.btn-primary {
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(170, 150, 255, 0.35);
  background: rgba(170, 150, 255, 0.14);
  color: rgba(255, 255, 255, 0.92);
  font-weight: 800;
  letter-spacing: 0.2px;
  cursor: pointer;
  margin-top: 6px;
}

.btn-primary:hover {
  background: rgba(170, 150, 255, 0.20);
}

.btn-primary:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.25);
  border-top-color: rgba(255,255,255,0.85);
  border-radius: 999px;
  margin-right: 8px;
  vertical-align: -2px;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.demo-hint{
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.chip {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.05);
  margin-right: 6px;
  margin-top: 6px;
}

.footer {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.85rem;
}

.muted {
  color: rgba(255,255,255,0.45);
}

@media (max-width: 420px) {
  .login-bg { padding: 16px; }
  .login-card { padding: 18px 16px; }
}
</style>
