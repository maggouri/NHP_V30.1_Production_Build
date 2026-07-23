# EP302B API Decisions

## Adopted Decisions

1. **Extend `server/mailbox-lifecycle-api.js` (not standalone server)**
   - Rationale: registry is mailbox policy source; same auth context and namespace as EP-301B.

2. **Route namespace: `/api/mailbox-lifecycle/domain-registry`**
   - Rationale: keeps domain policy under lifecycle API; matches EP-302 execution plan.

3. **Logic in `logic/domain-registry-model.js`; HTTP thin layer only (PE-10)**
   - CRUD, guardrails, and validation remain in logic module from 302A.

4. **Admin-only mutations via role === `Admin`**
   - Rationale: 302D will add explicit `MANAGE_DOMAINS` actions; 302B uses existing admin resolution.

5. **Soft delete via `deprecated` status (DELETE + PATCH action)**
   - Rationale: EP-302A rejected hard delete; preserves audit trail and workflow references.

6. **Atomic registry writes (temp + rename)**
   - Rationale: 302A deferred concurrency safety; 302B owns persistence correctness.

7. **Env fallback when registry empty or unreadable on User read path**
   - Rationale: PE-09 backward compatibility; zero breakage for unmigrated deployments.

8. **Registry authoritative when populated**
   - `buildDomainList()` and workflow domain validation use registry over env.

9. **Standard error envelope on all failure paths**
   - `{ ok, code, message, recoverable, retryable, nextAction }`

## Rejected Alternatives

1. **New standalone `domain-registry-api.js` mount**
   - Rejected: duplicates auth/middleware; lifecycle namespace is sufficient.

2. **Hard DELETE removing registry rows**
   - Rejected: conflicts with 302A audit/deprecate contract.

3. **Supervisor registry write access**
   - Rejected: EP-302 journey reserves policy mutations to Admin.

4. **Mandatory `NHP_DOMAIN_REGISTRY_ENABLED` flag for 302B**
   - Rejected: empty registry already preserves env behavior; flag deferred to 302C rollout.

5. **Automated DNS verification endpoints**
   - Rejected: out of MVP scope per EP-302 charter.

## Configuration
- `NHP_MAILBOX_ALLOWED_DOMAINS` — bootstrap fallback when registry empty
- `NHP_MAILBOX_ADMIN_USER_IDS` — admin CRUD authorization
- Registry file: `server_logs/mailbox-lifecycle-domains.json`

## GB-02 Permissions Review
**PASS** — Admin-only CRUD; User/Admin/Supervisor retain `/domains` read per EP-301 matrix.

## GB-03 Validation Review
**PASS** — Model guardrails (`DOMAIN_LAST_ACTIVE`, `DOMAIN_NOT_VERIFIED`, duplicate checks) enforced at API boundary with mapped HTTP status codes.
