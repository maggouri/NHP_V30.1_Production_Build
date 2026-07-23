# EP302A Model Review

## Current Schema (pre-302A)

- Allowed domains are **not persisted** — derived at runtime from `NHP_MAILBOX_ALLOWED_DOMAINS`.
- Default allow-list: `emailcore.app` when env is unset.
- Mailbox lifecycle model (`logic/mailbox-lifecycle-model.js`) defines domain entity shape for API responses: `{ id, name, isVerified }`.
- `isVerified` is always `true` in current `buildDomainList()` — placeholder only.
- No lifecycle states, no admin CRUD, no registry file.

## Proposed Schema (302A)

Introduced additive registry contract in `logic/domain-registry-model.js`:

### Store envelope

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | number | Fixed to `1` |
| `domains` | object map | Keyed by `domain.id` |
| `meta` | object | `createdAt`, `updatedAt`, optional migration metadata |

### Domain entity (registry)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `dom_<normalized-name>` via `buildDomainId()` |
| `name` | string | Lowercase; charset `[a-z0-9.-]+` |
| `status` | enum | `disabled` \| `enabled` \| `deprecated` |
| `isVerified` | boolean | Operator-set; required before enable |
| `notes` | string | Optional admin note |
| `createdAt` | ISO string | Set on create |
| `updatedAt` | ISO string | Updated on mutation |

### State transitions

```text
[new] → disabled (unverified)
disabled + verify → disabled (verified)
disabled (verified) → enabled
enabled → disabled
enabled → deprecated
disabled → deprecated
```

Guardrails:
- Enable requires `isVerified === true` and status ≠ `deprecated`.
- Disable/deprecate blocked when domain is the **last enabled** domain (`DOMAIN_LAST_ACTIVE`).

### Error code taxonomy (302A)

| Code | Meaning |
|---|---|
| `DOMAIN_INVALID` | Name/entity validation failed |
| `DOMAIN_DUPLICATE` | Name already in registry |
| `DOMAIN_NOT_FOUND` | Unknown domain id |
| `DOMAIN_NOT_VERIFIED` | Enable blocked — not verified |
| `DOMAIN_LAST_ACTIVE` | Cannot disable/deprecate last enabled domain |
| `DOMAIN_STATUS_INVALID` | Status transition precheck failed |
| `DOMAIN_TRANSITION_INVALID` | Illegal transition (e.g. enable deprecated) |
| `DOMAIN_REGISTRY_INVALID` | Store schema/entry validation failed |
| `DOMAIN_REGISTRY_UNAVAILABLE` | Registry file unreadable |

Existing mailbox codes reused unchanged: `DOMAIN_REQUIRED`, `DOMAIN_NOT_ALLOWED`.

## Precedence (env vs registry)

| Condition | Allow-list source | Mailbox list (`{ id, name, isVerified }`) |
|---|---|---|
| Registry empty | `NHP_MAILBOX_ALLOWED_DOMAINS` | Env domains, all `isVerified: true` (current behavior) |
| Registry populated | Enabled registry domains | Enabled **and** verified registry domains |

This preserves backward compatibility until migration seeds the registry file.

## Migration Notes

- Offline migration: `scripts/migrations/ep302a-migrate-domain-registry.js`
- Seeds from env with `enabled + isVerified` to match today's runtime behavior.
- Backs up existing registry file before overwrite.
- **No mandatory runtime migration in 302A** — API still reads env via `mailbox-lifecycle-api.js` until 302B wires registry.

## Compatibility Assessment

- **Backward compatible:** Empty registry → env fallback identical to pre-302A behavior.
- **EP-301 domain entity:** Registry entries map to `{ id, name, isVerified }` via `buildMailboxDomainList()`.
- **No API/UI changes in 302A** — logic layer only; 302B owns persistence API integration.
- **UTF-8 safe:** JSON file store with explicit `utf8` read/write.

## Risks

- Registry/env desync if operator edits env after migration — 302B must document single source of truth.
- Concurrent writes without atomic rename deferred to 302B (basic write in 302A contract).
- Rename via `updateDomain` changes map key — callers must use returned `domain.id`.
