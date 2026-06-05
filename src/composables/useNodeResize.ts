import { onBeforeUnmount, ref } from 'vue'

/**
 * Drag-to-resize for a canvas node's bottom-right handle. Resizes WIDTH only
 * (node height follows its content); the current/default size is the minimum.
 * The drag delta is divided by the canvas zoom so the handle tracks the cursor
 * 1:1 at any zoom level.
 */
const MIN_W = 360 // = the default (current) node width — can only grow
const MAX_W = 600

export function useNodeResize(getZoom: () => number) {
  const width = ref(MIN_W)
  let startX = 0
  let startW = 0

  function onMove(e: PointerEvent) {
    const z = getZoom() || 1
    width.value = Math.max(MIN_W, Math.min(MAX_W, startW + (e.clientX - startX) / z))
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  function onResizeStart(e: PointerEvent) {
    if (e.button !== 0) return
    startX = e.clientX
    startW = width.value
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  onBeforeUnmount(onUp)
  return { width, onResizeStart }
}
