<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue"
import { useRouter } from "vue-router"
import { getSession, isAdmin } from "../auth/session"
import { getTurnoOperativo, setTurnoOperativo } from "../ui/turnoOperativo"
import { cajaApi } from "../services/cajaApi"
import { ventasApi } from "../services/ventasApi"
import { pagosApi } from "../services/pagosApi"
import { metodosPagoApi } from "../services/metodopagoService"
import { productosApi } from "../services/productosApi"
import { clientesApi } from "../services/clientesApi"
import { mapCliente } from "../mappers/clientes"

function formatMoney2(n) {
  const num = Number(n ?? 0)
  return Number.isFinite(num)
    ? num.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    : "0,00"
}

function formatMoney(n) {
  const num = Number(n ?? 0)
  return Number.isFinite(num)
    ? num.toLocaleString("es-AR", { maximumFractionDigits: 0 })
    : "0"
}

function parseArNumber(v) {
  let s = String(v ?? "").trim()
  if (!s) return NaN

  s = s.replace(/\$/g, "").replace(/\s/g, "")

  const hasComma = s.includes(",")
  const hasDot = s.includes(".")

  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", ".")
    const x = Number(s)
    return Number.isFinite(x) ? x : NaN
  }

  if (hasComma) {
    s = s.replace(",", ".")
    const x = Number(s)
    return Number.isFinite(x) ? x : NaN
  }

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
  return Number.isFinite(n) && n > 0 ? n : 0
}

function pickErr(e, fallback = "Error") {
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.response?.data ||
    e?.message ||
    fallback
  )
}

function getCajaInfoMessage(turno) {
  return `Todavía no hay caja abierta para el turno ${turnoUI(turno)}.`
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
  if (n < -100) return -100
  if (n > 100) return 100
  return round2(n)
}

const router = useRouter()
const session = getSession() ?? null
const admin = computed(() => Boolean(session && isAdmin()))
const userIdInt = computed(() => resolveUserId(session))
const hasValidUser = computed(() => Number(userIdInt.value) > 0)

const loading = ref(false)
const saving = ref(false)
const errorMsg = ref("")
const okMsg = ref("")
const infoMsg = ref("")

function setOk(msg) {
  okMsg.value = msg
  errorMsg.value = ""
}

function setErr(msg) {
  errorMsg.value = msg
  okMsg.value = ""
}

function clearMsgs() {
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""
}

const fechaTexto = computed(() => {
  const d = new Date()
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
})

const turnoSel = ref(turnoUI(getTurnoOperativo()))

const cajaCheck = ref({ ok: false, error: "" })
const cajaAbierta = ref(null)

async function refreshCaja() {
  try {
    const { data } = await cajaApi.abierta({ turno: turnoBE(turnoSel.value) })
    cajaAbierta.value = data ?? null

    if (cajaAbierta.value?.cajaId) {
      cajaCheck.value = { ok: true, error: "" }
      infoMsg.value = ""
    } else {
      cajaCheck.value = { ok: false, error: "No hay caja ABIERTA." }
      infoMsg.value = getCajaInfoMessage(turnoSel.value)
    }
  } catch (e) {
    cajaAbierta.value = null

    if (e?.response?.status === 404) {
      cajaCheck.value = { ok: false, error: "No hay caja ABIERTA." }
      infoMsg.value = getCajaInfoMessage(turnoSel.value)
    } else {
      cajaCheck.value = { ok: false, error: pickErr(e, "No se pudo validar la caja.") }
      infoMsg.value = ""
    }
  }
}

const canSell = computed(() => {
  return hasValidUser.value && cajaCheck.value.ok === true && Boolean(cajaAbierta.value?.cajaId)
})

function goCaja() {
  router.push({ name: "caja.dashboard" })
}

const productos = ref([])
const clientes = ref([])
const metodosPago = ref([])
const loadedMetodos = ref(false)

const productSearch = ref("")
const clientesSearch = ref("")

// ✅ FIX 1: normalizeProducto ahora incluye precioMayorista
function normalizeProducto(p) {
  return {
    id: Number(p.productoId ?? p.id),
    nombre: p.nombre,
    codigoProducto: p.codigoProducto ?? null,
    stockActual: p.stockActual == null ? null : Number(p.stockActual),
    precioVenta: Number(p.precioVenta ?? 0),
    precioMayorista: p.precioMayorista != null ? Number(p.precioMayorista) : null,
    precioCosto: Number(p.precioCosto ?? 0),
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
  } catch {
    productos.value = []
  }
  // Sincronizar stock en items ya en el carrito
  if (items.value.length > 0) {
    items.value = items.value.map(it => {
      const p = productos.value.find(p => Number(p.id) === Number(it.productId))
      if (p == null || p.stockActual == null) return it
      return recalcItem({ ...it, stock: Number(p.stockActual) })
    })
  }
}

async function refreshClientes(searchTerm = null) {
  try {
    const params = { page: 0, size: 300, search: searchTerm || null, q: searchTerm || null }
    const { data } = await clientesApi.list(params)
    const arr = unwrapPageArray(data)
    clientes.value = arr.map(mapCliente).filter((c) => c.activo !== false)
  } catch {
    clientes.value = []
  }
}

async function fetchMetodosOnce() {
  if (loadedMetodos.value) return

  try {
    const { data } = await metodosPagoApi.list()
    const arr = Array.isArray(data) ? data : unwrapPageArray(data)
    metodosPago.value = arr.map(normalizeMetodoPago).filter((m) => m.id > 0)
  } catch {
    metodosPago.value = []
  } finally {
    loadedMetodos.value = true
  }
}

const clienteSelId = ref("")
const clienteSel = computed(() =>
  clientes.value.find((c) => String(c.id) === String(clienteSelId.value)) ?? null
)

// ✅ computed para saber si el cliente seleccionado es mayorista
const clienteEsMayorista = computed(() => clienteSel.value?.tipoClienteId === 2)

const pagoAhora = ref(true)
const aplicaPrecioMayorista = computed(() => clienteEsMayorista.value && pagoAhora.value)

const selProductoId = ref("")
const itemQty = ref("1")
const codeInputRef = ref(null)

const selectedProducto = computed(() =>
  productos.value.find((p) => String(p.id) === String(selProductoId.value)) ?? null
)

function getPrecioSugerido(p) {
  if (aplicaPrecioMayorista.value && p.precioMayorista != null && p.precioMayorista > 0) {
    return Number(p.precioMayorista)
  }
  return Number(p.precioVenta ?? 0)
}

const items = ref([])

