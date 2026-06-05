<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import { Info, Play, Star, X, ZoomIn } from 'lucide-vue-next'
import IconTooltip from '@/components/ui/IconTooltip.vue'
import ThreeDViewer from './ThreeDViewer.vue'
import { placeholderBg } from './placeholder'
import { mockSize, mockDate, mockDuration, mockFps, mockPolyCount, mockSampleRate, mockWaveform } from './assetMeta'
import type { useGalleryFilters } from '@/composables/useGalleryFilters'

// macOS Finder "Quick Look" style mini preview. Opened with SPACE on a selection
// (double-click / Enter still open the full lightbox). Behaves like the details
// popover: a PERSISTENT, DRAGGABLE floating panel (no scrim / no click-outside
// close) that REFLECTS the selection — clicking another card live-updates it; it
// auto-closes only when the selection empties. A lighter peek than the lightbox:
// large preview + a horizontal "skim" metadata strip.
const props = defineProps<{ filters: ReturnType<typeof useGalleryFilters> }>()
const f = props.filters

const asset = computed(() => f.quickLookAsset.value)
const created = computed(() => (asset.value ? mockDate(asset.value.name) : null))

// Minimal preview by default; a header toggle reveals the metadata footer strip
// (format/dimensions/size/date/tags). Resets to hidden each time Quick Look opens
// (the panel unmounts on close). Reclamp on toggle so revealing it near the screen
// bottom keeps the panel on-screen.
const showFooter = ref(false)
watch(showFooter, () => nextTick(reclamp))

// Per-type preview (video poster + transport · audio waveform player · 3D orbit
// cube · else image).
const isVideo = computed(() => asset.value?.mediaType === 'video')
const isAudio = computed(() => asset.value?.mediaType === 'audio')
const isThree = computed(() => asset.value?.mediaType === '3d')
// Non-image previews don't zoom/pan.
const isStatic = computed(() => isVideo.value || isAudio.value || isThree.value)
const duration = computed(() => (asset.value ? mockDuration(asset.value.name) : ''))
const fps = computed(() => (asset.value ? mockFps(asset.value.name) : ''))
const sampleRate = computed(() => (asset.value ? mockSampleRate(asset.value.name) : ''))
const polyCount = computed(() => (asset.value ? mockPolyCount(asset.value.name) : ''))
const waveform = computed(() => (asset.value ? mockWaveform(asset.value.name, 96) : []))
// Square + portrait are bounded by height; landscape by width — so the gradient
// box keeps the asset's aspect and always fits the preview area.
const portrait = computed(() => (asset.value?.aspectRatio ?? 1) <= 1)

const list = computed(() => f.filteredAssets.value)
const index = computed(() => list.value.findIndex((a) => a.name === asset.value?.name))

function openLightbox() {
  if (!asset.value) return
  const name = asset.value.name
  f.closeQuickLook()
  f.openInspect(name)
}

/* ── Zoom + pan inside the preview ────────────────────────────────────────────
   Default = FIT (zoom 1 = the max zoom-OUT, exactly how it looks on Space).
   Wheel zooms in (never out past fit); you can only PAN once zoomed in (zoom>1),
   and dropping back to fit re-centres (pan reset). Stepping to another asset
   resets the view. */
const stageRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLElement | null>(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const MAX_ZOOM = 5
const zoomed = computed(() => zoom.value > 1.001)
const imgTransform = computed(() => `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`)

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}
// Keep the scaled image covering the frame — can't pan into empty space. At
// zoom 1 the range is 0, so pan is locked until you zoom in.
function clampPan() {
  const img = imgRef.value
  if (!img) return
  const maxX = (img.offsetWidth * (zoom.value - 1)) / 2
  const maxY = (img.offsetHeight * (zoom.value - 1)) / 2
  panX.value = Math.max(-maxX, Math.min(maxX, panX.value))
  panY.value = Math.max(-maxY, Math.min(maxY, panY.value))
}
function onPreviewWheel(e: WheelEvent) {
  if (isStatic.value) return // zoom/pan is image-only
  e.preventDefault()
  zoom.value = Math.min(MAX_ZOOM, Math.max(1, zoom.value * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
  if (!zoomed.value) resetView()
  else clampPan()
}
let panStartX = 0
let panStartY = 0
let panOrigX = 0
let panOrigY = 0
function onPreviewPointerDown(e: PointerEvent) {
  if (isStatic.value) return // zoom/pan is image-only (3D handles its own drag)
  if (e.button !== 0 || !zoomed.value) return
  e.preventDefault()
  panStartX = e.clientX
  panStartY = e.clientY
  panOrigX = panX.value
  panOrigY = panY.value
  window.addEventListener('pointermove', onPreviewPan)
  window.addEventListener('pointerup', onPreviewPanUp)
}
function onPreviewPan(e: PointerEvent) {
  panX.value = panOrigX + (e.clientX - panStartX)
  panY.value = panOrigY + (e.clientY - panStartY)
  clampPan()
}
function onPreviewPanUp() {
  window.removeEventListener('pointermove', onPreviewPan)
  window.removeEventListener('pointerup', onPreviewPanUp)
}
// Stepping the selection (or reopening) resets to fit.
watch(asset, resetView)

/* ── Position + drag (mirrors DockDetailsPopover) ─────────────────────────── */
const rootRef = ref<HTMLElement | null>(null)
const pos = ref({ left: 0, top: 0 })
const placed = ref(false) // hidden until centered (avoids a top-left flash)

function clampPos(left: number, top: number) {
  const w = rootRef.value?.offsetWidth ?? 640
  const h = rootRef.value?.offsetHeight ?? 400
  return {
    left: Math.max(8, Math.min(left, window.innerWidth - w - 8)),
    top: Math.max(8, Math.min(top, window.innerHeight - h - 8)),
  }
}
function center() {
  const el = rootRef.value
  if (!el) return
  pos.value = clampPos((window.innerWidth - el.offsetWidth) / 2, (window.innerHeight - el.offsetHeight) / 2)
  placed.value = true
}
function reclamp() {
  pos.value = clampPos(pos.value.left, pos.value.top)
}

let dragStartX = 0
let dragStartY = 0
let startLeft = 0
let startTop = 0
let dragMoved = false
function onHeaderPointerDown(e: PointerEvent) {
  if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return // not the buttons
  dragStartX = e.clientX
  dragStartY = e.clientY
  startLeft = pos.value.left
  startTop = pos.value.top
  dragMoved = false
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragUp)
}
function onDragMove(e: PointerEvent) {
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  if (!dragMoved && Math.hypot(dx, dy) < 4) return
  dragMoved = true
  pos.value = clampPos(startLeft + dx, startTop + dy)
}
function onDragUp() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
}

/* ── Resize (bottom-right grip) ────────────────────────────────────────────────
   The panel is square-driven (width controls the 1:1 preview), so resizing is one
   "overall size" handle: the right edge follows the cursor and the height follows.
   NOT persisted (the panel unmounts on close → reopens at default); double-clicking
   the grip resets to default. */
const MIN_W = 360
const DEFAULT_W = 640
// Largest width that still FITS the viewport — caps on both 92vw and the height
// budget (square preview + header/meta), so the panel never overflows either axis.
function maxW() {
  const vw = window.innerWidth || document.documentElement.clientWidth || 1280
  const vh = window.innerHeight || document.documentElement.clientHeight || 800
  return Math.max(MIN_W, Math.min(vw * 0.92, vh - 192))
}
const userWidth = ref<number | null>(null) // null → default size
const panelWidth = ref(DEFAULT_W)
function recomputeWidth() {
  const max = maxW()
  const base = userWidth.value ?? Math.min(DEFAULT_W, max)
  panelWidth.value = Math.round(Math.max(MIN_W, Math.min(max, base)))
}
function onResizePointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation() // don't start a header drag
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeUp)
}
function onResizeMove(e: PointerEvent) {
  const vw = window.innerWidth || document.documentElement.clientWidth || 1280
  const vh = window.innerHeight || document.documentElement.clientHeight || 800
  // Cap the width so the panel stays fully on-screen AT ITS CURRENT POSITION — don't
  // reclamp/move it (which made it "grow upward" once the bottom hit the edge). The
  // non-preview chrome (header + meta) = panel height − the square preview (≈ width).
  const chrome = (rootRef.value?.offsetHeight ?? 0) - panelWidth.value
  const fitRight = vw - 8 - pos.value.left
  const fitBottom = vh - 8 - pos.value.top - chrome
  const desired = e.clientX - pos.value.left // right edge tracks the cursor
  userWidth.value = Math.min(desired, fitRight, fitBottom)
  recomputeWidth()
}
function onResizeUp() {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeUp)
}
function resetSize() {
  userWidth.value = null
  recomputeWidth()
  nextTick(reclamp)
}
function onWindowResize() {
  recomputeWidth()
  nextTick(reclamp)
}

