<template>
  <div class="proveedores-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Compras</p>
        <h1 class="page-title mb-1">Proveedores</h1>
        <p class="page-subtitle mb-0">
          Alta, edición, estado y seguimiento de saldo para proveedores.
        </p>
      </div>

      <div class="hero-actions">
        <div class="form-check form-switch m-0 switch-inline">
          <input class="form-check-input" type="checkbox" id="inactive" v-model="includeInactive" />
          <label class="form-check-label helper-text" for="inactive">Ver inactivos</label>
        </div>

        <button
          class="btn btn-primary btn-accent"
          data-bs-toggle="modal"
          data-bs-target="#proveedorModal"
          @click="prepareCreate"
        >
          Nuevo proveedor
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
            Total proveedores: <b>{{ totalElements }}</b> · Mostrando: <b>{{ filtered.length }}</b>
          </div>
        </div>

        <div class="filters-bar">
          <div class="filters-grid">
            <div>
              <label class="form-label field-label">Buscar</label>
              <input
                v-model="q"
                class="form-control app-input"
                placeholder="Nombre, razón social, documento, teléfono o email..."
              />
            </div>

            <div>
              <label class="form-label field-label">Orden</label>
              <select v-model="sortBy" class="form-select app-input">
                <option value="displayName">Nombre</option>
                <option value="createdAt">Creación</option>
                <option value="saldoDesc">Mayor deuda</option>
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
            Consultá contacto, saldo y registrá pagos por compra.
          </div>
        </div>

        <div v-if="filtered.length === 0" class="empty-block">
          <div class="empty-title">No hay proveedores para mostrar</div>
          <div class="helper-text">
            Probá ajustar la búsqueda o crear un proveedor nuevo.
          </div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Contacto</th>
                <th class="text-end">Saldo</th>
                <th class="text-center">Estado</th>
                <th class="text-end">Acciones</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="p in filtered" :key="p.id">
                <td>
                  <div class="table-main d-flex gap-2 align-items-center flex-wrap">
                    <span>{{ p.displayName || "—" }}</span>

                    <span class="badge" :class="p.tipo === 'EMPRESA' ? 'text-bg-info' : 'text-bg-secondary'">
                      {{ p.tipo === "EMPRESA" ? "EMPRESA" : "PERSONA" }}
                    </span>

                    <span class="badge" :class="docBadgeClass(p)">
                      {{ p.documentoLabel || (p.tipo === "EMPRESA" ? "CUIT —" : "DOC —") }}
                    </span>
                  </div>

                  <div v-if="p.direccion" class="table-sub">
                    {{ p.direccion }}
                  </div>

                  <div v-if="p.notas" class="table-sub">
                    {{ p.notas }}
                  </div>
                </td>

                <td class="text-secondary">
                  <div>{{ p.telefono || "—" }}</div>
                  <div class="table-sub">{{ p.email || "—" }}</div>
                </td>

                <td class="text-end">
                  <div class="fw-bold" :class="saldoClass(p)">
                    $ {{ formatMoney(getSaldo(p).saldo) }}
                  </div>
                  <div class="table-sub">Compras: $ {{ formatMoney(getSaldo(p).deudaCompras) }}</div>
                  <div class="table-sub">Pagos: $ {{ formatMoney(getSaldo(p).pagosTotal) }}</div>
                </td>

                <td class="text-center">
                  <span class="badge" :class="p.activo ? 'text-bg-success' : 'text-bg-secondary'">
                    {{ p.activo ? "Activo" : "Inactivo" }}
                  </span>
                </td>

                <td class="text-end">
                  <div class="d-flex justify-content-end gap-2 flex-wrap">
                    <button
                      class="btn btn-sm btn-outline-light"
                      data-bs-toggle="modal"
                      data-bs-target="#proveedorModal"
                      @click="prepareEdit(p)"
                    >
                      Editar
                    </button>

                    <button
                      class="btn btn-sm btn-outline-success"
                      data-bs-toggle="modal"
                      data-bs-target="#pagoModal"
                      @click="preparePago(p)"
                    >
                      Pago
                    </button>

                    <button class="btn btn-sm btn-outline-warning" @click="toggleActivo(p)">
                      {{ p.activo ? "Desactivar" : "Activar" }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer-summary">
          <div class="helper-text">
            El saldo refleja compras menos pagos registrados.
          </div>
        </div>

        <div class="mt-3">
          <div class="pager-minimal">
            <button class="btn btn-sm btn-outline-light" @click="prevPage" :disabled="loading || !canPrev">
              Anterior
            </button>

            <span class="helper-text">
              Página <b>{{ Math.max(1, page) }}</b> de <b>{{ totalPages }}</b>
            </span>

            <button class="btn btn-sm btn-outline-light" @click="nextPage" :disabled="loading || !canNext">
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="proveedorModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-panel border-0 modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">
              {{ mode === "create" ? "Nuevo proveedor" : "Editar proveedor" }}
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div v-if="formError" class="alert alert-danger py-2 mb-3">{{ formError }}</div>

            <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
              <span class="helper-text">Tipo</span>

              <div class="btn-group">
                <button
                  class="btn btn-sm"
                  :class="form.tipo === 'PERSONA' ? 'btn-accent' : 'btn-outline-light'"
                  @click="setTipo('PERSONA')"
                  type="button"
                >
                  Persona
                </button>
                <button
                  class="btn btn-sm"
                  :class="form.tipo === 'EMPRESA' ? 'btn-accent' : 'btn-outline-light'"
                  @click="setTipo('EMPRESA')"
                  type="button"
                >
                  Empresa
                </button>
              </div>
            </div>

            <div class="row g-3">
              <template v-if="form.tipo !== 'EMPRESA'">
                <div class="col-12 col-md-6">
                  <label class="form-label field-label">Nombre *</label>
                  <input v-model="form.nombre" class="form-control app-input" placeholder="Ej: Juan" />
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label field-label">Apellido</label>
                  <input v-model="form.apellido" class="form-control app-input" placeholder="Ej: Pérez" />
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label field-label">Tipo de documento</label>
                  <select v-model="form.documentoTipo" class="form-select app-input">
                    <option value="DNI">DNI</option>
                    <option value="CUIL">CUIL</option>
                    <option value="PASAPORTE">PASAPORTE</option>
                    <option value="OTRO">OTRO</option>
                  </select>
                </div>

                <div class="col-12 col-md-8">
                  <label class="form-label field-label">Número de documento</label>
                  <input
                    v-model="form.documentoNro"
                    class="form-control app-input"
                    inputmode="numeric"
                    placeholder="Ej: 40111222"
                  />
                </div>
              </template>

              <template v-else>
                <div class="col-12">
                  <label class="form-label field-label">Razón social *</label>
                  <input
                    v-model="form.razonSocial"
                    class="form-control app-input"
                    placeholder="Ej: Distribuidora X S.A."
                  />
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label field-label">CUIT *</label>
                  <input
                    v-model="form.cuit"
                    class="form-control app-input"
                    inputmode="numeric"
                    placeholder="Ej: 30712345678"
                  />
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label field-label">Contacto</label>
                  <input
                    v-model="form.contacto"
                    class="form-control app-input"
                    placeholder="Ej: Mariana / Compras"
                  />
                </div>
              </template>

              <div class="col-12 col-md-6">
                <label class="form-label field-label">Teléfono</label>
                <input v-model="form.telefono" class="form-control app-input" />
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label field-label">Email</label>
                <input v-model="form.email" class="form-control app-input" />
              </div>

              <div class="col-12">
                <label class="form-label field-label">Dirección</label>
                <input v-model="form.direccion" class="form-control app-input" />
              </div>

              <div class="col-12">
                <label class="form-label field-label">Notas</label>
                <textarea v-model="form.notas" class="form-control app-input" rows="3"></textarea>
              </div>

              <div class="col-12">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="activo" v-model="form.activo" />
                  <label class="form-check-label helper-text" for="activo">Activo</label>
                </div>
              </div>
            </div>

            <div class="helper-text mt-3">
              Los campos marcados con * son obligatorios.
            </div>
          </div>

          <div class="modal-footer border-secondary">
            <button class="btn btn-outline-light" data-bs-dismiss="modal">Cancelar</button>
            <button class="btn btn-primary btn-accent" @click="saveProveedor" :disabled="loading">
              {{ mode === "create" ? "Crear" : "Guardar cambios" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="pagoModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-panel border-0 modal-round">
          <div class="modal-header border-secondary">
            <div>
              <h5 class="modal-title mb-0">Registrar pago</h5>
              <div class="helper-text" v-if="pagoProveedor">
                Proveedor: <b>{{ pagoProveedor.displayName }}</b>
                · Saldo actual:
                <b :class="saldoClass(pagoProveedor)">
                  $ {{ formatMoney(getSaldo(pagoProveedor).saldo) }}
                </b>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div v-if="pagoError" class="alert alert-danger py-2 mb-3">{{ pagoError }}</div>
            <div v-if="pagoOk" class="alert alert-success py-2 mb-3">{{ pagoOk }}</div>

            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label field-label">Compra a pagar *</label>
                <AppCombobox
                  v-model="pagoCompraId"
                  :items="comprasPendientesItems"
                  placeholder="Buscar compra pendiente..."
                  :disabled="!comprasPendientes.length"
                />
                <div v-if="!comprasPendientes.length" class="helper-text mt-1">
                  No hay compras pendientes para este proveedor.
                </div>
              </div>

              <div class="col-12" v-if="compraSeleccionada">
                <div class="card bg-dark border-secondary">
                  <div class="card-body py-3">
                    <div class="helper-text mb-1">
                      Fecha: <b>{{ formatDate(compraSeleccionada.fecha) }}</b>
                    </div>
                    <div class="helper-text mb-1">
                      Total compra: <b>$ {{ formatMoney(compraSeleccionada.total) }}</b>
                    </div>
                    <div class="helper-text mb-1">
                      Pagado: <b>$ {{ formatMoney(pagadoCompraSeleccionada) }}</b>
                    </div>
                    <div class="helper-text">
                      Saldo pendiente:
                      <b class="text-warning">$ {{ formatMoney(saldoCompraSeleccionada) }}</b>
                    </div>
                  </div>
                </div>
              </div>

              <div class="col-12 col-md-3">
                <label class="form-label field-label">Monto *</label>
                <input
                  v-model.number="pagoMonto"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control app-input"
                />
              </div>

              <div class="col-12 col-md-3">
                <label class="form-label field-label">Método *</label>
                <select v-model.number="pagoMetodoPagoId" class="form-select app-input">
                  <option :value="null">Seleccionar...</option>
                  <option v-for="m in metodosPago" :key="m.metodoPagoId" :value="m.metodoPagoId">
                    {{ m.nombre }}
                  </option>
                </select>
              </div>

              <div class="col-12">
                <label class="form-label field-label">Referencia</label>
                <input v-model="pagoNotas" class="form-control app-input" placeholder="Ej: Factura 0001..." />
              </div>

              <div class="col-12 d-flex justify-content-end">
                <button
                  class="btn btn-primary btn-accent"
                  @click="registrarPago"
                  :disabled="loading || !pagoCompraId || !pagoMetodoPagoId"
                >
                  Guardar pago
                </button>
              </div>
            </div>

            <hr class="border-secondary my-4" />

            <div class="section-header mb-3">
              <h2 class="section-title mb-0">Pagos de la compra seleccionada</h2>
              <div class="helper-text">{{ pagosCompra.length }} pago(s)</div>
            </div>

            <div v-if="pagosCompra.length === 0" class="helper-text">
              No hay pagos registrados para esta compra.
            </div>

            <div v-else class="table-responsive">
              <table class="table table-dark table-hover align-middle app-table mb-0">
                <thead>
                  <tr>
                    <th style="width:90px">Pago</th>
                    <th style="width:140px">Fecha</th>
                    <th class="text-end">Monto</th>
                    <th>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="pg in pagosCompra" :key="pg.pagoProveedorId || pg.id">
                    <td class="text-secondary">#{{ pg.pagoProveedorId || pg.id }}</td>
                    <td class="text-secondary">{{ formatDate(pg.fecha) }}</td>
                    <td class="text-end fw-semibold">$ {{ formatMoney(pg.monto) }}</td>
                    <td class="text-secondary">{{ pg.referencia || "—" }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="helper-text mt-3">
              El pago siempre se registra contra una compra específica.
            </div>
          </div>

          <div class="modal-footer border-secondary">
            <button class="btn btn-outline-light" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue"
import AppCombobox from "../components/AppCombobox.vue"
import { proveedoresApi } from "../services/proveedoresApi"
import { comprasApi } from "../services/comprasApi"
import { pagosProveedorApi } from "../services/pagosProveedorApi"
import { metodosPagoApi } from "../services/metodopagoService"

function unwrapPage(data) {
  if (Array.isArray(data)) {
    return { content: data, page: 1, size: data.length || 10, totalElements: data.length, totalPages: 1 }
  }
  const content = data?.content ?? data?.items ?? data?.data ?? []
  return {
    content: Array.isArray(content) ? content : [],
    page: Number(data?.page ?? data?.number ?? 1),
    size: Number(data?.size ?? data?.pageSize ?? 10),
    totalElements: Number(data?.totalElements ?? data?.total ?? (Array.isArray(content) ? content.length : 0)),
    totalPages: Number(data?.totalPages ?? data?.pages ?? 1),
  }
}

const loading = ref(false)
const proveedores = ref([])
const q = ref("")
const sortBy = ref("displayName")
const includeInactive = ref(false)
const page = ref(1)
const size = ref(10)
const totalElements = ref(0)
const totalPages = ref(1)
const error = ref("")
const success = ref("")
const mode = ref("create")
const editingId = ref(null)
const form = ref({
  tipo: "PERSONA", nombre: "", apellido: "", documentoTipo: "DNI", documentoNro: "",
  razonSocial: "", cuit: "", contacto: "", telefono: "", email: "", direccion: "", notas: "", activo: true,
})
const formError = ref("")
const pagoProveedor = ref(null)
const pagoCompraId = ref(null)
const pagoMonto = ref("")
const pagoNotas = ref("")
const pagoMetodoPagoId = ref(null)
const pagoError = ref("")
const pagoOk = ref("")
const comprasPendientes = ref([])
const pagosCompra = ref([])
const compraSeleccionada = ref(null)
const pagadoCompraSeleccionada = ref(0)
const saldoCompraSeleccionada = ref(0)
const metodosPago = ref([])
const deudasMap = ref(new Map())

// Computeds

const filtered = computed(() => {
  let arr = [...proveedores.value]
  if (!includeInactive.value) arr = arr.filter((p) => p.activo !== false)

  if (sortBy.value === "saldoDesc") {
    arr.sort((a, b) => (getSaldo(b).saldo ?? 0) - (getSaldo(a).saldo ?? 0))
    return arr
  }
  if (sortBy.value === "displayName") arr.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "es"))
  else if (sortBy.value === "createdAt") arr.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
  return arr
})

const canPrev = computed(() => page.value > 1)
const canNext = computed(() => page.value < totalPages.value)

// Items para AppCombobox de compras pendientes
const comprasPendientesItems = computed(() =>
  comprasPendientes.value.map(c => ({
    id: c.compraId,
    label: `Compra #${c.compraId} · ${formatDate(c.fecha)}`,
    sublabel: `Total: $${formatMoney(c.total)} · ${c.estado}`,
  }))
)

// Helpers

function formatMoney(n) {
  return Number(n ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 0 })
}

function formatDate(v) {
  const s = String(v || "")
  return s ? s.slice(0, 10) : "—"
}

function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "") || null
}

