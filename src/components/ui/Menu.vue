<script setup lang="ts">
/**
 * Menu shell matching Figma "Menu (Dropdown, Context, Combo)":
 *   bg #171718, 1px border #494a50, rounded-lg (8px), px-2 py-3, gap-1.
 * Use inside <PopoverContent> or render directly.
 */
</script>

<template>
  <div
    class="flex flex-col items-start gap-1 overflow-hidden rounded-lg border border-border-default bg-base-background px-2 py-3 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.6)]"
  >
    <slot />
  </div>
</template>
