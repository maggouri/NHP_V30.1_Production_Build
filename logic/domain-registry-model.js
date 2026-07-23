'use strict';

/**
 * EP-302A — Domain registry model, validation, and logic-layer CRUD.
 * INT-001: Legacy local mirror only — EmailCore is SSOT when NHP_DOMAIN_REGISTRY_SSOT=emailcore.
 * Storage contract (local/tests): server_logs/mailbox-lifecycle-domains.json
 * Env bootstrap: NHP_MAILBOX_ALLOWED_DOMAINS (backward compatible until migration).
 */
const fs = require('fs');
const path = require('path');
const {
    buildDomainId,
    normalizeDomainName,
    validateDomainEntity,
} = require('./mailbox-lifecycle-model.js');

const DOMAIN_REGISTRY_SCHEMA_VERSION = 1;
const DOMAIN_REGISTRY_FILENAME = 'mailbox-lifecycle-domains.json';

const DOMAIN_STATUSES = Object.freeze(['disabled', 'enabled', 'deprecated']);

const DOMAIN_REGISTRY_ERROR_CODES = Object.freeze({
    DOMAIN_INVALID: 'DOMAIN_INVALID',
    DOMAIN_DUPLICATE: 'DOMAIN_DUPLICATE',
    DOMAIN_NOT_FOUND: 'DOMAIN_NOT_FOUND',
    DOMAIN_NOT_VERIFIED: 'DOMAIN_NOT_VERIFIED',
    DOMAIN_LAST_ACTIVE: 'DOMAIN_LAST_ACTIVE',
    DOMAIN_STATUS_INVALID: 'DOMAIN_STATUS_INVALID',
    DOMAIN_TRANSITION_INVALID: 'DOMAIN_TRANSITION_INVALID',
    DOMAIN_REGISTRY_INVALID: 'DOMAIN_REGISTRY_INVALID',
    DOMAIN_REGISTRY_UNAVAILABLE: 'DOMAIN_REGISTRY_UNAVAILABLE',
});

const DEFAULT_ALLOWED_DOMAINS = Object.freeze(['emailcore.app']);

function asString(value) {
    return String(value || '').trim();
}

function nowIso() {
    return new Date().toISOString();
}

function createEmptyStore() {
    return {
        schemaVersion: DOMAIN_REGISTRY_SCHEMA_VERSION,
        domains: {},
        meta: {
            createdAt: nowIso(),
            updatedAt: nowIso(),
            source: 'empty',
        },
    };
}

function getRegistryStorePath(rootDir) {
    const logDir = path.join(rootDir, 'server_logs');
    return path.join(logDir, DOMAIN_REGISTRY_FILENAME);
}

