<script setup lang="ts">
import { ChevronDown, HelpCircle, History, Keyboard, Settings, SquareTerminal } from 'lucide-vue-next'
import ComfyLogoIcon from '@/components/icons/ComfyLogoIcon.vue'
import ImageAiEditIcon from '@/components/icons/ImageAiEditIcon.vue'
import NodeIcon from '@/components/icons/NodeIcon.vue'
import AiModelIcon from '@/components/icons/AiModelIcon.vue'
import WorkflowIcon from '@/components/icons/WorkflowIcon.vue'
import TemplateIcon from '@/components/icons/TemplateIcon.vue'

// Sidebar order matches Figma 2345-53812. Top: history · image-ai-edit · node ·
// ai-model · workflow · template (image-ai-edit / media is the active item). The
// custom icons (image-ai-edit / node / ai-model / workflow / template / the C
// logo) live in src/assets/icons/sidebar and are inlined as the components in
// src/components/icons; `history` + the bottom four are standard lucide.
const topIcons = [History, ImageAiEditIcon, NodeIcon, AiModelIcon, WorkflowIcon, TemplateIcon]
const bottomIcons = [HelpCircle, Keyboard, SquareTerminal, Settings]
</script>

<template>
  <div
    class="flex w-14 shrink-0 flex-col items-center justify-between border-r border-border-default bg-base-background py-3"
  >
    <div class="flex flex-col items-center gap-1">
      <!-- Comfy logo mark + workspace chevron (Figma "C_Button"). The C is
           centered on the rail (aligned with the nav icons below); the chevron is
           an absolute adornment pulled in from the right so the C stays centered
           and the chevron doesn't drift to the edge. -->
      <button
        class="relative mb-1 flex h-9 w-11 items-center justify-center rounded-lg text-base-foreground transition-colors hover:bg-button-hovered"
        aria-label="Workspace"
      >
        <ComfyLogoIcon class="h-3.5 w-auto" />
        <ChevronDown
          class="pointer-events-none absolute right-0.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
          :stroke-width="1.5"
        />
      </button>
      <button
        v-for="(Icon, i) in topIcons"
        :key="i"
        class="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-button-hovered"
        :class="
          i === 1
            ? 'bg-button-hovered text-base-foreground'
            : 'text-muted-foreground hover:text-base-foreground'
        "
      >
        <component :is="Icon" class="size-[18px]" :stroke-width="1.5" />
      </button>
    </div>

    <div class="flex flex-col items-center gap-1">
      <button
        v-for="(Icon, i) in bottomIcons"
        :key="i"
        class="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-button-hovered hover:text-base-foreground"
      >
        <component :is="Icon" class="size-[18px]" :stroke-width="1.5" />
      </button>
    </div>
  </div>
</template>
