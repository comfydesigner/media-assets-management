<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Grid2x2, Grid3x3, List, Settings2 } from 'lucide-vue-next'
import { PopoverRoot, PopoverAnchor, PopoverPortal, PopoverContent } from 'reka-ui'
import Menu from '@/components/ui/Menu.vue'
import MenuItem from '@/components/ui/MenuItem.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import TooltipTrigger from '@/components/ui/TooltipTrigger.vue'
import TooltipContent from '@/components/ui/TooltipContent.vue'
import IconTooltip from '@/components/ui/IconTooltip.vue'
import { SORT_LABELS, type DockLayout, type SortOrder, type ViewOptions } from './types'

const props = withDefaults(
  defineProps<{
    sortOrder: SortOrder
    viewOptions: ViewOptions
    browse?: boolean
    /** Include the sort options at the top (when the standalone sort dropdown
     *  is collapsed away, or in the dock which has no separate sort control). */
    showSort?: boolean
    /** Include the Layout radios (Grid / Masonry Row / Masonry Column). Gallery
     *  tab only — the dock has a single fixed layout. */
    showLayout?: boolean
    mode?: 'manage' | 'browse'
    /** Browse-mode masonry orientation (drives the two Masonry radios). */
    masonryAxis?: 'row' | 'column'
    variant?: 'header' | 'dock'
    /** Dock only: List / Grid: Small / Grid: Large view mode (Figma 1780-35593).
     *  The gallery uses the header size slider + Grid/Masonry instead. */
    dockLayout?: DockLayout
  }>(),
  {
    browse: false,
    showSort: false,
    showLayout: false,
    mode: 'manage',
    masonryAxis: 'row',
    variant: 'header',
  },
)
const emit = defineEmits<{
  'update:sortOrder': [value: SortOrder]
  'update:viewOptions': [value: ViewOptions]
  'update:mode': [value: 'manage' | 'browse']
  'update:masonryAxis': [value: 'row' | 'column']
  'update:dockLayout': [value: DockLayout]
}>()

// Select a gallery-tab layout: Grid (manage) or one of the two browse masonries.
function selectLayout(layout: 'grid' | 'masonry-row' | 'masonry-column') {
  if (layout === 'grid') {
    emit('update:mode', 'manage')
  } else {
    emit('update:mode', 'browse')
    emit('update:masonryAxis', layout === 'masonry-column' ? 'column' : 'row')
  }
}

// Dock view modes (single-choice). Colon labels match the gallery's "Layout: …".
const LAYOUTS = [
  { value: 'list' as const, label: 'List', icon: List },
  { value: 'grid-small' as const, label: 'Grid: Small', icon: Grid3x3 },
  { value: 'grid-large' as const, label: 'Grid: Large', icon: Grid2x2 },
]

const ORDER: SortOrder[] = ['newest', 'oldest', 'az', 'za']

// Controlled open: the button's own @click toggles it. (Chaining a reka
// TooltipTrigger AND PopoverTrigger onto one element via double `as-child`
// swallowed the click in reka-vue, so the menu never opened — drive it
// explicitly and use a PopoverAnchor purely for positioning.)
const open = ref(false)
const btnRef = ref<HTMLElement | null>(null)

// Because the trigger isn't a real reka PopoverTrigger, reka's dismiss layer
// treats a click on it (while open) as "outside" and closes the popover on
// pointer-down — then the @click below would immediately REOPEN it. Record when
// it closes and skip the reopen if the click is the very one that just closed it,
// so clicking the trigger toggles (closes) instead of flickering back open.
let closedAt = 0
watch(open, (v) => {
  if (!v) closedAt = Date.now()
})
function onTriggerClick() {
  if (Date.now() - closedAt < 250) return // this click just closed it → stay closed
  open.value = true
}

function toggle<K extends keyof ViewOptions>(key: K) {
  emit('update:viewOptions', { ...props.viewOptions, [key]: !props.viewOptions[key] })
}

// List view is inherently a name+meta row, so the two metadata toggles are locked
// ON (the AssetListRow always shows them) — shown disabled with a tooltip.
const nameDetailsLocked = computed(() => props.variant === 'dock' && props.dockLayout === 'list')

const triggerClass = computed(() =>
  props.variant === 'dock'
    ? 'flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary-background text-muted-foreground transition-colors hover:bg-button-hovered hover:text-base-foreground focus:outline-none'
    : 'flex size-10 items-center justify-center rounded-lg border border-border-default transition-colors hover:bg-secondary-background focus:outline-none',
)
</script>

