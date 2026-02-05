<!-- src/views/CajaView.vue (BACKEND) -->
<script setup>
import { computed, ref, onMounted } from "vue"
import { getSession, isAdmin } from "../auth/session"

import { cajaApi } from "../services/cajaApi"
import { movimientosCajaApi } from "../services/movimientosCajaApi"

const session = getSession() ?? null
const admin = computed(() => Boolean(session && isAdmin()))
const userId = session?.userId ?? null

const loading = ref(false)
const errorMsg = ref("")
const okMsg = ref("")

const cajaAbierta = ref(null)
const movimientos = ref([])
const resumen = ref({ ingresos: 0, egresos: 0, saldo: 0 })

// inputs (abrir/cerrar)
const abrirMontoInicial = ref("")
const cerrarMontoFinal = ref("")

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
}

function toMoneyNumber(v) {
  const x = Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(x) ? x : NaN
}

function calcResumen(caja, movs) {
  const ingresos = (movs ?? [])
    .filter((m) => m.tipo === "INGRESO")
    .reduce((a, m) => a + Number(m.monto || 0), 0)

  const egresos = (movs ?? [])
    .filter((m) => m.tipo === "EGRESO")
    .reduce((a, m) => a + Number(m.monto || 0), 0)

  const saldo =
    Number(caja?.montoInicial || 0) + ingresos - egresos

  return { ingresos, egresos, saldo }
}

async function refresh() {
  loading.value = true
  errorMsg.value = ""
  okMsg.value = ""

  try {
    // 1) Caja abierta
    const { data } = await cajaApi.abierta()
    cajaAbierta.value = data ?? null

    // 2) Movimientos + resumen
    movimientos.value = []
    resumen.value = { ingresos: 0, egresos: 0, saldo: 0 }

    if (cajaAbierta.value?.cajaId) {
      const { data: movs } = await movimientosCajaApi.porCajaId(cajaAbierta.value.cajaId)
      movimientos.value = Array.isArray(movs) ? movs : []
      resumen.value = calcResumen(cajaAbierta.value, movimientos.value)
    }
  } catch (e) {
    cajaAbierta.value = null
    movimientos.value = []
    resumen.value = { ingresos: 0, egresos: 0, saldo: 0 }
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data ||
      e?.message ||
      "No hay caja ABIERTA (backend)."
  } finally {
    loading.value = false
  }
}

async function abrirCaja() {
  errorMsg.value = ""
  okMsg.value = ""

  const monto = toMoneyNumber(abrirMontoInicial.value)
  if (!Number.isFinite(monto) || monto < 0) {
    errorMsg.value = "Ingresá un monto inicial válido."
    return
  }

  try {
    // Ajustá payload según tu endpoint real:
    // si tu backend requiere userId/turno/fecha, agregalo acá.
    const payload = {
      montoInicial: monto,
      userId: Number.isFinite(Number(userId)) ? Number(userId) : null,
    }

    await cajaApi.abrir(payload) // <- tenés que tener este método
    okMsg.value = "Caja abierta ✅"
    abrirMontoInicial.value = ""
    await refresh()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data ||
      e?.message ||
      "Error abriendo caja."
  }
}

async function cerrarCaja() {
  errorMsg.value = ""
  okMsg.value = ""

  const monto = toMoneyNumber(cerrarMontoFinal.value)
  if (!Number.isFinite(monto) || monto < 0) {
    errorMsg.value = "Ingresá un monto final válido."
    return
  }

  if (!cajaAbierta.value?.cajaId) {
    errorMsg.value = "No hay caja ABIERTA para cerrar."
    return
  }

  try {
    const payload = { montoFinal: monto }
    await cajaApi.cerrar(cajaAbierta.value.cajaId, payload) // <- tu ruta /cajas/{id}/cerrar
    okMsg.value = "Caja cerrada ✅"
    cerrarMontoFinal.value = ""
    await refresh()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data ||
      e?.message ||
      "Error cerrando caja."
  }
}

// últimos movimientos
const ultimosMovs = computed(() => movimientos.value.slice(0, 10))

