<script setup lang="ts">
import { computed } from 'vue'
import { Columns3, LayoutGrid, Rows3 } from 'lucide-vue-next'
import IconTooltip from '@/components/ui/IconTooltip.vue'

export type LayoutKind = 'grid' | 'masonry-row' | 'masonry-column'

const props = defineProps<{
  /** Current gallery mode + masonry orientation (from useGalleryFilters). */
  mode: 'manage' | 'browse'
  masonryAxis: 'row' | 'column'
}>()
const emit = defineEmits<{ select: [value: LayoutKind] }>()

// Which segment is lit. Grid == manage; the two masonries == browse + axis.
const active = computed<LayoutKind>(() =>
  props.mode === 'manage'
    ? 'grid'
    : props.masonryAxis === 'column'
      ? 'masonry-column'
      : 'masonry-row',
)

// Rows3 (horizontal bars) vs Columns3 (vertical bars) read the row-vs-column
// masonry distinction instantly — they're rotated twins, same as the rotated
// template, but far less abstract at icon size.
const SEGMENTS: { value: LayoutKind; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'masonry-row', label: 'Masonry rows', icon: Rows3 },
  { value: 'masonry-column', label: 'Masonry columns', icon: Columns3 },
]
</script>

<template>
  <!-- One rounded outline around all three segments = clearly a single toggle.
       Active segment gets a filled pill; the rest are quiet until hovered. -->
  <div
    role="radiogroup"
    aria-label="Layout"
    class="inline-flex h-10 shrink-0 items-center gap-0.5 rounded-lg border border-border-default p-0.5"
  >
    <IconTooltip v-for="seg in SEGMENTS" :key="seg.value" :label="seg.label" side="bottom">
      <button
        type="button"
        role="radio"
        :aria-checked="active === seg.value"
        :aria-label="seg.label"
        class="flex size-8 items-center justify-center rounded-md transition-colors focus:outline-none"
        :class="
          active === seg.value
            ? 'bg-secondary-background text-base-foreground'
            : 'text-muted-foreground hover:bg-secondary-background hover:text-base-foreground'
        "
        @click="emit('select', seg.value)"
      >
        <component :is="seg.icon" class="size-4" :stroke-width="1.5" />
      </button>
    </IconTooltip>
  </div>
</template>
