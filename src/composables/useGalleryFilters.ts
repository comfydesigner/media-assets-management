import { computed, reactive, ref, watch } from 'vue'
import {
  BASE_ASSETS,
  EXTRA_ASSETS,
  MEDIA_JOB_ASSETS,
  PREVIEW_ASSETS,
  TAG_COUNTS,
  dimsForAspect,
  generateNames,
  randomAspect,
} from '@/components/gallery/data'
import {
  ALL_TAGS,
  BROWSE_SIZE_BREAKPOINTS,
  CATEGORY_LABELS,
  DEFAULT_SIZE_STEP,
  SIZE_BREAKPOINTS,
  type Category,
  type GalleryLayout,
  type MediaType,
  type SortOrder,
  type ViewOptions,
} from '@/components/gallery/types'
import { MOCK_FILTER_KEYS } from '@/components/gallery/filters'

/** Maps an asset's `mediaType` to the "Media type" filter option label. */
const MEDIA_LABELS: Record<MediaType, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  '3d': '3D model',
}

/**
 * Single source of truth for category + tag filtering, sort, and view options.
 *
 * Modifier semantics on tag click:
 *   - plain         → single-select (replace)
 *   - Cmd/Ctrl      → toggle the clicked tag (additive)
 *   - Shift         → range-select from the anchor (last single/toggle-click) to the clicked tag
 *
 * Category click clears any tag selection, per spec.
 *
 * SINGLETON: the gallery tab and the workflow dock both call this and must share
 * ONE state — drilling/filtering/searching in the dock is reflected when you open
 * or switch to the Media Assets tab (and vice versa). Only one surface is mounted
 * at a time, so a shared instance is safe.
 */
