<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { getSession } from "../auth/session"
import { usuariosApi } from "../services/usuariosService"

const session = getSession() ?? null

const perms = computed(() => session?.permissions || [])
const canView = computed(() => perms.value.includes("admin:all") || perms.value.includes("usuarios:ver"))
const canManage = computed(() => perms.value.includes("admin:all") || perms.value.includes("usuarios:gestionar"))

const loading = ref(false)
const error = ref("")
const success = ref("")
const usuarios = ref([])

const modalOpen = ref(false)

const form = reactive({
  name: "",
  email: "",
  password: "",
  role: "EMPLEADO", // ADMIN | EMPLEADO
  shift: "MANIANA", // opcional (si todavía no lo guardás, lo ignoramos)
})

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase()
}

function resetAlerts() {
  error.value = ""
  success.value = ""
}

function resetForm() {
  form.name = ""
  form.email = ""
  form.password = ""
  form.role = "EMPLEADO"
  form.shift = "MANIANA"
}

async function fetchUsuarios() {
  if (!canView.value) return
  loading.value = true
  resetAlerts()
  try {
    const { data } = await usuariosApi.list()
    usuarios.value = Array.isArray(data) ? data : (Array.isArray(data?.content) ? data.content : [])
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "No se pudieron cargar los usuarios"
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetAlerts()
  resetForm()
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

function validateForm() {
  resetAlerts()
  if (!String(form.name || "").trim()) return (error.value = "Ingresá nombre"), false
  const email = normalizeEmail(form.email)
  if (!email) return (error.value = "Ingresá email"), false
  if (!email.includes("@")) return (error.value = "Email inválido"), false
  if (!String(form.password || "").trim()) return (error.value = "Ingresá contraseña"), false
  if (!["ADMIN", "EMPLEADO"].includes(String(form.role))) return (error.value = "Rol inválido"), false
  return true
}

async function createUsuario() {
  if (!canManage.value) {
    error.value = "Sin permiso para gestionar usuarios"
    return
  }
  if (!validateForm()) return

  loading.value = true
  resetAlerts()

  try {
    const payload = {
      name: String(form.name).trim(),
      email: normalizeEmail(form.email),
      password: String(form.password),
      roles: [String(form.role)], // ✅ back: roles: ["ADMIN"] o ["EMPLEADO"]
      // shift: form.shift, // solo si tu back lo soporta
    }

    await usuariosApi.create(payload)

    success.value = "Usuario creado correctamente"
    closeModal()
    await fetchUsuarios()
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "No se pudo crear el usuario"
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsuarios)
</script>

<template>
  <div class="container py-4">
    <div class="d-flex flex-wrap gap-2 align-items-end justify-content-between mb-3">
      <div>
        <h1 class="h4 mb-1">Usuarios</h1>
        <div class="text-secondary">Crear y administrar usuarios del sistema.</div>
      </div>

      <div class="d-flex gap-2">
        <button class="btn btn-outline-light" @click="fetchUsuarios" :disabled="loading || !canView">
          {{ loading ? "Actualizando..." : "Refresh" }}
        </button>
        <button class="btn btn-accent" @click="openCreate" :disabled="loading || !canManage">
          + Nuevo usuario
        </button>
      </div>
    </div>

    <div v-if="!canView" class="alert alert-warning py-2">
      No tenés permisos para ver usuarios.
    </div>

    <div v-else>
      <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
      <div v-if="success" class="alert alert-success py-2">{{ success }}</div>

      <div class="card bg-panel border-0 shadow-sm">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style="width: 80px">ID</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th style="width: 160px">Roles</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in usuarios" :key="u.userId ?? u.id">
                  <td class="text-secondary">{{ u.userId ?? u.id }}</td>
                  <td>{{ u.name ?? u.nombre ?? "-" }}</td>
                  <td class="text-secondary">{{ u.email }}</td>
                  <td>
                    <span
                      v-for="r in (u.roles || [])"
                      :key="r"
                      class="badge rounded-pill bg-secondary me-1"
                    >
                      {{ r }}
                    </span>
                    <span v-if="!u.roles || !u.roles.length" class="text-secondary">-</span>
                  </td>
                </tr>

                <tr v-if="usuarios.length === 0">
                  <td colspan="4" class="text-secondary">No hay usuarios para mostrar.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="text-secondary small mt-2">
            Para crear/editar usuarios necesitás <b>usuarios:gestionar</b>.
          </div>
        </div>
      </div>
    </div>

    <!-- Modal simple (sin Bootstrap JS) -->
    <div v-if="modalOpen" class="modal-backdrop">
      <div class="modal-card">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <div class="fw-bold">Nuevo usuario</div>
          <button class="btn btn-sm btn-outline-light" @click="closeModal" :disabled="loading">X</button>
        </div>

        <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

        <div class="mb-2">
          <label class="form-label text-secondary small">Nombre</label>
          <input class="form-control bg-dark text-white border-0" v-model="form.name" :disabled="loading" />
        </div>

        <div class="mb-2">
          <label class="form-label text-secondary small">Email</label>
          <input class="form-control bg-dark text-white border-0" v-model="form.email" :disabled="loading" />
        </div>

        <div class="mb-2">
          <label class="form-label text-secondary small">Contraseña</label>
          <input class="form-control bg-dark text-white border-0" type="password" v-model="form.password" :disabled="loading" />
        </div>

        <div class="mb-3">
          <label class="form-label text-secondary small">Rol</label>
          <select class="form-select bg-dark text-white border-0" v-model="form.role" :disabled="loading">
            <option value="EMPLEADO">EMPLEADO</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <div class="text-secondary small mt-1">
            EMPLEADO: sin compras/proveedores · ADMIN: todo
          </div>
        </div>

        <div class="d-flex gap-2 justify-content-end">
          <button class="btn btn-outline-light" @click="closeModal" :disabled="loading">Cancelar</button>
          <button class="btn btn-accent" @click="createUsuario" :disabled="loading || !canManage">
            {{ loading ? "Guardando..." : "Crear" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-panel { background: rgba(18, 22, 32, .92); }
.btn-accent {
  border: 1px solid rgba(170, 150, 255, 0.35);
  background: rgba(170, 150, 255, 0.14);
  color: rgba(255, 255, 255, 0.92);
  font-weight: 800;
}
.btn-accent:hover { background: rgba(170, 150, 255, 0.20); }
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  display: grid;
  place-items: center;
  z-index: 2000;
  padding: 16px;
}
.modal-card{
  width: 100%;
  max-width: 520px;
  border-radius: 16px;
  background: rgba(18, 22, 32, .98);
  border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 18px 55px rgba(0,0,0,.45);
  padding: 16px;
}
</style>