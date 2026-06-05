<script setup lang="ts">
// "PREV." badge for temporary preview assets (Figma 2121-63508). Deliberately
// prominent — for a preview asset, that it's unsaved matters more than the file
// details, so it gets a high-contrast pill rather than muted meta text.
//
// `onThumb` — when the badge sits ON the thumbnail (name + details hidden), it
// switches to a FILLED dark pill (no outline, white text) so it reads over the
// image and matches the duration pill, instead of the bordered card-row style.
defineProps<{ onThumb?: boolean }>()
</script>

<template>
  <span
    class="inline-flex min-h-4 shrink-0 items-center rounded-full px-1.5 font-semibold uppercase leading-none tracking-wide"
    :class="
      onThumb
        ? 'bg-black/70 text-[11px] text-white'
        : 'border border-border-default text-[10px] text-base-foreground'
    "
    title="Preview — download to save"
  >
    PREV.
  </span>
</template>
