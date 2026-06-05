import { ref } from 'vue'

// Cross-component drag state for "drag asset(s) out of the dock onto the canvas
// → create Load Image node(s)" (Figma 1780-48220 / 1780-37134 / 1797-20347). The
// dock initiates; the canvas registers its element + a drop handler. A pill ghost
// (AssetDragGhost) follows the cursor. `overCanvas` drives the ghost hint + the
// add-cursor. Module-level refs = a shared singleton.
const names = ref<string[]>([]) // assets being dragged
const pos = ref<{ x: number; y: number } | null>(null) // ghost position (client coords)
const dragging = ref(false)
const overCanvas = ref(false) // pointer currently over the drop target

// "Insert into workflow" (context menu) → queue asset names for the canvas to turn
// into Load Image nodes. Reactive so an already-mounted canvas (dock) reacts; the
// canvas also drains it onMounted (when navigating to the workflow tab fresh).
const pendingInserts = ref<string[]>([])

let canvasEl: HTMLElement | null = null
let onDrop: ((names: string[], clientX: number, clientY: number) => void) | null = null

function hitCanvas(x: number, y: number) {
  const r = canvasEl?.getBoundingClientRect()
  return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

export function useAssetDrag() {
  return {
    names,
    pos,
    dragging,
    overCanvas,
    pendingInserts,
    /** Queue asset(s) to be inserted as nodes (used by "Insert into workflow"). */
    requestInsert(n: string[]) {
      if (n.length) pendingInserts.value = [...pendingInserts.value, ...n]
    },
    /** Canvas drains the queue (returns + clears the pending names). */
    takeInserts(): string[] {
      const n = pendingInserts.value
      pendingInserts.value = []
      return n
    },
    /** The canvas registers its element (for the hit-test) + node creation. */
    registerCanvas(el: HTMLElement | null, drop: (names: string[], cx: number, cy: number) => void) {
      canvasEl = el
      onDrop = drop
    },
    begin(n: string[], x: number, y: number) {
      names.value = n
      pos.value = { x, y }
      dragging.value = true
      overCanvas.value = hitCanvas(x, y)
    },
    move(x: number, y: number) {
      if (!dragging.value) return
      pos.value = { x, y }
      overCanvas.value = hitCanvas(x, y)
    },
    /** Returns true if the assets landed on the canvas (→ node[s] created). */
    drop(x: number, y: number): boolean {
      const over = dragging.value && hitCanvas(x, y)
      if (over) onDrop?.(names.value, x, y)
      dragging.value = false
      pos.value = null
      overCanvas.value = false
      names.value = []
      return over
    },
    cancel() {
      dragging.value = false
      pos.value = null
      overCanvas.value = false
      names.value = []
    },
  }
}
