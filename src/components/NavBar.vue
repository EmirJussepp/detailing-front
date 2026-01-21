<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { clearSession, getSession } from '../auth/session'

const router = useRouter()

const session = computed(() => getSession())

function logout() {
  clearSession()
  router.push({ name: 'login' })
}
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark border-bottom">
    <div class="container-fluid">
      <RouterLink class="navbar-brand fw-bold" to="/dashboard">
        GestionaTuNegocio
      </RouterLink>

      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="nav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item"><RouterLink class="nav-link" to="/dashboard">Dashboard</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" to="/clientes">Clientes</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" to="/productos">Productos</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" to="/ventas">Ventas</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" to="/caja">Caja</RouterLink></li>
          <li class="nav-item"><RouterLink class="nav-link" to="/proveedores">Proveedores</RouterLink></li>
        </ul>

        <div class="d-flex align-items-center gap-2">
          <span class="badge text-bg-dark border" v-if="session">
            {{ session.role }}<span v-if="session.role !== 'ADMIN'"> • {{ session.shift }}</span>
          </span>
          <button class="btn btn-outline-light btn-sm" @click="logout">Cerrar sesión</button>
        </div>
      </div>
    </div>
  </nav>
</template>
