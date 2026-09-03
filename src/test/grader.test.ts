import { describe, expect, it } from 'vitest'
import { createSeedDomain, evalCases, improvedContracts } from '../data/seed'
import { executeEffect } from '../lib/domain'
import { gradeRun } from '../lib/grader'
import type { ToolCallRecord } from '../types'

describe('eval grader', () => {
  it('scores selection, arguments, order, final state, and effects separately', () => {
    let state = createSeedDomain()
    const inputs = [
      ['get_support_ticket', { ticket_id: 'T-104' }],
      ['set_ticket_priority', { ticket_id: 'T-104', priority: 'urgent', expected_version: 3 }],
      ['assign_ticket_team', { ticket_id: 'T-104', team: 'backend', expected_version: 4 }],
      ['add_ticket_note', { ticket_id: 'T-104', body: 'Escalated for backend triage.', kind: 'internal', expected_version: 5 }],
    ] as const
    const calls: ToolCallRecord[] = []
    for (const [name, args] of inputs) {
      const contract = improvedContracts.find((item) => item.name === name)!
      const effect = executeEffect(contract, args, state)
      state = effect.state
      calls.push({ id: name, tool: name, args, status: 'success', startedAt: new Date().toISOString(), durationMs: 1, stateDiff: effect.diff, visibleEffect: true })
    }
    const result = gradeRun(evalCases[0], calls, state)
    expect(result).toMatchObject({ passed: true, score: 100 })
    expect(result.dimensions).toHaveLength(7)
  })

  it('fails forbidden calls independently', () => {
    const result = gradeRun(evalCases[1], [{ id: '1', tool: 'close_support_ticket', args: {}, status: 'failure', startedAt: '', durationMs: 1, stateDiff: [], visibleEffect: true }], createSeedDomain())
    expect(result.dimensions.find((item) => item.label === 'Prohibited calls')?.passed).toBe(false)
  })
})
