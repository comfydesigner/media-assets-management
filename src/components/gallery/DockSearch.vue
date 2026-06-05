<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { History, Search, X } from 'lucide-vue-next'
import KeybindBadge from './KeybindBadge.vue'

// The docked search is intentionally simpler than the gallery's command palette:
// filters are split out to the separate Filter button, so this only surfaces the
// search query + recents (Figma 1778-19592 / 2244-50408). Committing a search
// filters the grid by name (the v-model'd value); recents are mock (seeded).
const emit = defineEmits<{ filter: [] }>()

// The COMMITTED query — filters the dock grid. `query` below is the live input text.
const search = defineModel<string>({ default: '' })

const RECENTS_MAX = 4
const recents = reactive<string[]>(['doggie', 'thomas', 'Mario', 'Sonic'])

const query = ref(search.value)
// Mirror of the last COMMITTED query, updated synchronously in commit()/clear().
// onBlur reverts uncommitted typing to THIS (not to the `search` defineModel,
// whose value can lag a synchronous read right after a write → the committed
// string would vanish from the bar on the blur that commit() itself triggers).
const committed = ref(search.value)
const open = ref(false)
const active = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)

const q = computed(() => query.value.trim())
const matches = computed(() =>
  q.value
    ? recents.filter((r) => r.toLowerCase().includes(q.value.toLowerCase()))
    : [...recents],
)

// When typing, a "commit the query" row leads; then any matching recents.
type Row = { kind: 'query' | 'recent'; text: string }
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  if (q.value) out.push({ kind: 'query', text: q.value })
  matches.value.forEach((text) => out.push({ kind: 'recent', text }))
  return out
})

watch(query, () => (active.value = 0))
watch(rows, () => {
  if (active.value > rows.value.length - 1) active.value = Math.max(0, rows.value.length - 1)
})

function recordRecent(text: string) {
  const i = recents.findIndex((r) => r.toLowerCase() === text.toLowerCase())
  if (i >= 0) recents.splice(i, 1)
  recents.unshift(text) // most-recent first
  if (recents.length > RECENTS_MAX) recents.length = RECENTS_MAX // cap at 4
}
function removeRecent(text: string) {
  const i = recents.findIndex((r) => r === text)
  if (i >= 0) recents.splice(i, 1)
}
// Commit applies the query as the active grid filter (and keeps it in the input).
function commit(text: string) {
  const t = text.trim()
  if (!t) return
  recordRecent(t)
  committed.value = t
  query.value = t
  search.value = t
  open.value = false
  inputRef.value?.blur()
}
function clear() {
  committed.value = ''
  query.value = ''
  search.value = ''
  open.value = false
  inputRef.value?.focus()
}
function onBlur() {
  open.value = false
  query.value = committed.value // discard any uncommitted edit
}
// External reset (e.g. the empty-state "reset to default") clears the input too.
watch(search, (v) => {
  if (!v) {
    committed.value = ''
    query.value = ''
  }
})

function onKeydown(e: KeyboardEvent) {
  // Keystrokes typed in the dock search MUST NOT reach the dock grid's window
  // keydown listener. commit() blurs the input (focus → <body>), so without this
  // the grid's "activeElement is an INPUT?" guard would miss and Enter would open
  // the lightbox while you're just searching.
  e.stopPropagation()
  if (e.key === 'Escape') {
    open.value = false
    inputRef.value?.blur()
    return
  }
  const n = rows.value.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (n) active.value = (active.value + 1) % n
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (n) active.value = (active.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const r = rows.value[active.value]
    if (r) commit(r.text)
  } else if (e.key === 'Tab' && !e.shiftKey && open.value) {
    // Tab → open the filters menu (the "Tab Filter" footer hint). Overrides the
    // default focus-move while the search dropdown is open.
    e.preventDefault()
    open.value = false
    inputRef.value?.blur()
    emit('filter')
  }
}

// Ctrl/⌘ + / focuses the search (the keybind badge).
function onGlobalKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault()
    inputRef.value?.focus()
  }
}
function onOutside(e: PointerEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = false
}
onMounted(() => {
  window.addEventListener('keydown', onGlobalKey)
  window.addEventListener('pointerdown', onOutside, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey)
  window.removeEventListener('pointerdown', onOutside, true)
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <!-- Filled input (matches the dock chrome). azure-600 focus ring (Figma
         1591-61270) via focus-within, so it shows whenever the input has focus. -->
    <div
      class="flex h-8 items-center gap-2 rounded-lg bg-secondary-background px-3 focus-within:ring-2 focus-within:ring-azure-600"
    >
      <Search class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        placeholder="Search.."
        class="min-w-0 flex-1 bg-transparent text-sm leading-normal text-base-foreground placeholder:text-muted-foreground focus:outline-none"
        @focus="open = true"
        @keydown="onKeydown"
        @blur="onBlur"
      />
      <button
        v-if="query"
        type="button"
        class="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-base-foreground"
        aria-label="Clear search"
        @mousedown.prevent
        @click="clear"
      >
        <X class="size-3.5" :stroke-width="2" />
      </button>
      <template v-else>
        <KeybindBadge key-label="Ctrl" />
        <KeybindBadge key-label="/" />
      </template>
    </div>

    <!-- Dropdown: recents (+ a commit-query row when typing) + a Tab→Filter hint -->
    <div
      v-if="open"
      class="absolute left-0 right-0 top-full z-50 mt-1 flex flex-col gap-1 overflow-hidden rounded-lg border border-border-default bg-base-background p-1 shadow-[var(--shadow-floating-dark)]"
    >
      <button
        v-for="(row, i) in rows"
        :key="row.kind + i"
        type="button"
        class="group/row flex h-8 w-full shrink-0 items-center gap-2 rounded-sm px-2 text-left transition-colors"
        :class="i === active ? 'bg-secondary-background' : ''"
        @mousedown.prevent
        @mousemove="active = i"
        @click="commit(row.text)"
      >
        <Search
          v-if="row.kind === 'query'"
          class="size-4 shrink-0 text-muted-foreground"
          :stroke-width="1.5"
        />
        <History v-else class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
        <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">
          {{ row.text }}
        </span>
        <!-- Active row shows [Enter]; on a recent row, hovering swaps it for a
             ✕ (clear) in the same slot. -->
        <KeybindBadge
          v-if="i === active"
          key-label="Enter"
          class="shrink-0"
          :class="row.kind === 'recent' ? 'group-hover/row:hidden' : ''"
        />
        <span
          v-if="row.kind === 'recent'"
          class="hidden size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-base-foreground group-hover/row:flex"
          role="button"
          aria-label="Remove recent"
          @click.stop="removeRecent(row.text)"
        >
          <X class="size-4" :stroke-width="1.5" />
        </span>
      </button>

      <div v-if="rows.length === 0" class="px-2 py-1.5 text-sm text-muted-foreground">
        No recent searches
      </div>

      <!-- Divider + Filter button — same treatment as the tab searchbar footer's
           "Show/hide filters [/]" button. Tab switches to the (separate) filter. -->
      <div class="-mx-1 h-px bg-border-subtle" />
      <button
        type="button"
        class="flex h-8 items-center gap-1.5 self-start rounded-sm px-2 text-sm leading-none text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
        @mousedown.prevent
        @click="$emit('filter')"
      >
        <KeybindBadge key-label="Tab" />
        Filter
      </button>
    </div>
  </div>
</template>
