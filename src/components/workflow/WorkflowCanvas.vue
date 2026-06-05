<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ChevronDown,
  CornerUpRight,
  EllipsisVertical,
  Frame,
  Shrink,
  Trash2,
} from 'lucide-vue-next'
import WorkflowIcon from '@/components/icons/WorkflowIcon.vue'
import LoadImageNode from './LoadImageNode.vue'
import SaveImageNode from './SaveImageNode.vue'
import RunToolbar from './RunToolbar.vue'
import Minimap from './Minimap.vue'
import CanvasControls from './CanvasControls.vue'
import { useAssetDrag } from '@/composables/useAssetDrag'
import { useTabs } from '@/composables/useTabs'

const canvasRef = ref<HTMLElement | null>(null)

// Pan/zoom of the canvas (canvas coords).
const panX = ref(60)
const panY = ref(48)
const zoom = ref(1)

// Minimap visibility — the minimap's X closes it; the controls' map button re-opens.
const minimapOpen = ref(true)

// Nodes on the canvas. The first is a pre-placed demo node; dropping assets from
// the dock appends Load Image nodes (Figma 1780-48220). The "Save Image Demo"
// workflow tab seeds a Save Image node instead (the canvas is keyed per tab, so
// the active tab id at mount identifies which workflow this instance is).
type CanvasNode = { id: number; type: 'load' | 'save'; name: string; x: number; y: number }
let nextId = 1
const isSaveDemo = useTabs().activeId.value === 'workflow-2'
const nodes = ref<CanvasNode[]>([
  { id: 0, type: isSaveDemo ? 'save' : 'load', name: '', x: 320, y: 120 },
])
const selectedIds = ref<Set<number>>(new Set([0]))

const zoomPct = computed(() => Math.round(zoom.value * 100))

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2

// PAN is the default drag (panning is the common action). Marquee select is the
// modifier action (Ctrl/⌘ + drag). Cursor stays the default arrow either way.
const mode = ref<'pan' | null>(null)
let dragNodes: CanvasNode[] | null = null
let lastX = 0
let lastY = 0
// A LEFT pan that never moves is treated as a click on empty canvas → deselect
// (panning is the default drag, but a bare click should still clear selection).
let panIsLeft = false
let pressStartX = 0
let pressStartY = 0
let pressMoved = false

function beginPointer(e: PointerEvent) {
  lastX = e.clientX
  lastY = e.clientY
  pressStartX = e.clientX
  pressStartY = e.clientY
  pressMoved = false
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
function onMove(e: PointerEvent) {
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
  if (!pressMoved && Math.hypot(e.clientX - pressStartX, e.clientY - pressStartY) > DRAG_THRESHOLD) {
    pressMoved = true
  }
  if (mode.value === 'pan') {
    panX.value += dx
    panY.value += dy
  } else if (dragNodes) {
    for (const n of dragNodes) {
      n.x += dx / zoom.value
      n.y += dy / zoom.value
    }
  }
}
function onUp() {
  // Bare left click on empty canvas (pan that didn't move) → clear selection.
  if (mode.value === 'pan' && panIsLeft && !pressMoved) selectedIds.value = new Set()
  mode.value = null
  dragNodes = null
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
}

/* ── Marquee (rubber-band) select ─────────────────────────────────────────────
   Ctrl/⌘ + drag rubber-band-selects nodes; a click (no drag) on empty space
   deselects. A plain drag pans instead (see onCanvasPointerDown). */
const marquee = ref<{ left: number; top: number; width: number; height: number } | null>(null)
let mqStartX = 0
let mqStartY = 0
let mqActive = false
const DRAG_THRESHOLD = 4

function rectsIntersect(
  a: DOMRect,
  b: { left: number; top: number; right: number; bottom: number },
) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
}

