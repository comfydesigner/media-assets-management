<script setup lang="ts">
import { computed } from 'vue'
import { Check, Ellipsis, Star } from 'lucide-vue-next'
import { placeholderBg } from './placeholder'
import IconTooltip from '@/components/ui/IconTooltip.vue'
import PreviewBadge from './PreviewBadge.vue'

// Compact list-view row for the dock (Figma 2448-54316): square thumbnail + a
// truncating filename + "format · dimensions" meta, with the actions on the RIGHT
// (the row has the width for them). Hover fills the row + reveals the More /
// Favorite buttons; SELECTED adds a white check pill on the right + a white ring
// (same selection language as the grid cards). Mirrors AssetCard's interaction
// contract so the shared selection composable (marquee / drag-out / context menu)
// works unchanged — the root is a `button[aria-pressed]`.
const props = withDefaults(
  defineProps<{
    name?: string
    format?: string
    dimensions?: string
    selected?: boolean
    favorite?: boolean
    preview?: boolean
  }>(),
  {
    name: 'image00',
    format: 'PNG',
    dimensions: '512×512',
    selected: false,
    favorite: false,
    preview: false,
  },
)
defineEmits<{ select: [e: MouseEvent]; 'toggle-favorite': []; menu: [rect: DOMRect]; inspect: [] }>()

const placeholderStyle = computed(() => placeholderBg(props.name))
</script>

<template>
  <button
    type="button"
    :aria-pressed="selected"
    :data-name="name"
    class="group/row relative flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-azure-600"
    :class="
      selected
        ? 'bg-secondary-background ring-1 ring-inset ring-base-foreground'
        : 'hover:bg-secondary-background'
    "
    @click="$emit('select', $event)"
    @dblclick="$emit('inspect')"
  >
    <!-- Thumbnail (40×40) with the selected check pill in its top-right corner. -->
    <div data-thumb class="relative size-10 shrink-0">
      <div class="size-10 overflow-hidden rounded-md" :style="placeholderStyle" />
      <span
        v-if="selected"
        class="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-white shadow-[1px_1px_3px_rgba(0,0,0,0.35)]"
        aria-label="Selected"
      >
        <Check class="size-3 text-black" :stroke-width="2.5" />
      </span>
    </div>

    <!-- Name + meta (truncates to make room for the right-side actions) -->
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="truncate text-sm leading-tight text-base-foreground">{{ name }}</span>
      <div class="flex min-w-0 items-center gap-1.5">
        <span class="truncate text-xs leading-tight text-muted-foreground">
          {{ format }} {{ dimensions }}
        </span>
        <PreviewBadge v-if="preview" />
      </div>
    </div>

    <!-- Right actions: More (hover) · Favorite (gold when favorited, else
         revealed on hover). The selected check lives on the thumbnail. -->
    <div class="flex shrink-0 items-center gap-1 pl-1">
      <IconTooltip label="More actions">
        <span
          class="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors hover:bg-button-hovered hover:text-base-foreground group-hover/row:opacity-100"
          role="button"
          aria-label="More"
          @click.stop="$emit('menu', ($event.currentTarget as HTMLElement).getBoundingClientRect())"
          @dblclick.stop
        >
          <Ellipsis class="size-4" :stroke-width="1.5" />
        </span>
      </IconTooltip>

      <IconTooltip :label="favorite ? 'Remove from favorites' : 'Add to favorites'">
        <span
          class="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-button-hovered"
          :class="
            favorite
              ? 'text-yellow-400'
              : 'text-muted-foreground opacity-0 hover:text-base-foreground group-hover/row:opacity-100'
          "
          role="button"
          :aria-label="favorite ? 'Unfavorite' : 'Favorite'"
          @click.stop="$emit('toggle-favorite')"
          @dblclick.stop
        >
          <Star class="size-4" :fill="favorite ? 'currentColor' : 'none'" :stroke-width="1.5" />
        </span>
      </IconTooltip>
    </div>
  </button>
</template>
