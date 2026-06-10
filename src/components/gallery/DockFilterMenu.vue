<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Check, ChevronRight, ListFilter, Search } from 'lucide-vue-next'
import Tooltip from '@/components/ui/Tooltip.vue'
import TooltipTrigger from '@/components/ui/TooltipTrigger.vue'
import TooltipContent from '@/components/ui/TooltipContent.vue'
import KeybindBadge from './KeybindBadge.vue'
import { DATE_PRESETS, FILTERS, filterByKey, type FilterDef } from './filters'
import type { useGalleryFilters } from '@/composables/useGalleryFilters'

// The dock's Filter button (Figma 1778-19586 / 1778-19593). Search is split out
// to DockSearch; this opens the filter command-palette. Linear-style CASCADING
// submenus (same flyout machinery as the right-click ContextMenu: hover-open,
// first-option aligned to the parent row, 2px overlap, collision flip, full
// keyboard nav). UNLIKE the tab SearchBar (which commits a value and returns to
// root), picking a value here just toggles it and the submenu STAYS OPEN, so you
// can assign several at once and watch the chips/checks accumulate. Right-aligned
// to the trigger so the flyout has room over the canvas. Root section padding
// mirrors the SearchBar's filter sections for visual consistency.
const props = defineProps<{ filters: ReturnType<typeof useGalleryFilters> }>()
const f = props.filters

const open = ref(false)
const btnRef = ref<HTMLElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const subRef = ref<HTMLElement | null>(null)
const rootSearchRef = ref<HTMLInputElement | null>(null)
const subSearchRef = ref<HTMLInputElement | null>(null)

const query = ref('') // root: search the categories
const openSub = ref<string | null>(null) // category key whose submenu is open
const subQuery = ref('') // submenu: search the values
const active = ref(0) // active root category (keyboard / hover)
const subActive = ref(0) // active submenu value

// Hover is IGNORED until the pointer actually moves after the menu opens. When
// the menu is opened via keyboard (the search's Tab shortcut) it can appear
// directly under a stationary cursor, which fires `mouseenter` on whatever row
// sits beneath it — that would auto-open that category's submenu and steal the
// keyboard selection. We arm hover only on the first real `pointermove`.
const hoverReady = ref(false)
function onFirstPointerMove() {
  hoverReady.value = true
  window.removeEventListener('pointermove', onFirstPointerMove, true)
}

const MENU_W = 256
const SUB_OVERLAP = 2 // px the submenu overlaps the root edge (bridges hover)
const pos = ref({ left: 0, top: 0 }) // root menu position
const subPos = ref({ left: 0, top: 0 })
const subFlipped = ref(false) // submenu opened to the LEFT (collision)

