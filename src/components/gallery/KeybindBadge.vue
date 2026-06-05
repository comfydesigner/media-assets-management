<script setup lang="ts">
defineProps<{ keyLabel: string }>()
</script>

<template>
  <span
    class="flex h-5 min-w-5 items-center justify-center rounded-sm border border-border-subtle px-1 text-center text-xs leading-normal text-muted-foreground"
  >
    {{ keyLabel }}
  </span>
</template>
