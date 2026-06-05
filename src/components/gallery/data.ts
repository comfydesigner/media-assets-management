import { ALL_TAGS, type Asset, type MediaType, type Tag } from './types'

const CATEGORIES: Asset['category'][] = ['generated', 'imported']

/**
 * Mock asset filenames (no extension — format is shown separately). Mixed
 * lengths on purpose: short ones never truncate, long ones exercise the
 * middle-truncation, and most carry a meaningful trailing suffix
 * (version / sequence / resolution) so the pinned tail stays useful.
 */
const NAMES = [
  'Sunset over the lake',
  'Mountain range study 02',
  'Final poster draft',
  'IMG_4821',
  'Client logo concept v2',
  'Beach trip 2024',
  'portrait_retouch_final',
  'Untitled design',
  'Golden hour portrait',
  'DSC_0481',
  'Voiceover take 03',
  'City lights at night',
  'Sneaker render 3D',
  'Forest path in the morning fog',
  'Moodboard v3',
  'Abstract gradient render',
  'ref',
  'Background music loop',
  'Character model v4',
  'Image012',
  'Coastal landscape at dusk',
  'Logo exploration round 2',
  'snowy_pine_forest_8k',
  'Studio lighting test',
  'wip',
  'Landing page hero image',
  'Vacation photos final',
  'IMG_6602',
  'Desert dunes golden hour',
  'Spaceship model hires',
  'draft',
  'SFX whoosh 02',
  'Minimal poster layout',
] as const

/* ── Random name generator (for the randomizer dev button) ─────────────────
   Produces a mix of styles so truncation gets exercised:
   short ("sunset"), generic ("Image001", "IMG_2931"), and long descriptive
   ("snowy_alpine_forest_dusk_8k"). Names are de-duped to stay valid v-for keys. */
const SHORT = ['cat', 'dog', 'sunset', 'draft', 'wip', 'ref', 'hero', 'mockup', 'sky', 'dune', 'fog', 'moon', 'test', 'final']
// Human-typed names (spaces, sentence case) — what a user would actually name a file.
const TITLES = ['Sunset over the lake', 'Mountain range study', 'Final poster draft', 'Client logo concept', 'Beach trip', 'Product hero shot', 'Portrait retouch', 'Forest path in the morning', 'City lights at night', 'Abstract gradient render', 'Character turnaround sheet', 'Album cover idea', 'Landing page hero image', 'Moodboard', 'Untitled design', 'Quick sketch', 'Reference sheet', 'Studio lighting test', 'Golden hour portrait', 'Coastal landscape at dusk', 'Vacation photos', 'Concept art spaceship hangar']
const TITLE_SUFFIX = ['', '', ' v2', ' v3', ' final', ' (1)', ' (2)', ' 02', ' 2024', ' copy']
const ADJ = ['snowy', 'golden', 'misty', 'vivid', 'muted', 'soft', 'dramatic', 'serene', 'vintage', 'neon', 'abstract', 'minimal', 'cinematic', 'dreamy', 'rustic', 'urban', 'coastal', 'alpine', 'tropical', 'autumn']
const SUBJ = ['mountain', 'forest', 'ocean', 'portrait', 'cityscape', 'desert', 'river', 'flower', 'spaceship', 'character', 'interior', 'landscape', 'skyline', 'canyon', 'waterfall', 'meadow', 'glacier', 'harbor', 'temple']
const EXTRA = ['sunrise', 'sunset', 'dawn', 'dusk', 'night', 'macro', 'aerial', 'closeup', 'study', 'render', 'sketch', 'concept', 'hero']
const SUFFIX = ['final', 'draft', 'edit', 'v2', 'v3', '4k', '8k', '001', '042', 'raw', 'upscaled', 'retouch']

const rand = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!
const pad = (n: number, len: number) => String(n).padStart(len, '0')

