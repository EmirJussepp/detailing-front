<template>
  <div class="container py-4">
    <!-- Header -->
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div>
        <h2 class="mb-1">Proveedores</h2>
        <div class="text-secondary small">
          Alta/edición · activar/desactivar · cuenta corriente (deuda y pagos).
        </div>
      </div>

      <div class="d-flex gap-2 align-items-center">
        <div class="form-check form-switch m-0">
          <input
            class="form-check-input"
            type="checkbox"
            id="inactive"
            v-model="includeInactive"
          />
          <label class="form-check-label small text-secondary" for="inactive">
            Ver inactivos
          </label>
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

    <!-- Filtros -->
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
              <option value="updatedAt">Orden: Última edición</option>
              <option value="createdAt">Orden: Creación</option>
              <option value="saldoDesc">Orden: Saldo (mayor deuda)</option>
            </select>
          </div>

          <div class="col-12 col-md-4 d-flex justify-content-md-end">
            <span class="text-secondary small">
              {{ filtered.length }} proveedor(es)
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="success" class="alert alert-success py-2">{{ success }}</div>

    <!-- Tabla -->
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
                      <span>{{ p.displayName || '—' }}</span>

                      <span
                        class="badge"
                        :class="p.tipo === 'EMPRESA' ? 'text-bg-info' : 'text-bg-secondary'"
                      >
                        {{ p.tipo === 'EMPRESA' ? 'EMPRESA' : 'PERSONA' }}
                      </span>

                      <span class="badge" :class="docBadgeClass(p)">
                        {{ p.documentoLabel || (p.tipo === 'EMPRESA' ? 'CUIT —' : 'DOC —') }}
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
                <div>{{ p.telefono || '—' }}</div>
                <div class="small opacity-75">{{ p.email || '—' }}</div>
              </td>

              <td class="text-end">
                <div class="fw-bold" :class="saldoClass(p)">
                  $ {{ formatMoney(getSaldo(p).saldo) }}
                </div>
                <div class="text-secondary small">
                  deuda: $ {{ formatMoney(getSaldo(p).deudaCompras) }}
                  · pagos: $ {{ formatMoney(getSaldo(p).pagosTotal) }}
                </div>
              </td>

              <td class="text-center">
                <span class="badge" :class="p.activo ? 'text-bg-success' : 'text-bg-secondary'">
                  {{ p.activo ? 'Sí' : 'No' }}
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
                    {{ p.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>

        </table>
      </div>

      <div class="card-footer border-secondary text-secondary small">
        Tip: el saldo es <b>deuda (compras a cuenta)</b> menos <b>pagos</b>. Si queda negativo, el proveedor te queda “a favor”.
      </div>
    </div>

    <!-- ========================= -->
    <!-- MODAL: Crear/Editar Proveedor -->
    <!-- ========================= -->
    <div class="modal fade" id="proveedorModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary modal-round">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">
              {{ mode === 'create' ? 'Nuevo proveedor' : 'Editar proveedor' }}
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div v-if="formError" class="alert alert-danger py-2">{{ formError }}</div>

            <!-- Tipo -->
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
              <!-- PERSONA -->
              <template v-if="form.tipo !== 'EMPRESA'">
                <div class="col-12 col-md-6">
                  <label class="form-label text-secondary">Nombre *</label>
                  <input v-model="form.nombre" class="form-control" placeholder="Ej: Juan" />
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label text-secondary">Apellido *</label>
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
                  <label class="form-label text-secondary">Nro doc. *</label>
                  <input v-model="form.documentoNro" class="form-control" inputmode="numeric" placeholder="Ej: 40111222" />
                </div>
              </template>

              <!-- EMPRESA -->
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

              <!-- Comunes -->
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
              Se valida unicidad por documento/CUIT y por nombre/razón social.
            </div>
          </div>

          <div class="modal-footer border-secondary">
            <button class="btn btn-outline-light" data-bs-dismiss="modal">Cancelar</button>
            <button class="btn btn-primary btn-accent" @click="saveProveedor">
              {{ mode === 'create' ? 'Crear' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================= -->
    <!-- MODAL: Registrar Pago -->
    <!-- ========================= -->
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
              <div class="col-12 col-md-4">
                <label class="form-label text-secondary">Monto *</label>
                <input v-model="pagoMonto" class="form-control" inputmode="numeric" placeholder="Ej: 50000" />
              </div>

              <div class="col-12 col-md-4">
                <label class="form-label text-secondary">Método</label>
                <select v-model="pagoMetodo" class="form-select">
                  <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                  <option value="EFECTIVO">EFECTIVO</option>
                  <option value="DEBITO">DÉBITO</option>
                  <option value="OTRO">OTRO</option>
                </select>
              </div>

              <div class="col-12 col-md-4">
                <label class="form-label text-secondary">Notas</label>
                <input v-model="pagoNotas" class="form-control" placeholder="Ej: Factura 0001..." />
              </div>

              <div class="col-12 d-flex justify-content-end">
                <button class="btn btn-primary btn-accent" @click="registrarPago">
                  Guardar pago
                </button>
              </div>
            </div>

            <hr class="border-secondary my-3" />

            <div class="d-flex align-items-center justify-content-between mb-2">
              <div class="fw-semibold">Últimos pagos</div>
              <div class="text-secondary small">{{ pagosProveedor.length }} pago(s)</div>
            </div>

            <div v-if="pagosProveedor.length === 0" class="text-secondary">
              No hay pagos registrados para este proveedor.
            </div>

            <div v-else class="table-responsive">
              <table class="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr class="text-secondary">
                    <th>Fecha</th>
                    <th>Origen</th>
                    <th>Método</th>
                    <th class="text-end">Monto</th>
                    <th>Notas</th>
                    <th class="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="pg in pagosProveedor" :key="pg.id">
                    <td class="text-secondary">{{ new Date(pg.createdAt).toLocaleString('es-AR') }}</td>
                    <td class="text-secondary">
                      <span class="badge" :class="pg.origin === 'AUTO_COMPRA' ? 'text-bg-info' : 'text-bg-secondary'">
                        {{ pg.origin || 'MANUAL' }}
                      </span>
                    </td>
                    <td class="text-secondary">{{ pg.method }}</td>
                    <td class="text-end fw-bold">$ {{ formatMoney(pg.amount) }}</td>
                    <td class="text-secondary">{{ pg.notes || '—' }}</td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-danger" @click="borrarPago(pg)">
                        Borrar
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="text-secondary small mt-3">
              Nota: si pagás más que la deuda, el saldo puede quedar “a favor” (negativo).
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
import {
  listProveedores,
  createProveedor,
  updateProveedor,
  setProveedorActivo
} from '../services/proveedoresStorage'

import { getSaldoProveedor } from '../services/proveedoresCC'

import {
  listPagosByProveedor,
  addPago,
  removePago
} from '../services/pagosProveedoresStorage'

export default {
  name: 'ProveedoresView',
  data() {
    return {
      proveedores: [],
      q: '',
      sortBy: 'displayName',
      includeInactive: false,

      error: '',
      success: '',

      // modal proveedor
      mode: 'create',
      editingId: null,
      form: {
        tipo: 'PERSONA', // PERSONA | EMPRESA

        // persona
        nombre: '',
        apellido: '',
        documentoTipo: 'DNI',
        documentoNro: '',

        // empresa
        razonSocial: '',
        cuit: '',
        contacto: '',

        // comunes
        telefono: '',
        email: '',
        direccion: '',
        notas: '',
        activo: true
      },
      formError: '',

      // pagos
      pagoProveedor: null,
      pagoMonto: '',
      pagoMetodo: 'TRANSFERENCIA',
      pagoNotas: '',
      pagoError: '',
      pagoOk: '',
      pagosProveedor: [],

      // cache saldos
      saldosCache: new Map()
    }
  },

  computed: {
    filtered() {
      const q = this.q.trim().toLowerCase()
      let arr = [...this.proveedores]

      if (q) {
        arr = arr.filter(p => {
          const blob = [
            p.displayName,
            p.documentoLabel,
            p.telefono,
            p.email,
            p.direccion,
            p.notas
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          return blob.includes(q)
        })
      }

      if (!this.includeInactive) {
        arr = arr.filter(p => p.activo !== false)
      }

      if (this.sortBy === 'saldoDesc') {
        arr.sort((a, b) => {
          const sa = this.getSaldo(a).saldo
          const sb = this.getSaldo(b).saldo
          return (sb ?? 0) - (sa ?? 0) // mayor deuda primero
        })
        return arr
      }

      if (this.sortBy === 'displayName') {
        arr.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'es'))
      } else {
        arr.sort((a, b) => (b[this.sortBy] || '').localeCompare(a[this.sortBy] || ''))
      }

      return arr
    }
  },

  mounted() {
    this.refresh()
  },

  methods: {
    // ---------- UI helpers ----------
    formatMoney(n) {
      const num = Number(n ?? 0)
      return num.toLocaleString('es-AR', { minimumFractionDigits: 0 })
    },

    saldoClass(p) {
      const s = this.getSaldo(p).saldo
      if (s > 0) return 'text-warning' // debe
      if (s < 0) return 'text-info'    // a favor
      return 'text-success'            // ok
    },

    docBadgeClass(p) {
      // solo para darle “punch” visual a doc/cuit
      if (p?.tipo === 'EMPRESA') return 'text-bg-dark border border-info'
      return 'text-bg-dark border border-secondary'
    },

    toastSuccess(msg) {
      this.success = msg
      setTimeout(() => (this.success = ''), 2200)
    },

    // ---------- saldo cache ----------
    getSaldo(p) {
      if (!p?.id) return { deudaCompras: 0, pagosTotal: 0, saldo: 0 }
      if (this.saldosCache.has(p.id)) return this.saldosCache.get(p.id)
      const res = getSaldoProveedor(p.id)
      this.saldosCache.set(p.id, res)
      return res
    },

    invalidateSaldoCache() {
      this.saldosCache = new Map()
    },

    // ---------- data ----------
    refresh() {
      this.error = ''
      try {
        this.proveedores = listProveedores({ includeInactive: true })
        this.invalidateSaldoCache()
      } catch (e) {
        this.error = e?.message || 'Error cargando proveedores'
      }
    },

    // ---------- proveedor modal ----------
    setTipo(tipo) {
      this.form.tipo = (tipo === 'EMPRESA') ? 'EMPRESA' : 'PERSONA'

      // limpiar campos “del otro tipo” para evitar validaciones raras
      if (this.form.tipo === 'EMPRESA') {
        this.form.nombre = ''
        this.form.apellido = ''
        this.form.documentoTipo = 'DNI'
        this.form.documentoNro = ''
      } else {
        this.form.razonSocial = ''
        this.form.cuit = ''
        this.form.contacto = ''
      }
    },

    prepareCreate() {
      this.mode = 'create'
      this.editingId = null
      this.formError = ''
      this.form = {
        tipo: 'PERSONA',

        nombre: '',
        apellido: '',
        documentoTipo: 'DNI',
        documentoNro: '',

        razonSocial: '',
        cuit: '',
        contacto: '',

        telefono: '',
        email: '',
        direccion: '',
        notas: '',
        activo: true
      }
    },

    prepareEdit(p) {
      this.mode = 'edit'
      this.editingId = p.id
      this.formError = ''

      const tipo = (p.tipo === 'EMPRESA') ? 'EMPRESA' : 'PERSONA'

      this.form = {
        tipo,

        // persona
        nombre: p.nombre ?? '',
        apellido: p.apellido ?? '',
        documentoTipo: p.documentoTipo ?? 'DNI',
        documentoNro: p.documentoNro ?? '',

        // empresa
        razonSocial: p.razonSocial ?? '',
        cuit: p.cuit ?? '',
        contacto: p.contacto ?? '',

        // comunes
        telefono: p.telefono ?? '',
        email: p.email ?? '',
        direccion: p.direccion ?? '',
        notas: p.notas ?? '',
        activo: p.activo !== false
      }
    },

    saveProveedor() {
      this.formError = ''
      try {
        // IMPORTANT: el storage valida, pero acá damos mensajes más “UX friendly”
        if (this.form.tipo === 'EMPRESA') {
          if (!String(this.form.razonSocial || '').trim()) {
            this.formError = 'La razón social es obligatoria.'
            return
          }
          if (!String(this.form.cuit || '').replace(/\D/g, '').trim()) {
            this.formError = 'El CUIT es obligatorio.'
            return
          }
        } else {
          if (!String(this.form.nombre || '').trim()) {
            this.formError = 'El nombre es obligatorio.'
            return
          }
          if (!String(this.form.apellido || '').trim()) {
            this.formError = 'El apellido es obligatorio.'
            return
          }
          if (!String(this.form.documentoNro || '').replace(/\D/g, '').trim()) {
            this.formError = 'El documento es obligatorio.'
            return
          }
        }

        if (this.mode === 'create') {
          createProveedor(this.form)
          this.toastSuccess('Proveedor creado ✅')
        } else {
          updateProveedor(this.editingId, this.form)
          this.toastSuccess('Proveedor actualizado ✅')
        }

        this.refresh()

        // cerrar modal (sin depender del bootstrap instance)
        const modalEl = document.getElementById('proveedorModal')
        const closeBtn = modalEl?.querySelector('[data-bs-dismiss="modal"]')
        closeBtn?.click()
      } catch (e) {
        this.formError = e?.message || 'No se pudo guardar'
      }
    },

    toggleActivo(p) {
      this.error = ''
      try {
        setProveedorActivo(p.id, !p.activo)
        this.refresh()
        this.toastSuccess(p.activo ? 'Proveedor desactivado' : 'Proveedor activado')
      } catch (e) {
        this.error = e?.message || 'No se pudo cambiar el estado'
      }
    },

    // ---------- pagos ----------
    preparePago(p) {
      this.pagoProveedor = p
      this.pagoMonto = ''
      this.pagoMetodo = 'TRANSFERENCIA'
      this.pagoNotas = ''
      this.pagoError = ''
      this.pagoOk = ''
      this.loadPagosProveedor()
      this.invalidateSaldoCache()
    },

    loadPagosProveedor() {
      const pid = this.pagoProveedor?.id
      if (!pid) {
        this.pagosProveedor = []
        return
      }
      this.pagosProveedor = listPagosByProveedor(pid)
    },

    registrarPago() {
      this.pagoError = ''
      this.pagoOk = ''

      const p = this.pagoProveedor
      if (!p?.id) {
        this.pagoError = 'Proveedor inválido'
        return
      }

      try {
        addPago({
          proveedorId: p.id,
          proveedorNombre: p.displayName,
          amount: this.pagoMonto,
          method: this.pagoMetodo,
          notes: this.pagoNotas
        })

        this.pagoOk = 'Pago registrado ✅'
        this.pagoMonto = ''
        this.pagoNotas = ''

        this.loadPagosProveedor()
        this.invalidateSaldoCache()
        this.refresh()
      } catch (e) {
        this.pagoError = e?.message || 'No se pudo registrar el pago'
      }
    },

    borrarPago(pg) {
      if (!confirm('¿Borrar este pago?')) return
      try {
        removePago(pg.id)
        this.loadPagosProveedor()
        this.invalidateSaldoCache()
        this.refresh()
        this.pagoOk = 'Pago eliminado.'
        setTimeout(() => (this.pagoOk = ''), 1800)
      } catch (e) {
        this.pagoError = e?.message || 'No se pudo borrar el pago'
      }
    }
  }
}
</script>

<style scoped>
.bg-panel{ background: rgba(18, 22, 32, .92); }
.modal-round{ border-radius: 14px; }

.btn-accent {
  background: #7c3aed;
  border-color: #7c3aed;
}
.btn-accent:hover { filter: brightness(1.05); }

.table td, .table th { vertical-align: middle; }
</style>
