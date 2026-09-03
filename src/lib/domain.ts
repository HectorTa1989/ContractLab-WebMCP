import type { DomainState, EffectCommand, Ticket, TicketNote, ToolContract } from '../types'
import { validateArguments } from './schema'

export interface EffectResult {
  state: DomainState
  result: unknown
  diff: string[]
  focusTicketId?: string
}

const copyState = (state: DomainState): DomainState => ({
  ...state,
  tickets: state.tickets.map((ticket) => ({ ...ticket, notes: [...ticket.notes], activity: [...ticket.activity], tags: [...ticket.tags] })),
})

const ticketIdFrom = (args: Record<string, unknown>) => String(args.ticket_id ?? args.id ?? '')

const requireTicket = (state: DomainState, id: string): Ticket => {
  const ticket = state.tickets.find((item) => item.id === id)
  if (!ticket) throw new Error(`Ticket ${id || '(missing)'} was not found.`)
  return ticket
}

const requireVersion = (contract: ToolContract, ticket: Ticket, args: Record<string, unknown>) => {
  if (!contract.requiresVersion) return
  if (args.expected_version !== ticket.version) throw new Error(`Version conflict: expected ${String(args.expected_version)}, current ${ticket.version}. Read the ticket and retry.`)
}

const appendActivity = (ticket: Ticket, kind: Ticket['activity'][number]['kind'], message: string) => {
  ticket.activity.push({ id: `A-${ticket.activity.length + 10}`, at: new Date().toISOString(), actor: 'Browser agent', message, kind })
}

export const isAvailable = (contract: ToolContract, state: DomainState): boolean => {
  if (contract.availability === 'always') return true
  if (!state.selectedTicketId) return false
  const ticket = state.tickets.find((item) => item.id === state.selectedTicketId)
  if (!ticket) return false
  if (contract.availability === 'ticket_selected') return true
  return ticket.notes.some((note) => note.kind === 'resolution') && ticket.status !== 'closed'
}

const normalizeEffectArgs = (effect: EffectCommand, args: Record<string, unknown>) => {
  if (effect === 'set_priority' && args.value && !args.priority) return { ...args, priority: args.value }
  if (effect === 'assign_team' && args.value && !args.team) return { ...args, team: args.value }
  if (effect === 'add_note' && args.note && !args.body) return { ...args, body: args.note }
  return args
}

export const executeEffect = (contract: ToolContract, rawArgs: Record<string, unknown>, current: DomainState): EffectResult => {
  const issues = validateArguments(rawArgs, contract.inputSchema)
  if (issues.length) throw new Error(issues.map((issue) => `${issue.path} ${issue.message}`).join('; '))
  const args = normalizeEffectArgs(contract.effect, rawArgs)
  const state = copyState(current)
  if (contract.effect === 'search_tickets') {
    const query = String(args.query ?? '').toLowerCase()
    const matches = state.tickets.filter((ticket) => [ticket.id, ticket.subject, ticket.customer, ...ticket.tags].join(' ').toLowerCase().includes(query))
    return { state, result: { tickets: matches.map(({ id, subject, status, priority, team, version }) => ({ id, subject, status, priority, team, version })) }, diff: [] }
  }
  const ticketId = ticketIdFrom(args)
  const ticket = requireTicket(state, ticketId)
  state.selectedTicketId = ticket.id
  if (contract.effect === 'get_ticket') return { state, result: { ...ticket, notes: ticket.notes.map((note) => ({ ...note, trust: note.kind === 'customer' ? 'untrusted_user_content' : 'internal' })) }, diff: [], focusTicketId: ticket.id }
  if (contract.effect === 'get_activity') return { state, result: { ticket_id: ticket.id, activity: ticket.activity }, diff: [], focusTicketId: ticket.id }
  requireVersion(contract, ticket, args)
  if (contract.effect === 'set_priority') {
    const before = ticket.priority
    ticket.priority = String(args.priority) as Ticket['priority']
    ticket.version += 1
    appendActivity(ticket, 'priority', `Priority changed from ${before} to ${ticket.priority}`)
    return { state, result: { ticket_id: ticket.id, priority: ticket.priority, version: ticket.version }, diff: [`priority: ${before} → ${ticket.priority}`, `version: ${ticket.version - 1} → ${ticket.version}`], focusTicketId: ticket.id }
  }
  if (contract.effect === 'assign_team') {
    const before = ticket.team
    ticket.team = String(args.team) as Ticket['team']
    ticket.version += 1
    appendActivity(ticket, 'assignment', `Assigned from ${before} to ${ticket.team}`)
    return { state, result: { ticket_id: ticket.id, team: ticket.team, version: ticket.version }, diff: [`team: ${before} → ${ticket.team}`, `version: ${ticket.version - 1} → ${ticket.version}`], focusTicketId: ticket.id }
  }
  if (contract.effect === 'add_note') {
    const note: TicketNote = { id: `N-${ticket.notes.length + 30}`, body: String(args.body), author: 'Browser agent', kind: String(args.kind ?? 'internal') as TicketNote['kind'], createdAt: new Date().toISOString() }
    ticket.notes.push(note)
    ticket.version += 1
    appendActivity(ticket, 'note', `Added ${note.kind} note`)
    return { state, result: { ticket_id: ticket.id, note_id: note.id, kind: note.kind, version: ticket.version }, diff: [`notes: +1 ${note.kind}`, `version: ${ticket.version - 1} → ${ticket.version}`], focusTicketId: ticket.id }
  }
  if (contract.effect === 'close_ticket') {
    if (!ticket.notes.some((note) => note.kind === 'resolution')) throw new Error('Precondition failed: add a resolution note before closing this ticket.')
    const before = ticket.status
    ticket.status = 'closed'
    ticket.version += 1
    appendActivity(ticket, 'status', 'Closed ticket after resolution note validation')
    return { state, result: { ticket_id: ticket.id, status: ticket.status, version: ticket.version }, diff: [`status: ${before} → closed`, `version: ${ticket.version - 1} → ${ticket.version}`], focusTicketId: ticket.id }
  }
  throw new Error(`Unsupported safe effect: ${contract.effect satisfies never}`)
}
