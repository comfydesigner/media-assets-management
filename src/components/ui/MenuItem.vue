<script setup lang="ts">
import { Check } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    /** Show check on the trailing edge (selected single-choice / toggled-on). */
    checked?: boolean
    /** Reserve space for a check icon so labels align across rows. */
    reserveTrailing?: boolean
  }>(),
  { checked: false, reserveTrailing: false },
)
</script>

<template>
  <button
    type="button"
    class="flex h-8 min-h-6 w-full shrink-0 items-center gap-2 rounded-sm p-2 text-left hover:bg-secondary-background"
    @click="$emit('select')"
  >
    <!-- Optional leading icon (e.g. the dock's List / Grid layout rows). -->
    <slot name="leading" />
    <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">
      <slot />
    </span>
    <span
      v-if="checked"
      class="flex size-4 shrink-0 items-center justify-center text-base-foreground"
    >
      <Check class="size-4" :stroke-width="1.5" />
    </span>
    <span v-else-if="reserveTrailing" class="size-4 shrink-0" aria-hidden="true" />
  </button>
</template>
