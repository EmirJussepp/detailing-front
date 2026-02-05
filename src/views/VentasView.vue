<!-- src/views/VentasView.vue -->
<script setup>
import { computed, ref, watch } from "vue"
import { getSession, isAdmin, getShift } from "../auth/session"

import { cajaApi } from "../services/cajaApi"
import { ventasApi } from "../services/ventasApi"
import { movimientosCajaApi } from "../services/movimientosCajaApi"
import { productosApi } from "../services/productosApi"
import { clientesApi } from "../services/clientesApi"

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

function mapMetodoPago(pm) {
  // Ajustá si tus IDs reales son otros
  if (pm === "EFECTIVO") return 1
  if (pm === "TRANSFERENCIA") return 2
  if (pm === "DEBITO") return 3
  if (pm === "CREDITO") return 4
  return 1
}

// =========================
// Estado principal
// =========================
const cajaCheck = ref({ ok: false, error: "" })
const cajaAbierta = ref(null)

const movimientosCaja = ref([])
const resumenCaja = ref({ ingresos: 0, egresos: 0, saldo: 0 })

const ventas = ref([]) // (por ahora sin GET por turno)
const productos = ref([])
const clientes = ref([])

const clienteSelId = ref("")
const clienteSel = computed(() =>
  clientes.value.find(c => String(c.id) === String(clienteSelId.value)) ?? null
)

const canSell = computed(() => cajaCheck.value?.ok === true)

// =========================
// Refresh (todo backend)
// =========================
async function refresh() {
  okMsg.value = ""
  errorMsg.value = ""

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
      stockActual: p.stockActual == null ? null : Number(p.stockActual), // si el backend lo devuelve
      activo: true
    }))
  } catch (e) {
    productos.value = []
    errorMsg.value = e?.response?.data?.error || e?.message || "Error cargando productos (backend)."
  }

  // 3) Clientes
  try {
    const { data } = await clientesApi.list()
    const arr = Array.isArray(data) ? data : []
    clientes.value = arr.map(c => ({
      id: Number(c.clienteId ?? c.id),
      nombre: c.nombre,
      tipoClienteId: c.tipoClienteId ?? null,
      activo: c.activo ?? true,
      descuentoPct: c.descuentoPct ?? 0
    })).filter(c => c.activo !== false)
  } catch (e) {
    // Si todavía no tenés endpoint, dejalo vacío sin romper
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
      // no rompemos la vista si falla
    }
  }
}

watch([fecha, turnoSel, admin], () => { refresh() }, { immediate: true })

// =========================
// Items (productos) con descuento por línea
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

  const discountPct = clamp(String(itemDiscountPct.value).replace(",", "."), 0, 100)

  const base = {
    id: ensureUUID(),
    productId: Number(p.id),
    name: p.nombre,
    price: Number(p.precioVenta ?? 0),
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
// Totales
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

    // Payload que espera tu backend
    const detallesVenta = items.value.map(i => ({
      productoId: Number(i.productId),
      cantidad: Number(i.qty),
    }))

    if (detallesVenta.some(d => !Number.isInteger(d.productoId) || d.productoId <= 0)) {
      errorMsg.value = "Hay un producto inválido en el detalle (productoId vacío)."
      return
    }
    if (detallesVenta.some(d => !Number.isInteger(d.cantidad) || d.cantidad <= 0)) {
      errorMsg.value = "Hay una cantidad inválida en el detalle."
      return
    }

    const command = {
      cajaId: Number(cajaAbierta.value.cajaId),
      userId: Number.isFinite(Number(userId)) ? Number(userId) : null,
      clienteId: clienteSel.value?.id ? Number(clienteSel.value.id) : null,
      detallesVenta,
    }

    console.log("PAYLOAD /ventas", JSON.stringify(command, null, 2))

    const { data } = await ventasApi.create(command)

    okMsg.value = `Venta registrada ✅ (backend id: ${data?.ventaId ?? "OK"})`
    clearForm()
    await refresh()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data ||
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

        <!-- Cliente -->
        <div class="row g-3 mb-3">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Cliente (opcional)</label>
            <select
              v-model="clienteSelId"
              class="form-select bg-dark text-white border-secondary"
              :disabled="!canSell || clientes.length === 0"
            >
              <option value="">Sin cliente</option>
              <option v-for="c in clientes" :key="c.id" :value="String(c.id)">
                {{ c.nombre }}
              </option>
            </select>
          </div>

          <div class="col-12 col-md-6 d-flex align-items-end">
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
                {{ p.nombre }} — $ {{ formatMoney(p.precioVenta) }}
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
            Subtotal: <b>$ {{ formatMoney(subtotalBase) }}</b> ·
            Descuento: <b>$ {{ formatMoney(descuentoTotal) }}</b> ·
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
          ✅ Cliente opcional · ✅ Descuento por producto · ✅ Caja + POST venta
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
