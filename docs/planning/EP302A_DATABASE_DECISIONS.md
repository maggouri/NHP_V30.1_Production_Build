# EP302A Database Decisions

## Model decisions

- Adopted **file-based domain registry** at `server_logs/mailbox-lifecycle-domains.json` (PE-02 — no DB/Oracle).
- Registry schema version `1` with object-map storage (same pattern as `mailbox-lifecycle-workflows.json`).
- Extended domain entity with `status`, `isVerified`, timestamps, and `notes` — additive to EP-301 `{ id, name, isVerified }` response contract.
- Env `NHP_MAILBOX_ALLOWED_DOMAINS` retained as **bootstrap fallback** when registry is empty (PE-09 managed-data path without breaking existing deployments).
- Logic-layer CRUD in `logic/domain-registry-model.js`; no HTTP endpoints in 302A (302B scope).
- Last-active guardrail enforced at model layer to prevent operator lockout.

## Rationale

- EP-302 goal is managed domain policy without env edits; registry file is the authoritative store once seeded.
- Fallback to env ensures zero breakage for deployments that have not migrated.
- Validation-first model mirrors EP-301A precedent — 302B can wire API with confidence.
- Pure Node.js module keeps low-spec performance; no new services or ports.

## Rejected alternatives

- **Replace env immediately in 302A API layer:**
  - Rejected — 302B owns read-path integration; 302A stays pack-isolated (PE-01).
- **SQL/Oracle persistence:**
  - Rejected — violates PE-02 and MVP out-of-scope infra constraints.
- **Array-based registry storage:**
  - Rejected — object map keyed by `id` matches workflow store and enables O(1) lookup.
- **Hard delete domains:**
  - Rejected — soft `deprecated` status preserves audit trail and avoids orphan workflow references.
- **Enable without verification by default:**
  - Rejected — journey requires explicit verify step; migration script marks env-seeded domains verified to preserve current behavior.

## Storage contract summary

| Item | Value |
|---|---|
| Path | `{rootDir}/server_logs/mailbox-lifecycle-domains.json` |
| Encoding | UTF-8 |
| Empty store | Valid — triggers env fallback |
| Migration tool | `scripts/migrations/ep302a-migrate-domain-registry.js` |
| Feature flag | `NHP_DOMAIN_REGISTRY_ENABLED` — planned for 302B/302C (not required in 302A) |
