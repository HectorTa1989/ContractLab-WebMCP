export const theme = {
  ink: '#0b0b0f',
  inkSoft: '#15151c',
  paper: '#f5f5f7',
  line: 'rgba(255,255,255,.12)',
  text: '#f6f6f8',
  textMuted: 'rgba(246,246,248,.66)',
  blue: '#0a84ff',
  purple: '#7c5cff',
  green: '#30d158',
  orange: '#ff9f0a',
  sans: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  mono: '"Cascadia Code", "SF Mono", ui-monospace, Consolas, monospace',
} as const

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export interface Rect { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }

/** Everything below works in the screenshot's own CSS pixels (a 1600x900 viewport). */
export interface Framing {
  /** CSS pixel → box pixel factor for the fully zoomed-out image. */
  cover: number
  /** Extra push-in on top of `cover`. */
  scale: number
  x: number
  y: number
}

/** Scale at which the screenshot covers `box` with no empty edges. */
export const coverScale = (viewport: Size, box: Size) =>
  Math.max(box.width / viewport.width, box.height / viewport.height)

/** Place the image at a given push-in so `center` sits as close to the middle of `box` as the edges allow. */
export const framingFor = (
  center: { x: number; y: number },
  scale: number,
  viewport: Size,
  box: Size,
): Framing => {
  const cover = coverScale(viewport, box)
  const drawn = { width: viewport.width * cover * scale, height: viewport.height * cover * scale }
  const cx = center.x * cover * scale
  const cy = center.y * cover * scale
  return {
    cover,
    scale,
    x: clamp(box.width / 2 - cx, box.width - drawn.width, 0),
    y: clamp(box.height / 2 - cy, box.height - drawn.height, 0),
  }
}

export interface FocusOptions {
  padding?: number
  maxZoom?: number
  minZoom?: number
  fit?: 'contain' | 'width'
}

/** The push-in that frames `focus` inside `box`, and the point it should be centred on. */
export const focusPlan = (
  focus: Rect | null,
  viewport: Size,
  box: Size,
  { padding = 52, maxZoom = 2.05, minZoom = 1, fit = 'contain' }: FocusOptions = {},
) => {
  const cover = coverScale(viewport, box)
  const centre = focus
    ? { x: focus.x + focus.width / 2, y: focus.y + focus.height / 2 }
    : { x: viewport.width / 2, y: viewport.height / 2 }
  if (!focus) return { centre, scale: minZoom }
  const byWidth = box.width / (focus.width * cover + padding * 2)
  const byHeight = box.height / (focus.height * cover + padding * 2)
  // 'contain' keeps the whole region on screen; 'width' fills the frame across and lets a
  // tall panel run off the top and bottom, which is what a vertical crop needs.
  const scale = clamp(fit === 'width' ? byWidth : Math.min(byWidth, byHeight), minZoom, maxZoom)
  return { centre, scale }
}

/** Project a screenshot CSS point into box pixels under a framing. */
export const project = (point: { x: number; y: number }, framing: Framing) => ({
  x: point.x * framing.cover * framing.scale + framing.x,
  y: point.y * framing.cover * framing.scale + framing.y,
})

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
