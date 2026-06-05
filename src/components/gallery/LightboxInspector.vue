<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'reka-ui'
import {
  ArrowLeft,
  AudioLines,
  Box,
  ChevronLeft,
  ChevronRight,
  Minus,
  PanelRight,
  Play,
  Plus,
  Sparkles,
} from 'lucide-vue-next'
import AssetDetailsPanel from './AssetDetailsPanel.vue'
import ThreeDViewer from './ThreeDViewer.vue'
import TooltipProvider from '@/components/ui/TooltipProvider.vue'
import IconTooltip from '@/components/ui/IconTooltip.vue'
import { placeholderBg } from './placeholder'
import { mockDuration, mockWaveform } from './assetMeta'
import type { useGalleryFilters } from '@/composables/useGalleryFilters'

const props = defineProps<{ filters: ReturnType<typeof useGalleryFilters> }>()
const f = props.filters

const asset = computed(() => f.inspectAsset.value)
const list = computed(() => f.filteredAssets.value)
const panelVisible = ref(true)

// Per-type stage: video player / audio waveform player / 3D orbit cube (full-bleed,
// it fills the stage like the image) / else the zoomable image.
const isVideo = computed(() => asset.value?.mediaType === 'video')
const isAudio = computed(() => asset.value?.mediaType === 'audio')
const isThree = computed(() => asset.value?.mediaType === '3d')
// Non-image stages don't zoom (3D handles its own drag-orbit).
const isStatic = computed(() => isVideo.value || isAudio.value || isThree.value)
const duration = computed(() => (asset.value ? mockDuration(asset.value.name) : ''))
const waveform = computed(() => (asset.value ? mockWaveform(asset.value.name, 140) : []))

// "N of M" position in the current filtered view (matches the Quick Look counter).
const position = computed(() => {
  const i = list.value.findIndex((a) => a.name === asset.value?.name)
  return i >= 0 ? { index: i + 1, total: list.value.length } : null
})

/* ── Placeholder thumbnail (shared with the cards; see ./placeholder) ──────── */

/* ── Zoom (scroll-based pan + drag-to-pan) ────────────────────────────────── */
const BREAKPOINTS = [50, 100, 150, 200, 250, 300]
const MIN = 50 // slider/wheel/buttons range
const MAX = 300
const ABS_MIN = 10 // typed-input range (decoupled from the slider)
const ABS_MAX = 1000
const zoomPct = ref(100) // 100 = fit-to-viewport
const zoom = computed(() => zoomPct.value / 100)

const stageRef = ref<HTMLElement | null>(null)
const stage = ref({ w: 0, h: 0 })
let ro: ResizeObserver | null = null

// Fitted (contain) base size at 100%, leaving a small margin.
const fit = computed(() => {
  const { w, h } = stage.value
  const r = asset.value?.aspectRatio || 1
  if (!w || !h) return { w: 0, h: 0 }
  const availW = w * 0.92
  const availH = h * 0.92
  const fh = Math.min(availH, availW / r)
  return { w: fh * r, h: fh }
})
const imgStyle = computed(() => ({
  width: `${Math.round(fit.value.w * zoom.value)}px`,
  height: `${Math.round(fit.value.h * zoom.value)}px`,
  ...placeholderBg(asset.value?.name ?? '', true), // grid ON → reveals zoom level
}))
const scrollable = computed(() => zoom.value > 1)

// 3D cube sized to the stage (full-bleed viewer): a generous fraction of the
// smaller stage edge, so the model fills the allotted media area like the image.
const cubeSize = computed(() => {
  const { w, h } = stage.value
  return Math.max(200, Math.round(Math.min(w || 600, h || 600) * 0.42))
})

