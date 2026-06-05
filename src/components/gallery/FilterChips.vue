<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import FilterChip from './FilterChip.vue'
import { filterByKey } from './filters'
import type { useGalleryFilters } from '@/composables/useGalleryFilters'

// The 'search' chip is a free-text search, not a FilterDef → its own icon.
const chipIcon = (key: string) => (key === 'search' ? Search : filterByKey(key).icon)

// Applied-filter chip bar (gallery tab + dock).
//   - gallery tab: inline "Clear filters" flowing after the chips.
//   - dock (Figma 1778-19686): chips wrap; a "Clear all" sits on its OWN row,
//     right-aligned, below them. → clearLabel="Clear all" clearAlign="end".
const props = withDefaults(
  defineProps<{
    filters: ReturnType<typeof useGalleryFilters>
    hideClear?: boolean
    clearLabel?: string
    clearAlign?: 'inline' | 'end'
  }>(),
  { hideClear: false, clearLabel: 'Clear filters', clearAlign: 'inline' },
)
const f = props.filters
const clearBtnClass =
  'flex h-6 items-center justify-center rounded-md px-2 py-1 text-sm leading-normal text-muted-foreground hover:text-base-foreground'
</script>

<template>
  <div v-if="f.appliedFilterChips.value.length" class="flex flex-col gap-1.5">
    <div class="flex flex-wrap items-center gap-2">
      <FilterChip
        v-for="chip in f.appliedFilterChips.value"
        :key="`${chip.key}:${chip.value}`"
        :label="chip.label"
        :icon="chipIcon(chip.key)"
        @remove="f.removeChip(chip)"
      />
      <button
        v-if="!hideClear && clearAlign === 'inline'"
        type="button"
        :class="clearBtnClass"
        @click="f.clearAllFilters"
      >
        {{ clearLabel }}
      </button>
    </div>

    <!-- Own-row, right-aligned (dock). -->
    <button
      v-if="!hideClear && clearAlign === 'end'"
      type="button"
      :class="[clearBtnClass, 'self-end']"
      @click="f.clearAllFilters"
    >
      {{ clearLabel }}
    </button>
  </div>
</template>
