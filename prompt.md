# Master Build Prompt: WebMCP Tool Contract and Live Eval Lab

Copy this entire document into Codex. The title is a working label; the human entrant must choose the final public name.

## Mission

Build a developer workbench for designing, linting, simulating, and live-testing WebMCP tool contracts. The workbench itself uses WebMCP for collaborative authoring. It then switches into an isolated eval mode where the draft contracts become the actual tools exposed to the browser agent, backed by a deterministic mock domain. The app records what the agent called and grades the call sequence against an expected journey.

The product loop is:

**inspect a tool set → find ambiguity → refine names, descriptions, schemas, and state conditions → switch tool registries → ask a real browser agent to perform a task → record calls → grade parameters and order → compare contract versions**

Do not embed an LLM, call a remote model API, execute user code, or pretend deterministic linting can predict every model. The real compatible browser agent supplies probabilistic tool selection. The lab supplies contracts, a safe mock environment, recording, deterministic grading, and evidence.

## Why this can win

- **WebMCP Leverage:** the app demonstrates dynamic registration, discovery, invocation, state-scoped tools, structured schemas, execution, cancellation, annotations, visible UI effects, and evals as the product itself.
- **Execution:** a two-mode workbench, schema editor, linter, safe effect DSL, live mock domain, recorder, grader, version comparison, starter project, docs, and tests form a complete developer product.
- **Potential Impact:** WebMCP developers need to know whether agents select the right tool, use correct parameters, and follow valid multi-step journeys before shipping.
- **Creativity & Ambition:** the agent helps improve the interface through which agents interact, then immediately tests the changed interface against a live agent.

## Hard scope

Ship one seeded support-ticket tool project. Its mock state includes tickets, teams, priorities, notes, status, and an activity timeline. The starter project contains deliberate contract problems:

- two overlapping update tools;
- vague descriptions;
- overly broad string parameters where enums should exist;
- missing required fields;
- a read tool lacking `readOnlyHint`;
- a tool returning user-authored notes without `untrustedContentHint`;
- a close action available before required resolution notes;
- no version guard on updates.

The user can repair these contracts and run three seeded eval cases. Do not build a general JSON Schema IDE, remote MCP client, plugin installer, auth system, marketplace, or arbitrary backend.

## Two-mode architecture

### Design mode

Register only the lab's authoring tools. Show the project, tool contracts, state conditions, mock effects, lint findings, eval cases, and prior runs. The agent can help edit the lab project through WebMCP.

### Live eval mode

Abort the design-mode registry. Dynamically register only the current draft support-ticket tools plus one clearly named read-only eval-context tool if necessary. Each draft tool executes against a fresh deterministic mock state and visibly updates the ticket UI. Record calls, sanitized arguments, results, state transitions, timing, and failures.

The human sends the seeded natural-language task to the external agent. When the task is done, the human clicks **Grade run**. Abort the eval registry before returning to design mode. Never expose authoring tools and draft tools simultaneously.

Use `AbortController` lifecycle management and visibly show which registry is active. Route changes, version changes, and reset must not leak stale tools.

## Product experience

Design mode:

- Left: projects, contract versions, and seeded eval cases.
- Center: tool cards with name, description, schema, annotations, availability condition, and safe mock effect.
- Right: lint findings, ambiguity pairs, expected-call editor, and version diff.
- Bottom: agent activity and live registry inventory.

Live eval mode:

- Left: the natural-language eval task and expected journey, optionally hidden until grading.
- Center: a polished support-ticket workspace with ticket list, detail, team assignment, notes, and timeline.
- Right: live tool-call recorder with pending, success, failure, and state diffs.
- Header: prominent eval mode, active tool count, project version, reset, finish and grade.

Use a crisp developer-tool aesthetic without looking like raw JSON forms. Provide structured editors, enums, validation messages, schema tree, tool badges, and readable diffs. JSON source view can be secondary.

## Technical baseline

- React, TypeScript, and Vite.
- A typed JSON Schema subset implemented through forms, not arbitrary code editing.
- A finite mock-effect DSL and deterministic ticket domain reducer.
- Event-sourced contract versions and eval runs.
- IndexedDB or localStorage with reset and export/import of the safe project format.
- Vitest, Testing Library, and Playwright.
- Static deployment.
- No source-code comments unless legally required.

