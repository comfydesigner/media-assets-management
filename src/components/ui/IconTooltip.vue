<script setup lang="ts">
// Thin convenience over the shadcn-vue Tooltip primitives for the common case:
// a single icon button trigger + a text label. Needs a <TooltipProvider>
// ancestor (which also sets the open delay). Content follows the app theme.
import Tooltip from './Tooltip.vue'
import TooltipTrigger from './TooltipTrigger.vue'
import TooltipContent from './TooltipContent.vue'

withDefaults(
  defineProps<{
    label: string
    side?: 'top' | 'right' | 'bottom' | 'left'
    sideOffset?: number
  }>(),
  { side: 'top', sideOffset: 6 },
)
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipContent :side="side" :side-offset="sideOffset">{{ label }}</TooltipContent>
  </Tooltip>
</template>
