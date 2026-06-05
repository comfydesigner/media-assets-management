<script setup lang="ts">
// shadcn-vue style AlertDialog (built on reka-ui's AlertDialog primitives),
// styled to match the app. A modal secondary-confirmation: it does NOT close on
// outside-click (alert-dialog semantics) — only Cancel / Esc / the action button.
import {
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from 'reka-ui'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    /** Red action button + emphasis for destructive confirmations (delete). */
    destructive?: boolean
  }>(),
  { confirmLabel: 'Confirm', cancelLabel: 'Cancel', destructive: false },
)
const emit = defineEmits<{ 'update:open': [v: boolean]; confirm: []; cancel: [] }>()
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogPortal>
      <!-- z-[70]: above the lightbox (z-[60]) and Quick Look (z-[55]). -->
      <AlertDialogOverlay
        class="fixed inset-0 z-[70] bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <AlertDialogContent
        class="fixed left-1/2 top-1/2 z-[70] flex w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border-default bg-base-background p-5 shadow-[0px_8px_32px_rgba(0,0,0,0.5)] focus:outline-none"
      >
        <AlertDialogTitle class="text-base font-semibold leading-snug text-base-foreground">
          {{ title }}
        </AlertDialogTitle>
        <AlertDialogDescription
          v-if="description"
          class="mt-1.5 text-sm leading-normal text-muted-foreground"
        >
          {{ description }}
        </AlertDialogDescription>

        <div class="mt-5 flex items-center justify-end gap-2">
          <AlertDialogCancel
            class="flex h-9 items-center justify-center rounded-lg border border-border-default px-3.5 text-sm leading-none text-base-foreground transition-colors hover:bg-secondary-background focus:outline-none"
            @click="emit('cancel')"
          >
            {{ cancelLabel }}
          </AlertDialogCancel>
          <AlertDialogAction
            class="flex h-9 items-center justify-center rounded-lg px-3.5 text-sm font-medium leading-none text-white transition-colors focus:outline-none"
            :class="destructive ? 'bg-[#b33a3a] hover:bg-[#c64545]' : 'bg-azure-600 hover:bg-azure-600/90'"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
