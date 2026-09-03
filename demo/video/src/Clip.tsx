import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion'
import { LogoMark, OutroCard, TitleCard } from './components/Cards'
import { SceneAudio, Stage, type TimelineScene } from './Scene'
import { theme } from './theme'
import timeline from './timeline.json'

const viewport = timeline.viewport
const all = timeline.scenes as TimelineScene[]

/** The beats that still land on a phone, in a feed, at arm's length. */
const CLIP_ORDER = ['title', 'design-registry', 'flawed', 'isolation', 'untrusted', 'trace', 'score', 'outro']

/** Re-lay the chosen scenes end to end; their audio and lengths come across unchanged. */
export const clipScenes: TimelineScene[] = (() => {
  const picked = CLIP_ORDER.map((id) => all.find((scene) => scene.id === id)).filter(Boolean) as TimelineScene[]
  let cursor = 0
  return picked.map((scene) => {
    const laid = { ...scene, from: cursor }
    cursor += scene.durationInFrames
    return laid
  })
})()

export const CLIP_DURATION = clipScenes.reduce((total, scene) => total + scene.durationInFrames, 0)

const SCREEN_TOP = 150
const SCREEN_HEIGHT = 1124

const Header = () => (
  <div style={{ position: 'absolute', top: 46, left: 48, right: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 6 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <LogoMark size={54} />
      <span style={{ font: `700 40px/1 ${theme.sans}`, letterSpacing: '-.03em', color: theme.text }}>ContractLab</span>
    </div>
    <span style={{ font: `600 24px/1 ${theme.sans}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(246,246,248,.45)' }}>
      WebMCP
    </span>
  </div>
)

export const Clip = () => {
  const { durationInFrames } = useVideoConfig()
  const frame = useCurrentFrame()
  const box = { width: 1080, height: SCREEN_HEIGHT }

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #14161f 0%, ${theme.ink} 55%)`, fontFamily: theme.sans }}>
      {clipScenes.map((scene) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.durationInFrames} name={scene.id}>
          {scene.kind === 'title' ? (
            <TitleCard title={scene.title ?? 'ContractLab'} subtitle={scene.subtitle ?? ''} durationInFrames={scene.durationInFrames} compact />
          ) : scene.kind === 'outro' ? (
            <OutroCard title={scene.title ?? 'ContractLab'} subtitle={scene.subtitle ?? ''} durationInFrames={scene.durationInFrames} compact />
          ) : (
            <>
              <Header />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: SCREEN_TOP,
                  height: SCREEN_HEIGHT,
                  overflow: 'hidden',
                  borderTop: '1px solid rgba(255,255,255,.1)',
                  borderBottom: '1px solid rgba(255,255,255,.1)',
                }}
              >
                <Stage
                  scene={scene}
                  cursorFrom={{ x: viewport.width * 0.5, y: viewport.height * 0.8 }}
                  viewport={viewport}
                  box={box}
                    cursorSize={54}
                  focusOptions={{ padding: 22, maxZoom: 2.35, minZoom: 1.05, fit: 'width' }}
                />
              </div>
            </>
          )}
          <SceneAudio scene={scene} />
        </Sequence>
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 7, background: 'rgba(255,255,255,.1)', zIndex: 7 }}>
        <div style={{ width: `${(frame / durationInFrames) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${theme.blue}, ${theme.purple})` }} />
      </div>
    </AbsoluteFill>
  )
}
