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
const isEditing = ref(false)
const editingId = ref(null)

const form = reactive({
  name: "",
  email: "",
  password: "",
  confirmPassword: "", // ← nuevo
  role: "EMPLEADO",
  shift: "MANIANA",
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
  form.confirmPassword = "" // ← nuevo
  form.role = "EMPLEADO"
  form.shift = "MANIANA"
}
function roleBadgeClass(role) {
  const r = String(role || "").toUpperCase()
  if (r === "ADMIN") return "text-bg-warning"
  if (r === "EMPLEADO") return "text-bg-secondary"
  return "text-bg-dark border border-secondary"
}

function normalizeUsuarios(data) {
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : Array.isArray(data?.items)
        ? data.items
        : []

  return arr.map((u) => ({
    userId: Number(u?.userId ?? u?.id ?? 0),
    name: String(u?.name ?? u?.nombre ?? ""),
    email: String(u?.email ?? ""),
    roles: Array.isArray(u?.roles) ? u.roles : [],
  }))
}

async function fetchUsuarios() {
  if (!canView.value) return

  loading.value = true
  resetAlerts()

  try {
    const { data } = await usuariosApi.list()
    usuarios.value = normalizeUsuarios(data)
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "No se pudieron cargar los usuarios."
  } finally {
    loading.value = false
  }
}

function openCreate() {
  resetAlerts()
  resetForm()
  isEditing.value = false
  editingId.value = null
  modalOpen.value = true
}

function openEdit(u) {
  resetAlerts()
  resetForm()

  isEditing.value = true
  editingId.value = u.userId ?? u.id
  form.name = u.name ?? ""
  form.email = u.email ?? ""
  form.password = ""
  form.role = Array.isArray(u.roles) && u.roles.includes("ADMIN") ? "ADMIN" : "EMPLEADO"

  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  isEditing.value = false
  editingId.value = null
  resetForm()
}

function validateForm() {
  resetAlerts()

  if (!String(form.name || "").trim()) {
    error.value = "Ingresá nombre."
    return false
  }

  const email = normalizeEmail(form.email)

  if (!email) {
    error.value = "Ingresá email."
    return false
  }

  if (!email.includes("@")) {
    error.value = "Email inválido."
    return false
  }

  if (!isEditing.value) {
    if (!String(form.password || "").trim()) {
      error.value = "Ingresá contraseña."
      return false
    }
    if (form.password !== form.confirmPassword) {
      error.value = "Las contraseñas no coinciden."
      return false
    }
  }

  if (isEditing.value && form.password) {
    if (form.password !== form.confirmPassword) {
      error.value = "Las contraseñas no coinciden."
      return false
    }
  }

  if (!["ADMIN", "EMPLEADO"].includes(String(form.role))) {
    error.value = "Rol inválido."
    return false
  }

  return true
}

async function submitUsuario() {
  if (!canManage.value) {
    error.value = "Sin permiso para gestionar usuarios."
    return
  }

  if (!validateForm()) return

  loading.value = true
  resetAlerts()

  try {
    if (isEditing.value) {
      const rawPassword = String(form.password || "").trim()

      const payload = {
        userId: editingId.value,
        name: String(form.name).trim(),
        email: normalizeEmail(form.email),
        password: rawPassword || null,
        roles: [String(form.role)],
      }

      await usuariosApi.update(editingId.value, payload)
      success.value = "Usuario actualizado correctamente."
    } else {
      const payload = {
        name: String(form.name).trim(),
        email: normalizeEmail(form.email),
        password: String(form.password),
        roles: [String(form.role)],
      }

      await usuariosApi.create(payload)
      success.value = "Usuario creado correctamente."
    }

    closeModal()
    await fetchUsuarios()
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "No se pudo guardar el usuario."
  } finally {
    loading.value = false
  }
}

async function removeUsuario(u) {
  if (!canManage.value) {
    error.value = "Sin permiso para gestionar usuarios."
    return
  }

  const id = u.userId ?? u.id
  const nombre = u.name ?? "usuario"

  if (!confirm(`Eliminar "${nombre}"?`)) return

  loading.value = true
  resetAlerts()

  try {
    await usuariosApi.delete(id)
    success.value = "Usuario eliminado correctamente."
    await fetchUsuarios()
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "No se pudo eliminar el usuario."
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsuarios)
</script>

<template>
  <div class="usuarios-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Configuración</p>
        <h1 class="page-title mb-1">Usuarios</h1>
        <p class="page-subtitle mb-0">
          Crear, editar y administrar usuarios del sistema.
        </p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="fetchUsuarios" :disabled="loading || !canView">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>

        <button class="btn btn-primary btn-accent" @click="openCreate" :disabled="loading || !canManage">
          Nuevo usuario
        </button>
      </div>
    </section>

    <div v-if="!canView" class="alert alert-warning py-2 mb-3">
      No tenés permisos para ver usuarios.
    </div>

    <template v-else>
      <div v-if="error" class="alert alert-danger py-2 mb-3">{{ error }}</div>
      <div v-if="success" class="alert alert-success py-2 mb-3">{{ success }}</div>

      <div class="card bg-panel border-0 shadow-sm">
        <div class="card-body">
          <div class="section-header mb-3">
            <h2 class="section-title mb-0">Resultados</h2>
            <div class="helper-text">
              Total: <b>{{ usuarios.length }}</b> usuario(s)
            </div>
          </div>

          <div v-if="loading" class="helper-text">Cargando...</div>

          <div v-else-if="usuarios.length === 0" class="empty-block">
            <div class="empty-title">No hay usuarios para mostrar</div>
            <div class="helper-text">
              Creá un usuario nuevo para comenzar.
            </div>
          </div>

          <div v-else class="table-responsive">
            <table class="table table-dark table-hover align-middle app-table mb-0">
              <thead>
                <tr>
                  <th style="width: 90px">Usuario</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th style="width: 180px">Roles</th>
                  <th class="text-end" style="width: 220px">Acciones</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="u in usuarios" :key="u.userId">
                  <td class="text-secondary">#{{ u.userId }}</td>

                  <td>
                    <div class="table-main">{{ u.name || "—" }}</div>
                  </td>

                  <td class="text-secondary">{{ u.email || "—" }}</td>

                  <td>
                    <template v-if="u.roles && u.roles.length">
                      <span v-for="r in u.roles" :key="r" class="badge rounded-pill me-1" :class="roleBadgeClass(r)">
                        {{ r }}
                      </span>
                    </template>

                    <span v-else class="text-secondary">—</span>
                  </td>

                  <td class="text-end">
                    <div class="d-flex justify-content-end gap-2 flex-wrap">
                      <button class="btn btn-sm btn-outline-light" @click="openEdit(u)"
                        :disabled="loading || !canManage">
                        Editar
                      </button>

                      <button class="btn btn-sm btn-outline-danger" @click="removeUsuario(u)"
                        :disabled="loading || !canManage">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="helper-text mt-3">
            Para crear, editar o eliminar usuarios necesitás el permiso <b>usuarios:gestionar</b>.
          </div>
        </div>
      </div>
    </template>

    <div v-if="modalOpen" class="modal-backdrop-custom" @click.self="closeModal">
      <div class="modal-custom">
        <div class="section-header mb-3">
          <div>
            <div class="section-title">
              {{ isEditing ? "Editar usuario" : "Nuevo usuario" }}
            </div>
            <div class="helper-text">
              Completá los datos básicos del usuario.
            </div>
          </div>

          <button class="btn btn-sm btn-outline-light" @click="closeModal" :disabled="loading">
            Cerrar
          </button>
        </div>

        <div v-if="error" class="alert alert-danger py-2 mb-3">{{ error }}</div>

        <div class="row g-3">
          <div class="col-12">
            <label class="form-label field-label">Nombre</label>
            <input class="form-control app-input" v-model="form.name" :disabled="loading" />
          </div>

          <div class="col-12">
            <label class="form-label field-label">Email</label>
            <input class="form-control app-input" v-model="form.email" :disabled="loading" />
          </div>

          <div class="col-12">
            <label class="form-label field-label">
              {{ isEditing ? "Nueva contraseña (opcional)" : "Contraseña" }}
            </label>
            <input class="form-control app-input" type="password" v-model="form.password" :disabled="loading" />
          </div>

          <!-- ← nuevo campo -->
          <div class="col-12">
            <label class="form-label field-label">
              {{ isEditing ? "Repetir nueva contraseña" : "Repetir contraseña" }}
            </label>
            <input class="form-control app-input" type="password" v-model="form.confirmPassword" :disabled="loading"
              :placeholder="isEditing ? 'Solo si cambiás la contraseña' : ''" />
          </div>

          <div class="col-12">
            <label class="form-label field-label">Rol</label>
            <select class="form-select app-input" v-model="form.role" :disabled="loading">
              <option value="EMPLEADO">EMPLEADO</option>
              <option value="ADMIN">ADMIN</option>
            </select>

            <div class="helper-text mt-2">
              EMPLEADO: operación general · ADMIN: acceso completo.
            </div>
          </div>
        </div>

        <div class="d-flex gap-2 justify-content-end mt-4">
          <button class="btn btn-outline-light" @click="closeModal" :disabled="loading">
            Cancelar
          </button>

          <button class="btn btn-primary btn-accent" @click="submitUsuario" :disabled="loading || !canManage">
            {{ loading ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.usuarios-page {
  min-height: 100%;
}

.table-main {
  color: #fff;
  font-weight: 600;
}

.empty-block {
  padding: 14px 0;
}

.empty-title {
  color: #fff;
  font-weight: 700;
  margin-bottom: 4px;
}

.modal-backdrop-custom {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .55);
  display: grid;
  place-items: center;
  z-index: 2000;
  padding: 16px;
}

.modal-custom {
  width: 100%;
  max-width: 520px;
  border-radius: 18px;
  background: rgba(18, 22, 32, .98);
  border: 1px solid rgba(255, 255, 255, .10);
  box-shadow: 0 18px 55px rgba(0, 0, 0, .45);
  padding: 18px;
  color: #fff;
}
</style>