onMounted(() => refresh())
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
      <div>
        <h1 class="h4 mb-1">Caja</h1>
        <div class="text-secondary">
          <span v-if="admin">Vista ADMIN.</span>
          <span v-else>Vista CAJERO.</span>
        </div>
      </div>

      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-light" @click="refresh" :disabled="loading">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>

        <RouterLink class="btn btn-sm btn-primary btn-accent" to="/caja/ventas">
          Ir a Ventas
        </RouterLink>

        <RouterLink class="btn btn-sm btn-outline-light" to="/caja/movimientos">
          Ver todos los movimientos
        </RouterLink>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <!-- Estado caja + resumen -->
    <div class="row g-3 mb-3">
      <div class="col-12 col-lg-5">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-secondary small">Estado</div>

            <div v-if="cajaAbierta?.cajaId" class="mt-2">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <span class="badge text-bg-success">ABIERTA</span>
                  <div class="text-secondary small mt-2">
                    Caja ID: <b>{{ cajaAbierta.cajaId }}</b>
                  </div>
                </div>
                <div class="text-end">
                  <div class="text-secondary small">Monto inicial</div>
                  <div class="fw-bold">$ {{ formatMoney(cajaAbierta.montoInicial) }}</div>
                </div>
              </div>
            </div>

            <div v-else class="mt-2 text-secondary">
              No hay caja abierta.
            </div>

            <hr class="border-secondary my-3" />

            <div class="row g-2">
              <div class="col-4">
                <div class="text-secondary small">Ingresos</div>
                <div class="fw-bold">$ {{ formatMoney(resumen.ingresos) }}</div>
              </div>
              <div class="col-4">
                <div class="text-secondary small">Egresos</div>
                <div class="fw-bold">$ {{ formatMoney(resumen.egresos) }}</div>
              </div>
              <div class="col-4">
                <div class="text-secondary small">Saldo</div>
                <div class="fw-bold">$ {{ formatMoney(resumen.saldo) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Acciones -->
      <div class="col-12 col-lg-7">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <h2 class="h6 mb-3">Acciones</h2>

            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label text-secondary">Monto inicial (abrir)</label>
                <input
                  v-model="abrirMontoInicial"
                  class="form-control bg-dark text-white border-secondary"
                  placeholder="Ej: 20000"
                  inputmode="numeric"
                  :disabled="loading"
                />
                <button class="btn btn-primary btn-accent w-100 mt-2" @click="abrirCaja" :disabled="loading || !!cajaAbierta?.cajaId">
                  Abrir caja
                </button>
                <div class="text-secondary small mt-2" v-if="cajaAbierta?.cajaId">
                  Ya hay una caja abierta.
                </div>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label text-secondary">Monto final (cerrar)</label>
                <input
                  v-model="cerrarMontoFinal"
                  class="form-control bg-dark text-white border-secondary"
                  placeholder="Ej: 35000"
                  inputmode="numeric"
                  :disabled="loading || !cajaAbierta?.cajaId"
                />
                <button class="btn btn-outline-light w-100 mt-2" @click="cerrarCaja" :disabled="loading || !cajaAbierta?.cajaId">
                  Cerrar caja
                </button>
                <div class="text-secondary small mt-2" v-if="!cajaAbierta?.cajaId">
                  No hay caja abierta para cerrar.
                </div>
              </div>
            </div>

            <div class="text-secondary small mt-3">
              Tip: dejá Caja como “dashboard” y Ventas/MOVs como pantallas dedicadas.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Últimos movimientos -->
    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 class="h6 mb-0">Últimos movimientos</h2>
          <RouterLink to="/caja/movimientos" class="btn btn-sm btn-outline-light">
            Ver todos
          </RouterLink>
        </div>

        <div v-if="!cajaAbierta?.cajaId" class="text-secondary">
          Abrí una caja para ver movimientos.
        </div>

        <div v-else-if="ultimosMovs.length === 0" class="text-secondary">
          No hay movimientos todavía.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 160px;">Fecha/Hora</th>
                <th style="width: 110px;">Tipo</th>
                <th>Detalle</th>
                <th style="width: 140px;" class="text-end">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in ultimosMovs" :key="m.movimientoId ?? m.id">
                <td class="text-secondary">
                  {{m.createdAt ? new Date(m.createdAt).toLocaleString("es-AR") : "—"}}
                </td>
                <td>
                  <span class="badge" :class="m.tipo === 'INGRESO' ? 'text-bg-success' : 'text-bg-danger'">
                    {{ m.tipo }}
                  </span>
                </td>
                <td class="text-secondary">{{ m.detalle ?? m.descripcion ?? "—" }}</td>
                <td class="text-end fw-bold">$ {{ formatMoney(m.monto) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-3">
          Si querés, después agregamos filtros por fecha/tipo y paginado en la ruta /caja/movimientos.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-panel{ background: rgba(18, 22, 32, .92); }
.btn-accent{ background: #6f5cff; border: none; }
.btn-accent:hover{ background: #5f4de6; }
</style>
