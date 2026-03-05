<script setup>
import { computed, onMounted, ref, watch } from "vue"
import { productosApi, marcasApi, categoriasApi } from "../services/productosApi"
import { getSession } from "../auth/session"

// =========================
// Utils
// =========================
function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
}

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

function toNumber(v) {
  const x = Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(x) ? x : NaN
}

function normalizeName(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ")
}

function mapProducto(row) {
  return {
    id: row?.productoId ?? row?.id ?? row?.producto_id ?? null,
    nombre: row?.nombre ?? "",
    codigoProducto: row?.codigoProducto ?? row?.codigo ?? row?.codigo_producto ?? null,

    // legacy
    categoria: row?.categoria ?? null,

    // ids nuevos
    categoriaId: row?.categoriaId ?? row?.categoria_id ?? null,
    marcaId: row?.marcaId ?? row?.marca_id ?? null,

    stockActual: Number(row?.stockActual ?? row?.stock_actual ?? 0),
    stockMinimo: row?.stockMinimo ?? row?.stock_minimo ?? null,
    stockMaximo: row?.stockMaximo ?? row?.stock_maximo ?? null,

    precioVenta: Number(row?.precioVenta ?? row?.precio_venta ?? 0),
    precioMayorista: row?.precioMayorista ?? row?.precio_mayorista ?? null,

    // no se muestra, pero lo guardamos por si el back lo exige en PATCH
    precioCosto: Number(row?.precioCosto ?? row?.precio_costo ?? 0),
  }
}

// =========================
// State
// =========================
const loading = ref(false)
const saving = ref(false)
const error = ref("")
const ok = ref("")

// filtros
const q = ref("")
const onlyLowStock = ref(false)

// paginación
const page = ref(0)
const size = ref(10)
const totalElements = ref(0)
const totalPages = ref(1)

// data
const rows = ref([])

// catálogos
const marcas = ref([])
const categorias = ref([])

const marcaById = computed(() => new Map((marcas.value || []).map((m) => [Number(m.marcaId ?? m.id), m])))
const catById = computed(() => new Map((categorias.value || []).map((c) => [Number(c.categoriaId ?? c.id), c])))

function marcaName(id) {
  const m = marcaById.value.get(Number(id))
  return m?.nombre ?? "-"
}
function catName(id) {
  const c = catById.value.get(Number(id))
  return c?.nombre ?? "-"
}

// =========================
// Create form (CreateProductoCommand)
// =========================
const userId = computed(() => Number(getSession()?.userId ?? 0) || null)

const nombre = ref("")
const codigoProducto = ref("")

const categoriaIdNew = ref("")
const marcaIdNew = ref("")

const stockMinimo = ref(null)
const stockMaximo = ref(null)
const stockInicial = ref(0)

const precioCosto = ref("") // se usa para create
const precioVenta = ref("")
const precioMayorista = ref("")

function resetForm() {
  nombre.value = ""
  codigoProducto.value = ""
  categoriaIdNew.value = ""
  marcaIdNew.value = ""
  stockMinimo.value = null
  stockMaximo.value = null
  stockInicial.value = 0
  precioCosto.value = ""
  precioVenta.value = ""
  precioMayorista.value = ""
}

// =========================
// Edit modal (PATCH)
// =========================
const editing = ref(null)
const editForm = ref({
  nombre: "",
  codigoProducto: "",
  categoria: "",
  categoriaId: "",
  marcaId: "",
  stockMinimo: null,
  stockMaximo: null,
  stockActual: 0,
  precioVenta: "",
  precioMayorista: "",
  // hidden pero enviado al back si hace falta
  precioCosto: "",
})

function openEdit(p) {
  editing.value = p
  editForm.value = {
    nombre: p.nombre ?? "",
    codigoProducto: p.codigoProducto ?? "",
    categoria: p.categoria ?? "",
    categoriaId: p.categoriaId != null ? String(p.categoriaId) : "",
    marcaId: p.marcaId != null ? String(p.marcaId) : "",
    stockMinimo: p.stockMinimo ?? null,
    stockMaximo: p.stockMaximo ?? null,
    stockActual: Number(p.stockActual ?? 0),
    precioVenta: String(p.precioVenta ?? ""),
    precioMayorista: p.precioMayorista != null ? String(p.precioMayorista) : "",
    precioCosto: String(p.precioCosto ?? ""),
  }
}
function closeEdit() {
  editing.value = null
}

