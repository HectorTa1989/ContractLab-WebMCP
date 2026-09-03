import { Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { ChangeHighlight } from './components/ChangeHighlight'
import { Cursor, type Point } from './components/Cursor'
import { Screen } from './components/Screen'
import { focusPlan, framingFor, lerp, theme, type FocusOptions, type Framing, type Rect, type Size } from './theme'

export interface TimelineScene {
  id: string
  kind: 'title' | 'hold' | 'click' | 'burst' | 'outro'
  from: number
  durationInFrames: number
  audio: string
  audioDelayInFrames: number
  audioDurationInFrames: number
  caption: string | null
  title: string | null
  subtitle: string | null
  vo: string
  push: 'none' | 'focus'
  image?: string
  before?: string
  after?: string
  frames?: string[]
  target?: Point
  focus?: Rect | null
  /** Regions that changed when the button was pressed (click scenes). */
  highlights?: Rect[]
  /** Per-frame changed regions (burst scenes). */
  highlightSteps?: Rect[][]
}

interface StageProps {
  scene: TimelineScene
  /** Where the pointer was left by the previous click, in screenshot CSS pixels. */
  cursorFrom: Point
  viewport: Size
  /** The box the screenshot occupies — the whole canvas in landscape, a panel in the vertical cut. */
  box: Size
  focusOptions?: FocusOptions
  cursorSize?: number
}

const EASE = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** Timing of one click beat, in frames from the start of the scene. */
export const clickTiming = (durationInFrames: number) => {
  const travelStart = 5
  const press = Math.max(travelStart + 18, Math.min(travelStart + 30, Math.round(durationInFrames * 0.38)))
  return { travelStart, press, cut: press + 5, exit: press + 18 }
}

export const SceneAudio = ({ scene }: { scene: TimelineScene }) => (
  <Sequence from={scene.audioDelayInFrames} durationInFrames={scene.audioDurationInFrames + 6} name={`vo:${scene.id}`}>
    <Audio src={staticFile(scene.audio)} />
  </Sequence>
)

/**
 * Draws the screenshot layer of one scene: the shot and the pointer. Wording lives in the
 * sidecar .srt tracks rather than burned into the picture, so nothing covers the app UI.
 * Title and outro cards are handled by the compositions themselves.
 */
export const Stage = ({
  scene,
  cursorFrom,
  viewport,
  box,
  focusOptions,
  cursorSize = 46,
}: StageProps) => {
  const frame = useCurrentFrame()
  const plan = focusPlan(scene.focus ?? null, viewport, box, focusOptions)
  const wide = { x: viewport.width / 2, y: viewport.height / 2 }
  const flat = framingFor(wide, 1, viewport, box)
  const framingAt = (centre: Point, scale: number) => framingFor(centre, scale, viewport, box)

  if (scene.kind === 'click' && scene.target && scene.before && scene.after) {
    const { travelStart, press, cut, exit } = clickTiming(scene.durationInFrames)
    const showAfter = frame >= cut
    // Stay flat while the pointer travels, then push in on the result of the press.
    const t = interpolate(frame, [cut + 2, Math.min(scene.durationInFrames - 3, cut + 32)], [0, 1], EASE)
    const framing: Framing =
      showAfter && scene.push !== 'none' && scene.focus
        ? framingAt(
            { x: lerp(wide.x, plan.centre.x, t), y: lerp(wide.y, plan.centre.y, t) },
            lerp(1, plan.scale, t),
          )
        : flat

    return (
      <>
        <Screen src={showAfter ? scene.after : scene.before} framing={framing} viewport={viewport} />
        <Cursor
          from={cursorFrom}
          to={scene.target}
          startFrame={travelStart}
          pressFrame={press}
          exitFrame={exit}
          framing={framing}
          size={cursorSize}
        />
        <ChangeHighlight boxes={scene.highlights ?? []} startFrame={cut} framing={framing} />
      </>
    )
  }

  if (scene.kind === 'burst' && scene.frames?.length) {
    const per = scene.durationInFrames / scene.frames.length
    const index = Math.min(scene.frames.length - 1, Math.floor(frame / per))
    const settle = interpolate(frame - index * per, [0, 9], [0.985, 1], EASE)
    const framing = framingAt(plan.centre, plan.scale * settle)
    return (
      <>
        <Screen src={scene.frames[index]} framing={framing} viewport={viewport} />
        <ChangeHighlight
          boxes={scene.highlightSteps?.[index] ?? []}
          startFrame={Math.round(index * per) + 5}
          framing={framing}
          holdInFrames={Math.max(12, Math.round(per) - 34)}
        />
        <div style={{ position: 'absolute', top: 34, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, zIndex: 4 }}>
          {scene.frames.map((file, dot) => (
            <span
              key={file}
              style={{
                width: dot === index ? 44 : 13,
                height: 8,
                borderRadius: 999,
                background: dot === index ? theme.blue : 'rgba(11,11,15,.24)',
                boxShadow: '0 1px 4px rgba(0,0,0,.18)',
              }}
            />
          ))}
        </div>
      </>
    )
  }

  // hold — settle into the framing, then drift a hair so the frame stays alive
  const settleIn = interpolate(frame, [0, 16], [0, 1], EASE)
  const drift = interpolate(frame, [0, scene.durationInFrames], [0, 1], EASE)
  const targetScale = scene.push === 'focus' && scene.focus ? plan.scale : 1
  const centre = scene.push === 'focus' && scene.focus ? plan.centre : wide
  const scale = lerp(targetScale * 0.972, targetScale * 1.014, drift) * lerp(0.996, 1, settleIn)
  const framing = framingAt(centre, scale)

  return (
    <>
      <Screen src={scene.image ?? ''} framing={framing} viewport={viewport} />
    </>
  )
}
