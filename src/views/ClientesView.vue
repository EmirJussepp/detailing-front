<!-- src/views/ClientesView.vue -->
<script setup>
import { onMounted, ref, computed, watch } from "vue"
import { useRouter } from "vue-router"

import { clientesApi } from "../services/clientesApi"
import { tipoClientesApi } from "../services/tipoClienteService"
import { localidadesApi } from "../services/localidadService"

const router = useRouter()

// =========================
// Page unwrap (paginación)
// =========================
function unwrapPage(data) {
  if (Array.isArray(data)) {
    return { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1 }
  }
  const content = data?.content ?? data?.items ?? data?.data ?? []
  return {
    content: Array.isArray(content) ? content : [],
    page: Number(data?.page ?? data?.number ?? 0),
    size: Number(data?.size ?? data?.pageSize ?? 10),
    totalElements: Number(data?.totalElements ?? data?.total ?? (Array.isArray(content) ? content.length : 0)),
    totalPages: Number(data?.totalPages ?? data?.pages ?? 1),
  }
}

// =========================
// State
// =========================
const items = ref([])
const tipos = ref([])
const localidades = ref([])

const loading = ref(false)
const saving = ref(false)
const error = ref("")
const ok = ref("")

// paginación
const page = ref(0)
const size = ref(10)
const totalElements = ref(0)
const totalPages = ref(1)

// form
const nombre = ref("")
const apellido = ref("")
const dni = ref("")
const telefono = ref("")
const email = ref("")
const localidadId = ref("") // "" => null
const tipoClienteId = ref("") // requerido

// búsqueda (server-side + debounce)
const search = ref("")

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
  return {
    id: Number(t.tipoClienteId ?? t.id),
    name: t.name ?? t.nombre ?? "",
  }
}

function mapLoc(l) {
  return { id: Number(l.localidadId ?? l.id), nombre: l.nombre ?? l.name ?? "" }
}

const tipoById = computed(() => {
  const m = new Map()
  tipos.value.forEach((t) => m.set(String(t.id), t))
  return m
})

const locById = computed(() => {
  const m = new Map()
  localidades.value.forEach((l) => m.set(String(l.id), l))
  return m
})

// activos SOLO sobre la página actual (porque paginamos server-side)
const activos = computed(() => items.value.filter((c) => c.activo !== false))

// filtrado local liviano (por si el back no filtra perfecto)
// OJO: esto filtra sobre la página actual, no sobre todos los clientes.
const filtrados = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return activos.value
  return activos.value.filter((c) => {
    const blob = `${c.id} ${c.nombre} ${c.apellido ?? ""} ${c.dni ?? ""} ${c.telefono ?? ""} ${c.email ?? ""}`.toLowerCase()
    return blob.includes(q)
  })
})

async function fetchMaestros() {
  try {
    const { data } = await tipoClientesApi.list()
    const p = unwrapPage(data)
    tipos.value = p.content.map(mapTipo)
  } catch {
    tipos.value = []
  }

  try {
    const { data } = await localidadesApi.list()
    const p = unwrapPage(data)
    localidades.value = p.content.map(mapLoc)
  } catch {
    localidades.value = []
  }
}

async function fetchAll() {
  loading.value = true
  error.value = ""
  try {
    const { data } = await clientesApi.list({
      page: page.value,
      size: size.value,
      search: search.value.trim() || null,
    })

    const p = unwrapPage(data)
    items.value = p.content.map(mapCliente)

    totalElements.value = p.totalElements
    totalPages.value = p.totalPages
    page.value = p.page
    size.value = p.size
  } catch (e) {
    items.value = []
    totalElements.value = 0
    totalPages.value = 1
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

    page.value = 0
    await fetchAll()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error creando cliente"
  } finally {
    saving.value = false
  }
}

function goCuentaCorriente(clienteId) {
  router.push({ name: "caja.cuenta", query: { clienteId: String(clienteId) } })
}

// paginación UI
const canPrev = computed(() => page.value > 0)
const canNext = computed(() => page.value < totalPages.value - 1)

