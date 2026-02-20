<script setup>
import { computed, ref, onMounted, watch, onBeforeUnmount } from "vue"
import { useRouter } from "vue-router"
import { clearSession, getSession } from "../auth/session"
import { cajaApi } from "../services/cajaApi"

const props = defineProps({
  sidebarOpen: { type: Boolean, default: false },
})

const emit = defineEmits(["toggle-sidebar"])

const router = useRouter()
const session = computed(() => getSession())

const isAdmin = computed(() => session.value?.role === "ADMIN")

function logout() {
  clearSession()
  router.push({ name: "login" })
}

function toggleSidebar() {
  emit("toggle-sidebar")
}

// -------- helpers turno --------
function turnoBE(t) {
  const s = String(t ?? "").toUpperCase()
  if (s === "MAÑANA" || s === "MANIANA") return "MANIANA"
  return "TARDE"
}
function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// -------- Caja status global --------
const cajaStatus = ref("SIN_CAJA") // ABIERTA | CERRADA | SIN_CAJA
const cajaId = ref(null)

async function fetchCajaStatus() {
  try {
    const fecha = todayISO()
    const turno = turnoBE(session.value?.shift || "MAÑANA")
    const userId = Number(session.value?.userId ?? 0) || 1

    const { data } = await cajaApi.abierta({ fecha, turno, userId })

    if (!data) {
      cajaStatus.value = "SIN_CAJA"
      cajaId.value = null
      return
    }

    cajaId.value = data.cajaId ?? data.id ?? null
    const estado = String(data.estado || "").toUpperCase()

    if (estado === "ABIERTA") cajaStatus.value = "ABIERTA"
    else if (estado === "CERRADA") cajaStatus.value = "CERRADA"
    else cajaStatus.value = "SIN_CAJA"
  } catch {
    cajaStatus.value = "SIN_CAJA"
    cajaId.value = null
  }
}

function goCaja() {
  router.push({ name: "caja.dashboard" })
}

function onCajaChanged() {
  fetchCajaStatus()
}

onMounted(() => {
  fetchCajaStatus()
  window.addEventListener("caja:changed", onCajaChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener("caja:changed", onCajaChanged)
})

// si cambia turno o usuario, refresco
watch(
  () => [session.value?.shift, session.value?.userId],
  () => fetchCajaStatus()
)
</script>

<template>
  <nav class="topbar">
    <div class="topbar__left">
      <!-- hamburger solo mobile -->
      <button class="iconbtn topbar__hamb" type="button" @click="toggleSidebar" aria-label="Menu">
        ☰
      </button>

      <button class="brand" type="button" @click="router.push({ name: 'dashboard' })">
        GestionaTuNegocio
      </button>

      <span class="pill pill--soft" v-if="session?.role">
        {{ session.role }}<span v-if="session?.role !== 'ADMIN' && session?.shift"> • {{ session.shift }}</span>
      </span>

      <button
        class="pill pill--status"
        type="button"
        @click="(cajaStatus !== 'ABIERTA') && goCaja()"
        :title="cajaStatus === 'ABIERTA' ? 'Caja abierta' : 'Ir a Caja para abrir/cerrar'"
      >
        <span v-if="cajaStatus === 'ABIERTA'">🟢 CAJA ABIERTA</span>
        <span v-else-if="cajaStatus === 'CERRADA'">🔴 CAJA CERRADA</span>
        <span v-else>⚠️ SIN CAJA</span>
        <span v-if="cajaId"> • #{{ cajaId }}</span>
      </button>

      <span class="hint" v-if="isAdmin">ADMIN</span>
    </div>

    <div class="topbar__right">
      <button class="btnlogout" @click="logout">Cerrar sesión</button>
    </div>
  </nav>
</template>

<style scoped>
.topbar{
  height: 56px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 0 12px;
  background: #0b0b10;
  border-bottom: 1px solid rgba(255,255,255,.08);
}

.topbar__left{
  display:flex;
  align-items:center;
  gap: 10px;
  min-width: 0;
}

.brand{
  border: none;
  background: transparent;
  color: rgba(255,255,255,.92);
  font-weight: 800;
  letter-spacing: .2px;
  padding: 6px 8px;
  border-radius: 10px;
  cursor:pointer;
}
.brand:hover{ background: rgba(255,255,255,.06); }

.iconbtn{
  border:none;
  background: transparent;
  color: rgba(255,255,255,.9);
  font-size: 18px;
  padding: 6px 10px;
  border-radius: 10px;
  cursor:pointer;
}
.iconbtn:hover{ background: rgba(255,255,255,.06); }

/* pills */
.pill{
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.04);
  color: rgba(255,255,255,.9);
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
}
.pill--soft{
  border-color: rgba(202,166,255,.20);
}
.pill--status{
  border-color: rgba(202,166,255,.25);
}
.pill--status:hover{
  background: rgba(202,166,255,.10);
}

.hint{
  font-size: 11px;
  opacity: .65;
}

.btnlogout{
  border: 1px solid rgba(202,166,255,.35);
  background: transparent;
  color: rgba(255,255,255,.9);
  padding: 8px 12px;
  border-radius: 12px;
  cursor: pointer;
}
.btnlogout:hover{
  background: rgba(202,166,255,.12);
}

/* mobile tweaks */
.topbar__hamb{ display:none; }

@media (max-width: 991.98px){
  .topbar__hamb{ display:inline-flex; }
  .pill--soft{ display:none; }     /* deja respirar */
  .hint{ display:none; }
}
@media (max-width: 520px){
  .pill--status{ display:none; }   /* en muy chico, fuera */
}
</style>
