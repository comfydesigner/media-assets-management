<script setup lang="ts">
import { ArrowUpDown, ChevronDown } from 'lucide-vue-next'
import { PopoverRoot, PopoverAnchor, PopoverPortal, PopoverContent } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import Menu from '@/components/ui/Menu.vue'
import MenuItem from '@/components/ui/MenuItem.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import TooltipTrigger from '@/components/ui/TooltipTrigger.vue'
import TooltipContent from '@/components/ui/TooltipContent.vue'
import { SORT_LABELS, type SortOrder } from './types'

defineProps<{ modelValue: SortOrder; iconOnly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: SortOrder] }>()

const ORDER: SortOrder[] = ['newest', 'oldest', 'az', 'za']

// Widest option label — rendered invisibly as a sizer so the trigger hugs its
// content (minimum width that fits any label) yet never jumps width when the
// selected sort changes.
const longestLabel = computed(() =>
  ORDER.map((o) => SORT_LABELS[o]).reduce((a, b) => (b.length > a.length ? b : a), ''),
)

// Controlled open (mirrors ViewsMenu): chaining a reka TooltipTrigger AND
// PopoverTrigger onto one element via double `as-child` swallows the click, so the
// tooltip takes the button and the popover is opened by @click + positioned via a
// virtual PopoverAnchor.
const open = ref(false)
const btnRef = ref<HTMLElement | null>(null)
let closedAt = 0
watch(open, (v) => {
  if (!v) closedAt = Date.now()
})
function onTriggerClick() {
  if (Date.now() - closedAt < 250) return // this click just closed it → stay closed
  open.value = true
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <Tooltip>
      <TooltipTrigger as-child>
        <!-- ONE stable trigger element — only the INNER content swaps between the
             icon-only (narrow header) and labeled forms, so reka's popper anchor
             stays bound to the same node when `iconOnly` flips on resize. -->
        <button
          ref="btnRef"
          type="button"
          :aria-label="iconOnly ? 'Sort by' : undefined"
          class="flex h-10 shrink-0 items-center rounded-lg border border-[var(--stroke)] hover:bg-secondary-background focus:outline-none"
          :class="iconOnly ? 'w-10 justify-center' : 'w-fit'"
          @click="onTriggerClick"
        >
          <ArrowUpDown v-if="iconOnly" class="size-4" :stroke-width="1.5" />
          <template v-else>
            <div class="flex h-full items-center gap-2 py-2 pl-4">
              <ArrowUpDown class="size-4 shrink-0" :stroke-width="1.5" />
              <!-- grid stack: the invisible sizer fixes the width to the longest label -->
              <span class="grid text-left text-sm leading-normal text-base-foreground">
                <span
                  class="col-start-1 row-start-1 whitespace-nowrap invisible"
                  aria-hidden="true"
                >
                  {{ longestLabel }}
                </span>
                <span class="col-start-1 row-start-1 truncate">
                  {{ SORT_LABELS[modelValue] }}
                </span>
              </span>
            </div>
            <div class="flex h-full w-8 items-center justify-center p-2">
              <ChevronDown class="size-4" :stroke-width="1.5" />
            </div>
          </template>
        </button>
      </TooltipTrigger>
      <!-- Only when collapsed to an icon — the labeled form is self-explanatory. -->
      <TooltipContent v-if="iconOnly" side="bottom">Sort by</TooltipContent>
    </Tooltip>

    <!-- Virtual anchor positions the popover off the button (hidden so it doesn't
         occupy a slot in the header flex row). -->
    <PopoverAnchor :reference="btnRef || undefined" class="hidden" />

    <PopoverPortal>
      <PopoverContent align="end" :side-offset="4" class="z-50 w-64 outline-none">
        <Menu>
          <MenuItem
            v-for="opt in ORDER"
            :key="opt"
            :checked="opt === modelValue"
            :reserve-trailing="true"
            @select="emit('update:modelValue', opt)"
          >
            {{ SORT_LABELS[opt] }}
          </MenuItem>
        </Menu>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
