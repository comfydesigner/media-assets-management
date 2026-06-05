<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, ExternalLink } from 'lucide-vue-next'
import AssetCard from '@/components/gallery/AssetCard.vue'
import AssetListRow from '@/components/gallery/AssetListRow.vue'
import ContextMenu from '@/components/gallery/ContextMenu.vue'
import ViewsMenu from '@/components/gallery/ViewsMenu.vue'
import DockSearch from '@/components/gallery/DockSearch.vue'
import DockFilterMenu from '@/components/gallery/DockFilterMenu.vue'
import FilterChips from '@/components/gallery/FilterChips.vue'
import DockEmptyState from '@/components/gallery/DockEmptyState.vue'
import DockDetailsPopover from '@/components/gallery/DockDetailsPopover.vue'
import LightboxInspector from '@/components/gallery/LightboxInspector.vue'
import QuickLook from '@/components/gallery/QuickLook.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import IconTooltip from '@/components/ui/IconTooltip.vue'
import SelectionToolbar from '@/components/gallery/SelectionToolbar.vue'
import { useGalleryFilters } from '@/composables/useGalleryFilters'
import { useAssetSelection } from '@/composables/useAssetSelection'
import { useAssetDrag } from '@/composables/useAssetDrag'
import { useTabs } from '@/composables/useTabs'
import { DOCK_SIZE_BREAKPOINTS, type Category, type DockLayout } from '@/components/gallery/types'

defineEmits<{ openMedia: [] }>()

// Shared gallery state (singleton) — the dock and the Media Assets tab show the
// same assets/filters/drill, so switching/opening the tab preserves the view.
const f = useGalleryFilters()

const TABS: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'generated', label: 'Generated' },
  { id: 'imported', label: 'Uploaded' },
]

// Filter menu (opened by its own button OR the search's Tab shortcut).
const filterMenu = ref<InstanceType<typeof DockFilterMenu> | null>(null)

// Dock root (the details popover anchors to its right edge) + the vertical level
// of the asset that triggered "Show details".
const rootRef = ref<HTMLElement | null>(null)
const detailsAnchorY = ref(0)

// Dock view mode (List / Grid: Small / Grid: Large), set from the Views menu.
const dockLayout = ref<DockLayout>('grid-small')
// Grid columns from the size's min-width breakpoint (responsive auto-fill, same
// model as the gallery), so Small packs more/smaller tiles than Large.
const gridStyle = computed(() => {
  if (dockLayout.value === 'list') return {}
  const bp = DOCK_SIZE_BREAKPOINTS[dockLayout.value]
  return { gridTemplateColumns: `repeat(auto-fill, minmax(${bp.min}px, 1fr))` }
})

// Name/details visibility (shared with the gallery). Affects the dock's GRID
// cards; the list view is inherently a name+meta row. Both hidden → equal gaps.
const showName = computed(() => f.viewOptions.value.showName)
const showDetails = computed(() => f.viewOptions.value.showDetails)
const infoHidden = computed(() => !showName.value && !showDetails.value)

// Committed dock search query (filters the grid by asset name).
const searchQuery = ref('')
const visibleAssets = computed(() => {
  // Drilled into a job → show its outputs as-is (no search filter; the search row
  // is hidden in that state). Otherwise the grouped/flat list + the dock search.
  if (f.drilledJobId.value) return f.displayAssets.value
  const q = searchQuery.value.trim().toLowerCase()
  const base = f.displayAssets.value
  return q ? base.filter((a) => a.name.toLowerCase().includes(q)) : base
})

// Collapse the title + tabs rows when scrolling the grid DOWN; reveal them the
// moment the user scrolls back UP (Figma 1797-26563). The search row stays
// pinned. The grid itself is the scroll container.
const headerCollapsed = ref(false)
let lastScrollTop = 0
function onGridScroll(e: Event) {
  const top = (e.target as HTMLElement).scrollTop
  if (top <= 4) headerCollapsed.value = false
  else if (top > lastScrollTop + 2) headerCollapsed.value = true
  else if (top < lastScrollTop - 2) headerCollapsed.value = false
  lastScrollTop = top
}

