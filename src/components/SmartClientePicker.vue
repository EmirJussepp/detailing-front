<script setup>
import { computed, ref, watch } from "vue"
import { useDebouncedRef } from "../composables/useDebouncedRef"
import { normStr, onlyDigits } from "../utils/searchNorm"

const props = defineProps({
  modelValue: { type: [String, Number], default: "" },
  disabled: { type: Boolean, default: false },

  // ✅ Modo A: función async(q) => array clientes
  // ✅ Modo B: lista completa
  fetcher: { type: Function, default: null },
  items: { type: Array, default: () => [] },

  limit: { type: Number, default: 30 },
})

const emit = defineEmits(["update:modelValue", "picked"])

const q = ref("")
const qDeb = useDebouncedRef(q, 250)

const loading = ref(false)
const results = ref([])

function pick(c) {
  emit("update:modelValue", String(c.id))
  emit("picked", c)
  q.value = ""
  results.value = []
}

function clientLabel(c) {
  return `${c.nombre} ${c.apellido || ""} — DNI: ${c.dni || "-"}`
}

async function runSearch() {
  const term = String(qDeb.value ?? "").trim()
  if (term.length < 2) {
    results.value = []
    return
  }

  // MODO A
  if (props.fetcher) {
    loading.value = true
    try {
      const arr = await props.fetcher(term, props.limit)
      results.value = Array.isArray(arr) ? arr.slice(0, props.limit) : []
    } finally {
      loading.value = false
    }
    return
  }

  // MODO B (filtra local)
  const termN = normStr(term)
  const dni = onlyDigits(term)
  const list = props.items || []

  let filtered = list.filter(c => {
    const full = normStr(`${c.nombre} ${c.apellido || ""}`)
    const dniC = onlyDigits(c.dni)
    return full.includes(termN) || (dni && dniC.includes(dni))
  })

  // prioridad por DNI exacto
  if (dni) {
    const exact = filtered.find(c => onlyDigits(c.dni) === dni)
    if (exact) filtered = [exact, ...filtered.filter(x => x.id !== exact.id)]
  }

  results.value = filtered.slice(0, props.limit)
}

watch(qDeb, runSearch, { immediate: false })

const selectedLabel = computed(() => {
  const id = String(props.modelValue || "")
  if (!id) return "Sin cliente"
  const c = (props.items || []).find(x => String(x.id) === id)
  return c ? clientLabel(c) : `Cliente #${id}`
})
</script>

<template>
  <div>
    <label class="form-label text-secondary">Cliente (opcional)</label>

    <div class="d-flex gap-2">
      <input
        v-model="q"
        class="form-control bg-dark text-white border-secondary"
        :disabled="disabled"
        placeholder="Buscar por nombre o DNI..."
      />
    </div>

    <div class="text-secondary small mt-1">
      Seleccionado: <b>{{ selectedLabel }}</b>
    </div>

    <div v-if="loading" class="text-secondary small mt-2">Buscando...</div>

    <div v-if="results.length" class="list-group mt-2">
      <button
        v-for="c in results"
        :key="c.id"
        type="button"
        class="list-group-item list-group-item-action bg-dark text-white border-secondary"
        @click="pick(c)"
      >
        {{ clientLabel(c) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-group-item { cursor: pointer; }
</style>
