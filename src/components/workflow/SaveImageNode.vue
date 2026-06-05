<script setup lang="ts">
import {
  ChevronDown,
  EllipsisVertical,
  Info,
  Play,
  RedoDot,
  RotateCw,
  Shrink,
  Trash2,
  X,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ALL_TAGS } from '../gallery/types'
import { TAG_COUNTS } from '../gallery/data'
import TagSelector from '../gallery/TagSelector.vue'
import VariablePicker, { type VariableGroup } from './VariablePicker.vue'
import { useNodeResize } from '@/composables/useNodeResize'

const props = defineProps<{
  selected?: boolean
  showToolbar?: boolean
  name?: string
  /** Canvas zoom — used to keep the resize handle tracking the cursor 1:1. */
  zoom?: number
}>()

const emit = defineEmits<{ delete: [] }>()

// Bottom-right handle resizes the node WIDTH (min = current size).
const { width, onResizeStart } = useNodeResize(() => props.zoom ?? 1)

// The dropdowns live inside the canvas's scaled layer, so they'd zoom with the
// graph. Counter-scale by 1/zoom (origin top-left = the field's bottom-left) so
// they render at a CONSTANT screen size regardless of canvas zoom while staying
// anchored to the field — popups are UI chrome, not graph content.
const popupStyle = computed(() => {
  const z = props.zoom ?? 1
  return { transform: `scale(${1 / z})`, transformOrigin: 'top left' }
})

/* ── Widget state (mock) ──────────────────────────────────────────────────── */
const filenamePrefix = ref('')
const tagQuery = ref('')
const appliedTags = ref<Set<string>>(new Set())
// Which field's dropdown is open (only one at a time).
const open = ref<null | 'variable' | 'tags'>(null)

// SPECIAL WIDGET 1 — filename_prefix variable insertion (ComfyUI `%var%` tokens).
const VARIABLE_GROUPS: VariableGroup[] = [
  {
    label: 'Metadata properties',
    items: [
      { label: 'project', token: '%project%', sample: 'Project_Comfy' },
      { label: 'workflow', token: '%workflow%', sample: 'Current_workflow' },
      { label: 'node_name', token: '%node_name%', sample: 'Save_Image' },
    ],
  },
  {
    label: 'Runtime variables',
    items: [
      { label: 'width', token: '%width%', sample: 'Output image width' },
      { label: 'height', token: '%height%', sample: 'Output image height' },
      { label: 'batch_num', token: '%batch_num%', sample: 'Batch index' },
    ],
  },
  {
    label: 'Date formats',
    items: [
      { label: 'date: yyyymmdd', token: '%date:yyyyMMdd%', sample: '20260601' },
      { label: 'date: yyyy-mm-dd', token: '%date:yyyy-MM-dd%', sample: '2026-06-01' },
      { label: 'time: hhmmss', token: '%date:hhmmss%', sample: 'Ex: 170852' },
    ],
  },
  {
    // Mock node graph: a basic text-to-image workflow (checkpoint → CLIP text
    // encode → empty latent → KSampler → VAE decode → save).
    label: 'Node properties',
    items: [
      { label: 'CheckpointLoaderSimple.ckpt_name', token: '%CheckpointLoaderSimple.ckpt_name%', sample: 'sd_xl_base_1.0' },
      { label: 'VAELoader.vae_name', token: '%VAELoader.vae_name%', sample: 'sdxl_vae' },
      { label: 'CLIPTextEncode.text', token: '%CLIPTextEncode.text%', sample: 'Positive prompt' },
      { label: 'EmptyLatentImage.width', token: '%EmptyLatentImage.width%', sample: '1024' },
      { label: 'EmptyLatentImage.height', token: '%EmptyLatentImage.height%', sample: '1024' },
      { label: 'EmptyLatentImage.batch_size', token: '%EmptyLatentImage.batch_size%', sample: '1' },
      { label: 'KSampler.seed', token: '%KSampler.seed%', sample: '21341099' },
      { label: 'KSampler.steps', token: '%KSampler.steps%', sample: '20' },
      { label: 'KSampler.cfg', token: '%KSampler.cfg%', sample: '7.5' },
      { label: 'KSampler.sampler_name', token: '%KSampler.sampler_name%', sample: 'euler' },
      { label: 'KSampler.scheduler', token: '%KSampler.scheduler%', sample: 'normal' },
      { label: 'KSampler.denoise', token: '%KSampler.denoise%', sample: '1.0' },
      { label: 'LoadImage.image_name', token: '%LoadImage.image_name%', sample: 'image001' },
    ],
  },
]
// The picker only filters AFTER an `@` (mention-style trigger): the active query
// is the text following the LAST `@` as long as no whitespace has been typed
// since. With no active `@`, the query is '' so the user types freely and the
// picker shows everything (Figma flow — "free to type, unaffecting this picker").
const varQuery = computed(() => {
  const v = filenamePrefix.value
  const at = v.lastIndexOf('@')
  if (at < 0) return ''
  const after = v.slice(at + 1)
  return /\s/.test(after) ? '' : after
})
// Inserting a token CONSUMES the active `@query` (replaces `@wid` → `%width%`),
// like a mention autocomplete; with no active `@` it just appends.
function insertVariable(token: string) {
  const v = filenamePrefix.value
  const at = v.lastIndexOf('@')
  if (at >= 0 && !/\s/.test(v.slice(at + 1))) {
    filenamePrefix.value = v.slice(0, at) + token
  } else {
    filenamePrefix.value += token
  }
}
const varPicker = ref<InstanceType<typeof VariablePicker> | null>(null)
function onVarKeydown(e: KeyboardEvent) {
  if (open.value !== 'variable') return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    varPicker.value?.move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    varPicker.value?.move(-1)
  } else if (e.key === 'Enter' && varPicker.value?.hasRows()) {
    e.preventDefault()
    varPicker.value.activateActive()
  } else if (e.key === 'Escape') {
    open.value = null
  }
}

