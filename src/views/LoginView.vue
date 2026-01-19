<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

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
  return true
}

async function onSubmit() {
  if (!validate()) return

  try {
    loading.value = true
    await new Promise((r) => setTimeout(r, 600))

    if (form.remember) localStorage.setItem('remember_email', form.email)
    else localStorage.removeItem('remember_email')

    localStorage.setItem('token', 'mock-token')
    router.push({ name: 'home' })
  } catch (e) {
    errorMsg.value = 'Error al iniciar sesión'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-bg">
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>

    <div class="login-container">
      <div class="login-card">
        <!-- Brand -->
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">3B</div>
          <div class="brand-text">
            <div class="product-name">GestionaTuNegocio</div>
            <div class="product-sub">by <span class="brand-3byte">3Byte</span></div>
          </div>
        </div>

        <div class="title">
          <h1>Iniciar sesión</h1>
          <p>Ingresá para acceder al panel.</p>
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
              />
              <button
                type="button"
                class="toggle"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? 'Ocultar' : 'Ver' }}
              </button>
            </div>
          </div>

          <div class="row-options">
            <label class="remember">
              <input type="checkbox" v-model="form.remember" />
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
        </form>

        <div class="footer">
          <span class="chip">v1</span>
          <span class="muted">UI Dark Purple</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Full-bleed: evita bordes blancos */
.login-bg {
  position: fixed;
  inset: 0;
  width: 100vw;
  min-height: 100vh;
  margin: 0;
  padding: 24px;
  overflow: hidden;


  display: grid;
  place-items: center;

  overflow: auto; /* por si en móvil necesita scroll */
  background:
  radial-gradient(900px 500px at 20% 10%, rgba(120, 92, 255, 0.18), transparent 60%),
  radial-gradient(900px 500px at 85% 80%, rgba(38, 208, 255, 0.10), transparent 62%),
  linear-gradient(180deg, #0b0f1a 0%, #070a12 45%, #06040b 100%);

  color: #f2eefe;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}
.login-container {
  width: 100%;
  max-width: 420px;
}



/* Glows */
.glow {
  position: absolute;
  filter: blur(60px);
  opacity: 0.35;
  pointer-events: none;
}
.glow-1 {
  width: 520px;
  height: 520px;
  left: -140px;
  top: -140px;
  background: #9b51e0;
}
.glow-2 {
  width: 560px;
  height: 560px;
  right: -160px;
  bottom: -160px;
  background: #5f4dff;
}

/* Container responsive */
.login-container {
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
}

/* Card */
.login-card {
  width: 100%;
  border-radius: 16px;
  padding: 22px 20px;
  background: rgba(12, 9, 20, 0.72);
  border: 1px solid rgba(155, 81, 224, 0.18);
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(10px);
}

/* Brand */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 800;
  letter-spacing: 0.6px;
  background: linear-gradient(135deg, rgba(155, 81, 224, 0.95), rgba(95, 77, 255, 0.92));
  box-shadow: 0 10px 24px rgba(155, 81, 224, 0.22);
}
.product-name {
  font-weight: 800;
  letter-spacing: 0.2px;
  font-size: 1.05rem;
}
.product-sub {
  font-size: 0.85rem;
  color: rgba(242, 238, 254, 0.62);
}
.brand-3byte {
  color: rgba(202, 168, 255, 0.95);
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
  color: rgba(242, 238, 254, 0.6);
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
  color: rgba(242, 238, 254, 0.68);
}
.field input {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(242, 238, 254, 0.95);
  padding: 0 12px;
}
.field input::placeholder {
  color: rgba(242, 238, 254, 0.35);
}
.field input:focus {
  outline: none;
  border-color: rgba(155, 81, 224, 0.55);
  box-shadow: 0 0 0 4px rgba(155, 81, 224, 0.14);
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
  color: rgba(202, 168, 255, 0.95);
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
}
.toggle:hover {
  color: rgba(155, 81, 224, 1);
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
  color: rgba(242, 238, 254, 0.70);
}
.remember input {
  accent-color: #9b51e0;
}
.linkish {
  border: none;
  background: transparent;
  color: rgba(242, 238, 254, 0.35);
  font-size: 0.85rem;
  cursor: not-allowed;
}

/* Button */
.btn-primary {
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(120, 92, 255, 0.35);
  background: linear-gradient(135deg, rgba(120, 92, 255, 0.92), rgba(85, 77, 190, 0.92));
  color: white;
  font-weight: 800;
  letter-spacing: 0.2px;
  cursor: pointer;
  margin-top: 6px;
}

.btn-primary:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

/* Spinner simple */
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: rgba(255,255,255,0.95);
  border-radius: 999px;
  margin-right: 8px;
  vertical-align: -2px;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Footer */
.footer {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgba(242, 238, 254, 0.45);
  font-size: 0.85rem;
}
.chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.05);
}

/* Responsive: en pantallas chicas se ajusta solo */
@media (max-width: 420px) {
  .login-bg { padding: 16px; }
  .login-card { padding: 18px 16px; }
}
</style>
