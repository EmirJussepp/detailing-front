<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue"
import { useRoute, useRouter } from "vue-router"
import { getSession, isAdmin, getShift } from "../auth/session"

import { cajaApi } from "../services/cajaApi"
import { ventasApi } from "../services/ventasApi"
import { pagosApi } from "../services/pagosApi"
import { metodosPagoApi } from "../services/metodopagoService"
import { productosApi } from "../services/productosApi"
import { clientesApi } from "../services/clientesApi"
import { mapCliente } from "../mappers/clientes"

// =========================
// Helpers
// =========================
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return Number.isFinite(num) ? num.toLocaleString("es-AR", { maximumFractionDigits: 0 }) : "0"
}

function parseArNumber(v) {
  const s = String(v ?? "")
    .trim()
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
  const x = Number(s)
  return Number.isFinite(x) ? x : NaN
}

function toIntSafe(v, fallback = 0) {
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(",", ".")
  const x = Math.floor(Number(s))
  return Number.isFinite(x) ? x : fallback
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
  const n = Number(sess?.userId)
  return Number.isFinite(n) && n > 0 ? n : 1
}

function pickErr(e, fallback = "Error") {
  return e?.response?.data?.error || e?.response?.data?.message || e?.response?.data || e?.message || fallback
}

function unwrapPageArray(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
}

function debounce(fn, wait = 250) {
  let t = null
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

function round2(n) {
  const x = Number(n ?? 0)
  return Math.round(x * 100) / 100
}

function normalizePct(v) {
  const n = Number(String(v ?? "0").replace(",", "."))
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 100) return 100
  return round2(n)
}

// =========================
// Router / Session
// =========================
const route = useRoute()
const router = useRouter()

const session = getSession() ?? null
const admin = computed(() => Boolean(session && isAdmin()))
const userIdInt = computed(() => resolveUserId(session))

// =========================
// Filtros (fecha/turno)
// =========================
const fecha = ref(todayISO())
const turnoSel = ref("MAÑANA")

watch(
  admin,
  (isAdm) => {
    turnoSel.value = turnoUI(isAdm ? "MAÑANA" : getShift())
  },
  { immediate: true }
)

// =========================
// Estado UI
// =========================
const loading = ref(false)
const saving = ref(false)
const errorMsg = ref("")
const okMsg = ref("")

function setOk(msg) {
  okMsg.value = msg
  errorMsg.value = ""
}
function setErr(msg) {
  errorMsg.value = msg
  okMsg.value = ""
}

// =========================
// Caja (bloqueo real)
// =========================
const cajaCheck = ref({ ok: false, error: "" })
const cajaAbierta = ref(null)

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
    cajaAbierta.value = null
    cajaCheck.value = { ok: false, error: pickErr(e, "No hay caja ABIERTA para esta fecha/turno.") }
  }
}

const canSell = computed(() => cajaCheck.value?.ok === true && Boolean(cajaAbierta.value?.cajaId))

function goCaja() {
  router.push({ name: "caja.dashboard" })
}

// =========================
// Datos maestros (server-side search)
// =========================
const productos = ref([])
const clientes = ref([])
const metodosPago = ref([])
const loadedMetodos = ref(false)

const productSearch = ref("")
const clientesSearch = ref("")

function normalizeProducto(p) {
  return {
    id: Number(p.productoId ?? p.id),
    nombre: p.nombre,
    codigoProducto: p.codigoProducto ?? null,
    stockActual: p.stockActual == null ? null : Number(p.stockActual),
    precioVenta: Number(p.precioVenta ?? 0),
    precioCosto: Number(p.precioCosto ?? 0),
    precioMayorista: p.precioMayorista == null ? null : Number(p.precioMayorista),
  }
}

function normalizeMetodoPago(x) {
  return {
    id: Number(x?.metodoPagoId ?? x?.id ?? 0),
    nombre: String(x?.nombre ?? x?.name ?? x?.descripcion ?? "SIN NOMBRE"),
  }
}

function metodoNombreById(id) {
  const m = metodosPago.value.find((x) => Number(x.id) === Number(id))
  return m?.nombre ?? String(id ?? "-")
}

async function refreshProductos(searchTerm = null) {
  try {
    const params = { page: 0, size: 300, search: searchTerm || null, q: searchTerm || null }
    const { data } = await productosApi.list(params)
    const arr = unwrapPageArray(data)
    productos.value = arr.map(normalizeProducto).filter((p) => p.id > 0)
  } catch (e) {
    productos.value = []
    console.error("refreshProductos:", e?.response?.status, e?.response?.data || e?.message)
  }
}

