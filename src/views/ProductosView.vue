<script setup>
import { computed, onMounted, ref, watch } from "vue"
import Pager from "../components/Pager.vue"
import { productosApi, marcasApi, categoriasApi } from "../services/productosApi"
import { getSession } from "../auth/session"

function formatMoney(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
}

function unwrapPage(data) {
  if (Array.isArray(data)) {
    return {
      content: data,
      page: 0,
      size: data.length,
      totalElements: data.length,
      totalPages: 1,
    }
  }

  const content = data?.content ?? data?.items ?? data?.data ?? []

  return {
    content: Array.isArray(content) ? content : [],
    page: Number(data?.page ?? data?.number ?? 0),
    size: Number(data?.size ?? data?.pageSize ?? 10),
    totalElements: Number(
      data?.totalElements ??
        data?.total ??
        (Array.isArray(content) ? content.length : 0)
    ),
    totalPages: Number(data?.totalPages ?? data?.pages ?? 1),
  }
}

function unwrapArray(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
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
    nombre: row?.nombre ?? row?.name ?? "",
    codigoProducto: row?.codigoProducto ?? row?.codigo ?? row?.codigo_producto ?? null,
    categoria: row?.categoria ?? row?.categoriaNombre ?? row?.categoria_name ?? null,
    categoriaId: row?.categoriaId ?? row?.categoria_id ?? null,
    marcaId: row?.marcaId ?? row?.marca_id ?? null,
    stockActual: Number(row?.stockActual ?? row?.stock_actual ?? 0),

    stockMinimo:
      row?.stockMinimo != null
        ? Number(row.stockMinimo)
        : row?.stock_minimo != null
          ? Number(row.stock_minimo)
          : null,

    stockMaximo:
      row?.stockMaximo != null
        ? Number(row.stockMaximo)
        : row?.stock_maximo != null
          ? Number(row.stock_maximo)
          : null,

    precioVenta: Number(row?.precioVenta ?? row?.precio_venta ?? 0),

    precioMayorista:
      row?.precioMayorista != null
        ? Number(row.precioMayorista)
        : row?.precio_mayorista != null
          ? Number(row.precio_mayorista)
          : null,

    precioCosto: Number(row?.precioCosto ?? row?.precio_costo ?? 0),
  }
}

const loading = ref(false)
const saving = ref(false)
const errorMsg = ref("")
const okMsg = ref("")
const infoMsg = ref("")

const q = ref("")
const onlyLowStock = ref(false)

const page = ref(0)
const size = ref(10)
const totalElements = ref(0)
const totalPages = ref(1)

const rows = ref([])
const marcas = ref([])
const categorias = ref([])

const excelFile = ref(null)
const importingExcel = ref(false)
const excelInputRef = ref(null)

const showCostoAlta = ref(false)
const showCostoEdicion = ref(false)

const confirmState = ref({
  open: false,
  title: "",
  message: "",
  variant: "primary",
  onConfirm: null,
})

function openConfirm({ title, message, variant = "primary", onConfirm }) {
  confirmState.value = {
    open: true,
    title,
    message,
    variant,
    onConfirm,
  }
}

function closeConfirm() {
  confirmState.value = {
    open: false,
    title: "",
    message: "",
    variant: "primary",
    onConfirm: null,
  }
}

async function confirmAccept() {
  const action = confirmState.value.onConfirm
  closeConfirm()
  if (typeof action === "function") {
    await action()
  }
}

const marcaById = computed(() =>
  new Map((marcas.value || []).map((m) => [Number(m.marcaId ?? m.id), m]))
)

const catById = computed(() =>
  new Map((categorias.value || []).map((c) => [Number(c.categoriaId ?? c.id), c]))
)

function marcaName(id) {
  const m = marcaById.value.get(Number(id))
  return m?.nombre ?? m?.name ?? "-"
}

function catName(id) {
  const c = catById.value.get(Number(id))
  return c?.nombre ?? c?.name ?? "-"
}

const userId = computed(() => Number(getSession()?.userId ?? 0) || null)

const nombre = ref("")
const codigoProducto = ref("")
const categoriaIdNew = ref("")
const marcaIdNew = ref("")
const stockMinimo = ref(null)
const stockMaximo = ref(null)
const stockInicial = ref(0)
const precioCosto = ref("")
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
  showCostoAlta.value = false
}

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
  precioCosto: "",
})

