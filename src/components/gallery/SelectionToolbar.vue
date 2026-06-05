<script setup lang="ts">
import { ref } from 'vue'
import { Download, Star, Tag, Trash2, X } from 'lucide-vue-next'
import IconTooltip from '@/components/ui/IconTooltip.vue'

const props = withDefaults(
  defineProps<{
    count: number
    condensed?: boolean
    favorited?: boolean
    /** Viewport X to center the floating (non-condensed) toolbar on — the asset
     *  grid's midpoint, so it aligns with the grid-centered TagPopover. Falls
     *  back to viewport-center (50%) when absent. */
    centerX?: number
  }>(),
  { condensed: false, favorited: false },
)
defineEmits<{
  clear: []
  download: []
  favorite: []
  tag: []
  delete: []
}>()

// Hovering the clear (X) button turns the count label into an "Unselect…" hint.
const clearHover = ref(false)
const noun = () => (props.count === 1 ? 'asset' : 'assets')
</script>

<template>
  <!--
    Condensed variant (workflow Media dock): same inverted pill, in-flow + full
    width, icon-only actions to fit the narrow panel. (Figma "Panel Actions"
    2276:53578.)
  -->
  <div
    v-if="condensed"
    class="flex w-full items-center gap-1 rounded-lg bg-base-foreground px-1.5 py-1.5 text-base-background shadow-[var(--shadow-floating-dark)]"
  >
    <button
      type="button"
      class="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-base-background/10 focus:outline-none"
      aria-label="Clear selection"
      @click="$emit('clear')"
      @mouseenter="clearHover = true"
      @mouseleave="clearHover = false"
    >
      <X class="size-4" :stroke-width="1.5" />
    </button>
    <!-- Both labels share one grid cell so the pill width is the max of the two
         (no resize when the label swaps on X-hover). -->
    <span class="grid justify-items-start whitespace-nowrap pl-1 text-sm font-bold">
      <span class="col-start-1 row-start-1" :class="{ invisible: clearHover }">
        <span class="tabular-nums">{{ count }}</span> selected
      </span>
      <span class="col-start-1 row-start-1" :class="{ invisible: !clearHover }">Unselect</span>
    </span>
    <span class="flex-1" />
    <IconTooltip label="Download">
      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-base-background/10 focus:outline-none"
        aria-label="Download"
        @click="$emit('download')"
      >
        <Download class="size-4" :stroke-width="1.5" />
      </button>
    </IconTooltip>
    <IconTooltip :label="favorited ? 'Remove from favorites' : 'Add to favorites'">
      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-base-background/10 focus:outline-none"
        aria-label="Favorite"
        @click="$emit('favorite')"
      >
        <Star
          class="size-4"
          :class="favorited ? 'text-yellow-400' : ''"
          :fill="favorited ? 'currentColor' : 'none'"
          :stroke-width="1.5"
        />
      </button>
    </IconTooltip>
    <div class="mx-0.5 h-6 w-px bg-base-background/20" aria-hidden="true" />
    <IconTooltip label="Delete">
      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-base-background/10 focus:outline-none"
        aria-label="Delete"
        @click="$emit('delete')"
      >
        <Trash2 class="size-4" :stroke-width="1.5" />
      </button>
    </IconTooltip>
  </div>

  <!--
    Figma "Panel Actions" (2020:32843). Inverted surface: background is
    --base-foreground and content is --base-background, so it flips with the
    theme (white pill + dark content in dark mode, dark pill + light content in
    light mode). Centered on the viewport width, not the assets container.
  -->
  <div
    v-else
    class="fixed bottom-6 z-40 flex w-fit items-center gap-2 rounded-lg bg-base-foreground px-2 py-2 text-base-background shadow-[var(--shadow-floating-dark)]"
    :style="{ left: centerX != null ? `${centerX}px` : '50%', transform: 'translateX(-50%)' }"
  >
    <!-- Close / clear selection -->
    <button
      type="button"
      class="flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-base-background/10 focus:outline-none"
      aria-label="Clear selection"
      @click="$emit('clear')"
      @mouseenter="clearHover = true"
      @mouseleave="clearHover = false"
    >
      <X class="size-4" :stroke-width="1.5" />
    </button>

    <!-- Selection count (→ "Unselect …" while hovering the X). One invisible
         sizer reserves the width of the WIDEST phrase the label ever shows (a
         two-digit count + plural noun), so neither the asset/assets "s" nor the
         digit count resizes the pill. The real phrase renders naturally and is
         left-anchored — the slack lands as trailing space before the actions
         (no mid-phrase gap). -->
    <div class="grid justify-items-start pr-6 text-sm font-bold whitespace-nowrap">
      <span aria-hidden="true" class="invisible col-start-1 row-start-1">
        <span class="tabular-nums">00</span> assets selected
      </span>
      <div class="col-start-1 row-start-1" :class="{ invisible: clearHover }">
        <span class="tabular-nums">{{ count }}</span> {{ noun() }} selected
      </div>
      <div class="col-start-1 row-start-1" :class="{ invisible: !clearHover }">
        Unselect {{ noun() }}
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="flex h-10 items-center justify-center gap-1 rounded-lg border border-base-background px-4 text-sm transition-colors hover:bg-base-background/10 focus:outline-none"
        @click="$emit('download')"
      >
        <span>Download</span>
        <Download class="size-4" :stroke-width="1.5" />
      </button>

      <IconTooltip :label="favorited ? 'Remove from favorites' : 'Add to favorites'">
        <button
          type="button"
          class="flex h-10 items-center justify-center rounded-lg px-3 transition-colors hover:bg-base-background/10 focus:outline-none"
          aria-label="Favorite"
          @click="$emit('favorite')"
        >
          <Star
            class="size-4"
            :class="favorited ? 'text-yellow-400' : ''"
            :fill="favorited ? 'currentColor' : 'none'"
            :stroke-width="1.5"
          />
        </button>
      </IconTooltip>

      <IconTooltip label="Add tags">
        <button
          type="button"
          class="flex h-10 items-center justify-center rounded-lg px-3 transition-colors hover:bg-base-background/10 focus:outline-none"
          aria-label="Tag"
          @click="$emit('tag')"
        >
          <Tag class="size-4" :stroke-width="1.5" />
        </button>
      </IconTooltip>

      <div class="h-6 w-px bg-base-background/20" aria-hidden="true" />

      <IconTooltip label="Delete">
        <button
          type="button"
          class="flex h-10 items-center justify-center rounded-lg px-3 transition-colors hover:bg-base-background/10 focus:outline-none"
          aria-label="Delete"
          @click="$emit('delete')"
        >
          <Trash2 class="size-4" :stroke-width="1.5" />
        </button>
      </IconTooltip>
    </div>
  </div>
</template>
