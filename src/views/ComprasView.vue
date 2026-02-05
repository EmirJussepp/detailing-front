<script setup>
import { onMounted, ref, computed } from "vue";
import { clientesApi } from "../services/clientesService.js";
import { tipoClienteApi } from "../services/tipoClienteService";
import { localidadApi } from "../services/localidadService";

const items = ref([]);
const tiposCliente = ref([]);
const localidades = ref([]);

const loading = ref(false);
const saving = ref(false);
const errorMsg = ref("");
const okMsg = ref("");

const showCreate = ref(false);

const form = ref({
  nombre: "",
  apellido: "",
  dni: "",
  telefono: "",
  email: "",
  localidadId: null,
  tipoClienteId: "",
});

const valid = computed(() => {
  const tipoId = Number(form.value.tipoClienteId)
  return (
    form.value.nombre.trim() &&
    form.value.dni.trim() &&
    Number.isFinite(tipoId) &&
    tipoId > 0
  )
})


async function fetchAll() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const [clientesRes, tiposRes, locsRes] = await Promise.all([
      clientesApi.list(),
      tipoClienteApi.list(),
      localidadApi.list(),
    ]);

    const clientes = clientesRes.data;
    items.value = Array.isArray(clientes) ? clientes : (clientes?.items ?? []);

    const tipos = tiposRes.data;
    tiposCliente.value = Array.isArray(tipos) ? tipos : (tipos?.items ?? []);

    const locs = locsRes.data;
    localidades.value = Array.isArray(locs) ? locs : (locs?.items ?? []);
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error || e?.message || "Error cargando datos";
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  errorMsg.value = "";
  okMsg.value = "";
  form.value = {
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    email: "",
    localidadId: null,
    tipoClienteId: "",
  };
  showCreate.value = true;
}

function closeCreate() {
  showCreate.value = false;
}

async function crear() {
  saving.value = true
  errorMsg.value = ""
  okMsg.value = ""

  try {
    // ✅ VALIDACIÓN FUERTE
    const tipoId = Number(form.value.tipoClienteId)
    if (!Number.isFinite(tipoId) || tipoId <= 0) {
      throw new Error("Seleccioná un tipo de cliente")
    }

    const locId =
      form.value.localidadId === null ||
      form.value.localidadId === "" ||
      form.value.localidadId === undefined
        ? null
        : Number(form.value.localidadId)

    await clientesApi.create({
      nombre: form.value.nombre.trim(),
      apellido: form.value.apellido?.trim() || null,
      dni: form.value.dni.trim(),
      telefono: form.value.telefono?.trim() || null,
      email: form.value.email?.trim() || null,
      localidadId: Number.isFinite(locId) ? locId : null,
      tipoClienteId: tipoId, // 👈 ACÁ está la clave
    })

    okMsg.value = "Cliente creado."
    closeCreate()
    await fetchAll()

  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error || e?.message || "Error creando cliente"
  } finally {
    saving.value = false
  }
}



onMounted(fetchAll);
</script>

<template>
  <div>
    <div class="mb-3">
      <h1 class="h4 mb-1">Clientes</h1>
      <div class="text-secondary">Conectado a API (Ktor)</div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <div class="d-flex justify-content-end mb-3">
      <button class="btn btn-primary btn-accent" @click="openCreate">
        + Nuevo cliente
      </button>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div v-if="loading" class="text-secondary">Cargando...</div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 90px;">ID</th>
                <th>Cliente</th>
                <th>DNI</th>
                <th>Tipo</th>
                <th>Localidad</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in items" :key="c.id">
                <td class="text-secondary">{{ c.id }}</td>
                <td class="fw-semibold">
                  {{ c.nombre }} <span v-if="c.apellido"> {{ c.apellido }}</span>
                </td>
                <td class="text-secondary">{{ c.dni }}</td>
                <td class="text-secondary">
                  {{ c.tipoCliente?.nombre ?? c.tipoClienteId ?? "-" }}
                </td>
                <td class="text-secondary">
                  {{ c.localidad?.nombre ?? c.localidadId ?? "-" }}
                </td>
              </tr>

              <tr v-if="items.length === 0">
                <td colspan="5" class="text-secondary">No hay clientes cargados.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-3">
          Próximo: selector de cliente en Ventas.
        </div>
      </div>
    </div>

    <!-- Modal Alta -->
    <div v-if="showCreate" class="modal-backdrop-custom">
      <div class="modal-custom">
        <h5 class="mb-3">Nuevo cliente</h5>

        <div class="row g-2">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Nombre *</label>
            <input v-model="form.nombre" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Apellido</label>
            <input v-model="form.apellido" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">DNI *</label>
            <input v-model="form.dni" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Teléfono</label>
            <input v-model="form.telefono" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12">
            <label class="form-label text-secondary">Email</label>
            <input v-model="form.email" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Tipo cliente *</label>
            <select v-model="form.tipoClienteId" class="form-select bg-dark text-white border-secondary">
              <option disabled value="">Seleccionar...</option>
              <option v-for="t in tiposCliente" :key="t.id" :value="String(t.id)">
  {{ t.nombre }}
</option>

            </select>
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Localidad</label>
            <select v-model="form.localidadId" class="form-select bg-dark text-white border-secondary">
              <option :value="null">—</option>
              <option value="">—</option>
<option v-for="l in localidades" :key="l.id" :value="String(l.id)">
  {{ l.nombre }} ({{ l.provincia }})
</option>

            </select>
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2 mt-3">
          <button class="btn btn-outline-secondary" @click="closeCreate" :disabled="saving">
            Cancelar
          </button>
          <button class="btn btn-primary btn-accent" @click="crear" :disabled="saving || !valid">
            Crear
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-panel{ background: rgba(18, 22, 32, .92); }
.btn-accent{ background: #6f5cff; border: none; }
.btn-accent:hover{ background: #5f4de6; }

.modal-backdrop-custom{
  position: fixed; inset: 0;
  background: rgba(0,0,0,.6);
  display:flex; align-items:center; justify-content:center;
  z-index: 2000;
}
.modal-custom{
  width: min(720px, 92vw);
  background: #111;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 8px 30px rgba(0,0,0,.55);
  color: #fff;
}
</style>
