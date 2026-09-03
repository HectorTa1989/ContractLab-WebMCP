import { describe, expect, it } from 'vitest'
import { seededVersions } from '../data/seed'
import { ambiguityScore, lintContracts } from '../lib/lint'

describe('contract linting', () => {
  it('finds deliberate starter defects and clears the refined version', () => {
    const starter = lintContracts(seededVersions[0].contracts)
    const refined = lintContracts(seededVersions[1].contracts)
    expect(starter.length).toBeGreaterThan(10)
    expect(starter.map((item) => item.code)).toContain('ambiguous_pair')
    expect(refined).toEqual([])
  })

  it('scores overlapping update tools above distinct read tools', () => {
    const [search, get, update, change] = seededVersions[0].contracts
    expect(ambiguityScore(update, change)).toBeGreaterThan(ambiguityScore(search, get))
  })
})
