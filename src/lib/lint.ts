import type { ToolContract } from '../types'
import { validateContract } from './schema'

export type LintSeverity = 'error' | 'warning' | 'info'

export interface LintFinding {
  id: string
  toolId?: string
  severity: LintSeverity
  code: string
  title: string
  detail: string
}

const vagueDescriptions = /^(find|gets?|updates?|changes?|adds?|closes?)\s+[^.]{0,30}\.?$/i
const knownEnums: Record<string, string[]> = {
  priority: ['low', 'normal', 'high', 'urgent'],
  team: ['backend', 'billing', 'success', 'platform'],
  kind: ['internal', 'resolution'],
  status: ['open', 'in_progress', 'closed'],
}

const stopTokens = new Set(['the', 'this', 'that', 'with', 'from', 'when', 'one', 'support', 'ticket', 'tickets', 'current', 'version', 'requires', 'mutates', 'state', 'stable', 'allowed', 'value', 'values', 'new', 'read'])

const tokens = (value: string) => new Set(value.toLowerCase().replace(/[^a-z0-9_ ]/g, ' ').split(/[_\s]+/).map((token) => ['update', 'change'].includes(token) ? 'mutate' : token).filter((token) => token.length > 2 && !stopTokens.has(token)))

export const ambiguityScore = (left: ToolContract, right: ToolContract): number => {
  const a = new Set([...tokens(left.name), ...tokens(left.description)])
  const b = new Set([...tokens(right.name), ...tokens(right.description)])
  const intersection = [...a].filter((token) => b.has(token)).length
  const union = new Set([...a, ...b]).size || 1
  const requiredA = new Set(left.inputSchema.required)
  const requiredB = new Set(right.inputSchema.required)
  const requiredIntersection = [...requiredA].filter((key) => requiredB.has(key)).length
  const requiredUnion = new Set([...requiredA, ...requiredB]).size || 1
  const vaguePair = vagueDescriptions.test(left.description.trim()) && vagueDescriptions.test(right.description.trim()) ? .25 : 0
  return Math.min(1, (intersection / union) * .75 + (requiredIntersection / requiredUnion) * .15 + vaguePair)
}

export const lintContracts = (contracts: ToolContract[]): LintFinding[] => {
  const findings: LintFinding[] = []
  for (const contract of contracts) {
    for (const issue of validateContract(contract)) {
      findings.push({ id: `${contract.id}-${issue.path}`, toolId: contract.id, severity: 'error', code: 'invalid_contract', title: 'Contract cannot compile', detail: `${issue.path} ${issue.message}` })
    }
    if (vagueDescriptions.test(contract.description.trim())) findings.push({ id: `${contract.id}-vague`, toolId: contract.id, severity: 'warning', code: 'vague_description', title: 'Description is too vague', detail: 'Describe the operation, when to use it, and any side effect.' })
    if (contract.inputSchema.additionalProperties !== false) findings.push({ id: `${contract.id}-additional`, toolId: contract.id, severity: 'error', code: 'open_schema', title: 'Open input schema', detail: 'Set additionalProperties to false to reject invented fields.' })
    for (const [field, property] of Object.entries(contract.inputSchema.properties)) {
      if (property.type === 'string' && knownEnums[field] && !property.enum) findings.push({ id: `${contract.id}-${field}-enum`, toolId: contract.id, severity: 'warning', code: 'missing_enum', title: `Unbounded ${field}`, detail: `Use the known values: ${knownEnums[field].join(', ')}.` })
    }
    const readEffect = ['search_tickets', 'get_ticket', 'get_activity'].includes(contract.effect)
    if (readEffect && !contract.annotations.readOnlyHint) findings.push({ id: `${contract.id}-readonly`, toolId: contract.id, severity: 'warning', code: 'missing_readonly', title: 'Missing read-only hint', detail: 'This effect does not mutate state and should declare readOnlyHint.' })
    if (['get_ticket', 'get_activity'].includes(contract.effect) && !contract.annotations.untrustedContentHint) findings.push({ id: `${contract.id}-untrusted`, toolId: contract.id, severity: 'error', code: 'missing_untrusted', title: 'Untrusted output is unlabeled', detail: 'Ticket notes contain user-authored text; set untrustedContentHint.' })
    if (!readEffect && !contract.requiresVersion) findings.push({ id: `${contract.id}-version`, toolId: contract.id, severity: 'warning', code: 'missing_version_guard', title: 'No optimistic lock', detail: 'Mutating ticket commands should require expected_version.' })
    if (contract.effect === 'close_ticket' && contract.availability !== 'has_resolution_note') findings.push({ id: `${contract.id}-precondition`, toolId: contract.id, severity: 'error', code: 'unsafe_terminal_action', title: 'Close is always available', detail: 'Require a resolution note before registering the terminal action.' })
  }
  for (let i = 0; i < contracts.length; i += 1) {
    for (let j = i + 1; j < contracts.length; j += 1) {
      const score = ambiguityScore(contracts[i], contracts[j])
      if (score >= 0.42) findings.push({ id: `pair-${contracts[i].id}-${contracts[j].id}`, severity: 'warning', code: 'ambiguous_pair', title: `${contracts[i].name} ↔ ${contracts[j].name}`, detail: `${Math.round(score * 100)}% deterministic overlap signal. Distinguish purpose and parameters.` })
    }
  }
  return findings
}
