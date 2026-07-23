'use strict';

/**
 * EP-301D — Single policy source for mailbox lifecycle authorization.
 * Shared by API (server) and client helpers (UI gating + tests).
 */

const MAILBOX_LIFECYCLE_ACTIONS = Object.freeze({
    LIST_DOMAINS: 'list_domains',
    CREATE_WORKFLOW: 'create_workflow',
    CHANGE_DOMAIN: 'change_domain',
    READ_WORKFLOW: 'read_workflow',
    CREATE_MAILBOX: 'create_mailbox',
    VALIDATE_MAILBOX: 'validate_mailbox',
    CONNECTION_READ: 'connection_read',
    CONNECTION_VERIFY: 'connection_verify',
    MARK_READY: 'mark_ready',
    RESET_WORKFLOW: 'reset_workflow',
    RECOVER: 'recover',
});

const ROLES = Object.freeze(['User', 'Admin', 'Supervisor']);

function asString(value) {
    return String(value || '').trim();
}

function readAdminUserIds(env = process.env) {
    const raw = asString(env.NHP_MAILBOX_ADMIN_USER_IDS);
    if (!raw) return new Set(['admin', 'maggouri']);
    return new Set(raw.split(',').map((item) => asString(item)).filter(Boolean));
}

function readSupervisorKey(env = process.env) {
    return asString(env.NHP_MAILBOX_SUPERVISOR_KEY || env.NHP_SUPERVISOR_KEY);
}

function resolveRoleFromRequest(req, env = process.env) {
    const supervisorKey = readSupervisorKey(env);
    const headerSupervisor = asString(req?.headers?.['x-nhp-supervisor-key']);
    if (supervisorKey && headerSupervisor && headerSupervisor === supervisorKey) {
        return 'Supervisor';
    }
    const userId = asString(req?.auth?.userId || req?.userId);
    if (readAdminUserIds(env).has(userId)) return 'Admin';
    if (userId) return 'User';
    return '';
}

function canAccessWorkflow(role, workflow, userId) {
    if (!workflow) return false;
    if (role === 'Admin' || role === 'Supervisor') return true;
    return asString(workflow.ownerUserId) === asString(userId);
}

function canMutateWorkflow(role) {
    return role === 'User' || role === 'Admin';
}

function canRecoverWorkflow(role) {
    return role === 'Supervisor';
}

function canUseMailboxLifecycleUi(role) {
    return role === 'User' || role === 'Admin';
}

function canPerformAction(role, action, context = {}) {
    const normalizedRole = asString(role);
    const normalizedAction = asString(action);
    if (!ROLES.includes(normalizedRole)) return false;

    switch (normalizedAction) {
        case MAILBOX_LIFECYCLE_ACTIONS.LIST_DOMAINS:
            return normalizedRole === 'User' || normalizedRole === 'Admin' || normalizedRole === 'Supervisor';
        case MAILBOX_LIFECYCLE_ACTIONS.CREATE_WORKFLOW:
        case MAILBOX_LIFECYCLE_ACTIONS.CHANGE_DOMAIN:
        case MAILBOX_LIFECYCLE_ACTIONS.CREATE_MAILBOX:
        case MAILBOX_LIFECYCLE_ACTIONS.VALIDATE_MAILBOX:
        case MAILBOX_LIFECYCLE_ACTIONS.CONNECTION_READ:
        case MAILBOX_LIFECYCLE_ACTIONS.CONNECTION_VERIFY:
        case MAILBOX_LIFECYCLE_ACTIONS.MARK_READY:
        case MAILBOX_LIFECYCLE_ACTIONS.RESET_WORKFLOW:
            return canMutateWorkflow(normalizedRole);
        case MAILBOX_LIFECYCLE_ACTIONS.READ_WORKFLOW:
            return canAccessWorkflow(normalizedRole, context.workflow, context.userId);
        case MAILBOX_LIFECYCLE_ACTIONS.RECOVER:
            return canRecoverWorkflow(normalizedRole);
        default:
            return false;
    }
}

function getCapabilitiesForRole(role) {
    const normalizedRole = asString(role);
    const caps = {};
    Object.values(MAILBOX_LIFECYCLE_ACTIONS).forEach((action) => {
        caps[action] = canPerformAction(normalizedRole, action);
    });
    caps.canUseUi = canUseMailboxLifecycleUi(normalizedRole);
    caps.canCrossWorkflowRead = normalizedRole === 'Admin' || normalizedRole === 'Supervisor';
    return caps;
}

module.exports = {
    MAILBOX_LIFECYCLE_ACTIONS,
    ROLES,
    asString,
    readAdminUserIds,
    readSupervisorKey,
    resolveRoleFromRequest,
    canAccessWorkflow,
    canMutateWorkflow,
    canRecoverWorkflow,
    canUseMailboxLifecycleUi,
    canPerformAction,
    getCapabilitiesForRole,
};