async function refreshClientes(searchTerm = null) {
  try {
    const params = { page: 0, size: 300, search: searchTerm || null, q: searchTerm || null }
    const { data } = await clientesApi.list(params)
    const arr = unwrapPageArray(data)
    clientes.value = arr.map(mapCliente).filter((c) => c.activo !== false)
  } catch (e) {
    clientes.value = []
    console.error("refreshClientes:", e?.response?.status, e?.response?.data || e?.message)
  }
}

async function fetchMetodosOnce() {
  if (loadedMetodos.value) return
  try {
    const { data } = await metodosPagoApi.list()
    console.log("METODOS PAGO RAW:", data)

    const arr = Array.isArray(data) ? data : unwrapPageArray(data)
    metodosPago.value = arr.map(normalizeMetodoPago).filter((m) => m.id > 0)

    console.log("METODOS PAGO NORMALIZADOS:", metodosPago.value)
  } catch (e) {
    metodosPago.value = []
    console.error("ERROR /metodos-pago:", e?.response?.status, e?.response?.data || e?.message)
  } finally {
    loadedMetodos.value = true
  }
}

// =========================
// Cobros PRO (por cliente)
// =========================
const cobrarClienteId = ref("")
const cobrarCliente = computed(() => clientes.value.find((c) => String(c.id) === String(cobrarClienteId.value)) ?? null)
const showAdvancedId = ref(false)

function goCuentaCorriente() {
  if (!cobrarClienteId.value) return setErr("Seleccioná un cliente para ir a Cuenta Corriente.")
  router.push({ name: "cuentaCorriente", query: { clienteId: String(cobrarClienteId.value) } })
}

// =========================
// Carrito (venta nueva)
// =========================
const clienteSelId = ref("")
const clienteSel = computed(() => clientes.value.find((c) => String(c.id) === String(clienteSelId.value)) ?? null)

const selProductoId = ref("")
const itemQty = ref("1")
const codeInputRef = ref(null)

const selectedProducto = computed(() => productos.value.find((p) => String(p.id) === String(selProductoId.value)) ?? null)

function getPrecioSugerido(p) {
  return Number(p.precioVenta ?? 0)
}

const items = ref([])

function recalcItem(it) {
  const basePrice = Number(it.basePrice ?? it.price ?? 0)
  const porcentajeAjuste = normalizePct(it.porcentajeAjuste ?? 0)
  const cost = Number(it.cost ?? 0)
  const qty = Number.isFinite(Number(it.qty)) ? Number(it.qty) : 0

  const price = round2(basePrice * (1 - porcentajeAjuste / 100))
  const subtotal = round2(price * qty)

  let invalidReason = ""

  if (qty <= 0) {
    invalidReason = "Cantidad inválida"
  } else if (price < 0) {
    invalidReason = "Precio final inválido"
  } else if (price < cost) {
    invalidReason = "Vende a pérdida"
  }

  if (it.stock != null && Number.isFinite(Number(it.stock)) && qty > Number(it.stock)) {
    invalidReason = `Stock insuficiente (disp: ${it.stock})`
  }

  return {
    ...it,
    basePrice: round2(basePrice),
    porcentajeAjuste,
    price,
    qty,
    subtotal,
    invalidReason,
  }
}

function addItem(qtyOverride = null) {
  okMsg.value = ""
  errorMsg.value = ""

  if (!canSell.value) return setErr(cajaCheck.value?.error || "Caja no disponible.")

  const p = selectedProducto.value
  if (!p) return setErr("Seleccioná un producto.")

  const qty = qtyOverride != null ? Number(qtyOverride) : toIntSafe(itemQty.value, 0)
  if (!qty || qty <= 0) return setErr("Cantidad inválida.")

  if (p.stockActual != null && Number.isFinite(Number(p.stockActual))) {
    const existingQty = items.value.find((x) => Number(x.productId) === Number(p.id))?.qty ?? 0
    if (existingQty + qty > Number(p.stockActual)) return setErr(`Stock insuficiente: disp ${p.stockActual}.`)
  }

  const existing = items.value.find((x) => Number(x.productId) === Number(p.id))

  if (existing) {
    const updated = recalcItem({
      ...existing,
      qty: Number(existing.qty) + qty,
    })
    items.value = items.value.map((x) => (x.id === existing.id ? updated : x))
  } else {
    const basePrice = Number(getPrecioSugerido(p) ?? 0)

    const it = {
      id: `${Date.now()}_${Math.floor(Math.random() * 1e9)}`,
      productId: Number(p.id),
      name: p.nombre,
      basePrice,
      porcentajeAjuste: 0,
      price: basePrice,
      cost: Number(p.precioCosto ?? 0),
      qty,
      stock: p.stockActual == null ? null : Number(p.stockActual),
    }

    items.value = [...items.value, recalcItem(it)]
  }

  selProductoId.value = ""
  itemQty.value = "1"
  nextTick(() => codeInputRef.value?.focus?.())
}

