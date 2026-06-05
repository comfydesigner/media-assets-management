<script setup lang="ts">
import { SquareDashed } from 'lucide-vue-next'

defineProps<{ label: string }>()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-base-background">
    <SquareDashed class="size-10 text-muted-foreground" :stroke-width="1.25" />
    <p class="text-base font-medium text-base-foreground">{{ label }}</p>
    <p class="text-sm text-muted-foreground">This page is empty</p>
  </div>
</template>
