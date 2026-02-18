import { ref, watch } from "vue"

export function useDebouncedRef(sourceRef, delay = 250) {
  const debounced = ref(sourceRef.value)
  let t = null

  watch(sourceRef, (v) => {
    clearTimeout(t)
    t = setTimeout(() => {
      debounced.value = v
    }, delay)
  }, { immediate: true })

  return debounced
}