function removeItem(itemId) {
  items.value = items.value.filter((i) => i.id !== itemId)
}

function updateItemQty(itemId, v) {
  const q = toIntSafe(v, 1)
  items.value = items.value.map((it) => (it.id === itemId ? recalcItem({ ...it, qty: q <= 0 ? 1 : q }) : it))
}

function updateItemPct(itemId, v) {
  const pct = normalizePct(v)
  items.value = items.value.map((it) =>
    it.id === itemId ? recalcItem({ ...it, porcentajeAjuste: pct }) : it
  )
}

function clearForm() {
  items.value = []
  clienteSelId.value = ""
  selProductoId.value = ""
  itemQty.value = "1"
  productSearch.value = ""
  nextTick(() => codeInputRef.value?.focus?.())
}

const totalCalc = computed(() => items.value.reduce((acc, it) => acc + Number(it.subtotal ?? 0), 0))
const hasInvalidItems = computed(() => items.value.some((it) => it.invalidReason))
const canRegister = computed(() => canSell.value && items.value.length > 0 && !hasInvalidItems.value)

function trySelectByExactCode(termRaw) {
  const term = String(termRaw ?? "").trim().toLowerCase()
  if (!term) return false
  const match = productos.value.find((p) => String(p.codigoProducto ?? "").trim().toLowerCase() === term)
  if (match) {
    selProductoId.value = String(match.id)
    return true
  }
  return false
}

function onSearchKeydown(e) {
  if (e?.key !== "Enter") return
  const selected = trySelectByExactCode(productSearch.value)
  if (selected) nextTick(() => addItem(1))
}

function onQtyKeydown(e) {
  if (e?.key === "Enter") addItem()
}

// =========================
// Venta: normalizador y registro
// =========================
const lastVenta = ref(null)

function normalizeVentaFromApi(payload) {
  const v = payload?.venta ?? payload?.ventaActualizada ?? payload ?? null
  if (!v) return null

  const ventaId = Number(v.ventaId ?? v.id ?? payload?.ventaId ?? payload?.id ?? 0) || null
  const total = Number(v.total ?? payload?.total ?? 0) || 0
  const estado = String(v.estado ?? payload?.estado ?? "PENDIENTE").toUpperCase()

  const clienteId =
    v.clienteId != null ? Number(v.clienteId)
      : v.cliente?.id != null ? Number(v.cliente.id)
        : v.cliente?.clienteId != null ? Number(v.cliente.clienteId)
          : null

  return { ventaId, total, estado, clienteId, raw: v }
}

