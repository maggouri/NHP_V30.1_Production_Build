/**
 * Autopilot (AUT) Module for Niche Hunter Pro
 */

let AP = {};
let AP_SEO = {};

// ══ Multi-Platform Architecture ══
let currentPlatform = 'teepublic';
let accountsDB = { teepublic: [], redbubble: [], amazon: [], pinterest: [] };
const SERVER_PORTS = { teepublic: 3019, redbubble: 3021, amazon: 3022, pinterest: 3023 };

async function apLocalUrl(port, path = '') {
    if (window.NhpRuntimeConfig) {
        await window.NhpRuntimeConfig.loadFromStorage();
        return window.NhpRuntimeConfig.localUrl(port, path);
    }
    const pathStr = path ? (String(path).startsWith('/') ? path : `/${path}`) : '';
    return `http://127.0.0.1:${port}${pathStr}`;
}
const SESSION_MODE_PLATFORMS = new Set(['pinterest']);
const SESSION_BACKUP_FALLBACK_PORT = 3019;
const AUTOPILOT_BACKUP_KEYS = [
    'ap_accounts_teepublic',
    'ap_accounts_redbubble',
    'ap_accounts_amazon',
    'ap_accounts_pinterest',
    'ap_accounts',
    'ap_groups',
    'ap_proxy_pool',
    'ap_auto_rotate',
    'ap_visual_mode',
    'ap_auto_login',
    'ap_fair_distribution',
    'ap_max_per_account',
    'active_platform'
];
const AP_MAX_PER_ACCOUNT_STORAGE_KEY = 'ap_max_per_account';

function isApCountPerAuto(value) {
    if (value == null || value === '') return true;
    const normalized = String(value).trim().toLowerCase();
    return normalized === 'auto'
        || normalized === 'تلقائي'
        || normalized === 'غير محدود'
        || normalized === 'unlimited';
}

function parseApMaxPerAccountValue(raw) {
    if (isApCountPerAuto(raw)) return { auto: true, countPer: null };
    const parsed = parseInt(String(raw).trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return { auto: false, countPer: Math.max(1, parsed) };
    }
    return { auto: true, countPer: null };
}

function getApMaxPerAccountFromInput(inputEl) {
    return parseApMaxPerAccountValue(inputEl?.value);
}

function syncApDesignsPerInputFromParsed(parsed) {
    if (!AP.designsPer || !parsed) return;
    AP.designsPer.value = parsed.auto ? '' : String(parsed.countPer);
}

async function saveApMaxPerAccountPreference(value) {
    const payload = isApCountPerAuto(value) ? 'auto' : String(Math.max(1, parseInt(value, 10) || 1));
    await new Promise((resolve) => chrome.storage.local.set({ [AP_MAX_PER_ACCOUNT_STORAGE_KEY]: payload }, resolve));
}

function isApUnlimitedCapacity(capacity) {
    const n = Number(capacity);
    return n === Infinity || n === Number.POSITIVE_INFINITY || !Number.isFinite(n);
}

function hasApUploadCapacity(capacity) {
    if (isApUnlimitedCapacity(capacity)) return true;
    return Math.max(0, Number(capacity) || 0) > 0;
}

function formatApCapacityLabel(capacity) {
    if (isApUnlimitedCapacity(capacity)) return 'السعة: غير محدود';
    const n = Math.max(0, Number(capacity) || 0);
    return n > 0 ? `السعة: ${n}` : 'بدون سعة';
}

function getApUploadConfirmRemainingForRow(state, index) {
    if (!state || !Array.isArray(state.rows)) return 0;
    const total = Math.max(0, Number(state.totalDesigns) || 0);
    let others = 0;
    state.rows.forEach((row, i) => {
        if (i === index || !row?.included) return;
        others += Math.max(0, Math.floor(Number(row.designCount) || 0));
    });
    return Math.max(0, total - others);
}

function clampApUploadConfirmRowCount(state, index, nextValue) {
    const row = state?.rows?.[index];
    if (!row) return 0;
    const requested = Math.max(0, Math.floor(Number(nextValue) || 0));
    const remaining = getApUploadConfirmRemainingForRow(state, index);
    const poolCap = Math.min(requested, remaining);
    if (isApUnlimitedCapacity(row.capacity)) return poolCap;
    const cap = Math.max(0, Number(row.capacity) || 0);
    return Math.min(cap, poolCap);
}
let autopilotAccounts = [];
let activeAdminAccountSourceTab = 'normal';
let selectedAdminCreatyAccountIds = [];
let selectedAdminNormalAccountIds = [];
let adminUserSelectionSaved = false;
let adminCreatySearchQuery = '';
let adminNormalSearchQuery = '';
let editingId = null;
let autopilotQueryBootHandled = false;
let autopilotModuleInitialized = false;
let apFairDistributionSessionExplicitOff = false;
let apQueueMonitorFp = '';
let apAccountsRenderFp = '';
let apAccountsLoadPromise = null;
let adminSelectionLoadInProgress = false;
const isLowSpecModeEnabled = () => !!window.NHP_IS_LIGHT_MODE || !!window.NHP_LOW_SPEC_MODE;

function ensureAPAccountsLoaded(existingData = null) {
    if (!apAccountsLoadPromise) {
        apAccountsLoadPromise = loadAPAccounts(existingData).finally(() => {
            apAccountsLoadPromise = null;
        });
    }
    return apAccountsLoadPromise;
}

function isAutopilotPanelActive() {
    return !!document.getElementById('panel-autopilot')?.classList.contains('active');
}

function isAutopilotUploadBusy(state) {
    if (!state || typeof state !== 'object') return false;
    return state.isRunning === true;
}

function apQueueStateHasStaleUploadMarkers(state) {
    if (!state || typeof state !== 'object' || state.isRunning) return false;
    const status = String(state.overallStatus || '').toLowerCase();
    if (['uploading', 'running'].includes(status)) return true;
    if (String(state.currentAccountEmail || '').trim()) return true;
    if (String(state.currentAccountId || '').trim()) return true;
    const perAccount = Array.isArray(state.perAccount) ? state.perAccount : [];
    return perAccount.some((item) => normalizeQueueStatus(item?.status) === 'uploading');
}

function sanitizeApQueueMonitorState(state) {
    if (!state || typeof state !== 'object') return null;
    if (state.isRunning) return state;
    if (!apQueueStateHasStaleUploadMarkers(state)) return state;
    const perAccount = (Array.isArray(state.perAccount) ? state.perAccount : []).map((item) => {
        const status = normalizeQueueStatus(item?.status);
        return {
            ...item,
            status: status === 'uploading' ? 'waiting' : status
        };
    });
    const completedUploads = Math.max(0, Number(state.completedUploads) || 0);
    const totalPlannedUploads = Math.max(0, Number(state.totalPlannedUploads) || 0);
    let overallStatus = String(state.overallStatus || 'waiting').toLowerCase();
    if (['uploading', 'running'].includes(overallStatus)) {
        overallStatus = totalPlannedUploads > 0 && completedUploads >= totalPlannedUploads ? 'uploaded' : 'waiting';
    }
    return {
        ...state,
        isRunning: false,
        overallStatus,
        currentAccountId: '',
        currentAccountEmail: '',
        currentAccountLabel: '',
        currentAccountIndex: 0,
        currentAccountTotal: 0,
        currentAccountUploaded: 0,
        currentAccountPlanned: 0,
        perAccount
    };
}

const AP_START_BTN_IDLE_HTML = '<i class="fa-solid fa-ghost"></i> بدء عبر Ghost Server <span id="ap-countdown-timer" class="hidden ml-2 px-2 py-0.5 bg-black/40 rounded text-[10px] font-mono border border-white/10 animate-pulse">00:00</span>';
const AP_START_BTN_IDLE_TITLE = 'ابدأ الرفع عبر Ghost Server';
const AP_START_BTN_STOP_TITLE = 'إيقاف الرفع الجاري فوراً';

function applyApStartButtonMode(running) {
    AP.startBtn = document.getElementById('ap-start-btn') || AP.startBtn;
    if (!AP.startBtn) return;

    const btn = AP.startBtn;
    const nowRunning = !!running;
    const wasRunning = btn.classList.contains('ap-start-btn--stop');
    btn.disabled = false;
    btn.classList.toggle('ap-start-btn--stop', nowRunning);
    if (wasRunning === nowRunning) return;

    if (nowRunning) {
        btn.title = AP_START_BTN_STOP_TITLE;
        btn.setAttribute('aria-label', 'إيقاف الرفع');
        btn.style.background = '';
        btn.style.opacity = '';
        btn.classList.remove('ap-start-offline');
        const timerMarkup = AP.countdownTimer?.outerHTML
            || '<span id="ap-countdown-timer" class="hidden ml-2 px-2 py-0.5 bg-black/40 rounded text-[10px] font-mono border border-white/10 animate-pulse">00:00</span>';
        btn.innerHTML = `<i class="fa-solid fa-stop"></i> إيقاف ${timerMarkup}`;
    } else {
        btn.title = AP_START_BTN_IDLE_TITLE;
        btn.removeAttribute('aria-label');
        btn.style.background = 'linear-gradient(135deg, var(--primary), #EC4899)';
        btn.innerHTML = AP_START_BTN_IDLE_HTML;
        if (!_ghostServerOnline && isGhostServerPlatform(currentPlatform)) {
            btn.classList.add('ap-start-offline');
            btn.style.opacity = '0.55';
            btn.title = '⚠️ Ghost Server غير متصل — اضغط تشغيل السيرفر أولاً';
        } else {
            btn.classList.remove('ap-start-offline');
            btn.style.opacity = '';
        }
    }

    AP.countdownTimer = document.getElementById('ap-countdown-timer');
}

function syncApUploadControlButtons(state) {
    const running = isAutopilotUploadBusy(state);
    applyApStartButtonMode(running);
    if (!running && AP.countdownTimer) AP.countdownTimer.classList.add('hidden');
}

function buildQueueMonitorFingerprint(state) {
    if (!state || typeof state !== 'object') return '';
    const perAccount = (Array.isArray(state.perAccount) ? state.perAccount : []).slice(0, 24);
    const perDesign = (Array.isArray(state.perDesign) ? state.perDesign : []).slice(0, 40);
    return [
        state.overallStatus || '',
        state.completedAccountCount || 0,
        state.selectedAccountCount || 0,
        state.completedUploads || 0,
        state.totalPlannedUploads || 0,
        state.designsReadyForUpload ? 1 : 0,
        state.currentAccountEmail || '',
        state.currentAccountUploaded || 0,
        state.currentAccountPlanned || 0,
        perAccount.map((item) => `${item.accountEmail || item.accountLabel}:${item.status}:${item.uploadedCount}`).join('|'),
        perDesign.map((item) => `${item.queueItemId || item.title}:${item.status}`).join('|')
    ].join('::');
}

function buildApAccountsFingerprint() {
    const list = Array.isArray(autopilotAccounts) ? autopilotAccounts : [];
    const activeUpload = getActiveUploadAccountFromState(apQueueMonitorState);
    return [
        currentPlatform,
        activeAdminAccountSourceTab || 'normal',
        adminCreatySearchQuery || '',
        adminNormalSearchQuery || '',
        activeGroupFilter || '',
        activeUpload?.accountId || activeUpload?.accountEmail || '',
        activeUpload?.uploadedCount || 0,
        list.length,
        list.slice(0, 60).map((acc) => [
            acc.id,
            isAutopilotAccountSelected(acc) ? 1 : 0,
            acc.verified ? 1 : 0,
            acc.uploadedTodayCount || 0,
            acc.groupId || ''
        ].join(':')).join('|')
    ].join('::');
}

// v15.0 — Album Groups
let autopilotGroups = [];
let activeGroupFilter = null;

function resolveAccountCategory(acc) {
    const api = globalThis.ApAccountActivation;
    if (api?.deriveAccountStatus) return api.deriveAccountStatus(acc);

    if (!acc || typeof acc !== 'object') return 'inactive';

    const status = String(acc.teepublic_status || acc.tp_status || acc.status || '').trim().toLowerCase();
    const uploads = Number(acc?.stats?.uploaded ?? acc?.designsUploaded ?? acc?.uploadedCount ?? 0) || 0;
    if (uploads >= 5 || acc.is_artisan === true || status === 'artisan' || acc.groupId === 'g_artisan') {
        return 'artisan';
    }
    if (status === 'deactivated' || status === 'disabled' || acc.deactivated === true) {
        return 'inactive';
    }
    if (api?.isAutAccountActivated?.(acc)) return 'active';
    if (['active', 'registered', 'signup_complete'].includes(status)) return 'active';
    return 'inactive';
}

function ensureAccountCategory(acc) {
    const category = resolveAccountCategory(acc);
    let changed = false;
    if (acc.category !== category) {
        acc.category = category;
        changed = true;
    }
    if (acc.status !== category) {
        acc.status = category;
        changed = true;
    }
    return changed;
}

function migrateAccountsCategories(accounts) {
    if (!Array.isArray(accounts)) return false;
    let changed = false;
    accounts.forEach((acc) => {
        if (ensureAccountCategory(acc)) changed = true;
    });
    return changed;
}

function getFilteredAutopilotAccounts() {
    return autopilotAccounts.filter((acc) => {
        // filter by active platform/tab sourceType
        const expectedType = activeAdminAccountSourceTab;
        if (acc.sourceType !== expectedType) return false;
        
        // filter by active group
        if (activeGroupFilter && acc.groupId !== activeGroupFilter) return false;
        
        // filter by search query
        const query = (expectedType === 'creaty' ? adminCreatySearchQuery : adminNormalSearchQuery).trim().toLowerCase();
        if (query) {
            const alias = (acc.displayName || acc.storeName || acc.email.split('@')[0]).toLowerCase();
            const email = acc.email.toLowerCase();
            if (!alias.includes(query) && !email.includes(query)) return false;
        }
        
        return true;
    });
}

function getActiveSelectionSet() {
    return activeAdminAccountSourceTab === 'creaty' ? selectedAdminCreatyAccountIds : selectedAdminNormalAccountIds;
}

function getSelectionSetForAccount(acc) {
    return acc?.sourceType === 'creaty' ? selectedAdminCreatyAccountIds : selectedAdminNormalAccountIds;
}

function isAccountIdInSelectionSet(id, set) {
    const needle = String(id || '').trim();
    if (!needle) return false;
    return set.some((entry) => String(entry) === needle);
}

const ADMIN_SELECTION_MIGRATION_KEY = 'ap_admin_selection_user_only_v1';
const ADMIN_SELECTION_RESET_V2_KEY = 'ap_admin_selection_zero_default_v2';
const ADMIN_SELECTION_RESET_V3_KEY = 'ap_admin_selection_zero_default_v3';
const ADMIN_USER_SELECTION_SAVED_KEY = 'ap_admin_user_selection_saved';

function applyClearedAdminSelectionToRes(res) {
    if (!res || typeof res !== 'object') return;
    res[ADMIN_USER_SELECTION_SAVED_KEY] = false;
    res.selectedAdminCreatyAccountIds = [];
    res.selectedAdminNormalAccountIds = [];
}

function buildAdminAccountSelectionIndex() {
    const normalIds = new Set();
    const creatyIds = new Set();
    const normalByEmail = new Map();
    const creatyByEmail = new Map();
    Object.values(accountsDB).forEach((list) => {
        (Array.isArray(list) ? list : []).forEach((acc) => {
            if (!acc?.id) return;
            const id = String(acc.id);
            const emailKey = String(acc.email || '').trim().toLowerCase();
            if (acc.sourceType === 'creaty') {
                creatyIds.add(id);
                if (emailKey) creatyByEmail.set(emailKey, id);
            } else {
                normalIds.add(id);
                if (emailKey) normalByEmail.set(emailKey, id);
            }
        });
    });
    return { normalIds, creatyIds, normalByEmail, creatyByEmail };
}

function pruneAdminSelectionSet(selSet, validIds, emailToId) {
    const next = [];
    const seen = new Set();
    (Array.isArray(selSet) ? selSet : []).forEach((entry) => {
        const needle = String(entry || '').trim();
        if (!needle) return;
        const resolved = validIds.has(needle) ? needle : (emailToId.get(needle.toLowerCase()) || '');
        if (!resolved || seen.has(resolved)) return;
        seen.add(resolved);
        next.push(resolved);
    });
    selSet.length = 0;
    next.forEach((id) => selSet.push(id));
}

function reconcileAdminSelectionSets() {
    const { normalIds, creatyIds, normalByEmail, creatyByEmail } = buildAdminAccountSelectionIndex();
    pruneAdminSelectionSet(selectedAdminNormalAccountIds, normalIds, normalByEmail);
    pruneAdminSelectionSet(selectedAdminCreatyAccountIds, creatyIds, creatyByEmail);
}

function stripLegacyAccountSelectedFields() {
    let changed = false;
    Object.keys(accountsDB).forEach((plat) => {
        (accountsDB[plat] || []).forEach((acc) => {
            if (acc && 'selected' in acc) {
                delete acc.selected;
                changed = true;
            }
        });
    });
    return changed;
}

/** Never persist acc.selected — checkbox state lives only in admin selection sets. */
function sanitizeAccountsSelectedFieldFromSets() {
    stripLegacyAccountSelectedFields();
}

async function purgeStaleAdminSelectionFromStorageIfNeeded(res) {
    const storageSaysSaved = res?.[ADMIN_USER_SELECTION_SAVED_KEY] === true;
    if (storageSaysSaved) return false;

    const hasStaleIds = (Array.isArray(res?.selectedAdminNormalAccountIds) && res.selectedAdminNormalAccountIds.length > 0)
        || (Array.isArray(res?.selectedAdminCreatyAccountIds) && res.selectedAdminCreatyAccountIds.length > 0);
    const hasStaleSavedFlag = res?.[ADMIN_USER_SELECTION_SAVED_KEY] === true;
    const accountsHaveSelected = stripLegacyAccountSelectedFields();
    if (!hasStaleIds && !hasStaleSavedFlag && !accountsHaveSelected) return false;

    console.log('[Autopilot][Selection] purgeStaleAdminSelectionFromStorage', {
        hasStaleIds,
        hasStaleSavedFlag,
        accountsHaveSelected
    });

    const payload = {
        selectedAdminCreatyAccountIds: [],
        selectedAdminNormalAccountIds: [],
        [ADMIN_USER_SELECTION_SAVED_KEY]: false
    };
    if (accountsHaveSelected) {
        payload.ap_accounts_teepublic = accountsDB.teepublic;
        payload.ap_accounts_redbubble = accountsDB.redbubble;
        payload.ap_accounts_amazon = accountsDB.amazon;
        payload.ap_accounts_pinterest = accountsDB.pinterest;
        payload.ap_accounts = accountsDB.teepublic;
    }
    await new Promise((resolve) => chrome.storage.local.set(payload, resolve));
    applyClearedAdminSelectionToRes(res);
    return true;
}

function loadAdminSelectionSetsFromStorage(res) {
    adminUserSelectionSaved = res?.[ADMIN_USER_SELECTION_SAVED_KEY] === true;
    if (!adminUserSelectionSaved) {
        selectedAdminCreatyAccountIds = [];
        selectedAdminNormalAccountIds = [];
        return;
    }
    selectedAdminCreatyAccountIds = Array.isArray(res.selectedAdminCreatyAccountIds)
        ? [...res.selectedAdminCreatyAccountIds]
        : [];
    selectedAdminNormalAccountIds = Array.isArray(res.selectedAdminNormalAccountIds)
        ? [...res.selectedAdminNormalAccountIds]
        : [];
}

async function runAdminSelectionMigrationIfNeeded(res) {
    if (res?.[ADMIN_SELECTION_MIGRATION_KEY]) return false;

    const legacyStrip = stripLegacyAccountSelectedFields();
    selectedAdminCreatyAccountIds = [];
    selectedAdminNormalAccountIds = [];
    adminUserSelectionSaved = false;

    const payload = {
        [ADMIN_SELECTION_MIGRATION_KEY]: true,
        [ADMIN_USER_SELECTION_SAVED_KEY]: false,
        selectedAdminCreatyAccountIds: [],
        selectedAdminNormalAccountIds: []
    };
    if (legacyStrip) {
        payload.ap_accounts_teepublic = accountsDB.teepublic;
        payload.ap_accounts_redbubble = accountsDB.redbubble;
        payload.ap_accounts_amazon = accountsDB.amazon;
        payload.ap_accounts_pinterest = accountsDB.pinterest;
        payload.ap_accounts = accountsDB.teepublic;
    }
    await new Promise((resolve) => chrome.storage.local.set(payload, resolve));
    applyClearedAdminSelectionToRes(res);
    return true;
}

/** One-time: users who already ran v1 migration may still have polluted selection + userSaved. */
async function runAdminSelectionResetV2IfNeeded(res) {
    if (res?.[ADMIN_SELECTION_RESET_V2_KEY]) return false;

    const legacyStrip = stripLegacyAccountSelectedFields();
    selectedAdminCreatyAccountIds = [];
    selectedAdminNormalAccountIds = [];
    adminUserSelectionSaved = false;

    const payload = {
        [ADMIN_SELECTION_RESET_V2_KEY]: true,
        [ADMIN_USER_SELECTION_SAVED_KEY]: false,
        selectedAdminCreatyAccountIds: [],
        selectedAdminNormalAccountIds: []
    };
    if (legacyStrip) {
        payload.ap_accounts_teepublic = accountsDB.teepublic;
        payload.ap_accounts_redbubble = accountsDB.redbubble;
        payload.ap_accounts_amazon = accountsDB.amazon;
        payload.ap_accounts_pinterest = accountsDB.pinterest;
        payload.ap_accounts = accountsDB.teepublic;
    }
    await new Promise((resolve) => chrome.storage.local.set(payload, resolve));
    applyClearedAdminSelectionToRes(res);
    return true;
}

/** One-time: clear polluted userSaved + first-account auto-selection after prior fixes. */
async function runAdminSelectionResetV3IfNeeded(res) {
    if (res?.[ADMIN_SELECTION_RESET_V3_KEY]) return false;

    console.log('[Autopilot][Selection] runAdminSelectionResetV3IfNeeded — clearing all admin selection state');

    const legacyStrip = stripLegacyAccountSelectedFields();
    selectedAdminCreatyAccountIds = [];
    selectedAdminNormalAccountIds = [];
    adminUserSelectionSaved = false;

    const payload = {
        [ADMIN_SELECTION_RESET_V3_KEY]: true,
        [ADMIN_USER_SELECTION_SAVED_KEY]: false,
        selectedAdminCreatyAccountIds: [],
        selectedAdminNormalAccountIds: []
    };
    if (legacyStrip) {
        payload.ap_accounts_teepublic = accountsDB.teepublic;
        payload.ap_accounts_redbubble = accountsDB.redbubble;
        payload.ap_accounts_amazon = accountsDB.amazon;
        payload.ap_accounts_pinterest = accountsDB.pinterest;
        payload.ap_accounts = accountsDB.teepublic;
    }
    await new Promise((resolve) => chrome.storage.local.set(payload, resolve));
    applyClearedAdminSelectionToRes(res);
    return true;
}

function setAccountSelectedInSet(id, selected) {
    const acc = resolveAccountById(id);
    if (!acc) return false;
    const selSet = getSelectionSetForAccount(acc);
    const needle = String(acc.id);
    const idx = selSet.findIndex((entry) => String(entry) === needle);
    if (selected) {
        if (idx === -1) selSet.push(acc.id);
    } else if (idx !== -1) {
        selSet.splice(idx, 1);
    }
    return true;
}

function syncAllAccountSelectedFlagsFromSets() {
    stripLegacyAccountSelectedFields();
}

/** Source of truth for upload/checkbox selection — matches admin selection sets, not stale acc.selected. */
function isAutopilotAccountSelected(acc) {
    if (!acc?.id) return false;
    return isAccountIdInSelectionSet(acc.id, getSelectionSetForAccount(acc));
}

function getSelectedAutopilotAccounts(options = {}) {
    const { verifiedOnly = false } = options;
    const seen = new Set();
    const selected = [];
    [selectedAdminNormalAccountIds, selectedAdminCreatyAccountIds].forEach((selSet) => {
        (Array.isArray(selSet) ? selSet : []).forEach((id) => {
            const needle = String(id || '').trim();
            if (!needle || seen.has(needle)) return;
            const acc = autopilotAccounts.find((item) => {
                const itemId = String(item?.id || '').trim();
                const itemEmail = String(item?.email || '').trim();
                return itemId === needle || itemEmail === needle || itemEmail.toLowerCase() === needle.toLowerCase();
            });
            if (!acc) return;
            if (verifiedOnly && !acc.verified) return;
            seen.add(needle);
            selected.push(acc);
        });
    });
    return selected;
}

function applyVisibleSelection(checked) {
    getFilteredAutopilotAccounts().forEach((acc) => setAccountSelectedInSet(acc.id, checked));
    syncAllAccountSelectedFlagsFromSets();
}

function purgeRemovedAccountsFromSelectionSets(removedIds = []) {
    const removed = new Set((removedIds || []).map((id) => String(id)));
    if (!removed.size) return;
    [selectedAdminCreatyAccountIds, selectedAdminNormalAccountIds].forEach((set) => {
        for (let i = set.length - 1; i >= 0; i -= 1) {
            if (removed.has(String(set[i]))) set.splice(i, 1);
        }
    });
    syncAllAccountSelectedFlagsFromSets();
}

function persistAdminSelectionState(cb, options = {}) {
    const { markUserSaved = false } = options;
    if (markUserSaved) adminUserSelectionSaved = true;
    const totalSelected = selectedAdminNormalAccountIds.length + selectedAdminCreatyAccountIds.length;
    if (!totalSelected) {
        adminUserSelectionSaved = false;
    }
    return new Promise((resolve) => {
        const payload = {
            selectedAdminCreatyAccountIds,
            selectedAdminNormalAccountIds,
            [ADMIN_USER_SELECTION_SAVED_KEY]: adminUserSelectionSaved === true
        };
        chrome.storage.local.set(payload, () => {
            if (cb) cb();
            resolve();
        });
    });
}

function saveSelectionAndAccounts(cb) {
    if (adminSelectionLoadInProgress) {
        console.log('[Autopilot][Selection] saveSelectionAndAccounts skipped — load in progress');
        if (cb) cb();
        return Promise.resolve();
    }
    sanitizeAccountsSelectedFieldFromSets();
    return saveCurrentAccounts(() => {
        persistAdminSelectionState(cb, { markUserSaved: true });
    });
}

function syncAdminSelectAllCheckboxState() {
    const selectAllCb = document.getElementById('admin-accounts-select-all-cb');
    if (!selectAllCb) return;
    const visibleIds = getFilteredAutopilotAccounts().map((acc) => String(acc.id));
    const activeSelSet = getActiveSelectionSet();
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => isAccountIdInSelectionSet(id, activeSelSet));
    const someVisibleSelected = visibleIds.some((id) => isAccountIdInSelectionSet(id, activeSelSet));
    selectAllCb.checked = allVisibleSelected;
    selectAllCb.indeterminate = someVisibleSelected && !allVisibleSelected;
}

let editingGroupId = null;
let _modalGroupId = null; // v15.1
const AP_UPLOAD_QUEUE_STATE_KEY = 'ap_upload_queue_state';
let apQueueMonitorState = null;
const DEFAULT_GROUPS = [
    { id: 'g_artisan', name: 'ARTISAN ACCOUNT STORE', emoji: '🏆', color: '#F59E0B', desc: 'الحسابات المتمرسة وذات الخبرة العالية' },
    { id: 'g_apprentice', name: 'APPRENTICE ACCOUNT STORE', emoji: '🎓', color: '#6366f1', desc: 'الحسابات المتوسطة في مرحلة النمو' },
    { id: 'g_new', name: 'NEW ACCOUNT STORE', emoji: '🌱', color: '#10B981', desc: 'الحسابات الجديدة وحديثة الإنشاء' },
];

// Helpers passed from popup.js
let showToast, switchTab, getDesignQueue, setDesignQueue, saveQueueToStorage, renderQueue, showDesignPreview, removeFromQueue;

/**
 * Initialize Autopilot Module
 */
export function bindApUploadConfirmModalEarly() {
    bindApUploadConfirmModalEvents();
}