function recalcItem(it) {
  const basePrice = Number(it.basePrice ?? it.price ?? 0)
  const porcentajeAjuste = normalizePct(it.porcentajeAjuste ?? 0)
  const cost = Number(it.cost ?? 0)
  const qty = Number.isFinite(Number(it.qty)) ? Number(it.qty) : 0

  const price = round2(basePrice * (1 + porcentajeAjuste / 100))
  const subtotal = round2(price * qty)

  let invalidReason = ""

  if (qty <= 0) invalidReason = "Cantidad inválida"
  else if (price < 0) invalidReason = "Precio final inválido"
  else if (price < cost) invalidReason = "Vende a pérdida"

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
  clearMsgs()

  if (!hasValidUser.value) return setErr("Sesión inválida. Volvé a iniciar sesión.")
  if (!canSell.value) return setErr(infoMsg.value || cajaCheck.value.error || "Caja no disponible.")

  const p = selectedProducto.value
  if (!p) return setErr("Seleccioná un producto.")

  const qty = qtyOverride != null ? Number(qtyOverride) : toIntSafe(itemQty.value, 0)
  if (!qty || qty <= 0) return setErr("Cantidad inválida.")

  if (p.stockActual != null && Number.isFinite(Number(p.stockActual))) {
    const existingQty = items.value.find((x) => Number(x.productId) === Number(p.id))?.qty ?? 0
    if (existingQty + qty > Number(p.stockActual)) {
      return setErr(`Stock insuficiente: disp ${p.stockActual}.`)
    }
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
  items.value = items.value.map((it) =>
    it.id === itemId ? recalcItem({ ...it, qty: q <= 0 ? 1 : q }) : it
  )
}

function updateItemPct(itemId, v) {
  const raw = String(v ?? "")

  // Dejamos escribir libremente sin recalcular mientras el valor es incompleto
  if (raw === "-" || raw === "" || raw.endsWith(",") || raw.endsWith(".") || raw === "-0") return

  const pct = normalizePct(raw)
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
  pagoAhora.value = true
  nextTick(() => codeInputRef.value?.focus?.())
}

const totalCalc = computed(() =>
  items.value.reduce((acc, it) => acc + Number(it.subtotal ?? 0), 0)
)

const hasInvalidItems = computed(() =>
  items.value.some((it) => it.invalidReason)
)

const canRegister = computed(() =>
  canSell.value && items.value.length > 0 && !hasInvalidItems.value
)

function trySelectByExactCode(termRaw) {
  const term = String(termRaw ?? "").trim().toLowerCase()
  if (!term) return false

  const match = productos.value.find(
    (p) => String(p.codigoProducto ?? "").trim().toLowerCase() === term
  )

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
  clearMsgs()

  try {
    if (!hasValidUser.value) throw new Error("Sesión inválida. Volvé a iniciar sesión.")
    if (!canSell.value) throw new Error(infoMsg.value || cajaCheck.value.error || "No hay caja ABIERTA disponible.")

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
      pagoInmediato: pagoAhora.value,
      detallesVenta,
    }

    const { data } = await ventasApi.create(command)

    const ventaN =
      normalizeVentaFromApi(data) ?? {
        ventaId: null,
        total: totalCalc.value,
        estado: "PENDIENTE",
        clienteId: null,
      }

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
        : clienteSel.value
          ? `${clienteSel.value.nombre} ${clienteSel.value.apellido || ""}`.trim()
          : "Sin cliente",
      metodoTxt: "",
    }

    setOk(
      ventaN.ventaId
        ? `Venta #${ventaN.ventaId} registrada correctamente.`
        : `Venta registrada correctamente.`
    )

    items.value = []
    selProductoId.value = ""
    itemQty.value = "1"
    productSearch.value = ""

    await refreshCaja()
    await refreshProductos(productSearch.value?.trim() || null)

    if (ventaN.ventaId) {
      await openPagoModal(ventaN.ventaId, ventaN.total)
    }

    nextTick(() => codeInputRef.value?.focus?.())
  } catch (e) {
    setErr(pickErr(e, "Error creando venta."))
  } finally {
    saving.value = false
  }
}

const confirmState = ref({
  open: false,
  title: "",
  message: "",
  variant: "danger",
  onConfirm: null,
})

function openConfirm({ title, message, variant = "danger", onConfirm }) {
  confirmState.value = {
    open: true,
    title,
    message,
    variant,
    onConfirm,
  }
}

function closeConfirm() {
  confirmState.value = {
    open: false,
    title: "",
    message: "",
    variant: "danger",
    onConfirm: null,
  }
}

async function confirmAccept() {
  const action = confirmState.value.onConfirm
  closeConfirm()
  if (typeof action === "function") {
    await action()
  }
}

// ✅ FIX 3: confirmarVenta muestra resumen con alerta antes de registrar
function confirmarVenta() {
  if (!canRegister.value) return

  const clienteTxt = clienteSel.value
    ? `${clienteSel.value.nombre} ${clienteSel.value.apellido || ""}`.trim()
    : "Sin cliente"

  const etiquetaMayorista = clienteEsMayorista.value ? " MAYORISTA" : ""

  const lineas = items.value
    .map((it) => `• ${it.name} x${it.qty} — $ ${formatMoney(it.subtotal)}`)
    .join("\n")

  openConfirm({
    title: "Confirmar venta",
    message: `Cliente: ${clienteTxt}${etiquetaMayorista}\n\n${lineas}\n\nTotal: $ ${formatMoney(totalCalc.value)}`,
    variant: "primary",
    onConfirm: registrarVenta,
  })
}

const devolviendoVenta = ref(false)

// ── Devolución parcial ────────────────────────────────────────────────────
const showDevParcial = ref(false)
const devParcialVentaId = ref(null)
const devParcialItems = ref([])   // [{ detalleId, nombre, cantidad, precioFinal, cantDevolver, seleccionado }]
const devParcialLoading = ref(false)

const devParcialMonto = computed(() =>
  devParcialItems.value
    .filter(i => i.seleccionado && i.cantDevolver > 0)
    .reduce((acc, i) => acc + i.precioFinal * Number(i.cantDevolver), 0)
)

