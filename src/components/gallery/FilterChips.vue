<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRightLeft, Search } from 'lucide-vue-next'
import FilterChip from './FilterChip.vue'
import IconTooltip from '@/components/ui/IconTooltip.vue'
import { ghostButtonClass } from '@/components/ui/ghostButton'
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

// Tags get the special AND/OR treatment; everything else is a plain chip.
const tagChips = computed(() => f.appliedFilterChips.value.filter((c) => c.key === 'tag'))
const otherChips = computed(() => f.appliedFilterChips.value.filter((c) => c.key !== 'tag'))
// Divider between the tag cluster (governed by the all/any toggle) and the other
// filter chips — makes the toggle's scope unmistakable when both are present.
const showDivider = computed(() => tagChips.value.length > 0 && otherChips.value.length > 0)

// One consistent control for 2+ tags: "matching all" (intersection) / "matching
// any" (union). (We dropped the earlier inline "and"/"or" word between two tags —
// morphing the affordance from "and" to "matching all" at 2→3 tags was confusing.)
const matchWord = computed(() => (f.tagMatch.value === 'all' ? 'all' : 'any'))
const toggleHint = computed(() =>
  f.tagMatch.value === 'all' ? 'Switch to matching any tag' : 'Switch to matching all tags',
)
</script>

<template>
  <div v-if="f.appliedFilterChips.value.length" class="flex flex-col gap-1.5">
    <div class="flex flex-wrap items-center gap-2">
      <!-- Tag cluster: the chips, then ONE consistent "matching all/any ▾" toggle
           whenever 2+ tags are selected — same control at 2 tags or 5, so it never
           morphs as you add tags. -->
      <FilterChip
        v-for="chip in tagChips"
        :key="`tag:${chip.value}`"
        :label="chip.label"
        :icon="chipIcon(chip.key)"
        @remove="f.removeChip(chip)"
      />
      <IconTooltip v-if="tagChips.length >= 2" :label="toggleHint" side="bottom">
        <!-- Ghost button (same family as Select all / Clear filters). Trailing swap
             glyph (not a chevron) — this flips all↔any in place, no menu opens. -->
        <button type="button" :class="ghostButtonClass" @click="f.toggleTagMatch">
          Match {{ matchWord }}
          <ArrowRightLeft class="size-3.5 shrink-0" :stroke-width="1.5" />
        </button>
      </IconTooltip>

      <!-- Scope divider: tags (+ their all/any toggle) on the left, other filters
           on the right. Only when both kinds are present. -->
      <div v-if="showDivider" class="mx-0.5 h-5 w-px shrink-0 bg-border-default" aria-hidden="true" />

      <!-- Everything else (media type, model/lora/workflow, Favorited, Previews). -->
      <FilterChip
        v-for="chip in otherChips"
        :key="`${chip.key}:${chip.value}`"
        :label="chip.label"
        :icon="chipIcon(chip.key)"
        @remove="f.removeChip(chip)"
      />

      <button
        v-if="!hideClear && clearAlign === 'inline'"
        type="button"
        :class="ghostButtonClass"
        @click="f.clearAllFilters"
      >
        {{ clearLabel }}
      </button>
    </div>

    <!-- Own-row, right-aligned (dock). -->
    <button
      v-if="!hideClear && clearAlign === 'end'"
      type="button"
      :class="[ghostButtonClass, 'self-end']"
      @click="f.clearAllFilters"
    >
      {{ clearLabel }}
    </button>
  </div>
</template>
