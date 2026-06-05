<script setup lang="ts">
import {
  ChevronDown,
  EllipsisVertical,
  Folder,
  Info,
  RedoDot,
  RotateCw,
  Shrink,
  Trash2,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { placeholderBg } from '../gallery/placeholder'
import { useNodeResize } from '@/composables/useNodeResize'

const props = defineProps<{
  selected?: boolean
  showToolbar?: boolean
  name?: string
  /** Canvas zoom — keeps the resize handle tracking the cursor 1:1. */
  zoom?: number
}>()

const emit = defineEmits<{ delete: [] }>()

const fileName = computed(() => props.name || 'image01.png')

// Bottom-right handle resizes the node WIDTH (min = current size).
const { width, onResizeStart } = useNodeResize(() => props.zoom ?? 1)
</script>

<template>
  <div class="relative select-none" :style="{ width: `${width}px` }">
    <!-- Floating node toolbar — centered above the node. Shown only when this is
         the SOLE selected node; a multi-selection shows one shared group toolbar
         (rendered by the canvas) instead. -->
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
      <!-- redo / rotate. The blue Run (Play) button is hidden for Load Image. -->
      <button class="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
        <RedoDot class="size-4" :stroke-width="1.5" />
      </button>
      <button class="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
        <RotateCw class="size-4" :stroke-width="1.5" />
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

    <!-- Node body — matches the Comfy DS node (7556-90328): `secondary` body with
         `tertiary` widgets one shade lighter, a darker header strip, and
         `node-foreground-secondary` (#b4b4b4) socket/widget labels. -->
    <div
      class="relative rounded-xl border bg-secondary-background shadow-[1px_1px_8px_rgba(0,0,0,0.5)]"
      :class="selected ? 'border-base-foreground' : 'border-node-border'"
    >
      <!-- Header — subtle darker strip (DS: node bg + 15% black) -->
      <div class="flex h-8 items-center gap-2 rounded-t-xl bg-black/15 px-3">
        <ChevronDown class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.5" />
        <span class="truncate text-sm font-medium text-base-foreground">Load Image</span>
      </div>

      <!-- Output sockets (right edge): IMAGE, MASK -->
      <div class="flex flex-col gap-1 pb-1 pt-1">
        <div class="relative flex h-6 items-center justify-end pr-3">
          <span class="text-sm text-node-foreground-secondary">IMAGE</span>
          <span class="absolute -right-[5px] size-[10px] rounded-full bg-[#5aa9ff] ring-2 ring-base-background" />
        </div>
        <div class="relative flex h-6 items-center justify-end pr-3">
          <span class="text-sm text-node-foreground-secondary">MASK</span>
          <span class="absolute -right-[5px] size-[10px] rounded-full bg-[#7ed957] ring-2 ring-base-background" />
        </div>
      </div>

      <!-- Widgets -->
      <div class="flex flex-col gap-2 px-3 pb-3">
        <!-- image select widget -->
        <div class="flex items-center gap-2">
          <span class="w-12 shrink-0 text-sm text-node-foreground-secondary">image</span>
          <button
            class="flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-md bg-tertiary-background px-2.5 text-sm text-base-foreground hover:bg-button-hovered"
          >
            <span class="truncate">{{ fileName }}</span>
            <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" :stroke-width="1.5" />
          </button>
          <button class="flex size-8 shrink-0 items-center justify-center rounded-md bg-tertiary-background text-muted-foreground hover:bg-button-hovered hover:text-base-foreground">
            <Folder class="size-4" :stroke-width="1.5" />
          </button>
        </div>

        <!-- image preview -->
        <div class="relative overflow-hidden rounded-md">
          <div
            class="aspect-square w-full"
            :style="
              name
                ? placeholderBg(name)
                : { backgroundImage: 'linear-gradient(to bottom, #c9966a 0%, #b98a6e 18%, #8a93a0 42%, #59636f 52%, #6e7a86 70%, #b58f6e 100%)' }
            "
          />
          <span
            class="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-base-foreground/90"
          >
            512 × 512
          </span>
        </div>
      </div>

      <!-- resize handle -->
      <span
        class="absolute bottom-1 right-1 size-2.5 cursor-nwse-resize rounded-sm border-b-2 border-r-2 border-node-border"
        @pointerdown.stop="onResizeStart"
      />
    </div>
  </div>
</template>
