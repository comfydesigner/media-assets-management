<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Check, CircleAlert, Minus, Plus, Tag as TagIcon } from 'lucide-vue-next'
import { MAX_TAG_LENGTH } from './types'

const props = defineProps<{
  /** Query text (owned by the parent's input). */
  query: string
  /** Ordered tag list to choose from. */
  tags: string[]
  /** Global per-tag counts ("N assets"). */
  counts: Record<string, number>
  /** Tri-state of a tag across the current selection. */
  state: (tag: string) => 'all' | 'some' | 'none'
  /** Render just the list (no border/shadow), e.g. inside a popover. */
  bare?: boolean
  /** Grow-to-content (resizes while filtering) instead of bare's fixed height —
   *  matches the context-menu tag submenu. */
  grow?: boolean
}>()
const emit = defineEmits<{ toggle: [tag: string]; create: [name: string] }>()

const q = computed(() => props.query.trim().toLowerCase())
const matches = computed(() =>
  props.tags.filter((t) => !q.value || t.toLowerCase().includes(q.value)),
)
// Applied (all/some) first, then a divider, then the rest — like the context-menu
// submenu. The applied/unapplied PARTITION is frozen on open (toggling a tag flips
// its checkmark in place rather than jarringly jumping it between groups); the
// regrouping happens next time the dropdown is opened.
const frozenApplied = ref<Set<string>>(new Set())
function snapshotGroups() {
  frozenApplied.value = new Set(props.tags.filter((t) => props.state(t) !== 'none'))
}
onMounted(snapshotGroups)
const applied = computed(() => matches.value.filter((t) => frozenApplied.value.has(t)))
const unapplied = computed(() => matches.value.filter((t) => !frozenApplied.value.has(t)))
const exactExists = computed(() => props.tags.some((t) => t.toLowerCase() === q.value))
const showCreate = computed(() => q.value.length > 0 && !exactExists.value)
// A typed name longer than the cap can't be created (Figma 2166-99383).
const overLimit = computed(() => props.query.trim().length > MAX_TAG_LENGTH)

// Flat actionable rows for keyboard nav.
type Row = { kind: 'tag'; tag: string } | { kind: 'create'; name: string }
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  applied.value.forEach((t) => out.push({ kind: 'tag', tag: t }))
  unapplied.value.forEach((t) => out.push({ kind: 'tag', tag: t }))
  if (showCreate.value) out.push({ kind: 'create', name: props.query.trim() })
  return out
})

const active = ref(0)
watch(() => props.query, () => (active.value = 0))
watch(rows, () => {
  if (active.value > rows.value.length - 1) active.value = Math.max(0, rows.value.length - 1)
})

function move(delta: number) {
  const n = rows.value.length
  if (n) active.value = (active.value + delta + n) % n
}
function activateActive() {
  fire(rows.value[active.value])
}
function createTag(name: string) {
  if (overLimit.value) return // over the character cap — can't create
  frozenApplied.value.add(name) // show the new tag in place (applied group)
  emit('create', name)
}
function fire(r: Row | undefined) {
  if (!r) return
  if (r.kind === 'create') createTag(r.name)
  else emit('toggle', r.tag)
}
defineExpose({ move, activateActive, hasRows: () => rows.value.length > 0 })

const activeRow = computed(() => rows.value[active.value])
const isTagActive = (tag: string) =>
  activeRow.value?.kind === 'tag' && activeRow.value.tag === tag
const isCreateActive = computed(() => activeRow.value?.kind === 'create')
</script>

<template>
  <div
    :class="
      bare
        ? ''
        : 'overflow-hidden rounded-lg border border-border-default bg-base-background py-1 shadow-[var(--shadow-floating-dark)]'
    "
  >
    <!-- bare (popover): fixed height so the menu doesn't resize while filtering;
         inline (details panel): grow-to-content up to a max. -->
    <div
      class="overflow-y-auto py-1"
      :class="bare ? (grow ? 'max-h-80 px-2' : 'h-80 px-2') : 'max-h-64 px-1'"
    >
      <!-- Applied (all / some) -->
      <button
        v-for="t in applied"
        :key="`a-${t}`"
        type="button"
        class="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
        :class="isTagActive(t) ? 'bg-secondary-background' : ''"
        @mousedown.prevent
        @mousemove="active = rows.findIndex((r) => r.kind === 'tag' && r.tag === t)"
        @click="emit('toggle', t)"
      >
        <TagIcon class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
        <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">{{ t }}</span>
        <span v-if="counts[t]" class="shrink-0 text-sm leading-normal text-muted-foreground">
          {{ counts[t] }} {{ counts[t] === 1 ? 'asset' : 'assets' }}
        </span>
        <Check
          v-if="state(t) === 'all'"
          class="size-4 shrink-0 text-base-foreground"
          :stroke-width="1.5"
        />
        <Minus
          v-else-if="state(t) === 'some'"
          class="size-4 shrink-0 text-muted-foreground"
          :stroke-width="1.5"
        />
      </button>

      <div
        v-if="applied.length && (unapplied.length || showCreate)"
        class="my-1 h-px w-full bg-border-subtle"
      />

      <!-- Unapplied -->
      <button
        v-for="t in unapplied"
        :key="`u-${t}`"
        type="button"
        class="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors"
        :class="isTagActive(t) ? 'bg-secondary-background' : ''"
        @mousedown.prevent
        @mousemove="active = rows.findIndex((r) => r.kind === 'tag' && r.tag === t)"
        @click="emit('toggle', t)"
      >
        <TagIcon class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
        <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">{{ t }}</span>
        <span v-if="counts[t]" class="shrink-0 text-sm leading-normal text-muted-foreground">
          {{ counts[t] }} {{ counts[t] === 1 ? 'asset' : 'assets' }}
        </span>
        <!-- Tri-state shows in place when a frozen-unapplied tag is toggled on. -->
        <Check
          v-if="state(t) === 'all'"
          class="size-4 shrink-0 text-base-foreground"
          :stroke-width="1.5"
        />
        <Minus
          v-else-if="state(t) === 'some'"
          class="size-4 shrink-0 text-muted-foreground"
          :stroke-width="1.5"
        />
      </button>

      <!-- Create (disabled + dimmed past the character cap — Figma 2166-99383) -->
      <button
        v-if="showCreate"
        type="button"
        :disabled="overLimit"
        class="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        :class="isCreateActive && !overLimit ? 'bg-secondary-background' : ''"
        @mousedown.prevent
        @mousemove="active = rows.length - 1"
        @click="createTag(query.trim())"
      >
        <Plus class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
        <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">
          Add “{{ query.trim() }}” as a tag
        </span>
      </button>
      <!-- Character-limit warning -->
      <div
        v-if="showCreate && overLimit"
        class="flex items-center gap-2 px-2 py-1.5 text-sm leading-normal text-amber-500"
      >
        <CircleAlert class="size-4 shrink-0" :stroke-width="1.5" />
        Max character limit reached
      </div>

      <div v-if="rows.length === 0" class="px-2 py-1.5 text-sm text-muted-foreground">
        No matching tags
      </div>
    </div>
  </div>
</template>