/* ── Filter data ─────────────────────────────────────────────────────────── */
function optionsFor(key: string): string[] {
  if (key === 'tag') return f.tags
  if (key === 'date') return DATE_PRESETS
  return filterByKey(key).options ?? []
}
function isApplied(key: string, value: string): boolean {
  if (key === 'tag') return f.selectedTags.has(value)
  return f.appliedFilters[key]?.has(value) ?? false
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
function toggleOption(key: string, value: string) {
  if (key === 'tag') f.toggleTag(value)
  else f.toggleFilter(key, value)
}
const hasSub = (def: FilterDef) => def.kind !== 'toggle'

const rootCats = computed(() => {
  const q = query.value.trim().toLowerCase()
  return FILTERS.filter(
    (d) =>
      (d.key !== 'previews' || f.viewOptions.value.showPreviews) &&
      (!q || d.label.toLowerCase().includes(q)),
  )
})
const attrCats = computed(() => rootCats.value.filter((d) => d.group === 'attribute'))
const metaCats = computed(() => rootCats.value.filter((d) => d.group === 'metadata'))
const rootNav = computed(() => [...attrCats.value, ...metaCats.value]) // flat keyboard order
const groups = computed(() =>
  [
    { label: 'Filter by attribute', cats: attrCats.value },
    { label: 'Filter by metadata', cats: metaCats.value },
  ].filter((g) => g.cats.length),
)
const subValues = computed(() => {
  if (!openSub.value) return []
  const q = subQuery.value.trim().toLowerCase()
  return optionsFor(openSub.value).filter((v) => !q || v.toLowerCase().includes(q))
})
const subDef = computed(() => (openSub.value ? filterByKey(openSub.value) : null))

/* ── Flat value search (mirrors the tab SearchBar) ───────────────────────────
 * When the root search has text, we ALSO match VALUES across every category and
 * surface them inline as "Type: value" rows — so you can pick "Film Grain"
 * straight from the root without first drilling into LoRA model. */
const searching = computed(() => query.value.trim().length > 0)
const valueMatches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return [] as { key: string; value: string }[]
  const out: { key: string; value: string }[] = []
  for (const def of FILTERS) {
    if (def.kind !== 'multi') continue // values only exist for multi-select filters
    for (const value of optionsFor(def.key)) {
      if (value.toLowerCase().includes(q)) out.push({ key: def.key, value })
    }
  }
  return out
})
// Unified navigable root list: searching → matching categories THEN matching
// values; idle → the grouped categories. `active` indexes into this.
type RootRow = { t: 'cat'; def: FilterDef } | { t: 'value'; key: string; value: string }
const navItems = computed<RootRow[]>(() =>
  searching.value
    ? [
        ...rootCats.value.map((def) => ({ t: 'cat' as const, def })),
        ...valueMatches.value.map((v) => ({ t: 'value' as const, key: v.key, value: v.value })),
      ]
    : rootNav.value.map((def) => ({ t: 'cat' as const, def })),
)
function navIndexOfCat(def: FilterDef) {
  return navItems.value.findIndex((it) => it.t === 'cat' && it.def.key === def.key)
}

watch(query, () => (active.value = 0))
watch(subQuery, () => (subActive.value = 0))

/* ── Submenu positioning (mirrors ContextMenu) ───────────────────────────── */
let subTriggerTop = 0
function positionSub(key: string) {
  const row = rootRef.value?.querySelector<HTMLElement>(`[data-cat="${key}"]`)
  const menuRect = rootRef.value?.getBoundingClientRect()
  if (row && menuRect) {
    const r = row.getBoundingClientRect()
    subTriggerTop = r.top
    subPos.value = { left: menuRect.right - SUB_OVERLAP, top: r.top }
  }
}
function clampSub() {
  const el = subRef.value
  const menuRect = rootRef.value?.getBoundingClientRect()
  if (!el || !menuRect) return
  const M = 8
  let left = subPos.value.left
  const flip = left + el.offsetWidth > window.innerWidth - M
  subFlipped.value = flip
  if (flip) left = menuRect.left - el.offsetWidth + SUB_OVERLAP
  // Align the first value row with the parent category row (Linear-style).
  const firstOpt = el.querySelector('button')
  let top = subTriggerTop
  if (firstOpt) top -= firstOpt.getBoundingClientRect().top - el.getBoundingClientRect().top
  top = Math.min(top, window.innerHeight - el.offsetHeight - M)
  subPos.value = { left, top: Math.max(M, top) }
}
function predictFlip() {
  const mr = rootRef.value?.getBoundingClientRect()
  if (!mr) return false
  return mr.right - SUB_OVERLAP + MENU_W > window.innerWidth - 8
}

/* ── Open / close ────────────────────────────────────────────────────────── */
function openSubFor(key: string) {
  if (!hasSub(filterByKey(key))) return
  positionSub(key)
  openSub.value = key
  subQuery.value = ''
  subActive.value = 0
  const idx = navIndexOfCat(filterByKey(key))
  if (idx >= 0) active.value = idx
  nextTick(() => {
    clampSub()
    subSearchRef.value?.focus()
  })
}
function closeSub() {
  openSub.value = null
  subQuery.value = ''
  nextTick(() => rootSearchRef.value?.focus())
}
function activateCat(def: FilterDef) {
  if (def.kind === 'toggle') activateToggle(def) // Favorited / Previews — toggle, no submenu
  else openSubFor(def.key)
}

