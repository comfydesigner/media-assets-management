<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, Copy, Plus, X } from 'lucide-vue-next'
import TagSelector from './TagSelector.vue'
import { mockGeneration } from './assetMeta'
import type { useGalleryFilters } from '@/composables/useGalleryFilters'

// (z-40 — below the z-50 context menu so a right-click still layers above it.)
// Dock "Asset details" — a floating popover (Figma 1812-70678). Structurally the
// same info as the tab's AssetDetailsPanel, but: no preview image, it floats
// beside the dock aligned with the triggering card, and the TAGS use a chips +
// "+" pattern (the + opens the shared tri-state TagSelector as a side dropdown).
const props = defineProps<{
  filters: ReturnType<typeof useGalleryFilters>
  /** The dock root — the popover sits just to its right. */
  anchorEl?: HTMLElement | null
  /** Vertical position of the triggering card (client Y) to align to. */
  anchorY?: number
}>()
const emit = defineEmits<{ close: [] }>()
const f = props.filters

const count = computed(() => f.selectedAssets.size)
const single = computed(() => f.detailAsset.value) // non-null only when exactly 1
const isMulti = computed(() => count.value > 1)

/* ── Mocked metadata (mirrors AssetDetailsPanel) ──────────────────────────── */
function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
function mockSize(name: string) {
  return `${(2 + (hash(name) % 180) / 10).toFixed(1)} MB`
}
function mockSeed(name: string) {
  return String(10_000_000_000 + (hash(name) % 89_999_999_999))
}
function mockDate(name: string) {
  const h = hash(name)
  const d = new Date(2025, h % 12, (h % 28) + 1, h % 24, h % 60, (h >> 3) % 60)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  let hr = d.getHours()
  const ampm = hr >= 12 ? 'pm' : 'am'
  hr = hr % 12 || 12
  const time = `${hr}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}${ampm}`
  return { date, time }
}
const created = computed(() => (single.value ? mockDate(single.value.name) : null))
// Realistic-but-deterministic Generation details (shared with AssetDetailsPanel).
const gen = computed(() => (single.value ? mockGeneration(single.value.name) : null))

/* ── Copy-on-hover for the read-only Prompt ───────────────────────────────── */
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined
function copyPrompt() {
  navigator.clipboard?.writeText(gen.value?.prompt ?? '')
  copied.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copied.value = false), 1500)
}

/* ── Inline name rename ───────────────────────────────────────────────────── */
const editingName = ref(false)
const nameDraft = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
function startRename() {
  if (!single.value) return
  nameDraft.value = single.value.name
  editingName.value = true
  nextTick(() => nameInput.value?.select())
}
function commitRename() {
  if (!editingName.value || !single.value) return
  f.renameAsset(single.value.name, nameDraft.value)
  editingName.value = false
}

/* ── Tags: chips + "+" → side tri-state picker ────────────────────────────── */
const chips = computed(() => f.sharedSelectionTags.value)
const picking = ref(false)
const tagQuery = ref('')
const tagInput = ref<HTMLInputElement | null>(null)
const selector = ref<InstanceType<typeof TagSelector> | null>(null)
const plusBtn = ref<HTMLElement | null>(null)
const pickerRef = ref<HTMLElement | null>(null)
const chipsRef = ref<HTMLElement | null>(null)
const pickerPos = ref({ left: 0, top: 0 })
const PICKER_W = 240

function openPicker() {
  picking.value = !picking.value
  if (!picking.value) return
  const r = plusBtn.value?.getBoundingClientRect()
  const pop = rootRef.value?.getBoundingClientRect()
  if (r && pop) {
    // Prefer the right of the popover (over the canvas); if it won't fit, flip to
    // the LEFT of the popover (over the dock) so it never covers the popover.
    let left = pop.right + 8
    if (left + PICKER_W > window.innerWidth - 8) left = pop.left - PICKER_W - 8
    left = Math.max(8, left)
    const top = Math.max(8, Math.min(r.top, window.innerHeight - 332))
    pickerPos.value = { left, top }
  }
  nextTick(() => tagInput.value?.focus())
}
function onTagKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); selector.value?.move(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); selector.value?.move(-1) }
  else if (e.key === 'Enter') { e.preventDefault(); selector.value?.activateActive() }
  else if (e.key === 'Escape') { e.preventDefault(); picking.value = false }
}
function onToggle(t: string) {
  f.toggleTagForSelection(t)
}
function onCreate(n: string) {
  f.createTagForSelection(n)
  tagQuery.value = ''
}
// Clicking anywhere outside the picker (or its "+" toggle) closes it — incl.
// grabbing the popover header to drag, so it doesn't float around detached.
// Exception: the existing tag chips (e.g. clicking a chip's "×" to remove a
// tag) keep the picker open, so you can prune + add tags in one session.
function onPickerOutside(e: PointerEvent) {
  if (!picking.value) return
  const t = e.target as Node
  if (
    pickerRef.value?.contains(t) ||
    plusBtn.value?.contains(t) ||
    chipsRef.value?.contains(t)
  )
    return
  picking.value = false
}

