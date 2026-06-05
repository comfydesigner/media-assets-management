<script setup lang="ts">
import { Shuffle } from 'lucide-vue-next'
import IconTooltip from '@/components/ui/IconTooltip.vue'

defineEmits<{ randomize: [] }>()
</script>

<template>
  <!-- Dev affordance: inline in the tab bar, just left of the theme toggle. -->
  <IconTooltip label="Prototype purposes only: Randomize asset names" side="bottom">
    <button
      type="button"
      class="flex size-7 items-center justify-center rounded-md text-base-foreground transition-colors hover:bg-button-hovered focus:outline-none"
      aria-label="Randomize asset names"
      @click="$emit('randomize')"
    >
      <Shuffle class="size-4" :stroke-width="1.5" />
    </button>
  </IconTooltip>
</template>
