<script setup lang="ts">
import { Plus, Settings2 } from 'lucide-vue-next'
import { PopoverRoot, PopoverAnchor, PopoverPortal, PopoverContent } from 'reka-ui'
import { ref } from 'vue'
import Menu from '@/components/ui/Menu.vue'
import MenuItem from '@/components/ui/MenuItem.vue'
import IconTooltip from '@/components/ui/IconTooltip.vue'

export type TagSort = 'custom' | 'alpha'
export type TagMatch = 'all' | 'any'

defineProps<{ mode: TagSort; matchMode: TagMatch }>()
const emit = defineEmits<{
  add: []
  select: [mode: TagSort]
  'set-match': [mode: TagMatch]
}>()

// Combined "tag options" menu: Add tags + sort mode + multi-tag match mode,
// behind a single button.
const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
// Add tags starts the inline add-tag input in the panel, so the menu must get out
// of the way → close. Sort / Match are quick toggles (like the Views menu) — leave
// the menu OPEN so several can be flipped without reopening it each time.
function addTags() {
  open.value = false
  emit('add')
}
function select(mode: TagSort) {
  emit('select', mode)
}
function selectMatch(mode: TagMatch) {
  emit('set-match', mode)
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <!-- Controlled open via the button's own @click + a PopoverAnchor for
         positioning. Chaining PopoverTrigger inside IconTooltip's TooltipTrigger
         (double `as-child`) breaks reka's click forwarding → the button did
         nothing (same fix as ViewsMenu). -->
    <IconTooltip label="Tag options" side="bottom">
      <button
        ref="triggerRef"
        type="button"
        class="flex h-10 items-center justify-center rounded-lg px-3 py-2 hover:bg-button-hovered focus:outline-none"
        aria-label="Tag options"
        @click="open = !open"
      >
        <Settings2 class="size-4" :stroke-width="1.5" />
      </button>
    </IconTooltip>
    <PopoverAnchor :reference="triggerRef || undefined" class="hidden" />
    <PopoverPortal>
      <PopoverContent align="start" :side-offset="4" class="z-50 w-64 outline-none">
        <Menu>
          <!-- Add tags (with trailing +) -->
          <button
            type="button"
            class="flex h-8 min-h-6 w-full shrink-0 items-center gap-2 rounded-sm p-2 text-left hover:bg-secondary-background focus:outline-none"
            @click="addTags"
          >
            <span class="min-w-0 flex-1 truncate text-sm leading-normal text-base-foreground">
              Add tags
            </span>
            <Plus class="size-4 shrink-0 text-base-foreground" :stroke-width="1.5" />
          </button>

          <div class="h-px w-full shrink-0 bg-border-subtle" />

          <MenuItem
            :checked="mode === 'custom'"
            :reserve-trailing="true"
            @select="select('custom')"
          >
            Sort by custom
          </MenuItem>
          <MenuItem
            :checked="mode === 'alpha'"
            :reserve-trailing="true"
            @select="select('alpha')"
          >
            Sort by alphabet (A → Z)
          </MenuItem>

          <!-- How multiple selected tags combine (mirrors the chip-row toggle). -->
          <div class="h-px w-full shrink-0 bg-border-subtle" />
          <MenuItem
            :checked="matchMode === 'all'"
            :reserve-trailing="true"
            @select="selectMatch('all')"
          >
            Match all
          </MenuItem>
          <MenuItem
            :checked="matchMode === 'any'"
            :reserve-trailing="true"
            @select="selectMatch('any')"
          >
            Match any
          </MenuItem>
        </Menu>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