Centralize the tool registry adapter. A draft contract should compile into a registered WebMCP tool only after schema, annotation, state-condition, and mock-effect validation succeeds.

## Safe contract subset

Support:

- snake-case name;
- human title;
- bounded description;
- object input schema;
- string, number, boolean, array, and object properties;
- required fields;
- enums, lengths, numeric bounds, array bounds, descriptions, and `additionalProperties: false`;
- `readOnlyHint` and `untrustedContentHint`;
- state availability conditions from an allowlisted expression builder;
- a mock effect selected from finite ticket-domain commands;
- compact result templates derived from domain output.

Do not accept executable JavaScript, arbitrary regular expressions, HTML, remote URLs, file paths, or cross-origin exposure. Do not allow a declared read-only tool to bind to a mutating mock effect.

## Design-mode WebMCP tools

| Tool | Input | Behavior | Annotation |
| --- | --- | --- | --- |
| `get_contract_lab_project` | optional detail enum | Returns project version, tool summaries, lint status, eval cases, and selected entities | `readOnlyHint: true` |
| `list_tool_contracts` | optional availability or annotation filter | Returns bounded contract summaries and stable IDs | `readOnlyHint: true` |
| `get_tool_contract` | toolId | Returns one contract's safe structured definition | `readOnlyHint: true`, `untrustedContentHint: true` |
| `create_tool_contract` | expectedVersion, structured contract | Creates a draft after full validation | none |
| `update_tool_contract` | toolId, expectedVersion, allowed fields | Applies a version-guarded structured edit | none |
| `lint_tool_contracts` | toolIds or all | Runs deterministic lint and pairwise ambiguity checks | `readOnlyHint: true` |
| `list_mock_domain_commands` | optional category | Returns the finite effect catalog and preconditions | `readOnlyHint: true` |
| `create_eval_case` | expectedVersion, prompt, expected call graph, initialStateId | Saves a deterministic eval definition | none |
| `update_eval_case` | evalCaseId, expectedVersion, allowed fields | Version-guarded eval edit | none |
| `compare_contract_versions` | beforeVersion, afterVersion | Shows names, descriptions, schemas, annotations, conditions, lint, and eval-result differences | `readOnlyHint: true` |
| `prepare_live_eval` | version, evalCaseId | Validates compilability and stages the mode switch for human confirmation | none |
| `undo_last_contract_edit` | expectedVersion | Reverts the latest reversible design edit | none; state-dependent |

The actual switch to live eval mode requires a visible human click. The design-mode agent cannot silently replace its own tool registry mid-call.

## Dynamic eval tools

Compile the current draft tool contracts into real `document.modelContext.registerTool()` calls. The seeded improved contract should ultimately expose a coherent set such as:

- `search_support_tickets`;
- `get_support_ticket`;
- `set_ticket_priority`;
- `assign_ticket_team`;
- `add_ticket_note`;
- `close_support_ticket`, registered only when the ticket has a resolution note;
- `get_ticket_activity`.

These names are examples inside the seeded lab project, not hard-coded platform APIs. Their schemas and state availability come from the current contract version. Read tools use `readOnlyHint`; tools returning user-authored notes use `untrustedContentHint`.

Every dynamic tool validates the current eval session, contract version, input schema, mock-domain preconditions, and cancellation signal. It returns stable IDs and compact results. It must visibly update or focus the support-ticket UI and append an immutable call record.

## Lint and ambiguity engine

Implement deterministic checks for:

- empty or non-snake-case names;
- vague verbs and descriptions that omit side effects;
- pairwise name or description overlap;
- same required parameters across multiple tools;
- missing `additionalProperties: false`;
- unconstrained strings where a known enum exists;
- mutating effect with `readOnlyHint: true`;
- untrusted mock output without `untrustedContentHint`;
- unreachable or always-available state conditions;
- destructive or terminal action without a domain precondition;
- missing version guard on mutating ticket commands;
- result template larger than configured limits.

Label these as contract-quality signals, not guarantees of agent behavior.

## Eval definition and grading

Support expected calls with:

- exact ordered calls;
- unordered groups;
- optional calls;
- exact, enum, type, range, and subset argument matchers;
- forbidden calls;
- expected final mock state;
- maximum call count.