function saldoClass(p) {
  const s = getSaldo(p).saldo
  if (s > 0) return "text-warning"
  if (s < 0) return "text-info"
  return "text-success"
}

function docBadgeClass(p) {
  if (p?.tipo === "EMPRESA") return "text-bg-dark border border-info"
  return "text-bg-dark border border-secondary"
}

function toastSuccess(msg) {
  success.value = msg
  setTimeout(() => { success.value = "" }, 2200)
}

function hideModal(id) {
  const modalEl = document.getElementById(id)
  if (!modalEl || !window.bootstrap?.Modal) return
  window.bootstrap.Modal.getInstance(modalEl)?.hide()
}

function mapProveedorApiToVM(raw) {
  const id = Number(raw?.proveedorId ?? raw?.id ?? 0)
  const tipo = (raw?.tipoProveedor ?? "PERSONA") === "EMPRESA" ? "EMPRESA" : "PERSONA"
  const nombre = raw?.nombre ?? ""
  const apellido = raw?.apellido ?? ""
  const dni = raw?.dni ?? ""
  const razonSocial = raw?.razonSocial ?? ""
  const cuit = raw?.cuit ?? ""
  const displayName = tipo === "EMPRESA" ? (razonSocial || "—") : `${nombre} ${apellido}`.trim() || "—"
  const documentoLabel = tipo === "EMPRESA" ? (cuit ? `CUIT ${cuit}` : "CUIT —") : (dni ? `DNI ${dni}` : "DOC —")
  return {
    id, tipo, displayName, documentoLabel, nombre, apellido, documentoTipo: "DNI",
    documentoNro: dni, razonSocial, cuit, contacto: "", telefono: raw?.telefono ?? "",
    email: raw?.email ?? "", direccion: raw?.direccion ?? "", notas: raw?.notas ?? "",
    activo: raw?.activo !== false, createdAt: raw?.createdAt ?? "",
  }
}

