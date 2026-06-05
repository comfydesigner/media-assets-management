<script setup lang="ts">
import {
  Check,
  CircleAlert,
  ChevronRight,
  Download,
  FileOutput,
  Info,
  Plus,
  Star,
  Tag,
  Trash2,
  Waypoints,
  Workflow,
  ZoomIn,
  type LucideIcon,
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MAX_TAG_LENGTH } from './types'
import KeybindBadge from './KeybindBadge.vue'
import { useTabs } from '@/composables/useTabs'
import type { useGalleryFilters } from '@/composables/useGalleryFilters'

const props = withDefaults(
  defineProps<{
    x: number
    y: number
    multiple: boolean
    /** Gallery state — the tag submenu reads/writes the REAL selection tags. */
    filters: ReturnType<typeof useGalleryFilters>
    variant?: 'context' | 'more'
    /** Details panel/popover currently open → the "Show details" row toggles to
     *  "Hide details". */
    detailsOpen?: boolean
  }>(),
  { variant: 'context', detailsOpen: false },
)
const f = props.filters
const emit = defineEmits<{ close: []; action: [id: string, target?: string] }>()

/* ── Root menu model ─────────────────────────────────────────────────────── */
type Item = {
  id: string
  label: string
  icon: LucideIcon
  submenu?: 'tags' | 'workflows'
  /** Keyboard shortcut hint shown as a trailing KeybindBadge. */
  key?: string
}
type Row = Item | 'divider'

const singleRows: Row[] = [
  { id: 'inspect', label: 'Inspect asset', icon: ZoomIn, key: 'Enter' },
  { id: 'details', label: 'Show details', icon: Info, key: 'i' },
  { id: 'favorite', label: 'Favorite', icon: Star },
  { id: 'tags', label: 'Add tags', icon: Tag, submenu: 'tags' },
  'divider',
  { id: 'download', label: 'Download', icon: Download },
  'divider',
  { id: 'insert', label: 'Insert into workflow', icon: Waypoints, submenu: 'workflows' },
  { id: 'open', label: 'Open as workflow in new tab', icon: Workflow },
  { id: 'export', label: 'Export workflow', icon: FileOutput },
  'divider',
  { id: 'delete', label: 'Delete asset', icon: Trash2 },
]
const multiRows: Row[] = [
  { id: 'details', label: 'Show details', icon: Info, key: 'i' },
  { id: 'favorite', label: 'Favorite all', icon: Star },
  { id: 'tags', label: 'Add tags', icon: Tag, submenu: 'tags' },
  'divider',
  { id: 'download', label: 'Download all', icon: Download },
  'divider',
  { id: 'insert', label: 'Insert all into workflow', icon: Waypoints, submenu: 'workflows' },
  { id: 'open', label: 'Open all workflows', icon: Workflow },
  { id: 'export', label: 'Export all workflows', icon: FileOutput },
  'divider',
  { id: 'delete', label: 'Delete all', icon: Trash2 },
]
// Compact menu behind the lightbox details-panel "…" button — the workflow/
// delete actions "left over" from the context menu (Figma 2281:53006).
const moreRows: Row[] = [
  { id: 'insert', label: 'Insert into workflow', icon: Waypoints, submenu: 'workflows' },
  { id: 'open', label: 'Open workflow', icon: Workflow },
  { id: 'export', label: 'Export workflow', icon: FileOutput },
  'divider',
  { id: 'delete', label: 'Delete asset', icon: Trash2 },
]
const activeRows = computed<Row[]>(() =>
  props.variant === 'more' ? moreRows : props.multiple ? multiRows : singleRows,
)

// "Insert into workflow" submenu targets = the open workflow tabs (everything but
// Media Assets). Derived from the real tab strip so we can flag the ACTIVE one
// ("Current") — the workflow the user is currently in. Shared by the context menu
// and the lightbox "…" menu.
const tabs = useTabs()
const workflowTargets = computed(() =>
  tabs.tabs.value
    .filter((t) => t.kind !== 'media')
    .map((t) => ({ id: t.id, label: t.label, active: t.id === tabs.activeId.value })),
)

