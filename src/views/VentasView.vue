<script setup>
import { computed, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { getSession, isAdmin, getShift } from "../auth/session"

import { cajaApi } from "../services/cajaApi"
import { ventasApi } from "../services/ventasApi"
import { movimientosCajaApi } from "../services/movimientosCajaApi"
import { productosApi } from "../services/productosApi"
import { clientesApi } from "../services/clientesApi"
import { tipoClientesApi } from "../services/tipoClienteService"
import { pagosApi } from "../services/pagosApi"
import { metodosPagoApi } from "../services/metodopagoService"
import { mapCliente } from "../mappers/clientes"

// =========================
// Router
// =========================
const route = useRoute()
const router = useRouter()

function goCreateCliente() {
  router.push({ name: "clientes", query: { from: "ventas" } })
}

// =========================
// Session / permisos
// =========================
const saving = ref(false)

const session = getSession() ?? null
const admin = computed(() => Boolean(session && isAdmin()))

function resolveUserId(sess) {
  const v = sess?.userId
  const n = Number(v)
  if (Number.isFinite(n) && n > 0) return n

  const s = String(v ?? "").toLowerCase()
  if (s.includes("maniana")) return 1
  if (s.includes("tarde")) return 2

  return 1
}

const userIdInt = computed(() => resolveUserId(session))

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const fecha = ref(todayISO())
const turnoSel = ref(admin.value ? "MAÑANA" : (getShift() ?? "MAÑANA"))

const errorMsg = ref("")
const okMsg = ref("")

const notes = ref("")

function turnoBackend(t) {
  return t === "MAÑANA" ? "MANIANA" : t
}

// =========================
// Helpers
// =========================
function ensureUUID() {
  return crypto?.randomUUID?.() ?? String(Date.now() + Math.random())
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
}

function clamp(n, min, max) {
  const x = Number(n)
  if (!Number.isFinite(x)) return min
  return Math.min(max, Math.max(min, x))
}

function toMoneyNumber(v) {
  const x = Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(x) ? x : NaN
}

// =========================
// Tipos de cliente (BACKEND)
// =========================
const tiposCliente = ref([])

async function fetchTiposCliente() {
  try {
    const { data } = await tipoClientesApi.list()
    tiposCliente.value = Array.isArray(data) ? data : []
  } catch {
    tiposCliente.value = []
  }
}

function getTipoClienteNameById(tipoId) {
  const t = tiposCliente.value.find(x => Number(x.tipoClienteId ?? x.id) === Number(tipoId))
  return String(t?.name ?? "").toUpperCase()
}

function isMayoristaCliente(cliente) {
  if (!cliente?.tipoClienteId) return false
  const name = getTipoClienteNameById(cliente.tipoClienteId)
  return name.includes("MAYOR")
}

const tipoClienteBadge = computed(() => {
  if (!clienteSel.value) return null
  return isMayoristaCliente(clienteSel.value) ? "MAYORISTA" : "MINORISTA"
})

// =========================
// Estado principal
// =========================
const cajaCheck = ref({ ok: false, error: "" })
const cajaAbierta = ref(null)

const movimientosCaja = ref([])
const resumenCaja = ref({ ingresos: 0, egresos: 0, saldo: 0 })

const ventas = ref([]) // aún sin GET por turno
const productos = ref([])
const clientes = ref([])

const clienteSelId = ref("")
const clienteSel = computed(() =>
  clientes.value.find(c => String(c.id) === String(clienteSelId.value)) ?? null
)

const canSell = computed(() => cajaCheck.value?.ok === true)

// ✅ si volvemos desde clientes con ?clienteId=...
function applyClienteFromQuery() {
  const qid = route.query.clienteId
  if (!qid) return
  clienteSelId.value = String(qid)
  router.replace({ query: { ...route.query, clienteId: undefined } })
}

// =========================
// Métodos de pago (BACKEND)
// =========================
const metodosPago = ref([])

function normalizeMetodoPago(x) {
  return {
    id: Number(x?.metodoPagoId ?? x?.id ?? 0),
    nombre: String(x?.nombre ?? x?.name ?? x?.descripcion ?? x?.tipo ?? "SIN NOMBRE"),
  }
}

async function fetchMetodosPago() {
  try {
    const { data } = await metodosPagoApi.list()
    const arr = Array.isArray(data) ? data : []
    metodosPago.value = arr.map(normalizeMetodoPago).filter(m => m.id > 0)
  } catch {
    metodosPago.value = []
  }
}

// =========================
// Modal Pago
// =========================
const showPagoModal = ref(false)
const pagoVentaId = ref(null)
const pagoMonto = ref("")
const pagoMetodoPagoId = ref("")
const pagoReferencia = ref("")
const pagoLoading = ref(false)
const pagosDeVenta = ref([])

async function loadPagosVenta(ventaId) {
  try {
    const { data } = await pagosApi.porVentaId(ventaId)
    pagosDeVenta.value = Array.isArray(data) ? data : []
  } catch {
    pagosDeVenta.value = []
  }
}

function openPagoModal(ventaId, suggestedMonto = null) {
  pagoVentaId.value = Number(ventaId)
  pagoMonto.value = suggestedMonto != null ? String(suggestedMonto) : ""
  pagoReferencia.value = ""

  // set default método
  pagoMetodoPagoId.value = metodosPago.value?.[0]?.id ? String(metodosPago.value[0].id) : ""

  showPagoModal.value = true
  loadPagosVenta(ventaId)
}

function closePagoModal() {
  showPagoModal.value = false
  pagoVentaId.value = null
  pagoMonto.value = ""
  pagoMetodoPagoId.value = ""
  pagoReferencia.value = ""
  pagosDeVenta.value = []
}

const totalPagadoVenta = computed(() =>
  (pagosDeVenta.value ?? []).reduce((a, p) => a + Number(p.monto ?? 0), 0)
)

async function registrarPago() {
  if (pagoLoading.value) return
  pagoLoading.value = true
  errorMsg.value = ""
  okMsg.value = ""

  if (!cajaAbierta.value?.cajaId) {
    errorMsg.value = "No hay caja ABIERTA para registrar el pago."
    pagoLoading.value = false
    return
  }

  if (!pagoVentaId.value) {
    errorMsg.value = "Venta inválida."
    pagoLoading.value = false
    return
  }

  const mp = Number(pagoMetodoPagoId.value)
  if (!Number.isFinite(mp) || mp <= 0) {
    errorMsg.value = "Seleccioná un método de pago."
    pagoLoading.value = false
    return
  }

  const monto = toMoneyNumber(pagoMonto.value)
  if (!Number.isFinite(monto) || monto <= 0) {
    errorMsg.value = "Monto de pago inválido."
    pagoLoading.value = false
    return
  }

  try {
    const payload = {
      ventaId: Number(pagoVentaId.value),
      cajaId: Number(cajaAbierta.value.cajaId),
      metodoPagoId: mp,
      monto,
      referencia: pagoReferencia.value?.trim() || null,
    }

    await pagosApi.create(payload)

    okMsg.value = `Pago registrado ✅ $ ${formatMoney(monto)}`
    await loadPagosVenta(pagoVentaId.value)
    await refresh()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.response?.data ||
      e?.message ||
      "Error registrando pago."
  } finally {
    pagoLoading.value = false
  }
}

// =========================
// Refresh (todo backend)
// =========================
async function refresh() {
  okMsg.value = ""
  errorMsg.value = ""

  await fetchTiposCliente()
  await fetchMetodosPago()

  // 1) Caja abierta
  try {
    const { data } = await cajaApi.abierta({
      fecha: fecha.value,
      turno: turnoBackend(turnoSel.value),
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

  // 2) Productos
  try {
    const { data } = await productosApi.list()
    const arr = Array.isArray(data) ? data : []
    productos.value = arr.map(p => ({
      id: Number(p.productoId),
      nombre: p.nombre,
      precioVenta: Number(p.precioVenta ?? 0),
      precioCosto: Number(p.precioCosto ?? 0),
      precioMayorista: p.precioMayorista == null ? null : Number(p.precioMayorista),
      codigoProducto: p.codigoProducto ?? null,
      categoria: p.categoria ?? null,
      userId: p.userId ?? null,
      stockActual: p.stockActual == null ? null : Number(p.stockActual),
      activo: true,
    }))
  } catch (e) {
    productos.value = []
    const msg = e?.response?.data?.error || e?.message || "Error cargando productos (backend)."
    if (!errorMsg.value) errorMsg.value = msg
  }

  // 3) Clientes
  try {
    const { data } = await clientesApi.list()
    const arr = Array.isArray(data) ? data : []
    clientes.value = arr.map(mapCliente).filter(c => c.activo !== false)
    applyClienteFromQuery()
  } catch {
    clientes.value = []
  }

  // 4) Ventas (aún vacío por falta de endpoint)
  ventas.value = []

  // 5) Movimientos + resumen
  movimientosCaja.value = []
  resumenCaja.value = { ingresos: 0, egresos: 0, saldo: 0 }

  if (cajaAbierta.value?.cajaId) {
    try {
      const { data: movs } = await movimientosCajaApi.porCajaId(cajaAbierta.value.cajaId)
      movimientosCaja.value = Array.isArray(movs) ? movs : []

      const ingresos = movimientosCaja.value
        .filter(m => m.tipo === "INGRESO")
        .reduce((a, m) => a + Number(m.monto || 0), 0)

      const egresos = movimientosCaja.value
        .filter(m => m.tipo === "EGRESO")
        .reduce((a, m) => a + Number(m.monto || 0), 0)

      const saldo = Number(cajaAbierta.value.montoInicial || 0) + ingresos - egresos
      resumenCaja.value = { ingresos, egresos, saldo }
    } catch {
      // si falla, dejamos 0 sin romper vista
    }
  }
}

watch([fecha, turnoSel, admin], () => { refresh() }, { immediate: true })

// =========================
// Items (productos)
// =========================
const selProductoId = ref("")
const itemQty = ref("1")
const itemDiscountPct = ref("0")

const selectedProducto = computed(() =>
  productos.value.find(p => String(p.id) === String(selProductoId.value)) ?? null
)

const items = ref([])

// item: {id, productId, name, price, cost, qty, discountPct, discountUnit, netUnit, subtotal, invalidReason}
function recalcItem(it) {
  const price = Number(it.price ?? 0)
  const cost = Number(it.cost ?? 0)

  const qtyRaw = Number(it.qty ?? 0)
  const qty = Number.isFinite(qtyRaw) ? qtyRaw : 0

  const discountPct = clamp(String(it.discountPct ?? 0).replace(",", "."), 0, 100)

  const discountUnit = Math.round((price * discountPct) / 100)
  const netUnit = Math.max(0, price - discountUnit)
  const subtotal = netUnit * qty

  const invalidReason = netUnit < cost
    ? `Vende a pérdida: $${formatMoney(netUnit)} < costo $${formatMoney(cost)}`
    : ""

  return { ...it, qty, discountPct, discountUnit, netUnit, subtotal, invalidReason }
}

function getPrecioSugerido(p) {
  const mayor = isMayoristaCliente(clienteSel.value)
  if (mayor) return Number(p.precioMayorista ?? p.precioVenta ?? 0)
  return Number(p.precioVenta ?? 0)
}

function addItem() {
  errorMsg.value = ""
  okMsg.value = ""

  if (!canSell.value) {
    errorMsg.value = cajaCheck.value?.error || "Caja no disponible para vender."
    return
  }

  const p = selectedProducto.value
  if (!p) { errorMsg.value = "Seleccioná un producto."; return }

  const qty = Math.floor(Number(String(itemQty.value).trim().replace(",", ".")))
  if (!Number.isFinite(qty) || qty <= 0) { errorMsg.value = "Cantidad inválida."; return }

  if (p.stockActual != null && qty > p.stockActual) {
    errorMsg.value = `Stock insuficiente. Disponible: ${p.stockActual}`
    return
  }

  const discountPct = clamp(String(itemDiscountPct.value).replace(",", "."), 0, 100)

  const base = {
    id: ensureUUID(),
    productId: Number(p.id),
    name: p.nombre,
    price: getPrecioSugerido(p),
    cost: Number(p.precioCosto ?? 0),
    qty,
    discountPct,
  }

  items.value = [...items.value, recalcItem(base)]

  selProductoId.value = ""
  itemQty.value = "1"
  itemDiscountPct.value = "0"
}

function removeItem(itemId) {
  items.value = items.value.filter(i => i.id !== itemId)
}

function updateItemDiscount(itemId, pct) {
  const parsed = String(pct ?? "").replace(",", ".")
  items.value = items.value.map(it =>
    it.id === itemId ? recalcItem({ ...it, discountPct: parsed }) : it
  )
}

function updateItemQty(itemId, qty) {
  errorMsg.value = ""

  const parsed = Number(String(qty ?? "").replace(",", "."))
  const safe = Number.isFinite(parsed) ? parsed : 1
  const finalQty = safe <= 0 ? 1 : Math.floor(safe)

  const it0 = items.value.find(x => x.id === itemId)
  const p = it0 ? productos.value.find(pp => Number(pp.id) === Number(it0.productId)) : null

  if (p?.stockActual != null && finalQty > p.stockActual) {
    errorMsg.value = `Stock insuficiente. Disponible: ${p.stockActual}`
    return
  }

  items.value = items.value.map(it =>
    it.id === itemId ? recalcItem({ ...it, qty: finalQty }) : it
  )
}

function clearForm() {
  items.value = []
  notes.value = ""
  clienteSelId.value = ""
  selProductoId.value = ""
  itemQty.value = "1"
  itemDiscountPct.value = "0"
}

// =========================
// Totales (preview)
// =========================
const subtotalBase = computed(() =>
  items.value.reduce((acc, it) => acc + Number(it.price ?? 0) * Number(it.qty ?? 0), 0)
)

const descuentoTotal = computed(() =>
  items.value.reduce((acc, it) => acc + Number(it.discountUnit ?? 0) * Number(it.qty ?? 0), 0)
)

const totalCalc = computed(() =>
  items.value.reduce((acc, it) => acc + Number(it.subtotal ?? 0), 0)
)

const hasInvalidItems = computed(() => items.value.some(it => it.invalidReason))
const canRegister = computed(() => canSell.value && items.value.length > 0 && !hasInvalidItems.value)

const ventasTotalDelBucket = computed(() =>
  ventas.value.reduce((acc, v) => acc + Number(v.total ?? 0), 0)
)

const lastTicket = ref(null)

// =========================
// Registrar venta (BACKEND)
// =========================
async function registrarVenta() {
  if (saving.value) return
  saving.value = true

  try {
    errorMsg.value = ""
    okMsg.value = ""

    if (!cajaCheck.value?.ok || !cajaAbierta.value?.cajaId) {
      errorMsg.value = cajaCheck.value?.error || "No hay caja ABIERTA (backend)."
      return
    }

    if (items.value.length === 0) {
      errorMsg.value = "Agregá al menos 1 producto."
      return
    }

    if (hasInvalidItems.value) {
      errorMsg.value = "Hay productos con venta a pérdida. Ajustá el descuento."
      return
    }

    const detallesVenta = items.value.map(i => ({
      productoId: Number(i.productId),
      cantidad: Number(i.qty),
    }))

    const command = {
      cajaId: Number(cajaAbierta.value.cajaId),
      userId: userIdInt.value,
      clienteId: clienteSel.value?.id ? Number(clienteSel.value.id) : null,
      detallesVenta,
      notas: notes.value?.trim() || null,
    }

    const { data } = await ventasApi.create(command)

    const ventaId = data?.venta?.ventaId ?? data?.ventaId ?? null
    const total = data?.venta?.total ?? data?.total ?? totalCalc.value

    lastTicket.value = data

    okMsg.value = ventaId
      ? `Venta #${ventaId} registrada ✅ Total: $ ${formatMoney(total)}`
      : `Venta registrada ✅ Total: $ ${formatMoney(total)}`

    if (ventaId) {
      openPagoModal(ventaId, total)
    }

    clearForm()
    await refresh()
  } catch (e) {
    console.log("VENTAS ERROR:", e?.response?.status, e?.response?.data)

    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      (typeof e?.response?.data === "string" ? e.response.data : null) ||
      e?.message ||
      "Error creando venta en backend."

    await refresh()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-3">
      <h1 class="h4 mb-1">Ventas</h1>
      <div class="text-secondary">
        <span v-if="admin">Vista ADMIN: podés elegir fecha y turno.</span>
        <span v-else>Vista CAJERO: solo tu turno ({{ turnoSel }}).</span>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <!-- CONTROLES -->
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
            <div v-if="!canSell" class="alert alert-warning py-2 mb-0">
              {{ cajaCheck.error }}
            </div>
            <div v-else class="small text-secondary">
              Caja ABIERTA ✅ Podés registrar ventas.
              <span class="ms-2">
                · Ingresos: <b>$ {{ formatMoney(resumenCaja.ingresos) }}</b>
                · Egresos: <b>$ {{ formatMoney(resumenCaja.egresos) }}</b>
                · Saldo: <b>$ {{ formatMoney(resumenCaja.saldo) }}</b>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MOVIMIENTOS DEL TURNO -->
    <div class="card bg-panel border-0 shadow-sm mb-4" v-if="cajaAbierta?.cajaId">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h6 mb-0">Movimientos del turno</h2>
          <div class="text-secondary small">
            Caja #{{ cajaAbierta.cajaId }} · Saldo: <b>$ {{ formatMoney(resumenCaja.saldo) }}</b>
          </div>
        </div>

        <div v-if="!movimientosCaja.length" class="text-secondary small">
          No hay movimientos todavía.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Concepto</th>
                <th>Descripción</th>
                <th class="text-end">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in movimientosCaja" :key="m.movimientoId ?? m.id">
                <td class="text-secondary">{{ m.tipo }}</td>
                <td class="text-secondary">{{ m.concepto ?? "-" }}</td>
                <td class="text-secondary">{{ m.descripcion ?? "-" }}</td>
                <td class="text-end fw-bold">$ {{ formatMoney(m.monto) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary small mt-2">
          Ingresos: <b>$ {{ formatMoney(resumenCaja.ingresos) }}</b> ·
          Egresos: <b>$ {{ formatMoney(resumenCaja.egresos) }}</b>
        </div>
      </div>
    </div>

    <!-- NUEVA VENTA -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <h2 class="h6 mb-3">Nueva venta</h2>

        <!-- Cliente + Nuevo -->
        <div class="row g-3 mb-3">
          <div class="col-12 col-md-8">
            <div class="d-flex gap-2 align-items-end">
              <div class="flex-grow-1">
                <label class="form-label text-secondary">Cliente (opcional)</label>
                <select
                  v-model="clienteSelId"
                  class="form-select bg-dark text-white border-secondary"
                  :disabled="!canSell"
                >
                  <option value="">Sin cliente</option>
                  <option v-for="c in clientes" :key="c.id" :value="String(c.id)">
                    {{ c.nombre }} {{ c.apellido || "" }} — DNI: {{ c.dni || "-" }}
                  </option>
                </select>
              </div>

              <button class="btn btn-outline-light" @click="goCreateCliente" :disabled="!canSell">
                + Nuevo
              </button>
            </div>

            <div v-if="tipoClienteBadge === 'MAYORISTA'" class="small text-secondary mt-2">
              Cliente <b>Mayorista</b> (el backend aplicará precio mayorista donde corresponda)
            </div>
          </div>

          <div class="col-12 col-md-4 d-flex align-items-end">
            <div class="text-secondary small">Tip: el descuento real lo ponés por producto.</div>
          </div>
        </div>

        <!-- Agregar producto -->
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Producto</label>
            <select
              v-model="selProductoId"
              class="form-select bg-dark text-white border-secondary"
              :disabled="!canSell || productos.length === 0"
            >
              <option value="" disabled>Seleccionar…</option>
              <option v-for="p in productos" :key="p.id" :value="String(p.id)">
                {{ p.nombre }} — $ {{ formatMoney(getPrecioSugerido(p)) }}
                {{
                  tipoClienteBadge === "MAYORISTA" && p.precioMayorista != null ? " (mayorista)" : ""
                }}
              </option>
            </select>
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">Cant.</label>
            <input
              v-model="itemQty"
              class="form-control bg-dark text-white border-secondary"
              inputmode="numeric"
              :disabled="!canSell || !selProductoId"
            />
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">Desc %</label>
            <input
              v-model="itemDiscountPct"
              class="form-control bg-dark text-white border-secondary"
              inputmode="numeric"
              :disabled="!canSell || !selProductoId"
            />
          </div>

          <div class="col-12 col-md-2 d-flex justify-content-md-end">
            <button class="btn btn-outline-light w-100" @click="addItem" :disabled="!canSell || !selProductoId">
              Agregar
            </button>
          </div>
        </div>

        <!-- Items -->
        <div class="table-responsive mt-3" v-if="items.length">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th style="width: 120px">Precio</th>
                <th style="width: 90px">Cant.</th>
                <th style="width: 110px">Desc %</th>
                <th style="width: 180px">Unit. final</th>
                <th style="width: 150px">Subtotal</th>
                <th style="width: 120px" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in items" :key="it.id" :class="it.invalidReason ? 'table-danger' : ''">
                <td class="fw-semibold">{{ it.name }}</td>
                <td class="text-secondary">$ {{ formatMoney(it.price) }}</td>

                <td>
                  <input
                    class="form-control form-control-sm bg-dark text-white border-secondary"
                    :value="it.qty"
                    inputmode="numeric"
                    @input="updateItemQty(it.id, $event.target.value)"
                    :disabled="!canSell"
                  />
                </td>

                <td>
                  <input
                    class="form-control form-control-sm bg-dark text-white border-secondary"
                    :value="it.discountPct"
                    inputmode="numeric"
                    @input="updateItemDiscount(it.id, $event.target.value)"
                    :disabled="!canSell"
                  />
                </td>

                <td class="text-secondary">
                  $ {{ formatMoney(it.netUnit) }}
                  <div v-if="it.invalidReason" class="small text-danger fw-semibold mt-1">
                    {{ it.invalidReason }}
                  </div>
                </td>

                <td class="fw-bold">$ {{ formatMoney(it.subtotal) }}</td>

                <td class="text-end">
                  <button class="btn btn-sm btn-outline-light" @click="removeItem(it.id)" :disabled="!canSell">
                    Quitar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-secondary mt-3" v-else>Agregá productos para armar la venta.</div>

        <div v-if="hasInvalidItems" class="alert alert-danger py-2 mt-3 mb-0">
          Hay ítems a pérdida. Ajustá el descuento para poder registrar la venta.
        </div>

        <!-- Notas -->
        <div class="row g-3 mt-1">
          <div class="col-12 col-md-8">
            <label class="form-label text-secondary">Notas</label>
            <input v-model="notes" class="form-control bg-dark text-white border-secondary" :disabled="!canSell" />
          </div>
        </div>

        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
          <div class="text-secondary">
            Subtotal (preview): <b>$ {{ formatMoney(subtotalBase) }}</b> ·
            Descuento: <b>$ {{ formatMoney(descuentoTotal) }}</b> ·
            Total (preview): <b class="fs-5">$ {{ formatMoney(totalCalc) }}</b>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-outline-light" @click="clearForm" :disabled="!canSell">Limpiar</button>
            <button class="btn btn-primary btn-accent" @click="registrarVenta" :disabled="!canRegister || saving">
              {{ saving ? "Guardando..." : "Registrar venta" }}
            </button>
          </div>
        </div>

        <div class="text-secondary small mt-2">
          ✅ Venta descuenta stock · ✅ Caja debe estar ABIERTA · ✅ Cobro parcial o total: desde el modal
        </div>
      </div>
    </div>

    <!-- ÚLTIMA VENTA -->
    <div class="card bg-dark border-secondary mb-4" v-if="lastTicket">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center gap-2">
          <h2 class="h6 mb-0">Última venta (backend)</h2>

          <button
            class="btn btn-sm btn-outline-light"
            v-if="lastTicket?.venta?.ventaId"
            @click="openPagoModal(lastTicket.venta.ventaId, lastTicket.venta.total)"
            :disabled="!cajaAbierta?.cajaId"
          >
            Registrar pago
          </button>
        </div>

        <div class="text-secondary small mt-2" v-if="lastTicket?.venta">
          VentaId: <b>{{ lastTicket.venta.ventaId }}</b>
          · Total: <b>$ {{ formatMoney(lastTicket.venta.total) }}</b>
          · Estado: <b>{{ lastTicket.venta.estado }}</b>
        </div>

        <div class="table-responsive mt-3" v-if="Array.isArray(lastTicket?.detallesVenta)">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>ProductoId</th>
                <th>Cant.</th>
                <th>Precio</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in lastTicket.detallesVenta" :key="d.detalleId">
                <td class="text-secondary">{{ d.productoId }}</td>
                <td class="text-secondary">{{ d.cantidad }}</td>
                <td class="text-secondary">$ {{ formatMoney(d.precioUnitario) }}</td>
                <td class="fw-bold">$ {{ formatMoney(d.subtotal) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- LISTADO -->
    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 class="h6 mb-0">Ventas del turno</h2>
          <div class="text-secondary small">
            Total listado: <b>$ {{ formatMoney(ventasTotalDelBucket) }}</b>
          </div>
        </div>

        <div class="text-secondary">
          (Por ahora el backend no tiene GET por turno, así que este listado está vacío.)
        </div>
      </div>
    </div>

    <!-- MODAL PAGO -->
    <div v-if="showPagoModal" class="modal-backdrop-custom">
      <div class="modal-card">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
            <div class="h6 mb-0">Registrar pago</div>
            <div class="text-secondary small">Venta #{{ pagoVentaId }} — Caja #{{ cajaAbierta?.cajaId }}</div>
          </div>
          <button class="btn btn-sm btn-outline-light" @click="closePagoModal">X</button>
        </div>

        <div class="row g-2">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Monto</label>
            <input v-model="pagoMonto" class="form-control bg-dark text-white border-secondary" placeholder="Ej: 20000" />
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Método de pago</label>

            <select v-model="pagoMetodoPagoId" class="form-select bg-dark text-white border-secondary">
              <option disabled value="">Seleccionar método…</option>

              <option v-if="!metodosPago.length" disabled value="">
                No hay métodos cargados
              </option>

              <option v-for="m in metodosPago" :key="m.id" :value="String(m.id)">
                {{ m.nombre }}
              </option>
            </select>
          </div>

          <div class="col-12">
            <label class="form-label text-secondary">Referencia (opcional)</label>
            <input
              v-model="pagoReferencia"
              class="form-control bg-dark text-white border-secondary"
              placeholder="Ej: comprobante / alias"
            />
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mt-3">
          <div class="text-secondary small">
            Pagado en esta venta: <b>$ {{ formatMoney(totalPagadoVenta) }}</b>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-outline-light" @click="closePagoModal" :disabled="pagoLoading">
              Cancelar
            </button>
            <button class="btn btn-primary btn-accent" @click="registrarPago" :disabled="pagoLoading || !cajaAbierta?.cajaId">
              {{ pagoLoading ? "Guardando..." : "Registrar pago" }}
            </button>
          </div>
        </div>

        <hr class="border-secondary my-3" />

        <div>
          <div class="text-secondary small mb-2">Pagos registrados</div>

          <div v-if="pagosDeVenta.length === 0" class="text-secondary small">Sin pagos todavía.</div>

          <div v-else class="table-responsive">
            <table class="table table-dark table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Método</th>
                  <th class="text-end">Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in pagosDeVenta" :key="p.pagoId ?? p.id">
                  <td class="text-secondary">{{ p.pagoId ?? p.id }}</td>
                  <td class="text-secondary">{{ p.metodoPagoId }}</td>
                  <td class="text-end fw-bold">$ {{ formatMoney(p.monto) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="text-secondary small mt-2">
            ✅ Los pagos impactan caja porque el backend crea un MovimientoCaja (INGRESO / VENTA).
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-panel{ background: rgba(18, 22, 32, .92); }
.btn-accent{ background: #6f5cff; border: none; }
.btn-accent:hover{ background: #5f4de6; }

.modal-backdrop-custom{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  display: grid;
  place-items: center;
  z-index: 2000;
  padding: 16px;
}
.modal-card{
  width: min(720px, 96vw);
  border-radius: 16px;
  padding: 16px;
  background: rgba(18, 22, 32, .98);
  border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 20px 70px rgba(0,0,0,.55);
}
</style>