function getSaldo(p) {
  const id = Number(p?.id ?? 0)
  const d = deudasMap.value.get(id)
  if (!id || !d) return { deudaCompras: 0, pagosTotal: 0, saldo: 0 }
  const deudaCompras = Number(d.deudaCompras ?? d.deuda ?? 0)
  const pagosTotal = Number(d.pagosTotal ?? d.pagos ?? 0)
  const saldo = Number(d.saldo ?? (deudaCompras - pagosTotal))
  return { deudaCompras, pagosTotal, saldo }
}

// Actions

async function refresh() {
  loading.value = true
  error.value = ""

  try {
    const [provRes, deudasRes, mpRes] = await Promise.all([
      proveedoresApi.list({ page: page.value, size: size.value, search: q.value.trim() || null }),
      proveedoresApi.deudas().catch(() => ({ data: [] })),
      metodosPagoApi.list().catch(() => ({ data: [] })),
    ])

    const provPage = unwrapPage(provRes?.data)
    proveedores.value = provPage.content.map(mapProveedorApiToVM)
    totalElements.value = provPage.totalElements
    totalPages.value = Math.max(1, provPage.totalPages || 1)
    page.value = Math.max(1, provPage.page || 1)

    const deudas = deudasRes?.data ?? []
    deudasMap.value = new Map(
      deudas.map((d) => [
        Number(d.proveedorId ?? d.id),
        {
          proveedorId: Number(d.proveedorId ?? d.id),
          deudaCompras: Number(d.totalCompras ?? d.deudaCompras ?? 0),
          pagosTotal: Number(d.totalPagado ?? d.pagosTotal ?? 0),
          saldo: Number(d.deuda ?? d.saldo ?? 0),
        },
      ])
    )

    metodosPago.value = (unwrapPage(mpRes?.data).content ?? []).map((m) => ({
      metodoPagoId: Number(m?.metodoPagoId ?? m?.id ?? 0),
      nombre: m?.nombre ?? m?.descripcion ?? "—",
    }))
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "Error cargando proveedores"
    proveedores.value = []
    totalElements.value = 0
    totalPages.value = 1
  } finally {
    loading.value = false
  }
}