// SPECIAL WIDGET 2 — tags picker. Reuses the asset details panel's <TagSelector>
// so the node and the gallery share one tag-picking UI. The node has no real asset
// selection, so we adapt TagSelector's tri-state/toggle/create contract to a local
// applied-set instead of the gallery's useGalleryFilters instance.
const tagList = ref<string[]>([...ALL_TAGS]) // grows when a new tag is created here
function toggleTag(t: string) {
  const s = new Set(appliedTags.value)
  s.has(t) ? s.delete(t) : s.add(t)
  appliedTags.value = s
}
const tagState = (t: string): 'all' | 'some' | 'none' =>
  appliedTags.value.has(t) ? 'all' : 'none'
function createTagLocal(name: string) {
  if (!tagList.value.includes(name)) tagList.value = [...tagList.value, name]
  const s = new Set(appliedTags.value)
  s.add(name)
  appliedTags.value = s
  tagQuery.value = ''
}
// Drive TagSelector's keyboard nav from the input (matches AssetDetailsPanel).
const tagSelector = ref<InstanceType<typeof TagSelector> | null>(null)
function onTagKeydown(e: KeyboardEvent) {
  if (open.value !== 'tags') return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    tagSelector.value?.move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    tagSelector.value?.move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    tagSelector.value?.activateActive()
  } else if (e.key === 'Escape') {
    open.value = null
  }
}

/* ── Close any open dropdown on outside-pointerdown (capture) ─────────────── */
const rootRef = ref<HTMLElement | null>(null)
function onOutside(e: PointerEvent) {
  if (!open.value) return
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = null
}
onMounted(() => window.addEventListener('pointerdown', onOutside, true))
onBeforeUnmount(() => window.removeEventListener('pointerdown', onOutside, true))
</script>