export function initAutopilotModule(helpers) {
    if (autopilotModuleInitialized) return;
    autopilotModuleInitialized = true;

    showToast = helpers.showToast;
    switchTab = helpers.switchTab;
    getDesignQueue = helpers.getDesignQueue;
    setDesignQueue = helpers.setDesignQueue;
    saveQueueToStorage = helpers.saveQueueToStorage;
    renderQueue = helpers.renderQueue;
    showDesignPreview = helpers.showDesignPreview;
    removeFromQueue = helpers.removeFromQueue;

    console.log('🚀 Autopilot Module: Initializing...');

    // Initialize Selectors
    AP = {
        email: document.getElementById('ap-email'),
        pass: document.getElementById('ap-pass'),
        displayNameInput: document.getElementById('ap-display-name'),
        proxy: document.getElementById('ap-proxy'),
        quota: document.getElementById('ap-quota'),
        nicheMap: document.getElementById('ap-niche-mapping'),
        addBtn: document.getElementById('ap-add-account'),
        list: document.getElementById('ap-accounts-list'),
        startBtn: document.getElementById('ap-start-btn'),
        designsPer: document.getElementById('ap-designs-per-account'),
        delay: document.getElementById('ap-delay'),
        progressPanel: document.getElementById('ap-status-panel'),
        progressBar: document.getElementById('ap-progress-bar'),
        progressText: document.getElementById('ap-progress-text'),
        progressPercent: document.getElementById('ap-progress-percent'),
        queueRunStatus: document.getElementById('ap-queue-run-status'),
        queueDesignReady: document.getElementById('ap-queue-design-ready'),
        queueSelectedAccounts: document.getElementById('ap-queue-selected-accounts'),
        queueCompletedAccounts: document.getElementById('ap-queue-completed-accounts'),
        queueAccountList: document.getElementById('ap-queue-account-list'),
        queueDesignList: document.getElementById('ap-queue-design-list'),
        queueEmpty: document.getElementById('ap-queue-empty'),
        queueMonitorBody: document.getElementById('ap-queue-monitor-body'),
        log: document.getElementById('ap-log'),
        proxyPool: document.getElementById('ap-proxy-pool'),
        autoRotate: document.getElementById('ap-auto-rotate'),
        togglePool: document.getElementById('toggle-proxy-pool'),
        poolWrap: document.getElementById('proxy-pool-wrap'),
        visualMode: document.getElementById('ap-visual-mode'),
        autoLogin: document.getElementById('ap-auto-login'),
        retryFailedBtn: document.getElementById('ap-retry-failed-btn'),
        uploadActiveBanner: document.getElementById('ap-upload-active-banner'),
        uploadMonitorStrip: document.getElementById('ap-upload-monitor-strip'),
        uploadMonitorCounts: document.getElementById('ap-upload-monitor-counts'),
        uploadMonitorLabel: document.getElementById('ap-upload-monitor-label'),
        // v13.0 — Ghost Server
        serverDot: document.getElementById('ap-server-dot'),
        serverStatusText: document.getElementById('ap-server-status-text'),
        wakeupBtn: document.getElementById('ap-wakeup-btn'),
        randomDistrib: document.getElementById('ap-random-distribution'),
        fairDistrib: document.getElementById('ap-fair-distribution'),
        resetBtn: document.getElementById('ap-reset-btn'),
        serverStopBtn: document.getElementById('ap-server-stop-btn'),
        // v14.0 — Accounts Manager
        selectAll: document.getElementById('ap-select-all'),
        deselectAll: document.getElementById('ap-deselect-all'),
        selectedCount: document.getElementById('ap-selected-count'),
        // v15.0 — Group Assign
        groupAssign: document.getElementById('ap-group-assign'),
        platformSelect: document.getElementById('ap-platform-select'),
        // v16.0 — Stats & Multi-timers
        countdownTimer: document.getElementById('ap-countdown-timer'),
        downloadLog: document.getElementById('ap-download-log'),
        downloadStats: document.getElementById('ap-download-stats')
    };

    ensureApUploadUiRefs();
    apFairDistributionSessionExplicitOff = false;
    if (AP.fairDistrib) AP.fairDistrib.checked = true;
    chrome.storage.local.set({ ap_fair_distribution: true });

    AP_SEO = {
        imageInput: document.getElementById('ap-image-upload'),
        uploadTrigger: document.getElementById('ap-upload-trigger'),
        queueList: document.getElementById('ap-queue'),
        queueCount: document.getElementById('ap-queue-count'),
        queueContainer: document.getElementById('ap-queue-container'),
        previewPanel: document.getElementById('ap-seo-preview'),
        previewImg: document.getElementById('ap-img-preview'),
        previewFilename: document.getElementById('ap-current-filename'),
        title: document.getElementById('ap-seo-title'),
        mainTag: document.getElementById('ap-seo-main-tag'),
        tags: document.getElementById('ap-seo-tags'),
        desc: document.getElementById('ap-seo-desc'),
        desc: document.getElementById('ap-seo-desc'),
        nicheManual: document.getElementById('ap-seo-niche-manual')
    };

    // Cross-section nav: Autopilot → SEO
    const gotoSeoBtn = document.getElementById('ap-goto-seo');
    if (gotoSeoBtn && !gotoSeoBtn.dataset.navBound) {
        gotoSeoBtn.dataset.navBound = 'true';
        gotoSeoBtn.addEventListener('click', () => {
            if (typeof switchTab === 'function') switchTab('seo');
        });
    }

    repairAutopilotStaticText();
    setupEventListeners();
    setupSeoPreviewEmptyState();
    rebindWakeupButton();
    void ensureAPAccountsLoaded();
    setTimeout(() => maybeRunAutopilotQueryBootstrap(), 600);

    // v15.0 — تحميل المجموعات
    loadGroups();

    window.NHP_activateAutopilotPanel = async function activateAutopilotPanel() {
        apQueueMonitorFp = '';
        apAccountsRenderFp = '';
        if (!_serverMonitorTimer) startServerMonitor();
        await ensureAPAccountsLoaded();
        await loadQueueMonitorState();
        if (!apQueueMonitorState) {
            renderQueueMonitorState(buildFallbackQueueMonitorState());
        }
        renderAPAccounts();
        if (typeof renderQueue === 'function') renderQueue();
    };
}

function setupSeoPreviewEmptyState() {
    const preview = document.getElementById('ap-seo-preview');
    const emptyState = document.getElementById('ap-seo-empty-state');
    if (!preview || !emptyState) return;
    if (preview.dataset.emptyStateBound === 'true') return;
    preview.dataset.emptyStateBound = 'true';

    const refreshEmptyState = () => {
        const isPreviewVisible = !preview.classList.contains('hidden');
        emptyState.style.display = isPreviewVisible ? 'none' : '';
    };

    refreshEmptyState();
    if (typeof MutationObserver === 'function') {
        const observer = new MutationObserver(refreshEmptyState);
        observer.observe(preview, { attributes: true, attributeFilter: ['class'] });
    }
}

function maybeRunAutopilotQueryBootstrap() {
    if (autopilotQueryBootHandled) return;
    let params;
    try {
        params = new URLSearchParams(window.location.search || '');
    } catch (_) {
        return;
    }

    const mode = params.get('nhp_autotest');
    const email = (params.get('email') || '').trim().toLowerCase();
    if (mode !== 'teepublic_album' || !email) return;

    autopilotQueryBootHandled = true;
    switchAPPlatform('teepublic', false);

    const targetAccount = (accountsDB.teepublic || []).find((acc) => String(acc?.email || '').trim().toLowerCase() === email);
    if (!targetAccount) {
        showToast('⚠️ لم يتم العثور على حساب TeePublic المطلوب للاختبار الحي.');
        apLog(`⚠️ Live test account not found: ${email}`, 'error');
        return;
    }

    setTimeout(() => launchTeePublicAlbumOrganizerFlow(targetAccount), 900);
}

/**
 * Handle external updates (e.g. from storage refresh)
 */
export function updateAutopilot(data) {
    if (data && data.ap_accounts) {
        apAccountsLoadPromise = null;
        void ensureAPAccountsLoaded(data).then(() => {
            if (isAutopilotPanelActive() || isAutopilotUploadBusy(apQueueMonitorState)) {
                apAccountsRenderFp = '';
                renderAPAccounts();
            }
        });
    }
}

function apLog(msg, type = 'info') {
    if (!AP.log) return;
    const time = new Date().toLocaleTimeString();
    const color = type === 'error' ? 'var(--banned)' : (type === 'success' ? 'var(--safe)' : 'var(--text-muted)');
    const item = document.createElement('div');
    item.style.color = color;
    item.innerHTML = `<span style="opacity:0.5">[${time}]</span> ${msg}`;
    AP.log.prepend(item);
}

function normalizeQueueStatus(value, fallback = 'waiting') {
    const status = String(value || '').trim().toLowerCase();
    if (['waiting', 'ready', 'uploading', 'uploaded', 'published', 'skipped', 'stopped', 'failed'].includes(status)) return status;
    return fallback;
}

function getQueueStatusVisual(status) {
    const normalized = normalizeQueueStatus(status);
    const map = {
        waiting: { label: 'waiting', color: '#94a3b8' },
        ready: { label: 'ready', color: '#22c55e' },
        uploading: { label: 'جاري الرفع', color: '#818cf8' },
        uploaded: { label: 'uploaded', color: '#10b981' },
        published: { label: 'published', color: '#10b981' },
        skipped: { label: 'skipped', color: '#94a3b8' },
        stopped: { label: 'stopped', color: '#f59e0b' },
        failed: { label: 'failed', color: '#ef4444' }
    };
    return map[normalized] || map.waiting;
}

function isSameApAccount(accountRef, acc) {
    if (!accountRef || !acc) return false;
    const refId = String(accountRef.accountId || accountRef.accountEmail || '');
    const accId = String(acc.id || '');
    const accEmail = String(acc.email || '');
    return !!refId && (refId === accId || refId === accEmail);
}

function getActiveUploadAccountFromState(state) {
    if (!state || typeof state !== 'object' || state.isRunning !== true) return null;
    const perAccount = Array.isArray(state.perAccount) ? state.perAccount : [];
    const fromList = perAccount.find((item) => normalizeQueueStatus(item?.status) === 'uploading');
    if (fromList) return fromList;
    const email = String(state.currentAccountEmail || '').trim();
    if (email) {
        const matched = perAccount.find((item) => String(item?.accountEmail || '').trim() === email);
        if (matched) return matched;
        return {
            accountId: state.currentAccountId || email,
            accountEmail: email,
            accountLabel: state.currentAccountLabel || email,
            uploadedCount: Number(state.currentAccountUploaded) || 0,
            plannedCount: Number(state.currentAccountPlanned) || 0,
            status: 'uploading'
        };
    }
    const pending = perAccount.find((item) => {
        const status = normalizeQueueStatus(item?.status);
        return status === 'waiting' || status === 'ready';
    });
    if (pending) return pending;
    return null;
}

function formatApActiveUploadLabel(state) {
    const active = getActiveUploadAccountFromState(state);
    if (!active) return '';
    const email = active.accountEmail || active.accountLabel || 'حساب غير معروف';
    const uploaded = Number(active.uploadedCount) || 0;
    const planned = Number(active.plannedCount) || 0;
    const designPart = planned > 0 ? ` (${uploaded}/${planned})` : '';
    return `الرفع على: ${email}${designPart}`;
}

function buildApUploadBusyToast(state) {
    const label = formatApActiveUploadLabel(state);
    if (label) return `⏳ ${label} — انتظر اكتمال الحساب الحالي`;
    return '⏳ الرفع قيد التنفيذ — انتظر اكتمال الحساب الحالي';
}

function buildOptimisticApUploadState(accounts, designCount = 0, options = {}) {
    // accounts MUST be the checkbox-selected list only (see getSelectedAutopilotAccounts).
    // Test: only pearly.drown checked → first banner email must be pearly.drown, never an unchecked account.
    const list = Array.isArray(accounts) ? accounts.filter(Boolean) : [];
    const first = list[0];
    const fairAssigned = Array.isArray(options.fairAssigned) ? options.fairAssigned : null;
    const perAccount = list.map((acc, index) => ({
        accountId: String(acc?.id || acc?.email || ''),
        accountLabel: acc?.displayName || acc?.email || 'Unknown',
        accountEmail: acc?.email || '',
        status: index === 0 ? 'uploading' : 'waiting',
        uploadedCount: 0,
        plannedCount: fairAssigned ? (Number(fairAssigned[index]) || 0) : 0
    }));
    return {
        isRunning: true,
        overallStatus: 'uploading',
        selectedAccountCount: list.length,
        completedAccountCount: 0,
        totalPlannedUploads: Math.max(0, Number(designCount) || 0),
        completedUploads: 0,
        overallProgressPercent: 0,
        perAccount,
        perDesign: [],
        currentAccountId: String(first?.id || first?.email || ''),
        currentAccountEmail: first?.email || '',
        currentAccountLabel: first?.displayName || first?.email?.split?.('@')?.[0] || '',
        currentAccountIndex: first ? 1 : 0,
        currentAccountTotal: list.length,
        currentAccountUploaded: 0,
        currentAccountPlanned: 0
    };
}

function highlightActiveUploadAccount(state) {
    if (!AP.list) return;
    const active = getActiveUploadAccountFromState(state);
    let activeCard = null;
    AP.list.querySelectorAll('.ap-acc-card').forEach((card) => {
        const cardId = String(card.getAttribute('data-id') || '');
        const cardEmail = String(card.querySelector('.ap-acc-email')?.textContent || card.querySelector('[title*="@"]')?.getAttribute('title') || '').trim();
        const activeId = String(active?.accountId || active?.accountEmail || '');
        const isActive = !!activeId && (activeId === cardId || (!!active?.accountEmail && active.accountEmail === cardEmail));
        card.classList.toggle('is-active', isActive);
        if (isActive) activeCard = card;
    });
    if (activeCard && typeof activeCard.scrollIntoView === 'function') {
        activeCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function ensureApUploadUiRefs() {
    AP.progressPanel = document.getElementById('ap-status-panel');
    AP.progressBar = document.getElementById('ap-progress-bar');
    AP.progressText = document.getElementById('ap-progress-text');
    AP.progressPercent = document.getElementById('ap-progress-percent');
    AP.queueRunStatus = document.getElementById('ap-queue-run-status');
    AP.uploadActiveBanner = document.getElementById('ap-upload-active-banner');
    AP.uploadMonitorStrip = document.getElementById('ap-upload-monitor-strip');
    AP.uploadMonitorCounts = document.getElementById('ap-upload-monitor-counts');
    AP.uploadMonitorLabel = document.getElementById('ap-upload-monitor-label');
    AP.retryFailedBtn = document.getElementById('ap-retry-failed-btn') || AP.retryFailedBtn;
    AP.fairDistrib = document.getElementById('ap-fair-distribution') || AP.fairDistrib;
}

/**
 * Fair distribution resolution priority:
 * 1) Multi-account + multi-design → always on (unless retry)
 * 2) User explicitly unchecked this session → off (single-account only)
 * 3) Storage / checkbox (default on when missing)
 */
function resolveIsFairDistribution(accountCount = 0, options = {}) {
    ensureApUploadUiRefs();
    const designCount = Math.max(0, Number(options.designCount) || 0);
    if (accountCount > 1 && designCount > 1) {
        return true;
    }
    if (apFairDistributionSessionExplicitOff === true) {
        return false;
    }
    const checkbox = options.checkbox ?? AP.fairDistrib;
    let fromPreference = true;
    if (checkbox) {
        fromPreference = checkbox.checked !== false;
    } else if (options.storageValue !== undefined) {
        fromPreference = options.storageValue !== false;
    }
    if (accountCount > 1) {
        return true;
    }
    return fromPreference;
}

function applyApActiveUploadVisuals(state, options = {}) {
    ensureApUploadUiRefs();
    const uploadBusy = isAutopilotUploadBusy(state);
    const activeUploadLabel = formatApActiveUploadLabel(state);
    const progressPercent = Number.isFinite(Number(options.progressPercent))
        ? Math.max(0, Math.min(100, Number(options.progressPercent)))
        : null;

    if (AP.progressPanel) {
        AP.progressPanel.classList.toggle('hidden', !uploadBusy);
    }
    if (AP.uploadActiveBanner) {
        if (uploadBusy && activeUploadLabel) {
            AP.uploadActiveBanner.textContent = activeUploadLabel;
            AP.uploadActiveBanner.title = activeUploadLabel;
            AP.uploadActiveBanner.classList.remove('hidden');
        } else {
            AP.uploadActiveBanner.textContent = '';
            AP.uploadActiveBanner.title = '';
            AP.uploadActiveBanner.classList.add('hidden');
        }
    }
    if (uploadBusy && activeUploadLabel) {
        if (AP.progressText) {
            AP.progressText.textContent = activeUploadLabel;
            AP.progressText.title = activeUploadLabel;
        }
        if (AP.queueRunStatus) {
            AP.queueRunStatus.textContent = 'جاري الرفع';
            AP.queueRunStatus.title = activeUploadLabel;
            AP.queueRunStatus.style.color = '#818cf8';
        }
    }
    if (progressPercent !== null) {
        if (AP.progressBar) AP.progressBar.style.width = `${progressPercent}%`;
        if (AP.progressPercent) AP.progressPercent.textContent = `${progressPercent}%`;
    }
    highlightActiveUploadAccount(state);
}

function hasRetryableApFailures(state) {
    if (!state || typeof state !== 'object' || state.isRunning) return false;
    const perDesign = Array.isArray(state.perDesign) ? state.perDesign : [];
    return perDesign.some((item) => normalizeQueueStatus(item?.status) === 'failed' && item?.accountId);
}

/** True when queue monitor has durable upload results that must survive remount/refresh. */
function hasPersistedApUploadResults(state) {
    if (!state || typeof state !== 'object') return false;
    if (state.isRunning) return true;
    if (hasRetryableApFailures(state)) return true;
    const perDesign = Array.isArray(state.perDesign) ? state.perDesign : [];
    return perDesign.some((item) => {
        const status = normalizeQueueStatus(item?.status);
        return ['failed', 'uploaded', 'published', 'stopped', 'skipped'].includes(status);
    });
}

function syncApRetryFailedButton(state) {
    AP.retryFailedBtn = document.getElementById('ap-retry-failed-btn') || AP.retryFailedBtn;
    if (!AP.retryFailedBtn) return;
    AP.retryFailedBtn.classList.toggle('hidden', !hasRetryableApFailures(state));
    AP.retryFailedBtn.disabled = !!state?.isRunning;
}

/**
 * Rebuild monitor from design-queue fallback only when there is no persisted run result.
 * Failed uploads (and Retry Failed) must remain until explicit Reset or successful clear.
 */
function renderFallbackQueueMonitorUnlessPersisted() {
    if (hasPersistedApUploadResults(apQueueMonitorState)) {
        syncApRetryFailedButton(apQueueMonitorState);
        updateApUploadMonitorStrip(apQueueMonitorState);
        return false;
    }
    renderQueueMonitorState(buildFallbackQueueMonitorState());
    return true;
}

function formatApMonitorCounts(counts) {
    const c = counts || {};
    return `✓ ${Number(c.ok) || 0} | ✎ ${Number(c.corrected) || 0} | ⏭ ${Number(c.skipped_failed) || 0}`;
}

function updateApUploadMonitorStrip(state, countsOverride) {
    const strip = AP.uploadMonitorStrip || document.getElementById('ap-upload-monitor-strip');
    const countsEl = AP.uploadMonitorCounts || document.getElementById('ap-upload-monitor-counts');
    const labelEl = AP.uploadMonitorLabel || document.getElementById('ap-upload-monitor-label');
    if (!strip) return;
    const counts = countsOverride || state?.monitorCounts || null;
    const uploadBusy = isAutopilotUploadBusy(state);
    const failed = Array.isArray(state?.perDesign)
        ? state.perDesign.filter((item) => normalizeQueueStatus(item?.status) === 'failed').length
        : 0;
    const hasCounts = counts && (Number(counts.ok) || Number(counts.corrected) || Number(counts.skipped_failed) || failed > 0 || uploadBusy);
    if (!hasCounts) {
        strip.classList.add('hidden');
        return;
    }
    strip.classList.remove('hidden');
    if (countsEl) countsEl.textContent = formatApMonitorCounts(counts || { ok: 0, corrected: 0, skipped_failed: failed });
    if (labelEl) {
        labelEl.innerHTML = uploadBusy
            ? '<i class="fa-solid fa-shield-halved"></i> مراقب الرفع (يستمر عند الفشل)'
            : '<i class="fa-solid fa-shield-halved"></i> مراقب الرفع AI';
    }
}

function buildFallbackQueueMonitorState() {
    const queue = Array.isArray(getDesignQueue?.()) ? getDesignQueue() : [];
    const selectedAccounts = getSelectedAutopilotAccounts({ verifiedOnly: true });
    const completedDesigns = queue.filter((item) => item?.status === 'done').length;
    const totalDesigns = queue.length;
    return {
        overallProgressPercent: totalDesigns > 0 ? Math.round((completedDesigns / totalDesigns) * 100) : 0,
        selectedAccountCount: selectedAccounts.length,
        completedAccountCount: 0,
        overallStatus: 'waiting',
        designsReadyForUpload: totalDesigns > 0 && queue.every((item) => !!item?.meta),
        totalPlannedUploads: totalDesigns,
        completedUploads: completedDesigns,
        perAccount: selectedAccounts.map((acc) => ({
            accountId: String(acc?.id || acc?.email || ''),
            accountLabel: acc.displayName || acc.email || 'Unknown',
            accountEmail: acc?.email || '',
            status: 'waiting',
            uploadedCount: 0,
            plannedCount: 0
        })),
        perDesign: queue.map((item) => ({
            title: item?.meta?.title || item?.file?.name || item?.id || 'Untitled',
            status: item?.meta ? (item?.status === 'done' ? 'uploaded' : 'ready') : 'waiting'
        }))
    };
}

function renderQueueMonitorState(nextState) {
    const state = sanitizeApQueueMonitorState(nextState) || buildFallbackQueueMonitorState();
    apQueueMonitorState = state;
    syncApUploadControlButtons(state);
    const panelUi = isAutopilotPanelActive() || isAutopilotUploadBusy(state);
    const uploadBusy = isAutopilotUploadBusy(state);
    const fp = buildQueueMonitorFingerprint(state);
    const fpChanged = fp !== apQueueMonitorFp;
    if (fpChanged) apQueueMonitorFp = fp;
    syncApRetryFailedButton(state);
    updateApUploadMonitorStrip(state);
    if (uploadBusy || fpChanged) {
        applyApActiveUploadVisuals(state, {
            progressPercent: state.overallProgressPercent
        });
    }
    if (!fpChanged) return;
    if (!panelUi) return;
    const perAccount = Array.isArray(state.perAccount) ? state.perAccount : [];
    const perDesign = Array.isArray(state.perDesign) ? state.perDesign : [];
    const totalPlannedUploads = Math.max(0, Number(state.totalPlannedUploads) || perDesign.length);
    const completedUploads = Math.max(0, Number(state.completedUploads) || perDesign.filter((item) => {
        const s = normalizeQueueStatus(item.status);
        return s === 'uploaded' || s === 'published';
    }).length);
    const progressPercent = totalPlannedUploads > 0
        ? Math.max(0, Math.min(100, Math.round((completedUploads / totalPlannedUploads) * 100)))
        : Math.max(0, Math.min(100, Number(state.overallProgressPercent) || 0));
    const statusVisual = getQueueStatusVisual(state.overallStatus || 'waiting');
    const activeUploadLabel = formatApActiveUploadLabel(state);
    if (AP.progressBar) AP.progressBar.style.width = `${progressPercent}%`;
    if (AP.progressPercent) AP.progressPercent.textContent = `${progressPercent}%`;
    if (AP.progressText) {
        if (uploadBusy && activeUploadLabel) {
            AP.progressText.textContent = activeUploadLabel;
            AP.progressText.title = activeUploadLabel;
        } else {
            AP.progressText.textContent = `${Number(state.completedAccountCount) || 0} / ${Number(state.selectedAccountCount) || 0} حساب`;
            AP.progressText.title = '';
        }
    }
    if (AP.queueRunStatus) {
        if (uploadBusy && activeUploadLabel) {
            AP.queueRunStatus.textContent = 'جاري الرفع';
            AP.queueRunStatus.title = activeUploadLabel;
            AP.queueRunStatus.style.color = '#818cf8';
        } else {
            AP.queueRunStatus.textContent = statusVisual.label;
            AP.queueRunStatus.title = '';
            AP.queueRunStatus.style.color = statusVisual.color;
        }
    }
    if (AP.queueDesignReady) {
        AP.queueDesignReady.textContent = state.designsReadyForUpload ? 'ready' : 'waiting';
        AP.queueDesignReady.style.color = state.designsReadyForUpload ? '#10b981' : '#f59e0b';
    }
    if (AP.queueSelectedAccounts) AP.queueSelectedAccounts.textContent = String(Number(state.selectedAccountCount) || 0);
    if (AP.queueCompletedAccounts) AP.queueCompletedAccounts.textContent = String(Number(state.completedAccountCount) || 0);

    if (AP.queueEmpty && AP.queueMonitorBody) {
        const isEmpty = perDesign.length === 0 && perAccount.length === 0;
        AP.queueEmpty.classList.toggle('hidden', !isEmpty);
        AP.queueMonitorBody.classList.toggle('hidden', isEmpty);
    }

    if (AP.queueAccountList) {
        AP.queueAccountList.innerHTML = perAccount.length > 0
            ? perAccount.slice(0, 40).map((item) => {
                const visual = getQueueStatusVisual(item.status);
                return `<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid rgba(148,163,184,0.12);">
                    <span style="color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.accountLabel || item.accountEmail || 'Account'}</span>
                    <span style="color:${visual.color};font-weight:700;">${visual.label}${item.plannedCount ? ` (${item.uploadedCount || 0}/${item.plannedCount})` : ''}</span>
                </div>`;
            }).join('')
            : '<div style="color:#94a3b8;">لا توجد حسابات في الطابور.</div>';
    }

    if (AP.queueDesignList) {
        AP.queueDesignList.innerHTML = perDesign.length > 0
            ? perDesign.slice(0, 80).map((item) => {
                const visual = getQueueStatusVisual(item.status);
                return `<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid rgba(148,163,184,0.12);">
                    <span style="color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.title || item.queueItemId || 'Design'}</span>
                    <span style="color:${visual.color};font-weight:700;">${visual.label}</span>
                </div>`;
            }).join('')
            : '<div style="color:#94a3b8;">لا توجد تصاميم في الطابور.</div>';
    }
    if (uploadBusy && activeUploadLabel) {
        apAccountsRenderFp = '';
        renderAPAccounts();
    } else {
        highlightActiveUploadAccount(state);
    }
}

function loadQueueMonitorState() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'ap_get_queue_state' }, (res) => {
            const raw = res?.success ? res.data : null;
            const state = raw?.isRunning
                ? raw
                : (sanitizeApQueueMonitorState(raw) || buildFallbackQueueMonitorState());
            // Always paint monitor UI so Retry Failed restores after popup refresh/remount.
            apQueueMonitorFp = '';
            renderQueueMonitorState(state);
            resolve(apQueueMonitorState);
        });
    });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

function isGhostServerPlatform(platform) {
    return !!SERVER_PORTS[platform] && !SESSION_MODE_PLATFORMS.has(platform);
}

async function detectPinterestImageTransparencyFromDataUrl(dataUrl) {
    return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const sampleWidth = Math.max(1, Math.min(img.width || 1, 220));
            const sampleHeight = Math.max(1, Math.round((img.height || 1) * (sampleWidth / Math.max(img.width || 1, 1))));
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return resolve(false);

            canvas.width = sampleWidth;
            canvas.height = sampleHeight;
            ctx.clearRect(0, 0, sampleWidth, sampleHeight);
            ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);
            const pixels = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
            for (let i = 3; i < pixels.length; i += 4) {
                if (pixels[i] < 250) return resolve(true);
            }
            resolve(false);
        };
        img.onerror = () => resolve(false);
        img.src = dataUrl;
    });
}

async function preparePinterestSessionImage(dataUrl) {
    return await new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
            const targetWidth = 1000;
            const targetHeight = 1500;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) return resolve(dataUrl);

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            const hasTransparency = await detectPinterestImageTransparencyFromDataUrl(dataUrl);
            ctx.fillStyle = hasTransparency ? '#000000' : '#ffffff';
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
            const drawWidth = Math.max(1, Math.round(img.width * scale));
            const drawHeight = Math.max(1, Math.round(img.height * scale));
            const drawX = Math.round((targetWidth - drawWidth) / 2);
            const drawY = Math.round((targetHeight - drawHeight) / 2);
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

            resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

function prioritizePinterestEnglishText(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';

    const parts = raw
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length <= 1) return raw;

    const englishParts = [];
    const otherParts = [];

    parts.forEach((part) => {
        const latinCount = (part.match(/[A-Za-z]/g) || []).length;
        const arabicCount = (part.match(/[\u0600-\u06FF]/g) || []).length;
        if (latinCount > 0 && latinCount >= arabicCount) englishParts.push(part);
        else otherParts.push(part);
    });

    return [...englishParts, ...otherParts].join('\n\n').trim() || raw;
}

function preferEnglishPinterestTags(tagsValue) {
    const rawTokens = Array.isArray(tagsValue)
        ? tagsValue
        : String(tagsValue || '')
            .split(/[,\n]/)
            .map((token) => token.trim())
            .filter(Boolean);

    if (!rawTokens.length) return '';

    const englishTokens = rawTokens.filter((token) => /[A-Za-z]/.test(token));
    const selected = englishTokens.length ? englishTokens : rawTokens;
    return selected.join(', ').trim();
}

function buildPinterestSessionPayload(item, imageDataUrl) {
    const meta = item?.meta || {};
    const rawTags = preferEnglishPinterestTags(meta.tags);
    const title = prioritizePinterestEnglishText(String(meta.title || item?.file?.name || 'Pinterest Design'))
        .replace(/\.[^/.]+$/, '')
        .trim()
        .slice(0, 100);
    const description = [
        prioritizePinterestEnglishText(meta.description || ''),
        rawTags
    ].filter(Boolean).join('\n\n').trim().slice(0, 800);
    const link = String(meta.product_url || meta.productUrl || meta.link || '').trim();

    return {
        id: `pt_${Date.now()}`,
        queueItemId: item?.id || null,
        title,
        description,
        link,
        imageDataUrl,
        createdAt: new Date().toISOString(),
        source: 'autopilot'
    };
}

