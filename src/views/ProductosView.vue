<script>
import { proveedoresApi } from "../services/proveedoresApi"
import { comprasApi } from "../services/comprasApi"
import { pagosProveedorApi } from "../services/pagosProveedorApi"
import { metodosPagoApi } from "../services/metodopagoService"
import { cajaApi } from "../services/cajaApi"
import { getSession, getShift } from "../auth/session"

export default {
  name: "ProveedoresView",

  data() {
    return {
      loading: false,

      // paginación
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 1,

      proveedores: [],
      q: "",
      sortBy: "displayName",
      includeInactive: false,

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

      // pagos
      pagoProveedor: null,
      pagoCompraId: null,
      pagoMonto: "",
      pagoNotas: "",
      pagoMetodoPagoId: null,
      pagoError: "",
      pagoOk: "",
      comprasPendientes: [],
      pagosCompra: [],

      // caja + metodos
      cajaAbierta: null,
      metodosPago: [],

      // saldos
      deudasMap: new Map(),
    }
  },

  computed: {
    // filtros + sort se aplican sobre la PÁGINA actual (porque paginamos server-side)
    filtered() {
      const q = this.q.trim().toLowerCase()
      let arr = [...this.proveedores]

      // filtro texto (por si el back no filtra perfecto)
      if (q) {
        arr = arr.filter((p) => {
          const blob = [p.displayName, p.documentoLabel, p.telefono, p.email, p.direccion, p.notas]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
          return blob.includes(q)
        })
      }

      if (!this.includeInactive) arr = arr.filter((p) => p.activo !== false)

      if (this.sortBy === "saldoDesc") {
        arr.sort((a, b) => (this.getSaldo(b).saldo ?? 0) - (this.getSaldo(a).saldo ?? 0))
        return arr
      }

      if (this.sortBy === "displayName") {
        arr.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "es"))
      } else {
        arr.sort((a, b) => String(b[this.sortBy] || "").localeCompare(String(a[this.sortBy] || "")))
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
    this.refresh()
  },

  watch: {
    // debounce búsqueda → server-side
    q() {
      clearTimeout(this._t)
      this._t = setTimeout(() => {
        this.page = 0
        this.refresh()
      }, 250)
    },

    page() {
      this.refresh()
    },
    size() {
      this.page = 0
      this.refresh()
    },

    async pagoCompraId(newId) {
      this.pagosCompra = []
      if (!newId) return
      try {
        const res = await pagosProveedorApi.porCompra(newId)
        this.pagosCompra = res?.data?.content ?? res?.data ?? []
      } catch {
        this.pagosCompra = []
      }
    },
  },

  methods: {
    // -------- utils --------
    formatMoney(n) {
      const num = Number(n ?? 0)
      return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
    },

    unwrapPage(data) {
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
      setTimeout(() => (this.success = ""), 2200)
    },

    mapProveedorApiToVM(raw) {
      const id = Number(raw?.proveedorId ?? raw?.id ?? 0)
      const tipo = (raw?.tipoProveedor ?? "PERSONA") === "EMPRESA" ? "EMPRESA" : "PERSONA"

      const nombre = raw?.nombre ?? ""
      const apellido = raw?.apellido ?? ""
      const dni = raw?.dni ?? ""
      const razonSocial = raw?.razonSocial ?? ""
      const cuit = raw?.cuit ?? ""

      const displayName = tipo === "EMPRESA" ? (razonSocial || "—") : `${nombre} ${apellido}`.trim() || "—"
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

        createdAt: raw?.createdAt ?? raw?.created_at ?? null,
        updatedAt: raw?.updatedAt ?? raw?.updated_at ?? null,
      }
    },

    getSaldo(p) {
      const id = Number(p?.id ?? 0)
      const d = this.deudasMap.get(id)
      if (!id || !d) return { deudaCompras: 0, pagosTotal: 0, saldo: 0 }

      const deudaCompras = Number(d.deudaCompras ?? d.deuda ?? 0)
      const pagosTotal = Number(d.pagosTotal ?? d.pagos ?? 0)
      const saldo = Number(d.saldo ?? (deudaCompras - pagosTotal))
      return { deudaCompras, pagosTotal, saldo }
    },

    prevPage() {
      if (!this.canPrev) return
      this.page--
    },

    nextPage() {
      if (!this.canNext) return
      this.page++
    },

    // -------- refresh (paginado) --------
    async refresh() {
      this.loading = true
      this.error = ""
      try {
        const session = getSession() ?? null
        const userId = Number(session?.userId ?? 1)
        const turno = getShift()

        const [provRes, deudasRes, cajaRes, mpRes] = await Promise.all([
          proveedoresApi.list({
            page: this.page,
            size: this.size,
            search: this.q.trim() || null,
          }),
          proveedoresApi.deudas().catch(() => ({ data: [] })),
          cajaApi.abierta({ userId, turno }).catch(() => ({ data: null })),
          metodosPagoApi.list().catch(() => ({ data: [] })),
        ])

        const provPage = this.unwrapPage(provRes?.data)

        this.proveedores = provPage.content.map(this.mapProveedorApiToVM)
        this.totalElements = provPage.totalElements
        this.totalPages = provPage.totalPages
        this.page = provPage.page
        this.size = provPage.size

        const deudas = deudasRes?.data?.content ?? deudasRes?.data ?? []
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

        this.cajaAbierta = cajaRes?.data ?? null

        const mp = mpRes?.data?.content ?? mpRes?.data ?? []
        this.metodosPago = mp.map((m) => ({
          metodoPagoId: Number(m?.metodoPagoId ?? m?.id ?? 0),
          nombre: m?.nombre ?? m?.descripcion ?? "—",
        }))
      } catch (e) {
        this.error = e?.response?.data?.error || e?.message || "Error cargando proveedores"
      } finally {
        this.loading = false
      }
    },

    // -------- form --------
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
      if (err) return (this.formError = err)

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

        const modalEl = document.getElementById("proveedorModal")
        const closeBtn = modalEl?.querySelector("[data-bs-dismiss='modal']")
        closeBtn?.click()
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

    // -------- pagos (solo arreglo de paginación en compras list) --------
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
        const res = await comprasApi.list()
        const allRaw = res?.data?.content ?? res?.data ?? [] // ✅ soporta paginación
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

      const p = this.pagoProveedor
      if (!p?.id) return (this.pagoError = "Proveedor inválido")

      const cajaId = Number(this.cajaAbierta?.cajaId ?? 0)
      if (!cajaId) return (this.pagoError = "No hay caja abierta para tu turno.")

      const compraId = Number(this.pagoCompraId || 0)
      if (!compraId) return (this.pagoError = "Seleccioná una compra")

      const metodoPagoId = Number(this.pagoMetodoPagoId || 0)
      if (!metodoPagoId) return (this.pagoError = "Seleccioná un método de pago")

      const monto = Number(String(this.pagoMonto || "").replace(/[^\d.]/g, "") || 0)
      if (monto <= 0) return (this.pagoError = "Monto inválido")

      this.loading = true
      try {
        const payload = {
          compraId,
          cajaId,
          metodoPagoId,
          monto,
          referencia: (this.pagoNotas || "").trim() || null,
        }

        await pagosProveedorApi.create(payload)

        this.pagoOk = "Pago registrado ✅"
        this.pagoMonto = ""
        this.pagoNotas = ""

        const pagosRes = await pagosProveedorApi.porCompra(compraId)
        this.pagosCompra = pagosRes?.data?.content ?? pagosRes?.data ?? []

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