# EP-301 Execution Plan

## Objective
Deliver a deterministic mailbox onboarding workflow:
`Login -> Choose Domain -> Create Mailbox -> Validation -> Mailbox Created -> Connection Settings -> Ready`
using the current Creaty/EmailCore architecture, with no infrastructure migration.

## Scope
- Add a structured EP-301 workflow layer over existing modules/endpoints.
- Add explicit domain selection and step-based validation contracts.
- Standardize error/retry behavior and readiness criteria.
- Provide role-aware behavior for User/Admin/Supervisor capabilities.
- Preserve baseline runtime services and existing ports/endpoints.

## Non-goals
- No replacement of existing Creaty/EmailCore server stack.
- No DNS/Caddy/Render or production infra redesign.
- No baseline vault/security secret model redesign.
- No redesign of unrelated modules (SEO, PNG generation, non-mailbox flows).

## Impact Analysis

### Architecture
- Add EP-301 orchestration state machine in UI/background boundary.
- Reuse current action dispatch and handler structure.
- Introduce explicit step transition guards and uniform result envelope.

### Database / persistence
- Reuse existing extension local storage and account/session structures.
- Add EP-301 workflow state keys per mailbox request (new logical records only).
- No breaking change to existing account keys.

### API
- Continue using existing `creaty` and `library` endpoints.
- Add a normalized client-side API adapter shape:
  - `createMailbox(...)`
  - `validateMailbox(...)`
  - `resolveConnectionSettings(...)`
  - `markReady(...)`
- Any new API surface should be additive and backward compatible.

### UI
- Add explicit stepper or equivalent stateful journey in Creaty UX.
- Add domain selector before mailbox creation trigger.
- Add "connection verified" and final "ready" status views.
- Keep low-spec compatibility: bounded polling, lightweight rendering, lazy updates.

### Oracle / AI impact
- Oracle/AI path is kept as assistive and non-authoritative for EP-301 state transitions.
- Supervisor/AI may recover field issues but cannot override authz or completion gates.
- Deterministic workflow validations remain rule-based.

## Rollback Plan
- Feature-flag EP-301 workflow entrypoint.
- On rollback:
  1. Disable EP-301 UI entry.
  2. Route users to current mailbox creation path.
  3. Keep created mailbox/session data intact.
- Rollback is non-destructive (no schema drop required).

## Recovery Plan
- For transient API failures: exponential retry with max-attempt cap.
- For queue-contention failures: explicit queued state + resume mechanism.
- For mapping mismatches (session id/email): fallback lookup from both library and pipeline-phase.
- For credential failures: guided re-auth/config sync path before retry.

## Success Criteria
- User can complete full 7-step journey with deterministic state transitions.
- Each step returns standard validation/error payload.
- No open blockers in role gating (User/Admin/Supervisor matrix enforced).
- No regression in existing signup queue and activation flows.
- Observed low-spec usability remains acceptable (no significant UI lag increase).

## Time-to-First-Working-Mailbox (Target)
- **Primary target**: <= 90 seconds median (from journey start to `Ready`) under normal server conditions.
- **Acceptable under queue pressure**: <= 180 seconds with explicit queued/wait states.

## Execution Gates

### GV-01 UX Gate
- Stepper/journey clarity validated.
- Domain selection and error feedback understandable.
- Ready state and next actions obvious.

### GV-02 Functional Gate
- Full 7-step workflow passes happy-path end-to-end.
- Validation and retries work per contract.
- Connection settings verification passes.

### GV-03 Regression Gate
- Existing queue, activation polling, and EmailCore message/session behavior unaffected.
- Existing admin and auth surfaces continue to work.
- No critical performance regression on low-spec devices.

### GV-04 Product Acceptance Gate
- Stakeholder sign-off on journey, readiness signal, and operational usability.
- Documentation aligned with shipped behavior.
- EP-301 marked implementation complete.

## Implementation Readiness Notes
- Architecture baseline is sufficient.
- Endpoints and integration points already exist.
- Required work is orchestration, validation normalization, and UX/state hardening.
