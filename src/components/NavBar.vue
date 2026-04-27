<script setup>
import { computed, ref, onMounted, watch, onBeforeUnmount } from "vue"
import { useRouter } from "vue-router"
import { clearSession, getSession } from "../auth/session"
import { getTurnoOperativo, turnoLabel } from "../ui/turnoOperativo"
import { cajaApi } from "../services/cajaApi"
import { tenant } from "../tenant.config"

const props = defineProps({
  sidebarOpen: { type: Boolean, default: false },
})

const emit = defineEmits(["toggle-sidebar"])

const router = useRouter()
const session = computed(() => getSession() ?? null)

function roleLabel(role) {
  const raw = String(role || "").toUpperCase()
  if (raw === "ADMIN")  return "ADMIN"
  if (raw === "CAJERO") return "CAJERO"
  return "EMPLEADO"
}

function logout() {
  clearSession()
  router.push({ name: "login" })
}

function toggleSidebar() {
  emit("toggle-sidebar")
}

const turnoActual = ref(getTurnoOperativo())
const cajaStatus  = ref("SIN_CAJA")

async function fetchCajaStatus() {
  try {
    const { data } = await cajaApi.abierta({ turno: turnoActual.value })

    if (!data) {
      cajaStatus.value = "SIN_CAJA"
      return
    }

    const estado = String(data.estado || "ABIERTA").toUpperCase()

    if (estado === "ABIERTA")      cajaStatus.value = "ABIERTA"
    else if (estado === "CERRADA") cajaStatus.value = "CERRADA"
    else                           cajaStatus.value = "SIN_CAJA"
  } catch {
    cajaStatus.value = "SIN_CAJA"
  }
}

const turnoActualLabel = computed(() => turnoLabel(turnoActual.value))

const cajaStatusText = computed(() => {
  if (cajaStatus.value === "ABIERTA")  return "Caja abierta"
  if (cajaStatus.value === "CERRADA")  return "Caja cerrada"
  return "Sin caja"
})

const cajaStatusClass = computed(() => {
  if (cajaStatus.value === "ABIERTA")  return "pill--success"
  if (cajaStatus.value === "CERRADA")  return "pill--danger"
  return "pill--warn"
})

function goCaja() {
  router.push({ name: "caja.dashboard" })
}

function onCajaChanged()        { fetchCajaStatus() }
function onTurnoChanged(event)  {
  turnoActual.value = event?.detail?.turno || getTurnoOperativo()
  fetchCajaStatus()
}

onMounted(() => {
  fetchCajaStatus()
  window.addEventListener("caja:changed",  onCajaChanged)
  window.addEventListener("turno:changed", onTurnoChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener("caja:changed",  onCajaChanged)
  window.removeEventListener("turno:changed", onTurnoChanged)
})

watch(
  () => session.value?.userId,
  () => fetchCajaStatus()
)
</script>

<template>
  <nav class="topbar">
    <div class="topbar__left">
      <button
        class="iconbtn topbar__hamb"
        type="button"
        @click="toggleSidebar"
        aria-label="Menú"
      >
        ☰
      </button>

      <button class="brand" type="button" @click="router.push({ name: 'dashboard' })">
        {{ tenant.nombre }}
      </button>

      <span class="pill pill--soft" v-if="session?.role">
        {{ roleLabel(session.role) }}
      </span>

      <button
        class="pill pill--status"
        :class="cajaStatusClass"
        type="button"
        @click="goCaja"
        :title="cajaStatusText"
      >
        <span class="status-dot" :class="cajaStatusClass"></span>
        <span>{{ cajaStatusText }}</span>
        <span class="sep">·</span>
        <span>Turno {{ turnoActualLabel }}</span>
      </button>
    </div>

    <div class="topbar__right">
      <span class="powered-tag">{{ tenant.developer.texto }}</span>
      <button class="btnlogout" @click="logout">Cerrar sesión</button>
    </div>
  </nav>
</template>

<style scoped>
.topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: rgba(11, 9, 4, 0.97);
  border-bottom: 1px solid rgba(180, 140, 60, 0.14);
  backdrop-filter: blur(8px);
}

.topbar__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 900;
  letter-spacing: 0.2px;
  padding: 6px 8px;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
}

.brand:hover {
  background: rgba(201, 162, 39, 0.08);
}

.iconbtn {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-size: 18px;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
}

.iconbtn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.92);
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
}

.pill--soft {
  border-color: rgba(201, 162, 39, 0.28);
  background: rgba(201, 162, 39, 0.08);
  color: rgba(201, 162, 39, 0.95);
}

.pill--status {
  cursor: pointer;
  transition: 0.18s ease;
}

.pill--status:hover {
  transform: translateY(-1px);
}

.pill--success {
  border-color: rgba(39, 209, 127, 0.24);
  background: rgba(39, 209, 127, 0.08);
}

.pill--danger {
  border-color: rgba(255, 107, 107, 0.22);
  background: rgba(255, 107, 107, 0.08);
}

.pill--warn {
  border-color: rgba(255, 193, 7, 0.24);
  background: rgba(255, 193, 7, 0.08);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  display: inline-block;
}

.status-dot.pill--success {
  background: #27d17f;
  box-shadow: 0 0 0 4px rgba(39, 209, 127, 0.12);
}

.status-dot.pill--danger {
  background: #ff6b6b;
  box-shadow: 0 0 0 4px rgba(255, 107, 107, 0.10);
}

.status-dot.pill--warn {
  background: #ffc107;
  box-shadow: 0 0 0 4px rgba(255, 193, 7, 0.10);
}

.sep {
  opacity: 0.45;
}

.powered-tag {
  font-size: 11px;
  color: rgba(201, 162, 39, 0.55);
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.btnlogout {
  border: 1px solid rgba(201, 162, 39, 0.30);
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  padding: 8px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: 0.18s ease;
}

.btnlogout:hover {
  background: rgba(201, 162, 39, 0.10);
}

.topbar__hamb {
  display: none;
}

@media (max-width: 991.98px) {
  .topbar__hamb {
    display: inline-flex;
  }

  .pill--soft {
    display: none;
  }
}

@media (max-width: 768px) {
  .powered-tag {
    display: none;
  }
}

@media (max-width: 640px) {
  .pill--status {
    display: none;
  }

  .topbar {
    padding: 0 10px;
  }

  .brand {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>