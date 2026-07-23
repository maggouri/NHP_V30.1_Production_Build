# EP301A Model Review

## Current Schema
- Persistence source for mailbox/session flow is currently flat account/session rows (primarily `ap_accounts_teepublic` / `ap_accounts`) plus EmailCore session API payloads.
- Effective mailbox identity is inferred from mixed fields: `email`, `display_email`, `mailbox`, `id`, `sessionId`, `emailcoreSessionId`.
- Domain relation is implicit (derived from mailbox email), not represented as an explicit entity.
- Workflow state is phase/status-driven with mixed legacy values (`PENDING`, `OPENING`, `WAIT_EMAIL`, `DONE`, `ERROR`, `SKIPPED`, etc.).

## Proposed Schema
- Introduced additive, backward-compatible model contract in `logic/mailbox-lifecycle-model.js`:
  - `schemaVersion` (fixed to `2`)
  - `domain` entity: `id`, `name`, `isVerified`
  - `mailbox` entity: `id`, `address`, `status`, `provider`, `sessionId`, `inboxToken`, `createdAt`, `updatedAt`
  - `legacy` block to preserve legacy ids during transition (`id`, `sessionId`, `emailcoreSessionId`)
- Added explicit relation/constraint checks:
  - `mailbox.address` domain must equal `domain.name`
  - required ids and valid mailbox email format
  - normalized mailbox status enum (`PENDING`, `CREATED`, `VALIDATING`, `ACTIVE`, `FAILED`, `ARCHIVED`)

## Migration Notes
- Runtime migration is **not mandatory** for EP301A (no breaking storage/key rename introduced).
- Optional offline migration script prepared:
  - `scripts/migrations/ep301a-migrate-mailbox-lifecycle.js`
  - Converts flat legacy rows (JSON) to schema v2 records.
  - Invalid rows are rejected with indexed error details.
- Impact:
  - Zero impact to live routes/endpoints in this pack.
  - Enables safe data-shape hardening before EP301B orchestration.

## Compatibility Assessment
- Backward compatibility preserved:
  - Legacy field sources remain accepted during normalization.
  - Legacy phase values are mapped to safe statuses (e.g. `DONE -> ACTIVE`, `ERROR/SKIPPED -> FAILED`).
  - No change to existing API routes, no storage key deletion, no field removal.
- Forward compatibility improved:
  - explicit domain/mailbox relation enables deterministic Domain -> Mailbox lifecycle checks required by EP301B.

## Risks
- Existing payload variability across environments may still include edge-case fields not observed in current samples.
- Offline migration tool requires valid JSON input export (manual operational step).
- If external providers introduce new status values, mapper defaults to `PENDING`; requires controlled update to avoid silent semantic drift.