async function abrirDevParcial(venta) {
  if (!cajaAbierta.value?.cajaId) return setErr("Necesitás una caja ABIERTA para registrar la devolución.")

  let detalles = venta.detalles ?? venta.items ?? []

  // La lista de ventas no incluye detalles — los traemos por ID
  if (detalles.length === 0) {
    devParcialLoading.value = true
    try {
      const { data } = await ventasApi.porId(venta.ventaId ?? venta.id)
      // El backend devuelve { venta: {...}, detallesVenta: [...] }
      detalles = data?.detallesVenta ?? data?.detalles ?? data?.items ?? data?.lineas ?? []
    } catch {
      // si falla, hacemos devolución total
    } finally {
      devParcialLoading.value = false
    }
  }

  if (detalles.length <= 1) {
    devolverVenta(venta.ventaId ?? venta.id)
    return
  }
  devParcialVentaId.value = venta.ventaId ?? venta.id
  devParcialItems.value = detalles.map(d => {
    const prod = productos.value.find(p => Number(p.id) === Number(d.productoId))
    return {
      detalleId:    d.detalleId ?? d.id,
      nombre:       d.productoNombre ?? d.nombre ?? prod?.nombre ?? `Producto #${d.productoId}`,
      cantidad:     d.cantidad,
      precioFinal:  d.precioFinal ?? d.precio_final ?? d.precioUnitario,
      cantDevolver: d.cantidad,
      seleccionado: true,
    }
  })
  showDevParcial.value = true
}

async function confirmarDevParcial() {
  const itemsADevolver = devParcialItems.value.filter(i => i.seleccionado && Number(i.cantDevolver) > 0)
  if (!itemsADevolver.length) return setErr("Seleccioná al menos un item para devolver.")
  devParcialLoading.value = true
  try {
    await ventasApi.devolverParcial(devParcialVentaId.value, {
      cajaId:  Number(cajaAbierta.value.cajaId),
      userId:  Number(userIdInt.value),
      motivo:  "Devolución parcial desde ventas",
      items:   itemsADevolver.map(i => ({ detalleId: i.detalleId, cantidad: Number(i.cantDevolver) })),
    })
    setOk(`Devolución parcial registrada — reembolso $${formatMoney(devParcialMonto.value)}`)
    showDevParcial.value = false
    if (devClienteId.value) await buscarVentasCliente()
    await refreshCaja()
    window.dispatchEvent(new Event("cuentaCorriente:changed"))
  } catch (e) {
    setErr(pickErr(e, "Error en devolución parcial."))
  } finally {
    devParcialLoading.value = false
  }
}

async function devolverVentaConfirmed(ventaId) {
  devolviendoVenta.value = true
  clearMsgs()

  try {
    await ventasApi.devolver(ventaId, {
      userId: Number(userIdInt.value),
      cajaId: Number(cajaAbierta.value.cajaId),
      motivo: "Devolución registrada desde ventas",
    })

    setOk(`Venta #${ventaId} devuelta correctamente ✅`)
    if (lastVenta.value?.ventaId === ventaId) {
      lastVenta.value.estado = "ANULADA"
    }

    await refreshProductos(productSearch.value?.trim() || null)
    await refreshCaja()

    // ✅ AGREGAR ESTO — refresca la tabla de ventas del cliente
    if (devClienteId.value) await buscarVentasCliente()

    window.dispatchEvent(new Event("cuentaCorriente:changed"))
  } catch (e) {
    setErr(pickErr(e, "Error devolviendo venta."))
  } finally {
    devolviendoVenta.value = false
  }
}

function devolverVenta(ventaId) {
  if (!ventaId) return setErr("Venta inválida.")
  if (!cajaAbierta.value?.cajaId) {
    return setErr("Necesitás una caja ABIERTA para registrar la devolución.")
  }

  openConfirm({
    title: "Confirmar devolución",
    message: `Vas a devolver la venta #${ventaId}. Esto generará un egreso en caja y devolverá stock. ¿Querés continuar?`,
    variant: "danger",
    onConfirm: () => devolverVentaConfirmed(ventaId),
  })
}

const devClienteId = ref("")
const devVentas = ref([])
const devLoading = ref(false)
const devError = ref("")

const devClienteEsMayorista = computed(
  () => clientes.value.find((c) => String(c.id) === String(devClienteId.value))?.tipoClienteId === 2
)

async function buscarVentasCliente() {
  devError.value = ""
  devVentas.value = []

  if (!devClienteId.value) {
    devError.value = "Seleccioná un cliente."
    return
  }

  devLoading.value = true
  try {
    const { data } = await ventasApi.porClienteId(Number(devClienteId.value))
    const arr = Array.isArray(data) ? data : (data?.content ?? [])
    // Mostrar solo no anuladas
    devVentas.value = arr
      .filter((v) => String(v.estado ?? "").toUpperCase() !== "ANULADA")
      .map((v) => ({
        ventaId: Number(v.ventaId ?? v.id),
        total: Number(v.total ?? 0),
        estado: String(v.estado ?? "PENDIENTE").toUpperCase(),
        fecha: v.fecha ?? null,
        turno: v.turno ?? null,
      }))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

    if (!devVentas.value.length) devError.value = "No hay ventas activas para este cliente."
  } catch (e) {
    devError.value = pickErr(e, "Error buscando ventas.")
  } finally {
    devLoading.value = false
  }
}

function formatDateShort(v) {
  if (!v) return "—"
  try {
    return new Date(v).toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch { return String(v) }
}





function normalizePago(p) {
  const id = Number(p?.pagoId ?? p?.id ?? 0)
  const metodoPagoId = Number(p?.metodoPagoId ?? p?.metodo_pago_id ?? p?.metodoId ?? p?.metodoPago ?? 0)
  const monto = Number(p?.monto ?? p?.importe ?? p?.amount ?? 0)
  return { id, metodoPagoId, monto }
}

const showPagoModal = ref(false)
const pagoVentaId = ref(null)
const pagoTotalVenta = ref(0)
const pagoLineas = ref([])
const pagoLoading = ref(false)
const pagosDeVenta = ref([])
const lastPagoMetodoTxt = ref("")

function nuevaLinea() {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    metodoPagoId: metodosPago.value?.[0]?.id ? String(metodosPago.value[0].id) : "",
    monto: "",
    referencia: ""
  }
}

function addPagoLinea() {
  if (pagoLineas.value.length >= 3) return
  pagoLineas.value = [...pagoLineas.value, nuevaLinea()]
}

function removePagoLinea(lineaId) {
  if (pagoLineas.value.length <= 1) return
  pagoLineas.value = pagoLineas.value.filter((l) => l.id !== lineaId)
}

const totalLineas = computed(() =>
  round2(
    pagoLineas.value.reduce((sum, l) => {
      const m = round2(parseArNumber(l.monto))
      return sum + (Number.isFinite(m) && m > 0 ? m : 0)
    }, 0)
  )
)

async function loadPagosVenta(ventaId) {
  try {
    const { data } = await pagosApi.porVentaId(ventaId)
    const arr = Array.isArray(data) ? data : unwrapPageArray(data)
    pagosDeVenta.value = arr.map(normalizePago).filter((x) => x.id > 0)
  } catch {
    pagosDeVenta.value = []
  }
}

