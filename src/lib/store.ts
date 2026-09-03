import type { PersistedLabState } from '../types'
import { evalCases, seededVersions } from '../data/seed'

const STORAGE_KEY = 'contractlab.project.v1'

export const freshLabState = (): PersistedLabState => ({
  versions: structuredClone(seededVersions),
  selectedVersion: 2,
  evalCases: structuredClone(evalCases),
  runHistory: [],
})

export const loadLabState = (): PersistedLabState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return freshLabState()
    const parsed = JSON.parse(stored) as PersistedLabState
    if (!Array.isArray(parsed.versions) || !Array.isArray(parsed.runHistory)) return freshLabState()
    if (!Array.isArray(parsed.evalCases)) parsed.evalCases = structuredClone(evalCases)
    return parsed
  } catch {
    return freshLabState()
  }
}

export const saveLabState = (state: PersistedLabState) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

export const resetLabState = () => {
  const state = freshLabState()
  saveLabState(state)
  return state
}

export const exportLabState = (state: PersistedLabState) => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `contractlab-v${state.selectedVersion}.json`
  link.click()
  URL.revokeObjectURL(url)
}
