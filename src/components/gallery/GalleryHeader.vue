<script setup lang="ts">
import { ChevronLeft, ChevronRight, Upload } from 'lucide-vue-next'
import SearchBar from './SearchBar.vue'
import SizeSlider from './SizeSlider.vue'
import SortMenu from './SortMenu.vue'
import ViewsMenu from './ViewsMenu.vue'
import LayoutSwitcher, { type LayoutKind } from './LayoutSwitcher.vue'
import type { SortOrder, ViewOptions } from './types'
import { useGalleryFilters } from '@/composables/useGalleryFilters'
import { useExperiments } from '@/composables/useExperiments'

const experiments = useExperiments()

// Translate a segmented-control choice into mode + masonry orientation
// (same mapping the Views menu uses for its "Layout: …" rows).
function selectLayout(filters: ReturnType<typeof useGalleryFilters>, layout: LayoutKind) {
  if (layout === 'grid') {
    filters.setMode('manage')
  } else {
    filters.setMode('browse')
    filters.setMasonryAxis(layout === 'masonry-column' ? 'column' : 'row')
  }
}

defineProps<{
  filters: ReturnType<typeof useGalleryFilters>
  title: string
  count: number
  allSelected: boolean
  sortOrder: SortOrder
  viewOptions: ViewOptions
  sizeStep: number
  /** Gallery is narrow: fold the labeled sort dropdown into the Views menu,
   *  drop the title text + the Import label, stack search on its own row. */
  compact?: boolean
  /** Intermediate (still single-row) steps that shrink the RIGHT cluster first so
   *  the search bar stays centered: sort → icon, then Import → icon. */
  condenseSort?: boolean
  condenseImport?: boolean
  /** When drilled into a job: the cover/"final output" name → shown as the final
   *  breadcrumb crumb (the parent crumb = the category title, which exits). */
  drilledLabel?: string | null
}>()
defineEmits<{
  'update:sortOrder': [value: SortOrder]
  'update:viewOptions': [value: ViewOptions]
  'update:sizeStep': [value: number]
  'toggleSelectAll': []
  'exitJob': []
}>()
</script>

