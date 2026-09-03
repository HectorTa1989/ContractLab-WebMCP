# ContractLab

ContractLab is a focused workbench for designing, linting, simulating, and live-evaluating WebMCP tool contracts. It ships with one intentionally flawed support-desk project, a refined contract version, three repeatable eval cases, a deterministic ticket domain, and a seven-dimension grader.

The browser page is the product and the tool provider: design mode exposes authoring tools; live eval mode aborts that registry and exposes only the selected draft contract tools. No LLM is embedded and no user code is executed.

[GitHub: HectorTa1989](https://github.com/HectorTa1989) · MIT licensed

## Product tour

- Inspect a deliberately ambiguous starter registry beside its lint evidence.
- Refine names, descriptions, schemas, annotations, state conditions, and safe effects.
- Switch into live eval mode with a visible human action.
- Let a compatible browser agent invoke the compiled contracts against a clean mock state.
- Review immutable arguments, results, failures, timings, state diffs, and visible effects.
- Grade tool choice, parameters, order, prohibited calls, executor success, final state, and UI effects.
- Compare repeatable evidence across contract versions.

The UI uses an Apple-inspired product language: restrained typography, translucent chrome, grouped inspectors, dense-but-readable developer surfaces, soft depth, and platform-style controls. It uses only local/system fonts and has no remote UI asset dependency.

## Quick start

Requirements: Node.js 20 or newer and npm.

```bash
npm install
copy .env.example .env
npm run dev
```

Open `http://127.0.0.1:5173`.

The local development admin account is:

```text
Email: admin@contractlab.local
Password: contractlab-admin
```

The defaults exist only when `NODE_ENV` is not `production`. Production startup fails unless `SESSION_SECRET` and `ADMIN_PASSWORD` are set. Change every credential before deployment.

## Polar paywall

Free visitors can inspect contracts and lint results. Pro and admin sessions can enter live eval mode, save contract revisions, grade runs, and export project evidence. The admin role always passes the entitlement gate, so the workspace owner can use every paid feature without purchasing their own product.

Create a recurring product in the [Polar dashboard](https://polar.sh), then configure:

```env
APP_URL=https://your-domain.example
SESSION_SECRET=a-long-random-secret
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-strong-unique-password
POLAR_ACCESS_TOKEN=polar_oat_...
POLAR_PRODUCT_ID=your-product-uuid
POLAR_WEBHOOK_SECRET=polar_whs_...
POLAR_SERVER=production
```

Set the Polar webhook URL to `https://your-domain.example/api/polar/webhook` and subscribe to `order.paid`. ContractLab verifies the Standard Webhooks signature using Polar’s SDK. Checkout completion is also verified server-side before a signed, HTTP-only Pro session is issued.

Use `POLAR_SERVER=sandbox` while testing. Polar sandbox and production tokens/products are separate.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite and the local Node API together |
| `npm run build` | Type-check and produce the optimized client build |
| `npm start` | Serve the API and existing `dist/` build |
| `npm test` | Run deterministic unit tests |
| `npm run test:e2e` | Run the Chromium mode-switch journey |

## Project structure

```text
ContractLab/
├─ e2e/
│  └─ workbench.spec.ts          Admin → live eval → grade journey
├─ server/
│  └─ index.ts                   Sessions, admin bypass, Polar checkout/webhook
├─ src/
│  ├─ data/
│  │  └─ seed.ts                 Flawed/refined contracts, tickets, eval cases
│  ├─ lib/
│  │  ├─ api.ts                  Typed browser-to-server calls
│  │  ├─ domain.ts               Finite mock-effect executor and state guards
│  │  ├─ grader.ts               Seven-dimension deterministic grading
│  │  ├─ lint.ts                 Contract-quality and ambiguity signals
│  │  ├─ schema.ts               Safe schema/argument validation and compiler
│  │  ├─ store.ts                Local project versions, runs, reset, export
│  │  └─ webmcp.ts               Central registry lifecycle adapter
│  ├─ test/                      Unit and mode-isolation tests
│  ├─ App.tsx                   Design/eval product experience
│  ├─ styles.css                Responsive Apple-inspired design system
│  └─ types.ts                  Domain and contract model
├─ EVALS.md                      Supported-client evidence log
├─ WEBMCP.md                     API choices, lifecycle, and security boundaries
├─ SECURITY.md                   Threat model and deployment checklist
├─ playwright.config.ts
├─ vite.config.ts
└─ prompt.md                     Original product brief
```

## Architecture

```text
Human + browser agent
        │
        ▼
 React workbench ───── localStorage versions and run evidence
        │
        ├─ Design mode ── authoring WebMCP registry
        │                   └─ lint / inspect / compare / stage
        │
        └─ Live eval ─── compiled draft WebMCP registry
                            └─ validate → safe reducer → trace → visible UI → grade

 Node companion
        └─ signed admin sessions + Polar checkout verification + signed webhooks
```

`WebMCPRegistry` owns one `AbortController`. Every register operation aborts the previous controller first. Route/mode/version/domain changes therefore remove stale tools before the next registry is installed. The close tool is omitted until the selected ticket contains a resolution note.

Every contract compiles only after validating its name, bounded descriptions, object schema, allowed primitive subset, annotations, effect compatibility, availability condition, and result budget. Effects are enum values handled by a pure reducer; contracts cannot contain JavaScript, regular expressions, HTML, URLs, paths, or network actions.

## Deployment

`npm run build` creates a static Vite client. Polar entitlement verification and the admin bypass require the small Node companion in `server/index.ts`, so deploy the repository to a Node-capable host and run `npm start`. A purely static host can render the free workbench but cannot securely unlock paid features.

Required production checks:

1. Set all environment variables and use a 32+ character random session secret.
2. Replace the development admin credentials.
3. Configure a public HTTPS webhook endpoint in Polar.
4. Confirm `POLAR_SERVER=production` and use production IDs.
5. Run `npm run build`, `npm test`, and `npm run test:e2e`.
6. Test WebMCP from a clean supported browser session.

## Documentation

- [WebMCP implementation](WEBMCP.md)
- [Eval evidence](EVALS.md)
- [Security model](SECURITY.md)
- [Polar TypeScript SDK](https://polar.sh/docs/integrate/sdk/typescript)
- [Polar checkout sessions](https://polar.sh/docs/features/checkout/session)

## Current verification

- Production TypeScript/Vite build: passing
- Deterministic unit suites: 5 passing
- Deterministic unit tests: 11 passing
- Chrome Playwright journeys: 1 passing
- Live Codex in-app Browser WebMCP run: 100/100 on urgent triage
- Dependency audit: 0 known vulnerabilities
- Browser-agent evidence and its limitations are recorded in `EVALS.md`

## License

MIT © HectorTa1989. See [LICENSE](LICENSE).
