/**
 * ContractLab demo capture.
 *
 * Drives the real running app with Playwright and records, for every beat:
 *   - a "before" screenshot plus the cursor target of the control we are about to press
 *   - an "after" screenshot once the app has settled
 *
 * The browser is given a spec-shaped `document.modelContext` host (the same imperative
 * surface a WebMCP-capable browser exposes), so the registry rail reports the tools the
 * page actually registered, and the urgent-triage run is driven by real tool invocations
 * instead of the in-app preview button.
 *
 * The manifest feeds the Remotion composition in demo/video, so the on-screen cursor
 * lands on real button positions instead of guessed ones.
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const shotsDir = resolve(here, '../video/public/shots')
const manifestPath = resolve(here, 'manifest.json')

const BASE_URL = process.env.DEMO_URL ?? 'http://127.0.0.1:5174'
const VIEWPORT = { width: 1600, height: 900 }
const SCALE = 2

/** Minimal WebMCP tool host: registration, abort-signal teardown, discovery, invocation. */
const MODEL_CONTEXT_HOST = () => {
  const tools = new Map()
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: {
      registerTool(definition, options = {}) {
        const signal = options?.signal
        if (signal?.aborted) return Promise.resolve()
        tools.set(definition.name, definition)
        signal?.addEventListener('abort', () => {
          if (tools.get(definition.name) === definition) tools.delete(definition.name)
        }, { once: true })
        return Promise.resolve()
      },
      getTools: async () => [...tools.keys()].map((name) => ({ name })),
    },
  })
  window.__agent = {
    tools: () => [...tools.keys()],
    invoke: async (name, args) => {
      const tool = tools.get(name)
      if (!tool) throw new Error(`Tool "${name}" is not registered on this page.`)
      return tool.execute(args ?? {})
    },
  }
}

const manifest = { viewport: VIEWPORT, scale: SCALE, shots: [] }
let counter = 0

