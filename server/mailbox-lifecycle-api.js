'use strict';

/**
 * EP-301B — Mailbox Lifecycle REST API
 * Mounted on creaty-server: /api/mailbox-lifecycle/*
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
    MAILBOX_SCHEMA_VERSION,
    buildDomainId,
    normalizeDomainName,
    normalizeLegacyMailboxRecord,
    validateDomainEntity,
    validateMailboxEntity,
    validateMailboxLifecycleRecord,
} = require('../logic/mailbox-lifecycle-model.js');
const {
    resolveRoleFromRequest,
    canAccessWorkflow,
    canMutateWorkflow,
    canRecoverWorkflow,
    getCapabilitiesForRole,
} = require('../logic/mailbox-lifecycle-permissions.js');
const {
    DOMAIN_REGISTRY_ERROR_CODES,
    loadRegistryStore,
    saveRegistryStore,
    createEmptyStore,
    listAllDomains,
    addDomain,
    updateDomain,
    setDomainVerified,
    enableDomain,
    disableDomain,
    deprecateDomain,
    buildMailboxDomainList,
    validateDomainChoiceAgainstRegistry,
    registryHasDomains,
} = require('../logic/domain-registry-model.js');

const MAILBOX_LIFECYCLE_API_VERSION = 1;
const DOMAIN_REGISTRY_API_VERSION = 1;
const WORKFLOW_STEPS = [
    'LOGIN',
    'CHOOSE_DOMAIN',
    'CREATE_MAILBOX',
    'VALIDATION',
    'MAILBOX_CREATED',
    'CONNECTION_SETTINGS',
    'READY',
];

const DEFAULT_ALLOWED_DOMAINS = ['emailcore.app'];

function asString(value) {
    return String(value || '').trim();
}

function readAllowedDomains() {
    const raw = asString(process.env.NHP_MAILBOX_ALLOWED_DOMAINS);
    if (!raw) return [...DEFAULT_ALLOWED_DOMAINS];
    const list = raw.split(',').map((item) => normalizeDomainName(item)).filter(Boolean);
    return list.length ? list : [...DEFAULT_ALLOWED_DOMAINS];
}

function buildError(code, message, options = {}) {
    return {
        ok: false,
        code,
        message,
        recoverable: options.recoverable !== false,
        retryable: !!options.retryable,
        nextAction: options.nextAction || '',
    };
}

function buildOk(payload = {}) {
    return { ok: true, ...payload };
}

function resolveRole(req) {
    return resolveRoleFromRequest(req);
}

function getWorkflowStorePath(rootDir) {
    const logDir = path.join(rootDir, 'server_logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    return path.join(logDir, 'mailbox-lifecycle-workflows.json');
}

function loadWorkflowStore(rootDir) {
    const filePath = getWorkflowStorePath(rootDir);
    if (!fs.existsSync(filePath)) return { workflows: {} };
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (parsed && typeof parsed === 'object' && parsed.workflows) return parsed;
    } catch (_) {
        /* fall through */
    }
    return { workflows: {} };
}

