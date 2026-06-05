<script setup lang="ts">
// Matches the Comfy design-system minimap (vALUV…/1861-64424): a `base-background`
// panel = header (settings · close) + divider + map. The node graph renders on the
// panel bg itself (no distinct darker canvas rectangle).
import { Settings2, X } from 'lucide-vue-next'

defineEmits<{ close: [] }>()
</script>

<template>
  <!-- w-full: the parent column is sized to the (narrower) CanvasControls toolbar
       below, so the minimap matches the toolbar's width. -->
  <div class="w-full overflow-hidden rounded-lg border border-border-default bg-base-background shadow-[1px_1px_8px_rgba(0,0,0,0.5)]">
    <!-- Header -->
    <div class="flex h-8 items-center justify-between p-1">
      <button class="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground">
        <Settings2 class="size-4" :stroke-width="1.5" />
      </button>
      <button
        class="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
        aria-label="Close minimap"
        @click="$emit('close')"
      >
        <X class="size-4" :stroke-width="1.5" />
      </button>
    </div>

    <div class="h-px w-full bg-border-default" />

    <!-- Map — the node graph floats on the panel background (per the DS). -->
    <div class="relative h-[155px] bg-base-background">
      <!-- connector links -->
      <svg class="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <g stroke="#828282" stroke-width="0.6" fill="none">
          <line x1="49" y1="49" x2="60" y2="52" />
          <line x1="69" y1="52" x2="74" y2="44" />
          <line x1="69" y1="52" x2="74" y2="62" />
        </g>
      </svg>

      <!-- group box behind the left cluster -->
      <span class="absolute left-[18%] top-[34%] h-[34%] w-[38%] rounded-[3px] border border-[#3a86c9] bg-[#0b8ce9]/15" />

      <!-- node blocks (coral / azure / gold — match the DS tokens) -->
      <span class="absolute left-[21%] top-[40%] h-[22%] w-[15%] rounded-[2px] bg-[#b33a3a]" />
      <span class="absolute left-[39%] top-[40%] h-[22%] w-[9%] rounded-[2px] bg-[#0b8ce9]" />
      <span class="absolute left-[55%] top-[45%] h-[15%] w-[9%] rounded-[2px] bg-[#fd9903]" />
      <span class="absolute left-[70%] top-[36%] h-[15%] w-[11%] rounded-[2px] bg-[#fd9903]" />
      <span class="absolute left-[70%] top-[57%] h-[13%] w-[11%] rounded-[2px] bg-[#0b8ce9]" />

      <!-- viewport indicator -->
      <span class="absolute left-[15%] top-[26%] h-[52%] w-[52%] rounded-[3px] border border-base-foreground/45" />
    </div>
  </div>
</template>
