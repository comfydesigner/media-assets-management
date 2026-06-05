import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Tracks an element's content-box width via ResizeObserver. Bind the returned
 * `el` ref to the element you want to measure and read `width` reactively.
 *
 * Used to drive container-style responsive breakpoints off an element's own
 * width (e.g. the gallery), rather than the viewport — the side panel / dock
 * eat horizontal space, so viewport widths would be wrong.
 */
export function useElementWidth() {
  const el = ref<HTMLElement | null>(null)
  const width = ref(0)
  let ro: ResizeObserver | null = null

  onMounted(() => {
    if (!el.value) return
    const measure = () => (width.value = el.value!.clientWidth)
    measure()
    ro = new ResizeObserver(measure)
    ro.observe(el.value)
  })
  onBeforeUnmount(() => ro?.disconnect())

  return { el, width }
}
