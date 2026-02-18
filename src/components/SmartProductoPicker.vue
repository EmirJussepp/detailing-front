<script setup>
import { computed, ref, watch } from "vue"
import { useDebouncedRef } from "../composables/useDebouncedRef"
import { normStr, looksLikeCode } from "../utils/searchNorm"

const props = defineProps({
  disabled: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  fetcher: { type: Function, default: null }, // async(q) => productos
  limit: { type: Number, default: 40 },
})

const emit = defineEmits(["pick", "enterPick"])

const q = ref("")
const qDeb = useDebouncedRef(q, 250)

const loading = ref(false)
const results = ref([])

function normalizeProduct(p) {
  return {
    id: Number(p.id ?? p.productoId),
    nombre: p.nombre,
    codigoProducto: p.codigoProducto ?? null,
    categoria: p.categoria ?? null,
    stockActual: p.stockActual == null ? null : Number(p.stockActual),
    precioVenta: Number(p.precioVenta ?? 0),
    precioCosto: Number(p.precioCosto ?? 0),
    precioMayorista: p.precioMayorista == null ? null : Number(p.precioMayorista),
  }
}

function parseCodigoConCantidad(raw) {
  const s = String(raw ?? "").trim()
  if (!s) return { code: "", qty: 1 }

  const m1 = s.match(/^(.+?)(?:\s*[*xX]\s*)(\d+)$/)
  if (m1) return { code: m1[1].trim(), qty: Math.max(1, parseInt(m1[2], 10)) }

  const m2 = s.match(/^(.+?)\s+(\d+)$/)
  if (m2) return { code: m2[1].trim(), qty: Math.max(1, parseInt(m2[2], 10)) }

  return { code: s, qty: 1 }
}

async function runSearch() {
  const term = String(qDeb.value ?? "").trim()
  if (term.length < 2) {
    results.value = []
    return
  }

  if (props.fetcher) {
    loading.value = true
    try {
      const arr = await props.fetcher(term, props.limit)
      results.value = (Array.isArray(arr) ? arr : []).map(normalizeProduct).slice(0, props.limit)
    } finally {
      loading.value = false
    }
    return
  }

  const t = normStr(term)
  const list = props.items || []
  results.value = list
    .filter(p => {
      const n = normStr(p.nombre)
      const c = normStr(p.codigoProducto)
      const cat = normStr(p.categoria)
      return n.includes(t) || c.includes(t) || cat.includes(t)
    })
    .slice(0, props.limit)
}

watch(qDeb, runSearch)

function onEnter() {
  const raw = String(q.value ?? "").trim()
  if (!raw) return

  const { code, qty } = parseCodigoConCantidad(raw)
  const codeN = normStr(code)

  // si parece código: intentamos match exacto
  if (looksLikeCode(code)) {
    const exact =
      results.value.find(p => normStr(p.codigoProducto) === codeN) ||
      (props.items || []).find(p => normStr(p.codigoProducto) === codeN)

    if (exact) {
      emit("enterPick", { producto: exact, qty })
      q.value = ""
      results.value = []
      return
    }
  }

  if (results.value.length === 1) {
    emit("enterPick", { producto: results.value[0], qty: 1 })
    q.value = ""
    results.value = []
    return
  }
}
</script>

<template>
  <div>
    <label class="form-label text-secondary">Buscar / Escanear</label>
    <input
      v-model="q"
      class="form-control bg-dark text-white border-secondary"
      :disabled="disabled"
      placeholder="Ej: CERA-001*3 | shampoo"
      @keydown.enter.prevent="onEnter"
    />
    <div class="text-secondary small mt-1">
      Enter: código exacto (si existe) · o agrega si hay 1 coincidencia.
    </div>

    <div v-if="loading" class="text-secondary small mt-2">Buscando...</div>

    <div v-if="results.length" class="table-responsive mt-2">
      <table class="table table-dark table-hover align-middle mb-0">
        <thead>
          <tr>
            <th>Producto</th>
            <th style="width:160px">Código</th>
            <th style="width:120px" class="text-end">Stock</th>
            <th style="width:170px" class="text-end">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in results" :key="p.id">
            <td class="fw-semibold">{{ p.nombre }}</td>
            <td class="text-secondary">{{ p.codigoProducto || "-" }}</td>
            <td class="text-end text-secondary">{{ p.stockActual ?? "-" }}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-light" @click="$emit('pick', p)">
                Agregar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