const totalPagadoVenta = computed(() =>
  pagosDeVenta.value.reduce((a, p) => a + Number(p.monto ?? 0), 0)
)

const restanteVenta = computed(() =>
  Math.max(0, Number(pagoTotalVenta.value ?? 0) - Number(totalPagadoVenta.value ?? 0))
)

const estadoPagoVenta = computed(() => {
  const total = Number(pagoTotalVenta.value ?? 0)
  const pagado = Number(totalPagadoVenta.value ?? 0)
  if (!pagoVentaId.value) return "-"
  if (pagado <= 0) return "PENDIENTE"
  if (pagado < total) return "PARCIAL"
  return "PAGADA"
})

// true cuando la venta es de mostrador (sin cliente) — en ese caso
// no se puede cerrar el modal sin registrar al menos un pago.
const pagoEsMostrador = ref(false)

async function openPagoModal(ventaId, total = 0) {
  pagoVentaId.value     = Number(ventaId)
  pagoTotalVenta.value  = Number(total ?? 0)
  pagoLineas.value      = [nuevaLinea()]
  // Si no hay cliente seleccionado es venta de mostrador: pago obligatorio
  pagoEsMostrador.value = !clienteSel.value?.id
  showPagoModal.value   = true

  await loadPagosVenta(ventaId)
}

function closePagoModal() {
  // Venta de mostrador sin ningún pago registrado: bloquear cierre
  if (pagoEsMostrador.value && totalPagadoVenta.value <= 0) {
    setErr("Las ventas sin cliente deben tener al menos un pago registrado antes de cerrar.")
    return
  }
  const vid   = pagoVentaId.value
  const total = pagoTotalVenta.value
  const metodo = lastPagoMetodoTxt.value || ""
  pagoEsMostrador.value = false
  showPagoModal.value   = false
  if (vid) {
    nextTick(() => abrirComprobante(vid, total, metodo))
  } else {
    nextTick(() => codeInputRef.value?.focus?.())
  }
}

function setPagarRestante() {
  const restante = round2(restanteVenta.value || pagoTotalVenta.value || 0)
  if (restante <= 0 || pagoLineas.value.length === 0) return
  // Pone el restante en la primera línea, limpia las demás
  pagoLineas.value = pagoLineas.value.map((l, i) =>
    i === 0
      ? {
          ...l,
          monto: restante.toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        }
      : { ...l, monto: "" }
  )
}

async function registrarPago() {
  if (pagoLoading.value) return

  pagoLoading.value = true
  clearMsgs()

  try {
    if (!hasValidUser.value) throw new Error("Sesión inválida. Volvé a iniciar sesión.")
    if (!canSell.value) throw new Error(infoMsg.value || cajaCheck.value.error || "No hay caja ABIERTA para registrar pagos.")
    if (!pagoVentaId.value) throw new Error("Venta inválida.")
    if (estadoPagoVenta.value === "PAGADA") throw new Error("Esta venta ya está PAGADA.")

    // Validar todas las líneas
    const lineasValidas = pagoLineas.value.map((l, i) => {
      const mp = Number(l.metodoPagoId)
      if (!Number.isFinite(mp) || mp <= 0)
        throw new Error(`Línea ${i + 1}: seleccioná un método de pago.`)
      const monto = round2(parseArNumber(l.monto))
      if (!Number.isFinite(monto) || monto <= 0)
        throw new Error(`Línea ${i + 1}: ingresá un monto válido.`)
      return { mp, monto, referencia: l.referencia?.trim() || null }
    })

    const totalNuevo = round2(lineasValidas.reduce((s, l) => s + l.monto, 0))
    const restante = round2(restanteVenta.value)

    if (totalNuevo > restante + 0.01) {
      throw new Error(
        `El total ingresado ($ ${formatMoney2(totalNuevo)}) supera el restante ($ ${formatMoney2(restante)}).`
      )
    }

    // Registrar cada pago secuencialmente
    for (const l of lineasValidas) {
      await pagosApi.create({
        ventaId: Number(pagoVentaId.value),
        cajaId: Number(cajaAbierta.value.cajaId),
        metodoPagoId: l.mp,
        monto: l.monto,
        referencia: l.referencia,
      })
    }

    await loadPagosVenta(pagoVentaId.value)
    await refreshCaja()
    window.dispatchEvent(new Event("cuentaCorriente:changed"))

    const metodosTxt = lineasValidas
      .map((l) => `$ ${formatMoney2(l.monto)} — ${metodoNombreById(l.mp)}`)
      .join(" + ")

    lastPagoMetodoTxt.value = lineasValidas.map((l) => metodoNombreById(l.mp)).join(" + ")

    if (estadoPagoVenta.value === "PAGADA") {
      setOk(`Venta #${pagoVentaId.value} pagada correctamente ✅ · ${metodosTxt}`)
    } else {
      setOk(`Pago registrado en venta #${pagoVentaId.value} ✅ · ${metodosTxt}`)
    }

    if (lastVenta.value?.ventaId === Number(pagoVentaId.value)) {
      lastVenta.value.estado = estadoPagoVenta.value
      lastVenta.value.metodoTxt = lastPagoMetodoTxt.value
    }

    // Resetear líneas para permitir otro pago parcial
    pagoLineas.value = [nuevaLinea()]
  } catch (e) {
    setErr(pickErr(e, "Error registrando pago."))
  } finally {
    pagoLoading.value = false
  }
}

const showComprobanteModal = ref(false)
const comprobanteVentaId = ref(null)
const comprobanteTotal = ref(0)
const comprobanteEmail = ref("")
const comprobanteTipo = ref("VENTA")
const comprobanteMetodo = ref("")
const enviandoComprobante = ref(false)
const comprobanteOk = ref(false)
const comprobanteErr = ref("")

function abrirComprobante(ventaId, total, metodoPago = "") {
  comprobanteVentaId.value = ventaId
  comprobanteTotal.value = total
  comprobanteMetodo.value = metodoPago
  comprobanteEmail.value = clienteSel.value?.email ?? ""
  comprobanteTipo.value = "VENTA"
  comprobanteOk.value = false
  comprobanteErr.value = ""
  showComprobanteModal.value = true
}

async function enviarComprobante() {
  if (!comprobanteEmail.value.trim()) {
    comprobanteErr.value = "Ingresá un email."
    return
  }
  comprobanteErr.value = ""
  enviandoComprobante.value = true
  try {
    await ventasApi.enviarComprobante(comprobanteVentaId.value, {
      email: comprobanteEmail.value.trim(),
      metodoPago: comprobanteMetodo.value || "Efectivo",
      tipo: comprobanteTipo.value,
    })
    comprobanteOk.value = true
    setTimeout(() => { showComprobanteModal.value = false }, 2000)
  } catch (e) {
    comprobanteErr.value = pickErr(e, "Error enviando el comprobante.")
  } finally {
    enviandoComprobante.value = false
  }
}

