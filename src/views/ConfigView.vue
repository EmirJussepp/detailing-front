<script setup>
import { computed } from "vue"
import { getSession, isAdmin } from "../auth/session"

const session = getSession() ?? null
const admin = computed(() => Boolean(session && isAdmin()))
</script>

<template>
  <div class="container py-4">
    <div class="mb-3">
      <h1 class="h4 mb-1">Configuración</h1>
      <div class="text-secondary">Parámetros del sistema (catálogos + usuarios).</div>
    </div>

    <div v-if="!admin" class="alert alert-warning py-2">
      Solo ADMIN puede entrar a configuración.
    </div>

    <div v-else class="row g-3">
      <div class="col-12 col-md-4">
        <RouterLink class="card bg-panel border-0 shadow-sm text-decoration-none" to="/config/localidades">
          <div class="card-body">
            <div class="fw-semibold text-white">Localidades</div>
            <div class="text-secondary small">ABM de localidades.</div>
          </div>
        </RouterLink>
      </div>

      <div class="col-12 col-md-4">
        <RouterLink class="card bg-panel border-0 shadow-sm text-decoration-none" to="/config/tipos-cliente">
          <div class="card-body">
            <div class="fw-semibold text-white">Tipos de cliente</div>
            <div class="text-secondary small">Minorista / Mayorista.</div>
          </div>
        </RouterLink>
      </div>

      <div class="col-12 col-md-4">
        <RouterLink class="card bg-panel border-0 shadow-sm text-decoration-none" to="/config/metodos-pago">
          <div class="card-body">
            <div class="fw-semibold text-white">Métodos de pago</div>
            <div class="text-secondary small">Efectivo / Transferencia, etc.</div>
          </div>
        </RouterLink>
      </div>

      <div class="col-12 col-md-4">
        <RouterLink class="card bg-panel border-0 shadow-sm text-decoration-none" to="/config/usuarios">
          <div class="card-body">
            <div class="fw-semibold text-white">Usuarios</div>
            <div class="text-secondary small">Crear / listar / eliminar.</div>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-panel { background: rgba(18, 22, 32, .92); }
</style>
