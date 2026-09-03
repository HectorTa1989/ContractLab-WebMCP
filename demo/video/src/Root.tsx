import { Composition } from 'remotion'
import { CLIP_DURATION, Clip } from './Clip'
import { Demo } from './Demo'
import timeline from './timeline.json'

export const RemotionRoot = () => (
  <>
    <Composition
      id="ContractLabDemo"
      component={Demo}
      durationInFrames={timeline.durationInFrames}
      fps={timeline.fps}
      width={1920}
      height={1080}
    />
    <Composition
      id="ContractLabClip"
      component={Clip}
      durationInFrames={CLIP_DURATION}
      fps={timeline.fps}
      width={1080}
      height={1350}
    />
  </>
)