<template>
  <div ref="rootRef" class="relative select-none" :style="{ width: `${width}px` }">
    <!-- Floating node toolbar (same as Load Image) — shown only when sole-selected. -->
    <div
      v-if="showToolbar"
      class="absolute bottom-full left-1/2 mb-2 flex h-10 -translate-x-1/2 items-center gap-1 rounded-md border border-border-default bg-base-background p-1 shadow-[1px_1px_8px_rgba(0,0,0,0.4)]"
      @pointerdown.stop
    >
      <button class="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
        <Info class="size-4" :stroke-width="1.5" />
      </button>
      <span class="h-6 w-px bg-border-default" />
      <!-- node color swatch -->
      <button class="flex h-8 items-center gap-1 rounded-md px-1.5 text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
        <span class="size-4 rounded-full bg-[#cfcfcf]" />
        <ChevronDown class="size-3" :stroke-width="1.5" />
      </button>
      <button class="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
        <Shrink class="size-4" :stroke-width="1.5" />
      </button>
      <span class="h-6 w-px bg-border-default" />
      <button class="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
        <RedoDot class="size-4" :stroke-width="1.5" />
      </button>
      <button class="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
        <RotateCw class="size-4" :stroke-width="1.5" />
      </button>
      <!-- blue Run (Play) — shown on Save Image (hidden on Load Image) -->
      <button class="flex size-8 items-center justify-center rounded-lg bg-[#0b8ce9] text-white hover:bg-[#0b8ce9]/90">
        <Play class="size-4 fill-current" :stroke-width="1.5" />
      </button>
      <span class="h-6 w-px bg-border-default" />
      <button
        class="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-button-hovered hover:text-base-foreground"
        aria-label="Delete node"
        @click="emit('delete')"
      >
        <Trash2 class="size-4" :stroke-width="1.5" />
      </button>
      <button class="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
        <EllipsisVertical class="size-4" :stroke-width="1.5" />
      </button>
    </div>

    <!-- Node body — matches the Comfy DS node (7556-90328): `secondary` body, with
         `tertiary` widgets one shade lighter and tag chips one lighter again
         (`button-hovered`); darker header strip; `node-foreground-secondary` labels. -->
    <div
      class="relative rounded-xl border bg-secondary-background shadow-[1px_1px_8px_rgba(0,0,0,0.5)]"
      :class="selected ? 'border-base-foreground' : 'border-node-border'"
    >
      <!-- Header — subtle darker strip (DS: node bg + 15% black) -->
      <div class="flex h-8 items-center gap-2 rounded-t-xl bg-black/15 px-3">
        <ChevronDown class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
        <span class="truncate text-sm font-medium text-base-foreground">Save Image</span>
      </div>

      <!-- Input socket (left edge): images -->
      <div class="relative mt-1 flex h-6 items-center pl-3">
        <span class="absolute -left-[5px] size-[10px] rounded-full bg-[#5aa9ff] ring-2 ring-base-background" />
        <span class="text-sm text-node-foreground-secondary">images</span>
      </div>

      <!-- Widgets -->
      <div class="flex flex-col gap-2 px-3 pb-3 pt-1">
        <!-- filename_prefix + variable-insert dropdown (special) -->
        <div class="flex items-center gap-3">
          <span class="w-32 shrink-0 text-sm text-node-foreground-secondary">filename_prefix</span>
          <div class="relative min-w-0 flex-1">
            <input
              v-model="filenamePrefix"
              type="text"
              placeholder="Type @ to add a variable.."
              class="h-8 w-full min-w-0 rounded-md bg-tertiary-background px-2.5 text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none"
              @pointerdown.stop
              @focus="open = 'variable'"
              @keydown="onVarKeydown"
            />
            <!-- Variable picker: sticky subheaders + arrow-key nav + @-trigger filter -->
            <VariablePicker
              v-if="open === 'variable'"
              ref="varPicker"
              class="absolute left-0 top-full z-20 mt-1 w-[360px]"
              :style="popupStyle"
              :groups="VARIABLE_GROUPS"
              :query="varQuery"
              @pointerdown.stop
              @select="insertVariable"
            />
          </div>
        </div>

        <!-- tags picker — chips live INSIDE the field, reusing AssetDetailsPanel's
             layout (filled box: wrapped chips above the input) + its <TagSelector>
             dropdown. The chips-BENEATH-the-field alternative is commented below to
             revisit later. -->
        <div class="flex items-start gap-3">
          <span class="w-32 shrink-0 pt-2 text-sm text-node-foreground-secondary">tags</span>
          <div class="relative min-w-0 flex-1">
            <!-- Filled box: `tertiary` fill (one step up from the node's `secondary`
                 body); chips `button-hovered` (one step up again) pop on it. -->
            <div class="rounded-md bg-tertiary-background px-2.5 py-1.5" @pointerdown.stop>
              <div v-if="appliedTags.size" class="flex flex-wrap gap-1">
                <span
                  v-for="t in [...appliedTags]"
                  :key="t"
                  class="flex h-5 items-center gap-1 rounded-full bg-button-hovered px-1.5 text-xs text-base-foreground"
                >
                  {{ t }}
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-base-foreground"
                    @pointerdown.stop
                    @click="toggleTag(t)"
                  >
                    <X class="size-3" :stroke-width="2" />
                  </button>
                </span>
              </div>
              <input
                v-model="tagQuery"
                type="text"
                placeholder="Add tags.."
                class="w-full min-w-0 bg-transparent text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none"
                :class="appliedTags.size ? 'mt-1.5' : ''"
                @focus="open = 'tags'"
                @keydown="onTagKeydown"
              />
            </div>
            <!-- Shared tag dropdown (same component as AssetDetailsPanel).
                 @wheel.stop so scrolling the list doesn't zoom the canvas. -->
            <!-- Fixed 240px (the standard tag-menu width — matches the context-menu
                 tag submenu + dock detail picker); intentionally not the field width. -->
            <TagSelector
              v-if="open === 'tags'"
              ref="tagSelector"
              class="absolute left-0 top-full z-20 mt-1 w-60"
              :style="popupStyle"
              :query="tagQuery"
              :tags="tagList"
              :counts="TAG_COUNTS"
              :state="tagState"
              @wheel.stop
              @toggle="toggleTag"
              @create="createTagLocal"
            />
          </div>
        </div>

        <!-- ALTERNATIVE (commented) — tags BENEATH the field. Worth revisiting if a
             below-field chip list reads better in the node context:
        <div class="flex items-start gap-2">
          <span class="w-24 shrink-0 pt-2 text-xs text-muted-foreground">tags</span>
          <div class="relative min-w-0 flex-1">
            <input
              v-model="tagQuery"
              type="text"
              placeholder="Add tags.."
              class="h-8 w-full min-w-0 rounded-md bg-tertiary-background px-2.5 text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none"
              @focus="open = 'tags'"
              @keydown="onTagKeydown"
            />
            <div v-if="appliedTags.size" class="mt-1.5 flex flex-wrap gap-1">
              <span v-for="t in [...appliedTags]" :key="t" class="flex h-5 items-center gap-1 rounded-full bg-tertiary-background px-1.5 text-xs text-base-foreground">
                {{ t }}
                <button type="button" @pointerdown.stop @click="toggleTag(t)"><X class="size-3" :stroke-width="2" /></button>
              </span>
            </div>
            <TagSelector v-if="open === 'tags'" ref="tagSelector" class="absolute left-0 right-0 top-full z-20 mt-1" :query="tagQuery" :tags="tagList" :counts="TAG_COUNTS" :state="tagState" @toggle="toggleTag" @create="createTagLocal" />
          </div>
        </div>
        -->
        <!-- No image preview: the workflow hasn't been executed, so this Save
             Image node has no output to show yet. -->
      </div>

      <!-- resize handle — drag to widen the node (min = default width) -->
      <span
        class="absolute bottom-1 right-1 size-2.5 cursor-nwse-resize rounded-sm border-b-2 border-r-2 border-node-border"
        @pointerdown.stop="onResizeStart"
      />
    </div>
  </div>
</template>