<template>
  <!-- WIDE: single row -->
  <div v-if="!compact" class="flex h-10 items-center gap-4 px-2">
    <div class="flex min-w-0 flex-1 items-baseline gap-6">
      <!-- Drilled into a job → breadcrumb (parent crumb exits); else plain title. -->
      <nav v-if="drilledLabel" class="flex shrink-0 items-center gap-1 text-base leading-normal">
        <button
          type="button"
          class="shrink-0 whitespace-nowrap text-muted-foreground transition-colors hover:text-base-foreground"
          @click="$emit('exitJob')"
        >
          {{ title }}
        </button>
        <ChevronRight class="size-4 shrink-0 translate-y-px text-muted-foreground" :stroke-width="1.5" />
        <span class="whitespace-nowrap font-medium text-base-foreground">{{ drilledLabel }}</span>
      </nav>
      <p v-else class="whitespace-nowrap text-base font-medium leading-normal text-base-foreground">
        {{ title }}
      </p>
      <div class="flex shrink-0 items-center gap-2">
        <p class="whitespace-nowrap text-sm leading-5 text-muted-foreground">
          {{ count }} {{ count === 1 ? 'asset' : 'assets' }}
        </p>
        <button
          type="button"
          :disabled="count === 0"
          class="flex h-8 shrink-0 items-center justify-center rounded-lg p-2 enabled:hover:bg-secondary-background disabled:cursor-not-allowed disabled:opacity-40"
          @click="$emit('toggleSelectAll')"
        >
          <span class="whitespace-nowrap text-sm leading-normal text-base-foreground">
            {{ allSelected ? 'Deselect all' : 'Select all' }}
          </span>
        </button>
      </div>
    </div>

    <SearchBar :filters="filters" />

    <div class="flex flex-1 items-center justify-end gap-2">
      <SizeSlider
        :model-value="sizeStep"
        @update:model-value="$emit('update:sizeStep', $event)"
      />
      <!-- "Future options" experiment: Layout moves out of the Views menu into a
           segmented control on the header. -->
      <LayoutSwitcher
        v-if="experiments.headerLayoutSwitcher"
        :mode="filters.mode.value"
        :masonry-axis="filters.masonryAxis.value"
        @select="selectLayout(filters, $event)"
      />
      <SortMenu
        :model-value="sortOrder"
        :icon-only="condenseSort"
        @update:model-value="$emit('update:sortOrder', $event)"
      />
      <ViewsMenu
        variant="header"
        :sort-order="sortOrder"
        :view-options="viewOptions"
        :browse="filters.mode.value === 'browse'"
        :show-layout="!experiments.headerLayoutSwitcher"
        :mode="filters.mode.value"
        :masonry-axis="filters.masonryAxis.value"
        @update:sort-order="$emit('update:sortOrder', $event)"
        @update:view-options="$emit('update:viewOptions', $event)"
        @update:mode="filters.setMode"
        @update:masonry-axis="filters.setMasonryAxis"
      />
      <button
        type="button"
        class="flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg border border-border-default hover:bg-secondary-background"
        :class="condenseImport ? 'w-10' : 'px-3 py-2'"
        :aria-label="condenseImport ? 'Upload' : undefined"
      >
        <Upload class="size-4" :stroke-width="1.5" />
        <span v-if="!condenseImport" class="text-sm leading-normal text-base-foreground">Upload</span>
      </button>
    </div>
  </div>

  <!-- COMPACT: search on its own row, controls below. The labeled sort dropdown
       folds into the Views menu (showSort); Import is icon-only. -->
  <div v-else class="flex flex-col gap-2 px-2">
    <SearchBar :filters="filters" />
    <div class="flex items-center gap-2">
      <!-- Drilled into a job → back to the category (the breadcrumb's parent crumb). -->
      <button
        v-if="drilledLabel"
        type="button"
        class="flex shrink-0 items-center gap-0.5 text-sm leading-5 text-muted-foreground transition-colors hover:text-base-foreground"
        @click="$emit('exitJob')"
      >
        <ChevronLeft class="size-4 shrink-0" :stroke-width="1.5" />
        <span class="whitespace-nowrap">{{ title }}</span>
      </button>
      <p class="whitespace-nowrap text-sm leading-5 text-muted-foreground">
        {{ count }} {{ count === 1 ? 'asset' : 'assets' }}
      </p>
      <button
        type="button"
        :disabled="count === 0"
        class="flex h-8 shrink-0 items-center justify-center rounded-lg p-2 enabled:hover:bg-secondary-background disabled:cursor-not-allowed disabled:opacity-40"
        @click="$emit('toggleSelectAll')"
      >
        <span class="whitespace-nowrap text-sm leading-normal text-base-foreground">
          {{ allSelected ? 'Deselect all' : 'Select all' }}
        </span>
      </button>

      <div class="min-w-0 flex-1" />

      <SizeSlider
        :model-value="sizeStep"
        @update:model-value="$emit('update:sizeStep', $event)"
      />
      <ViewsMenu
        variant="header"
        :show-sort="true"
        :sort-order="sortOrder"
        :view-options="viewOptions"
        :browse="filters.mode.value === 'browse'"
        :show-layout="true"
        :mode="filters.mode.value"
        :masonry-axis="filters.masonryAxis.value"
        @update:sort-order="$emit('update:sortOrder', $event)"
        @update:view-options="$emit('update:viewOptions', $event)"
        @update:mode="filters.setMode"
        @update:masonry-axis="filters.setMasonryAxis"
      />
      <button
        type="button"
        class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border-default hover:bg-secondary-background"
        aria-label="Upload"
      >
        <Upload class="size-4" :stroke-width="1.5" />
      </button>
    </div>
  </div>
</template>