function makeName(): string {
  const roll = Math.random()
  if (roll < 0.18) return rand(SHORT) // short
  if (roll < 0.36) {
    // generic camera/export style
    const g = Math.random()
    if (g < 0.34) return `Image${pad(Math.floor(Math.random() * 999) + 1, 3)}`
    if (g < 0.67) return `IMG_${pad(Math.floor(Math.random() * 9999), 4)}`
    return `DSC_${pad(Math.floor(Math.random() * 9999), 4)}`
  }
  if (roll < 0.74) return rand(TITLES) + rand(TITLE_SUFFIX) // human-typed, spaces
  // long descriptive snake_case (AI/export style)
  const parts = [rand(ADJ), rand(SUBJ), rand(EXTRA)]
  if (Math.random() < 0.5) parts.push(rand(EXTRA))
  if (Math.random() < 0.45) parts.push(rand(SUFFIX))
  return parts.join('_')
}

export function generateNames(count = 33): string[] {
  const used = new Set<string>()
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const base = makeName()
    let name = base
    let k = 2
    while (used.has(name)) name = `${base}_${k++}`
    used.add(name)
    out.push(name)
  }
  return out
}

/**
 * Random aspect ratio (w:h) in ~0.45–2.45, so the masonry shows a continuous
 * spread of shapes including a few extremes (panorama / very tall) that exercise
 * the layout's clamping. Real assets would use their true dimensions instead.
 */
export function randomAspect(): number {
  return +(0.45 + Math.random() * 2.0).toFixed(2)
}

/** Pixel dimensions string for a ratio, anchored to a 512px short edge. */
export function dimsForAspect(ratio: number): string {
  const base = 512
  return ratio >= 1
    ? `${Math.round(base * ratio)}×${base}`
    : `${base}×${Math.round(base / ratio)}`
}

/* A handful of the demo assets are mocked as VIDEO / AUDIO so the grid shows a
 * believable media mix (the rest are images). Indices map into NAMES above — the
 * audio names were chosen to read as audio (Voiceover / Background music / SFX). */
const VIDEO_INDICES = new Set([5, 11, 20, 28])
const AUDIO_INDICES = new Set([10, 17, 31])
const THREED_INDICES = new Set([12, 18, 29])

// A few generation JOBS that produced multiple outputs (a batch). Indices map into
// NAMES; assets sharing a job collapse to one cover + "+N" badge when "Group by
// job" is on. Kept to image indices so a job's outputs are a consistent media type.
const JOB_GROUPS: Record<string, number[]> = {
  'job-7f3a91': [3, 7, 14, 22], // 4 outputs → "+3"
  'job-2b9c08': [9, 16, 23], // 3 → "+2"
  'job-c18e44': [24, 25, 26, 27, 30, 32], // 6 → "+5"
  'job-5d0417': [1, 4], // 2 → "+1"
}
const INDEX_JOB: Record<number, string> = {}
for (const [job, idxs] of Object.entries(JOB_GROUPS)) for (const i of idxs) INDEX_JOB[i] = job
const VIDEO_FORMATS = ['MP4', 'WebM', 'MOV'] as const
const VIDEO_DIMS = ['1920×1080', '1280×720', '3840×2160'] as const
const AUDIO_FORMATS = ['WAV', 'MP3', 'FLAC'] as const
const THREED_FORMATS = ['GLB', 'OBJ', 'USDZ'] as const

/**
 * 33 demo assets with deterministic category/favorite/tag assignment. Images get
 * a random aspect ratio (re-rolled by the randomizer button); video is fixed 16:9
 * with a real resolution; audio + 3D are square tiles (no pixel dimensions —
 * audio shows a waveform, 3D a draggable cube).
 */