/* ── Position the popover beside the dock, aligned to the trigger ─────────── */
const rootRef = ref<HTMLElement | null>(null)
// The popover's TOP is pinned (at the triggering card's image top, or wherever
// the user drags it); its body grows/shrinks downward, capped to the viewport
// bottom via `maxHeight` (internal scroll) so it never runs off-screen.
const pos = ref({ left: 340, top: 80 })
const maxHeight = ref(600)
// Min height (also enforced in the template). The top is clamped so a MIN_H-tall
// popover always fits — i.e. it can't be pushed past the bottom of the screen.
const MIN_H = 384
const clampTop = (top: number) => Math.max(8, Math.min(top, window.innerHeight - MIN_H - 8))
function setMaxHeight() {
  maxHeight.value = window.innerHeight - pos.value.top - 8
}
function place() {
  const r = props.anchorEl?.getBoundingClientRect()
  pos.value = { left: r ? r.right + 8 : 340, top: clampTop(props.anchorY ?? 100) }
  setMaxHeight()
}
// Resize: keep the (possibly dragged) popover on-screen WITHOUT re-anchoring.
function reclamp() {
  const w = rootRef.value?.offsetWidth ?? 288
  pos.value = {
    left: Math.max(8, Math.min(pos.value.left, window.innerWidth - w - 8)),
    top: clampTop(pos.value.top),
  }
  setMaxHeight()
}

/* ── Drag the header to reposition (X-button / threshold guarded) ─────────── */
let dragStartX = 0
let dragStartY = 0
let startLeft = 0
let startTop = 0
let dragMoved = false
function onHeaderPointerDown(e: PointerEvent) {
  if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return // not the X
  dragStartX = e.clientX
  dragStartY = e.clientY
  startLeft = pos.value.left
  startTop = pos.value.top
  dragMoved = false
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragUp)
}
function onDragMove(e: PointerEvent) {
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  if (!dragMoved && Math.hypot(dx, dy) < 4) return // threshold so a tap isn't a drag
  dragMoved = true
  const w = rootRef.value?.offsetWidth ?? 288
  pos.value = {
    left: Math.max(8, Math.min(startLeft + dx, window.innerWidth - w - 8)),
    top: clampTop(startTop + dy),
  }
  setMaxHeight()
}
function onDragUp() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
}

