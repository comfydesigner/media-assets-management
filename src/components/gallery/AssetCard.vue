<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, Download, Ellipsis, Pause, Play, Star } from 'lucide-vue-next'
import MiddleTruncate from '@/components/ui/MiddleTruncate.vue'
import IconTooltip from '@/components/ui/IconTooltip.vue'
import PreviewBadge from './PreviewBadge.vue'
import AssetThumb from './AssetThumb.vue'
import GroupBadge from './GroupBadge.vue'
import { fmtClock, mockDuration, mockDurationSeconds, mockPolyCount, mockSampleRate } from './assetMeta'
import type { MediaType } from './types'

const props = withDefaults(
  defineProps<{
    name?: string
    /** Asset kind — drives the thumbnail + metadata variations. */
    mediaType?: MediaType
    format?: string
    dimensions?: string
    selected?: boolean
    favorite?: boolean
    /** Image aspect ratio (w/h). 1 = square (grid view); varies in masonry. */
    aspect?: number
    /** Browse mode: no filename row; name/details overlay the image on hover. */
    browse?: boolean
    /** Temporary preview asset → show the PREV. badge. */
    preview?: boolean
    /** View options: show the name / the details meta. Placement is by mode
     *  (manage → below the tile · browse → hover overlay). */
    showName?: boolean
    showDetails?: boolean
    /** Job-group cover: number of ADDITIONAL outputs behind this card (0 = not a
     *  group). Drives the stacked-card edge + the clickable "+N" badge. */
    groupCount?: number
  }>(),
  {
    name: 'image00',
    mediaType: 'image',
    format: 'PNG',
    dimensions: '512x512',
    selected: false,
    favorite: false,
    aspect: 1,
    browse: false,
    preview: false,
    showName: true,
    showDetails: true,
    groupCount: 0,
  },
)

defineEmits<{
  select: [event: MouseEvent]
  'toggle-favorite': []
  /** Hover "download" button (only present once the card is wide enough). */
  download: []
  /** Hover "more" button → open the context menu, anchored to the button. */
  menu: [rect: DOMRect]
  /** "+N" group badge clicked → open the per-job drill-in view. */
  'open-group': []
  /** Double-click → Inspect asset. */
  inspect: []
}>()

const isVideo = computed(() => props.mediaType === 'video')
const isAudio = computed(() => props.mediaType === 'audio')
const isThree = computed(() => props.mediaType === '3d')
// Video/audio get a hover "play" affordance over the thumb. (3D doesn't — the
// rendered model is the signifier; orbiting happens in Quick Look / the lightbox.)
const hasOverlay = computed(() => isVideo.value || isAudio.value)
const duration = computed(() => mockDuration(props.name))

/* ── Mock playback (video/audio) ─────────────────────────────────────────────
 * No real media — clicking the thumbnail's play affordance flips it to pause and
 * a 1s ticker advances a fake playhead, so the duration badge reads
 * "elapsed / total" and counts up. Pausing freezes it; finishing or DESELECTING
 * the card resets to the start. State is per-card and purely local. */
const totalSeconds = computed(() => mockDurationSeconds(props.name))
const playing = ref(false)
const elapsed = ref(0)
const started = computed(() => elapsed.value > 0)
// Badge text: a quiet total until playback begins, then "elapsed / total".
const badgeText = computed(() =>
  started.value ? `${fmtClock(elapsed.value)} / ${duration.value}` : duration.value,
)

let timer = 0
function stopTimer() {
  if (timer) { clearInterval(timer); timer = 0 }
}
function pause() {
  playing.value = false
  stopTimer()
}
function play() {
  if (elapsed.value >= totalSeconds.value) elapsed.value = 0 // replay from start
  playing.value = true
  stopTimer()
  timer = window.setInterval(() => {
    elapsed.value += 1
    if (elapsed.value >= totalSeconds.value) {
      elapsed.value = totalSeconds.value
      pause()
    }
  }, 1000)
}
function togglePlay() {
  playing.value ? pause() : play()
}
function resetPlayback() {
  pause()
  elapsed.value = 0
}
// Deselecting the asset tears playback down (per the spec).
watch(() => props.selected, (sel) => { if (!sel) resetPlayback() })
onBeforeUnmount(stopTimer)

