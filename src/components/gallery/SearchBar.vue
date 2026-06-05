<script setup lang="ts">
import { Check, History, Search, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { type DateRange } from 'reka-ui'
import KeybindBadge from './KeybindBadge.vue'
import RangeCalendar from '@/components/ui/RangeCalendar.vue'
import { FILTERS, filterByKey, type FilterDef } from './filters'
import type { useGalleryFilters } from '@/composables/useGalleryFilters'

const props = defineProps<{ filters: ReturnType<typeof useGalleryFilters> }>()
const f = props.filters

// Applied filter state lives in the composable (shared with the chip bar):
//   f.selectedTags  → Tag (shared with the sidebar)
//   f.appliedFilters → media / model / lora / workflow (mock value sets)
//   f.favorited     → Favorited toggle

// Seeded mock "recents" (reset on reload): plain text searches, recent tag
// filters, and recent applied filters (Type: value).
type RecentItem =
  | { type: 'text'; value: string }
  | { type: 'tag'; value: string }
  | { type: 'filter'; filterKey: string; value: string }
const RECENTS_MAX = 4
const recents = reactive<RecentItem[]>([
  { type: 'text', value: 'wan model' },
  { type: 'text', value: 'dog' },
  { type: 'tag', value: 'mountain' },
  { type: 'filter', filterKey: 'model', value: 'Qwen' },
])
function recentMatches(rec: RecentItem, q: string): boolean {
  if (rec.value.toLowerCase().includes(q)) return true
  if (rec.type === 'filter') return filterByKey(rec.filterKey).label.toLowerCase().includes(q)
  return false
}
const filterRecents: Record<string, string[]> = {
  tag: [],
  media: ['Image'],
  model: ['LTX 2.3'],
  lora: ['Film Grain'],
  workflow: ['upscale pass'],
}

function optionsFor(key: string): string[] {
  if (key === 'tag') return f.tags
  return filterByKey(key).options ?? []
}
/** Single-select-style click: commit the value as a chip (toggle in/out). */
function toggleOption(key: string, value: string) {
  if (key === 'tag') f.toggleTag(value)
  else f.toggleFilter(key, value)
  // Record newly-APPLIED values as recents (history) so applied filters surface
  // in RECENT — dedupe + cap. Toggling a value OFF doesn't record/remove it.
  if (isApplied(key, value)) {
    recordRecent(key === 'tag' ? { type: 'tag', value } : { type: 'filter', filterKey: key, value })
  }
}
function sameRecent(a: RecentItem, b: RecentItem): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'filter' && b.type === 'filter') return a.filterKey === b.filterKey && a.value === b.value
  return a.value === b.value
}
function recordRecent(item: RecentItem) {
  const i = recents.findIndex((r) => sameRecent(r, item))
  if (i >= 0) recents.splice(i, 1)
  recents.unshift(item)
  if (recents.length > RECENTS_MAX) recents.length = RECENTS_MAX
}
// Both toggle filters (Favorited, Previews) read/write a single bool ref.
function toggleApplied(def: FilterDef): boolean {
  return def.key === 'previews' ? f.previews.value : f.favorited.value
}
function activateToggle(def: FilterDef) {
  if (def.key === 'previews') f.togglePreviews()
  else f.toggleFavorited()
}
function appliedCount(def: FilterDef): number {
  if (def.kind === 'toggle') return toggleApplied(def) ? 1 : 0
  return def.key === 'tag' ? f.selectedTags.size : f.filterTypeCount(def.key)
}
// The Previews filter only appears while "Show preview assets" is on.
const visibleFilters = computed(() =>
  FILTERS.filter((d) => d.key !== 'previews' || f.viewOptions.value.showPreviews),
)
/** Whether a specific base-level filter value is currently applied (→ checkmark). */
function isApplied(key: string, value: string): boolean {
  if (key === 'tag') return f.selectedTags.has(value)
  return f.appliedFilters[key]?.has(value) ?? false
}