async function launchPinterestCurrentSessionFlow() {
    const queue = Array.isArray(getDesignQueue?.()) ? getDesignQueue() : [];
    if (queue.length === 0) {
        showToast('⚠️ القائمة فارغة! أضف تصاميم أولاً');
        return;
    }

    const seoReadyDesigns = queue.filter((item) => item && item.meta);
    if (seoReadyDesigns.length === 0) {
        showToast('⚠️ يرجى تنفيذ التحليل الذكي في تبويب SEO AI أولاً.');
        return;
    }

    const pendingDesign = seoReadyDesigns.find((item) => item.status !== 'done') || seoReadyDesigns[0];
    const rawBase64 = pendingDesign.base64 || await window.NHPDatabase?.getImage?.(pendingDesign.id);
    if (!rawBase64) {
        showToast('❌ تعذر قراءة صورة التصميم من التخزين المحلي.');
        return;
    }

    const imageDataUrl = rawBase64.startsWith('data:') ? rawBase64 : `data:image/png;base64,${rawBase64}`;
    const pinterestReadyImage = await preparePinterestSessionImage(imageDataUrl);
    const payload = buildPinterestSessionPayload(pendingDesign, pinterestReadyImage);

    chrome.storage.local.set({ pt_pending_publish: payload }, () => {
        if (chrome.runtime.lastError) {
            showToast('❌ فشل تجهيز أمر النشر إلى Pinterest.');
            return;
        }

        apLog(`📌 Pinterest Session Mode | تجهيز ${pendingDesign.file?.name || 'design'} للنشر عبر نفس المتصفح`, 'success');
        showToast('📌 تم تجهيز التصميم لـ Pinterest على نفس جلسة Chrome.');
        chrome.runtime.sendMessage({
            action: 'open_account_browser',
            platform: 'pinterest',
            account: { id: payload.id, email: 'session@pinterest.local', displayName: 'Pinterest Session' }
        });
    });
}

function launchTeePublicAlbumOrganizerFlow(acc) {
    if (!acc || !acc.email) {
        showToast('❌ الحساب المحدد غير صالح أو لا يحتوي على بريد إلكتروني.');
        apLog('❌ TeePublic Albums | invalid account payload for organizer flow', 'error');
        return;
    }
    const payload = {
        saaScrape: { active: true, phase: 'ALBUMS', designs: [], albums: [] },
        saaAuto: { active: false },
        saaAutopilotSource: {
            accountId: acc?.id || null,
            email: acc?.email || null,
            startedAt: new Date().toISOString(),
            source: 'autopilot'
        },
        saaAutopilotStatus: {
            active: true,
            stage: 'OPENING_ACCOUNT',
            message: 'Preparing TeePublic album organizer launch',
            accountId: acc?.id || null,
            email: acc?.email || null,
            updatedAt: new Date().toISOString()
        }
    };

    chrome.storage.local.set(payload, () => {
        if (chrome.runtime.lastError) {
            showToast('❌ تعذر تجهيز مهمة تنظيم ألبومات TeePublic.');
            return;
        }
        const alias = acc?.displayName || acc?.storeName || acc?.email?.split('@')?.[0] || 'account';
        apLog(`📚 TeePublic Albums | تجهيز التنظيم التلقائي للحساب: ${alias}`, 'success');
        showToast('📚 تم تجهيز تنظيم ألبومات TeePublic، وسيبدأ المسح داخل جلسة الحساب.');
        if (acc) {
            openAccountBrowser(acc, { targetUrl: 'https://www.teepublic.com/account/store/albums' });
        } else {
            chrome.runtime.sendMessage({
                action: 'open_account_browser',
                platform: 'teepublic',
                account: { id: 'teepublic-albums', email: 'session@teepublic.local', displayName: 'TeePublic Session' },
                targetUrl: 'https://www.teepublic.com/account/store/albums'
            });
        }
    });
}

function resolveAccountById(id) {
    const needle = String(id || '').trim();
    if (!needle) return null;
    return autopilotAccounts.find((acc) => String(acc?.id || '').trim() === needle)
        || autopilotAccounts.find((acc) => String(acc?.email || '').trim().toLowerCase() === needle.toLowerCase())
        || null;
}

function normalizePlatform(platform) {
    return ['teepublic', 'redbubble', 'amazon', 'pinterest'].includes(platform) ? platform : 'teepublic';
}

async function getServerStatusViaBackground(platform) {
    return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'get_server_status', platform }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            if (!response) {
                reject(new Error('Empty background response'));
                return;
            }
            resolve(response);
        });
    });
}

/**
 * حفظ حسابات المنصة الحالية في التخزين المخصص لها
 */
function saveCurrentAccounts(cb) {
    sanitizeAccountsSelectedFieldFromSets();
    const storageKey = `ap_accounts_${currentPlatform}`;
    accountsDB[currentPlatform] = autopilotAccounts;
    const payload = { [storageKey]: autopilotAccounts };
    if (currentPlatform === 'teepublic') payload.ap_accounts = autopilotAccounts;
    return new Promise((resolve) => {
        chrome.storage.local.set(payload, () => {
            if (cb) cb();
            resolve();
        });
    });
}

/**
 * تبديل المنصة الحالية (TeePublic <-> Redbubble <-> Amazon)
 */
function switchAPPlatform(platform, notify = true) {
    platform = normalizePlatform(platform);
    currentPlatform = platform;
    autopilotAccounts = accountsDB[platform] || [];
    migrateAccountsCategories(autopilotAccounts);
    renderAPAccounts();
    refreshAutopilotPlatformModeUi();

    if (AP.platformSelect) AP.platformSelect.value = platform;

    document.querySelectorAll('.ap-plat-btn').forEach(btn => {
        const isActive = btn.dataset.plat === platform;
        btn.style.opacity = isActive ? '1' : '0.5';
        btn.style.boxShadow = isActive ? `0 0 10px ${btn.style.backgroundColor}` : 'none';
    });

    chrome.storage.local.set({ active_platform: platform });
    checkServerStatusNow();
    if (notify) showToast(`🔄 تم التبديل إلى منصة ${platform.toUpperCase()}`);
}

/**
 * Account & Proxy Management
 */
const ADMIN_SELECTION_STATE_KEYS = [
    'activeAdminAccountSourceTab', 'selectedAdminCreatyAccountIds', 'selectedAdminNormalAccountIds',
    'adminCreatySearchQuery', 'adminNormalSearchQuery',
    ADMIN_SELECTION_MIGRATION_KEY, ADMIN_SELECTION_RESET_V2_KEY, ADMIN_SELECTION_RESET_V3_KEY,
    ADMIN_USER_SELECTION_SAVED_KEY
];

async function loadAPAccounts(existingData = null) {
    adminSelectionLoadInProgress = true;
    try {
    const keysToLoad = [
        'ap_accounts_teepublic', 'ap_accounts_redbubble', 'ap_accounts_amazon', 'ap_accounts_pinterest', 'ap_accounts',
        'ap_proxy_pool', 'ap_auto_rotate', 'ap_visual_mode', 'ap_auto_login', 'ap_fair_distribution', 'ap_max_per_account', 'active_platform',
        ...ADMIN_SELECTION_STATE_KEYS
    ];

    let res;
    if (existingData) {
        const needsSelectionMerge = ADMIN_SELECTION_STATE_KEYS.some((key) => !(key in existingData));
        if (needsSelectionMerge) {
            const stored = await new Promise((r) => chrome.storage.local.get(ADMIN_SELECTION_STATE_KEYS, r));
            res = { ...stored, ...existingData };
        } else {
            res = existingData;
        }
    } else {
        res = await new Promise((r) => chrome.storage.local.get(keysToLoad, r));
    }

    if (res.active_platform) currentPlatform = normalizePlatform(res.active_platform);
    else currentPlatform = normalizePlatform(currentPlatform);

    accountsDB.teepublic = res.ap_accounts_teepublic || res.ap_accounts || [];
    accountsDB.redbubble = res.ap_accounts_redbubble || [];
    accountsDB.amazon = res.ap_accounts_amazon || [];
    accountsDB.pinterest = res.ap_accounts_pinterest || [];

    // Normalize accounts database sourceType and id
    Object.keys(accountsDB).forEach(plat => {
        accountsDB[plat] = accountsDB[plat].map(acc => {
            if (!acc.sourceType) acc.sourceType = 'normal';
            if (!acc.id) acc.id = 'acc_' + Math.random().toString(36).substr(2, 9);
            return acc;
        });
    });

    let migrationNeeded = false;
    Object.keys(accountsDB).forEach((platformKey) => {
        if (migrateAccountsCategories(accountsDB[platformKey])) migrationNeeded = true;
    });

    autopilotAccounts = accountsDB[currentPlatform];

    await runAdminSelectionMigrationIfNeeded(res);
    await runAdminSelectionResetV2IfNeeded(res);
    await runAdminSelectionResetV3IfNeeded(res);

    stripLegacyAccountSelectedFields();
    await purgeStaleAdminSelectionFromStorageIfNeeded(res);

    // Load state keys — restore checkbox selection only after explicit user save
    activeAdminAccountSourceTab = res.activeAdminAccountSourceTab || 'normal';
    adminCreatySearchQuery = res.adminCreatySearchQuery || '';
    adminNormalSearchQuery = res.adminNormalSearchQuery || '';
    loadAdminSelectionSetsFromStorage(res);
    reconcileAdminSelectionSets();
    if (!adminUserSelectionSaved) {
        selectedAdminCreatyAccountIds = [];
        selectedAdminNormalAccountIds = [];
    }
    syncAllAccountSelectedFlagsFromSets();

    console.log('[Autopilot][Selection] loadAPAccounts complete', {
        userSaved: adminUserSelectionSaved,
        normal: [...selectedAdminNormalAccountIds],
        creaty: [...selectedAdminCreatyAccountIds],
        accountCount: autopilotAccounts.length
    });

    if (AP.platformSelect) AP.platformSelect.value = currentPlatform;

    if (AP.proxyPool) AP.proxyPool.value = res.ap_proxy_pool || '';
    if (AP.autoRotate) AP.autoRotate.checked = res.ap_auto_rotate !== false;
    if (AP.visualMode) AP.visualMode.checked = res.ap_visual_mode !== false;
    if (AP.autoLogin) AP.autoLogin.checked = res.ap_auto_login !== false;
    if (AP.designsPer) {
        syncApDesignsPerInputFromParsed(parseApMaxPerAccountValue(res.ap_max_per_account ?? AP.designsPer.value));
    }

    // v40.0.13 — one-time: drop legacy artificial 50 ceiling → unlimited by default
    if (!res.ap_unlimited_capacity_v40_0_13) {
        syncApDesignsPerInputFromParsed({ auto: true, countPer: null });
        let clearedBatch = 0;
        Object.keys(accountsDB).forEach((platformKey) => {
            (accountsDB[platformKey] || []).forEach((acc) => {
                if (acc && acc.batchLimit != null) {
                    acc.batchLimit = null;
                    clearedBatch += 1;
                }
            });
        });
        const migratePayload = {
            ap_unlimited_capacity_v40_0_13: true,
            [AP_MAX_PER_ACCOUNT_STORAGE_KEY]: 'auto',
            ap_accounts_teepublic: accountsDB.teepublic,
            ap_accounts_redbubble: accountsDB.redbubble,
            ap_accounts_amazon: accountsDB.amazon,
            ap_accounts_pinterest: accountsDB.pinterest
        };
        if (currentPlatform === 'teepublic') migratePayload.ap_accounts = accountsDB.teepublic;
        await new Promise((resolve) => chrome.storage.local.set(migratePayload, resolve));
        if (clearedBatch) migrationNeeded = true;
    }

    if (AP.fairDistrib) {
        if (apFairDistributionSessionExplicitOff) {
            AP.fairDistrib.checked = false;
        } else {
            AP.fairDistrib.checked = res.ap_fair_distribution !== false;
            if (!AP.fairDistrib.checked) AP.fairDistrib.checked = true;
        }
    }

    if (migrationNeeded) {
        stripLegacyAccountSelectedFields();
        const payload = {
            ap_accounts_teepublic: accountsDB.teepublic,
            ap_accounts_redbubble: accountsDB.redbubble,
            ap_accounts_amazon: accountsDB.amazon,
            ap_accounts_pinterest: accountsDB.pinterest,
        };
        if (currentPlatform === 'teepublic') payload.ap_accounts = accountsDB.teepublic;
        await new Promise((resolve) => chrome.storage.local.set(payload, resolve));
    }

    apAccountsRenderFp = '';

    if (isAutopilotPanelActive() || isAutopilotUploadBusy(apQueueMonitorState)) {
        renderAPAccounts();
        refreshAutopilotPlatformModeUi();
    }
    } finally {
        adminSelectionLoadInProgress = false;
    }
}

function refreshAutopilotPlatformModeUi() {
    const accountsCard = AP.email?.closest('.glass-card');
    if (!accountsCard) return;

    let note = document.getElementById('ap-platform-mode-note');
    if (!note) {
        note = document.createElement('div');
        note.id = 'ap-platform-mode-note';
        note.style.cssText = 'display:none; margin-bottom:10px; padding:10px 12px; border-radius:10px; font-size:11px; line-height:1.6;';
        const anchor = accountsCard.querySelector('.space-y-3') || accountsCard.firstElementChild;
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(note, anchor);
    }

    const pinterestMode = currentPlatform === 'pinterest';
    const controls = [
        AP.email,
        AP.pass,
        AP.displayNameInput,
        AP.proxy,
        AP.quota,
        AP.nicheMap,
        AP.groupAssign,
        AP.addBtn
    ].filter(Boolean);

    controls.forEach((control) => {
        control.disabled = false;
        control.style.opacity = '1';
        control.style.cursor = '';
    });

    if (note) {
        if (pinterestMode) {
            note.style.display = 'block';
            note.style.background = 'rgba(230, 0, 35, 0.08)';
            note.style.border = '1px solid rgba(230, 0, 35, 0.28)';
            note.style.color = '#fecdd3';
            note.innerHTML = '<strong>وضع Pinterest الجديد:</strong> أصبح يعمل كسيرفر مستقل داخل Autopilot مثل باقي المنصات. يمكنك الآن إضافة حسابات Pinterest أو جلسات مخصصة له ثم تشغيل سيرفر Pinterest على البورت الخاص به قبل بدء الرفع الجماعي.';
            note.innerHTML = '<strong>وضع Pinterest الحالي:</strong> لا يحتاج حسابات داخل Autopilot. سيتم النشر عبر نفس جلسة Chrome المفتوحة التي تحتوي على حساب Pinterest المسجل لديك.';
            note.innerHTML = '<strong>وضع Pinterest الجديد:</strong> أصبح يعمل كسيرفر مستقل داخل Autopilot مثل باقي المنصات. يمكنك الآن إضافة حسابات Pinterest أو جلسات مخصصة له ثم تشغيل سيرفر Pinterest على البورت الخاص به قبل بدء الرفع الجماعي.';
        } else {
            note.style.display = 'none';
            note.textContent = '';
        }
    }
}

function getAccountArraysFromSnapshot(snapshot = {}) {
    return {
        teepublic: Array.isArray(snapshot.ap_accounts_teepublic) ? snapshot.ap_accounts_teepublic : (Array.isArray(snapshot.ap_accounts) ? snapshot.ap_accounts : []),
        redbubble: Array.isArray(snapshot.ap_accounts_redbubble) ? snapshot.ap_accounts_redbubble : [],
        amazon: Array.isArray(snapshot.ap_accounts_amazon) ? snapshot.ap_accounts_amazon : [],
        pinterest: Array.isArray(snapshot.ap_accounts_pinterest) ? snapshot.ap_accounts_pinterest : []
    };
}

function countAccountsInSnapshot(snapshot = {}) {
    const groups = getAccountArraysFromSnapshot(snapshot);
    return groups.teepublic.length + groups.redbubble.length + groups.amazon.length + groups.pinterest.length;
}

function mergeAccountsByEmail(current = [], incoming = []) {
    const byEmail = new Map();
    [...current, ...incoming].forEach((acc) => {
        const emailKey = String(acc?.email || '').trim().toLowerCase();
        if (!emailKey) return;
        byEmail.set(emailKey, { ...(byEmail.get(emailKey) || {}), ...acc });
    });
    return Array.from(byEmail.values());
}

function mergeGroupsById(current = [], incoming = []) {
    const byId = new Map();
    [...current, ...incoming].forEach((group) => {
        const key = String(group?.id || group?.name || '').trim();
        if (!key) return;
        byId.set(key, { ...(byId.get(key) || {}), ...group });
    });
    return Array.from(byId.values());
}

async function getAutopilotBackupSnapshot() {
    const raw = await new Promise((resolve) => chrome.storage.local.get(AUTOPILOT_BACKUP_KEYS, resolve));
    const accountArrays = getAccountArraysFromSnapshot(raw);
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        active_platform: normalizePlatform(raw.active_platform || currentPlatform),
        ap_accounts_teepublic: accountArrays.teepublic,
        ap_accounts_redbubble: accountArrays.redbubble,
        ap_accounts_amazon: accountArrays.amazon,
        ap_accounts_pinterest: accountArrays.pinterest,
        ap_accounts: accountArrays.teepublic,
        ap_groups: Array.isArray(raw.ap_groups) ? raw.ap_groups : autopilotGroups,
        ap_proxy_pool: raw.ap_proxy_pool || '',
        ap_auto_rotate: raw.ap_auto_rotate !== false,
        ap_visual_mode: raw.ap_visual_mode !== false,
        ap_auto_login: raw.ap_auto_login !== false
    };
}

async function applyAutopilotBackupSnapshot(snapshot = {}, { replace = true } = {}) {
    const incomingAccounts = getAccountArraysFromSnapshot(snapshot);
    const incomingGroups = Array.isArray(snapshot.ap_groups) ? snapshot.ap_groups : [];

    let payload = {
        ap_accounts_teepublic: incomingAccounts.teepublic,
        ap_accounts_redbubble: incomingAccounts.redbubble,
        ap_accounts_amazon: incomingAccounts.amazon,
        ap_accounts_pinterest: incomingAccounts.pinterest,
        ap_accounts: incomingAccounts.teepublic,
        ap_groups: incomingGroups,
        ap_proxy_pool: snapshot.ap_proxy_pool || '',
        ap_auto_rotate: snapshot.ap_auto_rotate !== false,
        ap_visual_mode: snapshot.ap_visual_mode !== false,
        ap_auto_login: snapshot.ap_auto_login !== false,
        active_platform: normalizePlatform(snapshot.active_platform || currentPlatform)
    };

    if (!replace) {
        const currentSnapshot = await getAutopilotBackupSnapshot();
        const currentAccounts = getAccountArraysFromSnapshot(currentSnapshot);
        payload = {
            ap_accounts_teepublic: mergeAccountsByEmail(currentAccounts.teepublic, incomingAccounts.teepublic),
            ap_accounts_redbubble: mergeAccountsByEmail(currentAccounts.redbubble, incomingAccounts.redbubble),
            ap_accounts_amazon: mergeAccountsByEmail(currentAccounts.amazon, incomingAccounts.amazon),
            ap_accounts_pinterest: mergeAccountsByEmail(currentAccounts.pinterest, incomingAccounts.pinterest),
            ap_groups: mergeGroupsById(currentSnapshot.ap_groups || [], incomingGroups),
            ap_proxy_pool: currentSnapshot.ap_proxy_pool || snapshot.ap_proxy_pool || '',
            ap_auto_rotate: currentSnapshot.ap_auto_rotate !== false,
            ap_visual_mode: currentSnapshot.ap_visual_mode !== false,
            ap_auto_login: currentSnapshot.ap_auto_login !== false,
            active_platform: normalizePlatform(currentSnapshot.active_platform || currentPlatform)
        };
        payload.ap_accounts = payload.ap_accounts_teepublic;
    }

    await new Promise((resolve) => chrome.storage.local.set(payload, resolve));
    await loadAPAccounts(payload);
    await loadGroups();
    checkServerStatusNow();
    return payload;
}