// stock quick
const stockDelta = ref(1)

// aumento precios
const incScope = ref("MARCA") // MARCA | CATEGORIA | GLOBAL
const incPorcentaje = ref("")
const incAplicarA = ref("VENTA") // VENTA | MAYORISTA | AMBOS
const incMarcaId = ref("")
const incCategoriaId = ref("")

// =========================
// Modales: crear Marca / Categoría
// =========================
const showMarcaModal = ref(false)
const showCategoriaModal = ref(false)
const newMarcaNombre = ref("")
const newCategoriaNombre = ref("")

function openMarcaModal() {
  newMarcaNombre.value = ""
  showMarcaModal.value = true
}
function closeMarcaModal() {
  showMarcaModal.value = false
}

function openCategoriaModal() {
  newCategoriaNombre.value = ""
  showCategoriaModal.value = true
}
function closeCategoriaModal() {
  showCategoriaModal.value = false
}

async function crearMarca() {
  error.value = ""
  ok.value = ""
  const nombreM = normalizeName(newMarcaNombre.value)
  if (!nombreM) return (error.value = "Nombre de marca obligatorio.")

  saving.value = true
  try {
    const uid = Number(getSession()?.userId ?? 0) || null
    try {
      await marcasApi.create({ nombre: nombreM, userId: uid })
    } catch {
      await marcasApi.create({ nombre: nombreM })
    }

    await fetchCatalogos()

    const creada = (marcas.value || []).find((m) => String(m.nombre ?? "").toLowerCase() === nombreM.toLowerCase())
    if (creada) {
      const id = String(creada.marcaId ?? creada.id)
      marcaIdNew.value = id
      incMarcaId.value = id
    }

    ok.value = "Marca creada ✅"
    closeMarcaModal()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Error creando marca."
  } finally {
    saving.value = false
  }
}

async function crearCategoria() {
  error.value = ""
  ok.value = ""
  const nombreC = normalizeName(newCategoriaNombre.value)
  if (!nombreC) return (error.value = "Nombre de categoría obligatorio.")

  saving.value = true
  try {
    const uid = Number(getSession()?.userId ?? 0) || null
    try {
      await categoriasApi.create({ nombre: nombreC, userId: uid })
    } catch {
      await categoriasApi.create({ nombre: nombreC })
    }

    await fetchCatalogos()

    const creada = (categorias.value || []).find((c) => String(c.nombre ?? "").toLowerCase() === nombreC.toLowerCase())
    if (creada) {
      const id = String(creada.categoriaId ?? creada.id)
      categoriaIdNew.value = id
      incCategoriaId.value = id
    }

    ok.value = "Categoría creada ✅"
    closeCategoriaModal()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Error creando categoría."
  } finally {
    saving.value = false
  }
}

// =========================
// Fetch
// =========================
async function fetchCatalogos() {
  try {
    const [m, c] = await Promise.all([marcasApi.list(), categoriasApi.list()])
    marcas.value = Array.isArray(m.data) ? m.data : []
    categorias.value = Array.isArray(c.data) ? c.data : []
  } catch {
    marcas.value = []
    categorias.value = []
  }
}

async function fetchAll() {
  loading.value = true
  error.value = ""
  ok.value = ""
  try {
    const { data } = await productosApi.list({
      page: page.value,
      size: size.value,
      search: q.value?.trim() || null,
    })
    const p = unwrapPage(data)
    rows.value = p.content.map(mapProducto)
    totalElements.value = p.totalElements
    totalPages.value = p.totalPages
    page.value = p.page
    size.value = p.size
  } catch (e) {
    rows.value = []
    totalElements.value = 0
    totalPages.value = 1
    error.value = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Error cargando productos."
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const arr = rows.value
  if (!onlyLowStock.value) return arr
  return arr.filter((p) => p.stockMinimo != null && p.stockActual <= p.stockMinimo)
})

