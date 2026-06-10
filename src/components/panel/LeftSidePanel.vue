<script setup lang="ts">
import {
  CircleHelp,
  Folder,
  Star,
  Tag as TagIcon,
  Upload,
  X,
} from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import NavItem from './NavItem.vue'
import ImageAiEditIcon from '@/components/icons/ImageAiEditIcon.vue'
import TagContextMenu from './TagContextMenu.vue'
import TagMenu, { type TagMatch, type TagSort } from './TagMenu.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { MAX_TAG_LENGTH, type Category } from '@/components/gallery/types'

const props = defineProps<{
  activeCategory: Category
  selectedTags: ReadonlySet<string>
  tags: string[]
  tagCounts: Record<string, number>
  sortMode: TagSort
  matchMode: TagMatch
}>()
const emit = defineEmits<{
  'select-category': [value: Category]
  'select-tag': [tag: string, event: MouseEvent]
  'add-tag': [name: string]
  'rename-tag': [oldName: string, newName: string]
  'delete-tag': [name: string]
  'delete-selected-tags': []
  'move-tag': [from: number, to: number]
  'set-sort': [mode: TagSort]
  'set-match': [mode: TagMatch]
}>()

const topNav: { label: string; icon: any; key: Category }[] = [
  { label: 'All', icon: Folder, key: 'all' },
  { label: 'Favorites', icon: Star, key: 'favorites' },
  { label: 'Generated', icon: ImageAiEditIcon, key: 'generated' },
  { label: 'Uploaded', icon: Upload, key: 'imported' },
]

/* Add-tag input */
const adding = ref(false)
const newTag = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const addRowRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)

// Cancel the "New tag" field when the user interacts anywhere outside it
// (a tag, a nav item, an asset, …). Listener is attached only while open, so
// the opening click on + doesn't immediately dismiss it.
function onAddOutside(e: PointerEvent) {
  if (addRowRef.value && !addRowRef.value.contains(e.target as Node)) cancel()
}
watch(adding, (open) => {
  if (open) window.addEventListener('pointerdown', onAddOutside, true)
  else window.removeEventListener('pointerdown', onAddOutside, true)
})

/**
 * Whether the tag list overflows. When it does, the scroll container is nudged
 * 6px into the right gutter (-mr-1.5) so the 6px scrollbar sits beside the rows
 * instead of shrinking them — keeping the row right edge aligned with the +
 * button in BOTH states. (scrollbar-gutter can't be used: it reserves the UA
 * default width, not the custom 6px.)
 */
const isOverflowing = ref(false)
let ro: ResizeObserver | null = null
function updateOverflow() {
  const el = scrollRef.value
  if (el) isOverflowing.value = el.scrollHeight > el.clientHeight + 1
}
onMounted(() => {
  updateOverflow()
  ro = new ResizeObserver(updateOverflow)
  if (scrollRef.value) ro.observe(scrollRef.value)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('pointerdown', onAddOutside, true)
})
watch([() => props.tags.length, adding], () => nextTick(updateOverflow))

async function startAdding() {
  adding.value = true
  await nextTick()
  scrollRef.value?.scrollTo({ top: 0 })
  inputRef.value?.focus()
}
function commit() {
  const name = newTag.value.trim()
  if (name && name.length <= MAX_TAG_LENGTH) emit('add-tag', name)
  newTag.value = '' // keep the field open so several tags can be added in a row
  inputRef.value?.focus()
}
function cancel() {
  adding.value = false
  newTag.value = ''
}

/* Right-click tag → rename / delete (single) or delete-selected (multi) */
const tagMenu = ref<{ x: number; y: number; tag: string; multiple: boolean } | null>(null)
const renaming = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

function onTagContextMenu(tag: string, e: MouseEvent) {
  e.preventDefault()
  // Multi menu when right-clicking within a multi-tag selection.
  const multiple = props.selectedTags.size > 1 && props.selectedTags.has(tag)
  tagMenu.value = { x: e.clientX, y: e.clientY, tag, multiple }
}
// Tag deletion is destructive (removes the tag from EVERY asset) → confirm first.
const tagDelete = ref<{ bulk: boolean; tag?: string; count: number } | null>(null)
function onDeleteSelectedTags() {
  tagMenu.value = null
  tagDelete.value = { bulk: true, count: props.selectedTags.size }
}
function confirmTagDelete() {
  const d = tagDelete.value
  if (!d) return
  if (d.bulk) emit('delete-selected-tags')
  else if (d.tag) emit('delete-tag', d.tag)
  tagDelete.value = null
}
async function startRename() {
  const tag = tagMenu.value?.tag
  tagMenu.value = null
  if (!tag) return
  renaming.value = tag
  renameValue.value = tag
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}
function commitRename() {
  const from = renaming.value
  const to = renameValue.value.trim()
  if (from && to && to !== from) emit('rename-tag', from, to)
  renaming.value = null
}
function cancelRename() {
  renaming.value = null
}
function onDeleteTag() {
  const tag = tagMenu.value?.tag
  tagMenu.value = null
  if (tag) tagDelete.value = { bulk: false, tag, count: props.tagCounts[tag] ?? 0 }
}

/* Drag-to-reorder tags */
const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)