function ensureLogDir(rootDir) {
    const logDir = path.join(rootDir, 'server_logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    return logDir;
}

function readEnvAllowedDomains(env = process.env) {
    const raw = asString(env.NHP_MAILBOX_ALLOWED_DOMAINS);
    if (!raw) return [...DEFAULT_ALLOWED_DOMAINS];
    const list = raw.split(',').map((item) => normalizeDomainName(item)).filter(Boolean);
    return list.length ? list : [...DEFAULT_ALLOWED_DOMAINS];
}

function normalizeDomainStatus(value, fallback = 'disabled') {
    const raw = asString(value).toLowerCase();
    if (DOMAIN_STATUSES.includes(raw)) return raw;
    return fallback;
}

function createDomainEntry(input = {}) {
    const name = normalizeDomainName(input.name);
    const id = asString(input.id) || buildDomainId(name);
    const ts = nowIso();
    return {
        id,
        name,
        status: normalizeDomainStatus(input.status, 'disabled'),
        isVerified: !!input.isVerified,
        notes: asString(input.notes),
        createdAt: asString(input.createdAt) || ts,
        updatedAt: asString(input.updatedAt) || ts,
    };
}

function validateDomainRegistryEntry(domain = {}) {
    const errors = [];
    const entityCheck = validateDomainEntity(domain);
    errors.push(...entityCheck.errors);

    const status = normalizeDomainStatus(domain.status, '');
    if (!status) errors.push('domain.status is required');
    else if (!DOMAIN_STATUSES.includes(status)) errors.push('domain.status is invalid');

    if (typeof domain.isVerified !== 'boolean') errors.push('domain.isVerified must be boolean');
    if (domain.notes !== undefined && typeof domain.notes !== 'string') {
        errors.push('domain.notes must be a string');
    }

    return { ok: errors.length === 0, errors };
}

function validateDomainRegistryStore(store = {}) {
    const errors = [];
    if (Number(store.schemaVersion) !== DOMAIN_REGISTRY_SCHEMA_VERSION) {
        errors.push(`schemaVersion must be ${DOMAIN_REGISTRY_SCHEMA_VERSION}`);
    }
    if (!store.domains || typeof store.domains !== 'object' || Array.isArray(store.domains)) {
        errors.push('domains must be an object map');
        return { ok: false, errors };
    }

    Object.entries(store.domains).forEach(([key, domain]) => {
        const check = validateDomainRegistryEntry(domain);
        if (!check.ok) {
            errors.push(`domains.${key}: ${check.errors.join('; ')}`);
            return;
        }
        if (key !== domain.id) {
            errors.push(`domains.${key}: key must match domain.id`);
        }
    });

    return { ok: errors.length === 0, errors };
}

function loadRegistryStore(rootDir) {
    const filePath = getRegistryStorePath(rootDir);
    if (!fs.existsSync(filePath)) return createEmptyStore();
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const check = validateDomainRegistryStore(parsed);
        if (!check.ok) {
            const err = new Error(check.errors.join('; '));
            err.code = DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_INVALID;
            throw err;
        }
        return parsed;
    } catch (err) {
        if (err.code === DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_INVALID) throw err;
        const wrap = new Error('Unable to read domain registry store');
        wrap.code = DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE;
        wrap.cause = err;
        throw wrap;
    }
}

function saveRegistryStore(rootDir, store) {
    const check = validateDomainRegistryStore(store);
    if (!check.ok) {
        const err = new Error(check.errors.join('; '));
        err.code = DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_INVALID;
        throw err;
    }
    ensureLogDir(rootDir);
    const filePath = getRegistryStorePath(rootDir);
    store.meta = {
        ...(store.meta || {}),
        updatedAt: nowIso(),
    };
    const content = `${JSON.stringify(store, null, 2)}\n`;
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
}

function listAllDomains(store) {
    return Object.values(store.domains || {}).sort((a, b) => a.name.localeCompare(b.name));
}

function findDomainById(store, id) {
    return store.domains?.[asString(id)] || null;
}

function findDomainByName(store, name) {
    const normalized = normalizeDomainName(name);
    return listAllDomains(store).find((row) => row.name === normalized) || null;
}

function countEnabledDomains(store) {
    return listAllDomains(store).filter((row) => row.status === 'enabled').length;
}

function buildStoreFromEnvDomains(env = process.env, options = {}) {
    const store = createEmptyStore();
    const markVerified = options.markVerified !== false;
    const markEnabled = options.markEnabled !== false;
    const names = readEnvAllowedDomains(env);
    const ts = nowIso();

    names.forEach((name) => {
        const entry = createDomainEntry({
            name,
            status: markEnabled ? 'enabled' : 'disabled',
            isVerified: markVerified,
            createdAt: ts,
            updatedAt: ts,
        });
        store.domains[entry.id] = entry;
    });

    store.meta = {
        ...store.meta,
        source: 'env_bootstrap',
        migratedFromEnv: true,
        envSnapshot: names.join(','),
        updatedAt: ts,
    };
    return store;
}

function registryHasDomains(store) {
    return Object.keys(store?.domains || {}).length > 0;
}

function resolveAllowedDomainNames(store, env = process.env) {
    if (registryHasDomains(store)) {
        return listAllDomains(store)
            .filter((row) => row.status === 'enabled')
            .map((row) => row.name);
    }
    return readEnvAllowedDomains(env);
}

