import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Asset } from '@/components/gallery/types'
import { useAssetDrag } from './useAssetDrag'

/**
 * Shared asset-grid selection behavior (used by the main gallery AND the
 * workflow Media dock), so both get identical interactions:
 *   - plain click        → select only this (Finder-style replace)
 *   - Cmd/Ctrl click     → toggle this one (additive)
 *   - Shift click        → range-select from the anchor (guarded against a stale
 *                          anchor after the selection was cleared)
 *   - marquee drag        → rubber-band select; drag on empty space clears
 *
 * `getAssets` returns the CURRENT ordered asset list (DOM card order must match,
 * since the marquee maps hit cards back to assets by index).
 */
export function useAssetSelection(
  getAssets: () => Asset[],
  selected: Set<string>,
  /** Invoked by Enter (or double-click) when something is selected → lightbox. */
  onInspect?: () => void,
  /** Dock only: pointer-down on a card + drag = pull the asset(s) OUT to the
   *  canvas (instead of a marquee). The gallery leaves this off. */
  dragOut = false,
  /** Invoked by Space when something is selected → macOS-style Quick Look. */
  onQuickLook?: () => void,
  /** Invoked by "I" when something is selected → toggle the details panel/popover. */
  onShowDetails?: () => void,
) {
  const containerRef = ref<HTMLElement | null>(null)
  const drag = useAssetDrag()
  const marquee = ref<{ left: number; top: number; width: number; height: number } | null>(null)

  // Anchor for shift-range select: the last plainly-clicked card (by name, so it
  // survives re-sorts/filters).
  let anchorName: string | null = null

  function onCardClick(i: number, e: MouseEvent) {
    // A marquee drag ends with a synthetic click on the card under the pointer;
    // swallow that one so it doesn't undo the drag selection.
    if (suppressClick) {
      suppressClick = false
      return
    }
    const assets = getAssets()
    const name = assets[i]?.name
    if (!name) return

    if (e.shiftKey && anchorName && selected.has(anchorName)) {
      const anchorIdx = assets.findIndex((a) => a.name === anchorName)
      if (anchorIdx >= 0) {
        const [lo, hi] = [Math.min(anchorIdx, i), Math.max(anchorIdx, i)]
        selected.clear()
        for (let k = lo; k <= hi; k++) selected.add(assets[k]!.name)
        return
      }
    }

    if (e.metaKey || e.ctrlKey) {
      if (selected.has(name)) selected.delete(name)
      else selected.add(name)
      anchorName = name
      return
    }

    selected.clear()
    selected.add(name)
    anchorName = name
  }

  /* ── Marquee (rubber-band) selection ─────────────────────────────────────── */
  let startX = 0
  let startY = 0
  let baseSelection = new Set<string>()
  let active = false
  let suppressClick = false
  const DRAG_THRESHOLD = 4

  function rectsIntersect(
    a: DOMRect,
    b: { left: number; top: number; right: number; bottom: number },
  ) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
  }

  function applyMarquee(clientX: number, clientY: number) {
    const el = containerRef.value
    if (!el) return
    const left = Math.min(startX, clientX)
    const top = Math.min(startY, clientY)
    const right = Math.max(startX, clientX)
    const bottom = Math.max(startY, clientY)

    // Visual rect in VIEWPORT coords (rendered as a fixed overlay) so the band can
    // begin in the header and run into the grid without being clipped by the
    // grid's scroll container.
    marquee.value = { left, top, width: right - left, height: bottom - top }

    const cards = el.querySelectorAll<HTMLElement>('button[aria-pressed]')
    const assets = getAssets()
    const next = new Set(baseSelection)
    cards.forEach((card, i) => {
      if (rectsIntersect(card.getBoundingClientRect(), { left, top, right, bottom })) {
        // Map a hit card to its asset by NAME (data-name): in column-masonry the
        // DOM order is column-major, so index-based lookup picks the wrong asset.
        const name = card.dataset.name ?? assets[i]?.name
        if (name) next.add(name)
      }
    })
    selected.clear()
    next.forEach((n) => selected.add(n))
  }

  function onPointerMove(e: PointerEvent) {
    if (!active && Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return
    active = true
    applyMarquee(e.clientX, e.clientY)
  }

  function onPointerUp(e: PointerEvent) {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    document.body.style.removeProperty('user-select')
    document.body.style.removeProperty('-webkit-user-select')
    if (active) {
      suppressClick = true // eat the trailing click on whatever card we're over
    } else {
      const onCard = (e.target as HTMLElement)?.closest('button[aria-pressed]')
      if (!onCard) selected.clear()
    }
    active = false
    marquee.value = null
  }

  // Dock only: drag a card OUT to the canvas. pointer-down on a card → potential
  // drag (move past threshold = drag-to-canvas via the shared useAssetDrag store;
  // release without moving = a normal click/select). Grabbing a card that's part
  // of a multi-selection drags the whole selection; otherwise just that card.
  function startCardDrag(name: string, e: PointerEvent) {
    const names = selected.has(name) && selected.size > 1 ? [...selected] : [name]
    const sx = e.clientX
    const sy = e.clientY
    let started = false
    const move = (ev: PointerEvent) => {
      if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return
      if (!started) {
        started = true
        drag.begin(names, ev.clientX, ev.clientY)
      } else {
        drag.move(ev.clientX, ev.clientY)
      }
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (started) {
        // Creates node(s) if released over the canvas; returns whether it landed.
        const placed = drag.drop(ev.clientX, ev.clientY)
        if (placed) selected.clear() // placed assets deselect; the node(s) are now selected
        suppressClick = true // a real drag happened → don't let the trailing click select
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || !containerRef.value) return
    const t = e.target as HTMLElement
    const card = t.closest<HTMLElement>('button[aria-pressed]')
    if (card) {
      // On a card: a marquee may start here; only the per-card action buttons
      // (star / more) opt out.
      if (t.closest('[role="button"]')) return
    } else if (
      // Off-card (header / chips / empty space): a marquee MAY start so users can
      // rubber-band from the empty header — but never hijack interactive controls.
      t.closest(
        'button, input, textarea, select, a[href], [role="button"], [role="slider"], [role="tab"], [role="menu"], [role="dialog"], [role="combobox"], [contenteditable], [data-marquee-skip]',
      )
    ) {
      return
    }
    // Fresh interaction: clear any stale suppression left over from a marquee
    // that ended on empty space (its trailing click never landed on a card to
    // consume the flag — otherwise this click would be wrongly swallowed).
    suppressClick = false

    // Dock: starting a drag ON a card pulls it out to the canvas — UNLESS Ctrl/⌘ is
    // held, which instead starts a marquee from anywhere (mirrors the canvas's
    // Ctrl+drag box-select, so users don't have to find an empty spot to begin).
    if (dragOut && !e.ctrlKey && !e.metaKey) {
      const card = (e.target as HTMLElement)?.closest<HTMLElement>('button[aria-pressed]')
      if (card) {
        const cards = [
          ...containerRef.value.querySelectorAll<HTMLElement>('button[aria-pressed]'),
        ]
        const name = card.dataset.name ?? getAssets()[cards.indexOf(card)]?.name
        if (name) {
          startCardDrag(name, e)
          return // skip the marquee
        }
      }
    }

    startX = e.clientX
    startY = e.clientY
    baseSelection = e.shiftKey || e.metaKey || e.ctrlKey ? new Set(selected) : new Set()
    active = false
    // Suppress native text selection for the duration of the drag — otherwise a
    // marquee that starts in the header text-selects the labels ("All", "Select
    // all", …). Restored in onPointerUp. (Inputs keep their own selection.)
    document.body.style.setProperty('user-select', 'none')
    document.body.style.setProperty('-webkit-user-select', 'none')
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  /* ── Context menu (right-click + the card's "more" button) ───────────────── */
  const menu = ref<{ x: number; y: number; multiple: boolean } | null>(null)

  // Inside a multi-selection → act on the whole selection; otherwise select just
  // this card and show the single-asset menu. `x`/`y` is the menu's anchor point.
  function openCardMenu(name: string, x: number, y: number) {
    if (selected.has(name) && selected.size > 1) {
      menu.value = { x, y, multiple: true }
    } else {
      selected.clear()
      selected.add(name)
      menu.value = { x, y, multiple: false }
    }
  }
  function onCardContextMenu(name: string, e: MouseEvent) {
    e.preventDefault()
    openCardMenu(name, e.clientX, e.clientY) // anchored at the cursor
  }
  // The hover "more" button opens the SAME menu, anchored to the button.
  function onCardMore(name: string, rect: DOMRect) {
    openCardMenu(name, rect.left, rect.bottom + 4)
  }
  function closeMenu() {
    menu.value = null
  }

  /* ── Keyboard: Space/Enter → Inspect, arrow keys → move selection ────────── */
  function onKeydown(e: KeyboardEvent) {
    if (selected.size === 0) return
    // The inspect lightbox owns the keyboard while open (←/→ step assets there).
    if (document.querySelector('[aria-label="Zoom level"]')) return
    const ae = document.activeElement as HTMLElement | null
    // Don't hijack typing or menu/dialog keyboard handling.
    if (
      ae &&
      (ae.tagName === 'INPUT' ||
        ae.tagName === 'TEXTAREA' ||
        ae.isContentEditable ||
        ae.closest('[role="menu"],[role="dialog"]'))
    )
      return

    // Esc clears the selection. If the right-click menu is open, leave it to the
    // menu's own Esc (it closes itself) — a second Esc then clears the selection.
    if (e.key === 'Escape') {
      if (menu.value) return
      e.preventDefault()
      selected.clear()
      // Blur the focused card — a click focuses the card button (no ring), but
      // the Esc keydown flips it to :focus-visible → a stale azure ring would
      // linger after the selection is gone.
      const ae = document.activeElement as HTMLElement | null
      if (ae && containerRef.value?.contains(ae)) ae.blur()
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      onInspect?.() // → full lightbox (same as double-click)
      return
    }
    if (e.key === ' ') {
      e.preventDefault()
      onQuickLook?.() // → macOS-style Quick Look mini preview
      return
    }
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault()
      onShowDetails?.() // → toggle the details panel/popover (context-menu "I")
      return
    }

    // Cmd/Ctrl+A → select every loaded asset in THIS panel. Scope is handled for
    // free by the early `selected.size === 0` return above: the user "enters" the
    // panel by clicking one asset first, which both (a) tells us the asset grid —
    // not the canvas — owns the keyboard right now (no fragile focus-vs-canvas
    // detection needed), and (b) keeps us from hijacking the browser's native
    // select-all when no asset context is active. We sweep the rendered cards in
    // `containerRef`, so this matches Comfy's paginated library — only assets
    // currently loaded into the DOM get selected, which is the intended behavior.
    if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault()
      const cards = containerRef.value?.querySelectorAll<HTMLElement>('button[aria-pressed]')
      cards?.forEach((c) => {
        const n = c.dataset.name
        if (n) selected.add(n)
      })
      return
    }

    const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
    if (!arrows.includes(e.key)) return
    const cards = [...(containerRef.value?.querySelectorAll<HTMLElement>('button[aria-pressed]') ?? [])]
    if (!cards.length) return
    // Current card = the anchor (last-clicked) or the first selected card.
    const curName = anchorName ?? [...selected][0]
    const curEl = cards.find((c) => c.dataset.name === curName) ?? null
    if (!curEl) return
    e.preventDefault()
    // GEOMETRIC nav off card centers (DOM order ≠ visual order in masonry). Left/
    // Right move ALONG the current row, then WRAP to the adjacent row's edge card
    // (reading order — so the row's end takes you to the next line, unlike Finder);
    // Up/Down pick the nearest card in that direction favouring the same column.
    const cr = curEl.getBoundingClientRect()
    const cx = cr.left + cr.width / 2
    const cy = cr.top + cr.height / 2
    const rowTol = cr.height * 0.5 // centers within half a card-height = same row
    const centers = cards
      .filter((el) => el !== curEl)
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { el, x: r.left + r.width / 2, y: r.top + r.height / 2 }
      })
    let best: HTMLElement | null = null

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const dir = e.key === 'ArrowRight' ? 1 : -1
      // 1) nearest neighbour along the SAME row in the pressed direction.
      let bestAlong = Infinity
      for (const c of centers) {
        if (Math.abs(c.y - cy) > rowTol) continue
        const along = (c.x - cx) * dir
        if (along <= 1) continue
        if (along < bestAlong) {
          bestAlong = along
          best = c.el
        }
      }
      // 2) row end → wrap to the adjacent row's edge (Right→next row's leftmost,
      //    Left→previous row's rightmost).
      if (!best) {
        const rowCands = centers.filter((c) => (dir === 1 ? c.y > cy + rowTol : c.y < cy - rowTol))
        if (rowCands.length) {
          const rowY =
            dir === 1
              ? Math.min(...rowCands.map((c) => c.y))
              : Math.max(...rowCands.map((c) => c.y))
          const inRow = rowCands.filter((c) => Math.abs(c.y - rowY) <= rowTol)
          best = inRow.reduce((a, b) => ((dir === 1 ? b.x < a.x : b.x > a.x) ? b : a)).el
        }
      }
    } else {
      // Up / Down — nearest card in direction, same-column alignment dominating.
      const dir = e.key === 'ArrowDown' ? 1 : -1
      let bestScore = Infinity
      for (const c of centers) {
        const along = (c.y - cy) * dir
        if (along <= 1) continue
        const score = Math.abs(c.x - cx) * 3 + along
        if (score < bestScore) {
          bestScore = score
          best = c.el
        }
      }
    }
    const name = best?.dataset.name
    if (!best || !name) return
    selected.clear()
    selected.add(name)
    anchorName = name
    // Focus the SAME card we selected (no stale focus ring on a different card).
    best.focus({ preventScroll: true })
    best.scrollIntoView({ block: 'nearest' })
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

  return {
    containerRef,
    marquee,
    onCardClick,
    onPointerDown,
    menu,
    onCardContextMenu,
    onCardMore,
    closeMenu,
  }
}
