<template>
  <div class="compras-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Compras</p>
        <h1 class="page-title mb-1">Compras</h1>
        <p class="page-subtitle mb-0">
          Registrá compras, consultá detalle y cargá pagos a proveedor.
        </p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="refreshAll" :disabled="loading">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>

        <button
          class="btn btn-outline-light"
          data-bs-toggle="modal"
          data-bs-target="#nuevoProductoModal"
          @click="prepareNewProducto"
        >
          Nuevo producto
        </button>

        <button
          class="btn btn-primary btn-accent"
          data-bs-toggle="modal"
          data-bs-target="#compraModal"
          @click="prepareCreate"
        >
          Nueva compra
        </button>
      </div>
    </section>

    <div v-if="error" class="alert alert-danger py-2 mb-3">{{ error }}</div>
    <div v-if="success" class="alert alert-success py-2 mb-3">{{ success }}</div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Filtros</h2>
          <div class="helper-text">
            Total compras: <b>{{ totalElements }}</b> · Mostrando: <b>{{ comprasFiltradas.length }}</b>
          </div>
        </div>

        <div class="filters-bar">
          <div class="filters-grid">
            <div>
              <label class="form-label field-label">Buscar</label>
              <input
                v-model="q"
                class="form-control app-input"
                placeholder="Proveedor o número de compra..."
              />
            </div>

            <div>
              <label class="form-label field-label">Orden</label>
              <select v-model="sortBy" class="form-select app-input">
                <option value="fechaDesc">Más recientes</option>
                <option value="fechaAsc">Más antiguas</option>
                <option value="totalDesc">Total mayor</option>
                <option value="totalAsc">Total menor</option>
                <option value="proveedor">Proveedor</option>
                <option value="estado">Estado</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Resultados</h2>
          <div class="helper-text">
            Desde acá podés crear compras, revisar detalle y registrar pagos.
          </div>
        </div>

        <div v-if="!comprasFiltradas.length" class="empty-block">
          <div class="empty-title">No hay compras para mostrar</div>
          <div class="helper-text">
            Probá ajustar la búsqueda o registrá una nueva compra.
          </div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th style="width: 90px">Compra</th>
                <th>Proveedor</th>
                <th style="width: 140px">Fecha</th>
                <th style="width: 140px" class="text-end">Total</th>
                <th style="width: 130px" class="text-center">Estado</th>
                <th style="width: 190px" class="text-end">Acciones</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="c in comprasFiltradas" :key="c.compraId">
                <td class="text-secondary">#{{ c.compraId }}</td>

                <td>
                  <div class="table-main">{{ proveedorName(c.proveedorId) }}</div>
                  <div class="table-sub">Compra registrada</div>
                </td>

                <td class="text-secondary">
                  {{ (c.fecha || "").slice(0, 10) || "—" }}
                </td>

                <td class="text-end fw-semibold">
                  {{ formatMoney(c.total) }}
                </td>

                <td class="text-center">
                  <span class="badge" :class="estadoBadgeClass(c.estado)">
                    {{ c.estado }}
                  </span>
                </td>

                <td class="text-end">
                  <div class="d-flex justify-content-end gap-2 flex-wrap">
                    <button
                      class="btn btn-sm btn-outline-light"
                      data-bs-toggle="modal"
                      data-bs-target="#detalleModal"
                      @click="openDetalle(c.compraId)"
                    >
                      Ver
                    </button>

                    <button
                      class="btn btn-sm btn-outline-success"
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

        <div class="footer-summary">
          <div class="helper-text">
            Página <b>{{ page + 1 }}</b> de <b>{{ totalPages }}</b>
          </div>
        </div>

        <div class="mt-3">
          <div class="pager-minimal">
            <button class="btn btn-sm btn-outline-light" @click="prevPage" :disabled="loading || !canPrev">
              Anterior
            </button>

            <span class="helper-text">
              Página <b>{{ page + 1 }}</b> de <b>{{ totalPages }}</b>
            </span>

            <button class="btn btn-sm btn-outline-light" @click="nextPage" :disabled="loading || !canNext">
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="compraModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-panel border-0 modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">Nueva compra</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div class="row g-3">
              <div class="col-md-8">
                <label class="form-label field-label">Proveedor</label>
                <select v-model.number="form.proveedorId" class="form-select app-input">
                  <option :value="null">Seleccionar...</option>
                  <option v-for="p in proveedores" :key="p.proveedorId" :value="p.proveedorId">
                    {{ p.displayName }}
                  </option>
                </select>
              </div>

              <div class="col-md-4">
                <label class="form-label field-label">Fecha</label>
                <input v-model="form.fecha" type="date" class="form-control app-input" />
              </div>

              <div class="col-12">
                <div class="form-check mt-1">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="impactarStockCheck"
                    v-model="form.impactarStock"
                  />
                  <label class="form-check-label helper-text" for="impactarStockCheck">
                    Impactar stock automáticamente
                  </label>
                </div>
              </div>
            </div>

            <hr class="border-secondary my-4" />

            <div class="section-header mb-3">
              <h2 class="section-title mb-0">Ítems</h2>
              <div class="helper-text">
                Total: <b>{{ formatMoney(totalDraft) }}</b>
              </div>
            </div>

            <div class="row g-2 align-items-end">
              <div class="col-md-6">
                <label class="form-label field-label">Producto</label>
                <select v-model.number="itemDraft.productoId" @change="onProductoChange" class="form-select app-input">
                  <option :value="null">Seleccionar...</option>
                  <option v-for="p in productos" :key="p.productoId ?? p.id" :value="Number(p.productoId ?? p.id)">
                    {{ p.nombre }}
                  </option>
                </select>
              </div>

              <div class="col-md-2">
                <label class="form-label field-label">Cant.</label>
                <input v-model.number="itemDraft.cantidad" type="number" min="1" class="form-control app-input" />
              </div>

              <div class="col-md-2">
                <label class="form-label field-label">P. costo</label>
                <input
                  v-model.number="itemDraft.precioUnitario"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control app-input"
                />
              </div>

              <div class="col-md-2 d-grid">
                <button class="btn btn-outline-light" @click="addItem">Agregar</button>
              </div>
            </div>

            <div v-if="form.detalles.length" class="table-responsive mt-3">
              <table class="table table-dark table-hover align-middle app-table mb-0">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style="width: 90px">Cant.</th>
                    <th style="width: 140px" class="text-end">P. costo</th>
                    <th style="width: 140px" class="text-end">Subtotal</th>
                    <th style="width: 80px" class="text-end">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(d, idx) in form.detalles" :key="idx">
                    <td>{{ productoName(d.productoId) }}</td>
                    <td>{{ d.cantidad }}</td>
                    <td class="text-end">{{ formatMoney(d.precioUnitario) }}</td>
                    <td class="text-end">{{ formatMoney(d.cantidad * d.precioUnitario) }}</td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-danger" @click="removeItem(idx)">Quitar</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else class="helper-text mt-3">
              Agregá al menos un ítem a la compra.
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
        <div class="modal-content bg-panel border-0 modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">Detalle de compra</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div v-if="detalle?.compra">
              <div class="detalle-top mb-3">
                <div>
                  <div class="detalle-title">Compra #{{ detalle.compra.compraId }}</div>
                  <div class="helper-text">{{ proveedorName(detalle.compra.proveedorId) }}</div>
                  <div class="helper-text">{{ (detalle.compra.fecha || "").slice(0, 10) }}</div>
                </div>

                <div class="text-end">
                  <div>
                    <span class="badge" :class="estadoBadgeClass(detalle.compra.estado)">
                      {{ detalle.compra.estado }}
                    </span>
                  </div>
                  <div class="detalle-total mt-2">{{ formatMoney(detalle.compra.total) }}</div>
                </div>
              </div>

              <div class="section-header mb-3">
                <h2 class="section-title mb-0">Ítems</h2>
              </div>

              <div class="table-responsive">
                <table class="table table-dark table-hover align-middle app-table mb-0">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style="width: 90px">Cant.</th>
                      <th style="width: 140px" class="text-end">P. costo</th>
                      <th style="width: 140px" class="text-end">Subtotal</th>
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

              <hr class="border-secondary my-4" />

              <div class="section-header mb-3">
                <h2 class="section-title mb-0">Pagos</h2>
              </div>

              <div v-if="pagosDetalle.length" class="table-responsive">
                <table class="table table-dark table-hover align-middle app-table mb-0">
                  <thead>
                    <tr>
                      <th style="width: 90px">Pago</th>
                      <th style="width: 140px">Fecha</th>
                      <th class="text-end" style="width: 140px">Monto</th>
                      <th>Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in pagosDetalle" :key="p.pagoProveedorId || p.id">
                      <td class="text-secondary">#{{ p.pagoProveedorId || p.id }}</td>
                      <td class="text-secondary">{{ (p.fecha || "").slice(0, 10) || "—" }}</td>
                      <td class="text-end fw-semibold">{{ formatMoney(p.monto) }}</td>
                      <td class="text-secondary">{{ p.referencia || "—" }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else class="helper-text">
                Sin pagos registrados para esta compra.
              </div>
            </div>

            <div v-else class="helper-text">Cargando detalle...</div>
          </div>

          <div class="modal-footer border-secondary">
            <button class="btn btn-outline-light" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="pagoModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-panel border-0 modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">Registrar pago</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div v-if="compraSeleccionada" class="mb-3">
              <div class="helper-text">
                Proveedor: <b>{{ proveedorName(compraSeleccionada.proveedorId) }}</b>
              </div>
              <div class="helper-text">
                Compra: <b>#{{ compraSeleccionada.compraId }}</b>
              </div>
              <div class="helper-text">
                Total compra: <b>{{ formatMoney(compraSeleccionada.total) }}</b>
              </div>
              <div class="helper-text">
                Pagado: <b>{{ formatMoney(pagadoCompraSeleccionada) }}</b>
              </div>
              <div class="helper-text">
                Saldo pendiente: <b class="text-warning">{{ formatMoney(saldoCompraSeleccionada) }}</b>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label field-label">Monto</label>
              <input
                v-model.number="pagoForm.monto"
                type="number"
                min="0"
                step="0.01"
                class="form-control app-input"
              />
            </div>

            <div class="mb-3">
              <label class="form-label field-label">Método de pago</label>
              <select v-model.number="pagoForm.metodoPagoId" class="form-select app-input">
                <option :value="null">Seleccionar...</option>
                <option v-for="m in metodosPago" :key="m.metodoPagoId" :value="m.metodoPagoId">
                  {{ m.nombre }}
                </option>
              </select>
            </div>

            <div>
              <label class="form-label field-label">Referencia</label>
              <input
                v-model="pagoForm.referencia"
                type="text"
                class="form-control app-input"
                placeholder="Opcional"
              />
            </div>
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

    <div class="modal fade" id="nuevoProductoModal" tabindex="-1" ref="nuevoProductoModalRef">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-panel border-0 modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">Nuevo producto</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label field-label">Nombre</label>
                <input
                  v-model="nuevoProducto.nombre"
                  class="form-control app-input"
                  placeholder="Ej: Shampoo siliconado"
                />
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label field-label">Código</label>
                <input
                  v-model="nuevoProducto.codigoProducto"
                  class="form-control app-input"
                  placeholder="Ej: SHAMP001"
                />
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label field-label">Categoría</label>
                <select v-model="nuevoProducto.categoriaId" class="form-select app-input">
                  <option :value="null">(sin)</option>
                  <option
                    v-for="c in categorias"
                    :key="c.categoriaId ?? c.id"
                    :value="Number(c.categoriaId ?? c.id)"
                  >
                    {{ c.nombre ?? c.name }}
                  </option>
                </select>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label field-label">Marca</label>
                <select v-model="nuevoProducto.marcaId" class="form-select app-input">
                  <option :value="null">(sin)</option>
                  <option
                    v-for="m in marcas"
                    :key="m.marcaId ?? m.id"
                    :value="Number(m.marcaId ?? m.id)"
                  >
                    {{ m.nombre ?? m.name }}
                  </option>
                </select>
              </div>

              <div class="col-12 col-md-4">
                <label class="form-label field-label">Precio costo</label>
                <input
                  v-model.number="nuevoProducto.precioCosto"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control app-input"
                />
              </div>

              <div class="col-12 col-md-4">
                <label class="form-label field-label">Precio venta</label>
                <input
                  v-model.number="nuevoProducto.precioVenta"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control app-input"
                />
              </div>

              <div class="col-12 col-md-4">
                <label class="form-label field-label">Precio mayorista</label>
                <input
                  v-model.number="nuevoProducto.precioMayorista"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control app-input"
                />
              </div>
            </div>
          </div>

          <div class="modal-footer border-secondary">
            <button class="btn btn-outline-light" data-bs-dismiss="modal">Cancelar</button>
            <button class="btn btn-primary btn-accent" :disabled="loading" @click="crearProducto">
              {{ loading ? "Guardando..." : "Guardar" }}
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
import { productosApi, marcasApi, categoriasApi } from "../services/productosApi"
import { metodosPagoApi } from "../services/metodopagoService"
import { getSession } from "../auth/session"

function unwrapPage(data) {
  if (Array.isArray(data)) {
    return { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1 }
  }

  const content = data?.content ?? data?.items ?? data?.data ?? []

  return {
    content: Array.isArray(content) ? content : [],
    page: Number(data?.page ?? data?.number ?? 0),
    size: Number(data?.size ?? data?.pageSize ?? 10),
    totalElements: Number(data?.totalElements ?? data?.total ?? (Array.isArray(content) ? content.length : 0)),
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

      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 1,

      proveedores: [],
      productos: [],
      categorias: [],
      marcas: [],
      compras: [],
      metodosPago: [],

      form: {
        proveedorId: null,
        fecha: new Date().toISOString().slice(0, 10),
        detalles: [],
        impactarStock: false,
      },

      itemDraft: {
        productoId: null,
        cantidad: 1,
        precioUnitario: 0,
      },

      nuevoProducto: {
        nombre: "",
        codigoProducto: "",
        categoriaId: null,
        marcaId: null,
        precioCosto: 0,
        precioVenta: 0,
        precioMayorista: 0,
      },

      detalle: null,
      pagosDetalle: [],

      pagoForm: {
        compraId: null,
        monto: 0,
        metodoPagoId: null,
        referencia: "",
      },

      compraSeleccionada: null,
      pagadoCompraSeleccionada: 0,
      saldoCompraSeleccionada: 0,

      _t: null,
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
      return this.page > 0
    },

    canNext() {
      return this.page < this.totalPages - 1
    },
  },

  mounted() {
    this.refreshAll()
  },

  watch: {
    q() {
      clearTimeout(this._t)
      this._t = setTimeout(() => {
        this.page = 0
        this.refreshCompras()
      }, 250)
    },

    page() {
      this.refreshCompras()
    },

    size() {
      this.page = 0
    },
  },

  methods: {
    formatMoney(n) {
      const num = Number(n ?? 0)
      return num.toLocaleString("es-AR", { style: "currency", currency: "ARS" })
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
      setTimeout(() => (this.success = ""), 2200)
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
      const tipo =
        (raw?.tipoProveedor ?? raw?.tipo ?? "PERSONA") === "EMPRESA" ? "EMPRESA" : "PERSONA"

      const nombre = raw?.nombre ?? ""
      const apellido = raw?.apellido ?? ""
      const razonSocial = raw?.razonSocial ?? ""

      const displayName =
        tipo === "EMPRESA" ? (razonSocial || "—") : `${nombre} ${apellido}`.trim() || "—"

      return { proveedorId, tipo, displayName }
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

    async refreshAll() {
      this.loading = true
      this.error = ""

      try {
        const [provRes, prodRes, catRes, marcaRes, mpRes] = await Promise.all([
          proveedoresApi.list(),
          productosApi.list({ page: 0, size: 9999 }).catch(() => ({ data: [] })),
          categoriasApi.list().catch(() => ({ data: [] })),
          marcasApi.list().catch(() => ({ data: [] })),
          metodosPagoApi.list().catch(() => ({ data: [] })),
        ])

        const provPage = unwrapPage(provRes?.data)
        this.proveedores = provPage.content.map(this.mapProveedorApiToVM)

        const prodPage = unwrapPage(prodRes?.data)
        this.productos = prodPage.content ?? prodRes?.data ?? []

        const catPage = unwrapPage(catRes?.data)
        this.categorias = catPage.content ?? catRes?.data ?? []

        const marcaPage = unwrapPage(marcaRes?.data)
        this.marcas = marcaPage.content ?? marcaRes?.data ?? []

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

    onProductoChange() {
      const prod = this.productos.find(
        (p) => Number(p.productoId ?? p.id) === Number(this.itemDraft.productoId)
      )
      this.itemDraft.precioUnitario = prod ? Number(prod.precioCosto ?? 0) : 0
    },

    async refreshCompras() {
      this.loading = true
      this.error = ""

      try {
        const res = await comprasApi.list({
          page: this.page,
          size: this.size,
          search: this.q.trim() || null,
        })

        const p = unwrapPage(res?.data)
        this.compras = p.content.map(this.mapCompraApiToVM)
        this.totalElements = p.totalElements
        this.totalPages = p.totalPages
        this.page = p.page
        this.size = p.size
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
        impactarStock: false,
      }
      this.itemDraft = { productoId: null, cantidad: 1, precioUnitario: 0 }
    },

    prepareNewProducto() {
      this.error = ""
      this.nuevoProducto = {
        nombre: "",
        codigoProducto: "",
        categoriaId: null,
        marcaId: null,
        precioCosto: 0,
        precioVenta: 0,
        precioMayorista: 0,
      }
    },

    async crearProducto() {
      this.loading = true
      this.error = ""

      try {
        const session = getSession() ?? null
        const userId = Number(session?.userId ?? 1)

        const payload = {
          nombre: String(this.nuevoProducto.nombre || "").trim(),
          codigoProducto: String(this.nuevoProducto.codigoProducto || "").trim() || null,
          categoriaId: this.nuevoProducto.categoriaId ? Number(this.nuevoProducto.categoriaId) : null,
          marcaId: this.nuevoProducto.marcaId ? Number(this.nuevoProducto.marcaId) : null,
          precioCosto: Number(this.nuevoProducto.precioCosto || 0),
          precioVenta: Number(this.nuevoProducto.precioVenta || 0),
          precioMayorista: Number(this.nuevoProducto.precioMayorista || 0),
          userId,
        }

        if (!payload.nombre) throw new Error("Ingresá el nombre del producto.")
        if (payload.precioCosto < 0) throw new Error("Precio costo inválido.")
        if (payload.precioVenta < 0) throw new Error("Precio venta inválido.")
        if (payload.precioMayorista < 0) throw new Error("Precio mayorista inválido.")

        await productosApi.create(payload)

        this.toastSuccess("Producto creado ✅")
        this.prepareNewProducto()

        const prodRes = await productosApi.list({ page: 0, size: 9999 }).catch(() => ({ data: [] }))
        const prodPage = unwrapPage(prodRes?.data)
        this.productos = prodPage.content ?? prodRes?.data ?? []
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || "Error creando producto"
      } finally {
        this.loading = false
      }
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

        const detallesConPrecio = this.form.detalles.map((d) => {
          const prod = this.productos.find((p) => Number(p.productoId ?? p.id) === Number(d.productoId))
          if (!prod) throw new Error(`Producto ${d.productoId} no existe`)
          const precioUnitario = Number(prod.precioCosto ?? d.precioUnitario ?? 0)

          return {
            productoId: d.productoId,
            cantidad: d.cantidad,
            precioUnitario,
          }
        })

        const payload = {
          userId,
          proveedorId: Number(this.form.proveedorId),
          fecha: this.form.fecha,
          detalles: detallesConPrecio,
          impactaStock: Boolean(this.form.impactarStock),
        }

        await comprasApi.create(payload)
        this.toastSuccess("Compra creada ✅")

        this.page = 0
        await this.refreshCompras()
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

        this.detalle = cRes?.data ?? null

        const pagosPage = unwrapPage(pRes?.data)
        this.pagosDetalle = pagosPage.content ?? pRes?.data ?? []
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || "Error cargando detalle"
      } finally {
        this.loading = false
      }
    },

    async preparePago(compraId) {
      this.error = ""
      this.pagoForm = { compraId, monto: 0, metodoPagoId: null, referencia: "" }
      this.compraSeleccionada = this.compras.find((c) => Number(c.compraId) === Number(compraId)) || null
      this.pagadoCompraSeleccionada = 0
      this.saldoCompraSeleccionada = Number(this.compraSeleccionada?.total || 0)

      try {
        const res = await pagosProveedorApi.porCompra(compraId)
        const pagosPage = unwrapPage(res?.data)
        const pagos = pagosPage.content ?? []

        const pagado = pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0)
        const total = Number(this.compraSeleccionada?.total || 0)
        const saldo = Math.max(total - pagado, 0)

        this.pagadoCompraSeleccionada = pagado
        this.saldoCompraSeleccionada = saldo
        this.pagoForm.monto = saldo
      } catch {
        this.pagadoCompraSeleccionada = 0
        this.saldoCompraSeleccionada = Number(this.compraSeleccionada?.total || 0)
        this.pagoForm.monto = this.saldoCompraSeleccionada
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
        if (this.saldoCompraSeleccionada > 0 && monto > this.saldoCompraSeleccionada) {
          throw new Error("El monto supera el saldo pendiente de la compra.")
        }

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

        await this.preparePago(compraId)
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
.compras-page {
  min-height: 100%;
}

.modal-round {
  border-radius: 18px;
}

.filters-bar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.table-main {
  color: #fff;
  font-weight: 600;
}

.table-sub {
  color: rgba(255,255,255,.58);
  font-size: .82rem;
}

.footer-summary {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.pager-minimal {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.detalle-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.detalle-title {
  color: #fff;
  font-weight: 800;
  font-size: 1.05rem;
}

.detalle-total {
  color: #fff;
  font-weight: 800;
  font-size: 1.05rem;
}

@media (max-width: 992px) {
  .filters-grid {
    grid-template-columns: 1fr;
  }
}
</style>