const run = async () => {
  await rm(shotsDir, { recursive: true, force: true })
  await mkdir(shotsDir, { recursive: true })

  const browser = await chromium.launch({ channel: 'chrome' })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: 'light',
  })
  await context.addInitScript(MODEL_CONTEXT_HOST)
  const page = await context.newPage()

  /** Screenshot the viewport and register it in the manifest. */
  const shot = async (name, { target = null, focus = null, note = '' } = {}) => {
    counter += 1
    const file = `${String(counter).padStart(2, '0')}-${name}.png`
    await page.screenshot({ path: resolve(shotsDir, file), animations: 'disabled' })
    manifest.shots.push({ id: name, file, target, focus, note })
    console.log(`  ${file}${target ? `  cursor ${target.x},${target.y}` : ''}`)
    return file
  }

  /** Centre point of a locator in CSS pixels, after bringing it on screen. */
  const point = async (locator) => {
    const element = locator.first()
    await element.scrollIntoViewIfNeeded()
    await page.waitForTimeout(220)
    const box = await element.boundingBox()
    if (!box) throw new Error('element has no box')
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }
  }

  /** Bounding rect of a region the video should zoom toward. */
  const region = async (selector) => {
    const box = await page.locator(selector).first().boundingBox()
    if (!box) return null
    return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }
  }

  const settle = async (ms = 550) => { await page.waitForTimeout(ms) }
  const registered = () => page.evaluate(() => window.__agent.tools())
  const invoke = async (name, args) => {
    const result = await page.evaluate(([tool, payload]) => window.__agent.invoke(tool, payload), [name, args])
    await settle(700)
    return result
  }

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: .001s !important; transition-duration: .001s !important; }' })
  await settle(1200)

  // ── 1. Free workspace on arrival ────────────────────────────────────────────
  await shot('design-free', { focus: await region('.workspace-frame'), note: 'Free workspace, design mode' })
  await shot('design-free-rail', { focus: await region('.registry-rail'), note: 'Design registry live in the page' })

  // ── 2. A free visitor meets the Polar paywall ───────────────────────────────
  const liveEvalTab = page.getByRole('button', { name: 'Live eval', exact: true })
  await shot('before-live-eval', { target: await point(liveEvalTab) })
  await liveEvalTab.click()
  await settle()
  await shot('paywall', { focus: await region('.modal-card'), note: 'Polar-backed entitlement gate' })

  // ── 3. Admin escape hatch → sign in ─────────────────────────────────────────
  const adminBtn = page.getByRole('button', { name: 'I’m the workspace admin' })
  await shot('before-admin', { target: await point(adminBtn), focus: await region('.modal-card') })
  await adminBtn.click()
  await settle()
  const signInBtn = page.getByRole('button', { name: 'Sign in as admin' })
  await shot('auth-modal', { target: await point(signInBtn), focus: await region('.modal-card') })
  await signInBtn.click()
  await page.getByText('Admin workspace').waitFor()
  await settle(800)
  await shot('design-admin', { focus: await region('.workspace-frame'), note: 'Signed in as admin' })

  // ── 4. The deliberately flawed starter registry ─────────────────────────────
  const v1 = page.locator('.version-list button', { hasText: 'v1' })
  await shot('before-v1', { target: await point(v1) })
  await v1.click()
  await settle(700)
  await shot('v1-starter', { focus: await region('.contracts-section'), note: 'v1 starter contracts' })
  await shot('v1-metrics', { focus: await region('.metric-strip'), note: 'Quality signal count' })

  const flawed = page.locator('.contract-card', { hasText: 'update_ticket' })
  await shot('before-flawed-tool', { target: await point(flawed) })
  await flawed.click()
  await settle()
  await shot('flawed-inspector', { focus: await region('.editor-panel'), note: 'Vague description, loose schema' })

  const finding = page.locator('.finding-item').first()
  await shot('before-finding', { target: await point(finding), focus: await region('.findings-panel') })
  await finding.click()
  await settle()
  await shot('findings-panel', { focus: await region('.findings-panel'), note: 'Deterministic lint findings' })

  // ── 5. The refined registry ─────────────────────────────────────────────────
  const v2 = page.locator('.version-list button', { hasText: 'v2' })
  await shot('before-v2', { target: await point(v2) })
  await v2.click()
  await settle(700)
  await shot('v2-refined', { focus: await region('.contracts-section'), note: 'v2 refined contracts' })

  const guarded = page.locator('.contract-card', { hasText: 'close_support_ticket' })
  await shot('before-guarded-tool', { target: await point(guarded) })
  await guarded.click()
  await settle()
  await shot('guarded-inspector', { focus: await region('.editor-panel'), note: 'Availability: has resolution note' })

  // ── 6. Version evidence ─────────────────────────────────────────────────────
  const compare = page.getByRole('button', { name: /Compare v1/ })
  await shot('before-compare', { target: await point(compare) })
  await compare.click()
  await settle()
  await shot('diff-banner', { focus: await region('.diff-banner'), note: 'v1 → v2 evidence' })

  // ── 7. Human-gated switch into live eval ────────────────────────────────────
  const prepare = page.getByRole('button', { name: 'Prepare live eval' })
  await shot('before-prepare', { target: await point(prepare) })
  await prepare.click()
  await page.getByText('Live evaluation').waitFor()
  await settle(1000)
  const evalTools = await registered()
  await shot('eval-mode', { focus: await region('.eval-frame'), note: `Eval registry: ${evalTools.join(', ')}` })
  await shot('eval-rail', { focus: await region('.registry-rail'), note: `${evalTools.length} tools exposed` })
  await shot('eval-task', { focus: await region('.task-panel'), note: 'Seeded agent task' })

  // ── 8. Untrusted customer content ───────────────────────────────────────────
  await page.locator('.conversation .untrusted').first().scrollIntoViewIfNeeded()
  await settle(450)
  await shot('untrusted-note', { focus: await region('.conversation'), note: 'Prompt injection inside customer data' })

  // ── 9. Real WebMCP invocations drive the urgent-triage run ──────────────────
  const ticket = await invoke('get_support_ticket', { ticket_id: 'T-104' })
  await shot('agent-call-1', { focus: await region('.recorder-panel'), note: 'get_support_ticket' })
  await invoke('set_ticket_priority', { ticket_id: 'T-104', priority: 'urgent', expected_version: ticket.version })
  await shot('agent-call-2', { focus: await region('.recorder-panel'), note: 'set_ticket_priority' })
  await invoke('assign_ticket_team', { ticket_id: 'T-104', team: 'backend', expected_version: ticket.version + 1 })
  await shot('agent-call-3', { focus: await region('.recorder-panel'), note: 'assign_ticket_team' })
  await invoke('add_ticket_note', { ticket_id: 'T-104', body: 'Escalated for backend triage and duplicate invoice review.', kind: 'internal', expected_version: ticket.version + 2 })
  await settle(700)
  await shot('trace-filled', { focus: await region('.recorder-panel'), note: 'Four calls, arguments and state diffs' })
  await shot('ticket-updated', { focus: await region('.ticket-detail'), note: 'Urgent · backend · note added' })

  // ── 10. Grade ───────────────────────────────────────────────────────────────
  const gradeBtn = page.getByRole('button', { name: 'Finish & grade' })
  await shot('before-grade', { target: await point(gradeBtn) })
  await gradeBtn.click()
  await page.locator('.grade-score').waitFor()
  await settle(800)
  await shot('grade-drawer', { focus: await region('.grade-drawer'), note: 'Seven-dimension grade' })

  // ── 11. State-conditional tool: close appears only after a resolution note ──
  await page.locator('.grade-drawer .icon-button').click()
  await settle(400)
  const caseSelect = page.locator('.eval-context select')
  await shot('before-case-switch', { target: await point(caseSelect), focus: await region('.eval-header') })
  await caseSelect.selectOption('eval-close')
  await settle(1000)
  const beforeClose = await registered()
  await shot('case-guarded-rail', { focus: await region('.registry-rail'), note: `close_support_ticket absent: ${!beforeClose.includes('close_support_ticket')}` })
  await shot('case-guarded-task', { focus: await region('.task-panel'), note: 'Guarded close recovery' })

  const preview2 = page.getByRole('button', { name: 'Run deterministic preview' })
  await shot('before-preview-2', { target: await point(preview2), focus: await region('.task-panel') })
  await preview2.click()
  await page.locator('.call-card').filter({ hasText: 'close_support_ticket' }).waitFor()
  await settle(1000)
  const afterClose = await registered()
  await shot('closed-trace', { focus: await region('.recorder-panel'), note: 'Resolution note then close' })
  await shot('closed-ticket', { focus: await region('.ticket-detail'), note: 'Ticket closed' })
  await shot('closed-rail', { focus: await region('.registry-rail'), note: `tools after close: ${afterClose.length}` })

  await page.getByRole('button', { name: 'Finish & grade' }).click()
  await page.locator('.grade-score').waitFor()
  await settle(800)
  await shot('grade-drawer-2', { focus: await region('.grade-drawer'), note: 'Guarded close graded' })
  await page.locator('.grade-drawer .icon-button').click()
  await settle(400)

  // ── 12. Mode isolation: eval tools vanish, design tools come back ───────────
  const designTab = page.getByRole('button', { name: 'Design', exact: true })
  await shot('before-design-return', { target: await point(designTab) })
  await designTab.click()
  await settle(1100)
  const designTools = await registered()
  await shot('design-return', { focus: await region('.registry-rail'), note: `back to ${designTools.length} design tools` })

  // ── 13. Evidence export ─────────────────────────────────────────────────────
  const exportFab = page.locator('.export-fab')
  await shot('before-export', { target: await point(exportFab) })
  const download = page.waitForEvent('download').catch(() => null)
  await exportFab.click()
  await download
  await settle(700)
  await shot('exported', { focus: await region('.workspace-frame'), note: 'Evidence exported' })

  manifest.registries = { design: designTools, evalTriage: evalTools, evalGuardedBefore: beforeClose, evalGuardedAfter: afterClose }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  await browser.close()
  console.log(`\n${manifest.shots.length} shots → ${shotsDir}`)
  console.log(`design registry: ${designTools.length} tools · eval registry: ${evalTools.length} tools`)
}

run().catch((reason) => {
  console.error(reason)
  process.exit(1)
})
