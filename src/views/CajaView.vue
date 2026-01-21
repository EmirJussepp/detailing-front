<script setup>
import { computed, ref } from 'vue'
import { getSession, isAdmin, getShift } from '../auth/session'

const session = getSession()

const admin = computed(() => isAdmin())
const userId = session?.userId ?? 'anon'

// ✅ aislado por usuario
const STORAGE_KEY = `cajas_v1:${userId}`

const errorMsg = ref('')
const abrirMontoInicial = ref('')
const cerrarMontoFinal = ref('')

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
const fecha = ref(todayISO())

// ✅ turno fijo para CASHIER, libre para ADMIN
const turnoSel = ref(admin.value ? 'MAÑANA' : (getShift() ?? 'MAÑANA'))

function makeKey(fechaStr, turno) {
  return `${fechaStr}|${turno}`
}

function loadCajas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCajas(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

const cajas = ref(loadCajas())

function getCaja(turno) {
  return cajas.value[makeKey(fecha.value, turno)] ?? null
}

function setCaja(turno, data) {
  cajas.value = { ...cajas.value, [makeKey(fecha.value, turno)]: data }
  saveCajas(cajas.value)
}

function ensureUUID() {
  return (crypto?.randomUUID?.() ?? String(Date.now() + Math.random()))
}

function calcSaldo(caja) {
  if (!caja) return 0
  const inicial = Number(caja.montoInicial ?? 0)
  const ventas = Number(caja.ventasTotal ?? 0)
  const ingresos = Number(caja.ingresos ?? 0)
  const egresos = Number(caja.egresos ?? 0)
  return inicial + ventas + ingresos - egresos
}

const cajaManiana = computed(() => getCaja('MAÑANA'))
const cajaTarde = computed(() => getCaja('TARDE'))

const saldoManiana = computed(() => calcSaldo(cajaManiana.value))
const saldoTarde = computed(() => calcSaldo(cajaTarde.value))

const generalDelDia = computed(() => saldoManiana.value + saldoTarde.value)

const cajaTurnoActual = computed(() => getCaja(turnoSel.value))
const saldoTurnoActual = computed(() => calcSaldo(cajaTurnoActual.value))

function abrirCaja() {
  errorMsg.value = ''
  const monto = Number(String(abrirMontoInicial.value).replace(',', '.'))

  if (!Number.isFinite(monto) || monto < 0) {
    errorMsg.value = 'Ingresá un monto inicial válido.'
    return
  }

  const existente = getCaja(turnoSel.value)
  if (existente?.estado === 'ABIERTA') {
    errorMsg.value = `La caja ${turnoSel.value} ya está ABIERTA.`
    return
  }

  const nueva = {
    id: ensureUUID(),
    fecha: fecha.value,
    turno: turnoSel.value,
    estado: 'ABIERTA',
    montoInicial: monto,
    montoFinal: null,
    ventasTotal: existente?.ventasTotal ?? 0,
    ingresos: existente?.ingresos ?? 0,
    egresos: existente?.egresos ?? 0,
    createdAt: new Date().toISOString(),
    closedAt: null
  }

  setCaja(turnoSel.value, nueva)
  abrirMontoInicial.value = ''
}

function cerrarCaja() {
  errorMsg.value = ''
  const monto = Number(String(cerrarMontoFinal.value).replace(',', '.'))

  if (!Number.isFinite(monto) || monto < 0) {
    errorMsg.value = 'Ingresá un monto final válido.'
    return
  }

  const actual = getCaja(turnoSel.value)
  if (!actual || actual.estado !== 'ABIERTA') {
    errorMsg.value = `No hay caja ${turnoSel.value} ABIERTA para cerrar.`
    return
  }

  const cerrada = {
    ...actual,
    estado: 'CERRADA',
    montoFinal: monto,
    closedAt: new Date().toISOString()
  }

  setCaja(turnoSel.value, cerrada)
  cerrarMontoFinal.value = ''
}

function resetDiaAdmin() {
  if (!admin.value) return
  const obj = { ...cajas.value }
  delete obj[makeKey(fecha.value, 'MAÑANA')]
  delete obj[makeKey(fecha.value, 'TARDE')]
  cajas.value = obj
  saveCajas(obj)
  abrirMontoInicial.value = ''
  cerrarMontoFinal.value = ''
  errorMsg.value = ''
}

function badgeClass(estado) {
  if (estado === 'ABIERTA') return 'text-bg-success'
  if (estado === 'CERRADA') return 'text-bg-secondary'
  return 'text-bg-dark border'
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString('es-AR', { minimumFractionDigits: 0 })
}
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
      <div>
        <h1 class="h4 mb-1">Caja</h1>
        <div class="text-secondary">
          <span v-if="admin">Vista ADMIN: ver ambos turnos + general.</span>
          <span v-else>Vista CAJERO: solo tu turno ({{ turnoSel }}).</span>
        </div>
      </div>

      <div class="d-flex gap-2" v-if="admin">
        <button class="btn btn-sm btn-outline-light" @click="resetDiaAdmin">
          Reset día (admin)
        </button>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>

    <!-- CONTROLES -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Fecha</label>
            <input v-model="fecha" type="date" class="form-control bg-dark text-white border-secondary" :disabled="!admin" />
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
            <div class="d-flex flex-wrap gap-2 justify-content-md-end">
              <button class="btn btn-primary btn-accent" @click="abrirCaja">Abrir caja</button>
              <button class="btn btn-outline-light" @click="cerrarCaja">Cerrar caja</button>
            </div>
          </div>
        </div>

        <div class="small text-secondary mt-3">
          El turno seleccionado define qué caja se abre/cierra.
        </div>
      </div>
    </div>

    <!-- ADMIN: resumen general -->
    <div class="row g-3 mb-3" v-if="admin">
      <div class="col-12 col-lg-4">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-secondary small">General del día</div>
            <div class="fs-3 fw-bold mt-1">$ {{ formatMoney(generalDelDia) }}</div>
            <div class="text-secondary small mt-2">
              (Saldo teórico = inicial + ventas + ingresos - egresos)
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-4">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="text-secondary small">Caja MAÑANA</div>
                <div class="fw-semibold mt-1">
                  <span class="badge" :class="badgeClass(cajaManiana?.estado)">
                    {{ cajaManiana?.estado ?? 'SIN CAJA' }}
                  </span>
                </div>
              </div>
              <div class="text-end">
                <div class="text-secondary small">Saldo</div>
                <div class="fw-bold">$ {{ formatMoney(saldoManiana) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-4">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="text-secondary small">Caja TARDE</div>
                <div class="fw-semibold mt-1">
                  <span class="badge" :class="badgeClass(cajaTarde?.estado)">
                    {{ cajaTarde?.estado ?? 'SIN CAJA' }}
                  </span>
                </div>
              </div>
              <div class="text-end">
                <div class="text-secondary small">Saldo</div>
                <div class="fw-bold">$ {{ formatMoney(saldoTarde) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CAJERO: solo su caja -->
    <div class="card bg-panel border-0 shadow-sm mb-3" v-else>
      <div class="card-body">
        <div class="text-secondary small">Tu caja ({{ turnoSel }})</div>
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-1">
          <div class="fw-semibold">
            <span class="badge" :class="badgeClass(cajaTurnoActual?.estado)">
              {{ cajaTurnoActual?.estado ?? 'SIN CAJA' }}
            </span>
          </div>
          <div class="text-end">
            <div class="text-secondary small">Saldo</div>
            <div class="fw-bold">$ {{ formatMoney(saldoTurnoActual) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Inputs rápidos -->
    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <h2 class="h6 mb-3">Acción rápida — {{ turnoSel }}</h2>

        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Monto inicial (para abrir)</label>
            <input v-model="abrirMontoInicial" class="form-control bg-dark text-white border-secondary" placeholder="Ej: 20000" inputmode="numeric" />
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Monto final (para cerrar)</label>
            <input v-model="cerrarMontoFinal" class="form-control bg-dark text-white border-secondary" placeholder="Ej: 35000" inputmode="numeric" />
          </div>
        </div>

        <div class="text-secondary small mt-3">
          Próximo paso: Ventas suma automáticamente en <b>ventasTotal</b> del turno.
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
