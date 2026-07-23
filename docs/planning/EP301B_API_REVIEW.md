# EP301B API Review

## Scope
Backend REST APIs for EP-301 mailbox lifecycle journey on Creaty server (`3020`), additive and backward compatible.

## Endpoint Map

| Method | Path | Step | Roles |
|---|---|---|---|
| GET | `/api/mailbox-lifecycle/ping` | Health | Public |
| GET | `/api/mailbox-lifecycle/domains` | Choose Domain | User, Admin, Supervisor (read) |
| POST | `/api/mailbox-lifecycle/workflows` | Choose Domain | User, Admin |
| GET | `/api/mailbox-lifecycle/workflows/:id` | Any | User (own), Admin, Supervisor |
| POST | `/api/mailbox-lifecycle/workflows/:id/mailbox/generate` | Create Mailbox | User, Admin |
| POST | `/api/mailbox-lifecycle/workflows/:id/mailbox/manual` | Create Mailbox | User, Admin |
| POST | `/api/mailbox-lifecycle/workflows/:id/validate` | Validation | User, Admin |
| GET | `/api/mailbox-lifecycle/workflows/:id/connection` | Connection Settings | User, Admin |
| POST | `/api/mailbox-lifecycle/workflows/:id/connection/verify` | Connection Settings | User, Admin |
| POST | `/api/mailbox-lifecycle/workflows/:id/ready` | Ready | User, Admin |
| POST | `/api/mailbox-lifecycle/workflows/:id/recover` | Recovery assist | Supervisor only |

## Auth Contract
- Required on protected routes:
  - Header: `x-creaty-token`
  - Identity: `userId` in query/body
- Supervisor service role:
  - Header: `x-nhp-supervisor-key` (matches `NHP_MAILBOX_SUPERVISOR_KEY`)

## Validation Contract
All step failures return EP-301 envelope:
```json
{
  "ok": false,
  "code": "DOMAIN_NOT_ALLOWED",
  "message": "...",
  "recoverable": true,
  "retryable": false,
  "nextAction": "choose_allowed_domain"
}
```

Mailbox records are normalized/validated through `logic/mailbox-lifecycle-model.js` (`schemaVersion = 2`).

## Journey Alignment
1. Login — existing auth context supplies `userId/token`.
2. Choose Domain — `POST /workflows` with domain.
3. Create Mailbox — generate/manual endpoints with domain guard.
4. Validation — library lookup + lifecycle validation.
5. Mailbox Created — state transition after successful validation.
6. Connection Settings — resolve + verify EmailCore credentials.
7. Ready — gated by validation + connection verification.

## Compatibility Notes
- Existing EmailCore endpoints remain source of truth for mailbox creation.
- New routes are additive under `/api/mailbox-lifecycle/*`.
- Creaty `/ping` exposes `mailboxLifecycleApiVersion` for deploy detection.

## GB-01 API Design Review
**PASS** — Endpoints are step-aligned, additive, and documented with stable error envelope.
