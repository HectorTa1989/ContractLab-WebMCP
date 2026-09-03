import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { project, type Framing } from '../theme'

export interface Point { x: number; y: number }

interface CursorProps {
  /** Where the pointer starts, in screenshot CSS pixels. */
  from: Point
  /** Where the pointer lands, in screenshot CSS pixels. */
  to: Point
  startFrame: number
  pressFrame: number
  exitFrame: number
  /** Current push-in, so the pointer stays glued to the control it presses. */
  framing: Framing
  size?: number
}

const Pointer = ({ pressed, size }: { pressed: number; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `scale(${1 - pressed * 0.16})`, transformOrigin: '3px 2px' }}>
    <defs>
      <filter id="cursor-shadow" x="-60%" y="-60%" width="240%" height="240%">
        <feDropShadow dx="0" dy="1.1" stdDeviation="1.1" floodColor="rgba(0,0,0,.5)" />
      </filter>
    </defs>
    <path
      d="M3.2 2.1 L3.2 18.4 L7.35 14.4 L10.05 20.6 L12.75 19.4 L10.1 13.35 L15.8 13.35 Z"
      fill="#ffffff"
      stroke="#1c1c1e"
      strokeWidth={1.3}
      strokeLinejoin="round"
      filter="url(#cursor-shadow)"
    />
  </svg>
)

export const Cursor = ({ from, to, startFrame, pressFrame, exitFrame, framing, size = 46 }: CursorProps) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const travel = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 200, mass: 0.9, stiffness: 90 },
    durationInFrames: Math.max(12, pressFrame - startFrame),
  })

  const { x, y } = project(
    { x: from.x + (to.x - from.x) * travel, y: from.y + (to.y - from.y) * travel },
    framing,
  )

  const pressed = interpolate(frame, [pressFrame - 3, pressFrame, pressFrame + 5], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = interpolate(frame, [startFrame - 6, startFrame, exitFrame, exitFrame + 10], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const age = frame - pressFrame
  const ringVisible = age >= 0 && age < 24
  const ring = interpolate(age, [0, 23], [0.2, 2.4], { extrapolateRight: 'clamp' })
  const ringOpacity = interpolate(age, [0, 5, 23], [0.6, 0.4, 0], { extrapolateRight: 'clamp' })

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity, zIndex: 5 }}>
      {ringVisible && (
        <div
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: size * 1.9,
            height: size * 1.9,
            marginLeft: -size * 0.95,
            marginTop: -size * 0.95,
            borderRadius: '50%',
            border: '3px solid rgba(10,132,255,.95)',
            background: 'rgba(10,132,255,.15)',
            transform: `scale(${ring})`,
            opacity: ringOpacity,
          }}
        />
      )}
      <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-4px, -3px)' }}>
        <Pointer pressed={pressed} size={size} />
      </div>
    </div>
  )
}