function openEdit(p) {
  editing.value = p
  showCostoEdicion.value = false

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
  showCostoEdicion.value = false
}

const stockDelta = ref(1)

const incScope = ref("MARCA")
const incPorcentaje = ref("")
const incAplicarA = ref("VENTA")
const incMarcaId = ref("")
const incCategoriaId = ref("")

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

function onExcelChange(e) {
  const file = e?.target?.files?.[0] ?? null
  excelFile.value = file
}

function clearExcelFile() {
  excelFile.value = null
  if (excelInputRef.value) {
    excelInputRef.value.value = ""
  }
}

async function eliminarProducto(id) {
  if (!id) return

  openConfirm({
    title: "Eliminar producto",
    message: "¿Seguro que querés eliminar este producto? Esta acción no se puede deshacer.",
    variant: "danger",
    onConfirm: async () => {
      saving.value = true
      errorMsg.value = ""
      okMsg.value = ""
      infoMsg.value = ""

      try {
        await productosApi.delete(id)
        okMsg.value = "Producto eliminado correctamente."

        if (filtered.value.length === 1 && page.value > 0) {
          page.value = page.value - 1
        } else {
          await fetchAll()
        }
      } catch (e) {
        errorMsg.value =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          "Error eliminando producto."
      } finally {
        saving.value = false
      }
    },
  })
}

async function importarExcel() {
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  if (!excelFile.value) {
    errorMsg.value = "Seleccioná un archivo Excel."
    return
  }

  const fileName = String(excelFile.value.name || "").toLowerCase()
  if (!fileName.endsWith(".xlsx")) {
    errorMsg.value = "El archivo debe ser .xlsx"
    return
  }

  importingExcel.value = true

  try {
    const { data } = await productosApi.importarExcel(excelFile.value)

    const creados = Number(data?.creados ?? 0)
    const actualizados = Number(data?.actualizados ?? 0)

    okMsg.value = `Importación finalizada · Creados: ${creados} · Actualizados: ${actualizados}`

    if (Array.isArray(data?.errores) && data.errores.length > 0) {
      infoMsg.value = `Se encontraron errores en ${data.errores.length} fila(s): ${data.errores.slice(0, 3).map(e => e?.mensaje || e?.error || JSON.stringify(e)).join(' · ')}${data.errores.length > 3 ? ' ...' : ''}`
    }

    clearExcelFile()
    page.value = 0
    await fetchCatalogos()
    await fetchAll()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error importando Excel."
  } finally {
    importingExcel.value = false
  }
}

async function crearMarca() {
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  const nombreM = normalizeName(newMarcaNombre.value)
  if (!nombreM) {
    errorMsg.value = "Nombre de marca obligatorio."
    return
  }

  saving.value = true
  try {
    const uid = Number(getSession()?.userId ?? 0) || null
    try {
      await marcasApi.create({ nombre: nombreM, userId: uid })
    } catch {
      await marcasApi.create({ nombre: nombreM })
    }

    await fetchCatalogos()

    const creada = (marcas.value || []).find(
      (m) => String(m.nombre ?? m.name ?? "").toLowerCase() === nombreM.toLowerCase()
    )

    if (creada) {
      const id = String(creada.marcaId ?? creada.id)
      marcaIdNew.value = id
      incMarcaId.value = id
      if (editing.value) {
        editForm.value.marcaId = id
      }
    }

    okMsg.value = "Marca creada correctamente."
    closeMarcaModal()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error creando marca."
  } finally {
    saving.value = false
  }
}

async function crearCategoria() {
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  const nombreC = normalizeName(newCategoriaNombre.value)
  if (!nombreC) {
    errorMsg.value = "Nombre de categoría obligatorio."
    return
  }

  saving.value = true
  try {
    const uid = Number(getSession()?.userId ?? 0) || null
    try {
      await categoriasApi.create({ nombre: nombreC, userId: uid })
    } catch {
      await categoriasApi.create({ nombre: nombreC })
    }

    await fetchCatalogos()

    const creada = (categorias.value || []).find(
      (c) => String(c.nombre ?? c.name ?? "").toLowerCase() === nombreC.toLowerCase()
    )

    if (creada) {
      const id = String(creada.categoriaId ?? creada.id)
      categoriaIdNew.value = id
      incCategoriaId.value = id
      if (editing.value) {
        editForm.value.categoriaId = id
      }
    }

    okMsg.value = "Categoría creada correctamente."
    closeCategoriaModal()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error creando categoría."
  } finally {
    saving.value = false
  }
}

