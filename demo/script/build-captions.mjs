/**
 * Emits subtitle tracks from the compiled timeline, so the uploaded video carries
 * real captions instead of the platform's auto-transcription.
 *
 *   src/timeline.json  ──▶  demo/ContractLab-*.srt   plain cues, widest player support
 *                      └─▶  demo/ContractLab-*.vtt   same cues + ::cue styling
 *                      └─▶  demo/narration-script.md
 *
 * One narration line becomes several short cues rather than one long block. SRT carries no
 * styling of its own — the glyph size is the player's setting — so the only lever a file
 * has over how much screen it covers is how few characters sit on screen at once. Cues are
 * split on sentence boundaries and timed by their share of the line's characters, which
 * also tracks the speech more closely than one cue held across a whole scene.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const timelinePath = resolve(here, '../video/src/timeline.json')
const outDir = resolve(here, '..')
// Sidecar tracks live in their own folder: a .srt sitting next to a .mp4 with a matching
// basename is auto-loaded by VLC and friends, which is not what you want while reviewing.
const captionDir = resolve(outDir, 'captions')

const CLIP_ORDER = ['title', 'design-registry', 'flawed', 'isolation', 'untrusted', 'trace', 'score', 'outro']

const MAX_LINE = 34      // characters per row
const MAX_ROWS = 2       // never a third row
const MAX_CUE = MAX_LINE * MAX_ROWS
const MIN_CUE_CHARS = 22 // shorter than this and a fragment is folded into its neighbour
const MIN_CUE_SECONDS = 0.9
const NL = String.fromCharCode(10)

const stamp = (seconds, decimal) => {
  const ms = Math.round(seconds * 1000)
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  return `${h}:${m}:${s}${decimal}${String(ms % 1000).padStart(3, '0')}`
}

/** Split a run of text that is still too long, preferring a comma near the middle. */
const splitLong = (text) => {
  if (text.length <= MAX_CUE) return [text]
  const middle = Math.floor(text.length / 2)
  const comma = [...text.matchAll(/,\s+/g)]
    .map((match) => match.index + match[0].length)
    .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0]
  let cut = comma
  if (cut === undefined || cut < MIN_CUE_CHARS || text.length - cut < MIN_CUE_CHARS) {
    const before = text.lastIndexOf(' ', middle)
    const after = text.indexOf(' ', middle)
    cut = middle - before <= after - middle && before > 0 ? before + 1 : after + 1
  }
  if (cut <= 0 || cut >= text.length) return [text]
  return [...splitLong(text.slice(0, cut).trim()), ...splitLong(text.slice(cut).trim())]
}

/** One spoken line becomes several short cues, broken on sentence boundaries. */
const chunk = (line) => {
  const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean)
  const merged = []
  for (const sentence of sentences) {
    const previous = merged[merged.length - 1]
    const tooShort = sentence.length < MIN_CUE_CHARS || (previous && previous.length < MIN_CUE_CHARS)
    if (previous && tooShort && `${previous} ${sentence}`.length <= MAX_CUE) {
      merged[merged.length - 1] = `${previous} ${sentence}`
    } else {
      merged.push(sentence)
    }
  }
  return merged.flatMap(splitLong)
}

/**
 * Break a cue across at most two rows. Prefers a sentence end, then a comma, then the most
 * balanced word boundary — a purely greedy fill strands short words like "An" on their own row.
 */
const wrap = (text) => {
  if (text.length <= MAX_LINE) return text
  const words = text.split(' ')
  let best = null
  for (let index = 1; index < words.length; index += 1) {
    const top = words.slice(0, index).join(' ')
    const bottom = words.slice(index).join(' ')
    const overflow = top.length > MAX_LINE || bottom.length > MAX_LINE ? 1000 : 0
    const punctuation = /[.!?]$/.test(top) ? 40 : /[,;:]$/.test(top) ? 18 : 0
    const score = overflow - punctuation + Math.abs(top.length - bottom.length)
    if (!best || score < best.score) best = { score, top, bottom }
  }
  return best ? `${best.top}${NL}${best.bottom}` : text
}

