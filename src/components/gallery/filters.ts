import { Box, Calendar, Eye, Images, Star, Tag as TagIcon, Type, type LucideIcon } from 'lucide-vue-next'
import { MODELS } from './assetMeta'

/** Shared filter definitions for the search command palette + the applied-chip bar. */
export type FilterKind = 'multi' | 'toggle' | 'date'
export interface FilterDef {
  key: string
  label: string
  icon: LucideIcon
  kind: FilterKind
  group: 'attribute' | 'metadata'
  options?: string[] // static mock options; Tag uses the live tag list
}

export const FILTERS: FilterDef[] = [
  { key: 'date', label: 'Date', icon: Calendar, kind: 'date', group: 'attribute' },
  { key: 'tag', label: 'Tag', icon: TagIcon, kind: 'multi', group: 'attribute' },
  {
    key: 'media',
    label: 'Media type',
    icon: Images,
    kind: 'multi',
    group: 'attribute',
    options: ['Image', 'Video', 'Audio', '3D model'],
  },
  { key: 'favorited', label: 'Favorited', icon: Star, kind: 'toggle', group: 'attribute' },
  // Shown only when "Show preview assets" is on (see each menu's filter list).
  { key: 'previews', label: 'Previews', icon: Eye, kind: 'toggle', group: 'attribute' },
  {
    key: 'model',
    label: 'Model type',
    icon: Box,
    kind: 'multi',
    group: 'metadata',
    // The models assets are actually generated with (shared with the details
    // popover's Generation details) + a few partner/video models.
    options: [
      ...MODELS,
      'Bytedance Seedream',
      'Grok',
      'LTX 2.3',
      'Qwen',
      'Wan 2.1',
      'Wan 2.2',
    ],
  },
  {
    key: 'lora',
    label: 'LoRA model',
    icon: Box,
    kind: 'multi',
    group: 'metadata',
    options: ['Detail Tweaker XL', 'Add More Details', 'Film Grain', 'Anime Lineart'],
  },
  {
    key: 'workflow',
    label: 'Workflow Name',
    icon: Type,
    kind: 'multi',
    group: 'metadata',
    options: ['txt2img base', 'upscale pass', 'inpaint v2', 'controlnet pose'],
  },
]

// Present option values alphabetically — EXCEPT Date (chronological presets) and
// Tag (live list with its own order), neither of which carries a static
// `options` array here anyway. Sorts the static lists once at module load so
// every consumer (dock filter menu + tab search palette) shows the same order.
for (const f of FILTERS) {
  if (f.options && f.key !== 'date' && f.key !== 'tag') {
    f.options.sort((a, b) => a.localeCompare(b))
  }
}

export const filterByKey = (k: string) => FILTERS.find((x) => x.key === k)!

/** Mock filter types whose applied values are stored as Sets in the composable.
 *  (`date` only gets applied from the dock filter menu's presets — the gallery
 *  SearchBar still leaves Date as a stub — but it's a Set here so its chips +
 *  clear-all work the same as the others.) */
export const MOCK_FILTER_KEYS = ['date', 'media', 'model', 'lora', 'workflow'] as const

/** Preset ranges for the Date filter (dock menu). */
export const DATE_PRESETS = [
  'Today',
  'Yesterday',
  'This week',
  'Last week',
  'This month',
  'Last month',
]
