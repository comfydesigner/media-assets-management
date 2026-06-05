<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import IconTooltip from '@/components/ui/IconTooltip.vue'

const STORAGE_KEY = 'media-assets-theme'
const isDark = ref(true)

function apply(dark: boolean) {
  isDark.value = dark
  document.documentElement.classList.toggle('dark-theme', dark)
  localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
}

function toggle() {
  apply(!isDark.value)
}

onMounted(() => {
  const stored = localStorage.getItem(STORAGE_KEY)
  // Default to dark (matches the class pre-set on <html>) unless a light
  // preference was stored.
  apply(stored ? stored === 'dark' : true)
})
</script>

<template>
  <IconTooltip
    :label="
      isDark
        ? 'Prototype purposes only: Switch to light mode'
        : 'Prototype purposes only: Switch to dark mode'
    "
    side="bottom"
  >
    <button
      type="button"
      class="flex size-7 items-center justify-center rounded-md text-base-foreground transition-colors hover:bg-button-hovered focus:outline-none"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="toggle"
    >
      <Sun v-if="isDark" class="size-4" :stroke-width="1.5" />
      <Moon v-else class="size-4" :stroke-width="1.5" />
    </button>
  </IconTooltip>
</template>