async function callSessionBackupApi(endpoint, options = {}, timeoutMs = 180000) {
    const candidatePorts = Array.from(new Set([
        SERVER_PORTS[currentPlatform],
        SESSION_BACKUP_FALLBACK_PORT
    ].filter(Boolean)));

    let lastError = null;

    for (const port of candidatePorts) {
        try {
            const response = await fetchWithTimeout(`${await apLocalUrl(port)}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(options.headers || {})
                },
                ...options
            }, timeoutMs);

            let data = {};
            try {
                data = await response.json();
            } catch (_) {
                data = {};
            }

            if (!response.ok || data.success === false) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Session backup server is unavailable');
}

async function exportSessionBackup() {
    const snapshot = await getAutopilotBackupSnapshot();
    const accountCount = countAccountsInSnapshot(snapshot);
    if (!accountCount) {
        showToast('⚠️ لا توجد حسابات لحفظ نسخة احتياطية لها');
        return;
    }

    const shouldContinue = confirm('سيتم إنشاء نسخة احتياطية محلية للحسابات والجلسات. يفضّل إغلاق نوافذ الحسابات المفتوحة أولاً.');
    if (!shouldContinue) return;

    const suggestedName = `autopilot_backup_${new Date().toISOString().slice(0, 10)}`;
    const backupName = (prompt('اسم النسخة الاحتياطية (اختياري):', suggestedName) || suggestedName).trim();

    showToast('💾 جاري إنشاء النسخة الاحتياطية...');
    const data = await callSessionBackupApi('/profiles-backup/export', {
        method: 'POST',
        body: JSON.stringify({ backupName, snapshot })
    }, 600000);

    apLog(`💾 Backup saved: ${data.backupId} | ${data.backupDir}`, 'success');
    showToast(`✅ تم حفظ النسخة الاحتياطية: ${data.backupId}`);
}

async function importSessionBackup() {
    const listData = await callSessionBackupApi('/profiles-backup/list', { method: 'GET' }, 30000);
    const backups = Array.isArray(listData.backups) ? listData.backups : [];
    if (!backups.length) {
        showToast('⚠️ لا توجد نسخ احتياطية متاحة حالياً');
        return;
    }

    const menu = backups.slice(0, 12).map((backup, index) =>
        `${index + 1}. ${backup.backupId} | profiles:${backup.profileCount || 0} | accounts:${backup.accountCount || 0}`
    ).join('\n');

    const pickedValue = prompt(`اختر رقم النسخة التي تريد استعادتها:\n\n${menu}`, '1');
    if (pickedValue === null) return;

    const pickedIndex = parseInt(pickedValue, 10) - 1;
    const selectedBackup = backups[pickedIndex];
    if (!selectedBackup) {
        showToast('⚠️ اختيار غير صالح');
        return;
    }

    const proceed = confirm(`سيتم استرجاع الجلسات من النسخة:\n${selectedBackup.backupId}\n\nأغلق أي نوافذ Chrome للحسابات قبل المتابعة.`);
    if (!proceed) return;

    const replaceAccounts = confirm('اضغط "موافق" لاستبدال الحسابات الحالية بالكامل.\nاضغط "إلغاء" لدمج الحسابات المستوردة مع الحالية.');
    const currentSnapshot = await getAutopilotBackupSnapshot();

    showToast('📥 جاري استيراد النسخة الاحتياطية...');
    const data = await callSessionBackupApi('/profiles-backup/import', {
        method: 'POST',
        body: JSON.stringify({ backupId: selectedBackup.backupId, currentSnapshot })
    }, 600000);

    if (data.snapshot) {
        await applyAutopilotBackupSnapshot(data.snapshot, { replace: replaceAccounts });
    } else {
        await loadAPAccounts();
        await loadGroups();
    }

    apLog(`📥 Restored backup: ${selectedBackup.backupId} | safety: ${data.safetyBackupId || 'n/a'}`, 'success');
    showToast(`✅ تم استيراد النسخة ${replaceAccounts ? 'واستبدال الحسابات' : 'ودمج الحسابات'} بنجاح`);
}

function renderAPAccounts() {
    if (!AP.list) return;
    const panelUi = isAutopilotPanelActive() || isAutopilotUploadBusy(apQueueMonitorState);
    if (!panelUi) return;
    const accountsFp = buildApAccountsFingerprint();
    if (accountsFp === apAccountsRenderFp && editingId == null) return;
    apAccountsRenderFp = accountsFp;
    if (!apQueueMonitorState || !apQueueMonitorState.isRunning) {
        renderFallbackQueueMonitorUnlessPersisted();
    }
    if (autopilotAccounts.length === 0) {
        AP.list.innerHTML = `<div class="text-center py-6 text-xs text-slate-500">
            <i class="fa-solid fa-users-slash text-[20px] mb-2 block opacity-30"></i>
            لا توجد حسابات مضافة حالياً</div>`;
        updateSelectedCount();
        return;
    }

    const filteredAccounts = getFilteredAutopilotAccounts();

    if (filteredAccounts.length === 0) {
        const emptyMsg = activeGroupFilter
            ? 'لا توجد حسابات في هذه المجموعة بعد'
            : 'لا توجد حسابات مضافة حالياً';
        AP.list.innerHTML = `<div class="text-center py-6 text-xs text-slate-500">
            <i class="fa-solid fa-users-slash text-[20px] mb-2 block opacity-30"></i>
            ${emptyMsg}</div>`;
        updateSelectedCount();
        return;
    }

    AP.list.innerHTML = filteredAccounts.map((acc) => {
        const index = autopilotAccounts.indexOf(acc);
        const alias = acc.displayName || acc.storeName || acc.email.split('@')[0];
        const isSelected = isAutopilotAccountSelected(acc);
        const isUploadingActive = isSameApAccount(getActiveUploadAccountFromState(apQueueMonitorState), acc);
        const isVerified = !!acc.verified;
        const runLimit = Number.isFinite(Number(acc.batchLimit)) && Number(acc.batchLimit) > 0 ? Number(acc.batchLimit) : '';
        const dayLimit = Number.isFinite(Number(acc.dailyLimit)) && Number(acc.dailyLimit) > 0 ? Number(acc.dailyLimit) : '';
        const uploadedToday = Number(acc.uploadedTodayCount || 0) || 0;
        const proxyBadge = isVerified
            ? `<span style="font-size:7px; color:#10B981; background:rgba(16,185,129,0.12); padding:1px 5px; border-radius:4px; border:1px solid rgba(16,185,129,0.2);" title="Account linked and verified"><i class="fa-solid fa-shield-halved"></i> Verified</span>`
            : `<span style="font-size:7px; color:#6B7280; background:rgba(107,114,128,0.08); padding:1px 5px; border-radius:4px; border:1px solid rgba(107,114,128,0.15);" title="Account needs verification"><i class="fa-solid fa-globe"></i> Check</span>`;
        const grpInfo = acc.groupId ? autopilotGroups.find(g => g.id === acc.groupId) : null;
        const groupBadge = grpInfo
            ? `<span style="font-size:7px;color:${grpInfo.color};background:${grpInfo.color}18;padding:1px 5px;border-radius:4px;border:1px solid ${grpInfo.color}33;">${grpInfo.emoji} ${grpInfo.name}</span>`
            : '';

        // v16.0 — Account Stats
        const stats = acc.stats || { uploaded: 0, time: 0 };
        const timeStr = stats.time ? `${Math.floor(stats.time / 60)}m ${stats.time % 60}s` : '0m 0s';
        const albumsButton = currentPlatform === 'teepublic'
            ? `<button class="open-ap-albums-btn" data-id="${acc.id}"
                title="فتح صفحة ألبومات TeePublic لهذا الحساب"
                style="width:26px; height:26px; background:rgba(245,158,11,0.1);
                       border:1px solid rgba(245,158,11,0.25); color:#F59E0B;
                       border-radius:7px; display:flex; align-items:center;
                       justify-content:center; cursor:pointer; transition:all 0.2s;
                       font-size:9px;">
              <i class="fa-solid fa-folder-tree"></i>
            </button>`
            : '';
        const statsBadge = `
            <div style="display:flex; align-items:center; gap:5px; margin-top:2px;">
                <span title="تصاميم مرفوعة" style="font-size:7px; color:#A78BFA; background:rgba(167,139,250,0.1); padding:1px 5px; border-radius:4px; border:1px solid rgba(167,139,250,0.2);">
                    <i class="fa-solid fa-cloud-arrow-up"></i> ${stats.uploaded}
                </span>
                <span title="الوقت المستغرق" style="font-size:7px; color:#FBBF24; background:rgba(251,191,36,0.1); padding:1px 5px; border-radius:4px; border:1px solid rgba(251,191,36,0.2);">
                    <i class="fa-solid fa-clock-rotate-left"></i> ${timeStr}
                </span>
            </div>
        `;

        return `
        <div class="ap-acc-card${isUploadingActive ? ' is-active' : ''}"
             data-index="${index}" data-id="${acc.id}"
             style="background: ${isUploadingActive ? 'rgba(129,140,248,0.14)' : (isSelected ? 'rgba(108,99,255,0.07)' : 'rgba(15,12,35,0.5)')};
                    border: 1px solid ${isUploadingActive ? 'rgba(129,140,248,0.55)' : (isSelected ? 'rgba(108,99,255,0.3)' : 'rgba(255,255,255,0.06)')};
                    border-radius: 10px; padding: 9px 10px;
                    display: flex; align-items: center; gap: 8px;
                    transition: all 0.2s; margin-bottom: 6px;">

          ${buildApDragHandleHtml()}

          <!-- Checkbox Selection -->
          <input type="checkbox" class="ap-account-checkbox"
                 data-id="${acc.id}" ${isSelected ? 'checked' : ''}
                 style="width:14px; height:14px; flex-shrink:0; accent-color: var(--primary); cursor:pointer;">

          <!-- Account Info -->
          <div style="flex:1; overflow:hidden;">
            <!-- Alias (double-click to rename) -->
            <div style="display:flex; align-items:center; gap:5px; margin-bottom:2px;">
              <span style="width:6px; height:6px; border-radius:50%; flex-shrink:0;
                           background:${acc.verified ? '#10B981' : '#F59E0B'};
                           box-shadow: 0 0 5px ${acc.verified ? 'rgba(16,185,129,0.5)' : 'rgba(245,158,11,0.5)'};">
              </span>
              <span class="ap-alias-display"
                    data-id="${acc.id}"
                    title="انقر مرتين لتعديل الاسم المستعار"
                    style="font-size:11px; font-weight:800; color:#fff;
                           cursor:pointer; white-space:nowrap; overflow:hidden;
                           text-overflow:ellipsis; max-width:130px;
                           transition: color 0.15s; padding: 1px 3px; border-radius:3px;"
                    onmouseover="this.style.color='var(--primary)'"
                    onmouseout="this.style.color='#fff'">${alias}</span>
            </div>
            <!-- Email + Proxy + Quota -->
            <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
              <span class="ap-acc-email" style="font-size:8px; color:#4B5563; font-family:monospace;
                           white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:110px;"
                    title="${acc.email}">${acc.email}</span>
              ${isUploadingActive ? '<span class="ap-acc-uploading-badge" title="الحساب قيد الرفع الآن">⏳ جاري الرفع</span>' : ''}
              ${proxyBadge}
              ${groupBadge}
              <span style="font-size:7px; color:#374151;">
                <i class="fa-solid fa-calendar-check text-[6px]"></i> ${acc.quota || 50}/يوم
              </span>
            </div>
            ${statsBadge}

            <!-- v16.1 — Limits UI -->
            <div style="display: flex; gap: 10px; margin-top: 5px; font-size: 11px;">
               <label style="display: flex; flex-direction: column; color: #cbd5e1; font-size: 8px;">
                  حد الدفعة:
                  <input type="number" class="ap-batch-limit modern-input" data-id="${acc.id}" value="${acc.batchLimit || ''}" placeholder="بلا حد" style="width: 55px; padding: 2px 4px; border-radius: 4px; background: rgba(108,99,255,0.05); border: 1px solid rgba(108,99,255,0.1); color: #fff; font-size: 9px; margin-top: 2px;">
               </label>
               <label style="display: flex; flex-direction: column; color: #cbd5e1; font-size: 8px;">
                  الحد اليومي:
                  <input type="number" class="ap-daily-limit modern-input" data-id="${acc.id}" value="${acc.dailyLimit || ''}" placeholder="بلا حد" style="width: 55px; padding: 2px 4px; border-radius: 4px; background: rgba(108,99,255,0.05); border: 1px solid rgba(108,99,255,0.1); color: #fff; font-size: 9px; margin-top: 2px;">
               </label>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">

            <!-- Open Browser (v14.0) -->
            <button class="open-ap-browser-btn" data-id="${acc.id}"
                title="فتح متصفح مخصص لهذا الحساب"
                style="width:26px; height:26px; background:rgba(16,185,129,0.1);
                       border:1px solid rgba(16,185,129,0.25); color:#10B981;
                       border-radius:7px; display:flex; align-items:center;
                       justify-content:center; cursor:pointer; transition:all 0.2s;
                       font-size:9px;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </button>

            <!-- Edit -->
            <button class="edit-ap-acc-btn" data-id="${acc.id}"
                title="تعديل بيانات الحساب"
                style="width:26px; height:26px; background:rgba(108,99,255,0.1);
                       border:1px solid rgba(108,99,255,0.25); color:var(--primary);
                       border-radius:7px; display:flex; align-items:center;
                       justify-content:center; cursor:pointer; transition:all 0.2s;
                       font-size:9px;">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>

            <!-- Delete -->
            <button class="remove-ap-acc-btn" data-id="${acc.id}"
                title="حذف الحساب"
                style="width:26px; height:26px; background:rgba(239,68,68,0.08);
                       border:1px solid rgba(239,68,68,0.2); color:#ef4444;
                       border-radius:7px; display:flex; align-items:center;
                       justify-content:center; cursor:pointer; transition:all 0.2s;
                       font-size:9px;">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>`;
    }).join('');

    setupAPDragDrop();
    updateSelectedCount();
}

/**
 * Update the selected count badge (delegates to selection-set override when loaded)
 */
function updateSelectedCount() {
    const el = document.getElementById('ap-selected-count') || AP.selectedCount;
    if (!el) return;
    const total = autopilotAccounts.filter((a) => a.sourceType === activeAdminAccountSourceTab).length;
    const selectedSet = activeAdminAccountSourceTab === 'creaty' ? selectedAdminCreatyAccountIds : selectedAdminNormalAccountIds;
    const selected = selectedSet.length;
    el.textContent = `${selected} / ${total} محدد`;
    el.style.color = selected > 0 ? 'var(--primary)' : '#6B7280';
    el.style.borderColor = selected > 0 ? 'rgba(108,99,255,0.3)' : 'rgba(107,114,128,0.2)';
    el.style.background = selected > 0 ? 'rgba(108,99,255,0.1)' : 'rgba(107,114,128,0.06)';
}

/* ══════════════════════════════════════
   v15.0 — Album Groups Management
   ══════════════════════════════════════ */

async function loadGroups() {
    const res = await new Promise(r => chrome.storage.local.get(['ap_groups'], r));
    if (res.ap_groups && res.ap_groups.length > 0) {
        autopilotGroups = res.ap_groups;
    } else {
        autopilotGroups = [...DEFAULT_GROUPS];
        chrome.storage.local.set({ ap_groups: autopilotGroups });
    }
    renderGroups();
    populateGroupSelect();
}

function saveGroups(cb) {
    chrome.storage.local.set({ ap_groups: autopilotGroups }, () => {
        renderGroups();
        populateGroupSelect();
        if (cb) cb();
    });
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
}

function renderGroups() {
    const grid = document.getElementById('ap-groups-grid');
    if (!grid) return;
    if (autopilotGroups.length === 0) {
        grid.innerHTML = `<div class="col-span-3 text-center py-4 text-xs text-slate-500">
            <i class="fa-solid fa-layer-group text-[22px] mb-2 block opacity-20"></i>
            لا توجد مجموعات — أنشئ مجموعتك الأولى!</div>`;
        return;
    }
    grid.innerHTML = autopilotGroups.map(g => {
        const count = autopilotAccounts.filter(a => a.groupId === g.id).length;
        const isActive = activeGroupFilter === g.id;
        const rgb = hexToRgb(g.color);
        return `
        <div class="ap-group-card" data-gid="${g.id}"
             style="background:${isActive ? `rgba(${rgb},0.14)` : 'rgba(15,12,35,0.65)'};
                    border:1.5px solid ${isActive ? g.color : 'rgba(255,255,255,0.07)'};
                    border-radius:13px;padding:11px 12px;cursor:pointer;
                    transition:all 0.25s;position:relative;overflow:hidden;">
            ${isActive ? `<div style="position:absolute;top:0;right:0;width:70px;height:70px;
                background:radial-gradient(circle at top right,${g.color}30,transparent);
                pointer-events:none;"></div>` : ''}
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:24px;line-height:1;">${g.emoji}</span>
                <div style="display:flex;gap:3px;">
                    <button class="ap-group-assign-accounts-btn" data-gid="${g.id}" title="تعيين حسابات"
                        style="width:21px;height:21px;background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.3);
                               color:#a855f7;border-radius:5px;display:flex;align-items:center;
                               justify-content:center;cursor:pointer;font-size:8px;transition:all 0.2s;">
                        <i class="fa-solid fa-users-plus"></i></button>
                    <button class="ap-group-edit-btn" data-gid="${g.id}" title="تعديل"
                        style="width:21px;height:21px;background:rgba(108,99,255,0.12);border:1px solid rgba(108,99,255,0.25);
                               color:var(--primary);border-radius:5px;display:flex;align-items:center;
                               justify-content:center;cursor:pointer;font-size:8px;transition:all 0.2s;">
                        <i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="ap-group-delete-btn" data-gid="${g.id}" title="حذف"
                        style="width:21px;height:21px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);
                               color:#ef4444;border-radius:5px;display:flex;align-items:center;
                               justify-content:center;cursor:pointer;font-size:8px;transition:all 0.2s;">
                        <i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
            <div style="font-size:11px;font-weight:900;color:#fff;margin-bottom:2px;
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${g.name}</div>
            <div style="font-size:8px;color:#6B7280;margin-bottom:7px;
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${g.desc || ''}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:8px;background:${g.color}18;border-radius:10px;padding:2px 8px;
                              color:${g.color};font-weight:800;border:1px solid ${g.color}33;">
                    ${count} حساب</span>
                <span style="font-size:7px;color:${isActive ? g.color : '#374151'};">${isActive ? '● محدد' : 'اضغط للعرض'}</span>
            </div>
        </div>`;
    }).join('');
}

function populateGroupSelect() {
    const sel = document.getElementById('ap-group-assign');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">📦 بدون مجموعة</option>` +
        autopilotGroups.map(g => `<option value="${g.id}">${g.emoji} ${g.name}</option>`).join('');
    sel.value = cur;
}

function setActiveGroupFilter(groupId) {
    activeGroupFilter = (activeGroupFilter === groupId) ? null : groupId;
    const bar = document.getElementById('ap-group-filter-bar');
    const label = document.getElementById('ap-active-group-label');
    if (bar && label) {
        if (activeGroupFilter) {
            const g = autopilotGroups.find(g => g.id === activeGroupFilter);
            bar.classList.remove('hidden');
            label.textContent = g ? `${g.emoji} ${g.name}` : '';
        } else {
            bar.classList.add('hidden');
        }
    }
    renderGroups();
    renderAPAccounts();
}

function deleteGroup(groupId) {
    autopilotAccounts.forEach(a => { if (a.groupId === groupId) a.groupId = ''; });
    autopilotGroups = autopilotGroups.filter(g => g.id !== groupId);
    if (activeGroupFilter === groupId) activeGroupFilter = null;
    document.getElementById('ap-group-filter-bar')?.classList.add('hidden');
    chrome.storage.local.set({ ap_groups: autopilotGroups }, () => {
        saveCurrentAccounts(() => {
            renderGroups();
            renderAPAccounts();
            populateGroupSelect();
            showToast('🗑️ تم حذف المجموعة');
        });
    });
}

/* ══════════════════════════════════════
   v15.1 — Group Account Assign Modal
   ══════════════════════════════════════ */

function openGroupAssignModal(groupId) {
    _modalGroupId = groupId;
    const g = autopilotGroups.find(g => g.id === groupId);
    if (!g) return;
    document.getElementById('ap-modal-group-title').textContent = `${g.emoji} ${g.name}`;
    document.getElementById('ap-modal-search').value = '';
    renderModalAccounts('');
    const modal = document.getElementById('ap-group-assign-modal');
    if (modal) { modal.style.display = 'flex'; }
}

function renderModalAccounts(query) {
    const list = document.getElementById('ap-modal-accounts-list');
    if (!list) return;
    const q = query.toLowerCase();
    const filtered = autopilotAccounts.filter(acc => {
        if (!q) return true;
        const alias = (acc.displayName || acc.storeName || acc.email.split('@')[0]).toLowerCase();
        return alias.includes(q) || acc.email.toLowerCase().includes(q);
    });
    document.getElementById('ap-modal-total').textContent = filtered.length;
    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:20px;font-size:11px;color:#6B7280;">
            <i class="fa-solid fa-users-slash" style="font-size:20px;display:block;margin-bottom:8px;opacity:0.3;"></i>
            لا توجد حسابات مضافة بعد</div>`;
        updateModalCounter();
        return;
    }
    list.innerHTML = filtered.map(acc => {
        const alias = acc.displayName || acc.storeName || acc.email.split('@')[0];
        const isInGroup = acc.groupId === _modalGroupId;
        const otherGrp = (acc.groupId && acc.groupId !== _modalGroupId)
            ? autopilotGroups.find(g => g.id === acc.groupId) : null;
        return `
        <div class="ap-modal-acc-row" style="display:flex;align-items:center;gap:8px;padding:7px 10px;
                     background:${isInGroup ? 'rgba(168,85,247,0.08)' : 'rgba(15,12,35,0.5)'};
                     border:1px solid ${isInGroup ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.06)'};
                     border-radius:10px;transition:background 0.15s,border-color 0.15s;cursor:pointer;">
            <input type="checkbox" class="ap-modal-acc-checkbox" data-id="${acc.id}"
                   ${isInGroup ? 'checked' : ''}
                   style="width:15px;height:15px;accent-color:#a855f7;flex-shrink:0;cursor:pointer;">
            <div style="flex:1;overflow:hidden;">
                <div style="font-size:11px;font-weight:800;color:#fff;white-space:nowrap;
                            overflow:hidden;text-overflow:ellipsis;">${alias}</div>
                <div style="display:flex;align-items:center;gap:4px;margin-top:1px;">
                    <span style="font-size:8px;color:#4B5563;font-family:monospace;
                                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;"
                          title="${acc.email}">${acc.email}</span>
                    ${otherGrp ? `<span style="font-size:7px;color:${otherGrp.color};background:${otherGrp.color}18;
                        padding:1px 5px;border-radius:4px;border:1px solid ${otherGrp.color}33;">
                        ${otherGrp.emoji} ${otherGrp.name}</span>` : ''}
                </div>
            </div>
            ${isInGroup ? `<i class="fa-solid fa-circle-check" style="color:#a855f7;font-size:11px;flex-shrink:0;"></i>` : ''}
        </div>`;
    }).join('');
    updateModalCounter();
}

function updateModalCounter() {
    const checked = document.querySelectorAll('.ap-modal-acc-checkbox:checked').length;
    const counterEl = document.getElementById('ap-modal-counter');
    if (counterEl) counterEl.textContent = checked;
}

function closeGroupModal() {
    const modal = document.getElementById('ap-group-assign-modal');
    if (modal) modal.style.display = 'none';
    _modalGroupId = null;
}

function styleModalRow(cb, isChecked) {
    const row = cb.closest('.ap-modal-acc-row');
    if (!row) return;
    row.style.background = isChecked ? 'rgba(168,85,247,0.08)' : 'rgba(15,12,35,0.5)';
    row.style.borderColor = isChecked ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.06)';
}

/**
 * Open a dedicated browser session for a specific account via Ghost Server
 */
async function openAccountBrowser(acc, options = {}) {
    const alias = acc.displayName || acc.storeName || acc.email.split('@')[0];
    const targetUrl = options.targetUrl || null;
    const reportServerUnavailable = () => {
        apLog(`❌ تعذر فتح جلسة Ghost Server للحساب: ${alias}`, 'error');
        showToast('❌ تعذر فتح جلسة الحساب عبر Ghost Server. لم يتم تشغيل أي مشغل خارجي.');
    };
    apLog(`🌐 فتح جلسة يدوية لحساب: ${alias} (${acc.email})`, 'info');
    showToast(`🌐 جاري فتح متصفح لـ: ${alias}...`);

    // Try Ghost Server first (persistent profile = same fingerprint)
    try {
        const res = await fetchWithTimeout(await apLocalUrl(SERVER_PORTS[currentPlatform] || 3019, '/browse-account'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: acc.email,
                pass: acc.pass,
                proxy: acc.proxy || null,
                autoLogin: AP.autoLogin?.checked ?? true,
                targetUrl
            })
        }, 8000);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success !== false) {
            apLog(`✅ تم فتح متصفح خاص ببصمة الحساب: ${alias}`, 'success');
            showToast(`✅ تم فتح المتصفح بنجاح!`);
            return;
        }
    } catch (_) {
        // Keep the account in its Ghost profile; never fall back to an external launcher.
    }

    reportServerUnavailable();
}

let apDraggedAccountId = null;

function buildApDragHandleHtml() {
    return `<span class="ap-drag-handle" draggable="true" title="اسحب لإعادة الترتيب" aria-label="اسحب لإعادة الترتيب">
      <i class="fa-solid fa-grip-vertical" aria-hidden="true"></i>
    </span>`;
}

function clearApDragVisualState() {
    if (!AP.list) return;
    AP.list.querySelectorAll('.ap-acc-card.ap-dragging, .ap-acc-card.ap-drag-over').forEach((el) => {
        el.classList.remove('ap-dragging', 'ap-drag-over');
        el.style.opacity = '';
    });
}

function bindApAccountListDragDrop() {
    if (!AP.list || AP.list.dataset.apDragDropBound === '1') return;
    AP.list.dataset.apDragDropBound = '1';

    AP.list.addEventListener('dragstart', (e) => {
        const handle = e.target.closest('.ap-drag-handle');
        if (!handle || !AP.list.contains(handle)) return;
        const card = handle.closest('.ap-acc-card');
        if (!card) return;
        apDraggedAccountId = card.dataset.id || null;
        if (!apDraggedAccountId) return;
        e.dataTransfer.setData('text/plain', apDraggedAccountId);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('ap-dragging');
        requestAnimationFrame(() => { card.style.opacity = '0.45'; });
    });

    AP.list.addEventListener('dragend', () => {
        apDraggedAccountId = null;
        clearApDragVisualState();
    });

    AP.list.addEventListener('dragover', (e) => {
        if (!apDraggedAccountId) return;
        const card = e.target.closest('.ap-acc-card');
        if (!card || !AP.list.contains(card)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const prev = AP.list.querySelector('.ap-acc-card.ap-drag-over');
        if (prev && prev !== card) prev.classList.remove('ap-drag-over');
        card.classList.add('ap-drag-over');
    });

    AP.list.addEventListener('dragleave', (e) => {
        const card = e.target.closest('.ap-acc-card');
        if (!card) return;
        const related = e.relatedTarget;
        if (related && card.contains(related)) return;
        card.classList.remove('ap-drag-over');
    });

    AP.list.addEventListener('drop', (e) => {
        const card = e.target.closest('.ap-acc-card');
        if (!card || !AP.list.contains(card)) return;
        e.preventDefault();
        const fromId = apDraggedAccountId || e.dataTransfer.getData('text/plain');
        const toId = card.dataset.id || null;
        apDraggedAccountId = null;
        clearApDragVisualState();
        if (!fromId || !toId || String(fromId) === String(toId)) return;

        const fromIndex = autopilotAccounts.findIndex((acc) => String(acc.id) === String(fromId));
        const toIndex = autopilotAccounts.findIndex((acc) => String(acc.id) === String(toId));
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

        const item = autopilotAccounts.splice(fromIndex, 1)[0];
        autopilotAccounts.splice(toIndex, 0, item);
        apAccountsRenderFp = '';
        saveCurrentAccounts(renderAPAccounts);
    });
}

function setupAPDragDrop() {
    bindApAccountListDragDrop();
}

async function removeAPAccount(id, options = {}) {
    const { skipConfirm = false, bulk = false, deferRender = false } = options;
    const acc = resolveAccountById(id);
    if (!acc) {
        console.warn('[Autopilot] Delete account failed: not found', {
            id,
            platform: currentPlatform,
            tab: activeAdminAccountSourceTab
        });
        if (!bulk) showToast('⚠️ تعذر العثور على الحساب المطلوب حذفه');
        return false;
    }

    const label = acc.displayName || acc.storeName || acc.email || String(acc.id);
    if (!skipConfirm && !bulk) {
        const confirmed = confirm(`🗑️ هل أنت متأكد من حذف الحساب "${label}" نهائياً؟`);
        if (!confirmed) return false;
    }

    const needle = String(acc.id);
    autopilotAccounts = autopilotAccounts.filter((a) => String(a.id) !== needle);
    accountsDB[currentPlatform] = autopilotAccounts;
    purgeRemovedAccountsFromSelectionSets([acc.id]);
    apAccountsRenderFp = '';

    if (editingId && String(editingId) === needle) {
        editingId = null;
        if (AP.addBtn) {
            AP.addBtn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> التحقق وحفظ الحساب';
            AP.addBtn.style.background = '';
        }
    }

    try {
        await saveCurrentAccounts();
        if (adminUserSelectionSaved) {
            await persistAdminSelectionState();
        }
        if (!deferRender) renderAPAccounts();
        if (!bulk) showToast(`🗑️ تم إزالة الحساب: ${label}`);
        return true;
    } catch (err) {
        console.warn('[Autopilot] Delete account failed during save', {
            id: needle,
            email: acc.email,
            error: err?.message || String(err)
        });
        if (!bulk) showToast('❌ فشل حذف الحساب — حاول مرة أخرى');
        return false;
    }
}

/**
 * Event Listeners
 */

// ══ v13.0 — Ghost Server Monitor ══
let _serverMonitorTimer = null;
let _serverCheckInFlight = null;
let _wakeServerPending = false;
let _lastServerStatusSignature = '';
let _ghostServerOnline = false;

function setServerStatus(isOnline, port, source = 'unknown') {
    const nextStatusSignature = `${currentPlatform}|${port || ''}|${source}|${isOnline ? '1' : '0'}`;
    const statusChanged = nextStatusSignature !== _lastServerStatusSignature;
    _lastServerStatusSignature = nextStatusSignature;
    if (!isGhostServerPlatform(currentPlatform)) {
        if (AP.serverDot) {
            AP.serverDot.style.background = 'radial-gradient(circle, #fbbf24, #f59e0b)';
            AP.serverDot.style.boxShadow = '0 0 8px rgba(245,158,11,0.45)';
            AP.serverDot.title = `Pinterest mode | Social Publisher | ${source}`;
        }
        if (AP.serverStatusText) {
            AP.serverStatusText.textContent = 'Social Mode';
            AP.serverStatusText.style.color = '#fbbf24';
            AP.serverStatusText.title = 'Pinterest does not use Ghost Server in Autopilot';
            AP.serverStatusText.dataset.platform = currentPlatform;
            AP.serverStatusText.dataset.port = '';
            AP.serverStatusText.dataset.source = source;
            AP.serverStatusText.dataset.online = 'false';
        }
        if (AP.startBtn && !isAutopilotUploadBusy(apQueueMonitorState)) {
            AP.startBtn.disabled = false;
            AP.startBtn.title = 'Pinterest داخل Autopilot يحوّلك إلى لوحة Social Publisher بدلاً من Ghost Server';
        }
        if (AP.wakeupBtn) {
            AP.wakeupBtn.disabled = true;
            AP.wakeupBtn.title = 'لا يوجد Ghost Server خاص بـ Pinterest حالياً';
        }
        if (AP.serverStopBtn) {
            AP.serverStopBtn.disabled = true;
            AP.serverStopBtn.title = 'لا يوجد Ghost Server خاص بـ Pinterest حالياً';
        }
        return;
    }

    if (statusChanged) {
        console.log('[Autopilot][ServerStatus]', {
            platform: currentPlatform,
            port,
            source,
            isOnline,
            hasDot: !!AP.serverDot,
            hasLabel: !!AP.serverStatusText
        });
    }
    if (AP.serverDot) {
        AP.serverDot.style.background = isOnline
            ? 'radial-gradient(circle, #34d399, #059669)'
            : 'radial-gradient(circle, #f87171, #dc2626)';
        AP.serverDot.style.boxShadow = isOnline
            ? '0 0 8px rgba(52,211,153,0.7)'
            : '0 0 8px rgba(248,113,113,0.6)';
        AP.serverDot.title = `Ghost Server ${currentPlatform} @ ${port} | ${source} | ${isOnline ? 'ONLINE' : 'OFFLINE'}`;
    }
    if (AP.serverStatusText) {
        AP.serverStatusText.textContent = isOnline ? '\u0645\u062a\u0635\u0644' : '\u063a\u064a\u0631 \u0645\u062a\u0635\u0644';
        AP.serverStatusText.style.color = isOnline ? '#34d399' : '#f87171';
        AP.serverStatusText.title = `platform=${currentPlatform}, port=${port}, source=${source}, online=${isOnline}`;
        AP.serverStatusText.dataset.platform = currentPlatform;
        AP.serverStatusText.dataset.port = String(port || '');
        AP.serverStatusText.dataset.source = source;
        AP.serverStatusText.dataset.online = String(!!isOnline);
    }
    if (AP.startBtn) {
        const isRunning = isAutopilotUploadBusy(apQueueMonitorState);
        _ghostServerOnline = !!isOnline;
        if (!isRunning) {
            AP.startBtn.disabled = false;
            AP.startBtn.classList.toggle('ap-start-offline', !isOnline);
            AP.startBtn.style.opacity = !isOnline ? '0.55' : '';
            AP.startBtn.title = isOnline ? AP_START_BTN_IDLE_TITLE : '⚠️ Ghost Server غير متصل — اضغط تشغيل السيرفر أولاً';
        }
    }
    if (AP.wakeupBtn) {
        AP.wakeupBtn.disabled = false;
        AP.wakeupBtn.title = isOnline
            ? 'إعادة تشغيل Ghost Server إذا احتجت لذلك'
            : 'تشغيل Ghost Server من داخل Autopilot';
    }
    if (AP.serverStopBtn) {
        AP.serverStopBtn.disabled = !isOnline;
        AP.serverStopBtn.title = isOnline
            ? 'إيقاف Ghost Server'
            : 'زر الإيقاف يتفعّل بعد اتصال السيرفر';
    }
}

function showServerPermissionHint(serverLabel = 'Ghost Server') {
    const msg = `🛡️ إذا ظهرت نافذة من Chrome للسماح بفتح تطبيق خارجي لتشغيل ${serverLabel}، وافق عليها مرة واحدة.`;
    apLog(msg, 'info');
    showToast(msg);
}

async function checkServerStatusNow() {
    if (_serverCheckInFlight) return _serverCheckInFlight;

    _serverCheckInFlight = (async () => {
    const resolvedPlatform = normalizePlatform(AP.platformSelect?.value || currentPlatform);
    if (resolvedPlatform !== currentPlatform) currentPlatform = resolvedPlatform;
    if (!isGhostServerPlatform(resolvedPlatform)) {
        setServerStatus(false, null, 'social-publisher');
        return;
    }
    const port = SERVER_PORTS[resolvedPlatform] || 3019;
    const gc = typeof globalThis !== 'undefined' ? globalThis.NhpGhostConnect : null;
    if (gc?.probePortWithRetry) {
        const probed = await gc.probePortWithRetry(port, {
            attempts: gc.RETRY?.ATTEMPTS ?? 3,
            delayMs: gc.RETRY?.DELAY_MS ?? 2000,
            timeoutMs: 3000,
            onRetry: () => {
                if (AP.serverStatusText) {
                    AP.serverStatusText.textContent = 'جاري الاتصال...';
                    AP.serverStatusText.style.color = '#fbbf24';
                }
            }
        });
        if (probed?.ok) {
            setServerStatus(true, port, 'direct-ping');
            return;
        }
    } else {
        try {
            const res = await fetchWithTimeout(await apLocalUrl(port, '/ping'), {}, 3000);
            if (res.ok) {
                setServerStatus(true, port, 'direct-ping');
                return;
            }
        } catch (err) {
            console.warn('[Autopilot][ServerCheck] direct ping failed', err);
        }
    }

    try {
        const bgStatus = await getServerStatusViaBackground(resolvedPlatform);
        if (bgStatus && bgStatus.success) {
            setServerStatus(!!bgStatus.online, port, bgStatus.source || 'background');
            return;
        }
    } catch (err) {
        console.warn('[Autopilot][ServerCheck] background failed', err);
    }

    try {
        const managerRes = await fetchWithTimeout(await apLocalUrl(3009, '/api/status'), {}, 3000);
        const status = await managerRes.json();
        setServerStatus(status?.[resolvedPlatform] === 'ONLINE', port, 'manager-fallback');
    } catch (err) {
        console.warn('[Autopilot][ServerCheck] manager fallback failed', err);
        setServerStatus(false, port, 'all-failed');
    }
    })();

    try {
        return await _serverCheckInFlight;
    } finally {
        _serverCheckInFlight = null;
    }
}

function startServerMonitor() {
    if (_serverMonitorTimer) return;
    checkServerStatusNow();
    _serverMonitorTimer = setInterval(() => {
        const autopilotPanel = document.getElementById('panel-autopilot');
        const isPanelActive = !!(autopilotPanel && autopilotPanel.classList.contains('active'));
        const isRunning = isAutopilotUploadBusy(apQueueMonitorState);
        const isWakePending = !!_wakeServerPending;

        if (document.hidden && !isRunning && !isWakePending) return;
        if (!isPanelActive && !isRunning && !isWakePending) return;

        checkServerStatusNow();
    }, 12000);
}

function rebindWakeupButton() {
    if (!AP.wakeupBtn) return;

    const replacement = AP.wakeupBtn.cloneNode(true);
    AP.wakeupBtn.replaceWith(replacement);
    AP.wakeupBtn = replacement;

    AP.wakeupBtn.addEventListener('click', async () => {
        const port = SERVER_PORTS[currentPlatform];
        if (!port) {
            showToast('⚠️ لا يوجد سيرفر مخصص لهذه المنصة حالياً.');
            return;
        }
        if (_wakeServerPending) {
            apLog('⏳ توجد محاولة تشغيل للسيرفر قيد التنفيذ بالفعل', 'info');
            return;
        }

        _wakeServerPending = true;
        AP.wakeupBtn.disabled = true;
        const serverLabel = currentPlatform === 'teepublic' ? 'سيرفر تيبابلك' : 'Ghost Server';
        apLog(`🔌 جارٍ تشغيل ${serverLabel}...`);
        showToast(`⚡ جارٍ تشغيل ${serverLabel}...`);

        try {
            const wakeResult = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'wake_server', platform: currentPlatform, port }, (response) => {
                    resolve(response || null);
                });
            });

            if (wakeResult?.permissionRequired) {
                showServerPermissionHint(serverLabel);
            }

            if (wakeResult?.success === false && !wakeResult?.pending) {
                const errMsg = wakeResult?.error || 'تعذر إرسال أمر تشغيل السيرفر';
                apLog(`❌ ${errMsg}`, 'error');
                showToast(`❌ ${errMsg}`);
                _wakeServerPending = false;
                AP.wakeupBtn.disabled = false;
                return;
            }
        } catch (_) { }

        setTimeout(async () => {
            try {
                const res = await fetchWithTimeout(await apLocalUrl(port, '/ping'), {}, 3000);
                if (res.ok) {
                    setServerStatus(true, port);
                    apLog(`✅ ${serverLabel} اتصل بنجاح!`, 'success');
                    showToast(`✅ ${serverLabel} جاهز!`);
                } else {
                    apLog('⚠️ السيرفر لم يستجب، انتظر قليلاً', 'error');
                }
            } catch {
                apLog('❌ السيرفر لم يستجب، شغّل Start_Server_Setup.cmd مرة واحدة ثم أعد المحاولة', 'error');
            } finally {
                _wakeServerPending = false;
                AP.wakeupBtn.disabled = false;
            }
        }, 6000);
    });
}

function getTargetDestination() {
    const select = document.getElementById('operation-location-select');
    const val = select ? select.value : 'active-tab';
    
    let sourceType = activeAdminAccountSourceTab;
    let groupId = '';
    let createNewGroup = false;
    let newGroupName = '';

    if (val === 'creaty-tab') {
        sourceType = 'creaty';
    } else if (val === 'normal-tab') {
        sourceType = 'normal';
    } else if (val === 'existing-group') {
        const groupSel = document.getElementById('operation-group-select');
        groupId = groupSel ? groupSel.value : '';
    } else if (val === 'new-group') {
        createNewGroup = true;
        const newGroupInput = document.getElementById('operation-new-group-name');
        newGroupName = newGroupInput ? newGroupInput.value.trim() : '';
    }
    
    return { sourceType, groupId, createNewGroup, newGroupName };
}

async function handleToolbarCopy() {
    const activeSelSet = getActiveSelectionSet();
    if (activeSelSet.length === 0) {
        return showToast('⚠️ يرجى تحديد حساب واحد على الأقل للنسخ');
    }

    const { sourceType, groupId, createNewGroup, newGroupName } = getTargetDestination();
    
    if (!groupId && !createNewGroup && sourceType === activeAdminAccountSourceTab) {
        return showToast('⚠️ المصدر والوجهة متطابقان. يرجى اختيار وجهة مختلفة.');
    }

    if (sourceType !== activeAdminAccountSourceTab) {
        const confirmChange = confirm(`⚠️ تنبيه: أنت تقوم بنسخ حسابات من نوع (${activeAdminAccountSourceTab.toUpperCase()}) إلى نوع (${sourceType.toUpperCase()}).\nهل تريد تأكيد تغيير نوع الحسابات وتصنيفها الجديد؟`);
        if (!confirmChange) return;
    }

    let targetGroupId = groupId;
    if (createNewGroup) {
        if (!newGroupName) {
            return showToast('⚠️ يرجى إدخال اسم المجموعة الجديدة');
        }
        const newG = {
            id: 'g_' + Math.random().toString(36).substr(2, 6),
            name: newGroupName,
            emoji: '📦',
            color: '#a855f7',
            desc: 'مجموعة منشأة تلقائياً أثناء النسخ'
        };
        autopilotGroups.push(newG);
        targetGroupId = newG.id;
        await new Promise(resolve => saveGroups(resolve));
        const newGroupInput = document.getElementById('operation-new-group-name');
        if (newGroupInput) newGroupInput.value = '';
    }

    const selectedAccounts = autopilotAccounts.filter((acc) => isAccountIdInSelectionSet(acc.id, activeSelSet));
    let copiedCount = 0;
    let skippedDuplicates = 0;

    selectedAccounts.forEach(acc => {
        const dup = autopilotAccounts.find(a => a.email.toLowerCase() === acc.email.toLowerCase() && a.sourceType === sourceType);
        if (dup) {
            skippedDuplicates++;
            return;
        }

        const newAcc = {
            ...acc,
            id: 'acc_' + Math.random().toString(36).substr(2, 9),
            sourceType: sourceType,
            groupId: targetGroupId || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        delete newAcc.selected;
        autopilotAccounts.push(newAcc);
        copiedCount++;
    });

    await saveCurrentAccounts();
    renderAPAccounts();
    
    alert(`📊 ملخص عملية النسخ:\n------------------------\n✅ الحسابات التي تم نسخها بنجاح: ${copiedCount}\n⚠️ مكررات تم تخطيها: ${skippedDuplicates}`);
}

function parseImportedContent(text, destinationSourceType, destinationGroupId) {
    let imported = [];
    text = text.trim();
    
    if (text.startsWith('[') || text.startsWith('{')) {
        try {
            const parsed = JSON.parse(text);
            const rawArr = Array.isArray(parsed) ? parsed : [parsed];
            rawArr.forEach(item => {
                if (item.email && item.pass) {
                    imported.push({
                        id: 'acc_' + Math.random().toString(36).substr(2, 9),
                        email: String(item.email).trim(),
                        pass: String(item.pass).trim(),
                        proxy: item.proxy ? String(item.proxy).trim() : '',
                        quota: item.quota ? parseInt(item.quota) : (item.dailyLimit ? parseInt(item.dailyLimit) : 50),
                        dailyLimit: item.dailyLimit ? parseInt(item.dailyLimit) : (item.quota ? parseInt(item.quota) : 50),
                        storeName: item.storeName ? String(item.storeName).trim() : (item.displayName ? String(item.displayName).trim() : 'Store'),
                        displayName: item.displayName ? String(item.displayName).trim() : '',
                        verified: item.verified !== false,
                        sourceType: destinationSourceType,
                        groupId: destinationGroupId,
                        createdAt: item.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            });
            return imported;
        } catch (e) {
            console.log('Not valid JSON, trying CSV/TXT...');
        }
    }

    const lines = text.split(/\r?\n/).filter(line => line.trim());
    lines.forEach(line => {
        let parts = [];
        if (line.includes('|')) {
            parts = line.split('|');
        } else if (line.includes(',')) {
            parts = line.split(',');
        } else {
            parts = line.split('\t');
        }

        if (parts.length >= 2) {
            const email = parts[0].trim();
            const pass = parts[1].trim();
            if (email.includes('@') && pass) {
                const proxy = parts[2] ? parts[2].trim() : '';
                const quota = parts[3] ? parseInt(parts[3].trim()) : 50;
                const storeName = parts[4] ? parts[4].trim() : 'Store';
                imported.push({
                    id: 'acc_' + Math.random().toString(36).substr(2, 9),
                    email,
                    pass,
                    proxy,
                    quota: isNaN(quota) ? 50 : quota,
                    dailyLimit: isNaN(quota) ? 50 : quota,
                    storeName,
                    displayName: '',
                    verified: true,
                    sourceType: destinationSourceType,
                    groupId: destinationGroupId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        }
    });

    return imported;
}

async function handleToolbarAdd() {
    let email = AP.email.value.trim();
    let pass = AP.pass.value.trim();
    let proxy = AP.proxy.value.trim();
    let displayName = AP.displayNameInput?.value.trim() || '';

    if (!email || !pass) {
        const inputStr = prompt('الرجاء إدخال بيانات الحساب بالصيغة التالية:\nemail|password|proxy (اختياري)\nمثال:\nuser@example.com|pass123|1.1.1.1:8080');
        if (!inputStr) return;
        const parts = inputStr.split('|');
        if (parts.length >= 2) {
            email = parts[0].trim();
            pass = parts[1].trim();
            if (parts[2]) proxy = parts[2].trim();
        } else {
            return showToast('⚠️ صيغة الإدخال غير صالحة');
        }
    }

    if (!email || !pass) {
        return showToast('⚠️ البريد وكلمة المرور مطلوبان');
    }

    const { sourceType, groupId, createNewGroup, newGroupName } = getTargetDestination();

    let targetGroupId = groupId;
    if (createNewGroup) {
        if (!newGroupName) {
            return showToast('⚠️ يرجى إدخال اسم المجموعة الجديدة');
        }
        const newG = {
            id: 'g_' + Math.random().toString(36).substr(2, 6),
            name: newGroupName,
            emoji: '📦',
            color: '#a855f7',
            desc: 'مجموعة منشأة تلقائياً أثناء الإضافة'
        };
        autopilotGroups.push(newG);
        targetGroupId = newG.id;
        await new Promise(resolve => saveGroups(resolve));
        const newGroupInput = document.getElementById('operation-new-group-name');
        if (newGroupInput) newGroupInput.value = '';
    }

    const dup = autopilotAccounts.find(a => a.email.toLowerCase().trim() === email.toLowerCase().trim() && a.sourceType === sourceType);
    if (dup) {
        return showToast('⚠️ هذا الحساب موجود بالفعل في هذه الفئة!');
    }

    const storeName = displayName || (email.split('@')[0] + "_Store");
    const newAcc = {
        id: 'acc_' + Math.random().toString(36).substr(2, 9),
        email,
        pass,
        proxy,
        quota: 50,
        dailyLimit: 50,
        nicheMapping: 'all',
        displayName,
        storeName,
        groupId: targetGroupId || '',
        category: targetGroupId === 'g_artisan' ? 'artisan' : 'active',
        verified: true,
        sourceType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    ensureAccountCategory(newAcc);
    autopilotAccounts.push(newAcc);

    await saveCurrentAccounts();
    renderAPAccounts();

    AP.email.value = '';
    AP.pass.value = '';
    AP.proxy.value = '';
    if (AP.displayNameInput) AP.displayNameInput.value = '';

    showToast(`✅ تم إضافة الحساب: ${storeName}`);
}

async function handleToolbarRemove() {
    const activeSelSet = getActiveSelectionSet();
    if (activeSelSet.length === 0) {
        return showToast('⚠️ يرجى تحديد حساب واحد على الأقل للإزالة');
    }

    const confirmDel = confirm(`🗑️ هل أنت متأكد من حذف الحسابات المحددة عدد (${activeSelSet.length}) نهائياً؟`);
    if (!confirmDel) return;

    const idsToRemove = [...activeSelSet];
    let removedCount = 0;

    for (const id of idsToRemove) {
        const removed = await removeAPAccount(id, { skipConfirm: true, bulk: true, deferRender: true });
        if (removed) removedCount += 1;
    }

    activeSelSet.length = 0;
    accountsDB[currentPlatform] = autopilotAccounts;
    await saveCurrentAccounts();
    if (adminUserSelectionSaved) {
        await persistAdminSelectionState();
    }
    renderAPAccounts();
    showToast(`🗑️ تم إزالة ${removedCount} حساب بنجاح.`);
}

function handleToolbarBackup() {
    const activeSelSet = getActiveSelectionSet();
    
    let toExport = [];
    if (activeSelSet.length > 0) {
        toExport = autopilotAccounts.filter((acc) => isAccountIdInSelectionSet(acc.id, activeSelSet));
    } else {
        toExport = autopilotAccounts.filter(acc => acc.sourceType === activeAdminAccountSourceTab);
    }

    if (toExport.length === 0) {
        return showToast('⚠️ لا توجد حسابات للتصدير في هذا القسم');
    }

    const content = JSON.stringify(toExport, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
    
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const filename = `accounts-backup-admin-${activeAdminAccountSourceTab}-${dateStr}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    showToast(`📤 تم تصدير نسخة احتياطية لعدد ${toExport.length} حساب`);
}

function populateApAccountFormForEdit(acc) {
    if (!acc) return;
    AP.email.value = acc.email || '';
    AP.pass.value = acc.pass || '';
    AP.proxy.value = acc.proxy || '';
    AP.quota.value = acc.dailyLimit || acc.quota || 50;
    if (AP.nicheMap) AP.nicheMap.value = acc.nicheMapping || 'all';
    if (AP.displayNameInput) AP.displayNameInput.value = acc.displayName || '';
    if (AP.groupAssign) AP.groupAssign.value = acc.groupId || '';
    editingId = acc.id;
    if (AP.addBtn) {
        AP.addBtn.innerHTML = '<i class="fa-solid fa-save"></i> حفظ التعديلات وتحديث الحساب';
        AP.addBtn.style.background = 'linear-gradient(135deg, #10B981, #059669)';
    }
}

function switchApMainTab(tabName) {
    const isList = tabName === 'list';
    const listBtn = document.getElementById('ap-main-tab-list-btn');
    const detailsBtn = document.getElementById('ap-main-tab-details-btn');
    const listPanel = document.getElementById('ap-main-tab-panel-list');
    const detailsPanel = document.getElementById('ap-main-tab-panel-details');
    if (!listBtn || !detailsBtn || !listPanel || !detailsPanel) return;
    listBtn.classList.toggle('is-active', isList);
    detailsBtn.classList.toggle('is-active', !isList);
    listBtn.setAttribute('aria-selected', isList ? 'true' : 'false');
    detailsBtn.setAttribute('aria-selected', !isList ? 'true' : 'false');
    listPanel.classList.toggle('is-active', isList);
    detailsPanel.classList.toggle('is-active', !isList);
    listPanel.hidden = !isList;
    detailsPanel.hidden = isList;
}

function bindApStartButton() {
    AP.startBtn = document.getElementById('ap-start-btn') || AP.startBtn;
    if (!AP.startBtn) {
        console.warn('[AP] ap-start-btn not found — start handler not bound');
        return;
    }
    if (AP.startBtn.dataset.apStartBound === '1') return;
    AP.startBtn.dataset.apStartBound = '1';
    AP.startBtn.addEventListener('click', () => {
        if (isAutopilotUploadBusy(apQueueMonitorState)) {
            void handleApStopClick();
        } else {
            void handleApStartClick();
        }
    });
}

let _apUploadConfirmResolver = null;
let _apUploadConfirmState = null;

function previewSequentialUploadAssignment(designCount, accounts, effectiveCountPer) {
    const assigned = [];
    let remaining = Math.max(0, Number(designCount) || 0);
    const list = Array.isArray(accounts) ? accounts : [];
    for (const acc of list) {
        const cap = computeApAccountUploadLimit(acc, effectiveCountPer);
        const count = Math.min(Math.max(0, cap), remaining);
        assigned.push(count);
        remaining -= count;
    }
    while (assigned.length < list.length) assigned.push(0);
    return { assigned, unassigned: remaining };
}

function buildApUploadStartPreview(uploadAccounts, designCount, effectiveCountPer, options = {}) {
    const accounts = Array.isArray(uploadAccounts) ? uploadAccounts : [];
    const totalDesigns = Math.max(0, Number(designCount) || 0);
    const forceFairRun = options.forceFairRun === true;
    const useFair = forceFairRun ? true : (options.isFairDistribution !== false);
    let assigned = [];
    let unassigned = 0;
    let modeLabel = 'تسلسلي';

    if (useFair && accounts.length > 1) {
        const fair = previewFairDistributionCapacity(totalDesigns, accounts, effectiveCountPer);
        assigned = fair.assigned;
        unassigned = fair.unassigned;
        modeLabel = 'توزيع عادل';
    } else {
        const seq = previewSequentialUploadAssignment(totalDesigns, accounts, effectiveCountPer);
        assigned = seq.assigned;
        unassigned = seq.unassigned;
    }

    const rows = accounts.map((acc, index) => {
        const email = String(acc?.email || '').trim();
        const label = acc?.displayName || email.split('@')[0] || email || 'حساب';
        return { label, email, designCount: Number(assigned[index]) || 0 };
    });
    const totalAssigned = assigned.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const activeRows = rows.filter((row) => row.designCount > 0);

    return {
        rows,
        activeRows,
        totalAssigned,
        unassigned,
        totalDesigns,
        accountCount: accounts.length,
        modeLabel
    };
}

function buildApUploadConfirmEditableState(uploadAccounts, designCount, effectiveCountPer, options = {}) {
    const accounts = Array.isArray(uploadAccounts) ? uploadAccounts : [];
    const parsedCountPer = parseApMaxPerAccountValue(effectiveCountPer);
    const countPerForLimit = parsedCountPer.auto ? null : parsedCountPer.countPer;
    const preview = buildApUploadStartPreview(accounts, designCount, countPerForLimit, options);
    const limits = accounts.map((acc) => computeApAccountUploadLimit(acc, countPerForLimit));
    const rows = accounts.map((acc, index) => {
        const email = String(acc?.email || '').trim();
        const label = acc?.displayName || email.split('@')[0] || email || 'حساب';
        const capacity = limits[index];
        const unlimited = isApUnlimitedCapacity(capacity);
        const rawAssigned = Math.max(0, Number(preview.rows[index]?.designCount) || 0);
        const designCountForAccount = unlimited
            ? rawAssigned
            : Math.min(rawAssigned, Math.max(0, Number(capacity) || 0));
        return {
            accountId: String(acc?.id || acc?.email || ''),
            label,
            email,
            capacity: unlimited ? Infinity : Math.max(0, Number(capacity) || 0),
            designCount: designCountForAccount,
            included: hasApUploadCapacity(capacity)
        };
    });
    return {
        uploadAccounts: accounts,
        countPer: parsedCountPer.countPer,
        countPerAuto: parsedCountPer.auto,
        totalDesigns: preview.totalDesigns,
        modeLabel: preview.modeLabel,
        unassigned: preview.unassigned,
        previewOptions: { ...options },
        rows
    };
}

function applyAutoDistributionToApUploadConfirmState(state) {
    if (!state || !Array.isArray(state.rows) || !Array.isArray(state.uploadAccounts)) return state;
    const includedAccounts = state.rows
        .map((row, index) => ({ row, acc: state.uploadAccounts[index] }))
        .filter(({ row }) => row.included && hasApUploadCapacity(row.capacity));
    if (!includedAccounts.length) return state;

    const accounts = includedAccounts.map(({ acc }) => acc);
    const countPerForLimit = state.countPerAuto ? null : state.countPer;
    const preview = buildApUploadStartPreview(accounts, state.totalDesigns, countPerForLimit, state.previewOptions || {});
    includedAccounts.forEach(({ row }, index) => {
        const rawAssigned = Math.max(0, Number(preview.rows[index]?.designCount) || 0);
        if (isApUnlimitedCapacity(row.capacity)) {
            row.designCount = rawAssigned;
        } else {
            const cap = Math.max(0, Number(row.capacity) || 0);
            row.designCount = Math.min(rawAssigned, cap);
        }
    });
    state.rows.forEach((row) => {
        if (!row.included || !hasApUploadCapacity(row.capacity)) row.designCount = 0;
    });
    return state;
}

function rebuildApUploadConfirmStateCapacities(state) {
    if (!state || !Array.isArray(state.rows) || !Array.isArray(state.uploadAccounts)) return state;
    const countPerForLimit = state.countPerAuto ? null : state.countPer;
    const limits = state.uploadAccounts.map((acc) => computeApAccountUploadLimit(acc, countPerForLimit));
    state.rows.forEach((row, index) => {
        const capacity = limits[index];
        const unlimited = isApUnlimitedCapacity(capacity);
        row.capacity = unlimited ? Infinity : Math.max(0, Number(capacity) || 0);
        if (!hasApUploadCapacity(row.capacity)) {
            row.included = false;
            row.designCount = 0;
        } else if (!unlimited && (Number(row.designCount) || 0) > row.capacity) {
            row.designCount = row.capacity;
        }
    });
    return applyAutoDistributionToApUploadConfirmState(state);
}

function onApUploadConfirmMaxPerChanged() {
    if (!_apUploadConfirmState) return;
    const input = document.getElementById('ap-upload-confirm-max-per');
    const parsed = parseApMaxPerAccountValue(input?.value);
    if (input) input.value = parsed.auto ? '' : String(parsed.countPer);
    _apUploadConfirmState.countPerAuto = parsed.auto;
    _apUploadConfirmState.countPer = parsed.countPer;
    syncApDesignsPerInputFromParsed(parsed);
    void saveApMaxPerAccountPreference(parsed.auto ? 'auto' : parsed.countPer);
    rebuildApUploadConfirmStateCapacities(_apUploadConfirmState);
    renderApUploadConfirmModal(_apUploadConfirmState);
}

function validateApUploadConfirmState(state) {
    if (!state || !Array.isArray(state.rows)) {
        return { valid: false, totalAssigned: 0, activeCount: 0, unassigned: 0, message: 'لا توجد بيانات للرفع', level: 'error' };
    }
    const totalDesigns = Math.max(0, Number(state.totalDesigns) || 0);
    let totalAssigned = 0;
    let activeCount = 0;
    let overCapacity = false;

    state.rows.forEach((row) => {
        if (!row.included || !hasApUploadCapacity(row.capacity)) {
            row.designCount = 0;
            return;
        }
        let count = Math.max(0, Math.floor(Number(row.designCount) || 0));
        if (!isApUnlimitedCapacity(row.capacity)) {
            const cap = Math.max(0, Number(row.capacity) || 0);
            if (count > cap) {
                count = cap;
                row.designCount = cap;
                overCapacity = true;
            }
        }
        row.designCount = count;
        if (count > 0) {
            totalAssigned += count;
            activeCount += 1;
        }
    });

    const unassigned = Math.max(0, totalDesigns - totalAssigned);
    let message = '';
    let level = 'ok';

    if (activeCount === 0) {
        message = 'فعّل حساباً واحداً على الأقل للرفع';
        level = 'error';
    } else if (totalAssigned <= 0) {
        message = 'عيّن تصميماً واحداً على الأقل';
        level = 'error';
    } else if (totalAssigned > totalDesigns) {
        message = `المجموع (${totalAssigned}) يتجاوز التصاميم المتاحة (${totalDesigns})`;
        level = 'error';
    } else if (overCapacity) {
        message = 'تم ضبط بعض الحسابات إلى الحد الأقصى المسموح';
        level = 'warn';
    } else if (unassigned > 0) {
        message = `${unassigned} تصميم لن يُرفع — وزّعها على الحسابات أو أعد التوزيع`;
        level = 'warn';
    } else {
        message = 'جاهز للرفع';
        level = 'ok';
    }

    return { valid: level !== 'error', totalAssigned, activeCount, unassigned, message, level };
}

function buildApUploadConfirmApproveResult(state) {
    const validation = validateApUploadConfirmState(state);
    if (!validation.valid) return null;

    const accounts = [];
    const assigned = [];
    state.rows.forEach((row, index) => {
        const acc = state.uploadAccounts[index];
        if (!acc || !row.included || row.designCount <= 0) return;
        accounts.push(acc);
        assigned.push(row.designCount);
    });

    if (!accounts.length) return null;
    return {
        approved: true,
        accounts,
        assigned,
        totalAssigned: validation.totalAssigned,
        unassigned: validation.unassigned,
        countPer: state.countPer,
        countPerAuto: state.countPerAuto
    };
}

function renderApUploadConfirmModal(state) {
    const listEl = document.getElementById('ap-upload-confirm-list');
    const modeEl = document.getElementById('ap-upload-confirm-mode');
    const validationEl = document.getElementById('ap-upload-confirm-validation');
    const statAccountsEl = document.getElementById('ap-upload-confirm-stat-accounts');
    const statDesignsEl = document.getElementById('ap-upload-confirm-stat-designs');
    const statAvailableEl = document.getElementById('ap-upload-confirm-stat-available');
    const approveBtn = document.getElementById('ap-upload-confirm-approve');
    const maxPerInput = document.getElementById('ap-upload-confirm-max-per');
    if (!listEl || !state) return;

    const validation = validateApUploadConfirmState(state);
    if (maxPerInput) maxPerInput.value = state.countPerAuto ? '' : String(state.countPer || '');
    if (statAccountsEl) statAccountsEl.textContent = String(validation.activeCount);
    if (statDesignsEl) statDesignsEl.textContent = String(validation.totalAssigned);
    if (statAvailableEl) statAvailableEl.textContent = String(state.totalDesigns || 0);
    if (modeEl) modeEl.textContent = `وضع ${state.modeLabel || '—'}`;
    if (validationEl) {
        validationEl.textContent = validation.message || '';
        validationEl.className = 'ap-upload-confirm-validation';
        if (validation.level === 'warn') validationEl.classList.add('is-warn');
        else if (validation.level === 'error') validationEl.classList.add('is-error');
        else if (validation.level === 'ok') validationEl.classList.add('is-ok');
    }
    if (approveBtn) approveBtn.disabled = !validation.valid;

    const rows = state.rows || [];
    if (!rows.length) {
        listEl.innerHTML = '<div class="ap-upload-confirm-row is-excluded" role="listitem"><span class="ap-upload-confirm-row-label">لا توجد حسابات</span></div>';
        return;
    }

    listEl.innerHTML = rows.map((row, index) => {
        const excludedClass = !row.included ? ' is-excluded' : '';
        const noCapClass = !hasApUploadCapacity(row.capacity) ? ' is-no-capacity' : '';
        const emailLine = row.email && row.email !== row.label
            ? `<span class="ap-upload-confirm-row-email" dir="ltr">${row.email}</span>`
            : '';
        const capLabel = formatApCapacityLabel(row.capacity);
        const disabled = !row.included || !hasApUploadCapacity(row.capacity);
        const count = Math.max(0, Number(row.designCount) || 0);
        const remainingForRow = getApUploadConfirmRemainingForRow(state, index);
        const atMin = count <= 0;
        const atMax = isApUnlimitedCapacity(row.capacity)
            ? count >= remainingForRow
            : count >= Math.min(Math.max(0, Number(row.capacity) || 0), remainingForRow);
        const maxAttr = isApUnlimitedCapacity(row.capacity)
            ? `max="${remainingForRow}"`
            : `max="${Math.max(0, Number(row.capacity) || 0)}"`;
        return `<div class="ap-upload-confirm-row${excludedClass}${noCapClass}" role="listitem" data-index="${index}">
            <label class="ap-upload-confirm-toggle" title="${row.included ? 'استبعاد من الرفع' : 'تضمين في الرفع'}">
                <input type="checkbox" class="ap-upload-confirm-include" data-index="${index}" ${row.included ? 'checked' : ''} ${!hasApUploadCapacity(row.capacity) ? 'disabled' : ''}>
            </label>
            <div class="ap-upload-confirm-row-info">
                <span class="ap-upload-confirm-row-label">${row.label}</span>
                ${emailLine}
                <span class="ap-upload-confirm-row-cap">${capLabel}</span>
            </div>
            <div class="ap-upload-confirm-stepper">
                <button type="button" class="ap-upload-confirm-stepper-btn ap-upload-confirm-minus" data-index="${index}" aria-label="تقليل" ${disabled || atMin ? 'disabled' : ''}>−</button>
                <input type="number" class="ap-upload-confirm-stepper-input" data-index="${index}" min="0" ${maxAttr} value="${count}" ${disabled ? 'disabled' : ''} aria-label="عدد التصاميم">
                <button type="button" class="ap-upload-confirm-stepper-btn ap-upload-confirm-plus" data-index="${index}" aria-label="زيادة" ${disabled || atMax ? 'disabled' : ''}>+</button>
            </div>
        </div>`;
    }).join('');
}

function updateApUploadConfirmRowCount(index, nextValue) {
    if (!_apUploadConfirmState || !Array.isArray(_apUploadConfirmState.rows)) return;
    const row = _apUploadConfirmState.rows[index];
    if (!row || !row.included || !hasApUploadCapacity(row.capacity)) return;
    row.designCount = clampApUploadConfirmRowCount(_apUploadConfirmState, index, nextValue);
    renderApUploadConfirmModal(_apUploadConfirmState);
}

function toggleApUploadConfirmRowIncluded(index, included) {
    if (!_apUploadConfirmState || !Array.isArray(_apUploadConfirmState.rows)) return;
    const row = _apUploadConfirmState.rows[index];
    if (!row || !hasApUploadCapacity(row.capacity)) return;
    row.included = included === true;
    if (!row.included) {
        row.designCount = 0;
    } else if (row.designCount <= 0 && hasApUploadCapacity(row.capacity)) {
        row.designCount = clampApUploadConfirmRowCount(_apUploadConfirmState, index, 1);
    }
    renderApUploadConfirmModal(_apUploadConfirmState);
}

function bindApUploadConfirmListEvents(listEl) {
    if (!listEl || listEl.dataset.bound === '1') return;
    listEl.dataset.bound = '1';
    listEl.addEventListener('click', (e) => {
        const minusBtn = e.target.closest('.ap-upload-confirm-minus');
        const plusBtn = e.target.closest('.ap-upload-confirm-plus');
        if (minusBtn) {
            const index = Number(minusBtn.dataset.index);
            const row = _apUploadConfirmState?.rows?.[index];
            if (row) updateApUploadConfirmRowCount(index, (Number(row.designCount) || 0) - 1);
            return;
        }
        if (plusBtn) {
            const index = Number(plusBtn.dataset.index);
            const row = _apUploadConfirmState?.rows?.[index];
            if (row) updateApUploadConfirmRowCount(index, (Number(row.designCount) || 0) + 1);
        }
    });
    listEl.addEventListener('change', (e) => {
        const includeCb = e.target.closest('.ap-upload-confirm-include');
        if (includeCb) {
            toggleApUploadConfirmRowIncluded(Number(includeCb.dataset.index), includeCb.checked);
            return;
        }
        const input = e.target.closest('.ap-upload-confirm-stepper-input');
        if (input) updateApUploadConfirmRowCount(Number(input.dataset.index), input.value);
    });
    listEl.addEventListener('input', (e) => {
        const input = e.target.closest('.ap-upload-confirm-stepper-input');
        if (input) updateApUploadConfirmRowCount(Number(input.dataset.index), input.value);
    });
}

function ensureApUploadConfirmModalMounted() {
    const modal = document.getElementById('ap-upload-confirm-modal');
    if (!modal) return null;
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }
    return modal;
}

function showApUploadConfirmModal(editableState) {
    return new Promise((resolve) => {
        const modal = ensureApUploadConfirmModalMounted();
        if (!modal) {
            resolve(buildApUploadConfirmApproveResult(editableState) || { approved: true });
            return;
        }
        if (_apUploadConfirmResolver) {
            _apUploadConfirmResolver(null);
            _apUploadConfirmResolver = null;
        }
        _apUploadConfirmState = editableState;
        bindApUploadConfirmListEvents(document.getElementById('ap-upload-confirm-list'));
        renderApUploadConfirmModal(_apUploadConfirmState);
        _apUploadConfirmResolver = resolve;
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('ap-modal-open');
        document.body.style.overflow = 'hidden';
        document.getElementById('ap-upload-confirm-approve')?.focus();
    });
}

function closeApUploadConfirmModal(result = null) {
    const modal = document.getElementById('ap-upload-confirm-modal');
    if (modal) {
        // Blur focused control before aria-hidden/hide to avoid a11y "focused inside aria-hidden" warnings.
        const active = document.activeElement;
        if (active && typeof active.blur === 'function' && modal.contains(active)) {
            active.blur();
        }
        modal.classList.remove('ap-modal-open');
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
    }
    if (document.querySelector('.ap-upload-confirm-modal.ap-modal-open') == null) {
        document.body.style.overflow = '';
    }
    _apUploadConfirmState = null;
    if (_apUploadConfirmResolver) {
        _apUploadConfirmResolver(result);
        _apUploadConfirmResolver = null;
    }
}

function approveApUploadConfirmModal() {
    if (!_apUploadConfirmState) {
        closeApUploadConfirmModal(null);
        return;
    }
    const result = buildApUploadConfirmApproveResult(_apUploadConfirmState);
    if (!result) {
        renderApUploadConfirmModal(_apUploadConfirmState);
        return;
    }
    closeApUploadConfirmModal(result);
}

function bindApUploadConfirmModalEvents() {
    if (document.getElementById('ap-upload-confirm-modal')?.dataset.bound === '1') return;
    ensureApUploadConfirmModalMounted();
    const uploadConfirmModal = document.getElementById('ap-upload-confirm-modal');
    if (!uploadConfirmModal) return;
    uploadConfirmModal.dataset.bound = '1';
    uploadConfirmModal.querySelector('.ap-upload-confirm-card')?.addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('ap-upload-confirm-approve')?.addEventListener('click', () => approveApUploadConfirmModal());
    document.getElementById('ap-upload-confirm-cancel')?.addEventListener('click', () => closeApUploadConfirmModal(null));
    document.getElementById('ap-upload-confirm-close')?.addEventListener('click', () => closeApUploadConfirmModal(null));
    document.getElementById('ap-upload-confirm-redistribute')?.addEventListener('click', () => {
        if (!_apUploadConfirmState) return;
        applyAutoDistributionToApUploadConfirmState(_apUploadConfirmState);
        renderApUploadConfirmModal(_apUploadConfirmState);
    });
    document.getElementById('ap-upload-confirm-max-per')?.addEventListener('change', onApUploadConfirmMaxPerChanged);
    document.getElementById('ap-upload-confirm-max-per')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onApUploadConfirmMaxPerChanged();
        }
    });
    uploadConfirmModal.addEventListener('click', (e) => {
        if (e.target === uploadConfirmModal) closeApUploadConfirmModal(null);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !uploadConfirmModal.classList.contains('ap-modal-open')) return;
        closeApUploadConfirmModal(null);
    });
}