// Manage mode with BOTH the name and details rows hidden → the info row (which
// normally hosts the PREV. / "+N" badges) is gone, so relocate those badges onto
// the thumbnail's bottom-right corner.
const badgesOnThumb = computed(
  () => !props.browse && !props.showName && !props.showDetails && (props.preview || props.groupCount > 0),
)
// Bottom-right thumbnail cluster (prev/group + duration, side by side). Grid: only
// when the info row is hidden. Browse: ALWAYS (the hover overlay can't host a
// pinned corner without colliding with the duration pill) — so the duration stays
// pinned bottom-right and the prev/group badges reveal on hover beside it. When the
// cluster is shown it owns the duration, so AssetThumb's own pill is suppressed.
const cornerCluster = computed(
  () =>
    badgesOnThumb.value ||
    (props.browse && (props.preview || props.groupCount > 0 || hasOverlay.value)),
)
// In browse with the name/meta overlay on, prev/group fade in with the overlay
// (hover); the duration pill stays put. Everywhere else the cluster is always shown.
const badgeRevealOnHover = computed(() => props.browse && (props.showName || props.showDetails))

// Metadata strip, per type: image = format · dimensions; video adds duration;
// audio swaps dimensions for duration · sample-rate; 3D = format · poly count.
const metaParts = computed(() => {
  if (isVideo.value) return [props.format, props.dimensions, duration.value]
  if (isAudio.value) return [props.format, duration.value, mockSampleRate(props.name)]
  if (isThree.value) return [props.format, mockPolyCount(props.name)]
  return [props.format, props.dimensions]
})

/**
 * Root chrome differs by mode:
 *   - browse: a 2px border (transparent → white when selected) hugs the image so
 *     selecting causes no layout shift; no card hover-fill (the image fills it).
 *   - manage: the existing rounded card with hover-fill + the border/padding trick.
 */
// When a card is selected, the white border ring IS the focus/active indicator
// (arrow-nav always keeps focus on the selected card), so we suppress the
// redundant browser focus outline there. Unselected cards keep a clean
// focus-visible ring for keyboard traversal.
const rootClass = computed(() => {
  if (props.browse) {
    return props.selected
      ? 'rounded-lg border-2 border-base-foreground outline-none'
      : 'rounded-lg border-2 border-transparent outline-none focus-visible:ring-2 focus-visible:ring-azure-600'
  }
  return props.selected
    ? 'rounded-lg border-2 border-base-foreground p-[2px] outline-none hover:bg-selected-card-hover'
    : 'rounded-lg p-1 outline-none focus-visible:ring-2 focus-visible:ring-azure-600 hover:bg-[var(--modal-card-background-hovered)]'
})
</script>