function buildMailboxDomainList(store, env = process.env) {
    if (registryHasDomains(store)) {
        return listAllDomains(store)
            .filter((row) => row.status === 'enabled' && row.isVerified)
            .map((row) => ({
                id: row.id,
                name: row.name,
                isVerified: row.isVerified,
            }));
    }
    return readEnvAllowedDomains(env).map((name) => ({
        id: buildDomainId(name),
        name,
        isVerified: true,
    }));
}

function buildRegistryError(code, message, options = {}) {
    return {
        ok: false,
        code,
        message,
        errors: options.errors || [],
        recoverable: options.recoverable !== false,
        retryable: !!options.retryable,
        nextAction: options.nextAction || '',
    };
}

function buildRegistryOk(payload = {}) {
    return { ok: true, ...payload };
}

function canEnableDomain(domain) {
    if (!domain) return false;
    if (domain.status === 'deprecated') return false;
    return domain.isVerified === true;
}

function canDisableDomain(store, domain) {
    if (!domain || domain.status !== 'enabled') return { ok: false, code: DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_STATUS_INVALID };
    if (countEnabledDomains(store) <= 1) {
        return {
            ok: false,
            code: DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_LAST_ACTIVE,
            message: 'Cannot disable the last enabled domain',
        };
    }
    return { ok: true };
}

function addDomain(store, input = {}) {
    const name = normalizeDomainName(input.name);
    if (!name) {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_INVALID, 'Domain name is required', {
            errors: ['domain.name is required'],
            nextAction: 'fix_domain_input',
        });
    }

    if (findDomainByName(store, name)) {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_DUPLICATE, `Domain "${name}" already exists`, {
            nextAction: 'edit_existing_domain',
        });
    }

    const entry = createDomainEntry({
        name,
        notes: input.notes,
        status: input.status || 'disabled',
        isVerified: !!input.isVerified,
    });
    const check = validateDomainRegistryEntry(entry);
    if (!check.ok) {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_INVALID, check.errors.join('; '), {
            errors: check.errors,
            nextAction: 'fix_domain_input',
        });
    }

    store.domains[entry.id] = entry;
    return buildRegistryOk({ domain: entry });
}

function updateDomain(store, id, patch = {}) {
    const domain = findDomainById(store, id);
    if (!domain) {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_NOT_FOUND, 'Domain not found', {
            recoverable: false,
            nextAction: 'refresh_registry',
        });
    }

    const next = {
        ...domain,
        notes: patch.notes !== undefined ? asString(patch.notes) : domain.notes,
        updatedAt: nowIso(),
    };

    if (patch.name !== undefined) {
        const name = normalizeDomainName(patch.name);
        const duplicate = findDomainByName(store, name);
        if (duplicate && duplicate.id !== domain.id) {
            return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_DUPLICATE, `Domain "${name}" already exists`, {
                nextAction: 'edit_existing_domain',
            });
        }
        next.name = name;
        next.id = buildDomainId(name);
    }

    const check = validateDomainRegistryEntry(next);
    if (!check.ok) {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_INVALID, check.errors.join('; '), {
            errors: check.errors,
            nextAction: 'fix_domain_input',
        });
    }

    if (next.id !== domain.id) {
        delete store.domains[domain.id];
    }
    store.domains[next.id] = next;
    return buildRegistryOk({ domain: next });
}

function setDomainVerified(store, id, isVerified = true) {
    const domain = findDomainById(store, id);
    if (!domain) {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_NOT_FOUND, 'Domain not found', {
            recoverable: false,
            nextAction: 'refresh_registry',
        });
    }
    if (domain.status === 'deprecated') {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_TRANSITION_INVALID, 'Cannot verify a deprecated domain', {
            nextAction: 'restore_or_add_domain',
        });
    }

    domain.isVerified = !!isVerified;
    domain.updatedAt = nowIso();
    store.domains[domain.id] = domain;
    return buildRegistryOk({ domain });
}