async function registrarVenta() {
  if (saving.value) return
  saving.value = true
  errorMsg.value = ""
  okMsg.value = ""

  try {
    if (!canSell.value) throw new Error(cajaCheck.value?.error || "No hay caja ABIERTA.")

    const uid = Number(userIdInt.value)
    if (!Number.isFinite(uid) || uid <= 0) throw new Error("userId inválido.")

    const detallesVenta = items.value.map((i) => ({
      productoId: Number(i.productId),
      cantidad: Number(i.qty),
      porcentajeAjuste: Number(i.porcentajeAjuste ?? 0),
    }))

    const command = {
      cajaId: Number(cajaAbierta.value.cajaId),
      userId: uid,
      clienteId: clienteSel.value?.id ? Number(clienteSel.value.id) : null,
      detallesVenta,
    }

    const { data } = await ventasApi.create(command)
    const ventaN = normalizeVentaFromApi(data) ?? { ventaId: null, total: totalCalc.value, estado: "PENDIENTE", clienteId: null }

    const c =
      ventaN.clienteId != null
        ? clientes.value.find((x) => Number(x.id) === Number(ventaN.clienteId))
        : null

    lastVenta.value = {
      ventaId: ventaN.ventaId,
      total: ventaN.total,
      estado: ventaN.estado,
      clienteTxt: c
        ? `${c.nombre} ${c.apellido || ""}`.trim()
        : (clienteSel.value ? `${clienteSel.value.nombre} ${clienteSel.value.apellido || ""}`.trim() : "Sin cliente"),
    }

    setOk(
      ventaN.ventaId
        ? `Venta #${ventaN.ventaId} registrada ✅ Total: $ ${formatMoney(ventaN.total)}`
        : `Venta registrada ✅ Total: $ ${formatMoney(ventaN.total)}`
    )

    items.value = []
    selProductoId.value = ""
    itemQty.value = "1"
    productSearch.value = ""

    await refreshCaja()
    await refreshProductos(productSearch.value?.trim() || null)

    if (ventaN.ventaId) await openPagoModal(ventaN.ventaId, ventaN.total)

    nextTick(() => codeInputRef.value?.focus?.())
  } catch (e) {
    setErr(pickErr(e, "Error creando venta."))
  } finally {
    saving.value = false
  }
}

// =========================
// Buscar venta por ID (ADVANCED)
// =========================
const buscarVentaId = ref("")
const buscarLoading = ref(false)
const devolviendoVenta = ref(false)


async function buscarVenta() {
  errorMsg.value = ""
  okMsg.value = ""

  const id = toIntSafe(buscarVentaId.value, 0)
  if (!id || id <= 0) return setErr("Ingresá un N° de venta válido.")

  buscarLoading.value = true
  try {
    if (!clientes.value.length) await refreshClientes(clientesSearch.value?.trim() || null)

    const { data } = await ventasApi.porId(id)
    const ventaN = normalizeVentaFromApi(data) ?? null
    if (!ventaN?.ventaId) return setErr("No se encontró la venta.")

    const c =
      ventaN.clienteId != null
        ? clientes.value.find((x) => Number(x.id) === Number(ventaN.clienteId))
        : null

    lastVenta.value = {
      ventaId: ventaN.ventaId,
      total: ventaN.total,
      estado: ventaN.estado,
      clienteTxt: c ? `${c.nombre} ${c.apellido || ""}`.trim() : "Sin cliente",
    }

    setOk(`Venta #${ventaN.ventaId} cargada ✅ Estado: ${ventaN.estado}`)
    await openPagoModal(ventaN.ventaId, ventaN.total)
  } catch (e) {
    setErr(pickErr(e, "Error buscando venta."))
  } finally {
    buscarLoading.value = false
  }
}
async function devolverVenta(ventaId) {
  if (!ventaId) return setErr("Venta inválida.")

  if (!cajaAbierta.value?.cajaId) {
    return setErr("Necesitás una caja ABIERTA para registrar la devolución.")
  }

  const confirmado = window.confirm(`¿Seguro que querés devolver la venta #${ventaId}? Esto generará un egreso en caja y devolverá stock.`)
  if (!confirmado) return

  devolviendoVenta.value = true
  errorMsg.value = ""
  okMsg.value = ""

  try {
    await ventasApi.devolver(ventaId, {
      userId: Number(userIdInt.value),
      cajaId: Number(cajaAbierta.value.cajaId),
      motivo: "Devolución registrada desde ventas",
    })

    setOk(`Venta #${ventaId} devuelta correctamente ✅`)

    await refreshProductos(productSearch.value?.trim() || null)
    await refreshCaja()

    if (String(buscarVentaId.value || "").trim()) {
      await buscarVenta()
    }

    window.dispatchEvent(new Event("cuentaCorriente:changed"))
  } catch (e) {
    setErr(pickErr(e, "Error devolviendo venta."))
  } finally {
    devolviendoVenta.value = false
  }
}

// =========================
// Pagos (modal)
// =========================
function normalizePago(p) {
  const id = Number(p?.pagoId ?? p?.id ?? 0)
  const metodoPagoId = Number(p?.metodoPagoId ?? p?.metodo_pago_id ?? p?.metodoId ?? p?.metodoPago ?? 0)
  const monto = Number(p?.monto ?? p?.importe ?? p?.amount ?? 0)
  return { id, metodoPagoId, monto }
}