<template>
  <PopoverRoot v-model:open="open">
    <!-- "Views" tooltip + popover share the Settings2 button. Only ONE component
         takes the button via `as-child` (the tooltip) — chaining a second
         (Popover trigger/anchor) broke reka's ref forwarding and the menu opened
         off-screen. The popover is opened by the button's own @click and
         positioned via a PopoverAnchor that references the button by ref. -->
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          ref="btnRef"
          type="button"
          :class="triggerClass"
          aria-label="Views"
          @click="onTriggerClick"
        >
          <Settings2 class="size-4" :stroke-width="1.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent :side="variant === 'dock' ? 'bottom' : 'top'">Views</TooltipContent>
    </Tooltip>
    <!-- Virtual anchor (positions off btnRef). `hidden` so its rendered element
         doesn't sit in the flex row and push the trigger button off the edge. -->
    <PopoverAnchor :reference="btnRef || undefined" class="hidden" />

    <PopoverPortal>
      <PopoverContent align="end" :side-offset="4" class="z-50 w-64 outline-none">
        <Menu>
          <!-- Dock view modes: List / Grid: Small / Grid: Large (Figma 1780-35593).
               Small & Large are two distinct responsive sizes (min/max breakpoints,
               see DOCK_SIZE_BREAKPOINTS), not fixed column counts. -->
          <template v-if="variant === 'dock'">
            <MenuItem
              v-for="l in LAYOUTS"
              :key="l.value"
              :checked="l.value === dockLayout"
              :reserve-trailing="true"
              @select="emit('update:dockLayout', l.value)"
            >
              <template #leading>
                <component :is="l.icon" class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
              </template>
              {{ l.label }}
            </MenuItem>
            <div class="my-1 h-px w-full shrink-0 bg-border-subtle" />
          </template>

          <template v-if="showSort">
            <MenuItem
              v-for="opt in ORDER"
              :key="opt"
              :checked="opt === sortOrder"
              :reserve-trailing="true"
              @select="emit('update:sortOrder', opt)"
            >
              {{ SORT_LABELS[opt] }}
            </MenuItem>
            <div class="my-1 h-px w-full shrink-0 bg-border-subtle" />
          </template>

          <!-- Layout (gallery tab only): single-choice Grid / Masonry (Row) /
               Masonry (Column). The two masonry rows both put the gallery in
               Browse mode; they differ in orientation (justified rows vs
               balanced columns). -->
          <template v-if="showLayout">
            <MenuItem
              :checked="mode === 'manage'"
              :reserve-trailing="true"
              @select="selectLayout('grid')"
            >
              Layout: Grid
            </MenuItem>
            <MenuItem
              :checked="mode === 'browse' && masonryAxis === 'row'"
              :reserve-trailing="true"
              @select="selectLayout('masonry-row')"
            >
              Layout: Masonry (Row)
            </MenuItem>
            <MenuItem
              :checked="mode === 'browse' && masonryAxis === 'column'"
              :reserve-trailing="true"
              @select="selectLayout('masonry-column')"
            >
              Layout: Masonry (Column)
            </MenuItem>
            <div class="my-1 h-px w-full shrink-0 bg-border-subtle" />
          </template>

          <!-- Grouping is a management concern — hidden in Browse mode. -->
          <MenuItem
            v-if="!browse"
            :checked="viewOptions.groupByJob"
            :reserve-trailing="true"
            @select="toggle('groupByJob')"
          >
            Group assets by job
          </MenuItem>
          <MenuItem
            :checked="viewOptions.showPreviews"
            :reserve-trailing="true"
            @select="toggle('showPreviews')"
          >
            Show preview assets
          </MenuItem>

          <!-- Metadata visibility: two independent toggles. Placement is derived
               from the layout (Grid → below the tile · Masonry → hover overlay).
               In the dock's LIST view they're locked ON (a list row is name+meta by
               definition) — shown disabled with a tooltip explaining why. -->
          <div class="my-1 h-px w-full shrink-0 bg-border-subtle" />
          <template v-if="nameDetailsLocked">
            <IconTooltip label="Always shown in list view" side="left">
              <MenuItem :checked="true" :reserve-trailing="true" disabled>Show file name</MenuItem>
            </IconTooltip>
            <IconTooltip label="Always shown in list view" side="left">
              <MenuItem :checked="true" :reserve-trailing="true" disabled>Show file details</MenuItem>
            </IconTooltip>
          </template>
          <template v-else>
            <MenuItem
              :checked="viewOptions.showName"
              :reserve-trailing="true"
              @select="toggle('showName')"
            >
              Show file name
            </MenuItem>
            <MenuItem
              :checked="viewOptions.showDetails"
              :reserve-trailing="true"
              @select="toggle('showDetails')"
            >
              Show file details
            </MenuItem>
          </template>
        </Menu>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
