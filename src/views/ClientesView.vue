<script setup>
import { onMounted, ref, computed, watch } from "vue"
import { useRouter } from "vue-router"

import Pager from "../components/Pager.vue"
import { clientesApi } from "../services/clientesApi"
import { tipoClientesApi } from "../services/tipoClienteService"
import { localidadesApi } from "../services/localidadService"

const router = useRouter()

function unwrapPage(data) {
  if (Array.isArray(data)) {
    return {
      content: data,
      page: 0,
      size: data.length,
      totalElements: data.length,
      totalPages: 1,
    }
  }

  const content = data?.content ?? data?.items ?? data?.data ?? []

  return {
    content: Array.isArray(content) ? content : [],
    page: Number(data?.page ?? data?.number ?? 0),
    size: Number(data?.size ?? data?.pageSize ?? 10),
    totalElements: Number(
      data?.totalElements ??
        data?.total ??
        (Array.isArray(content) ? content.length : 0)
    ),
    totalPages: Number(data?.totalPages ?? data?.pages ?? 1),
  }
}

const items = ref([])
const tipos = ref([])
const localidades = ref([])

const loading = ref(false)
const saving = ref(false)
const errorMsg = ref("")
const okMsg = ref("")
const infoMsg = ref("")

const page = ref(0)
const size = ref(10)
const totalElements = ref(0)
const totalPages = ref(1)

const nombre = ref("")
const apellido = ref("")
const dni = ref("")
const telefono = ref("")
const email = ref("")
const localidadId = ref("")
const tipoClienteId = ref("")

const search = ref("")

function mapCliente(c) {
  return {
    id: Number(c?.clienteId ?? c?.id),
    nombre: c?.nombre ?? "",
    apellido: c?.apellido ?? null,
    dni: c?.dni ?? null,
    telefono: c?.telefono ?? null,
    email: c?.email ?? null,
    localidadId: c?.localidadId ?? null,
    tipoClienteId: c?.tipoClienteId ?? null,
    activo: c?.activo ?? true,
  }
}

function mapTipo(t) {
  return {
    id: Number(t?.tipoClienteId ?? t?.id),
    name: t?.name ?? t?.nombre ?? "",
  }
}

function mapLoc(l) {
  return {
    id: Number(l?.localidadId ?? l?.id),
    nombre: l?.nombre ?? l?.name ?? "",
  }
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

const activos = computed(() =>
  items.value.filter((c) => c.activo !== false)
)

const filtrados = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return activos.value

  return activos.value.filter((c) => {
    const blob =
      `${c.nombre} ${c.apellido ?? ""} ${c.dni ?? ""} ${c.telefono ?? ""} ${c.email ?? ""}`.toLowerCase()
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
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

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

    if (!p.content.length) {
      infoMsg.value = "No hay clientes para mostrar con los filtros actuales."
    }
  } catch (e) {
    items.value = []
    totalElements.value = 0
    totalPages.value = 1
    errorMsg.value =
      e?.response?.data?.error ||
      e?.message ||
      "Error cargando clientes."
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
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

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

    okMsg.value = "Cliente creado correctamente."
    resetForm()
    page.value = 0
    await fetchAll()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.message ||
      "Error creando cliente."
  } finally {
    saving.value = false
  }
}

function goCuentaCorriente(clienteId) {
  router.push({ name: "caja.cuenta", query: { clienteId: String(clienteId) } })
}

function onPageChange(newPage) {
  page.value = Number(newPage ?? 0)
}

function onSizeChange() {
  // el pager minimalista no expone cambio de tamaño
}

let t = null
watch(search, () => {
  clearTimeout(t)
  t = setTimeout(() => {
    page.value = 0
    fetchAll()
  }, 250)
})

watch(page, () => {
  fetchAll()
})

onMounted(async () => {
  await fetchMaestros()
  if (!tipoClienteId.value && tipos.value.length) {
    tipoClienteId.value = String(tipos.value[0].id)
  }
  await fetchAll()
})
</script>

<template>
  <div class="clientes-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Clientes</p>
        <h1 class="page-title mb-1">Clientes</h1>
        <p class="page-subtitle mb-0">
          Alta, consulta y acceso rápido a cuenta corriente.
        </p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="fetchAll" :disabled="loading">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>

        <button class="btn btn-primary btn-accent" @click="create" :disabled="saving">
          {{ saving ? "Guardando..." : "Nuevo cliente" }}
        </button>
      </div>
    </section>

    <div v-if="errorMsg" class="alert alert-danger py-2 mb-3">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2 mb-3">{{ okMsg }}</div>
    <div v-if="infoMsg" class="alert alert-secondary py-2 mb-3">{{ infoMsg }}</div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Búsqueda</h2>
          <div class="helper-text">
            Total: <b>{{ totalElements }}</b> · Mostrando: <b>{{ filtrados.length }}</b>
          </div>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-8">
            <label class="form-label field-label">Buscar cliente</label>
            <input
              v-model="search"
              class="form-control app-input"
              placeholder="Nombre, DNI, teléfono o email..."
            />
          </div>

          <div class="col-12 col-md-4 d-flex gap-2">
            <button class="btn btn-outline-light w-100" @click="fetchAll" :disabled="loading">
              Refrescar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Nuevo cliente</h2>
          <div class="helper-text">Completá los datos básicos para darlo de alta.</div>
        </div>

        <div class="row g-3">
          <div class="col-12 col-md-4">
            <label class="form-label field-label">Nombre</label>
            <input v-model="nombre" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label field-label">Apellido</label>
            <input v-model="apellido" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label field-label">DNI</label>
            <input v-model="dni" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label field-label">Teléfono</label>
            <input v-model="telefono" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label field-label">Email</label>
            <input v-model="email" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label field-label">Tipo</label>
            <select v-model="tipoClienteId" class="form-select app-input">
              <option v-for="t in tipos" :key="t.id" :value="String(t.id)">
                {{ t.name }}
              </option>
            </select>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label field-label">Localidad</label>
            <select v-model="localidadId" class="form-select app-input">
              <option value="">Sin localidad</option>
              <option v-for="l in localidades" :key="l.id" :value="String(l.id)">
                {{ l.nombre }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Listado</h2>
          <div class="helper-text">Clientes activos de la página actual.</div>
        </div>

        <div v-if="loading" class="empty-block">
          <div class="empty-title">Cargando clientes</div>
          <div class="helper-text">Esperá un momento.</div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
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
                <td class="fw-semibold">
                  {{ c.nombre }} {{ c.apellido || "" }}
                </td>

                <td class="text-secondary">{{ c.dni || "-" }}</td>
                <td class="text-secondary">{{ c.telefono || "-" }}</td>
                <td class="text-secondary">{{ c.email || "-" }}</td>

                <td class="text-secondary">
                  {{ tipoById.get(String(c.tipoClienteId))?.name || "-" }}
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
                <td colspan="7" class="text-secondary">No hay resultados para mostrar.</td>
              </tr>
            </tbody>
          </table>

          <div class="mt-3">
            <Pager
              :page="page"
              :size="size"
              :total-elements="totalElements"
              :total-pages="totalPages"
              :loading="loading"
              @update:page="onPageChange"
              @update:size="onSizeChange"
            />
          </div>

          <div class="helper-text mt-3">
            “Ver cuenta” abre la cuenta corriente del cliente seleccionado.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.clientes-page {
  min-height: 100%;
}
</style>