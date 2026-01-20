<script setup>
import NavBar from '../components/NavBar.vue'
</script>

<template>
  <div class="min-vh-100 bg-app">
    <NavBar />
    <main class="container py-4">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.bg-app{
  background: #0e1117;
  color: rgba(255,255,255,.9);
}
</style>