/* ── Panel state ─────────────────────────────────────────────────────────── */
const open = ref(false)
const query = ref(f.searchQuery.value) // top-level free text (mirrors the committed search)
const subQuery = ref('') // text within a drill-in
const drill = ref<string | null>(null) // current filter key being drilled into
const filtersVisible = ref(true)
const active = ref(0)

const inputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)

const drillDef = computed(() => (drill.value ? filterByKey(drill.value) : null))

/* ── View model (rows for render + keyboard nav) ─────────────────────────── */
type Row =
  | { t: 'header'; label: string }
  | { t: 'search'; value: string }
  | { t: 'recent'; idx: number; rec: RecentItem }
  | { t: 'filterRecent'; key: string; value: string }
  | { t: 'category'; def: FilterDef }
  | { t: 'option'; key: string; value: string }
  | { t: 'searchOption'; key: string; value: string }

const rows = computed<Row[]>(() => {
  const out: Row[] = []

  // Date drill shows the range calendar instead of a value list → no nav rows.
  if (drill.value === 'date') return out

  // Drill-in view: per-filter recents + all options (filtered by subQuery)
  if (drill.value) {
    const key = drill.value
    const q = subQuery.value.trim().toLowerCase()
    const recs = (filterRecents[key] ?? []).filter((r) => !q || r.toLowerCase().includes(q))
    if (recs.length) {
      out.push({ t: 'header', label: 'Recent' })
      recs.forEach((value) => out.push({ t: 'filterRecent', key, value }))
    }
    const opts = optionsFor(key).filter((o) => !q || o.toLowerCase().includes(q))
    out.push({ t: 'header', label: 'All options' })
    opts.forEach((value) => out.push({ t: 'option', key, value }))
    return out
  }

  const q = query.value.trim().toLowerCase()

  // Top-level free-text search. Shows, in order:
  //   1. a literal "Search for {q}" action,
  //   2. matching recent searches / applied filters,
  //   3. a Filters section = matching filter categories (by label) PLUS matching
  //      option values across filters, shown as "Type: value" pills.
  if (q) {
    out.push({ t: 'search', value: query.value.trim() })

    const recMatches = recents
      .map((rec, idx) => ({ rec, idx }))
      .filter(({ rec }) => recentMatches(rec, q))
    if (recMatches.length) {
      out.push({ t: 'header', label: 'Recent' })
      recMatches.forEach(({ rec, idx }) => out.push({ t: 'recent', idx, rec }))
    }

    const filterRows: Row[] = []
    for (const def of visibleFilters.value) {
      if (def.label.toLowerCase().includes(q)) filterRows.push({ t: 'category', def })
    }
    for (const def of visibleFilters.value) {
      if (def.kind !== 'multi') continue
      for (const value of optionsFor(def.key)) {
        if (value.toLowerCase().includes(q)) filterRows.push({ t: 'searchOption', key: def.key, value })
      }
    }
    if (filterRows.length) {
      out.push({ t: 'header', label: 'Filters' })
      out.push(...filterRows)
    }
    return out
  }

  // Default: recents + (optionally) the filter categories.
  if (recents.length) {
    out.push({ t: 'header', label: 'Recent' })
    recents.forEach((rec, idx) => out.push({ t: 'recent', idx, rec }))
  }
  if (filtersVisible.value) {
    out.push({ t: 'header', label: 'Filter by attribute' })
    visibleFilters.value
      .filter((d) => d.group === 'attribute')
      .forEach((def) => out.push({ t: 'category', def }))
    out.push({ t: 'header', label: 'Filter by metadata' })
    visibleFilters.value
      .filter((d) => d.group === 'metadata')
      .forEach((def) => out.push({ t: 'category', def }))
  }
  return out
})

// Navigable (non-header) rows, with their index back into `rows`.
const navRows = computed(() =>
  rows.value.map((r, i) => ({ r, i })).filter(({ r }) => r.t !== 'header'),
)
function navIndexOf(rowIndex: number) {
  return navRows.value.findIndex((n) => n.i === rowIndex)
}

