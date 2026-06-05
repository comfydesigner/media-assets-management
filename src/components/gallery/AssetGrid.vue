<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AssetCard from './AssetCard.vue'
import ContextMenu from './ContextMenu.vue'
import SelectionToolbar from './SelectionToolbar.vue'
import type { Asset, GalleryLayout, SizeBreakpoint } from './types'
import { useAssetSelection } from '@/composables/useAssetSelection'
import { useAssetDrag } from '@/composables/useAssetDrag'
import { useTabs } from '@/composables/useTabs'
import type { useGalleryFilters } from '@/composables/useGalleryFilters'

const props = withDefaults(
  defineProps<{
    assets: Asset[]
    breakpoint: SizeBreakpoint
    /** Gallery state — forwarded to the ContextMenu so its tag submenu writes the
     *  real selection tags. */
    filters: ReturnType<typeof useGalleryFilters>
    /** Shared selection set (owned by useGalleryFilters); mutated in place. */
    selected: Set<string>
    /** cover asset name → additional output count, for the "+N" group badge. */
    groupCounts?: Record<string, number>
    /** 'grid' = uniform square grid; 'masonry-row' = row-first justified;
     *  'masonry-column' = column-balanced (Pinterest-style). */
    layout?: GalleryLayout
    /** Browse mode: cards drop their filename row and show info on hover overlay. */
    browse?: boolean
    /** Whether every selected asset is favorited (drives the toolbar star). */
    selectionFavorited?: boolean
    /** Details panel open → context menu's "Show details" becomes "Hide details". */
    detailsOpen?: boolean
  }>(),
  {
    layout: 'grid',
    browse: false,
    selectionFavorited: false,
    detailsOpen: false,
    groupCounts: () => ({}),
  },
)
const emit = defineEmits<{
  'toggle-favorite': [name: string]
  'favorite-selected': []
  'delete-selected': []
  'show-details': []
  'show-tag-popover': []
  'inspect-asset': [name?: string]
  'quick-look': []
  'open-group': [jobId?: string]
}>()

// Stable reference to the shared reactive Set — mutating it is reactive.
const selected = props.selected

// View options (name / details visibility) read straight off the shared filters
// instance. Placement is by mode (manage → below, browse → hover overlay); when
// BOTH are hidden in the square grid we equalise the row gap with the column gap
// (gap-y-1 == gap-x-1) for a clean, even image grid.
const showName = computed(() => props.filters.viewOptions.value.showName)
const showDetails = computed(() => props.filters.viewOptions.value.showDetails)
const infoHidden = computed(() => !showName.value && !showDetails.value)

// Selection + context-menu interactions (plain / Cmd / Shift click, marquee,
// right-click menu, "more" button, Space/Enter inspect) — shared with the
// workflow Media dock for exact parity.
const {
  containerRef,
  marquee,
  onCardClick,
  onPointerDown,
  menu,
  onCardContextMenu,
  onCardMore,
  closeMenu,
} = useAssetSelection(
  () => props.assets,
  selected,
  () => emit('inspect-asset'),
  false,
  () => emit('quick-look'),
  () => emit('show-details'), // "I" → toggle the details panel (same as the menu)
)

const drag = useAssetDrag()
const tabs = useTabs()
function onMenuAction(id: string, target?: string) {
  if (id === 'favorite') emit('favorite-selected')
  else if (id === 'delete') emit('delete-selected')
  else if (id === 'details') emit('show-details')
  else if (id === 'inspect') emit('inspect-asset')
  else if (id === 'insert') {
    // `target` is the chosen tab id — insert into any workflow-kind tab.
    const tab = tabs.tabs.value.find((t) => t.id === target)
    if (tab?.kind === 'workflow') {
      drag.requestInsert([...selected])
      tabs.navigate(tab.id)
    }
  } else if (id === 'open') {
    // One new (empty) tab per selected asset, named after it; land on the first.
    tabs.openAssetWorkflows([...selected])
  }
  // remaining actions stubbed — wire up later.
}

