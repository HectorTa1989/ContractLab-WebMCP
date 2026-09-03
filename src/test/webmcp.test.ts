import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeedDomain, evalCases, seededVersions } from '../data/seed'
import { WebMCPRegistry } from '../lib/webmcp'

const callbacks = () => ({
  getVersions: () => seededVersions,
  getVersion: () => seededVersions[1],
  getEvalCases: () => evalCases,
  getDomain: () => createSeedDomain(),
  executeDraft: vi.fn(async () => ({})),
  selectContract: vi.fn(),
  prepareEval: vi.fn(),
  createContract: vi.fn(),
  updateContract: vi.fn(),
  createEvalCase: vi.fn(),
  updateEvalCase: vi.fn(),
  undoLastEdit: vi.fn(),
})

describe('WebMCP registry isolation', () => {
  afterEach(() => { delete document.modelContext })

  it('aborts design tools before registering eval tools', async () => {
    const active = new Set<string>()
    document.modelContext = {
      registerTool: vi.fn((tool, options) => {
        active.add(tool.name)
        options?.signal?.addEventListener('abort', () => active.delete(tool.name))
      }),
    }
    const registry = new WebMCPRegistry()
    await registry.register('design', callbacks())
    expect(active.has('lint_tool_contracts')).toBe(true)
    expect(active.has('get_support_ticket')).toBe(false)
    await registry.register('eval', callbacks())
    expect(active.has('lint_tool_contracts')).toBe(false)
    expect(active.has('get_support_ticket')).toBe(true)
    expect(active.has('close_support_ticket')).toBe(false)
    registry.abort()
    expect(active.size).toBe(0)
  })
})
