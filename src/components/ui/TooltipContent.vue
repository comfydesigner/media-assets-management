<script setup lang="ts">
// shadcn-vue Tooltip (new-york). Wraps reka-ui's TooltipContent (portaled).
// Uses the design's semantic color tokens (base background/foreground + default
// border, per Figma 269:1315). NOTE: the content portals to <body>, outside any
// dark-theme subtree, so it resolves whatever theme is on <html>. Callers that
// sit over the always-dark lightbox pass `class="dark-theme"` to pin it dark.
import { computed, type HTMLAttributes } from 'vue'
import {
  TooltipContent,
  TooltipPortal,
  useForwardPropsEmits,
  type TooltipContentEmits,
  type TooltipContentProps,
} from 'reka-ui'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<TooltipContentProps & { class?: HTMLAttributes['class'] }>(),
  { sideOffset: 6 },
)
const emits = defineEmits<TooltipContentEmits>()

const delegated = computed(() => {
  const { class: _, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      v-bind="forwarded"
      :class="
        cn(
          'z-[70] max-w-xs select-none rounded-lg border border-border-default bg-base-background px-2.5 py-1.5 text-xs leading-none text-base-foreground shadow-[var(--shadow-floating-dark)]',
          props.class,
        )
      "
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