const canPrev = computed(() => page.value > 0)
const canNext = computed(() => page.value < totalPages.value - 1)
function prevPage() {
  if (canPrev.value) page.value--
}
function nextPage() {
  if (canNext.value) page.value++
}

watch(page, () => fetchAll())
watch(size, () => {
  page.value = 0
  fetchAll()
})

let t = null
watch(q, () => {
  clearTimeout(t)
  t = setTimeout(() => {
    page.value = 0
    fetchAll()
  }, 250)
})

// =========================
// Create
// =========================
async function create() {
  error.value = ""
  ok.value = ""

  const uid = Number(getSession()?.userId ?? 0)
  if (!uid) return (error.value = "No se detectó userId en session_v2. Volvé a loguearte.")

  if (!nombre.value.trim()) return (error.value = "Nombre es obligatorio.")

  const pc = toNumber(precioCosto.value)
  const pv = toNumber(precioVenta.value)
  const pm = precioMayorista.value?.trim() ? toNumber(precioMayorista.value) : null

  if (!Number.isFinite(pc) || pc < 0) return (error.value = "Precio costo inválido.")
  if (!Number.isFinite(pv) || pv < pc) return (error.value = "Precio venta no puede ser menor al costo.")
  if (pm !== null && (!Number.isFinite(pm) || pm < pc)) return (error.value = "Mayorista no puede ser menor al costo.")

  const sMin = stockMinimo.value == null || stockMinimo.value === "" ? null : Number(stockMinimo.value)
  const sMax = stockMaximo.value == null || stockMaximo.value === "" ? null : Number(stockMaximo.value)
  const sIni = Number(stockInicial.value ?? 0)

  if (sMin !== null && sMin < 0) return (error.value = "Stock mínimo no puede ser negativo.")
  if (sMax !== null && sMax < 0) return (error.value = "Stock máximo no puede ser negativo.")
  if (sMin !== null && sMax !== null && sMin > sMax) return (error.value = "Stock mínimo no puede ser mayor al máximo.")
  if (sIni < 0) return (error.value = "Stock inicial no puede ser negativo.")

  saving.value = true
  try {
    await productosApi.create({
      nombre: nombre.value.trim(),
      codigoProducto: codigoProducto.value?.trim() || null,
      // categoria: categoriaStr.value?.trim() || null,
      stockMinimo: sMin,
      stockMaximo: sMax,
      stockInicial: sIni,
      precioCosto: pc,
      precioVenta: pv,
      precioMayorista: pm,
      userId: uid,
      marcaId: marcaIdNew.value ? Number(marcaIdNew.value) : null,
      categoriaId: categoriaIdNew.value ? Number(categoriaIdNew.value) : null,
    })

    ok.value = "Producto creado ✅"
    resetForm()
    page.value = 0
    await fetchAll()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Error creando producto."
  } finally {
    saving.value = false
  }
}

// =========================
// Stock quick (PATCH)
// =========================
async function applyStockDelta(p, delta) {
  if (!p?.id) return
  const next = Number(p.stockActual ?? 0) + Number(delta)
  if (next < 0) return (error.value = "El stock no puede quedar negativo.")

  saving.value = true
  error.value = ""
  ok.value = ""
  try {
    await productosApi.update(p.id, { stockActual: next })
    ok.value = `Stock actualizado (${delta > 0 ? "+" : ""}${delta}) ✅`
    await fetchAll()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Error ajustando stock."
  } finally {
    saving.value = false
  }
}

