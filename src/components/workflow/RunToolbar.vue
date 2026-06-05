<script setup lang="ts">
// Matches the Comfy design-system run toolbar (vALUV…/5564-7882): a near-black
// `base-background` FRAME (border + floating shadow) holding lighter
// `secondary-background` inner buttons. The Run is a split control
// [batch-count + stepper │ blue Run │ options chevron]; cancel / jobs / panel are
// separate inner buttons. Extensions is its own matching framed button.
import { ChevronDown, ChevronUp, PanelRight, Play, X } from 'lucide-vue-next'

const FRAME =
  'flex h-12 items-center rounded-lg border border-border-default bg-base-background shadow-[1px_1px_8px_rgba(0,0,0,0.4)]'
</script>

<template>
  <div class="flex items-center gap-2 text-sm">
    <!-- Extensions button hidden for now (kept out of the run toolbar). -->

    <!-- Run toolbar frame -->
    <div :class="FRAME" class="gap-2 px-2">
      <!-- Run group: split [count + stepper | blue Run | options chevron] -->
      <div class="flex items-center gap-0.5 overflow-hidden rounded-lg bg-secondary-background">
        <!-- batch count + up/down stepper -->
        <div class="flex h-8 items-center gap-1 pl-3 pr-1">
          <span class="tabular-nums text-base-foreground">1</span>
          <div class="flex flex-col text-muted-foreground">
            <ChevronUp class="-mb-[3px] size-3" :stroke-width="2.5" />
            <ChevronDown class="-mt-[3px] size-3" :stroke-width="2.5" />
          </div>
        </div>
        <!-- Run -->
        <button class="flex h-8 items-center gap-1.5 rounded-lg bg-[#0b8ce9] px-4 text-white transition-[filter] hover:brightness-110">
          <Play class="size-4" fill="currentColor" :stroke-width="0" />
          Run
        </button>
        <!-- Run options dropdown -->
        <button class="flex h-8 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-base-foreground">
          <ChevronDown class="size-3" :stroke-width="2" />
        </button>
      </div>

      <!-- Cancel — destructive token, faint when idle (nothing to cancel); full red
           when running (state not modelled in this static prototype). -->
      <button class="flex size-8 items-center justify-center rounded-lg bg-[#b33a3a] text-white opacity-30 transition-opacity hover:opacity-60">
        <X class="size-4" :stroke-width="2" />
      </button>

      <!-- Jobs count -->
      <div class="flex h-8 min-w-[57px] items-center justify-center rounded-lg bg-secondary-background px-2 text-base-foreground">
        0 jobs
      </div>

      <!-- Panel toggle (inside the frame, per Figma) -->
      <button class="flex size-8 items-center justify-center rounded-lg bg-secondary-background text-muted-foreground transition-colors hover:text-base-foreground">
        <PanelRight class="size-4" :stroke-width="1.5" />
      </button>
    </div>
  </div>
</template>
