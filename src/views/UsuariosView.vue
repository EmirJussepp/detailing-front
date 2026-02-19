<script setup>
import { computed, ref, onMounted } from "vue"
import { getSession, isAdmin } from "../auth/session"
import { usuariosApi } from "../services/usuariosService"

const session = getSession() ?? null
const admin = computed(() => Boolean(session && isAdmin()))

const loading = ref(false)
const errorMsg = ref("")
const okMsg = ref("")

const items = ref([])

async function load() {
  loading.value = true
  errorMsg.value = ""
  try {
    const { data } = await usuariosApi.list()
    items.value = Array.isArray(data) ? data : []
  } catch (e) {
    errorMsg.value = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Error cargando usuarios"
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Form create
const fName = ref("")
const fEmail = ref("")
const fPassword = ref("")
const fRoleId = ref("1") // por defecto ADMIN (en tu dump: roles tiene id 1)

async function createUser() {
  if (loading.value) return
  errorMsg.value = ""
  okMsg.value = ""

  try {
    if (!admin.value) throw new Error("Solo ADMIN puede crear usuarios.")
    if (!fName.value.trim()) throw new Error("Nombre requerido.")
    if (!fEmail.value.trim()) throw new Error("Email requerido.")
    if (!fPassword.value.trim()) throw new Error("Password requerido.")

    const roleId = Number(fRoleId.value)
    if (!Number.isFinite(roleId) || roleId <= 0) throw new Error("roleId inválido.")

    await usuariosApi.create({
      name: fName.value.trim(),
      email: fEmail.value.trim(),
      password: fPassword.value.trim(),
      roleId,
    })

    okMsg.value = "Usuario creado ✅"
    fName.value = ""
    fEmail.value = ""
    fPassword.value = ""
    fRoleId.value = "1"
    await load()
  } catch (e) {
    errorMsg.value = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Error creando usuario"
  }
}

async function removeUser(u) {
  if (loading.value) return
  errorMsg.value = ""
  okMsg.value = ""

  try {
    if (!admin.value) throw new Error("Solo ADMIN puede eliminar usuarios.")
    const id = Number(u?.userId ?? u?.id)
    if (!Number.isFinite(id) || id <= 0) throw new Error("ID inválido.")
    const ok = confirm(`¿Eliminar usuario #${id}?`)
    if (!ok) return

    await usuariosApi.delete(id)
    okMsg.value = "Usuario eliminado ✅"
    await load()
  } catch (e) {
    errorMsg.value = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Error eliminando usuario"
  }
}

function roleName(roleId) {
  const id = Number(roleId)
  if (id === 1) return "ADMIN"
  if (id === 2) return "CASHIER"
  return `ROLE #${id}`
}
</script>

<template>
  <div class="container py-4">
    <div class="mb-3">
      <h1 class="h4 mb-1">Usuarios</h1>
      <div class="text-secondary">Alta / listado / baja (usa el back real).</div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <div v-if="!admin" class="alert alert-warning py-2">
      Solo ADMIN puede administrar usuarios.
    </div>

    <div v-else class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <h2 class="h6 mb-3">Crear usuario</h2>

        <div class="row g-3">
          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Nombre</label>
            <input v-model="fName" class="form-control bg-dark text-white border-secondary" placeholder="Ej: Juan Pérez" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Email</label>
            <input v-model="fEmail" class="form-control bg-dark text-white border-secondary" placeholder="ej@mail.com" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Password</label>
            <input v-model="fPassword" type="password" class="form-control bg-dark text-white border-secondary" placeholder="••••••" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Role ID</label>
            <select v-model="fRoleId" class="form-select bg-dark text-white border-secondary">
              <option value="1">1 - ADMIN</option>
              <option value="2">2 - CASHIER</option>
            </select>
            <div class="text-secondary small mt-1">
              (Roles CRUD todavía no existe en tu back, esto es por ID.)
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-end mt-3">
          <button class="btn btn-primary btn-accent" @click="createUser" :disabled="loading">
            {{ loading ? "Guardando..." : "Crear usuario" }}
          </button>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h6 mb-0">Listado</h2>
          <button class="btn btn-sm btn-outline-light" @click="load" :disabled="loading">
            {{ loading ? "Cargando..." : "Refrescar" }}
          </button>
        </div>

        <div v-if="loading" class="text-secondary small">Cargando…</div>

        <div v-else-if="!items.length" class="text-secondary small">
          No hay usuarios.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 90px">ID</th>
                <th>Nombre</th>
                <th>Email</th>
                <th style="width: 140px">Role</th>
                <th style="width: 130px" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in items" :key="u.userId ?? u.id">
                <td class="text-secondary">{{ u.userId ?? u.id }}</td>
                <td class="fw-semibold">{{ u.name ?? u.nombre }}</td>
                <td class="text-secondary">{{ u.email }}</td>
                <td class="text-secondary">{{ roleName(u.roleId) }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-danger" @click="removeUser(u)">
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-2">
          ✅ Esto usa tus endpoints reales: <b>GET /users</b> · <b>POST /users</b> · <b>DELETE /users/:id</b>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-panel { background: rgba(18, 22, 32, .92); }
</style>
