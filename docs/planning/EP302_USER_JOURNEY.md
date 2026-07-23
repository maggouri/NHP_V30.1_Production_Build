# EP-302 User Journey — Domain Management

**Journey target (Admin):**  
`Login → Domain Registry → Review Domains → Add/Configure Domain → Verify Policy → Enable → Available in Mailbox Journey`

**Downstream effect (User — mailbox journey):**  
Enabled domains appear in EP-301 Step 2 «اختيار النطاق» without operator env edits.

**Baseline:** `a507d308`  
**Status:** Planning — AUTHORIZED FOR PLANNING REVIEW  
**Quality closure:** AR-08 → `QUALITY_TEMPLATE_REUSABLE.md` (EP-302E)

---

## Journey Actors

| Actor | Primary journey |
|---|---|
| **Admin** | Full Domain Management journey (this document) |
| **User** | Consumes enabled domains in mailbox wizard (EP-301 Step 2) |
| **Supervisor** | No domain policy authority; assistive recovery only if UI stuck |

---

## Step 1: Login

- **Goal:** Authenticate as Admin with domain-management capabilities.
- **Backend action:** Resolve session via existing auth; confirm Admin role (`NHP_MAILBOX_ADMIN_USER_IDS` or equivalent).
- **Validation:**
  - Credentials present and valid.
  - Role resolves to `Admin`.
  - Capabilities include domain registry access (future: `MANAGE_DOMAINS`).
- **Error handling:**
  - Missing credentials → inline Arabic prompt.
  - Non-admin → «لا تملك صلاحية إدارة النطاقات» with link to mailbox journey.
  - Auth service unavailable → retry banner.
- **Success state:** Admin context established; Domain Registry entry unlocked.

---

## Step 2: Domain Registry

- **Goal:** Present authoritative list of configured domains and their status.
- **Backend action:** Load domain registry (file store); merge bootstrap from env if empty.
- **Validation:**
  - Registry readable and schema-valid.
  - At least zero rows allowed (empty registry shows guided empty state).
- **Error handling:**
  - Registry read failure → recoverable error + retry.
  - Schema mismatch → admin diagnostic message (no internal stack traces).
- **Success state:** Admin sees table/cards: name, status (enabled/disabled/deprecated), verified flag, last updated.

**Arabic UI label:** «سجل النطاقات»

---

## Step 3: Review Domains

- **Goal:** Inspect existing domain policy before making changes.
- **Backend action:** Optional filter/sort by status; show count of mailboxes/workflows using domain (future enhancement — planning note only).
- **Validation:**
  - Selected domain exists in registry when drilling into detail.
- **Error handling:**
  - Stale view → refresh action.
- **Success state:** Admin understands current allow-list that feeds mailbox journey.

---

## Step 4: Add / Configure Domain

- **Goal:** Register a new domain or edit metadata (notes, display order).
- **Backend action:**
  - `POST` add domain with normalized name (`normalizeDomainName`).
  - Validate uniqueness and character rules (`validateDomainEntity`).
  - Default new domain to `disabled` until explicit enable (safe default).
- **Validation:**
  - Domain name non-empty, lowercase, valid charset.
  - Not duplicate of existing registry entry.
  - Admin role confirmed on mutation.
- **Error handling:**
  - `DOMAIN_INVALID` → field-level Arabic feedback.
  - `DOMAIN_DUPLICATE` → suggest edit existing entry.
  - Forbidden → re-login guidance.
- **Success state:** Domain row created/updated in registry; shown in admin list.

**Arabic UI labels:** «إضافة نطاق» / «تعديل النطاق»

---

## Step 5: Verify Policy

- **Goal:** Confirm domain is acceptable for mailbox provisioning before enable.
- **Backend action (MVP slice):**
  - Operator toggles `isVerified` after manual checklist (no automated DNS in MVP).
  - Optional note field for verification evidence reference.
- **Validation:**
  - Domain entity passes model validation.
  - Verification cannot be skipped if policy requires verified-only enable (configurable gate — default: verified required to enable).
- **Error handling:**
  - Attempt to enable unverified domain → `DOMAIN_NOT_VERIFIED` with next action «أكمل التحقق أولاً».
- **Success state:** Domain marked verified; eligible for enable step.

**Planning note:** Automated DNS/Resend verification deferred to v1.1+ (see `MVP_v1_0_OUT_OF_SCOPE.md` infra exclusions).

---

## Step 6: Enable Domain

- **Goal:** Make domain available to Users in mailbox journey selector.
- **Backend action:**
  - Set domain status → `enabled`.
  - Persist registry; invalidate in-memory cache if used.
- **Validation:**
  - Domain verified (per policy).
  - Not deprecated.
  - At least one domain remains enabled if disabling others (guardrail).
- **Error handling:**
  - Enable blocked → clear Arabic reason + suggested fix.
  - Concurrent edit → refresh and retry.
- **Success state:** Domain status `enabled`; appears in `GET /api/mailbox-lifecycle/domains` for User/Admin.

---

## Step 7: Available in Mailbox Journey

- **Goal:** Prove downstream EP-301 integration — User can select newly enabled domain.
- **Backend action:**
  - Mailbox lifecycle domain list reads from registry.
  - User workflow `validateDomainChoice()` accepts enabled domain.
- **Validation:**
  - E2E: Admin enables domain → User opens «إعداد البريد» → domain in `<select>`.
  - Disabled domains absent from user list.
- **Error handling:**
  - Domain disappeared mid-journey → `DOMAIN_NOT_ALLOWED` with refresh guidance (existing EP-301 behavior).
- **Success state:** **Domain Management journey complete** — policy change live without env restart.

**Cross-journey marker:** `DOMAIN_POLICY_ACTIVE`

---

## Cross-step error model (EP-302 standard)

Reuses EP-301 envelope — no new shape:

```json
{
  "ok": false,
  "code": "DOMAIN_NOT_VERIFIED",
  "message": "النطاق غير مُتحقق بعد",
  "recoverable": true,
  "retryable": false,
  "nextAction": "complete_verification"
}
```

### New stable codes (proposed)

| Code | Meaning |
|---|---|
| `DOMAIN_DUPLICATE` | Registry already contains domain |
| `DOMAIN_NOT_VERIFIED` | Enable blocked — verification incomplete |
| `DOMAIN_LAST_ACTIVE` | Cannot disable last enabled domain |
| `DOMAIN_REGISTRY_UNAVAILABLE` | Registry read/write failure |
| `FORBIDDEN` | Non-admin mutation attempt |

Existing codes reused: `DOMAIN_REQUIRED`, `DOMAIN_NOT_ALLOWED`, `DOMAIN_INVALID`, `AUTH_REQUIRED`, `AUTH_INVALID`.

---

## Success Criteria (journey-level)

1. Admin completes Steps 1–7 without env var edit or server restart.
2. User mailbox journey reflects registry within same Creaty server session.
3. All steps emit standard error envelope; Arabic user-facing messages (PE-04).
4. Role matrix enforced: User read/select only; Admin mutate; Supervisor no policy access.
5. EP-302E closes per AR-08 Quality Template with declaration: **`DOMAIN MANAGEMENT v1.0 — COMPLETE`**.

---

## Out of Journey Scope (explicit)

- DNS/Caddy/Render automated verification
- Multi-tenant domain ownership per user
- Bulk domain import from CSV
- EmailCore provider domain provisioning API changes

These remain deferred per MVP out-of-scope and EP-302 execution plan non-goals.