const showPagoModal = ref(false)
const pagoVentaId = ref(null)
const pagoTotalVenta = ref(0)
const pagoMonto = ref("")
const pagoMetodoPagoId = ref("")
const pagoReferencia = ref("")
const pagoLoading = ref(false)
const pagosDeVenta = ref([])

async function loadPagosVenta(ventaId) {
  try {
    const { data } = await pagosApi.porVentaId(ventaId)
    const arr = Array.isArray(data) ? data : unwrapPageArray(data)
    pagosDeVenta.value = arr.map(normalizePago).filter((x) => x.id > 0)
  } catch {
    pagosDeVenta.value = []
  }
}

const totalPagadoVenta = computed(() => pagosDeVenta.value.reduce((a, p) => a + Number(p.monto ?? 0), 0))
const restanteVenta = computed(() => Math.max(0, Number(pagoTotalVenta.value ?? 0) - Number(totalPagadoVenta.value ?? 0)))

const estadoPagoVenta = computed(() => {
  const total = Number(pagoTotalVenta.value ?? 0)
  const pagado = Number(totalPagadoVenta.value ?? 0)
  if (!pagoVentaId.value) return "-"
  if (pagado <= 0) return "PENDIENTE"
  if (pagado < total) return "PARCIAL"
  return "PAGADA"
})

async function openPagoModal(ventaId, total = 0) {
  pagoVentaId.value = Number(ventaId)
  pagoTotalVenta.value = Number(total ?? 0)
  pagoMonto.value = ""
  pagoReferencia.value = ""
  pagoMetodoPagoId.value = metodosPago.value?.[0]?.id ? String(metodosPago.value[0].id) : ""
  showPagoModal.value = true

  await loadPagosVenta(ventaId)

  if (estadoPagoVenta.value === "PAGADA") setOk("Esta venta ya está PAGADA ✅")
}

function closePagoModal() {
  showPagoModal.value = false
  nextTick(() => codeInputRef.value?.focus?.())
}

function setPagarRestante() {
  pagoMonto.value = String(restanteVenta.value || pagoTotalVenta.value || "")
}

async function registrarPago() {
  if (pagoLoading.value) return
  pagoLoading.value = true
  errorMsg.value = ""
  okMsg.value = ""

  try {
    if (!canSell.value) throw new Error(cajaCheck.value?.error || "No hay caja ABIERTA para registrar pagos.")
    if (!pagoVentaId.value) throw new Error("Venta inválida.")
    if (estadoPagoVenta.value === "PAGADA") throw new Error("Esta venta ya está PAGADA.")

    const mp = Number(pagoMetodoPagoId.value)
    if (!Number.isFinite(mp) || mp <= 0) throw new Error("Seleccioná un método de pago.")

    const monto = parseArNumber(pagoMonto.value)
    if (!Number.isFinite(monto) || monto <= 0) throw new Error("Monto inválido.")
    if (monto > restanteVenta.value) throw new Error(`El monto supera el restante ($ ${formatMoney(restanteVenta.value)}).`)

    const payload = {
      ventaId: Number(pagoVentaId.value),
      cajaId: Number(cajaAbierta.value.cajaId),
      metodoPagoId: mp,
      monto,
      referencia: pagoReferencia.value?.trim() || null,
    }

    await pagosApi.create(payload)

    await loadPagosVenta(pagoVentaId.value)
    await refreshCaja()

    window.dispatchEvent(new Event("cuentaCorriente:changed"))

    let msg = `Pago registrado ✅ $ ${formatMoney(monto)} (${metodoNombreById(mp)})`
    if (estadoPagoVenta.value === "PAGADA") msg += " · Venta PAGADA ✅"
    setOk(msg)

    if (restanteVenta.value > 0) pagoMonto.value = String(restanteVenta.value)
    else pagoMonto.value = ""
  } catch (e) {
    setErr(pickErr(e, "Error registrando pago."))
  } finally {
    pagoLoading.value = false
  }
}

// modal ESC
function onKeydown(e) {
  if (e?.key === "Escape" && showPagoModal.value) closePagoModal()
}

// =========================
// Refresh + watchers
// =========================
let refreshSeq = 0

async function refreshAll() {
  const seq = ++refreshSeq
  loading.value = true
  try {
    await fetchMetodosOnce()
    if (seq !== refreshSeq) return

    await refreshCaja()
    if (seq !== refreshSeq) return

    await Promise.all([
      refreshProductos(productSearch.value?.trim() || null),
      refreshClientes(clientesSearch.value?.trim() || null),
    ])
  } finally {
    if (seq === refreshSeq) loading.value = false
  }
}