function openMenu() {
  if (open.value) return // already open (e.g. opened again via the search's Tab)
  open.value = true
  query.value = ''
  openSub.value = null
  subQuery.value = ''
  active.value = 0
  hoverReady.value = false
  nextTick(() => {
    const b = btnRef.value?.getBoundingClientRect()
    const el = rootRef.value
    if (b && el) {
      const M = 8
      // Left edge anchored to the button; the menu (and its submenu flyout) float
      // to the RIGHT over the canvas, so the dock's chip row + grid stay visible.
      const left = Math.min(b.left, window.innerWidth - el.offsetWidth - M)
      const top = Math.min(b.bottom + 4, window.innerHeight - el.offsetHeight - M)
      pos.value = { left: Math.max(M, left), top: Math.max(M, top) }
    }
    rootSearchRef.value?.focus()
  })
  window.addEventListener('keydown', handleKey, true)
  window.addEventListener('pointerdown', onOutside, true)
  window.addEventListener('pointermove', onFirstPointerMove, true)
  window.addEventListener('resize', close)
}
function close() {
  open.value = false
  openSub.value = null
  clearSubTimer()
  window.removeEventListener('keydown', handleKey, true)
  window.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('pointermove', onFirstPointerMove, true)
  window.removeEventListener('resize', close)
}
function toggleOpen() {
  open.value ? close() : openMenu()
}
function onOutside(e: PointerEvent) {
  const t = e.target as Node
  if (btnRef.value?.contains(t) || rootRef.value?.contains(t) || subRef.value?.contains(t)) return
  close()
}
onBeforeUnmount(close)

/* ── Hover-open submenus (mirrors ContextMenu) ───────────────────────────── */
let subTimer: ReturnType<typeof setTimeout> | null = null
function clearSubTimer() {
  if (subTimer) {
    clearTimeout(subTimer)
    subTimer = null
  }
}
// Hover-OPEN only (no active-setting — the highlight follows @mousemove so a
// stale/stationary pointer never hijacks keyboard nav). Gated on `hoverReady`
// so the menu opening UNDER a stationary cursor (keyboard Tab) doesn't fire a
// synthetic mouseenter that auto-opens that row's submenu.
function onCatEnter(def: FilterDef) {
  if (!hoverReady.value) return
  clearSubTimer()
  if (hasSub(def)) {
    if (openSub.value !== def.key)
      subTimer = setTimeout(() => {
        if (openSub.value !== def.key) openSubFor(def.key)
      }, 60)
  } else if (openSub.value) {
    subTimer = setTimeout(() => {
      if (openSub.value) closeSub()
    }, 180)
  }
}

/* ── Keyboard (window-capture; owns its keys regardless of focus) ─────────── */
function handleKey(e: KeyboardEvent) {
  if (!open.value) return
  const claim = () => {
    e.preventDefault()
    e.stopPropagation()
  }
  if (e.key === 'Escape') {
    claim()
    openSub.value ? closeSub() : close()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace' && f.anyFilterApplied.value) {
    claim()
    f.clearAllFilters()
    return
  }

  if (openSub.value) {
    const vals = subValues.value
    const backKey = subFlipped.value ? 'ArrowRight' : 'ArrowLeft'
    if (e.key === 'ArrowDown') {
      claim()
      if (vals.length) subActive.value = (subActive.value + 1) % vals.length
    } else if (e.key === 'ArrowUp') {
      claim()
      if (vals.length) subActive.value = (subActive.value - 1 + vals.length) % vals.length
    } else if (e.key === 'Enter') {
      claim()
      const v = vals[subActive.value]
      if (v) toggleOption(openSub.value, v) // multi-add — stays open
    } else if (e.key === backKey) {
      claim()
      closeSub()
    } else if (e.key === 'Backspace' && subQuery.value === '') {
      claim()
      closeSub()
    }
    return
  }

  const items = navItems.value
  const openKey = predictFlip() ? 'ArrowLeft' : 'ArrowRight'
  if (e.key === 'ArrowDown') {
    claim()
    if (items.length) active.value = (active.value + 1) % items.length
  } else if (e.key === 'ArrowUp') {
    claim()
    if (items.length) active.value = (active.value - 1 + items.length) % items.length
  } else if (e.key === 'Enter') {
    claim()
    const it = items[active.value]
    if (!it) return
    if (it.t === 'cat') activateCat(it.def)
    else toggleOption(it.key, it.value) // flat value hit — toggle in place, stay open
  } else if (e.key === openKey) {
    const it = items[active.value]
    if (it && it.t === 'cat' && hasSub(it.def)) {
      claim()
      openSubFor(it.def.key)
    }
  }
}

