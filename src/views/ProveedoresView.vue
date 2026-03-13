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
              Se valida unicidad por documento, CUIT y razón social.
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
                <select v-model.number="pagoCompraId" class="form-select app-input">
                  <option :value="null">Seleccionar compra pendiente...</option>
                  <option v-for="c in comprasPendientes" :key="c.compraId" :value="c.compraId">
                    Compra #{{ c.compraId }} · {{ formatDate(c.fecha) }} · Total ${{ formatMoney(c.total) }}
                  </option>
                </select>
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

<script>
import { proveedoresApi } from "../services/proveedoresApi"
import { comprasApi } from "../services/comprasApi"
import { pagosProveedorApi } from "../services/pagosProveedorApi"
import { metodosPagoApi } from "../services/metodopagoService"

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
  name: "ProveedoresView",

  data() {
    return {
      loading: false,

      proveedores: [],
      q: "",
      sortBy: "displayName",
      includeInactive: false,

      page: 1,
      size: 10,
      totalElements: 0,
      totalPages: 1,

      error: "",
      success: "",

      mode: "create",
      editingId: null,
      form: {
        tipo: "PERSONA",
        nombre: "",
        apellido: "",
        documentoTipo: "DNI",
        documentoNro: "",
        razonSocial: "",
        cuit: "",
        contacto: "",
        telefono: "",
        email: "",
        direccion: "",
        notas: "",
        activo: true,
      },
      formError: "",

      pagoProveedor: null,
      pagoCompraId: null,
      pagoMonto: "",
      pagoNotas: "",
      pagoMetodoPagoId: null,
      pagoError: "",
      pagoOk: "",
      comprasPendientes: [],
      pagosCompra: [],
      compraSeleccionada: null,
      pagadoCompraSeleccionada: 0,
      saldoCompraSeleccionada: 0,

      metodosPago: [],
      deudasMap: new Map(),

      _t: null,
    }
  },

  computed: {
    filtered() {
      let arr = [...this.proveedores]

      if (!this.includeInactive) {
        arr = arr.filter((p) => p.activo !== false)
      }

      if (this.sortBy === "saldoDesc") {
        arr.sort((a, b) => (this.getSaldo(b).saldo ?? 0) - (this.getSaldo(a).saldo ?? 0))
        return arr
      }

      if (this.sortBy === "displayName") {
        arr.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "es"))
      } else if (this.sortBy === "createdAt") {
        arr.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
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
    this.refresh()
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
          this.refresh()
        }
      }, 300)
    },

    async pagoCompraId(newId) {
      await this.cargarDetalleCompraPago(newId)
    },
  },

  methods: {
    formatMoney(n) {
      const num = Number(n ?? 0)
      return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
    },

    formatDate(v) {
      const s = String(v || "")
      return s ? s.slice(0, 10) : "—"
    },

    onlyDigits(v) {
      return String(v || "").replace(/\D/g, "") || null
    },

    saldoClass(p) {
      const s = this.getSaldo(p).saldo
      if (s > 0) return "text-warning"
      if (s < 0) return "text-info"
      return "text-success"
    },

    docBadgeClass(p) {
      if (p?.tipo === "EMPRESA") return "text-bg-dark border border-info"
      return "text-bg-dark border border-secondary"
    },

    toastSuccess(msg) {
      this.success = msg
      setTimeout(() => {
        this.success = ""
      }, 2200)
    },

    hideModal(id) {
      const modalEl = document.getElementById(id)
      if (!modalEl || !window.bootstrap?.Modal) return
      const instance = window.bootstrap.Modal.getInstance(modalEl)
      instance?.hide()
    },

    mapProveedorApiToVM(raw) {
      const id = Number(raw?.proveedorId ?? raw?.id ?? 0)
      const tipo = (raw?.tipoProveedor ?? "PERSONA") === "EMPRESA" ? "EMPRESA" : "PERSONA"

      const nombre = raw?.nombre ?? ""
      const apellido = raw?.apellido ?? ""
      const dni = raw?.dni ?? ""
      const razonSocial = raw?.razonSocial ?? ""
      const cuit = raw?.cuit ?? ""

      const displayName =
        tipo === "EMPRESA" ? (razonSocial || "—") : `${nombre} ${apellido}`.trim() || "—"

      const documentoLabel =
        tipo === "EMPRESA" ? (cuit ? `CUIT ${cuit}` : "CUIT —") : (dni ? `DNI ${dni}` : "DOC —")

      return {
        id,
        tipo,
        displayName,
        documentoLabel,
        nombre,
        apellido,
        documentoTipo: "DNI",
        documentoNro: dni,
        razonSocial,
        cuit,
        contacto: "",
        telefono: raw?.telefono ?? "",
        email: raw?.email ?? "",
        direccion: raw?.direccion ?? "",
        notas: raw?.notas ?? "",
        activo: raw?.activo !== false,
        createdAt: raw?.createdAt ?? "",
      }
    },

    getSaldo(p) {
      const id = Number(p?.id ?? 0)
      const d = this.deudasMap.get(id)

      if (!id || !d) {
        return { deudaCompras: 0, pagosTotal: 0, saldo: 0 }
      }

      const deudaCompras = Number(d.deudaCompras ?? d.deuda ?? 0)
      const pagosTotal = Number(d.pagosTotal ?? d.pagos ?? 0)
      const saldo = Number(d.saldo ?? (deudaCompras - pagosTotal))

      return { deudaCompras, pagosTotal, saldo }
    },

    async refresh() {
      this.loading = true
      this.error = ""

      try {
        const [provRes, deudasRes, mpRes] = await Promise.all([
          proveedoresApi.list({
            page: this.page,
            size: this.size,
            search: this.q.trim() || null,
          }),
          proveedoresApi.deudas().catch(() => ({ data: [] })),
          metodosPagoApi.list().catch(() => ({ data: [] })),
        ])

        const provPage = unwrapPage(provRes?.data)
        this.proveedores = provPage.content.map(this.mapProveedorApiToVM)
        this.totalElements = provPage.totalElements
        this.totalPages = Math.max(1, provPage.totalPages || 1)
        this.page = Math.max(1, provPage.page || 1)

        const deudas = deudasRes?.data ?? []
        this.deudasMap = new Map(
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

        const mp = unwrapPage(mpRes?.data)
        this.metodosPago = (mp.content ?? []).map((m) => ({
          metodoPagoId: Number(m?.metodoPagoId ?? m?.id ?? 0),
          nombre: m?.nombre ?? m?.descripcion ?? "—",
        }))
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || "Error cargando proveedores"
        this.proveedores = []
        this.totalElements = 0
        this.totalPages = 1
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

    setTipo(tipo) {
      this.form.tipo = tipo === "EMPRESA" ? "EMPRESA" : "PERSONA"

      if (this.form.tipo === "EMPRESA") {
        this.form.nombre = ""
        this.form.apellido = ""
        this.form.documentoTipo = "DNI"
        this.form.documentoNro = ""
      } else {
        this.form.razonSocial = ""
        this.form.cuit = ""
        this.form.contacto = ""
      }
    },

    prepareCreate() {
      this.mode = "create"
      this.editingId = null
      this.formError = ""
      this.form = {
        tipo: "PERSONA",
        nombre: "",
        apellido: "",
        documentoTipo: "DNI",
        documentoNro: "",
        razonSocial: "",
        cuit: "",
        contacto: "",
        telefono: "",
        email: "",
        direccion: "",
        notas: "",
        activo: true,
      }
    },

    prepareEdit(p) {
      this.mode = "edit"
      this.editingId = p.id
      this.formError = ""

      const tipo = p.tipo === "EMPRESA" ? "EMPRESA" : "PERSONA"

      this.form = {
        tipo,
        nombre: p.nombre ?? "",
        apellido: p.apellido ?? "",
        documentoTipo: "DNI",
        documentoNro: p.documentoNro ?? "",
        razonSocial: p.razonSocial ?? "",
        cuit: p.cuit ?? "",
        contacto: "",
        telefono: p.telefono ?? "",
        email: p.email ?? "",
        direccion: p.direccion ?? "",
        notas: p.notas ?? "",
        activo: p.activo !== false,
      }
    },

    validateForm() {
      if (this.form.tipo === "EMPRESA") {
        if (!String(this.form.razonSocial || "").trim()) return "La razón social es obligatoria."
        if (!String(this.form.cuit || "").replace(/\D/g, "").trim()) return "El CUIT es obligatorio."
      } else {
        if (!String(this.form.nombre || "").trim()) return "El nombre es obligatorio."
      }

      const email = String(this.form.email || "").trim()
      if (email && !email.includes("@")) return "El email no tiene un formato válido."

      return ""
    },

    async saveProveedor() {
      this.formError = ""
      const err = this.validateForm()
      if (err) {
        this.formError = err
        return
      }

      this.loading = true
      try {
        const tipoProveedor = this.form.tipo === "EMPRESA" ? "EMPRESA" : "PERSONA"

        if (this.mode === "create") {
          const payload = {
            tipoProveedor,
            nombre: tipoProveedor === "PERSONA" ? (this.form.nombre || "").trim() : null,
            apellido: tipoProveedor === "PERSONA" ? (this.form.apellido || "").trim() : null,
            dni: tipoProveedor === "PERSONA" ? this.onlyDigits(this.form.documentoNro) : null,
            razonSocial: tipoProveedor === "EMPRESA" ? (this.form.razonSocial || "").trim() : null,
            cuit: tipoProveedor === "EMPRESA" ? this.onlyDigits(this.form.cuit) : null,
            telefono: (this.form.telefono || "").trim() || null,
            email: (this.form.email || "").trim() || null,
            direccion: (this.form.direccion || "").trim() || null,
            notas: (this.form.notas || "").trim() || null,
          }

          await proveedoresApi.create(payload)
          this.toastSuccess("Proveedor creado ✅")
        } else {
          const safeNombre =
            tipoProveedor === "PERSONA"
              ? (this.form.nombre || "").trim()
              : ((this.form.razonSocial || "").trim() || "Empresa")

          const payload = {
            proveedorId: Number(this.editingId),
            tipoProveedor,
            nombre: safeNombre,
            apellido: tipoProveedor === "PERSONA" ? (this.form.apellido || "").trim() || null : null,
            dni: tipoProveedor === "PERSONA" ? this.onlyDigits(this.form.documentoNro) : null,
            razonSocial: tipoProveedor === "EMPRESA" ? (this.form.razonSocial || "").trim() : null,
            cuit: tipoProveedor === "EMPRESA" ? this.onlyDigits(this.form.cuit) : null,
            telefono: (this.form.telefono || "").trim() || null,
            email: (this.form.email || "").trim() || null,
            direccion: (this.form.direccion || "").trim() || null,
            notas: (this.form.notas || "").trim() || null,
            activo: !!this.form.activo,
          }

          await proveedoresApi.update(this.editingId, payload)
          this.toastSuccess("Proveedor actualizado ✅")
        }

        await this.refresh()
        this.hideModal("proveedorModal")
      } catch (e) {
        this.formError = e?.response?.data?.error || e?.message || "No se pudo guardar"
      } finally {
        this.loading = false
      }
    },

    async toggleActivo(p) {
      this.error = ""
      this.loading = true

      try {
        const tipoProveedor = p.tipo === "EMPRESA" ? "EMPRESA" : "PERSONA"
        const safeNombre =
          tipoProveedor === "PERSONA"
            ? (p.nombre || "").trim()
            : ((p.razonSocial || "").trim() || "Empresa")

        const payload = {
          proveedorId: Number(p.id),
          tipoProveedor,
          nombre: safeNombre,
          apellido: tipoProveedor === "PERSONA" ? (p.apellido || "").trim() || null : null,
          dni: tipoProveedor === "PERSONA" ? this.onlyDigits(p.documentoNro) : null,
          razonSocial: tipoProveedor === "EMPRESA" ? (p.razonSocial || "").trim() : null,
          cuit: tipoProveedor === "EMPRESA" ? this.onlyDigits(p.cuit) : null,
          telefono: (p.telefono || "").trim() || null,
          email: (p.email || "").trim() || null,
          direccion: (p.direccion || "").trim() || null,
          notas: (p.notas || "").trim() || null,
          activo: !p.activo,
        }

        await proveedoresApi.update(p.id, payload)
        await this.refresh()
        this.toastSuccess(p.activo ? "Proveedor desactivado" : "Proveedor activado")
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || "No se pudo cambiar el estado"
      } finally {
        this.loading = false
      }
    },

    async cargarDetalleCompraPago(compraId) {
      this.compraSeleccionada =
        this.comprasPendientes.find((c) => Number(c.compraId) === Number(compraId)) || null

      this.pagosCompra = []
      this.pagadoCompraSeleccionada = 0
      this.saldoCompraSeleccionada = Number(this.compraSeleccionada?.total || 0)

      if (!compraId) return

      try {
        const res = await pagosProveedorApi.porCompra(compraId)
        const p = unwrapPage(res?.data)
        this.pagosCompra = p.content ?? []

        const pagado = this.pagosCompra.reduce((acc, x) => acc + Number(x.monto || 0), 0)
        const total = Number(this.compraSeleccionada?.total || 0)
        const saldo = Math.max(total - pagado, 0)

        this.pagadoCompraSeleccionada = pagado
        this.saldoCompraSeleccionada = saldo

        if (!this.pagoMonto || Number(this.pagoMonto) <= 0) {
          this.pagoMonto = saldo
        }
      } catch {
        this.pagosCompra = []
        this.pagadoCompraSeleccionada = 0
        this.saldoCompraSeleccionada = Number(this.compraSeleccionada?.total || 0)
      }
    },

    async preparePago(p) {
      this.pagoProveedor = p
      this.pagoCompraId = null
      this.pagoMonto = ""
      this.pagoNotas = ""
      this.pagoMetodoPagoId = null
      this.pagoError = ""
      this.pagoOk = ""
      this.comprasPendientes = []
      this.pagosCompra = []
      this.compraSeleccionada = null
      this.pagadoCompraSeleccionada = 0
      this.saldoCompraSeleccionada = 0

      this.loading = true
      try {
        const res = await comprasApi.list({
          page: 1,
          size: 9999,
          search: "",
        })

        const allPage = unwrapPage(res?.data)
        const allRaw = allPage.content ?? []
        const pid = Number(p.id)

        const all = allRaw.map((x) => {
          const c = x?.compra ?? x ?? {}
          return {
            compraId: Number(c.compraId ?? c.id ?? 0),
            proveedorId: Number(c.proveedorId ?? 0),
            fecha: c.fecha ?? "",
            total: Number(c.total ?? 0),
            estado: c.estado ?? "—",
          }
        })

        this.comprasPendientes = all
          .filter((c) => Number(c.proveedorId) === pid)
          .filter((c) => !["PAGADA", "ANULADA"].includes(String(c.estado || "").toUpperCase()))
          .sort((a, b) => Number(b.compraId) - Number(a.compraId))
      } catch {
        this.comprasPendientes = []
      } finally {
        this.loading = false
      }
    },

    async registrarPago() {
      this.pagoError = ""
      this.pagoOk = ""

      const proveedor = this.pagoProveedor
      if (!proveedor?.id) {
        this.pagoError = "Proveedor inválido"
        return
      }

      const compraId = Number(this.pagoCompraId || 0)
      if (!compraId) {
        this.pagoError = "Seleccioná una compra"
        return
      }

      const metodoPagoId = Number(this.pagoMetodoPagoId || 0)
      if (!metodoPagoId) {
        this.pagoError = "Seleccioná un método de pago"
        return
      }

      const monto = Number(this.pagoMonto || 0)
      if (monto <= 0) {
        this.pagoError = "Monto inválido"
        return
      }

      if (this.saldoCompraSeleccionada > 0 && monto > this.saldoCompraSeleccionada) {
        this.pagoError = "El monto supera el saldo pendiente de la compra."
        return
      }

      this.loading = true
      try {
        const payload = {
          compraId,
          metodoPagoId,
          monto,
          referencia: (this.pagoNotas || "").trim() || null,
        }

        await pagosProveedorApi.create(payload)

        this.pagoOk = "Pago registrado ✅"
        this.pagoNotas = ""
        this.pagoMonto = ""

        await this.cargarDetalleCompraPago(compraId)
        await this.refresh()
      } catch (e) {
        this.pagoError = e?.response?.data?.error || e?.message || "No se pudo registrar el pago"
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style scoped>
.proveedores-page {
  min-height: 100%;
}

.modal-round {
  border-radius: 18px;
}

.switch-inline {
  display: flex;
  align-items: center;
  gap: 8px;
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
  margin-top: 2px;
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

@media (max-width: 992px) {
  .filters-grid {
    grid-template-columns: 1fr;
  }
}
</style>