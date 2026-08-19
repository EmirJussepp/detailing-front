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

                <td class="text-end td-num fw-semibold">
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
                <AppCombobox
                  v-model="form.proveedorId"
                  :items="proveedoresItems"
                  placeholder="Buscar proveedor..."
                />
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
                <AppCombobox
                  v-model="itemDraft.productoId"
                  :items="productosItems"
                  placeholder="Buscar producto o código..."
                  @picked="onProductoChange"
                />
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
                    <td class="td-num">{{ d.cantidad }}</td>
                    <td class="text-end td-num">$ {{ formatMoney(d.precioUnitario) }}</td>
                    <td class="text-end td-num fw-semibold">$ {{ formatMoney(d.cantidad * d.precioUnitario) }}</td>
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
                      <td class="td-num">{{ d.cantidad }}</td>
                      <td class="text-end td-num">$ {{ formatMoney(d.precioUnitario) }}</td>
                      <td class="text-end td-num fw-semibold">$ {{ formatMoney(d.cantidad * d.precioUnitario) }}</td>
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
                      <td class="td-code">#{{ p.pagoProveedorId || p.id }}</td>
                      <td class="td-num" style="color:rgba(255,255,255,0.55)">{{ (p.fecha || "").slice(0, 10) || "—" }}</td>
                      <td class="text-end td-num fw-semibold">$ {{ formatMoney(p.monto) }}</td>
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
        <div>
          <h5 class="modal-title mb-0">Nuevo producto</h5>
          <div class="helper-text mt-1">
            Creá un producto nuevo para usarlo en compras y controlar stock.
          </div>
        </div>

        <button
          type="button"
          class="btn-close btn-close-white"
          data-bs-dismiss="modal"
        ></button>
      </div>

      <div class="modal-body">
        <div class="row g-3">
          <div class="col-12 col-md-8">
            <label class="form-label field-label">Nombre</label>
            <input
              v-model="nuevoProducto.nombre"
              class="form-control app-input"
              placeholder="Ej: Shampoo siliconado"
            />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label field-label">Código</label>
            <input
              v-model="nuevoProducto.codigoProducto"
              class="form-control app-input"
              placeholder="Ej: SHAMP001"
            />
          </div>

          <div class="col-12">
            <hr class="border-secondary my-1" />
          </div>

          <div class="col-12">
            <div class="section-header mb-1">
              <h2 class="section-title mb-0">Clasificación</h2>
              <div class="helper-text">
                Organizá el producto para encontrarlo más fácil.
              </div>
            </div>
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

          <div class="col-12">
            <hr class="border-secondary my-1" />
          </div>

          <div class="col-12">
            <div class="section-header mb-1">
              <h2 class="section-title mb-0">Precios y stock</h2>
              <div class="helper-text">
                Definí valores iniciales y el stock mínimo recomendado.
              </div>
            </div>
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label field-label">Precio costo</label>
            <input
              v-model.number="nuevoProducto.precioCosto"
              type="number"
              min="0"
              step="0.01"
              class="form-control app-input"
              placeholder="0"
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
              placeholder="0"
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
              placeholder="0"
            />
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label field-label">Stock mínimo</label>
            <input
              v-model.number="nuevoProducto.stockMinimo"
              type="number"
              min="0"
              step="1"
              class="form-control app-input"
              placeholder="Ej: 5"
            />
            <div class="helper-text mt-1">
              Agregalo para mostrar alertas chicas cuando el stock esté bajo.
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer border-secondary">
        <button class="btn btn-outline-light" data-bs-dismiss="modal">
          Cancelar
        </button>

        <button
          class="btn btn-primary btn-accent"
          :disabled="loading"
          @click="crearProducto"
        >
          {{ loading ? "Guardando..." : "Guardar producto" }}
        </button>
      </div>
    </div>
  </div>
</div>
</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue"
import AppCombobox from "../components/AppCombobox.vue"
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

const loading = ref(false)
const error = ref("")
const success = ref("")

const q = ref("")
const sortBy = ref("fechaDesc")

const page = ref(1)
const size = ref(10)
const totalElements = ref(0)
const totalPages = ref(1)

const proveedores = ref([])
const productos = ref([])
const categorias = ref([])
const marcas = ref([])
const compras = ref([])
const metodosPago = ref([])

const form = ref({
  proveedorId: null,
  fecha: new Date().toISOString().slice(0, 10),
  detalles: [],
  impactarStock: false,
})

const itemDraft = ref({
  productoId: null,
  cantidad: 1,
  precioUnitario: 0,
})

const nuevoProducto = ref({
  nombre: "",
  codigoProducto: "",
  categoriaId: null,
  marcaId: null,
  precioCosto: 0,
  precioVenta: 0,
  precioMayorista: 0,
  stockMinimo: 0,
})