async function fetchCatalogos() {
  try {
    const [m, c] = await Promise.all([marcasApi.list(), categoriasApi.list()])
    marcas.value = unwrapArray(m.data)
    categorias.value = unwrapArray(c.data)
  } catch {
    marcas.value = []
    categorias.value = []
  }
}

async function fetchAll() {
  loading.value = true
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  try {
    const params = {
      page: onlyLowStock.value ? 0 : page.value,
      size: onlyLowStock.value ? 9999 : size.value,
      search: q.value?.trim() || null,
    }

    const { data } = await productosApi.list(params)

    const p = unwrapPage(data)
    const mappedRows = p.content.map(mapProducto)

    rows.value = mappedRows

    if (onlyLowStock.value) {
      const lowStockRows = mappedRows.filter(
        (prod) => prod.stockMinimo != null && prod.stockActual <= prod.stockMinimo
      )

      totalElements.value = lowStockRows.length
      totalPages.value = 1
      page.value = 0
    } else {
      totalElements.value = p.totalElements
      totalPages.value = p.totalPages
      page.value = p.page
      size.value = p.size
    }

    if (!mappedRows.length) {
      infoMsg.value = "No hay productos para mostrar con los filtros actuales."
    }
  } catch (e) {
    rows.value = []
    totalElements.value = 0
    totalPages.value = 1
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error cargando productos."
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const arr = rows.value
  if (!onlyLowStock.value) return arr
  return arr.filter((p) => p.stockMinimo != null && p.stockActual <= p.stockMinimo)
})

function onPageChange(newPage) {
  page.value = Number(newPage ?? 0)
}

function onSizeChange() {}

watch(page, () => {
  fetchAll()
})

