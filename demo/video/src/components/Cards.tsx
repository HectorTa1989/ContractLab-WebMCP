import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { theme } from '../theme'

/** The app's own mark: three bars in a rounded gradient tile. */
export const LogoMark = ({ size = 96 }: { size?: number }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const bars = [0.24, 0.45, 0.34]
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: size * 0.07,
        padding: size * 0.24,
        background: 'linear-gradient(145deg, #147df5 0%, #5454e8 100%)',
        boxShadow: `inset 0 ${size * 0.02}px 0 rgba(255,255,255,.35), 0 ${size * 0.14}px ${size * 0.42}px rgba(58,76,219,.45)`,
      }}
    >
      {bars.map((height, index) => {
        const grow = spring({ frame: frame - 6 - index * 4, fps, config: { damping: 14, mass: 0.5 } })
        return (
          <div
            key={height}
            style={{
              width: size * 0.1,
              height: size * height * grow,
              borderRadius: size * 0.05,
              background: '#fff',
              opacity: index === 1 ? 1 : 0.82,
            }}
          />
        )
      })}
    </div>
  )
}

const CardShell = ({ children }: { children: React.ReactNode }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1200px 700px at 50% 18%, #1b2340 0%, ${theme.ink} 62%)`,
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.text,
      fontFamily: theme.sans,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(520px 320px at 78% 78%, rgba(124,92,255,.20), transparent 70%), radial-gradient(460px 300px at 18% 30%, rgba(10,132,255,.18), transparent 70%)',
      }}
    />
    {children}
  </AbsoluteFill>
)

interface CardProps {
  title: string
  subtitle: string
  durationInFrames: number
  kicker?: string
  footnote?: string
  compact?: boolean
}

export const TitleCard = ({ title, subtitle, kicker = 'WebMCP Challenge', compact = false }: CardProps) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rise = spring({ frame: frame - 8, fps, config: { damping: 20, mass: 0.7 } })
  const sub = spring({ frame: frame - 18, fps, config: { damping: 20, mass: 0.7 } })

  return (
    <CardShell>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 20 : 26, zIndex: 1 }}>
        <LogoMark size={compact ? 92 : 108} />
        <div
          style={{
            font: `600 ${compact ? 22 : 24}px/1 ${theme.sans}`,
            letterSpacing: '.22em',
            textTransform: 'uppercase',
            color: 'rgba(246,246,248,.5)',
            opacity: rise,
          }}
        >
          {kicker}
        </div>
        <h1
          style={{
            margin: 0,
            font: `700 ${compact ? 96 : 128}px/1 ${theme.sans}`,
            letterSpacing: '-.045em',
            transform: `translateY(${(1 - rise) * 26}px)`,
            opacity: rise,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: compact ? 880 : 1080,
            textAlign: 'center',
            font: `400 ${compact ? 36 : 40}px/1.35 ${theme.sans}`,
            color: theme.textMuted,
            letterSpacing: '-.015em',
            transform: `translateY(${(1 - sub) * 18}px)`,
            opacity: sub,
          }}
        >
          {subtitle}
        </p>
      </div>
    </CardShell>
  )
}

export const OutroCard = ({ title, subtitle, durationInFrames, compact = false }: CardProps) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rise = spring({ frame: frame - 6, fps, config: { damping: 20, mass: 0.7 } })
  const facts = ['No embedded LLM', 'No user code execution', 'Same-origin tools only', 'Deterministic grading']

  return (
    <CardShell>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 22 : 30, zIndex: 1, transform: `translateY(${(1 - rise) * 18}px)`, opacity: rise }}>
        <LogoMark size={compact ? 84 : 96} />
        <h1 style={{ margin: 0, font: `700 ${compact ? 84 : 112}px/1 ${theme.sans}`, letterSpacing: '-.045em' }}>{title}</h1>
        <p style={{ margin: 0, font: `400 ${compact ? 34 : 42}px/1.3 ${theme.sans}`, color: theme.textMuted, letterSpacing: '-.015em', textAlign: 'center' }}>{subtitle}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, maxWidth: compact ? 900 : 1200, marginTop: 8 }}>
          {facts.map((fact, index) => {
            const pop = spring({ frame: frame - 20 - index * 5, fps, config: { damping: 18, mass: 0.6 } })
            return (
              <span
                key={fact}
                style={{
                  padding: `${compact ? 12 : 14}px ${compact ? 20 : 24}px`,
                  borderRadius: 999,
                  border: `1px solid ${theme.line}`,
                  background: 'rgba(255,255,255,.05)',
                  font: `600 ${compact ? 24 : 28}px/1 ${theme.sans}`,
                  color: 'rgba(246,246,248,.86)',
                  opacity: pop,
                  transform: `scale(${0.9 + pop * 0.1})`,
                }}
              >
                {fact}
              </span>
            )
          })}
        </div>
        <div
          style={{
            marginTop: compact ? 14 : 22,
            font: `500 ${compact ? 26 : 30}px/1 ${theme.mono}`,
            color: 'rgba(246,246,248,.5)',
            opacity: interpolate(frame, [durationInFrames - 70, durationInFrames - 52], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          github.com/HectorTa1989 · MIT
        </div>
      </div>
    </CardShell>
  )
}
