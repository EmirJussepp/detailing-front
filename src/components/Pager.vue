<template>
  <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between mt-3">
    <div class="text-secondary small">
      Mostrando
      <b>{{ from }}</b>-<b>{{ to }}</b>
      de <b>{{ totalElements }}</b>
      · Página <b>{{ pageDisplay }}</b>/<b>{{ totalPagesSafe }}</b>
    </div>

    <div class="d-flex gap-2 align-items-center">
      <select class="form-select form-select-sm bg-panel text-light border-0"
              style="width: 110px"
              :value="size"
              @change="onSize($event.target.value)">
        <option v-for="n in sizeOptions" :key="n" :value="n">{{ n }}/pág</option>
      </select>

      <button class="btn btn-outline-light btn-sm"
              :disabled="page <= 0 || loading"
              @click="$emit('update:page', page - 1)">
        ← Anterior
      </button>

      <button class="btn btn-outline-light btn-sm"
              :disabled="page >= totalPagesSafe - 1 || loading"
              @click="$emit('update:page', page + 1)">
        Siguiente →
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue"

const props = defineProps({
  page: { type: Number, default: 0 },          // 0-based
  size: { type: Number, default: 10 },
  totalPages: { type: Number, default: 1 },
  totalElements: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  sizeOptions: { type: Array, default: () => [10, 20, 50, 100] },
})

const totalPagesSafe = computed(() => Math.max(1, Number(props.totalPages || 1)))
const pageDisplay = computed(() => Math.min(totalPagesSafe.value, props.page + 1))

const from = computed(() => {
  if (!props.totalElements) return 0
  return props.page * props.size + 1
})
const to = computed(() => {
  if (!props.totalElements) return 0
  return Math.min(props.totalElements, (props.page + 1) * props.size)
})

function onSize(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return
  // cuando cambia size: volvemos a page 0 y avisamos al padre
  // el padre decide recargar
  // emit update:size
  // eslint-disable-next-line no-undef
  emit("update:size", n)
  // eslint-disable-next-line no-undef
  emit("update:page", 0)
}

const emit = defineEmits(["update:page", "update:size"])
</script>