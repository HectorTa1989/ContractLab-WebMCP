import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { OutroCard, TitleCard } from './components/Cards'
import { SceneAudio, Stage, clickTiming, type TimelineScene } from './Scene'
import { theme } from './theme'
import timeline from './timeline.json'

const scenes = timeline.scenes as TimelineScene[]
const viewport = timeline.viewport

/**
 * Where the pointer sits when a click scene opens: wherever the previous click left it,
 * so travel reads as one continuous hand rather than a teleporting cursor.
 */
const cursorOrigins = (list: TimelineScene[]) => {
  const origins = new Map<string, { x: number; y: number }>()
  let last = { x: viewport.width * 0.52, y: viewport.height * 0.72 }
  for (const scene of list) {
    if (scene.kind === 'click' && scene.target) {
      origins.set(scene.id, last)
      last = scene.target
    }
  }
  return origins
}

const Progress = ({ total }: { total: number }) => {
  const frame = useCurrentFrame()
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: 'rgba(11,11,15,.14)', zIndex: 6 }}>
      <div style={{ width: `${(frame / total) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${theme.blue}, ${theme.purple})` }} />
    </div>
  )
}

/** A short white flash under the cut, so mode switches feel like a real transition. */
const CutFlash = ({ at }: { at: number }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [at - 1, at + 1, at + 7], [0, 0.22, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ background: '#fff', opacity, pointerEvents: 'none', zIndex: 4 }} />
}

export const Demo = () => {
  const { durationInFrames, width, height } = useVideoConfig()
  const origins = cursorOrigins(scenes)
  const box = { width, height }

  return (
    <AbsoluteFill style={{ background: theme.ink, fontFamily: theme.sans }}>
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.durationInFrames} name={scene.id}>
          {scene.kind === 'title' ? (
            <TitleCard title={scene.title ?? 'ContractLab'} subtitle={scene.subtitle ?? ''} durationInFrames={scene.durationInFrames} />
          ) : scene.kind === 'outro' ? (
            <OutroCard title={scene.title ?? 'ContractLab'} subtitle={scene.subtitle ?? ''} durationInFrames={scene.durationInFrames} />
          ) : (
            <>
              <Stage
                scene={scene}
                cursorFrom={origins.get(scene.id) ?? { x: viewport.width / 2, y: viewport.height / 2 }}
                viewport={viewport}
                box={box}
                focusOptions={{ padding: 56, maxZoom: 2.0 }}
              />
              {scene.kind === 'click' && <CutFlash at={clickTiming(scene.durationInFrames).cut} />}
            </>
          )}
          <SceneAudio scene={scene} />
        </Sequence>
      ))}
      <Progress total={durationInFrames} />
    </AbsoluteFill>
  )
}
