<script setup lang="ts">
// shadcn-vue Tooltip (new-york). Wraps reka-ui's TooltipTrigger. Use `as-child`
// to make an existing element (e.g. a styled <button>) the trigger.
import { TooltipTrigger, type TooltipTriggerProps } from 'reka-ui'

const props = defineProps<TooltipTriggerProps>()
</script>

<template>
  <TooltipTrigger v-bind="props">
    <slot />
  </TooltipTrigger>
</template>
