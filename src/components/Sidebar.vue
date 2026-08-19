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

    <!-- Aviso de vencimiento de pago (aparece 4 días antes del 10) -->
    <div v-if="vencimiento" class="venc-banner" :class="vencimiento.urgencia">
      <component :is="icons.AlertCircle" class="venc-icon" :size="15" :stroke-width="2.5" />
      <div class="venc-text">
        <span class="venc-title">{{ vencimiento.titulo }}</span>
        <span class="venc-sub">{{ vencimiento.sub }}</span>
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

// ── Aviso de vencimiento ──────────────────────────────────────────────────────
// Muestra un banner en el sidebar los 4 días previos al día 10 de cada mes.
const vencimiento = computed(() => {
  const hoy  = new Date()
  const dia  = hoy.getDate()
  const DIA_PAGO = 12
  const DIAS_AVISO = 4

  const diasRestantes = DIA_PAGO - dia

  if (diasRestantes < 0 || diasRestantes > DIAS_AVISO) return null

  if (diasRestantes === 0) {
    return {
      titulo:   "Vence hoy el pago",
      sub:      "Regularizá tu suscripción.",
      urgencia: "venc-rojo",
    }
  }
  if (diasRestantes === 1) {
    return {
      titulo:   "Vence mañana",
      sub:      "Renovación el día 12.",
      urgencia: "venc-rojo",
    }
  }
  if (diasRestantes === 2) {
    return {
      titulo:   `Vence en ${diasRestantes} días`,
      sub:      "Renovación el día 12.",
      urgencia: "venc-naranja",
    }
  }
  return {
    titulo:   `Vence en ${diasRestantes} días`,
    sub:      "Renovación el día 12.",
    urgencia: "venc-amarillo",
  }
})

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
  width: 42px;
  height: 42px;
  border-radius: v-bind("tenant.logoRadius");
  overflow: hidden;
  border: 1px solid v-bind("tenant.colors.accentBorder");
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
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.shift {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.40);
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
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: v-bind("tenant.colors.accentMuted");
}

.link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: 2px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.68);
  border: none;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.link:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.92);
  box-shadow: inset 3px 0 0 rgba(201, 162, 39, 0.40);
}

.link.active {
  background: rgba(201, 162, 39, 0.08);
  color: #fff;
  box-shadow: inset 3px 0 0 #c9a227;
}

.icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.32);
  transition: color 0.15s ease;
}

.link:hover .icon,
.icon.active {
  color: v-bind("tenant.colors.accent");
}

.label {
  font-weight: 600;
  font-size: 0.9rem;
  line-height: 1.2;
}

/* ── Banner de vencimiento ─────────────────────────── */
.venc-banner {
  margin: 10px 10px 0;
  border-radius: 2px;
  padding: 10px 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid;
  border-left-width: 3px;
}

.venc-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.venc-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.venc-title {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
}

.venc-sub {
  font-size: 11px;
  opacity: 0.75;
  line-height: 1.3;
}

/* Niveles de urgencia */
.venc-amarillo {
  background: rgba(234, 179, 8, 0.12);
  border-color: rgba(234, 179, 8, 0.35);
  color: #f0c040;
}
.venc-amarillo .venc-icon { color: #f0c040; }

.venc-naranja {
  background: rgba(249, 115, 22, 0.14);
  border-color: rgba(249, 115, 22, 0.40);
  color: #fb923c;
}
.venc-naranja .venc-icon { color: #fb923c; }

.venc-rojo {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.45);
  color: #f87171;
  animation: venc-pulse 2s ease-in-out infinite;
}
.venc-rojo .venc-icon { color: #f87171; }

@keyframes venc-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.7; }
}
/* ─────────────────────────────────────────────────── */

.footer {
  padding: 12px 16px;
  border-top: 1px solid v-bind("tenant.colors.accentBorder");
}

.powered {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: v-bind("tenant.developer.color");
  font-weight: 500;
  letter-spacing: 0.05em;
}
</style>