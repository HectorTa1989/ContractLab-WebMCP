import { describe, expect, it } from 'vitest'
import { improvedContracts } from '../data/seed'
import { validateArguments, validateContract } from '../lib/schema'

describe('safe contract validation', () => {
  it('accepts the refined seeded contracts', () => {
    expect(improvedContracts.flatMap(validateContract)).toEqual([])
  })

  it('rejects unknown fields and invalid enums', () => {
    const priority = improvedContracts.find((contract) => contract.effect === 'set_priority')!
    expect(validateArguments({ ticket_id: 'T-104', priority: 'maximum', expected_version: 3, invented: true }, priority.inputSchema)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'priority' }),
      expect.objectContaining({ path: 'invented' }),
    ]))
  })

  it('rejects read-only annotations on mutating effects', () => {
    const contract = structuredClone(improvedContracts.find((item) => item.effect === 'assign_team')!)
    contract.annotations.readOnlyHint = true
    expect(validateContract(contract)).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'annotations.readOnlyHint' })]))
  })
})
