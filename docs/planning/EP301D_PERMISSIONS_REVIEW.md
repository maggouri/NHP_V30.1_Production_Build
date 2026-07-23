# EP301D Permissions Review (GD-01)

## Scope
Permissions hardening for EP-301 mailbox lifecycle — API consolidation + UI gating. No Oracle/DB/infra changes.

## Policy Source
**Single module:** `logic/mailbox-lifecycle-permissions.js`

| Export | Purpose |
|---|---|
| `MAILBOX_LIFECYCLE_ACTIONS` | Canonical action identifiers |
| `resolveRoleFromRequest` | User / Admin / Supervisor resolution |
| `canPerformAction` | Action × role matrix |
| `getCapabilitiesForRole` | Capability map for UI session |
| `canUseMailboxLifecycleUi` | Blocks Supervisor from Creaty wizard |

API (`server/mailbox-lifecycle-api.js`) and client helpers (`mailbox-lifecycle-helpers.js` / `mailbox-lifecycle-client.js`) consume aligned policy.

## Permissions Matrix (enforced)

| Action | User | Admin | Supervisor |
|---|---|---|---|
| Create workflow / mailbox | Yes (own) | Yes | No |
| Change domain | Yes | Yes | No |
| Read workflow | Own | Cross-workflow | Read (assist) |
| Validate / connection / READY | Yes (own) | Yes | No |
| Reset workflow | Yes (own) | Yes | No |
| Recover | No | No | Yes |
| Creaty UI journey | Yes | Yes | Blocked |

Matches `EP301_DISCOVERY_REPORT.md` §2 and `EP301B_API_REVIEW.md` endpoint table.

## API Enforcement

| Endpoint | Deny roles | Evidence |
|---|---|---|
| `POST /workflows` | Supervisor | 403 `FORBIDDEN` |
| `POST .../mailbox/*` | Supervisor | 403 |
| `POST .../validate`, `connection/*`, `ready` | Supervisor | 403 |
| `POST .../recover` | User, Admin | 403 |
| `GET /workflows/:id` | User (other owner) | 403 |
| `GET /session` | Unauthenticated | 401 |

New: `GET /api/mailbox-lifecycle/session` returns `{ role, capabilities }` for UI gating.

## UI Gating

| Surface | Behavior |
|---|---|
| Role banner | Shows resolved role (User/Admin) in Arabic |
| Supervisor | Blocked panel — no journey buttons |
| Create / validate / verify / ready | Hidden when `canUiAction` false |
| Forbidden client calls | Arabic `FORBIDDEN` via `mapLifecycleError` |
| Reset workflow | Gated to User/Admin |

Files: `mailbox-lifecycle-ui.js`, `creaty.html` (role banner), `creaty.css` (banner styles).

## PE-06 Compliance
Every 301D change answered "Who is allowed?" before implementation:
1. Policy module defined matrix
2. API wired to policy
3. UI reads session capabilities
4. Tests assert deny paths

## Post-301D Recommendation
Chief Architect suggests standalone `PERMISSIONS_MATRIX.md` for cross-module authz — **deferred** (not in 301D scope).

## GD-01 Verdict
**PASS** — Matrix consistent across discovery, API, UI, and tests; no policy drift detected.
