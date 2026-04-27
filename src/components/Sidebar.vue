<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-logo-wrap">
        <img class="brand-logo" :src="tenant.logo" :alt="tenant.nombre" />
      </div>
      <div class="meta">
        <div class="tenant-name">{{ tenant.nombreCorto }}</div>
        <div class="role">{{ roleLabel }}</div>
        <div class="shift" v-if="shiftLabel">Turno: {{ shiftLabel }}</div>
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
          <component
            v-if="item.icon && icons[item.icon]"
            :is="icons[item.icon]"
            class="icon"
            :class="{ active: isActive(item) }"
            :size="18"
            :stroke-width="2"
          />
          <span class="label">{{ item.label }}</span>
        </router-link>
      </template>
    </nav>

    <div class="footer">
      <div class="powered">{{ tenant.developer.texto }}</div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from "vue"
import { useRoute } from "vue-router"
import * as icons from "lucide-vue-next"

import { buildMenuFromPermissions } from "../ui/menu"
import { getSession } from "../auth/session"
import { getTurnoOperativo, turnoLabel } from "../ui/turnoOperativo"
import { tenant } from "../tenant.config"

const route = useRoute()

const session    = computed(() => getSession() ?? null)
const permissions = computed(() => session.value?.permissions || [])
const turnoActual = ref(getTurnoOperativo())

const roleLabel = computed(() => {
  const raw = String(session.value?.role || "EMPLEADO").toUpperCase()
  if (raw === "ADMIN")   return "ADMIN"
  if (raw === "CAJERO")  return "CAJERO"
  return "EMPLEADO"
})

const shiftLabel = computed(() => turnoLabel(turnoActual.value))
const menu       = computed(() => buildMenuFromPermissions(permissions.value))

function isActive(item) {
  const name   = route.name ? String(route.name) : ""
  const target = item?.to?.name ? String(item.to.name) : ""
  if (!target) return false
  if (name === target) return true
  const prefixes = ["caja.", "ventas.", "compras.", "clientes.", "productos.", "reportes."]
  return prefixes.some(p => target.startsWith(p) && name.startsWith(p))
}

function onTurnoChanged(event) {
  turnoActual.value = event?.detail?.turno || getTurnoOperativo()
}

onMounted(()        => window.addEventListener("turno:changed", onTurnoChanged))
onBeforeUnmount(()  => window.removeEventListener("turno:changed", onTurnoChanged))
</script>

<style scoped>
.sidebar {
  width: 260px;
  height: 100%;
  background: v-bind("tenant.colors.sidebarBg");
  border-right: 1px solid v-bind("tenant.colors.accentBorder");
  display: flex;
  flex-direction: column;
}

.brand {
  padding: 16px;
  border-bottom: 1px solid v-bind("tenant.colors.accentBorder");
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo-wrap {
  flex-shrink: 0;
  width: 50px;
  height: 50px;
  border-radius: v-bind("tenant.logoRadius");
  overflow: hidden;
  border: 2px solid v-bind("tenant.colors.accent");
  box-shadow: 0 0 14px v-bind("tenant.colors.accentSoft");
}

.brand-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tenant-name {
  font-size: 1rem;
  font-weight: 900;
  color: v-bind("tenant.colors.accent");
  letter-spacing: 0.04em;
  line-height: 1.2;
}

.role {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.shift {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.menu {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1;
}

.section {
  margin-top: 10px;
  margin-bottom: 2px;
  padding: 0 4px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: v-bind("tenant.colors.accentMuted");
}

.link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 12px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.82);
  border: 1px solid transparent;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.link:hover {
  background: v-bind("tenant.colors.accentSoft");
  border-color: v-bind("tenant.colors.accentBorder");
  color: #fff;
}

.link.active {
  background: v-bind("tenant.colors.accentSoft");
  border-color: v-bind("tenant.colors.accentBorder");
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.35);
  transition: color 0.18s ease, transform 0.18s ease;
}

.link:hover .icon,
.icon.active {
  color: v-bind("tenant.colors.accent");
  transform: translateX(1px);
}

.label {
  font-weight: 600;
  font-size: 0.9rem;
  line-height: 1.2;
}

.footer {
  padding: 12px 16px;
  border-top: 1px solid v-bind("tenant.colors.accentBorder");
}

.powered {
  font-size: 11px;
  color: v-bind("tenant.developer.color");
  font-weight: 600;
  letter-spacing: 0.04em;
}
</style>