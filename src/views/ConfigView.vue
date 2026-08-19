conf<script setup>
import { computed } from "vue"
import { RouterLink } from "vue-router"
import { getSession, isAdmin } from "../auth/session"

const admin = computed(() => Boolean(getSession() && isAdmin()))
</script>

<template>
  <div class="config-page">

    <!-- HEADER -->
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Sistema</p>
        <h1 class="page-title mb-1">Configuración</h1>
        <p class="page-subtitle mb-0">
          Parámetros del sistema, catálogos y administración de usuarios.
        </p>
      </div>
    </section>

    <!-- ERROR PERMISO -->
    <div v-if="!admin" class="alert alert-warning py-2 mb-3">
      Solo los usuarios <b>ADMIN</b> pueden acceder a esta sección.
    </div>

    <!-- TARJETAS -->
    <div v-if="admin" class="config-grid">

      <!-- METODOS PAGO -->
      <RouterLink to="/config/metodos-pago" class="config-card">
        <div class="config-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        </div>
        <div>
          <div class="config-title">Métodos de pago</div>
          <div class="config-desc">Administrar efectivo, transferencias y otros medios.</div>
        </div>
      </RouterLink>

      <!-- LOCALIDADES -->
      <RouterLink to="/config/localidades" class="config-card">
        <div class="config-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
        </div>
        <div>
          <div class="config-title">Localidades</div>
          <div class="config-desc">Crear y administrar localidades del sistema.</div>
        </div>
      </RouterLink>

      <!-- USUARIOS -->
      <RouterLink to="/config/usuarios" class="config-card">
        <div class="config-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div>
          <div class="config-title">Usuarios</div>
          <div class="config-desc">Crear, editar y gestionar accesos.</div>
        </div>
      </RouterLink>

    </div>

  </div>
</template>

<style scoped>

.config-page{
  min-height:100%;
}

/* GRID */

.config-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  gap:16px;
  margin-top:18px;
}

/* CARD */

.config-card{
  display:flex;
  gap:14px;
  align-items:center;

  background:rgba(18,22,32,.92);
  border-radius:2px;

  padding:18px;

  text-decoration:none;
  color:white;

  transition:.15s;
}

.config-card:hover{
  transform:translateY(-4px);
  box-shadow:0 10px 28px rgba(0,0,0,.45);
}

/* ICON */

.config-icon{
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c9a227;
}

.config-icon svg {
  width: 22px;
  height: 22px;
}

/* TEXT */

.config-title{
  font-weight:700;
  margin-bottom:2px;
}

.config-desc{
  font-size:.85rem;
  color:rgba(255,255,255,.65);
}

</style>