import { Img, staticFile } from 'remotion'
import type { Framing, Size } from '../theme'

interface ScreenProps {
  src: string
  framing: Framing
  viewport: Size
  opacity?: number
}

/**
 * One captured screenshot, drawn at cover size inside its box and then pushed toward
 * the region the narration is talking about.
 */
export const Screen = ({ src, framing, viewport, opacity = 1 }: ScreenProps) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#f5f5f7', opacity }}>
    <Img
      src={staticFile(`shots/${src}`)}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: viewport.width * framing.cover,
        height: viewport.height * framing.cover,
        transformOrigin: '0 0',
        transform: `translate(${framing.x}px, ${framing.y}px) scale(${framing.scale})`,
      }}
    />
  </div>
)
