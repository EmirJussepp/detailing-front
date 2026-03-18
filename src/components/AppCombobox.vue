<script setup>
/**
 * AppCombobox — selector con búsqueda en tiempo real.
 *
 * Props:
 *  - modelValue: id seleccionado (String | Number | null)
 *  - items: array de { id, label, sublabel? }
 *  - placeholder: string
 *  - disabled: boolean
 *  - clearable: boolean — muestra botón para limpiar
 *
 * Emits:
 *  - update:modelValue(id)
 *  - picked(item)
 */

import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue"
import { normStr } from "../utils/searchNorm"

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  items:       { type: Array,           default: () => [] },
  placeholder: { type: String,          default: "Buscar..." },
  disabled:    { type: Boolean,         default: false },
  clearable:   { type: Boolean,         default: true },
  limit:       { type: Number,          default: 50 },
})

const emit = defineEmits(["update:modelValue", "picked"])

const q         = ref("")
const open      = ref(false)
const rootRef   = ref(null)
const inputRef  = ref(null)
const activeIdx = ref(-1)

// ── Ítem seleccionado actual ──────────────────────────────────────────
const selected = computed(() => {
  if (props.modelValue == null || props.modelValue === "") return null
  return props.items.find(i => String(i.id) === String(props.modelValue)) ?? null
})

const displayLabel = computed(() => selected.value?.label ?? "")

// ── Filtrado ──────────────────────────────────────────────────────────
const filtered = computed(() => {
  const t = normStr(q.value)
  if (!t) return props.items.slice(0, props.limit)
  return props.items
    .filter(i => normStr(i.label).includes(t) || normStr(i.sublabel ?? "").includes(t))
    .slice(0, props.limit)
})

// ── Abrir / cerrar ────────────────────────────────────────────────────
function openDropdown() {
  if (props.disabled) return
  q.value = ""
  open.value = true
  activeIdx.value = -1
}

function closeDropdown() {
  open.value = false
  q.value = ""
  activeIdx.value = -1
}

function pick(item) {
  emit("update:modelValue", item.id)
  emit("picked", item)
  closeDropdown()
}

function clear(e) {
  e.stopPropagation()
  emit("update:modelValue", null)
  emit("picked", null)
  closeDropdown()
}

// ── Teclado ───────────────────────────────────────────────────────────
function onKeydown(e) {
  if (!open.value) return

  if (e.key === "ArrowDown") {
    e.preventDefault()
    activeIdx.value = Math.min(activeIdx.value + 1, filtered.value.length - 1)
  } else if (e.key === "ArrowUp") {
    e.preventDefault()
    activeIdx.value = Math.max(activeIdx.value - 1, 0)
  } else if (e.key === "Enter") {
    e.preventDefault()
    if (activeIdx.value >= 0 && filtered.value[activeIdx.value]) {
      pick(filtered.value[activeIdx.value])
    } else if (filtered.value.length === 1) {
      pick(filtered.value[0])
    }
  } else if (e.key === "Escape") {
    closeDropdown()
  }
}

// ── Click fuera cierra ────────────────────────────────────────────────
function onOutsideClick(e) {
  if (rootRef.value && !rootRef.value.contains(e.target)) {
    closeDropdown()
  }
}

onMounted(() => document.addEventListener("mousedown", onOutsideClick))
onBeforeUnmount(() => document.removeEventListener("mousedown", onOutsideClick))

watch(open, (v) => {
  if (v) {
    setTimeout(() => inputRef.value?.focus(), 30)
  }
})
</script>

