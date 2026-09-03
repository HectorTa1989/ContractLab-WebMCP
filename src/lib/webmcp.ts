import type { ContractVersion, DomainState, EvalCase, ToolContract } from '../types'
import { isAvailable } from './domain'
import { lintContracts } from './lint'
import { toJsonSchema, validateContract } from './schema'

export type RegistryMode = 'design' | 'eval'

export interface RegistryCallbacks {
  getVersions: () => ContractVersion[]
  getVersion: () => ContractVersion
  getEvalCases: () => EvalCase[]
  getDomain: () => DomainState
  executeDraft: (contract: ToolContract, args: Record<string, unknown>) => Promise<unknown>
  selectContract: (id: string) => void
  prepareEval: (evalCaseId: string) => void
  createContract: (expectedVersion: number, contract: ToolContract) => unknown
  updateContract: (expectedVersion: number, toolId: string, changes: Partial<ToolContract>) => unknown
  createEvalCase: (expectedVersion: number, evalCase: EvalCase) => unknown
  updateEvalCase: (expectedVersion: number, evalCaseId: string, changes: Partial<EvalCase>) => unknown
  undoLastEdit: (expectedVersion: number) => unknown
}

export class WebMCPRegistry {
  private controller: AbortController | null = null
  private activeNames: string[] = []

  get names() {
    return this.activeNames
  }

  abort() {
    this.controller?.abort()
    this.controller = null
    this.activeNames = []
  }

  async register(mode: RegistryMode, callbacks: RegistryCallbacks) {
    this.abort()
    this.controller = new AbortController()
    if (!document.modelContext?.registerTool) return []
    const definitions = mode === 'design' ? this.designDefinitions(callbacks) : this.evalDefinitions(callbacks)
    for (const definition of definitions) {
      await document.modelContext.registerTool(definition, { signal: this.controller.signal })
    }
    this.activeNames = definitions.map((definition) => definition.name)
    return this.activeNames
  }