function onMarqueeMove(e: PointerEvent) {
  if (!mqActive && Math.hypot(e.clientX - mqStartX, e.clientY - mqStartY) < DRAG_THRESHOLD) return
  mqActive = true
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const left = Math.min(mqStartX, e.clientX)
  const top = Math.min(mqStartY, e.clientY)
  const right = Math.max(mqStartX, e.clientX)
  const bottom = Math.max(mqStartY, e.clientY)
  marquee.value = { left: left - rect.left, top: top - rect.top, width: right - left, height: bottom - top }

  // Hit-test node DOM rects (in document order == nodes order).
  const els = [...(canvasRef.value?.querySelectorAll<HTMLElement>('[data-node]') ?? [])]
  const ids = new Set<number>()
  els.forEach((el, i) => {
    if (rectsIntersect(el.getBoundingClientRect(), { left, top, right, bottom })) {
      const n = nodes.value[i]
      if (n) ids.add(n.id)
    }
  })
  selectedIds.value = ids
}
function onMarqueeUp() {
  window.removeEventListener('pointermove', onMarqueeMove)
  window.removeEventListener('pointerup', onMarqueeUp)
  if (!mqActive) selectedIds.value = new Set() // click on empty space → deselect
  mqActive = false
  marquee.value = null
}

// Canvas background: middle-mouse hold pans anywhere (Figma-style); Ctrl/⌘-held →
// marquee (drag) / deselect (click); otherwise a plain LEFT drag PANS (the default
// — panning is used more than box-select).
function onCanvasPointerDown(e: PointerEvent) {
  // Middle button (1) pans from anywhere — incl. over a node, since
  // onNodePointerDown ignores non-left buttons and lets the press bubble here.
  if (e.button === 1) {
    e.preventDefault()
    mode.value = 'pan'
    panIsLeft = false // middle-pan never deselects on click
    beginPointer(e)
    return
  }
  if (e.button !== 0) return
  if (e.ctrlKey || e.metaKey) {
    mqStartX = e.clientX
    mqStartY = e.clientY
    mqActive = false
    window.addEventListener('pointermove', onMarqueeMove)
    window.addEventListener('pointerup', onMarqueeUp)
    return
  }
  mode.value = 'pan'
  panIsLeft = true // a bare left click (no drag) clears selection on pointerup
  beginPointer(e)
}
// Press ANYWHERE on a node selects it AND begins a drag (the whole node is a drag
// handle, not just the header). A press on a node already in the current
// (multi-)selection keeps the selection so the drag moves the whole group;
// otherwise it selects just this node.
function onNodePointerDown(node: CanvasNode, e: PointerEvent) {
  if (e.button !== 0) return
  e.stopPropagation() // don't let the canvas start a pan / marquee
  if (!selectedIds.value.has(node.id)) selectedIds.value = new Set([node.id])
  dragNodes =
    selectedIds.value.has(node.id) && selectedIds.value.size > 1
      ? nodes.value.filter((n) => selectedIds.value.has(n.id))
      : [node]
  beginPointer(e)
}

// Remove the currently-selected node(s) — used by Delete/Backspace and the
// group toolbar's trash button.
function deleteSelected() {
  if (!selectedIds.value.size) return
  nodes.value = nodes.value.filter((n) => !selectedIds.value.has(n.id))
  selectedIds.value = new Set()
}

// Remove a single node by id — used by the per-node toolbar's trash button.
function deleteNode(id: number) {
  nodes.value = nodes.value.filter((n) => n.id !== id)
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
    selectedIds.value = new Set(selectedIds.value)
  }
}

/* ── Multi-select group box (Figma 1797-21186) ────────────────────────────────
   When 2+ nodes are selected, draw a dashed bounding box (in layer coords, so it
   pans/zooms with the nodes) around their union + a shared group toolbar above
   it. Node body is a fixed 320×448. */
const NODE_W = 360
const NODE_H = 448
const GROUP_PAD = 16
const selBox = computed(() => {
  const sel = nodes.value.filter((n) => selectedIds.value.has(n.id))
  if (sel.length < 2) return null
  const minX = Math.min(...sel.map((n) => n.x))
  const minY = Math.min(...sel.map((n) => n.y))
  const maxX = Math.max(...sel.map((n) => n.x + NODE_W))
  const maxY = Math.max(...sel.map((n) => n.y + NODE_H))
  return {
    left: minX - GROUP_PAD,
    top: minY - GROUP_PAD,
    width: maxX - minX + GROUP_PAD * 2,
    height: maxY - minY + GROUP_PAD * 2,
  }
})

/* ── Keyboard: Delete/Backspace = remove selected node(s) ──────────────────── */
function isTyping() {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}
function onKeyDown(e: KeyboardEvent) {
  if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping() && selectedIds.value.size) {
    e.preventDefault()
    deleteSelected()
  }
}