// Zoom while keeping the viewport center stable (so scroll-based pan feels right).
// Slider/buttons/wheel stay within the breakpoint range; typed input (`wide`)
// may go beyond — the slider handle then just pins to min/max.
function applyZoom(pct: number, wide = false) {
  const lo = wide ? ABS_MIN : MIN
  const hi = wide ? ABS_MAX : MAX
  const el = stageRef.value
  const old = zoom.value
  zoomPct.value = Math.round(Math.min(hi, Math.max(lo, pct)))
  if (!el) return
  const ratio = zoom.value / old
  nextTick(() => {
    el.scrollLeft = (el.scrollLeft + el.clientWidth / 2) * ratio - el.clientWidth / 2
    el.scrollTop = (el.scrollTop + el.clientHeight / 2) * ratio - el.clientHeight / 2
  })
}
function stepZoom(dir: 1 | -1) {
  applyZoom(
    dir > 0
      ? BREAKPOINTS.find((b) => b > zoomPct.value) ?? MAX
      : [...BREAKPOINTS].reverse().find((b) => b < zoomPct.value) ?? MIN,
  )
}
// Brief hint nudging scroll-wheel users to hold Ctrl to zoom.
const zoomHint = ref(false)
let zoomHintTimer: ReturnType<typeof setTimeout> | null = null
function flashZoomHint() {
  zoomHint.value = true
  if (zoomHintTimer) clearTimeout(zoomHintTimer)
  zoomHintTimer = setTimeout(() => (zoomHint.value = false), 2400)
}

function onWheel(e: WheelEvent) {
  if (isStatic.value) return // no zoom for video / audio / 3D
  // Only zoom on a pinch gesture (Mac trackpads synthesize ctrlKey) or ⌘/Ctrl+
  // wheel. Plain two-finger scroll is left untouched so the overflow-auto stage
  // pans natively on both axes (otherwise vertical scroll hijacks into zoom and
  // horizontal pan is swallowed by preventDefault).
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    applyZoom(zoomPct.value * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
    return
  }
  // Plain scroll pans natively while zoomed. When the image already fits there's
  // nothing to pan, so a scroll here is almost certainly a zoom attempt — nudge
  // the user to hold Ctrl (pinch-to-zoom on trackpads already works).
  if (!scrollable.value) flashZoomHint()
}

// Editable % (single click), double-click slider resets to 100% (Lightroom-style).
const editingZoom = ref(false)
const zoomDraft = ref('')
const zoomInput = ref<HTMLInputElement | null>(null)
function startZoomEdit() {
  zoomDraft.value = String(zoomPct.value)
  editingZoom.value = true
  nextTick(() => zoomInput.value?.select())
}
function commitZoomEdit() {
  const v = parseInt(zoomDraft.value, 10)
  if (!Number.isNaN(v)) applyZoom(v, true)
  editingZoom.value = false
}

// Drag-to-pan (in addition to scrollbars / trackpad scroll).
let dragging = false
let lastX = 0
let lastY = 0
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 || !scrollable.value) return
  dragging = true
  lastX = e.clientX
  lastY = e.clientY
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}
function onPointerMove(e: PointerEvent) {
  const el = stageRef.value
  if (!el) return
  el.scrollLeft -= e.clientX - lastX
  el.scrollTop -= e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
}
function onPointerUp() {
  dragging = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

// Persist the zoom level across image changes (makes A/B comparison easier);
// just recenter the new image in the stage + recenter the carousel.
watch(
  () => asset.value?.name,
  () => {
    nextTick(() => {
      const el = stageRef.value
      if (el) {
        el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
        el.scrollTop = (el.scrollHeight - el.clientHeight) / 2
      }
      scrollCurrentIntoView()
    })
  },
)

/* ── Carousel ─────────────────────────────────────────────────────────────── */
const stripRef = ref<HTMLElement | null>(null)
function scrollCurrentIntoView() {
  stripRef.value
    ?.querySelector('[data-current="true"]')
    ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
}

/* ── Keyboard ─────────────────────────────────────────────────────────────── */
function onKey(e: KeyboardEvent) {
  if (editingZoom.value) return
  if (e.key === 'Escape') f.closeInspect()
  else if (e.key === 'ArrowLeft') f.inspectStep(-1)
  else if (e.key === 'ArrowRight') f.inspectStep(1)
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  const el = stageRef.value
  if (el) {
    const measure = () => (stage.value = { w: el.clientWidth, h: el.clientHeight })
    measure()
    ro = new ResizeObserver(measure)
    ro.observe(el)
  }
  nextTick(scrollCurrentIntoView)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  ro?.disconnect()
})

