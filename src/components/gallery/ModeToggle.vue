<script setup lang="ts">
import { Images, LayoutGrid } from 'lucide-vue-next'

defineProps<{ mode: 'manage' | 'browse' }>()
defineEmits<{ 'update:mode': [value: 'manage' | 'browse'] }>()

const SEGMENTS = [
  { value: 'manage', label: 'Manage', icon: LayoutGrid },
  { value: 'browse', label: 'Browse', icon: Images },
] as const
</script>

<template>
  <div class="flex h-10 items-center gap-0.5 rounded-lg border border-border-default p-0.5">
    <button
      v-for="seg in SEGMENTS"
      :key="seg.value"
      type="button"
      class="flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm leading-normal transition-colors"
      :class="
        mode === seg.value
          ? 'bg-secondary-background text-base-foreground'
          : 'text-muted-foreground hover:text-base-foreground'
      "
      :aria-pressed="mode === seg.value"
      @click="$emit('update:mode', seg.value)"
    >
      <component :is="seg.icon" class="size-4" :stroke-width="1.5" />
      {{ seg.label }}
    </button>
  </div>
</template>
