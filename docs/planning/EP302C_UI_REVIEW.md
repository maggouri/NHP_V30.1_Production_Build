# EP302C UI Review

## Scope (AR-09 Option A — updated 2026-07-07)

**Primary:** EmailCore Web Admin — full «إدارة النطاقات» / Domain Management panel  
**Secondary:** Creaty Column 2 — Quick Access only (preview + link to web admin)

Thin client wired to EP-302B public APIs on Creaty server (`:3020`).

## Screen Flow

### Web Admin (primary — PE-05 gate)

```
EmailCore login (admin) → Sidebar «إدارة النطاقات» → #domain-registry → List → Add/Edit → Verify → Enable/Disable → Deprecate
```

| Surface | Element | Primary action |
|---|---|---|
| **Sidebar** | `#domainRegistryNavLink` | Admin only — alongside Mail Monitor, Send Mail |
| Route | `#domain-registry` | Full CRUD via `domain-registry.js` |
| List | `#dreg-list` | `GET /api/mailbox-lifecycle/domain-registry` |
| Add/Edit | `#dreg-form-panel` | `POST` / `PATCH` |
| Row actions | verify / enable / disable | `PATCH` with `action` |
| Deprecate | delete button | `DELETE` |
| Auth bridge | `/api/admin/creaty/extension-token` | Issues Creaty token for `:3020` calls |

### Creaty Quick Access (secondary)

```
Credentials → Session role → Admin sidebar «إدارة النطاقات» → Preview count → «فتح في لوحة الإدارة»
```

| Surface | Element | Action |
|---|---|---|
| Admin sidebar | `#creaty-admin-nav-domain-registry` | Opens quick access panel (Admin only) |
| Quick access | `#creaty-dreg-open-admin` | Opens `emailcore.app/admin#domain-registry` |
| Preview | read-only GET | Session + domain count only — **no CRUD** |

## UX Decisions

### AR-09 Single Source of Administration
- **Decision**: Full admin UI on EmailCore Web Admin; Creaty is Quick Access only.
- **Rationale**: Resolves `EP302C_SCOPE_LEAK_CONFIRMED`; PE-05 expects unified web admin sidebar.

### Web admin placement (after Send Mail)
- **Decision**: `#domainRegistryNavLink` in hosted admin sidebar, Admin-gated.
- **Rationale**: Matches Email Library / Mail Monitor / Send Mail operator journey.

### Creaty Quick Access (no duplicate CRUD)
- **Decision**: Creaty panel shows preview + external link; removed form/table/actions.
- **Rationale**: AR-09 — avoid dual admin surfaces and extension contamination.

### Thin client (PE-11/PE-12)
- **Decision**: Both surfaces use public REST only; web admin gets token via existing `/creaty/extension-token` bridge.
- **Rationale**: Same APIs as EP-302B; no model/file bypass.

### Error envelope (PE-04)
- **Decision**: Arabic messages in both web admin i18n and Creaty helpers.
- **Rationale**: Consistent product copy across surfaces.

## Files Touched

### EmailCore Web Admin
- `.tmp/emailcore-ref/public/admin/index.html`
- `.tmp/emailcore-ref/public/admin/js/admin.js`
- `.tmp/emailcore-ref/public/admin/js/domain-registry.js`
- `.tmp/emailcore-ref/public/admin/js/domain-registry-helpers.js`
- `.tmp/emailcore-ref/public/admin/css/domain-registry.css`
- `.tmp/emailcore-ref/public/admin/js/i18n.js`

### Creaty Quick Access
- `modules/creaty/domain-registry-ui.js` — simplified to Quick Access
- `modules/creaty/creaty.html` — quick access copy
- `modules/creaty/creaty.css` — `.creaty-dreg-quick__*`

### Documentation
- `Developer_Vault/03_ARCHITECTURE_DECISIONS/AR-09.md`
- `docs/planning/EP302C_OPTION_A_IMPLEMENTATION.md`

## Decision
**EP302C_WEB_UI_FIXED** — Web admin primary surface implemented; Creaty Quick Access only. **PE-05 retest required** on `emailcore.app/admin#domain-registry`. EP-302C remains OPEN until PE-05 PASS. EP-302D not started.
