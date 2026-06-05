<script setup lang="ts">
import { computed } from 'vue'

// Contextual empty state for the dock grid (Figma 1778-20596). Left-aligned at
// the top of the grid area. Variants:
//   - search    → no results for the active query
//   - favorites → "Favorites only" filter on, but nothing favorited
//   - filtered  → other filters applied, no matches
//   - empty     → no assets at all (empty library)
// (favorites/filtered light up once the dock filter UI exists.)
const props = defineProps<{
  query?: string
  favoritesOnly?: boolean
  filtered?: boolean
}>()
defineEmits<{ reset: [] }>()

const variant = computed<'search' | 'favorites' | 'filtered' | 'empty'>(() => {
  // A live search query is the most specific reason for "no results"; then the
  // Favorited-only filter; then any other applied filter; else an empty library.
  if (props.query) return 'search'
  if (props.favoritesOnly) return 'favorites'
  if (props.filtered) return 'filtered'
  return 'empty'
})

const primary = computed(() => {
  switch (variant.value) {
    case 'search':
      return `No results found for “${props.query}”.`
    case 'favorites':
      return 'No favorites yet.'
    case 'filtered':
      return 'No results found.'
    default:
      return 'No assets yet.'
  }
})

// Whether the secondary line offers the "Widen … reset to default" recovery.
const recoverable = computed(() => variant.value === 'search' || variant.value === 'filtered')
</script>

<template>
  <!-- Horizontal padding is set by the caller so the text lines up with that
       surface's header/cards (gallery vs dock have different insets). -->
  <div class="pt-4">
    <p class="text-sm leading-normal text-base-foreground">{{ primary }}</p>

    <p v-if="recoverable" class="mt-1 text-sm leading-snug text-muted-foreground">
      Widen your search filters or
      <button
        type="button"
        class="text-base-foreground underline-offset-2 hover:underline"
        @click="$emit('reset')"
      >
        reset to default
      </button>
      and try again.
    </p>
    <p v-else-if="variant === 'favorites'" class="mt-1 text-sm leading-snug text-muted-foreground">
      Only favorited assets are shown with this filter.
    </p>
    <p v-else class="mt-1 text-sm leading-snug text-muted-foreground">
      Generated and imported assets will appear here.
    </p>
  </div>
</template>