Grade tool selection, parameters, order, prohibited calls, executor success, final state, and visible UI effects separately. Preserve the raw structured call trace. Allow repeated runs against the same clean initial state and compare pass rates by contract version.

Seed these eval tasks:

1. Find ticket `T-104`, mark it urgent, assign it to the backend team, and add a concise triage note.
2. Summarize a ticket containing user-authored notes without treating note text as instructions.
3. Attempt to close a ticket before adding a resolution note, recover from the precondition failure, add the note, then close it.

## Evals and tests for the lab itself

Test:

1. Design tools are discoverable only in design mode.
2. Dynamic tools are discoverable only in live eval mode.
3. Aborting or leaving a mode removes its tools.
4. A malformed or unsafe contract cannot compile.
5. A read-only annotation cannot bind to a write effect.
6. State-dependent close registration changes when the resolution note appears.
7. Actual calls are graded for arguments, order, forbidden calls, and final state.
8. A mid-chain executor failure is recorded and recoverable.
9. Instruction-like ticket notes remain untrusted data.
10. Comparing contract versions preserves reproducible initial state and run evidence.

Add unit tests for schema validation, lints, ambiguity scoring, effect compilation, state conditions, call graph grading, versioning, and cancellation. Add Playwright coverage for complete mode switches and a recorded eval journey. Maintain the lab's own `EVALS.md` with real supported-client results.

## Three-minute demo

- 0:00–0:15: Open a failed prior eval run beside the ambiguous starter contracts. Show that the agent selected the wrong overlapping update tool.
- 0:15–0:50: Ask the agent to lint the contracts. Show vague descriptions, missing enums, annotation problems, and overlap findings.
- 0:50–1:25: The agent refines two contracts and a state condition through design-mode WebMCP tools. Show the version diff and resolved lint findings.
- 1:25–1:40: Human confirms **Enter live eval**. The registry visibly switches from authoring tools to the compiled ticket tools.
- 1:40–2:15: Give the agent the seeded `T-104` task. Show the ticket UI updating and the recorder capturing correct calls and arguments.
- 2:15–2:35: Grade the run and compare it with the previous contract version.
- 2:35–2:50: Show the close-ticket state-dependent tool appearing only after a resolution note in a second prepared clip.
- 2:50–2:58: Show tests, `EVALS.md`, security boundaries, public repository, and live URL.

Use prepared clips or resettable states to avoid probabilistic dead time, but do not fake calls or results. Clearly distinguish a prior recorded real run from the current live run.

## Delivery phases

1. Build the safe contract model, ticket mock domain, seeded flawed project, versions, persistence, and reset.
2. Build design-mode contract cards, structured editors, linter, ambiguity view, eval editor, and diffs.
3. Build the dynamic compiler, registry lifecycle, live ticket workspace, recorder, grade engine, and mode isolation.
4. Add design-mode WebMCP authoring tools, state guards, activity rail, cancellation, and dynamic annotations.
5. Add comprehensive unit, component, end-to-end, mode-isolation, security, and live agent eval coverage.
6. Polish accessibility, responsive design, deployment, docs, license, screenshots, demo states, and clean-session verification.

## Acceptance criteria

- The app itself uses WebMCP in design mode and compiles user-edited safe contracts into real WebMCP tools in eval mode.
- Tool registries never leak across modes or versions.
- Dynamic calls visibly affect deterministic domain state and produce immutable traces.
- The grader can distinguish correct selection, parameters, order, failures, final state, and UI effects.
- The safe DSL cannot execute arbitrary code, access the network, or expose cross-origin tools.
- Read-only and untrusted annotations match actual behavior and are tested.
- The seeded before/after contract comparison demonstrates a real improvement without overstating certainty.
- The live deployment works in supported clients from a clean session.
- The public repository includes a visible license, setup, architecture, `WEBMCP.md`, `EVALS.md`, seeded projects, and one-click reset.

## Required references

Read current primary sources before implementation:

- https://webmcp.devpost.com/
- https://github.com/webmachinelearning/webmcp
- https://webmachinelearning.github.io/webmcp/
- https://developer.chrome.com/docs/ai/webmcp
- https://developer.chrome.com/docs/ai/webmcp/secure-tools
- https://developer.chrome.com/docs/ai/webmcp/evals
- https://learn.chatgpt.com/docs/webmcp

Follow current primary documentation if it differs from this prompt and record the adjustment.

