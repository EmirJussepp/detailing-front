<template>
  <div class="container py-4">
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div>
        <h2 class="mb-1">Métodos de pago</h2>
        <div class="text-secondary small">Crear / editar / eliminar.</div>
      </div>

      <button class="btn btn-primary" @click="openCreate">
        + Nuevo método
      </button>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="card bg-dark border-secondary">
      <div class="card-body">
        <div v-if="loading" class="text-secondary">Cargando...</div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 90px">ID</th>
                <th>Nombre</th>
                <th class="text-end" style="width: 220px">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in items" :key="m.id">
                <td class="text-secondary">{{ m.id }}</td>
                <td>
                  <span v-if="editId !== m.id">{{m.nombre}}</span>

                  <input
                    v-else
                    v-model="editNombre"
                    class="form-control form-control-sm"
                    placeholder="Nombre"
                  />
                </td>

                <td class="text-end">
                  <div class="btn-group btn-group-sm">
                    <button
                      v-if="editId !== m.id"
                      class="btn btn-outline-light"
                      @click="openEdit(m)"
                    >
                      Editar
                    </button>

                    <button
                      v-else
                      class="btn btn-success"
                      @click="saveEdit(m)"
                      :disabled="saving"
                    >
                      Guardar
                    </button>

                    <button
                      v-if="editId === m.id"
                      class="btn btn-outline-secondary"
                      @click="cancelEdit"
                      :disabled="saving"
                    >
                      Cancelar
                    </button>

                    <button
                      class="btn btn-outline-danger"
                      @click="remove(m)"
                      :disabled="saving"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="items.length === 0">
                <td colspan="3" class="text-secondary">No hay métodos de pago cargados.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal simple inline (sin bootstrap JS) -->
    <div v-if="showCreate" class="modal-backdrop-custom">
      <div class="modal-custom">
        <h5 class="mb-3">Nuevo método de pago</h5>

        <input
          v-model="newNombre"
          class="form-control mb-3"
          placeholder="Ej: Efectivo / Transferencia / MercadoPago"
        />

        <div class="d-flex gap-2 justify-content-end">
          <button class="btn btn-primary" @click="create" :disabled="saving || !newNombre.trim()">
            Crear
          </button>
          <button class="btn btn-outline-secondary" @click="closeCreate" :disabled="saving">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { metodoPagoApi } from "../services/metodoPagoService";

const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");

const showCreate = ref(false);
const newNombre = ref("");

const editId = ref(null);
const editNombre = ref("");

async function fetchAll() {
  error.value = "";
  loading.value = true;
  try {
    const { data } = await metodoPagoApi.list();
    items.value = Array.isArray(data) ? data : (data?.items ?? []);
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || "Error cargando métodos de pago";
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  newNombre.value = "";
  showCreate.value = true;
}
function closeCreate() {
  showCreate.value = false;
}

async function create() {
  saving.value = true;
  error.value = "";
  try {
    // ⚠️ ajustamos el payload cuando sepamos el DTO exacto
    await metodoPagoApi.create(newNombre.value.trim());
    closeCreate();
    await fetchAll();
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || "Error creando método";
  } finally {
    saving.value = false;
  }
}

function openEdit(m) {
  editId.value = m.id;
  editNombre.value = editNombre.value = m.nombre || "";
}
function cancelEdit() {
  editId.value = null;
  editNombre.value = "";
}

async function saveEdit(m) {
  saving.value = true;
  error.value = "";
  try {
    await metodoPagoApi.update(m.id, editNombre.value.trim());
    cancelEdit();
    await fetchAll();
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || "Error actualizando método";
  } finally {
    saving.value = false;
  }
}

async function remove(m) {
  if (!confirm(`Eliminar "${m.nombre ?? m.name ?? 'método'}"?`)) return;
  saving.value = true;
  error.value = "";
  try {
    await metodoPagoApi.remove(m.id);
    await fetchAll();
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || "Error eliminando método";
  } finally {
    saving.value = false;
  }
}

onMounted(fetchAll);
</script>

<style scoped>
.modal-backdrop-custom{
  position: fixed; inset: 0;
  background: rgba(0,0,0,.6);
  display:flex; align-items:center; justify-content:center;
  z-index: 2000;
}
.modal-custom{
  width: min(520px, 92vw);
  background: #111;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 8px 30px rgba(0,0,0,.55);
  color: #fff;
}
</style>
