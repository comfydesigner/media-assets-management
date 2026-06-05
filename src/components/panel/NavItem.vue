<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    label: string
    icon?: Component
    count?: number | string
    selected?: boolean
    indent?: boolean
  }>(),
  { selected: false, indent: false },
)

defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button
    type="button"
    class="flex h-10 w-full items-center gap-2 overflow-hidden rounded-lg py-3 text-left hover:bg-button-hovered"
    :class="[
      selected && 'bg-tertiary-background',
      indent ? 'pl-10 pr-4' : 'px-4',
    ]"
    :aria-pressed="selected"
    @click="$emit('click', $event)"
  >
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <component
        v-if="icon"
        :is="icon"
        class="size-4 shrink-0"
        :stroke-width="1.5"
      />
      <span
        class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground"
      >
        {{ label }}
      </span>
    </div>
    <span
      v-if="count !== undefined"
      class="shrink-0 text-right text-sm leading-normal text-muted-foreground"
    >
      {{ count }}
    </span>
  </button>
</template>