/**
 * Grid columns:
 *   - `auto-fill` fits as many columns as possible at MIN width
 *   - `minmax(min, 1fr)` lets tracks stretch to fill the row (no empty trailing
 *     space) — that's what makes the rightmost card align with the Import button
 *
 * The breakpoint's `max` is used as a soft cap: it controls when the slider
 * "jumps" to fewer columns by raising the min on the next step. The 1fr stretch
 * may push individual cards slightly past max on very wide viewports, which is
 * the right trade-off — the alternative (`minmax(min, max)`) leaves a visible
 * gap on the right edge.
 */
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${props.breakpoint.min}px, 1fr))`,
}))

/* ── Masonry (row-first / justified) layout ──────────────────────────────── */

// Inner content width (container minus its px-1), tracked for the row math.
const containerWidth = ref(0)
// Viewport X midpoint of the grid — the floating selection toolbar centers on
// this (not the viewport) so it lines up with the grid-centered TagPopover.
const toolbarCenterX = ref(0)
let ro: ResizeObserver | null = null
onMounted(() => {
  const el = containerRef.value
  if (!el) return
  const measure = () => {
    containerWidth.value = el.clientWidth - 8 // px-1 both sides
    const r = el.getBoundingClientRect()
    toolbarCenterX.value = r.left + r.width / 2
  }
  measure()
  // Re-measure after first paint: when the gallery mounts during a tab switch
  // the container can report 0 width on the mount tick, which would leave the
  // masonry (row/column) layouts empty until the next resize.
  requestAnimationFrame(measure)
  ro = new ResizeObserver(measure)
  ro.observe(el)
})
onBeforeUnmount(() => ro?.disconnect())

const COL_GAP = 4 // gap-x-1 between cards in a row
// Horizontal chrome inside each card cell that isn't the image. The masonry math
// must subtract exactly this so every card's image height resolves to the row
// height `h` (otherwise heights drift by 4/ratio per card → misaligned rows).
// Masonry only renders in Browse, whose cards use border-2 (2px × 2 = 4px); the
// 8px fallback matches Manage's p-1 should masonry ever be used there.
const CARD_PAD = computed(() => (props.browse ? 4 : 8))

// Clamp extreme aspect ratios so one panorama/very-tall asset can't make a whole
// row tiny or absurdly wide. Beyond this range the thumbnail is effectively
// letterboxed/cropped to the clamped shape (fine for placeholders).
const MIN_ASPECT = 0.6
const MAX_ASPECT = 2
const clampAspect = (r: number) => Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, r))

/**
 * Greedy justified rows: fill a row at the target height (breakpoint.min) until
 * it would exceed the container width, then scale that row to fit exactly so
 * every full row spans the width with each card at its natural aspect ratio.
 * The last (partial) row stays at the target height (left-aligned).
 */
const masonryRows = computed(() => {
  if (props.layout !== 'masonry-row') return []
  const target = props.breakpoint.min
  const cw = containerWidth.value
  const rows: { asset: Asset; index: number; w: number; aspect: number }[][] = []
  let row: { asset: Asset; index: number; ratio: number }[] = []
  let ratioSum = 0

  const flush = (stretch: boolean) => {
    const n = row.length
    if (!n) return
    const h =
      stretch && cw > 0 ? (cw - n * CARD_PAD.value - (n - 1) * COL_GAP) / ratioSum : target
    rows.push(
      row.map((c) => ({
        asset: c.asset,
        index: c.index,
        w: c.ratio * h + CARD_PAD.value,
        aspect: c.ratio, // clamped — keeps the card shape consistent with layout
      })),
    )
    row = []
    ratioSum = 0
  }

  props.assets.forEach((a, i) => {
    const ratio = clampAspect(a.aspectRatio || 1)
    row.push({ asset: a, index: i, ratio })
    ratioSum += ratio
    const n = row.length
    const outerWidth = ratioSum * target + n * CARD_PAD.value + (n - 1) * COL_GAP
    if (cw > 0 && outerWidth >= cw) flush(true)
  })
  flush(false)
  return rows
})

/**
 * Column-balanced (Pinterest-style) masonry: pick a column count from the
 * container width vs the target column width (breakpoint.min), then place each
 * asset into the currently-SHORTEST column (estimating its height from the
 * column width / aspect ratio). Columns are equal-width flex tracks; each card
 * fills its column and sizes its image to the aspect ratio. Preserves source
 * order well enough while keeping the column bottoms roughly even.
 */
const masonryColumns = computed(() => {
  if (props.layout !== 'masonry-column') return []
  const cw = containerWidth.value
  if (cw <= 0) return []
  const target = props.breakpoint.min
  const cols = Math.max(1, Math.round((cw + COL_GAP) / (target + COL_GAP)))
  const colWidth = (cw - (cols - 1) * COL_GAP) / cols
  const out: { asset: Asset; index: number; aspect: number }[][] = Array.from(
    { length: cols },
    () => [],
  )
  const heights = new Array(cols).fill(0)
  props.assets.forEach((a, i) => {
    const aspect = clampAspect(a.aspectRatio || 1)
    // shortest column wins (ties → leftmost, keeping order natural)
    let c = 0
    for (let k = 1; k < cols; k++) if (heights[k] < heights[c]) c = k
    out[c]!.push({ asset: a, index: i, aspect })
    heights[c] += colWidth / aspect + COL_GAP // image height + row gap
  })
  return out
})

// The gallery <section> forwards its pointerdown here so a marquee can also be
// started from the empty header area (not just over the grid).
defineExpose({ marqueePointerDown: onPointerDown })
</script>

<template>
  <!--
    px-1 (not px-2) on purpose: cards have their own 4px outer padding (p-1) for
    the hover hit-area, so giving the grid only 4px of side padding makes the
    cards' visible content line up with the header text and Import button above.
    Matches Figma frame 2075:40191 — Assets row at x=16, Card at x=4, content
    inset 4px == header text at x=16+8 = +24.
  -->
  <!-- pointerdown for the marquee is bound on the gallery <section> (so it also
       starts from the empty header), routed in via the exposed marqueePointerDown. -->
  <div ref="containerRef" class="relative h-full select-none overflow-auto">
    <!-- Square grid: gap-x-1 / gap-y-3 (4px col, 12px row) per Figma 2121:79705.
         When the info row is hidden the grid becomes a pure image wall, so we drop
         the gutters entirely (gap-0) — thin/zero gutters avoid the grid-illusion
         (faint flicker at gutter intersections) that medium gutters cause in light
         mode. Cards keep their own 4px padding, so thumbnails still don't touch. -->
    <div
      v-if="layout === 'grid'"
      class="grid px-1"
      :class="infoHidden ? 'gap-0' : 'gap-x-1 gap-y-3'"
      :style="gridStyle"
    >
      <AssetCard
        v-for="(a, i) in assets"
        :key="a.name"
        v-bind="a"
        :browse="browse"
        :show-name="showName"
        :show-details="showDetails"
        :group-count="groupCounts[a.name] ?? 0"
        :selected="selected.has(a.name)"
        @select="onCardClick(i, $event)"
        @contextmenu="onCardContextMenu(a.name, $event)"
        @toggle-favorite="emit('toggle-favorite', a.name)"
        @menu="onCardMore(a.name, $event)"
        @inspect="emit('inspect-asset', a.name)"
        @open-group="emit('open-group', a.jobId)"
      />
    </div>

    <!-- Masonry — Row (Browse): justified rows, each card at its own aspect
         ratio. Row gap matches the column gap (gap-1) for an even gallery grid. -->
    <div v-else-if="layout === 'masonry-row'" class="flex flex-col gap-y-1 px-1">
      <div v-for="(r, ri) in masonryRows" :key="ri" class="flex gap-x-1">
        <div
          v-for="cell in r"
          :key="cell.asset.name"
          class="shrink-0"
          :style="{ width: `${cell.w}px` }"
        >
          <AssetCard
            v-bind="cell.asset"
            :aspect="cell.aspect"
            :browse="browse"
            :show-name="showName"
            :show-details="showDetails"
            :group-count="groupCounts[cell.asset.name] ?? 0"
            :selected="selected.has(cell.asset.name)"
            @select="onCardClick(cell.index, $event)"
            @contextmenu="onCardContextMenu(cell.asset.name, $event)"
            @toggle-favorite="emit('toggle-favorite', cell.asset.name)"
            @menu="onCardMore(cell.asset.name, $event)"
            @inspect="emit('inspect-asset', cell.asset.name)"
            @open-group="emit('open-group', cell.asset.jobId)"
          />
        </div>
      </div>
    </div>

    <!-- Masonry — Column (Browse): equal-width columns, cards flow top-to-bottom
         into the shortest column (Pinterest-style). -->
    <div v-else class="flex items-start gap-x-1 px-1">
      <div
        v-for="(col, ci) in masonryColumns"
        :key="ci"
        class="flex min-w-0 flex-1 flex-col gap-y-1"
      >
        <AssetCard
          v-for="cell in col"
          :key="cell.asset.name"
          v-bind="cell.asset"
          :aspect="cell.aspect"
          :browse="browse"
          :show-name="showName"
          :show-details="showDetails"
          :group-count="groupCounts[cell.asset.name] ?? 0"
          :selected="selected.has(cell.asset.name)"
          @select="onCardClick(cell.index, $event)"
          @contextmenu="onCardContextMenu(cell.asset.name, $event)"
          @toggle-favorite="emit('toggle-favorite', cell.asset.name)"
          @menu="onCardMore(cell.asset.name, $event)"
          @inspect="emit('inspect-asset', cell.asset.name)"
          @open-group="emit('open-group', cell.asset.jobId)"
        />
      </div>
    </div>

  </div>

  <!-- Marquee rectangle — fixed/viewport-positioned (teleported) so it can span
       the header and the grid without the grid's overflow clipping it. -->
  <Teleport to="body">
    <div
      v-if="marquee"
      class="pointer-events-none fixed z-30 rounded-[2px] border border-azure-600 bg-azure-600/10"
      :style="{
        left: `${marquee.left}px`,
        top: `${marquee.top}px`,
        width: `${marquee.width}px`,
        height: `${marquee.height}px`,
      }"
    />
  </Teleport>

  <Transition name="toolbar">
    <SelectionToolbar
      v-if="selected.size > 0"
      :count="selected.size"
      :center-x="toolbarCenterX"
      :favorited="selectionFavorited"
      @clear="selected.clear()"
      @favorite="emit('favorite-selected')"
      @delete="emit('delete-selected')"
      @tag="emit('show-tag-popover')"
    />
  </Transition>

  <Teleport to="body">
    <ContextMenu
      v-if="menu"
      :x="menu.x"
      :y="menu.y"
      :multiple="menu.multiple"
      :filters="filters"
      :details-open="detailsOpen"
      @close="closeMenu"
      @action="onMenuAction"
    />
  </Teleport>
</template>

<style scoped>
.toolbar-enter-active,
.toolbar-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.toolbar-enter-from,
.toolbar-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
</style>