/* ── Resizable width (drag the right edge) ────────────────────────────────────
   The current width is the MIN; the MAX is opinionatedly half the viewport (a
   full-width dock would swamp the canvas). The grid reflows via its responsive
   `auto-fill minmax` columns (DOCK_SIZE_BREAKPOINTS), which is why those needed a
   range and not a fixed size. */
const MIN_DOCK_W = 320
const dockWidth = ref(MIN_DOCK_W)
// Selection toolbar: below this dock width it renders the compact in-flow pill
// (icon-only, fills the panel); at/above it swaps to the gallery's full labeled
// pill, which is `w-fit` (its own max width) and stays centered on the dock.
// Threshold leaves a margin around the ~470px-wide full pill so it never spills
// past the dock edges (the dock's bottom == viewport bottom, so `fixed bottom-6`
// lands at the dock floor).
const DOCK_TOOLBAR_FULL_W = 520
const toolbarFull = computed(() => dockWidth.value >= DOCK_TOOLBAR_FULL_W)
// Dock left edge is fixed (it sits right after the 56px rail); measured once on
// mount + on viewport resize so the full pill can be centered on the dock.
const dockLeft = ref(0)
function measureDockLeft() {
  const r = rootRef.value?.getBoundingClientRect()
  if (r) dockLeft.value = r.left
}
const dockCenterX = computed(() => dockLeft.value + dockWidth.value / 2)
// Real browsers always report a valid innerWidth; the fallbacks just guard a
// transient 0 (e.g. during init) so the dock isn't accidentally pinned to its min.
const maxDockW = () =>
  Math.max(MIN_DOCK_W, Math.round((window.innerWidth || document.documentElement.clientWidth || 1920) / 2))
let resizeStartX = 0
let resizeStartW = 0
function onResizeMove(e: PointerEvent) {
  dockWidth.value = Math.max(MIN_DOCK_W, Math.min(maxDockW(), resizeStartW + (e.clientX - resizeStartX)))
}
function onResizeUp() {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeUp)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}
function onResizeStart(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  resizeStartX = e.clientX
  resizeStartW = dockWidth.value
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeUp)
}
// If the viewport shrinks below 2× the current dock width, pull the dock in.
function reclampDock() {
  dockWidth.value = Math.min(dockWidth.value, maxDockW())
  measureDockLeft()
}
onMounted(() => {
  measureDockLeft()
  window.addEventListener('resize', reclampDock)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', reclampDock)
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeUp)
})

const sel = f.selectedAssets
// Exact parity with the main gallery: plain/Cmd/Shift click + marquee + the same
// right-click context menu.
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
  () => visibleAssets.value,
  sel,
  () => f.openInspect(),
  true,
  () => f.openQuickLook(),
  () => onMenuAction('details'), // "I" → toggle the details popover (same as the menu)
)

// Delete confirmation (AlertDialog) — toolbar/context-menu delete routes here.
const confirmDeleteOpen = ref(false)
const deleteCount = computed(() => sel.size)
function requestDelete() {
  if (deleteCount.value > 0) confirmDeleteOpen.value = true
}
function doDelete() {
  f.deleteSelected()
  confirmDeleteOpen.value = false
}