// =========================
// Save edit (PATCH)
// =========================
async function saveEdit() {
  if (!editing.value?.id) return
  error.value = ""
  ok.value = ""

  if (!editForm.value.nombre.trim()) return (error.value = "Nombre es obligatorio.")

  const pc = toNumber(editForm.value.precioCosto) // hidden
  const pv = toNumber(editForm.value.precioVenta)
  const pm = editForm.value.precioMayorista?.trim() ? toNumber(editForm.value.precioMayorista) : null

  if (!Number.isFinite(pc) || pc < 0) return (error.value = "Precio costo inválido.")
  if (!Number.isFinite(pv) || pv < pc) return (error.value = "Precio venta no puede ser menor al costo.")
  if (pm !== null && (!Number.isFinite(pm) || pm < pc)) return (error.value = "Mayorista no puede ser menor al costo.")

  const sMin =
    editForm.value.stockMinimo == null || editForm.value.stockMinimo === "" ? null : Number(editForm.value.stockMinimo)
  const sMax =
    editForm.value.stockMaximo == null || editForm.value.stockMaximo === "" ? null : Number(editForm.value.stockMaximo)
  const sAct = Number(editForm.value.stockActual ?? 0)

  if (sMin !== null && sMin < 0) return (error.value = "Stock mínimo no puede ser negativo.")
  if (sMax !== null && sMax < 0) return (error.value = "Stock máximo no puede ser negativo.")
  if (sMin !== null && sMax !== null && sMin > sMax) return (error.value = "Stock mínimo no puede ser mayor al máximo.")
  if (sAct < 0) return (error.value = "Stock no puede ser negativo.")

  saving.value = true
  try {
    await productosApi.update(editing.value.id, {
      nombre: editForm.value.nombre.trim(),
      codigoProducto: editForm.value.codigoProducto?.trim() || null,
      categoria: editForm.value.categoria?.trim() || null,

      categoriaId: editForm.value.categoriaId ? Number(editForm.value.categoriaId) : null,
      marcaId: editForm.value.marcaId ? Number(editForm.value.marcaId) : null,

      stockMinimo: sMin,
      stockMaximo: sMax,
      stockActual: sAct,

      // hidden pero enviado
      precioCosto: pc,
      precioVenta: pv,
      precioMayorista: pm,
    })

    ok.value = "Producto actualizado ✅"
    closeEdit()
    await fetchAll()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Error actualizando producto."
  } finally {
    saving.value = false
  }
}

// =========================
// Aumento precios (PUT)
// =========================
async function aplicarAumento() {
  error.value = ""
  ok.value = ""

  const pct = toNumber(incPorcentaje.value)
  if (!Number.isFinite(pct) || pct === 0) return (error.value = "El porcentaje no puede ser 0 (ej: 10 o -5).")

  const aplicarA = incAplicarA.value

  saving.value = true
  try {
    if (incScope.value === "GLOBAL") {
      await productosApi.actualizarPreciosPorcentaje({ porcentaje: pct, aplicarA })
    } else if (incScope.value === "MARCA") {
      if (!incMarcaId.value) return (saving.value = false), (error.value = "Elegí una marca.")
      await productosApi.actualizarPreciosPorMarca({ marcaId: Number(incMarcaId.value), porcentaje: pct, aplicarA })
    } else if (incScope.value === "CATEGORIA") {
      if (!incCategoriaId.value) return (saving.value = false), (error.value = "Elegí una categoría.")
      await productosApi.actualizarPreciosPorCategoria({ categoriaId: Number(incCategoriaId.value), porcentaje: pct, aplicarA })
    }
    ok.value = "Aumento aplicado ✅"
    incPorcentaje.value = ""
    await fetchAll()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Error aplicando aumento."
  } finally {
    saving.value = false
  }
}

