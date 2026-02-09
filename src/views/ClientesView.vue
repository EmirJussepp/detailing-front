<script setup>
import { onMounted, ref, computed } from "vue"
import { clientesApi } from "../services/clientesService"
import { tipoClientesApi } from "../services/tipoClienteService"
import { localidadesApi } from "../services/localidadService"


const items = ref([])
const tipos = ref([])
const localidades = ref([])

const loading = ref(false)
const saving = ref(false)
const error = ref("")
const ok = ref("")

const nombre = ref("")
const apellido = ref("")
const dni = ref("")
const telefono = ref("")
const email = ref("")
const localidadId = ref("")     // "" = null
const tipoClienteId = ref("")   // requerido

function mapCliente(c) {
  return {
    id: Number(c.clienteId ?? c.id),
    nombre: c.nombre ?? "",
    apellido: c.apellido ?? null,
    dni: c.dni ?? null,
    telefono: c.telefono ?? null,
    email: c.email ?? null,
    localidadId: c.localidadId ?? null,
    tipoClienteId: c.tipoClienteId ?? null,
    activo: c.activo ?? true,
  }
}

function mapTipo(t) {
  return { id: Number(t.tipoClienteId ?? t.id), name: t.name ?? "", descripcion: t.descripcion ?? null }
}

function mapLoc(l) {
  return { id: Number(l.localidadId ?? l.id), nombre: l.nombre ?? l.name ?? "" }
}

const tipoById = computed(() => {
  const m = new Map()
  tipos.value.forEach(t => m.set(String(t.id), t))
  return m
})

const locById = computed(() => {
  const m = new Map()
  localidades.value.forEach(l => m.set(String(l.id), l))
  return m
})

const activos = computed(() => items.value.filter(c => c.activo !== false))

async function fetchMaestros() {
  // Tipos
  try {
    const { data } = await tipoClientesApi.list()
    const arr = Array.isArray(data) ? data : []
    tipos.value = arr.map(mapTipo)
  } catch {
    tipos.value = []
  }

  // Localidades
  try {
    const { data } = await localidadesApi.list()
    const arr = Array.isArray(data) ? data : []
    localidades.value = arr.map(mapLoc)
  } catch {
    localidades.value = []
  }
}

async function fetchAll() {
  loading.value = true
  error.value = ""
  try {
    const { data } = await clientesApi.list()
    const arr = Array.isArray(data) ? data : []
    items.value = arr.map(mapCliente)
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error cargando clientes"
  } finally {
    loading.value = false
  }
}

function resetForm() {
  nombre.value = ""
  apellido.value = ""
  dni.value = ""
  telefono.value = ""
  email.value = ""
  localidadId.value = ""
  // tipoClienteId lo dejamos como estaba (más cómodo)
}

async function create() {
  if (saving.value) return
  saving.value = true
  error.value = ""
  ok.value = ""

  try {
    const payload = {
      nombre: nombre.value.trim(),
      apellido: apellido.value.trim() || null,
      dni: dni.value.trim(),
      telefono: telefono.value.trim() || null,
      email: email.value.trim() || null,
      localidadId: localidadId.value ? Number(localidadId.value) : null,
      tipoClienteId: tipoClienteId.value ? Number(tipoClienteId.value) : null,
    }

    if (!payload.nombre) throw new Error("Ingresá el nombre.")
    if (!payload.dni) throw new Error("Ingresá el DNI.")
    if (!payload.tipoClienteId) throw new Error("Seleccioná el tipo de cliente.")

    await clientesApi.create(payload)

    ok.value = "Cliente creado ✅"
    resetForm()
    await fetchAll()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error creando cliente"
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await fetchMaestros()
  // default tipo si hay
  if (!tipoClienteId.value && tipos.value.length) tipoClienteId.value = String(tipos.value[0].id)
  await fetchAll()
})
</script>

<template>
  <div>
    <!-- Header (igual a Ventas) -->
    <div class="mb-3">
      <h1 class="h4 mb-1">Clientes</h1>
      <div class="text-secondary">Listar + Crear (Backend)</div>
    </div>

    <!-- Alerts -->
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="ok" class="alert alert-success py-2">{{ ok }}</div>

    <!-- Toolbar (igual a Ventas) -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div class="text-secondary small">
            Total: <b>{{ activos.length }}</b>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-outline-light" @click="fetchAll" :disabled="loading">
              Refrescar
            </button>
            <button class="btn btn-primary btn-accent" @click="create" :disabled="saving">
              {{ saving ? "Guardando..." : "+ Crear cliente" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Form (igual a Ventas) -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <h2 class="h6 mb-3">Nuevo cliente</h2>

        <div class="row g-3">
          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Nombre</label>
            <input v-model="nombre" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Apellido</label>
            <input v-model="apellido" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">DNI</label>
            <input v-model="dni" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Teléfono</label>
            <input v-model="telefono" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Email</label>
            <input v-model="email" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Tipo de cliente</label>
            <select v-model="tipoClienteId" class="form-select bg-dark text-white border-secondary">
              <option v-for="t in tipos" :key="t.id" :value="String(t.id)">
                {{ t.name }}
              </option>
            </select>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Localidad</label>
            <select v-model="localidadId" class="form-select bg-dark text-white border-secondary">
              <option value="">Sin localidad</option>
              <option v-for="l in localidades" :key="l.id" :value="String(l.id)">
                {{ l.nombre }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Lista (igual a Ventas) -->
    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div v-if="loading" class="text-secondary">Cargando...</div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 80px">ID</th>
                <th>Cliente</th>
                <th>DNI</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th style="width: 160px">Tipo</th>
                <th style="width: 180px">Localidad</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="c in activos" :key="c.id">
                <td class="text-secondary">{{ c.id }}</td>
                <td class="fw-semibold">{{ c.nombre }} {{ c.apellido || "" }}</td>
                <td class="text-secondary">{{ c.dni || "-" }}</td>
                <td class="text-secondary">{{ c.telefono || "-" }}</td>
                <td class="text-secondary">{{ c.email || "-" }}</td>
                <td class="text-secondary">
                  {{ tipoById.get(String(c.tipoClienteId))?.name || ("#" + (c.tipoClienteId ?? "-")) }}
                </td>
                <td class="text-secondary">
                  {{ locById.get(String(c.localidadId))?.nombre || "-" }}
                </td>
              </tr>

              <tr v-if="activos.length === 0">
                <td colspan="7" class="text-secondary">No hay clientes activos.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.bg-panel{ background: rgba(18, 22, 32, .92); }
.btn-accent{ background: #6f5cff; border: none; }
.btn-accent:hover{ background: #5f4de6; }
</style>
