<script setup>
import { computed, ref, onMounted, watch } from "vue"
import { RouterLink } from "vue-router"
import { getSession } from "../auth/session"
import { emitCajaChanged } from "../ui/cajaEvents"
import { cajaApi } from "../services/cajaApi"
import { movimientosCajaApi } from "../services/movimientosCajaApi"
import { getTurnoOperativo, setTurnoOperativo } from "../ui/turnoOperativo"
import { metodosPagoApi } from "../services/metodopagoService"
import { ventasApi } from "../services/ventasApi"
import { productosApi } from "../services/productosApi"
import { clientesApi } from "../services/clientesApi"

const session = getSession() ?? null
const permissions = Array.isArray(session?.permissions) ? session.permissions : []

function hasPermission(permission) {
  if (permissions.includes("admin:all")) return true
  return permissions.includes(permission)
}

const canViewCaja = computed(() => hasPermission("caja:ver"))
const canAbrirCajaPerm = computed(() => hasPermission("caja:abrir"))
const canCerrarCajaPerm = computed(() => hasPermission("caja:cerrar"))
const canCrearMovimientoPerm = computed(() => hasPermission("movimientos_caja:crear"))
const isAdmin = computed(() => permissions.includes("admin:all"))

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function toMoneyNumber(v) {
  const raw = String(v ?? "").trim()
  if (!raw) return null
  const normalized = raw.replace(",", ".").replace(/[^\d.-]/g, "")
  if (!normalized) return null
  const x = Number(normalized)
  return Number.isFinite(x) ? x : null
}

function formatDateTime(v) {
  if (!v) return "—"
  try {
    const text = String(v).includes("T") ? String(v) : `${v}T00:00:00`
    return new Date(text).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return String(v)
  }
}

function formatDate(v) {
  if (!v) return "—"
  try {
    return new Date(`${v}T12:00:00`).toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return String(v)
  }
}

function tipoPorConcepto(concepto) {
  if (concepto === "GASTO" || concepto === "RETIRO") return "EGRESO"
  if (concepto === "APORTE") return "INGRESO"
  return "EGRESO"
}

function badgeTipoClass(tipo) {
  return String(tipo || "").toUpperCase() === "INGRESO"
    ? "badge-soft-success"
    : "badge-soft-danger"
}

function turnoLabel(turno) {
  return turno === "MANIANA" ? "MAÑANA" : "TARDE"
}

function pickError(e, fallback = "Ocurrió un error.") {
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  )
}

const selectedTurno = ref(getTurnoOperativo())

const loading = ref(false)
const errorMsg = ref("")
const okMsg = ref("")
const infoMsg = ref("")

const caja = ref(null)
const saldoActual = ref(0)
const movimientos = ref([])
const cajaOtroTurnoAbierta = ref(null)
const cerrandoOtroCaja = ref(false)

const cajasAtrasadas = ref([])
const cerrandoAtrasada = ref(null)

const otroTurno = computed(() => selectedTurno.value === "MANIANA" ? "TARDE" : "MANIANA")
const metodosPago = ref([])
const metodosLoaded = ref(false)

const productosById = ref(new Map())
const productosLoaded = ref(false)

const clientes = ref([])
const clientesLoaded = ref(false)

const ventaInfoCache = ref({})

const abrirMontoInicial = ref("")
const montoContado = ref("")

const showMovModal = ref(false)
const savingMov = ref(false)

// ✅ FIX: formulario de movimiento manual incluye metodoPagoId
const movForm = ref({
  concepto: "GASTO",
  tipoManual: "EGRESO",
  monto: "",
  descripcion: "",
  metodoPagoId: null,   // ← NUEVO campo obligatorio
})

const confirmState = ref({
  open: false,
  title: "",
  message: "",
  variant: "primary",
  onConfirm: null,
})

function clearMsgs() {
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""
}

function openConfirm({ title, message, variant = "primary", onConfirm }) {
  confirmState.value = { open: true, title, message, variant, onConfirm }
}

function closeConfirm() {
  confirmState.value = { open: false, title: "", message: "", variant: "primary", onConfirm: null }
}

