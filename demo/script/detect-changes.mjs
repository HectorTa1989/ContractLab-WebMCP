/**
 * Works out what visibly changed when each button was pressed.
 *
 *   video/public/shots/*.png  ──▶  capture/changes.json
 *
 * For every click scene the before and after captures are compared, and for every burst
 * scene each frame is compared with the one before it. Changed pixels are clustered into
 * bounding boxes, which the Remotion composition draws as highlights over the result of
 * the press — so the viewer's eye goes to the thing that actually moved.
 *
 * Boxes are emitted in screenshot CSS pixels against the 1600x900 capture viewport.
 *
 * Whole-page transitions (mode switches, version switches) are deliberately dropped: when
 * nearly everything changed, boxing it says nothing.
 */
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { scenes } from './scenes.mjs'

const exec = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const shotsDir = resolve(here, '../video/public/shots')
const manifestPath = resolve(here, '../capture/manifest.json')
const outPath = resolve(here, '../capture/changes.json')

const CELL = 10               // CSS pixels per sampled cell
const DELTA = 12              // per-cell channel delta that counts as "changed"
const MIN_CELLS = 6           // ignore specks
const MERGE_GAP = 3           // cells: boxes closer than this are merged
const MAX_BOX_AREA = 0.42     // a single box may not cover more than this share of the page
const MAX_TOTAL_CHANGE = 0.45 // above this the whole page changed; emit nothing
const MAX_BOXES = 3
const PAD = 8                 // CSS pixels of breathing room around a box

/** Decode one screenshot into a small RGB grid via ffmpeg, so there is no image dependency. */
const sample = async (file, cols, rows) => {
  const { stdout } = await exec(
    'ffmpeg',
    ['-v', 'error', '-i', resolve(shotsDir, file), '-vf', `scale=${cols}:${rows}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 26 },
  )
  return stdout
}

/** Cells whose colour moved between two samples. */
const changedCells = (before, after, cols, rows) => {
  const grid = new Uint8Array(cols * rows)
  for (let index = 0; index < cols * rows; index += 1) {
    const offset = index * 3
    const delta = Math.max(
      Math.abs(before[offset] - after[offset]),
      Math.abs(before[offset + 1] - after[offset + 1]),
      Math.abs(before[offset + 2] - after[offset + 2]),
    )
    grid[index] = delta > DELTA ? 1 : 0
  }
  return grid
}

/** Flood-fill the changed cells into connected clusters. */
const clusters = (grid, cols, rows) => {
  const seen = new Uint8Array(grid.length)
  const found = []
  for (let start = 0; start < grid.length; start += 1) {
    if (!grid[start] || seen[start]) continue
    const stack = [start]
    seen[start] = 1
    let minX = cols, minY = rows, maxX = -1, maxY = -1, area = 0
    while (stack.length) {
      const index = stack.pop()
      const x = index % cols
      const y = (index - x) / cols
      area += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        const next = ny * cols + nx
        if (grid[next] && !seen[next]) {
          seen[next] = 1
          stack.push(next)
        }
      }
    }
    if (area >= MIN_CELLS) found.push({ minX, minY, maxX, maxY, area })
  }
  return found
}

const overlaps = (a, b, gap) =>
  a.minX - gap <= b.maxX && b.minX - gap <= a.maxX && a.minY - gap <= b.maxY && b.minY - gap <= a.maxY

/** Fold clusters that sit close together into one box, so a card and its badge read as one thing. */
const merge = (boxes) => {
  const pool = [...boxes]
  let changed = true
  while (changed) {
    changed = false
    outer: for (let i = 0; i < pool.length; i += 1) {
      for (let j = i + 1; j < pool.length; j += 1) {
        if (!overlaps(pool[i], pool[j], MERGE_GAP)) continue
        pool[i] = {
          minX: Math.min(pool[i].minX, pool[j].minX),
          minY: Math.min(pool[i].minY, pool[j].minY),
          maxX: Math.max(pool[i].maxX, pool[j].maxX),
          maxY: Math.max(pool[i].maxY, pool[j].maxY),
          area: pool[i].area + pool[j].area,
        }
        pool.splice(j, 1)
        changed = true
        break outer
      }
    }
  }
  return pool
}

const run = async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const { width, height } = manifest.viewport
  const cols = Math.round(width / CELL)
  const rows = Math.round(height / CELL)
  const pageCells = cols * rows
  const byId = new Map(manifest.shots.map((shot) => [shot.id, shot]))
  const cache = new Map()
  const read = async (file) => {
    if (!cache.has(file)) cache.set(file, await sample(file, cols, rows))
    return cache.get(file)
  }

  /** Boxes describing what moved between two shots, in CSS pixels. */
  const diff = async (beforeFile, afterFile, label) => {
    const grid = changedCells(await read(beforeFile), await read(afterFile), cols, rows)
    const total = grid.reduce((sum, cell) => sum + cell, 0) / pageCells
    if (total > MAX_TOTAL_CHANGE) {
      console.log(`  ${label.padEnd(16)} ${(total * 100).toFixed(0)}% of the page changed — full transition, no box`)
      return []
    }
    const boxes = merge(clusters(grid, cols, rows))
      .map((box) => ({
        x: Math.max(0, box.minX * CELL - PAD),
        y: Math.max(0, box.minY * CELL - PAD),
        width: Math.min(width, (box.maxX + 1) * CELL + PAD) - Math.max(0, box.minX * CELL - PAD),
        height: Math.min(height, (box.maxY + 1) * CELL + PAD) - Math.max(0, box.minY * CELL - PAD),
        cells: box.area,
      }))
      .filter((box) => (box.width * box.height) / (width * height) <= MAX_BOX_AREA)
      .sort((a, b) => b.cells - a.cells)
      .slice(0, MAX_BOXES)
      .map(({ cells, ...box }) => box)

    console.log(
      `  ${label.padEnd(16)} ${(total * 100).toFixed(0)}% changed → ${boxes.length} box${boxes.length === 1 ? '' : 'es'}` +
        boxes.map((box) => ` [${box.x},${box.y} ${box.width}x${box.height}]`).join(''),
    )
    return boxes
  }

  const changes = {}
  for (const scene of scenes) {
    if (scene.kind === 'click') {
      const before = byId.get(scene.from)
      const after = byId.get(scene.to)
      if (!before || !after) continue
      changes[scene.id] = { kind: 'click', boxes: await diff(before.file, after.file, scene.id) }
    } else if (scene.kind === 'burst') {
      const shots = scene.shots.map((id) => byId.get(id)).filter(Boolean)
      const steps = []
      for (const [index, shot] of shots.entries()) {
        const previous = index === 0 ? byId.get(scene.previousShot ?? '') : shots[index - 1]
        steps.push(previous ? await diff(previous.file, shot.file, `${scene.id}#${index}`) : [])
      }
      changes[scene.id] = { kind: 'burst', steps }
    }
  }

  await writeFile(outPath, JSON.stringify(changes, null, 2))
  const boxed = Object.values(changes).filter((entry) =>
    entry.kind === 'click' ? entry.boxes.length : entry.steps.some((step) => step.length),
  ).length
  console.log(`\n${boxed} of ${Object.keys(changes).length} scenes get highlights → ${outPath}`)
}

run().catch((reason) => {
  console.error(reason)
  process.exit(1)
})
