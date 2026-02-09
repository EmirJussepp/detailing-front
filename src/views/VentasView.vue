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
const userId = session?.userId ?? null

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const fecha = ref(todayISO())
const turnoSel = ref(admin.value ? "MAÑANA" : (getShift() ?? "MAÑANA"))

const errorMsg = ref("")
const okMsg = ref("")

const paymentMethod = ref("EFECTIVO")
const notes = ref("")

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
  return name.includes("MAYOR") // MAYORISTA
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

const ventas = ref([]) // sin GET por turno (todavía)
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
// Refresh (todo backend)
// =========================
async function refresh() {
  okMsg.value = ""
  errorMsg.value = ""

  await fetchTiposCliente()

  // 1) Caja abierta
  try {
    const { data } = await cajaApi.abierta()
    cajaAbierta.value = data
    cajaCheck.value = { ok: true, error: "" }
  } catch (e) {
    cajaAbierta.value = null
    cajaCheck.value = { ok: false, error: "No hay caja ABIERTA (backend)." }
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
      activo: true
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

  // 4) Ventas (vacío por ahora)
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
      // no rompemos la vista
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

  // UX stock
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
  const p = it0 ? productos.value.find(p => Number(p.id) === Number(it0.productId)) : null
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
  paymentMethod.value = "EFECTIVO"
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
      userId: Number.isFinite(Number(userId)) ? Number(userId) : null,
      clienteId: clienteSel.value?.id ? Number(clienteSel.value.id) : null,
      detallesVenta,
    }

    const { data } = await ventasApi.create(command)

    const ventaId = data?.venta?.ventaId ?? data?.ventaId ?? null
    const total = data?.venta?.total ?? data?.total ?? totalCalc.value

    lastTicket.value = data

    okMsg.value = ventaId
      ? `Venta #${ventaId} registrada ✅ Total: $ ${formatMoney(total)}`
      : `Venta registrada ✅ Total: $ ${formatMoney(total)}`

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
                <select v-model="clienteSelId" class="form-select bg-dark text-white border-secondary" :disabled="!canSell">
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
            <div class="text-secondary small">
              Tip: el descuento real lo ponés por producto.
            </div>
          </div>
        </div>

        <!-- Agregar producto -->
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Producto</label>
            <select v-model="selProductoId" class="form-select bg-dark text-white border-secondary" :disabled="!canSell || productos.length === 0">
              <option value="" disabled>Seleccionar…</option>
              <option v-for="p in productos" :key="p.id" :value="String(p.id)">
  {{ p.nombre }} — $ {{ formatMoney(getPrecioSugerido(p)) }}{{
    tipoClienteBadge === 'MAYORISTA' && p.precioMayorista != null ? ' (mayorista)' : ''
  }}
</option>


            </select>
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">Cant.</label>
            <input v-model="itemQty" class="form-control bg-dark text-white border-secondary" inputmode="numeric" :disabled="!canSell || !selProductoId" />
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">Desc %</label>
            <input v-model="itemDiscountPct" class="form-control bg-dark text-white border-secondary" inputmode="numeric" :disabled="!canSell || !selProductoId" />
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
                <th style="width: 120px;">Precio</th>
                <th style="width: 90px;">Cant.</th>
                <th style="width: 110px;">Desc %</th>
                <th style="width: 180px;">Unit. final</th>
                <th style="width: 150px;">Subtotal</th>
                <th style="width: 120px;" class="text-end">Acciones</th>
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

        <div class="text-secondary mt-3" v-else>
          Agregá productos para armar la venta.
        </div>

        <div v-if="hasInvalidItems" class="alert alert-danger py-2 mt-3 mb-0">
          Hay ítems a pérdida. Ajustá el descuento para poder registrar la venta.
        </div>

        <!-- Totales -->
        <div class="row g-3 mt-3">
          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Método de pago</label>
            <select v-model="paymentMethod" class="form-select bg-dark text-white border-secondary" :disabled="!canSell">
              <option value="EFECTIVO">EFECTIVO</option>
              <option value="TRANSFERENCIA">TRANSFERENCIA</option>
              <option value="DEBITO">DÉBITO</option>
              <option value="CREDITO">CRÉDITO</option>
            </select>
          </div>

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
          ✅ Cliente opcional · ✅ Descuento por producto · ✅ Caja + POST venta · ✅ Total real lo define el backend
        </div>
      </div>
    </div>

    <!-- ÚLTIMA VENTA (respuesta backend) -->
    <div class="card bg-dark border-secondary mb-4" v-if="lastTicket">
      <div class="card-body">
        <h2 class="h6 mb-2">Última venta (backend)</h2>
        <div class="text-secondary small" v-if="lastTicket?.venta">
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
  </div>
</template>

<style scoped>
.bg-panel{ background: rgba(18, 22, 32, .92); }
.btn-accent{ background: #6f5cff; border: none; }
.btn-accent:hover{ background: #5f4de6; }
</style>
