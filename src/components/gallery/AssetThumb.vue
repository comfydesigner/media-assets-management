<script setup lang="ts">
import { computed } from 'vue'
import ThreeDViewer from './ThreeDViewer.vue'
import { placeholderBg } from './placeholder'
import { mockDuration, mockWaveform } from './assetMeta'
import type { MediaType } from './types'

// Shared per-type STATIC thumbnail content so every surface renders an asset the
// same way: image/video = gradient poster · audio = waveform on a neutral gray ·
// 3D = a static model render on a studio backdrop · video/audio = a duration pill.
// Fills its parent (caller supplies a `relative`, sized, clipped box); AssetCard
// layers its hover/selection chrome over it, the detail panels use it standalone.
const props = withDefaults(
  defineProps<{
    name: string
    mediaType?: MediaType
    /** Render the bottom-right duration pill (video/audio). AssetCard turns this
     *  off when it relocates the preview/group badges into a shared corner cluster
     *  so the duration sits side-by-side with them instead of overlapping. */
    showDuration?: boolean
    /** Nudge the duration pill 4px closer to the corner (bottom-1 right-1). Used on
     *  group covers, whose thumbnail is 4px smaller — keeps the pill aligned with
     *  the pills on full-size non-group cards in the same row. */
    tightCorner?: boolean
  }>(),
  {
    mediaType: 'image',
    showDuration: true,
    tightCorner: false,
  },
)

const isVideo = computed(() => props.mediaType === 'video')
const isAudio = computed(() => props.mediaType === 'audio')
const isThree = computed(() => props.mediaType === '3d')

// Backdrop — theme-aware via CSS vars (see style.css); gradient poster otherwise.
const bgStyle = computed(() => {
  if (isAudio.value) return { backgroundColor: 'var(--thumb-audio-bg)' }
  if (isThree.value)
    return { backgroundImage: 'radial-gradient(circle at 50% 34%, var(--thumb-3d-from) 0%, var(--thumb-3d-to) 100%)' }
  return placeholderBg(props.name)
})
const waveform = computed(() => (isAudio.value ? mockWaveform(props.name, 40) : []))
const duration = computed(() => mockDuration(props.name))
</script>

<template>
  <!-- @container establishes the context for the 3D cube's cqw sizing. -->
  <div class="@container absolute inset-0" :style="bgStyle" aria-hidden="true">
    <!-- Audio: waveform fill -->
    <div v-if="isAudio" class="absolute inset-0 flex items-center justify-center gap-[2px] px-3">
      <span
        v-for="(h, i) in waveform"
        :key="i"
        class="w-[2px] shrink-0 rounded-full bg-base-foreground/45"
        :style="{ height: `${Math.round(h * 64)}%` }"
      />
    </div>

    <!-- 3D: static model render -->
    <ThreeDViewer v-if="isThree" :name="name" size="44cqw" :interactive="false" class="absolute inset-0" />

    <!-- Duration pill (bottom-right) — video clips + audio tracks -->
    <div
      v-if="(isVideo || isAudio) && showDuration"
      class="absolute flex min-h-4 items-center rounded-full bg-black/70 px-1.5 text-[11px] font-medium leading-none tabular-nums text-white"
      :class="tightCorner ? 'bottom-1 right-1' : 'bottom-2 right-2'"
    >
      {{ duration }}
    </div>
  </div>
</template>