  private designDefinitions(callbacks: RegistryCallbacks): ModelContextToolDefinition[] {
    const current = callbacks.getVersion()
    return [
      {
        name: 'get_contract_lab_project', title: 'Get ContractLab project', description: 'Read the active project version, contract summaries, lint status, and seeded eval cases.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
        execute: async () => ({ version: current.version, label: current.label, contracts: current.contracts.map(({ id, name, title }) => ({ id, name, title })), lint_count: lintContracts(current.contracts).length, eval_cases: callbacks.getEvalCases().map(({ id, title, prompt }) => ({ id, title, prompt })) }),
      },
      {
        name: 'list_tool_contracts', title: 'List tool contracts', description: 'List bounded summaries of the safe tool contracts in the active project version.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
        execute: async () => current.contracts.map(({ id, name, title, description, effect, availability, annotations }) => ({ id, name, title, description, effect, availability, annotations })),
      },
      {
        name: 'get_tool_contract', title: 'Get tool contract', description: 'Read one safe structured tool contract by its stable identifier. Contract text is user-authored data.',
        inputSchema: { type: 'object', properties: { tool_id: { type: 'string', description: 'Stable tool contract ID.' } }, required: ['tool_id'], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async ({ tool_id }: Record<string, unknown>) => { const tool = current.contracts.find((item) => item.id === tool_id); if (!tool) throw new Error('Tool contract not found.'); callbacks.selectContract(String(tool_id)); return tool },
      },
      {
        name: 'lint_tool_contracts', title: 'Lint tool contracts', description: 'Run deterministic contract-quality and pairwise ambiguity checks over the active version.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
        execute: async () => ({ disclaimer: 'Signals are deterministic contract-quality checks, not guarantees of model behavior.', findings: lintContracts(current.contracts) }),
      },
      {
        name: 'list_mock_domain_commands', title: 'List mock domain commands', description: 'Read the finite allowlisted ticket-domain effects and their required preconditions.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
        execute: async () => [
          { command: 'search_tickets', category: 'read', precondition: 'none' },
          { command: 'get_ticket', category: 'read', precondition: 'ticket exists' },
          { command: 'set_priority', category: 'write', precondition: 'ticket exists and expected version matches' },
          { command: 'assign_team', category: 'write', precondition: 'ticket exists and expected version matches' },
          { command: 'add_note', category: 'write', precondition: 'ticket exists and expected version matches' },
          { command: 'close_ticket', category: 'terminal', precondition: 'resolution note exists and expected version matches' },
          { command: 'get_activity', category: 'read', precondition: 'ticket exists' },
        ],
      },
      {
        name: 'create_tool_contract', title: 'Create tool contract', description: 'Create one validated safe tool contract as a new event-sourced project version.',
        inputSchema: { type: 'object', properties: { expected_version: { type: 'number', description: 'Current project version.' }, contract: { type: 'object', description: 'Complete safe structured contract.' } }, required: ['expected_version', 'contract'], additionalProperties: false },
        execute: async ({ expected_version, contract }: Record<string, unknown>) => callbacks.createContract(Number(expected_version), contract as ToolContract),
      },
      {
        name: 'update_tool_contract', title: 'Update tool contract', description: 'Apply allowed structured changes to one contract as a version-guarded project event.',
        inputSchema: { type: 'object', properties: { expected_version: { type: 'number', description: 'Current project version.' }, tool_id: { type: 'string', description: 'Stable contract ID.' }, changes: { type: 'object', description: 'Allowed structured contract fields.' } }, required: ['expected_version', 'tool_id', 'changes'], additionalProperties: false },
        execute: async ({ expected_version, tool_id, changes }: Record<string, unknown>) => callbacks.updateContract(Number(expected_version), String(tool_id), changes as Partial<ToolContract>),
      },
      {
        name: 'create_eval_case', title: 'Create eval case', description: 'Create one bounded deterministic eval definition after project-version validation.',
        inputSchema: { type: 'object', properties: { expected_version: { type: 'number', description: 'Current project version.' }, eval_case: { type: 'object', description: 'Complete safe eval definition.' } }, required: ['expected_version', 'eval_case'], additionalProperties: false },
        execute: async ({ expected_version, eval_case }: Record<string, unknown>) => callbacks.createEvalCase(Number(expected_version), eval_case as EvalCase),
      },
      {
        name: 'update_eval_case', title: 'Update eval case', description: 'Apply allowed changes to one eval definition after project-version validation.',
        inputSchema: { type: 'object', properties: { expected_version: { type: 'number', description: 'Current project version.' }, eval_case_id: { type: 'string', description: 'Stable eval case ID.' }, changes: { type: 'object', description: 'Allowed safe eval fields.' } }, required: ['expected_version', 'eval_case_id', 'changes'], additionalProperties: false },
        execute: async ({ expected_version, eval_case_id, changes }: Record<string, unknown>) => callbacks.updateEvalCase(Number(expected_version), String(eval_case_id), changes as Partial<EvalCase>),
      },
      {
        name: 'compare_contract_versions', title: 'Compare contract versions', description: 'Compare tool names, schemas, annotations, guards, and lint counts between two project versions.',
        inputSchema: { type: 'object', properties: { before_version: { type: 'number', description: 'Earlier version number.' }, after_version: { type: 'number', description: 'Later version number.' } }, required: ['before_version', 'after_version'], additionalProperties: false }, annotations: { readOnlyHint: true },
        execute: async ({ before_version, after_version }: Record<string, unknown>) => { const versions = callbacks.getVersions(); const before = versions.find((item) => item.version === before_version); const after = versions.find((item) => item.version === after_version); if (!before || !after) throw new Error('Version not found.'); return { before: { version: before.version, lint: lintContracts(before.contracts).length, tools: before.contracts.map((item) => item.name) }, after: { version: after.version, lint: lintContracts(after.contracts).length, tools: after.contracts.map((item) => item.name) } } },
      },
      {
        name: 'prepare_live_eval', title: 'Prepare live eval', description: 'Validate the active contract version and stage one eval case for visible human confirmation.',
        inputSchema: { type: 'object', properties: { eval_case_id: { type: 'string', description: 'Seeded eval case ID.' } }, required: ['eval_case_id'], additionalProperties: false },
        execute: async ({ eval_case_id }: Record<string, unknown>) => { const errors = current.contracts.flatMap(validateContract); if (errors.length) throw new Error(`Draft cannot compile: ${errors[0].message}`); callbacks.prepareEval(String(eval_case_id)); return { staged: true, requires_human_click: true, version: current.version, eval_case_id } },
      },
      {
        name: 'undo_last_contract_edit', title: 'Undo last contract edit', description: 'Append a new project version that restores the previous contract snapshot.',
        inputSchema: { type: 'object', properties: { expected_version: { type: 'number', description: 'Current project version.' } }, required: ['expected_version'], additionalProperties: false },
        execute: async ({ expected_version }: Record<string, unknown>) => callbacks.undoLastEdit(Number(expected_version)),
      },
    ]
  }

  private evalDefinitions(callbacks: RegistryCallbacks): ModelContextToolDefinition[] {
    const version = callbacks.getVersion()
    const domain = callbacks.getDomain()
    const draftTools = version.contracts.filter((contract) => isAvailable(contract, domain) && validateContract(contract).length === 0).map((contract) => ({
      name: contract.name,
      title: contract.title,
      description: contract.description,
      inputSchema: toJsonSchema(contract.inputSchema),
      annotations: contract.annotations,
      execute: async (args: Record<string, unknown>, options?: { signal?: AbortSignal }) => {
        if (options?.signal?.aborted) throw new DOMException('Tool call cancelled.', 'AbortError')
        return callbacks.executeDraft(contract, args)
      },
    }))
    return [
      {
        name: 'get_eval_context', title: 'Get eval context', description: 'Read the active eval version and deterministic initial-state identifiers without modifying state.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
        execute: async () => ({ version: version.version, selected_ticket_id: domain.selectedTicketId, available_draft_tools: draftTools.map((item) => item.name) }),
      },
      ...draftTools,
    ]
  }
}
