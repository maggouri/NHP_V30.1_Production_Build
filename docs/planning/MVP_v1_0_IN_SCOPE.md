# MVP v1.0 In Scope

## Scope Statement
MVP v1.0 focuses on shipping one complete, deterministic mailbox onboarding journey with clear user value and production-safe boundaries aligned to the current frozen baseline.

## Included Items

### 1) Deterministic Mailbox Journey (Login -> Ready)
- **objective**: Deliver a full end-to-end mailbox onboarding flow that reaches a clear `Ready` outcome.
- **target user**: Primary end users creating operational mailboxes through Creaty.
- **inclusion rationale**: This is the core product promise validated in EP-301 and required to ship a complete user story in v1.0.

### 2) Explicit Domain Selection Before Provisioning
- **objective**: Require domain choice as a first-class step before mailbox creation.
- **target user**: End users who must create domain-bound mailboxes with fewer setup mistakes.
- **inclusion rationale**: Domain selection is a key contract element from EP-301 and prevents ambiguous mailbox provisioning paths.

### 3) Standard Validation and Error Envelope
- **objective**: Normalize validation outputs (`ok/code/message/recoverable/retryable/nextAction`) across journey steps.
- **target user**: End users and operators who need predictable guidance when failures occur.
- **inclusion rationale**: Consistent validation behavior is required for reliability, supportability, and gate certification.

### 4) Connection Settings Verification and Final Ready State
- **objective**: Confirm connection settings and only mark completion when usability is proven.
- **target user**: End users who need confidence that created mailboxes are immediately usable.
- **inclusion rationale**: The journey is incomplete without verified connectivity and an explicit readiness signal.

### 5) Role-Aware Guardrails (User/Admin/Supervisor)
- **objective**: Enforce clear boundaries so only authorized actions are allowed per role.
- **target user**: Users, admins, and supervisors operating shared operational workflows.
- **inclusion rationale**: Role clarity reduces misuse risk and aligns with EP-301 policy hardening requirements.

### 6) Low-Spec Friendly UX Behavior
- **objective**: Keep journey interactions lightweight and responsive on weak hardware.
- **target user**: Users running on low-resource machines.
- **inclusion rationale**: Performance stability on constrained devices is a quality requirement for broad adoption.