function prevPage() {
  if (!canPrev.value) return
  page.value--
}
function nextPage() {
  if (!canNext.value) return
  page.value++
}

// watchers optimizados (sin doble fetch)
watch([page, size], () => fetchAll())

let t = null
watch(search, () => {
  clearTimeout(t)
  t = setTimeout(() => {
    page.value = 0 // ✅ el fetch lo dispara el watch de page/size
  }, 250)
})

onMounted(async () => {
  await fetchMaestros()
  if (!tipoClienteId.value && tipos.value.length) tipoClienteId.value = String(tipos.value[0].id)
  await fetchAll()
})
</script>

<template>
  <div>
    <div class="mb-3">
      <h1 class="h4 mb-1">Clientes</h1>
      <div class="text-secondary">Listar + Crear (Backend)</div>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="ok" class="alert alert-success py-2">{{ ok }}</div>

    <!-- toolbar -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div class="text-secondary small">
           Total: <b>{{ totalElements }}</b> · Mostrando: <b>{{ filtrados.length }}</b>
          </div>

          <div class="d-flex gap-2 flex-wrap">
            <input
              v-model="search"
              class="form-control bg-dark text-white border-secondary"
              style="max-width: 320px"
              placeholder="Buscar (nombre / dni / tel / email)…"
            />

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

    <!-- form -->
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
            <label class="form-label text-secondary">Tipo</label>
            <select v-model="tipoClienteId" class="form-select bg-dark text-white border-secondary">
              <option v-for="t in tipos" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
            </select>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Localidad</label>
            <select v-model="localidadId" class="form-select bg-dark text-white border-secondary">
              <option value="">Sin localidad</option>
              <option v-for="l in localidades" :key="l.id" :value="String(l.id)">{{ l.nombre }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- list -->
    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div v-if="loading" class="text-secondary">Cargando...</div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 70px">ID</th>
                <th>Cliente</th>
                <th>DNI</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th style="width: 150px">Tipo</th>
                <th style="width: 160px">Localidad</th>
                <th style="width: 190px" class="text-end">Acciones</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="c in filtrados" :key="c.id">
                <td class="text-secondary">{{ c.id }}</td>

                <td class="fw-semibold">
                  {{ c.nombre }} {{ c.apellido || "" }}
                </td>

                <td class="text-secondary">{{ c.dni || "-" }}</td>
                <td class="text-secondary">{{ c.telefono || "-" }}</td>
                <td class="text-secondary">{{ c.email || "-" }}</td>

                <td class="text-secondary">
                  {{ tipoById.get(String(c.tipoClienteId))?.name || ("#" + (c.tipoClienteId ?? "-")) }}
                </td>

                <td class="text-secondary">
                  {{ locById.get(String(c.localidadId))?.nombre || "-" }}
                </td>

                <td class="text-end">
                  <button class="btn btn-sm btn-outline-light" @click="goCuentaCorriente(c.id)">
                    Ver cuenta
                  </button>
                </td>
              </tr>

              <tr v-if="filtrados.length === 0">
                <td colspan="8" class="text-secondary">No hay resultados.</td>
              </tr>
            </tbody>
          </table>

          <div class="d-flex justify-content-end align-items-center gap-2 mt-3 text-secondary small">
  <button class="btn btn-sm btn-outline-light" @click="prevPage" :disabled="loading || !canPrev">◀</button>
  <span>Página {{ page + 1 }} / {{ totalPages }}</span>
  <button class="btn btn-sm btn-outline-light" @click="nextPage" :disabled="loading || !canNext">▶</button>

  <select v-model.number="size" class="form-select form-select-sm bg-dark text-white border-secondary" style="width: 90px">
    <option :value="10">10</option>
    <option :value="20">20</option>
    <option :value="50">50</option>
  </select>
</div>

          <div class="text-secondary small mt-2">
            ✅ “Ver cuenta” abre la cuenta corriente real del backend.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-panel {
  background: rgba(18, 22, 32, 0.92);
}
.btn-accent {
  background: #6f5cff;
  border: none;
}
.btn-accent:hover {
  background: #5f4de6;
}
</style>