async function executeApGhostUploadStart(ctx) {
    const {
        uploadAccounts,
        seoReadyDesigns,
        resolvedCountPer,
        isFairDistribution,
        forceFairRun,
        fairPreviewAssigned,
        totalPlannedUploads,
        actionType
    } = ctx;

    await saveSelectionAndAccounts();

    const config = {
        accounts: uploadAccounts,
        selectedAccountIds: uploadAccounts.map((acc) => String(acc.id || acc.email || '')).filter(Boolean),
        countPer: resolvedCountPer == null ? 'auto' : Math.max(1, Number(resolvedCountPer) || 1),
        countPerAuto: resolvedCountPer == null,
        confirmedAssigned: Array.isArray(fairPreviewAssigned) && fairPreviewAssigned.length > 0
            ? fairPreviewAssigned.map((v) => Math.max(0, Math.floor(Number(v) || 0)))
            : null,
        totalPlannedUploads: Math.max(0, Number(totalPlannedUploads) || seoReadyDesigns.length),
        delaySec: parseInt(AP.delay?.value, 10) || 30,
        isVisual: AP.visualMode?.checked ?? false,
        actionType: actionType,
        defaultColor: document.querySelector('input[name="ap-default-color"]:checked')?.value || 'Black',
        isRandom: AP.randomDistrib?.checked ?? false,
        isFairDistribution: forceFairRun ? true : isFairDistribution,
        explicitFairDistributionOff: forceFairRun ? false : (apFairDistributionSessionExplicitOff === true),
        seoReadyCount: seoReadyDesigns.length,
        platform: currentPlatform,
        port: SERVER_PORTS[currentPlatform]
    };

    ensureApUploadUiRefs();
    if (AP.progressPanel) AP.progressPanel.classList.remove('hidden');

    const distribLabel = config.isRandom ? 'عشوائي' : 'دائري';
    const fairLabel = isFairDistribution ? ' | توزيع: عادل ⚖️' : '';
    const limitLabel = resolvedCountPer == null ? 'تلقائي' : resolvedCountPer;
    apLog(`🚀 Ghost Server [${currentPlatform.toUpperCase()}] | ${uploadAccounts.length} حسابات | ${distribLabel}${fairLabel} | حد أقصى/حساب: ${limitLabel}`);
    console.log('[Autopilot][Upload] ap_start payload', {
        emails: uploadAccounts.map((a) => a?.email).filter(Boolean),
        uploadAccountsLength: uploadAccounts.length,
        selectedAccountIds: config.selectedAccountIds,
        isFairDistribution: config.isFairDistribution,
        explicitFairDistributionOff: config.explicitFairDistributionOff === true,
        forceFairRun,
        seoReady: seoReadyDesigns.length,
        userSaved: adminUserSelectionSaved,
        confirmedAssigned: config.confirmedAssigned,
        totalPlannedUploads: config.totalPlannedUploads
    });
    const plannedTotal = Math.max(0, Number(totalPlannedUploads) || seoReadyDesigns.length);
    const optimisticState = buildOptimisticApUploadState(uploadAccounts, plannedTotal, {
        fairAssigned: fairPreviewAssigned
    });
    const startEmails = uploadAccounts.map((a) => a?.email).filter(Boolean).join(', ');
    chrome.runtime.sendMessage({ action: 'ap_start', data: config }, (response) => {
        if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || 'فشل بدء الرفع';
            showToast(`❌ ${msg}`);
            apLog(`❌ ap_start: ${msg}`, 'error');
            void loadQueueMonitorState();
        } else if (response?.success === false) {
            void loadQueueMonitorState();
        }
    });
    showToast(`🚀 ${startEmails} — ${plannedTotal} تصميم`);
    apLog(`📚 queueReady=${seoReadyDesigns.length} | selected=${startEmails}`);
    apQueueMonitorFp = '';
    renderQueueMonitorState(optimisticState);
}

