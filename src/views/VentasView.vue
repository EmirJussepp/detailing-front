<script setup>
import { computed, ref, watch, nextTick } from "vue"
import { useRoute, useRouter } from "vue-router"
import { getSession, isAdmin, getShift } from "../auth/session"

import SmartClientePicker from "../components/SmartClientePicker.vue"
import SmartProductoPicker from "../components/SmartProductoPicker.vue"

import { cajaApi } from "../services/cajaApi"
import { ventasApi } from "../services/ventasApi"
import { movimientosCajaApi } from "../services/movimientosCajaApi"
import { productosApi } from "../services/productosApi"
import { clientesApi } from "../services/clientesApi"
import { tipoClientesApi } from "../services/tipoClienteService"   // ✅ nombre consistente
import { pagosApi } from "../services/pagosApi"
import { metodosPagoApi } from "../services/metodopagoService"     // ✅ nombre consistente

import { mapCliente } from "../mappers/clientes"

// =========================
// Search PRO (normalize + tokens + debounce)
// =========================
function normalizeTxt(v) {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function buildTokens(q) {
  const s = normalizeTxt(q)
  if (!s) return []
  return s.split(/[\s,;|/\\]+/g).filter(Boolean)
}

function tokensMatch(blob, tokens) {
  if (!tokens.length) return true
  for (const t of tokens) {
    if (!blob.includes(t)) return false
  }
  return true
}

function useDebouncedRef(sourceRef, delay = 180) {
  const debounced = ref(sourceRef.value)
  let t = null
  watch(sourceRef, (v) => {
    clearTimeout(t)
    t = setTimeout(() => (debounced.value = v), delay)
  })
  return debounced
}

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

// =========================
// Turno: UI <-> Backend
// =========================
function turnoUI(t) {
  const s = String(t ?? "").toUpperCase()
  if (s === "MANIANA" || s === "MAÑANA") return "MAÑANA"
  if (s === "TARDE") return "TARDE"
  return "MAÑANA"
}
function turnoBE(t) {
  return turnoUI(t) === "MAÑANA" ? "MANIANA" : "TARDE"
}

const fecha = ref(todayISO())
const turnoSel = ref(turnoUI(admin.value ? "MAÑANA" : getShift()))

// =========================
// Mensajes
// =========================
const errorMsg = ref("")
const okMsg = ref("")

// =========================
// Helpers
// =========================
function ensureUUID() {
  return crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.floor(Math.random() * 1e9)}`
}
function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
}
function toMoneyNumber(v) {
  const x = Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(x) ? x : NaN
}
function toIntSafe(v, fallback = 0) {
  const x = Math.floor(Number(String(v ?? "").replace(",", ".")))
  return Number.isFinite(x) ? x : fallback
}

// =========================
// Persistencia: bucket por turno + last_ctx
// =========================
const LS_LAST_CTX = "ventas:last_ctx_v1"

function saveLastCtx(ctx) {
  try { localStorage.setItem(LS_LAST_CTX, JSON.stringify(ctx)) } catch {}
}
function readLastCtx() {
  try { return JSON.parse(localStorage.getItem(LS_LAST_CTX) || "null") } catch { return null }
}

function bucketKey() {
  return `ventas:bucket_v1:${userIdInt.value}:${fecha.value}:${turnoBE(turnoSel.value)}`
}
function readBucket() {
  try { return JSON.parse(localStorage.getItem(bucketKey()) || "[]") } catch { return [] }
}
function saveBucket(arr) {
  try { localStorage.setItem(bucketKey(), JSON.stringify(arr)) } catch {}
}
function upsertInBucket(ctx) {
  const arr = readBucket()
  const idx = arr.findIndex(v => Number(v.ventaId) === Number(ctx.ventaId))
  if (idx >= 0) arr[idx] = { ...arr[idx], ...ctx, ts: Date.now() }
  else arr.unshift({ ...ctx, ts: Date.now() })
  saveBucket(arr.slice(0, 80))
}
function removeFromBucket(ventaId) {
  saveBucket(readBucket().filter(v => Number(v.ventaId) !== Number(ventaId)))
}
function isOpenEstado(e) {
  const s = String(e ?? "").toUpperCase()
  return s === "PENDIENTE" || s === "PARCIAL"
}
function pickBestCtxForHeader() {
  const arr = readBucket()
  const open = arr
    .filter(v => isOpenEstado(v.estado))
    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
  if (open.length) return open[0]
  const last = readLastCtx()
  if (last?.ventaId) return last
  if (arr.length) return arr[0]
  return null
}

// =========================
// Tipos de cliente (cache)
// =========================
const tiposCliente = ref([])
const tiposLoaded = ref(false)

async function fetchTiposClienteOnce() {
  if (tiposLoaded.value && tiposCliente.value.length) return
  try {
    const { data } = await tipoClientesApi.list() // ✅ consistente
    tiposCliente.value = Array.isArray(data) ? data : []
  } catch {
    tiposCliente.value = []
  } finally {
    tiposLoaded.value = true
  }
}

function getTipoClienteNameById(tipoId) {
  const t = tiposCliente.value.find(x => Number(x.tipoClienteId ?? x.id) === Number(tipoId))
  return String(t?.name ?? t?.nombre ?? "").toUpperCase()
}
function isMayoristaCliente(cliente) {
  if (!cliente?.tipoClienteId) return false
  return getTipoClienteNameById(cliente.tipoClienteId).includes("MAYOR")
}

// =========================
// Estado principal
// =========================
const cajaCheck = ref({ ok: false, error: "" })
const cajaAbierta = ref(null)

const movimientosCaja = ref([])
const resumenCaja = ref({ ingresos: 0, egresos: 0, saldo: 0 })

const ventas = ref([])
const productos = ref([])
const clientes = ref([])

// =========================
// Search Clientes PRO
// =========================
const clienteSearch = ref("")
const clienteSearchDebounced = useDebouncedRef(clienteSearch, 160)

const clientesById = computed(() => {
  const m = new Map()
  for (const c of (clientes.value || [])) m.set(Number(c.id), c)
  return m
})

const clientesIndex = computed(() => {
  const arr = clientes.value || []
  return arr.map(c => {
    const id = Number(c.id ?? c.clienteId ?? 0)
    const blob = normalizeTxt([
      id,
      c.nombre,
      c.apellido,
      c.dni,
      c.telefono,
      c.email,
      c.localidad,
    ].filter(Boolean).join(" "))
    return { c, id, blob }
  })
})

const clientesFiltrados = computed(() => {
  const tokens = buildTokens(clienteSearchDebounced.value)
  if (!tokens.length) return clientes.value
  return clientesIndex.value
    .filter(x => tokensMatch(x.blob, tokens))
    .map(x => x.c)
})

const clienteSelId = ref("")
const clienteSel = computed(() => clientes.value.find(c => String(c.id) === String(clienteSelId.value)) ?? null)

const tipoClienteBadge = computed(() => {
  if (!clienteSel.value) return null
  return isMayoristaCliente(clienteSel.value) ? "MAYORISTA" : "MINORISTA"
})

const canSell = computed(() => cajaCheck.value?.ok === true && Boolean(cajaAbierta.value?.cajaId))

function applyClienteFromQuery() {
  const qid = route.query.clienteId
  if (!qid) return
  clienteSelId.value = String(qid)
  router.replace({ query: { ...route.query, clienteId: undefined } })
}

function buildClienteTxtFromClienteObj(c) {
  if (!c) return "Sin cliente"
  return `${c.nombre} ${c.apellido || ""} (DNI: ${c.dni || "-"})`
}
function resolveClienteTxt(clienteId, fallbackTxt = "Sin cliente") {
  if (!clienteId) return "Sin cliente"
  const c = clientesById.value.get(Number(clienteId))
  return c ? buildClienteTxtFromClienteObj(c) : (fallbackTxt || "Sin cliente")
}

// =========================
// Métodos de pago (cache)
// =========================
const metodosPago = ref([])
const metodosLoaded = ref(false)

function normalizeMetodoPago(x) {
  return {
    id: Number(x?.metodoPagoId ?? x?.id ?? 0),
    nombre: String(x?.nombre ?? x?.name ?? x?.descripcion ?? x?.tipo ?? "SIN NOMBRE"),
  }
}
async function fetchMetodosPagoOnce() {
  if (metodosLoaded.value && metodosPago.value.length) return
  try {
    const { data } = await metodosPagoApi.list() // ✅ consistente
    const arr = Array.isArray(data) ? data : []
    metodosPago.value = arr.map(normalizeMetodoPago).filter(m => m.id > 0)
  } catch {
    metodosPago.value = []
  } finally {
    metodosLoaded.value = true
  }
}
function metodoNombreById(id) {
  const m = metodosPago.value.find(x => Number(x.id) === Number(id))
  return m?.nombre ?? String(id ?? "-")
}

// =========================
// Filtros de productos + scanner
// =========================
const productSearch = ref("")
const codeInputRef = ref(null)

const productosFiltrados = computed(() => {
  const term = String(productSearch.value ?? "").trim().toLowerCase()
  if (!term) return productos.value
  return productos.value.filter(p => {
    const n = String(p.nombre ?? "").toLowerCase()
    const c = String(p.codigoProducto ?? "").toLowerCase()
    const cat = String(p.categoria ?? "").toLowerCase()
    return n.includes(term) || c.includes(term) || cat.includes(term)
  })
})

// =========================
// Items (carrito)
// =========================
const selProductoId = ref("")
const itemQty = ref("1")

const selectedProducto = computed(() => productos.value.find(p => String(p.id) === String(selProductoId.value)) ?? null)

const items = ref([])

const reservedByProductId = computed(() => {
  const map = new Map()
  for (const it of items.value) {
    const pid = Number(it.productId)
    map.set(pid, (map.get(pid) ?? 0) + Number(it.qty ?? 0))
  }
  return map
})

function availableForProduct(p, excludingItemId = null) {
  const stock = p?.stockActual == null ? null : Number(p.stockActual)
  if (stock == null) return null

  const pid = Number(p.id)
  const reserved = reservedByProductId.value.get(pid) ?? 0

  if (!excludingItemId) return Math.max(0, stock - reserved)

  const it = items.value.find(x => x.id === excludingItemId)
  const currentQty = it ? Number(it.qty ?? 0) : 0
  return Math.max(0, stock - (reserved - currentQty))
}

function recalcItem(it) {
  const price = Number(it.price ?? 0)
  const cost = Number(it.cost ?? 0)
  const qty = Number.isFinite(Number(it.qty)) ? Number(it.qty) : 0
  const subtotal = price * qty
  const invalidReason = price < cost ? `Vende a pérdida: $${formatMoney(price)} < costo $${formatMoney(cost)}` : ""
  return { ...it, qty, subtotal, invalidReason }
}

function getPrecioSugerido(p) {
  const mayor = isMayoristaCliente(clienteSel.value)
  if (mayor) return Number(p.precioMayorista ?? p.precioVenta ?? 0)
  return Number(p.precioVenta ?? 0)
}

function addOrIncrementProduct(p, qtyToAdd = 1) {
  const existing = items.value.find(it => Number(it.productId) === Number(p.id))
  if (existing) {
    updateItemQty(existing.id, Number(existing.qty ?? 0) + qtyToAdd)
    return
  }
  const base = {
    id: ensureUUID(),
    productId: Number(p.id),
    name: p.nombre,
    price: getPrecioSugerido(p),
    cost: Number(p.precioCosto ?? 0),
    qty: qtyToAdd,
  }
  items.value = [...items.value, recalcItem(base)]
}

function addItem() {
  errorMsg.value = ""
  okMsg.value = ""

  if (!canSell.value) {
    errorMsg.value = cajaCheck.value?.error || "Caja no disponible para vender."
    return
  }

  const p = selectedProducto.value
  if (!p) {
    errorMsg.value = "Seleccioná un producto."
    return
  }

  const qty = toIntSafe(itemQty.value, 0)
  if (!qty || qty <= 0) {
    errorMsg.value = "Cantidad inválida."
    return
  }

  const available = availableForProduct(p)
  if (available != null && qty > available) {
    errorMsg.value = `Stock insuficiente. Disponible (considerando carrito): ${available}`
    return
  }

  addOrIncrementProduct(p, qty)

  selProductoId.value = ""
  itemQty.value = "1"
  nextTick(() => codeInputRef.value?.focus?.())
}

function removeItem(itemId) {
  items.value = items.value.filter(i => i.id !== itemId)
  nextTick(() => codeInputRef.value?.focus?.())
}

function updateItemQty(itemId, qty) {
  errorMsg.value = ""

  const parsed = toIntSafe(qty, 1)
  const finalQty = parsed <= 0 ? 1 : parsed

  const it0 = items.value.find(x => x.id === itemId)
  const p = it0 ? productos.value.find(pp => Number(pp.id) === Number(it0.productId)) : null

  if (p) {
    const available = availableForProduct(p, itemId)
    if (available != null && finalQty > available) {
      errorMsg.value = `Stock insuficiente. Disponible (considerando carrito): ${available}`
      return
    }
  }

  items.value = items.value.map(it => (it.id === itemId ? recalcItem({ ...it, qty: finalQty }) : it))
}

function clearForm() {
  if (items.value.length > 0) {
    const ok = confirm("¿Seguro querés limpiar la venta? Se van a borrar los ítems.")
    if (!ok) return
  }

  items.value = []
  clienteSelId.value = ""
  selProductoId.value = ""
  itemQty.value = "1"
  nextTick(() => codeInputRef.value?.focus?.())
}

// =========================
// Totales
// =========================
const totalCalc = computed(() => items.value.reduce((acc, it) => acc + Number(it.subtotal ?? 0), 0))
const hasInvalidItems = computed(() => items.value.some(it => it.invalidReason))
const canRegister = computed(() => canSell.value && items.value.length > 0 && !hasInvalidItems.value)
const ventasTotalDelBucket = computed(() => ventas.value.reduce((acc, v) => acc + Number(v.total ?? 0), 0))

const pendientesDelTurno = computed(() => {
  const arr = readBucket()
  const open = arr
    .filter(v => isOpenEstado(v.estado))
    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))

  return open.map(v => ({
    ...v,
    clienteTxt: resolveClienteTxt(v.clienteId, v.clienteTxt || "Sin cliente"),
  }))
})

function formatTs(ts) {
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return "-"
  return new Date(n).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

// =========================
// Última venta (UI)
// =========================
const lastTicket = ref(null)
const lastVentaUI = ref(null)

function buildVentaUI(payload, ventaId, total) {
  const cliId = clienteSel.value?.id ? Number(clienteSel.value.id) : null
  const clienteTxt = resolveClienteTxt(cliId, "Sin cliente")

  return {
    ventaId: ventaId ?? null,
    total: Number(total ?? 0),
    fecha: fecha.value,
    turno: turnoUI(turnoSel.value),
    clienteId: cliId,
    estado: payload?.venta?.estado ?? payload?.estado ?? "PENDIENTE",
    cliente: clienteTxt,
    items: items.value.map(i => ({
      productId: i.productId,
      name: i.name,
      qty: i.qty,
      price: i.price,
      subtotal: i.subtotal,
    })),
    raw: payload ?? null,
  }
}

// =========================
// Scanner (Enter)
// =========================
function findByCodigoExacto(codeRaw) {
  const code = String(codeRaw ?? "").trim().toLowerCase()
  if (!code) return null
  return productos.value.find(p => String(p.codigoProducto ?? "").trim().toLowerCase() === code) ?? null
}

function parseCodigoConCantidad(raw) {
  const s = String(raw ?? "").trim()
  if (!s) return { code: "", qty: 1 }

  const normalized = s.replace(/\s+/g, " ").trim()
  const m1 = normalized.match(/^(.+?)(?:\s*[*xX]\s*)(\d+)$/)
  if (m1) return { code: m1[1].trim(), qty: Math.max(1, parseInt(m1[2], 10)) }

  const m2 = normalized.match(/^(.+?)\s+(\d+)$/)
  if (m2) return { code: m2[1].trim(), qty: Math.max(1, parseInt(m2[2], 10)) }

  return { code: normalized, qty: 1 }
}

function addFromSearchEnter() {
  errorMsg.value = ""
  okMsg.value = ""

  if (!canSell.value) {
    errorMsg.value = cajaCheck.value?.error || "Caja no disponible."
    return
  }

  const raw = String(productSearch.value ?? "").trim()
  if (!raw) return

  const { code, qty } = parseCodigoConCantidad(raw)
  const byCode = findByCodigoExacto(code)

  if (byCode) {
    const available = availableForProduct(byCode)
    if (available != null && qty > available) {
      errorMsg.value = `Stock insuficiente. Disponible (considerando carrito): ${available}`
      return
    }

    addOrIncrementProduct(byCode, qty)
    productSearch.value = ""
    nextTick(() => codeInputRef.value?.focus?.())
    return
  }

  const list = productosFiltrados.value
  if (!list.length) {
    errorMsg.value = "No hay productos que coincidan con la búsqueda."
    return
  }

  if (list.length === 1) {
    const p = list[0]
    const available = availableForProduct(p)
    if (available != null && 1 > available) {
      errorMsg.value = `Stock insuficiente. Disponible (considerando carrito): ${available}`
      return
    }

    addOrIncrementProduct(p, 1)
    productSearch.value = ""
    nextTick(() => codeInputRef.value?.focus?.())
    return
  }

  errorMsg.value = `Hay ${list.length} coincidencias. Seleccioná el producto en la lista y tocá "Agregar".`
}

// =========================
// Pagos
// =========================
function normalizePago(p) {
  const id = Number(p?.pagoId ?? p?.id ?? p?.pago_id ?? 0)
  const metodoPagoId = Number(
    p?.metodoPagoId ??
    p?.metodo_pago_id ??
    p?.metodoPago ??
    p?.metodo_id ??
    p?.metodoId ??
    0
  )
  const monto = Number(p?.monto ?? p?.importe ?? p?.amount ?? p?.total ?? p?.valor ?? 0)
  return {
    id,
    metodoPagoId,
    monto,
    referencia: p?.referencia ?? p?.ref ?? p?.descripcion ?? null,
    fecha: p?.fecha ?? p?.createdAt ?? p?.created_at ?? null,
  }
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
    const arr = Array.isArray(data) ? data : []
    pagosDeVenta.value = arr.map(normalizePago).filter(x => x.id > 0)
  } catch {
    pagosDeVenta.value = []
  }
}

const totalPagadoVenta = computed(() => (pagosDeVenta.value ?? []).reduce((a, p) => a + Number(p.monto ?? 0), 0))
const restanteVenta = computed(() => {
  const r = Number(pagoTotalVenta.value ?? 0) - Number(totalPagadoVenta.value ?? 0)
  return Math.max(0, r)
})

const estadoPagoVenta = computed(() => {
  if (!pagoVentaId.value) return "-"
  const total = Number(pagoTotalVenta.value ?? 0)
  const pagado = Number(totalPagadoVenta.value ?? 0)
  if (pagado <= 0) return "PENDIENTE"
  if (pagado < total) return "PARCIAL"
  return "PAGADA"
})

async function openPagoModal(ventaId, suggestedTotal = 0) {
  pagoVentaId.value = Number(ventaId)
  pagoTotalVenta.value = Number(suggestedTotal ?? 0)
  pagoMonto.value = ""
  pagoReferencia.value = ""
  pagoMetodoPagoId.value = metodosPago.value?.[0]?.id ? String(metodosPago.value[0].id) : ""
  showPagoModal.value = true
  await loadPagosVenta(ventaId)
}

function closePagoModal() {
  showPagoModal.value = false
  nextTick(() => codeInputRef.value?.focus?.())
}

function setPagarTotalRestante() {
  pagoMonto.value = String(restanteVenta.value || pagoTotalVenta.value || "")
}

function syncCtxToUI(ctx) {
  if (!ctx?.ventaId) return

  lastVentaUI.value = {
    ventaId: Number(ctx.ventaId),
    total: Number(ctx.total || 0),
    fecha: String(ctx.fecha || fecha.value),
    turno: turnoUI(ctx.turno || turnoSel.value),
    clienteId: ctx.clienteId ?? null,
    cliente: resolveClienteTxt(ctx.clienteId, ctx.clienteTxt || "Sin cliente"),
    estado: String(ctx.estado || "PENDIENTE"),
    items: lastVentaUI.value?.items || [],
    raw: lastVentaUI.value?.raw || null,
  }

  pagoVentaId.value = Number(ctx.ventaId)
  pagoTotalVenta.value = Number(ctx.total || 0)
}

async function restoreBestVentaAndPagos() {
  const best = pickBestCtxForHeader()
  if (!best?.ventaId) return

  syncCtxToUI(best)
  await loadPagosVenta(best.ventaId)

  const total = Number(pagoTotalVenta.value ?? 0)
  const pagado = Number(totalPagadoVenta.value ?? 0)

  let estado = "PENDIENTE"
  if (pagado <= 0) estado = "PENDIENTE"
  else if (pagado < total) estado = "PARCIAL"
  else estado = "PAGADA"

  if (estado === "PAGADA") removeFromBucket(best.ventaId)
  else upsertInBucket({ ...best, estado })

  saveLastCtx({ ...best, estado, ts: Date.now() })
}

async function registrarPago() {
  if (pagoLoading.value) return
  pagoLoading.value = true
  errorMsg.value = ""
  okMsg.value = ""

  try {
    if (!cajaAbierta.value?.cajaId) throw new Error("No hay caja ABIERTA para registrar el pago.")
    if (!pagoVentaId.value) throw new Error("Venta inválida.")

    const mp = Number(pagoMetodoPagoId.value)
    if (!Number.isFinite(mp) || mp <= 0) throw new Error("Seleccioná un método de pago.")

    const monto = toMoneyNumber(pagoMonto.value)
    if (!Number.isFinite(monto) || monto <= 0) throw new Error("Monto de pago inválido.")

    const payload = {
      ventaId: Number(pagoVentaId.value),
      cajaId: Number(cajaAbierta.value.cajaId),
      metodoPagoId: mp,
      monto,
      referencia: pagoReferencia.value?.trim() || null,
    }

    const { data: res } = await pagosApi.create(payload)
    const ventaUpdated = res?.venta ?? res?.ventaActualizada ?? null

    await loadPagosVenta(pagoVentaId.value)
    await refreshAfterPago()

    if (ventaUpdated?.total != null) pagoTotalVenta.value = Number(ventaUpdated.total)

    const total = Number(pagoTotalVenta.value ?? 0)
    const pagado = Number(totalPagadoVenta.value ?? 0)
    const estadoFinal = pagado <= 0 ? "PENDIENTE" : pagado < total ? "PARCIAL" : "PAGADA"

    if (lastVentaUI.value && Number(lastVentaUI.value.ventaId) === Number(pagoVentaId.value)) {
      lastVentaUI.value = {
        ...lastVentaUI.value,
        total: Number(pagoTotalVenta.value ?? lastVentaUI.value.total ?? 0),
        estado: estadoFinal,
      }
    }

    const ctx = {
      ventaId: Number(pagoVentaId.value),
      total: Number(pagoTotalVenta.value ?? 0),
      estado: estadoFinal,
      fecha: String(fecha.value),
      turno: String(turnoBE(turnoSel.value)),
      clienteId: lastVentaUI.value?.clienteId ?? null,
      clienteTxt: lastVentaUI.value?.cliente ?? "Sin cliente",
    }

    saveLastCtx({ ...ctx, ts: Date.now() })
    if (estadoFinal === "PAGADA") removeFromBucket(ctx.ventaId)
    else upsertInBucket(ctx)

    okMsg.value = `Pago registrado ✅ $ ${formatMoney(monto)} (${metodoNombreById(mp)})`

    if (restanteVenta.value > 0) pagoMonto.value = String(restanteVenta.value)
    else pagoMonto.value = ""
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
// Refresh
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

async function refreshProductos() {
  try {
    const { data } = await productosApi.list()
    const arr = Array.isArray(data) ? data : []
    productos.value = arr.map(p => ({
      id: Number(p.productoId ?? p.id),
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
}

async function refreshClientes() {
  try {
    const { data } = await clientesApi.list()
    const arr = Array.isArray(data) ? data : []
    clientes.value = arr.map(mapCliente).filter(c => c.activo !== false)
    applyClienteFromQuery()
  } catch {
    clientes.value = []
  }
}

async function refreshMovimientos() {
  movimientosCaja.value = []
  resumenCaja.value = { ingresos: 0, egresos: 0, saldo: 0 }

  if (!cajaAbierta.value?.cajaId) return

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
    // no rompemos la vista
  }
}

async function refreshAll() {
  await fetchTiposClienteOnce()
  await fetchMetodosPagoOnce()

  await refreshCaja()
  await Promise.all([refreshProductos(), refreshClientes()])
  await refreshMovimientos()

  await restoreBestVentaAndPagos()
}

async function refreshAfterVenta() {
  await refreshCaja()
  await Promise.all([refreshProductos()])
  await refreshMovimientos()
}

async function refreshAfterPago() {
  await refreshCaja()
  await refreshMovimientos()
}

watch([fecha, turnoSel, admin], async () => {
  try {
    await refreshAll()
  } catch (e) {
    console.log("refreshAll error:", e)
  }
}, { immediate: true })

// =========================
// Registrar venta (BACKEND)
// =========================
async function registrarVenta() {
  if (saving.value) return
  saving.value = true

  try {
    errorMsg.value = ""
    okMsg.value = ""

    if (!canSell.value) {
      errorMsg.value = cajaCheck.value?.error || "No hay caja ABIERTA (backend)."
      return
    }

    const uid = Number(userIdInt.value)
    if (!Number.isFinite(uid) || uid <= 0) {
      throw new Error("userId inválido en sesión.")
    }

    const detallesVenta = items.value.map(i => ({
      productoId: Number(i.productId),
      cantidad: Number(i.qty),
    }))

    const command = {
      cajaId: Number(cajaAbierta.value.cajaId),
      userId: uid,
      clienteId: clienteSel.value?.id ? Number(clienteSel.value.id) : null,
      detallesVenta,
    }

    const { data } = await ventasApi.create(command)

    const ventaId = data?.venta?.ventaId ?? data?.ventaId ?? null
    const total = Number(data?.venta?.total ?? data?.total ?? totalCalc.value)
    const ventaEstado = data?.venta?.estado ?? data?.estado ?? "PENDIENTE"

    lastTicket.value = data
    lastVentaUI.value = buildVentaUI(data, ventaId, total)

    okMsg.value = ventaId
      ? `Venta #${ventaId} registrada ✅ Total: $ ${formatMoney(total)}`
      : `Venta registrada ✅ Total: $ ${formatMoney(total)}`

    if (ventaId) {
      const clienteTxt = resolveClienteTxt(
        clienteSel.value?.id ? Number(clienteSel.value.id) : null,
        buildClienteTxtFromClienteObj(clienteSel.value)
      )

      const ctx = {
        ventaId: Number(ventaId),
        total: Number(total || 0),
        estado: String(ventaEstado || "PENDIENTE"),
        fecha: String(fecha.value),
        turno: String(turnoBE(turnoSel.value)),
        clienteId: clienteSel.value?.id ? Number(clienteSel.value.id) : null,
        clienteTxt,
      }

      saveLastCtx({ ...ctx, ts: Date.now() })
      if (isOpenEstado(ctx.estado)) upsertInBucket(ctx)
    }

    items.value = []
    selProductoId.value = ""
    itemQty.value = "1"
    productSearch.value = ""

    await refreshAfterVenta()

    if (ventaId) await openPagoModal(ventaId, total)

    nextTick(() => codeInputRef.value?.focus?.())
  } catch (e) {
    console.log("VENTAS ERROR:", e?.response?.status, e?.response?.data)

    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      (typeof e?.response?.data === "string" ? e.response.data : null) ||
      e?.message ||
      "Error creando venta en backend."

    await refreshAll()
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
        

        <div class="text-secondary small mt-2">
          Ingresos: <b>$ {{ formatMoney(resumenCaja.ingresos) }}</b> ·
          Egresos: <b>$ {{ formatMoney(resumenCaja.egresos) }}</b>
        </div>
      </div>
    </div>

    <!-- ÚLTIMA VENTA (ENRIQUECIDA) -->
    <div class="card bg-dark border-secondary mb-4" v-if="lastVentaUI">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center gap-2">
          <h2 class="h6 mb-0">Última venta</h2>

          <button
            class="btn btn-sm btn-outline-light"
            v-if="lastVentaUI?.ventaId"
            @click="openPagoModal(lastVentaUI.ventaId, lastVentaUI.total)"
            :disabled="!cajaAbierta?.cajaId"
          >
            Ver / registrar pagos
          </button>
        </div>

        <div class="text-secondary small mt-2">
          Venta: <b>#{{ lastVentaUI.ventaId ?? "—" }}</b> ·
          Fecha: <b>{{ lastVentaUI.fecha }}</b> ·
          Turno: <b>{{ lastVentaUI.turno }}</b>
        </div>

        <div class="text-secondary small mt-1">
          Cliente: <b>{{ lastVentaUI.cliente }}</b>
        </div>

        <div class="text-secondary small mt-1">
          Total: <b>$ {{ formatMoney(lastVentaUI.total) }}</b>
        </div>

        <div class="table-responsive mt-3" v-if="lastVentaUI.items?.length">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th style="width: 110px">Cant.</th>
                <th style="width: 140px">Precio</th>
                <th style="width: 160px">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in lastVentaUI.items" :key="it.productId + '-' + it.name">
                <td class="fw-semibold">{{ it.name }}</td>
                <td class="text-secondary">{{ it.qty }}</td>
                <td class="text-secondary">$ {{ formatMoney(it.price) }}</td>
                <td class="fw-bold">$ {{ formatMoney(it.subtotal) }}</td>
              </tr>
            </tbody>
          </table>
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
              Cliente <b>Mayorista</b> (precio sugerido mayorista donde corresponda)
            </div>
          </div>

          <div class="col-12 col-md-4 d-flex align-items-end">
            <div class="text-secondary small">Tip: buscá rápido o escaneá por código.</div>
          </div>
        </div>

        <div class="row g-2 mb-2">
          <div class="col-12">
            <label class="form-label text-secondary">Buscar / Escanear (Enter)</label>
            <input
              ref="codeInputRef"
              v-model="productSearch"
              class="form-control bg-dark text-white border-secondary"
              placeholder="Ej: SH-001*3  |  shampoo"
              :disabled="!canSell"
              @keydown.enter.prevent="addFromSearchEnter"
            />
            <div class="text-secondary small mt-1">
              Enter agrega por <b>código exacto</b>. Si buscás por nombre, Enter agrega solo si hay <b>1 coincidencia</b>.
            </div>
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

              <option v-for="p in productosFiltrados" :key="p.id" :value="String(p.id)">
                {{ p.nombre }}
                ({{ p.codigoProducto || "SIN CÓD" }})
                — $ {{ formatMoney(getPrecioSugerido(p)) }}
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
                <th style="width: 120px">Cant.</th>
                <th style="width: 150px">Subtotal</th>
                <th style="width: 120px" class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in items" :key="it.id" :class="it.invalidReason ? 'table-danger' : ''">
                <td class="fw-semibold">
                  {{ it.name }}
                  <div class="text-secondary small" v-if="it.invalidReason">{{ it.invalidReason }}</div>
                </td>

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
          Hay ítems a pérdida. Ajustá el precio/costo.
        </div>

        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
          <div class="text-secondary">
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

    <!-- PENDIENTES / PARCIALES (DEL TURNO) -->
    <div class="card bg-panel border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 class="h6 mb-0">Pendientes / parciales del turno</h2>
          <div class="text-secondary small">
            {{ pendientesDelTurno.length }} venta(s) abierta(s)
          </div>
        </div>

        <div v-if="!pendientesDelTurno.length" class="text-secondary">
          No hay ventas pendientes/parciales guardadas en este turno.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 90px">Venta</th>
                <th>Cliente</th>
                <th style="width: 120px">Estado</th>
                <th style="width: 140px" class="text-end">Total</th>
                <th style="width: 110px" class="text-secondary">Último</th>
                <th style="width: 220px" class="text-end">Acciones</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="v in pendientesDelTurno" :key="v.ventaId">
                <td class="fw-semibold">#{{ v.ventaId }}</td>

                <td class="text-secondary">
                  {{ v.clienteTxt || "Sin cliente" }}
                </td>

                <td>
                  <span
                    class="badge"
                    :class="String(v.estado).toUpperCase() === 'PARCIAL' ? 'bg-warning text-dark' : 'bg-secondary'"
                  >
                    {{ String(v.estado || 'PENDIENTE').toUpperCase() }}
                  </span>
                </td>

                <td class="text-end fw-bold">$ {{ formatMoney(v.total) }}</td>

                <td class="text-secondary small">{{ formatTs(v.ts) }}</td>

                <td class="text-end">
                  <div class="d-inline-flex gap-2">
                    <button
                      class="btn btn-sm btn-outline-light"
                      @click="openPagoModal(v.ventaId, v.total)"
                      :disabled="!cajaAbierta?.cajaId"
                    >
                      Pagar
                    </button>

                    <button
                      class="btn btn-sm btn-outline-danger"
                      title="Saca esta venta del listado local"
                      @click="removeFromBucket(v.ventaId)"
                    >
                      Quitar
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="text-secondary small mt-2">
            ✅ Sale del <b>bucket</b> (localStorage por fecha/turno). Si una venta queda <b>PAGADA</b>, se limpia sola.
          </div>
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
              <input
                v-model="pagoMonto"
                class="form-control bg-dark text-white border-secondary"
                placeholder="Ej: 20000"
              />
              <button class="btn btn-outline-light" @click="setPagarTotalRestante" :disabled="pagoLoading">
                Pagar restante
              </button>
            </div>
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

        <div class="d-flex justify-content-end align-items-center mt-3">
          <div class="d-flex gap-2">
            <button class="btn btn-outline-light" @click="closePagoModal" :disabled="pagoLoading">
              Cancelar
            </button>
            <button
              class="btn btn-primary btn-accent"
              @click="registrarPago"
              :disabled="pagoLoading || !cajaAbierta?.cajaId"
            >
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
