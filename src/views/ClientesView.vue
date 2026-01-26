<script setup>
import { computed, ref, watch } from 'vue'
import { getSession } from '../auth/session'
import { listClientes, addCliente, updateCliente, removeCliente } from '../services/clientesStorage'

const session = getSession()
const userId = session?.userId ?? 'anon'

function ensureUUID() {
  return (crypto?.randomUUID?.() ?? String(Date.now() + Math.random()))
}

const clientes = ref([])
const errorMsg = ref('')
const okMsg = ref('')

function refresh() {
  clientes.value = listClientes(userId)
}

watch(() => userId, refresh, { immediate: true })

const nombre = ref('')
const telefono = ref('')
const tipo = ref('MINORISTA')
const descuentoPct = ref('0')

function crear() {
  errorMsg.value = ''
  okMsg.value = ''

  const n = nombre.value.trim()
  if (!n) return (errorMsg.value = 'Ingresá el nombre del cliente.')

  const d = Number(String(descuentoPct.value).replace(',', '.'))
  if (!Number.isFinite(d) || d < 0 || d > 100) {
    return (errorMsg.value = 'Descuento inválido (0 a 100).')
  }

  addCliente(userId, {
    id: ensureUUID(),
    nombre: n,
    telefono: telefono.value.trim(),
    tipo: tipo.value,
    descuentoPct: d,
    activo: true,
    createdAt: new Date().toISOString()
  })

  nombre.value = ''
  telefono.value = ''
  tipo.value = 'MINORISTA'
  descuentoPct.value = '0'
  okMsg.value = 'Cliente creado.'
  refresh()
}

function toggleActivo(c) {
  updateCliente(userId, c.id, { activo: !c.activo })
  refresh()
}

function borrar(c) {
  if (!confirm(`Eliminar "${c.nombre}"?`)) return
  removeCliente(userId, c.id)
  refresh()
}

const activos = computed(() => clientes.value.filter(c => c.activo))
const inactivos = computed(() => clientes.value.filter(c => !c.activo))
</script>

<template>
  <div>
    <div class="mb-3">
      <h1 class="h4 mb-1">Clientes</h1>
      <div class="text-secondary">Mayoristas / minoristas (localStorage)</div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <h2 class="h6 mb-3">Nuevo cliente</h2>

        <div class="row g-3">
          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Nombre</label>
            <input v-model="nombre" class="form-control bg-dark text-white border-secondary" placeholder="Ej: Juan Pérez / Taller X" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Teléfono</label>
            <input v-model="telefono" class="form-control bg-dark text-white border-secondary" placeholder="Ej: 351..." />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Tipo</label>
            <select v-model="tipo" class="form-select bg-dark text-white border-secondary">
              <option value="MINORISTA">MINORISTA</option>
              <option value="MAYORISTA">MAYORISTA</option>
            </select>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Descuento %</label>
            <input v-model="descuentoPct" class="form-control bg-dark text-white border-secondary" placeholder="0" inputmode="numeric" />
          </div>

          <div class="col-12 d-flex justify-content-end">
            <button class="btn btn-primary btn-accent" @click="crear">Crear cliente</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2 class="h6 mb-0">Activos</h2>
          <div class="text-secondary small">{{ activos.length }} clientes</div>
        </div>

        <div v-if="activos.length === 0" class="text-secondary">No hay clientes.</div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Tipo</th>
                <th>Desc %</th>
                <th class="text-end" style="width: 220px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in activos" :key="c.id">
                <td class="fw-semibold">{{ c.nombre }}</td>
                <td class="text-secondary">{{ c.telefono || '-' }}</td>
                <td class="text-secondary">{{ c.tipo }}</td>
                <td class="text-secondary">{{ c.descuentoPct ?? 0 }}%</td>
                <td class="text-end">
                  <div class="btn-group">
                    <button class="btn btn-sm btn-outline-light" @click="toggleActivo(c)">Desactivar</button>
                    <button class="btn btn-sm btn-outline-danger" @click="borrar(c)">Borrar</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-3">
          Próximo: selector de cliente en Ventas + descuento automático.
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm" v-if="inactivos.length">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2 class="h6 mb-0">Inactivos</h2>
          <div class="text-secondary small">{{ inactivos.length }} clientes</div>
        </div>

        <div class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Tipo</th>
                <th>Desc %</th>
                <th class="text-end" style="width: 140px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in inactivos" :key="c.id">
                <td class="fw-semibold">{{ c.nombre }}</td>
                <td class="text-secondary">{{ c.telefono || '-' }}</td>
                <td class="text-secondary">{{ c.tipo }}</td>
                <td class="text-secondary">{{ c.descuentoPct ?? 0 }}%</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-light" @click="toggleActivo(c)">Activar</button>
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
.bg-panel{ background: rgba(18, 22, 32, .92); }
.btn-accent{ background: #6f5cff; border: none; }
.btn-accent:hover{ background: #5f4de6; }
</style>