const drag = useAssetDrag()
const tabs = useTabs()
function onMenuAction(id: string, target?: string) {
  if (id === 'favorite') f.favoriteSelected()
  else if (id === 'delete') requestDelete()
  else if (id === 'inspect') f.openInspect()
  else if (id === 'details') {
    // Toggle: "Show details" opens it (anchored to the card's IMAGE top), "Hide
    // details" closes it.
    if (f.detailsOpen.value) {
      f.closeDetails()
    } else {
      let y = menu.value?.y ?? 0
      const name = f.detailAsset.value?.name
      if (name && containerRef.value) {
        const idx = visibleAssets.value.findIndex((a) => a.name === name)
        const card = containerRef.value.querySelectorAll('button[aria-pressed]')[idx]
        const thumb = card?.querySelector('[data-thumb]') ?? card
        if (thumb) y = thumb.getBoundingClientRect().top
      }
      detailsAnchorY.value = y
      f.openDetails()
    }
  }
  else if (id === 'insert') {
    // `target` is the chosen tab id — insert into any workflow-kind tab.
    const tab = tabs.tabs.value.find((t) => t.id === target)
    if (tab?.kind === 'workflow') {
      drag.requestInsert([...sel])
      tabs.navigate(tab.id)
    }
  } else if (id === 'open') {
    tabs.openAssetWorkflows([...sel])
  }
  // remaining actions stubbed — same as the tab.
}
</script>

