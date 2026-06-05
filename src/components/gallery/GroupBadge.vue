<script setup lang="ts">
// "+N" badge for a job cover — N = additional outputs hidden behind it. Styled to
// match the "PREV." badge (same bordered pill, same spot in the card-info row) so
// job groups read at the same hierarchy as preview assets (their view-option
// toggles sit together). Clicking it opens the per-job drill-in view.
//
// Rendered as a role="button" SPAN (not a <button>) because it nests inside the
// card's root <button> — same pattern as the card's other in-card actions.
// `onThumb` — when the badge sits ON the thumbnail (name + details hidden), it
// switches to a FILLED dark pill (no outline, white text) matching the duration
// pill, instead of the bordered card-row style.
defineProps<{ count: number; onThumb?: boolean }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <span
    role="button"
    tabindex="0"
    class="inline-flex min-h-4 shrink-0 cursor-pointer items-center rounded-full px-1.5 font-semibold uppercase leading-none tracking-wide transition-colors"
    :class="
      onThumb
        ? 'bg-black/70 text-[11px] text-white hover:bg-black/40'
        : 'border border-border-default text-[10px] text-base-foreground hover:bg-black/40'
    "
    :aria-label="`View all outputs — ${count} more output${count === 1 ? '' : 's'}`"
    @click.stop="$emit('open')"
    @keydown.enter.stop.prevent="$emit('open')"
    @dblclick.stop
  >
    +{{ count }}
  </span>
</template>