/* ── Actions ─────────────────────────────────────────────────────────────── */
function enterDrill(key: string) {
  if (filterByKey(key).kind === 'toggle') {
    activateToggle(filterByKey(key))
    return
  }
  drill.value = key
  subQuery.value = ''
  active.value = 0
  // Entering a drill swaps the input-row's conditional chip/controls, which makes
  // Vue detach + re-insert the (unkeyed) input and drop focus — refocus so the
  // keyboard handler (bound to the input) keeps working.
  nextTick(() => inputRef.value?.focus())
}
function exitDrill() {
  drill.value = null
  subQuery.value = ''
  active.value = 0
  nextTick(() => inputRef.value?.focus())
}

/* ── Date range (tab Date filter = a range CALENDAR, not the dock's presets) ──── */
const fmtDay = (d: NonNullable<DateRange['start']>) =>
  // Build a LOCAL Date from the calendar parts (no timezone round-trip → no
  // off-by-one when the browser TZ is behind UTC).
  new Date(d.year, d.month - 1, d.day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
// `complete` fires only once both ends are picked → commit one "Date" chip.
function onDateRange(range: DateRange) {
  if (!range.start || !range.end) return
  const set = f.appliedFilters['date']
  set?.clear()
  set?.add(`${fmtDay(range.start)} – ${fmtDay(range.end)}`)
  exitDrill()
}
function applyRecent(rec: RecentItem) {
  if (rec.type === 'tag') f.toggleTag(rec.value)
  else if (rec.type === 'filter') toggleOption(rec.filterKey, rec.value)
  else {
    // Recent text search → put it in the search bar + filter (string stays shown).
    query.value = rec.value
    f.searchQuery.value = rec.value
    open.value = false
  }
}
// Free-text search behaves like a regular search field: the string stays IN the
// bar (NOT a removable chip) and is cleared via ✕. Results are committed on
// ENTER, not per-keystroke — typing only updates the local `query` (and the
// suggestions), so the grid re-queries once (factors in real-world pagination).
function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (drill.value) {
    subQuery.value = v
    return
  }
  query.value = v
  open.value = true // keep the suggestions dropdown showing while typing
  // Emptying the box drops the committed search immediately. (New text only
  // filters on Enter, but an EMPTY box must never leave an invisible committed
  // search applied — otherwise the grid stays filtered by a term you can't see.)
  if (v === '' && f.searchQuery.value) f.searchQuery.value = ''
}
function clearSearch() {
  query.value = ''
  f.searchQuery.value = ''
  nextTick(() => inputRef.value?.focus())
}
function removeRecent(idx: number) {
  recents.splice(idx, 1)
}
/** Commit the free-text query → filter the grid by name (surfaces as a removable
 *  "search" chip) + record it in recents. */
function activateSearch() {
  const v = query.value.trim()
  if (!v) return
  const i = recents.findIndex((r) => r.type === 'text' && r.value === v)
  if (i >= 0) recents.splice(i, 1)
  recents.unshift({ type: 'text', value: v })
  if (recents.length > RECENTS_MAX) recents.length = RECENTS_MAX // cap at 4
  f.searchQuery.value = v
  // Keep the string IN the search bar (no chip); just close the suggestions.
  open.value = false
}
function activateRow(r: Row) {
  if (r.t === 'search') activateSearch()
  else if (r.t === 'category') enterDrill(r.def.key)
  else if (r.t === 'recent') applyRecent(r.rec)
  else if (r.t === 'searchOption') {
    // Free-text search hit — no drill to exit; stay so more matches can be picked.
    toggleOption(r.key, r.value)
  } else if (r.t === 'option' || r.t === 'filterRecent') {
    // Picking a value inside a drill commits the chip and returns to the root menu.
    toggleOption(r.key, r.value)
    exitDrill()
  }
}