<template>
  <button
    type="button"
    class="group @container relative flex w-full cursor-default flex-col items-start text-left transition-colors"
    :class="rootClass"
    :aria-pressed="selected"
    :data-name="name"
    @click="$emit('select', $event)"
    @dblclick="$emit('inspect')"
  >
    <div class="flex w-full flex-col gap-1" :class="browse ? '' : 'rounded-sm'">
      <!-- Image Frame — shared per-type thumbnail content (AssetThumb), with the
           card's hover/selection chrome layered over it. A job cover gets ONE
           "card edge" tile peeking behind it (down-right) → reads as a 2-stack. -->
      <div class="relative w-full" :style="{ aspectRatio: String(aspect) }">
        <!-- Job-group cover: a second "card edge" peeks from the BOTTOM-RIGHT. The
             front thumb shrinks 4px (and stays flush top-left with non-group cards),
             so the stack reveal lives in that freed 4px and never spills past the
             card's hover bounds. -->
        <div
          v-if="groupCount > 0"
          class="pointer-events-none absolute bottom-0 right-0 h-[calc(100%-4px)] w-[calc(100%-4px)] rounded-sm border border-border-default bg-secondary-background shadow-[1px_1px_3px_rgba(0,0,0,0.25)]"
        />
        <div
          data-thumb
          class="absolute overflow-hidden"
          :class="[
            browse ? 'rounded-md' : 'rounded-sm',
            groupCount > 0 ? 'left-0 top-0 h-[calc(100%-4px)] w-[calc(100%-4px)]' : 'inset-0',
          ]"
        >
          <!-- AssetCard owns the duration badge for video/audio (it animates during
               mock playback), so AssetThumb never draws its own static pill here. -->
          <AssetThumb
            :name="name"
            :media-type="mediaType"
            :show-duration="false"
            :tight-corner="groupCount > 0"
          />

        <!-- Video/audio: play/pause affordance. Hover-revealed when idle; stays
             visible while playing or mid-clip so pause/resume is always reachable.
             Mock only — toggles the local playback ticker, no real media. -->
        <div
          v-if="hasOverlay"
          class="absolute inset-0 z-[6] flex items-center justify-center transition-opacity"
          :class="playing || started ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
        >
          <button
            type="button"
            class="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            :aria-label="playing ? 'Pause' : 'Play'"
            @click.stop="togglePlay"
            @dblclick.stop
          >
            <Pause v-if="playing" class="size-5" fill="currentColor" :stroke-width="0" />
            <Play v-else class="size-5 translate-x-[1px]" fill="currentColor" :stroke-width="0" />
          </button>
        </div>

        <!-- Persistent favorite badge: smaller/less intrusive than the hover pill,
             shown when favorited & not hovering. -->
        <div
          v-if="favorite"
          class="absolute left-2 top-2 z-10 flex items-center rounded-md bg-white p-1 shadow-[1px_1px_4px_rgba(0,0,0,0.2)] transition-opacity group-hover:opacity-0"
          aria-hidden="true"
        >
          <Star class="size-3.5 text-yellow-400" fill="currentColor" :stroke-width="1.5" />
        </div>

        <!-- Hover actions pill: star + ellipsis (shown on hover, even when selected) -->
        <div
          class="absolute left-2 top-2 z-20 flex items-center rounded-lg bg-white opacity-0 shadow-[1px_1px_4px_rgba(0,0,0,0.2)] transition-opacity group-hover:opacity-100"
        >
          <IconTooltip :label="favorite ? 'Remove from favorites' : 'Add to favorites'" side="bottom">
            <span
              class="flex size-8 items-center justify-center rounded-lg p-2 hover:bg-black/5"
              :class="favorite ? 'text-yellow-400' : 'text-black'"
              role="button"
              :aria-label="favorite ? 'Unfavorite' : 'Favorite'"
              @click.stop="$emit('toggle-favorite')"
              @dblclick.stop
            >
              <Star class="size-4" :fill="favorite ? 'currentColor' : 'none'" :stroke-width="1.5" />
            </span>
          </IconTooltip>
          <!-- Download: only surfaced once the card is wide enough to comfortably
               fit a third action (card width > 192px, in either Small/Large mode).
               Driven by a container query on the card root — no JS measuring. -->
          <IconTooltip label="Download" side="bottom">
            <span
              class="hidden size-8 items-center justify-center rounded-lg p-2 text-black hover:bg-black/5 @min-[192px]:flex"
              role="button"
              aria-label="Download"
              @click.stop="$emit('download')"
              @dblclick.stop
            >
              <Download class="size-4" :stroke-width="1.5" />
            </span>
          </IconTooltip>
          <IconTooltip label="More actions" side="bottom">
            <span
              class="flex size-8 items-center justify-center rounded-lg p-2 text-black hover:bg-black/5"
              role="button"
              aria-label="More"
              @click.stop="$emit('menu', ($event.currentTarget as HTMLElement).getBoundingClientRect())"
              @dblclick.stop
            >
              <Ellipsis class="size-4" :stroke-width="1.5" />
            </span>
          </IconTooltip>
        </div>

        <!-- Selected overlay: check pill (top-right) -->
        <div
          v-if="selected"
          class="absolute right-2 top-2 z-10 flex items-center rounded-full bg-white p-1 shadow-[1px_1px_4px_rgba(0,0,0,0.2)]"
          aria-label="Selected"
        >
          <Check class="size-4 text-black" :stroke-width="2" />
        </div>

        <!-- Browse mode: name + details overlay on a gradient, revealed on hover.
             Each piece honours its view-option toggle; both off → no overlay. -->
        <div
          v-if="browse && (showName || showDetails)"
          class="pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex flex-col gap-0.5 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2 pb-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <span v-if="showName" class="truncate text-sm leading-normal text-white">{{ name }}</span>
          <span
            v-if="showDetails"
            class="min-w-0 truncate text-xs leading-normal text-white/70"
          >
            {{ metaParts.join(' · ') }}
          </span>
        </div>

        <!-- Bottom-right cluster: PREV. / "+N" badges + duration pill, side by side.
             Grid → shown when the info row is hidden; browse → always (duration
             pinned, prev/group reveal on hover with the overlay). Group covers nudge
             it 4px down-right so it aligns with non-group cards (their thumb is 4px
             smaller). -->
        <div
          v-if="cornerCluster"
          class="pointer-events-none absolute z-[7] flex items-center gap-1"
          :class="groupCount > 0 ? 'bottom-1 right-1' : 'bottom-2 right-2'"
        >
          <PreviewBadge
            v-if="preview"
            on-thumb
            :class="badgeRevealOnHover ? 'opacity-0 transition-opacity group-hover:opacity-100' : ''"
          />
          <IconTooltip v-if="groupCount > 0" label="View all outputs" side="top">
            <GroupBadge
              :count="groupCount"
              on-thumb
              class="pointer-events-auto"
              :class="badgeRevealOnHover ? 'opacity-0 transition-opacity group-hover:opacity-100' : ''"
              @open="$emit('open-group')"
            />
          </IconTooltip>
          <span
            v-if="hasOverlay"
            class="inline-flex min-h-4 items-center rounded-full bg-black/70 px-1.5 text-[11px] font-medium leading-none tabular-nums text-white"
          >
            {{ badgeText }}
          </span>
        </div>

        <!-- Standalone duration badge when there's no corner cluster (the common
             grid case). Same position as AssetThumb's old pill; shows the live
             "elapsed / total" during mock playback. -->
        <div
          v-if="hasOverlay && !cornerCluster"
          class="pointer-events-none absolute z-[7] inline-flex min-h-4 items-center rounded-full bg-black/70 px-1.5 text-[11px] font-medium leading-none tabular-nums text-white"
          :class="groupCount > 0 ? 'bottom-1 right-1' : 'bottom-2 right-2'"
        >
          {{ badgeText }}
        </div>
        </div>
      </div>

      <!-- Card Info (manage mode only) — name + details, each toggleable. Both
           off → the whole row is gone (AssetGrid then equalises the grid gaps). -->
      <div v-if="!browse && (showName || showDetails)" class="flex flex-col px-[2px] pt-1">
        <div class="flex items-end gap-2 pb-1">
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div v-if="showName" class="flex w-full items-center rounded-[4px]">
              <MiddleTruncate
                :text="name"
                class="min-w-0 flex-1 text-sm leading-normal text-base-foreground"
              />
            </div>
            <div
              v-if="showDetails"
              class="flex w-full items-center gap-1 whitespace-nowrap text-xs leading-normal text-muted-foreground"
            >
              <!-- Per-type parts (image: format · dimensions · video adds duration ·
                   audio: format · duration · sample-rate). All but the last stay
                   whole; the last abbreviates when the row tightens. -->
              <span
                v-for="(p, i) in metaParts"
                :key="i"
                :class="i === metaParts.length - 1 ? 'min-w-0 truncate' : 'shrink-0'"
              >
                {{ p }}
              </span>
            </div>
          </div>
          <!-- PREV. + "+N" group badge: same hierarchy, bottom-aligned right of the
               info. The group badge opens the per-job drill-in. -->
          <PreviewBadge v-if="preview" class="mb-0.5" />
          <IconTooltip v-if="groupCount > 0" label="View all outputs" side="top">
            <GroupBadge :count="groupCount" class="mb-0.5" @open="$emit('open-group')" />
          </IconTooltip>
        </div>
      </div>
    </div>
  </button>
</template>
