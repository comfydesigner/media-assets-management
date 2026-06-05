// Shared placeholder "thumbnail" styling for assets (until real thumbnails exist).
// A vibrant MESH gradient — a dominant base colour with two soft radial light
// sources at varied corners (per asset, so every tile looks distinct) — evokes the
// look of freshly-generated AI imagery. The inspect lightbox opts into a fine grid
// (sized in %, so it SCALES with the element) to make zoom levels obvious.

// 3-colour mesh palettes: [light source A, dominant base, light source B]. MOST are
// muted/desaturated (calmer library) with a FEW vibrant ones sprinkled in. The hash
// picks per asset, and there are more muted entries, so most tiles read muted.
const GRADIENTS: [string, string, string][] = [
  // Muted (majority) — low-saturation, multi-hue blends.
  ['#7c89a8', '#5a6478', '#9a8794'], // dusty blue · slate · mauve
  ['#7e9080', '#5c6a5e', '#8f8a76'], // sage · moss · stone
  ['#9a8390', '#6d5d68', '#a08d7c'], // taupe · plum-grey · sand
  ['#76819c', '#565d78', '#86789a'], // muted indigo · slate · lilac
  ['#7e938f', '#5b6a66', '#928c80'], // muted teal · pine · greige
  ['#a0857c', '#6f5d57', '#8a8298'], // clay · cocoa · dusty violet
  // Vibrant (a few).
  ['#6b8cff', '#ff3b3b', '#ffb38a'], // blue · red · peach
  ['#28c76f', '#19c2c2', '#2b8cff'], // green · teal · blue
]

// Corner/edge anchor points for the radial light sources.
const POS = ['16% 14%', '84% 16%', '14% 84%', '86% 82%', '50% 8%', '8% 50%', '92% 50%'] as const

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** The dominant base colour for a name. Used as a solid backdrop where a flat tint
 *  is wanted (rather than the full mesh). */
export function placeholderTint(name: string) {
  return GRADIENTS[hash(name) % GRADIENTS.length]![1]
}

/**
 * @param withGrid  Overlay the fine scaling grid. OFF by default — tiles read as
 *   clean gradient thumbnails. Only the inspect lightbox's main image opts IN.
 */
export function placeholderBg(name: string, withGrid = false) {
  const h = hash(name)
  const [a, base, b] = GRADIENTS[h % GRADIENTS.length]!
  // Two light sources at two DIFFERENT anchors for a mesh-like blend.
  const p1 = POS[h % POS.length]!
  const p2 = POS[(Math.floor(h / 7) % (POS.length - 1)) + (h % POS.length === 0 ? 1 : 0)]!
  const pB = p2 === p1 ? POS[(POS.indexOf(p1) + 3) % POS.length]! : p2
  const mesh = [
    `radial-gradient(circle at ${p1}, ${a}, transparent 70%)`,
    `radial-gradient(circle at ${pB}, ${b}, transparent 70%)`,
  ]
  if (!withGrid) {
    return { backgroundColor: base, backgroundImage: mesh.join(','), backgroundSize: '100% 100%' }
  }
  return {
    backgroundColor: base,
    backgroundImage: [
      // Fine grid that scales with the element → reveals the zoom level.
      'linear-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)',
      'linear-gradient(90deg, rgba(255,255,255,0.10) 1px, transparent 1px)',
      ...mesh,
    ].join(','),
    backgroundSize: '12.5% 12.5%, 12.5% 12.5%, 100% 100%, 100% 100%',
  }
}