export const BASE_ASSETS: Asset[] = Array.from({ length: 33 }, (_, i) => {
  const mediaType: Asset['mediaType'] = VIDEO_INDICES.has(i)
    ? 'video'
    : AUDIO_INDICES.has(i)
      ? 'audio'
      : THREED_INDICES.has(i)
        ? '3d'
        : 'image'
  // Video = 16:9; audio/3D = square tiles; images keep a random shape.
  const ratio = mediaType === 'video' ? +(16 / 9).toFixed(2) : mediaType === 'image' ? randomAspect() : 1
  const format =
    mediaType === 'video'
      ? VIDEO_FORMATS[i % VIDEO_FORMATS.length]!
      : mediaType === 'audio'
        ? AUDIO_FORMATS[i % AUDIO_FORMATS.length]!
        : mediaType === '3d'
          ? THREED_FORMATS[i % THREED_FORMATS.length]!
          : 'PNG'
  // Only images/video carry pixel dimensions; audio + 3D have none.
  const dimensions =
    mediaType === 'video' ? VIDEO_DIMS[i % VIDEO_DIMS.length]! : mediaType === 'image' ? dimsForAspect(ratio) : ''
  return {
    name: NAMES[i] ?? `asset_${String(i).padStart(2, '0')}`,
    mediaType,
    format,
    dimensions,
    aspectRatio: ratio,
    createdAt: i,
    jobId: INDEX_JOB[i],
    // Grouped jobs are the outputs of ONE workflow run → always "generated"
    // (they can never live under "Uploaded"); ungrouped assets alternate.
    category: INDEX_JOB[i] ? 'generated' : CATEGORIES[i % CATEGORIES.length],
    favorite: i % 4 === 0,
    // Two tags per asset, picked by deterministic index math so the grid has variety
    tags: [
      ALL_TAGS[i % ALL_TAGS.length] as Tag,
      ALL_TAGS[(i + 3) % ALL_TAGS.length] as Tag,
    ],
  }
})

/**
 * Mock "preview" assets — freshly-generated, temporary outputs that haven't been
 * saved yet (the user must explicitly Download them). Hidden unless the "Show
 * preview assets" view option is on; rendered with a PREV. badge (Figma 2121-63508).
 * Appended AFTER the base assets with high `createdAt` so they sort to the top
 * under "Newest first".
 */
const PREVIEW_NAMES = [
  'Generated output 0481',
  'Generated output 0482',
  'untitled_preview',
  'Generated output 0483',
] as const

export const PREVIEW_ASSETS: Asset[] = PREVIEW_NAMES.map((name, i) => {
  const ratio = randomAspect()
  return {
    name,
    format: 'PNG',
    dimensions: dimsForAspect(ratio),
    aspectRatio: ratio,
    createdAt: 1000 + i, // newer than every base asset
    category: 'generated',
    favorite: false,
    tags: [ALL_TAGS[i % ALL_TAGS.length] as Tag],
    preview: true,
  }
})

/**
 * Seeded GROUPED video/audio jobs — generation batches whose COVER (the newest
 * member) is itself a video or audio asset. In the grouped view that surfaces the
 * "+N" badge sitting beside the duration pill in the thumbnail's bottom-right
 * corner (the side-by-side case). High `createdAt` so each cover wins its group
 * and the covers sort near the top under "Newest first". Members of a job share a
 * media type (a believable batch). Kept separate from BASE_ASSETS so the existing
 * standalone media tiles are untouched.
 */
const VIDEO_RATIO = +(16 / 9).toFixed(2)
const MEDIA_JOB_GROUPS: {
  jobId: string
  mediaType: MediaType
  format: string
  dimensions: string
  aspect: number
  tags: string[]
  names: string[]
}[] = [
  {
    jobId: 'job-vidgen-a',
    mediaType: 'video',
    format: 'MP4',
    dimensions: '1920×1080',
    aspect: VIDEO_RATIO,
    tags: ['sky', 'desert'],
    names: ['Drone flythrough take 1', 'Drone flythrough take 2', 'Drone flythrough final'],
  },
  {
    jobId: 'job-vidgen-b',
    mediaType: 'video',
    format: 'MOV',
    dimensions: '3840×2160',
    aspect: VIDEO_RATIO,
    tags: ['photograph', 'film'],
    names: ['Product spin 4k v1', 'Product spin 4k v2'],
  },
  {
    jobId: 'job-audgen-a',
    mediaType: 'audio',
    format: 'WAV',
    dimensions: '',
    aspect: 1,
    tags: ['forest', 'river'],
    names: ['Ambient pad loop A', 'Ambient pad loop B', 'Ambient pad loop C'],
  },
  {
    jobId: 'job-audgen-b',
    mediaType: 'audio',
    format: 'MP3',
    dimensions: '',
    aspect: 1,
    tags: ['cat', 'sky'],
    names: ['Voiceover alt take 1', 'Voiceover alt take 2'],
  },
]
let seedClock = 500 // newer than every BASE_ASSET (0–32), older than previews (1000+)
export const MEDIA_JOB_ASSETS: Asset[] = MEDIA_JOB_GROUPS.flatMap((g) =>
  g.names.map((name) => ({
    name,
    mediaType: g.mediaType,
    format: g.format,
    dimensions: g.dimensions,
    aspectRatio: g.aspect,
    createdAt: seedClock++, // last name in each group = newest = the cover
    jobId: g.jobId,
    category: 'generated' as const,
    favorite: false,
    tags: g.tags,
  })),
)

