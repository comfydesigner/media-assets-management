<script setup lang="ts">
import { computed, onBeforeUnmount, watchEffect } from 'vue'
import { useAssetDrag } from '@/composables/useAssetDrag'
import { placeholderBg } from '../gallery/placeholder'

// The "dragged tile" that follows the cursor while pulling asset(s) toward the
// canvas (Figma 1780-37134 single / 1797-20347 multi): a dark pill with a
// thumbnail (stacked for multi) + the asset name (or "N assets") + a hint that
// flips to "Drop to add node" over the canvas.
const drag = useAssetDrag()

const multi = computed(() => drag.names.value.length > 1)
const topName = computed(() => drag.names.value[0] ?? '')
const title = computed(() =>
  multi.value ? `${drag.names.value.length} assets` : topName.value,
)
const hint = computed(() => (drag.overCanvas.value ? 'Drop to add node' : 'Drag to canvas'))
const style = computed(() =>
  drag.pos.value ? { left: `${drag.pos.value.x - 8}px`, top: `${drag.pos.value.y - 8}px` } : {},
)

// Force the cursor while dragging: plain arrow over the dock, green "add" (copy)
// over the canvas (the CSS lives in style.css to win over element cursors).
watchEffect(() => {
  const html = document.documentElement
  html.classList.toggle('asset-dragging', drag.dragging.value)
  html.classList.toggle('asset-drag-copy', drag.dragging.value && drag.overCanvas.value)
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('asset-dragging', 'asset-drag-copy')
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="drag.dragging.value && drag.pos.value"
      class="pointer-events-none fixed z-[100] flex items-center gap-2.5 rounded-lg border border-node-border bg-secondary-background py-1.5 pl-1.5 pr-3 shadow-[1px_2px_10px_rgba(0,0,0,0.5)]"
      :style="style"
    >
      <!-- thumbnail (fanned deck for multi — Figma 1797-20371): up to two tiles
           rotated behind the front one so the stack peeks out top-left. -->
      <div class="relative size-9 shrink-0">
        <div
          v-if="drag.names.value.length > 2"
          class="absolute inset-0 size-9 origin-center rotate-[-13deg] overflow-hidden rounded-md border border-white/10 shadow-[1px_1px_4px_rgba(0,0,0,0.4)]"
          :style="placeholderBg(drag.names.value[2] ?? topName)"
        />
        <div
          v-if="multi"
          class="absolute inset-0 size-9 origin-center rotate-[-6deg] overflow-hidden rounded-md border border-white/10 shadow-[1px_1px_4px_rgba(0,0,0,0.4)]"
          :style="placeholderBg(drag.names.value[1] ?? topName)"
        />
        <div
          class="relative size-9 overflow-hidden rounded-md border border-white/20 shadow-[1px_1px_4px_rgba(0,0,0,0.4)]"
          :style="placeholderBg(topName)"
        />
      </div>
      <div class="flex min-w-0 flex-col leading-tight">
        <span class="max-w-[180px] truncate text-sm font-medium text-base-foreground">{{ title }}</span>
        <span class="text-xs text-muted-foreground">{{ hint }}</span>
      </div>
    </div>
  </Teleport>
</template>
