export type PrimitiveType = 'string' | 'number' | 'boolean' | 'array' | 'object'

export interface SchemaProperty {
  type: PrimitiveType
  description: string
  enum?: string[]
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  items?: SchemaProperty
}

export interface InputSchema {
  type: 'object'
  properties: Record<string, SchemaProperty>
  required: string[]
  additionalProperties: false | true
}

export type EffectCommand =
  | 'search_tickets'
  | 'get_ticket'
  | 'set_priority'
  | 'assign_team'
  | 'add_note'
  | 'close_ticket'
  | 'get_activity'

export type AvailabilityCondition = 'always' | 'ticket_selected' | 'has_resolution_note'

export interface ToolContract {
  id: string
  name: string
  title: string
  description: string
  inputSchema: InputSchema
  annotations: {
    readOnlyHint: boolean
    untrustedContentHint: boolean
  }
  availability: AvailabilityCondition
  effect: EffectCommand
  resultTemplate: string
  requiresVersion: boolean
}

export interface ContractVersion {
  version: number
  label: string
  createdAt: string
  summary: string
  contracts: ToolContract[]
}

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'closed'
export type Team = 'backend' | 'billing' | 'success' | 'platform'

export interface ActivityItem {
  id: string
  at: string
  actor: string
  message: string
  kind: 'created' | 'priority' | 'assignment' | 'note' | 'status'
}

export interface TicketNote {
  id: string
  body: string
  author: string
  kind: 'internal' | 'resolution' | 'customer'
  createdAt: string
}

export interface Ticket {
  id: string
  subject: string
  customer: string
  customerEmail: string
  status: TicketStatus
  priority: TicketPriority
  team: Team
  version: number
  summary: string
  tags: string[]
  notes: TicketNote[]
  activity: ActivityItem[]
}

export interface DomainState {
  tickets: Ticket[]
  selectedTicketId: string | null
}

export interface ExpectedCall {
  tool: string
  args: Record<string, unknown>
  optional?: boolean
}

export interface EvalCase {
  id: string
  title: string
  prompt: string
  expectedCalls: ExpectedCall[]
  forbiddenCalls: string[]
  maxCalls: number
  expectedFinalState: Partial<Pick<Ticket, 'id' | 'priority' | 'team' | 'status'>> & { hasNoteKind?: TicketNote['kind'] }
}

export type CallStatus = 'pending' | 'success' | 'failure'

export interface ToolCallRecord {
  id: string
  tool: string
  args: Record<string, unknown>
  status: CallStatus
  startedAt: string
  durationMs: number
  result?: unknown
  error?: string
  stateDiff: string[]
  visibleEffect: boolean
}

export interface GradeDimension {
  label: string
  passed: boolean
  score: number
  detail: string
}

export interface GradeResult {
  score: number
  passed: boolean
  dimensions: GradeDimension[]
}

export type Plan = 'free' | 'pro' | 'admin'

export interface SessionUser {
  email: string | null
  plan: Plan
  authenticated: boolean
}

export interface PersistedLabState {
  versions: ContractVersion[]
  selectedVersion: number
  evalCases: EvalCase[]
  runHistory: Array<{
    id: string
    evalCaseId: string
    version: number
    createdAt: string
    calls: ToolCallRecord[]
    grade: GradeResult
  }>
}