function handleApStopClick() {
    if (!isAutopilotUploadBusy(apQueueMonitorState)) {
        return;
    }
    chrome.runtime.sendMessage({ action: 'ap_stop' });
    const stoppedState = {
        ...(apQueueMonitorState || buildFallbackQueueMonitorState()),
        isRunning: false,
        overallStatus: 'stopped',
        currentAccountId: '',
        currentAccountEmail: '',
        currentAccountLabel: '',
        currentAccountIndex: 0,
        currentAccountTotal: 0,
        currentAccountUploaded: 0,
        currentAccountPlanned: 0
    };
    apQueueMonitorFp = '';
    renderQueueMonitorState(stoppedState);
    applyApActiveUploadVisuals(stoppedState);
    showToast('🛑 تم طلب إيقاف الرفع');
    apLog('🛑 طلب إيقاف العملية يدوياً...', 'warning');
}

async function handleApStartClick() {
    const selected = getSelectedAutopilotAccounts({ verifiedOnly: true });
    const selectedEmails = selected.map((a) => a?.email).filter(Boolean);
    console.warn('[Autopilot][Upload] START CLICKED', { selected: selectedEmails });

    if (!isGhostServerPlatform(currentPlatform)) {
        await launchPinterestCurrentSessionFlow();
        return;
    }

    if (!_ghostServerOnline) {
        showToast('⚠️ Ghost Server غير متصل — اضغط «تشغيل السيرفر» أولاً');
        return;
    }

    if (isAutopilotUploadBusy(apQueueMonitorState)) {
        showToast(buildApUploadBusyToast(apQueueMonitorState));
        return;
    }

    syncAllAccountSelectedFlagsFromSets();
    await loadAPAccounts();
    const selectedAccounts = getSelectedAutopilotAccounts({ verifiedOnly: true });
    if (selectedAccounts.length === 0) return showToast('⚠️ يرجى اختيار حساب واحد على الأقل');

    const queue = getDesignQueue();
    const maxPerParsed = getApMaxPerAccountFromInput(AP.designsPer);
    const resolvedCountPer = maxPerParsed.auto ? null : maxPerParsed.countPer;
    ensureApUploadUiRefs();
    const seoReadyDesigns = queue.filter(i => i.meta);
    const isFairDistribution = resolveIsFairDistribution(selectedAccounts.length, { designCount: seoReadyDesigns.length });
    if (isFairDistribution && AP.fairDistrib && !AP.fairDistrib.checked && !apFairDistributionSessionExplicitOff) {
        AP.fairDistrib.checked = true;
    }

    const resetAccountSessionForUpload = (acc) => {
        acc.sessionUploadedCount = 0;
        if (isFairDistribution && selectedAccounts.length > 1) {
            acc.uploadedTodayCount = 0;
            acc.lastUploadDate = new Date().toISOString().split('T')[0];
            if (acc.dailyLimitReachedDate) delete acc.dailyLimitReachedDate;
        }
    };
    selectedAccounts.forEach(resetAccountSessionForUpload);

    const readyAccounts = selectedAccounts.filter((acc) => canUploadToAccount(acc, resolvedCountPer));
    const uploadAccounts = (isFairDistribution && selectedAccounts.length > 1)
        ? selectedAccounts
        : readyAccounts;

    if (readyAccounts.length === 0) {
        return showToast('⚠️ جميع الحسابات المختارة تجاوزت حدود الرفع اليومية.');
    }
    if (!isFairDistribution && readyAccounts.length < selectedAccounts.length) {
        showToast(`⚠️ ${selectedAccounts.length - readyAccounts.length} حساب(ات) بدون سعة رفع — سيتم التوزيع على ${readyAccounts.length} حساب فقط`);
    } else if (isFairDistribution && selectedAccounts.length > 1 && readyAccounts.length < selectedAccounts.length) {
        showToast(`⚠️ ${selectedAccounts.length - readyAccounts.length} حساب(ات) بدون سعة — التوزيع العادل على ${uploadAccounts.length} حساب`);
    }

    // Sync reset session counters + persist checkbox selection before background reads storage
    await saveSelectionAndAccounts();

    if (queue.length === 0) return showToast('⚠️ القائمة فارغة! أضف تصاميم أولاً');

    if (seoReadyDesigns.length === 0) return showToast('⚠️ يرجى تنفيذ التحليل الذكي في تبويب SEO AI أولاً.');

    const actionType = document.querySelector('input[name="ap-action-type"]:checked')?.value || 'publish';

    let fairPreviewAssigned = null;
    if (isFairDistribution && uploadAccounts.length > 1) {
        const fairPreview = previewFairDistributionCapacity(seoReadyDesigns.length, uploadAccounts, resolvedCountPer);
        if (fairPreview.totalAssigned <= 0) {
            return showToast('⚠️ التوزيع العادل: لا سعة رفع للحسابات المحددة — راجع حدود الحسابات (🛡️) أو الحد اليومي');
        }
        if (fairPreview.unassigned > 0) {
            showToast(`⚠️ سعة الحسابات (${fairPreview.totalAssigned}) أقل من التصاميم (${seoReadyDesigns.length}) — ${fairPreview.unassigned} لن يُرفع`);
        }
        const fairPreviewSummary = uploadAccounts.map((acc, index) => {
            const alias = acc.displayName || acc.email?.split?.('@')?.[0] || acc.email || 'حساب';
            return `${alias}:${fairPreview.assigned[index] || 0}`;
        }).join(' | ');
        console.log('[Autopilot][Upload] fair distribution preview:', {
            limits: fairPreview.limits,
            assigned: fairPreview.assigned,
            summary: fairPreviewSummary
        });
        fairPreviewAssigned = fairPreview.assigned;
    }

    const forceFairRun = uploadAccounts.length > 1 && seoReadyDesigns.length > 1;
    const uploadConfirmState = buildApUploadConfirmEditableState(uploadAccounts, seoReadyDesigns.length, resolvedCountPer, {
        isFairDistribution,
        forceFairRun
    });
    if (validateApUploadConfirmState(uploadConfirmState).totalAssigned <= 0) {
        return showToast('⚠️ لا توجد سعة رفع كافية للحسابات المحددة');
    }

    const confirmResult = await showApUploadConfirmModal(uploadConfirmState);
    if (!confirmResult?.approved) {
        apLog('ℹ️ تم إلغاء بدء الرفع من نافذة التأكيد', 'info');
        return;
    }

    const finalCountPer = confirmResult.countPerAuto ? null : confirmResult.countPer;
    syncApDesignsPerInputFromParsed(parseApMaxPerAccountValue(finalCountPer));
    void saveApMaxPerAccountPreference(finalCountPer == null ? 'auto' : finalCountPer);

    showToast('🚀 بدء الرفع...');
    await executeApGhostUploadStart({
        uploadAccounts: confirmResult.accounts,
        seoReadyDesigns,
        resolvedCountPer: finalCountPer,
        isFairDistribution,
        forceFairRun,
        fairPreviewAssigned: confirmResult.assigned,
        totalPlannedUploads: confirmResult.totalAssigned,
        actionType
    });
}

