<script setup lang="ts">
import {
  SliderRoot,
  SliderTrack,
  SliderRange,
  SliderThumb,
} from 'reka-ui'
import { computed } from 'vue'
import { SIZE_BREAKPOINTS } from './types'
import IconTooltip from '@/components/ui/IconTooltip.vue'

const props = defineProps<{ modelValue: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

// reka-ui SliderRoot expects a number[]; we wrap our single number.
const value = computed({
  get: () => [props.modelValue],
  set: (next) => emit('update:modelValue', next[0]!),
})

const STEPS = SIZE_BREAKPOINTS.length // 5
</script>

<template>
  <!--
    Container gets the same hover bg as the neighboring SortMenu / ViewMenu /
    Import buttons so the row reads as a coherent set of controls.
  -->
  <IconTooltip label="Card size" side="bottom">
  <div
    data-marquee-skip
    class="group flex h-10 w-32 items-center justify-center overflow-clip rounded-lg px-4 py-2 transition-colors hover:bg-secondary-background"
  >
    <SliderRoot
      v-model="value"
      :min="1"
      :max="STEPS"
      :step="1"
      class="relative flex h-full w-full touch-none select-none items-center"
      aria-label="Gallery card size"
    >
      <SliderTrack
        class="relative h-0.5 w-full grow rounded-lg bg-node-border"
      >
        <!-- Filled tail (min → thumb) — muted so the slider stays low-emphasis
             among the header controls (was base-foreground / bright white);
             brightens together with the thumb on hover. -->
        <SliderRange class="absolute h-full rounded-lg bg-muted-foreground transition-colors group-hover:bg-base-foreground" />
      </SliderTrack>
      <SliderThumb
        class="block size-3.5 rounded-full bg-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.4)] outline-none transition group-hover:scale-110 group-hover:bg-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground/40 active:scale-110"
      />
    </SliderRoot>
  </div>
  </IconTooltip>
</template>
