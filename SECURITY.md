# Security model

ContractLab is a deterministic browser lab, not a production support system. Its boundaries are intentionally narrow.

## Contract execution

- Contracts select from finite ticket-domain effects; they cannot contain code.
- Input schemas reject undeclared fields and validate types, enums, bounds, and required keys.
- Mutating commands use an optimistic `expected_version` guard.
- Closing requires a resolution note and is registered only while the condition is true.
- Read-only annotations are checked against actual effect behavior.
- User-authored ticket notes are marked untrusted in schemas, results, and UI.

## WebMCP exposure

- Tools register only in the top-level document.
- Registries are same-origin by default and never use `exposedTo`.
- Each mode owns one abort signal; a new registry aborts the old one first.
- Unsupported browsers get a labeled preview, not a fake active status.

## Accounts and payments

- Admin credentials are checked by the Node server, never by client code.
- Sessions are signed, HTTP-only, SameSite=Lax cookies.
- Production requires explicit admin credentials and a session secret.
- Admin login has a small in-memory rate limit.
- Polar checkout completion is retrieved server-side and matched to the configured product.
- Polar webhooks are signature-verified before paid email state is accepted.
- State-changing API requests reject mismatched origins.

## Production checklist

- Replace development credentials and set a random 32+ character `SESSION_SECRET`.
- Use HTTPS and `POLAR_SERVER=production`.
- Store entitlement state in a durable database if access must survive server restarts across devices.
- Put rate limiting in a shared store when running more than one server instance.
- Review the included Content Security Policy for any hosting-specific requirements.
- Rotate Polar and session secrets after suspected exposure.
- Do not put `.env` in source control.

Report vulnerabilities privately to the repository owner before public disclosure.