// The slider only spans [MIN, MAX]; if the typed zoom goes beyond that, the
// handle just pins to the nearest end.
const sliderValue = computed({
  get: () => [Math.min(MAX, Math.max(MIN, zoomPct.value))],
  set: (v) => applyZoom(v[0]!),
})
</script>

<template>
  <Teleport to="body">
    <!-- 200ms tooltip open delay shared across the lightbox (incl. the nested
         details panel's action buttons). -->
    <TooltipProvider :delay-duration="200">
    <!-- Row: left canvas + full-height details panel. Fully theme-aware: the
         backdrop + controls + panel all follow the app theme (light viewer in
         light mode, dark in dark). -->
    <div class="fixed inset-0 z-[60] flex bg-lightbox-backdrop text-base-foreground">
      <!-- Left canvas (image viewer) -->
      <div class="relative flex min-w-0 flex-1 flex-col">
        <!-- Image stage area: nav buttons flank the clipped image frame.
             pt-16 keeps the frame clear of the top controls so a zoomed/panned
             image is clipped to this region and never slides under any button
             (Figma 1851:26464 — "bounds of the media when zooming or panning in"). -->
        <div class="flex min-h-0 flex-1 items-stretch gap-2 px-4 pb-2 pt-16">
          <IconTooltip label="Previous">
            <button
              type="button"
              class="flex size-10 shrink-0 items-center justify-center self-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
              aria-label="Previous asset"
              @click="f.inspectStep(-1)"
            >
              <ChevronLeft class="size-5" :stroke-width="1.5" />
            </button>
          </IconTooltip>

          <!-- Clipped image frame (rounded-lg, overflow clips the zoomed image) -->
          <div
            ref="stageRef"
            class="relative flex min-w-px flex-1 overflow-auto rounded-lg"
            :class="scrollable ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''"
            @wheel="onWheel"
            @pointerdown="onPointerDown"
          >
            <!-- 3D: full-bleed orbit cube — fills the whole stage (drag anywhere). -->
            <ThreeDViewer v-if="isThree" :name="asset!.name" :size="cubeSize" class="absolute inset-0" />

            <div v-else class="flex min-h-full min-w-full items-center justify-center p-8">
              <!-- Image: zoomable gradient box -->
              <div
                v-if="!isStatic"
                class="shrink-0 rounded-md shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
                :style="imgStyle"
              />

              <!-- Video: large poster + centered play + transport bar -->
              <div
                v-else-if="isVideo"
                class="relative w-full max-w-5xl shrink-0 overflow-hidden rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
                :style="[placeholderBg(asset!.name), { aspectRatio: String(asset!.aspectRatio) }]"
                aria-hidden="true"
              >
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="flex size-20 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                    <Play class="size-9 translate-x-[3px]" fill="currentColor" :stroke-width="0" />
                  </span>
                </div>
                <div class="absolute inset-x-0 bottom-0 flex items-center gap-4 bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-12 text-white">
                  <Play class="size-5 shrink-0" fill="currentColor" :stroke-width="0" />
                  <span class="shrink-0 text-sm tabular-nums">0:00</span>
                  <div class="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                    <div class="h-full w-1/3 rounded-full bg-white" />
                  </div>
                  <span class="shrink-0 text-sm tabular-nums">{{ duration }}</span>
                </div>
              </div>

              <!-- Audio: large waveform player card -->
              <div
                v-else
                class="flex w-full max-w-2xl shrink-0 flex-col gap-8 rounded-2xl bg-secondary-background p-10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
              >
                <div class="flex h-44 items-center justify-center gap-[3px] overflow-hidden">
                  <span
                    v-for="(h, i) in waveform"
                    :key="i"
                    class="w-[3px] shrink-0 rounded-full"
                    :class="i / waveform.length < 0.33 ? 'bg-base-foreground' : 'bg-muted-foreground/40'"
                    :style="{ height: `${Math.round(h * 100)}%` }"
                  />
                </div>
                <div class="flex items-center gap-4">
                  <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-base-foreground text-base-background">
                    <Play class="size-6 translate-x-[1px]" fill="currentColor" :stroke-width="0" />
                  </span>
                  <span class="shrink-0 text-sm tabular-nums text-muted-foreground">0:00</span>
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-tertiary-background">
                    <div class="h-full w-1/3 rounded-full bg-base-foreground" />
                  </div>
                  <span class="shrink-0 text-sm tabular-nums text-muted-foreground">{{ duration }}</span>
                </div>
              </div>
            </div>
          </div>

          <IconTooltip label="Next">
            <button
              type="button"
              class="flex size-10 shrink-0 items-center justify-center self-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
              aria-label="Next asset"
              @click="f.inspectStep(1)"
            >
              <ChevronRight class="size-5" :stroke-width="1.5" />
            </button>
          </IconTooltip>
        </div>

        <!-- Carousel — py-2/px-1 so the selected thumb's ring-offset isn't clipped
             by the strip's (auto) overflow. Thumbs preview the asset: gradient for
             image/video/3D, a glyph for audio (no room for a waveform here). -->
        <div class="flex shrink-0 justify-center px-4 pb-3 pt-1">
          <div
            ref="stripRef"
            class="flex max-w-full items-center gap-2 overflow-x-auto px-1 py-2"
          >
            <button
              v-for="a in list"
              :key="a.name"
              type="button"
              :data-current="a.name === asset?.name"
              class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md transition"
              :class="[
                a.name === asset?.name
                  ? 'ring-2 ring-base-foreground ring-offset-2 ring-offset-lightbox-backdrop'
                  : 'opacity-70 hover:opacity-100',
                a.mediaType === 'audio' ? 'bg-secondary-background' : '',
              ]"
              :style="a.mediaType === 'audio' ? undefined : placeholderBg(a.name)"
              :aria-label="a.name"
              @click="f.inspectSelect(a.name)"
            >
              <AudioLines
                v-if="a.mediaType === 'audio'"
                class="size-5 text-muted-foreground"
                :stroke-width="1.5"
              />
              <Box
                v-else-if="a.mediaType === '3d'"
                class="size-5 text-white/70 drop-shadow"
                :stroke-width="1.5"
              />
              <Play
                v-else-if="a.mediaType === 'video'"
                class="size-4 text-white/90 drop-shadow"
                fill="currentColor"
                :stroke-width="0"
              />
            </button>
          </div>
        </div>

        <!-- Scroll-to-zoom hint (mouse-wheel users): the image already fits, so a
             plain scroll did nothing — nudge them to hold Ctrl. -->
        <Transition
          enter-active-class="transition-opacity duration-150 ease-out"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-300 ease-in"
          leave-to-class="opacity-0"
        >
          <div
            v-if="zoomHint"
            class="pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-secondary-background px-3 py-2 text-sm leading-none text-base-foreground shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
          >
            Hold Ctrl while scrolling to zoom
          </div>
        </Transition>

        <!-- Back / exit + filename (top-left) -->
        <div class="absolute left-4 top-4 z-10 flex items-center gap-4">
          <IconTooltip label="Exit" side="bottom">
            <button
              type="button"
              class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-background text-muted-foreground transition-colors hover:bg-button-hovered hover:text-base-foreground"
              aria-label="Exit"
              @click="f.closeInspect"
            >
              <ArrowLeft class="size-4" :stroke-width="1.5" />
            </button>
          </IconTooltip>
          <span class="max-w-[40vw] truncate text-sm text-base-foreground">{{ asset?.name }}</span>
        </div>

        <!-- Top-right cluster: "N of M" position + zoom pill (one unit) + show-panel (when hidden).
             Fixed h-10 so the position label keeps the same vertical center whether or
             not the zoom pill (image-only) is present — it lines up with the panel header. -->
        <div class="absolute right-4 top-4 z-10 flex h-10 items-center gap-2">
          <!-- Position in the current view, to the left of the zoom controls. -->
          <span
            v-if="position && position.total > 1"
            class="px-1 text-sm tabular-nums text-muted-foreground"
          >
            {{ position.index }} of {{ position.total }}
          </span>
          <!-- Zoom control: −/slider/+/% grouped into one pill (Figma 2301:52013).
               The pill fill only appears on hover (its own :hover bubbles up from
               any child) so the control stays low-emphasis at rest — keeps the
               filled back/exit + "Open app" buttons visually primary. Image-only:
               video/audio have nothing to zoom, so the whole pill is hidden. -->
          <div
            v-if="!isStatic"
            class="flex h-10 items-center gap-0.5 rounded-lg px-1 transition-colors hover:bg-secondary-background"
          >
            <IconTooltip label="Zoom out" side="bottom">
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-button-hovered hover:text-base-foreground"
                aria-label="Zoom out"
                @click="stepZoom(-1)"
              >
                <Minus class="size-4" :stroke-width="1.5" />
              </button>
            </IconTooltip>
            <!-- double-click resets to 100% (Lightroom-style). Hover gives the
                 same #3c3d42 fill as the −/+/% controls (Figma 2316-52504). -->
            <div
              class="group flex h-8 w-24 items-center rounded-md px-2 transition-colors hover:bg-button-hovered"
              @dblclick="applyZoom(100)"
            >
              <SliderRoot
                v-model="sliderValue"
                :min="MIN"
                :max="MAX"
                :step="1"
                class="relative flex h-full w-full touch-none select-none items-center"
                aria-label="Zoom level"
              >
                <SliderTrack class="relative h-0.5 w-full grow rounded-lg bg-node-border">
                  <SliderRange class="absolute h-full rounded-lg bg-base-foreground" />
                </SliderTrack>
                <SliderThumb
                  class="block size-3.5 rounded-full bg-base-foreground shadow-[0_1px_2px_rgba(0,0,0,0.4)] outline-none transition-transform group-hover:scale-110 focus-visible:ring-2 focus-visible:ring-base-foreground/40 active:scale-110"
                />
              </SliderRoot>
            </div>
            <IconTooltip label="Zoom in" side="bottom">
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-button-hovered hover:text-base-foreground"
                aria-label="Zoom in"
                @click="stepZoom(1)"
              >
                <Plus class="size-4" :stroke-width="1.5" />
              </button>
            </IconTooltip>
            <!-- editable % -->
            <input
              v-if="editingZoom"
              ref="zoomInput"
              v-model="zoomDraft"
              type="text"
              inputmode="numeric"
              class="h-8 w-[3.75rem] rounded-md bg-button-hovered px-2 text-center text-sm tabular-nums text-base-foreground focus:outline-none"
              @keydown.enter="commitZoomEdit"
              @keydown.escape="editingZoom = false"
              @blur="commitZoomEdit"
            />
            <IconTooltip v-else label="Set zoom level" side="bottom">
              <button
                type="button"
                class="h-8 min-w-[3.75rem] cursor-text rounded-md px-2 text-center text-sm tabular-nums text-muted-foreground transition-colors hover:bg-button-hovered hover:text-base-foreground"
                @click="startZoomEdit"
              >
                {{ zoomPct }}%
              </button>
            </IconTooltip>
          </div>

          <!-- When the panel is closed, the re-generate + panel-toggle buttons move
               here from the panel header. The app-mode button gains a text label;
               the panel-toggle is ghost (no fill) — Figma 1857-39508. -->
          <template v-if="!panelVisible">
            <button
              type="button"
              class="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-secondary-background px-3 text-sm leading-normal text-base-foreground transition-colors hover:bg-button-hovered"
            >
              <Sparkles class="size-4" :stroke-width="1.5" />
              Re-generate
            </button>
            <IconTooltip label="Show panel" side="bottom">
              <button
                type="button"
                class="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
                aria-label="Show details panel"
                @click="panelVisible = true"
              >
                <PanelRight class="size-4" :stroke-width="1.5" />
              </button>
            </IconTooltip>
          </template>
        </div>
      </div>

      <!-- Details panel (full height) -->
      <AssetDetailsPanel
        v-if="panelVisible"
        :filters="f"
        lightbox
        @toggle-panel="panelVisible = false"
      />
    </div>
    </TooltipProvider>
  </Teleport>
</template>
