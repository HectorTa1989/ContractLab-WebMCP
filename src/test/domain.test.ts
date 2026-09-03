import { describe, expect, it } from 'vitest'
import { createSeedDomain, improvedContracts } from '../data/seed'
import { executeEffect, isAvailable } from '../lib/domain'

const contract = (effect: string) => improvedContracts.find((item) => item.effect === effect)!

describe('deterministic ticket effects', () => {
  it('enforces optimistic versions and records state diffs', () => {
    const state = createSeedDomain()
    expect(() => executeEffect(contract('set_priority'), { ticket_id: 'T-104', priority: 'urgent', expected_version: 2 }, state)).toThrow('Version conflict')
    const result = executeEffect(contract('set_priority'), { ticket_id: 'T-104', priority: 'urgent', expected_version: 3 }, state)
    expect(result.state.tickets[0]).toMatchObject({ priority: 'urgent', version: 4 })
    expect(result.diff).toContain('priority: normal → urgent')
    expect(state.tickets[0]).toMatchObject({ priority: 'normal', version: 3 })
  })

  it('registers close only after a resolution note and closes safely', () => {
    const initial = createSeedDomain()
    const close = contract('close_ticket')
    expect(isAvailable(close, initial)).toBe(false)
    const noted = executeEffect(contract('add_note'), { ticket_id: 'T-104', body: 'Resolved.', kind: 'resolution', expected_version: 3 }, initial).state
    expect(isAvailable(close, noted)).toBe(true)
    const closed = executeEffect(close, { ticket_id: 'T-104', expected_version: 4 }, noted).state
    expect(closed.tickets[0].status).toBe('closed')
  })

  it('labels customer notes as untrusted data', () => {
    const result = executeEffect(contract('get_ticket'), { ticket_id: 'T-104' }, createSeedDomain())
    expect((result.result as { notes: Array<{ trust: string }> }).notes[0].trust).toBe('untrusted_user_content')
  })
})
