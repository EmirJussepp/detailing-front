<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLogged = computed(() => !!localStorage.getItem('token'))

function logout() {
  localStorage.removeItem('token')
  router.push({ name: 'login' })
}
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container-fluid">
      <router-link class="navbar-brand" to="/">Detailing</router-link>

      <div class="collapse navbar-collapse">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item" v-if="isLogged">
            <router-link class="nav-link" to="/">Home</router-link>
          </li>

          <li class="nav-item" v-if="!isLogged">
            <router-link class="nav-link" to="/login">Login</router-link>
          </li>

          <li class="nav-item" v-if="isLogged">
            <button class="btn btn-outline-light btn-sm" @click="logout">
              Salir
            </button>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>
