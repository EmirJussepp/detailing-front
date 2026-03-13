<script setup>
import { computed, onMounted, ref } from "vue"
import { localidadApi } from "../services/localidadService"

const items = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref("")
const okMsg = ref("")

const showCreate = ref(false)
const newName = ref("")

const editId = ref(null)
const editName = ref("")

const canCreate = computed(() => {
  return newName.value.trim().length > 0
})

const canSaveEdit = computed(() => {
  return editName.value.trim().length > 0
})

function clearMsgs() {
  error.value = ""
  okMsg.value = ""
}

function normalizeItem(l) {
  return {
    id: Number(l?.localidadId ?? l?.id ?? 0),
    name: String(l?.name ?? l?.nombre ?? ""),
  }
}

async function fetchAll() {
  clearMsgs()
  loading.value = true

  try {
    const { data } = await localidadApi.list()

    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.content)
          ? data.content
          : []

    items.value = arr.map(normalizeItem).filter((x) => x.id > 0)
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error cargando localidades."
  } finally {
    loading.value = false
  }
}

function openCreate() {
  clearMsgs()
  newName.value = ""
  showCreate.value = true
}

function closeCreate() {
  showCreate.value = false
  newName.value = ""
}

async function create() {
  clearMsgs()
  saving.value = true

  try {
    await localidadApi.create({
      name: newName.value.trim(),
    })

    okMsg.value = "Localidad creada correctamente."
    closeCreate()
    await fetchAll()
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error creando localidad."
  } finally {
    saving.value = false
  }
}

function openEdit(l) {
  clearMsgs()
  editId.value = l.id
  editName.value = l.name
}

function cancelEdit() {
  editId.value = null
  editName.value = ""
}

async function saveEdit(l) {
  clearMsgs()
  saving.value = true

  try {
    await localidadApi.update(l.id, {
      localidadId: l.id,
      name: editName.value.trim(),
    })

    okMsg.value = "Localidad actualizada correctamente."
    cancelEdit()
    await fetchAll()
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error actualizando localidad."
  } finally {
    saving.value = false
  }
}

async function removeItem(l) {
  const nombre = l?.name || "localidad"

  if (!confirm(`Eliminar "${nombre}"?`)) return

  clearMsgs()
  saving.value = true

  try {
    await localidadApi.remove(l.id)
    okMsg.value = "Localidad eliminada correctamente."
    await fetchAll()
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error eliminando localidad."
  } finally {
    saving.value = false
  }
}

onMounted(fetchAll)
</script>

<template>
  <div class="config-section-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Configuración</p>

        <h1 class="page-title mb-1">
          Localidades
        </h1>

        <p class="page-subtitle mb-0">
          Crear, editar y eliminar localidades del sistema.
        </p>
      </div>

      <div class="hero-actions">
        <button
          class="btn btn-primary btn-accent"
          @click="openCreate"
        >
          Nueva localidad
        </button>
      </div>
    </section>

    <div v-if="error" class="alert alert-danger py-2 mb-3">
      {{ error }}
    </div>

    <div v-if="okMsg" class="alert alert-success py-2 mb-3">
      {{ okMsg }}
    </div>

    <div
      v-if="showCreate"
      class="card bg-panel border-0 shadow-sm mb-3"
    >
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Nueva localidad</h2>
        </div>

        <div class="row g-3">
          <div class="col-12">
            <label class="form-label">Localidad</label>
            <input
              v-model="newName"
              type="text"
              class="form-control app-input"
              placeholder="Ej: Mar del Plata"
            />
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2 mt-3">
          <button
            class="btn btn-outline-light"
            @click="closeCreate"
            :disabled="saving"
          >
            Cancelar
          </button>

          <button
            class="btn btn-primary btn-accent"
            @click="create"
            :disabled="saving || !canCreate"
          >
            {{ saving ? "Guardando..." : "Guardar" }}
          </button>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">
            Resultados
          </h2>

          <div class="helper-text">
            Total:
            <b>{{ items.length }}</b>
            localidad(es)
          </div>
        </div>

        <div v-if="loading" class="helper-text">
          Cargando...
        </div>

        <div
          v-else-if="items.length === 0"
          class="empty-block"
        >
          <div class="empty-title">
            No hay localidades cargadas
          </div>

          <div class="helper-text">
            Creá una localidad para empezar.
          </div>
        </div>

        <div
          v-else
          class="table-responsive"
        >
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th style="width:110px">
                  ID
                </th>

                <th>
                  Localidad
                </th>

                <th
                  class="text-end"
                  style="width:220px"
                >
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="l in items"
                :key="l.id"
              >
                <td class="text-secondary">
                  #{{ l.id }}
                </td>

                <td>
                  <span
                    v-if="editId !== l.id"
                    class="table-main"
                  >
                    {{ l.name }}
                  </span>

                  <input
                    v-else
                    v-model="editName"
                    class="form-control form-control-sm app-input"
                  />
                </td>

                <td class="text-end">
                  <div class="d-flex justify-content-end gap-2 flex-wrap">
                    <button
                      v-if="editId !== l.id"
                      class="btn btn-sm btn-outline-light"
                      @click="openEdit(l)"
                    >
                      Editar
                    </button>

                    <button
                      v-else
                      class="btn btn-sm btn-success"
                      @click="saveEdit(l)"
                      :disabled="saving || !canSaveEdit"
                    >
                      Guardar
                    </button>

                    <button
                      v-if="editId === l.id"
                      class="btn btn-sm btn-outline-light"
                      @click="cancelEdit"
                    >
                      Cancelar
                    </button>

                    <button
                      class="btn btn-sm btn-outline-danger"
                      @click="removeItem(l)"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-section-page {
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
  background: rgba(0, 0, 0, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
}

.modal-custom {
  width: min(520px, 92vw);
  background: rgba(18, 22, 32, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 18px;
  padding: 18px;
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.55);
  color: #fff;
}
</style>