const query = ref('')
const active = ref(0)
// Hover-activation is only honoured AFTER a real pointer move. Filtering (typing)
// reflows the list, which can fire `mouseenter` on whichever row lands under a
// stationary cursor — that used to hover-open its submenu + steal the active row
// while the user was typing. Disarm on filter/keyboard, re-arm on real movement.
const hoverReady = ref(false)
function onPointerMove() {
  hoverReady.value = true
}

type RenderRow = { divider: true } | { item: Item; navIndex: number }

function buildRender(rows: Row[], q: string): RenderRow[] {
  const out: RenderRow[] = []
  let nav = 0
  for (const r of rows) {
    if (r === 'divider') {
      out.push({ divider: true })
    } else if (!q || r.label.toLowerCase().includes(q)) {
      out.push({ item: r, navIndex: nav++ })
    }
  }
  // Drop leading/trailing/doubled dividers (can appear once filtering removes a group).
  return out.filter((row, i) => {
    if (!('divider' in row)) return true
    const prev = out[i - 1]
    const next = out[i + 1]
    return prev && next && 'item' in prev && 'item' in next
  })
}

const rootRender = computed(() => buildRender(activeRows.value, query.value.trim().toLowerCase()))
const rootItems = computed(() => rootRender.value.filter((r): r is { item: Item; navIndex: number } => 'item' in r).map((r) => r.item))

watch(query, () => {
  active.value = 0
  hoverReady.value = false // typing reflows the list — ignore hover until a real move
})

/* ── Tag submenu model — wired to the REAL selection tags via `f` ──────────── */
type TagModel = { label: string }
// A tag is "applied" when every selected asset has it; count = assets with it.
const isApplied = (label: string) => f.tagSelectionState(label) === 'all'
const tagCount = (label: string) => f.tagCounts[label] ?? 0
const allTagModels = computed<TagModel[]>(() => f.tags.map((label) => ({ label })))

const openSub = ref<null | 'tags' | 'workflows'>(null)
const subPos = ref({ left: 0, top: 0 })
// Whether the submenu actually opened to the LEFT of the parent (collision flip).
// Drives which arrow key opens/closes it so the controls match what's on screen.
const subFlipped = ref(false)
// Workflow submenu matches the parent menu's width (264 context / 232 more); tags
// stays its own width.
const SUB_WIDTH = computed(() => ({ tags: 240, workflows: props.variant === 'more' ? 232 : 264 }))
// How far the submenu overlaps its parent's edge. A small overlap keeps the two
// panels visually connected AND bridges the gap so a hover doesn't fall into
// dead space (which would close the submenu) while moving toward it.
const SUB_OVERLAP = 2
function predictFlip(kind: 'tags' | 'workflows') {
  const mr = menuRef.value?.getBoundingClientRect()
  if (!mr) return false
  return mr.right - 4 + SUB_WIDTH.value[kind] > window.innerWidth - 8
}
const tagQuery = ref('')
const subActive = ref(0)

// Workflow submenu search (Figma 2340-52751). Unlike tags there's no "create"
// row — just an empty state when nothing matches.
const workflowQuery = ref('')
const workflowSearchRef = ref<HTMLInputElement | null>(null)
const filteredWorkflows = computed(() => {
  const q = workflowQuery.value.trim().toLowerCase()
  return q
    ? workflowTargets.value.filter((t) => t.label.toLowerCase().includes(q))
    : workflowTargets.value
})
watch(workflowQuery, () => (subActive.value = 0))

// Row order is frozen when the submenu opens so toggling a tag only flips its
// check in place — the applied/unapplied regrouping happens on the next open,
// not jarringly while you're clicking. (Each group holds live tag refs, so the
// checkmark still updates reactively.)
const frozenApplied = ref<TagModel[]>([])
const frozenUnapplied = ref<TagModel[]>([])

