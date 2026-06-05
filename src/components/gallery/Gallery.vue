<script setup lang="ts">
import { computed, ref } from 'vue'
import AssetGrid from './AssetGrid.vue'
import AssetDetailsPanel from './AssetDetailsPanel.vue'
import DockEmptyState from './DockEmptyState.vue'
import FilterChips from './FilterChips.vue'
import GalleryHeader from './GalleryHeader.vue'
import TagPopover from './TagPopover.vue'
import LightboxInspector from './LightboxInspector.vue'
import QuickLook from './QuickLook.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useElementWidth } from '@/composables/useElementWidth'
import type { useGalleryFilters } from '@/composables/useGalleryFilters'

const props = defineProps<{
  filters: ReturnType<typeof useGalleryFilters>
}>()

const f = props.filters

// Bulk-tag command dialog (centered, top), launched from the selection toolbar.
const tagOpen = ref(false)

// Delete confirmation (AlertDialog). The toolbar/context-menu delete routes here
// instead of deleting immediately.
const confirmDeleteOpen = ref(false)
const deleteCount = computed(() => f.selectedAssets.size)
function requestDelete() {
  if (deleteCount.value > 0) confirmDeleteOpen.value = true
}
function doDelete() {
  f.deleteSelected()
  confirmDeleteOpen.value = false
}

// AssetGrid owns the marquee logic; the <section> forwards pointerdown to it so
// a rubber-band can start from the empty header area too (not just the grid).
const gridRef = ref<InstanceType<typeof AssetGrid> | null>(null)

// "+N" group badge → drill into that job (grid shows just its outputs; the header
// swaps its title for a breadcrumb whose parent crumb exits back).
function onOpenGroup(jobId?: string) {
  f.openJob(jobId)
}


// Container-style responsive breakpoint driven by the gallery's OWN width
// (not the viewport — the side panel eats ~240px). Below this the header
// condenses: the labeled sort dropdown folds into the Views menu, etc.
const { el: sectionRef, width: galleryWidth } = useElementWidth()
const compact = computed(() => galleryWidth.value > 0 && galleryWidth.value <= 720)
// Keep the search bar centered by shrinking the RIGHT cluster (it's much wider
// than the left) BEFORE it overflows its centered half-share and pushes the
// search off-center. The search centers via the flex-1 side clusters as long as
// the right content ≤ its share = (gallery − searchW(512) − gaps(48)) / 2.
// MEASURED (gallery 1776): full right content ≈ 490 → overflows its share when
// gallery < 512+48+2·490 ≈ 1540; after sort→icon right ≈ 376 → overflows when
// gallery < 512+48+2·376 ≈ 1312. So condense at those crossovers (cascade: sort
// label drops first, then Import label), then full-compact two-row at ≤720.
const condenseSort = computed(() => galleryWidth.value > 0 && galleryWidth.value <= 1540)
const condenseImport = computed(() => galleryWidth.value > 0 && galleryWidth.value <= 1320)
</script>

<template>
  <div class="flex h-full min-w-0 flex-1">
    <section
      ref="sectionRef"
      class="flex h-full min-w-0 flex-1 flex-col bg-base-background p-4"
      @pointerdown="gridRef?.marqueePointerDown?.($event)"
    >
      <GalleryHeader
        :filters="f"
        :title="f.headerTitle.value"
        :count="f.headerCount.value"
        :all-selected="f.allVisibleSelected.value"
        :compact="compact"
        :condense-sort="condenseSort"
        :condense-import="condenseImport"
        :drilled-label="f.drilledLabel.value"
        v-model:sort-order="f.sortOrder.value"
        v-model:view-options="f.viewOptions.value"
        v-model:size-step="f.sizeStep.value"
        @toggle-select-all="f.toggleSelectAll"
        @exit-job="f.exitJob"
      />
      <!-- Applied-filter chips: auto-height accordion. <Transition> keeps the chip
           DOM mounted (frozen) through the leave, so the grid-rows 1fr↔0fr height
           transition animates smoothly when filters are applied AND cleared. (No
           grid-rows on the base class → avoids a Tailwind utility-order conflict
           with the from/to classes.) The `pt-4` above the chips is in the animated
           region; the grid keeps a constant `pt-4`. -->
      <Transition
        enter-active-class="transition-[grid-template-rows,opacity] duration-200 ease-out"
        enter-from-class="grid-rows-[0fr] opacity-0"
        enter-to-class="grid-rows-[1fr] opacity-100"
        leave-active-class="transition-[grid-template-rows,opacity] duration-200 ease-in"
        leave-from-class="grid-rows-[1fr] opacity-100"
        leave-to-class="grid-rows-[0fr] opacity-0"
      >
        <div v-if="f.appliedFilterChips.value.length" class="grid">
          <div class="overflow-hidden">
            <FilterChips :filters="f" class="px-2 pt-4" />
          </div>
        </div>
      </Transition>
      <div class="min-h-0 flex-1 overflow-hidden pt-4">
        <AssetGrid
          v-if="f.displayAssets.value.length"
          ref="gridRef"
          :filters="f"
          :assets="f.displayAssets.value"
          :group-counts="f.groupCounts.value"
          :breakpoint="f.sizeBreakpoint.value"
          :selected="f.selectedAssets"
          :layout="f.galleryLayout.value"
          :browse="f.mode.value === 'browse'"
          :selection-favorited="f.allSelectedFavorited.value"
          :details-open="f.detailsOpen.value"
          @toggle-favorite="f.favoriteFromCard"
          @favorite-selected="f.toggleFavoriteSelected"
          @delete-selected="requestDelete"
          @show-details="f.toggleDetails"
          @show-tag-popover="tagOpen = true"
          @inspect-asset="f.openInspect($event)"
          @quick-look="f.openQuickLook()"
          @open-group="onOpenGroup"
        />
        <!-- Empty states (shared with the dock): search → favorites → filtered → empty. -->
        <DockEmptyState
          v-else
          class="px-2"
          :query="f.searchQuery.value"
          :favorites-only="f.favorited.value || f.activeCategory.value === 'favorites'"
          :filtered="f.anyFilterApplied.value"
          @reset="f.clearAllFilters"
        />
      </div>
    </section>

    <AssetDetailsPanel v-if="f.detailsOpen.value" :filters="f" />

    <TagPopover v-if="tagOpen" :filters="f" :anchor-el="sectionRef" @close="tagOpen = false" />

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
