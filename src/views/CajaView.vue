<script setup>
import { computed, ref } from 'vue'

/**
 * Storage
 * Guardamos todas las cajas en un objeto:
 * cajas["YYYY-MM-DD|MAÑANA"] = { ... }
 * cajas["YYYY-MM-DD|TARDE"] = { ... }
 */
const STORAGE_KEY = 'cajas_v1'

const turnoSel = ref('MAÑANA')
const errorMsg = ref('')
const abrirMontoInicial = ref('')
const cerrarMontoFinal = ref('')

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
const fecha = ref(todayISO())

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
  cajas.value = {
    ...cajas.value,
    [makeKey(fecha.value, turno)]: data
  }
  saveCajas(cajas.value)
}

function ensureUUID() {
  return (crypto?.randomUUID?.() ?? String(Date.now() + Math.random()))
}

/** Calcula el "saldo" de una caja (mock) */
function calcSaldo(caja) {
  if (!caja) return 0
  const inicial = Number(caja.montoInicial ?? 0)
  const ventas = Number(caja.ventasTotal ?? 0)
  const ingresos = Number(caja.ingresos ?? 0)
  const egresos = Number(caja.egresos ?? 0)
  // saldo teórico (sin contar "montoFinal")
  return inicial + ventas + ingresos - egresos
}

const cajaManiana = computed(() => getCaja('MAÑANA'))
const cajaTarde = computed(() => getCaja('TARDE'))

const saldoManiana = computed(() => calcSaldo(cajaManiana.value))
const saldoTarde = computed(() => calcSaldo(cajaTarde.value))

const generalDelDia = computed(() => {
  return saldoManiana.value + saldoTarde.value
})

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

    // mock de totales (ventas luego)
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

/** Utilidad para resetear el día (solo mock/dev) */
function resetDia() {
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
          Gestión por turno (MAÑANA / TARDE) + General del día.
        </div>
      </div>

      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-light" @click="resetDia">
          Reset día (mock)
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
            <input v-model="fecha" type="date" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Turno</label>
            <select v-model="turnoSel" class="form-select bg-dark text-white border-secondary">
              <option value="MAÑANA">MAÑANA</option>
              <option value="TARDE">TARDE</option>
            </select>
          </div>

          <div class="col-12 col-md-6">
            <div class="d-flex flex-wrap gap-2 justify-content-md-end">
              <button class="btn btn-primary btn-accent" @click="abrirCaja">
                Abrir caja
              </button>
              <button class="btn btn-outline-light" @click="cerrarCaja">
                Cerrar caja
              </button>
            </div>
          </div>
        </div>

        <div class="small text-secondary mt-3">
          Tip: Abrís/cerrás la caja del turno seleccionado. El General del día suma ambos turnos.
        </div>
      </div>
    </div>

    <!-- RESUMEN GENERAL -->
    <div class="row g-3 mb-3">
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

            <hr class="my-3 border-secondary-subtle" />

            <div class="d-flex flex-wrap gap-3 small">
              <div><span class="text-secondary">Inicial:</span> $ {{ formatMoney(cajaManiana?.montoInicial) }}</div>
              <div><span class="text-secondary">Ventas:</span> $ {{ formatMoney(cajaManiana?.ventasTotal) }}</div>
              <div><span class="text-secondary">Ing.:</span> $ {{ formatMoney(cajaManiana?.ingresos) }}</div>
              <div><span class="text-secondary">Egr.:</span> $ {{ formatMoney(cajaManiana?.egresos) }}</div>
              <div v-if="cajaManiana?.montoFinal !== null">
                <span class="text-secondary">Final:</span> $ {{ formatMoney(cajaManiana?.montoFinal) }}
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

            <hr class="my-3 border-secondary-subtle" />

            <div class="d-flex flex-wrap gap-3 small">
              <div><span class="text-secondary">Inicial:</span> $ {{ formatMoney(cajaTarde?.montoInicial) }}</div>
              <div><span class="text-secondary">Ventas:</span> $ {{ formatMoney(cajaTarde?.ventasTotal) }}</div>
              <div><span class="text-secondary">Ing.:</span> $ {{ formatMoney(cajaTarde?.ingresos) }}</div>
              <div><span class="text-secondary">Egr.:</span> $ {{ formatMoney(cajaTarde?.egresos) }}</div>
              <div v-if="cajaTarde?.montoFinal !== null">
                <span class="text-secondary">Final:</span> $ {{ formatMoney(cajaTarde?.montoFinal) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ACCIONES DEL TURNO SELECCIONADO -->
    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <h2 class="h6 mb-3">Acción rápida — {{ turnoSel }}</h2>

        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Monto inicial (para abrir)</label>
            <input
              v-model="abrirMontoInicial"
              class="form-control bg-dark text-white border-secondary"
              placeholder="Ej: 20000"
              inputmode="numeric"
            />
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Monto final (para cerrar)</label>
            <input
              v-model="cerrarMontoFinal"
              class="form-control bg-dark text-white border-secondary"
              placeholder="Ej: 35000"
              inputmode="numeric"
            />
          </div>
        </div>

        <div class="text-secondary small mt-3">
          Próximo paso: conectar Ventas para que sume automáticamente en <b>ventasTotal</b> del turno.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Dark sobrio */
.bg-panel{
  background: rgba(18, 22, 32, .92);
}

/* Acento 3Byte (morado sutil) */
.btn-accent{
  background: #6f5cff;
  border: none;
}
.btn-accent:hover{
  background: #5f4de6;
}
</style>