function prevPage() { if (canPrev.value) page.value-- }
function nextPage() { if (canNext.value) page.value++ }

function setTipo(tipo) {
  form.value.tipo = tipo === "EMPRESA" ? "EMPRESA" : "PERSONA"
  if (form.value.tipo === "EMPRESA") {
    form.value.nombre = ""; form.value.apellido = ""
    form.value.documentoTipo = "DNI"; form.value.documentoNro = ""
  } else {
    form.value.razonSocial = ""; form.value.cuit = ""; form.value.contacto = ""
  }
}

function prepareCreate() {
  mode.value = "create"
  editingId.value = null
  formError.value = ""
  form.value = {
    tipo: "PERSONA", nombre: "", apellido: "", documentoTipo: "DNI", documentoNro: "",
    razonSocial: "", cuit: "", contacto: "", telefono: "", email: "", direccion: "", notas: "", activo: true,
  }
}

function prepareEdit(p) {
  mode.value = "edit"
  editingId.value = p.id
  formError.value = ""
  form.value = {
    tipo: p.tipo === "EMPRESA" ? "EMPRESA" : "PERSONA",
    nombre: p.nombre ?? "", apellido: p.apellido ?? "", documentoTipo: "DNI",
    documentoNro: p.documentoNro ?? "", razonSocial: p.razonSocial ?? "", cuit: p.cuit ?? "",
    contacto: "", telefono: p.telefono ?? "", email: p.email ?? "",
    direccion: p.direccion ?? "", notas: p.notas ?? "", activo: p.activo !== false,
  }
}