function saveWorkflowStore(rootDir, store) {
    const filePath = getWorkflowStorePath(rootDir);
    fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function createWorkflowId() {
    return `wf_${crypto.randomBytes(8).toString('hex')}`;
}

function nowIso() {
    return new Date().toISOString();
}

/** INT-006 Wave 2 (B2) — EmailCore session userId overrides stale request-body userId. */
function resolveSsotUserIdFromSession(sessionData, requestUserId) {
    const ssotUserId = asString(sessionData?.userId);
    if (ssotUserId) return ssotUserId;
    return asString(requestUserId);
}

/**
 * INT-006 Wave 2 (B2) — resume sync when connection already references SSOT user
 * but ownerUserId was stamped from a stale chrome.storage userId at create time.
 */
function syncWorkflowOwnerOnResume(workflow, authUserId, options = {}) {
    if (!options.ssotMode) return false;
    if (!workflow) return false;
    const ssotUserId = asString(authUserId);
    if (!ssotUserId) return false;
    if (asString(workflow.ownerUserId) === ssotUserId) return false;
    const connectionUserId = asString(workflow.connection?.userId);
    if (!connectionUserId || connectionUserId !== ssotUserId) return false;
    workflow.ownerUserId = ssotUserId;
    return true;
}

function createWorkflow(ownerUserId) {
    const ts = nowIso();
    return {
        id: createWorkflowId(),
        ownerUserId: asString(ownerUserId),
        step: 'CHOOSE_DOMAIN',
        status: 'IN_PROGRESS',
        domain: null,
        mailbox: null,
        validation: null,
        connection: null,
        ready: false,
        history: [{ step: 'LOGIN', at: ts, event: 'authenticated' }],
        createdAt: ts,
        updatedAt: ts,
    };
}

function appendHistory(workflow, step, event, detail = {}) {
    workflow.history.push({ step, event, at: nowIso(), ...detail });
    workflow.updatedAt = nowIso();
}

function normalizeEmailCoreBase(value) {
    let base = asString(value || process.env.NHP_EMAILCORE_API_BASE || 'https://emailcore.app');
    if (!base) base = 'https://emailcore.app';
    return base.replace(/\/+$/, '');
}

async function emailCoreRequest({ apiBase, userId, token, method, apiPath, body }) {
    const base = normalizeEmailCoreBase(apiBase);
    const pathPart = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    const url = new URL(`${base}/api/creaty${pathPart}`);
    url.searchParams.set('userId', userId);
    if (method === 'GET') url.searchParams.set('token', token);

    const response = await fetch(url.toString(), {
        method,
        headers: {
            'content-type': 'application/json',
            'x-creaty-token': token,
            Accept: 'application/json',
        },
        body: method === 'GET' ? undefined : JSON.stringify({ ...(body || {}), userId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const err = new Error(asString(data.error || data.message) || `EmailCore HTTP ${response.status}`);
        err.status = response.status;
        err.data = data;
        throw err;
    }
    return data;
}

function usesEmailCoreSsot(deps = {}) {
    const mode = asString(deps.domainRegistrySsot || process.env.NHP_DOMAIN_REGISTRY_SSOT).toLowerCase();
    return mode === 'emailcore';
}

function resolveEmailCoreApiBase(req, deps = {}) {
    return normalizeEmailCoreBase(
        asString(req.query?.apiBase || req.body?.apiBase || deps.emailCoreApiBase || process.env.NHP_EMAILCORE_API_BASE),
    );
}

async function emailCoreMailboxLifecycleRequest({ apiBase, userId, token, method, path, body }) {
    const pathPart = path.startsWith('/') ? path : `/${path}`;
    return emailCoreRequest({
        apiBase,
        userId,
        token,
        method,
        apiPath: `/mailbox-lifecycle${pathPart}`,
        body,
    });
}

async function proxyRegistryToEmailCore(req, deps, { method, path, body, successStatus = 200 }) {
    const data = await emailCoreMailboxLifecycleRequest({
        apiBase: resolveEmailCoreApiBase(req, deps),
        userId: req.auth.userId,
        token: req.auth.token,
        method,
        path,
        body,
    });
    return { status: successStatus, data };
}

async function validateDomainChoiceRemote(domainName, req, deps) {
    const normalized = normalizeDomainName(domainName);
    if (!normalized) {
        return buildError('DOMAIN_REQUIRED', 'Domain is required', {
            recoverable: true,
            nextAction: 'choose_domain',
        });
    }
    try {
        const data = await emailCoreMailboxLifecycleRequest({
            apiBase: resolveEmailCoreApiBase(req, deps),
            userId: req.auth.userId,
            token: req.auth.token,
            method: 'GET',
            path: '/domains',
        });
        const allowed = (Array.isArray(data.domains) ? data.domains : [])
            .some((row) => normalizeDomainName(row.name) === normalized);
        if (allowed) return null;
        return buildError('DOMAIN_NOT_ALLOWED', 'Domain is not enabled and verified in registry', {
            recoverable: true,
            nextAction: 'choose_domain',
        });
    } catch (err) {
        return buildError(
            err.data?.code || DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
            err.message || 'Unable to validate domain against EmailCore registry',
            { recoverable: true, retryable: true, nextAction: 'verify_emailcore_credentials' },
        );
    }
}

function loadDomainRegistry(rootDir) {
    return loadRegistryStore(rootDir);
}

function loadDomainRegistryForRead(rootDir) {
    try {
        return loadDomainRegistry(rootDir);
    } catch (_) {
        return createEmptyStore();
    }
}

function buildDomainList(rootDir = process.cwd()) {
    const store = loadDomainRegistryForRead(rootDir);
    return buildMailboxDomainList(store, process.env);
}

function validateDomainChoice(domainName, rootDir = process.cwd()) {
    const store = loadDomainRegistryForRead(rootDir);
    return validateDomainChoiceAgainstRegistry(store, domainName, process.env);
}

function isAdminRole(role) {
    return asString(role) === 'Admin';
}

function mapRegistryErrorToHttp(result) {
    const code = asString(result.code);
    if (code === DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_NOT_FOUND) return 404;
    if (code === DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE) return 503;
    if (
        code === DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_DUPLICATE
        || code === DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_INVALID
        || code === DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_NOT_VERIFIED
        || code === DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_LAST_ACTIVE
        || code === DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_STATUS_INVALID
        || code === DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_TRANSITION_INVALID
    ) {
        return 409;
    }
    return 400;
}

function applyDomainRegistryPatch(store, id, body = {}) {
    const action = asString(body.action).toLowerCase();
    if (action === 'verify') return setDomainVerified(store, id, true);
    if (action === 'unverify') return setDomainVerified(store, id, false);
    if (action === 'enable') return enableDomain(store, id);
    if (action === 'disable') return disableDomain(store, id);
    if (action === 'deprecate' || action === 'delete') return deprecateDomain(store, id);

    const status = asString(body.status).toLowerCase();
    if (status === 'enabled') return enableDomain(store, id);
    if (status === 'disabled') return disableDomain(store, id);
    if (status === 'deprecated') return deprecateDomain(store, id);

    const patch = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.notes !== undefined) patch.notes = body.notes;

    if (body.isVerified !== undefined) {
        const verified = setDomainVerified(store, id, !!body.isVerified);
        if (!verified.ok) return verified;
    }

    if (Object.keys(patch).length) return updateDomain(store, id, patch);

    if (body.isVerified !== undefined) {
        const domain = store.domains?.[asString(id)] || null;
        return domain ? buildOk({ domain }) : buildError('DOMAIN_NOT_FOUND', 'Domain not found', {
            recoverable: false,
            nextAction: 'refresh_registry',
        });
    }

    return buildError('DOMAIN_INVALID', 'No supported domain patch fields provided', {
        recoverable: true,
        nextAction: 'fix_domain_input',
    });
}

function buildLifecycleRecord(workflow) {
    if (!workflow?.domain || !workflow?.mailbox) return null;
    return {
        schemaVersion: MAILBOX_SCHEMA_VERSION,
        domain: workflow.domain,
        mailbox: workflow.mailbox,
        legacy: workflow.legacy || {},
    };
}

function createAuthMiddleware(deps = {}) {
    return async function authMiddleware(req, res, next) {
        const token = asString(req.headers['x-creaty-token'] || req.query?.token);
        const userId = asString(req.body?.userId || req.query?.userId);
        if (!token || !userId) {
            return res.status(401).json(buildError('AUTH_REQUIRED', 'userId and x-creaty-token are required', {
                recoverable: true,
                retryable: false,
                nextAction: 'provide_credentials',
            }));
        }
        req.auth = { token, userId, role: '' };

        // Supervisor remains local-only (ops key); not in EmailCore creaty-token roles.
        const localRole = resolveRole(req);
        if (localRole === 'Supervisor') {
            req.auth.role = 'Supervisor';
            return next();
        }

        // INT-002 / INT-006 Wave 3 (C3) — EmailCore SSOT role; NHP_MAILBOX_ADMIN_USER_IDS not used here.
        if (usesEmailCoreSsot(deps)) {
            try {
                const data = await emailCoreMailboxLifecycleRequest({
                    apiBase: resolveEmailCoreApiBase(req, deps),
                    userId: req.auth.userId,
                    token: req.auth.token,
                    method: 'GET',
                    path: '/session',
                });
                const ecRole = asString(data.role);
                if (ecRole === 'Admin' || ecRole === 'User') {
                    req.auth.userId = resolveSsotUserIdFromSession(data, req.auth.userId);
                    req.auth.role = ecRole;
                    return next();
                }
            } catch (_) {
                /* fall through to AUTH_INVALID */
            }
            return res.status(401).json(buildError('AUTH_INVALID', 'Invalid token or unable to resolve role from EmailCore', {
                recoverable: true,
                retryable: false,
                nextAction: 'sync_credentials',
            }));
        }

        req.auth.role = localRole;
        if (!req.auth.role) {
            return res.status(401).json(buildError('AUTH_INVALID', 'Unable to resolve role for request', {
                recoverable: true,
                retryable: false,
                nextAction: 'sync_credentials',
            }));
        }
        return next();
    };
}

function registerMailboxLifecycleApi(app, deps = {}) {
    const rootDir = deps.rootDir || process.cwd();
    const logFn = deps.logFn || (() => {});
    const authMiddleware = createAuthMiddleware(deps);

    app.get('/api/mailbox-lifecycle/ping', (_req, res) => {
        res.json(buildOk({
            service: 'mailbox-lifecycle',
            version: MAILBOX_LIFECYCLE_API_VERSION,
            domainRegistryVersion: DOMAIN_REGISTRY_API_VERSION,
            steps: WORKFLOW_STEPS,
        }));
    });

    app.get('/api/mailbox-lifecycle/session', authMiddleware, (req, res) => {
        return res.json(buildOk({
            role: req.auth.role,
            userId: req.auth.userId,
            capabilities: getCapabilitiesForRole(req.auth.role),
        }));
    });

    app.get('/api/mailbox-lifecycle/domains', authMiddleware, async (req, res) => {
        if (!canMutateWorkflow(req.auth.role) && req.auth.role !== 'Supervisor') {
            return res.status(403).json(buildError('FORBIDDEN', 'Insufficient permissions to list domains', {
                recoverable: false,
                nextAction: 'login_as_user_or_admin',
            }));
        }
        if (usesEmailCoreSsot(deps)) {
            try {
                const data = await emailCoreMailboxLifecycleRequest({
                    apiBase: resolveEmailCoreApiBase(req, deps),
                    userId: req.auth.userId,
                    token: req.auth.token,
                    method: 'GET',
                    path: '/domains',
                });
                return res.json(buildOk({
                    ...data,
                    capabilities: getCapabilitiesForRole(req.auth.role),
                    source: data.source || 'emailcore',
                    ssot: 'emailcore',
                }));
            } catch (err) {
                logFn(`Domain list EmailCore proxy failed: ${err.message}`, 'WARN');
                return res.status(err.status || 502).json(err.data?.ok === false ? err.data : buildError(
                    'DOMAIN_REGISTRY_UNAVAILABLE',
                    err.message || 'Unable to read domain registry from EmailCore',
                    { recoverable: true, retryable: true, nextAction: 'verify_emailcore_credentials' },
                ));
            }
        }
        return res.json(buildOk({
            domains: buildDomainList(rootDir),
            role: req.auth.role,
            capabilities: getCapabilitiesForRole(req.auth.role),
            source: registryHasDomains(loadDomainRegistryForRead(rootDir)) ? 'registry' : 'env',
        }));
    });

    app.get('/api/mailbox-lifecycle/domain-registry', authMiddleware, async (req, res) => {
        if (!isAdminRole(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Admin role required for domain registry management', {
                recoverable: false,
                nextAction: 'login_as_admin',
            }));
        }
        if (usesEmailCoreSsot(deps)) {
            try {
                const proxied = await proxyRegistryToEmailCore(req, deps, {
                    method: 'GET',
                    path: '/domain-registry',
                });
                return res.status(proxied.status).json(proxied.data);
            } catch (err) {
                logFn(`Domain registry read EmailCore proxy failed: ${err.message}`, 'WARN');
                return res.status(err.status || 502).json(err.data?.ok === false ? err.data : buildError(
                    DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
                    err.message || 'Unable to read domain registry from EmailCore',
                    { recoverable: true, retryable: true, nextAction: 'retry_registry_read' },
                ));
            }
        }
        let store;
        try {
            store = loadDomainRegistry(rootDir);
        } catch (err) {
            return res.status(503).json(buildError(
                err.code || DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
                err.message || 'Unable to read domain registry',
                { recoverable: true, retryable: true, nextAction: 'retry_registry_read' },
            ));
        }
        return res.json(buildOk({
            domains: listAllDomains(store),
            meta: store.meta || {},
            schemaVersion: store.schemaVersion,
            source: registryHasDomains(store) ? 'registry' : 'env_fallback_ready',
        }));
    });

    app.post('/api/mailbox-lifecycle/domain-registry', authMiddleware, async (req, res) => {
        if (!isAdminRole(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Admin role required to add domains', {
                recoverable: false,
                nextAction: 'login_as_admin',
            }));
        }
        if (usesEmailCoreSsot(deps)) {
            try {
                const proxied = await proxyRegistryToEmailCore(req, deps, {
                    method: 'POST',
                    path: '/domain-registry',
                    body: req.body || {},
                    successStatus: 201,
                });
                return res.status(proxied.status).json(proxied.data);
            } catch (err) {
                logFn(`Domain registry create EmailCore proxy failed: ${err.message}`, 'WARN');
                return res.status(err.status || 502).json(err.data?.ok === false ? err.data : buildError(
                    DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
                    err.message || 'Unable to write domain registry on EmailCore',
                    { recoverable: true, retryable: true, nextAction: 'retry_registry_write' },
                ));
            }
        }
        let store;
        try {
            store = loadDomainRegistry(rootDir);
        } catch (err) {
            return res.status(503).json(buildError(
                err.code || DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
                err.message || 'Unable to read domain registry',
                { recoverable: true, retryable: true, nextAction: 'retry_registry_read' },
            ));
        }

        const result = addDomain(store, {
            name: req.body?.name || req.body?.domainName,
            notes: req.body?.notes,
            isVerified: req.body?.isVerified,
            status: req.body?.status,
        });
        if (!result.ok) {
            return res.status(mapRegistryErrorToHttp(result)).json(result);
        }

        try {
            saveRegistryStore(rootDir, store);
        } catch (err) {
            return res.status(503).json(buildError(
                err.code || DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
                err.message || 'Unable to save domain registry',
                { recoverable: true, retryable: true, nextAction: 'retry_registry_write' },
            ));
        }
        return res.status(201).json(buildOk({ domain: result.domain }));
    });

    app.patch('/api/mailbox-lifecycle/domain-registry/:id', authMiddleware, async (req, res) => {
        if (!isAdminRole(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Admin role required to update domains', {
                recoverable: false,
                nextAction: 'login_as_admin',
            }));
        }
        if (usesEmailCoreSsot(deps)) {
            try {
                const proxied = await proxyRegistryToEmailCore(req, deps, {
                    method: 'PATCH',
                    path: `/domain-registry/${asString(req.params.id)}`,
                    body: req.body || {},
                });
                return res.status(proxied.status).json(proxied.data);
            } catch (err) {
                logFn(`Domain registry patch EmailCore proxy failed: ${err.message}`, 'WARN');
                return res.status(err.status || 502).json(err.data?.ok === false ? err.data : buildError(
                    DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
                    err.message || 'Unable to update domain registry on EmailCore',
                    { recoverable: true, retryable: true, nextAction: 'retry_registry_write' },
                ));
            }
        }
        let store;
        try {
            store = loadDomainRegistry(rootDir);
        } catch (err) {
            return res.status(503).json(buildError(
                err.code || DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
                err.message || 'Unable to read domain registry',
                { recoverable: true, retryable: true, nextAction: 'retry_registry_read' },
            ));
        }

        const domainId = asString(req.params.id);
        const result = applyDomainRegistryPatch(store, domainId, req.body || {});
        if (!result.ok) {
            return res.status(mapRegistryErrorToHttp(result)).json(result);
        }

        try {
            saveRegistryStore(rootDir, store);
        } catch (err) {
            return res.status(503).json(buildError(
                err.code || DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
                err.message || 'Unable to save domain registry',
                { recoverable: true, retryable: true, nextAction: 'retry_registry_write' },
            ));
        }
        return res.json(buildOk({ domain: result.domain }));
    });

    app.delete('/api/mailbox-lifecycle/domain-registry/:id', authMiddleware, async (req, res) => {
        if (!isAdminRole(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Admin role required to delete domains', {
                recoverable: false,
                nextAction: 'login_as_admin',
            }));
        }
        if (usesEmailCoreSsot(deps)) {
            try {
                const proxied = await proxyRegistryToEmailCore(req, deps, {
                    method: 'DELETE',
                    path: `/domain-registry/${asString(req.params.id)}`,
                    body: req.body || {},
                });
                return res.status(proxied.status).json(proxied.data);
            } catch (err) {
                logFn(`Domain registry delete EmailCore proxy failed: ${err.message}`, 'WARN');
                return res.status(err.status || 502).json(err.data?.ok === false ? err.data : buildError(
                    DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
                    err.message || 'Unable to delete domain on EmailCore registry',
                    { recoverable: true, retryable: true, nextAction: 'retry_registry_write' },
                ));
            }
        }
        let store;
        try {
            store = loadDomainRegistry(rootDir);
        } catch (err) {
            return res.status(503).json(buildError(
                err.code || DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
                err.message || 'Unable to read domain registry',
                { recoverable: true, retryable: true, nextAction: 'retry_registry_read' },
            ));
        }

        const domainId = asString(req.params.id);
        const result = deprecateDomain(store, domainId);
        if (!result.ok) {
            return res.status(mapRegistryErrorToHttp(result)).json(result);
        }

        try {
            saveRegistryStore(rootDir, store);
        } catch (err) {
            return res.status(503).json(buildError(
                err.code || DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_REGISTRY_UNAVAILABLE,
                err.message || 'Unable to save domain registry',
                { recoverable: true, retryable: true, nextAction: 'retry_registry_write' },
            ));
        }
        return res.json(buildOk({ domain: result.domain, deleted: true, softDelete: true }));
    });

    app.post('/api/mailbox-lifecycle/workflows', authMiddleware, async (req, res) => {
        if (!canMutateWorkflow(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Only User/Admin can start mailbox workflows', {
                recoverable: false,
                nextAction: 'login_as_user_or_admin',
            }));
        }
        const domainName = asString(req.body?.domain || req.body?.domainName);
        const domainError = usesEmailCoreSsot(deps)
            ? await validateDomainChoiceRemote(domainName, req, deps)
            : validateDomainChoice(domainName, rootDir);
        if (domainError) return res.status(400).json(domainError);

        const store = loadWorkflowStore(rootDir);
        const workflow = createWorkflow(req.auth.userId);
        workflow.domain = {
            id: buildDomainId(domainName),
            name: normalizeDomainName(domainName),
            isVerified: true,
        };
        workflow.step = 'CREATE_MAILBOX';
        appendHistory(workflow, 'CHOOSE_DOMAIN', 'domain_selected', { domain: workflow.domain.name });
        store.workflows[workflow.id] = workflow;
        saveWorkflowStore(rootDir, store);
        return res.status(201).json(buildOk({ workflow }));
    });

    app.get('/api/mailbox-lifecycle/workflows/:id', authMiddleware, (req, res) => {
        const store = loadWorkflowStore(rootDir);
        const workflow = store.workflows[asString(req.params.id)];
        if (!workflow) {
            return res.status(404).json(buildError('WORKFLOW_NOT_FOUND', 'Workflow not found', {
                recoverable: false,
                nextAction: 'create_new_workflow',
            }));
        }
        if (syncWorkflowOwnerOnResume(workflow, req.auth.userId, { ssotMode: usesEmailCoreSsot(deps) })) {
            appendHistory(workflow, workflow.step, 'owner_synced_resume', { ownerUserId: workflow.ownerUserId });
            store.workflows[workflow.id] = workflow;
            saveWorkflowStore(rootDir, store);
        }
        if (!canAccessWorkflow(req.auth.role, workflow, req.auth.userId)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Cannot access this workflow', {
                recoverable: false,
                nextAction: 'use_own_workflow',
            }));
        }
        return res.json(buildOk({ workflow }));
    });

    app.post('/api/mailbox-lifecycle/workflows/:id/mailbox/generate', authMiddleware, async (req, res) => {
        if (!canMutateWorkflow(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Only User/Admin can create mailboxes', {
                recoverable: false,
                nextAction: 'login_as_user_or_admin',
            }));
        }
        const store = loadWorkflowStore(rootDir);
        const workflow = store.workflows[asString(req.params.id)];
        if (!workflow) {
            return res.status(404).json(buildError('WORKFLOW_NOT_FOUND', 'Workflow not found', {
                recoverable: false,
                nextAction: 'create_new_workflow',
            }));
        }
        if (!canAccessWorkflow(req.auth.role, workflow, req.auth.userId)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Cannot modify this workflow', {
                recoverable: false,
                nextAction: 'use_own_workflow',
            }));
        }
        if (!workflow.domain?.name) {
            return res.status(409).json(buildError('DOMAIN_NOT_SET', 'Choose domain before mailbox creation', {
                recoverable: true,
                nextAction: 'choose_domain',
            }));
        }

        const count = Math.max(1, Math.min(10, Number(req.body?.count) || 1));
        const apiBase = asString(req.body?.apiBase);
        let remoteData;
        try {
            remoteData = await emailCoreRequest({
                apiBase,
                userId: req.auth.userId,
                token: req.auth.token,
                method: 'POST',
                apiPath: '/library/sessions/generate',
                body: { count },
            });
        } catch (err) {
            return res.status(err.status || 502).json(buildError('MAILBOX_CREATE_FAILED', err.message, {
                recoverable: true,
                retryable: true,
                nextAction: 'verify_emailcore_credentials',
            }));
        }

        const sessions = Array.isArray(remoteData.sessions) ? remoteData.sessions : [];
        const first = sessions[0] || remoteData.session || remoteData;
        const normalized = normalizeLegacyMailboxRecord({
            ...first,
            domain: workflow.domain.name,
            status: 'CREATED',
        });
        const lifecycleCheck = validateMailboxLifecycleRecord(normalized);
        if (!lifecycleCheck.ok) {
            return res.status(422).json(buildError('MAILBOX_VALIDATION_FAILED', lifecycleCheck.errors.join('; '), {
                recoverable: true,
                retryable: false,
                nextAction: 'review_mailbox_payload',
            }));
        }

        workflow.mailbox = normalized.mailbox;
        workflow.legacy = normalized.legacy;
        workflow.step = 'VALIDATION';
        appendHistory(workflow, 'CREATE_MAILBOX', 'mailbox_generated', {
            address: workflow.mailbox.address,
            count,
        });
        store.workflows[workflow.id] = workflow;
        saveWorkflowStore(rootDir, store);
        return res.json(buildOk({ workflow, record: normalized, remote: remoteData }));
    });

    app.post('/api/mailbox-lifecycle/workflows/:id/mailbox/manual', authMiddleware, async (req, res) => {
        if (!canMutateWorkflow(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Only User/Admin can create mailboxes', {
                recoverable: false,
                nextAction: 'login_as_user_or_admin',
            }));
        }
        const store = loadWorkflowStore(rootDir);
        const workflow = store.workflows[asString(req.params.id)];
        if (!workflow) {
            return res.status(404).json(buildError('WORKFLOW_NOT_FOUND', 'Workflow not found', {
                recoverable: false,
                nextAction: 'create_new_workflow',
            }));
        }
        if (!canAccessWorkflow(req.auth.role, workflow, req.auth.userId)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Cannot modify this workflow', {
                recoverable: false,
                nextAction: 'use_own_workflow',
            }));
        }
        if (!workflow.domain?.name) {
            return res.status(409).json(buildError('DOMAIN_NOT_SET', 'Choose domain before mailbox creation', {
                recoverable: true,
                nextAction: 'choose_domain',
            }));
        }

        const email = asString(req.body?.email).toLowerCase();
        const emailDomain = email.split('@')[1] || '';
        if (!email || emailDomain !== workflow.domain.name) {
            return res.status(400).json(buildError('MAILBOX_DOMAIN_MISMATCH', 'Manual mailbox must use selected domain', {
                recoverable: true,
                retryable: false,
                nextAction: 'fix_mailbox_email',
            }));
        }

        const apiBase = asString(req.body?.apiBase);
        let remoteData;
        try {
            remoteData = await emailCoreRequest({
                apiBase,
                userId: req.auth.userId,
                token: req.auth.token,
                method: 'POST',
                apiPath: '/library/sessions/manual',
                body: { email },
            });
        } catch (err) {
            return res.status(err.status || 502).json(buildError('MAILBOX_CREATE_FAILED', err.message, {
                recoverable: true,
                retryable: true,
                nextAction: 'verify_emailcore_credentials',
            }));
        }

        const normalized = normalizeLegacyMailboxRecord({
            ...(remoteData.session || remoteData),
            email,
            domain: workflow.domain.name,
            status: 'CREATED',
        });
        const lifecycleCheck = validateMailboxLifecycleRecord(normalized);
        if (!lifecycleCheck.ok) {
            return res.status(422).json(buildError('MAILBOX_VALIDATION_FAILED', lifecycleCheck.errors.join('; '), {
                recoverable: true,
                retryable: false,
                nextAction: 'review_mailbox_payload',
            }));
        }

        workflow.mailbox = normalized.mailbox;
        workflow.legacy = normalized.legacy;
        workflow.step = 'VALIDATION';
        appendHistory(workflow, 'CREATE_MAILBOX', 'mailbox_manual_created', { address: email });
        store.workflows[workflow.id] = workflow;
        saveWorkflowStore(rootDir, store);
        return res.json(buildOk({ workflow, record: normalized, remote: remoteData }));
    });

    app.post('/api/mailbox-lifecycle/workflows/:id/validate', authMiddleware, async (req, res) => {
        if (!canMutateWorkflow(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Only User/Admin can validate mailboxes', {
                recoverable: false,
                nextAction: 'login_as_user_or_admin',
            }));
        }
        const store = loadWorkflowStore(rootDir);
        const workflow = store.workflows[asString(req.params.id)];
        if (!workflow) {
            return res.status(404).json(buildError('WORKFLOW_NOT_FOUND', 'Workflow not found', {
                recoverable: false,
                nextAction: 'create_new_workflow',
            }));
        }
        if (!canAccessWorkflow(req.auth.role, workflow, req.auth.userId)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Cannot validate this workflow', {
                recoverable: false,
                nextAction: 'use_own_workflow',
            }));
        }
        const record = buildLifecycleRecord(workflow);
        if (!record) {
            return res.status(409).json(buildError('MAILBOX_NOT_CREATED', 'Create mailbox before validation', {
                recoverable: true,
                nextAction: 'create_mailbox',
            }));
        }

        const entityCheck = validateMailboxEntity(workflow.mailbox);
        if (!entityCheck.ok) {
            return res.status(422).json(buildError('MAILBOX_INVALID', entityCheck.errors.join('; '), {
                recoverable: true,
                nextAction: 'recreate_mailbox',
            }));
        }

        const apiBase = asString(req.body?.apiBase);
        let remoteFound = false;
        try {
            const remote = await emailCoreRequest({
                apiBase,
                userId: req.auth.userId,
                token: req.auth.token,
                method: 'GET',
                apiPath: '/library/sessions',
            });
            const sessions = Array.isArray(remote.sessions) ? remote.sessions : [];
            remoteFound = sessions.some((row) => {
                const sid = asString(row.id || row.sessionId);
                const em = asString(row.display_email || row.email).toLowerCase();
                return sid === asString(workflow.mailbox.sessionId) || em === asString(workflow.mailbox.address);
            });
        } catch (err) {
            workflow.validation = {
                ok: false,
                code: 'VALIDATION_REMOTE_ERROR',
                message: err.message,
                recoverable: true,
                retryable: true,
                nextAction: 'retry_validation',
            };
            workflow.mailbox.status = 'VALIDATING';
            appendHistory(workflow, 'VALIDATION', 'validation_failed', { error: err.message });
            store.workflows[workflow.id] = workflow;
            saveWorkflowStore(rootDir, store);
            return res.status(err.status || 502).json(buildError('VALIDATION_REMOTE_ERROR', err.message, {
                recoverable: true,
                retryable: true,
                nextAction: 'retry_validation',
            }));
        }

        if (!remoteFound) {
            workflow.validation = {
                ok: false,
                code: 'MAILBOX_NOT_FOUND',
                message: 'Mailbox not found in EmailCore library after create',
                recoverable: true,
                retryable: true,
                nextAction: 'retry_validation',
            };
            workflow.mailbox.status = 'VALIDATING';
            appendHistory(workflow, 'VALIDATION', 'validation_pending', { remoteFound: false });
            store.workflows[workflow.id] = workflow;
            saveWorkflowStore(rootDir, store);
            return res.status(404).json(buildError('MAILBOX_NOT_FOUND', workflow.validation.message, {
                recoverable: true,
                retryable: true,
                nextAction: 'retry_validation',
            }));
        }

        workflow.validation = {
            ok: true,
            code: 'MAILBOX_VALIDATED',
            message: 'Mailbox validated in EmailCore library',
            recoverable: false,
            retryable: false,
            nextAction: 'continue_to_connection',
        };
        workflow.mailbox.status = 'ACTIVE';
        workflow.step = 'MAILBOX_CREATED';
        appendHistory(workflow, 'VALIDATION', 'validation_passed');
        workflow.step = 'CONNECTION_SETTINGS';
        appendHistory(workflow, 'MAILBOX_CREATED', 'mailbox_created_confirmed');
        store.workflows[workflow.id] = workflow;
        saveWorkflowStore(rootDir, store);
        return res.json(buildOk({ workflow, validation: workflow.validation, record }));
    });

    app.get('/api/mailbox-lifecycle/workflows/:id/connection', authMiddleware, (req, res) => {
        if (!canMutateWorkflow(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Only User/Admin can read connection settings', {
                recoverable: false,
                nextAction: 'login_as_user_or_admin',
            }));
        }
        const store = loadWorkflowStore(rootDir);
        const workflow = store.workflows[asString(req.params.id)];
        if (!workflow) {
            return res.status(404).json(buildError('WORKFLOW_NOT_FOUND', 'Workflow not found', {
                recoverable: false,
                nextAction: 'create_new_workflow',
            }));
        }
        if (!canAccessWorkflow(req.auth.role, workflow, req.auth.userId)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Cannot access this workflow', {
                recoverable: false,
                nextAction: 'use_own_workflow',
            }));
        }
        const settings = {
            apiBase: normalizeEmailCoreBase(req.query?.apiBase),
            userId: req.auth.userId,
            accessToken: req.auth.token,
            sessionId: asString(workflow.mailbox?.sessionId),
            mailboxAddress: asString(workflow.mailbox?.address),
        };
        workflow.connection = { ...settings, verified: !!workflow.connection?.verified };
        store.workflows[workflow.id] = workflow;
        saveWorkflowStore(rootDir, store);
        return res.json(buildOk({ workflow, connection: settings }));
    });

    app.post('/api/mailbox-lifecycle/workflows/:id/connection/verify', authMiddleware, async (req, res) => {
        if (!canMutateWorkflow(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Only User/Admin can verify connection settings', {
                recoverable: false,
                nextAction: 'login_as_user_or_admin',
            }));
        }
        const store = loadWorkflowStore(rootDir);
        const workflow = store.workflows[asString(req.params.id)];
        if (!workflow) {
            return res.status(404).json(buildError('WORKFLOW_NOT_FOUND', 'Workflow not found', {
                recoverable: false,
                nextAction: 'create_new_workflow',
            }));
        }
        if (!canAccessWorkflow(req.auth.role, workflow, req.auth.userId)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Cannot verify this workflow', {
                recoverable: false,
                nextAction: 'use_own_workflow',
            }));
        }
        if (!workflow.validation?.ok) {
            return res.status(409).json(buildError('VALIDATION_REQUIRED', 'Validate mailbox before connection verification', {
                recoverable: true,
                nextAction: 'validate_mailbox',
            }));
        }

        const apiBase = asString(req.body?.apiBase);
        try {
            await emailCoreRequest({
                apiBase,
                userId: req.auth.userId,
                token: req.auth.token,
                method: 'GET',
                apiPath: '/library/sessions',
            });
        } catch (err) {
            return res.status(err.status || 502).json(buildError('CONNECTION_VERIFY_FAILED', err.message, {
                recoverable: true,
                retryable: true,
                nextAction: 'sync_credentials',
            }));
        }

        workflow.connection = {
            apiBase: normalizeEmailCoreBase(apiBase),
            userId: req.auth.userId,
            accessToken: req.auth.token,
            sessionId: asString(workflow.mailbox?.sessionId),
            mailboxAddress: asString(workflow.mailbox?.address),
            verified: true,
            verifiedAt: nowIso(),
        };
        workflow.step = 'CONNECTION_SETTINGS';
        appendHistory(workflow, 'CONNECTION_SETTINGS', 'connection_verified');
        store.workflows[workflow.id] = workflow;
        saveWorkflowStore(rootDir, store);
        return res.json(buildOk({ workflow, connection: workflow.connection }));
    });

    app.post('/api/mailbox-lifecycle/workflows/:id/ready', authMiddleware, (req, res) => {
        if (!canMutateWorkflow(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Only User/Admin can mark workflow ready', {
                recoverable: false,
                nextAction: 'login_as_user_or_admin',
            }));
        }
        const store = loadWorkflowStore(rootDir);
        const workflow = store.workflows[asString(req.params.id)];
        if (!workflow) {
            return res.status(404).json(buildError('WORKFLOW_NOT_FOUND', 'Workflow not found', {
                recoverable: false,
                nextAction: 'create_new_workflow',
            }));
        }
        if (!canAccessWorkflow(req.auth.role, workflow, req.auth.userId)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Cannot finalize this workflow', {
                recoverable: false,
                nextAction: 'use_own_workflow',
            }));
        }
        if (!workflow.validation?.ok) {
            return res.status(409).json(buildError('VALIDATION_REQUIRED', 'Validation must pass before READY', {
                recoverable: true,
                nextAction: 'validate_mailbox',
            }));
        }
        if (!workflow.connection?.verified) {
            return res.status(409).json(buildError('CONNECTION_NOT_VERIFIED', 'Connection must be verified before READY', {
                recoverable: true,
                nextAction: 'verify_connection',
            }));
        }

        workflow.ready = true;
        workflow.status = 'READY';
        workflow.step = 'READY';
        workflow.mailbox.status = 'ACTIVE';
        appendHistory(workflow, 'READY', 'workflow_ready');
        store.workflows[workflow.id] = workflow;
        saveWorkflowStore(rootDir, store);
        return res.json(buildOk({ workflow, record: buildLifecycleRecord(workflow) }));
    });

    app.post('/api/mailbox-lifecycle/workflows/:id/recover', authMiddleware, (req, res) => {
        if (!canRecoverWorkflow(req.auth.role)) {
            return res.status(403).json(buildError('FORBIDDEN', 'Supervisor role required for recovery actions', {
                recoverable: false,
                nextAction: 'use_supervisor_key',
            }));
        }
        const store = loadWorkflowStore(rootDir);
        const workflow = store.workflows[asString(req.params.id)];
        if (!workflow) {
            return res.status(404).json(buildError('WORKFLOW_NOT_FOUND', 'Workflow not found', {
                recoverable: false,
                nextAction: 'create_new_workflow',
            }));
        }

        const action = asString(req.body?.action || 'retry_validation');
        appendHistory(workflow, workflow.step, 'supervisor_recovery', { action });
        if (action === 'retry_validation') {
            workflow.step = 'VALIDATION';
            workflow.validation = null;
        } else if (action === 'retry_connection') {
            workflow.step = 'CONNECTION_SETTINGS';
            if (workflow.connection) workflow.connection.verified = false;
        }
        store.workflows[workflow.id] = workflow;
        saveWorkflowStore(rootDir, store);
        return res.json(buildOk({ workflow, recovery: { action, by: 'Supervisor' } }));
    });

    logFn('Mailbox Lifecycle API mounted (/api/mailbox-lifecycle/*)', 'INFO');
}

module.exports = {
    MAILBOX_LIFECYCLE_API_VERSION,
    DOMAIN_REGISTRY_API_VERSION,
    WORKFLOW_STEPS,
    registerMailboxLifecycleApi,
    buildError,
    buildOk,
    resolveRole,
    validateDomainChoice,
    readAllowedDomains,
    buildDomainList,
    applyDomainRegistryPatch,
    isAdminRole,
    canMutateWorkflow,
    canRecoverWorkflow,
    canAccessWorkflow,
    getCapabilitiesForRole,
    createWorkflow,
    resolveSsotUserIdFromSession,
    syncWorkflowOwnerOnResume,
};