// Capture-phase so the grid's window keydown (Space/Enter/arrows) never double-fires.
function onKey(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    f.closeQuickLook()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    openLightbox()
  }
  // Arrows are intentionally NOT handled here — they fall through to the grid's
  // keydown (←/→ = ±1, ↑/↓ = ±a row), which moves the selection; Quick Look
  // reflects the selection so the preview follows.
}

onMounted(() => {
  recomputeWidth() // size before centering so center() uses the real width
  nextTick(center)
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', onWindowResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeUp)
  window.removeEventListener('pointermove', onPreviewPan)
  window.removeEventListener('pointerup', onPreviewPanUp)
})
</script>

<template>
  <Teleport to="body">
    <!-- Persistent, draggable floating panel — NO scrim / catcher, so clicks pass
         through to the grid (selecting another card live-updates the preview).
         Below the lightbox's z-[60]. -->
    <div
      v-if="asset"
      ref="rootRef"
      class="fixed z-[55] flex flex-col overflow-hidden rounded-xl border border-border-default bg-base-background shadow-[0px_8px_32px_rgba(0,0,0,0.5)]"
      :class="placed ? '' : 'invisible'"
      :style="{ left: `${pos.left}px`, top: `${pos.top}px`, width: `${panelWidth}px` }"
    >
      <!-- Header — drag handle (anywhere but the buttons). name · n/m · fav · Open · close -->
      <div
        class="flex shrink-0 cursor-move select-none items-center gap-2 border-b border-border-subtle px-4 py-3"
        @pointerdown="onHeaderPointerDown"
      >
        <span class="min-w-0 flex-1 truncate text-sm font-medium text-base-foreground">
          {{ asset.name }}
        </span>
        <span v-if="list.length > 1" class="shrink-0 text-xs tabular-nums text-muted-foreground">
          {{ index + 1 }} of {{ list.length }}
        </span>
        <!-- Details toggle: reveals/hides the metadata footer (hidden by default). -->
        <IconTooltip :label="showFooter ? 'Hide details' : 'Show details'" side="bottom">
          <button
            type="button"
            class="flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus:outline-none"
            :class="
              showFooter
                ? 'bg-secondary-background text-base-foreground'
                : 'text-muted-foreground hover:bg-secondary-background hover:text-base-foreground'
            "
            :aria-label="showFooter ? 'Hide details' : 'Show details'"
            :aria-pressed="showFooter"
            @click="showFooter = !showFooter"
          >
            <Info class="size-4" :stroke-width="1.5" />
          </button>
        </IconTooltip>
        <IconTooltip
          :label="asset.favorite ? 'Remove from favorites' : 'Add to favorites'"
          side="bottom"
        >
          <button
            type="button"
            class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground focus:outline-none"
            :aria-label="asset.favorite ? 'Remove from favorites' : 'Add to favorites'"
            @click="f.favoriteFromCard(asset.name)"
          >
            <Star
              class="size-4"
              :class="asset.favorite ? 'text-yellow-400' : ''"
              :fill="asset.favorite ? 'currentColor' : 'none'"
              :stroke-width="1.5"
            />
          </button>
        </IconTooltip>
        <IconTooltip label="Inspect" side="bottom">
          <button
            type="button"
            class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground focus:outline-none"
            aria-label="Inspect"
            @click="openLightbox"
          >
            <ZoomIn class="size-4" :stroke-width="1.5" />
          </button>
        </IconTooltip>
        <IconTooltip label="Close" side="bottom">
          <button
            type="button"
            class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground focus:outline-none"
            aria-label="Close preview"
            @click="f.closeQuickLook()"
          >
            <X class="size-4" :stroke-width="1.5" />
          </button>
        </IconTooltip>
      </div>

      <!-- Preview: a SQUARE (1:1) viewport sized off the panel width — so the panel
           keeps the same proportions on every screen (was h-[60vh], which scaled with
           screen height → portrait on tall monitors). The asset is contained within it.
           Wheel to zoom in (never below the fit default); drag to pan once zoomed. -->
      <div
        ref="stageRef"
        class="flex aspect-square w-full shrink-0 select-none items-center justify-center overflow-hidden bg-base-background p-6"
        :class="zoomed ? 'cursor-grab active:cursor-grabbing' : ''"
        @wheel="onPreviewWheel"
        @pointerdown="onPreviewPointerDown"
      >
        <!-- Image: zoom/pan gradient box -->
        <div
          v-if="!isStatic"
          ref="imgRef"
          class="overflow-hidden rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          :class="portrait ? 'h-full max-w-full' : 'max-h-full w-full'"
          :style="[
            placeholderBg(asset.name, true),
            { aspectRatio: String(asset.aspectRatio), transform: imgTransform },
          ]"
          aria-hidden="true"
        />

        <!-- Video: poster frame + centered play + a mock transport bar -->
        <div
          v-else-if="isVideo"
          class="relative max-h-full w-full overflow-hidden rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          :style="[placeholderBg(asset.name), { aspectRatio: String(asset.aspectRatio) }]"
          aria-hidden="true"
        >
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="flex size-16 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
              <Play class="size-7 translate-x-[2px]" fill="currentColor" :stroke-width="0" />
            </span>
          </div>
          <div class="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10 text-white">
            <Play class="size-4 shrink-0" fill="currentColor" :stroke-width="0" />
            <div class="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div class="h-full w-1/3 rounded-full bg-white" />
            </div>
            <span class="shrink-0 text-xs tabular-nums">0:00 / {{ duration }}</span>
          </div>
        </div>

        <!-- 3D: draggable orbit cube, filling the preview area -->
        <ThreeDViewer v-else-if="isThree" :name="asset.name" :size="240" class="h-full w-full" />

        <!-- Audio: waveform player card -->
        <div v-else class="flex w-full max-w-lg flex-col gap-6 rounded-xl bg-secondary-background p-7">
          <div class="flex h-32 items-center justify-center gap-[3px] overflow-hidden">
            <span
              v-for="(h, i) in waveform"
              :key="i"
              class="w-[3px] shrink-0 rounded-full"
              :class="i / waveform.length < 0.33 ? 'bg-base-foreground' : 'bg-muted-foreground/40'"
              :style="{ height: `${Math.round(h * 100)}%` }"
            />
          </div>
          <div class="flex items-center gap-3">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-base-foreground text-base-background">
              <Play class="size-5 translate-x-[1px]" fill="currentColor" :stroke-width="0" />
            </span>
            <span class="shrink-0 text-xs tabular-nums text-muted-foreground">0:00</span>
            <div class="h-1 flex-1 overflow-hidden rounded-full bg-tertiary-background">
              <div class="h-full w-1/3 rounded-full bg-base-foreground" />
            </div>
            <span class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ duration }}</span>
          </div>
        </div>
      </div>

      <!-- "Skim" metadata strip: label-less, values in the muted token. Type /
           dimensions / size grouped LEFT at fixed widths (so they don't shift
           when stepping assets); date | time aligned RIGHT. Tags on their own row.
           Hidden while exploring the minimal preview-only look (see showFooter). -->
      <div
        v-if="showFooter"
        class="flex shrink-0 flex-col gap-2 border-t border-border-subtle px-4 py-3 text-sm leading-normal text-muted-foreground"
      >
        <div class="flex items-center justify-between gap-4 tabular-nums">
          <div class="flex items-center gap-4">
            <span class="w-10">{{ asset.format }}</span>
            <span v-if="asset.dimensions" class="w-20">{{ asset.dimensions }}</span>
            <span v-if="isVideo || isAudio" class="w-12">{{ duration }}</span>
            <span v-if="isVideo" class="w-12">{{ fps }}</span>
            <span v-if="isAudio" class="w-16">{{ sampleRate }}</span>
            <span v-if="isThree" class="w-16">{{ polyCount }}</span>
            <span class="w-16">{{ mockSize(asset.name) }}</span>
          </div>
          <span class="shrink-0">{{ created?.date }} | {{ created?.time }}</span>
        </div>
        <div v-if="asset.tags.length" class="flex flex-wrap gap-1">
          <span
            v-for="t in asset.tags"
            :key="t"
            class="rounded-full bg-tertiary-background px-2 py-0.5 text-xs text-base-foreground"
          >
            {{ t }}
          </span>
        </div>
      </div>

      <!-- Resize grip (bottom-right). Drag = resize (right edge follows the cursor,
           square preview + height scale with it); double-click = reset to default.
           Not persisted — reopening Quick Look is always the default size. -->
      <div
        class="group absolute bottom-0 right-0 z-10 flex size-5 cursor-nwse-resize items-end justify-end p-1"
        title="Drag to resize · double-click to reset"
        @pointerdown="onResizePointerDown"
        @dblclick="resetSize"
      >
        <svg
          viewBox="0 0 10 10"
          class="size-2.5 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        >
          <path d="M9 3 L3 9 M9 7 L7 9" />
        </svg>
      </div>
    </div>
  </Teleport>
</template>