function setupEventListeners() {
    const mainTabListBtn = document.getElementById('ap-main-tab-list-btn');
    const mainTabDetailsBtn = document.getElementById('ap-main-tab-details-btn');
    if (mainTabListBtn && mainTabListBtn.dataset.bound !== '1') {
        mainTabListBtn.dataset.bound = '1';
        mainTabListBtn.addEventListener('click', () => switchApMainTab('list'));
    }
    if (mainTabDetailsBtn && mainTabDetailsBtn.dataset.bound !== '1') {
        mainTabDetailsBtn.dataset.bound = '1';
        mainTabDetailsBtn.addEventListener('click', () => switchApMainTab('details'));
    }

    // Admin Sub-tabs events
    const adminCreatyBtn = document.getElementById('admin-tab-creaty-btn');
    const adminNormalBtn = document.getElementById('admin-tab-normal-btn');
    if (adminCreatyBtn && adminCreatyBtn.dataset.bound !== '1') {
        adminCreatyBtn.dataset.bound = '1';
        adminCreatyBtn.addEventListener('click', () => {
            if (activeAdminAccountSourceTab === 'creaty') return;
            activeAdminAccountSourceTab = 'creaty';
            chrome.storage.local.set({ activeAdminAccountSourceTab: 'creaty' });
            if (typeof showToast === 'function') {
                const count = autopilotAccounts.filter((a) => a.sourceType === 'creaty').length;
                showToast(`✅ تم التبديل إلى حسابات CREATY (${count})`);
            }
            renderAPAccounts();
        });
    }
    if (adminNormalBtn && adminNormalBtn.dataset.bound !== '1') {
        adminNormalBtn.dataset.bound = '1';
        adminNormalBtn.addEventListener('click', () => {
            if (activeAdminAccountSourceTab === 'normal') return;
            activeAdminAccountSourceTab = 'normal';
            chrome.storage.local.set({ activeAdminAccountSourceTab: 'normal' });
            if (typeof showToast === 'function') {
                const count = autopilotAccounts.filter((a) => a.sourceType === 'normal').length;
                showToast(`✅ تم التبديل إلى حسابات Normal (${count})`);
            }
            renderAPAccounts();
        });
    }

    // Admin Search input
    const adminAccountsSearch = document.getElementById('admin-accounts-search');
    if (adminAccountsSearch) {
        adminAccountsSearch.addEventListener('input', (e) => {
            const val = e.target.value;
            if (activeAdminAccountSourceTab === 'creaty') {
                adminCreatySearchQuery = val;
                chrome.storage.local.set({ adminCreatySearchQuery: val });
            } else {
                adminNormalSearchQuery = val;
                chrome.storage.local.set({ adminNormalSearchQuery: val });
            }
            renderAPAccounts();
        });
    }

    // Select all visible checkbox
    const adminSelectAllCb = document.getElementById('admin-accounts-select-all-cb');
    if (adminSelectAllCb && adminSelectAllCb.dataset.bound !== '1') {
        adminSelectAllCb.dataset.bound = '1';
        adminSelectAllCb.addEventListener('change', (e) => {
            applyVisibleSelection(!!e.target.checked);
            saveSelectionAndAccounts(() => {
                renderAPAccounts();
            });
        });
    }

    // Operation Selector visibility change
    const opLocSelect = document.getElementById('operation-location-select');
    if (opLocSelect) {
        opLocSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const groupSelect = document.getElementById('operation-group-select');
            const newGroupInput = document.getElementById('operation-new-group-name');
            if (groupSelect) {
                if (val === 'existing-group') groupSelect.classList.remove('hidden');
                else groupSelect.classList.add('hidden');
            }
            if (newGroupInput) {
                if (val === 'new-group') newGroupInput.classList.remove('hidden');
                else newGroupInput.classList.add('hidden');
            }
        });
    }

    // Toolbar buttons click
    if (!window.__accountToolbarBound) {
        window.__accountToolbarBound = true;
        document.getElementById('btn-op-copy')?.addEventListener('click', () => {
            void handleToolbarCopy();
        });
        document.getElementById('btn-op-import')?.addEventListener('click', () => {
            document.getElementById('ap-import-input')?.click();
        });
        document.getElementById('btn-op-add')?.addEventListener('click', () => {
            void handleToolbarAdd();
        });
        document.getElementById('btn-op-remove')?.addEventListener('click', () => {
            void handleToolbarRemove();
        });
        document.getElementById('btn-op-upload')?.addEventListener('click', () => {
            console.warn('[AP] TOOLBAR UPLOAD CLICKED — forwarding to ap-start-btn');
            syncAllAccountSelectedFlagsFromSets();
            const selectedAccounts = getSelectedAutopilotAccounts({ verifiedOnly: true });
            if (selectedAccounts.length === 0) {
                return showToast('⚠️ يرجى تحديد حساب واحد على الأقل للرفع (✓ في القائمة)');
            }
            bindApStartButton();
            if (AP.startBtn) AP.startBtn.click();
            else showToast('❌ زر البدء غير موجود — أعد فتح تبويب Autopilot');
        });
        document.getElementById('btn-op-backup')?.addEventListener('click', () => {
            void handleToolbarBackup();
        });
    }

    window.addEventListener('nhp:queue-rendered', () => {
        if (!isAutopilotPanelActive() && !isAutopilotUploadBusy(apQueueMonitorState)) return;
        if (!apQueueMonitorState || !apQueueMonitorState.isRunning) {
            apQueueMonitorFp = '';
            renderFallbackQueueMonitorUnlessPersisted();
        }
    });
    // ربط أزرار المنصات
    document.querySelectorAll('.ap-plat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            switchAPPlatform(btn.dataset.plat);
        });
    });

    if (AP.platformSelect) {
        AP.platformSelect.addEventListener('change', (e) => {
            switchAPPlatform(e.target.value);
        });
    }

    // Proxy Pool Toggle
    if (AP.togglePool) {
        AP.togglePool.addEventListener('click', () => {
            AP.poolWrap.classList.toggle('hidden');
            AP.togglePool.querySelector('i').classList.toggle('fa-chevron-up');
            AP.togglePool.querySelector('i').classList.toggle('fa-chevron-down');
        });
    }

    // Auto-save Settings
    const saveSettings = (event) => {
        if (event?.target === AP.fairDistrib) {
            apFairDistributionSessionExplicitOff = AP.fairDistrib.checked === false;
        }
        chrome.storage.local.set({
            ap_proxy_pool: AP.proxyPool.value,
            ap_auto_rotate: AP.autoRotate.checked,
            ap_visual_mode: AP.visualMode.checked,
            ap_auto_login: AP.autoLogin.checked,
            ap_fair_distribution: AP.fairDistrib?.checked !== false
        });
    };
    [AP.proxyPool, AP.autoRotate, AP.visualMode, AP.autoLogin, AP.fairDistrib].forEach(el => {
        if (el) el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', saveSettings);
    });

    // Account List Actions (Edit, Delete, Checkbox) — delegated once
    if (AP.list && !window.__accountActionsBound) {
        window.__accountActionsBound = true;
        bindApAccountListDragDrop();

        AP.list.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-ap-acc-btn');
            if (editBtn) {
                const id = editBtn.getAttribute('data-id');
                const acc = resolveAccountById(id);
                if (acc) {
                    populateApAccountFormForEdit(acc);
                    switchApMainTab('details');
                    AP.email.focus();
                    showToast('📝 وضع التعديل: قم بتغيير المعلومات واضغط حفظ');
                }
                return;
            }

            const delBtn = e.target.closest('.remove-ap-acc-btn');
            if (delBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = delBtn.getAttribute('data-id');
                if (id) void removeAPAccount(id);
                return;
            }

            // v14.0 — Open Browser button
            const openBtn = e.target.closest('.open-ap-browser-btn');
            if (openBtn) {
                const id = openBtn.getAttribute('data-id');
                const acc = resolveAccountById(id);
                if (acc) openAccountBrowser(acc);
                else showToast('⚠️ تعذر العثور على الحساب المطلوب لفتح الجلسة.');
                return;
            }

            const albumsBtn = e.target.closest('.open-ap-albums-btn');
            if (albumsBtn) {
                const id = albumsBtn.getAttribute('data-id');
                const acc = resolveAccountById(id);
                if (acc) {
                    launchTeePublicAlbumOrganizerFlow(acc);
                } else {
                    showToast('⚠️ تعذر العثور على الحساب المطلوب لتشغيل منظم الألبومات.');
                }
                return;
            }

            // v14.0 — Double-click alias to rename inline
            const tpOrganizerBtn = e.target.closest('.run-ap-teepublic-organizer-btn');
            if (tpOrganizerBtn) {
                const id = tpOrganizerBtn.getAttribute('data-id');
                const acc = resolveAccountById(id);
                if (acc) launchTeePublicAlbumOrganizerFlow(acc);
                else showToast('⚠️ تعذر العثور على الحساب المطلوب لتشغيل المنظم.');
                return;
            }
            const emailEl = e.target.closest('.ap-acc-email, .ap-alias-display');
            if (emailEl && e.detail === 1 && !e.target.closest('button, input, .ap-account-checkbox')) {
                const id = emailEl.getAttribute('data-id') || emailEl.closest('.ap-acc-card')?.getAttribute('data-id');
                const acc = resolveAccountById(id);
                if (acc) {
                    populateApAccountFormForEdit(acc);
                    switchApMainTab('details');
                    AP.email?.focus();
                }
                return;
            }

            const aliasSpan = e.target.closest('.ap-alias-display');
            if (aliasSpan && e.detail >= 2) {
                const id = aliasSpan.getAttribute('data-id');
                const acc = resolveAccountById(id);
                if (!acc) return;
                const currentAlias = acc.displayName || acc.storeName || acc.email.split('@')[0];
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentAlias;
                input.style.cssText = `font-size:11px; font-weight:800; color:#fff; background:rgba(108,99,255,0.15);
                    border:1px solid var(--primary); border-radius:4px; padding:1px 5px; width:130px;
                    outline:none; font-family:'Tajawal',sans-serif;`;
                aliasSpan.replaceWith(input);
                input.focus();
                input.select();
                const save = () => {
                    const newAlias = input.value.trim();
                    if (newAlias && newAlias !== currentAlias) {
                        acc.displayName = newAlias;
                        saveCurrentAccounts(() => {
                            showToast(`✅ تم تغيير الاسم المستعار إلى: ${newAlias}`);
                            renderAPAccounts();
                        });
                    } else {
                        renderAPAccounts();
                    }
                };
                input.addEventListener('blur', save);
                input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); if (ev.key === 'Escape') renderAPAccounts(); });
            }
        });

        AP.list.addEventListener('change', (e) => {
            const checkbox = e.target.closest('.ap-account-checkbox');
            if (!checkbox) return;
            const id = checkbox.getAttribute('data-id');
            if (!setAccountSelectedInSet(id, checkbox.checked)) return;
            syncAllAccountSelectedFlagsFromSets();

            const card = checkbox.closest('.ap-acc-card');
            if (card) {
                card.style.background = checkbox.checked ? 'rgba(108,99,255,0.08)' : 'rgba(15,12,35,0.45)';
            }

            saveSelectionAndAccounts(() => {
                updateSelectedCount();
                syncAdminSelectAllCheckboxState();
            });
        });
    }

    // Save Limits (Batch/Daily) — v16.1
    if (AP.list && AP.list.dataset.apLimitsBound !== '1') {
        AP.list.dataset.apLimitsBound = '1';
        AP.list.addEventListener('change', (e) => {
            const batchInput = e.target.closest('.ap-batch-limit');
            const dailyInput = e.target.closest('.ap-daily-limit');

            if (batchInput || dailyInput) {
                const accId = (batchInput || dailyInput).getAttribute('data-id');
                const acc = autopilotAccounts.find(a => a.id === accId);
                if (acc) {
                    if (batchInput) acc.batchLimit = parseInt(batchInput.value) || null;
                    if (dailyInput) acc.dailyLimit = parseInt(dailyInput.value) || null;
                    saveCurrentAccounts(() => showToast('✅ تم حفظ حدود الرفع للحساب'));
                }
            }
        });
        AP.list.addEventListener('mousedown', (e) => {
            if (e.target.closest('.ap-limit-input')) e.stopPropagation();
        });
    }

    const applyGlobalRunLimitFromDesignsPer = (options = {}) => {
        const { silent = false } = options;
        const parsed = getApMaxPerAccountFromInput(AP.designsPer);
        syncApDesignsPerInputFromParsed(parsed);
        void saveApMaxPerAccountPreference(parsed.auto ? 'auto' : parsed.countPer);
        if (parsed.auto) {
            let cleared = 0;
            autopilotAccounts.forEach((acc) => {
                if (isAutopilotAccountSelected(acc) && acc.batchLimit != null) {
                    acc.batchLimit = null;
                    cleared += 1;
                }
            });
            if (cleared) {
                saveCurrentAccounts(() => renderAPAccounts());
            }
            if (!silent) showToast('✅ وضع غير محدود — بدون سقف لكل حساب');
            return;
        }
        const value = parsed.countPer;
        let updated = 0;
        autopilotAccounts.forEach((acc) => {
            if (isAutopilotAccountSelected(acc)) {
                acc.batchLimit = value;
                updated += 1;
            }
        });
        if (!updated) {
            if (!silent) showToast('⚠️ حدّد حساباً واحداً على الأقل لتطبيق العدد');
            return;
        }
        saveCurrentAccounts(() => {
            renderAPAccounts();
            if (!silent) showToast(`✅ تم تطبيق ${value} تصميم/حساب على ${updated} حساب`);
        });
    };

    AP.designsPer?.addEventListener('change', () => applyGlobalRunLimitFromDesignsPer());
    AP.designsPer?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyGlobalRunLimitFromDesignsPer();
        }
    });

    // Add/Update Account
    if (AP.addBtn) {
        AP.addBtn.addEventListener('click', async () => {
            const email = AP.email.value.trim();
            const pass = AP.pass.value.trim();
            let proxy = AP.proxy.value.trim();
            const quota = AP.quota.value;
            const accountDailyLimit = Math.max(1, parseInt(quota, 10) || 50);
            const nicheMapping = AP.nicheMap.value;

            if (!email || !pass) return showToast('⚠️ يرجى إداخل البيانات كاملة');

            if (!proxy && AP.proxyPool.value) {
                const pool = AP.proxyPool.value.split('\n').map(p => p.trim()).filter(p => p);
                if (pool.length > 0) {
                    proxy = pool[Math.floor(Math.random() * pool.length)];
                    apLog(`🌐 تم تعيين بروكسي تلقائي من المخزن للحساب: ${email}`);
                }
            }

            AP.addBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';
            AP.addBtn.disabled = true;

            setTimeout(() => {
                if (editingId) {
                    const accIndex = autopilotAccounts.findIndex(a => a.id === editingId);
                    if (accIndex !== -1) {
                        const displayName = AP.displayNameInput?.value.trim() || '';
                        const nextGroupId = AP.groupAssign?.value ?? autopilotAccounts[accIndex].groupId ?? '';
                        autopilotAccounts[accIndex] = {
                            ...autopilotAccounts[accIndex],
                            email, pass, proxy, quota, dailyLimit: accountDailyLimit, nicheMapping,
                            displayName: displayName || autopilotAccounts[accIndex].displayName,
                            groupId: nextGroupId,
                            updatedAt: new Date().toISOString()
                        };
                        ensureAccountCategory(autopilotAccounts[accIndex]);
                        showToast(`✅ تم تحديث بيانات الحساب بنجاح`);
                    }
                    editingId = null;
                } else {
                    const displayName = AP.displayNameInput?.value.trim() || '';
                    const storeName = displayName || (email.split('@')[0] + "_Store");
                    const assignedGroup = AP.groupAssign?.value || '';
                    const newAcc = {
                        id: Math.random().toString(36).substr(2, 9),
                        email, pass, proxy, quota, dailyLimit: accountDailyLimit, nicheMapping,
                        displayName,
                        storeName,
                        groupId: assignedGroup,
                        category: assignedGroup === 'g_artisan' ? 'artisan' : 'active',
                        verified: true,
                        addedAt: new Date().toISOString()
                    };
                    ensureAccountCategory(newAcc);
                    autopilotAccounts.push(newAcc);
                    showToast(`✅ تم إضافة الحساب: ${storeName}`);
                }

                saveCurrentAccounts(() => {
                    renderAPAccounts();
                    AP.email.value = '';
                    AP.pass.value = '';
                    AP.proxy.value = '';
                    if (AP.displayNameInput) AP.displayNameInput.value = '';
                    AP.addBtn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> التحقق وحفظ الحساب';
                    AP.addBtn.style.background = '';
                    AP.addBtn.disabled = false;
                });
            }, 1000);
        });
    }

    // Export/Import Accounts
    document.getElementById('ap-export-accounts')?.addEventListener('click', () => {
        if (autopilotAccounts.length === 0) return showToast('⚠️ لا توجد حسابات للتصدير');
        let content = autopilotAccounts.map(acc => [
            acc.email || '',
            acc.pass || '',
            acc.proxy || 'no-proxy',
            acc.dailyLimit || acc.quota || 50,
            acc.storeName || 'Store'
        ].join('|')).join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NHP_Accounts_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        showToast('📤 تم تصدير الحسابات بصيغة TXT');
    });

    const importInput = document.getElementById('ap-import-input');
    document.getElementById('ap-import-accounts')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim());
                const imported = lines.map(line => {
                    const parts = line.split('|');
                    if (parts.length >= 2) {
                        const importedAcc = {
                            id: Math.random().toString(36).substr(2, 9),
                            email: parts[0].trim(),
                            pass: parts[1].trim(),
                            proxy: parts[2] ? parts[2].trim() : '',
                            quota: parts[3] ? parseInt(parts[3].trim()) : 50,
                            dailyLimit: parts[3] ? parseInt(parts[3].trim()) : 50,
                            storeName: parts[4] ? parts[4].trim() : 'Store',
                            verified: true,
                            addedAt: new Date().toISOString()
                        };
                        ensureAccountCategory(importedAcc);
                        return importedAcc;
                    }
                    return null;
                }).filter(Boolean);

                const storageKey = `ap_accounts_${currentPlatform}`;
                chrome.storage.local.get([storageKey], (res) => {
                    const current = res[storageKey] || [];
                    const merged = [...current];
                    let added = 0;
                    imported.forEach(acc => {
                        if (!merged.some(a => a.email.toLowerCase().trim() === acc.email.toLowerCase().trim())) {
                            merged.push(acc);
                            added++;
                        }
                    });
                    accountsDB[currentPlatform] = merged;
                    autopilotAccounts = accountsDB[currentPlatform];
                    saveCurrentAccounts(() => {
                        renderAPAccounts();
                        showToast(added > 0 ? `✅ تم استيراد ${added} حساب بنجاح` : 'ℹ️ الحسابات موجودة بالفعل');
                    });
                });
            } catch (err) { showToast('❌ فشل الاستيراد'); }
            importInput.value = '';
        };
        reader.readAsText(file);
    });

    document.getElementById('ap-delete-all-accounts')?.addEventListener('click', async () => {
        const email = AP.email?.value?.trim();
        const targetId = editingId || (email ? resolveAccountById(email)?.id : null);
        if (!targetId) {
            return showToast('⚠️ يرجى اختيار حساب للحذف (اضغط تعديل أو أدخل البريد الإلكتروني)');
        }
        const removed = await removeAPAccount(targetId);
        if (removed) {
            if (AP.email) AP.email.value = '';
            if (AP.pass) AP.pass.value = '';
            if (AP.proxy) AP.proxy.value = '';
            if (AP.displayNameInput) AP.displayNameInput.value = '';
            if (AP.groupAssign) AP.groupAssign.value = '';
        }
    });

    document.getElementById('ap-export-session-backup')?.addEventListener('click', async () => {
        try {
            await exportSessionBackup();
        } catch (err) {
            apLog(`❌ Session backup export failed: ${err.message}`, 'error');
            showToast('❌ فشل إنشاء نسخة الجلسات');
        }
    });

    document.getElementById('ap-import-session-backup')?.addEventListener('click', async () => {
        try {
            await importSessionBackup();
        } catch (err) {
            apLog(`❌ Session backup import failed: ${err.message}`, 'error');
            showToast('❌ فشل استيراد نسخة الجلسات');
        }
    });

    bindApStartButton();

    // Wake Up Server — v13.0
    if (AP.retryFailedBtn) {
        AP.retryFailedBtn.addEventListener('click', () => {
            const state = apQueueMonitorState;
            if (!hasRetryableApFailures(state)) {
                showToast('لا توجد عمليات فاشلة قابلة للاستدراك.');
                return;
            }
            const failedCount = (Array.isArray(state?.perDesign) ? state.perDesign : [])
                .filter((item) => normalizeQueueStatus(item?.status) === 'failed' && item?.accountId).length;
            AP.retryFailedBtn.disabled = true;
            apLog(`🔁 استدراك الرفع الفاشل | ${failedCount} تصميم...`, 'info');
            chrome.runtime.sendMessage({ action: 'ap_retry_failed' }, (response) => {
                if (chrome.runtime.lastError || !response?.success) {
                    AP.retryFailedBtn.disabled = false;
                    syncApUploadControlButtons(apQueueMonitorState);
                    const msg = response?.error || chrome.runtime.lastError?.message || 'تعذر بدء الاستدراك.';
                    apLog(`❌ ${msg}`, 'error');
                    showToast(`❌ ${msg}`);
                    return;
                }
                const n = response.retryDesigns || failedCount;
                showToast(`🔁 بدأت إعادة رفع ${n} تصميم فاشل فقط`);
                renderQueueMonitorState({
                    ...(state || buildFallbackQueueMonitorState()),
                    isRunning: true,
                    overallStatus: 'uploading'
                });
            });
        });
    }

    // Server Stop Button
    if (AP.serverStopBtn) {
        AP.serverStopBtn.addEventListener('click', async () => {
            if (!isGhostServerPlatform(currentPlatform)) {
                showToast('📌 لا يوجد Ghost Server لإيقافه في وضع Pinterest.');
                return;
            }
            const port = SERVER_PORTS[currentPlatform];
            if (confirm('🛑 هل تريد إيقاف Ghost Server؟ سيتوقف الرفع الجماعي حالاً.')) {
                try {
                    const stopResult = await new Promise((resolve) => {
                        chrome.runtime.sendMessage({ action: 'stop_server', platform: currentPlatform, port }, (response) => {
                            resolve(response || null);
                        });
                    });
                    if (stopResult?.success) {
                        setServerStatus(false, port, stopResult.source || 'manual-stop');
                        apLog('🛑 تم إيقاف السيرفر يدوياً', 'error');
                        showToast('🛑 تم إيقاف Ghost Server');
                    } else {
                        const errMsg = stopResult?.error || 'فشل إيقاف السيرفر';
                        apLog(`❌ ${errMsg}`, 'error');
                        showToast(`❌ ${errMsg}`);
                    }
                } catch (e) {
                    showToast('❌ فشل إيقاف السيرفر');
                }
            }
        });
    }

    // Reset Queue Button
    if (AP.resetBtn) {
        AP.resetBtn.addEventListener('click', () => {
            if (confirm('⚠️ هل أنت متأكد من مسح كافة التصاميم من القائمة (Queue)؟')) {
                setDesignQueue([]);
                renderQueue();
                saveQueueToStorage(true);
                chrome.storage.local.remove(AP_UPLOAD_QUEUE_STATE_KEY);
                renderQueueMonitorState(buildFallbackQueueMonitorState());
                showToast('🔄 تم إعادة تعيين القائمة بنجاح');
                if (AP_SEO.previewPanel) AP_SEO.previewPanel.classList.add('hidden');
                if (AP_SEO.queueContainer) AP_SEO.queueContainer.classList.add('hidden');
            }
        });
    }

    // v14.0 — Select All / Deselect All (visible filtered accounts)
    if (!window.__accountBulkSelectBound) {
        window.__accountBulkSelectBound = true;
        const selectAllBtn = document.getElementById('ap-select-all');
        const deselectAllBtn = document.getElementById('ap-deselect-all');

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                applyVisibleSelection(true);
                saveSelectionAndAccounts(() => {
                    renderAPAccounts();
                    const groupName = activeGroupFilter
                        ? (autopilotGroups.find((g) => g.id === activeGroupFilter)?.name || 'المجموعة')
                        : 'كل الحسابات';
                    const visibleCount = getFilteredAutopilotAccounts().length;
                    showToast(`✅ تم تحديد ${visibleCount} حساب في (${groupName})`);
                });
            });
        }

        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                applyVisibleSelection(false);
                saveSelectionAndAccounts(() => {
                    renderAPAccounts();
                    showToast('⚠️ تم إلغاء التحديد للعرض الحالي');
                });
            });
        }
    }

    // v15.0 — Groups Events
    document.getElementById('ap-new-group-btn')?.addEventListener('click', () => {
        editingGroupId = null;
        document.getElementById('ap-group-edit-id').value = '';
        document.getElementById('ap-group-emoji').value = '';
        document.getElementById('ap-group-name').value = '';
        document.getElementById('ap-group-desc').value = '';
        document.getElementById('ap-group-color').value = '#a855f7';
        document.getElementById('ap-group-form')?.classList.toggle('hidden');
    });

    document.getElementById('ap-group-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('ap-group-form')?.classList.add('hidden');
        editingGroupId = null;
    });

    document.getElementById('ap-group-save-btn')?.addEventListener('click', () => {
        const emoji = document.getElementById('ap-group-emoji').value.trim() || '📦';
        const name = document.getElementById('ap-group-name').value.trim();
        const color = document.getElementById('ap-group-color').value;
        const desc = document.getElementById('ap-group-desc').value.trim();
        if (!name) return showToast('⚠️ ادخل اسم المجموعة');
        if (editingGroupId) {
            const g = autopilotGroups.find(g => g.id === editingGroupId);
            if (g) Object.assign(g, { name, emoji, color, desc });
        } else {
            autopilotGroups.push({ id: 'g_' + Math.random().toString(36).substr(2, 6), name, emoji, color, desc });
        }
        saveGroups(() => {
            document.getElementById('ap-group-form')?.classList.add('hidden');
            showToast(`✅ ${editingGroupId ? 'تم تحديث' : 'تم إنشاء'} مجموعة: ${name}`);
            editingGroupId = null;
        });
    });

    document.getElementById('ap-clear-filter-btn')?.addEventListener('click', () => {
        activeGroupFilter = null;
        document.getElementById('ap-group-filter-bar')?.classList.add('hidden');
        renderGroups();
        renderAPAccounts();
    });

    document.getElementById('ap-groups-grid')?.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.ap-group-edit-btn');
        if (editBtn) {
            const gid = editBtn.getAttribute('data-gid');
            const g = autopilotGroups.find(g => g.id === gid);
            if (!g) return;
            editingGroupId = gid;
            document.getElementById('ap-group-edit-id').value = gid;
            document.getElementById('ap-group-emoji').value = g.emoji;
            document.getElementById('ap-group-name').value = g.name;
            document.getElementById('ap-group-color').value = g.color;
            document.getElementById('ap-group-desc').value = g.desc || '';
            document.getElementById('ap-group-form')?.classList.remove('hidden');
            document.getElementById('ap-group-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        const delBtn = e.target.closest('.ap-group-delete-btn');
        if (delBtn) { deleteGroup(delBtn.getAttribute('data-gid')); return; }
        // v15.1 — Assign accounts button
        const assignAccBtn = e.target.closest('.ap-group-assign-accounts-btn');
        if (assignAccBtn) { openGroupAssignModal(assignAccBtn.getAttribute('data-gid')); return; }
        const card = e.target.closest('.ap-group-card');
        if (card) setActiveGroupFilter(card.getAttribute('data-gid'));
    });

    // v15.1 — Modal Event Listeners
    const closeModal = () => closeGroupModal();
    document.getElementById('ap-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('ap-modal-cancel')?.addEventListener('click', closeModal);

    // Close on backdrop click
    document.getElementById('ap-group-assign-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('ap-group-assign-modal')) closeGroupModal();
    });

    document.getElementById('ap-modal-search')?.addEventListener('input', (e) => {
        renderModalAccounts(e.target.value);
    });

    document.getElementById('ap-modal-select-all')?.addEventListener('click', () => {
        document.querySelectorAll('.ap-modal-acc-checkbox').forEach(cb => {
            cb.checked = true;
            styleModalRow(cb, true);
        });
        updateModalCounter();
    });

    document.getElementById('ap-modal-deselect-all')?.addEventListener('click', () => {
        document.querySelectorAll('.ap-modal-acc-checkbox').forEach(cb => {
            cb.checked = false;
            styleModalRow(cb, false);
        });
        updateModalCounter();
    });

    document.getElementById('ap-modal-accounts-list')?.addEventListener('change', (e) => {
        const cb = e.target.closest('.ap-modal-acc-checkbox');
        if (cb) { styleModalRow(cb, cb.checked); updateModalCounter(); }
    });

    // Click row to toggle checkbox
    document.getElementById('ap-modal-accounts-list')?.addEventListener('click', (e) => {
        const row = e.target.closest('.ap-modal-acc-row');
        const cb = row?.querySelector('.ap-modal-acc-checkbox');
        if (cb && e.target !== cb) {
            cb.checked = !cb.checked;
            styleModalRow(cb, cb.checked);
            updateModalCounter();
        }
    });

    document.getElementById('ap-modal-save')?.addEventListener('click', () => {
        const checkedIds = new Set(
            [...document.querySelectorAll('.ap-modal-acc-checkbox:checked')]
                .map(cb => cb.getAttribute('data-id'))
        );
        // Only modify accounts visible in the current search (safe approach: update all)
        autopilotAccounts.forEach(acc => {
            if (checkedIds.has(acc.id)) {
                acc.groupId = _modalGroupId;
                ensureAccountCategory(acc);
            } else if (acc.groupId === _modalGroupId) {
                // If was in this group but unchecked — remove only if found in DOM
                const cb = document.querySelector(`.ap-modal-acc-checkbox[data-id="${acc.id}"]`);
                if (cb) {
                    acc.groupId = '';
                    ensureAccountCategory(acc);
                }
            }
        });
        saveCurrentAccounts(() => {
            renderGroups();
            renderAPAccounts();
            closeGroupModal();
            showToast(`✅ تم تحديث تعيينات المجموعة`);
        });
    });

    bindApUploadConfirmModalEvents();

    // SEO Preview Actions
    document.getElementById('ap-seo-apply-all')?.addEventListener('click', applyToAll);
    document.getElementById('ap-seo-apply-niche-only')?.addEventListener('click', applyNicheFocus);
    document.getElementById('ap-seo-generate-btn')?.addEventListener('click', () => {
        document.getElementById('ap-ask-ai-btn')?.click();
    });
    document.getElementById('ap-seo-upload-only-btn')?.addEventListener('click', () => {
        document.getElementById('ap-start-btn')?.click();
    });
    document.getElementById('ap-seo-upload-trigger-proxy')?.addEventListener('click', () => {
        document.getElementById('ap-upload-trigger')?.click();
    });

    // SEO Field Copy
    document.getElementById('ap-seo-copy-title')?.addEventListener('click', () => { navigator.clipboard.writeText(AP_SEO.title.value); showToast('📋 تم النسخ'); });
    document.getElementById('ap-seo-copy-main-tag')?.addEventListener('click', () => { navigator.clipboard.writeText(AP_SEO.mainTag.value); showToast('📋 تم النسخ'); });
    document.getElementById('ap-seo-copy-tags')?.addEventListener('click', () => { navigator.clipboard.writeText(AP_SEO.tags.value); showToast('📋 تم النسخ'); });
    document.getElementById('ap-seo-copy-desc')?.addEventListener('click', () => { navigator.clipboard.writeText(AP_SEO.desc.value); showToast('📋 تم النسخ'); });

    // Design Queue Upload
    AP_SEO.uploadTrigger?.addEventListener('click', () => AP_SEO.imageInput.click());
    AP_SEO.imageInput?.addEventListener('change', (e) => {
        // Reuse global upload handler if available or implement local
        if (typeof window.handleBulkUpload === 'function') {
            window.handleBulkUpload(Array.from(e.target.files));
        }
        e.target.value = '';
    });

    if (AP_SEO.queueList) {
        AP_SEO.queueList.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.queue-item');
            const removeBtn = e.target.closest('.remove-btn');
            if (removeBtn) {
                removeFromQueue(removeBtn.getAttribute('data-remove-id'));
                return;
            }
            if (itemEl) {
                const id = itemEl.getAttribute('data-id');
                document.querySelectorAll('.queue-item').forEach(el => el.classList.remove('active'));
                itemEl.classList.add('active');
                showDesignPreview(id);
            }
        });
    }

    // Message Listener for Updates
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'ap_queue_state' && msg.data) {
            renderQueueMonitorState(msg.data);
            return;
        }
        if (msg.action === 'ap_upload_monitor' && msg.data) {
            const merged = {
                ...(apQueueMonitorState || buildFallbackQueueMonitorState()),
                monitorCounts: msg.data.counts || apQueueMonitorState?.monitorCounts || null
            };
            apQueueMonitorState = merged;
            updateApUploadMonitorStrip(merged, msg.data.counts);
            if (Array.isArray(msg.data.notes) && msg.data.notes.length) {
                const last = msg.data.notes[msg.data.notes.length - 1];
                if (last?.text) apLog(`🛡 ${last.text}`, last.source === 'ai' ? 'success' : 'info');
            }
            return;
        }
        if (msg.action === 'ap_update') {
            if (msg.monitorCounts) {
                const mergedMon = {
                    ...(apQueueMonitorState || buildFallbackQueueMonitorState()),
                    monitorCounts: msg.monitorCounts
                };
                apQueueMonitorState = mergedMon;
                updateApUploadMonitorStrip(mergedMon, msg.monitorCounts);
            }
            if (msg.percent !== undefined && AP.progressBar) AP.progressBar.style.width = `${msg.percent}%`;
            if (msg.percent !== undefined && AP.progressPercent) AP.progressPercent.textContent = `${msg.percent}%`;
            if (msg.accountEmail && !msg.done) {
                const uploaded = Number(msg.designUploaded) || 0;
                const planned = Number(msg.designPlanned) || 0;
                const mergedState = {
                    ...(apQueueMonitorState || buildFallbackQueueMonitorState()),
                    isRunning: msg.done ? false : true,
                    overallStatus: msg.done ? (msg.success ? 'uploaded' : 'failed') : 'uploading',
                    currentAccountEmail: msg.accountEmail,
                    currentAccountId: msg.accountEmail,
                    currentAccountUploaded: uploaded,
                    currentAccountPlanned: planned,
                    monitorCounts: msg.monitorCounts || apQueueMonitorState?.monitorCounts || null
                };
                apQueueMonitorState = mergedState;
                applyApActiveUploadVisuals(mergedState, { progressPercent: msg.percent });
                updateApUploadMonitorStrip(mergedState);
                if (!msg.done) {
                    apAccountsRenderFp = '';
                    renderAPAccounts();
                }
            } else if (msg.current && msg.total && AP.progressText && !formatApActiveUploadLabel(apQueueMonitorState)) {
                AP.progressText.textContent = `${msg.current} / ${msg.total} حساب`;
            }
            if (msg.log) apLog(msg.log, msg.type || 'info');
            if (msg.toast) showToast(msg.toast);

            // v16.0 — Countdown
            if (msg.action === 'ap_update' && msg.countdown !== undefined) {
                if (AP.countdownTimer) {
                    if (msg.countdown > 0) {
                        AP.countdownTimer.classList.remove('hidden');
                        const m = Math.floor(msg.countdown / 60).toString().padStart(2, '0');
                        const s = (msg.countdown % 60).toString().padStart(2, '0');
                        AP.countdownTimer.textContent = `${m}:${s}`;
                    } else {
                        AP.countdownTimer.classList.add('hidden');
                    }
                }
            }

            if (msg.done && AP.startBtn) {
                const finalState = {
                    ...(apQueueMonitorState || {}),
                    isRunning: false,
                    overallStatus: msg.success ? 'uploaded' : 'failed',
                    currentAccountEmail: '',
                    currentAccountUploaded: 0,
                    currentAccountPlanned: 0
                };
                syncApUploadControlButtons(finalState);
                applyApActiveUploadVisuals(finalState);
                if (msg.success) {
                    showToast('🎊 اكتملت جميع العمليات بنجاح!');
                } else if (!msg.zeroUploads) {
                    showToast('⚠️ اكتملت العملية مع أخطاء — راجع Queue Monitor');
                }
                // Auto refresh to show stats
                loadAPAccounts();
                loadQueueMonitorState();
            }
        }
    });

    // Sync Fields to Queue
    [AP_SEO.title, AP_SEO.mainTag, AP_SEO.tags, AP_SEO.desc].forEach(el => {
        if (el) el.addEventListener('input', syncAPtoQueue);
    });

}

// SEO Generation logic has been centralized in modules/seo/seo.js
// for better maintenance and batch processing support.

function syncAPtoQueue() {
    const queue = getDesignQueue();
    const activeEl = AP_SEO.queueList?.querySelector('.queue-item.active');
    const id = activeEl ? activeEl.dataset.id : (queue[0]?.id);
    if (!id) return;
    const item = queue.find(i => i.id === id);
    if (!item) return;
    item.meta = {
        title: AP_SEO.title.value,
        main_tag: AP_SEO.mainTag.value,
        tags: AP_SEO.tags.value.split(',').map(t => t.trim()).filter(Boolean),
        description: AP_SEO.desc.value,
        score: '100', risk: 'Low'
    };
    item.status = 'done';
    saveQueueToStorage();
    if (!apQueueMonitorState || !apQueueMonitorState.isRunning) {
        renderFallbackQueueMonitorUnlessPersisted();
    }
}

function applyToAll() {
    const queue = getDesignQueue();
    if (queue.length === 0) return showToast('⚠️ القائمة فارغة');
    const meta = {
        title: AP_SEO.title.value,
        main_tag: AP_SEO.mainTag.value,
        tags: AP_SEO.tags.value.split(',').map(t => t.trim()).filter(Boolean),
        description: AP_SEO.desc.value,
        score: '100', risk: 'Low'
    };
    if (!meta.title) return showToast('⚠️ تعبئة البيانات أولاً');
    queue.forEach(item => { item.meta = { ...meta }; item.status = 'done'; });
    renderQueue();
    saveQueueToStorage();
    if (!apQueueMonitorState || !apQueueMonitorState.isRunning) {
        renderFallbackQueueMonitorUnlessPersisted();
    }
    showToast('✅ تم الاستنساخ للكل في Autopilot');
}

function applyNicheFocus() {
    const niche = AP_SEO.nicheManual.value;
    if (!niche) return showToast('⚠️ اكتب نيتش أولاً');
    AP_SEO.title.value = `${niche} Design - Exclusive Edition`;
        AP_SEO.mainTag.value = niche.length > 38 ? niche.substring(0, 38).trim() : niche;
    let tags = AP_SEO.tags.value.split(',').map(t => t.trim()).filter(Boolean);
    if (!tags.includes(niche)) tags.unshift(niche);
    AP_SEO.tags.value = tags.slice(0, 15).join(', ');
    if (AP_SEO.desc.value.length < 10) AP_SEO.desc.value = `Premium ${niche} artwork for enthusiasts.`;
    syncAPtoQueue();
}

// الاستماع لأي تغيير في المنصة
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[AP_UPLOAD_QUEUE_STATE_KEY]) {
            const raw = changes[AP_UPLOAD_QUEUE_STATE_KEY].newValue;
            // Cleared only by explicit Reset (remove key) — do not invent empty fallback over failures.
            if (raw == null) {
                apQueueMonitorState = null;
                apQueueMonitorFp = '';
                syncApRetryFailedButton(null);
                if (isAutopilotPanelActive()) {
                    renderQueueMonitorState(buildFallbackQueueMonitorState());
                }
                return;
            }
            const nextState = sanitizeApQueueMonitorState(raw) || buildFallbackQueueMonitorState();
            if (!nextState?.isRunning) {
                apQueueMonitorFp = '';
                // Restore Retry Failed + monitor after storage writes even when idle.
                if (isAutopilotPanelActive() || hasPersistedApUploadResults(nextState) || apQueueStateHasStaleUploadMarkers(raw)) {
                    renderQueueMonitorState(nextState);
                    if (isAutopilotPanelActive() || apQueueStateHasStaleUploadMarkers(raw)) {
                        apAccountsRenderFp = '';
                        renderAPAccounts();
                    }
                } else {
                    apQueueMonitorState = nextState;
                    syncApUploadControlButtons(nextState);
                    applyApActiveUploadVisuals(nextState);
                    syncApRetryFailedButton(nextState);
                }
                return;
            }
            if (isAutopilotPanelActive() || isAutopilotUploadBusy(nextState)) {
                apQueueMonitorFp = '';
                renderQueueMonitorState(nextState);
            } else {
                apQueueMonitorState = nextState;
            }
        }
        if (area === 'local' && changes.active_platform) {
            if (changes.active_platform.newValue !== currentPlatform) {
                switchAPPlatform(changes.active_platform.newValue, false);
            }
        }
    });
}

/**
 * v16.1 — Check if account can upload more designs
 */
function toApFiniteUploadLimit(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function resolveApAccountDailyLimit(account) {
    return toApFiniteUploadLimit(account?.dailyLimit) ?? toApFiniteUploadLimit(account?.quota) ?? null;
}

function computeApAccountUploadLimit(account, effectiveCountPer) {
    const todayDate = new Date().toISOString().split('T')[0];
    if (account.lastUploadDate !== todayDate) {
        account.uploadedTodayCount = 0;
        account.lastUploadDate = todayDate;
    }
    if (account.dailyLimitReachedDate && account.dailyLimitReachedDate !== todayDate) {
        delete account.dailyLimitReachedDate;
    }
    // Platform hard-stop only — no artificial daily/50 ceiling for planning capacity.
    if (account.dailyLimitReachedDate === todayDate) return 0;

    const countPerAuto = effectiveCountPer == null;
    // «تلقائي» / empty = unlimited per account (design pool is the only safety).
    if (countPerAuto) return Infinity;

    const batchCap = toApFiniteUploadLimit(account?.batchLimit);
    const uploadedSession = Math.max(0, Number(account.sessionUploadedCount) || 0);
    const remainingBatch = batchCap == null ? Infinity : Math.max(0, batchCap - uploadedSession);
    const countPerCap = toApFiniteUploadLimit(effectiveCountPer);
    const caps = [remainingBatch];
    if (countPerCap != null) caps.push(countPerCap);
    const finiteCaps = caps.filter((v) => Number.isFinite(v));
    if (!finiteCaps.length) return Infinity;
    return Math.max(0, Math.min(...finiteCaps));
}

function fairDistributeDesignCountsPreview(totalDesigns, limits) {
    const safeLimits = (Array.isArray(limits) ? limits : []).map((limit) => {
        const n = Number(limit);
        if (n === Infinity) return Infinity;
        return Number.isFinite(n) && n > 0 ? n : 0;
    });
    const assigned = safeLimits.map(() => 0);
    let remaining = Math.max(0, totalDesigns);
    while (remaining > 0) {
        const eligible = safeLimits.map((limit, index) => index).filter((index) => assigned[index] < safeLimits[index]);
        if (eligible.length === 0) break;
        let pick = eligible[0];
        for (const index of eligible) {
            if (assigned[index] < assigned[pick] || (assigned[index] === assigned[pick] && index < pick)) {
                pick = index;
            }
        }
        assigned[pick] += 1;
        remaining -= 1;
    }
    return { assigned, unassigned: remaining };
}

function previewFairDistributionCapacity(designCount, accounts, effectiveCountPer) {
    const limits = accounts.map((acc) => computeApAccountUploadLimit(acc, effectiveCountPer));
    const plan = fairDistributeDesignCountsPreview(designCount, limits);
    const totalAssigned = plan.assigned.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const totalCapacity = limits.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
    return {
        limits,
        assigned: plan.assigned,
        totalAssigned,
        totalCapacity,
        unassigned: plan.unassigned
    };
}

function canUploadToAccount(account, effectiveCountPer = null) {
    const cap = (effectiveCountPer != null && Number.isFinite(Number(effectiveCountPer)) && Number(effectiveCountPer) > 0)
        ? Number(effectiveCountPer)
        : (getApMaxPerAccountFromInput(AP.designsPer).auto ? null : getApMaxPerAccountFromInput(AP.designsPer).countPer);
    if (computeApAccountUploadLimit(account, cap) <= 0) {
        const todayDate = new Date().toISOString().split('T')[0];
        if (account.dailyLimitReachedDate === todayDate) {
            console.log(`⚠️ الحساب ${account.email} متوقف اليوم (بلوغ الحد اليومي).`);
        } else if (account.dailyLimit && (account.uploadedTodayCount || 0) >= account.dailyLimit) {
            console.log(`⚠️ الحساب ${account.email} تجاوز الحد اليومي (${account.dailyLimit}).`);
        } else if (account.batchLimit && (account.sessionUploadedCount || 0) >= account.batchLimit) {
            console.log(`⚠️ الحساب ${account.email} تجاوز الحد المسموح لهذه الدفعة (${account.batchLimit}).`);
        } else {
            console.log(`⚠️ الحساب ${account.email} لا يملك سعة رفع متبقية.`);
        }
        return false;
    }
    return true;
}

const AP_GROUP_UI_DEFAULTS = {
    g_artisan: { emoji: '🏆', desc: 'الحسابات المتمرسة وذات الخبرة العالية' },
    g_apprentice: { emoji: '🎓', desc: 'الحسابات المتوسطة في مرحلة النمو' },
    g_new: { emoji: '🌱', desc: 'الحسابات الجديدة وحديثة الإنشاء' }
};

function getAutopilotGroupDisplay(group) {
    if (!group) return null;
    return { ...group, ...(AP_GROUP_UI_DEFAULTS[group.id] || {}) };
}

function setText(target, text) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.textContent = text;
}