/** Give each cue the share of its line's airtime that its characters account for. */
const timeChunks = (line, start, duration) => {
  const pieces = chunk(line)
  const total = pieces.reduce((sum, piece) => sum + piece.length, 0) || 1
  const cues = []
  let cursor = start
  for (const [index, piece] of pieces.entries()) {
    const span = index === pieces.length - 1 ? start + duration - cursor : (piece.length / total) * duration
    const end = Math.min(start + duration, cursor + Math.max(MIN_CUE_SECONDS, span))
    cues.push({ start: cursor, end, text: piece })
    cursor = end
  }
  return cues
}

const toSrt = (cues) =>
  cues
    .map((cue, index) => `${index + 1}${NL}${stamp(cue.start, ',')} --> ${stamp(cue.end, ',')}${NL}${wrap(cue.text)}${NL}`)
    .join(NL)

/**
 * WebVTT carries its own styling, so this is the track to use where the player honours it
 * (HTML5 video, and any platform that renders WebVTT natively). The SRT stays as the
 * fallback for players that ignore cue styles and use their own font size.
 */
const toVtt = (cues) =>
  [
    'WEBVTT',
    '',
    'STYLE',
    '::cue {',
    '  font-family: "Segoe UI", -apple-system, Helvetica, Arial, sans-serif;',
    '  font-size: 44%;',
    '  line-height: 1.3;',
    '  color: #ffffff;',
    '  background-color: rgba(11, 11, 15, 0.78);',
    '}',
    '',
    ...cues.flatMap((cue) => [
      `${stamp(cue.start, '.')} --> ${stamp(cue.end, '.')} line:88% align:center`,
      wrap(cue.text),
      '',
    ]),
  ].join(NL)

const run = async () => {
  const timeline = JSON.parse(await readFile(timelinePath, 'utf8'))
  const { fps, scenes } = timeline

  const cuesFor = (list) => {
    let offset = 0
    const cues = []
    for (const scene of list) {
      const start = (offset + scene.audioDelayInFrames) / fps
      cues.push(...timeChunks(scene.vo, start, scene.audioDurationInFrames / fps))
      offset += scene.durationInFrames
    }
    return cues
  }

  await mkdir(captionDir, { recursive: true })
  const clip = CLIP_ORDER.map((id) => scenes.find((scene) => scene.id === id)).filter(Boolean)
  const tracks = [
    { name: 'ContractLab-demo-1080p', cues: cuesFor(scenes) },
    { name: 'ContractLab-linkedin-clip', cues: cuesFor(clip) },
  ]

  for (const track of tracks) {
    await writeFile(resolve(captionDir, `${track.name}.srt`), toSrt(track.cues), 'utf8')
    await writeFile(resolve(captionDir, `${track.name}.vtt`), toVtt(track.cues), 'utf8')
    const longest = track.cues.reduce((max, cue) => Math.max(max, cue.text.length), 0)
    console.log(`${track.name}  ${String(track.cues.length).padStart(3)} cues · longest ${longest} chars`)
  }

  const total = timeline.durationInFrames / fps
  const words = scenes.reduce((count, scene) => count + scene.vo.split(/\s+/).length, 0)
  const transcript = [
    '# ContractLab demo — narration script',
    '',
    `Full demo: **${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}** · ${scenes.length} scenes · ${words} words.`,
    `LinkedIn cut: **${Math.floor(clip.reduce((n, s) => n + s.durationInFrames, 0) / fps)}s** · ${clip.length} scenes.`,
    '',
    'Voice: Microsoft neural `en-US-AndrewMultilingualNeural`. Re-synthesise with `node demo/script/build-audio.mjs`.',
    '',
    'Nothing is burned into the picture. Captions ship as sidecar `.srt` / `.vtt` tracks, so',
    'the app UI is never covered and viewers can size or disable them in their own player.',
    '',
    '| # | Scene | Beat | Narration |',
    '| ---: | --- | --- | --- |',
    ...scenes.map((scene, index) =>
      `| ${index + 1} | \`${scene.id}\` | ${scene.caption ?? scene.subtitle ?? '—'} | ${scene.vo} |`,
    ),
    '',
    '## LinkedIn cut order',
    '',
    CLIP_ORDER.map((id) => `\`${id}\``).join(' → '),
    '',
  ].join(NL)

  await writeFile(resolve(outDir, 'narration-script.md'), transcript, 'utf8')
  console.log(`transcript → ${outDir}\\narration-script.md`)
}

run().catch((reason) => {
  console.error(reason)
  process.exit(1)
})
