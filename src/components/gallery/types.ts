export type SortOrder = 'newest' | 'oldest' | 'az' | 'za'

/** Gallery-tab layout (Figma view options):
 *   'grid'            → uniform square grid, filenames below (Manage)
 *   'masonry-row'     → row-first justified masonry (Browse)
 *   'masonry-column'  → column-balanced (Pinterest-style) masonry (Browse) */
export type GalleryLayout = 'grid' | 'masonry-row' | 'masonry-column'

/** Dock-only view modes (Figma 1780-35593): a list, or one of two grid sizes.
 *  Each grid size maps to a responsive min/max breakpoint (DOCK_SIZE_BREAKPOINTS),
 *  not a fixed column count — Small has a smaller min (more columns), Large a
 *  larger min (fewer). */
export type DockLayout = 'list' | 'grid-small' | 'grid-large'

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  az: 'Alphabetical (A → Z)',
  za: 'Alphabetical (Z → A)',
}

export interface ViewOptions {
  groupByJob: boolean
  showPreviews: boolean
  /** Show the asset name (Grid: below the tile · Masonry: in the hover overlay). */
  showName: boolean
  /** Show the asset details/meta (format · dimensions · size). Same placement. */
  showDetails: boolean
}

/**
 * 5 size breakpoints for the gallery slider.
 * Each provides a (min, max) px width pair for the grid's `minmax()` call,
 * giving us responsive cards within each "size step".
 */
export interface SizeBreakpoint {
  min: number
  max: number
}

// Mins raised so the smallest cards still fit the hover actions pill + the
// selected-check pill without them overlapping (~120px needed).
export const SIZE_BREAKPOINTS: readonly SizeBreakpoint[] = [
  { min: 128, max: 160 },  // 1 — smallest, many per row
  { min: 152, max: 192 },  // 2
  { min: 176, max: 224 },  // 3 — default
  { min: 208, max: 256 },  // 4
  { min: 256, max: 360 },  // 5 — largest, few per row
] as const

/**
 * Browse mode wants bigger thumbnails (gallery feel), so the slider maps to a
 * higher range than Manage. In masonry `min` is the target ROW HEIGHT, so these
 * are taller than the Manage column-width values.
 */
export const BROWSE_SIZE_BREAKPOINTS: readonly SizeBreakpoint[] = [
  { min: 160, max: 220 },  // 1
  { min: 200, max: 280 },  // 2
  { min: 260, max: 360 },  // 3 — default
  { min: 340, max: 460 },  // 4
  { min: 440, max: 600 },  // 5
] as const

export const DEFAULT_SIZE_STEP = 3

/**
 * Dock grid sizes (Figma 1780-35593). Two distinct sizes, each a responsive
 * min/max pair fed to `repeat(auto-fill, minmax(min, 1fr))` (same model as the
 * gallery slider) — Small = smaller tiles / more columns, Large = bigger / fewer.
 */
export const DOCK_SIZE_BREAKPOINTS: Record<'grid-small' | 'grid-large', SizeBreakpoint> = {
  'grid-small': { min: 128, max: 180 },
  'grid-large': { min: 240, max: 360 },
}

export type Category = 'all' | 'favorites' | 'generated' | 'imported'

export const CATEGORY_LABELS: Record<Category, string> = {
  all: 'All',
  favorites: 'Favorites',
  generated: 'Generated',
  imported: 'Uploaded',
}

// Tag order used for Shift-range selection. Matches the left panel's display order.
export const ALL_TAGS = [
  'sky',
  'desert',
  'forest',
  'river',
  'cat',
  'photograph',
  'film',
] as const
export type Tag = (typeof ALL_TAGS)[number]

/** Max characters allowed in a tag name (Figma 2166-99383). Past this, the
 *  "Add …" create action is disabled and a "Max character limit reached" warning
 *  is shown. */
export const MAX_TAG_LENGTH = 20

export type MediaType = 'image' | 'video' | 'audio' | '3d'

export interface Asset {
  name: string
  /** Asset kind. Absent → treated as 'image'. Drives per-type card/preview UI. */
  mediaType?: MediaType
  format: string
  dimensions: string
  createdAt: number
  category: Exclude<Category, 'all'>
  favorite: boolean
  // string (not the Tag union) so tags can be added/renamed at runtime.
  tags: readonly string[]
  /** width / height — used by the masonry (justified) layout. */
  aspectRatio: number
  /** Temporary "preview" output (not yet saved — must be explicitly downloaded).
   *  Shown only when the "Show preview assets" view option is on; carries a PREV.
   *  badge on the card (Figma 2121-63508). */
  preview?: boolean
  /** Generation job this asset came from. Assets sharing a jobId are outputs of
   *  one run; when "Group assets by job" is on they collapse to one cover card
   *  with a +N badge (Figma 2121-54974). Absent → a solo job. */
  jobId?: string
}
