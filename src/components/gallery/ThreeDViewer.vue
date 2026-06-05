<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { placeholderBg } from './placeholder'

// A cheap-but-convincing 3D mock: a CSS cube (6 gradient faces with per-face
// brightness for solid shading) shown at a 3/4 angle. Interactive (drag to orbit)
// in Quick Look + the lightbox; `interactive=false` renders a static thumbnail.
// `size` accepts a number (px) or any CSS length string (e.g. "44cqw") so the
// card can scale the cube to its container with no JS.
const props = withDefaults(
  defineProps<{ name: string; size?: number | string; interactive?: boolean }>(),
  { size: 260, interactive: true },
)

const rotX = ref(-18)
const rotY = ref(28)
const touched = ref(false)

const sizeCss = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
const halfCss = computed(() =>
  typeof props.size === 'number' ? `${props.size / 2}px` : `calc(${props.size} / 2)`,
)

// 6 cube faces: a transform placing each face + a brightness multiplier so the
// cube reads as a lit solid (top brightest, bottom darkest).
const faces = computed(() => {
  const h = halfCss.value
  const bg = placeholderBg(props.name)
  const mk = (transform: string, brightness: number) => ({ ...bg, transform, filter: `brightness(${brightness})` })
  return [
    mk(`translateZ(${h})`, 1), // front
    mk(`rotateY(180deg) translateZ(${h})`, 0.68), // back
    mk(`rotateY(90deg) translateZ(${h})`, 0.82), // right
    mk(`rotateY(-90deg) translateZ(${h})`, 0.82), // left
    mk(`rotateX(90deg) translateZ(${h})`, 1.18), // top
    mk(`rotateX(-90deg) translateZ(${h})`, 0.5), // bottom
  ]
})

let startX = 0
let startY = 0
let origX = 0
let origY = 0
function onDown(e: PointerEvent) {
  if (!props.interactive || e.button !== 0) return
  e.preventDefault()
  touched.value = true
  startX = e.clientX
  startY = e.clientY
  origX = rotX.value
  origY = rotY.value
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
function onMove(e: PointerEvent) {
  rotY.value = origY + (e.clientX - startX) * 0.5
  rotX.value = Math.max(-85, Math.min(85, origX - (e.clientY - startY) * 0.5))
}
function onUp() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
}
onBeforeUnmount(onUp)
</script>

<template>
  <div
    class="relative flex h-full w-full select-none items-center justify-center"
    :class="interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'"
    @pointerdown="onDown"
  >
    <div class="[perspective:1200px]">
      <div
        class="relative [transform-style:preserve-3d]"
        :style="{
          width: sizeCss,
          height: sizeCss,
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        }"
        aria-hidden="true"
      >
        <div
          v-for="(faceStyle, i) in faces"
          :key="i"
          class="absolute inset-0 rounded-[2px] border border-white/10 [backface-visibility:hidden]"
          :style="faceStyle"
        />
      </div>
    </div>

    <!-- "Drag to rotate" hint — interactive only, fades out after the first drag. -->
    <Transition leave-active-class="transition-opacity duration-300" leave-to-class="opacity-0">
      <div
        v-if="interactive && !touched"
        class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/45 px-2.5 py-1 text-xs leading-none text-white/85 backdrop-blur-sm"
      >
        Drag to rotate
      </div>
    </Transition>
  </div>
</template>
