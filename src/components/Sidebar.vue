<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="logo">3Byte</div>
      <div class="meta">
        <div class="role">{{ role }}</div>
        <div class="shift" v-if="shift">Turno: {{ shift }}</div>
      </div>
    </div>

    <nav class="menu">
      <template v-for="(item, idx) in menu" :key="idx">
        <div v-if="item.section" class="section">{{ item.section }}</div>

        <router-link
          v-else
          class="link"
          :class="{ active: isActive(item) }"
          :to="item.to"
        >
          <span class="icon">{{ item.icon }}</span>
          <span class="label">{{ item.label }}</span>
        </router-link>
      </template>
    </nav>

    <div class="footer">
      <div class="small">
        v1 · GestionaTuNegocio
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from "vue"
import { useRoute } from "vue-router"
import { buildMenuFromPermissions, isAdminFromPermissions } from "../ui/menu"
import { getSession } from "../auth/session"

const route = useRoute()

const session = computed(() => getSession())
const permissions = computed(() => session.value?.permissions || [])
const role = computed(() => session.value?.role || "EMPLEADO")

const shift = computed(() => session.value?.shift || null)
const menu = computed(() => buildMenuFromPermissions(permissions.value))

function isActive(item) {
  const name = route.name ? String(route.name) : ""
  const target = item?.to?.name ? String(item.to.name) : ""
  if (!target) return false
  if (name === target) return true
  if (target.startsWith("caja.") && name.startsWith("caja.")) return true
  return false
}
</script>

<style scoped>
.sidebar {
  width: 260px;
  height: 100%;
  background: #0b0b10;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
}

.brand {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.logo {
  font-weight: 900;
  letter-spacing: 0.5px;
  color: #caa6ff;
}
.meta {
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.85;
  color: #fff;
}
.role { font-weight: 800; }
.shift { opacity: 0.8; }

.menu {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section {
  margin-top: 10px;
  margin-bottom: 4px;
  font-size: 11px;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  opacity: 0.6;
  color: #fff;
}

.link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.86);
  transition: 0.15s;
}
.link:hover {
  background: rgba(202, 166, 255, 0.12);
}
.link.active {
  background: rgba(202, 166, 255, 0.22);
  border: 1px solid rgba(202, 166, 255, 0.25);
}

.icon { width: 22px; text-align: center; }

.footer {
  margin-top: auto;
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.small{
  font-size: 11px;
  opacity: .6;
}
</style>
