# EP-301 Pack Breakdown

## 301A - Discovery Freeze and Workflow Contract
- **Objective**: Freeze EP-301 functional contract and step transition rules.
- **Dependencies**: Existing Creaty journey and auth/session behavior.
- **Files (planned touch)**:
  - `docs/planning/EP301_DISCOVERY_REPORT.md`
  - `docs/planning/EP301_USER_JOURNEY.md`
  - `docs/planning/EP301_EXECUTION_PLAN.md`
  - `docs/planning/EP301_PACK_BREAKDOWN.md`
- **Complexity**: Low.
- **Deliverables**:
  - Approved journey contract.
  - Step state model with transition guards.
  - Error taxonomy and validation envelope definition.

## 301B - Domain and Mailbox Provisioning Orchestration
- **Objective**: Implement explicit Domain -> Mailbox provisioning flow on top of existing APIs.
- **Dependencies**:
  - 301A approved contracts.
  - Existing EmailCore generate/manual create endpoints.
- **Files (expected implementation area)**:
  - `modules/creaty/creaty.html`
  - `modules/creaty/creaty.js`
  - `modules/creaty/emailcore-library.js`
- **Complexity**: Medium.
- **Deliverables**:
  - Domain selection step.
  - Mailbox create actions bound to selected domain.
  - Step-level validation responses.

## 301C - Validation, Connection Settings, and Ready State
- **Objective**: Standardize post-create validation and connection verification to produce Ready.
- **Dependencies**:
  - 301B provisioning output (mailbox/session identifiers).
  - Existing session/pipeline lookups.
- **Files (expected implementation area)**:
  - `modules/creaty/creaty.js`
  - `modules/creaty/emailcore-library.js`
  - `creaty-handlers.js` (only if additive API refinement is required)
- **Complexity**: Medium-High.
- **Deliverables**:
  - Validation contract (`ok/code/message/recoverable/retryable/nextAction`).
  - Connection verification step.
  - Deterministic final `READY` state logic.

## 301D - Permissions and Operational Controls Hardening
- **Objective**: Enforce clear User/Admin/Supervisor responsibilities for EP-301 actions.
- **Dependencies**:
  - 301A matrix and policy decisions.
  - Existing auth/admin and supervisor bridge logic.
- **Files (expected implementation area)**:
  - `modules/auth.js`
  - `modules/admin/admin.js`
  - `modules/creaty/creaty.js`
  - `server/nhp-ai-supervisor.js` (if policy checks are required in execution endpoints)
- **Complexity**: High.
- **Deliverables**:
  - Consolidated authorization checks for EP-301 actions.
  - Clear UI gating per role.
  - Supervisor constrained to assistive recovery only.

## 301E - Stabilization, Regression, and Gate Certification
- **Objective**: Validate EP-301 through gates GV-01..GV-04 and finalize release readiness.
- **Dependencies**:
  - 301B-301D complete.
  - Test data/accounts and controlled environment.
- **Files (expected implementation/test area)**:
  - `modules/creaty/creaty.js`
  - `creaty-handlers.js`
  - `server/nhp-ai-supervisor.js`
  - test scripts/checklists under project QA process
- **Complexity**: Medium.
- **Deliverables**:
  - Gate evidence:
    - GV-01 UX pass
    - GV-02 Functional pass
    - GV-03 Regression pass
    - GV-04 Product acceptance sign-off
  - Final "ready for implementation completion" decision package.

## Dependency Chain
- `301A -> 301B -> 301C -> 301D -> 301E`
- Parallelism allowance:
  - 301D can start partially after 301B contract-stable milestones, but final sign-off requires 301C.

## Complexity Rationale
- Highest risk/complexity sits in 301C/301D due to cross-layer consistency (UI/background/handler/authz) and state correctness under retries/queues.