// =========================
// Init
// =========================
onMounted(async () => {
  await fetchCatalogos()
  await fetchAll()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-3">
      <h1 class="h4 mb-1">Productos</h1>
      <div class="text-secondary">Crear · Editar · Stock · Aumentos por marca/categoría</div>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="ok" class="alert alert-success py-2">{{ ok }}</div>

    <!-- AUMENTO PRECIOS -->
    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <div class="fw-semibold text-white">Aumentar precios por %</div>
          <div class="text-secondary small">Ej: 10 = +10%, -5 = -5%</div>
        </div>

        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Alcance</label>
            <select v-model="incScope" class="form-select bg-dark text-white border-secondary">
              <option value="MARCA">Por marca</option>
              <option value="CATEGORIA">Por categoría</option>
              <option value="GLOBAL">Todos</option>
            </select>
          </div>

          <div class="col-12 col-md-3" v-if="incScope === 'MARCA'">
            <label class="form-label text-secondary">Marca</label>
            <select v-model="incMarcaId" class="form-select bg-dark text-white border-secondary">
              <option value="">Seleccionar…</option>
              <option v-for="m in marcas" :key="m.marcaId ?? m.id" :value="String(m.marcaId ?? m.id)">
                {{ m.nombre ?? m.name }}
              </option>
            </select>
          </div>

          <div class="col-12 col-md-3" v-if="incScope === 'CATEGORIA'">
            <label class="form-label text-secondary">Categoría</label>
            <select v-model="incCategoriaId" class="form-select bg-dark text-white border-secondary">
              <option value="">Seleccionar…</option>
              <option v-for="c in categorias" :key="c.categoriaId ?? c.id" :value="String(c.categoriaId ?? c.id)">
                {{ c.nombre ?? c.name }}
              </option>
            </select>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Aplicar a</label>
            <select v-model="incAplicarA" class="form-select bg-dark text-white border-secondary">
              <option value="VENTA">Venta</option>
              <option value="MAYORISTA">Mayorista</option>
              <option value="AMBOS">Ambos</option>
            </select>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">%</label>
            <input v-model="incPorcentaje" class="form-control bg-dark text-white border-secondary" placeholder="Ej 10" />
          </div>

          <div class="col-12 col-md-2">
            <button class="btn btn-outline-light w-100" @click="aplicarAumento" :disabled="saving">
              {{ saving ? "Aplicando..." : "Aplicar" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- NUEVO PRODUCTO -->
    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <div class="fw-semibold text-white">Nuevo producto</div>
          <div class="text-secondary small">
            userId detectado: <b class="text-white">{{ userId ?? "-" }}</b>
          </div>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-4">
            <label class="form-label text-secondary">Nombre *</label>
            <input v-model="nombre" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Código</label>
            <input v-model="codigoProducto" class="form-control bg-dark text-white border-secondary" />
          </div>

     

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Categoría</label>
            <div class="input-group">
              <select v-model="categoriaIdNew" class="form-select bg-dark text-white border-secondary">
                <option value="">(sin)</option>
                <option v-for="c in categorias" :key="c.categoriaId ?? c.id" :value="String(c.categoriaId ?? c.id)">
                  {{ c.nombre ?? c.name }}
                </option>
              </select>
              <button class="btn btn-outline-light" type="button" @click="openCategoriaModal">+ Cat</button>
            </div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Marca</label>
            <div class="input-group">
              <select v-model="marcaIdNew" class="form-select bg-dark text-white border-secondary">
                <option value="">(sin)</option>
                <option v-for="m in marcas" :key="m.marcaId ?? m.id" :value="String(m.marcaId ?? m.id)">
                  {{ m.nombre ?? m.name }}
                </option>
              </select>
              <button class="btn btn-outline-light" type="button" @click="openMarcaModal">+ Marca</button>
            </div>
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">Stock mín.</label>
            <input v-model.number="stockMinimo" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label text-secondary">Stock máx.</label>
            <input v-model.number="stockMaximo" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Stock inicial</label>
            <input v-model.number="stockInicial" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Costo *</label>
            <input v-model="precioCosto" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Venta *</label>
            <input v-model="precioVenta" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Mayorista</label>
            <input v-model="precioMayorista" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-3 d-flex gap-2">
            <button class="btn btn-outline-light w-100" @click="resetForm" :disabled="saving">Limpiar</button>
            <button class="btn btn-primary btn-accent w-100" @click="create" :disabled="saving">
              {{ saving ? "Guardando..." : "Crear" }}
            </button>
          </div>
        </div>

        <div class="text-secondary small mt-2">
          Guarda stock inicial en backend como stockActual y valida precios vs costo.
        </div>
      </div>
    </div>

    <!-- LISTA + STOCK QUICK -->
    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-7">
            <label class="form-label text-secondary">Buscar</label>
            <input v-model="q" class="form-control bg-dark text-white border-secondary" placeholder="nombre / código" />
          </div>

          <div class="col-12 col-md-3">
            <div class="form-check mt-4">
              <input class="form-check-input" type="checkbox" v-model="onlyLowStock" id="low" />
              <label class="form-check-label text-secondary" for="low">Solo bajo stock</label>
            </div>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label text-secondary">Δ stock</label>
            <input v-model.number="stockDelta" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>
        </div>

        <div class="text-secondary small mt-3">
          Total: <b class="text-white">{{ totalElements }}</b> · Mostrando: <b class="text-white">{{ filtered.length }}</b>
          <span class="ms-2" v-if="loading">· Cargando...</span>
        </div>
      </div>
    </div>

    <!-- TABLA -->
    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style="width: 70px">ID</th>
                <th>Producto</th>
                <th style="width: 160px">Categoría</th>
                <th style="width: 160px">Marca</th>
                <th style="width: 120px">Stock</th>
                <th style="width: 160px" class="text-end">Venta</th>
                <th style="width: 160px" class="text-end">Mayorista</th>
                <th style="width: 220px"></th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="p in filtered"
                :key="p.id"
                :class="p.stockMinimo != null && p.stockActual <= p.stockMinimo ? 'table-warning' : ''"
              >
                <td class="text-secondary">{{ p.id }}</td>

                <td class="fw-semibold">
                  {{ p.nombre }}
                  <div class="text-secondary small">
                    Código: {{ p.codigoProducto || "-" }}
                    <span v-if="p.stockMinimo != null" class="ms-2">· Min: {{ p.stockMinimo }}</span>
                  </div>
                </td>

                <td class="text-secondary">
                  <span v-if="p.categoriaId != null">{{ catName(p.categoriaId) }}</span>
                  <span v-else>{{ p.categoria || "-" }}</span>
                </td>

                <td class="text-secondary">
                  {{ p.marcaId != null ? marcaName(p.marcaId) : "-" }}
                </td>

                <td class="fw-bold">
                  {{ p.stockActual }}
                  <span v-if="p.stockMinimo != null && p.stockActual <= p.stockMinimo" class="badge text-bg-warning ms-2">
                    Bajo
                  </span>
                </td>

                <td class="text-end text-secondary">$ {{ formatMoney(p.precioVenta) }}</td>
                <td class="text-end text-secondary">
                  {{ p.precioMayorista != null ? "$ " + formatMoney(p.precioMayorista) : "-" }}
                </td>

                <td class="text-end">
                  <div class="btn-group">
                    <button class="btn btn-sm btn-outline-light" :disabled="saving" @click="applyStockDelta(p, -Math.abs(stockDelta))">
                      -{{ Math.abs(stockDelta) }}
                    </button>
                    <button class="btn btn-sm btn-outline-light" :disabled="saving" @click="applyStockDelta(p, +Math.abs(stockDelta))">
                      +{{ Math.abs(stockDelta) }}
                    </button>
                    <button class="btn btn-sm btn-outline-light" :disabled="saving" @click="openEdit(p)">
                      Editar
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filtered.length === 0">
                <td colspan="8" class="text-secondary">No hay productos para mostrar.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- paginador -->
        <div class="d-flex justify-content-end align-items-center gap-2 mt-3 text-secondary small">
          <button class="btn btn-sm btn-outline-light" @click="prevPage" :disabled="loading || page <= 0">◀</button>
          <span>Página {{ page + 1 }} / {{ totalPages }}</span>
          <button class="btn btn-sm btn-outline-light" @click="nextPage" :disabled="loading || page >= totalPages - 1">▶</button>

          <select v-model.number="size" class="form-select form-select-sm bg-dark text-white border-secondary" style="width: 90px">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </div>
      </div>
    </div>

    <!-- MODAL EDIT -->
    <div v-if="editing" class="cc-modal">
      <div class="cc-modal-card bg-panel border border-secondary rounded shadow">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="text-white fw-semibold">Editar producto #{{ editing.id }}</div>
          <button class="btn btn-sm btn-outline-light" @click="closeEdit" :disabled="saving">Cerrar</button>
        </div>

        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Nombre</label>
            <input v-model="editForm.nombre" class="form-control bg-dark text-white border-secondary" />
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Código</label>
            <input v-model="editForm.codigoProducto" class="form-control bg-dark text-white border-secondary" />
          </div>

        

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Categoría</label>
            <select v-model="editForm.categoriaId" class="form-select bg-dark text-white border-secondary">
              <option value="">(sin)</option>
              <option v-for="c in categorias" :key="c.categoriaId ?? c.id" :value="String(c.categoriaId ?? c.id)">
                {{ c.nombre ?? c.name }}
              </option>
            </select>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label text-secondary">Marca </label>
            <select v-model="editForm.marcaId" class="form-select bg-dark text-white border-secondary">
              <option value="">(sin)</option>
              <option v-for="m in marcas" :key="m.marcaId ?? m.id" :value="String(m.marcaId ?? m.id)">
                {{ m.nombre ?? m.name }}
              </option>
            </select>
          </div>

          <div class="col-6 col-md-4">
            <label class="form-label text-secondary">Stock</label>
            <input v-model.number="editForm.stockActual" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>
          <div class="col-6 col-md-4">
            <label class="form-label text-secondary">Min</label>
            <input v-model.number="editForm.stockMinimo" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>
          <div class="col-6 col-md-4">
            <label class="form-label text-secondary">Max</label>
            <input v-model.number="editForm.stockMaximo" type="number" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Venta</label>
            <input v-model="editForm.precioVenta" class="form-control bg-dark text-white border-secondary" />
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label text-secondary">Mayorista</label>
            <input v-model="editForm.precioMayorista" class="form-control bg-dark text-white border-secondary" />
          </div>

          <div class="col-12 d-flex gap-2 mt-2">
            <button class="btn btn-outline-light" @click="closeEdit" :disabled="saving">Cancelar</button>
            <button class="btn btn-primary btn-accent" @click="saveEdit" :disabled="saving">
              {{ saving ? "Guardando..." : "Guardar cambios" }}
            </button>
          </div>
        </div>

        <div class="text-secondary small mt-2">
          Ajuste de stock “rápido” usa PATCH stockActual. (No registra movimiento)
        </div>
      </div>
    </div>

    <!-- MODAL NUEVA MARCA -->
    <div v-if="showMarcaModal" class="cc-modal">
      <div class="cc-modal-card bg-panel border border-secondary rounded shadow">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="text-white fw-semibold">Nueva marca</div>
          <button class="btn btn-sm btn-outline-light" @click="closeMarcaModal" :disabled="saving">Cerrar</button>
        </div>

        <label class="form-label text-secondary">Nombre *</label>
        <input
          v-model="newMarcaNombre"
          class="form-control bg-dark text-white border-secondary"
          placeholder="Ej: Pantene"
          @keyup.enter="crearMarca"
        />

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-outline-light" @click="closeMarcaModal" :disabled="saving">Cancelar</button>
          <button class="btn btn-primary btn-accent" @click="crearMarca" :disabled="saving">
            {{ saving ? "Guardando..." : "Crear" }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL NUEVA CATEGORIA -->
    <div v-if="showCategoriaModal" class="cc-modal">
      <div class="cc-modal-card bg-panel border border-secondary rounded shadow">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="text-white fw-semibold">Nueva categoría</div>
          <button class="btn btn-sm btn-outline-light" @click="closeCategoriaModal" :disabled="saving">Cerrar</button>
        </div>

        <label class="form-label text-secondary">Nombre *</label>
        <input
          v-model="newCategoriaNombre"
          class="form-control bg-dark text-white border-secondary"
          placeholder="Ej: Shampoos"
          @keyup.enter="crearCategoria"
        />

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-outline-light" @click="closeCategoriaModal" :disabled="saving">Cancelar</button>
          <button class="btn btn-primary btn-accent" @click="crearCategoria" :disabled="saving">
            {{ saving ? "Guardando..." : "Crear" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-panel { background: rgba(18, 22, 32, .92); }
.btn-accent { background: #6f5cff; border: none; }
.btn-accent:hover { background: #5f4de6; }

.cc-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 2000;
}
.cc-modal-card {
  width: min(980px, 100%);
  padding: 16px;
}
</style>