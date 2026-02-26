<template>
  <div class="container py-4">
    <!-- Header -->
    <div class="d-flex flex-wrap gap-2 align-items-end justify-content-between mb-3">
      <div>
        <h2 class="mb-1">Compras</h2>
        <div class="text-secondary small">
          Crear compra · ver detalle · registrar pagos a proveedor.
        </div>
      </div>

      <div class="d-flex gap-2">
        <button class="btn btn-outline-light" @click="refreshAll" :disabled="loading">
          {{ loading ? "Actualizando..." : "Refresh" }}
        </button>

        <button
          class="btn btn-accent"
          data-bs-toggle="modal"
          data-bs-target="#compraModal"
          @click="prepareCreate"
        >
          + Nueva compra
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="success" class="alert alert-success py-2">{{ success }}</div>

    <!-- Listado -->
    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
          <div class="d-flex gap-2 align-items-center">
            <input
              v-model="q"
              class="form-control form-control-sm"
              style="min-width: 260px"
              placeholder="Buscar por proveedor / id"
            />
          </div>

          <div class="text-secondary small">
            Total compras: <b>{{ comprasFiltradas.length }}</b>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table table-dark table-hover align-middle">
            <thead>
              <tr>
                <th style="width: 90px">ID</th>
                <th>Proveedor</th>
                <th style="width: 140px">Fecha</th>
                <th style="width: 140px" class="text-end">Total</th>
                <th style="width: 120px">Estado</th>
                <th style="width: 160px"></th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="c in comprasFiltradas" :key="c.compraId">
                <td class="text-secondary">#{{ c.compraId }}</td>
                <td>{{ proveedorName(c.proveedorId) }}</td>
                <td class="text-secondary">{{ (c.fecha || "").slice(0, 10) }}</td>
                <td class="text-end">{{ formatMoney(c.total) }}</td>
                <td>
                  <span class="badge text-bg-dark border border-secondary">{{ c.estado }}</span>
                </td>
                <td class="text-end">
                  <button
                    class="btn btn-sm btn-outline-light me-2"
                    data-bs-toggle="modal"
                    data-bs-target="#detalleModal"
                    @click="openDetalle(c.compraId)"
                  >
                    Ver
                  </button>

                  <button
                    class="btn btn-sm btn-accent"
                    data-bs-toggle="modal"
                    data-bs-target="#pagoModal"
                    @click="preparePago(c.compraId)"
                  >
                    Pagar
                  </button>
                </td>
              </tr>

              <tr v-if="!comprasFiltradas.length">
                <td colspan="6" class="text-secondary">Sin compras.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- MODAL: Nueva compra -->
    <div class="modal fade" id="compraModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">Nueva compra</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div class="row g-2">
              <div class="col-md-8">
                <label class="form-label small text-secondary">Proveedor</label>
                <select v-model.number="form.proveedorId" class="form-select">
                  <option :value="null">Seleccionar...</option>
                  <option v-for="p in proveedores" :key="p.proveedorId" :value="p.proveedorId">
                    {{ p.displayName }}
                  </option>
                </select>
              </div>

              <div class="col-md-4">
                <label class="form-label small text-secondary">Fecha</label>
                <input v-model="form.fecha" type="date" class="form-control" />
              </div>
            </div>

            <hr class="border-secondary my-3" />

            <div class="d-flex align-items-center justify-content-between">
              <h6 class="mb-2">Ítems</h6>
              <span class="text-secondary small"
                >Total: <b>{{ formatMoney(totalDraft) }}</b></span
              >
            </div>

            <div class="row g-2 align-items-end">
              <div class="col-md-6">
                <label class="form-label small text-secondary">Producto</label>
                <select v-model.number="itemDraft.productoId" class="form-select">
                  <option :value="null">Seleccionar...</option>
                  <option v-for="p in productos" :key="p.productoId" :value="p.productoId">
                    {{ p.nombre }}
                  </option>
                </select>
              </div>

              <div class="col-md-2">
                <label class="form-label small text-secondary">Cant.</label>
                <input v-model.number="itemDraft.cantidad" type="number" min="1" class="form-control" />
              </div>

              <div class="col-md-2">
                <label class="form-label small text-secondary">PU</label>
                <input
                  v-model.number="itemDraft.precioUnitario"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control"
                />
              </div>

              <div class="col-md-2 d-grid">
                <button class="btn btn-outline-light" @click="addItem">Agregar</button>
              </div>
            </div>

            <div class="table-responsive mt-3" v-if="form.detalles.length">
              <table class="table table-dark table-hover align-middle">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style="width: 90px">Cant</th>
                    <th style="width: 140px" class="text-end">PU</th>
                    <th style="width: 140px" class="text-end">Subt</th>
                    <th style="width: 70px"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(d, idx) in form.detalles" :key="idx">
                    <td>{{ productoName(d.productoId) }}</td>
                    <td>{{ d.cantidad }}</td>
                    <td class="text-end">{{ formatMoney(d.precioUnitario) }}</td>
                    <td class="text-end">{{ formatMoney(d.cantidad * d.precioUnitario) }}</td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-danger" @click="removeItem(idx)">X</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else class="text-secondary small mt-2">Agregá al menos 1 ítem.</div>
          </div>

          <div class="modal-footer border-secondary">
            <button class="btn btn-outline-light" data-bs-dismiss="modal">Cancelar</button>
            <button class="btn btn-accent" :disabled="loading" @click="crearCompra">
              {{ loading ? "Guardando..." : "Crear compra" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: Detalle -->
    <div class="modal fade" id="detalleModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">Detalle compra</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div v-if="detalle?.compra">
              <div class="d-flex flex-wrap gap-2 justify-content-between mb-2">
                <div class="text-secondary">
                  <div><b>#{{ detalle.compra.compraId }}</b></div>
                  <div>{{ proveedorName(detalle.compra.proveedorId) }}</div>
                  <div>{{ (detalle.compra.fecha || "").slice(0, 10) }}</div>
                </div>
                <div class="text-end">
                  <div class="text-secondary small">Estado</div>
                  <div class="badge text-bg-dark border border-secondary">{{ detalle.compra.estado }}</div>
                  <div class="mt-2"><b>{{ formatMoney(detalle.compra.total) }}</b></div>
                </div>
              </div>

              <div class="table-responsive">
                <table class="table table-dark table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style="width: 90px">Cant</th>
                      <th style="width: 140px" class="text-end">PU</th>
                      <th style="width: 140px" class="text-end">Subt</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="d in detalle.detalles" :key="d.compraDetalleId || d.id">
                      <td>{{ productoName(d.productoId) }}</td>
                      <td>{{ d.cantidad }}</td>
                      <td class="text-end">{{ formatMoney(d.precioUnitario) }}</td>
                      <td class="text-end">{{ formatMoney(d.cantidad * d.precioUnitario) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <hr class="border-secondary" />

              <h6 class="mb-2">Pagos</h6>
              <div v-if="pagosDetalle.length" class="table-responsive">
                <table class="table table-dark table-hover align-middle">
                  <thead>
                    <tr>
                      <th style="width: 90px">ID</th>
                      <th style="width: 140px">Fecha</th>
                      <th class="text-end">Monto</th>
                      <th>Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in pagosDetalle" :key="p.pagoProveedorId || p.id">
                      <td class="text-secondary">#{{ p.pagoProveedorId || p.id }}</td>
                      <td class="text-secondary">{{ (p.fecha || "").slice(0, 10) }}</td>
                      <td class="text-end">{{ formatMoney(p.monto) }}</td>
                      <td class="text-secondary">{{ p.referencia || "—" }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="text-secondary small">Sin pagos registrados.</div>
            </div>

            <div v-else class="text-secondary">Cargando...</div>
          </div>

          <div class="modal-footer border-secondary">
            <button class="btn btn-outline-light" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: Pago -->
    <div class="modal fade" id="pagoModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">Registrar pago</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div class="text-secondary small mb-2">Compra: <b>#{{ pagoForm.compraId }}</b></div>

            <div class="alert alert-warning py-2" v-if="!cajaAbierta?.cajaId">
              No hay caja abierta para tu turno. Abrí caja antes de registrar pagos.
            </div>

            <label class="form-label small text-secondary">Monto</label>
            <input v-model.number="pagoForm.monto" type="number" min="0" step="0.01" class="form-control" />

            <label class="form-label small text-secondary mt-2">Método de pago</label>
            <select v-model.number="pagoForm.metodoPagoId" class="form-select">
              <option :value="null">Seleccionar...</option>
              <option v-for="m in metodosPago" :key="m.metodoPagoId" :value="m.metodoPagoId">
                {{ m.nombre }}
              </option>
            </select>

            <label class="form-label small text-secondary mt-2">Referencia</label>
            <input v-model="pagoForm.referencia" type="text" class="form-control" placeholder="Opcional" />
          </div>

          <div class="modal-footer border-secondary">
            <button class="btn btn-outline-light" data-bs-dismiss="modal">Cancelar</button>
            <button class="btn btn-accent" :disabled="loading || !cajaAbierta?.cajaId" @click="registrarPago">
              {{ loading ? "Procesando..." : "Registrar pago" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { comprasApi } from "../services/comprasApi"
import { pagosProveedorApi } from "../services/pagosProveedorApi"
import { proveedoresApi } from "../services/proveedoresApi"
import { productosApi } from "../services/productosApi"
import { cajaApi } from "../services/cajaApi"
import { metodosPagoApi } from "../services/metodopagoService"
import { getSession, getShift } from "../auth/session"

export default {
  name: "ComprasView",
  data() {
    return {
      loading: false,
      error: "",
      success: "",

      q: "",
      proveedores: [],
      productos: [],
      compras: [],

      cajaAbierta: null,
      metodosPago: [],

      form: {
        proveedorId: null,
        fecha: new Date().toISOString().slice(0, 10),
        detalles: [],
      },
      itemDraft: { productoId: null, cantidad: 1, precioUnitario: 0 },

      detalle: null, // { compra, detalles }
      pagosDetalle: [],

      pagoForm: { compraId: null, monto: 0, metodoPagoId: null, referencia: "" },
    }
  },

  computed: {
    totalDraft() {
      return (this.form.detalles || []).reduce(
        (acc, d) => acc + Number(d.cantidad) * Number(d.precioUnitario),
        0
      )
    },

    comprasFiltradas() {
      const t = String(this.q || "").trim().toLowerCase()
      if (!t) return this.compras

      return this.compras.filter((c) => {
        const id = String(c.compraId || "")
        const prov = this.proveedorName(c.proveedorId).toLowerCase()
        return id.includes(t) || prov.includes(t)
      })
    },
  },

  mounted() {
    this.refreshAll()
  },

  methods: {
    // ===== Utils =====
    formatMoney(n) {
      const num = Number(n ?? 0)
      return num.toLocaleString("es-AR", { style: "currency", currency: "ARS" })
    },

    productoName(id) {
      const pid = Number(id)
      const p = this.productos.find((x) => Number(x.productoId) === pid)
      return p?.nombre ?? `#${id}`
    },

    toastSuccess(msg) {
      this.success = msg
      setTimeout(() => (this.success = ""), 2200)
    },

    // ===== Mappers (API -> VM) =====
    mapProveedorApiToVM(raw) {
      const proveedorId = Number(raw?.proveedorId ?? raw?.id ?? 0)
      const tipo =
        (raw?.tipoProveedor ?? raw?.tipo ?? "PERSONA") === "EMPRESA" ? "EMPRESA" : "PERSONA"

      const nombre = raw?.nombre ?? ""
      const apellido = raw?.apellido ?? ""
      const razonSocial = raw?.razonSocial ?? ""
      const cuit = raw?.cuit ?? ""
      const dni = raw?.dni ?? ""

      const displayName =
        tipo === "EMPRESA" ? (razonSocial || "—") : `${nombre} ${apellido}`.trim() || "—"

      return {
        proveedorId,
        tipo,
        displayName,
        nombre,
        apellido,
        razonSocial,
        cuit,
        dni,
      }
    },

    mapCompraApiToVM(raw) {
      // BACK: /compras -> [{ compra: {...}, detalles:[...] }]
      const c = raw?.compra ?? raw ?? {}

      const compraId = Number(c?.compraId ?? c?.id ?? 0)
      const proveedorId = Number(c?.proveedorId ?? 0)

      const fecha = c?.fecha ?? c?.createdAt ?? ""
      const total = Number(c?.total ?? 0)
      const estado = c?.estado ?? "—"

      return { compraId, proveedorId, fecha, total, estado }
    },

    proveedorName(id) {
      const pid = Number(id)
      const p = this.proveedores.find((x) => Number(x.proveedorId) === pid)
      if (!p) return pid ? `#${pid}` : "#—"
      return p.displayName || `#${pid}`
    },

    // ===== Data =====
    async refreshAll() {
      this.loading = true
      this.error = ""
      try {
        const session = getSession() ?? null
        const userId = Number(session?.userId ?? 1)
        const turno = getShift()

        const [provRes, prodRes, comprasRes, cajaRes, mpRes] = await Promise.all([
          proveedoresApi.list(),
          productosApi.list(),
          comprasApi.list(),
          cajaApi.abierta({ userId, turno }).catch(() => ({ data: null })),
          metodosPagoApi.list().catch(() => ({ data: [] })),
        ])

        const provData = provRes?.data ?? []
        this.proveedores = provData.map(this.mapProveedorApiToVM)

        this.productos = prodRes?.data ?? []

        const comprasData = comprasRes?.data ?? []
        this.compras = comprasData.map(this.mapCompraApiToVM)

        this.cajaAbierta = cajaRes?.data ?? null
        this.metodosPago = (mpRes?.data ?? []).map((m) => ({
          metodoPagoId: Number(m?.metodoPagoId ?? m?.id ?? 0),
          nombre: m?.nombre ?? m?.descripcion ?? "—",
        }))
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || "Error cargando compras"
      } finally {
        this.loading = false
      }
    },

    // ===== Crear compra =====
    prepareCreate() {
      this.error = ""
      this.form = {
        proveedorId: null,
        fecha: new Date().toISOString().slice(0, 10),
        detalles: [],
      }
      this.itemDraft = { productoId: null, cantidad: 1, precioUnitario: 0 }
    },

    addItem() {
      this.error = ""
      const productoId = Number(this.itemDraft.productoId || 0)
      const cantidad = Number(this.itemDraft.cantidad || 0)
      const precioUnitario = Number(this.itemDraft.precioUnitario || 0)

      if (!productoId) return (this.error = "Elegí un producto")
      if (cantidad <= 0) return (this.error = "Cantidad inválida")
      if (precioUnitario < 0) return (this.error = "Precio inválido")

      this.form.detalles.push({ productoId, cantidad, precioUnitario })
      this.itemDraft = { productoId: null, cantidad: 1, precioUnitario: 0 }
    },

    removeItem(idx) {
      this.form.detalles.splice(idx, 1)
    },

    async crearCompra() {
      this.loading = true
      this.error = ""
      try {
        const session = getSession() ?? null
        const userId = Number(session?.userId ?? 1)

        if (!this.form.proveedorId) throw new Error("Seleccioná proveedor")
        if (!this.form.detalles.length) throw new Error("Agregá al menos 1 ítem")

        const payload = {
          userId,
          proveedorId: Number(this.form.proveedorId),
          fecha: this.form.fecha,
          detalles: this.form.detalles.map((d) => ({
            productoId: d.productoId,
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario, // back lo recalcula igual
          })),
        }

        await comprasApi.create(payload)
        this.toastSuccess("Compra creada ✅")
        await this.refreshAll()
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || "Error creando compra"
      } finally {
        this.loading = false
      }
    },

    // ===== Detalle =====
    async openDetalle(compraId) {
      this.detalle = null
      this.pagosDetalle = []
      this.loading = true
      this.error = ""
      try {
        const [cRes, pRes] = await Promise.all([
          comprasApi.porId(compraId),
          pagosProveedorApi.porCompra(compraId),
        ])
        this.detalle = cRes?.data ?? null
        this.pagosDetalle = pRes?.data ?? []
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || "Error cargando detalle"
      } finally {
        this.loading = false
      }
    },

    // ===== Pago =====
    preparePago(compraId) {
      this.error = ""
      this.pagoForm = { compraId, monto: 0, metodoPagoId: null, referencia: "" }
    },

    async registrarPago() {
      this.loading = true
      this.error = ""
      try {
        const cajaId = Number(this.cajaAbierta?.cajaId ?? 0)
        if (!cajaId) throw new Error("No hay caja abierta para tu turno. Abrí caja antes de pagar.")

        const compraId = Number(this.pagoForm.compraId || 0)
        const monto = Number(this.pagoForm.monto || 0)
        const metodoPagoId = Number(this.pagoForm.metodoPagoId || 0)

        if (!compraId) throw new Error("Compra inválida")
        if (monto <= 0) throw new Error("Monto inválido")
        if (!metodoPagoId) throw new Error("Elegí un método de pago")

        const payload = {
          compraId,
          cajaId,
          metodoPagoId,
          monto,
          referencia: (this.pagoForm.referencia || "").trim() || null,
        }

        await pagosProveedorApi.create(payload)
        this.toastSuccess("Pago registrado ✅")
        await this.refreshAll()

        if (this.detalle?.compra?.compraId === compraId) {
          await this.openDetalle(compraId)
        }
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || "Error registrando pago"
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style scoped>
.bg-panel {
  background: rgba(18, 22, 32, 0.92);
}
.modal-round {
  border-radius: 14px;
}

.btn-accent {
  background: #7c3aed;
  border-color: #7c3aed;
}
.btn-accent:hover {
  filter: brightness(1.05);
}

.table td,
.table th {
  vertical-align: middle;
}
</style>