function safeId(x) {
  const n = Number(x ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function normalizeMetodoPago(x) {
  return {
    id: safeId(x?.metodoPagoId ?? x?.id),
    nombre: String(x?.nombre ?? x?.name ?? x?.descripcion ?? "SIN NOMBRE"),
  }
}

async function fetchMetodosPagoOnce() {
  if (metodosLoaded.value) return
  try {
    const { data } = await metodosPagoApi.list()
    const arr = Array.isArray(data) ? data : []
    metodosPago.value = arr.map(normalizeMetodoPago).filter((m) => m.id > 0)
  } catch {
    metodosPago.value = []
  } finally {
    metodosLoaded.value = true
  }
}

function metodoNombreById(id) {
  const mid = safeId(id)
  const m = metodosPago.value.find((x) => Number(x.id) === mid)
  return m?.nombre ?? "-"
}

function unwrapPageLite(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
}

async function fetchProductosOnce() {
  if (productosLoaded.value) return
  try {
    const { data } = await productosApi.list({ page: 0, size: 1000, search: "" })
    const arr = unwrapPageLite(data)
    const map = new Map()
    for (const p of arr) {
      const id = safeId(p?.productoId ?? p?.id)
      if (id) map.set(id, String(p?.nombre ?? `Producto #${id}`))
    }
    productosById.value = map
  } catch {
    productosById.value = new Map()
  } finally {
    productosLoaded.value = true
  }
}

function mapClienteLite(c) {
  return {
    id: safeId(c?.clienteId ?? c?.id),
    nombre: c?.nombre ?? "",
    apellido: c?.apellido ?? "",
    dni: c?.dni ?? null,
  }
}

async function fetchClientesOnce() {
  if (clientesLoaded.value) return
  try {
    const { data } = await clientesApi.list({ page: 0, size: 1000, search: "" })
    const arr = unwrapPageLite(data)
    clientes.value = arr.map(mapClienteLite).filter((c) => c.id > 0)
  } catch {
    clientes.value = []
  } finally {
    clientesLoaded.value = true
  }
}

const clienteById = computed(() => {
  const map = new Map()
  for (const c of clientes.value) map.set(Number(c.id), c)
  return map
})

function clienteTxtById(clienteId) {
  const cid = safeId(clienteId)
  if (!cid) return "Mostrador"
  const c = clienteById.value.get(cid)
  if (!c) return `Cliente #${cid}`
  const full = `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim()
  return full || `Cliente #${cid}`
}

function pickClienteIdFromVenta(venta) {
  const raw =
    venta?.clienteId ??
    venta?.cliente_id ??
    venta?.cliente?.clienteId ??
    venta?.cliente?.id ??
    null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function hydrateVentaInfoFromVentaId(ventaId) {
  const vid = safeId(ventaId)
  if (!vid) return
  if (ventaInfoCache.value[vid]) return

  try {
    const { data } = await ventasApi.porId(vid)
    const venta = data?.venta ?? data?.ventaActualizada ?? data ?? null

    const clienteId = pickClienteIdFromVenta(venta)
    const metodoPagoId = venta?.metodoPagoId ?? venta?.metodo_pago_id ?? null

    // ✅ FIX: detallesVenta está en data (raíz), no dentro de data.venta
    const detalles = data?.detallesVenta ?? data?.detalles ?? venta?.detallesVenta ?? venta?.detalles ?? venta?.items ?? []

    const itemsTxt = Array.isArray(detalles)
      ? detalles
          .map((d) => {
            const cant = Number(d?.cantidad ?? d?.qty ?? 0) || 0
            const pid = safeId(d?.productoId ?? d?.producto_id)
            const nombre =
              d?.productoNombre ??
              d?.producto?.nombre ??
              d?.nombreProducto ??
              productosById.value.get(pid) ??
              (pid ? `Producto #${pid}` : "Producto")
            return cant > 0 ? `${cant}× ${nombre}` : nombre
          })
          .filter(Boolean)
          .slice(0, 2)
          .join(" · ")
      : ""

    ventaInfoCache.value = {
      ...ventaInfoCache.value,
      [vid]: { clienteId, metodoPagoId, itemsTxt },
    }
  } catch {
    ventaInfoCache.value = {
      ...ventaInfoCache.value,
      [vid]: { clienteId: null, metodoPagoId: null, itemsTxt: "" },
    }
  }
}

function pickVentaIdFromMovimiento(m) {
  return safeId(m?.ventaId ?? m?.venta_id ?? 0)
}

function movimientoResumen(m) {
  const concepto = String(m?.concepto ?? "").toUpperCase()
  const ventaId = pickVentaIdFromMovimiento(m)

  if (ventaId) {
    const info = ventaInfoCache.value[ventaId]
    if (info) {
      const cliente = clienteTxtById(info.clienteId)
      const metodo = info.metodoPagoId ? metodoNombreById(info.metodoPagoId) : null
      const items = info.itemsTxt ? ` · ${info.itemsTxt}` : ""
      return [`Venta #${ventaId}`, cliente, metodo].filter(Boolean).join(" · ") + items
    }
    return `Venta #${ventaId}`
  }

  if (m?.descripcion) return m.descripcion
  if (concepto) return concepto.charAt(0) + concepto.slice(1).toLowerCase()
  return "—"
}

async function confirmAccept() {
  const action = confirmState.value.onConfirm
  closeConfirm()
  if (typeof action === "function") await action()
}

function tipoMovimientoParaForm() {
  if (movForm.value.concepto === "AJUSTE") return movForm.value.tipoManual
  return tipoPorConcepto(movForm.value.concepto)
}

const movimientosOrdenados = computed(() => {
  const arr = Array.isArray(movimientos.value) ? [...movimientos.value] : []
  arr.sort((a, b) => {
    const da = new Date(a?.fecha ?? 0).getTime()
    const db = new Date(b?.fecha ?? 0).getTime()
    return db - da
  })
  return arr
})

const ultimosMovs = computed(() => movimientosOrdenados.value.slice(0, 8))

const kpiIngresos = computed(() =>
  movimientosOrdenados.value
    .filter((m) => String(m?.tipo || "").toUpperCase() === "INGRESO")
    .reduce((acc, m) => acc + Number(m?.monto ?? 0), 0)
)

const kpiEgresos = computed(() =>
  movimientosOrdenados.value
    .filter((m) => String(m?.tipo || "").toUpperCase() === "EGRESO")
    .reduce((acc, m) => acc + Number(m?.monto ?? 0), 0)
)

const kpiVentas = computed(() =>
  movimientosOrdenados.value
    .filter((m) => String(m?.concepto || "").toUpperCase() === "VENTA")
    .reduce((acc, m) => acc + Number(m?.monto ?? 0), 0)
)

const kpiPagosProveedor = computed(() =>
  movimientosOrdenados.value
    .filter((m) => String(m?.concepto || "").toUpperCase() === "PAGO_PROVEEDOR")
    .reduce((acc, m) => acc + Number(m?.monto ?? 0), 0)
)

const contadoNum = computed(() => toMoneyNumber(montoContado.value))

const diferencia = computed(() => {
  if (contadoNum.value === null) return null
  return contadoNum.value - Number(saldoActual.value ?? 0)
})

const canAbrir = computed(() => canAbrirCajaPerm.value && !caja.value?.cajaId && !loading.value)
const canCerrar = computed(() => canCerrarCajaPerm.value && !!caja.value?.cajaId && !loading.value)
const puedeRegistrarMovimiento = computed(() => canCrearMovimientoPerm.value && !!caja.value?.cajaId && !loading.value)

const cierreHint = computed(() => {
  if (!caja.value?.cajaId) return "No hay caja abierta en este turno."
  if (isAdmin.value) return "Como administrador, podés cerrar la caja operativa."
  return "Podés seguir operando o cerrar la caja cuando finalice el turno."
})

// ✅ FIX: validación de metodoPagoId requerido para conceptos manuales
const metodoPagoRequerido = computed(() => {
  return ["GASTO", "RETIRO", "APORTE"].includes(movForm.value.concepto)
})

async function loadMovimientos() {
  if (!caja.value?.cajaId) {
    movimientos.value = []
    return
  }

  const { data } = await movimientosCajaApi.porCajaId(caja.value.cajaId, { size: 9999 })
  movimientos.value = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : Array.isArray(data?.items)
        ? data.items
        : []

  await Promise.all([
    fetchMetodosPagoOnce(),
    fetchProductosOnce(),
    fetchClientesOnce(),
  ])

  const ventaIds = movimientos.value
    .map((m) => safeId(m?.ventaId))
    .filter((id) => id > 0)

  await Promise.all(ventaIds.map(hydrateVentaInfoFromVentaId))
}

async function refresh() {
  loading.value = true
  errorMsg.value = ""
  infoMsg.value = ""

  try {
    const { data } = await cajaApi.abierta({ turno: selectedTurno.value })
    caja.value = data ?? null

    if (!caja.value?.cajaId) {
      saldoActual.value = 0
      movimientos.value = []
      infoMsg.value = `No hay caja abierta para el turno ${turnoLabel(selectedTurno.value)}.`
      return
    }

    const { data: saldoDto } = await cajaApi.saldo(caja.value.cajaId)
    saldoActual.value = Number(saldoDto?.saldoActual ?? 0)

    try {
      await loadMovimientos()
    } catch {
      movimientos.value = []
    }
  } catch (e) {
    caja.value = null
    saldoActual.value = 0
    movimientos.value = []

    if (e?.response?.status === 404) {
      infoMsg.value = `No hay caja abierta para el turno ${turnoLabel(selectedTurno.value)}.`
    } else if (e?.response?.status === 403) {
      errorMsg.value = "No tenés permisos para ver Caja."
    } else {
      errorMsg.value = pickError(e, "Error consultando la caja.")
    }
  } finally {
    loading.value = false
  }

  // Verificar si el otro turno tiene una caja abierta (para avisar al usuario)
  try {
    const { data: otraData } = await cajaApi.abierta({ turno: otroTurno.value })
    cajaOtroTurnoAbierta.value = otraData?.cajaId ? otraData : null
  } catch {
    cajaOtroTurnoAbierta.value = null
  }
}

async function cerrarOtraCaja() {
  if (cerrandoOtroCaja.value || !cajaOtroTurnoAbierta.value?.cajaId) return
  openConfirm({
    title: `Cerrar turno ${turnoLabel(otroTurno.value)}`,
    message: `¿Cerrás la caja del turno ${turnoLabel(otroTurno.value)}? Asegurate de que la empleada del turno anterior ya terminó.`,
    variant: "warning",
    onConfirm: async () => {
      cerrandoOtroCaja.value = true
      try {
        await cajaApi.cerrar(cajaOtroTurnoAbierta.value.cajaId, {})
        cajaOtroTurnoAbierta.value = null
        okMsg.value = `Caja del turno ${turnoLabel(otroTurno.value)} cerrada correctamente.`
      } catch (e) {
        errorMsg.value = pickError(e, `Error cerrando caja del turno ${turnoLabel(otroTurno.value)}.`)
      } finally {
        cerrandoOtroCaja.value = false
      }
    }
  })
}

async function fetchCajasAtrasadas() {
  try {
    const { data } = await cajaApi.atrasadas()
    cajasAtrasadas.value = Array.isArray(data) ? data : []
  } catch {
    cajasAtrasadas.value = []
  }
}

async function cerrarCajaAtrasada(cajaAtrasada) {
  if (cerrandoAtrasada.value === cajaAtrasada.cajaId) return
  openConfirm({
    title: `Cerrar caja ${turnoLabel(cajaAtrasada.turno)} del ${formatDate(cajaAtrasada.fecha)}`,
    message: `¿Cerrás la caja que quedó abierta del turno ${turnoLabel(cajaAtrasada.turno)} del ${formatDate(cajaAtrasada.fecha)}?`,
    variant: "warning",
    onConfirm: async () => {
      cerrandoAtrasada.value = cajaAtrasada.cajaId
      try {
        await cajaApi.cerrar(cajaAtrasada.cajaId, {})
        cajasAtrasadas.value = cajasAtrasadas.value.filter(c => c.cajaId !== cajaAtrasada.cajaId)
        okMsg.value = `Caja ${turnoLabel(cajaAtrasada.turno)} del ${formatDate(cajaAtrasada.fecha)} cerrada correctamente.`
      } catch (e) {
        errorMsg.value = pickError(e, "Error cerrando caja atrasada.")
      } finally {
        cerrandoAtrasada.value = null
      }
    }
  })
}

async function abrirCajaConfirmed(monto) {
  try {
    await cajaApi.abrir({ turno: selectedTurno.value, montoInicial: monto ?? 0 })
    okMsg.value = "Caja abierta correctamente."
    abrirMontoInicial.value = ""
    emitCajaChanged()
    await refresh()
  } catch (e) {
    errorMsg.value = pickError(e, "Error abriendo caja.")
  }
}

function abrirCaja() {
  clearMsgs()
  const monto = toMoneyNumber(abrirMontoInicial.value)

  if (monto === null) {
    openConfirm({
      title: "Abrir caja sin saldo inicial",
      message: "Vas a crear una caja sin monto inicial. ¿Querés continuar?",
      variant: "warning",
      onConfirm: () => abrirCajaConfirmed(0),
    })
    return
  }

  if (!Number.isFinite(monto) || monto < 0) {
    errorMsg.value = "Ingresá un monto inicial válido."
    return
  }

  openConfirm({
    title: "Confirmar apertura de caja",
    message: `Se abrirá la caja del turno ${turnoLabel(selectedTurno.value)} con un monto inicial de $ ${formatMoney(monto)}.`,
    variant: "primary",
    onConfirm: () => abrirCajaConfirmed(monto),
  })
}

async function cerrarCajaConfirmed() {
  try {
    await cajaApi.cerrar(caja.value.cajaId, {
      observacion: "Cierre de caja",
      montoContado: Number.isFinite(contadoNum.value) ? contadoNum.value : null,
    })
    okMsg.value = "Caja cerrada correctamente."
    montoContado.value = ""
    emitCajaChanged()
    await refresh()
  } catch (e) {
    errorMsg.value = pickError(e, "Error cerrando caja.")
  }
}

function cerrarCaja() {
  clearMsgs()
  if (!caja.value?.cajaId) {
    errorMsg.value = "No hay caja abierta para cerrar."
    return
  }
  openConfirm({
    title: "Cerrar caja",
    message: "¿Seguro querés cerrar la caja? Una vez cerrada, no podrás volver a abrirla en este turno.",
    variant: "danger",
    onConfirm: cerrarCajaConfirmed,
  })
}

// ── Retiro Admin ─────────────────────────────────────────────────────────────
const showRetiroAdmin  = ref(false)
const savingRetiro     = ref(false)
const retiroAdminError = ref("")
const retiroForm       = ref({ monto: "", descripcion: "", metodoPagoId: null })

function cerrarRetiroAdmin() {
  if (savingRetiro.value) return
  retiroForm.value = { monto: "", descripcion: "", metodoPagoId: null }
  retiroAdminError.value = ""
  showRetiroAdmin.value = false
}

async function confirmarRetiroAdmin() {
  if (savingRetiro.value) return   // guard doble click
  retiroAdminError.value = ""
  const monto = toMoneyNumber(retiroForm.value.monto)
  if (!Number.isFinite(monto) || monto <= 0) {
    retiroAdminError.value = "Ingresá un monto válido mayor a 0."
    return
  }
  if (!retiroForm.value.metodoPagoId) {
    retiroAdminError.value = "Seleccioná un método de pago."
    return
  }
  savingRetiro.value = true
  try {
    await cajaApi.retiroAdmin({
      monto,
      descripcion: retiroForm.value.descripcion?.trim() || null,
      metodoPagoId: Number(retiroForm.value.metodoPagoId),
    })
    okMsg.value = `Retiro de $${monto.toLocaleString("es-AR")} registrado correctamente.`
    cerrarRetiroAdmin()
    await refresh()
  } catch (e) {
    retiroAdminError.value = pickError(e, "Error registrando el retiro.")
  } finally {
    savingRetiro.value = false
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ✅ FIX: crearMovimientoManual ahora valida y envía metodoPagoId
async function crearMovimientoManual() {
  if (savingMov.value) return   // guard doble click
  clearMsgs()
  if (!caja.value?.cajaId) { errorMsg.value = "Abrí una caja primero."; return }

  const monto = toMoneyNumber(movForm.value.monto)
  if (!Number.isFinite(monto) || monto <= 0) { errorMsg.value = "Monto inválido."; return }

  // ✅ FIX: validar que se seleccionó método de pago para conceptos que lo requieren
  if (metodoPagoRequerido.value && !movForm.value.metodoPagoId) {
    errorMsg.value = "Seleccioná un método de pago."
    return
  }

  savingMov.value = true
  try {
    await movimientosCajaApi.crear({
      cajaId: caja.value.cajaId,
      tipo: tipoMovimientoParaForm(),
      concepto: movForm.value.concepto,
      descripcion: movForm.value.descripcion?.trim() || null,
      monto,
      // ✅ FIX: se envía el metodoPagoId al backend
      metodoPagoId: movForm.value.metodoPagoId ? Number(movForm.value.metodoPagoId) : null,
    })
    okMsg.value = "Movimiento registrado correctamente."
    movForm.value = { concepto: "GASTO", tipoManual: "EGRESO", monto: "", descripcion: "", metodoPagoId: null }
    showMovModal.value = false
    emitCajaChanged()
    await refresh()
  } catch (e) {
    errorMsg.value = pickError(e, "Error registrando movimiento.")
  } finally {
    savingMov.value = false
  }
}

function cerrarMovModal() {
  if (savingMov.value) return
  movForm.value = { concepto: "GASTO", tipoManual: "EGRESO", monto: "", descripcion: "", metodoPagoId: null }
  showMovModal.value = false
}

watch(selectedTurno, async (v) => {
  setTurnoOperativo(v)
  await refresh()
})

onMounted(async () => {
  selectedTurno.value = getTurnoOperativo()
  if (canViewCaja.value) {
    await fetchMetodosPagoOnce()
    await refresh()
    fetchCajasAtrasadas()
  } else {
    errorMsg.value = "No tenés permisos para acceder a Caja."
  }
})
</script>

<template>
  <div class="caja-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Operación</p>
        <h1 class="page-title mb-1">Caja</h1>
        <p class="page-subtitle mb-0">
          Gestión operativa del turno, apertura, arqueo y últimos movimientos.
        </p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="refresh" :disabled="loading || !canViewCaja">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>
        <RouterLink class="btn btn-outline-light" to="/caja/movimientos">Movimientos</RouterLink>
        <RouterLink class="btn btn-outline-light" to="/compras">Compras</RouterLink>
        <!-- Retiro admin: visible solo para ADMIN, sin necesidad de caja abierta -->
        <button
          v-if="isAdmin"
          class="btn btn-outline-light"
          @click="showRetiroAdmin = true"
        >
          Retiro
        </button>
        <RouterLink class="btn btn-primary btn-accent" to="/ventas">Ventas</RouterLink>
      </div>
    </section>

    <!-- Aviso: el otro turno tiene una caja sin cerrar -->
    <div v-if="cajaOtroTurnoAbierta" class="alert-caja-pendiente mb-3 d-flex align-items-center justify-content-between gap-3 flex-wrap">
      <div>
        <strong>¡Espera!</strong> Quedó la caja del turno <strong>{{ turnoLabel(otroTurno) }}</strong> abierta.
        Cerrala antes de abrir la de este turno.
      </div>
      <button
        v-if="canCerrarCajaPerm"
        class="btn btn-sm btn-warning flex-shrink-0"
        @click="cerrarOtraCaja"
        :disabled="cerrandoOtroCaja"
      >
        {{ cerrandoOtroCaja ? "Cerrando..." : `Cerrar turno ${turnoLabel(otroTurno)}` }}
      </button>
    </div>

    <!-- Aviso: cajas de días anteriores sin cerrar -->
    <div
      v-for="cajaAtrasada in cajasAtrasadas"
      :key="cajaAtrasada.cajaId"
      class="alert-caja-pendiente mb-3 d-flex align-items-center justify-content-between gap-3 flex-wrap"
    >
      <div>
        <strong>⚠️ Caja sin cerrar:</strong> quedó abierta la caja
        <strong>{{ turnoLabel(cajaAtrasada.turno) }}</strong> del
        <strong>{{ formatDate(cajaAtrasada.fecha) }}</strong>.
      </div>
      <button
        v-if="canCerrarCajaPerm"
        class="btn btn-sm btn-warning flex-shrink-0"
        @click="cerrarCajaAtrasada(cajaAtrasada)"
        :disabled="cerrandoAtrasada === cajaAtrasada.cajaId"
      >
        {{ cerrandoAtrasada === cajaAtrasada.cajaId ? "Cerrando..." : `Cerrar caja del ${formatDate(cajaAtrasada.fecha)}` }}
      </button>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-12">
        <div class="card bg-panel border-0 shadow-sm">
          <div class="card-body">
            <div class="row g-3 align-items-center">
              <div class="col-12 col-md-4 col-lg-3">
                <label class="form-label field-label">Turno operativo</label>
                <select
                  v-model="selectedTurno"
                  class="form-select app-input"
                  :disabled="Boolean(caja?.cajaId) || loading"
                >
                  <option value="MANIANA">MAÑANA</option>
                  <option value="TARDE">TARDE</option>
                </select>
                <div v-if="caja?.cajaId" class="helper-text mt-2">
                  El turno queda bloqueado mientras la caja esté abierta.
                </div>
              </div>

              <div class="col-12 col-md">
                <div class="status-summary-card">
                  <div class="status-summary-icon">
                    <span class="status-dot" :class="{ active: !!caja?.cajaId }"></span>
                  </div>
                  <div class="status-summary-content">
                    <div class="field-label mb-1">Estado actual</div>
                    <div class="status-summary-title">
                      {{ caja?.cajaId ? "Caja abierta" : "Sin caja abierta" }}
                    </div>
                    <div class="status-summary-subtitle">
                      {{ caja?.cajaId ? `Turno ${turnoLabel(caja.turno)}` : `Turno ${turnoLabel(selectedTurno)}` }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="col-12 col-lg-auto">
                <div v-if="errorMsg" class="alert alert-danger py-2 mb-0">{{ errorMsg }}</div>
                <div v-else-if="okMsg" class="alert alert-success py-2 mb-0">{{ okMsg }}</div>
                <div v-else-if="infoMsg" class="alert alert-secondary py-2 mb-0">{{ infoMsg }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-4">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="section-header mb-3">
              <h2 class="section-title mb-0">Estado de caja</h2>
            </div>

            <template v-if="caja?.cajaId">
              <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                <span class="badge badge-soft-success">ABIERTA</span>
                <span class="badge badge-soft-neutral">Turno {{ turnoLabel(caja.turno) }}</span>
              </div>

              <div class="info-list">
                <div class="info-row">
                  <span>Apertura</span>
                  <strong>{{ caja.apertura ? formatDateTime(caja.apertura) : "—" }}</strong>
                </div>
                <div class="info-row">
                  <span>Monto inicial</span>
                  <strong>$ {{ formatMoney(caja.montoInicial) }}</strong>
                </div>
                <div class="info-row">
                  <span>Saldo actual</span>
                  <strong>$ {{ formatMoney(saldoActual) }}</strong>
                </div>
              </div>

              <div class="helper-text mt-3">{{ cierreHint }}</div>
            </template>

            <template v-else>
              <div class="empty-caja">
                <div class="empty-caja__title">Sin caja abierta</div>
                <div class="helper-text mt-1">
                  Ingresá el monto inicial y abrí la caja del turno {{ turnoLabel(selectedTurno) }}.
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-8">
        <div class="card bg-panel border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="section-header mb-3">
              <h2 class="section-title mb-0">Resumen del turno</h2>
              <div class="helper-text">Totales calculados a partir de los movimientos registrados</div>
            </div>

            <div class="row g-2">
              <div class="col-6 col-md-3">
                <div class="kpi-card kpi-card--success">
                  <div class="kpi-label">Ingresos</div>
                  <div class="kpi-value" style="color:#5cb88a">$ {{ formatMoney(kpiIngresos) }}</div>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="kpi-card kpi-card--danger">
                  <div class="kpi-label">Egresos</div>
                  <div class="kpi-value" style="color:#e87070">$ {{ formatMoney(kpiEgresos) }}</div>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="kpi-card kpi-card--accent">
                  <div class="kpi-label">Ventas</div>
                  <div class="kpi-value">$ {{ formatMoney(kpiVentas) }}</div>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="kpi-card kpi-card--neutral">
                  <div class="kpi-label">Pagos proveedor</div>
                  <div class="kpi-value">$ {{ formatMoney(kpiPagosProveedor) }}</div>
                </div>
              </div>
            </div>

            <hr class="border-secondary my-4" />

            <div class="row g-4 align-items-start">
              <!-- MONTO INICIAL -->
              <div class="col-12 col-md-6">
                <template v-if="!caja?.cajaId">
                  <label class="form-label field-label">Monto inicial</label>
                  <input
                    v-model="abrirMontoInicial"
                    class="form-control app-input"
                    placeholder="Ej: 20000"
                    inputmode="numeric"
                    :disabled="loading || !canAbrirCajaPerm"
                  />
                  <button class="btn btn-primary btn-accent w-100 mt-3" @click="abrirCaja" :disabled="!canAbrir">
                    Abrir caja
                  </button>
                  <div class="helper-text mt-2">Se abrirá una única caja para el turno seleccionado.</div>
                </template>

                <template v-else>
                  <label class="form-label field-label">Caja operativa</label>
                  <div class="static-field">Caja abierta en turno {{ turnoLabel(caja.turno) }}</div>
                  <div class="helper-text mt-2">La apertura ya fue realizada. Podés seguir operando normalmente.</div>
                </template>
              </div>

              <!-- CIERRE Y ARQUEO -->
              <div class="col-12 col-md-6 cierre-section">
                <label class="form-label field-label">Cierre y arqueo</label>

                <div class="info-row">
                  <span class="helper-text">Esperado</span>
                  <strong>$ {{ formatMoney(saldoActual) }}</strong>
                </div>

                <input
                  v-model="montoContado"
                  class="form-control app-input mt-2"
                  placeholder="Contado final (opcional)"
                  inputmode="numeric"
                  :disabled="loading || !caja?.cajaId || !canCerrarCajaPerm"
                />

                <div class="info-row mt-2">
                  <span class="helper-text">Diferencia</span>
                  <strong
                    v-if="diferencia !== null"
                    :class="diferencia === 0 ? 'text-success' : diferencia > 0 ? 'text-success' : 'text-danger'"
                  >
                    {{ diferencia > 0 ? "+" : "" }}$ {{ formatMoney(diferencia) }}
                  </strong>
                  <span v-else class="helper-text">—</span>
                </div>

                <button class="btn btn-outline-light w-100 mt-3" @click="cerrarCaja" :disabled="!canCerrar">
                  Cerrar caja
                </button>
                <div class="helper-text mt-2">
                  Si el sistema registra el arqueo, el monto contado se usa para calcular la diferencia al cierre.
                </div>
              </div>
            </div>

            <div class="d-flex gap-2 mt-4 flex-wrap">
              <button
                class="btn btn-sm btn-primary btn-accent"
                :disabled="!puedeRegistrarMovimiento"
                @click="showMovModal = true"
              >
                + Movimiento manual
              </button>

              <RouterLink
                class="btn btn-sm btn-outline-light"
                :class="{ disabled: !caja?.cajaId }"
                to="/caja/movimientos-historico"
              >
                Ver historial completo
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Últimos movimientos -->
    <div v-if="caja?.cajaId && ultimosMovs.length" class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Últimos movimientos</h2>
          <div class="helper-text">Los 8 más recientes del turno actual</div>
        </div>

        <div class="table-responsive">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th style="width: 160px">Hora</th>
                <th style="width: 110px">Tipo</th>
                <th>Descripción</th>
                <th style="width: 160px" class="text-end">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in ultimosMovs" :key="m.movimientoCajaId ?? m.fecha">
                <td class="text-secondary">{{ formatDateTime(m.fecha) }}</td>
                <td>
                  <span class="badge" :class="badgeTipoClass(m.tipo)">
                    {{ String(m.tipo || "").toUpperCase() }}
                  </span>
                </td>
                <td class="text-secondary">{{ movimientoResumen(m) }}</td>
                <td class="text-end td-num fw-bold">$ {{ formatMoney(m.monto) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Retiro Admin — sin necesidad de caja abierta -->
    <div v-if="showRetiroAdmin" class="modal-backdrop" @click.self="!savingRetiro && cerrarRetiroAdmin()">
      <div class="modal-card">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div class="section-title">Retiro administrativo</div>
            <div class="helper-text">Se registra en la última caja. No requiere caja abierta.</div>
          </div>
          <button class="btn btn-sm btn-outline-light" @click="cerrarRetiroAdmin" :disabled="savingRetiro">Cerrar</button>
        </div>

        <div class="row g-3">
          <div class="col-12">
            <label class="form-label field-label">Método de pago <span class="text-danger">*</span></label>
            <select v-model="retiroForm.metodoPagoId" class="form-select app-input">
              <option :value="null">— Seleccioná un método —</option>
              <option v-for="mp in metodosPago" :key="mp.id" :value="mp.id">{{ mp.nombre }}</option>
            </select>
          </div>

          <div class="col-12">
            <label class="form-label field-label">Monto <span class="text-danger">*</span></label>
            <input v-model="retiroForm.monto" class="form-control app-input" inputmode="numeric" placeholder="0" />
          </div>

          <div class="col-12">
            <label class="form-label field-label">Descripción</label>
            <input v-model="retiroForm.descripcion" class="form-control app-input" placeholder="Ej: Retiro nocturno 27/05" />
          </div>
        </div>

        <div v-if="retiroAdminError" class="alert alert-danger py-2 mt-3 mb-0">{{ retiroAdminError }}</div>

        <button
          class="btn btn-primary btn-accent w-100 mt-4 fw-bold"
          @click="confirmarRetiroAdmin"
          :disabled="savingRetiro"
        >
          {{ savingRetiro ? "Registrando..." : "Confirmar retiro" }}
        </button>
      </div>
    </div>

    <!-- ✅ FIX: Modal movimiento manual con campo Método de Pago -->
    <div v-if="showMovModal" class="modal-backdrop" @click.self="!savingMov && cerrarMovModal()">
      <div class="modal-card">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div class="section-title">Nuevo movimiento manual</div>
            <div class="helper-text">Registrá un ajuste operativo de caja</div>
          </div>
          <button class="btn btn-sm btn-outline-light" @click="cerrarMovModal" :disabled="savingMov">Cerrar</button>
        </div>

        <div class="row g-3">
          <div class="col-12">
            <label class="form-label field-label">Concepto</label>
            <select v-model="movForm.concepto" class="form-select app-input">
              <option value="GASTO">GASTO</option>
              <option value="RETIRO">RETIRO</option>
              <option value="APORTE">APORTE</option>
              <option value="AJUSTE">AJUSTE</option>
            </select>
            <div class="helper-text mt-2">
              VENTA y PAGO_PROVEEDOR se generan automáticamente desde sus módulos.
            </div>
          </div>

          <div class="col-12" v-if="movForm.concepto === 'AJUSTE'">
            <label class="form-label field-label">Tipo de ajuste</label>
            <select v-model="movForm.tipoManual" class="form-select app-input">
              <option value="INGRESO">INGRESO</option>
              <option value="EGRESO">EGRESO</option>
            </select>
          </div>

          <!-- ✅ FIX: Campo Método de Pago — obligatorio para GASTO, RETIRO y APORTE -->
          <div class="col-12">
            <label class="form-label field-label">
              Método de pago
              <span v-if="metodoPagoRequerido" class="text-danger ms-1">*</span>
            </label>
            <select v-model="movForm.metodoPagoId" class="form-select app-input">
              <option :value="null">— Seleccioná un método —</option>
              <option v-for="mp in metodosPago" :key="mp.id" :value="mp.id">
                {{ mp.nombre }}
              </option>
            </select>
            <div v-if="metodoPagoRequerido" class="helper-text mt-1 text-danger-soft">
              Requerido para {{ movForm.concepto }}.
            </div>
          </div>

          <div class="col-12">
            <label class="form-label field-label">Monto</label>
            <input v-model="movForm.monto" class="form-control app-input" inputmode="numeric" />
          </div>

          <div class="col-12">
            <label class="form-label field-label">Descripción</label>
            <input v-model="movForm.descripcion" class="form-control app-input" placeholder="Detalle opcional" />
          </div>
        </div>

        <button class="btn btn-primary btn-accent w-100 mt-4" @click="crearMovimientoManual">
          Guardar movimiento
        </button>
      </div>
    </div>

    <!-- Confirm dialog -->
    <div v-if="confirmState.open" class="modal-backdrop">
      <div class="confirm-card">
        <div class="confirm-icon" :class="`confirm-icon--${confirmState.variant}`">
          <span v-if="confirmState.variant === 'danger'">!</span>
          <span v-else-if="confirmState.variant === 'warning'">!</span>
          <span v-else>✓</span>
        </div>
        <div class="confirm-title">{{ confirmState.title }}</div>
        <div class="confirm-text">{{ confirmState.message }}</div>
        <div class="confirm-actions">
          <button class="btn btn-outline-light" @click="closeConfirm">Cancelar</button>
          <button
            class="btn"
            :class="{
              'btn-confirm-primary': confirmState.variant === 'primary',
              'btn-confirm-danger': confirmState.variant === 'danger',
              'btn-confirm-warning': confirmState.variant === 'warning',
            }"
            @click="confirmAccept"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.caja-page { min-height: 100%; }

/* Cierre y arqueo: label y valor pegados, sin space-between */
.cierre-section .info-row {
  display: flex !important;
  justify-content: flex-start !important;
  gap: 10px;
}
.cierre-section .info-row strong {
  margin-left: 0;
  text-align: left;
}

.alert-caja-pendiente {
  background: rgba(255, 193, 7, 0.08);
  border: 1px solid rgba(255, 193, 7, 0.25);
  border-left: 3px solid rgba(255, 193, 7, 0.65);
  border-radius: 4px;
  padding: 12px 16px;
  color: #ffe082;
  font-size: 0.9rem;
}

.status-summary-card {
  min-height: 76px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 6px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.08);
}

.status-summary-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-summary-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.status-summary-title {
  color: #fff;
  font-weight: 800;
  font-size: 1.05rem;
  line-height: 1.1;
}

.status-summary-subtitle {
  color: rgba(255,255,255,.68);
  font-size: .92rem;
  margin-top: 2px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: rgba(255,255,255,.25);
  box-shadow: 0 0 0 6px rgba(255,255,255,.04);
}

.status-dot.active {
  background: #27d17f;
}

.text-danger-soft {
  color: rgba(255, 100, 100, 0.85);
}

.empty-caja {
  padding: 8px 0 4px;
}

.empty-caja__title {
  color: rgba(255, 255, 255, 0.75);
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 4px;
}
</style>