<template>
  <div
    ref="rootRef"
    class="relative flex shrink-0 flex-col border-r border-border-default bg-base-background"
    :style="{ width: `${dockWidth}px` }"
  >
    <!-- Resize handle: drag the right edge to widen the dock (min = default,
         max = half the viewport). A thin hit-strip straddling the border that
         shows an azure line on hover/drag. -->
    <div
      class="group absolute -right-1 top-0 z-30 h-full w-2 cursor-col-resize"
      @pointerdown="onResizeStart"
    >
      <div class="absolute right-1 top-0 h-full w-px bg-transparent transition-colors group-hover:bg-azure-600" />
    </div>

    <!-- NORMAL header (title + Open · tabs · search · chips). Swapped for a single
         "← Back to all assets" bar while drilled into a job (Figma 1257-1388). -->
    <template v-if="!f.drilledJobId.value">
    <!-- Title + Tabs: collapse on scroll-down, reappear on scroll-up
         (Figma 1797-26563). grid-rows 1fr↔0fr animates the height; the inner
         wrapper is overflow-hidden so the rows clip cleanly while collapsing. -->
    <div
      class="grid transition-[grid-template-rows] duration-200 ease-out"
      :class="headerCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
    >
      <div
        class="overflow-hidden transition-opacity duration-200"
        :class="headerCollapsed ? 'opacity-0' : 'opacity-100'"
      >
        <!-- Title — symmetric 13px vertical padding (was h-12 + items-center): the
             "Open" button's vertical center lines up with the canvas "Graph" button
             to its right (inset from the canvas top), with balanced breathing room
             above AND below before the divider. -->
        <div class="flex items-center justify-between px-4 py-[13px]">
          <span class="text-sm font-medium text-base-foreground">Media Assets</span>
          <!-- Emphasized (fill + label) so it's discoverable — the full Media
               Assets tab isn't open by default, so this is the way to expand. -->
          <IconTooltip label="Open in Media Assets tab" side="bottom">
            <button
              class="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-secondary-background px-2.5 text-sm leading-normal text-base-foreground transition-colors hover:bg-button-hovered focus:outline-none"
              aria-label="Open in Media Assets tab"
              @click="$emit('openMedia')"
            >
              <ExternalLink class="size-4" :stroke-width="1.5" />
              Open
            </button>
          </IconTooltip>
        </div>

        <!-- Divider under the header, above the category tabs. -->
        <div class="h-px w-full bg-border-subtle" />

        <!-- Tabs -->
        <div class="flex items-center gap-1 px-4 pt-3">
          <button
            v-for="t in TABS"
            :key="t.id"
            type="button"
            class="flex h-8 items-center rounded-lg px-2.5 text-sm transition-colors"
            :class="
              f.activeCategory.value === t.id
                ? 'bg-secondary-background text-base-foreground'
                : 'text-muted-foreground hover:text-base-foreground'
            "
            @click="f.selectCategory(t.id)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Search + actions (filled variant: background fill, no outline) -->
    <div class="flex items-center gap-2 px-4 py-3">
      <!-- flex-1 up to a max-width, then it stops stretching; the row is
           justify-start so the Filter/Views buttons sit right after it (the extra
           width becomes trailing space, not a giant search field). -->
      <DockSearch
        v-model="searchQuery"
        class="min-w-0 max-w-[420px] flex-1"
        @filter="filterMenu?.openMenu()"
      />
      <DockFilterMenu ref="filterMenu" :filters="f" />
      <ViewsMenu
        variant="dock"
        :show-sort="true"
        :sort-order="f.sortOrder.value"
        :view-options="f.viewOptions.value"
        :browse="f.mode.value === 'browse'"
        :dock-layout="dockLayout"
        @update:sort-order="f.sortOrder.value = $event"
        @update:view-options="f.viewOptions.value = $event"
        @update:dock-layout="dockLayout = $event"
      />
    </div>

    <!-- Applied filter chips (Figma 1778-19586). Tag chips filter the grid; the
         mock metadata chips are display-only, same as the gallery tab. Collapses
         on scroll-down alongside the title + tabs (Figma 1797-26563) — only the
         search row stays pinned. -->
    <div
      class="grid transition-[grid-template-rows] duration-200 ease-out"
      :class="headerCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
    >
      <div
        class="overflow-hidden transition-opacity duration-200"
        :class="headerCollapsed ? 'opacity-0' : 'opacity-100'"
      >
        <FilterChips :filters="f" clear-label="Clear all" clear-align="end" class="px-4 pb-2" />
      </div>
    </div>
    </template>

    <!-- DRILLED into a job: keep the panel title, swap everything else for a single
         "← Back to all assets" bar (Figma 1257-1388). The grid below shows just that
         job's outputs (visibleAssets → f.displayAssets). -->
    <template v-else>
      <!-- h-8 on the title matches the normal header's Open-button height, so the
           header doesn't change size when entering/leaving a job. Keep "Open" here
           too — it carries the DRILLED state to the tab (shared gallery state). -->
      <div class="flex items-center justify-between px-4 py-[13px]">
        <span class="flex h-8 items-center text-sm font-medium text-base-foreground">Media Assets</span>
        <IconTooltip label="Open in Media Assets tab" side="bottom">
          <button
            class="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-secondary-background px-2.5 text-sm leading-normal text-base-foreground transition-colors hover:bg-button-hovered focus:outline-none"
            aria-label="Open in Media Assets tab"
            @click="$emit('openMedia')"
          >
            <ExternalLink class="size-4" :stroke-width="1.5" />
            Open
          </button>
        </IconTooltip>
      </div>
      <div class="h-px w-full bg-border-subtle" />
      <div class="px-4 py-3">
        <button
          type="button"
          class="flex h-8 items-center gap-1.5 rounded-lg bg-secondary-background px-2.5 text-sm leading-normal text-base-foreground transition-colors hover:bg-button-hovered focus:outline-none"
          @click="f.exitJob()"
        >
          <ArrowLeft class="size-4" :stroke-width="1.5" />
          Back to all assets
        </button>
      </div>
    </template>

    <!-- Divider between the header controls and the asset grid -->
    <div class="h-px w-full bg-border-subtle" />

    <!-- Grid -->
    <div
      ref="containerRef"
      class="relative min-h-0 flex-1 select-none overflow-y-auto px-3"
      @pointerdown="onPointerDown"
      @scroll="onGridScroll"
    >
      <!-- List view (Figma 1780-35593 row): thumbnail + name + meta, hover fills. -->
      <div v-if="visibleAssets.length && dockLayout === 'list'" class="flex flex-col gap-0.5 py-2">
        <AssetListRow
          v-for="(a, i) in visibleAssets"
          :key="a.name"
          v-bind="a"
          :selected="sel.has(a.name)"
          :group-count="f.groupCounts.value[a.name] ?? 0"
          @select="onCardClick(i, $event)"
          @contextmenu="onCardContextMenu(a.name, $event)"
          @toggle-favorite="f.favoriteFromCard(a.name)"
          @menu="onCardMore(a.name, $event)"
          @inspect="f.openInspect(a.name)"
          @open-group="f.openJob(a.jobId)"
        />
      </div>

      <!-- Grid view — responsive columns from the size's min-width breakpoint. -->
      <div
        v-else-if="visibleAssets.length"
        class="grid gap-x-1 py-2"
        :class="infoHidden ? 'gap-y-1' : 'gap-y-3'"
        :style="gridStyle"
      >
        <AssetCard
          v-for="(a, i) in visibleAssets"
          :key="a.name"
          v-bind="a"
          :show-name="showName"
          :show-details="showDetails"
          :group-count="f.groupCounts.value[a.name] ?? 0"
          :selected="sel.has(a.name)"
          @select="onCardClick(i, $event)"
          @contextmenu="onCardContextMenu(a.name, $event)"
          @toggle-favorite="f.favoriteFromCard(a.name)"
          @menu="onCardMore(a.name, $event)"
          @inspect="f.openInspect(a.name)"
          @open-group="f.openJob(a.jobId)"
        />
      </div>

      <!-- Empty states (Figma 1778-20596 / 1778-20442). search → favorites
           (Favorited filter, no matches) → filtered → empty library. -->
      <DockEmptyState
        v-else
        class="px-1"
        :query="searchQuery"
        :favorites-only="f.favorited.value"
        :filtered="f.anyFilterApplied.value"
        @reset="searchQuery = ''"
      />

    </div>

    <!-- Marquee rectangle — fixed/viewport coords (teleported), matches the gallery. -->
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

    <!-- Selection toolbar. Narrow dock → condensed in-flow pill (icon-only, fills
         the panel). Wide dock (>= DOCK_TOOLBAR_FULL_W) → the gallery's full labeled
         pill, `w-fit` (its own max width) and centered on the dock via centerX.
         Both sit `bottom-6` off the dock floor. -->
    <template v-if="sel.size">
      <div v-if="!toolbarFull" class="absolute inset-x-0 bottom-6 z-20 px-3">
        <SelectionToolbar
          :count="sel.size"
          condensed
          :favorited="f.allSelectedFavorited.value"
          @clear="f.clearSelection"
          @favorite="f.toggleFavoriteSelected"
          @delete="requestDelete"
        />
      </div>
      <SelectionToolbar
        v-else
        :count="sel.size"
        :center-x="dockCenterX"
        :favorited="f.allSelectedFavorited.value"
        @clear="f.clearSelection"
        @favorite="f.toggleFavoriteSelected"
        @delete="requestDelete"
      />
    </template>

    <!-- Right-click context menu (same component as the tab). Teleported to body
         to escape the dock's overflow; follows the app theme. -->
    <Teleport to="body">
      <div v-if="menu">
        <ContextMenu
          :x="menu.x"
          :y="menu.y"
          :multiple="menu.multiple"
          :filters="f"
          :details-open="f.detailsOpen.value"
          @close="closeMenu"
          @action="onMenuAction"
        />
      </div>
    </Teleport>

    <!-- "Show details" → floating popover beside the dock (Figma 1812-70678). -->
    <DockDetailsPopover
      v-if="f.detailsOpen.value"
      :filters="f"
      :anchor-el="rootRef"
      :anchor-y="detailsAnchorY"
      @close="f.closeDetails"
    />

    <LightboxInspector v-if="f.inspectOpen.value" :filters="f" />

    <QuickLook v-if="f.quickLookOpen.value" :filters="f" />

    <ConfirmDialog
      v-model:open="confirmDeleteOpen"
      :title="`Delete ${deleteCount} ${deleteCount === 1 ? 'asset' : 'assets'}?`"
      :description="`${deleteCount === 1 ? 'This asset' : `These ${deleteCount} assets`} will be removed from your library. This can't be undone.`"
      destructive
      confirm-label="Delete"
      @confirm="doDelete"
    />
  </div>
</template>