function onKeydown(e) {
  if (e?.key === "Escape") {
    if (showPagoModal.value) closePagoModal()   // closePagoModal ya valida si es mostrador
    if (confirmState.value.open) closeConfirm()
  }
}


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

function onTurnoChanged(event) {
  const nuevoTurno = event?.detail?.turno
  if (!nuevoTurno) return
  turnoSel.value = turnoUI(nuevoTurno)
}

const refreshProductosDebounced = debounce(() => {
  refreshProductos(productSearch.value?.trim() || null)
}, 250)

const refreshClientesDebounced = debounce(() => {
  refreshClientes(clientesSearch.value?.trim() || null)
}, 250)

watch(productSearch, () => {
  trySelectByExactCode(productSearch.value)
  refreshProductosDebounced()
})

watch(clientesSearch, () => {
  refreshClientesDebounced()
})

watch(turnoSel, (v) => {
  setTurnoOperativo(turnoBE(v))
  refreshCaja()
})

onMounted(async () => {
  await refreshAll()
  window.addEventListener("caja:changed", onCajaChanged)
  window.addEventListener("turno:changed", onTurnoChanged)
  window.addEventListener("keydown", onKeydown)
  nextTick(() => codeInputRef.value?.focus?.())
})

onBeforeUnmount(() => {
  window.removeEventListener("caja:changed", onCajaChanged)
  window.removeEventListener("turno:changed", onTurnoChanged)
  window.removeEventListener("keydown", onKeydown)
})
</script>

