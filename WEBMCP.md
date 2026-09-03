# WebMCP implementation notes

ContractLab follows the current imperative WebMCP API and keeps the integration behind `src/lib/webmcp.ts` so browser/API changes remain localized.

## Primary sources checked

- [WebMCP Community Group draft](https://webmachinelearning.github.io/webmcp/) — current draft API, registration lifecycle, annotations, discovery, execution, and cancellation.
- [WebMCP repository and explainer](https://github.com/webmachinelearning/webmcp) — imperative registration examples and `AbortController` teardown.
- [Chrome imperative API guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api) — discovery, execution, same-origin defaults, events, and cancellation.
- [Chrome secure tools guide](https://developer.chrome.com/docs/ai/webmcp/secure-tools) — annotation use, origin exposure, and character budgets.
- [Chrome WebMCP eval guide](https://developer.chrome.com/docs/ai/webmcp/evals) — isolation tests plus deterministic and probabilistic evaluation responsibilities.
- [OpenAI Site tools documentation](https://learn.chatgpt.com/docs/webmcp) — top-level imperative registration and current built-in-browser limitations.
- [WebMCP Challenge](https://webmcp.devpost.com/) — official judging focus on leverage, execution, impact, creativity, and ambition.

Sources were checked on 2026-08-28.

## Adjustments from the original brief

1. ContractLab uses top-level imperative tools only. Official OpenAI documentation currently says the built-in browser does not discover declarative WebMCP tools or tools registered inside iframes.
2. Descriptions, parameter descriptions, names, and outputs use the Chrome security guide’s recommended compact budgets: 500, 150, 30, and 1,500 characters respectively.
3. The WebMCP specification is still a Community Group draft rather than a W3C Standard. The UI labels unsupported browsers as a preview instead of claiming the registry is active.
4. Cross-origin exposure is never requested. Registration passes only an abort signal, leaving tools same-origin by default.
5. The original static-deployment goal is retained for the client build, but secure Polar payment verification requires the included Node companion. Paid access is never trusted from localStorage.

## Registry lifecycle

Design and eval tools are never deliberately registered at the same time:

1. `WebMCPRegistry.register()` aborts its previous controller.
2. A fresh controller is created for the selected mode.
3. Definitions are compiled from the current project snapshot and deterministic domain state.
4. Each tool is registered with the fresh signal.
5. Mode, version, reset, and availability changes trigger cleanup and a new registry.

In live eval mode, `close_support_ticket` is absent until the selected ticket has a resolution note. Adding such a note changes deterministic state, which rebuilds the registry and exposes the close tool. Closing the ticket removes it again.

## Design registry

The implemented design registry exposes:

- `get_contract_lab_project`
- `list_tool_contracts`
- `get_tool_contract`
- `create_tool_contract`
- `update_tool_contract`
- `lint_tool_contracts`
- `list_mock_domain_commands`
- `create_eval_case`
- `update_eval_case`
- `compare_contract_versions`
- `prepare_live_eval`
- `undo_last_contract_edit`

`prepare_live_eval` only stages the selected case. The human must click the visible Live eval control to replace the registry.

## Eval registry

Version 2 compiles to:

- `get_eval_context`
- `search_support_tickets`
- `get_support_ticket`
- `set_ticket_priority`
- `assign_ticket_team`
- `add_ticket_note`
- `close_support_ticket` when its state condition passes
- `get_ticket_activity`

Each executor checks the schema, contract version semantics, domain preconditions, and cancellation state. It applies an allowlisted reducer command, focuses the affected ticket, and appends an immutable trace containing sanitized arguments, timing, result/failure, state diff, and visible-effect evidence.

## Security boundaries

- No model API or embedded LLM.
- No arbitrary JavaScript or user-code execution.
- No remote contract loading, remote MCP client, URLs, HTML, file paths, or regular expressions in the safe subset.
- `readOnlyHint` is rejected for mutating effects.
- Customer notes are returned with `untrustedContentHint` and a per-note trust label.
- Tool input is validated in the executor even though it also has a schema.
- Results and descriptions are bounded.
- No `exposedTo` origins are configured.

WebMCP annotations are hints for agents, not an authorization system. Normal server and application authorization must remain authoritative.
