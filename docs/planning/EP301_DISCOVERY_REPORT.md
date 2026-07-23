# EP-301 Discovery Report

## 1) Current Architecture Analysis

### 1.1 Frontend surfaces
- `modules/creaty/creaty.html` is the main operational UI for registration, activation tracking, EmailCore library, and supervision.
- `modules/creaty/creaty.js` orchestrates UI state, queue actions, server health checks, supervisor chat, and account/schedule flows.
- `modules/creaty/emailcore-library.js` handles EmailCore credentials, session listing, message viewing, and mailbox creation actions (`generate` and `manual`).
- `modules/auth.js` controls local login/logout and basic role-based visibility.
- `modules/admin/admin.js` exposes admin-only controls, key management, and operational tools.

### 1.2 Runtime/service architecture
- **Browser extension background**: `background.js` loads `creaty-handlers.js` and bridges UI actions to backend/network operations via message actions.
- **Creaty handlers/orchestration**: `creaty-handlers.js` provides queue/pipeline integration and status synchronization endpoints.
- **Creaty server health/orchestration**: monitored from UI on port `3020`.
- **Ghost server health**: monitored from UI on port `3019`.
- **AI Supervisor**: server module `server/nhp-ai-supervisor.js` for field recovery, status/journal, and controlled action execution.

### 1.3 EP-301 relevant endpoint map (already present)
- Queue and activation:
  - `GET /api/creaty/signup-queue`
  - `GET /api/creaty/signup-queue/:id/messages`
  - `GET /api/creaty/signup-queue/:id/activation-link`
  - `POST /api/creaty/signup-queue/:id/resend-activation`
- Pipeline/session state:
  - `GET /api/creaty/pipeline-phase?sessionId&email`
  - `POST /api/creaty/signup-status`
- Scheduling:
  - `POST /api/creaty/schedule-sync`
  - `GET /api/creaty/schedule-status`
- EmailCore mailbox library (through creaty routes in `emailcore-library.js`):
  - `GET /library/sessions`
  - `POST /library/sessions/generate`
  - `POST /library/sessions/manual`
  - plus read/send message endpoints.

### 1.4 Data/auth model observed
- EmailCore credentials are persisted in extension local storage:
  - `emailcore_creaty_api_base`
  - `emailcore_creaty_user_id`
  - `emailcore_creaty_token`
- Account/session identity is merged from local account rows plus remote session metadata (`pipeline-phase` and `library/sessions`).
- Status model already includes: `PENDING`, `OPENING`, `WAIT_EMAIL`, `ACTIVATING`, `SKIPPED`, `DONE`, and queue-aware waiting states.

## 2) Permissions Matrix (User/Admin/Supervisor)

| Capability | User | Admin | Supervisor |
|---|---|---|---|
| Login/logout in extension UI | Yes | Yes | N/A |
| View own auth status | Yes | Yes | N/A |
| Access admin panel controls | No | Yes (gated by identity checks) | No |
| Configure API keys/tokens globally | No | Yes | No |
| Start/stop/wake Creaty/Ghost via UI actions | Yes (operational) | Yes | No direct UI role |
| Generate mailbox sessions | Yes (if token/userId present) | Yes | No |
| Create custom mailbox | Yes | Yes | No |
| Read mailbox messages | Yes | Yes | No |
| Trigger signup/activation queue actions | Yes | Yes | Indirect assist |
| Run AI recovery for stuck fields | Triggered by workflow | Triggered by workflow | Yes (service role) |
| Execute supervised fix tool-calls | No direct | No direct | Yes (through supervisor bridge) |
| View supervisor status/journal | Yes (in Creaty UI) | Yes | Yes (native owner) |

Notes:
- "Supervisor" here is a **system capability role** (AI/operator service), not a human login role.
- Admin gating currently relies on known email/nickname conditions in UI/auth logic.

## 3) Gaps, Risks, Opportunities

### 3.1 Gaps
- No explicit "Domain selection" UX step in current mailbox create flow; mailbox creation is count/manual email driven.
- No unified validation contract object for all steps (validation currently distributed across UI checks and API response handling).
- No dedicated EP-301 journey state machine artifact for deterministic "Login -> Domain -> Mailbox -> Validation -> Created -> Connection -> Ready".
- Permission checks are partly UI-side; policy is not centralized in a single authz module.

### 3.2 Risks
- Role enforcement drift if admin checks remain duplicated across modules.
- Partial failures in cross-surface orchestration (UI <-> background <-> handler <-> remote API) can create "unknown" intermediate states.
- Queue/activation race conditions when server is online but under load ("another signup is running"/queued states).
- Credential misconfiguration (`userId`/`token`/base URL) leads to failures that can be mistaken for logic issues.
- Performance risk on low-spec devices if additional polling or heavy rendering is introduced without caps.

### 3.3 Opportunities
- Introduce EP-301 workflow contract with strict step states and transition guards.
- Add explicit Domain selection model (manual + recommended), persisted per mailbox request.
- Normalize validation and error taxonomy across frontend/background/server boundaries.
- Reuse existing supervisor/journal pipeline for recoverable validation failures.
- Add Time-to-First-Working-Mailbox telemetry marker from request start to "connection verified".

## 4) Architectural Decisions for EP-301 (resolved for implementation start)

1. **No infrastructure rework**: keep current extension + background + existing Creaty/EmailCore endpoints.
2. **EP-301 is orchestration-first**: implement as a structured workflow layer over current APIs.
3. **Domain step is first-class**: add explicit domain choice before mailbox creation call.
4. **Validation is standardized**: each step emits `{ok, code, message, recoverable, nextAction}`.
5. **Supervisor remains assistive**: used only for recoverable automation/form issues, not for authz.
6. **Authz policy baseline**:
   - User: create/view own mailbox workflow.
   - Admin: operational override, diagnostics, and policy controls.
   - Supervisor: technical recovery execution only.

This resolves architectural ambiguity and is sufficient to start EP-301 implementation.