/**
 * 64 extra procedurally-generated assets so the gallery reads as a larger, more
 * expansive library (deterministic: name/type/tags/aspect derived from the index,
 * so it's stable across reloads). A believable media mix (mostly images, a sprinkle
 * of video/audio/3D) and varied aspect ratios for the masonry layouts.
 */
const EXTRA_ADJ = [
  'Sunset', 'Neon', 'Abstract', 'Misty', 'Golden', 'Coastal', 'Urban', 'Vintage',
  'Frosted', 'Crimson', 'Azure', 'Verdant', 'Dusky', 'Radiant', 'Muted', 'Bold',
] as const
const EXTRA_SUBJ = [
  'landscape', 'portrait', 'render', 'study', 'composition', 'texture', 'gradient',
  'pattern', 'scene', 'mockup', 'concept', 'frame', 'sketch', 'panorama', 'still', 'loop',
] as const
const EXTRA_RATIOS = [1, 0.75, 1.33, 0.66, 1.5, 1, 0.8, 1.78] as const
export const EXTRA_ASSETS: Asset[] = Array.from({ length: 64 }, (_, i) => {
  const mediaType: MediaType =
    i % 9 === 0 ? 'video' : i % 11 === 0 ? 'audio' : i % 13 === 0 ? '3d' : 'image'
  const ratio =
    mediaType === 'video'
      ? VIDEO_RATIO
      : mediaType === 'image'
        ? EXTRA_RATIOS[i % EXTRA_RATIOS.length]!
        : 1
  const format =
    mediaType === 'video'
      ? VIDEO_FORMATS[i % VIDEO_FORMATS.length]!
      : mediaType === 'audio'
        ? AUDIO_FORMATS[i % AUDIO_FORMATS.length]!
        : mediaType === '3d'
          ? THREED_FORMATS[i % THREED_FORMATS.length]!
          : 'PNG'
  const dimensions =
    mediaType === 'video'
      ? VIDEO_DIMS[i % VIDEO_DIMS.length]!
      : mediaType === 'image'
        ? dimsForAspect(ratio)
        : ''
  return {
    name: `${EXTRA_ADJ[i % EXTRA_ADJ.length]} ${EXTRA_SUBJ[(i * 3) % EXTRA_SUBJ.length]} ${String(i + 1).padStart(2, '0')}`,
    mediaType,
    format,
    dimensions,
    aspectRatio: ratio,
    createdAt: 100 + i, // between the base assets (0–32) and the seeded media jobs
    category: i % 3 === 0 ? 'imported' : 'generated',
    favorite: i % 7 === 0,
    tags: [ALL_TAGS[i % ALL_TAGS.length]!, ALL_TAGS[(i + 4) % ALL_TAGS.length]!],
  }
})

/**
 * Sidebar tag counts: how many assets in the current pool carry each tag.
 * Static for the demo (computed once from BASE_ASSETS).
 */
export const TAG_COUNTS: Record<Tag, number> = ALL_TAGS.reduce(
  (acc, tag) => {
    acc[tag] = BASE_ASSETS.filter((a) => a.tags.includes(tag)).length
    return acc
  },
  {} as Record<Tag, number>,
)