function validateForm() {
  if (form.value.tipo === "EMPRESA") {
    if (!String(form.value.razonSocial || "").trim()) return "La razón social es obligatoria."
    if (!String(form.value.cuit || "").replace(/\D/g, "").trim()) return "El CUIT es obligatorio."
  } else {
    if (!String(form.value.nombre || "").trim()) return "El nombre es obligatorio."
  }
  const email = String(form.value.email || "").trim()
  if (email && !email.includes("@")) return "El email no tiene un formato válido."
  return ""
}

async function saveProveedor() {
  formError.value = ""
  const err = validateForm()
  if (err) { formError.value = err; return }

  loading.value = true
  try {
    const tipoProveedor = form.value.tipo === "EMPRESA" ? "EMPRESA" : "PERSONA"

    if (mode.value === "create") {
      await proveedoresApi.create({
        tipoProveedor,
        nombre: tipoProveedor === "PERSONA" ? (form.value.nombre || "").trim() : null,
        apellido: tipoProveedor === "PERSONA" ? (form.value.apellido || "").trim() : null,
        dni: tipoProveedor === "PERSONA" ? onlyDigits(form.value.documentoNro) : null,
        razonSocial: tipoProveedor === "EMPRESA" ? (form.value.razonSocial || "").trim() : null,
        cuit: tipoProveedor === "EMPRESA" ? onlyDigits(form.value.cuit) : null,
        telefono: (form.value.telefono || "").trim() || null,
        email: (form.value.email || "").trim() || null,
        direccion: (form.value.direccion || "").trim() || null,
        notas: (form.value.notas || "").trim() || null,
      })
      toastSuccess("Proveedor creado correctamente.")
    } else {
      const safeNombre = tipoProveedor === "PERSONA"
        ? (form.value.nombre || "").trim()
        : ((form.value.razonSocial || "").trim() || "Empresa")

      await proveedoresApi.update(editingId.value, {
        proveedorId: Number(editingId.value), tipoProveedor, nombre: safeNombre,
        apellido: tipoProveedor === "PERSONA" ? (form.value.apellido || "").trim() || null : null,
        dni: tipoProveedor === "PERSONA" ? onlyDigits(form.value.documentoNro) : null,
        razonSocial: tipoProveedor === "EMPRESA" ? (form.value.razonSocial || "").trim() : null,
        cuit: tipoProveedor === "EMPRESA" ? onlyDigits(form.value.cuit) : null,
        telefono: (form.value.telefono || "").trim() || null,
        email: (form.value.email || "").trim() || null,
        direccion: (form.value.direccion || "").trim() || null,
        notas: (form.value.notas || "").trim() || null,
        activo: !!form.value.activo,
      })
      toastSuccess("Proveedor actualizado correctamente.")
    }

    await refresh()
    hideModal("proveedorModal")
  } catch (e) {
    formError.value = e?.response?.data?.error || e?.message || "No se pudo guardar"
  } finally {
    loading.value = false
  }
}

