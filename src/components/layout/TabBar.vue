<script setup lang="ts">
import { Plus, User } from 'lucide-vue-next'
import WorkflowTab from './WorkflowTab.vue'
import ThemeToggle from './ThemeToggle.vue'
import RandomizeButton from './RandomizeButton.vue'
import IconTooltip from '@/components/ui/IconTooltip.vue'
import type { TabDef } from '@/composables/useTabs'

defineProps<{
  tabs: TabDef[]
  activeId: string
  /** Show the dev "shuffle names" button (media tab only). */
  showShuffle?: boolean
}>()
defineEmits<{
  navigate: [id: string]
  close: [id: string]
  add: []
  shuffle: []
}>()
</script>

<template>
  <div
    class="flex h-9 items-center justify-between border-b border-border-default bg-workflow-tab-background shadow-floating-dark"
  >
    <!-- Left -->
    <div class="flex h-full items-center">
      <!-- Workflow tabs -->
      <WorkflowTab
        v-for="tab in tabs"
        :key="tab.id"
        :label="tab.label"
        :icon="tab.icon"
        :selected="tab.id === activeId"
        :closable="true"
        @select="$emit('navigate', tab.id)"
        @close="$emit('close', tab.id)"
      />

      <!-- Plus -->
      <IconTooltip label="New tab" side="bottom">
        <button
          type="button"
          class="flex h-full items-center border-l border-workflow-tab-border px-[18px] py-[11px] hover:bg-button-hovered"
          aria-label="New tab"
          @click="$emit('add')"
        >
          <Plus class="size-4" :stroke-width="1.5" />
        </button>
      </IconTooltip>
    </div>

    <!-- Right -->
    <div class="flex h-full items-center gap-1 pr-2">
      <RandomizeButton v-if="showShuffle" @randomize="$emit('shuffle')" />
      <!-- Global light/dark toggle — available on every page, persists to
           localStorage. -->
      <ThemeToggle />
      <div class="flex size-9 items-center justify-center">
        <div
          class="flex size-6 items-center justify-center rounded-full bg-secondary-background"
        >
          <User class="size-4" :stroke-width="1.5" />
        </div>
      </div>
    </div>
  </div>
</template>
