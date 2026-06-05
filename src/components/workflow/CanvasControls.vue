<script setup lang="ts">
// Matches the Comfy design-system canvas controls (vALUV…/1861-64424 toolbar):
// a `base-background` frame with `secondary-background` inner buttons, the pointer
// tool shown ACTIVE (highlighted), vertical dividers grouping pointer | view |
// links, and a `route-off` (links-off) toggle.
import { ChevronDown, Focus, Map, MousePointer2, RouteOff } from 'lucide-vue-next'

defineProps<{ zoomPct: number; minimapOpen?: boolean }>()
defineEmits<{ fit: []; reset: []; toggleMap: [] }>()
</script>

<template>
  <div
    class="flex h-[41px] items-center gap-1 rounded-lg border border-border-default bg-base-background p-1 text-sm shadow-[1px_1px_8px_rgba(0,0,0,0.4)]"
  >
    <!-- Pointer tool (active → highlighted) + its dropdown chevron -->
    <div class="flex h-full items-center">
      <button class="flex size-8 items-center justify-center rounded-lg bg-secondary-background-high text-base-foreground">
        <MousePointer2 class="size-4" :stroke-width="1.5" />
      </button>
      <button class="flex h-full items-center px-1 text-muted-foreground transition-colors hover:text-base-foreground">
        <ChevronDown class="size-3" :stroke-width="2" />
      </button>
    </div>

    <div class="h-[27px] w-px bg-border-default" />

    <!-- Fit to view -->
    <button
      class="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-button-hovered hover:text-base-foreground"
      title="Fit to view"
      @click="$emit('fit')"
    >
      <Focus class="size-4" :stroke-width="1.5" />
    </button>

    <!-- Zoom level (reset). Muted figure per the DS; reserves a 3-digit width so the
         toolbar doesn't shift as the level changes (50% ↔ 150%). -->
    <button
      class="flex h-8 items-center gap-1 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-button-hovered hover:text-base-foreground"
      title="Reset zoom"
      @click="$emit('reset')"
    >
      <span class="inline-block min-w-[3rem] text-center tabular-nums">{{ zoomPct }}%</span>
      <ChevronDown class="size-3" :stroke-width="2" />
    </button>

    <div class="h-[27px] w-px bg-border-default" />

    <!-- Toggle minimap (active → highlighted, like the pointer tool) -->
    <button
      class="flex size-8 items-center justify-center rounded-lg transition-colors"
      :class="
        minimapOpen
          ? 'bg-secondary-background-high text-base-foreground'
          : 'text-muted-foreground hover:bg-button-hovered hover:text-base-foreground'
      "
      :aria-label="minimapOpen ? 'Hide minimap' : 'Show minimap'"
      @click="$emit('toggleMap')"
    >
      <Map class="size-4" :stroke-width="1.5" />
    </button>
    <!-- Toggle link render (links off) -->
    <button class="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-button-hovered hover:text-base-foreground">
      <RouteOff class="size-4" :stroke-width="1.5" />
    </button>
  </div>
</template>