async function toggleActivo(p) {
  error.value = ""
  loading.value = true
  try {
    const tipoProveedor = p.tipo === "EMPRESA" ? "EMPRESA" : "PERSONA"
    const safeNombre = tipoProveedor === "PERSONA"
      ? (p.nombre || "").trim()
      : ((p.razonSocial || "").trim() || "Empresa")

    await proveedoresApi.update(p.id, {
      proveedorId: Number(p.id), tipoProveedor, nombre: safeNombre,
      apellido: tipoProveedor === "PERSONA" ? (p.apellido || "").trim() || null : null,
      dni: tipoProveedor === "PERSONA" ? onlyDigits(p.documentoNro) : null,
      razonSocial: tipoProveedor === "EMPRESA" ? (p.razonSocial || "").trim() : null,
      cuit: tipoProveedor === "EMPRESA" ? onlyDigits(p.cuit) : null,
      telefono: (p.telefono || "").trim() || null,
      email: (p.email || "").trim() || null,
      direccion: (p.direccion || "").trim() || null,
      notas: (p.notas || "").trim() || null,
      activo: !p.activo,
    })
    await refresh()
    toastSuccess(p.activo ? "Proveedor desactivado" : "Proveedor activado")
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || "No se pudo cambiar el estado"
  } finally {
    loading.value = false
  }
}