// Receive assets dropped from the dock → create Load Image node(s) at the drop
// point, laid out in a 2-column GRID (not cascaded), then select the new node(s)
// (Figma 1797-21186). The store gates the drop to inside the canvas.
const drag = useAssetDrag()
const GRID_COLS = 2
const COL_STEP = 360 // node is 320px wide
const ROW_STEP = 500 // node is ~460px tall

// Create Load Image node(s) from `names` in a 2-column grid starting at (baseX,
// baseY) in canvas coords, then select them. Shared by drop + insert.
function addNodes(names: string[], baseX: number, baseY: number) {
  const ids: number[] = []
  names.forEach((name, i) => {
    const node: CanvasNode = {
      id: nextId++,
      type: 'load',
      name,
      x: baseX + (i % GRID_COLS) * COL_STEP,
      y: baseY + Math.floor(i / GRID_COLS) * ROW_STEP,
    }
    nodes.value.push(node)
    ids.push(node.id)
  })
  if (ids.length) selectedIds.value = new Set(ids)
}

// "Insert into workflow" (context menu): drain the queued asset names and drop
// the node grid CENTERED in the current viewport (there's no cursor drop point).
function insertPending() {
  const names = drag.takeInserts()
  if (!names.length) return
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const cols = Math.min(GRID_COLS, names.length)
  const rows = Math.ceil(names.length / GRID_COLS)
  const centerX = (rect.width / 2 - panX.value) / zoom.value
  const centerY = (rect.height / 2 - panY.value) / zoom.value
  const baseX = centerX - ((cols - 1) * COL_STEP) / 2 - NODE_W / 2
  const baseY = centerY - ((rows - 1) * ROW_STEP) / 2 - NODE_H / 2
  addNodes(names, baseX, baseY)
}

onMounted(() => {
  drag.registerCanvas(canvasRef.value, (names, cx, cy) => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return
    const baseX = (cx - rect.left - panX.value) / zoom.value - 24
    const baseY = (cy - rect.top - panY.value) / zoom.value - 16
    addNodes(names, baseX, baseY)
  })
  // Drain anything queued before this canvas mounted (navigated here to insert).
  insertPending()
  window.addEventListener('keydown', onKeyDown)
})
// Already-mounted canvas (e.g. inserting from the dock): react to new queue items.
watch(
  () => drag.pendingInserts.value.length,
  (n) => {
    if (n) insertPending()
  },
)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
  const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value * factor))
  // keep the point under the cursor stationary
  panX.value = mx - (mx - panX.value) * (nz / zoom.value)
  panY.value = my - (my - panY.value) * (nz / zoom.value)
  zoom.value = nz
}

function resetZoom() {
  zoom.value = 1
}
function fit() {
  zoom.value = 1
  panX.value = 60
  panY.value = 48
}

const gridStyle = computed(() => ({
  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: `${24 * zoom.value}px ${24 * zoom.value}px`,
  backgroundPosition: `${panX.value}px ${panY.value}px`,
}))
const layerStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
}))
const nodeStyle = (node: CanvasNode) => ({
  transform: `translate(${node.x}px, ${node.y}px)`,
})
</script>

