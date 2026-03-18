<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="logo">ELITE-CarShop</div>

      <div class="meta">
        <div class="role">{{ roleLabel }}</div>
        <div class="shift" v-if="shiftLabel">
          Turno: {{ shiftLabel }}
        </div>
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
      <div class="small">3byte · GestionaTuNegocio</div>
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

const route = useRoute()

const session = computed(() => getSession() ?? null)
const permissions = computed(() => session.value?.permissions || [])

const turnoActual = ref(getTurnoOperativo())

const roleLabel = computed(() => {
  const raw = String(session.value?.role || "EMPLEADO").toUpperCase()
  if (raw === "ADMIN") return "ADMIN"
  if (raw === "CAJERO") return "CAJERO"
  return "EMPLEADO"
})

const shiftLabel = computed(() => {
  return turnoLabel(turnoActual.value)
})

const menu = computed(() => buildMenuFromPermissions(permissions.value))

function isActive(item) {
  const name = route.name ? String(route.name) : ""
  const target = item?.to?.name ? String(item.to.name) : ""

  if (!target) return false
  if (name === target) return true
  if (target.startsWith("caja.") && name.startsWith("caja.")) return true
  if (target.startsWith("ventas.") && name.startsWith("ventas.")) return true
  if (target.startsWith("compras.") && name.startsWith("compras.")) return true
  if (target.startsWith("clientes.") && name.startsWith("clientes.")) return true
  if (target.startsWith("productos.") && name.startsWith("productos.")) return true
  if (target.startsWith("reportes.") && name.startsWith("reportes.")) return true

  return false
}

function onTurnoChanged(event) {
  turnoActual.value = event?.detail?.turno || getTurnoOperativo()
}

onMounted(() => {
  window.addEventListener("turno:changed", onTurnoChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener("turno:changed", onTurnoChanged)
})
</script>

<style scoped>
.sidebar {
  width: 260px;
  height: 100%;
  background: linear-gradient(180deg, #0b0b10 0%, #090b12 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
}

.brand {
  padding: 18px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.logo {
  font-weight: 900;
  letter-spacing: 0.4px;
  font-size: 1.8rem;
  color: #caa6ff;
  line-height: 1;
}

.meta {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.role {
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.04em;
}

.shift {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.74);
}

.menu {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.section {
  margin-top: 10px;
  margin-bottom: 4px;
  padding: 0 4px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.56);
}

.link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 10px 12px;
  border-radius: 14px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.88);
  border: 1px solid transparent;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.link:hover {
  background: rgba(202, 166, 255, 0.10);
  border-color: rgba(202, 166, 255, 0.12);
  color: #fff;
}

.link.active {
  background: rgba(202, 166, 255, 0.18);
  border: 1px solid rgba(202, 166, 255, 0.26);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03);
}

.icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #9ca3af;
  transition: color 0.18s ease, transform 0.18s ease;
}

.link:hover .icon {
  color: #d8c4ff;
  transform: translateX(1px);
}

.icon.active {
  color: #caa6ff;
}

.label {
  font-weight: 600;
  line-height: 1.2;
}

.footer {
  margin-top: auto;
  padding: 12px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.small {
  font-size: 11px;
  opacity: 0.6;
  color: #fff;
}
</style>