const detalle = ref(null)
const pagosDetalle = ref([])

const pagoForm = ref({
  compraId: null,
  monto: 0,
  metodoPagoId: null,
  referencia: "",
})

const compraSeleccionada = ref(null)
const pagadoCompraSeleccionada = ref(0)
const saldoCompraSeleccionada = ref(0)

// Computeds

const totalDraft = computed(() =>
  (form.value.detalles || []).reduce(
    (acc, d) => acc + Number(d.cantidad) * Number(d.precioUnitario),
    0
  )
)

const comprasFiltradas = computed(() => {
  let arr = [...compras.value]
  const t = String(q.value || "").trim().toLowerCase()

  if (t) {
    arr = arr.filter((c) => {
      const id = String(c.compraId || "")
      const prov = proveedorName(c.proveedorId).toLowerCase()
      return id.includes(t) || prov.includes(t)
    })
  }

  switch (sortBy.value) {
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
        proveedorName(a.proveedorId).localeCompare(proveedorName(b.proveedorId), "es")
      )
      break
    case "estado":
      arr.sort((a, b) => String(a.estado || "").localeCompare(String(b.estado || ""), "es"))
      break
  }

  return arr
})

const canPrev = computed(() => page.value > 0)
const canNext = computed(() => page.value < totalPages.value - 1)

// Items para AppCombobox
const proveedoresItems = computed(() =>
  proveedores.value.map(p => ({
    id: p.proveedorId,
    label: p.displayName,
  }))
)

const productosItems = computed(() =>
  productos.value.map(p => ({
    id: Number(p.productoId ?? p.id),
    label: p.nombre,
    sublabel: p.codigoProducto ? `Cód: ${p.codigoProducto}` : null,
  }))
)

// Helpers

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS" })
}

function estadoBadgeClass(estado) {
  const e = String(estado || "").toUpperCase()
  if (e === "PAGADA") return "text-bg-success"
  if (e === "PENDIENTE" || e === "PARCIAL") return "text-bg-warning"
  if (e === "ANULADA") return "text-bg-secondary"
  return "text-bg-dark border border-secondary"
}

function toastSuccess(msg) {
  success.value = msg
  setTimeout(() => (success.value = ""), 2200)
}

function hideModal(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.classList.remove("show")
  el.style.display = "none"
  el.setAttribute("aria-hidden", "true")
  el.removeAttribute("aria-modal")
  el.removeAttribute("role")
  document.querySelectorAll(".modal-backdrop").forEach(b => b.remove())
  document.body.classList.remove("modal-open")
  document.body.style.removeProperty("overflow")
  document.body.style.removeProperty("padding-right")
}

function productoName(id) {
  const pid = Number(id)
  const p = productos.value.find((x) => Number(x.productoId ?? x.id) === pid)
  return p?.nombre ?? `#${id}`
}

function proveedorName(id) {
  const pid = Number(id)
  const p = proveedores.value.find((x) => Number(x.proveedorId ?? x.id) === pid)
  if (!p) return pid ? `#${pid}` : "#—"
  return p.displayName || `#${pid}`
}

function mapProveedorApiToVM(raw) {
  const proveedorId = Number(raw?.proveedorId ?? raw?.id ?? 0)
  const tipo = (raw?.tipoProveedor ?? raw?.tipo ?? "PERSONA") === "EMPRESA" ? "EMPRESA" : "PERSONA"
  const nombre = raw?.nombre ?? ""
  const apellido = raw?.apellido ?? ""
  const razonSocial = raw?.razonSocial ?? ""
  const displayName = tipo === "EMPRESA" ? (razonSocial || "—") : `${nombre} ${apellido}`.trim() || "—"
  return { proveedorId, tipo, displayName }
}

function mapCompraApiToVM(raw) {
  const c = raw?.compra ?? raw ?? {}
  return {
    compraId: Number(c?.compraId ?? c?.id ?? 0),
    proveedorId: Number(c?.proveedorId ?? 0),
    fecha: c?.fecha ?? c?.createdAt ?? "",
    total: Number(c?.total ?? 0),
    estado: c?.estado ?? "—",
  }
}

// Actions

async function refreshAll() {
  loading.value = true
  error.value = ""

  try {
    const [provRes, prodRes, catRes, marcaRes, mpRes] = await Promise.all([
      proveedoresApi.list(),
      productosApi.list({ page: 0, size: 9999 }).catch(() => ({ data: [] })),
      categoriasApi.list().catch(() => ({ data: [] })),
      marcasApi.list().catch(() => ({ data: [] })),
      metodosPagoApi.list().catch(() => ({ data: [] })),
    ])

    proveedores.value = unwrapPage(provRes?.data).content.map(mapProveedorApiToVM)
    productos.value = unwrapPage(prodRes?.data).content ?? prodRes?.data ?? []
    categorias.value = unwrapPage(catRes?.data).content ?? catRes?.data ?? []
    marcas.value = unwrapPage(marcaRes?.data).content ?? marcaRes?.data ?? []
    metodosPago.value = (unwrapPage(mpRes?.data).content ?? mpRes?.data ?? []).map((m) => ({
      metodoPagoId: Number(m?.metodoPagoId ?? m?.id ?? 0),
      nombre: m?.nombre ?? m?.descripcion ?? "—",
    }))

    await refreshCompras()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error cargando compras"
  } finally {
    loading.value = false
  }
}

