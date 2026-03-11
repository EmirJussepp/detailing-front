<template>
  <div class="container py-4">
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div>
        <h2 class="mb-1">Compras</h2>
        <div class="text-secondary small">
          Crear compra · ver detalle · registrar pagos a proveedor.
        </div>
      </div>

      <div class="d-flex gap-2 align-items-center">
        <button class="btn btn-outline-light" @click="refreshAll" :disabled="loading">
          {{ loading ? "Actualizando..." : "Refresh" }}
        </button>

        <button
          class="btn btn-primary btn-accent"
          data-bs-toggle="modal"
          data-bs-target="#compraModal"
          @click="prepareCreate"
        >
          + Nueva compra
        </button>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-5">
            <input
              v-model="q"
              class="form-control bg-dark text-white border-secondary"
              placeholder="Buscar por ID de compra o proveedor visible en la página…"
            />
          </div>

          <div class="col-12 col-md-3">
            <select v-model="sortBy" class="form-select bg-dark text-white border-secondary">
              <option value="fechaDesc">Orden: Más recientes</option>
              <option value="fechaAsc">Orden: Más antiguas</option>
              <option value="totalDesc">Orden: Total mayor</option>
              <option value="totalAsc">Orden: Total menor</option>
              <option value="proveedor">Orden: Proveedor</option>
              <option value="estado">Orden: Estado</option>
            </select>
          </div>

          <div class="col-12 col-md-4 d-flex justify-content-md-end">
            <span class="text-secondary small">
              Total compras: <b>{{ totalElements }}</b> · Mostrando: <b>{{ comprasFiltradas.length }}</b>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="success" class="alert alert-success py-2">{{ success }}</div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table table-dark table-hover align-middle mb-0">
          <thead>
            <tr class="text-secondary">
              <th style="width: 90px">ID</th>
              <th>Proveedor</th>
              <th style="width: 140px">Fecha</th>
              <th style="width: 140px" class="text-end">Total</th>
              <th style="width: 130px" class="text-center">Estado</th>
              <th style="width: 180px" class="text-end">Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="!comprasFiltradas.length">
              <td colspan="6" class="text-center text-secondary py-4">
                No hay compras para mostrar.
              </td>
            </tr>

            <tr v-for="c in comprasFiltradas" :key="c.compraId">
              <td class="text-secondary">#{{ c.compraId }}</td>

              <td>
                <div class="fw-semibold">{{ proveedorName(c.proveedorId) }}</div>
                <div class="text-secondary small">Compra registrada</div>
              </td>

              <td class="text-secondary">
                {{ formatDate(c.fecha) }}
              </td>

              <td class="text-end fw-bold">
                {{ formatMoney(c.total) }}
              </td>

              <td class="text-center">
                <span class="badge" :class="estadoBadgeClass(c.estado)">
                  {{ c.estado }}
                </span>
              </td>

              <td class="text-end">
                <div class="btn-group">
                  <button
                    class="btn btn-outline-light btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#detalleModal"
                    @click="openDetalle(c.compraId)"
                  >
                    Ver
                  </button>

                  <button
                    class="btn btn-outline-success btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#pagoModal"
                    @click="preparePago(c.compraId)"
                  >
                    Pagar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        class="card-footer border-secondary d-flex flex-wrap justify-content-between align-items-center gap-2 text-secondary small"
      >
        <div>
          Tip: desde acá podés <b>crear compras</b>, consultar el <b>detalle</b> y registrar <b>pagos</b>.
        </div>

        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-outline-light" @click="prevPage" :disabled="loading || !canPrev">◀</button>
          <span>Página <b>{{ page }}</b> / <b>{{ totalPages }}</b></span>
          <button class="btn btn-sm btn-outline-light" @click="nextPage" :disabled="loading || !canNext">▶</button>

          <select
            v-model.number="size"
            class="form-select form-select-sm bg-dark text-white border-secondary"
            style="width: 90px"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </div>
      </div>
    </div>

    <div class="modal fade" id="compraModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">Nueva compra</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div class="row g-3">
              <div class="col-md-8">
                <label class="form-label text-secondary">Proveedor</label>
                <select v-model.number="form.proveedorId" class="form-select">
                  <option :value="null">Seleccionar...</option>
                  <option v-for="p in proveedores" :key="p.proveedorId" :value="p.proveedorId">
                    {{ p.displayName }}
                  </option>
                </select>
              </div>

              <div class="col-md-4">
                <label class="form-label text-secondary">Fecha</label>
                <input v-model="form.fecha" type="date" class="form-control" />
              </div>
            </div>

            <hr class="border-secondary my-3" />

            <div class="d-flex align-items-center justify-content-between mb-2">
              <h6 class="mb-0">Ítems</h6>
              <span class="text-secondary small">
                Total: <b>{{ formatMoney(totalDraft) }}</b>
              </span>
            </div>

            <div class="row g-2 align-items-end">
              <div class="col-md-6">
                <label class="form-label text-secondary">Producto</label>
                <select v-model.number="itemDraft.productoId" class="form-select">
                  <option :value="null">Seleccionar...</option>
                  <option v-for="p in productos" :key="p.productoId || p.id" :value="Number(p.productoId ?? p.id)">
                    {{ p.nombre }}
                  </option>
                </select>
              </div>

              <div class="col-md-2">
                <label class="form-label text-secondary">Cant.</label>
                <input v-model.number="itemDraft.cantidad" type="number" min="1" class="form-control" />
              </div>

              <div class="col-md-2">
                <label class="form-label text-secondary">PU</label>
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
              <table class="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr class="text-secondary">
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
                    <td class="text-end">{{ formatMoney(Number(d.cantidad) * Number(d.precioUnitario)) }}</td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-danger" @click="removeItem(idx)">X</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else class="text-secondary small mt-2">
              Agregá al menos 1 ítem.
            </div>
          </div>

          <div class="modal-footer border-secondary">
            <button class="btn btn-outline-light" data-bs-dismiss="modal">Cancelar</button>
            <button class="btn btn-primary btn-accent" :disabled="loading" @click="crearCompra">
              {{ loading ? "Guardando..." : "Crear compra" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="detalleModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">Detalle compra</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div v-if="detalle?.compra">
              <div class="d-flex flex-wrap gap-2 justify-content-between mb-3">
                <div class="text-secondary">
                  <div><b>#{{ detalle.compra.compraId }}</b></div>
                  <div>{{ proveedorName(detalle.compra.proveedorId) }}</div>
                  <div>{{ formatDate(detalle.compra.fecha) }}</div>
                </div>

                <div class="text-end">
                  <div class="text-secondary small">Estado</div>
                  <div class="badge" :class="estadoBadgeClass(detalle.compra.estado)">
                    {{ detalle.compra.estado }}
                  </div>
                  <div class="mt-2 fw-bold">{{ formatMoney(detalle.compra.total) }}</div>
                </div>
              </div>

              <div class="table-responsive">
                <table class="table table-dark table-hover align-middle">
                  <thead>
                    <tr class="text-secondary">
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
                      <td class="text-end">{{ formatMoney(Number(d.cantidad) * Number(d.precioUnitario)) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <hr class="border-secondary" />

              <h6 class="mb-2">Pagos</h6>
              <div v-if="pagosDetalle.length" class="table-responsive">
                <table class="table table-dark table-hover align-middle mb-0">
                  <thead>
                    <tr class="text-secondary">
                      <th style="width: 90px">ID</th>
                      <th style="width: 140px">Fecha</th>
                      <th class="text-end">Monto</th>
                      <th>Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in pagosDetalle" :key="p.pagoProveedorId || p.id">
                      <td class="text-secondary">#{{ p.pagoProveedorId || p.id }}</td>
                      <td class="text-secondary">{{ formatDate(p.fecha) }}</td>
                      <td class="text-end fw-bold">{{ formatMoney(p.monto) }}</td>
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

    <div class="modal fade" id="pagoModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">Registrar pago</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div class="text-secondary small mb-2">
              Compra: <b>#{{ pagoForm.compraId }}</b>
            </div>

            <label class="form-label text-secondary">Monto</label>
            <input v-model.number="pagoForm.monto" type="number" min="0" step="0.01" class="form-control" />

            <label class="form-label text-secondary mt-3">Método de pago</label>
            <select v-model.number="pagoForm.metodoPagoId" class="form-select">
              <option :value="null">Seleccionar...</option>
              <option v-for="m in metodosPago" :key="m.metodoPagoId" :value="m.metodoPagoId">
                {{ m.nombre }}
              </option>
            </select>

            <label class="form-label text-secondary mt-3">Referencia</label>
            <input v-model="pagoForm.referencia" type="text" class="form-control" placeholder="Opcional" />
          </div>

          <div class="modal-footer border-secondary">
            <button class="btn btn-outline-light" data-bs-dismiss="modal">Cancelar</button>
            <button class="btn btn-primary btn-accent" :disabled="loading" @click="registrarPago">
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
import { metodosPagoApi } from "../services/metodopagoService"
import { getSession } from "../auth/session"

function unwrapPage(data) {
  if (Array.isArray(data)) {
    return {
      content: data,
      page: 1,
      size: data.length || 10,
      totalElements: data.length,
      totalPages: 1,
    }
  }

  const content = data?.content ?? data?.items ?? data?.data ?? []

  return {
    content: Array.isArray(content) ? content : [],
    page: Number(data?.page ?? data?.number ?? 1),
    size: Number(data?.size ?? data?.pageSize ?? 10),
    totalElements: Number(
      data?.totalElements ?? data?.total ?? (Array.isArray(content) ? content.length : 0)
    ),
    totalPages: Number(data?.totalPages ?? data?.pages ?? 1),
  }
}

export default {
  name: "ComprasView",

  data() {
    return {
      loading: false,
      error: "",
      success: "",

      q: "",
      sortBy: "fechaDesc",

      page: 1,
      size: 10,
      totalElements: 0,
      totalPages: 1,

      proveedores: [],
      productos: [],
      compras: [],
      metodosPago: [],

      form: {
        proveedorId: null,
        fecha: new Date().toISOString().slice(0, 10),
        detalles: [],
      },

      itemDraft: {
        productoId: null,
        cantidad: 1,
        precioUnitario: 0,
      },

      detalle: null,
      pagosDetalle: [],

      pagoForm: {
        compraId: null,
        monto: 0,
        metodoPagoId: null,
        referencia: "",
      },

      _t: null,
    }
  },

  computed: {
    totalDraft() {
      return (this.form.detalles || []).reduce((acc, d) => {
        return acc + Number(d.cantidad || 0) * Number(d.precioUnitario || 0)
      }, 0)
    },

    comprasFiltradas() {
      let arr = [...this.compras]
      const t = String(this.q || "").trim().toLowerCase()

      if (t) {
        arr = arr.filter((c) => {
          const id = String(c.compraId || "")
          const prov = this.proveedorName(c.proveedorId).toLowerCase()
          return id.includes(t) || prov.includes(t)
        })
      }

      switch (this.sortBy) {
        case "fechaAsc":
          arr.sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")))
          break
        case "fechaDesc":
          arr.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")))
          break
        case "totalAsc":
          arr.sort((a, b) => Number(a.total || 0) - Number(b.total || 0))
          break
        case "totalDesc":
          arr.sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
          break
        case "proveedor":
          arr.sort((a, b) =>
            this.proveedorName(a.proveedorId).localeCompare(this.proveedorName(b.proveedorId), "es")
          )
          break
        case "estado":
          arr.sort((a, b) => String(a.estado || "").localeCompare(String(b.estado || ""), "es"))
          break
      }

      return arr
    },

    canPrev() {
      return this.page > 1
    },

    canNext() {
      return this.page < this.totalPages
    },
  },

  mounted() {
    this.refreshAll()
  },

  beforeUnmount() {
    if (this._t) clearTimeout(this._t)
  },

  watch: {
    q() {
      clearTimeout(this._t)
      this._t = setTimeout(() => {
        if (this.page !== 1) {
          this.page = 1
        } else {
          this.refreshCompras()
        }
      }, 300)
    },

    page() {
      this.refreshCompras()
    },

    size() {
      if (this.page !== 1) {
        this.page = 1
      } else {
        this.refreshCompras()
      }
    },
  },

  methods: {
    formatMoney(n) {
      const num = Number(n ?? 0)
      return num.toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
      })
    },

    formatDate(value) {
      const s = String(value || "")
      return s ? s.slice(0, 10) : "—"
    },

    estadoBadgeClass(estado) {
      const e = String(estado || "").toUpperCase()
      if (e === "PAGADA") return "text-bg-success"
      if (e === "PENDIENTE" || e === "PARCIAL") return "text-bg-warning"
      if (e === "ANULADA") return "text-bg-secondary"
      return "text-bg-dark border border-secondary"
    },

    toastSuccess(msg) {
      this.success = msg
      setTimeout(() => {
        this.success = ""
      }, 2200)
    },

    productoName(id) {
      const pid = Number(id)
      const p = this.productos.find((x) => Number(x.productoId ?? x.id) === pid)
      return p?.nombre ?? `#${id}`
    },

    proveedorName(id) {
      const pid = Number(id)
      const p = this.proveedores.find((x) => Number(x.proveedorId ?? x.id) === pid)
      if (!p) return pid ? `#${pid}` : "#—"
      return p.displayName || `#${pid}`
    },

    mapProveedorApiToVM(raw) {
      const proveedorId = Number(raw?.proveedorId ?? raw?.id ?? 0)
      const tipo = (raw?.tipoProveedor ?? raw?.tipo ?? "PERSONA") === "EMPRESA" ? "EMPRESA" : "PERSONA"

      const nombre = raw?.nombre ?? ""
      const apellido = raw?.apellido ?? ""
      const razonSocial = raw?.razonSocial ?? ""

      const displayName =
        tipo === "EMPRESA" ? (razonSocial || "—") : `${nombre} ${apellido}`.trim() || "—"

      return {
        proveedorId,
        tipo,
        displayName,
      }
    },

    mapCompraApiToVM(raw) {
      const c = raw?.compra ?? raw ?? {}

      return {
        compraId: Number(c?.compraId ?? c?.id ?? 0),
        proveedorId: Number(c?.proveedorId ?? 0),
        fecha: c?.fecha ?? c?.createdAt ?? "",
        total: Number(c?.total ?? 0),
        estado: c?.estado ?? "—",
      }
    },

    hideModal(id) {
      const modalEl = document.getElementById(id)
      if (!modalEl || !window.bootstrap?.Modal) return
      const instance = window.bootstrap.Modal.getInstance(modalEl)
      instance?.hide()
    },

   async refreshAll() {
  this.loading = true
  this.error = ""

  try {
    const [provRes, prodRes, mpRes] = await Promise.all([
      proveedoresApi.list({ page: 1, size: 9999, search: "" }).catch(() => ({ data: [] })),
      productosApi.list({ page: 1, size: 9999 }).catch(() => ({ data: [] })),
      metodosPagoApi.list().catch(() => ({ data: [] })),
    ])

    const provPage = unwrapPage(provRes?.data)
    this.proveedores = provPage.content.map(this.mapProveedorApiToVM)

    const prodPage = unwrapPage(prodRes?.data)
    this.productos = Array.isArray(prodPage.content) ? prodPage.content : (prodRes?.data ?? [])

    const mpPage = unwrapPage(mpRes?.data)
    this.metodosPago = (mpPage.content ?? mpRes?.data ?? []).map((m) => ({
      metodoPagoId: Number(m?.metodoPagoId ?? m?.id ?? 0),
      nombre: m?.nombre ?? m?.descripcion ?? "—",
    }))

    await this.refreshCompras()
  } catch (e) {
    this.error = e?.response?.data?.error || e?.message || "Error cargando compras"
  } finally {
    this.loading = false
  }
},

    async refreshCompras() {
      this.loading = true
      this.error = ""

      try {
        const res = await comprasApi.list({
          page: this.page,
          size: this.size,
          search: this.q.trim() || "",
        })

        const p = unwrapPage(res?.data)

        this.compras = p.content.map(this.mapCompraApiToVM)
        this.totalElements = p.totalElements
        this.totalPages = Math.max(1, Number(p.totalPages || 1))
        this.page = Math.max(1, Number(p.page || 1))
        this.size = Number(p.size || this.size)
      } catch (e) {
        this.compras = []
        this.totalElements = 0
        this.totalPages = 1
        this.error = e?.response?.data?.error || e?.message || "Error cargando compras"
      } finally {
        this.loading = false
      }
    },

    prevPage() {
      if (!this.canPrev) return
      this.page--
    },

    nextPage() {
      if (!this.canNext) return
      this.page++
    },

    prepareCreate() {
      this.error = ""
      this.form = {
        proveedorId: null,
        fecha: new Date().toISOString().slice(0, 10),
        detalles: [],
      }
      this.itemDraft = {
        productoId: null,
        cantidad: 1,
        precioUnitario: 0,
      }
    },

    addItem() {
      this.error = ""

      const productoId = Number(this.itemDraft.productoId || 0)
      const cantidad = Number(this.itemDraft.cantidad || 0)
      const precioUnitario = Number(this.itemDraft.precioUnitario || 0)

      if (!productoId) {
        this.error = "Elegí un producto"
        return
      }

      if (cantidad <= 0) {
        this.error = "Cantidad inválida"
        return
      }

      if (precioUnitario < 0) {
        this.error = "Precio inválido"
        return
      }

      this.form.detalles.push({
        productoId,
        cantidad,
        precioUnitario,
      })

      this.itemDraft = {
        productoId: null,
        cantidad: 1,
        precioUnitario: 0,
      }
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
            productoId: Number(d.productoId),
            cantidad: Number(d.cantidad),
            precioUnitario: Number(d.precioUnitario),
          })),
        }

        await comprasApi.create(payload)

        this.toastSuccess("Compra creada ✅")
        this.prepareCreate()
        this.page = 1
        await this.refreshCompras()
        this.hideModal("compraModal")
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || "Error creando compra"
      } finally {
        this.loading = false
      }
    },

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

        const detalleData = cRes?.data ?? null

        this.detalle = detalleData?.compra
          ? detalleData
          : detalleData
            ? {
                compra: detalleData,
                detalles: Array.isArray(detalleData.detalles) ? detalleData.detalles : [],
              }
            : null

        const pagosPage = unwrapPage(pRes?.data)
        this.pagosDetalle = Array.isArray(pagosPage.content) ? pagosPage.content : []
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || "Error cargando detalle"
      } finally {
        this.loading = false
      }
    },

    preparePago(compraId) {
      this.error = ""
      this.pagoForm = {
        compraId,
        monto: 0,
        metodoPagoId: null,
        referencia: "",
      }
    },

    async registrarPago() {
      this.loading = true
      this.error = ""

      try {
        const compraId = Number(this.pagoForm.compraId || 0)
        const monto = Number(this.pagoForm.monto || 0)
        const metodoPagoId = Number(this.pagoForm.metodoPagoId || 0)

        if (!compraId) throw new Error("Compra inválida")
        if (monto <= 0) throw new Error("Monto inválido")
        if (!metodoPagoId) throw new Error("Elegí un método de pago")

        const payload = {
          compraId,
          metodoPagoId,
          monto,
          referencia: (this.pagoForm.referencia || "").trim() || null,
        }

        await pagosProveedorApi.create(payload)

        this.toastSuccess("Pago registrado ✅")
        await this.refreshCompras()

        if (this.detalle?.compra?.compraId === compraId) {
          await this.openDetalle(compraId)
        }

        this.hideModal("pagoModal")
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
  background: rgba(18, 22, 32, .92);
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