<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { Check, Copy, Download, Ellipsis, PanelRight, Sparkles, Star, X } from 'lucide-vue-next'
import TagSelector from './TagSelector.vue'
import ContextMenu from './ContextMenu.vue'
import AssetThumb from './AssetThumb.vue'
import { mockDuration, mockFps, mockGeneration, mockPolyCount, mockSampleRate } from './assetMeta'
import IconTooltip from '@/components/ui/IconTooltip.vue'
import { useAssetDrag } from '@/composables/useAssetDrag'
import { useTabs } from '@/composables/useTabs'
import type { useGalleryFilters } from '@/composables/useGalleryFilters'

const props = withDefaults(
  defineProps<{ filters: ReturnType<typeof useGalleryFilters>; lightbox?: boolean }>(),
  { lightbox: false },
)
defineEmits<{ togglePanel: [] }>()
const f = props.filters

const count = computed(() => f.selectedAssets.size)
const single = computed(() => f.detailAsset.value) // non-null only when exactly 1
const isMulti = computed(() => count.value > 1)

// Per-type metadata rows (video/audio swap Dimensions for Duration + rate).
const isVideo = computed(() => single.value?.mediaType === 'video')
const isAudio = computed(() => single.value?.mediaType === 'audio')
const isThree = computed(() => single.value?.mediaType === '3d')

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
/** Up to 3 thumbnails for the multi-select fanned stack. */
const stack = computed(() => f.detailSelectionAssets.value.slice(0, 3))

/* ── Mocked single-asset metadata ─────────────────────────────────────────── */
function mockSize(name: string) {
  return `${(2 + (hash(name) % 180) / 10).toFixed(1)} MB`
}
function mockSeed(name: string) {
  return String(10_000_000_000 + (hash(name) % 89_999_999_999))
}
// `createdAt` isn't a real timestamp here, so derive a plausible date from the name.
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
// Realistic-but-deterministic Generation details (shared with DockDetailsPopover).
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

/* ── Tags ─────────────────────────────────────────────────────────────────── */
// Chips = shared tags (intersection); for a single asset that's just its tags.
const chips = computed(() => f.sharedSelectionTags.value)
const query = ref('')
const tagFocused = ref(false)
const selector = ref<InstanceType<typeof TagSelector> | null>(null)

function onTagKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selector.value?.move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selector.value?.move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    selector.value?.activateActive()
  } else if (e.key === 'Backspace' && query.value === '' && chips.value.length) {
    f.removeTagFromSelection(chips.value[chips.value.length - 1]!)
  } else if (e.key === 'Escape') {
    nameInput.value // no-op guard
    ;(e.target as HTMLInputElement).blur()
  }
}
function onToggle(tag: string) {
  f.toggleTagForSelection(tag)
}
function onCreate(name: string) {
  f.createTagForSelection(name)
  query.value = ''
}

// Reset transient UI when the selection changes.
watch(count, () => {
  editingName.value = false
  query.value = ''
  moreOpen.value = false
})

/* ── "…" actions menu (lightbox) — reuses ContextMenu's `more` variant ─────── */
const moreOpen = ref(false)
const moreBtn = ref<HTMLElement | null>(null)
const morePos = reactive({ x: 0, y: 0 })
const MORE_MENU_W = 232
function openMore() {
  const r = moreBtn.value?.getBoundingClientRect()
  if (r) {
    morePos.x = r.right - MORE_MENU_W // right-align under the button
    morePos.y = r.bottom + 6
  }
  moreOpen.value = !moreOpen.value
}
// Insert/Open are wired (same routing as the gallery/dock menus); the rest are
// stubbed. Acts on the currently-inspected asset(s).
const drag = useAssetDrag()
const tabs = useTabs()
function onMoreAction(id: string, target?: string) {
  moreOpen.value = false
  const names = [...f.selectedAssets]
  if (!names.length) return
  if (id === 'insert') {
    const tab = tabs.tabs.value.find((t) => t.id === target)
    if (tab?.kind === 'workflow') {
      drag.requestInsert(names)
      f.closeInspect()
      tabs.navigate(tab.id)
    }
  } else if (id === 'open') {
    tabs.openAssetWorkflows(names)
    f.closeInspect()
  }
}
</script>

