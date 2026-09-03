import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { project, theme, type Framing, type Rect } from '../theme'

interface ChangeHighlightProps {
  /** Regions that changed, in screenshot CSS pixels. */
  boxes: Rect[]
  /** Frame the result of the press becomes visible. */
  startFrame: number
  /** Current push-in, so a box stays locked to the pixels it describes. */
  framing: Framing
  holdInFrames?: number
}

const APPEAR = 10
const FADE = 15

/**
 * Rings the regions that changed when a button was pressed, so the eye lands on the state
 * change rather than hunting for it. Boxes come from diffing the before/after captures.
 */
export const ChangeHighlight = ({ boxes, startFrame, framing, holdInFrames = 34 }: ChangeHighlightProps) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (!boxes.length) return null

  const magnify = framing.cover * framing.scale

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
      {boxes.map((box, index) => {
        const begin = startFrame + index * 4
        const local = frame - begin
        if (local < -1) return null

        const appear = spring({
          frame: local,
          fps,
          config: { damping: 18, mass: 0.6, stiffness: 130 },
          durationInFrames: APPEAR,
        })
        const opacity = interpolate(
          local,
          [0, APPEAR * 0.6, APPEAR + holdInFrames, APPEAR + holdInFrames + FADE],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )
        if (opacity <= 0) return null

        const { x, y } = project({ x: box.x, y: box.y }, framing)
        const width = box.width * magnify
        const height = box.height * magnify
        // Overshoot slightly on entry so the ring reads as landing on the region.
        const swell = 1 + (1 - appear) * 0.045

        return (
          <div
            key={`${box.x}-${box.y}-${box.width}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width,
              height,
              borderRadius: 12,
              border: `3px solid ${theme.green}`,
              background: 'rgba(48,209,88,.07)',
              boxShadow: '0 0 0 1px rgba(255,255,255,.45), 0 10px 34px rgba(48,209,88,.32)',
              opacity,
              transform: `scale(${swell})`,
              transformOrigin: 'center',
            }}
          />
        )
      })}
    </div>
  )
}