function onCajaChanged() {
  refreshCaja()
}

const refreshProductosDebounced = debounce(() => refreshProductos(productSearch.value?.trim() || null), 250)
const refreshClientesDebounced = debounce(() => refreshClientes(clientesSearch.value?.trim() || null), 250)

watch(productSearch, () => {
  trySelectByExactCode(productSearch.value)
  refreshProductosDebounced()
})

watch(clientesSearch, () => {
  refreshClientesDebounced()
})

watch([fecha, turnoSel], () => refreshAll(), { flush: "post" })

// =========================
// Lifecycle
// =========================
onMounted(async () => {
  await refreshAll()

  const qVentaId = route.query.ventaId
  if (qVentaId) {
    showAdvancedId.value = true
    buscarVentaId.value = String(qVentaId)
    router.replace({ query: { ...route.query, ventaId: undefined } })
    await buscarVenta()
  }

  window.addEventListener("caja:changed", onCajaChanged)
  window.addEventListener("keydown", onKeydown)

  nextTick(() => codeInputRef.value?.focus?.())
})

onBeforeUnmount(() => {
  window.removeEventListener("caja:changed", onCajaChanged)
  window.removeEventListener("keydown", onKeydown)
})
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
      <div>
        <h1 class="h4 mb-1">Ventas</h1>
        <div class="text-secondary">
          <span v-if="admin">Vista ADMIN: elegís fecha y turno.</span>
          <span v-else>Vista CAJERO: turno fijo ({{ turnoSel }}).</span>
        </div>
      </div>

      <button class="btn btn-outline-light" @click="refreshAll" :disabled="loading">
        {{ loading ? "Actualizando..." : "Refresh" }}
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
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
            <div v-if="!canSell" class="alert alert-warning py-2 mb-0 d-flex justify-content-between align-items-center">
              <span>{{ cajaCheck.error }}</span>
              <button class="btn btn-sm btn-outline-light" @click="goCaja">Ir a Caja</button>
            </div>

            <div v-else class="small text-secondary">
              Caja ABIERTA ✅ · Caja #{{ cajaAbierta?.cajaId }}
            </div>
          </div>
        </div>
      </div>
    </div>

   <div class="card bg-panel border-0 shadow-sm mb-3">
  <div class="card-body">
    <h2 class="h6 mb-3">Gestionar / devolver venta</h2>

    <div class="row g-2 align-items-end">
      <div class="col-12 col-md-4">
        <label class="form-label text-secondary">N° de venta</label>
        <input
          v-model="buscarVentaId"
          class="form-control bg-dark text-white border-secondary"
          placeholder="Ej: 125"
        />
      </div>

      <div class="col-12 col-md-3">
        <button class="btn btn-outline-light w-100" @click="buscarVenta" :disabled="buscarLoading">
          {{ buscarLoading ? "Buscando..." : "Buscar venta" }}
        </button>
      </div>
    </div>

    <div v-if="lastVenta" class="mt-3 p-3 rounded border border-secondary-subtle">
      <div class="row g-2">
        <div class="col-12 col-md-3">
          <div class="text-secondary small">Venta</div>
          <div class="fw-semibold">#{{ lastVenta.ventaId }}</div>
        </div>

        <div class="col-12 col-md-3">
          <div class="text-secondary small">Estado</div>
          <div
            class="fw-semibold"
            :class="
              lastVenta.estado === 'ANULADA'
                ? 'text-danger'
                : lastVenta.estado === 'PAGADA'
                ? 'text-success'
                : lastVenta.estado === 'PARCIAL'
                ? 'text-warning'
                : 'text-secondary'
            "
          >
            {{ lastVenta.estado }}
          </div>
        </div>

        <div class="col-12 col-md-3">
          <div class="text-secondary small">Cliente</div>
          <div class="fw-semibold">{{ lastVenta.clienteTxt }}</div>
        </div>

        <div class="col-12 col-md-3">
          <div class="text-secondary small">Total</div>
          <div class="fw-semibold">$ {{ formatMoney(lastVenta.total) }}</div>
        </div>
      </div>

      <div class="d-flex flex-wrap gap-2 mt-3">
        <button
          class="btn btn-outline-light"
          @click="openPagoModal(lastVenta.ventaId, lastVenta.total)"
          :disabled="lastVenta.estado === 'ANULADA' || lastVenta.estado === 'PAGADA'"
        >
          Cobrar venta
        </button>

        <button
  class="btn btn-outline-danger"
  @click="devolverVenta(lastVenta.ventaId)"
  :disabled="devolviendoVenta || lastVenta.estado === 'ANULADA'"
