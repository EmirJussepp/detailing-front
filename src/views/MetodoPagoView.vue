<script setup>
import { computed, onMounted, ref } from "vue"
import { metodosPagoApi } from "../services/metodopagoService"

const items = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref("")
const okMsg = ref("")

const showCreate = ref(false)
const newNombre = ref("")

const editId = ref(null)
const editNombre = ref("")

const canCreate = computed(() => {
  return newNombre.value.trim()
})

const canSaveEdit = computed(() => {
  return editNombre.value.trim()
})

function clearMsgs() {
  error.value = ""
  okMsg.value = ""
}

function normalizeItem(m) {
  return {
    id: Number(m?.metodoPagoId ?? m?.id ?? 0),
    nombre: String(m?.nombre ?? m?.name ?? ""),
  }
}

async function fetchAll() {
  clearMsgs()
  loading.value = true

  try {
    const { data } = await metodosPagoApi.list()
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
      "Error cargando métodos de pago."
  } finally {
    loading.value = false
  }
}

function openCreate() {
  clearMsgs()
  newNombre.value = ""
  showCreate.value = true
}

function closeCreate() {
  showCreate.value = false
  newNombre.value = ""
}

async function create() {
  clearMsgs()
  saving.value = true

  try {
    await metodosPagoApi.create({
      nombre: newNombre.value.trim(),
    })

    okMsg.value = "Método de pago creado correctamente."
    closeCreate()
    await fetchAll()
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error creando método de pago."
  } finally {
    saving.value = false
  }
}

function openEdit(m) {
  clearMsgs()
  editId.value = m.id
  editNombre.value = m.nombre || ""
}

function cancelEdit() {
  editId.value = null
  editNombre.value = ""
}

async function saveEdit(m) {
  clearMsgs()
  saving.value = true

  try {
    await metodosPagoApi.update(m.id, {
      metodoPagoId: m.id,
      nombre: editNombre.value.trim(),
    })

    okMsg.value = "Método de pago actualizado correctamente."
    cancelEdit()
    await fetchAll()
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error actualizando método de pago."
  } finally {
    saving.value = false
  }
}

async function removeItem(m) {
  const nombre = m?.nombre || "método"
  if (!confirm(`Eliminar "${nombre}"?`)) return

  clearMsgs()
  saving.value = true

  try {
    await metodosPagoApi.remove(m.id)
    okMsg.value = "Método de pago eliminado correctamente."
    await fetchAll()
  } catch (e) {
    error.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error eliminando método de pago."
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
        <h1 class="page-title mb-1">Métodos de pago</h1>
        <p class="page-subtitle mb-0">
          Crear, editar y eliminar métodos de pago del sistema.
        </p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-primary btn-accent" @click="openCreate">
          Nuevo método
        </button>
      </div>
    </section>

    <div v-if="error" class="alert alert-danger py-2 mb-3">{{ error }}</div>
    <div v-if="okMsg" class="alert alert-success py-2 mb-3">{{ okMsg }}</div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Resultados</h2>
          <div class="helper-text">
            Total: <b>{{ items.length }}</b> método(s)
          </div>
        </div>

        <div v-if="loading" class="helper-text">Cargando...</div>

        <div v-else-if="items.length === 0" class="empty-block">
          <div class="empty-title">No hay métodos de pago cargados</div>
          <div class="helper-text">
            Creá el primero para comenzar a operar.
          </div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th>Nombre</th>
                <th class="text-end" style="width: 220px">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in items" :key="m.id">
                <td>
                  <span v-if="editId !== m.id" class="table-main">
                    {{ m.nombre }}
                  </span>

                  <input
                    v-else
                    v-model="editNombre"
                    class="form-control form-control-sm app-input"
                    placeholder="Nombre"
                  />
                </td>

                <td class="text-end">
                  <div class="d-flex justify-content-end gap-2 flex-wrap">
                    <button
                      v-if="editId !== m.id"
                      class="btn btn-sm btn-outline-light"
                      @click="openEdit(m)"
                    >
                      Editar
                    </button>

                    <button
                      v-else
                      class="btn btn-sm btn-success"
                      @click="saveEdit(m)"
                      :disabled="saving || !canSaveEdit"
                    >
                      Guardar
                    </button>

                    <button
                      v-if="editId === m.id"
                      class="btn btn-sm btn-outline-light"
                      @click="cancelEdit"
                      :disabled="saving"
                    >
                      Cancelar
                    </button>

                    <button
                      class="btn btn-sm btn-outline-danger"
                      @click="removeItem(m)"
                      :disabled="saving"
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

    <div v-if="showCreate" class="modal-backdrop-custom" @click.self="closeCreate">
      <div class="modal-custom">
        <div class="section-header mb-3">
          <div>
            <div class="section-title">Nuevo método de pago</div>
            <div class="helper-text">
              Ej: Efectivo, Transferencia, Mercado Pago.
            </div>
          </div>
        </div>

        <input
          v-model="newNombre"
          class="form-control app-input mb-3"
          placeholder="Nombre del método"
        />

        <div class="d-flex gap-2 justify-content-end">
          <button class="btn btn-outline-light" @click="closeCreate" :disabled="saving">
            Cancelar
          </button>

          <button
            class="btn btn-primary btn-accent"
            @click="create"
            :disabled="saving || !canCreate"
          >
            {{ saving ? "Creando..." : "Crear" }}
          </button>
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