<template>
  <div ref="rootRef" class="acb-root" :class="{ 'acb--disabled': disabled }">

    <!-- Trigger (muestra el ítem seleccionado o placeholder) -->
    <div
      class="acb-trigger app-input"
      :class="{ 'acb-trigger--open': open }"
      @click="openDropdown"
      role="combobox"
      :aria-expanded="open"
    >
      <span v-if="selected" class="acb-trigger-label">{{ displayLabel }}</span>
      <span v-else class="acb-trigger-placeholder">{{ placeholder }}</span>

      <div class="acb-trigger-icons">
        <button
          v-if="clearable && selected && !disabled"
          class="acb-clear"
          type="button"
          @click="clear"
          aria-label="Limpiar"
        >✕</button>
        <span class="acb-chevron" :class="{ 'acb-chevron--up': open }">▾</span>
      </div>
    </div>

    <!-- Dropdown -->
    <div v-if="open" class="acb-dropdown">
      <div class="acb-search-wrap">
        <input
          ref="inputRef"
          v-model="q"
          class="acb-search"
          :placeholder="placeholder"
          @keydown="onKeydown"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div class="acb-list">
        <div v-if="!filtered.length" class="acb-empty">
          Sin resultados
        </div>

        <button
          v-for="(item, idx) in filtered"
          :key="item.id"
          type="button"
          class="acb-item"
          :class="{ 'acb-item--active': idx === activeIdx, 'acb-item--selected': String(item.id) === String(modelValue) }"
          @click="pick(item)"
          @mouseenter="activeIdx = idx"
        >
          <span class="acb-item-label">{{ item.label }}</span>
          <span v-if="item.sublabel" class="acb-item-sub">{{ item.sublabel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.acb-root {
  position: relative;
  width: 100%;
}

.acb--disabled {
  opacity: 0.6;
  pointer-events: none;
}

/* Trigger */
.acb-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  padding: 0 12px;
  border-radius: var(--app-radius-input, 12px);
}

.acb-trigger--open {
  border-color: rgba(123, 104, 255, 0.55) !important;
  box-shadow: 0 0 0 0.18rem rgba(123, 104, 255, 0.16);
}

.acb-trigger-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #fff;
  font-size: 0.95rem;
}

.acb-trigger-placeholder {
  flex: 1;
  color: rgba(255, 255, 255, 0.38);
  font-size: 0.95rem;
}

.acb-trigger-icons {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.acb-clear {
  background: none;
  border: none;
  color: rgba(255,255,255,.45);
  font-size: 11px;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;
}

.acb-clear:hover {
  color: #fff;
  background: rgba(255,255,255,.1);
}

.acb-chevron {
  color: rgba(255,255,255,.45);
  font-size: 13px;
  transition: transform 0.15s;
  display: inline-block;
}

.acb-chevron--up {
  transform: rotate(180deg);
}

/* Dropdown */
.acb-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 200;
  background: #111827;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 12px;
  box-shadow: 0 12px 36px rgba(0,0,0,.45);
  overflow: hidden;
}

.acb-search-wrap {
  padding: 8px 8px 4px;
  border-bottom: 1px solid rgba(255,255,255,.07);
}

.acb-search {
  width: 100%;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 8px;
  color: #fff;
  padding: 7px 10px;
  font-size: 0.9rem;
  outline: none;
}

.acb-search::placeholder {
  color: rgba(255,255,255,.35);
}

.acb-search:focus {
  border-color: rgba(123,104,255,.5);
  background: rgba(255,255,255,.08);
}

/* Lista */
.acb-list {
  max-height: 240px;
  overflow-y: auto;
  padding: 4px 0;
}

.acb-empty {
  padding: 12px 14px;
  color: rgba(255,255,255,.45);
  font-size: 0.88rem;
  text-align: center;
}

.acb-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  background: none;
  border: none;
  padding: 8px 14px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.acb-item:hover,
.acb-item--active {
  background: rgba(123, 104, 255, 0.14);
}

.acb-item--selected {
  background: rgba(123, 104, 255, 0.1);
}

.acb-item-label {
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.3;
}

.acb-item-sub {
  color: rgba(255,255,255,.5);
  font-size: 0.78rem;
  line-height: 1.2;
}

/* Scrollbar del dropdown */
.acb-list::-webkit-scrollbar { width: 4px; }
.acb-list::-webkit-scrollbar-track { background: transparent; }
.acb-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 4px; }
</style>