function onDragStart(i: number, e: DragEvent) {
  dragFrom.value = i
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragOver(i: number) {
  if (dragFrom.value !== null) dragOver.value = i
}
function onDrop(i: number) {
  if (dragFrom.value !== null) emit('move-tag', dragFrom.value, i)
  dragFrom.value = null
  dragOver.value = null
}
function onDragEnd() {
  dragFrom.value = null
  dragOver.value = null
}
</script>

<template>
  <aside
    class="flex h-full w-56 flex-col border-r border-border-default bg-base-background px-4 pb-4 pt-3"
  >
    <!-- Header -->
    <div class="flex h-12 items-center px-4">
      <h1 class="text-base font-bold leading-tight text-base-foreground">
        Media Assets
      </h1>
    </div>

    <!-- Nav Options -->
    <div class="flex min-h-0 flex-1 flex-col gap-6 pt-3">
      <!-- Top categories -->
      <div class="flex flex-col">
        <NavItem
          v-for="item in topNav"
          :key="item.key"
          :label="item.label"
          :icon="item.icon"
          :selected="activeCategory === item.key && selectedTags.size === 0"
          @click="emit('select-category', item.key)"
        />
      </div>

      <!-- Tags collapsible (no overflow-hidden so the scrollbar can sit in the gutter) -->
      <div class="flex min-h-0 flex-1 flex-col">
        <!-- Category header (non-interactive label + combined tag options menu) -->
        <div class="flex items-center">
          <div class="flex h-10 flex-1 items-center gap-2 px-4">
            <TagIcon class="size-4 shrink-0" :stroke-width="1.5" />
            <span class="text-sm leading-normal text-base-foreground">Tags</span>
          </div>
          <TagMenu
            :mode="sortMode"
            :match-mode="matchMode"
            @add="startAdding"
            @select="emit('set-sort', $event)"
            @set-match="emit('set-match', $event)"
          />
        </div>

        <!--
          Real scroll container. overflow-y-auto = the thin scrollbar only
          shows when the list overflows. `-mr-1.5` + `scrollbar-gutter: stable`
          park the 6px scrollbar in the panel's right padding gutter, so the row
          content's right edge stays aligned with the + button (rows = 16..208,
          scrollbar = 208..214) in both scrolling and non-scrolling states.
        -->
        <div
          ref="scrollRef"
          class="flex min-h-0 flex-1 flex-col overflow-y-auto"
          :class="isOverflowing ? '-mr-1.5' : ''"
        >
          <!-- Add-tag input (aligned with the indented tag labels) -->
          <div
            v-if="adding"
            ref="addRowRef"
            class="flex h-10 min-h-10 shrink-0 items-center gap-2 rounded-lg bg-tertiary-background pl-10 pr-4"
          >
            <input
              ref="inputRef"
              v-model="newTag"
              type="text"
              placeholder="New tag"
              :maxlength="MAX_TAG_LENGTH"
              class="min-w-0 flex-1 bg-transparent text-sm leading-normal text-base-foreground placeholder:text-muted-foreground focus:outline-none"
              @keydown.enter="commit"
              @keydown.esc="cancel"
            />
            <button
              type="button"
              class="flex size-5 shrink-0 items-center justify-center text-muted-foreground hover:text-base-foreground"
              aria-label="Cancel adding tag"
              @click="cancel"
            >
              <X class="size-4" :stroke-width="1.5" />
            </button>
          </div>

          <div
            v-for="(tag, i) in tags"
            :key="tag"
            :draggable="sortMode === 'custom' && renaming !== tag"
            class="shrink-0 rounded-lg border-t-2 transition-colors"
            :class="[
              dragOver === i && dragFrom !== null && dragFrom !== i
                ? 'border-azure-600'
                : 'border-transparent',
              dragFrom === i && 'opacity-50',
            ]"
            @dragstart="onDragStart(i, $event)"
            @dragover.prevent="onDragOver(i)"
            @drop="onDrop(i)"
            @dragend="onDragEnd"
          >
            <!-- Inline rename input -->
            <div
              v-if="renaming === tag"
              class="flex h-10 min-h-10 shrink-0 items-center gap-2 rounded-lg bg-tertiary-background pl-10 pr-4"
            >
              <input
                ref="renameInputRef"
                v-model="renameValue"
                type="text"
                class="min-w-0 flex-1 bg-transparent text-sm leading-normal text-base-foreground focus:outline-none"
                @keydown.enter="commitRename"
                @keydown.esc="cancelRename"
                @blur="commitRename"
              />
            </div>
            <NavItem
              v-else
              :label="tag"
              :count="tagCounts[tag]"
              :selected="selectedTags.has(tag)"
              :indent="true"
              @click="emit('select-tag', tag, $event)"
              @contextmenu="onTagContextMenu(tag, $event)"
            />
          </div>
        </div>
      </div>

      <!-- Bottom nav -->
      <div class="flex flex-col gap-1">
        <NavItem label="Help" :icon="CircleHelp" />
      </div>
    </div>

    <Teleport to="body">
      <TagContextMenu
        v-if="tagMenu"
        :x="tagMenu.x"
        :y="tagMenu.y"
        :multiple="tagMenu.multiple"
        @rename="startRename"
        @delete="onDeleteTag"
        @delete-selected="onDeleteSelectedTags"
        @close="tagMenu = null"
      />
    </Teleport>

    <ConfirmDialog
      :open="!!tagDelete"
      :title="
        tagDelete?.bulk
          ? `Delete ${tagDelete.count} ${tagDelete.count === 1 ? 'tag' : 'tags'}?`
          : `Delete tag “${tagDelete?.tag}”?`
      "
      :description="
        tagDelete?.bulk
          ? `The selected ${tagDelete.count === 1 ? 'tag' : 'tags'} will be removed from every asset they're on. This can't be undone.`
          : `“${tagDelete?.tag}” will be removed from ${tagDelete?.count} ${tagDelete?.count === 1 ? 'asset' : 'assets'}. This can't be undone.`
      "
      destructive
      confirm-label="Delete"
      @update:open="(v: boolean) => { if (!v) tagDelete = null }"
      @confirm="confirmTagDelete"
    />
  </aside>
</template>
