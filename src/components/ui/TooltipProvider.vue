<script setup lang="ts">
// shadcn-vue Tooltip (new-york). Wraps reka-ui's TooltipProvider. The default
// open delay is dropped to 200ms (was 700) per design.
import { TooltipProvider, type TooltipProviderProps } from 'reka-ui'

const props = withDefaults(defineProps<TooltipProviderProps>(), {
  delayDuration: 200,
})
</script>

<template>
  <TooltipProvider v-bind="props">
    <slot />
  </TooltipProvider>
</template>