async function cargarDetalleCompraPago(compraId) {
  compraSeleccionada.value = comprasPendientes.value.find((c) => Number(c.compraId) === Number(compraId)) || null
  pagosCompra.value = []
  pagadoCompraSeleccionada.value = 0
  saldoCompraSeleccionada.value = Number(compraSeleccionada.value?.total || 0)

  if (!compraId) return

  try {
    const res = await pagosProveedorApi.porCompra(compraId)
    pagosCompra.value = unwrapPage(res?.data).content ?? []
    const pagado = pagosCompra.value.reduce((acc, x) => acc + Number(x.monto || 0), 0)
    const total = Number(compraSeleccionada.value?.total || 0)
    const saldo = Math.max(total - pagado, 0)
    pagadoCompraSeleccionada.value = pagado
    saldoCompraSeleccionada.value = saldo
    if (!pagoMonto.value || Number(pagoMonto.value) <= 0) pagoMonto.value = saldo
  } catch {
    pagosCompra.value = []
    pagadoCompraSeleccionada.value = 0
    saldoCompraSeleccionada.value = Number(compraSeleccionada.value?.total || 0)
  }
}

async function preparePago(p) {
  pagoProveedor.value = p
  pagoCompraId.value = null
  pagoMonto.value = ""
  pagoNotas.value = ""
  pagoMetodoPagoId.value = null
  pagoError.value = ""
  pagoOk.value = ""
  comprasPendientes.value = []
  pagosCompra.value = []
  compraSeleccionada.value = null
  pagadoCompraSeleccionada.value = 0
  saldoCompraSeleccionada.value = 0

  loading.value = true
  try {
    const res = await comprasApi.list({ page: 1, size: 9999, search: "" })
    const allRaw = unwrapPage(res?.data).content ?? []
    const pid = Number(p.id)

    comprasPendientes.value = allRaw
      .map((x) => {
        const c = x?.compra ?? x ?? {}
        return {
          compraId: Number(c.compraId ?? c.id ?? 0),
          proveedorId: Number(c.proveedorId ?? 0),
          fecha: c.fecha ?? "",
          total: Number(c.total ?? 0),
          estado: c.estado ?? "—",
        }
      })
      .filter((c) => Number(c.proveedorId) === pid)
      .filter((c) => !["PAGADA", "ANULADA"].includes(String(c.estado || "").toUpperCase()))
      .sort((a, b) => Number(b.compraId) - Number(a.compraId))
  } catch {
    comprasPendientes.value = []
  } finally {
    loading.value = false
  }
}

async function registrarPago() {
  pagoError.value = ""
  pagoOk.value = ""

  if (!pagoProveedor.value?.id) { pagoError.value = "Proveedor inválido"; return }
  const compraId = Number(pagoCompraId.value || 0)
  if (!compraId) { pagoError.value = "Seleccioná una compra"; return }
  const metodoPagoId = Number(pagoMetodoPagoId.value || 0)
  if (!metodoPagoId) { pagoError.value = "Seleccioná un método de pago"; return }
  const monto = Number(pagoMonto.value || 0)
  if (monto <= 0) { pagoError.value = "Monto inválido"; return }
  if (saldoCompraSeleccionada.value > 0 && monto > saldoCompraSeleccionada.value) {
    pagoError.value = "El monto supera el saldo pendiente de la compra."
    return
  }

  loading.value = true
  try {
    await pagosProveedorApi.create({
      compraId, metodoPagoId, monto,
      referencia: (pagoNotas.value || "").trim() || null,
    })
    pagoOk.value = "Pago registrado correctamente."
    pagoNotas.value = ""
    pagoMonto.value = ""
    await cargarDetalleCompraPago(compraId)
    await refresh()
  } catch (e) {
    pagoError.value = e?.response?.data?.error || e?.message || "No se pudo registrar el pago"
  } finally {
    loading.value = false
  }
}

// Watchers

let _t = null
watch(q, () => {
  clearTimeout(_t)
  _t = setTimeout(() => {
    if (page.value !== 1) page.value = 1
    else refresh()
  }, 300)
})

watch(pagoCompraId, async (newId) => {
  await cargarDetalleCompraPago(newId)
})

onMounted(() => refresh())
onBeforeUnmount(() => { if (_t) clearTimeout(_t) })
</script>

<style scoped>
.proveedores-page {
  min-height: 100%;
}
</style>