<template>
  <aside class="flex h-full w-80 shrink-0 flex-col border-l border-border-default bg-base-background">
    <!-- Header. Lightbox uses 40px buttons + py-4 so they vertically align with
         the canvas zoom controls (both centered 36px from the top). -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-border-subtle px-4"
      :class="lightbox ? 'py-4' : 'h-14'"
    >
      <span class="text-base font-medium leading-normal text-base-foreground">Asset details</span>
      <!-- Lightbox: re-generate (filled) + panel toggle. Otherwise: close (X). -->
      <div v-if="lightbox" class="flex items-center gap-2">
        <IconTooltip label="Re-generate in app mode" side="bottom">
          <button
            type="button"
            class="flex size-10 items-center justify-center rounded-lg bg-secondary-background text-base-foreground transition-colors hover:bg-button-hovered"
            aria-label="Re-generate in app mode"
          >
            <Sparkles class="size-4" :stroke-width="1.5" />
          </button>
        </IconTooltip>
        <IconTooltip label="Hide panel" side="bottom">
          <button
            type="button"
            class="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
            aria-label="Hide details panel"
            @click="$emit('togglePanel')"
          >
            <PanelRight class="size-4" :stroke-width="1.5" />
          </button>
        </IconTooltip>
      </div>
      <button
        v-else
        type="button"
        class="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground"
        aria-label="Close details"
        @click="f.closeDetails"
      >
        <X class="size-4" :stroke-width="1.5" />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <!-- Preview (hidden in the lightbox — the big image is already shown) -->
      <div v-if="!lightbox" class="flex flex-col items-center gap-3 p-4">
        <!-- Single -->
        <div v-if="single" class="relative size-36 overflow-hidden rounded-lg" aria-hidden="true">
          <AssetThumb :name="single.name" :media-type="single.mediaType" />
        </div>
        <!-- Multi: fanned stack -->
        <template v-else>
          <div class="relative size-36">
            <div
              v-for="(a, i) in stack"
              :key="a.name"
              class="absolute inset-0 overflow-hidden rounded-lg border border-border-default shadow-[var(--shadow-floating-dark)]"
              :style="{
                transform: `rotate(${(i - (stack.length - 1) / 2) * 5}deg) translateY(${i * 2}px)`,
                zIndex: stack.length - i,
              }"
            >
              <AssetThumb :name="a.name" :media-type="a.mediaType" />
            </div>
          </div>
          <span class="text-sm leading-normal text-muted-foreground">{{ count }} assets selected</span>
        </template>
      </div>

      <!-- Single-asset info -->
      <template v-if="single">
        <div v-if="!lightbox" class="h-px w-full bg-border-subtle" />
        <dl class="flex flex-col gap-3 p-4 text-sm leading-normal">
          <div class="flex items-center justify-between gap-4">
            <dt class="shrink-0 text-muted-foreground">Name</dt>
            <dd class="min-w-0 flex-1 text-right">
              <input
                v-if="editingName"
                ref="nameInput"
                v-model="nameDraft"
                type="text"
                class="w-full rounded-sm bg-secondary-background px-1.5 py-0.5 text-right text-base-foreground focus:outline-none"
                @keydown.enter.stop="commitRename"
                @keydown.escape.stop="editingName = false"
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
          <div v-if="single.dimensions" class="flex items-center justify-between gap-4">
            <dt class="text-muted-foreground">Dimensions</dt>
            <dd class="text-base-foreground">{{ single.dimensions }}</dd>
          </div>
          <div v-if="isVideo || isAudio" class="flex items-center justify-between gap-4">
            <dt class="text-muted-foreground">Duration</dt>
            <dd class="text-base-foreground tabular-nums">{{ mockDuration(single.name) }}</dd>
          </div>
          <div v-if="isVideo" class="flex items-center justify-between gap-4">
            <dt class="text-muted-foreground">Frame rate</dt>
            <dd class="text-base-foreground">{{ mockFps(single.name) }}</dd>
          </div>
          <div v-if="isAudio" class="flex items-center justify-between gap-4">
            <dt class="text-muted-foreground">Sample rate</dt>
            <dd class="text-base-foreground">{{ mockSampleRate(single.name) }}</dd>
          </div>
          <div v-if="isThree" class="flex items-center justify-between gap-4">
            <dt class="text-muted-foreground">Polygons</dt>
            <dd class="text-base-foreground">{{ mockPolyCount(single.name) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-muted-foreground">Size</dt>
            <dd class="text-base-foreground">{{ mockSize(single.name) }}</dd>
          </div>
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

        <!-- Actions (lightbox only): Download / Favorite / More -->
        <div v-if="lightbox" class="flex items-center gap-2 px-4 pb-4">
          <button
            type="button"
            class="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary-background text-sm leading-normal text-base-foreground transition-colors hover:bg-button-hovered"
          >
            Download
            <Download class="size-4" :stroke-width="1.5" />
          </button>
          <IconTooltip
            :label="f.allSelectedFavorited.value ? 'Remove from favorites' : 'Add to favorites'"
          >
            <button
              type="button"
              class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-background transition-colors hover:bg-button-hovered"
              aria-label="Favorite"
              @click="f.toggleFavoriteSelected"
            >
              <Star
                class="size-4"
                :class="f.allSelectedFavorited.value ? 'text-yellow-400' : 'text-base-foreground'"
                :fill="f.allSelectedFavorited.value ? 'currentColor' : 'none'"
                :stroke-width="1.5"
              />
            </button>
          </IconTooltip>
          <IconTooltip label="More options">
            <button
              ref="moreBtn"
              type="button"
              class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-background text-base-foreground transition-colors hover:bg-button-hovered"
              :class="moreOpen ? 'bg-button-hovered' : ''"
              aria-label="More"
              @click="openMore"
            >
              <Ellipsis class="size-4" :stroke-width="1.5" />
            </button>
          </IconTooltip>
        </div>
      </template>

      <!-- TAGS -->
      <div class="h-px w-full bg-border-subtle" />
      <div class="flex flex-col gap-2 p-4">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</span>

        <p v-if="isMulti && !chips.length" class="text-sm leading-normal text-muted-foreground">
          No tags shared across all selected assets.
        </p>

        <!-- Chips + input box (filled, no outline). The dropdown floats over the
             content below instead of pushing it down. -->
        <div class="relative">
          <div class="rounded-lg bg-secondary-background p-2">
            <div v-if="chips.length" class="flex flex-wrap gap-1.5">
              <span
                v-for="t in chips"
                :key="t"
                class="flex h-6 items-center gap-1 rounded-full bg-button-hovered px-2 text-sm leading-normal text-base-foreground"
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
            <input
              v-model="query"
              type="text"
              placeholder="Search or create a new tag.."
              class="w-full bg-transparent px-1 py-0.5 text-sm leading-normal text-base-foreground placeholder:text-muted-foreground focus:outline-none"
              :class="chips.length ? 'mt-1.5' : ''"
              @focus="tagFocused = true"
              @blur="tagFocused = false"
              @keydown="onTagKeydown"
            />
          </div>

          <!-- Dropdown (reused tag submenu) — floats on top -->
          <TagSelector
            v-if="tagFocused"
            ref="selector"
            class="absolute left-0 right-0 top-full z-30 mt-1"
            :query="query"
            :tags="f.tags"
            :counts="f.tagCounts"
            :state="f.tagSelectionState"
            @toggle="onToggle"
            @create="onCreate"
          />
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
  </aside>

  <!-- "…" actions menu (lightbox only). Lives in the lightbox's dark-theme +
       z-[60] stacking context, so it layers above the canvas. -->
  <ContextMenu
    v-if="moreOpen"
    variant="more"
    :x="morePos.x"
    :y="morePos.y"
    :multiple="false"
    :filters="f"
    @close="moreOpen = false"
    @action="onMoreAction"
  />
</template>
