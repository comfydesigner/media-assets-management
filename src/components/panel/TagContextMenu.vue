<script setup lang="ts">
import { Pencil, Trash2 } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ x: number; y: number; multiple: boolean }>()
const emit = defineEmits<{ rename: []; delete: []; deleteSelected: []; close: [] }>()

const menuRef = ref<HTMLElement | null>(null)
const pos = ref({ left: props.x, top: props.y })

function close() {
  emit('close')
}
function onOutside(e: PointerEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) close()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(async () => {
  await nextTick()
  const el = menuRef.value
  if (el) {
    const M = 8
    pos.value = {
      left: Math.min(props.x, window.innerWidth - el.offsetWidth - M),
      top: Math.min(props.y, window.innerHeight - el.offsetHeight - M),
    }
  }
  window.addEventListener('pointerdown', onOutside, true)
  window.addEventListener('keydown', onKey)
  window.addEventListener('scroll', close, true)
  window.addEventListener('resize', close)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
})
</script>

<template>
  <div
    ref="menuRef"
    class="fixed z-50 flex w-48 flex-col items-start gap-1 overflow-hidden rounded-lg border border-border-default bg-base-background p-1 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.6)]"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
    @contextmenu.prevent
  >
    <!-- Multiple tags selected -->
    <button
      v-if="multiple"
      type="button"
      class="flex h-8 w-full items-center gap-2 rounded-sm p-2 text-left transition-colors hover:bg-secondary-background focus:outline-none"
      @click="$emit('deleteSelected')"
    >
      <Trash2 class="size-4 shrink-0 text-base-foreground" :stroke-width="1.5" />
      <span class="text-sm leading-normal text-base-foreground">Delete selected tags</span>
    </button>

    <!-- Single tag -->
    <template v-else>
      <button
        type="button"
        class="flex h-8 w-full items-center gap-2 rounded-sm p-2 text-left transition-colors hover:bg-secondary-background focus:outline-none"
        @click="$emit('rename')"
      >
        <Pencil class="size-4 shrink-0 text-base-foreground" :stroke-width="1.5" />
        <span class="text-sm leading-normal text-base-foreground">Rename tag</span>
      </button>
      <button
        type="button"
        class="flex h-8 w-full items-center gap-2 rounded-sm p-2 text-left transition-colors hover:bg-secondary-background focus:outline-none"
        @click="$emit('delete')"
      >
        <Trash2 class="size-4 shrink-0 text-base-foreground" :stroke-width="1.5" />
        <span class="text-sm leading-normal text-base-foreground">Delete tag</span>
      </button>
    </template>
  </div>
</template>
