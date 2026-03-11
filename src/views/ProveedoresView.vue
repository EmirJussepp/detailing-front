<template>
  <div class="container py-4">
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div>
        <h2 class="mb-1">Proveedores</h2>
        <div class="text-secondary small">
          Alta/edición · activar/desactivar · cuenta corriente (deuda y pagos).
        </div>
      </div>

      <div class="d-flex gap-2 align-items-center">
        <div class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" id="inactive" v-model="includeInactive" />
          <label class="form-check-label small text-secondary" for="inactive">Ver inactivos</label>
        </div>

        <button
          class="btn btn-primary btn-accent"
          data-bs-toggle="modal"
          data-bs-target="#proveedorModal"
          @click="prepareCreate"
        >
          + Nuevo proveedor
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
              placeholder="Buscar por nombre/razón social, doc/CUIT, teléfono o email…"
            />
          </div>

          <div class="col-12 col-md-3">
            <select v-model="sortBy" class="form-select bg-dark text-white border-secondary">
              <option value="displayName">Orden: Nombre</option>
              <option value="createdAt">Orden: Creación</option>
              <option value="saldoDesc">Orden: Saldo (mayor deuda)</option>
            </select>
          </div>

          <div class="col-12 col-md-4 d-flex justify-content-md-end">
            <span class="text-secondary small">
              Total proveedores: <b>{{ totalElements }}</b> · Mostrando: <b>{{ filtered.length }}</b>
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
              <th>Proveedor</th>
              <th>Contacto</th>
              <th class="text-end">Saldo</th>
              <th class="text-center">Activo</th>
              <th class="text-end">Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="filtered.length === 0">
              <td colspan="5" class="text-center text-secondary py-4">
                No hay proveedores para mostrar.
              </td>
            </tr>

            <tr v-for="p in filtered" :key="p.id">
              <td>
                <div class="d-flex gap-2 align-items-start">
                  <div class="flex-grow-1">
                    <div class="fw-semibold d-flex gap-2 align-items-center flex-wrap">
                      <span>{{ p.displayName || "—" }}</span>

                      <span class="badge" :class="p.tipo === 'EMPRESA' ? 'text-bg-info' : 'text-bg-secondary'">
                        {{ p.tipo === "EMPRESA" ? "EMPRESA" : "PERSONA" }}
                      </span>

                      <span class="badge" :class="docBadgeClass(p)">
                        {{ p.documentoLabel || (p.tipo === "EMPRESA" ? "CUIT —" : "DOC —") }}
                      </span>
                    </div>

                    <div class="text-secondary small" v-if="p.direccion">
                      {{ p.direccion }}
                    </div>

                    <div class="text-secondary small" v-if="p.notas">
                      <span class="opacity-75">📝</span> {{ p.notas }}
                    </div>
                  </div>
                </div>
              </td>

              <td class="text-secondary">
                <div>{{ p.telefono || "—" }}</div>
                <div class="small opacity-75">{{ p.email || "—" }}</div>
              </td>

              <td class="text-end">
                <div class="fw-bold" :class="saldoClass(p)">
                  $ {{ formatMoney(getSaldo(p).saldo) }}
                </div>
                <div class="text-secondary small">
                  compras: $ {{ formatMoney(getSaldo(p).deudaCompras) }}
                  · pagos: $ {{ formatMoney(getSaldo(p).pagosTotal) }}
                </div>
              </td>

              <td class="text-center">
                <span class="badge" :class="p.activo ? 'text-bg-success' : 'text-bg-secondary'">
                  {{ p.activo ? "Sí" : "No" }}
                </span>
              </td>

              <td class="text-end">
                <div class="btn-group">
                  <button
                    class="btn btn-outline-light btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#proveedorModal"
                    @click="prepareEdit(p)"
                  >
                    Editar
                  </button>

                  <button
                    class="btn btn-outline-success btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#pagoModal"
                    @click="preparePago(p)"
                  >
                    Pago
                  </button>

                  <button class="btn btn-outline-warning btn-sm" @click="toggleActivo(p)">
                    {{ p.activo ? "Desactivar" : "Activar" }}
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
          Tip: el saldo es <b>compras</b> menos <b>pagos</b>. Si queda negativo, el proveedor te queda “a favor”.
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

    <div class="modal fade" id="proveedorModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">
              {{ mode === "create" ? "Nuevo proveedor" : "Editar proveedor" }}
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div v-if="formError" class="alert alert-danger py-2">{{ formError }}</div>

            <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
              <span class="text-secondary small">Tipo:</span>

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
                  <label class="form-label text-secondary">Nombre *</label>
                  <input v-model="form.nombre" class="form-control" placeholder="Ej: Juan" />
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label text-secondary">Apellido</label>
                  <input v-model="form.apellido" class="form-control" placeholder="Ej: Pérez" />
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label text-secondary">Tipo doc.</label>
                  <select v-model="form.documentoTipo" class="form-select">
                    <option value="DNI">DNI</option>
                    <option value="CUIL">CUIL</option>
                    <option value="PASAPORTE">PASAPORTE</option>
                    <option value="OTRO">OTRO</option>
                  </select>
                </div>

                <div class="col-12 col-md-8">
                  <label class="form-label text-secondary">Nro doc.</label>
                  <input
                    v-model="form.documentoNro"
                    class="form-control"
                    inputmode="numeric"
                    placeholder="Ej: 40111222"
                  />
                </div>
              </template>

              <template v-else>
                <div class="col-12">
                  <label class="form-label text-secondary">Razón social *</label>
                  <input v-model="form.razonSocial" class="form-control" placeholder="Ej: Distribuidora X S.A." />
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label text-secondary">CUIT *</label>
                  <input v-model="form.cuit" class="form-control" inputmode="numeric" placeholder="Ej: 30712345678" />
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label text-secondary">Contacto (opcional)</label>
                  <input v-model="form.contacto" class="form-control" placeholder="Ej: Mariana / Compras" />
                </div>
              </template>

              <div class="col-12 col-md-6">
                <label class="form-label text-secondary">Teléfono</label>
                <input v-model="form.telefono" class="form-control" placeholder="Ej: 3564..." />
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label text-secondary">Email</label>
                <input v-model="form.email" class="form-control" placeholder="proveedor@email.com" />
              </div>

              <div class="col-12">
                <label class="form-label text-secondary">Dirección</label>
                <input v-model="form.direccion" class="form-control" placeholder="Calle, nro, ciudad" />
              </div>

              <div class="col-12">
                <label class="form-label text-secondary">Notas</label>
                <textarea v-model="form.notas" class="form-control" rows="3" placeholder="Observaciones..."></textarea>
              </div>

              <div class="col-12">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="activo" v-model="form.activo" />
                  <label class="form-check-label text-secondary" for="activo">Activo</label>
                </div>
              </div>
            </div>

            <div class="text-secondary small mt-3">
              Se valida unicidad por DNI/CUIT y por razón social.
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
        <div class="modal-content bg-dark border-secondary modal-round">
          <div class="modal-header border-secondary">
            <div>
              <h5 class="modal-title mb-0">Registrar pago</h5>
              <div class="text-secondary small" v-if="pagoProveedor">
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
            <div v-if="pagoError" class="alert alert-danger py-2">{{ pagoError }}</div>
            <div v-if="pagoOk" class="alert alert-success py-2">{{ pagoOk }}</div>

            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label text-secondary">Compra a pagar *</label>
                <select v-model.number="pagoCompraId" class="form-select">
                  <option :value="null">Seleccionar compra pendiente...</option>
                  <option v-for="c in comprasPendientes" :key="c.compraId" :value="c.compraId">
                    #{{ c.compraId }} · {{ formatDate(c.fecha) }} · {{ formatMoney(c.total) }} · {{ c.estado }}
                  </option>
                </select>
                <div class="text-secondary small mt-1" v-if="!comprasPendientes.length">
                  No hay compras pendientes para este proveedor.
                </div>
              </div>

              <div class="col-12 col-md-3">
                <label class="form-label text-secondary">Monto *</label>
                <input v-model="pagoMonto" class="form-control" inputmode="numeric" placeholder="Ej: 50000" />
              </div>

              <div class="col-12 col-md-3">
                <label class="form-label text-secondary">Método *</label>
                <select v-model.number="pagoMetodoPagoId" class="form-select">
                  <option :value="null">Seleccionar...</option>
                  <option v-for="m in metodosPago" :key="m.metodoPagoId" :value="m.metodoPagoId">
                    {{ m.nombre }}
                  </option>
                </select>
              </div>

              <div class="col-12">
                <label class="form-label text-secondary">Referencia</label>
                <input v-model="pagoNotas" class="form-control" placeholder="Ej: Factura 0001..." />
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

            <hr class="border-secondary my-3" />

            <div class="d-flex align-items-center justify-content-between mb-2">
              <div class="fw-semibold">Pagos de la compra seleccionada</div>
              <div class="text-secondary small">{{ pagosCompra.length }} pago(s)</div>
            </div>

            <div v-if="pagosCompra.length === 0" class="text-secondary">
              No hay pagos registrados para esta compra.
            </div>

            <div v-else class="table-responsive">
              <table class="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr class="text-secondary">
                    <th style="width:90px">ID</th>
                    <th style="width:140px">Fecha</th>
                    <th class="text-end">Monto</th>
                    <th>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="pg in pagosCompra" :key="pg.pagoProveedorId || pg.id">
                    <td class="text-secondary">#{{ pg.pagoProveedorId || pg.id }}</td>
                    <td class="text-secondary">{{ formatDate(pg.fecha) }}</td>
                    <td class="text-end fw-bold">$ {{ formatMoney(pg.monto) }}</td>
                    <td class="text-secondary">{{ pg.referencia || "—" }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="text-secondary small mt-3">
              Nota: el pago se registra contra una compra.
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

    page() {
      this.refresh()
    },

    size() {
      if (this.page !== 1) {
        this.page = 1
      } else {
        this.refresh()
      }
    },

    async pagoCompraId(newId) {
      this.pagosCompra = []
      if (!newId) return

      try {
        const res = await pagosProveedorApi.porCompra(newId)
        const p = unwrapPage(res?.data)
        this.pagosCompra = p.content ?? []
      } catch {
        this.pagosCompra = []
      }
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
        this.size = provPage.size || this.size

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

      const monto = Number(String(this.pagoMonto || "").replace(/[^\d.]/g, "") || 0)
      if (monto <= 0) {
        this.pagoError = "Monto inválido"
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
        this.pagoMonto = ""
        this.pagoNotas = ""

        const pagosRes = await pagosProveedorApi.porCompra(compraId)
        const pagosPage = unwrapPage(pagosRes?.data)
        this.pagosCompra = pagosPage.content ?? []

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