// Let the parent open the menu (DockSearch's Tab shortcut routes through here).
defineExpose({ openMenu })

const triggerClass =
  'relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary-background text-muted-foreground transition-colors hover:bg-button-hovered hover:text-base-foreground focus:outline-none'
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <button ref="btnRef" type="button" :class="triggerClass" aria-label="Filters" @click="toggleOpen">
        <ListFilter class="size-4" :stroke-width="1.5" />
        <!-- Active-filters dot — base-foreground token (white in dark / black in light). -->
        <span
          v-if="f.anyFilterApplied.value"
          class="absolute right-1 top-1 size-2 rounded-full bg-base-foreground ring-2 ring-secondary-background"
        />
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom">Filters</TooltipContent>
  </Tooltip>

  <Teleport to="body">
    <div v-if="open">
      <!-- Root menu (sections padded to match the tab SearchBar) -->
      <div
        ref="rootRef"
        class="fixed z-50 flex w-64 flex-col overflow-hidden rounded-lg border border-border-default bg-base-background shadow-[var(--shadow-floating-dark)]"
        :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
      >
        <div class="flex h-10 items-center gap-2 px-4">
          <Search class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
          <input
            ref="rootSearchRef"
            v-model="query"
            type="text"
            placeholder="Filter by.."
            class="min-w-0 flex-1 bg-transparent text-sm leading-normal text-base-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div class="h-px w-full bg-border-subtle" />

        <div class="max-h-[60vh] overflow-y-auto px-2 py-2">
          <!-- IDLE: grouped categories with drill-in submenus. -->
          <template v-if="!searching">
            <template v-for="(group, gi) in groups" :key="group.label">
              <div
                class="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                :class="gi !== 0 ? 'mt-3' : ''"
              >
                {{ group.label }}
              </div>
              <button
                v-for="def in group.cats"
                :key="def.key"
                type="button"
                :data-cat="def.key"
                class="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
                :class="navIndexOfCat(def) === active ? 'bg-secondary-background' : ''"
                @mouseenter="onCatEnter(def)"
                @mousemove="hoverReady && (active = navIndexOfCat(def))"
                @click="activateCat(def)"
              >
                <component :is="def.icon" class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
                <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">
                  {{ def.label }}
                </span>
                <span
                  v-if="def.kind !== 'toggle' && appliedCount(def) > 0"
                  class="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-tertiary-background px-1 text-xs tabular-nums text-muted-foreground"
                >
                  {{ appliedCount(def) }}
                </span>
                <Check
                  v-if="def.kind === 'toggle' && toggleApplied(def)"
                  class="size-4 shrink-0 text-base-foreground"
                  :stroke-width="1.5"
                />
                <ChevronRight
                  v-else-if="def.kind !== 'toggle'"
                  class="size-4 shrink-0 text-muted-foreground"
                  :stroke-width="1.5"
                />
              </button>
            </template>
          </template>

          <!-- SEARCHING: flat results — matching categories (still drill) PLUS
               matching values as "Type: value" rows that toggle in place. -->
          <template v-else>
            <template v-for="(it, idx) in navItems" :key="it.t === 'cat' ? `c:${it.def.key}` : `v:${it.key}:${it.value}`">
              <!-- category label match → opens its submenu -->
              <button
                v-if="it.t === 'cat'"
                type="button"
                :data-cat="it.def.key"
                class="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
                :class="idx === active ? 'bg-secondary-background' : ''"
                @mouseenter="onCatEnter(it.def)"
                @mousemove="hoverReady && (active = idx)"
                @click="activateCat(it.def)"
              >
                <component :is="it.def.icon" class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
                <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">
                  {{ it.def.label }}
                </span>
                <span
                  v-if="it.def.kind !== 'toggle' && appliedCount(it.def) > 0"
                  class="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-tertiary-background px-1 text-xs tabular-nums text-muted-foreground"
                >
                  {{ appliedCount(it.def) }}
                </span>
                <ChevronRight
                  v-else-if="it.def.kind !== 'toggle'"
                  class="size-4 shrink-0 text-muted-foreground"
                  :stroke-width="1.5"
                />
              </button>
              <!-- value match → toggle directly, no drill needed. Single truncating
                   line (no pill): the dock menu is narrow, so a wrapping "Type: value"
                   pill would break onto two lines — muted category prefix + emphasized
                   value, ellipsized if long (full text in the row title). -->
              <button
                v-else
                type="button"
                :title="`${filterByKey(it.key).label}: ${it.value}`"
                class="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
                :class="idx === active ? 'bg-secondary-background' : ''"
                @mousemove="hoverReady && (active = idx)"
                @click="toggleOption(it.key, it.value)"
              >
                <component
                  :is="filterByKey(it.key).icon"
                  class="size-4 shrink-0 text-muted-foreground"
                  :stroke-width="1.5"
                />
                <span class="min-w-0 flex-1 truncate text-sm leading-normal">
                  <span class="text-muted-foreground">{{ filterByKey(it.key).label }}:&nbsp;</span>
                  <span class="font-medium text-base-foreground">{{ it.value }}</span>
                </span>
                <Check
                  v-if="isApplied(it.key, it.value)"
                  class="size-4 shrink-0 text-base-foreground"
                  :stroke-width="1.5"
                />
              </button>
            </template>
            <div v-if="navItems.length === 0" class="px-2 py-1.5 text-sm text-muted-foreground">
              No matches
            </div>
          </template>
        </div>

        <!-- Clear filters (matches the SearchBar footer treatment). -->
        <template v-if="f.anyFilterApplied.value">
          <div class="h-px w-full bg-border-subtle" />
          <button
            type="button"
            class="flex h-10 items-center gap-1.5 self-start px-4 text-sm leading-none text-muted-foreground transition-colors hover:text-base-foreground"
            @click="f.clearAllFilters"
          >
            <KeybindBadge key-label="Ctrl" />
            <KeybindBadge key-label="Backspace" />
            Clear filters
          </button>
        </template>
      </div>

      <!-- Submenu flyout (value list; multi-add → stays open) -->
      <div
        v-if="openSub"
        ref="subRef"
        class="fixed z-50 flex w-64 flex-col overflow-hidden rounded-lg border border-border-default bg-base-background shadow-[var(--shadow-floating-dark)]"
        :style="{ left: `${subPos.left}px`, top: `${subPos.top}px` }"
        @mouseenter="clearSubTimer()"
      >
        <div class="flex h-10 items-center gap-2 px-4">
          <component :is="subDef?.icon" class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
          <input
            ref="subSearchRef"
            v-model="subQuery"
            type="text"
            :placeholder="`Select ${subDef?.label.toLowerCase()}..`"
            class="min-w-0 flex-1 bg-transparent text-sm leading-normal text-base-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div class="h-px w-full bg-border-subtle" />

        <div class="max-h-[60vh] overflow-y-auto px-2 py-2">
          <button
            v-for="(value, i) in subValues"
            :key="value"
            type="button"
            class="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
            :class="i === subActive ? 'bg-secondary-background' : ''"
            @mousemove="subActive = i"
            @click="toggleOption(openSub!, value)"
          >
            <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">{{ value }}</span>
            <Check
              v-if="isApplied(openSub!, value)"
              class="size-4 shrink-0 text-base-foreground"
              :stroke-width="1.5"
            />
          </button>

          <div v-if="subValues.length === 0" class="px-2 py-1.5 text-sm text-muted-foreground">
            No matching values
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
