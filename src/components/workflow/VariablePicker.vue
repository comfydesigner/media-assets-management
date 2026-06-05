<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Braces } from 'lucide-vue-next'

/**
 * Variable-insertion picker for the Save Image node's `filename_prefix`
 * (Figma 2281-55278). Mirrors the TagSelector contract: the PARENT owns the
 * input + the `@`-trigger query, this renders the grouped list with **sticky
 * section subheaders** and exposes `move`/`activateActive` for keyboard nav.
 */
export type VariableItem = { label: string; token: string; sample: string }
export type VariableGroup = { label: string; items: VariableItem[] }

const props = defineProps<{
  groups: VariableGroup[]
  /** Active `@`-query (text after the last `@`); '' = show everything. */
  query: string
}>()
const emit = defineEmits<{ select: [token: string] }>()

const q = computed(() => props.query.trim().toLowerCase())
// Hide groups with no surviving items so a sticky header never floats over an
// empty section.
const filteredGroups = computed(() =>
  props.groups
    .map((g) => ({
      label: g.label,
      items: q.value ? g.items.filter((it) => it.label.toLowerCase().includes(q.value)) : g.items,
    }))
    .filter((g) => g.items.length),
)

// Flat list (across groups) for arrow-key navigation.
const rows = computed<VariableItem[]>(() => filteredGroups.value.flatMap((g) => g.items))
const active = ref(0)
watch(
  () => props.query,
  () => (active.value = 0),
)
watch(rows, () => {
  if (active.value > rows.value.length - 1) active.value = Math.max(0, rows.value.length - 1)
})

const scrollRef = ref<HTMLElement | null>(null)
function move(delta: number) {
  const n = rows.value.length
  if (n) active.value = (active.value + delta + n) % n
}
// Keep the active row scrolled into view (the list is taller than the viewport;
// arrowing past the fold otherwise hides the highlight).
watch(active, (i) => {
  nextTick(() => scrollRef.value?.querySelectorAll('button')[i]?.scrollIntoView({ block: 'nearest' }))
})
function activateActive() {
  const it = rows.value[active.value]
  if (it) emit('select', it.token)
}
defineExpose({ move, activateActive, hasRows: () => rows.value.length > 0 })

const isActive = (it: VariableItem) => rows.value[active.value]?.token === it.token
// A sample with whitespace is a DESCRIPTION ("Output image width", "Ex: 170852")
// → italic + muted; a single-token value ("Project_Comfy", "20260601") is plain.
const isExample = (sample: string) => /\s/.test(sample)
// `NodeClass.property` labels can get long (esp. renamed nodes). Split on the dot
// so the CLASS prefix truncates with an ellipsis while the `.property` suffix —
// the part that actually distinguishes the row — stays pinned and whole.
function labelParts(label: string) {
  const dot = label.indexOf('.')
  return dot < 0 ? { head: label, tail: '' } : { head: label.slice(0, dot), tail: label.slice(dot) }
}
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border border-border-default bg-base-background shadow-[var(--shadow-floating-dark)]"
  >
    <!-- @wheel.stop so scrolling the list doesn't bubble to the canvas (= zoom).
         NO top padding: a `py-1` top strip sits ABOVE the sticky `top-0` header and
         lets the scrolling row peek through it; the first header's `pt-2` gives the
         top breathing room instead. -->
    <!-- px-2 (+ row px-2 = 16px icon inset) so the option rows are rounded and
         inset from the menu edges, not edge-to-edge — the standard dropdown look. -->
    <div
      ref="scrollRef"
      class="overflow-y-auto px-2"
      :class="rows.length ? 'max-h-72 pb-1' : 'max-h-72'"
      @wheel.stop
    >
      <template v-for="(g, gi) in filteredGroups" :key="g.label">
        <!-- Sticky section subheader (Figma 2281-55278): sticks to the top of the
             scroll viewport so the current group stays labelled while scrolling.
             Non-first groups get extra top margin → more whitespace above each
             header (the margin scrolls away when the header pins, so the pinned
             label stays tight to the top). -->
        <!-- `text-xs` (12px) matches the asset-details section labels. More
             top/bottom padding (pt-2.5/pb-2) so the PINNED header isn't cramped;
             `mt-2.5` (was mt-3) compensates the +2px pt so the between-section
             whitespace (mt + pt) is unchanged. -->
        <div
          class="sticky top-0 z-10 bg-base-background px-2 pb-2 pt-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          :class="gi > 0 ? 'mt-2.5' : ''"
        >
          {{ g.label }}
        </div>
        <button
          v-for="it in g.items"
          :key="it.token"
          type="button"
          class="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
          :class="isActive(it) ? 'bg-secondary-background' : ''"
          @mousedown.prevent
          @mousemove="active = rows.findIndex((r) => r.token === it.token)"
          @click="emit('select', it.token)"
        >
          <Braces class="size-3.5 shrink-0 text-muted-foreground" :stroke-width="1.5" />
          <!-- Class prefix truncates; the `.property` suffix stays pinned + whole. -->
          <span
            class="flex min-w-0 flex-1 items-center text-sm leading-normal text-base-foreground"
            :title="it.label"
          >
            <span class="min-w-0 truncate">{{ labelParts(it.label).head }}</span>
            <span class="shrink-0 whitespace-pre">{{ labelParts(it.label).tail }}</span>
          </span>
          <span
            class="shrink-0 text-sm leading-normal text-muted-foreground"
            :class="isExample(it.sample) ? 'italic' : ''"
          >
            {{ it.sample }}
          </span>
        </button>
      </template>

      <div v-if="!rows.length" class="px-3 py-2 text-sm text-muted-foreground">
        No matching variables
      </div>
    </div>
  </div>
</template>