<template>
  <div class="ventas-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Operación</p>
        <h1 class="page-title mb-1">Ventas</h1>
        <p class="page-subtitle mb-0">
          Registrá ventas, cobros y devoluciones con control de caja y stock.
        </p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="refreshAll" :disabled="loading">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>
      </div>
    </section>

    <div v-if="errorMsg" class="alert alert-danger py-2 mb-3">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2 mb-3">{{ okMsg }}</div>
    <div v-if="infoMsg" class="alert alert-secondary py-2 mb-3">{{ infoMsg }}</div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label field-label">Fecha</label>
            <input class="form-control app-input" :value="fechaTexto" disabled />
          </div>

          <div class="col-12 col-md-3" v-if="admin">
            <label class="form-label field-label">Turno operativo</label>
            <select v-model="turnoSel" class="form-select app-input">
              <option value="MAÑANA">MAÑANA</option>
              <option value="TARDE">TARDE</option>
            </select>
          </div>

          <div class="col-12 col-md-3" v-else>
            <label class="form-label field-label">Turno operativo</label>
            <input class="form-control app-input" :value="turnoSel" disabled />
          </div>

          <div class="col-12 col-md-6">
            <div v-if="!canSell" class="status-warning d-flex justify-content-between align-items-center gap-2">
              <span>{{ infoMsg || cajaCheck.error || "Caja no disponible." }}</span>
              <button class="btn btn-sm btn-outline-light" @click="goCaja">Ir a Caja</button>
            </div>

            <div v-else class="status-ok">
              <span class="badge badge-soft-success">CAJA ABIERTA</span>
              <span class="status-ok-text">Turno operativo: {{ turnoUI(cajaAbierta?.turno) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="lastVenta" class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Última venta registrada</h2>
        </div>

        <div class="sale-summary">
          <div class="sale-summary-grid">
            <div class="sale-summary-item">
              <div class="helper-text">Venta</div>
              <div class="sale-summary-value">#{{ lastVenta.ventaId }}</div>
            </div>

            <div class="sale-summary-item">
              <div class="helper-text">Estado</div>
              <div class="sale-summary-value" :class="lastVenta.estado === 'ANULADA'
                  ? 'text-danger'
                  : lastVenta.estado === 'PAGADA'
                    ? 'text-success'
                    : lastVenta.estado === 'PARCIAL'
                      ? 'text-warning'
                      : 'text-secondary'
                ">
                {{ lastVenta.estado }}
              </div>
            </div>

            <div class="sale-summary-item">
              <div class="helper-text">Cliente</div>
              <div class="sale-summary-value">
                {{ lastVenta.clienteTxt || "Sin cliente" }}
              </div>
            </div>

            <div class="sale-summary-item">
              <div class="helper-text">Total</div>
              <div class="sale-summary-value">$ {{ formatMoney(lastVenta.total) }}</div>
            </div>

            <div class="sale-summary-item" v-if="lastVenta.metodoTxt">
              <div class="helper-text">Último pago</div>
              <div class="sale-summary-value">{{ lastVenta.metodoTxt }}</div>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-2 mt-3">
            <button class="btn btn-outline-light" @click="openPagoModal(lastVenta.ventaId, lastVenta.total)"
              :disabled="lastVenta.estado === 'ANULADA' || lastVenta.estado === 'PAGADA'">
              Cobrar venta
            </button>

            <button class="btn btn-outline-danger" @click="devolverVenta(lastVenta.ventaId)"
              :disabled="devolviendoVenta || lastVenta.estado === 'ANULADA'">
              {{ devolviendoVenta ? "Devolviendo..." : "Devolver venta" }}
            </button>

            <button class="btn btn-outline-light"
              @click="abrirComprobante(lastVenta.ventaId, lastVenta.total, lastVenta.metodoTxt)">
              📧 Comprobante
            </button>
          </div>

        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Nueva venta</h2>
        </div>

        <div class="row g-2 mb-2">
          <div class="col-12 col-md-4">
            <label class="form-label field-label">Buscar cliente</label>
            <input v-model="clientesSearch" class="form-control app-input" placeholder="nombre / dni / teléfono"
              :disabled="!canSell" />
          </div>

          <div class="col-12 col-md-8">
            <label class="form-label field-label">Cliente (opcional)</label>
            <select v-model="clienteSelId" class="form-select app-input" :disabled="!canSell">
              <option value="">Sin cliente</option>
              <option v-for="c in clientes" :key="c.id" :value="String(c.id)">
                {{ c.nombre }} {{ c.apellido || "" }} — DNI: {{ c.dni || "-" }}
                {{ c.tipoClienteId === 2 ? "MAYORISTA" : "" }}
              </option>
            </select>
          </div>
        </div>

        <!-- Toggle pago al momento para clientes mayoristas -->
        <div v-if="clienteEsMayorista" class="mayorista-pago-toggle mb-3">
          <div class="mayorista-pago-toggle__info">
            <span class="mayorista-pago-toggle__badge">Cliente mayorista</span>
            <span class="mayorista-pago-toggle__desc">
              {{ aplicaPrecioMayorista ? "Precio mayorista activado" : "Precio minorista — fía" }}
            </span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" v-model="pagoAhora" />
            <span class="toggle-switch__track"></span>
            <span class="toggle-switch__label">¿Paga ahora?</span>
          </label>
        </div>

        <div class="helper-text mb-3">Registrá la venta y cobrá ahora o después.</div>

        <div class="row g-2 mb-2">
          <div class="col-12">
            <label class="form-label field-label">Buscar producto (nombre o código)</label>
            <input ref="codeInputRef" v-model="productSearch" class="form-control app-input"
              placeholder="Ej: shampoo / 779123..." :disabled="!canSell" @keydown="onSearchKeydown" />
            <div class="helper-text mt-1">
              Consejo: si ingresás el código exacto y presionás Enter, agrega 1 unidad automáticamente.
            </div>
          </div>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-7">
            <label class="form-label field-label">Producto</label>
            <select v-model="selProductoId" class="form-select app-input" :disabled="!canSell">
              <option value="" disabled>Seleccionar…</option>
              <option v-for="p in productos" :key="p.id" :value="String(p.id)">
                {{ p.nombre }} ({{ p.codigoProducto || "SIN CÓD" }})
                — $ {{ formatMoney(getPrecioSugerido(p)) }}
                {{ aplicaPrecioMayorista && p.precioMayorista ? "(mayorista)" : "" }}
                · Stock: {{ p.stockActual ?? "-" }}
              </option>
            </select>
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label field-label">Cant.</label>
            <input v-model="itemQty" class="form-control app-input" inputmode="numeric" :disabled="!canSell"
              @keydown="onQtyKeydown" />
          </div>

          <div class="col-12 col-md-3">
            <button class="btn btn-outline-light w-100" @click="addItem()" :disabled="!canSell || !selProductoId">
              Agregar
            </button>
          </div>
        </div>

        <div class="table-responsive mt-3" v-if="items.length">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th style="width: 130px">Base</th>
                <th style="width: 140px">Porcentaje(+/-)</th>
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
                  <div class="helper-text" v-if="it.invalidReason">{{ it.invalidReason }}</div>
                </td>

                <td class="text-secondary td-num">$ {{ formatMoney(it.basePrice) }}</td>

                <td>
                  <input class="form-control form-control-sm app-input" :value="it.porcentajeAjuste" inputmode="decimal"
                    @input="updateItemPct(it.id, $event.target.value)"
                    @change="updateItemPct(it.id, $event.target.value)" placeholder="-10 desc / 10 aum"
                    :disabled="!canSell" />
                </td>

                <td class="text-secondary td-num fw-semibold">$ {{ formatMoney(it.price) }}</td>

                <td>
                  <input class="form-control form-control-sm app-input" :value="it.qty" inputmode="numeric"
                    @input="updateItemQty(it.id, $event.target.value)" :disabled="!canSell" />
                </td>

                <td class="td-num fw-bold">$ {{ formatMoney(it.subtotal) }}</td>

                <td class="text-end">
                  <button class="btn btn-sm btn-outline-light" @click="removeItem(it.id)" :disabled="!canSell">
                    Quitar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="helper-text mt-3">Agregá productos para armar la venta.</div>

        <div v-if="hasInvalidItems" class="alert alert-danger py-2 mt-3 mb-0">
          Hay ítems inválidos (pérdida o stock insuficiente). Corregí y volvé a intentar.
        </div>

        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
          <div class="helper-text">
            Total: <b class="fs-5 text-white">$ {{ formatMoney(totalCalc) }}</b>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-outline-light" @click="clearForm" :disabled="!canSell">Limpiar</button>
            <!-- ✅ FIX: llama a confirmarVenta en vez de registrarVenta directamente -->
            <button class="btn btn-primary btn-accent" @click="confirmarVenta" :disabled="!canRegister || saving">
              {{ saving ? "Guardando..." : "Registrar venta" }}
            </button>
          </div>
        </div>

        <div class="helper-text mt-2">
          Caja abierta requerida · la venta descuenta stock · cada ítem admite descuento % · el cobro puede ser parcial
          o total.
        </div>
      </div>
    </div>

    <div v-if="showPagoModal" class="modal-backdrop-custom" @click.self="pagoEsMostrador && totalPagadoVenta <= 0 ? null : closePagoModal()">
      <div class="modal-card">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
            <div class="section-title">Registrar pago</div>
            <div class="helper-text">
              Estado:
              <b :class="estadoPagoVenta === 'PAGADA'
                  ? 'text-success'
                  : estadoPagoVenta === 'PARCIAL'
                    ? 'text-warning'
                    : 'text-secondary'
                ">
                {{ estadoPagoVenta }}
              </b>
            </div>
            <div class="helper-text">
              Venta #{{ pagoVentaId }}
              · Total: <b>$ {{ formatMoney2(pagoTotalVenta) }}</b>
              · Pagado: <b>$ {{ formatMoney2(totalPagadoVenta) }}</b>
              · Restante: <b>$ {{ formatMoney2(restanteVenta) }}</b>
            </div>
          </div>
          <button
            class="btn btn-sm btn-outline-light"
            @click="closePagoModal"
            :disabled="pagoEsMostrador && totalPagadoVenta <= 0"
            :title="pagoEsMostrador && totalPagadoVenta <= 0 ? 'Registrá al menos un pago antes de cerrar' : ''"
          >Cerrar</button>
        </div>

        <!-- Líneas de pago (pago mixto) -->
        <div class="pago-lineas mb-2">
          <div v-for="(linea, idx) in pagoLineas" :key="linea.id" class="pago-linea-row mb-2">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-5">
                <label v-if="idx === 0" class="form-label field-label">Método de pago</label>
                <select v-model="linea.metodoPagoId" class="form-select app-input"
                  :disabled="estadoPagoVenta === 'PAGADA'">
                  <option disabled value="">Método…</option>
                  <option v-if="!metodosPago.length" disabled value="">Sin métodos cargados</option>
                  <option v-for="m in metodosPago" :key="m.id" :value="String(m.id)">{{ m.nombre }}</option>
                </select>
              </div>
              <div class="col col-md-5">
                <label v-if="idx === 0" class="form-label field-label">Monto</label>
                <input v-model="linea.monto" class="form-control app-input"
                  placeholder="Ej: 20000" inputmode="decimal"
                  :disabled="estadoPagoVenta === 'PAGADA'" />
              </div>
              <div class="col-auto">
                <button v-if="pagoLineas.length > 1" class="btn btn-sm btn-outline-danger"
                  @click="removePagoLinea(linea.id)" :disabled="pagoLoading" title="Quitar línea">
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Controles: agregar método + total de líneas + restante -->
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-light" @click="addPagoLinea"
              :disabled="pagoLoading || estadoPagoVenta === 'PAGADA' || pagoLineas.length >= 3">
              + Método
            </button>
            <button class="btn btn-sm btn-outline-light" @click="setPagarRestante"
              :disabled="pagoLoading || estadoPagoVenta === 'PAGADA'">
              Restante
            </button>
          </div>
          <div class="helper-text text-end" v-if="totalLineas > 0">
            <span>Ingresado: <b>$ {{ formatMoney2(totalLineas) }}</b></span>
            <span v-if="round2(restanteVenta - totalLineas) > 0.009">
              &nbsp;· Quedaría: <b class="text-warning">$ {{ formatMoney2(round2(restanteVenta - totalLineas)) }}</b>
            </span>
          </div>
        </div>

        <div class="d-flex justify-content-end">
          <div class="d-flex gap-2">
            <button
              v-if="!pagoEsMostrador"
              class="btn btn-outline-light"
              @click="closePagoModal"
              :disabled="pagoLoading"
            >
              Dejar fiado
            </button>
            <span v-else-if="totalPagadoVenta <= 0" class="text-warning small">
              Venta sin cliente — el pago es obligatorio
            </span>

            <button class="btn btn-primary btn-accent" @click="registrarPago"
              :disabled="pagoLoading || !canSell || estadoPagoVenta === 'PAGADA'">
              {{ pagoLoading ? "Guardando..." : "Registrar pago" }}
            </button>
          </div>
        </div>

        <hr class="border-secondary my-3" />

        <div>
          <div class="helper-text mb-2">Pagos registrados</div>

          <div v-if="pagosDeVenta.length === 0" class="helper-text">Sin pagos todavía.</div>

          <div v-else class="table-responsive">
            <table class="table table-dark table-hover align-middle app-table mb-0">
              <thead>
                <tr>
                  <th>Método</th>
                  <th class="text-end">Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in pagosDeVenta" :key="p.id">
                  <td class="text-secondary">{{ metodoNombreById(p.metodoPagoId) }}</td>
                  <td class="text-end td-num fw-bold">$ {{ formatMoney2(p.monto) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="helper-text mt-2">
            Cada cobro registrado suma un ingreso en la caja del turno.
          </div>
        </div>
      </div>
    </div>

    <div v-if="confirmState.open" class="modal-backdrop-custom">
      <div class="confirm-card">
        <div class="confirm-icon" :class="`confirm-icon--${confirmState.variant}`">
          <span v-if="confirmState.variant === 'danger'">!</span>
          <span v-else-if="confirmState.variant === 'warning'">!</span>
          <span v-else>✓</span>
        </div>

        <div class="confirm-title">{{ confirmState.title }}</div>
        <div class="confirm-text" style="white-space: pre-line">{{ confirmState.message }}</div>

        <div class="confirm-actions">
          <button class="btn btn-outline-light" @click="closeConfirm">
            Cancelar
          </button>

          <button class="btn" :class="{
            'btn-confirm-primary': confirmState.variant === 'primary',
            'btn-confirm-danger': confirmState.variant === 'danger',
            'btn-confirm-warning': confirmState.variant === 'warning',
          }" @click="confirmAccept">
            Confirmar
          </button>
        </div>
      </div>
    </div>
    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Devolver venta anterior</h2>
          <div class="helper-text">Buscá las ventas activas de un cliente para devolverlas.</div>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label field-label">Cliente</label>
            <select v-model="devClienteId" class="form-select app-input" :disabled="devLoading">
              <option value="">Seleccionar cliente…</option>
              <option v-for="c in clientes" :key="c.id" :value="String(c.id)">
                {{ c.nombre }} {{ c.apellido || "" }} — DNI: {{ c.dni || "-" }}
                {{ c.tipoClienteId === 2 ? "MAYORISTA" : "" }}
              </option>
            </select>
          </div>

          <div class="col-12 col-md-3">
            <button class="btn btn-outline-light w-100" @click="buscarVentasCliente"
              :disabled="devLoading || !devClienteId">
              {{ devLoading ? "Buscando..." : "Buscar ventas" }}
            </button>
          </div>
        </div>

        <div v-if="devError" class="alert alert-danger py-2 mt-3 mb-0">{{ devError }}</div>

        <div v-if="devVentas.length" class="table-responsive mt-3">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th style="width: 90px">#Venta</th>
                <th>Fecha</th>
                <th style="width: 160px" class="text-end">Total</th>
                <th style="width: 120px">Estado</th>
                <th style="width: 100px">Origen</th>
                <th style="width: 130px" class="text-end">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in devVentas" :key="v.ventaId">
                <td class="text-secondary">#{{ v.ventaId }}</td>
                <td class="text-secondary">{{ formatDateShort(v.fecha) }}</td>
                <td class="text-end td-num fw-bold">$ {{ formatMoney(v.total) }}</td>
                <td>
                  <span class="badge" :class="{
                    'badge-soft-success': v.estado === 'PAGADA',
                    'badge-soft-warning': v.estado === 'PARCIAL',
                    'badge-soft-secondary': v.estado === 'PENDIENTE',
                  }">
                    {{ v.estado }}
                  </span>
                </td>
                <td>
                  <span v-if="v.turno === 'ONLINE'" class="badge badge-tn-online">TN</span>
                  <span v-else class="badge badge-soft-secondary">Local</span>
                </td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-danger" :disabled="devolviendoVenta || !canSell"
                    @click="abrirDevParcial(v)">
                    Devolver
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
      </div>
    </div>

    <!-- Modal comprobante -->
<div v-if="showComprobanteModal" class="modal-backdrop-custom"
     @click.self="showComprobanteModal = false">
  <div class="modal-comprobante">

    <div class="d-flex justify-content-between align-items-start mb-3">
      <div>
        <div class="section-title">Enviar comprobante</div>
        <div class="helper-text">
          Venta #{{ comprobanteVentaId }} · $ {{ formatMoney(comprobanteTotal) }}
        </div>
      </div>
      <button class="btn btn-sm btn-outline-light"
              @click="showComprobanteModal = false">✕</button>
    </div>

    <div class="mb-3">
      <label class="form-label field-label">Email destinatario</label>
      <input
        v-model="comprobanteEmail"
        class="form-control app-input"
        type="email"
        placeholder="cliente@ejemplo.com"
        :disabled="enviandoComprobante || comprobanteOk"
      />
    </div>

    <div class="mb-3">
      <label class="form-label field-label">Tipo de comprobante</label>
      <select v-model="comprobanteTipo" class="form-select app-input"
              :disabled="enviandoComprobante || comprobanteOk">
        <option value="VENTA">Venta / Cobro</option>
        <option value="FIADO">Fiado / Cuenta corriente</option>
      </select>
    </div>

    <div v-if="comprobanteErr" class="alert alert-danger py-2 mb-3">
      {{ comprobanteErr }}
    </div>
    <div v-if="comprobanteOk" class="alert alert-success py-2 mb-3">
      ✅ Comprobante enviado correctamente.
    </div>

    <div class="d-flex justify-content-end gap-2">
      <button class="btn btn-outline-light"
              @click="showComprobanteModal = false"
              :disabled="enviandoComprobante">
        Omitir
      </button>
      <button
        class="btn btn-primary btn-accent"
        @click="enviarComprobante"
        :disabled="!comprobanteEmail || enviandoComprobante || comprobanteOk"
      >
        {{ enviandoComprobante ? "Enviando..." : "Enviar comprobante" }}
      </button>
    </div>

  </div>
</div>
    
  </div>

  <!-- Modal devolución parcial -->
  <div v-if="showDevParcial" class="modal-backdrop" @click.self="showDevParcial = false">
    <div class="modal-card" style="max-width:520px">
      <div class="modal-card-header">
        <h3 class="modal-card-title">Devolver items — venta #{{ devParcialVentaId }}</h3>
        <button class="btn-close-modal" @click="showDevParcial = false">✕</button>
      </div>
      <div class="modal-card-body">
        <p class="helper-text mb-3">Seleccioná qué productos devolver y cuántas unidades.</p>
        <div v-for="item in devParcialItems" :key="item.detalleId"
             class="dev-item-row" :class="{ 'dev-item-row--active': item.seleccionado }">
          <label class="dev-item-check">
            <input type="checkbox" v-model="item.seleccionado" />
          </label>
          <div class="dev-item-info">
            <div class="dev-item-nombre">{{ item.nombre }}</div>
            <div class="helper-text" style="font-size:0.75rem">$ {{ formatMoney(item.precioFinal) }} × {{ item.cantidad }} u.</div>
          </div>
          <div class="dev-item-qty">
            <input type="number" class="form-control app-input" style="width:68px;text-align:center"
              v-model="item.cantDevolver" :min="1" :max="item.cantidad" :disabled="!item.seleccionado" />
            <span class="helper-text" style="font-size:0.72rem;margin-top:2px">de {{ item.cantidad }}</span>
          </div>
          <div class="dev-item-subtotal">
            {{ item.seleccionado ? `$ ${formatMoney(item.precioFinal * Number(item.cantDevolver))}` : '—' }}
          </div>
        </div>
        <div class="dev-total-row">
          <span class="field-label">Reembolso</span>
          <span class="dev-total-monto">$ {{ formatMoney(devParcialMonto) }}</span>
        </div>
      </div>
      <div class="modal-card-footer">
        <button class="btn btn-outline-light" @click="showDevParcial = false" :disabled="devParcialLoading">Cancelar</button>
        <button class="btn btn-danger" @click="confirmarDevParcial"
          :disabled="devParcialLoading || devParcialMonto <= 0">
          {{ devParcialLoading ? "Procesando..." : `Confirmar — $ ${formatMoney(devParcialMonto)}` }}
        </button>
      </div>
    </div>
  </div>

</template>

<style scoped>
.mayorista-pago-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: rgba(255, 193, 7, 0.07);
  border: 1px solid rgba(255, 193, 7, 0.22);
  border-left: 3px solid rgba(255, 193, 7, 0.55);
  border-radius: 4px;
  padding: 10px 14px;
}
.mayorista-pago-toggle__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mayorista-pago-toggle__badge {
  font-size: 0.85rem;
  font-weight: 600;
  color: #ffe082;
}
.mayorista-pago-toggle__desc {
  font-size: 0.78rem;
  color: rgba(255,255,255,0.55);
}
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}
.toggle-switch input { display: none; }
.toggle-switch__track {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: rgba(255,255,255,0.15);
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}
.toggle-switch__track::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.toggle-switch input:checked ~ .toggle-switch__track {
  background: #4ade80;
}
.toggle-switch input:checked ~ .toggle-switch__track::after {
  transform: translateX(18px);
}
.toggle-switch__label {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.8);
}

