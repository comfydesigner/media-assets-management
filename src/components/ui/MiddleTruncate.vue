<script setup lang="ts">
import { computed } from 'vue'

/**
 * Middle truncation (a.k.a. middle ellipsis) — "Forest path in… fog".
 *
 * CSS-only + responsive: the head span fills the remaining width and truncates
 * with an ellipsis; the tail span is pinned and always shown. No JS width
 * measuring, so it reflows automatically when the card resizes. When the whole
 * string fits, the head shows in full with no ellipsis.
 *
 * The tail is delimiter-aware: it snaps to the last separator (space / _ / - /
 * .) so the trailing token (extension, version, last word) stays whole —
 * "snowy_pine_forest…_upscaled", "My vacation photo….png". Falls back to a
 * fixed char count when there's no usable separator (e.g. "abc…vwxyz") or the
 * trailing token is too long to pin.
 */
const props = withDefaults(
  defineProps<{ text: string; tail?: number; maxTail?: number }>(),
  { tail: 7, maxTail: 16 },
)

const split = computed(() => {
  const t = props.text

  // Prefer the last separator + trailing token, if it's a sensible length.
  const m = t.match(/[ _.\-][^ _.\-]*$/)
  if (m && m.index !== undefined && m.index > 0) {
    const cand = m[0]
    if (cand.length >= 2 && cand.length <= props.maxTail) {
      return { head: t.slice(0, m.index), tail: cand }
    }
  }

  // Fixed-char fallback (always leave ≥1 char for the head).
  const n = Math.min(props.tail, Math.max(0, t.length - 1))
  return { head: t.slice(0, t.length - n), tail: t.slice(t.length - n) }
})
</script>

<template>
  <span class="flex min-w-0 items-center" :title="text">
    <span class="truncate">{{ split.head }}</span>
    <span class="shrink-0 whitespace-pre">{{ split.tail }}</span>
  </span>
</template>
