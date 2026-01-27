<template>
  <div class="container py-4">
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div>
        <h2 class="mb-1">Proveedores</h2>
        <div class="text-secondary small">
          Alta/edición + activar/desactivar + cuenta corriente (saldo y pagos).
        </div>
      </div>

      <div class="d-flex gap-2 align-items-center">
        <div class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" id="inactive" v-model="includeInactive" />
          <label class="form-check-label small text-secondary" for="inactive">Ver inactivos</label>
        </div>

        <button
          class="btn btn-primary"
          data-bs-toggle="modal"
          data-bs-target="#proveedorModal"
          @click="prepareCreate"
        >
          + Nuevo proveedor
        </button>
      </div>
    </div>

    <div class="card bg-dark border-secondary mb-3">
      <div class="card-body">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-5">
            <input v-model="q" class="form-control" placeholder="Buscar por nombre, teléfono o email…" />
          </div>

          <div class="col-12 col-md-3">
            <select v-model="sortBy" class="form-select">
              <option value="nombre">Orden: Nombre</option>
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

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <div class="card bg-dark border-secondary">
      <div class="table-responsive">
        <table class="table table-dark table-hover align-middle mb-0">
          <thead>
            <tr class="text-secondary">
              <th>Proveedor</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th class="text-end">Saldo</th>
              <th class="text-center">Activo</th>
              <th class="text-end">Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="filtered.length === 0">
              <td colspan="6" class="text-center text-secondary py-4">
                No hay proveedores para mostrar.
              </td>
            </tr>

            <tr v-for="p in filtered" :key="p.id">
              <td>
                <div class="fw-semibold">{{ p.nombre }}</div>
                <div class="text-secondary small" v-if="p.direccion">{{ p.direccion }}</div>
              </td>

              <td class="text-secondary">{{ p.telefono || '—' }}</td>
              <td class="text-secondary">{{ p.email || '—' }}</td>

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
    </div>

    <!-- ========================= -->
    <!-- MODAL: Crear/Editar Proveedor -->
    <!-- ========================= -->
    <div class="modal fade" id="proveedorModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary">
          <div class="modal-header border-secondary">
            <h5 class="modal-title">
              {{ mode === 'create' ? 'Nuevo proveedor' : 'Editar proveedor' }}
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div v-if="formError" class="alert alert-danger">{{ formError }}</div>

            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label text-secondary">Nombre *</label>
                <input v-model="form.nombre" class="form-control" placeholder="Ej: Distribuidora X" />
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label text-secondary">Teléfono</label>
                <input v-model="form.telefono" class="form-control" placeholder="Ej: 3564..." />
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label text-secondary">Email</label>
                <input v-model="form.email" class="form-control" placeholder="proveedor@email.com" />
              </div>

              <div class="col-12 col-md-6">
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
          </div>

          <div class="modal-footer border-secondary">
            <!-- ✅ le agrego dismiss para poder cerrarlo desde código -->
            <button class="btn btn-outline-light" data-bs-dismiss="modal">Cancelar</button>
            <button class="btn btn-primary" @click="saveProveedor">
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
        <div class="modal-content bg-dark border-secondary">
          <div class="modal-header border-secondary">
            <div>
              <h5 class="modal-title mb-0">Registrar pago</h5>
              <div class="text-secondary small" v-if="pagoProveedor">
                Proveedor: <b>{{ pagoProveedor.nombre }}</b>
                · Saldo actual:
                <b :class="saldoClass(pagoProveedor)">
                  $ {{ formatMoney(getSaldo(pagoProveedor).saldo) }}
                </b>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <div v-if="pagoError" class="alert alert-danger">{{ pagoError }}</div>
            <div v-if="pagoOk" class="alert alert-success">{{ pagoOk }}</div>

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
                <button class="btn btn-primary" @click="registrarPago">
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
                    <th>Método</th>
                    <th class="text-end">Monto</th>
                    <th>Notas</th>
                    <th class="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="pg in pagosProveedor" :key="pg.id">
                    <td class="text-secondary">{{ new Date(pg.createdAt).toLocaleString('es-AR') }}</td>
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
  setProveedorActivo,
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
      sortBy: 'nombre',
      includeInactive: false,

      error: '',
      success: '',

      // modal proveedor
      mode: 'create',
      editingId: null,
      form: {
        nombre: '',
        telefono: '',
        email: '',
        direccion: '',
        notas: '',
        activo: true,
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
          const blob = `${p.nombre || ''} ${p.telefono || ''} ${p.email || ''}`.toLowerCase()
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

      if (this.sortBy === 'nombre') {
        arr.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
      } else {
        arr.sort((a, b) => (b[this.sortBy] || '').localeCompare(a[this.sortBy] || ''))
      }

      return arr
    },
  },
  mounted() {
    this.refresh()
  },
  methods: {
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

    refresh() {
      this.error = ''
      try {
        this.proveedores = listProveedores({ includeInactive: true })
        this.invalidateSaldoCache()
      } catch (e) {
        this.error = e?.message || 'Error cargando proveedores'
      }
    },

    toastSuccess(msg) {
      this.success = msg
      setTimeout(() => (this.success = ''), 2200)
    },

    prepareCreate() {
      this.mode = 'create'
      this.editingId = null
      this.formError = ''
      this.form = {
        nombre: '',
        telefono: '',
        email: '',
        direccion: '',
        notas: '',
        activo: true,
      }
    },

    prepareEdit(p) {
      this.mode = 'edit'
      this.editingId = p.id
      this.formError = ''
      this.form = {
        nombre: p.nombre || '',
        telefono: p.telefono || '',
        email: p.email || '',
        direccion: p.direccion || '',
        notas: p.notas || '',
        activo: p.activo !== false,
      }
    },

    saveProveedor() {
      this.formError = ''
      try {
        if (!String(this.form.nombre || '').trim()) {
          this.formError = 'El nombre es obligatorio.'
          return
        }

        if (this.mode === 'create') {
          createProveedor(this.form)
          this.toastSuccess('Proveedor creado ✅')
        } else {
          updateProveedor(this.editingId, this.form)
          this.toastSuccess('Proveedor actualizado ✅')
        }

        this.refresh()

        // cerrar modal
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

    // ======= PAGOS =======
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
          proveedorNombre: p.nombre,
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
  },
}
</script>

<style scoped>
.btn-primary {
  background: #7c3aed;
  border-color: #7c3aed;
}
.btn-primary:hover {
  filter: brightness(1.05);
}
.card, .modal-content {
  border-radius: 14px;
}
</style>
