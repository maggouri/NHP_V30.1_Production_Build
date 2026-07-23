# EP301B API Decisions

## Adopted Decisions

1. **Mount location: Creaty server (3020)**
   - Rationale: mailbox lifecycle is Creaty/EmailCore journey; keeps orchestration near existing signup/library integration.

2. **Additive route namespace: `/api/mailbox-lifecycle/*`**
   - Rationale: avoids breaking existing `/start-signup`, queue, and orchestration routes.

3. **Unified validation via EP-301A model**
   - Uses `logic/mailbox-lifecycle-model.js` for domain/mailbox normalization and relation checks.

4. **Role enforcement baseline**
   - User/Admin: create, validate, connection, ready.
   - Admin: cross-workflow read access.
   - Supervisor: recovery-only (`/recover`), no mailbox creation/authz override.

5. **Workflow persistence in `server_logs/mailbox-lifecycle-workflows.json`**
   - Rationale: no DB/infra migration; deployable immediately; offline-safe file store.

6. **EmailCore proxy for create/validate/verify**
   - Reuses existing remote endpoints (`/library/sessions*`) behind lifecycle guards.

7. **Standard EP-301 error envelope on all failures**
   - `{ ok, code, message, recoverable, retryable, nextAction }`

## Rejected Alternatives

1. **Frontend-first orchestration in `modules/creaty/*`**
   - Rejected: EP-301B scope is backend-only.

2. **New standalone server/port**
   - Rejected: violates PE-02 deploy simplicity and duplicates Creaty auth context.

3. **Hard SQL/Oracle persistence in EP-301B**
   - Rejected: infra out of scope; EP-301A already chose additive model.

4. **Supervisor allowed to mark READY or create mailboxes**
   - Rejected: conflicts with permissions matrix (assistive recovery only).

5. **Breaking changes to existing EmailCore route shapes**
   - Rejected: backward compatibility requirement for legacy consumers.

## Configuration
- `NHP_MAILBOX_ALLOWED_DOMAINS` — comma-separated allowed domains (default: `emailcore.app`)
- `NHP_MAILBOX_ADMIN_USER_IDS` — comma-separated admin userIds (default: `admin,maggouri`)
- `NHP_MAILBOX_SUPERVISOR_KEY` — supervisor service key
- `NHP_EMAILCORE_API_BASE` — optional default EmailCore base URL

## GB-02 Permissions Review
**PASS** — User/Admin/Supervisor matrix enforced per endpoint with explicit 403 responses.

## GB-03 Validation Review
**PASS** — Domain guards, lifecycle schema validation, and step transition gates implemented.