const subRender = computed(() => {
  const q = tagQuery.value.trim().toLowerCase()
  const match = (t: TagModel) => !q || t.label.toLowerCase().includes(q)
  const appliedTags = frozenApplied.value.filter(match)
  const unappliedTags = frozenUnapplied.value.filter(match)
  const exact = q && f.tags.some((t) => t.toLowerCase() === q)
  const out: ({ divider: true } | { tag: TagModel; navIndex: number } | { create: string; navIndex: number })[] = []
  let nav = 0
  appliedTags.forEach((t) => out.push({ tag: t, navIndex: nav++ }))
  if (appliedTags.length && unappliedTags.length) out.push({ divider: true })
  unappliedTags.forEach((t) => out.push({ tag: t, navIndex: nav++ }))
  if (q && !exact) out.push({ create: tagQuery.value.trim(), navIndex: nav++ })
  return out
})
const subItems = computed(() =>
  subRender.value.filter(
    (r): r is { tag: TagModel; navIndex: number } | { create: string; navIndex: number } =>
      !('divider' in r),
  ),
)
// A typed tag name past the cap can't be created (Figma 2166-99383).
const tagOverLimit = computed(() => tagQuery.value.trim().length > MAX_TAG_LENGTH)

watch(tagQuery, () => (subActive.value = 0))

/* ── Actions ─────────────────────────────────────────────────────────────── */
function selectAction(id: string) {
  emit('action', id)
  emit('close')
}

// Anchor a submenu to the right edge of its parent row (clampSub flips it left
// if it would overflow the viewport). `subTriggerTop` is the trigger row's top —
// clampSub aligns the submenu's FIRST option to it (Linear-style).
let subTriggerTop = 0
function positionSub(rowId: string) {
  const row = menuRef.value?.querySelector<HTMLElement>(`[data-row-id="${rowId}"]`)
  const menuRect = menuRef.value?.getBoundingClientRect()
  if (row && menuRect) {
    const r = row.getBoundingClientRect()
    subTriggerTop = r.top
    subPos.value = { left: menuRect.right - SUB_OVERLAP, top: r.top }
  }
}

function openTagSub() {
  positionSub('tags')
  // Snapshot the GROUPING for the duration this submenu stays open (the check
  // itself stays live via `isApplied`, so toggling flips it in place).
  frozenApplied.value = allTagModels.value.filter((t) => isApplied(t.label))
  frozenUnapplied.value = allTagModels.value.filter((t) => !isApplied(t.label))
  openSub.value = 'tags'
  subActive.value = 0
  tagQuery.value = ''
  // keep the root highlight on the "Add tags" row
  const idx = rootItems.value.findIndex((it) => it.submenu === 'tags')
  if (idx >= 0) active.value = idx
  nextTick(() => {
    clampSub()
    subSearchRef.value?.focus()
  })
}

function openWorkflowSub() {
  positionSub('insert')
  openSub.value = 'workflows'
  subActive.value = 0
  workflowQuery.value = ''
  const idx = rootItems.value.findIndex((it) => it.submenu === 'workflows')
  if (idx >= 0) active.value = idx
  nextTick(() => {
    clampSub()
    workflowSearchRef.value?.focus()
  })
}

function openSubFor(item: Item) {
  if (item.submenu === 'tags') openTagSub()
  else if (item.submenu === 'workflows') openWorkflowSub()
}

// Picking a target fires the insert action with the chosen workflow's TAB ID, so
// the host can route it → navigate to that workflow + add Load Image node(s).
function selectWorkflow(tabId: string) {
  emit('action', 'insert', tabId)
  emit('close')
}

function closeSub() {
  openSub.value = null
  nextTick(() => searchRef.value?.focus())
}

/* ── Hover-open submenus ─────────────────────────────────────────────────── */
// Submenus open on hover (with a short intent delay) in addition to click/
// keyboard. A grace timer means crossing sibling rows on the way to an already-
// open submenu doesn't slam it shut; entering the submenu cancels the timer.
let subTimer: ReturnType<typeof setTimeout> | null = null
function clearSubTimer() {
  if (subTimer) {
    clearTimeout(subTimer)
    subTimer = null
  }
}
// Hover-OPEN only — the highlight follows @mousemove (not @mouseenter) so a
// stale/stationary pointer doesn't hijack keyboard navigation.
function onRowEnter(item: Item) {
  if (!hoverReady.value) return // stationary cursor after a filter/keypress — not a real hover
  clearSubTimer()
  if (item.submenu) {
    if (openSub.value !== item.submenu)
      subTimer = setTimeout(() => {
        if (openSub.value !== item.submenu) openSubFor(item)
      }, 60)
  } else if (openSub.value) {
    subTimer = setTimeout(() => {
      if (openSub.value) closeSub()
    }, 180)
  }
}