<template>
  <div
    ref="canvasRef"
    class="relative min-h-0 min-w-0 flex-1 cursor-default overflow-hidden bg-canvas-background"
    @pointerdown="onCanvasPointerDown"
    @mousedown.middle.prevent
    @wheel="onWheel"
  >
    <!-- dot grid (pans + zooms with the canvas) -->
    <div class="pointer-events-none absolute inset-0" :style="gridStyle" />

    <!-- transformed node layer -->
    <div class="absolute left-0 top-0" :style="layerStyle">
      <div
        v-for="node in nodes"
        :key="node.id"
        data-node
        class="absolute left-0 top-0 cursor-grab active:cursor-grabbing"
        :style="nodeStyle(node)"
        @pointerdown="onNodePointerDown(node, $event)"
      >
        <SaveImageNode
          v-if="node.type === 'save'"
          :selected="selectedIds.has(node.id)"
          :show-toolbar="selectedIds.size === 1 && selectedIds.has(node.id)"
          :name="node.name || undefined"
          :zoom="zoom"
          @delete="deleteNode(node.id)"
        />
        <LoadImageNode
          v-else
          :selected="selectedIds.has(node.id)"
          :show-toolbar="selectedIds.size === 1 && selectedIds.has(node.id)"
          :name="node.name || undefined"
          :zoom="zoom"
          @delete="deleteNode(node.id)"
        />
      </div>

      <!-- Multi-select: dashed bounding box + shared group toolbar (Figma 1797-21186) -->
      <div
        v-if="selBox"
        class="pointer-events-none absolute rounded-xl border border-dashed border-base-foreground/50"
        :style="{
          left: `${selBox.left}px`,
          top: `${selBox.top}px`,
          width: `${selBox.width}px`,
          height: `${selBox.height}px`,
        }"
      >
        <!-- group toolbar, centered above the box -->
        <div
          class="pointer-events-auto absolute bottom-full left-1/2 mb-2 flex h-9 -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border-default bg-secondary-background px-1 shadow-[1px_1px_8px_rgba(0,0,0,0.4)]"
          @pointerdown.stop
        >
          <!-- node color swatch -->
          <button class="flex h-7 items-center gap-1 rounded-md px-1.5 text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
            <span class="size-3.5 rounded-full bg-[#cfcfcf]" />
            <ChevronDown class="size-3" :stroke-width="1.5" />
          </button>
          <button
            v-for="(Icon, i) in [Frame, Shrink]"
            :key="i"
            class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-button-hovered hover:text-base-foreground"
          >
            <component :is="Icon" class="size-4" :stroke-width="1.5" />
          </button>
          <span class="mx-0.5 h-5 w-px bg-border-default" />
          <button class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
            <CornerUpRight class="size-4" :stroke-width="1.5" />
          </button>
          <span class="mx-0.5 h-5 w-px bg-border-default" />
          <button
            class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-button-hovered hover:text-base-foreground"
            @click="deleteSelected"
          >
            <Trash2 class="size-4" :stroke-width="1.5" />
          </button>
          <button class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
            <EllipsisVertical class="size-4" :stroke-width="1.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Marquee rubber-band (screen space, over the canvas) -->
    <div
      v-if="marquee"
      class="pointer-events-none absolute z-10 rounded-sm border border-azure-600 bg-azure-600/10"
      :style="{
        left: `${marquee.left}px`,
        top: `${marquee.top}px`,
        width: `${marquee.width}px`,
        height: `${marquee.height}px`,
      }"
    />

    <!-- Top-left: Graph combo button. Unified with the run toolbar / controls /
         minimap pattern (user's call) — a base-background FRAME (border + shadow)
         holding secondary-background inner buttons — rather than the DS "Combo
         Button" inverted pill (2345-55668). Both buttons kept; static (hover only). -->
    <div
      class="absolute left-1 top-1 flex h-12 items-center gap-2 rounded-lg border border-border-default bg-base-background px-2 shadow-[1px_1px_8px_rgba(0,0,0,0.4)]"
      @pointerdown.stop
    >
      <button class="flex size-8 items-center justify-center rounded-lg bg-secondary-background text-base-foreground transition-colors hover:bg-button-hovered">
        <WorkflowIcon class="size-4" />
      </button>
      <button class="flex h-8 items-center gap-1 rounded-lg bg-secondary-background px-2.5 text-sm text-base-foreground transition-colors hover:bg-button-hovered">
        Graph
        <ChevronDown class="size-3 text-muted-foreground" :stroke-width="2" />
      </button>
    </div>

    <!-- Top-right: run toolbar -->
    <div class="absolute right-1 top-1" @pointerdown.stop>
      <RunToolbar />
    </div>

    <!-- Bottom-right: minimap + zoom controls. `w-fit` sizes the column to the
         (content-sized) CanvasControls toolbar; `items-stretch` then makes the
         w-full Minimap match that width. -->
    <div class="absolute bottom-1 right-1 flex w-fit flex-col items-stretch gap-1" @pointerdown.stop>
      <Minimap v-if="minimapOpen" @close="minimapOpen = false" />
      <CanvasControls
        :zoom-pct="zoomPct"
        :minimap-open="minimapOpen"
        @fit="fit"
        @reset="resetZoom"
        @toggle-map="minimapOpen = !minimapOpen"
      />
    </div>

    <!-- Bottom-center: marquee-select affordance — matches the lightbox zoom hint
         (plain text pill, no keybind box). Plain drag pans; this nudges users
         toward the modifier for box-select. -->
    <div
      class="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-secondary-background px-3 py-2 text-sm leading-none text-base-foreground shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
    >
      Hold Ctrl and drag to select
    </div>
  </div>
</template>
