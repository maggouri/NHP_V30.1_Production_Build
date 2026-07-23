'use strict';

const MAILBOX_SCHEMA_VERSION = 2;

const MAILBOX_STATUSES = new Set([
    'PENDING',
    'CREATED',
    'VALIDATING',
    'ACTIVE',
    'FAILED',
    'ARCHIVED',
]);

function asString(value) {
    return String(value || '').trim();
}

function normalizeStatus(value) {
    const raw = asString(value).toUpperCase();
    if (MAILBOX_STATUSES.has(raw)) return raw;
    if (!raw) return 'PENDING';
    if (raw === 'DONE') return 'ACTIVE';
    if (raw === 'ERROR' || raw === 'SKIPPED') return 'FAILED';
    return 'PENDING';
}

function normalizeDomainName(value) {
    return asString(value).toLowerCase();
}

function buildDomainId(domainName) {
    const clean = normalizeDomainName(domainName).replace(/[^a-z0-9.-]/g, '');
    return clean ? `dom_${clean}` : '';
}

function extractDomainFromEmail(email) {
    const normalized = asString(email).toLowerCase();
    const parts = normalized.split('@');
    return parts.length === 2 ? parts[1] : '';
}

function normalizeLegacyMailboxRecord(record = {}) {
    const mailboxAddress = asString(
        record.mailboxAddress
        || record.email
        || record.display_email
        || record.mailbox
    ).toLowerCase();
    const domainName = normalizeDomainName(
        record.domain
        || record.domainName
        || extractDomainFromEmail(mailboxAddress)
    );
    const domainId = asString(record.domainId) || buildDomainId(domainName);
    const mailboxId = asString(record.mailboxId || record.id || record.sessionId || record.emailcoreSessionId);
    const status = normalizeStatus(record.status || record.creaty_phase || record.teepublic_status);
    const createdAt = asString(record.createdAt || record.created_at || record.registeredAt);
    const updatedAt = asString(record.updatedAt || record.updated_at || createdAt);

    return {
        schemaVersion: MAILBOX_SCHEMA_VERSION,
        domain: {
            id: domainId,
            name: domainName,
            isVerified: !!record.domainVerified,
        },
        mailbox: {
            id: mailboxId || mailboxAddress,
            address: mailboxAddress,
            status,
            provider: asString(record.provider || 'emailcore'),
            sessionId: asString(record.sessionId || record.id || record.emailcoreSessionId || mailboxId),
            inboxToken: asString(record.inboxToken),
            createdAt: createdAt || new Date(0).toISOString(),
            updatedAt: updatedAt || createdAt || new Date(0).toISOString(),
        },
        legacy: {
            id: asString(record.id),
            sessionId: asString(record.sessionId),
            emailcoreSessionId: asString(record.emailcoreSessionId),
        },
    };
}

function validateDomainEntity(domain = {}) {
    const errors = [];
    const id = asString(domain.id);
    const name = normalizeDomainName(domain.name);

    if (!id) errors.push('domain.id is required');
    if (!name) errors.push('domain.name is required');
    if (name && !/^[a-z0-9.-]+$/.test(name)) errors.push('domain.name has invalid characters');

    return { ok: errors.length === 0, errors };
}

function validateMailboxEntity(mailbox = {}) {
    const errors = [];
    const id = asString(mailbox.id);
    const address = asString(mailbox.address).toLowerCase();
    const status = normalizeStatus(mailbox.status);

    if (!id) errors.push('mailbox.id is required');
    if (!address) errors.push('mailbox.address is required');
    if (address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) errors.push('mailbox.address is invalid');
    if (!MAILBOX_STATUSES.has(status)) errors.push('mailbox.status is invalid');

    return { ok: errors.length === 0, errors };
}

function validateMailboxLifecycleRecord(record = {}) {
    const errors = [];
    if (Number(record.schemaVersion) !== MAILBOX_SCHEMA_VERSION) {
        errors.push(`schemaVersion must be ${MAILBOX_SCHEMA_VERSION}`);
    }

    const domainResult = validateDomainEntity(record.domain || {});
    const mailboxResult = validateMailboxEntity(record.mailbox || {});
    errors.push(...domainResult.errors, ...mailboxResult.errors);

    const domainName = normalizeDomainName(record?.domain?.name);
    const mailboxDomain = extractDomainFromEmail(record?.mailbox?.address);
    if (domainName && mailboxDomain && domainName !== mailboxDomain) {
        errors.push('mailbox.address domain must match domain.name');
    }

    return { ok: errors.length === 0, errors };
}

module.exports = {
    MAILBOX_SCHEMA_VERSION,
    MAILBOX_STATUSES,
    normalizeDomainName,
    buildDomainId,
    normalizeLegacyMailboxRecord,
    validateDomainEntity,
    validateMailboxEntity,
    validateMailboxLifecycleRecord,
};