>
  {{ devolviendoVenta ? "Devolviendo..." : "Devolver venta" }}
</button>
      </div>

      <div class="text-secondary small mt-2">
  ⚠️ La devolución depende de las validaciones del backend: caja abierta, venta existente y pagos registrados.
</div>
    </div>
  </div>
</div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <h2 class="h6 mb-3">Nueva venta</h2>

        <div class="row g-2 mb-2">
          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Buscar cliente</label>
            <input
              v-model="clientesSearch"
              class="form-control bg-dark text-white border-secondary"
              placeholder="nombre / dni / teléfono"
              :disabled="!canSell"
            />
          </div>

          <div class="col-12 col-md-8">
            <label class="form-label text-secondary">Cliente (opcional)</label>
            <select v-model="clienteSelId" class="form-select bg-dark text-white border-secondary" :disabled="!canSell">
              <option value="">Sin cliente</option>
              <option v-for="c in clientes" :key="c.id" :value="String(c.id)">
                {{ c.nombre }} {{ c.apellido || "" }} — DNI: {{ c.dni || "-" }}
              </option>
            </select>
          </div>
        </div>

        <div class="text-secondary small mb-3">Registrá la venta y cobrá ahora o después (fiado).</div>

        <div class="row g-2 mb-2">
          <div class="col-12">
            <label class="form-label text-secondary">Buscar producto (nombre o código)</label>
            <input
              ref="codeInputRef"
              v-model="productSearch"
              class="form-control bg-dark text-white border-secondary"
              placeholder="Ej: shampoo / 779123..."
              :disabled="!canSell"
              @keydown="onSearchKeydown"
            />
            <div class="text-secondary small mt-1">
              Tip: si tipeás el <b>código exacto</b> y apretás <b>Enter</b>, agrega 1 unidad.
            </div>
          </div>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-7">
            <label class="form-label text-secondary">Producto</label>
            <select v-model="selProductoId" class="form-select bg-dark text-white border-secondary" :disabled="!canSell">
              <option value="" disabled>Seleccionar…</option>
              <option v-for="p in productos" :key="p.id" :value="String(p.id)">
                {{ p.nombre }} ({{ p.codigoProducto || "SIN CÓD" }}) — $ {{ formatMoney(getPrecioSugerido(p)) }}
                · Stock: {{ p.stockActual ?? "-" }}
              </option>
            </select>
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">Cant.</label>
            <input
              v-model="itemQty"
              class="form-control bg-dark text-white border-secondary"
              inputmode="numeric"
              :disabled="!canSell"
              @keydown="onQtyKeydown"
            />
          </div>

          <div class="col-12 col-md-3">
            <button class="btn btn-outline-light w-100" @click="addItem()" :disabled="!canSell || !selProductoId">
              Agregar
            </button>
          </div>
        </div>

        <div class="table-responsive mt-3" v-if="items.length">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th style="width: 130px">Base</th>
                <th style="width: 140px">Desc. %</th>
                <th style="width: 140px">Final</th>
                <th style="width: 120px">Cant.</th>
                <th style="width: 160px">Subtotal</th>
                <th style="width: 120px" class="text-end">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in items" :key="it.id" :class="it.invalidReason ? 'table-danger' : ''">
                <td class="fw-semibold">
                  {{ it.name }}
                  <div class="text-secondary small" v-if="it.invalidReason">{{ it.invalidReason }}</div>
                </td>

                <td class="text-secondary">
                  $ {{ formatMoney(it.basePrice) }}
                </td>

                <td>
                  <input
                    class="form-control form-control-sm bg-dark text-white border-secondary"
                    :value="it.porcentajeAjuste"
                    inputmode="decimal"
                    @input="updateItemPct(it.id, $event.target.value)"
                    :disabled="!canSell"
                    placeholder="0"
                  />
                </td>

                <td class="text-secondary fw-semibold">
                  $ {{ formatMoney(it.price) }}
                </td>

                <td>
                  <input
                    class="form-control form-control-sm bg-dark text-white border-secondary"
                    :value="it.qty"
                    inputmode="numeric"
                    @input="updateItemQty(it.id, $event.target.value)"
                    :disabled="!canSell"
                  />
                </td>

                <td class="fw-bold">
                  $ {{ formatMoney(it.subtotal) }}
                </td>

                <td class="text-end">
                  <button class="btn btn-sm btn-outline-light" @click="removeItem(it.id)" :disabled="!canSell">
                    Quitar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="text-secondary mt-3">Agregá productos para armar la venta.</div>

        <div v-if="hasInvalidItems" class="alert alert-danger py-2 mt-3 mb-0">
          Hay ítems inválidos (pérdida o stock insuficiente). Corregí y volvé a intentar.
        </div>

        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
          <div class="text-secondary">
            Total: <b class="fs-5">$ {{ formatMoney(totalCalc) }}</b>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-outline-light" @click="clearForm" :disabled="!canSell">Limpiar</button>
            <button class="btn btn-primary btn-accent" @click="registrarVenta" :disabled="!canRegister || saving">
              {{ saving ? "Guardando..." : "Registrar venta" }}
            </button>
          </div>
        </div>

        <div class="text-secondary small mt-2">
          ✅ Caja debe estar ABIERTA · ✅ Venta descuenta stock · ✅ Cada ítem admite descuento % · ✅ Cobro parcial/total desde el modal
        </div>
      </div>
    </div>

    <div v-if="showPagoModal" class="modal-backdrop-custom" @click.self="closePagoModal">
      <div class="modal-card">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
            <div class="h6 mb-0">Registrar pago</div>
            <div class="text-secondary small">
              Estado:
              <b
                :class="
                  estadoPagoVenta === 'PAGADA'
                    ? 'text-success'
                    : estadoPagoVenta === 'PARCIAL'
                      ? 'text-warning'
                      : 'text-secondary'
                "
              >
                {{ estadoPagoVenta }}
              </b>
            </div>
            <div class="text-secondary small">
              Venta #{{ pagoVentaId }} — Caja #{{ cajaAbierta?.cajaId }}
              · Total: <b>$ {{ formatMoney(pagoTotalVenta) }}</b>
              · Pagado: <b>$ {{ formatMoney(totalPagadoVenta) }}</b>
              · Restante: <b>$ {{ formatMoney(restanteVenta) }}</b>
            </div>
          </div>
          <button class="btn btn-sm btn-outline-light" @click="closePagoModal">X</button>
        </div>

        <div class="row g-2">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Monto</label>
            <div class="d-flex gap-2">
              <input v-model="pagoMonto" class="form-control bg-dark text-white border-secondary" placeholder="Ej: 20000" />
              <button class="btn btn-outline-light" @click="setPagarRestante" :disabled="pagoLoading || estadoPagoVenta === 'PAGADA'">
                Pagar restante
              </button>
            </div>
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Método de pago</label>
            <select v-model="pagoMetodoPagoId" class="form-select bg-dark text-white border-secondary" :disabled="estadoPagoVenta === 'PAGADA'">
              <option disabled value="">Seleccionar método…</option>
              <option v-if="!metodosPago.length" disabled value="">No hay métodos cargados</option>
              <option v-for="m in metodosPago" :key="m.id" :value="String(m.id)">{{ m.nombre }}</option>
            </select>
          </div>

          <div class="col-12">
            <label class="form-label text-secondary">Referencia (opcional)</label>
            <input
              v-model="pagoReferencia"
              class="form-control bg-dark text-white border-secondary"
              placeholder="Ej: comprobante / alias"
              :disabled="estadoPagoVenta === 'PAGADA'"
            />
          </div>
        </div>

        <div class="d-flex justify-content-end mt-3">
          <div class="d-flex gap-2">
            <button class="btn btn-outline-light" @click="closePagoModal" :disabled="pagoLoading">
              Dejar fiado
            </button>

            <button class="btn btn-primary btn-accent" @click="registrarPago" :disabled="pagoLoading || !canSell || estadoPagoVenta === 'PAGADA'">
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
                <tr v-for="p in pagosDeVenta" :key="p.id">
                  <td class="text-secondary">{{ p.id }}</td>
                  <td class="text-secondary">{{ metodoNombreById(p.metodoPagoId) }}</td>
                  <td class="text-end fw-bold">$ {{ formatMoney(p.monto) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="text-secondary small mt-2">✅ Los pagos impactan caja porque el backend crea un MovimientoCaja (INGRESO / VENTA).</div>
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