<script setup>
import { onMounted, ref, computed } from "vue";
import { clientesApi } from "../services/clientesService";

const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const ok = ref("");

const nombre = ref("");
const apellido = ref("");
const dni = ref("");
const telefono = ref("");
const email = ref("");
const localidadId = ref(1);     
const tipoClienteId = ref(1);   

async function fetchAll() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await clientesApi.list();
    items.value = Array.isArray(data) ? data : [];
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error cargando clientes";
  } finally {
    loading.value = false;
  }
}

async function create() {
  saving.value = true;
  error.value = "";
  ok.value = "";

  try {
    const payload = {
      nombre: nombre.value.trim(),
      apellido: apellido.value.trim() || null,
      dni: dni.value.trim(),
      telefono: telefono.value.trim() || null,
      email: email.value.trim() || null,
      localidadId: Number(localidadId.value) || null,
      tipoClienteId: Number(tipoClienteId.value),
    };

    if (!payload.nombre) throw new Error("Ingresá el nombre.");
    if (!payload.dni) throw new Error("Ingresá el DNI.");
    if (!payload.tipoClienteId) throw new Error("Tipo de cliente inválido.");

    await clientesApi.create(payload);

    ok.value = "Cliente creado.";
    nombre.value = "";
    apellido.value = "";
    dni.value = "";
    telefono.value = "";
    email.value = "";

    await fetchAll();
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error creando cliente";
  } finally {
    saving.value = false;
  }
}

const activos = computed(() => items.value.filter(c => c.activo));
</script>

<template>
  <div class="container py-4">
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div>
        <h2 class="mb-1">Clientes</h2>
        <div class="text-secondary small">Listar + Crear (API)</div>
      </div>

      <button class="btn btn-primary" @click="create" :disabled="saving">
        + Crear cliente
      </button>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="ok" class="alert alert-success py-2">{{ ok }}</div>

    <!-- Form -->
    <div class="card bg-dark border-secondary mb-3">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Nombre</label>
            <input v-model="nombre" class="form-control bg-dark text-white border-secondary" placeholder="Ej: Emir" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Apellido</label>
            <input v-model="apellido" class="form-control bg-dark text-white border-secondary" placeholder="Ej: Jussepp" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">DNI</label>
            <input v-model="dni" class="form-control bg-dark text-white border-secondary" placeholder="Ej: 44695233" />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Teléfono</label>
            <input v-model="telefono" class="form-control bg-dark text-white border-secondary" placeholder="Ej: 3564..." />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Email</label>
            <input v-model="email" class="form-control bg-dark text-white border-secondary" placeholder="Ej: mail@..." />
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">LocalidadId</label>
            <input v-model="localidadId" class="form-control bg-dark text-white border-secondary" type="number" min="1" />
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">TipoClienteId</label>
            <input v-model="tipoClienteId" class="form-control bg-dark text-white border-secondary" type="number" min="1" />
          </div>

          <div class="col-12">
            <button class="btn btn-outline-light btn-sm" @click="fetchAll" :disabled="loading">
              Refrescar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="card bg-dark border-secondary">
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
                <th style="width: 140px">Tipo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in activos" :key="c.id">
                <td class="text-secondary">{{ c.id }}</td>
                <td class="fw-semibold">{{ c.nombre }} {{ c.apellido || "" }}</td>
                <td class="text-secondary">{{ c.dni || "-" }}</td>
                <td class="text-secondary">{{ c.telefono || "-" }}</td>
                <td class="text-secondary">{{ c.email || "-" }}</td>
                <td class="text-secondary">#{{ c.tipoClienteId }}</td>
              </tr>

              <tr v-if="activos.length === 0">
                <td colspan="6" class="text-secondary">No hay clientes activos.</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  </div>
</template>
<style scoped >
.panel{
  background: rgba(18, 22, 32, .92);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  box-shadow: 0 10px 35px rgba(0,0,0,.35);
}

.input-dark{
  background: #0f141b !important;
  color: rgba(255,255,255,.92) !important;
  border: 1px solid rgba(255,255,255,.12) !important;
}
.input-dark:focus{
  border-color: rgba(111,92,255,.65) !important;
  box-shadow: 0 0 0 .2rem rgba(111,92,255,.15) !important;
}

.table-soft{
  border-color: rgba(255,255,255,.08);
}
.table-soft thead th{
  color: rgba(255,255,255,.85);
  font-size: .85rem;
}
.table-soft td{
  color: rgba(255,255,255,.8);
  font-size: .9rem;
}

</style>
