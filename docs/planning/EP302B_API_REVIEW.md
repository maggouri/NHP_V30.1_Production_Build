# EP302B API Review

## Scope
Service-layer domain registry APIs on Creaty server (`3020`), additive to EP-301B mailbox lifecycle routes. Wires registry read path into existing domain list and workflow validation with env fallback when registry is empty.

## Endpoint Map

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/mailbox-lifecycle/ping` | Public | Health + lifecycle/registry version |
| GET | `/api/mailbox-lifecycle/domains` | User, Admin, Supervisor | Enabled verified domains (registry or env) |
| GET | `/api/mailbox-lifecycle/domain-registry` | Admin | Full registry (all statuses) |
| POST | `/api/mailbox-lifecycle/domain-registry` | Admin | Add domain |
| PATCH | `/api/mailbox-lifecycle/domain-registry/:id` | Admin | Update metadata / verify / enable / disable |
| DELETE | `/api/mailbox-lifecycle/domain-registry/:id` | Admin | Soft delete (`deprecated`) |
| POST | `/api/mailbox-lifecycle/workflows` | User, Admin | Domain choice now validated against registry when populated |

## Auth Contract
- Protected routes require:
  - Header: `x-creaty-token`
  - Identity: `userId` in query/body
- Admin CRUD: `userId` must resolve to `Admin` via `NHP_MAILBOX_ADMIN_USER_IDS`
- Supervisor: read-only on `/domains`; no registry mutations

## PATCH Actions

| Input | Behavior |
|---|---|
| `action: verify` | Set `isVerified: true` |
| `action: unverify` | Set `isVerified: false` |
| `action: enable` | Enable (requires verified) |
| `action: disable` | Disable (last-active guardrail) |
| `action: deprecate` / `delete` | Soft delete |
| `status: enabled\|disabled\|deprecated` | Status transition alias |
| `name`, `notes`, `isVerified` | Metadata update |

## Validation Contract
Registry failures return EP-301/302 envelope:
```json
{
  "ok": false,
  "code": "DOMAIN_LAST_ACTIVE",
  "message": "...",
  "recoverable": true,
  "retryable": false,
  "nextAction": "enable_another_domain_first"
}
```

## Read-Path Precedence

| Registry state | `/domains` source | Workflow domain validation |
|---|---|---|
| Empty | `NHP_MAILBOX_ALLOWED_DOMAINS` | Env allow-list |
| Populated | Enabled + verified registry rows | Enabled registry names |

Response includes `source: "registry" | "env"` on `/domains` for operator diagnostics.

## Persistence
- File: `server_logs/mailbox-lifecycle-domains.json`
- UTF-8 JSON with atomic write (temp file + rename)
- Logic layer: `logic/domain-registry-model.js`
- HTTP layer: `server/mailbox-lifecycle-api.js` (extended)

## GB-01 API Design Review
**PASS** — Endpoints are additive, step-aligned with EP-302 journey, and documented with stable error envelope and env fallback.
