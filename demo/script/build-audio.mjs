/**
 * Synthesises the narration and compiles the timeline the Remotion composition renders.
 *
 *   scenes.mjs + capture/manifest.json  ──▶  public/audio/*.mp3
 *                                       └─▶  src/timeline.json  (exact frame counts)
 *
 * Scene length is the real measured clip length plus a tail, floored at a minimum so
 * cursor travel and click animations always have room to breathe.
 */
import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { clipScenes, pitch, rate, scenes, voice } from './scenes.mjs'

const exec = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const audioDir = resolve(here, '../video/public/audio')
const timelinePath = resolve(here, '../video/src/timeline.json')
const manifestPath = resolve(here, '../capture/manifest.json')
const changesPath = resolve(here, '../capture/changes.json')

const FPS = 30
const TAIL = 0.34         // breathing room after the last syllable
const LEAD = 0.24         // beat before narration starts, so cuts are not stepped on
const CLICK_MIN = 3.7     // a click scene needs travel + press + reveal
const HOLD_MIN = 2.9

const probeDuration = async (file) => {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
  return Number.parseFloat(stdout.trim())
}

const cachePath = resolve(here, '.voice-cache.json')

/** Re-synthesise only the lines that actually changed; edge-tts is a network round trip. */
const loadCache = async () => {
  try { return JSON.parse(await readFile(cachePath, 'utf8')) } catch { return {} }
}

const speak = async (text, file, cache, key) => {
  const stamp = `${voice}|${rate}|${pitch}|${text}`
  const hit = cache[key]
  if (hit && hit.stamp === stamp && existsSync(file)) return hit.duration
  await exec('python', ['-m', 'edge_tts', '--voice', voice, '--rate', rate, '--pitch', pitch, '--text', text, '--write-media', file])
  const duration = await probeDuration(file)
  cache[key] = { stamp, duration }
  return duration
}

const run = async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  // Produced by detect-changes.mjs; absent on a first run, which just means no highlights.
  const changes = await readFile(changesPath, 'utf8').then(JSON.parse).catch(() => ({}))
  const byId = new Map(manifest.shots.map((shot) => [shot.id, shot]))
  const need = (id) => {
    const shot = byId.get(id)
    if (!shot) throw new Error(`storyboard references missing shot "${id}"`)
    return shot
  }

  const cache = await loadCache()
  await mkdir(audioDir, { recursive: true })

  const timeline = { fps: FPS, width: 1920, height: 1080, viewport: manifest.viewport, scale: manifest.scale, scenes: [] }
  let frame = 0

  for (const [index, scene] of scenes.entries()) {
    const slug = `${String(index + 1).padStart(2, '0')}-${scene.id}`
    const audioFile = `audio/${slug}.mp3`
    const spoken = await speak(scene.vo, resolve(audioDir, `${slug}.mp3`), cache, slug)

    const floor = scene.minDur ?? (scene.kind === 'click' ? CLICK_MIN : HOLD_MIN)
    const seconds = Math.max(floor, LEAD + spoken + TAIL)
    const durationInFrames = Math.round(seconds * FPS)

    const entry = {
      id: scene.id,
      kind: scene.kind,
      from: frame,
      durationInFrames,
      audio: audioFile,
      audioDelayInFrames: Math.round(LEAD * FPS),
      audioDurationInFrames: Math.round(spoken * FPS),
      caption: scene.caption ?? null,
      title: scene.title ?? null,
      subtitle: scene.subtitle ?? null,
      vo: scene.vo,
      // Clicks and bursts always push in on the result; holds opt in explicitly.
      push: scene.push ?? (scene.kind === 'hold' ? 'none' : 'focus'),
    }

    if (scene.kind === 'click') {
      const from = need(scene.from)
      const to = need(scene.to)
      if (!from.target) throw new Error(`shot "${scene.from}" has no cursor target`)
      entry.before = from.file
      entry.after = to.file
      entry.target = from.target
      entry.focus = scene.focusOverride ?? to.focus ?? from.focus ?? null
      entry.highlights =
        scene.highlight === 'auto' ? changes[scene.id]?.boxes ?? []
        : scene.highlight === 'focus' && entry.focus ? [entry.focus]
        : []
    } else if (scene.kind === 'burst') {
      const shots = scene.shots.map(need)
      entry.frames = shots.map((shot) => shot.file)
      entry.focus = scene.focusOverride ?? shots[0].focus ?? null
      entry.highlightSteps = scene.highlight === 'auto' ? changes[scene.id]?.steps ?? [] : []
    } else if (scene.kind === 'hold') {
      const shot = need(scene.shot)
      entry.image = shot.file
      entry.focus = scene.focusOverride ?? shot.focus ?? null
    }

    timeline.scenes.push(entry)
    frame += durationInFrames
    console.log(`  ${slug.padEnd(22)} ${spoken.toFixed(2)}s spoken → ${(durationInFrames / FPS).toFixed(2)}s scene`)
  }

  await writeFile(cachePath, JSON.stringify(cache, null, 2))
  timeline.durationInFrames = frame
  timeline.clip = clipScenes
  await writeFile(timelinePath, JSON.stringify(timeline, null, 2))

  const total = frame / FPS
  console.log(`\ntimeline → ${timelinePath}`)
  console.log(`${timeline.scenes.length} scenes · ${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s · ${frame} frames @ ${FPS}fps`)
}

run().catch((reason) => {
  console.error(reason)
  process.exit(1)
})
