<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import type { Component } from 'vue'

const props = withDefaults(
  defineProps<{
    label?: string
    icon?: Component
    selected?: boolean
    closable?: boolean
    leftBorder?: boolean
  }>(),
  { selected: false, closable: false, leftBorder: true },
)

defineEmits<{ select: []; close: [] }>()

const bg = computed(() =>
  props.selected
    ? 'bg-secondary-background'
    : 'bg-workflow-tab-background hover:bg-button-hovered',
)
const textColor = computed(() =>
  props.selected ? 'text-base-foreground' : 'text-muted-foreground',
)
</script>

<template>
  <div
    class="flex h-9 shrink-0 cursor-pointer items-center gap-2 px-4 py-2 transition-colors"
    :class="[bg, leftBorder && 'border-l border-workflow-tab-border']"
    @click="$emit('select')"
  >
    <component v-if="icon" :is="icon" class="size-4 shrink-0" :class="textColor" :stroke-width="1.5" />
    <span
      v-if="label"
      class="whitespace-nowrap text-sm leading-normal"
      :class="textColor"
    >
      {{ label }}
    </span>
    <button
      v-if="closable"
      class="size-4 shrink-0 text-muted-foreground hover:text-base-foreground"
      type="button"
      aria-label="Close tab"
      @click.stop="$emit('close')"
    >
      <X class="size-4" :stroke-width="1.5" />
    </button>
    <span v-else-if="label" class="size-4 shrink-0" />
  </div>
</template>
