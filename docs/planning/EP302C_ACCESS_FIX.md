# EP-302C — Access Fix Report (EP-302C_REQUIRES_REVIEW)

**Date:** 2026-07-07  
**Issue:** Domain Management not reachable from Admin navigation during PE-05 validation  
**Status:** Fixed in Creaty Admin sidebar — ready for PE-05 retest

---

## 1) Was EP-302C implemented?

**YES** — full admin UI exists in Creaty Column 2:

| Artifact | Location |
|---|---|
| Panel shell | `modules/creaty/creaty.html` → `#creaty-col2-panel-domain-registry` |
| Controller | `modules/creaty/domain-registry-ui.js` |
| Helpers | `modules/creaty/domain-registry-helpers.js` |
| Tab routing | `modules/creaty/creaty.js` → `switchCol2Tab('domain-registry')` |
| Styles | `modules/creaty/creaty.css` → `.creaty-dreg-*` |

Implementation was **functionally complete** but **not discoverable** in the Admin navigation surface the operator uses.

---

## 2) Route / path to reach Domain Management

### Before fix (hidden)

- **Extension:** NHP popup → **CREATY** tab → Column 2 → tab `#creaty-col2-tab-domain-registry` (HTML `hidden`, shown only after Admin session resolve)
- **No entry** in Admin sidebar the user expects (Email Library / Mail Monitor / Send Mail tree)
- **Deep link:** none

### After fix (discoverable)

| Surface | Path |
|---|---|
| **Primary (Admin sidebar in Creaty)** | NHP popup → **CREATY** → Admin sidebar → **«إدارة النطاقات»** |
| **Col2 tab (Admin only)** | Same panel via `#creaty-col2-tab-domain-registry` (still Admin-gated) |
| **Deep link** | `?col2=domain-registry` or `#domain-registry` on Creaty panel load |
| **API base** | Thin client → `http://127.0.0.1:3020/api/mailbox-lifecycle/domain-registry*` (PE-11/PE-12) |

**Activation prerequisites:** Email Library credentials saved + Creaty Server running + userId in `NHP_MAILBOX_ADMIN_USER_IDS` (Admin role).

---

## 3) Gap analysis — Creaty tab vs EmailCore Admin sidebar

| Expectation (PE-05 operator) | EP-302C original placement | Gap |
|---|---|---|
| Admin sidebar: Email Library, Mail Monitor, Send Mail, **Domain Management** | Hidden col2 tab inside Creaty extension only | **Navigation mismatch** — no sidebar entry |
| Hosted EmailCore admin (`emailcore.app/admin`) | UI not in `.tmp/emailcore-ref/public/admin/` | Hosted admin is separate deploy; domain APIs live on **Creaty server :3020**, not EmailCore `/api/admin` |
| Discoverable without knowing internal tab IDs | Tab `hidden` until async session | **Discoverability failure** |
| Admin role gating | `canManageDomainRegistry()` + API 403 | OK — preserved |

### Root cause

EP-302C placed «إدارة النطاقات» as a **hidden Creaty col2 tab** instead of wiring it into the **Admin navigation shell** (sidebar) that operators use alongside Email Library. PE-05 Chief Architect validated Email Library from the admin workflow but had no visible path to Domain Management.

### Fix applied (this pack)

1. Added **`creaty-admin-sidebar`** in `creaty.html` with Admin section:
   - Email Library → `store`
   - إعداد البريد → `mailbox-setup`
   - **إدارة النطاقات** → `domain-registry` (Admin only, same gating as tab)
   - قائمة الحسابات → `dashboard`
2. **`syncAdminSidebarNav()`** in `creaty.js` keeps sidebar highlight in sync with active panel.
3. **`syncDomainRegistryAccess()`** in `domain-registry-ui.js` — refreshes Admin nav visibility after Email Library credential save.
4. **Deep link** support: `?col2=domain-registry`, `#domain-registry`.

### Hosted EmailCore admin note

The reference EmailCore admin shell (`.tmp/emailcore-ref/public/admin/index.html`) remains unchanged in this repo — domain registry APIs are mounted on **Creaty server**, not EmailCore server. Operators using **NHP extension CREATY** now have the correct Admin sidebar. A future pack may add a hosted-admin bridge if emailcore.app must expose the same route natively.

---

## 4) Files changed (access fix)

- `modules/creaty/creaty.html` — Admin sidebar nav
- `modules/creaty/creaty.css` — `.creaty-admin-sidebar*` styles
- `modules/creaty/creaty.js` — sidebar wiring, deep link, i18n
- `modules/creaty/domain-registry-ui.js` — nav visibility + `syncDomainRegistryAccess`
- `modules/creaty/emailcore-library.js` — refresh domain access after credential save
- `scripts/tests/ep302c-domain-admin-ui.test.js` — sidebar/nav assertions

---

## Decision

**EP302C_READY_FOR_PE05_RETEST** — Domain Management is now reachable from the Creaty Admin sidebar with Admin role gating and PE-11/PE-12 API client unchanged.
