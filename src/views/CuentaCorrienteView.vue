<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import Pager from "../components/Pager.vue"

import { clientesApi } from "../services/clientesApi"
import { cuentaCorrienteApi } from "../services/cuentaCorrienteService"
import { pagosApi } from "../services/pagosApi"
import { cajaApi } from "../services/cajaApi"
import { metodosPagoApi } from "../services/metodopagoService"
import { getTurnoOperativo } from "../ui/turnoOperativo"

const FLOAT_EPSILON = 0.001

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDateTime(v) {
  if (!v) return "—"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function unwrapPage(data) {
  if (Array.isArray(data)) {
    return {
      content: data,
      page: 0,
      size: data.length || 10,
      totalElements: data.length,
      totalPages: 1,
    }
  }
  const content = data?.content ?? data?.items ?? data?.data ?? []
  return {
    content: Array.isArray(content) ? content : [],
    page: Number(data?.page ?? data?.number ?? 0),
    size: Number(data?.size ?? data?.pageSize ?? 10),
    totalElements: Number(
      data?.totalElements ??
        data?.total ??
        (Array.isArray(content) ? content.length : 0)
    ),
    totalPages: Number(data?.totalPages ?? data?.pages ?? 1),
  }
}

function badgeOrigen(tipo) {
  const t = String(tipo || "").toUpperCase()
  if (t === "VENTA") return { text: "VENTA", cls: "badge badge-soft-primary" }
  if (t === "PAGO")  return { text: "PAGO",  cls: "badge badge-soft-success" }
  if (t === "NOTA_CREDITO" || t === "NC") {
    return { text: "NC", cls: "badge badge-soft-warning" }
  }
  return { text: t || "OTRO", cls: "badge badge-soft-secondary" }
}

function clampPage(p) {
  const n = Number(p)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function pickErr(e, fallback = "Ocurrió un error.") {
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.response?.data ||
    e?.message ||
    fallback
  )
}

function getCajaInfoMessage() {
  return "No hay una caja abierta para registrar cobros. Abrí una caja antes de cobrar deuda."
}

const loading      = ref(false)
const errorMsg     = ref("")
const okMsg        = ref("")
const infoMsg      = ref("")

const clientes     = ref([])
const clienteIdSel = ref("")

const deuda  = ref(null)
const estado = ref([])

// ── Panel de deudores ────────────────────────────────────────────
const deudores         = ref([])
const deudoresLoading  = ref(false)
const deudoresFiltro   = ref("")
const deudoresExpandido = ref(true)

async function fetchDeudores() {
  deudoresLoading.value = true
  try {
    const { data } = await cuentaCorrienteApi.deudores()
    const arr = Array.isArray(data) ? data : (data?.content ?? [])
    // Solo clientes con deuda real > 0, enrichidos con apellido del listado local
    deudores.value = arr
      .filter((d) => Number(d.deuda ?? 0) > 0.01)
      .map((d) => {
        const cLocal = clientes.value.find((c) => Number(c.id) === Number(d.clienteId))
        const apellido = cLocal?.apellido ?? ""
        const nombreCompleto = apellido
          ? `${d.nombre} ${apellido}`.trim()
          : d.nombre ?? "Sin nombre"
        return { ...d, apellido, nombreCompleto }
      })
      .sort((a, b) => Number(b.deuda) - Number(a.deuda))
  } catch {
    deudores.value = []
  } finally {
    deudoresLoading.value = false
  }
}

const deudoresFiltrados = computed(() => {
  const txt = deudoresFiltro.value.trim().toLowerCase()
  if (!txt) return deudores.value
  return deudores.value.filter((d) =>
    `${d.nombreCompleto} ${d.dni ?? ""}`.toLowerCase().includes(txt)
  )
})

const totalDeudaGlobal = computed(() =>
  deudores.value.reduce((a, d) => a + Number(d.deuda ?? 0), 0)
)

function exportDeudoresCSV() {
  const filas = deudoresFiltrados.value
  if (!filas.length) return
  const encabezado = ["Nombre", "DNI", "Deuda pendiente", "Ventas pendientes", "Ultima venta"]
  const lineas = [
    encabezado.join(";"),
    ...filas.map((d) => [
      `"${d.nombreCompleto}"`,
      `"${d.dni ?? ""}"`,
      String(Number(d.deuda ?? 0).toFixed(2)).replace(".", ","),
      String(d.cantidadVentasPendientes ?? ""),
      d.ultimaVenta ? `"${formatDateTime(d.ultimaVenta)}"` : "",
    ].join(";")),
  ]
  const blob = new Blob([lineas.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = `deudores_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function irACliente(d) {
  const cLocal = clientes.value.find((c) => Number(c.id) === Number(d.clienteId))
  if (cLocal) {
    selectCliente(cLocal)
  } else {
    clienteIdSel.value = String(d.clienteId)
    searchInput.value  = d.nombreCompleto
  }
  // scroll suave al buscador
  setTimeout(() => {
    document.querySelector(".cc-search")?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, 100)
}
// ─────────────────────────────────────────────────────────────────

const page          = ref(0)
const size          = ref(10)
const totalElements = ref(0)
const totalPages    = ref(1)

const filtroTexto  = ref("")
const filtroTipo   = ref("TODOS")
const filtroOrigen = ref("TODOS")

const expanded = ref(new Set())

const searchMode  = ref("DNI")
const searchInput = ref("")
const searching   = ref(false)
const searchError = ref("")
const showSuggest = ref(false)
const suggestions = ref([])

const debounceTimer = ref(null)
const requestSeq    = ref(0)
const bootstrapped  = ref(false)
const isMounted     = ref(false)

const turnoSel    = ref(getTurnoOperativo())
const cajaCheck   = ref({ ok: false, error: "" })
const cajaAbierta = ref(null)

async function refreshCaja() {
  try {
    const { data } = await cajaApi.abierta({ turno: turnoSel.value })
    cajaAbierta.value = data ?? null
    if (cajaAbierta.value?.cajaId) {
      cajaCheck.value = { ok: true, error: "" }
      if (infoMsg.value === getCajaInfoMessage()) infoMsg.value = ""
    } else {
      cajaCheck.value = { ok: false, error: "No hay caja ABIERTA." }
      infoMsg.value = getCajaInfoMessage()
    }
  } catch (e) {
    cajaAbierta.value = null
    if (e?.response?.status === 404) {
      cajaCheck.value = { ok: false, error: "No hay caja ABIERTA." }
      infoMsg.value = getCajaInfoMessage()
    } else {
      cajaCheck.value = { ok: false, error: pickErr(e, "No se pudo validar la caja.") }
    }
  }
}

const uiAlert = ref({ show: false, type: "info", title: "", message: "" })
let alertTimer = null

function showAlert(type, title, message) {
  uiAlert.value = { show: true, type, title, message }
  clearTimeout(alertTimer)
  alertTimer = setTimeout(() => { uiAlert.value.show = false }, 3600)
}

function closeAlert() { uiAlert.value.show = false }

const showPagoModal      = ref(false)
const ventaSeleccionada  = ref(null)
const pagoMonto          = ref("")
const pagoMetodoPagoId   = ref("")
const pagoReferencia     = ref("")
const pagoLoading        = ref(false)
const pagoError          = ref("")
const pagoInfo           = ref("")
const pagoSuccess        = ref("")
const metodosPago        = ref([])

async function fetchMetodosPago() {
  try {
    const { data } = await metodosPagoApi.list()
    metodosPago.value = Array.isArray(data) ? data : (data?.content ?? [])
  } catch {
    metodosPago.value = [
      { metodoPagoId: 1, nombre: "Efectivo" },
      { metodoPagoId: 2, nombre: "Transferencia" },
    ]
  }
}

const pagoRestante = computed(() => ventaSeleccionada.value?.pendiente ?? 0)

const pagoMontoNumero = computed(() => {
  const n = Number(pagoMonto.value)
  return Number.isFinite(n) ? n : 0
})

const pagoEsTotal = computed(() =>
  pagoMontoNumero.value > 0 &&
  Math.abs(pagoMontoNumero.value - pagoRestante.value) < FLOAT_EPSILON
)

const pagoEsParcial = computed(() =>
  pagoMontoNumero.value > 0 && pagoMontoNumero.value < pagoRestante.value - FLOAT_EPSILON
)

const saldoDespuesDelPago = computed(() => {
  const restante = pagoRestante.value - pagoMontoNumero.value
  return restante > FLOAT_EPSILON ? restante : 0
})

const cajaDisponibleLabel = computed(() => {
  if (!cajaAbierta.value?.cajaId) return "Sin caja abierta"
  return `Caja #${cajaAbierta.value.cajaId}`
})

function resetPagoModal() {
  showPagoModal.value     = false
  ventaSeleccionada.value = null
  pagoMonto.value         = ""
  pagoMetodoPagoId.value  = ""
  pagoReferencia.value    = ""
  pagoLoading.value       = false
  pagoError.value         = ""
  pagoInfo.value          = ""
  pagoSuccess.value       = ""
}

function cerrarPagoModal() { resetPagoModal() }

function abrirPago(row) {
  if (!cajaCheck.value.ok) {
    showAlert("warning", "Sin caja abierta", getCajaInfoMessage())
    return
  }
  ventaSeleccionada.value = row
  pagoError.value         = ""
  pagoSuccess.value       = ""
  const restante = row.pendiente
  if (!Number.isFinite(restante) || restante <= 0) {
    pagoMonto.value = ""
    pagoInfo.value  = "Esta venta no tiene saldo pendiente."
  } else {
    pagoMonto.value = restante.toFixed(2)
    pagoInfo.value  = "Se cargó automáticamente el saldo pendiente total. Podés modificarlo para registrar un pago parcial."
  }
  pagoMetodoPagoId.value = ""
  pagoReferencia.value   = ""
  showPagoModal.value    = true
}

function pagarTotal()  { if (pagoRestante.value) pagoMonto.value = pagoRestante.value.toFixed(2) }
function pagarMitad()  { if (pagoRestante.value) pagoMonto.value = (pagoRestante.value / 2).toFixed(2) }
function limpiarMonto(){ pagoMonto.value = "" }

function validarPago() {
  pagoError.value = ""
  if (!cajaAbierta.value?.cajaId) { pagoError.value = "No hay una caja abierta para registrar el cobro."; return false }
  const ventaId = Number(ventaSeleccionada.value?.ventaId || 0)
  if (!ventaId) { pagoError.value = "La venta seleccionada no es válida."; return false }
  const monto = Number(pagoMonto.value)
  if (!Number.isFinite(monto) || monto <= 0) { pagoError.value = "Ingresá un monto válido mayor a cero."; return false }
  if (monto > pagoRestante.value + FLOAT_EPSILON) { pagoError.value = "El monto no puede superar el saldo pendiente."; return false }
  const metodoId = Number(pagoMetodoPagoId.value)
  if (!metodoId) { pagoError.value = "Seleccioná un método de pago."; return false }
  return true
}

async function confirmarPago() {
  if (pagoLoading.value) return
  if (!validarPago()) return

  const esTotalPago  = pagoEsTotal.value
  const montoACobrar = Number(pagoMonto.value)
  const ventaId      = Number(ventaSeleccionada.value.ventaId)

  try {
    pagoLoading.value = true
    pagoError.value   = ""
    pagoSuccess.value = ""

    await pagosApi.create({
      ventaId,
      cajaId:       Number(cajaAbierta.value.cajaId),
      metodoPagoId: Number(pagoMetodoPagoId.value),
      monto:        montoACobrar,
      referencia:   pagoReferencia.value?.trim() || null,
    })

    pagoSuccess.value = esTotalPago
      ? "Cobro total registrado correctamente."
      : "Cobro parcial registrado correctamente."

    await refreshCurrentCuenta()
    await refreshCaja()
    // Refrescar panel global de deudores para que refleje el pago inmediatamente
    fetchDeudores()

    showAlert(
      "success",
      "Cobro registrado",
      esTotalPago
        ? "La deuda de esta venta quedó cancelada."
        : "El cobro parcial quedó registrado correctamente."
    )

    setTimeout(() => { if (isMounted.value) resetPagoModal() }, 650)
  } catch (e) {
    const msg = pickErr(e, "No se pudo registrar el cobro.")
    pagoError.value = msg
    showAlert("danger", "Error al registrar cobro", msg)
  } finally {
    pagoLoading.value = false
  }
}

function toggleRow(key) {
  const s = new Set(expanded.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  expanded.value = s
}

function mapCliente(c) {
  return {
    id:       Number(c?.clienteId ?? c?.id ?? 0),
    nombre:   c?.nombre ?? "",
    apellido: c?.apellido ?? "",
    dni:      c?.dni ?? null,
    activo:   c?.activo ?? true,
  }
}

const clientesActivos = computed(() =>
  (clientes.value || []).filter((c) => c.activo !== false)
)

const clienteSel = computed(() => {
  const id = Number(clienteIdSel.value)
  return clientesActivos.value.find((c) => Number(c.id) === id) ?? null
})

const clienteTitulo = computed(() => {
  if (!clienteSel.value) return "Cuenta Corriente"
  const c = clienteSel.value
  return `${c.nombre} ${c.apellido || ""}`.trim()
})

const clienteSubtitulo = computed(() => {
  if (!clienteSel.value) return "Seguimiento de deuda, historial y cobros por cliente."
  return clienteSel.value.dni
    ? `DNI: ${clienteSel.value.dni}`
    : "Seguimiento de deuda, historial y cobros del cliente."
})

function clienteLabel(c) {
  const full = `${c.nombre} ${c.apellido || ""}`.trim()
  const dni  = c.dni ? ` · DNI ${c.dni}` : ""
  return `${full}${dni}`
}

function buildSuggestions(txt) {
  const t = txt.trim().toLowerCase()
  if (!t) return []
  return clientesActivos.value
    .map((c) => ({
      id:      c.id,
      cliente: c,
      label:   clienteLabel(c),
      blob:    `${c.nombre} ${c.apellido} ${c.dni ?? ""} ${c.id}`.toLowerCase(),
    }))
    .filter((x) => x.blob.includes(t))
    .slice(0, 8)
    .map((x) => ({ id: x.id, label: x.label, cliente: x.cliente }))
}

function selectCliente(c) {
  if (!c?.id) return
  clienteIdSel.value = String(c.id)
  showSuggest.value  = false
  suggestions.value  = []
  searchError.value  = ""
  searchInput.value  = clienteLabel(c)
  infoMsg.value      = ""
}

async function searchByDni(dni) {
  const clean = String(dni || "").replace(/\D/g, "").trim()
  if (!clean) return
  const local = buildSuggestions(clean)
  if (local.length === 1) return selectCliente(local[0].cliente)
  if (local.length > 1) { suggestions.value = local; showSuggest.value = true; return }
  searching.value   = true
  searchError.value = ""
  try {
    const { data } = await clientesApi.getByDni(clean)
    const c = mapCliente(data)
    if (!c?.id) throw new Error("Cliente inválido")
    selectCliente(c)
    okMsg.value = `Cliente encontrado: ${c.nombre} ${c.apellido || ""}`.trim()
    setTimeout(() => { if (okMsg.value.startsWith("Cliente encontrado:")) okMsg.value = "" }, 1800)
  } catch (e) {
    searchError.value = e?.response?.data?.error || "No se encontró cliente con ese DNI."
  } finally {
    searching.value = false
  }
}

function onSearchInput() {
  const v = searchInput.value
  searchError.value = ""
  if (!v.trim()) { showSuggest.value = false; suggestions.value = []; return }
  clearTimeout(debounceTimer.value)
  debounceTimer.value = setTimeout(async () => {
    if (searchMode.value === "NOMBRE") {
      suggestions.value = buildSuggestions(v)
      showSuggest.value = suggestions.value.length > 0
      return
    }
    const clean = String(v).replace(/\D/g, "")
    if (clean.length >= 7) {
      const local = buildSuggestions(clean)
      if (local.length) { suggestions.value = local; showSuggest.value = true; return }
      try {
        searching.value = true
        const { data } = await clientesApi.getByDni(clean)
        const c = mapCliente(data)
        if (c?.id) { suggestions.value = [{ id: c.id, label: clienteLabel(c), cliente: c }]; showSuggest.value = true }
        else { suggestions.value = []; showSuggest.value = false }
      } catch { suggestions.value = []; showSuggest.value = false }
      finally  { searching.value = false }
    } else { suggestions.value = []; showSuggest.value = false }
  }, 250)
}

async function doSearch() {
  const v = searchInput.value.trim()
  if (!v) return
  if (searchMode.value === "NOMBRE") {
    const list = buildSuggestions(v)
    if (list.length === 1) { selectCliente(list[0].cliente) }
    else { suggestions.value = list; showSuggest.value = list.length > 0; if (!list.length) searchError.value = "No hay coincidencias." }
    return
  }
  await searchByDni(v)
}

function clearCliente() {
  clienteIdSel.value = ""
  searchInput.value  = ""
  suggestions.value  = []
  showSuggest.value  = false
  searchError.value  = ""
  infoMsg.value      = "Elegí un cliente para ver su cuenta corriente."
}

function onGlobalClick(e) {
  if (!e.target?.closest?.(".cc-search")) showSuggest.value = false
}

async function fetchClientes() {
  const { data } = await clientesApi.list({ page: 0, size: 500 })
  const paged = unwrapPage(data)
  clientes.value = paged.content.map(mapCliente)
}

function setClienteFromQuery() {
  const q = route.query.clienteId
  if (!q) return
  clienteIdSel.value = String(q)
}

function pushQueryCliente() {
  if (!clienteIdSel.value) {
    const qq = { ...route.query }
    delete qq.clienteId
    router.replace({ query: qq })
    return
  }
  router.replace({ query: { ...route.query, clienteId: String(clienteIdSel.value) } })
}

async function fetchCuenta(clienteId) {
  const pageAntes  = page.value
  const currentReq = ++requestSeq.value

  loading.value  = true
  errorMsg.value = ""
  okMsg.value    = ""
  infoMsg.value  = cajaCheck.value.ok ? "" : getCajaInfoMessage()

  try {
    // Cargamos TODOS los movimientos de una vez (size=9999) para que los KPIs
    // de Debe/Haber/Saldo y el export CSV sean siempre exactos, sin importar
    // cuántos movimientos tenga el cliente.
    const [rDeuda, rEstado] = await Promise.all([
      cuentaCorrienteApi.deuda(clienteId).catch(() => ({ data: null })),
      cuentaCorrienteApi.estadoCuenta(clienteId, { page: 0, size: 9999 }),
    ])

    if (currentReq !== requestSeq.value) return

    deuda.value = rDeuda?.data ?? null
    const paged = unwrapPage(rEstado?.data)

    // El backend no envía "pendiente" por fila. Lo calculamos acá:
    // para cada VENTA, pendiente = debe - suma de todos los pagos que apuntan a ese ventaId.
    const pagosMap = {}
    paged.content.forEach(r => {
      if (String(r.tipo ?? '').toUpperCase() === 'PAGO' && r.ventaId) {
        pagosMap[r.ventaId] = (pagosMap[r.ventaId] ?? 0) + Number(r.haber ?? 0)
      }
    })
    paged.content.forEach(r => {
      if (String(r.tipo ?? '').toUpperCase() === 'VENTA' && r.ventaId) {
        r.pendiente = Math.max(0, Number(r.debe ?? 0) - (pagosMap[r.ventaId] ?? 0))
      }
    })

    estado.value        = paged.content
    page.value          = 0
    totalElements.value = Math.max(0, Number(paged.totalElements || paged.content.length || 0))
    totalPages.value    = 1
    expanded.value      = new Set()

    if (!paged.content.length) {
      infoMsg.value = "Este cliente todavía no tiene movimientos en cuenta corriente."
    } else if (!cajaCheck.value.ok) {
      infoMsg.value = getCajaInfoMessage()
    }
  } catch (e) {
    if (currentReq !== requestSeq.value) return
    page.value          = pageAntes
    deuda.value         = null
    estado.value        = []
    totalElements.value = 0
    totalPages.value    = 1
    errorMsg.value      = pickErr(e, "Error cargando cuenta corriente.")
  } finally {
    if (currentReq === requestSeq.value) loading.value = false
  }
}

function normalizeRow(x, idx) {
  const fecha   = x.fecha ?? x.createdAt ?? x.created_at ?? null
  const debe    = Number(x.debe  ?? 0) || 0
  const haber   = Number(x.haber ?? 0) || 0
  const saldo   = x.saldo == null ? null : Number(x.saldo)
  const origen  = String(x.tipo ?? "OTRO").toUpperCase()
  const ventaId = x.ventaId ?? null
  const pagoId  = x.pagoId  ?? null
  const comprobanteId = x.comprobanteId ?? null
  const items   = Array.isArray(x.items) ? x.items : []

  let tipoMov = "OTRO"
  if (debe  > 0) tipoMov = "DEBE"
  else if (haber > 0) tipoMov = "HABER"

  const idKey = ventaId ?? pagoId ?? comprobanteId ?? idx
  const key   = `${origen}:${idKey}`

  const referencia =
    x.referencia ?? x.ref ?? x.descripcion ?? x.detalle ?? x.concepto ??
    (origen === "VENTA" ? "Venta" : null) ??
    (origen === "PAGO"  ? "Pago"  : null) ??
    (origen === "NOTA_CREDITO" ? "Nota de crédito" : null) ?? "—"

  return { fecha, referencia, debe, haber, saldo, tipoMov, origen, ventaId, pagoId, comprobanteId, items, key, pendiente: Number(x.pendiente ?? 0) }
}

const estadoUI = computed(() => (estado.value || []).map((x, idx) => normalizeRow(x, idx)))

const estadoFiltrado = computed(() => {
  const txt = filtroTexto.value.trim().toLowerCase()
  return estadoUI.value.filter((r) => {
    if (filtroOrigen.value !== "TODOS" && r.origen  !== filtroOrigen.value) return false
    if (filtroTipo.value   !== "TODOS" && r.tipoMov !== filtroTipo.value)   return false
    if (txt) {
      const blob = `${r.referencia ?? ""} ${r.origen ?? ""}`.toLowerCase()
      if (!blob.includes(txt)) return false
    }
    return true
  })
})

const totDebe  = computed(() => estadoUI.value.reduce((a, r) => a + Number(r.debe  || 0), 0))
const totHaber = computed(() => estadoUI.value.reduce((a, r) => a + Number(r.haber || 0), 0))

const saldoFinal = computed(() => {
  if (!estadoUI.value.length) return 0
  const last = estadoUI.value[estadoUI.value.length - 1]
  return Number(last.saldo ?? 0)
})

const deudaTotalActual = computed(() => {
  // Si hay historial cargado, la suma de pendientes por venta es la fuente más exacta
  // (evita el bug de inflación del endpoint /deuda cuando hay múltiples pagos por venta)
  if (estadoUI.value.length) {
    return estadoUI.value
      .filter(r => r.origen === 'VENTA')
      .reduce((sum, r) => sum + r.pendiente, 0)
  }
  const apiDebt = Number(deuda.value?.deuda)
  if (Number.isFinite(apiDebt)) return Math.max(0, apiDebt)
  return Math.max(0, saldoFinal.value, totDebe.value - totHaber.value)
})

const ventasConSaldoPendiente = computed(() =>
  estadoUI.value.filter((r) => r.origen === "VENTA" && r.pendiente > 0).length
)

function onPageChange(newPage) {
  const next    = clampPage(newPage)
  const maxPage = Math.max(0, totalPages.value - 1)
  const safeNext = Math.min(next, maxPage)
  if (safeNext === page.value) return
  page.value = safeNext
  if (clienteIdSel.value) fetchCuenta(Number(clienteIdSel.value))
}

function onSizeChange() {}

function cell(v) {
  return `"${String(v ?? "").replaceAll('"', '""')}"`
}

function formatMoneyExport(n) {
  const num = Number(n ?? 0)
  if (!num) return ""
  return `$ ${num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function origenLabel(o) {
  if (o === "VENTA")        return "Venta"
  if (o === "PAGO")         return "Pago"
  if (o === "NOTA_CREDITO") return "Nota de crédito"
  return o ?? ""
}

function exportCSV() {
  try {
    const c        = clienteSel.value
    const nombre   = c ? `${c.nombre} ${c.apellido || ""}`.trim() : "Cliente"
    const dni      = c?.dni ? `DNI ${c.dni}` : ""
    const hoy      = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    const filas    = estadoUI.value   // todos, sin filtro

    const lineas = [
      // ── Encabezado ──
      [cell("Elite Car Shop"), "", "", "", "", "", "", ""].join(";"),
      [cell("Estado de Cuenta"), "", "", "", "", "", "", ""].join(";"),
      ["", "", "", "", "", "", "", ""].join(";"),
      [cell("Cliente:"), cell(nombre), "", "", "", "", "", ""].join(";"),
      dni ? [cell("DNI:"), cell(dni), "", "", "", "", "", ""].join(";") : null,
      [cell("Fecha de emisión:"), cell(hoy), "", "", "", "", "", ""].join(";"),
      ["", "", "", "", "", "", "", ""].join(";"),

      // ── Columnas ──
      ["Fecha", "Movimiento", "Referencia", "Productos", "Cargo", "Abono", "Pendiente", "Saldo"].map(cell).join(";"),

      // ── Filas ──
      ...filas.map((r) => {
        const detalle = Array.isArray(r.items) && r.items.length
          ? r.items.map((it) => {
              const cant = it.cantidad > 0 ? `${it.cantidad}x ` : ""
              return `${cant}${it.productoNombre ?? "Producto"}`
            }).join(" · ")
          : ""
        return [
          cell(r.fecha ? new Date(r.fecha).toLocaleDateString("es-AR") : ""),
          cell(origenLabel(r.origen)),
          cell(r.referencia ?? ""),
          cell(detalle),
          cell(formatMoneyExport(r.debe)),
          cell(formatMoneyExport(r.haber)),
          cell(r.origen === "VENTA" && r.pendiente > 0 ? formatMoneyExport(r.pendiente) : ""),
          cell(formatMoneyExport(r.saldo)),
        ].join(";")
      }),

      // ── Totales ──
      ["", "", "", "", "", "", "", ""].join(";"),
      [cell("Total cargado:"), cell(formatMoneyExport(totDebe.value)), "", "", "", "", "", ""].join(";"),
      [cell("Total abonado:"), cell(formatMoneyExport(totHaber.value)), "", "", "", "", "", ""].join(";"),
      [cell("Saldo pendiente:"), cell(formatMoneyExport(deudaTotalActual.value)), "", "", "", "", "", ""].join(";"),
    ].filter((l) => l !== null)

    const bom  = "﻿"   // BOM para que Excel abra con tildes correctamente
    const blob = new Blob([bom + lineas.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `estado_cuenta_${(nombre).replace(/\s+/g, "_")}_${hoy.replace(/\//g, "-")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    showAlert("danger", "Error al exportar", "No se pudo generar el estado de cuenta.")
  }
}

function imprimirCuenta() {
  const c      = clienteSel.value
  const nombre = c ? `${c.nombre} ${c.apellido || ""}`.trim() : "Cliente"
  const dni    = c?.dni ? `DNI: ${c.dni}` : ""
  const hoy    = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
  const filas  = estadoUI.value

  const filasTR = filas.map((r) => {
    const productos = Array.isArray(r.items) && r.items.length
      ? r.items.map((it) => {
          const cant  = it.cantidad > 0 ? `${it.cantidad}x` : ""
          const precio = it.precioUnitario ? ` — $ ${formatMoney(it.precioUnitario)} c/u` : ""
          return `<span class="item-chip">${cant} ${it.productoNombre ?? "Producto"}${precio}</span>`
        }).join("")
      : ""
    return `
    <tr>
      <td>${r.fecha ? new Date(r.fecha).toLocaleDateString("es-AR") : ""}</td>
      <td>${origenLabel(r.origen)}</td>
      <td>
        <div class="ref">${r.referencia ?? ""}</div>
        ${productos ? `<div class="items">${productos}</div>` : ""}
      </td>
      <td class="num">${r.debe > 0 ? "$ " + formatMoney(r.debe) : ""}</td>
      <td class="num">${r.haber > 0 ? "$ " + formatMoney(r.haber) : ""}</td>
      <td class="num pend">${r.origen === "VENTA" && r.pendiente > 0 ? "$ " + formatMoney(r.pendiente) : ""}</td>
      <td class="num">${"$ " + formatMoney(r.saldo ?? 0)}</td>
    </tr>`
  }).join("")

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Estado de Cuenta - ${nombre}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 32px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .sub { color: #555; font-size: 12px; margin-bottom: 20px; }
    .info { margin-bottom: 20px; }
    .info span { display: inline-block; margin-right: 32px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #1a1a2e; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e5e5; font-size: 11px; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .num { text-align: right; }
    .pend { color: #c0392b; font-weight: bold; }
    .totales { margin-top: 24px; border-top: 2px solid #111; padding-top: 12px; }
    .totales table { width: 280px; margin-left: auto; }
    .totales td { border: none; padding: 4px 8px; }
    .totales .label { font-weight: bold; }
    .totales .pend { font-size: 14px; }
    .ref { font-weight: 600; }
    .items { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
    .item-chip { background: #f0f0f0; border-radius: 4px; padding: 2px 7px; font-size: 10px; color: #333; white-space: nowrap; }
    .footer { margin-top: 40px; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 8px; }
    @media print { body { margin: 16px; } }
  </style></head><body>
  <h1>Elite Car Shop</h1>
  <div class="sub">Estado de Cuenta</div>
  <div class="info">
    <span><b>Cliente:</b> ${nombre}</span>
    ${dni ? `<span><b>DNI:</b> ${c.dni}</span>` : ""}
    <span><b>Emitido:</b> ${hoy}</span>
  </div>
  <table>
    <thead><tr>
      <th>Fecha</th><th>Movimiento</th><th>Referencia</th>
      <th class="num">Cargo</th><th class="num">Abono</th>
      <th class="num">Pendiente</th><th class="num">Saldo</th>
    </tr></thead>
    <tbody>${filasTR}</tbody>
  </table>
  <div class="totales">
    <table>
      <tr><td class="label">Total cargado:</td><td class="num">$ ${formatMoney(totDebe.value)}</td></tr>
      <tr><td class="label">Total abonado:</td><td class="num">$ ${formatMoney(totHaber.value)}</td></tr>
      <tr><td class="label pend">Saldo pendiente:</td><td class="num pend">$ ${formatMoney(deudaTotalActual.value)}</td></tr>
    </table>
  </div>
  <div class="footer">Documento generado el ${hoy} · Elite Car Shop</div>
  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`

  const w = window.open("", "_blank")
  if (w) { w.document.write(html); w.document.close() }
  else showAlert("warning", "Ventana bloqueada", "Permitir ventanas emergentes para imprimir.")
}

async function refreshCurrentCuenta() {
  // Siempre refrescar el panel global de deudores
  fetchDeudores()
  // Refrescar la cuenta del cliente seleccionado si hay uno
  if (!clienteIdSel.value) return
  await fetchCuenta(Number(clienteIdSel.value))
}

const route  = useRoute()
const router = useRouter()

onMounted(async () => {
  isMounted.value = true
  await Promise.all([fetchClientes(), refreshCaja(), fetchMetodosPago()])
  setClienteFromQuery()
  bootstrapped.value = true
  // Cargar panel de deudores después de tener los clientes para poder enriquecer con apellido
  fetchDeudores()
  if (clienteIdSel.value) {
    await fetchCuenta(Number(clienteIdSel.value))
  } else {
    infoMsg.value = "Elegí un cliente para ver su cuenta corriente."
  }
  window.addEventListener("click", onGlobalClick)
  window.addEventListener("cuentaCorriente:changed", refreshCurrentCuenta)
})

onBeforeUnmount(() => {
  isMounted.value = false
  window.removeEventListener("click", onGlobalClick)
  window.removeEventListener("cuentaCorriente:changed", refreshCurrentCuenta)
  clearTimeout(debounceTimer.value)
  clearTimeout(alertTimer)
})

watch(clienteIdSel, async (v, oldV) => {
  if (!bootstrapped.value || v === oldV) return
  pushQueryCliente()
  if (!v) {
    deuda.value         = null
    estado.value        = []
    totalElements.value = 0
    totalPages.value    = 1
    page.value          = 0
    expanded.value      = new Set()
    infoMsg.value       = "Elegí un cliente para ver su cuenta corriente."
    return
  }
  page.value = 0
  await fetchCuenta(Number(v))
})
</script>

<template>
  <div class="cc-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Clientes</p>
        <h1 class="page-title mb-1">
          {{ clienteSel ? clienteTitulo : "Cuenta Corriente" }}
        </h1>
        <p class="page-subtitle mb-0">{{ clienteSubtitulo }}</p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="refreshCurrentCuenta" :disabled="loading || !clienteIdSel">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>
        <button class="btn btn-outline-light" @click="clearCliente" :disabled="loading && !clienteIdSel">
          Limpiar
        </button>
      </div>
    </section>

    <div v-if="uiAlert.show" class="app-alert mb-3" :class="`app-alert--${uiAlert.type}`">
      <div>
        <div class="app-alert__title">{{ uiAlert.title }}</div>
        <div class="app-alert__text">{{ uiAlert.message }}</div>
      </div>
      <button class="app-alert__close" @click="closeAlert">×</button>
    </div>

    <div v-if="errorMsg" class="alert alert-danger py-2 mb-3">{{ errorMsg }}</div>
    <div v-if="okMsg"    class="alert alert-success py-2 mb-3">{{ okMsg }}</div>
    <div v-if="infoMsg"  class="alert alert-secondary py-2 mb-3">{{ infoMsg }}</div>

    <!-- ── Panel global de deudores ─────────────────────────────── -->
    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-0" style="cursor:pointer" @click="deudoresExpandido = !deudoresExpandido">
          <div>
            <h2 class="section-title mb-0">
              Clientes con saldo pendiente
              <span v-if="!deudoresLoading" class="badge badge-soft-danger ms-2">{{ deudores.length }}</span>
            </h2>
            <div class="helper-text mt-1" v-if="!deudoresLoading">
              Total adeudado: <strong class="text-danger">$ {{ formatMoney(totalDeudaGlobal) }}</strong>
              · Hacé clic en un cliente para ver y cobrar su cuenta.
            </div>
          </div>
          <div class="d-flex gap-2 align-items-center">
            <button
              class="btn btn-sm btn-outline-light"
              @click.stop="exportDeudoresCSV"
              :disabled="!deudoresFiltrados.length"
              title="Exportar lista de deudores a Excel/CSV"
            >
              Exportar deudores
            </button>
            <button
              class="btn btn-sm btn-outline-light"
              @click.stop="fetchDeudores"
              :disabled="deudoresLoading"
            >
              {{ deudoresLoading ? "Cargando..." : "Actualizar" }}
            </button>
            <span class="helper-text ms-1">{{ deudoresExpandido ? "▲" : "▼" }}</span>
          </div>
        </div>

        <div v-if="deudoresExpandido" class="mt-3">
          <!-- Buscador rápido dentro del panel -->
          <div class="mb-3">
            <input
              v-model="deudoresFiltro"
              class="form-control app-input"
              placeholder="Filtrar por nombre o DNI..."
              style="max-width:340px"
            />
          </div>

          <div v-if="deudoresLoading" class="helper-text py-3">Cargando deudores...</div>

          <div v-else-if="!deudoresFiltrados.length" class="empty-block">
            <div class="empty-title">
              {{ deudores.length ? "Sin resultados para ese filtro" : "No hay clientes con deuda pendiente" }}
            </div>
          </div>

          <div v-else class="table-responsive">
            <table class="table table-dark table-hover align-middle app-table mb-0">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>DNI</th>
                  <th class="text-end">Deuda pendiente</th>
                  <th class="text-center">Ventas pendientes</th>
                  <th>Última venta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="d in deudoresFiltrados"
                  :key="d.clienteId"
                  :class="{ 'cc-fila-activa': String(d.clienteId) === String(clienteIdSel) }"
                >
                  <td class="fw-semibold">{{ d.nombreCompleto }}</td>
                  <td class="text-secondary">{{ d.dni ?? "—" }}</td>
                  <td class="text-end td-num fw-bold text-danger">$ {{ formatMoney(d.deuda) }}</td>
                  <td class="text-center">
                    <span class="badge badge-soft-warning">{{ d.cantidadVentasPendientes ?? "—" }}</span>
                  </td>
                  <td class="text-secondary" style="font-size:0.85rem">
                    {{ d.ultimaVenta ? formatDateTime(d.ultimaVenta) : "—" }}
                  </td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-light" @click="irACliente(d)">
                      Ver cuenta
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    <!-- ────────────────────────────────────────────────────────── -->

    <!-- Barra de cliente activo -->
    <div v-if="clienteSel" class="cc-cliente-activo mb-3">
      <div class="cc-cliente-activo-info">
        <div class="cc-cliente-activo-nombre">{{ clienteTitulo }}</div>
        <div class="cc-cliente-activo-sub">
          {{ clienteSel.dni ? `DNI: ${clienteSel.dni}` : 'Sin DNI registrado' }}
          · {{ ventasConSaldoPendiente }} venta(s) con saldo pendiente
        </div>
      </div>
      <div class="cc-cliente-activo-deuda">
        <div class="cc-cliente-activo-deuda-label">Saldo pendiente</div>
        <div class="cc-cliente-activo-deuda-valor">$ {{ formatMoney(deudaTotalActual) }}</div>
      </div>
      <button class="btn btn-sm btn-outline-light" @click="clearCliente">
        Cambiar cliente
      </button>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3 cc-search">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Buscar cliente</h2>
          <div class="helper-text">Buscá por DNI o por nombre para ver su deuda y sus movimientos.</div>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label field-label">Modo de búsqueda</label>
            <select v-model="searchMode" class="form-select app-input" :disabled="loading">
              <option value="DNI">Por DNI</option>
              <option value="NOMBRE">Por nombre / apellido</option>
            </select>
          </div>

          <div class="col-12 col-md-5 position-relative">
            <label class="form-label field-label">
              {{ searchMode === "DNI" ? "DNI" : "Nombre / Apellido" }}
            </label>
            <input
              v-model="searchInput"
              class="form-control app-input"
              :placeholder="searchMode === 'DNI' ? 'Ej: 40111222' : 'Ej: Juan Pérez'"
              :inputmode="searchMode === 'DNI' ? 'numeric' : 'text'"
              @input="onSearchInput"
              @focus="onSearchInput"
              @keyup.enter="doSearch"
              :disabled="loading"
            />
            <div v-if="showSuggest" class="suggest-box rounded mt-1">
              <button v-for="s in suggestions" :key="s.id" class="suggestion-item" type="button" @click="selectCliente(s.cliente)">
                {{ s.label }}
              </button>
            </div>
            <div v-if="searchError" class="text-danger small mt-2">{{ searchError }}</div>
          </div>

          <div class="col-12 col-md-2">
            <button class="btn btn-outline-light w-100" @click="doSearch" :disabled="loading || searching">
              {{ searching ? "Buscando..." : "Buscar" }}
            </button>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label field-label">Cliente</label>
            <select v-model="clienteIdSel" class="form-select app-input" :disabled="loading">
              <option value="">Seleccionar…</option>
              <option v-for="c in clientesActivos" :key="c.id" :value="String(c.id)">
                {{ c.nombre }} {{ c.apellido || "" }} · DNI: {{ c.dni || "-" }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <template v-if="clienteIdSel">
      <div class="debt-focus-card mb-3">
        <div class="debt-focus-copy">
          <div class="debt-focus-label">Total pendiente actual</div>
          <div class="debt-focus-value">$ {{ formatMoney(deudaTotalActual) }}</div>
          <div class="debt-focus-note">
            Este es el monto más importante para el cliente: lo que todavía resta abonar.
          </div>
        </div>
        <div class="debt-focus-side">
          <div class="debt-mini">
            <span>Ventas con saldo</span>
            <strong>{{ ventasConSaldoPendiente }}</strong>
          </div>
          <div class="debt-mini">
            <span>Caja activa</span>
            <strong :class="cajaCheck.ok ? 'text-success' : 'text-danger'">
              {{ cajaCheck.ok ? "Sí" : "No" }}
            </strong>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-6 col-md-3">
          <div class="kpi-card kpi-card--danger">
            <div class="kpi-label">Debe</div>
            <div class="kpi-value" style="color:#e87070">$ {{ formatMoney(totDebe) }}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="kpi-card kpi-card--success">
            <div class="kpi-label">Haber</div>
            <div class="kpi-value" style="color:#5cb88a">$ {{ formatMoney(totHaber) }}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="kpi-card">
            <div class="kpi-label">Saldo acumulado</div>
            <div class="kpi-value">$ {{ formatMoney(saldoFinal) }}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="kpi-card kpi-card--accent">
            <div class="kpi-label">Resta pagar</div>
            <div class="kpi-value">$ {{ formatMoney(deudaTotalActual) }}</div>
          </div>
        </div>
      </div>

      <div class="card bg-panel border-0 shadow-sm mb-3">
        <div class="card-body">
          <div class="section-header mb-3">
            <h2 class="section-title mb-0">Filtros</h2>
            <div class="helper-text">Mostrando {{ estadoFiltrado.length }} de {{ totalElements }} registro(s)</div>
          </div>
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-3">
              <label class="form-label field-label">Origen</label>
              <select v-model="filtroOrigen" class="form-select app-input">
                <option value="TODOS">Todos los orígenes</option>
                <option value="VENTA">Ventas</option>
                <option value="PAGO">Pagos</option>
                <option value="NOTA_CREDITO">Notas de crédito</option>
              </select>
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label field-label">Tipo</label>
              <select v-model="filtroTipo" class="form-select app-input">
                <option value="TODOS">Debe + Haber</option>
                <option value="DEBE">Solo Debe</option>
                <option value="HABER">Solo Haber</option>
              </select>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label field-label">Buscar en historial</label>
              <input v-model="filtroTexto" class="form-control app-input" placeholder="Referencia u origen..." />
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-panel border-0 shadow-sm">
        <div class="card-body">
          <div class="section-header mb-3">
            <div>
              <h2 class="section-title mb-0">Historial de cuenta</h2>
              <div class="helper-text">Todos los movimientos del cliente seleccionado.</div>
            </div>
            <div class="d-flex gap-2" v-if="estadoUI.length">
              <button class="btn btn-sm btn-outline-light" @click="exportCSV">
                Exportar Excel
              </button>
              <button class="btn btn-sm btn-outline-light" @click="imprimirCuenta">
                Imprimir / PDF
              </button>
            </div>
          </div>

          <div v-if="loading" class="empty-block">
            <div class="empty-title">Cargando movimientos</div>
            <div class="helper-text">Esperá un momento.</div>
          </div>

          <div v-else-if="!estadoFiltrado.length" class="empty-block">
            <div class="empty-title">No hay movimientos para mostrar</div>
            <div class="helper-text">Este cliente no tiene historial o no coincide con los filtros actuales.</div>
          </div>

          <div v-else class="table-responsive">
            <table class="table table-dark table-hover align-middle app-table mb-0">
              <thead>
                <tr>
                  <th style="width: 170px">Fecha</th>
                  <th style="width: 110px">Origen</th>
                  <th>Referencia</th>
                  <th style="width: 140px" class="text-end">Debe</th>
                  <th style="width: 140px" class="text-end">Haber</th>
                  <th style="width: 150px" class="text-end">Pendiente</th>
                  <th style="width: 150px" class="text-end">Saldo</th>
                  <th style="width: 120px" class="text-end">Detalle</th>
                  <th style="width: 150px" class="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="r in estadoFiltrado" :key="r.key">
                  <tr>
                    <td class="text-secondary">{{ formatDateTime(r.fecha) }}</td>
                    <td>
                      <span :class="badgeOrigen(r.origen).cls">{{ badgeOrigen(r.origen).text }}</span>
                    </td>
                    <td>
                      <div class="fw-semibold text-white">{{ r.referencia || "—" }}</div>
                    </td>
                    <td class="text-end td-num" :class="r.debe  > 0 ? 'text-danger fw-bold'  : 'text-secondary'">
                      {{ r.debe  > 0 ? "$ " + formatMoney(r.debe)  : "—" }}
                    </td>
                    <td class="text-end td-num" :class="r.haber > 0 ? 'text-success fw-bold' : 'text-secondary'">
                      {{ r.haber > 0 ? "$ " + formatMoney(r.haber) : "—" }}
                    </td>
                    <td class="text-end td-num">
                      <span v-if="r.origen === 'VENTA' && r.pendiente > 0" class="pending-pill">
                        $ {{ formatMoney(r.pendiente) }}
                      </span>
                      <span v-else class="text-secondary">—</span>
                    </td>
                    <td class="text-end td-num fw-bold">$ {{ formatMoney(r.saldo ?? 0) }}</td>
                    <td class="text-end">
                      <button
                        v-if="r.origen === 'VENTA'"
                        class="btn btn-sm btn-outline-light btn-expand"
                        type="button"
                        @click="toggleRow(r.key)"
                        :disabled="!r.items?.length"
                      >
                        {{ expanded.has(r.key) ? "Ocultar" : "Ver" }}
                      </button>
                    </td>
                    <td class="text-end">
                      <button
                        v-if="r.origen === 'VENTA' && r.pendiente > 0"
                        class="btn btn-sm btn-success"
                        @click="abrirPago(r)"
                        :disabled="!cajaCheck.ok"
                      >
                        Cobrar deuda
                      </button>
                      <span v-else class="text-secondary small">—</span>
                    </td>
                  </tr>

                  <tr v-if="expanded.has(r.key)">
                    <td colspan="9" class="p-0">
                      <div class="cc-detail p-3 border-top border-secondary">
                        <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                          <div class="text-white fw-semibold">Detalle de la venta</div>
                          <div class="detail-pills">
                            <span class="mini-pill">Pendiente: $ {{ formatMoney(r.pendiente) }}</span>
                            <span class="mini-pill mini-pill--muted">Items: {{ r.items.length }}</span>
                          </div>
                        </div>
                        <div v-if="!r.items?.length" class="text-secondary small">No hay items para mostrar.</div>
                        <div v-else class="table-responsive">
                          <table class="table table-dark table-sm align-middle app-table mb-0">
                            <thead>
                              <tr>
                                <th>Producto</th>
                                <th style="width: 110px" class="text-end">Cantidad</th>
                                <th style="width: 160px" class="text-end">Precio</th>
                                <th style="width: 160px" class="text-end">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="(it, i) in r.items" :key="i">
                                <td><div class="text-white fw-semibold">{{ it.productoNombre || "Producto" }}</div></td>
                                <td class="text-end text-white fw-semibold">{{ it.cantidad ?? "—" }}</td>
                                <td class="text-end td-num" style="color:rgba(255,255,255,0.55)">{{ it.precioUnitario != null ? "$ " + formatMoney(it.precioUnitario) : "—" }}</td>
                                <td class="text-end td-num fw-semibold">{{ it.subtotal != null ? "$ " + formatMoney(it.subtotal) : "—" }}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <div class="cc-footer">
            <div class="helper-text">
              <b>{{ estadoFiltrado.length }}</b> registro(s) mostrado(s)
              <template v-if="estadoFiltrado.length !== estadoUI.length">
                de <b>{{ estadoUI.length }}</b> en total
              </template>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="showPagoModal" class="modal-backdrop cc-modal-backdrop" @click.self="!pagoLoading && cerrarPagoModal()">
      <div class="cc-modal">
        <div class="cc-modal__header">
          <div>
            <h5 class="mb-1">Registrar cobro</h5>
            <p class="mb-0 text-secondary small">Confirmá cuánto querés cobrar de esta deuda.</p>
          </div>
          <button class="cc-modal__close" @click="cerrarPagoModal">×</button>
        </div>

        <div class="cc-modal__body">
          <div class="pay-resume-card">
            <div class="pay-resume-row">
              <span>Referencia</span>
              <strong>{{ ventaSeleccionada?.referencia || "—" }}</strong>
            </div>
            <div class="pay-resume-row">
              <span>Saldo pendiente actual</span>
              <strong class="text-warning">$ {{ formatMoney(pagoRestante) }}</strong>
            </div>
            <div class="pay-resume-row">
              <span>Monto a cobrar</span>
              <strong class="text-white">$ {{ formatMoney(pagoMontoNumero) }}</strong>
            </div>
            <div class="pay-resume-row">
              <span>Saldo luego del cobro</span>
              <strong :class="saldoDespuesDelPago > 0 ? 'text-warning' : 'text-success'">
                $ {{ formatMoney(saldoDespuesDelPago) }}
              </strong>
            </div>
            <div class="pay-resume-row">
              <span>Caja activa</span>
              <strong :class="cajaCheck.ok ? 'text-success' : 'text-danger'">
                {{ cajaDisponibleLabel }}
              </strong>
            </div>
          </div>

          <div v-if="pagoError"                  class="alert alert-danger    py-2 mt-3 mb-0">{{ pagoError }}</div>
          <div v-if="pagoSuccess"                 class="alert alert-success   py-2 mt-3 mb-0">{{ pagoSuccess }}</div>
          <div v-if="pagoInfo && !pagoError"      class="alert alert-secondary py-2 mt-3 mb-0">{{ pagoInfo }}</div>

          <div class="row g-3 mt-1">
            <div class="col-12">
              <label class="form-label field-label">Monto a cobrar</label>
              <input v-model="pagoMonto" type="number" min="0" step="0.01" class="form-control app-input" placeholder="Ingresá el monto" />
              <div class="quick-pay-actions mt-2">
                <button class="btn btn-sm btn-outline-light" type="button" @click="pagarMitad">50%</button>
                <button class="btn btn-sm btn-outline-light" type="button" @click="pagarTotal">Total</button>
                <button class="btn btn-sm btn-outline-light" type="button" @click="limpiarMonto">Limpiar</button>
                <span v-if="pagoEsTotal"   class="pay-chip pay-chip--success">Cancelación total</span>
                <span v-else-if="pagoEsParcial" class="pay-chip pay-chip--warning">Cobro parcial</span>
              </div>
            </div>

            <div class="col-12 col-md-6">
              <label class="form-label field-label">Método de pago</label>
              <select v-model="pagoMetodoPagoId" class="form-select app-input">
                <option value="">Seleccionar…</option>
                <option v-for="m in metodosPago" :key="m.metodoPagoId" :value="String(m.metodoPagoId)">
                  {{ m.nombre }}
                </option>
              </select>
            </div>

            <div class="col-12 col-md-6">
              <label class="form-label field-label">Referencia</label>
              <input v-model="pagoReferencia" class="form-control app-input" placeholder="Ej: transferencia, alias, comprobante..." />
            </div>
          </div>
        </div>

        <div class="cc-modal__footer">
          <button class="btn btn-outline-light" @click="cerrarPagoModal" :disabled="pagoLoading">Cancelar</button>
          <button class="btn btn-accent"        @click="confirmarPago"   :disabled="pagoLoading || !cajaCheck.ok">
            {{ pagoLoading ? "Registrando..." : "Confirmar cobro" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cc-page { min-height: 100%; }

.page-title { font-size: 1.75rem; font-weight: 800; color: #fff; line-height: 1.15; }

.bg-panel {
  background: rgba(16, 13, 8, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 6px;
}

.field-label  { color: rgba(255, 255, 255, 0.72); font-size: 0.88rem; font-weight: 600; }
.helper-text  { color: rgba(255, 255, 255, 0.58); font-size: 0.85rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.section-title  { color: #fff; font-weight: 700; font-size: 1rem; }

.app-input {
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.10);
  min-height: 44px;
}

.app-input:focus {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border-color: rgba(var(--app-accent-rgb), 0.40);
  box-shadow: 0 0 0 0.16rem rgba(var(--app-accent-rgb), 0.10);
}

/* ── Tarjeta de deuda principal ── */
.debt-focus-card {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px;
  border-radius: 6px;
  background: rgba(18, 14, 8, 0.97);
  border: 1px solid rgba(var(--app-accent-rgb), 0.18);
  border-left: 3px solid rgba(var(--app-accent-rgb), 0.45);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.22);
}

.debt-focus-copy  { flex: 1 1 320px; }
.debt-focus-label { color: rgba(255, 255, 255, 0.72); font-size: 0.9rem; margin-bottom: 8px; }
.debt-focus-value {
  color: #fff;
  font-weight: 900;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1;
  margin-bottom: 10px;
}
.debt-focus-note { color: rgba(255, 255, 255, 0.65); max-width: 560px; }

.debt-focus-side {
  display: grid;
  grid-template-columns: repeat(1, minmax(140px, 1fr));
  gap: 10px;
  min-width: 240px;
}

.debt-mini {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px 14px;
  border-radius: 4px;
}
.debt-mini span   { display: block; color: rgba(255, 255, 255, 0.62); font-size: 0.8rem; margin-bottom: 4px; }
.debt-mini strong { color: #fff; font-size: 1rem; }

/* ── KPIs ── */
.kpi-card {
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-top: 2px solid rgba(255, 255, 255, 0.10);
  border-radius: 6px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.02);
  height: 100%;
}

.kpi-card--danger {
  border-top-color: rgba(239, 68, 68, 0.55);
  background: rgba(239, 68, 68, 0.03);
}

.kpi-card--success {
  border-top-color: rgba(39, 209, 127, 0.55);
  background: rgba(39, 209, 127, 0.03);
}

.kpi-card--accent {
  border-top-color: rgba(201, 162, 39, 0.55);
  background: rgba(201, 162, 39, 0.03);
}

.kpi-label {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}
.kpi-value { color: #fff; font-weight: 800; font-size: 1.05rem; }

/* ── Fila activa en panel de deudores ── */
.cc-fila-activa td {
  background: rgba(201, 162, 39, 0.10) !important;
}
.cc-fila-activa td:first-child {
  border-left: 3px solid rgba(201, 162, 39, 0.65);
}

/* ── Barra de cliente activo ── */
.cc-cliente-activo {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 14px 18px;
  border-radius: 6px;
  border-left: 3px solid rgba(201, 162, 39, 0.50);
  background: rgba(201, 162, 39, 0.06);
  border-top: 1px solid rgba(201, 162, 39, 0.16);
  border-right: 1px solid rgba(201, 162, 39, 0.16);
  border-bottom: 1px solid rgba(201, 162, 39, 0.16);
  flex-wrap: wrap;
}

.cc-cliente-activo-info {
  flex: 1;
  min-width: 200px;
}

.cc-cliente-activo-nombre {
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}

.cc-cliente-activo-sub {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 3px;
}

.cc-cliente-activo-deuda {
  text-align: right;
  flex-shrink: 0;
}

.cc-cliente-activo-deuda-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.50);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.cc-cliente-activo-deuda-valor {
  font-size: 1.4rem;
  font-weight: 800;
  color: #e05252;
  line-height: 1;
}

/* ── Sugerencias ── */
.suggest-box {
  position: absolute;
  z-index: 50;
  width: 100%;
  max-height: 260px;
  overflow: auto;
  background: #111827;
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  border-radius: 4px;
}

.suggestion-item {
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: #fff;
  padding: 10px 12px;
}

.suggestion-item:hover {
  background: rgba(var(--app-accent-rgb), 0.14);
}

.cc-detail { background: rgba(10, 8, 4, 0.85); }

/* ── Badges ── */
.badge-soft-primary   { background: rgba(201, 162, 39, 0.16); color: #e8c97a;  border: 1px solid rgba(201, 162, 39, 0.30); }
.badge-soft-success   { background: rgba(34,  197, 94, 0.18); color: #86efac;  border: 1px solid rgba(34,  197, 94, 0.35); }
.badge-soft-warning   { background: rgba(245, 158, 11, 0.18); color: #fcd34d;  border: 1px solid rgba(245, 158, 11, 0.35); }
.badge-soft-secondary { background: rgba(107, 114, 128, 0.18); color: #d1d5db; border: 1px solid rgba(107, 114, 128, 0.35); }

.pending-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96px;
  padding: 5px 10px;
  border-radius: 4px;
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fcd34d;
  font-weight: 700;
  font-size: 0.82rem;
}

.detail-pills { display: flex; gap: 8px; flex-wrap: wrap; }

.mini-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 9px;
  border-radius: 3px;
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.22);
  color: #fcd34d;
  font-size: 0.8rem;
  font-weight: 700;
}

.mini-pill--muted {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.78);
}

.app-table thead th {
  color: rgba(255, 255, 255, 0.42);
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom-color: rgba(255, 255, 255, 0.08);
  padding-top: 8px;
  padding-bottom: 8px;
}
.app-table tbody td {
  border-bottom-color: rgba(255, 255, 255, 0.04);
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 0.9rem;
}
.table td, .table th { vertical-align: middle; }
.table-dark.table-hover tbody tr:hover td { background: rgba(255, 255, 255, 0.025); }
.btn-expand { min-width: 88px; }
.empty-block { padding: 14px 0; }
.empty-title { color: #fff; font-weight: 700; margin-bottom: 4px; }

.cc-footer {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 16px;
  margin-top: 16px;
}

/* ── Alertas ── */
.app-alert {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 16px;
  border-radius: 4px;
  border: 1px solid;
}
.app-alert__title { font-weight: 800; color: #fff; margin-bottom: 2px; }
.app-alert__text  { color: rgba(255, 255, 255, 0.78); font-size: 0.92rem; }
.app-alert__close { border: 0; background: transparent; color: #fff; font-size: 22px; line-height: 1; opacity: 0.8; }
.app-alert--success { background: rgba(34,  197, 94, 0.12); border-color: rgba(34,  197, 94, 0.28); }
.app-alert--danger  { background: rgba(239, 68,  68, 0.12); border-color: rgba(239, 68,  68, 0.28); }
.app-alert--warning { background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.28); }
.app-alert--info    { background: rgba(var(--app-accent-rgb), 0.10); border-color: rgba(var(--app-accent-rgb), 0.25); }

/* ── Modal ── */
.cc-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(4, 3, 1, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 20px;
}

.cc-modal {
  width: 100%;
  max-width: 580px;
  background: #120e06;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

.cc-modal__header,
.cc-modal__footer { padding: 18px 20px; }

.cc-modal__body { padding: 0 20px 20px; }

.cc-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.cc-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.cc-modal__close { border: 0; background: transparent; color: #fff; font-size: 24px; line-height: 1; opacity: 0.8; }

.pay-resume-card {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.pay-resume-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
  color: rgba(255, 255, 255, 0.8);
}

.pay-resume-row + .pay-resume-row { border-top: 1px dashed rgba(255, 255, 255, 0.08); }

.quick-pay-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.pay-chip { display: inline-flex; align-items: center; padding: 5px 9px; border-radius: 3px; font-size: 0.78rem; font-weight: 700; }
.pay-chip--success { background: rgba(34,  197, 94, 0.18); color: #86efac; border: 1px solid rgba(34,  197, 94, 0.30); }
.pay-chip--warning { background: rgba(245, 158, 11, 0.18); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.30); }

@media (max-width: 900px) {
  .debt-focus-card { flex-direction: column; }
  .debt-focus-side { grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; }
}

@media (max-width: 768px) {
  .page-title { font-size: 1.6rem; }
  .debt-focus-side { grid-template-columns: 1fr; }
}
</style>