let sharedFilters: ReturnType<typeof createGalleryFilters> | null = null
export function useGalleryFilters() {
  return (sharedFilters ??= createGalleryFilters())
}
function createGalleryFilters() {
  const activeCategory = ref<Category>('all')
  const selectedTags = reactive(new Set<string>())
  /** Anchor for Shift-range select. Set on every non-Shift tag click. */
  const tagAnchor = ref<string | null>(null)
  /**
   * How multiple selected tags combine:
   *   'all' (default) → intersection (asset must have EVERY selected tag). This is
   *                     the "drill into a subset" / nested-folder behavior.
   *   'any'           → union (asset has at least one). A broad gather.
   * One GLOBAL mode (never per-pair), so N tags can't form ambiguous mixed logic.
   */
  const tagMatch = ref<'all' | 'any'>('all')
  function toggleTagMatch() {
    tagMatch.value = tagMatch.value === 'all' ? 'any' : 'all'
  }
  function setTagMatch(mode: 'all' | 'any') {
    tagMatch.value = mode
  }

  /** Reactive tag list + counts, so tags can be added at runtime (the + button). */
  const tags = reactive<string[]>([...ALL_TAGS])
  const tagCounts = reactive<Record<string, number>>({ ...TAG_COUNTS })

  /**
   * Tag sort mode. 'custom' = the manual (drag) order, default. 'alpha' = a
   * non-destructive A→Z view (doesn't mutate `tags`, so switching back to
   * Custom restores the manual order). Drag-reorder is only enabled in custom.
   */
  const tagSort = ref<'custom' | 'alpha'>('custom')
  const displayedTags = computed(() =>
    tagSort.value === 'alpha' ? [...tags].sort((a, b) => a.localeCompare(b)) : tags,
  )
  function setTagSort(mode: 'custom' | 'alpha') {
    tagSort.value = mode
  }
  function addTag(name: string) {
    const t = name.trim()
    if (!t || tags.includes(t)) return
    tags.unshift(t) // new tag appears at the top, right under the add-input
    tagCounts[t] = 0
  }

  function renameTag(oldName: string, newName: string) {
    const t = newName.trim()
    const i = tags.indexOf(oldName)
    if (!t || i < 0 || t === oldName || tags.includes(t)) return
    tags[i] = t
    tagCounts[t] = tagCounts[oldName] ?? 0
    delete tagCounts[oldName]
    if (selectedTags.has(oldName)) {
      selectedTags.delete(oldName)
      selectedTags.add(t)
    }
    if (tagAnchor.value === oldName) tagAnchor.value = t
    assets.forEach((a) => {
      if (a.tags.includes(oldName)) a.tags = a.tags.map((x) => (x === oldName ? t : x))
    })
  }

  /** Delete every currently-selected tag (multi-select context action). */
  function deleteSelectedTags() {
    for (const name of [...selectedTags]) deleteTag(name)
  }

  /** Drag-to-reorder a tag: move the item at `from` to land at index `to`. */
  function moveTag(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= tags.length || to >= tags.length) return
    const [item] = tags.splice(from, 1)
    tags.splice(to, 0, item!)
  }

  function deleteTag(name: string) {
    const i = tags.indexOf(name)
    if (i < 0) return
    tags.splice(i, 1)
    delete tagCounts[name]
    selectedTags.delete(name)
    if (tagAnchor.value === name) tagAnchor.value = null
    assets.forEach((a) => {
      if (a.tags.includes(name)) a.tags = a.tags.filter((x) => x !== name)
    })
  }

  const sortOrder = ref<SortOrder>('newest')
  const viewOptions = ref<ViewOptions>({
    groupByJob: false,
    showPreviews: false,
    showName: true,
    showDetails: true,
  })
  /**
   * Top-level experience mode (replaces the old grid/masonry toggle):
   *   'manage' → uniform square grid with filenames below each card (DAM default)
   *   'browse' → row-first justified masonry, no filenames; info overlays on hover
   * Layout follows from the mode, so there's no separate layout switch.
   */
  const mode = ref<'manage' | 'browse'>('manage')
  function setMode(m: 'manage' | 'browse') {
    mode.value = m
  }
  /** Browse-mode masonry orientation: row-first justified vs column-balanced
   *  (Pinterest). Only meaningful when mode === 'browse'. */
  const masonryAxis = ref<'row' | 'column'>('row')
  function setMasonryAxis(a: 'row' | 'column') {
    masonryAxis.value = a
  }
  const galleryLayout = computed<GalleryLayout>(() =>
    mode.value !== 'browse'
      ? 'grid'
      : masonryAxis.value === 'column'
        ? 'masonry-column'
        : 'masonry-row',
  )

  /** 1..5; maps to a size-breakpoint index (range depends on mode). */
  const sizeStep = ref<number>(DEFAULT_SIZE_STEP)
  // Browse mode uses a higher size range than Manage (bigger gallery thumbnails).
  const sizeBreakpoint = computed(() => {
    const scale = mode.value === 'browse' ? BROWSE_SIZE_BREAKPOINTS : SIZE_BREAKPOINTS
    return scale[sizeStep.value - 1]!
  })

  /** Reactive working copy so the randomizer button can re-roll names. Includes
   *  the temporary preview assets (gated out of the grid unless "Show preview
   *  assets" is on — see filteredAssets). */
  const assets = reactive(
    [...BASE_ASSETS, ...EXTRA_ASSETS, ...MEDIA_JOB_ASSETS, ...PREVIEW_ASSETS].map((a) => ({ ...a })),
  )

  /**
   * Asset selection — lives here (not in AssetGrid) so the header's Select-all
   * and the grid share one source of truth, and selection survives tab switches.
   * Starts empty (nothing selected on load).
   */
  const selectedAssets = reactive(new Set<string>())
  function clearSelection() {
    selectedAssets.clear()
  }

  /** Toggle one asset's favorite flag. */
  function toggleFavorite(name: string) {
    const a = assets.find((x) => x.name === name)
    if (a) a.favorite = !a.favorite
  }

  /**
   * Favorite from a card's star. If the card is part of a multi-selection, the
   * action applies to the WHOLE selection: favorite all when any is unfavorited
   * (mixed → favorite-first), unfavorite all only when every one is already
   * favorited. Otherwise it just toggles the single card.
   */
  function favoriteFromCard(name: string) {
    if (selectedAssets.has(name) && selectedAssets.size > 1) {
      const sel = [...selectedAssets]
        .map((n) => assets.find((a) => a.name === n))
        .filter((a): a is (typeof assets)[number] => !!a)
      const target = !sel.every((a) => a.favorite) // favorite unless all already are
      sel.forEach((a) => (a.favorite = target))
    } else {
      toggleFavorite(name)
    }
  }

  /** Favorite all currently-selected assets. */
  function favoriteSelected() {
    for (const name of selectedAssets) {
      const a = assets.find((x) => x.name === name)
      if (a) a.favorite = true
    }
  }

  /** True when every selected asset is already favorited (drives the star state). */
  const allSelectedFavorited = computed(
    () =>
      selectedAssets.size > 0 &&
      [...selectedAssets].every((n) => assets.find((a) => a.name === n)?.favorite),
  )

  /** Toggle favorite across the selection: favorite all unless every one is
      already favorited (then unfavorite all) — matches the card-star behavior. */
  function toggleFavoriteSelected() {
    const sel = [...selectedAssets]
      .map((n) => assets.find((a) => a.name === n))
      .filter((a): a is (typeof assets)[number] => !!a)
    if (!sel.length) return
    const target = !sel.every((a) => a.favorite)
    sel.forEach((a) => (a.favorite = target))
  }

  /** Remove all selected assets from the library (toolbar trash), then clear. */
  function deleteSelected() {
    for (const name of [...selectedAssets]) {
      const i = assets.findIndex((a) => a.name === name)
      if (i >= 0) assets.splice(i, 1)
    }
    selectedAssets.clear()
  }

  /* ── Asset details panel ──────────────────────────────────────────────────
   * Opened from the context menu's "Show details". Reflects the live selection:
   * 1 selected → full single-asset view; 2+ → multi view (shared tags only).
   */
  const detailsOpen = ref(false)
  function openDetails() {
    if (selectedAssets.size > 0) detailsOpen.value = true
  }
  function closeDetails() {
    detailsOpen.value = false
  }
  function toggleDetails() {
    if (detailsOpen.value) closeDetails()
    else openDetails()
  }
  // Close automatically when the selection empties out.
  watch(
    () => selectedAssets.size,
    (n) => {
      if (n === 0) detailsOpen.value = false
    },
  )

  type AssetRow = (typeof assets)[number]
  /** The single asset shown when exactly one is selected (else null). */
  const detailAsset = computed<AssetRow | null>(() =>
    selectedAssets.size === 1 ? assets.find((a) => selectedAssets.has(a.name)) ?? null : null,
  )
  /** All assets in the current detail selection. */
  const detailSelectionAssets = computed<AssetRow[]>(() =>
    assets.filter((a) => selectedAssets.has(a.name)),
  )
  /** Tags shared by ALL selected assets (intersection) — the chips for multi. */
  const sharedSelectionTags = computed(() => {
    const sel = detailSelectionAssets.value
    if (sel.length === 0) return []
    return tags.filter((t) => sel.every((a) => a.tags.includes(t)))
  })
  /** Tri-state of a tag across the current selection: all / some / none have it. */
  function tagSelectionState(tag: string): 'all' | 'some' | 'none' {
    const sel = detailSelectionAssets.value
    if (sel.length === 0) return 'none'
    const n = sel.filter((a) => a.tags.includes(tag)).length
    return n === 0 ? 'none' : n === sel.length ? 'all' : 'some'
  }

  function addTagToAsset(a: AssetRow, tag: string) {
    if (a.tags.includes(tag)) return
    a.tags = [...a.tags, tag]
    tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
  }
  function removeTagFromAsset(a: AssetRow, tag: string) {
    if (!a.tags.includes(tag)) return
    a.tags = a.tags.filter((x) => x !== tag)
    tagCounts[tag] = Math.max(0, (tagCounts[tag] ?? 1) - 1)
  }
  /** Dropdown row toggle: if every selected asset has the tag → remove from all,
      otherwise add it to all (so 'some' → 'all'). */
  function toggleTagForSelection(tag: string) {
    const sel = detailSelectionAssets.value
    if (sel.length === 0) return
    if (sel.every((a) => a.tags.includes(tag))) sel.forEach((a) => removeTagFromAsset(a, tag))
    else sel.forEach((a) => addTagToAsset(a, tag))
  }
  /** Remove a shared-tag chip from every selected asset. */
  function removeTagFromSelection(tag: string) {
    detailSelectionAssets.value.forEach((a) => removeTagFromAsset(a, tag))
  }
  /** Create a brand-new tag (registers it globally) and add it to all selected. */
  function createTagForSelection(name: string) {
    const t = name.trim()
    if (!t) return
    if (!tags.includes(t)) addTag(t)
    detailSelectionAssets.value.forEach((a) => addTagToAsset(a, t))
  }
  /** Inline rename of the single detail asset (keeps the selection in sync). */
  function renameAsset(oldName: string, newName: string) {
    const t = newName.trim()
    if (!t || t === oldName || assets.some((a) => a.name === t)) return
    const a = assets.find((x) => x.name === oldName)
    if (!a) return
    a.name = t
    if (selectedAssets.has(oldName)) {
      selectedAssets.delete(oldName)
      selectedAssets.add(t)
    }
  }

  /* ── Inspect lightbox ─────────────────────────────────────────────────────
   * Full-screen viewer. The inspected asset is mirrored into `selectedAssets`
   * (single) so the reused details panel + tag ops target it. Browsing the
   * carousel / prev-next walks the current filtered view.
   */
  const inspectOpen = ref(false)
  const inspectName = ref<string | null>(null)
  const inspectAsset = computed(() => assets.find((a) => a.name === inspectName.value) ?? null)
  function inspectSelect(name: string) {
    inspectName.value = name
    selectedAssets.clear()
    selectedAssets.add(name)
  }
  function openInspect(name?: string) {
    const n = name ?? [...selectedAssets][0]
    if (!n) return
    inspectSelect(n)
    inspectOpen.value = true
  }
  function closeInspect() {
    inspectOpen.value = false
  }
  /** Step to the prev/next asset in the current filtered view (wraps). */
  function inspectStep(delta: number) {
    const list = filteredAssets.value
    const i = list.findIndex((a) => a.name === inspectName.value)
    if (i < 0 || !list.length) return
    inspectSelect(list[(i + delta + list.length) % list.length]!.name)
  }

  /* ── Quick Look (Space) — macOS-style mini preview ────────────────────────
   * A lighter peek than the full lightbox: Space opens it for the selected
   * asset, ←/→ steps the current view (without disturbing the grid selection),
   * Enter / the Open button escalates to the lightbox, Esc/Space closes.
   */
  const quickLookOpen = ref(false)
  // Like the details popover, Quick Look REFLECTS the selection (first selected),
  // so clicking another card — OR arrow-key navigation (handled by the grid's own
  // keydown: ←/→ = ±1, ↑/↓ = ±a row) — live-updates the preview.
  const quickLookAsset = computed<AssetRow | null>(
    () => assets.find((a) => a.name === [...selectedAssets][0]) ?? null,
  )
  function openQuickLook() {
    if (selectedAssets.size > 0) quickLookOpen.value = true
  }
  function closeQuickLook() {
    quickLookOpen.value = false
  }
  // Persistent (X-only / Esc) but auto-closes when the selection empties out.
  watch(
    () => selectedAssets.size,
    (n) => {
      if (n === 0) quickLookOpen.value = false
    },
  )

  /** Re-roll every asset name + aspect ratio, then prune now-orphaned selections. */
  function randomizeNames() {
    const names = generateNames(assets.length)
    assets.forEach((a, i) => {
      a.name = names[i]!
      // Only images get a re-rolled shape — video stays 16:9, audio stays a
      // square waveform tile with no pixel dimensions.
      if ((a.mediaType ?? 'image') === 'image') {
        const ratio = randomAspect()
        a.aspectRatio = ratio
        a.dimensions = dimsForAspect(ratio)
      }
    })
    for (const n of [...selectedAssets]) {
      if (!assets.some((a) => a.name === n)) selectedAssets.delete(n)
    }
  }

  function selectCategory(cat: Category) {
    activeCategory.value = cat
    selectedTags.clear()
    tagAnchor.value = null
    drilledJobId.value = null // navigating the rail exits any per-job drill-in
  }

  function selectTag(tag: string, event: MouseEvent) {
    const idx = tags.indexOf(tag)
    if (idx < 0) return

    if (event.shiftKey && tagAnchor.value) {
      const anchorIdx = tags.indexOf(tagAnchor.value)
      const [start, end] = [Math.min(idx, anchorIdx), Math.max(idx, anchorIdx)]
      selectedTags.clear()
      for (let i = start; i <= end; i++) selectedTags.add(tags[i]!)
      // Don't move the anchor on Shift — it stays at the original click.
      return
    }

    if (event.metaKey || event.ctrlKey) {
      if (selectedTags.has(tag)) selectedTags.delete(tag)
      else selectedTags.add(tag)
      tagAnchor.value = tag
      return
    }

    // Plain click: additive toggle — clicking tags BUILDS UP a filter (drill into
    // the intersection), and clicking an active tag removes it. This is what makes
    // tags feel like nested folders for the VFX flow (vs. the old replace-on-click).
    if (selectedTags.has(tag)) selectedTags.delete(tag)
    else selectedTags.add(tag)
    tagAnchor.value = tag
  }

  function removeTag(tag: string) {
    selectedTags.delete(tag)
    if (tagAnchor.value === tag) tagAnchor.value = null
  }

  /** Additive toggle of a tag's membership (used by the search bar's Tag filter,
      which shares this same selectedTags state with the sidebar). */
  function toggleTag(tag: string) {
    if (selectedTags.has(tag)) selectedTags.delete(tag)
    else selectedTags.add(tag)
    tagAnchor.value = tag
  }

  function clearTags() {
    selectedTags.clear()
    tagAnchor.value = null
  }

  /**
   * Applied filter values from the search palette (mock — these don't filter the
   * asset list, they just surface as chips). One Set per filter type; values are
   * additive (you can apply several Model types, etc.), matching the Figma chip
   * bar. Tag is NOT here — it's shared with the sidebar via `selectedTags`.
   */
  const appliedFilters = reactive<Record<string, Set<string>>>({
    date: new Set(),
    media: new Set(),
    model: new Set(),
    lora: new Set(),
    workflow: new Set(),
  })
  /** Favorited is a single toggle, not a value list. */
  const favorited = ref(false)
  /** Previews is a single toggle (like Favorited) — filters to just the temporary
   *  preview assets. Only surfaced in the filter menus when "Show preview assets"
   *  is on; auto-resets when that view option is turned off (below). */
  const previews = ref(false)
  /** Committed free-text search (filters the grid by asset name); shown as a
   *  removable chip in the gallery tab. (The dock has its own local search.) */
  const searchQuery = ref('')

  /** Menu click: toggle a value in/out of its filter type (no checkmark UI — the
      chip bar is the source of truth, so re-selecting an applied value removes it). */
  function toggleFilter(key: string, value: string) {
    const s = appliedFilters[key]
    if (!s) return
    s.has(value) ? s.delete(value) : s.add(value)
  }
  /** Chip × — always removes. */
  function removeFilter(key: string, value: string) {
    appliedFilters[key]?.delete(value)
  }
  function toggleFavorited() {
    favorited.value = !favorited.value
  }
  function togglePreviews() {
    previews.value = !previews.value
  }
  // Turning OFF "Show preview assets" hides every preview, so a lingering Previews
  // filter would empty the grid — reset it (and it's no longer shown in the menus).
  watch(
    () => viewOptions.value.showPreviews,
    (on) => {
      if (!on) previews.value = false
    },
  )
  function filterTypeCount(key: string) {
    return appliedFilters[key]?.size ?? 0
  }

  const anyFilterApplied = computed(
    () =>
      favorited.value ||
      previews.value ||
      searchQuery.value.trim().length > 0 ||
      selectedTags.size > 0 ||
      MOCK_FILTER_KEYS.some((k) => appliedFilters[k]!.size > 0),
  )

  function clearAllFilters() {
    favorited.value = false
    previews.value = false
    searchQuery.value = ''
    selectedTags.clear()
    tagAnchor.value = null
    MOCK_FILTER_KEYS.forEach((k) => appliedFilters[k]!.clear())
  }

  /** Flat list for the under-header chip bar: tags + mock filter values + favorited.
   *  (The free-text search is NOT a chip — it stays in the search bar itself, with
   *  its own clear ✕; it still counts toward anyFilterApplied + clearAllFilters.) */
  const appliedFilterChips = computed(() => {
    const out: { key: string; value: string; label: string }[] = []
    for (const t of selectedTags) out.push({ key: 'tag', value: t, label: t })
    for (const k of MOCK_FILTER_KEYS)
      for (const v of appliedFilters[k]!) out.push({ key: k, value: v, label: v })
    if (favorited.value) out.push({ key: 'favorited', value: '', label: 'Favorited' })
    if (previews.value) out.push({ key: 'previews', value: '', label: 'Previews' })
    return out
  })

  function removeChip(chip: { key: string; value: string }) {
    if (chip.key === 'search') searchQuery.value = ''
    else if (chip.key === 'tag') removeTag(chip.value)
    else if (chip.key === 'favorited') favorited.value = false
    else if (chip.key === 'previews') previews.value = false
    else removeFilter(chip.key, chip.value)
  }

  /** Sort a list by the active sort order. Shared by the main pipeline and the
   *  per-job drill-in (so a drilled job honours the user's chosen order too). */
  function sortByActiveOrder<T extends { createdAt: number; name: string }>(list: T[]): T[] {
    const sorted = [...list]
    switch (sortOrder.value) {
      case 'newest':
        sorted.sort((a, b) => b.createdAt - a.createdAt)
        break
      case 'oldest':
        sorted.sort((a, b) => a.createdAt - b.createdAt)
        break
      case 'az':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'za':
        sorted.sort((a, b) => b.name.localeCompare(a.name))
        break
    }
    return sorted
  }

  /** Filter pipeline: sort → category → tag union. */
  const filteredAssets = computed(() => {
    let result = sortByActiveOrder(assets)
    // Preview assets are temporary (need explicit download) — hidden unless the
    // "Show preview assets" view option is on.
    if (!viewOptions.value.showPreviews) {
      result = result.filter((a) => !a.preview)
    }

    if (activeCategory.value === 'favorites') {
      result = result.filter((a) => a.favorite)
    } else if (
      activeCategory.value === 'generated' ||
      activeCategory.value === 'imported'
    ) {
      result = result.filter((a) => a.category === activeCategory.value)
    }

    if (selectedTags.size > 0) {
      // 'all' → intersection (must have every selected tag · the folder-drill
      // default); 'any' → union (has at least one).
      result =
        tagMatch.value === 'all'
          ? result.filter((a) => [...selectedTags].every((t) => a.tags.includes(t)))
          : result.filter((a) => a.tags.some((t) => selectedTags.has(t)))
    }

    // Media type is REAL (driven by each asset's `mediaType`) — its applied values
    // are the option labels ('Image' / 'Video' / 'Audio' / '3D model'), so map the
    // asset's type to that label and keep it if the label is selected.
    const media = appliedFilters['media']
    if (media && media.size > 0) {
      result = result.filter((a) => media.has(MEDIA_LABELS[a.mediaType ?? 'image']))
    }

    // The Favorited filter is REAL (favoriting is real asset data) — like Media
    // type above, but unlike the mock model/lora/workflow chips (display-only).
    if (favorited.value) {
      result = result.filter((a) => a.favorite)
    }

    // Previews filter — keep only the temporary preview assets. (Only reachable
    // when "Show preview assets" is on, which is also what keeps them in the pool.)
    if (previews.value) {
      result = result.filter((a) => a.preview)
    }

    const q = searchQuery.value.trim().toLowerCase()
    if (q) {
      result = result.filter((a) => a.name.toLowerCase().includes(q))
    }

    return result
  })

  /* ── Group by job ─────────────────────────────────────────────────────────
   * When "Group assets by job" (viewOptions.groupByJob) is on, assets sharing a
   * jobId collapse to ONE cover card (the newest member) carrying a +N badge; the
   * other members are hidden from the grid (reachable via the per-job drill-in —
   * a later pass). Off → the flat filtered list. Tab only for now. */
  const jobMembers = computed(() => {
    const m = new Map<string, AssetRow[]>()
    if (!viewOptions.value.groupByJob) return m
    for (const a of filteredAssets.value) {
      if (!a.jobId) continue
      const arr = m.get(a.jobId)
      if (arr) arr.push(a)
      else m.set(a.jobId, [a])
    }
    return m
  })
  /** jobId → cover (newest member) name, for jobs with 2+ members in this view. */
  const jobCovers = computed(() => {
    const covers = new Map<string, string>()
    for (const [job, members] of jobMembers.value) {
      if (members.length < 2) continue
      const cover = members.reduce((best, a) => (a.createdAt > best.createdAt ? a : best))
      covers.set(job, cover.name)
    }
    return covers
  })
  /* ── Per-job drill-in ──────────────────────────────────────────────────────
   * Clicking a group cover's +N badge enters that job: the grid shows just that
   * job's outputs (all members — ignoring grouping + the category/tag/preview
   * filters, like a folder, but HONOURING the active sort), and the header swaps
   * its title for a breadcrumb (parent category crumb = back, final crumb = the
   * cover/output name). Tab view only. */
  const drilledJobId = ref<string | null>(null)
  function openJob(jobId?: string) {
    if (!jobId) return
    drilledJobId.value = jobId
    selectedAssets.clear()
  }
  function exitJob() {
    drilledJobId.value = null
  }
  /** Members of the drilled job (all of them, unfiltered), sorted by active order. */
  const drilledMembers = computed(() =>
    drilledJobId.value
      ? sortByActiveOrder(assets.filter((a) => a.jobId === drilledJobId.value))
      : [],
  )
  /** Breadcrumb label for the drilled job = its cover (newest member / "final"
   *  output) name. Computed from ALL members so it's stable regardless of filters. */
  const drilledLabel = computed(() => {
    if (!drilledJobId.value) return null
    const members = assets.filter((a) => a.jobId === drilledJobId.value)
    if (!members.length) return null
    return members.reduce((best, a) => (a.createdAt > best.createdAt ? a : best)).name
  })

  /** The list the grid renders: a drilled job's members, else grouped covers. */
  const displayAssets = computed(() => {
    if (drilledJobId.value) return drilledMembers.value
    if (!viewOptions.value.groupByJob) return filteredAssets.value
    const covers = jobCovers.value
    return filteredAssets.value.filter(
      (a) => !a.jobId || !covers.has(a.jobId) || covers.get(a.jobId) === a.name,
    )
  })
  /** cover name → number of ADDITIONAL outputs behind it (drives the +N badge). */
  const groupCounts = computed(() => {
    const counts: Record<string, number> = {}
    // No nested grouping: inside a drilled job, members never carry a +N badge.
    if (drilledJobId.value) return counts
    for (const [job, members] of jobMembers.value) {
      if (members.length < 2) continue
      const coverName = jobCovers.value.get(job)
      if (coverName) counts[coverName] = members.length - 1
    }
    return counts
  })

  /** True when every currently-visible (displayed) asset is already selected. */
  const allVisibleSelected = computed(
    () =>
      displayAssets.value.length > 0 &&
      displayAssets.value.every((a) => selectedAssets.has(a.name)),
  )

  /** "Select all" — toggles selection of just what's visible (the displayed list). */
  function toggleSelectAll() {
    if (allVisibleSelected.value) clearSelection()
    else displayAssets.value.forEach((a) => selectedAssets.add(a.name))
  }

  /** Header text per user spec:
   *  - 0 tags: active category label
   *  - 1 tag : `Tagged with "name"`
   *  - 2+    : `Tagged with multiple tags`
   */
  const headerTitle = computed(() => {
    if (selectedTags.size === 1) {
      const [only] = selectedTags
      return `Tagged with "${only}"`
    }
    if (selectedTags.size > 1) return 'Tagged with multiple tags'
    return CATEGORY_LABELS[activeCategory.value]
  })

  // Drilled into a job → count its members; otherwise the filtered total.
  const headerCount = computed(() =>
    drilledJobId.value ? drilledMembers.value.length : filteredAssets.value.length,
  )

  const selectedTagsArray = computed(() => Array.from(selectedTags))

  return {
    // state
    activeCategory,
    selectedTags,
    tags,
    tagCounts,
    tagSort,
    displayedTags,
    sortOrder,
    viewOptions,
    sizeStep,
    mode,
    setMode,
    masonryAxis,
    setMasonryAxis,
    galleryLayout,
    // actions
    selectCategory,
    selectTag,
    tagMatch,
    toggleTagMatch,
    setTagMatch,
    addTag,
    toggleTag,
    renameTag,
    deleteTag,
    deleteSelectedTags,
    moveTag,
    setTagSort,
    removeTag,
    clearTags,
    // applied search-palette filters (mock) + chip bar
    appliedFilters,
    favorited,
    previews,
    searchQuery,
    toggleFilter,
    removeFilter,
    toggleFavorited,
    togglePreviews,
    filterTypeCount,
    anyFilterApplied,
    clearAllFilters,
    appliedFilterChips,
    removeChip,
    randomizeNames,
    clearSelection,
    toggleSelectAll,
    toggleFavorite,
    favoriteFromCard,
    favoriteSelected,
    toggleFavoriteSelected,
    allSelectedFavorited,
    deleteSelected,
    // asset details panel
    detailsOpen,
    openDetails,
    closeDetails,
    toggleDetails,
    detailAsset,
    detailSelectionAssets,
    sharedSelectionTags,
    tagSelectionState,
    toggleTagForSelection,
    removeTagFromSelection,
    createTagForSelection,
    renameAsset,
    // inspect lightbox
    inspectOpen,
    inspectName,
    inspectAsset,
    openInspect,
    closeInspect,
    inspectSelect,
    inspectStep,
    // quick look (space)
    quickLookOpen,
    quickLookAsset,
    openQuickLook,
    closeQuickLook,
    // derived
    filteredAssets,
    displayAssets,
    groupCounts,
    drilledJobId,
    drilledLabel,
    openJob,
    exitJob,
    headerTitle,
    headerCount,
    selectedTagsArray,
    sizeBreakpoint,
    // selection
    selectedAssets,
    allVisibleSelected,
  }
}