function onProductoChange(item) {
  const id = item?.id ?? itemDraft.value.productoId
  const prod = productos.value.find(
    (p) => Number(p.productoId ?? p.id) === Number(id)
  )
  itemDraft.value.precioUnitario = prod ? Number(prod.precioCosto ?? 0) : 0
}

async function refreshCompras() {
  loading.value = true
  error.value = ""

  try {
    const res = await comprasApi.list({
      page: page.value,
      size: size.value,
      search: q.value.trim() || null,
    })

    const p = unwrapPage(res?.data)
    compras.value = p.content.map(mapCompraApiToVM)
    totalElements.value = p.totalElements
    totalPages.value = p.totalPages
    page.value = p.page
    size.value = p.size
  } catch (e) {
    compras.value = []
    totalElements.value = 0
    totalPages.value = 1
    error.value = e?.response?.data?.error || e?.message || "Error cargando compras"
  } finally {
    loading.value = false
  }
}

function prevPage() {
  if (!canPrev.value) return
  page.value--
}

function nextPage() {
  if (!canNext.value) return
  page.value++
}

function prepareCreate() {
  error.value = ""
  form.value = {
    proveedorId: null,
    fecha: new Date().toISOString().slice(0, 10),
    detalles: [],
    impactarStock: false,
  }
  itemDraft.value = { productoId: null, cantidad: 1, precioUnitario: 0 }
}

function prepareNewProducto() {
  error.value = ""
  nuevoProducto.value = {
    nombre: "",
    codigoProducto: "",
    categoriaId: null,
    marcaId: null,
    precioCosto: 0,
    precioVenta: 0,
    precioMayorista: 0,
    stockMinimo: 0,
  }
}

async function crearProducto() {
  loading.value = true
  error.value = ""

  try {
    const session = getSession() ?? null
    const userId = Number(session?.userId ?? 1)

    const payload = {
      nombre: String(nuevoProducto.value.nombre || "").trim(),
      codigoProducto: String(nuevoProducto.value.codigoProducto || "").trim() || null,
      categoriaId: nuevoProducto.value.categoriaId ? Number(nuevoProducto.value.categoriaId) : null,
      marcaId: nuevoProducto.value.marcaId ? Number(nuevoProducto.value.marcaId) : null,
      precioCosto: Number(nuevoProducto.value.precioCosto || 0),
      precioVenta: Number(nuevoProducto.value.precioVenta || 0),
      precioMayorista: Number(nuevoProducto.value.precioMayorista || 0),
      stockMinimo: Number(nuevoProducto.value.stockMinimo || 0),
      userId,
    }

    if (!payload.nombre) throw new Error("Ingresá el nombre del producto.")
    if (payload.precioCosto < 0) throw new Error("Precio costo inválido.")
    if (payload.precioVenta < 0) throw new Error("Precio venta inválido.")
    if (payload.precioMayorista < 0) throw new Error("Precio mayorista inválido.")
    if (payload.stockMinimo < 0) throw new Error("Stock mínimo inválido.")

    await productosApi.create(payload)
    toastSuccess("Producto creado correctamente.")
    hideModal("nuevoProductoModal")
    prepareNewProducto()

    const prodRes = await productosApi.list({ page: 0, size: 9999 }).catch(() => ({ data: [] }))
    productos.value = unwrapPage(prodRes?.data).content ?? prodRes?.data ?? []
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error creando producto"
  } finally {
    loading.value = false
  }
}

function addItem() {
  error.value = ""
  const productoId = Number(itemDraft.value.productoId || 0)
  const cantidad = Number(itemDraft.value.cantidad || 0)
  const precioUnitario = Number(itemDraft.value.precioUnitario || 0)

  if (!productoId) { error.value = "Elegí un producto"; return }
  if (cantidad <= 0) { error.value = "Cantidad inválida"; return }
  if (precioUnitario < 0) { error.value = "Precio inválido"; return }

  form.value.detalles.push({ productoId, cantidad, precioUnitario })
  itemDraft.value = { productoId: null, cantidad: 1, precioUnitario: 0 }
}

function removeItem(idx) {
  form.value.detalles.splice(idx, 1)
}