function setHtml(target, html) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.innerHTML = html;
}

function setPlaceholder(target, text) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.placeholder = text;
}

function setTitle(target, text) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.title = text;
}

function setOptionText(selectEl, value, label) {
    if (!selectEl) return;
    const option = selectEl.querySelector(`option[value="${value}"]`);
    if (option) option.textContent = label;
}

function repairAutopilotStaticText() {
    const queueCard = AP_SEO.uploadTrigger?.closest('.glass-card');
    setText(queueCard?.querySelector('h3'), 'إدارة تصاميم الرفع الجماعي');
    setText('#ap-upload-trigger p', 'اضغط لرفع التصاميم لهذه الحملة');
    setText('#ap-upload-trigger span', 'يدعم رفع الصور الجماعي');
    setText('#ap-queue-container .uppercase', 'قائمة المهام');
    setText('#ap-queue-count', '0 ملفات');
    setTitle('#ap-clear-queue-btn', 'مسح الكل');

    setTitle('#ap-ask-ai-btn', 'توليد تحليل شامل لهذا التصميم');
    setTitle('#ap-test-colors-btn', 'اختبار الألوان الذكي');
    setTitle('#ap-seo-apply-all', 'تطبيق هذا الـ SEO على كل التصاميم');
    setPlaceholder(AP_SEO.nicheManual, 'نيتش خاص...');
    setHtml('#ap-seo-gen-btn', '<i class="fa-solid fa-wand-magic-sparkles"></i> بدء التحليل الشامل');
    setPlaceholder(AP_SEO.title, 'عنوان التصميم...');
    setTitle('#ap-seo-copy-title', 'نسخ العنوان');
    setPlaceholder(AP_SEO.mainTag, 'التاغ الرئيسي...');
    setTitle('#ap-seo-copy-main-tag', 'نسخ التاغ الرئيسي');
    setPlaceholder(AP_SEO.tags, 'التاغات...');
    setTitle('#ap-seo-copy-tags', 'نسخ التاغات');
    setPlaceholder(AP_SEO.desc, 'وصف التصميم...');
    setTitle('#ap-seo-copy-desc', 'نسخ الوصف');

    const groupsCard = document.getElementById('ap-groups-card');
    setText(groupsCard?.querySelector('h3'), 'مجموعات الحسابات');
    setHtml('#ap-new-group-btn', '<i class="fa-solid fa-plus text-[8px]"></i> مجموعة جديدة');
    setPlaceholder('#ap-group-name', 'اسم المجموعة');
    setPlaceholder('#ap-group-desc', 'وصف مختصر للمجموعة (اختياري)');
    setHtml('#ap-group-save-btn', '<i class="fa-solid fa-save"></i> حفظ المجموعة');
    setText('#ap-group-cancel-btn', 'إلغاء');
    setText('#ap-group-filter-bar .text-slate-400', 'يعرض:');
    setHtml('#ap-clear-filter-btn', '<i class="fa-solid fa-xmark"></i> عرض الكل');

    setOptionText(document.getElementById('ap-group-color'), '#a855f7', 'بنفسجي 💜');
    setOptionText(document.getElementById('ap-group-color'), '#6366f1', 'نيلي 💙');
    setOptionText(document.getElementById('ap-group-color'), '#10B981', 'أخضر 💚');
    setOptionText(document.getElementById('ap-group-color'), '#F59E0B', 'ذهبي 🌟');
    setOptionText(document.getElementById('ap-group-color'), '#EC4899', 'وردي 💗');
    setOptionText(document.getElementById('ap-group-color'), '#EF4444', 'أحمر ❤️');
    setOptionText(document.getElementById('ap-group-color'), '#06B6D4', 'سماوي 🩵');

    const accountsCard = AP.email?.closest('.glass-card');
    setText(accountsCard?.querySelector('h3'), 'إدارة الحسابات المتعددة');
    setOptionText(AP.platformSelect, 'teepublic', 'TeePublic');
    setOptionText(AP.platformSelect, 'redbubble', 'Redbubble');
    setOptionText(AP.platformSelect, 'amazon', 'Merch by Amazon');
    setOptionText(AP.platformSelect, 'pinterest', 'Pinterest');
    setPlaceholder(AP.email, 'إيميل الحساب');
    setPlaceholder(AP.pass, 'كلمة السر');
    setPlaceholder(AP.displayNameInput, 'اسم مستعار يظهر في القائمة بدل الإيميل (اختياري)');
    setPlaceholder(AP.proxy, 'بروكسي للحساب أو اتركه فارغاً');
    setPlaceholder(AP.quota, 'الحد اليومي');
    setOptionText(AP.nicheMap, 'all', 'كل النيتشات');
    setOptionText(AP.groupAssign, '', '📦 بدون مجموعة');
    setText('#toggle-proxy-pool span', 'مخزن البروكسيات التلقائي');
    setPlaceholder(AP.proxyPool, 'أدخل قائمة البروكسيات هنا، واحد في كل سطر...\nip:port:user:pass');
    setText('label[for="ap-auto-rotate"]', 'تدوير تلقائي عند كل دخول');
    setHtml('#ap-add-account', '<i class="fa-solid fa-plus-circle"></i> التحقق وحفظ الحساب');
    setTitle('#ap-export-accounts', 'تصدير الحسابات');
    setHtml('#ap-export-accounts', '<i class="fa-solid fa-file-export"></i> تصدير');
    setTitle('#ap-import-accounts', 'استيراد الحسابات');
    setHtml('#ap-import-accounts', '<i class="fa-solid fa-file-import"></i> استيراد');
    setTitle('#ap-export-session-backup', 'تصدير نسخة احتياطية للجلسات والحسابات');
    setHtml('#ap-export-session-backup', '<i class="fa-solid fa-floppy-disk"></i> تصدير الجلسات');
    setTitle('#ap-import-session-backup', 'استيراد نسخة احتياطية للجلسات والحسابات');
    setHtml('#ap-import-session-backup', '<i class="fa-solid fa-box-open"></i> استعادة الجلسات');
    setText('#ap-session-backup-note', 'ينشئ نسخاً احتياطية محلية لجلسات server_profiles مع بيانات حسابات Autopilot لسهولة الاستعادة.');
    setTitle('#ap-delete-all-accounts', 'حذف كل الحسابات');
    setHtml('#ap-delete-all-accounts', '<i class="fa-solid fa-trash"></i>');
    setHtml('#ap-select-all', '<i class="fa-solid fa-check-double text-[8px]"></i> تحديد الكل');
    setHtml('#ap-deselect-all', '<i class="fa-regular fa-square text-[8px]"></i> إلغاء الكل');
    setText('#ap-selected-count', '0 محدد');

    const statusCard = AP.serverDot?.closest('.glass-card');
    setTitle(AP.serverDot, 'Ghost Server: غير متصل');
    setText(statusCard?.querySelector('h3'), 'إعدادات الرفع الجماعي الذكي');
    setText('#ap-server-status-text', 'غير متصل');
    setTitle('#ap-wakeup-btn', 'تشغيل Ghost Server عبر البروتوكول المخصص');
    setHtml('#ap-wakeup-btn', '<i class="fa-solid fa-power-off text-[10px]"></i> تشغيل السيرفر');
    setTitle('#ap-server-stop-btn', 'إيقاف Ghost Server');
    setHtml('#ap-server-stop-btn', '<i class="fa-solid fa-stop text-[10px]"></i> إيقاف السيرفر');

    const settingsLabels = statusCard?.querySelectorAll('.field-card > label');
    if (settingsLabels?.[0]) settingsLabels[0].textContent = 'الحد الأقصى لكل حساب';
    if (settingsLabels?.[1]) settingsLabels[1].textContent = 'تأخير بين الرفع (ثواني)';
    setText('label[for="ap-visual-mode"]', 'الوضع البصري (فتح التبويبات أمامك)');
    setText('label[for="ap-auto-login"]', 'دخول آلي');
    setHtml('label[for="ap-fair-distribution"]', 'توزيع عادل ⚖️ <span class="text-[8px] text-slate-500 block">تقسيم التصاميم بالتساوي بين الحسابات (سعة غير محدودة ما لم تحدد حداً)</span>');
    setHtml('label[for="ap-random-distribution"]', 'توزيع عشوائي <span class="text-[8px] text-slate-500 block">عند التعطيل: توزيع دائري متتالي</span>');
    setText('#ap-random-distribution + label + span', 'دائري');

    const actionTypeCard = document.querySelector('input[name="ap-action-type"]')?.closest('.field-card');
    setText(actionTypeCard?.querySelector('label.text-primary'), 'نوع العملية');
    const actionLabels = actionTypeCard?.querySelectorAll('label.flex.items-center.gap-2.cursor-pointer.text-xs span');
    if (actionLabels?.[0]) actionLabels[0].textContent = 'نشر نهائي';
    if (actionLabels?.[1]) actionLabels[1].textContent = 'ملء المعلومات فقط';

    const colorCard = document.querySelector('input[name="ap-default-color"]')?.closest('.field-card');
    setHtml(colorCard?.querySelector('label.block'), '<i class="fa-solid fa-palette text-pink-400"></i> لون الخلفية الافتراضي');
    const colorLabels = colorCard?.querySelectorAll('label.flex.items-center.gap-1.cursor-pointer.text-\\[10px\\]');
    if (colorLabels?.[0]) colorLabels[0].lastChild.textContent = ' أسود';
    if (colorLabels?.[1]) colorLabels[1].lastChild.textContent = ' أبيض';
    if (colorLabels?.[2]) colorLabels[2].lastChild.textContent = ' كحلي';
    if (colorLabels?.[3]) colorLabels[3].lastChild.textContent = ' أحمر';

    setTitle('#ap-start-btn', AP_START_BTN_IDLE_TITLE);
    setHtml('#ap-start-btn', AP_START_BTN_IDLE_HTML);
    AP.startBtn = document.getElementById('ap-start-btn');
    AP.countdownTimer = document.getElementById('ap-countdown-timer');
    syncApUploadControlButtons(apQueueMonitorState);
    setTitle('#ap-reset-btn', 'إعادة تعيين القائمة');
    setHtml('#ap-reset-btn', '<i class="fa-solid fa-rotate-left"></i> إعادة تعيين');

    setText('#ap-modal-group-title', '');
    const modalInfo = document.querySelector('#ap-group-assign-modal .text-\\[8px\\].text-slate-400');
    setText(modalInfo, 'حدد الحسابات لتعيينها لهذه المجموعة');
    setPlaceholder('#ap-modal-search', 'بحث بالاسم أو الإيميل...');
    setHtml('#ap-modal-select-all', '<i class="fa-solid fa-check-double text-[8px]"></i> تحديد الكل');
    setHtml('#ap-modal-deselect-all', '<i class="fa-regular fa-square text-[8px]"></i> إلغاء الكل');
    const counter = document.querySelector('#ap-modal-counter')?.parentElement;
    if (counter) {
        counter.innerHTML = '<span id="ap-modal-counter" style="color:#a855f7; font-weight:800;">0</span> حساب محدد من أصل <span id="ap-modal-total">0</span>';
    }
    setHtml('#ap-modal-save', '<i class="fa-solid fa-save"></i> حفظ التعيينات');
    setText('#ap-modal-cancel', 'إلغاء');
}

openAccountBrowser = async function openAccountBrowserOverride(acc, options = {}) {
    const alias = acc.displayName || acc.storeName || acc.email.split('@')[0];
    const targetUrl = options.targetUrl || null;
    apLog(`🌐 فتح جلسة يدوية لحساب: ${alias} (${acc.email})`, 'info');
    showToast(`🌐 جاري فتح متصفح لـ: ${alias}...`);

    const port = SERVER_PORTS[currentPlatform] || 3019;
    const browseUrl = await apLocalUrl(port, '/browse-account');
    const pingUrl = await apLocalUrl(port, '/ping');

    try {
        const res = await fetchWithTimeout(browseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: acc.email,
                pass: acc.pass,
                proxy: acc.proxy || null,
                autoLogin: AP.autoLogin?.checked ?? true,
                targetUrl
            })
        }, 45000);

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success !== false) {
            apLog(`✅ تم فتح متصفح خاص ببصمة الحساب: ${alias}`, 'success');
            showToast('✅ تم فتح المتصفح بنجاح!');
            return;
        }

        const pingOk = await fetchWithTimeout(pingUrl, {}, 3000).then((r) => r.ok).catch(() => false);
        const serverError = data.error || `HTTP ${res.status}`;
        if (pingOk) {
            apLog(`⚠️ Ghost Server متصل لكن فتح الجلسة فشل: ${serverError}`, 'error');
            showToast('⚠️ السيرفر متصل لكن فتح الجلسة فشل.');
            return;
        }
    } catch (err) {
        const msg = String(err?.message || '');
        const timedOut = err?.name === 'AbortError' || /abort|timeout/i.test(msg);
        const pingOk = await fetchWithTimeout(pingUrl, {}, 3000).then((r) => r.ok).catch(() => false);

        if (pingOk) {
            if (timedOut) {
                apLog('⏳ Ghost Server يفتح الجلسة ببطء ولن يتم فتح تبويب احتياطي', 'info');
                showToast('⏳ السيرفر يفتح الجلسة... انتظر قليلاً');
            } else {
                apLog(`⚠️ Ghost Server متصل لكن حدث خطأ في فتح الجلسة: ${msg}`, 'error');
                showToast('⚠️ حدث خطأ في فتح الجلسة، ولن يتم فتح تبويب عادي.');
            }
            return;
        }
    }

    apLog('❌ Ghost Server غير متصل. تم إلغاء فتح الحساب لحماية الجلسة ومنع طلب المشغل الخارجي.', 'error');
    showToast('❌ Ghost Server غير متصل. لم يتم فتح Chrome عادي أو طلب إذن خارجي.');
};

function fitAccountListHeightToVisibleRows() {
    if (!AP.list) return;
    AP.list.style.removeProperty('height');
    AP.list.style.removeProperty('min-height');
    AP.list.style.removeProperty('max-height');
    AP.list.style.removeProperty('overflow-y');
}

function buildApAccountRowActionsHtml(acc) {
    const albumsButton = currentPlatform === 'teepublic'
        ? `<button class="open-ap-albums-btn ap-acc-icon-btn" data-id="${acc.id}" title="فتح صفحة ألبومات TeePublic لهذا الحساب">
              <i class="fa-solid fa-folder-tree"></i>
            </button>`
        : '';
    return `
        <button class="btn-isolated-session open-ap-browser-btn ap-acc-icon-btn" data-id="${acc.id}" title="فتح جلسة معزولة للحساب">👁️</button>
        ${albumsButton}`;
}

renderAPAccounts = function renderAPAccountsOverride() {
    if (!AP.list) return;
    const panelUi = isAutopilotPanelActive() || isAutopilotUploadBusy(apQueueMonitorState);
    if (!panelUi) return;
    const accountsFp = buildApAccountsFingerprint();
    if (accountsFp === apAccountsRenderFp && editingId == null) return;
    apAccountsRenderFp = accountsFp;

    // Update active tab buttons UI class
    const creatyBtn = document.getElementById('admin-tab-creaty-btn');
    const normalBtn = document.getElementById('admin-tab-normal-btn');
    if (creatyBtn && normalBtn) {
        if (activeAdminAccountSourceTab === 'creaty') {
            creatyBtn.classList.add('is-active');
            normalBtn.classList.remove('is-active');
        } else {
            normalBtn.classList.add('is-active');
            creatyBtn.classList.remove('is-active');
        }
    }
    
    // Update sub-tab count badges
    const creatyCountEl = document.getElementById('admin-creaty-count');
    const normalCountEl = document.getElementById('admin-normal-count');
    if (creatyCountEl) {
        creatyCountEl.textContent = autopilotAccounts.filter(a => a.sourceType === 'creaty').length;
    }
    if (normalCountEl) {
        normalCountEl.textContent = autopilotAccounts.filter(a => a.sourceType === 'normal').length;
    }

    // Update search input value to match the active tab's query
    const searchInput = document.getElementById('admin-accounts-search');
    if (searchInput) {
        searchInput.value = activeAdminAccountSourceTab === 'creaty' ? adminCreatySearchQuery : adminNormalSearchQuery;
    }

    if (autopilotAccounts.length === 0) {
        AP.list.innerHTML = `<div class="text-center py-6 text-xs text-slate-500">
            <i class="fa-solid fa-users-slash text-[20px] mb-2 block opacity-30"></i>
            لا توجد حسابات مضافة حالياً</div>`;
        updateSelectedCount();
        fitAccountListHeightToVisibleRows(5);
        return;
    }

    const filteredAccounts = getFilteredAutopilotAccounts();
    const visibleAccounts = isLowSpecModeEnabled()
        ? filteredAccounts.slice(0, 80)
        : filteredAccounts;

    if (filteredAccounts.length === 0) {
        const emptyMsg = activeGroupFilter
            ? 'لا توجد حسابات في هذه المجموعة بعد'
            : 'لا توجد حسابات مضافة حالياً في هذا القسم';
        AP.list.innerHTML = `<div class="text-center py-6 text-xs text-slate-500">
            <i class="fa-solid fa-users-slash text-[20px] mb-2 block opacity-30"></i>
            ${emptyMsg}</div>`;
        updateSelectedCount();
        fitAccountListHeightToVisibleRows(5);
        return;
    }

    AP.list.innerHTML = visibleAccounts.map((acc) => {
        const index = autopilotAccounts.indexOf(acc);
        const alias = acc.displayName || acc.storeName || acc.email.split('@')[0];
        
        // Use the selection array to determine if selected
        const selSet = getSelectionSetForAccount(acc);
        const isSelected = isAccountIdInSelectionSet(acc.id, selSet);
            
        const isVerified = !!acc.verified;
        const runLimit = Number.isFinite(Number(acc.batchLimit)) && Number(acc.batchLimit) > 0 ? Number(acc.batchLimit) : '';
        const dayLimit = Number.isFinite(Number(acc.dailyLimit)) && Number(acc.dailyLimit) > 0 ? Number(acc.dailyLimit) : '';
        const uploadedToday = Number(acc.uploadedTodayCount || 0) || 0;
        const isUploadingActive = isSameApAccount(getActiveUploadAccountFromState(apQueueMonitorState), acc);
        return `
        <div class="ap-acc-card${isUploadingActive ? ' is-active' : ''}"
             data-index="${index}" data-id="${acc.id}"
             style="background:${isUploadingActive ? 'rgba(129,140,248,0.14)' : (isSelected ? 'rgba(108,99,255,0.08)' : 'rgba(15,12,35,0.45)')};">
          ${buildApDragHandleHtml()}
          <input type="checkbox" class="ap-account-checkbox"
                 data-id="${acc.id}" ${isSelected ? 'checked' : ''}
                 style="width:14px; height:14px; accent-color: var(--primary); cursor:pointer;">
          <div class="ap-acc-email ap-alias-display"
               data-id="${acc.id}"
               title="${alias} • انقر مرتين لتعديل الاسم المستعار">${acc.email}</div>
          ${isUploadingActive ? '<span class="ap-acc-uploading-badge" title="الحساب قيد الرفع الآن">⏳ جاري الرفع</span>' : ''}
          <span class="ap-acc-proxy" title="${isVerified ? 'Account linked and verified' : 'Account needs verification'}"
                style="color:${isVerified ? '#34d399' : '#64748b'};">
            <i class="fa-solid ${isVerified ? 'fa-shield-halved' : 'fa-globe'}"></i>
          </span>
          <div class="ap-acc-inline-limits ap-limit-controls">
            <label>Run
              <input type="number" class="ap-limit-input ap-batch-limit" data-id="${acc.id}" value="${runLimit}" min="1" max="50" placeholder="auto">
            </label>
            <label>Day
              <input type="number" class="ap-limit-input ap-daily-limit" data-id="${acc.id}" value="${dayLimit}" min="1" max="500" placeholder="none">
            </label>
            <span class="ap-day-used" title="Uploaded today">${uploadedToday}</span>
          </div>
          <div class="ap-acc-actions">${buildApAccountRowActionsHtml(acc)}</div>
          <button class="edit-ap-acc-btn ap-acc-icon-btn" data-id="${acc.id}" title="تعديل بيانات الحساب">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="remove-ap-acc-btn ap-acc-icon-btn" data-id="${acc.id}" title="حذف الحساب">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>`;
    }).join('');

    // Sync Select All checkbox state
    syncAdminSelectAllCheckboxState();

    setupAPDragDrop();
    updateSelectedCount();
    highlightActiveUploadAccount(apQueueMonitorState);
    requestAnimationFrame(() => fitAccountListHeightToVisibleRows(isLowSpecModeEnabled() ? 3 : 5));
};

updateSelectedCount = function updateSelectedCountOverride() {
    const el = document.getElementById('ap-selected-count') || AP.selectedCount;
    if (!el) return;
    const total = autopilotAccounts.filter(a => a.sourceType === activeAdminAccountSourceTab).length;
    const selectedSet = activeAdminAccountSourceTab === 'creaty' ? selectedAdminCreatyAccountIds : selectedAdminNormalAccountIds;
    const selected = selectedSet.length;
    el.textContent = `${selected} / ${total} محدد`;
    el.style.color = selected > 0 ? 'var(--primary)' : '#6B7280';
    el.style.borderColor = selected > 0 ? 'rgba(108,99,255,0.3)' : 'rgba(107,114,128,0.2)';
    el.style.background = selected > 0 ? 'rgba(108,99,255,0.1)' : 'rgba(107,114,128,0.06)';
};

renderGroups = function renderGroupsOverride() {
    const grid = document.getElementById('ap-groups-grid');
    if (!grid) return;
    if (autopilotGroups.length === 0) {
        grid.innerHTML = `<div class="col-span-3 text-center py-4 text-xs text-slate-500">
            <i class="fa-solid fa-layer-group text-[22px] mb-2 block opacity-20"></i>
            لا توجد مجموعات، أنشئ مجموعتك الأولى!</div>`;
        return;
    }

    grid.innerHTML = autopilotGroups.map((group) => {
        const g = getAutopilotGroupDisplay(group);
        const count = autopilotAccounts.filter((a) => a.groupId === g.id).length;
        const isActive = activeGroupFilter === g.id;
        const rgb = hexToRgb(g.color);
        return `
        <div class="ap-group-card" data-gid="${g.id}"
             style="background:${isActive ? `rgba(${rgb},0.2)` : 'rgba(15,12,35,0.45)'};
                    border:1px solid ${isActive ? g.color : 'rgba(148,163,184,0.22)'};
                    color:${isActive ? g.color : '#cbd5e1'};
                    transition:all 0.12s;cursor:pointer;">
            <span>${g.emoji}</span>
            <span style="white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;">${g.name}</span>
            <span style="opacity:0.9;">${count}</span>
            <button class="ap-group-assign-accounts-btn" data-gid="${g.id}" title="تعيين حسابات"
                    style="margin-inline-start:auto;background:transparent;border:0;color:inherit;padding:0 2px;">
              <i class="fa-solid fa-users-plus"></i>
            </button>
            <button class="ap-group-edit-btn" data-gid="${g.id}" title="تعديل"
                    style="background:transparent;border:0;color:inherit;padding:0 2px;">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="ap-group-delete-btn" data-gid="${g.id}" title="حذف"
                    style="background:transparent;border:0;color:#f87171;padding:0 2px;">
              <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>`;
    }).join('');
};

populateGroupSelect = function populateGroupSelectOverride() {
    const sel = document.getElementById('ap-group-assign');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">📦 بدون مجموعة</option>` +
        autopilotGroups.map((group) => {
            const g = getAutopilotGroupDisplay(group);
            return `<option value="${g.id}">${g.emoji} ${g.name}</option>`;
        }).join('');
    sel.value = cur;

    const opGroupSel = document.getElementById('operation-group-select');
    if (opGroupSel) {
        const opCur = opGroupSel.value;
        opGroupSel.innerHTML = autopilotGroups.map((group) => {
            const g = getAutopilotGroupDisplay(group);
            return `<option value="${g.id}">${g.emoji} ${g.name}</option>`;
        }).join('');
        if (opCur && autopilotGroups.some(g => g.id === opCur)) {
            opGroupSel.value = opCur;
        } else if (autopilotGroups.length > 0) {
            const firstG = getAutopilotGroupDisplay(autopilotGroups[0]);
            opGroupSel.value = firstG.id;
        }
    }
};

renderModalAccounts = function renderModalAccountsOverride(query) {
    const list = document.getElementById('ap-modal-accounts-list');
    if (!list) return;
    const q = query.toLowerCase();
    const filtered = autopilotAccounts.filter((acc) => {
        if (!q) return true;
        const alias = (acc.displayName || acc.storeName || acc.email.split('@')[0]).toLowerCase();
        return alias.includes(q) || acc.email.toLowerCase().includes(q);
    });
    document.getElementById('ap-modal-total').textContent = filtered.length;
    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:20px;font-size:11px;color:#6B7280;">
            <i class="fa-solid fa-users-slash" style="font-size:20px;display:block;margin-bottom:8px;opacity:0.3;"></i>
            لا توجد حسابات مضافة بعد</div>`;
        updateModalCounter();
        return;
    }

    list.innerHTML = filtered.map((acc) => {
        const alias = acc.displayName || acc.storeName || acc.email.split('@')[0];
        const isInGroup = acc.groupId === _modalGroupId;
        const otherRawGroup = (acc.groupId && acc.groupId !== _modalGroupId)
            ? autopilotGroups.find((g) => g.id === acc.groupId)
            : null;
        const otherGrp = getAutopilotGroupDisplay(otherRawGroup);
        return `
        <div class="ap-modal-acc-row" style="display:flex;align-items:center;gap:8px;padding:7px 10px;
                     background:${isInGroup ? 'rgba(168,85,247,0.08)' : 'rgba(15,12,35,0.5)'};
                     border:1px solid ${isInGroup ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.06)'};
                     border-radius:10px;transition:background 0.15s,border-color 0.15s;cursor:pointer;">
            <input type="checkbox" class="ap-modal-acc-checkbox" data-id="${acc.id}"
                   ${isInGroup ? 'checked' : ''}
                   style="width:15px;height:15px;accent-color:#a855f7;flex-shrink:0;cursor:pointer;">
            <div style="flex:1;overflow:hidden;">
                <div style="font-size:11px;font-weight:800;color:#fff;white-space:nowrap;
                            overflow:hidden;text-overflow:ellipsis;">${alias}</div>
                <div style="display:flex;align-items:center;gap:4px;margin-top:1px;">
                    <span style="font-size:8px;color:#4B5563;font-family:monospace;
                                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;"
                          title="${acc.email}">${acc.email}</span>
                    ${otherGrp ? `<span style="font-size:7px;color:${otherGrp.color};background:${otherGrp.color}18;
                        padding:1px 5px;border-radius:4px;border:1px solid ${otherGrp.color}33;">
                        ${otherGrp.emoji} ${otherGrp.name}</span>` : ''}
                </div>
            </div>
            ${isInGroup ? `<i class="fa-solid fa-circle-check" style="color:#a855f7;font-size:11px;flex-shrink:0;"></i>` : ''}
        </div>`;
    }).join('');
    updateModalCounter();
};
