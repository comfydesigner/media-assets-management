<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next'

defineProps<{ label: string }>()
defineEmits<{ back: [] }>()
</script>

<template>
  <!--
    Floating, labeled "exit Media Assets" affordance. Bottom-RIGHT of the gallery
    (the shuffle/theme buttons moved up to the tab bar, freeing this corner; the
    selection toolbar sits bottom-center). Names the destination so it's clear
    where "back" goes.
  -->
  <button
    type="button"
    class="fixed bottom-6 right-4 z-40 flex h-10 items-center gap-1.5 rounded-lg border border-border-default bg-secondary-background py-2 pl-3 pr-4 text-sm text-base-foreground shadow-[var(--shadow-floating-dark)] transition-colors hover:bg-button-hovered focus:outline-none"
    @click="$emit('back')"
  >
    <ChevronLeft class="size-4 shrink-0" :stroke-width="1.5" />
    <span class="whitespace-nowrap">Back to {{ label }}</span>
  </button>
</template>