async function crearCompra() {
  loading.value = true
  error.value = ""

  try {
    const session = getSession() ?? null
    const userId = Number(session?.userId ?? 1)

    if (!form.value.proveedorId) throw new Error("Seleccioná proveedor")
    if (!form.value.detalles.length) throw new Error("Agregá al menos 1 ítem")

    const detallesConPrecio = form.value.detalles.map((d) => {
      const prod = productos.value.find((p) => Number(p.productoId ?? p.id) === Number(d.productoId))
      if (!prod) throw new Error(`Producto ${d.productoId} no encontrado`)
      return {
        productoId: d.productoId,
        cantidad: d.cantidad,
        precioUnitario: Number(prod.precioCosto ?? d.precioUnitario ?? 0),
      }
    })

    await comprasApi.create({
      userId,
      proveedorId: Number(form.value.proveedorId),
      fecha: form.value.fecha,
      detalles: detallesConPrecio,
      impactaStock: Boolean(form.value.impactarStock),
    })

    toastSuccess("Compra creada correctamente.")
    hideModal("compraModal")
    page.value = 1
    await refreshCompras()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error creando compra"
  } finally {
    loading.value = false
  }
}

async function openDetalle(compraId) {
  detalle.value = null
  pagosDetalle.value = []
  loading.value = true
  error.value = ""

  try {
    const [cRes, pRes] = await Promise.all([
      comprasApi.porId(compraId),
      pagosProveedorApi.porCompra(compraId),
    ])

    detalle.value = cRes?.data ?? null
    pagosDetalle.value = unwrapPage(pRes?.data).content ?? pRes?.data ?? []
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error cargando detalle"
  } finally {
    loading.value = false
  }
}

async function preparePago(compraId) {
  error.value = ""
  pagoForm.value = { compraId, monto: 0, metodoPagoId: null, referencia: "" }
  compraSeleccionada.value = compras.value.find((c) => Number(c.compraId) === Number(compraId)) || null
  pagadoCompraSeleccionada.value = 0
  saldoCompraSeleccionada.value = Number(compraSeleccionada.value?.total || 0)

  try {
    const res = await pagosProveedorApi.porCompra(compraId)
    const pagos = unwrapPage(res?.data).content ?? []
    const pagado = pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0)
    const total = Number(compraSeleccionada.value?.total || 0)
    const saldo = Math.max(total - pagado, 0)

    pagadoCompraSeleccionada.value = pagado
    saldoCompraSeleccionada.value = saldo
    pagoForm.value.monto = saldo
  } catch {
    pagadoCompraSeleccionada.value = 0
    saldoCompraSeleccionada.value = Number(compraSeleccionada.value?.total || 0)
    pagoForm.value.monto = saldoCompraSeleccionada.value
  }
}

async function registrarPago() {
  loading.value = true
  error.value = ""

  try {
    const compraId = Number(pagoForm.value.compraId || 0)
    const monto = Number(pagoForm.value.monto || 0)
    const metodoPagoId = Number(pagoForm.value.metodoPagoId || 0)

    if (!compraId) throw new Error("Compra inválida")
    if (monto <= 0) throw new Error("Monto inválido")
    if (!metodoPagoId) throw new Error("Elegí un método de pago")
    if (saldoCompraSeleccionada.value > 0 && monto > saldoCompraSeleccionada.value) {
      throw new Error("El monto supera el saldo pendiente de la compra.")
    }

    await pagosProveedorApi.create({
      compraId,
      metodoPagoId,
      monto,
      referencia: (pagoForm.value.referencia || "").trim() || null,
    })

    toastSuccess("Pago registrado correctamente.")
    await refreshCompras()

    if (detalle.value?.compra?.compraId === compraId) {
      await openDetalle(compraId)
    }

    await preparePago(compraId)
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error registrando pago"
  } finally {
    loading.value = false
  }
}

// Watchers

let _t = null
watch(q, () => {
  clearTimeout(_t)
  _t = setTimeout(() => {
    page.value = 0
    refreshCompras()
  }, 250)
})

watch(page, () => {
  refreshCompras()
})

onMounted(() => {
  refreshAll()
})

onBeforeUnmount(() => {
  document.querySelectorAll(".modal.show").forEach(el => {
    el.classList.remove("show")
    el.style.display = "none"
    el.setAttribute("aria-hidden", "true")
    el.removeAttribute("aria-modal")
    el.removeAttribute("role")
  })
  document.querySelectorAll(".modal-backdrop").forEach(el => el.remove())
  document.body.classList.remove("modal-open")
  document.body.style.removeProperty("overflow")
  document.body.style.removeProperty("padding-right")
})
</script>

<style scoped>
.compras-page {
  min-height: 100%;
}

.detalle-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.detalle-title,
.detalle-total {
  color: #fff;
  font-weight: 800;
  font-size: 1.05rem;
}
</style>