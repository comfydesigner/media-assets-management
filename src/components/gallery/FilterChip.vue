<script setup lang="ts">
import { X, type LucideIcon } from 'lucide-vue-next'
defineProps<{ label: string; icon?: LucideIcon }>()
defineEmits<{ remove: [] }>()
</script>

<template>
  <div
    class="flex h-6 items-center gap-1 rounded-full border border-border-default px-2 py-1"
  >
    <component
      :is="icon"
      v-if="icon"
      class="size-3.5 shrink-0 text-muted-foreground"
      :stroke-width="1.5"
    />
    <span class="text-sm leading-5 text-base-foreground">{{ label }}</span>
    <button
      type="button"
      class="flex size-4 items-center justify-center text-muted-foreground hover:text-base-foreground"
      :aria-label="`Remove ${label}`"
      @click="$emit('remove')"
    >
      <X class="size-3" :stroke-width="1.5" />
    </button>
  </div>
</template>
