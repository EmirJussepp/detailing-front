<script setup>
import { computed, ref, watch } from "vue"
import { getSession, isAdmin, getShift } from "../auth/session"
import { cajaApi } from "../services/cajaApi"
import { movimientosCajaApi } from "../services/movimientosCajaApi"

// =========================
// Helpers
// =========================
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
}

function turnoUI(t) {
  const s = String(t ?? "").toUpperCase()
  if (s === "MANIANA" || s === "MAÑANA") return "MAÑANA"
  if (s === "TARDE") return "TARDE"
  return "MAÑANA"
}
function turnoBE(t) {
  return turnoUI(t) === "MAÑANA" ? "MANIANA" : "TARDE"
}

function resolveUserId(sess) {
  const v = sess?.userId
  const n = Number(v)
  if (Number.isFinite(n) && n > 0) return n
  // fallback bien básico por si tu sesión mock trae texto
  const s = String(v ?? "").toLowerCase()
  if (s.includes("maniana")) return 1
  if (s.includes("tarde")) return 2
  return 1
}

// =========================
// Session / permisos
// =========================
const session = getSession() ?? null
const admin = computed(() => Boolean(session && isAdmin()))
const userIdInt = computed(() => resolveUserId(session))

// =========================
// Filtros
// =========================
const fecha = ref(todayISO())
const turnoSel = ref(turnoUI(admin.value ? "MAÑANA" : getShift()))

// =========================
// Estado
// =========================
const errorMsg = ref("")
const okMsg = ref("")

const cajaCheck = ref({ ok: false, error: "" })
const cajaAbierta = ref(null)

const movimientos = ref([])
const resumen = ref({ ingresos: 0, egresos: 0, saldo: 0 })

const canSee = computed(() => cajaCheck.value?.ok === true && Boolean(cajaAbierta.value?.cajaId))

// =========================
// API
// =========================
async function refreshCaja() {
  try {
    const { data } = await cajaApi.abierta({
      fecha: fecha.value,
      turno: turnoBE(turnoSel.value),
      userId: userIdInt.value,
    })
    cajaAbierta.value = data ?? null
    cajaCheck.value = { ok: true, error: "" }
  } catch (e) {
    const status = e?.response?.status
    const msg = e?.response?.data?.message || e?.response?.data?.error || ""
    cajaAbierta.value = null

    if (status === 404 && String(msg).toLowerCase().includes("no hay caja abierta")) {
      cajaCheck.value = { ok: false, error: "No hay caja ABIERTA para esa fecha/turno." }
    } else {
      cajaCheck.value = { ok: false, error: msg || "Error consultando caja (backend)." }
    }
  }
}

async function refreshMovimientos() {
  movimientos.value = []
  resumen.value = { ingresos: 0, egresos: 0, saldo: 0 }

  if (!cajaAbierta.value?.cajaId) return

  const { data } = await movimientosCajaApi.porCajaId(cajaAbierta.value.cajaId)
  movimientos.value = Array.isArray(data) ? data : []

  const ingresos = movimientos.value
    .filter((m) => String(m.tipo).toUpperCase() === "INGRESO")
    .reduce((a, m) => a + Number(m.monto || 0), 0)

  const egresos = movimientos.value
    .filter((m) => String(m.tipo).toUpperCase() === "EGRESO")
    .reduce((a, m) => a + Number(m.monto || 0), 0)

  const saldo = Number(cajaAbierta.value.montoInicial || 0) + ingresos - egresos
  resumen.value = { ingresos, egresos, saldo }
}

async function refreshAll() {
  errorMsg.value = ""
  okMsg.value = ""

  await refreshCaja()
  if (!cajaAbierta.value?.cajaId) return

  await refreshMovimientos()
  okMsg.value = "Movimientos actualizados ✅"
}

// Auto refresh al cambiar filtros
watch([fecha, turnoSel, admin], async () => {
  try {
    await refreshAll()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error refrescando movimientos."
  }
}, { immediate: true })
</script>

<template>
  <div class="container py-4">
    <div class="mb-3">
      <h1 class="h4 mb-1">Movimientos de Caja</h1>
      <div class="text-secondary">
        <span v-if="admin">Vista ADMIN: podés elegir fecha y turno.</span>
        <span v-else>Vista CAJERO: solo tu turno ({{ turnoSel }}).</span>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <!-- Controles -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Fecha</label>
            <input
              v-model="fecha"
              type="date"
              class="form-control bg-dark text-white border-secondary"
              :disabled="!admin"
            />
          </div>

          <div class="col-12 col-md-3" v-if="admin">
            <label class="form-label text-secondary">Turno</label>
            <select v-model="turnoSel" class="form-select bg-dark text-white border-secondary">
              <option value="MAÑANA">MAÑANA</option>
              <option value="TARDE">TARDE</option>
            </select>
          </div>

          <div class="col-12 col-md-3" v-else>
            <label class="form-label text-secondary">Turno</label>
            <input class="form-control bg-dark text-white border-secondary" :value="turnoSel" disabled />
          </div>

          <div class="col-12 col-md-6">
            <div v-if="!canSee" class="alert alert-warning py-2 mb-0">
              {{ cajaCheck.error }}
            </div>
            <div v-else class="small text-secondary">
              Caja ABIERTA ✅
              <span class="ms-2">
                · Caja #<b>{{ cajaAbierta.cajaId }}</b>
                · Ingresos: <b>$ {{ formatMoney(resumen.ingresos) }}</b>
                · Egresos: <b>$ {{ formatMoney(resumen.egresos) }}</b>
                · Saldo: <b>$ {{ formatMoney(resumen.saldo) }}</b>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabla -->
    <div class="card bg-panel border-0 shadow-sm" v-if="canSee">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h6 mb-0">Movimientos del turno</h2>
          <button class="btn btn-sm btn-outline-light" @click="refreshAll">
            Refrescar
          </button>
        </div>

        <div v-if="!movimientos.length" class="text-secondary small">
          No hay movimientos todavía.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 120px">Tipo</th>
                <th style="width: 160px">Concepto</th>
                <th>Descripción</th>
                <th style="width: 140px">Refs</th>
                <th style="width: 160px" class="text-end">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in movimientos" :key="m.movimientoCajaId ?? m.id">
                <td class="text-secondary">{{ m.tipo }}</td>
                <td class="text-secondary">{{ m.concepto ?? "-" }}</td>
                <td class="text-secondary">{{ m.descripcion ?? "-" }}</td>

                <td class="text-secondary small">
                  <span v-if="m.ventaId">Vta #{{ m.ventaId }}</span>
                  <span v-else-if="m.compraId">Cmp #{{ m.compraId }}</span>
                  <span v-else>-</span>
                </td>

                <td class="text-end fw-bold">$ {{ formatMoney(m.monto) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-2">
          ✅ Estos datos vienen del endpoint <b>/movimientos-caja/caja/:cajaId</b>.
        </div>
      </div>
    </div>
  </div>
</template>



<style scoped>
.bg-panel{ background: rgba(18, 22, 32, .92); }
</style>