.sale-summary {
  padding: 16px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, .08);
  background: rgba(255, 255, 255, .03);
}

.sale-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.sale-summary-item {
  min-width: 0;
}

.sale-summary-value {
  color: #fff;
  font-weight: 700;
  margin-top: 4px;
  word-break: break-word;
}

@media (max-width: 992px) {
  .sale-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 576px) {
  .sale-summary-grid {
    grid-template-columns: 1fr;
  }
}

.ventas-page {
  min-height: 100%;
}

.status-warning {
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 4px;
  border-left: 3px solid rgba(255, 193, 7, 0.60);
  background: rgba(255, 193, 7, 0.07);
  border-top: 1px solid rgba(255, 193, 7, 0.18);
  border-right: 1px solid rgba(255, 193, 7, 0.18);
  border-bottom: 1px solid rgba(255, 193, 7, 0.18);
  color: #ffe8a3;
}

.status-ok {
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 4px;
  background: rgba(255, 255, 255, .03);
  border: 1px solid rgba(255, 255, 255, .08);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.status-ok-text {
  color: rgba(255, 255, 255, .78);
}
.modal-comprobante {
  width: min(500px, 100%);
  background: rgba(18, 22, 32, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 2px;
  padding: 24px;
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.55);
  color: #fff;
}

.badge-tn-online {
  background: rgba(201, 162, 39, 0.12);
  border: 1px solid rgba(201, 162, 39, 0.30);
  color: #c9a227;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 2px 7px;
  border-radius: 3px;
}

.pago-lineas {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.pago-linea-row {
  border-radius: 4px;
  transition: background 0.15s;
}

.pago-linea-row:not(:last-child) {
  padding-bottom: 4px;
}

.dev-item-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 0.5px solid rgba(255,255,255,0.07);
  opacity: 0.5;
  transition: opacity 0.15s;
}
.dev-item-row--active { opacity: 1; }
.dev-item-check { flex-shrink: 0; }
.dev-item-check input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
.dev-item-info { flex: 1; min-width: 0; }
.dev-item-nombre { font-size: 0.88rem; font-weight: 500; color: var(--text-primary, #fff); }
.dev-item-qty { display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; }
.dev-item-subtotal { font-size: 0.88rem; font-weight: 500; min-width: 90px; text-align: right; color: rgba(255,255,255,0.85); }
.dev-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.12);
}
.dev-total-monto { font-size: 1.15rem; font-weight: 600; color: #fff; }
</style>