<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue"
import NavBar from "../components/NavBar.vue"
import Sidebar from "../components/Sidebar.vue"

const sidebarOpen = ref(false)

function openSidebar() { sidebarOpen.value = true }
function closeSidebar() { sidebarOpen.value = false }

function onKey(e) {
  if (e.key === "Escape") closeSidebar()
}

onMounted(() => window.addEventListener("keydown", onKey))
onBeforeUnmount(() => window.removeEventListener("keydown", onKey))
</script>

<template>
  <div class="app">
    <header class="app__header">
      <NavBar @toggle-sidebar="openSidebar" />
    </header>

    <div class="app__body">
      <!-- Desktop sidebar -->
      <aside class="app__sidebar">
        <Sidebar />
      </aside>

      <!-- Mobile drawer -->
      <div v-if="sidebarOpen" class="drawer-backdrop" @click.self="closeSidebar">
        <aside class="drawer">
          <div class="drawer__top">
            <button class="btn btn-outline-light btn-sm" @click="closeSidebar">Cerrar</button>
          </div>
          <Sidebar />
        </aside>
      </div>

      <main class="app__content">
        <div class="content__inner">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: #0e1117;
  color: rgba(255, 255, 255, 0.9);
}
.app__header {
  position: sticky;
  top: 0;
  z-index: 50;
}
.app__body {
  display: flex;
  min-height: calc(100vh - 56px);
}

/* Desktop sidebar visible */
.app__sidebar {
  width: 260px;
  flex: 0 0 260px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

/* Content */
.app__content {
  flex: 1;
  overflow: auto;
}
.content__inner {
  padding: 24px;
}

/* Mobile: hide desktop sidebar and use drawer */
@media (max-width: 991px) {
  .app__sidebar { display: none; }
  .content__inner { padding: 16px; }
}

/* Drawer */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0,0,0,.55);
}
.drawer {
  width: 280px;
  height: 100%;
  background: #0b0b10;
  border-right: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 20px 70px rgba(0,0,0,.55);
}
.drawer__top {
  padding: 12px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
</style>
