<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import TagSelector from './TagSelector.vue'
import type { useGalleryFilters } from '@/composables/useGalleryFilters'

// Bulk "Add tags" launcher for the selection toolbar. Instead of a small popover
// pinned above the Tag button, this is a Linear-style COMMAND DIALOG floated near
// the top-center of the screen (cf. Linear's multi-select Actions palette) —
// combining that centered, comfortable width with our tri-state TagSelector list.
const props = defineProps<{
  filters: ReturnType<typeof useGalleryFilters>
  /** Element to horizontally center over (the gallery content area). Falls back
   *  to the viewport center when absent. */
  anchorEl?: HTMLElement | null
}>()
const emit = defineEmits<{ close: [] }>()
const f = props.filters

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const selector = ref<InstanceType<typeof TagSelector> | null>(null)

const selectedCount = computed(() => f.selectedAssets.size)

// Center the panel on the asset grid (content area), not the full viewport — so
// the fixed sidebar doesn't pull it off-center over the cards.
const centerX = ref(typeof window !== 'undefined' ? window.innerWidth / 2 : 0)
function updateCenter() {
  const el = props.anchorEl
  const r = el?.getBoundingClientRect()
  centerX.value = r ? r.left + r.width / 2 : window.innerWidth / 2
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selector.value?.move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selector.value?.move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    selector.value?.activateActive()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}
function onToggle(t: string) {
  f.toggleTagForSelection(t)
}
function onCreate(n: string) {
  f.createTagForSelection(n)
  query.value = ''
}

// Esc closes even if focus has left the input.
function onWindowKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}
onMounted(() => {
  inputRef.value?.focus()
  updateCenter()
  window.addEventListener('keydown', onWindowKey)
  window.addEventListener('resize', updateCenter)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKey)
  window.removeEventListener('resize', updateCenter)
})
</script>

<template>
  <Teleport to="body">
    <!-- Click-catching overlay (no scrim — the grid stays visible behind, like
         Linear's command palette). Clicking outside the panel closes. -->
    <div class="fixed inset-0 z-50" @pointerdown.self="emit('close')">
      <!-- Anchored near the BOTTOM (just above the selection toolbar) so it opens
           close to the launching Tag button — short mouse travel. Grows upward.
           Horizontally centered on the asset grid (centerX), same as the toolbar. -->
      <div
        class="absolute bottom-24 flex h-fit w-[482px] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border-default bg-base-background shadow-[0px_8px_32px_rgba(0,0,0,0.5)]"
        :style="{ left: `${centerX}px` }"
      >
        <!-- Search row: magnifier + input + the selection count on the right
             (cf. Linear's "N issues"). px-4 aligns the magnifier with the list
             row icons (px-2 body + px-2 row = 16px) — the app menu standard. -->
        <div class="flex items-center gap-2 px-4 py-3">
          <Search class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="Search or create a new tag.."
            class="min-w-0 flex-1 bg-transparent text-sm leading-normal text-base-foreground placeholder:text-muted-foreground focus:outline-none"
            @keydown="onKeydown"
          />
          <span class="shrink-0 whitespace-nowrap text-sm leading-normal text-muted-foreground">
            {{ selectedCount }} {{ selectedCount === 1 ? 'asset' : 'assets' }} selected
          </span>
        </div>
        <div class="h-px w-full bg-border-subtle" />
        <TagSelector
          ref="selector"
          bare
          :query="query"
          :tags="f.tags"
          :counts="f.tagCounts"
          :state="f.tagSelectionState"
          @toggle="onToggle"
          @create="onCreate"
        />
      </div>
    </div>
  </Teleport>
</template>
