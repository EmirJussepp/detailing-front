<template>
  <div class="container py-4">
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div>
        <h2 class="mb-1">Tipos de cliente</h2>
        <div class="text-secondary small">Crear y listar.</div>
      </div>

      <button class="btn btn-primary" @click="openCreate">
        + Nuevo tipo
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
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in items" :key="t.id">
                <td class="text-secondary">{{ t.id }}</td>
                <td>
                  <div class="fw-semibold">{{ t.name }}</div>
                  <div class="text-secondary small">{{ t.descripcion }}</div>
                </td>
              </tr>

              <tr v-if="items.length === 0">
                <td colspan="2" class="text-secondary">No hay tipos de cliente cargados.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Crear -->
    <div v-if="showCreate" class="modal-backdrop-custom">
      <div class="modal-custom">
        <h5 class="mb-3">Nuevo tipo de cliente</h5>

        <input
          v-model="newName"
          class="form-control mb-2"
          placeholder="Nombre (ej: Regular / VIP / Empresa)"
        />

        <textarea
          v-model="newDescripcion"
          class="form-control mb-3"
          placeholder="Descripción (opcional)"
          rows="3"
        />

        <div class="d-flex gap-2 justify-content-end">
          <button class="btn btn-primary" @click="create" :disabled="saving || !newName.trim()">
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
import { tipoClienteApi } from "../services/tipoClienteService";

const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");

const showCreate = ref(false);
const newName = ref("");
const newDescripcion = ref("");

async function fetchAll() {
  error.value = "";
  loading.value = true;
  try {
    const { data } = await tipoClienteApi.list();
    items.value = Array.isArray(data) ? data : (data?.items ?? []);
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error cargando tipos de cliente";
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  newName.value = "";
  newDescripcion.value = "";
  showCreate.value = true;
}

function closeCreate() {
  showCreate.value = false;
}

async function create() {
  saving.value = true;
  error.value = "";

  try {
    await tipoClienteApi.create({
      name: newName.value.trim(),
      descripcion: newDescripcion.value.trim(),
    });

    closeCreate();
    await fetchAll();
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error creando tipo de cliente";
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
