import { computed, markRaw, ref, type Component } from 'vue'
import ImageAiEditIcon from '@/components/icons/ImageAiEditIcon.vue'

export interface TabDef {
  id: string
  label: string
  icon?: Component
  /**
   * 'media'    → the gallery
   * 'workflow' → the ComfyUI workflow editor
   * 'blank'    → empty placeholder page
   */
  kind: 'media' | 'workflow' | 'blank'
}

/**
 * Tab strip. No browser-style history (that conflicts with ComfyUI's tabs).
 * Instead we remember the workflow tab the user came from before opening Media
 * Assets, so closing it (or the in-page "back" button) returns there.
 *
 * Module-level state = a shared singleton, so the gallery / dock context menus
 * ("Insert into workflow", "Open as workflow in new tab") can drive the same
 * tab strip that App.vue renders without prop-drilling.
 */
const tabs = ref<TabDef[]>([
  { id: 'media', label: 'Media Assets', icon: markRaw(ImageAiEditIcon), kind: 'media' },
  { id: 'tab-1', label: 'Tab', kind: 'blank' },
  { id: 'tab-2', label: 'Tab', kind: 'blank' },
  { id: 'workflow', label: 'Unsaved workflow (1)', kind: 'workflow' },
  { id: 'workflow-2', label: 'Save Image Demo', kind: 'workflow' },
])
const activeId = ref('media')
// The workflow tab to return to from Media Assets (set when we leave one for it).
const returnToId = ref<string | null>(null)
let counter = 0

const activeTab = computed(() => tabs.value.find((t) => t.id === activeId.value) ?? tabs.value[0]!)

/** Workflow tab to return to: the remembered one (wherever you came from), else
 *  default to the first WORKFLOW tab ("Unsaved workflow (1)") so a fresh load
 *  still shows a sensible back target (not the blank "Tab"). */
const returnTab = computed(() => {
  const remembered = tabs.value.find((t) => t.id === returnToId.value && t.kind !== 'media')
  return remembered ?? tabs.value.find((t) => t.kind === 'workflow') ?? null
})

function navigate(id: string) {
  if (id === activeId.value) return
  // Remember which workflow we were on when jumping into Media Assets.
  if (id === 'media' && activeTab.value.kind !== 'media') returnToId.value = activeId.value
  activeId.value = id
}

/**
 * Open (or focus) the single Media Assets tab. Closing it removes it from the
 * strip, so the dock's "Open" button must be able to recreate it — but there is
 * only ever ONE, so reuse it if it's still around. Recreated at the front to
 * restore its original leftmost slot. `navigate` handles remembering the
 * workflow we came from.
 */
function openMedia() {
  if (!tabs.value.some((t) => t.kind === 'media')) {
    tabs.value.unshift({
      id: 'media',
      label: 'Media Assets',
      icon: markRaw(ImageAiEditIcon),
      kind: 'media',
    })
  }
  navigate('media')
}

/** Return from Media Assets to the previous workflow tab. */
function backToWorkflow() {
  const t = returnTab.value
  if (t) activeId.value = t.id
}

function addTab() {
  const id = `tab-${++counter}-${Date.now()}`
  tabs.value.push({ id, label: 'Untitled', kind: 'blank' })
  navigate(id)
}

/**
 * "Open as workflow in new tab" (context menu): one new tab per asset, labeled
 * with the asset name. Kept as empty `blank` tabs for demonstration; lands on the
 * first one created.
 */
function openAssetWorkflows(names: string[]) {
  if (!names.length) return
  const firstId = `tab-${++counter}-${Date.now()}`
  let firstAdded: string | null = null
  names.forEach((name, i) => {
    const id = i === 0 ? firstId : `tab-${++counter}-${Date.now()}-${i}`
    tabs.value.push({ id, label: name, kind: 'blank' })
    if (!firstAdded) firstAdded = id
  })
  if (firstAdded) navigate(firstAdded)
}

function closeTab(id: string) {
  if (tabs.value.length <= 1) return // always keep at least one tab
  const i = tabs.value.findIndex((t) => t.id === id)
  if (i < 0) return
  const wasActive = id === activeId.value
  const wasMedia = tabs.value[i]!.kind === 'media'
  tabs.value.splice(i, 1)
  if (returnToId.value === id) returnToId.value = null

  if (wasActive) {
    // Closing Media Assets returns to the previous workflow; otherwise pick a neighbor.
    activeId.value =
      wasMedia && returnTab.value ? returnTab.value.id : tabs.value[Math.max(0, i - 1)]!.id
  }
}

export function useTabs() {
  return {
    tabs,
    activeId,
    activeTab,
    returnTab,
    navigate,
    openMedia,
    backToWorkflow,
    addTab,
    openAssetWorkflows,
    closeTab,
  }
}