function enableDomain(store, id) {
    const domain = findDomainById(store, id);
    if (!domain) {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_NOT_FOUND, 'Domain not found', {
            recoverable: false,
            nextAction: 'refresh_registry',
        });
    }
    if (!canEnableDomain(domain)) {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_NOT_VERIFIED, 'Domain must be verified before enable', {
            nextAction: 'complete_verification',
        });
    }
    if (domain.status === 'deprecated') {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_TRANSITION_INVALID, 'Cannot enable a deprecated domain', {
            nextAction: 'restore_or_add_domain',
        });
    }

    domain.status = 'enabled';
    domain.updatedAt = nowIso();
    store.domains[domain.id] = domain;
    return buildRegistryOk({ domain });
}

function disableDomain(store, id) {
    const domain = findDomainById(store, id);
    if (!domain) {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_NOT_FOUND, 'Domain not found', {
            recoverable: false,
            nextAction: 'refresh_registry',
        });
    }
    const guard = canDisableDomain(store, domain);
    if (!guard.ok) {
        return buildRegistryError(guard.code, guard.message || 'Cannot disable domain', {
            nextAction: 'enable_another_domain_first',
        });
    }

    domain.status = 'disabled';
    domain.updatedAt = nowIso();
    store.domains[domain.id] = domain;
    return buildRegistryOk({ domain });
}

function deprecateDomain(store, id) {
    const domain = findDomainById(store, id);
    if (!domain) {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_NOT_FOUND, 'Domain not found', {
            recoverable: false,
            nextAction: 'refresh_registry',
        });
    }
    if (domain.status === 'enabled') {
        const guard = canDisableDomain(store, domain);
        if (!guard.ok) {
            return buildRegistryError(guard.code, guard.message || 'Cannot deprecate the last enabled domain', {
                nextAction: 'enable_another_domain_first',
            });
        }
    }

    domain.status = 'deprecated';
    domain.updatedAt = nowIso();
    store.domains[domain.id] = domain;
    return buildRegistryOk({ domain });
}

function validateDomainChoiceAgainstRegistry(store, domainName, env = process.env) {
    const normalized = normalizeDomainName(domainName);
    if (!normalized) {
        return buildRegistryError('DOMAIN_REQUIRED', 'Domain selection is required', {
            recoverable: true,
            nextAction: 'choose_domain',
        });
    }

    const allowed = resolveAllowedDomainNames(store, env);
    if (!allowed.includes(normalized)) {
        return buildRegistryError('DOMAIN_NOT_ALLOWED', `Domain "${normalized}" is not allowed`, {
            recoverable: true,
            nextAction: 'choose_allowed_domain',
        });
    }

    const entity = { id: buildDomainId(normalized), name: normalized, isVerified: true };
    const check = validateDomainEntity(entity);
    if (!check.ok) {
        return buildRegistryError(DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_INVALID, check.errors.join('; '), {
            nextAction: 'fix_domain_input',
        });
    }
    return null;
}

module.exports = {
    DOMAIN_REGISTRY_SCHEMA_VERSION,
    DOMAIN_REGISTRY_FILENAME,
    DOMAIN_STATUSES,
    DOMAIN_REGISTRY_ERROR_CODES,
    DEFAULT_ALLOWED_DOMAINS,
    asString,
    createEmptyStore,
    getRegistryStorePath,
    readEnvAllowedDomains,
    normalizeDomainStatus,
    createDomainEntry,
    validateDomainRegistryEntry,
    validateDomainRegistryStore,
    loadRegistryStore,
    saveRegistryStore,
    listAllDomains,
    findDomainById,
    findDomainByName,
    countEnabledDomains,
    buildStoreFromEnvDomains,
    registryHasDomains,
    resolveAllowedDomainNames,
    buildMailboxDomainList,
    canEnableDomain,
    canDisableDomain,
    addDomain,
    updateDomain,
    setDomainVerified,
    enableDomain,
    disableDomain,
    deprecateDomain,
    validateDomainChoiceAgainstRegistry,
    buildRegistryError,
    buildRegistryOk,
};