watch(onlyLowStock, () => {
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

async function create() {
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  const uid = Number(getSession()?.userId ?? 0)
  if (!uid) {
    errorMsg.value = "No se detectó userId en sesión. Volvé a iniciar sesión."
    return
  }

  if (!nombre.value.trim()) {
    errorMsg.value = "Nombre es obligatorio."
    return
  }

  const pc = precioCosto.value?.toString().trim()
    ? toNumber(precioCosto.value)
    : 0

  const pv = toNumber(precioVenta.value)
  const pm = precioMayorista.value?.trim() ? toNumber(precioMayorista.value) : null

  if (!Number.isFinite(pc) || pc < 0) {
    errorMsg.value = "Precio costo inválido."
    return
  }

  if (!Number.isFinite(pv) || pv < pc) {
    errorMsg.value = "Precio venta no puede ser menor al costo."
    return
  }

  if (pm !== null && (!Number.isFinite(pm) || pm < pc)) {
    errorMsg.value = "Mayorista no puede ser menor al costo."
    return
  }

  const sMin = stockMinimo.value == null || stockMinimo.value === "" ? null : Number(stockMinimo.value)
  const sMax = stockMaximo.value == null || stockMaximo.value === "" ? null : Number(stockMaximo.value)
  const sIni = Number(stockInicial.value ?? 0)

  if (sMin !== null && sMin < 0) {
    errorMsg.value = "Stock mínimo no puede ser negativo."
    return
  }

  if (sMax !== null && sMax < 0) {
    errorMsg.value = "Stock máximo no puede ser negativo."
    return
  }

  if (sMin !== null && sMax !== null && sMin > sMax) {
    errorMsg.value = "Stock mínimo no puede ser mayor al máximo."
    return
  }

  if (sIni < 0) {
    errorMsg.value = "Stock inicial no puede ser negativo."
    return
  }

  saving.value = true
  try {
    await productosApi.create({
      nombre: nombre.value.trim(),
      codigoProducto: codigoProducto.value?.trim() || null,
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

    okMsg.value = "Producto creado correctamente."
    resetForm()
    page.value = 0
    await fetchCatalogos()
    await fetchAll()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error creando producto."
  } finally {
    saving.value = false
  }
}

async function applyStockDelta(p, delta) {
  if (!p?.id) return

  const next = Number(p.stockActual ?? 0) + Number(delta)
  if (next < 0) {
    errorMsg.value = "El stock no puede quedar negativo."
    return
  }

  saving.value = true
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  try {
    await productosApi.update(p.id, { stockActual: next })
    okMsg.value = `Stock actualizado (${delta > 0 ? "+" : ""}${delta}).`
    await fetchAll()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error ajustando stock."
  } finally {
    saving.value = false
  }
}

async function saveEdit() {
  if (!editing.value?.id) return

  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  if (!editForm.value.nombre.trim()) {
    errorMsg.value = "Nombre es obligatorio."
    return
  }

  const pc = editForm.value.precioCosto?.toString().trim()
    ? toNumber(editForm.value.precioCosto)
    : 0

  const pv = toNumber(editForm.value.precioVenta)
  const pm = editForm.value.precioMayorista?.trim() ? toNumber(editForm.value.precioMayorista) : null

  if (!Number.isFinite(pc) || pc < 0) {
    errorMsg.value = "Precio costo inválido."
    return
  }

  if (!Number.isFinite(pv) || pv < pc) {
    errorMsg.value = "Precio venta no puede ser menor al costo."
    return
  }

  if (pm !== null && (!Number.isFinite(pm) || pm < pc)) {
    errorMsg.value = "Mayorista no puede ser menor al costo."
    return
  }

  const sMin = editForm.value.stockMinimo == null || editForm.value.stockMinimo === "" ? null : Number(editForm.value.stockMinimo)
  const sMax = editForm.value.stockMaximo == null || editForm.value.stockMaximo === "" ? null : Number(editForm.value.stockMaximo)
  const sAct = Number(editForm.value.stockActual ?? 0)

  if (sMin !== null && sMin < 0) {
    errorMsg.value = "Stock mínimo no puede ser negativo."
    return
  }

  if (sMax !== null && sMax < 0) {
    errorMsg.value = "Stock máximo no puede ser negativo."
    return
  }

  if (sMin !== null && sMax !== null && sMin > sMax) {
    errorMsg.value = "Stock mínimo no puede ser mayor al máximo."
    return
  }

  if (sAct < 0) {
    errorMsg.value = "Stock no puede ser negativo."
    return
  }

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
      precioCosto: pc,
      precioVenta: pv,
      precioMayorista: pm,
    })

    okMsg.value = "Producto actualizado correctamente."
    closeEdit()
    await fetchCatalogos()
    await fetchAll()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error actualizando producto."
  } finally {
    saving.value = false
  }
}

async function aplicarAumentoConfirmed() {
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  const pct = toNumber(incPorcentaje.value)
  if (!Number.isFinite(pct) || pct === 0) {
    errorMsg.value = "El porcentaje no puede ser 0."
    return
  }

  saving.value = true
  try {
    if (incScope.value === "GLOBAL") {
      await productosApi.actualizarPreciosPorcentaje({
        porcentaje: pct,
        aplicarA: incAplicarA.value,
      })
    } else if (incScope.value === "MARCA") {
      if (!incMarcaId.value) {
        errorMsg.value = "Elegí una marca."
        saving.value = false
        return
      }
      await productosApi.actualizarPreciosPorMarca({
        marcaId: Number(incMarcaId.value),
        porcentaje: pct,
        aplicarA: incAplicarA.value,
      })
    } else if (incScope.value === "CATEGORIA") {
      if (!incCategoriaId.value) {
        errorMsg.value = "Elegí una categoría."
        saving.value = false
        return
      }
      await productosApi.actualizarPreciosPorCategoria({
        categoriaId: Number(incCategoriaId.value),
        porcentaje: pct,
        aplicarA: incAplicarA.value,
      })
    }

    okMsg.value = "Aumento aplicado correctamente."
    incPorcentaje.value = ""
    await fetchAll()
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Error aplicando aumento."
  } finally {
    saving.value = false
  }
}

function aplicarAumento() {
  errorMsg.value = ""
  okMsg.value = ""
  infoMsg.value = ""

  const pct = toNumber(incPorcentaje.value)
  if (!Number.isFinite(pct) || pct === 0) {
    errorMsg.value = "El porcentaje no puede ser 0."
    return
  }

  if (incScope.value === "MARCA" && !incMarcaId.value) {
    errorMsg.value = "Elegí una marca."
    return
  }

  if (incScope.value === "CATEGORIA" && !incCategoriaId.value) {
    errorMsg.value = "Elegí una categoría."
    return
  }

  let scopeText = "todos los productos"

  if (incScope.value === "MARCA") {
    scopeText = `los productos de la marca ${marcaName(incMarcaId.value)}`
  } else if (incScope.value === "CATEGORIA") {
    scopeText = `los productos de la categoría ${catName(incCategoriaId.value)}`
  }

  let aplicarAText = "precio de venta"

  if (incAplicarA.value === "MAYORISTA") {
    aplicarAText = "precio mayorista"
  } else if (incAplicarA.value === "AMBOS") {
    aplicarAText = "precio de venta y mayorista"
  }

  const accion = pct > 0 ? "aumentar" : "disminuir"

  openConfirm({
    title: "Confirmar actualización de precios",
    message: `Se va a ${accion} ${aplicarAText} de ${scopeText} en un ${Math.abs(pct)}%. ¿Querés continuar?`,
    variant: "warning",
    onConfirm: aplicarAumentoConfirmed,
  })
}

onMounted(async () => {
  await fetchCatalogos()
  await fetchAll()
})
</script>

<template>
  <div class="productos-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Inventario</p>
        <h1 class="page-title mb-1">Productos</h1>
        <p class="page-subtitle mb-0">
          Alta, edición, stock y actualización de precios.
        </p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-outline-light" @click="fetchAll" :disabled="loading">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </button>
      </div>
    </section>

    <div v-if="errorMsg" class="alert alert-danger py-2 mb-3">{{ errorMsg }}</div>
    <div v-if="okMsg" class="alert alert-success py-2 mb-3">{{ okMsg }}</div>
    <div v-if="infoMsg" class="alert alert-secondary py-2 mb-3">{{ infoMsg }}</div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Aumento de precios</h2>
          <div class="helper-text">Ejemplo: 10 = +10% · -5 = -5%</div>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <label class="form-label field-label">Alcance</label>
            <select v-model="incScope" class="form-select app-input">
              <option value="MARCA">Por marca</option>
              <option value="CATEGORIA">Por categoría</option>
              <option value="GLOBAL">Todos</option>
            </select>
          </div>

          <div class="col-12 col-md-3" v-if="incScope === 'MARCA'">
            <label class="form-label field-label">Marca</label>
            <select v-model="incMarcaId" class="form-select app-input">
              <option value="">Seleccionar…</option>
              <option v-for="m in marcas" :key="m.marcaId ?? m.id" :value="String(m.marcaId ?? m.id)">
                {{ m.nombre ?? m.name }}
              </option>
            </select>
          </div>

          <div class="col-12 col-md-3" v-if="incScope === 'CATEGORIA'">
            <label class="form-label field-label">Categoría</label>
            <select v-model="incCategoriaId" class="form-select app-input">
              <option value="">Seleccionar…</option>
              <option v-for="c in categorias" :key="c.categoriaId ?? c.id" :value="String(c.categoriaId ?? c.id)">
                {{ c.nombre ?? c.name }}
              </option>
            </select>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label field-label">Aplicar a</label>
            <select v-model="incAplicarA" class="form-select app-input">
              <option value="VENTA">Venta</option>
              <option value="MAYORISTA">Mayorista</option>
              <option value="AMBOS">Ambos</option>
            </select>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label field-label">Porcentaje</label>
            <input v-model="incPorcentaje" class="form-control app-input" placeholder="Ej: 10" />
          </div>

          <div class="col-12 col-md-2">
            <button class="btn btn-outline-light w-100" @click="aplicarAumento" :disabled="saving">
              {{ saving ? "Aplicando..." : "Aplicar" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Importar productos desde Excel</h2>
          <div class="helper-text">
            Archivo .xlsx con productos para crear o actualizar.
          </div>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-8">
            <label class="form-label field-label">Archivo Excel</label>
            <input
              ref="excelInputRef"
              type="file"
              accept=".xlsx"
              class="form-control app-input"
              @change="onExcelChange"
            />
          </div>

          <div class="col-12 col-md-4 d-flex gap-2">
            <button
              class="btn btn-outline-light w-100"
              @click="clearExcelFile"
              :disabled="importingExcel"
            >
              Limpiar
            </button>

            <button
              class="btn btn-primary btn-accent w-100"
              @click="importarExcel"
              :disabled="importingExcel"
            >
              {{ importingExcel ? "Importando..." : "Importar Excel" }}
            </button>
          </div>
        </div>

        <div class="helper-text mt-3">
          Ideal para cargas masivas. La carga manual sigue disponible abajo.
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Nuevo producto</h2>
          <div class="helper-text">Completá los datos del producto y hacé clic en Crear.</div>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-4">
            <label class="form-label field-label">Nombre</label>
            <input v-model="nombre" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label field-label">Código</label>
            <input v-model="codigoProducto" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label field-label">Categoría</label>
            <div class="input-group">
              <select v-model="categoriaIdNew" class="form-select app-input">
                <option value="">(sin)</option>
                <option v-for="c in categorias" :key="c.categoriaId ?? c.id" :value="String(c.categoriaId ?? c.id)">
                  {{ c.nombre ?? c.name }}
                </option>
              </select>
              <button class="btn btn-outline-light" type="button" @click="openCategoriaModal">+ Cat</button>
            </div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label field-label">Marca</label>
            <div class="input-group">
              <select v-model="marcaIdNew" class="form-select app-input">
                <option value="">(sin)</option>
                <option v-for="m in marcas" :key="m.marcaId ?? m.id" :value="String(m.marcaId ?? m.id)">
                  {{ m.nombre ?? m.name }}
                </option>
              </select>
              <button class="btn btn-outline-light" type="button" @click="openMarcaModal">+ Marca</button>
            </div>
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label field-label">Stock mín.</label>
            <input v-model.number="stockMinimo" type="number" class="form-control app-input" />
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label field-label">Stock máx.</label>
            <input v-model.number="stockMaximo" type="number" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label field-label">Stock inicial</label>
            <input v-model.number="stockInicial" type="number" class="form-control app-input" />
          </div>

          <div class="col-12">
            <button
              class="btn btn-sm btn-outline-light"
              @click="showCostoAlta = !showCostoAlta"
              type="button"
            >
              {{ showCostoAlta ? "Ocultar costo" : "Mostrar costo" }}
            </button>
          </div>

          <div v-if="showCostoAlta" class="col-12 col-md-3">
            <label class="form-label field-label">Costo</label>
            <input v-model="precioCosto" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label field-label">Venta</label>
            <input v-model="precioVenta" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label field-label">Mayorista</label>
            <input v-model="precioMayorista" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-3 d-flex gap-2">
            <button class="btn btn-outline-light w-100" @click="resetForm" :disabled="saving">
              Limpiar
            </button>
            <button class="btn btn-primary btn-accent w-100" @click="create" :disabled="saving">
              {{ saving ? "Guardando..." : "Crear" }}
            </button>
          </div>
        </div>

        <div class="helper-text mt-3">
          Podés crear productos manualmente o importarlos por Excel.
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Filtros</h2>
          <div class="helper-text">
            Total: <b>{{ totalElements }}</b> · Mostrando: <b>{{ filtered.length }}</b>
          </div>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-7">
            <label class="form-label field-label">Buscar</label>
            <input v-model="q" class="form-control app-input" placeholder="Nombre o código..." />
          </div>

          <div class="col-12 col-md-3">
            <div class="form-check mt-4">
              <input class="form-check-input" type="checkbox" v-model="onlyLowStock" id="low-stock" />
              <label class="form-check-label helper-text" for="low-stock">
                Solo bajo stock
              </label>
            </div>
          </div>

          <div class="col-12 col-md-2">
            <label class="form-label field-label">Cantidad a ajustar</label>
            <input v-model.number="stockDelta" type="number" class="form-control app-input" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Listado</h2>
          <div class="helper-text">Gestión rápida de stock y edición.</div>
        </div>

        <div v-if="loading" class="empty-block">
          <div class="empty-title">Cargando productos</div>
          <div class="helper-text">Esperá un momento.</div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-dark table-hover align-middle app-table mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th style="width: 160px">Categoría</th>
                <th style="width: 160px">Marca</th>
                <th style="width: 120px">Stock</th>
                <th style="width: 160px" class="text-end">Venta</th>
                <th style="width: 160px" class="text-end">Mayorista</th>
                <th style="width: 280px"></th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="p in filtered"
                :key="p.id"
                :class="{
                  'row-low-stock': p.stockActual > 0 && p.stockMinimo != null && p.stockActual <= p.stockMinimo,
                  'row-out-stock': p.stockActual === 0
                }"
              >
                <td class="fw-semibold">
                  {{ p.nombre }}
                  <div class="helper-text">
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

                <td class="fw-bold" :class="{ 'stock-zero': p.stockActual === 0 }">
                  {{ p.stockActual }}

                  <span
                    v-if="p.stockActual === 0"
                    class="badge badge-soft-danger ms-2"
                  >
                    Sin stock
                  </span>

                  <span
                    v-else-if="p.stockMinimo != null && p.stockActual <= p.stockMinimo"
                    class="badge badge-soft-warning ms-2"
                  >
                    Bajo stock
                  </span>
                </td>

                <td class="text-end text-secondary">$ {{ formatMoney(p.precioVenta) }}</td>
                <td class="text-end text-secondary">
                  {{ p.precioMayorista != null ? "$ " + formatMoney(p.precioMayorista) : "-" }}
                </td>

                <td class="text-end">
                  <div class="btn-group flex-wrap">
                    <button
                      class="btn btn-sm btn-outline-light"
                      :disabled="saving"
                      @click="applyStockDelta(p, -Math.abs(stockDelta || 0))"
                    >
                      -{{ Math.abs(stockDelta || 0) }}
                    </button>

                    <button
                      class="btn btn-sm btn-outline-light"
                      :disabled="saving"
                      @click="applyStockDelta(p, +Math.abs(stockDelta || 0))"
                    >
                      +{{ Math.abs(stockDelta || 0) }}
                    </button>

                    <button
                      class="btn btn-sm btn-outline-light"
                      :disabled="saving"
                      @click="openEdit(p)"
                    >
                      Editar
                    </button>

                    <button
                      class="btn btn-sm btn-outline-danger"
                      :disabled="saving"
                      @click="eliminarProducto(p.id)"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filtered.length === 0">
                <td colspan="7" class="text-secondary">No hay productos para mostrar.</td>
              </tr>
            </tbody>
          </table>

          <div class="mt-3">
            <Pager
              :page="page"
              :size="size"
              :total-elements="totalElements"
              :total-pages="totalPages"
              :loading="loading"
              @update:page="onPageChange"
              @update:size="onSizeChange"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="editing" class="modal-backdrop" @click.self="closeEdit">
      <div class="modal-card">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Editar producto</h2>
          <button class="btn btn-sm btn-outline-light" @click="closeEdit" :disabled="saving">
            Cerrar
          </button>
        </div>

        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label field-label">Nombre</label>
            <input v-model="editForm.nombre" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label field-label">Código</label>
            <input v-model="editForm.codigoProducto" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label field-label">Categoría</label>
            <div class="input-group">
              <select v-model="editForm.categoriaId" class="form-select app-input">
                <option value="">(sin)</option>
                <option v-for="c in categorias" :key="c.categoriaId ?? c.id" :value="String(c.categoriaId ?? c.id)">
                  {{ c.nombre ?? c.name }}
                </option>
              </select>
              <button class="btn btn-outline-light" type="button" @click="openCategoriaModal">+ Cat</button>
            </div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label field-label">Marca</label>
            <div class="input-group">
              <select v-model="editForm.marcaId" class="form-select app-input">
                <option value="">(sin)</option>
                <option v-for="m in marcas" :key="m.marcaId ?? m.id" :value="String(m.marcaId ?? m.id)">
                  {{ m.nombre ?? m.name }}
                </option>
              </select>
              <button class="btn btn-outline-light" type="button" @click="openMarcaModal">+ Marca</button>
            </div>
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label field-label">Stock</label>
            <input v-model.number="editForm.stockActual" type="number" class="form-control app-input" />
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label field-label">Mínimo</label>
            <input v-model.number="editForm.stockMinimo" type="number" class="form-control app-input" />
          </div>

          <div class="col-6 col-md-2">
            <label class="form-label field-label">Máximo</label>
            <input v-model.number="editForm.stockMaximo" type="number" class="form-control app-input" />
          </div>

          <div class="col-12">
            <button
              class="btn btn-sm btn-outline-light"
              type="button"
              @click="showCostoEdicion = !showCostoEdicion"
            >
              {{ showCostoEdicion ? "Ocultar costo" : "Mostrar costo" }}
            </button>
          </div>

          <div v-if="showCostoEdicion" class="col-12 col-md-6">
            <label class="form-label field-label">Costo</label>
            <input v-model="editForm.precioCosto" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label field-label">Venta</label>
            <input v-model="editForm.precioVenta" class="form-control app-input" />
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label field-label">Mayorista</label>
            <input v-model="editForm.precioMayorista" class="form-control app-input" />
          </div>

          <div class="col-12 d-flex gap-2 mt-2">
            <button class="btn btn-outline-light" @click="closeEdit" :disabled="saving">
              Cancelar
            </button>
            <button class="btn btn-primary btn-accent" @click="saveEdit" :disabled="saving">
              {{ saving ? "Guardando..." : "Guardar cambios" }}
            </button>
          </div>
        </div>

        <div class="helper-text mt-3">
          El costo queda oculto por defecto. Usá los botones +/- para ajustar el stock rápidamente.
        </div>
      </div>
    </div>

    <div v-if="showMarcaModal" class="modal-backdrop" @click.self="closeMarcaModal">
      <div class="modal-card modal-card-sm">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Nueva marca</h2>
          <button class="btn btn-sm btn-outline-light" @click="closeMarcaModal" :disabled="saving">
            Cerrar
          </button>
        </div>

        <label class="form-label field-label">Nombre</label>
        <input
          v-model="newMarcaNombre"
          class="form-control app-input"
          placeholder="Ej: Pantene"
          @keyup.enter="crearMarca"
        />

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-outline-light" @click="closeMarcaModal" :disabled="saving">
            Cancelar
          </button>
          <button class="btn btn-primary btn-accent" @click="crearMarca" :disabled="saving">
            {{ saving ? "Guardando..." : "Crear" }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCategoriaModal" class="modal-backdrop" @click.self="closeCategoriaModal">
      <div class="modal-card modal-card-sm">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Nueva categoría</h2>
          <button class="btn btn-sm btn-outline-light" @click="closeCategoriaModal" :disabled="saving">
            Cerrar
          </button>
        </div>

        <label class="form-label field-label">Nombre</label>
        <input
          v-model="newCategoriaNombre"
          class="form-control app-input"
          placeholder="Ej: Shampoos"
          @keyup.enter="crearCategoria"
        />

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-outline-light" @click="closeCategoriaModal" :disabled="saving">
            Cancelar
          </button>
          <button class="btn btn-primary btn-accent" @click="crearCategoria" :disabled="saving">
            {{ saving ? "Guardando..." : "Crear" }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="confirmState.open" class="modal-backdrop" @click.self="closeConfirm">
      <div class="confirm-card">
        <div class="confirm-icon" :class="`confirm-icon--${confirmState.variant}`">
          <span v-if="confirmState.variant === 'danger'">!</span>
          <span v-else-if="confirmState.variant === 'warning'">!</span>
          <span v-else>✓</span>
        </div>

        <div class="confirm-title">{{ confirmState.title }}</div>
        <div class="confirm-text">{{ confirmState.message }}</div>

        <div class="confirm-actions">
          <button class="btn btn-outline-light" @click="closeConfirm">
            Cancelar
          </button>

          <button
            class="btn"
            :class="{
              'btn-confirm-primary': confirmState.variant === 'primary',
              'btn-confirm-danger': confirmState.variant === 'danger',
              'btn-confirm-warning': confirmState.variant === 'warning',
            }"
            @click="confirmAccept"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.productos-page {
  min-height: 100%;
}

.modal-card-sm {
  max-width: 520px;
}
</style>