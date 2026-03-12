<script setup>
import { computed } from "vue"

const props = defineProps({
  page: { type: Number, default: 0 },
  size: { type: Number, default: 10 },
  totalElements: { type: Number, default: 0 },
  totalPages: { type: Number, default: 1 },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(["update:page", "update:size"])

const currentPage = computed(() => Number(props.page ?? 0))
const pages = computed(() => Math.max(1, Number(props.totalPages ?? 1)))

const canPrev = computed(() => currentPage.value > 0)
const canNext = computed(() => currentPage.value < pages.value - 1)

function prev() {
  if (!canPrev.value || props.loading) return
  emit("update:page", currentPage.value - 1)
}

function next() {
  if (!canNext.value || props.loading) return
  emit("update:page", currentPage.value + 1)
}
</script>

<template>
  <div class="app-pager">
    <button
      class="btn btn-outline-light"
      @click="prev"
      :disabled="!canPrev || loading"
    >
      Anterior
    </button>

    <div class="app-pager__info">
      Página <b>{{ currentPage + 1 }}</b> de <b>{{ pages }}</b>
    </div>

    <button
      class="btn btn-outline-light"
      @click="next"
      :disabled="!canNext || loading"
    >
      Siguiente
    </button>
  </div>
</template>