/* ── Keyboard ────────────────────────────────────────────────────────────── */
function move(delta: number) {
  const n = navRows.value.length
  if (!n) return
  active.value = (active.value + delta + n) % n
}
function onKey(e: KeyboardEvent) {
  // Keystrokes typed in the search MUST NOT reach the grid's window keydown
  // listener (else Enter would open the lightbox + arrows move the grid selection
  // while you're searching). The input owns its keys.
  e.stopPropagation()
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const hit = navRows.value[active.value]
    if (hit) activateRow(hit.r)
  } else if (e.key === 'Backspace') {
    if ((e.metaKey || e.ctrlKey) && f.anyFilterApplied.value) {
      e.preventDefault()
      f.clearAllFilters()
    } else if (drill.value && subQuery.value === '') {
      e.preventDefault()
      exitDrill()
    }
  } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !drill.value && query.value === '') {
    e.preventDefault()
    filtersVisible.value = !filtersVisible.value
  } else if (e.key === 'Escape') {
    e.preventDefault()
    if (drill.value) exitDrill()
    else close()
  }
}

/* ── Open / close ────────────────────────────────────────────────────────── */
function openPanel() {
  open.value = true
  active.value = 0
  nextTick(() => inputRef.value?.focus())
}
function close() {
  // Closes the suggestions dropdown; reverts any uncommitted typing back to the
  // committed search (results only change on Enter, so the box should reflect
  // what's actually applied when you click away). Drill state resets.
  open.value = false
  drill.value = null
  subQuery.value = ''
  query.value = f.searchQuery.value
  inputRef.value?.blur()
}
function onOutside(e: PointerEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) close()
}
// Global shortcut: Cmd/Ctrl + / focuses the search (toggles open/closed).
function onGlobalKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === '/') {
    e.preventDefault()
    if (open.value) close()
    else openPanel()
  }
}
onMounted(() => {
  window.addEventListener('pointerdown', onOutside, true)
  window.addEventListener('keydown', onGlobalKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('keydown', onGlobalKey)
})

// Reset the active row whenever the visible set changes.
watch([query, subQuery, drill, filtersVisible], () => (active.value = 0))
</script>

<template>
  <!-- h-10 reserves the input's space in the header; the box is always absolute
       so expanding/collapsing never reflows the header. -->
  <div ref="rootRef" data-marquee-skip class="relative h-10 w-[512px] min-w-0 shrink">
    <div
      class="absolute left-0 top-0 w-full overflow-hidden rounded-lg border border-border-default bg-base-background transition-shadow duration-150"
      :class="open ? 'z-50 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.6)]' : ''"
    >
      <!-- Input row -->
      <div class="flex h-10 items-center gap-2 px-4">
        <Search class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />

        <!-- Drill-in token chip -->
        <span
          v-if="drillDef"
          class="flex shrink-0 items-center gap-1 rounded-l-full rounded-r-lg bg-tertiary-background px-2.5 py-1 text-sm leading-none text-base-foreground"
        >
          <component :is="drillDef.icon" class="size-3.5" :stroke-width="1.5" />
          {{ drillDef.label }}:
        </span>

        <input
          ref="inputRef"
          :value="drill ? subQuery : query"
          type="text"
          :placeholder="
            drill === 'date'
              ? 'Select a date or range'
              : drill
                ? `Search for a ${drillDef?.label.toLowerCase()}…`
                : 'Search or filter..'
          "
          class="min-w-0 flex-1 bg-transparent text-sm leading-none text-base-foreground placeholder:text-muted-foreground focus:outline-none"
          @focus="openPanel"
          @input="onInput"
          @keydown="onKey"
        />

        <!-- Right control -->
        <template v-if="drill">
          <button
            type="button"
            class="-mr-2 flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-2 text-sm leading-none text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
            @mousedown.prevent
            @click="exitDrill"
          >
            Cancel
            <KeybindBadge key-label="Backspace" />
          </button>
        </template>
        <!-- A non-empty search shows a ✕ to clear it (overrides the Ctrl+/ hint). -->
        <button
          v-else-if="query"
          type="button"
          class="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
          aria-label="Clear search"
          @mousedown.prevent
          @click="clearSearch"
        >
          <X class="size-4" :stroke-width="1.5" />
        </button>
        <template v-else-if="open">
          <button
            type="button"
            class="-mr-2 flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2 text-sm leading-none text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
            @click="filtersVisible = !filtersVisible"
          >
            {{ filtersVisible ? 'Hide filters' : 'Show filters' }}
            <KeybindBadge key-label="/" />
          </button>
        </template>
        <template v-else>
          <KeybindBadge key-label="Ctrl" />
          <KeybindBadge key-label="/" />
        </template>
      </div>

      <!-- Dropdown body — grid-rows trick animates the height so it reads as the
           input expanding downward (rather than a separate menu appearing). -->
      <div
        class="grid transition-[grid-template-rows] duration-150 ease-out"
        :class="open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
      >
        <div
          class="min-h-0 overflow-hidden transition-opacity duration-150"
          :class="open ? 'opacity-100' : 'pointer-events-none opacity-0'"
        >
        <div class="h-px w-full bg-border-subtle" />

        <div class="max-h-[60vh] overflow-y-auto px-2 py-2">
          <!-- Date filter → range calendar (commits a single "Date" chip). -->
          <RangeCalendar v-if="drill === 'date'" @complete="onDateRange" />
          <template v-for="(row, i) in rows" :key="i">
            <div
              v-if="row.t === 'header'"
              class="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              :class="i !== 0 ? 'mt-3' : ''"
            >
              {{ row.label }}
            </div>

            <!-- Literal "Search for {query}" action -->
            <button
              v-else-if="row.t === 'search'"
              type="button"
              class="group/row flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
              :class="navIndexOf(i) === active ? 'bg-secondary-background' : ''"
              @mousedown.prevent
              @mousemove="active = navIndexOf(i)"
              @click="activateRow(row)"
            >
              <Search class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
              <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">
                Search for “{{ row.value }}”
              </span>
              <KeybindBadge v-if="navIndexOf(i) === active" key-label="Enter" class="shrink-0 group-hover/row:hidden" />
            </button>

            <!-- Top-level recent -->
            <button
              v-else-if="row.t === 'recent'"
              type="button"
              class="group/row flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
              :class="navIndexOf(i) === active ? 'bg-secondary-background' : ''"
              @mousedown.prevent
              @mousemove="active = navIndexOf(i)"
              @click="activateRow(row)"
            >
              <History class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
              <span
                v-if="row.rec.type === 'text'"
                class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground"
              >
                {{ row.rec.value }}
              </span>
              <span
                v-else
                class="rounded-full bg-tertiary-background px-2 py-0.5 text-sm leading-normal text-base-foreground"
              >
                {{ row.rec.type === 'tag' ? 'Tag' : filterByKey(row.rec.filterKey).label }}:
                <span class="font-medium">{{ row.rec.value }}</span>
              </span>
              <span class="flex-1" />
              <KeybindBadge v-if="navIndexOf(i) === active" key-label="Enter" class="shrink-0 group-hover/row:hidden" />
              <span
                class="hidden size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-base-foreground group-hover/row:flex"
                role="button"
                aria-label="Remove recent"
                @click.stop="removeRecent(row.idx)"
              >
                <X class="size-4" :stroke-width="1.5" />
              </span>
            </button>

            <!-- Filter category -->
            <button
              v-else-if="row.t === 'category'"
              type="button"
              class="group/row flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
              :class="navIndexOf(i) === active ? 'bg-secondary-background' : ''"
              @mousedown.prevent
              @mousemove="active = navIndexOf(i)"
              @click="activateRow(row)"
            >
              <component :is="row.def.icon" class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
              <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">
                {{ row.def.label }}
              </span>
              <KeybindBadge v-if="navIndexOf(i) === active" key-label="Enter" class="shrink-0 group-hover/row:hidden" />
              <span
                v-if="appliedCount(row.def) > 0 && row.def.kind === 'multi'"
                class="shrink-0 rounded-full bg-secondary-background px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground"
              >
                {{ appliedCount(row.def) }} applied
              </span>
              <Check
                v-else-if="row.def.kind === 'toggle' && toggleApplied(row.def)"
                class="size-4 shrink-0 text-base-foreground"
                :stroke-width="1.5"
              />
            </button>

            <!-- Free-text search hit: a filter option value as a "Type: value" pill -->
            <button
              v-else-if="row.t === 'searchOption'"
              type="button"
              class="group/row flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
              :class="navIndexOf(i) === active ? 'bg-secondary-background' : ''"
              @mousedown.prevent
              @mousemove="active = navIndexOf(i)"
              @click="activateRow(row)"
            >
              <component
                :is="filterByKey(row.key).icon"
                class="size-4 shrink-0 text-muted-foreground"
                :stroke-width="1.5"
              />
              <span
                class="rounded-full bg-tertiary-background px-2 py-0.5 text-sm leading-normal text-base-foreground"
              >
                {{ filterByKey(row.key).label }}:
                <span class="font-medium">{{ row.value }}</span>
              </span>
              <span class="ml-auto flex shrink-0 items-center gap-2">
                <KeybindBadge
                  v-if="navIndexOf(i) === active"
                  key-label="Enter"
                  class="group-hover/row:hidden"
                />
                <Check
                  v-if="isApplied(row.key, row.value)"
                  class="size-4 text-base-foreground"
                  :stroke-width="1.5"
                />
              </span>
            </button>

            <!-- Drill option / filter recent -->
            <button
              v-else
              type="button"
              class="group/row flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
              :class="navIndexOf(i) === active ? 'bg-secondary-background' : ''"
              @mousedown.prevent
              @mousemove="active = navIndexOf(i)"
              @click="activateRow(row)"
            >
              <History
                v-if="row.t === 'filterRecent'"
                class="size-4 shrink-0 text-muted-foreground"
                :stroke-width="1.5"
              />
              <component
                v-else
                :is="filterByKey(row.key).icon"
                class="size-4 shrink-0 text-muted-foreground"
                :stroke-width="1.5"
              />
              <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">
                {{ row.value }}
              </span>
              <KeybindBadge v-if="navIndexOf(i) === active" key-label="Enter" class="shrink-0 group-hover/row:hidden" />
              <Check
                v-if="isApplied(row.key, row.value)"
                class="size-4 shrink-0 text-base-foreground"
                :stroke-width="1.5"
              />
            </button>
          </template>

          <div
            v-if="navRows.length === 0 && drill !== 'date'"
            class="px-2 py-2 text-sm text-muted-foreground"
          >
            No matches
          </div>
        </div>

        <!-- Footer (root only) -->
        <template v-if="!drill">
          <div class="h-px w-full bg-border-subtle" />
          <div class="flex items-center justify-between px-2 py-1">
            <!-- Left-sitting: keybind first, then label. -->
            <button
              v-if="f.anyFilterApplied.value"
              type="button"
              class="flex h-8 items-center gap-1.5 rounded-sm px-2 text-sm leading-none text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
              @mousedown.prevent
              @click="f.clearAllFilters"
            >
              <KeybindBadge key-label="Ctrl" />
              <KeybindBadge key-label="Backspace" />
              Clear filters
            </button>
            <span v-else />
            <!-- Right-sitting: label, then keybind. -->
            <button
              type="button"
              class="flex h-8 items-center gap-1.5 rounded-sm px-2 text-sm leading-none text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
              @mousedown.prevent
              @click="filtersVisible = !filtersVisible"
            >
              {{ filtersVisible ? 'Hide filters' : 'Show filters' }}
              <KeybindBadge key-label="/" />
            </button>
          </div>
        </template>
        </div>
      </div>
    </div>
  </div>
</template>