// Persistent inspector: stays open until the X (no outside-click / Esc dismiss).
onMounted(() => {
  nextTick(place)
  window.addEventListener('resize', reclamp)
  window.addEventListener('pointerdown', onPickerOutside, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', reclamp)
  window.removeEventListener('pointerdown', onPickerOutside, true)
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="rootRef"
      class="fixed z-40 flex min-h-96 w-72 flex-col overflow-hidden rounded-xl border border-border-default bg-base-background shadow-[0px_8px_32px_rgba(0,0,0,0.5)]"
      :style="{ left: `${pos.left}px`, top: `${pos.top}px`, maxHeight: `${maxHeight}px` }"
    >
      <!-- Header — drag handle (anywhere but the X) to reposition. -->
      <div
        class="flex shrink-0 cursor-move select-none items-center justify-between border-b border-border-subtle px-4 py-3"
        @pointerdown="onHeaderPointerDown"
      >
        <span class="text-sm font-medium leading-normal text-base-foreground">Asset details</span>
        <button
          type="button"
          class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
          aria-label="Close details"
          @click="emit('close')"
        >
          <X class="size-4" :stroke-width="1.5" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <!-- Single-asset info -->
        <template v-if="single">
          <dl class="flex flex-col gap-3 p-4 text-sm leading-normal">
            <div class="flex items-center justify-between gap-4">
              <dt class="shrink-0 text-muted-foreground">Name</dt>
              <!-- text-right + `-mr-1.5` on the rename button so its text aligns
                   flush-right with the other values despite its hover padding
                   (the padding/bg just bleed into the panel's p-4). -->
              <dd class="min-w-0 flex-1 text-right">
                <input
                  v-if="editingName"
                  ref="nameInput"
                  v-model="nameDraft"
                  type="text"
                  class="w-full rounded-sm bg-secondary-background px-1.5 py-0.5 text-right text-base-foreground focus:outline-none"
                  @keydown.enter="commitRename"
                  @keydown.escape="editingName = false"
                  @blur="commitRename"
                />
                <button
                  v-else
                  type="button"
                  class="-mr-1.5 inline-block max-w-full truncate rounded-sm px-1.5 py-0.5 align-bottom text-base-foreground hover:bg-secondary-background"
                  @click="startRename"
                >
                  {{ single.name }}
                </button>
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4">
              <dt class="text-muted-foreground">Type</dt>
              <dd class="text-base-foreground">{{ single.format }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4">
              <dt class="text-muted-foreground">Dimensions</dt>
              <dd class="text-base-foreground">{{ single.dimensions }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4">
              <dt class="text-muted-foreground">Size</dt>
              <dd class="text-base-foreground">{{ mockSize(single.name) }}</dd>
            </div>
            <!-- Date created: label aligns with the date (top); time on its own
                 line below. -->
            <div class="flex items-start justify-between gap-4">
              <dt class="shrink-0 text-muted-foreground">Date created</dt>
              <dd class="text-right text-base-foreground">
                <div>{{ created?.date }}</div>
                <div>{{ created?.time }}</div>
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4">
              <dt class="text-muted-foreground">Uploaded by</dt>
              <dd class="text-base-foreground">John Doe</dd>
            </div>
          </dl>
        </template>

        <!-- Multi-asset header -->
        <div v-else class="p-4">
          <span class="text-sm leading-normal text-muted-foreground">{{ count }} assets selected</span>
        </div>

        <!-- TAGS -->
        <div class="h-px w-full bg-border-subtle" />
        <div class="flex flex-col gap-2 p-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</span>
            <button
              ref="plusBtn"
              type="button"
              class="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
              :class="picking ? 'bg-secondary-background text-base-foreground' : ''"
              aria-label="Add tags"
              @click="openPicker"
            >
              <Plus class="size-4" :stroke-width="1.5" />
            </button>
          </div>

          <!-- min-h-6 so the empty state matches the height of a single chip row
               (chips are h-6) — no vertical shift when the first tag is added. -->
          <p
            v-if="isMulti && !chips.length"
            class="flex min-h-6 items-center text-sm leading-normal text-muted-foreground"
          >
            No tags shared across all selected assets.
          </p>
          <p
            v-else-if="!chips.length"
            class="flex min-h-6 items-center text-sm leading-normal text-muted-foreground"
          >
            No tags yet.
          </p>
          <div v-else ref="chipsRef" class="flex flex-wrap gap-1.5">
            <span
              v-for="t in chips"
              :key="t"
              class="flex h-6 items-center gap-1 rounded-full bg-tertiary-background px-2 text-sm leading-normal text-base-foreground"
            >
              {{ t }}
              <button
                type="button"
                class="flex size-3.5 items-center justify-center rounded-full text-muted-foreground hover:text-base-foreground"
                :aria-label="`Remove ${t}`"
                @click="f.removeTagFromSelection(t)"
              >
                <X class="size-3" :stroke-width="2" />
              </button>
            </span>
          </div>
        </div>

        <!-- Generation details (single only) -->
        <template v-if="single">
          <div class="h-px w-full bg-border-subtle" />
          <div class="flex flex-col gap-3 p-4 text-sm leading-normal">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Generation details
            </span>
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted-foreground">Workflow</span>
              <span class="min-w-0 truncate text-base-foreground">{{ gen?.workflow }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted-foreground">Model</span>
              <span class="text-base-foreground">{{ gen?.model }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted-foreground">Steps</span>
              <span class="text-base-foreground">{{ gen?.steps }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted-foreground">Seed</span>
              <span class="tabular-nums text-base-foreground">{{ mockSeed(single.name) }}</span>
            </div>
            <!-- Prompt is omitted for promptless workflows (upscale/hi-res). -->
            <div v-if="gen?.prompt" class="flex flex-col gap-1.5">
              <span class="text-muted-foreground">Prompt</span>
              <!-- Read-only: hovering reveals a centered Copy button over a scrim. -->
              <div class="group/prompt relative">
                <p class="rounded-lg bg-secondary-background p-3 text-sm leading-5 text-base-foreground">
                  {{ gen?.prompt }}
                </p>
                <button
                  type="button"
                  class="absolute inset-0 flex items-start justify-end rounded-lg bg-base-background/75 p-2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/prompt:opacity-100"
                  @click="copyPrompt"
                >
                  <span
                    class="flex items-center gap-1.5 rounded-md border border-border-default bg-secondary-background px-2.5 py-1.5 text-sm text-base-foreground shadow-[0px_2px_8px_rgba(0,0,0,0.4)]"
                  >
                    <component :is="copied ? Check : Copy" class="size-4" :stroke-width="1.5" />
                    {{ copied ? 'Copied' : 'Copy' }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Tag picker (side dropdown): "Type a tag…" + the shared tri-state
         TagSelector, grow-to-content (resizes while filtering) — matches the
         right-click "Add tags" submenu. Below the popover's z so the context
         menu still layers above it. -->
    <div
      v-if="picking"
      ref="pickerRef"
      class="fixed z-[41] w-60 overflow-hidden rounded-lg border border-border-default bg-base-background py-1 shadow-[0px_8px_32px_rgba(0,0,0,0.5)]"
      :style="{ left: `${pickerPos.left}px`, top: `${pickerPos.top}px` }"
    >
      <div class="px-3 py-1.5">
        <input
          ref="tagInput"
          v-model="tagQuery"
          type="text"
          placeholder="Type a tag…"
          class="h-7 w-full min-w-0 bg-transparent text-sm leading-normal text-base-foreground placeholder:text-muted-foreground focus:outline-none"
          @keydown="onTagKeydown"
        />
      </div>
      <div class="mx-1 h-px bg-border-subtle" />
      <TagSelector
        ref="selector"
        bare
        grow
        :query="tagQuery"
        :tags="f.tags"
        :counts="f.tagCounts"
        :state="f.tagSelectionState"
        @toggle="onToggle"
        @create="onCreate"
      />
    </div>
  </Teleport>
</template>