function activateSub(item: { tag?: TagModel; create?: string }) {
  if (item.create !== undefined) {
    if (tagOverLimit.value) return // over the character cap — can't create
    f.createTagForSelection(item.create) // registers it + applies to the selection
    frozenApplied.value.push({ label: item.create }) // show it in place without regrouping
    tagQuery.value = ''
  } else if (item.tag) {
    f.toggleTagForSelection(item.tag.label) // mutates the real asset tags (persists)
  }
  subActive.value = Math.min(subActive.value, Math.max(0, subItems.value.length - 1))
}

/* ── Keyboard ────────────────────────────────────────────────────────────── */
// Bound to `window` in the CAPTURE phase while the menu is open (see onMounted),
// so the menu owns its keys regardless of where DOM focus actually sits. This is
// what stops arrow keys from leaking to host shortcuts — e.g. the lightbox's
// ←/→ image-step and Esc-to-close, or activating the still-focused "…"/favorite
// button with Enter — when focus didn't land inside the menu.
function handleKey(e: KeyboardEvent) {
  // Only CLAIM keys the menu actually consumes; everything else (printable text)
  // must pass through to the focused search input. In the bare `more` menu there
  // is no text input at the root, so Space is claimed too (else it would activate
  // the underlying focused button) — but not while a submenu's search is open.
  const NAV = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape']
  const owns = NAV.includes(e.key) || (props.variant === 'more' && !openSub.value && e.key === ' ')
  if (!owns) return
  e.preventDefault()
  e.stopPropagation()
  hoverReady.value = false // keyboard nav owns the highlight until the mouse moves again
  if (openSub.value) {
    const len = openSub.value === 'workflows' ? filteredWorkflows.value.length : subItems.value.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (len) subActive.value = (subActive.value + 1) % len
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (len) subActive.value = (subActive.value - 1 + len) % len
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (openSub.value === 'workflows') {
        if (filteredWorkflows.value[subActive.value])
          selectWorkflow(filteredWorkflows.value[subActive.value]!.id)
      } else if (subItems.value[subActive.value]) {
        activateSub(subItems.value[subActive.value]!)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeSub()
    } else if (e.key === (subFlipped.value ? 'ArrowRight' : 'ArrowLeft')) {
      // "Back" key points toward the parent — flips when the submenu opened left.
      e.preventDefault()
      closeSub()
    }
    return
  }
  const items = rootItems.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (items.length) active.value = (active.value + 1) % items.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (items.length) active.value = (active.value - 1 + items.length) % items.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const it = items[active.value]
    if (!it) return
    if (it.submenu) openSubFor(it)
    else selectAction(it.id)
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    // Open with the arrow pointing toward where the submenu will appear (flips
    // to ArrowLeft when it would collide with the right edge).
    const it = items[active.value]
    if (it?.submenu) {
      const openKey = predictFlip(it.submenu) ? 'ArrowLeft' : 'ArrowRight'
      if (e.key === openKey) {
        e.preventDefault()
        openSubFor(it)
      }
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

/* ── Positioning / lifecycle ─────────────────────────────────────────────── */
const menuRef = ref<HTMLElement | null>(null)
const subRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)
const subSearchRef = ref<HTMLInputElement | null>(null)
const pos = ref({ left: props.x, top: props.y })

function clampSub() {
  const el = subRef.value
  const menuRect = menuRef.value?.getBoundingClientRect()
  if (!el || !menuRect) return
  const M = 8
  let left = subPos.value.left
  const flip = left + el.offsetWidth > window.innerWidth - M
  subFlipped.value = flip
  if (flip) left = menuRect.left - el.offsetWidth + SUB_OVERLAP // flip left
  // Align the submenu's first option row with the parent trigger row (Linear-
  // style): offset up by the first button's distance from the submenu's top
  // (past the search box + divider).
  const firstOpt = el.querySelector('button')
  let top = subTriggerTop
  if (firstOpt) top -= firstOpt.getBoundingClientRect().top - el.getBoundingClientRect().top
  top = Math.min(top, window.innerHeight - el.offsetHeight - M)
  subPos.value = { left, top: Math.max(M, top) }
}

onMounted(async () => {
  // Focus the search box (context variant) or the menu itself (more variant)
  // so arrow-key navigation works without a focused input.
  if (searchRef.value) searchRef.value.focus()
  else menuRef.value?.focus()
  await nextTick()
  const el = menuRef.value
  if (el) {
    const M = 8
    pos.value = {
      left: Math.min(props.x, window.innerWidth - el.offsetWidth - M),
      top: Math.min(props.y, window.innerHeight - el.offsetHeight - M),
    }
  }
  // Capture-phase so the menu sees keys before any host window listener (the
  // lightbox's ←/→/Esc, the gallery's Space/Enter-inspect) and regardless of
  // where DOM focus actually is.
  window.addEventListener('keydown', handleKey, true)
  window.addEventListener('pointerdown', onOutside, true)
  window.addEventListener('pointermove', onPointerMove, true)
  window.addEventListener('resize', onClose)
  window.addEventListener('scroll', onClose, true)
})
onBeforeUnmount(() => {
  clearSubTimer()
  window.removeEventListener('keydown', handleKey, true)
  window.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('pointermove', onPointerMove, true)
  window.removeEventListener('resize', onClose)
  window.removeEventListener('scroll', onClose, true)
})

function onClose() {
  emit('close')
}
function onOutside(e: PointerEvent) {
  const t = e.target as Node
  if (menuRef.value?.contains(t) || subRef.value?.contains(t)) return
  emit('close')
}
</script>

<template>
  <!-- Root menu (Figma 1843:117261). Linear-style nav via the window-capture
       keydown listener (handleKey), so it works regardless of DOM focus. -->
  <div
    ref="menuRef"
    tabindex="-1"
    class="fixed z-50 flex flex-col items-start gap-1 overflow-hidden rounded-lg border border-border-default bg-base-background px-2 py-3 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.6)] focus:outline-none"
    :class="variant === 'more' ? 'w-[232px]' : 'w-[264px]'"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
    @contextmenu.prevent  >
    <template v-if="variant !== 'more'">
      <div class="w-full px-2">
        <input
          ref="searchRef"
          v-model="query"
          type="text"
          placeholder="Search actions..."
          class="h-8 w-full min-w-0 bg-transparent text-sm leading-normal text-base-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <div class="h-px w-full shrink-0 bg-border-subtle" />
    </template>

    <template v-for="(row, i) in rootRender" :key="'divider' in row ? `d${i}` : row.item.id">
      <div v-if="'divider' in row" class="h-px w-full shrink-0 bg-border-subtle" />
      <button
        v-else
        type="button"
        :data-row-id="row.item.id"
        class="flex h-8 w-full shrink-0 items-center gap-2 rounded-sm p-2 text-left transition-colors focus:outline-none"
        :class="row.navIndex === active ? 'bg-secondary-background' : ''"
        @mouseenter="onRowEnter(row.item)"
        @mousemove="active = row.navIndex"
        @click="row.item.submenu ? openSubFor(row.item) : selectAction(row.item.id)"
      >
        <component :is="row.item.icon" class="size-4 shrink-0 text-base-foreground" :stroke-width="1.5" />
        <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">{{
          row.item.id === 'details' && detailsOpen ? 'Hide details' : row.item.label
        }}</span>
        <KeybindBadge v-if="row.item.key" :key-label="row.item.key" class="shrink-0" />
        <ChevronRight v-if="row.item.submenu" class="size-4 shrink-0 text-base-foreground" :stroke-width="1.5" />
      </button>
    </template>

    <div v-if="rootItems.length === 0" class="px-2 py-1 text-sm text-muted-foreground">No actions</div>
  </div>

  <!-- Tag submenu (Figma 1718:15505) -->
  <div
    v-if="openSub === 'tags'"
    ref="subRef"
    class="fixed z-50 flex w-[240px] flex-col items-start gap-1 overflow-hidden rounded-lg border border-border-default bg-base-background px-2 py-3 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.6)]"
    :style="{ left: `${subPos.left}px`, top: `${subPos.top}px` }"
    @mouseenter="clearSubTimer()"  >
    <div class="w-full px-2">
      <input
        ref="subSearchRef"
        v-model="tagQuery"
        type="text"
        placeholder="Type a tag…"
        class="h-8 w-full min-w-0 bg-transparent text-sm leading-normal text-base-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
    <div class="h-px w-full shrink-0 bg-border-subtle" />

    <template v-for="(row, i) in subRender" :key="'divider' in row ? `sd${i}` : row.navIndex">
      <div v-if="'divider' in row" class="h-px w-full shrink-0 bg-border-subtle" />

      <!-- Create-new-tag row (disabled + dimmed past the cap, Figma 2166-99383) -->
      <template v-else-if="'create' in row">
        <button
          type="button"
          :disabled="tagOverLimit"
          class="flex h-8 w-full shrink-0 items-center gap-2 rounded-sm p-2 text-left transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          :class="row.navIndex === subActive && !tagOverLimit ? 'bg-secondary-background' : ''"
          @mousemove="subActive = row.navIndex"
          @click="activateSub(row)"
        >
          <Plus class="size-4 shrink-0 text-base-foreground" :stroke-width="1.5" />
          <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">Add “{{ row.create }}” as a tag</span>
        </button>
        <div
          v-if="tagOverLimit"
          class="flex shrink-0 items-center gap-2 p-2 text-sm leading-normal text-amber-500"
        >
          <CircleAlert class="size-4 shrink-0" :stroke-width="1.5" />
          Max character limit reached
        </div>
      </template>

      <!-- Tag row -->
      <button
        v-else
        type="button"
        class="flex h-8 w-full shrink-0 items-center gap-2 rounded-sm p-2 text-left transition-colors focus:outline-none"
        :class="row.navIndex === subActive ? 'bg-secondary-background' : ''"
        @mousemove="subActive = row.navIndex"
        @click="activateSub(row)"
      >
        <Tag class="size-4 shrink-0 text-base-foreground" :stroke-width="1.5" />
        <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">{{ row.tag.label }}</span>
        <span v-if="tagCount(row.tag.label)" class="shrink-0 text-sm leading-normal text-muted-foreground">
          {{ tagCount(row.tag.label) }} {{ tagCount(row.tag.label) === 1 ? 'asset' : 'assets' }}
        </span>
        <Check v-if="isApplied(row.tag.label)" class="size-4 shrink-0 text-base-foreground" :stroke-width="1.5" />
      </button>
    </template>
  </div>

  <!-- "Insert into workflow" submenu: the open workflow tabs (Figma 2281:53006).
       Width matches the parent menu. -->
  <div
    v-if="openSub === 'workflows'"
    ref="subRef"
    class="fixed z-50 flex flex-col items-start gap-1 overflow-hidden rounded-lg border border-border-default bg-base-background px-2 py-3 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.6)]"
    :style="{ left: `${subPos.left}px`, top: `${subPos.top}px`, width: `${SUB_WIDTH.workflows}px` }"
    @mouseenter="clearSubTimer()"  >
    <div class="w-full px-2">
      <input
        ref="workflowSearchRef"
        v-model="workflowQuery"
        type="text"
        placeholder="Search open workflows..."
        class="h-8 w-full min-w-0 bg-transparent text-sm leading-normal text-base-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
    <div class="h-px w-full shrink-0 bg-border-subtle" />

    <button
      v-for="(t, i) in filteredWorkflows"
      :key="i"
      type="button"
      class="flex h-8 w-full shrink-0 items-center gap-2 rounded-sm p-2 text-left transition-colors focus:outline-none"
      :class="i === subActive ? 'bg-secondary-background' : ''"
      @mousemove="subActive = i"
      @click="selectWorkflow(t.id)"
    >
      <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">{{ t.label }}</span>
      <!-- Dot marks the workflow the user is currently in (still selectable). -->
      <span
        v-if="t.active"
        class="size-2 shrink-0 rounded-full bg-azure-600"
        title="Current workflow"
        aria-label="Current workflow"
      />
    </button>

    <!-- Empty state — no "create" affordance (you can't add a workflow). -->
    <div v-if="filteredWorkflows.length === 0" class="px-2 py-1.5 text-sm text-muted-foreground">
      No matching workflows
    </div>
  </div>
</template>
