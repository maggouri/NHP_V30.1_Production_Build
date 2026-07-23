# EP301A Database Decisions

## Model decisions
- Adopted an additive schema contract (`schemaVersion = 2`) without replacing existing storage.
- Introduced explicit `domain` entity instead of domain-by-convention.
- Introduced explicit `mailbox` entity with canonical id/session fields and normalized status.
- Enforced relation integrity: mailbox email domain must match linked domain entity.
- Preserved legacy ids in a dedicated compatibility block to prevent data-loss during transition.

## Rationale
- EP301B requires deterministic Domain -> Mailbox lifecycle; implicit fields are not enough for reliable orchestration.
- Additive model avoids runtime breakage and keeps PE-01/PE-02 constraints (single pack to deployable state).
- Validation-first approach reduces hidden data quality issues before business orchestration is expanded.
- Lightweight pure-JS model keeps performance suitable for low-spec environments and avoids infra changes.

## Rejected alternatives
- Full storage rewrite in EP301A:
  - Rejected due to risk and scope breach (would introduce operational migration coupling).
- Introducing SQL/ORM migration stack:
  - Rejected because current persistence model is extension/local + API payload blend and EP301A forbids infra-level redesign.
- Enforcing hard-failure on unknown legacy statuses:
  - Rejected to preserve backward compatibility with mixed historical phase values.
