// ══════════════════════════════════════════════════════
//  ████████  ADMIN & SYNC MODULE  ████████
// ══════════════════════════════════════════════════════


let workspaceHandle = null;
window.NHP_WorkspaceHandle = null;

let lastSmartSyncTime = 0;
let smartSyncInterval = null;
let smartSyncPollInProgress = false;
let smartSyncPermissionDenied = false;
let smartSyncPermissionWarned = false;
let adminModuleInitialized = false;
let adminSetupLoaded = false;
let adminCurrentView = 'main';

const ADMIN_SETUP_HASHES = new Set(['setup', 'admin/setup']);

let adminCenterLangRtl = true;
let adminCenterActiveTab = 'overview';
let adminCenterUiInitialized = false;
let adminScanResultRows = [];
let adminDiagnosticLogRows = [];
let adminLastServersSnapshot = null;
let adminSetupStatusSnapshot = null;
let adminLastStatusCheckedAt = null;
let adminStatusRefreshTimer = null;
let adminStatusRefreshInFlight = false;

const ADMIN_I18N = {
    navAdminCenter: { ar: 'مركز الإدارة', en: 'Admin Center' },
    navSetup: { ar: 'التهيئة', en: 'Setup' },
    pageTitle: { ar: 'مركز الإدارة', en: 'Admin Center' },
    pageSubtitle: { ar: 'إدارة الحساب، المزامنة، الخدمات، والتشخيص من لوحة واحدة.', en: 'Manage account, sync, services, and diagnostics from one dashboard.' },
    aiSender: { ar: 'إرسال الصور', en: 'AI Sender' },
    kpiSystem: { ar: 'حالة النظام', en: 'System status' },
    kpiSync: { ar: 'المزامنة', en: 'Sync' },
    kpiAccount: { ar: 'الحساب', en: 'Account' },
    kpiFullScan: { ar: 'الفحص الشامل', en: 'Full scan' },
    kpiLastSync: { ar: 'آخر مزامنة', en: 'Last sync' },
    tabOverview: { ar: 'نظرة عامة', en: 'Overview' },
    tabAccount: { ar: 'الحساب والأمان', en: 'Account & Security' },
    tabSync: { ar: 'المزامنة والنسخ', en: 'Sync & Backup' },
    tabPreferences: { ar: 'التفضيلات', en: 'Preferences' },
    tabServices: { ar: 'الخدمات', en: 'Services' },
    tabIntegrations: { ar: 'التكاملات', en: 'Integrations' },
    tabDiagnostics: { ar: 'التشخيص', en: 'Diagnostics' },
    overviewStatusTitle: { ar: 'حالة النظام', en: 'System status' },
    openSetup: { ar: 'فتح صفحة التهيئة', en: 'Open Setup page' },
    colComponent: { ar: 'المكوّن', en: 'Component' },
    colStatus: { ar: 'الحالة', en: 'Status' },
    colDetails: { ar: 'التفاصيل', en: 'Details' },
    colService: { ar: 'الخدمة', en: 'Service' },
    colPort: { ar: 'المنفذ', en: 'Port' },
    colActions: { ar: 'الإجراءات', en: 'Actions' },
    colLevel: { ar: 'المستوى', en: 'Level' },
    colItem: { ar: 'البند', en: 'Item' },
    colTime: { ar: 'الوقت', en: 'Time' },
    colMessage: { ar: 'الرسالة', en: 'Message' },
    loading: { ar: 'جاري التحميل…', en: 'Loading…' },
    alertsTitle: { ar: 'التنبيهات', en: 'Alerts' },
    alertsEmpty: { ar: 'لا توجد تنبيهات حالياً.', en: 'No alerts at the moment.' },
    statusOnline: { ar: 'متصل', en: 'Online' },
    statusOffline: { ar: 'غير متصل', en: 'Offline' },
    statusDisabled: { ar: 'معطّل', en: 'Disabled' },
    statusEnabled: { ar: 'مفعّل', en: 'Enabled' },
    statusConfigured: { ar: 'مهيّأ', en: 'Configured' },
    statusNotConfigured: { ar: 'غير مهيّأ', en: 'Not configured' },
    statusPartial: { ar: 'جزئي', en: 'Partial' },
    statusCheckedAt: { ar: 'آخر فحص', en: 'Last checked' },
    statusGuest: { ar: 'زائر', en: 'Guest' },
    statusSignedIn: { ar: 'مسجّل', en: 'Signed in' },
    statusNever: { ar: 'لم تُجرَ', en: 'Never run' },
    statusReady: { ar: 'جاهز', en: 'Ready' },
    firstRunIncomplete: { ar: 'التشغيل الأول غير مكتمل', en: 'First run incomplete' },
    firstRunComplete: { ar: 'التشغيل الأول مكتمل', en: 'First run complete' },
    alertNative: { ar: 'Native Messaging غير مسجّل — شغّل التهيئة.', en: 'Native Messaging not registered — run Setup.' },
    alertServicesDown: { ar: 'بعض الخدمات متوقفة.', en: 'Some services are offline.' },
    scanNoResults: { ar: 'لم يُجرَ فحص بعد.', en: 'No scan run yet.' },
    logsEmpty: { ar: 'لا توجد سجلات.', en: 'No logs yet.' },
    menuStart: { ar: 'تشغيل', en: 'Start' },
    menuStop: { ar: 'إيقاف', en: 'Stop' },
    menuRestart: { ar: 'إعادة', en: 'Restart' },
    menuTerminal: { ar: 'طرفية', en: 'Terminal' },
    menuToggle: { ar: 'تعطيل/تفعيل', en: 'Disable/enable' },
    promptBagUiTitle: { ar: 'واجهة Prompt Bag', en: 'Prompt Bag UI' },
    promptBagOverlay: { ar: 'حقيبة البرومبت العائمة', en: 'Floating Prompt Bag' },
    promptBagOverlayDesc: {
        ar: 'إظهار أو إخفاء أيقونة الحقيبة العائمة (Notes / Images / Prompts / GEM / GPT) على الصفحات',
        en: 'Show or hide the floating bag icon (Notes / Images / Prompts / GEM / GPT) on pages'
    },
    btnContinueGoogle: { ar: 'المتابعة بحساب Google', en: 'Continue with Google' },
    authOrDivider: { ar: 'أو', en: 'or' },
    googleNotConfigured: {
        ar: 'تسجيل Google غير مهيأ على الخادم بعد. استخدم الاسم المستعار أو اضبط FIREBASE_* على EmailCore.',
        en: 'Google sign-in is not configured on the server yet. Use nickname login or set FIREBASE_* on EmailCore.'
    },
    googleSigningIn: { ar: 'جاري المتابعة بحساب Google…', en: 'Continuing with Google…' },
    googleSignInFailed: { ar: 'فشل تسجيل الدخول عبر Google', en: 'Google sign-in failed' },
    googlePending: {
        ar: 'تم تسجيل حساب Google — بانتظار موافقة المدير قبل الدخول.',
        en: 'Google account registered — awaiting admin approval before you can sign in.'
    },
    accountLoginTitle: { ar: 'تسجيل الدخول', en: 'Sign in' },
    accountSecurityBadge: { ar: 'الحساب والحماية', en: 'Account & Security' },
    btnLogin: { ar: 'تسجيل الدخول / إنشاء حساب', en: 'Sign in / Create account' },
    forgotPassword: { ar: 'نسيت كلمة السر؟', en: 'Forgot password?' },
    phNickname: { ar: 'الاسم المستعار', en: 'Nickname' },
    phPassword: { ar: 'كلمة المرور', en: 'Password' },
    btnLogout: { ar: 'تسجيل الخروج', en: 'Sign out' },
    activeAccount: { ar: 'الحساب النشط', en: 'Active account' }
};

function adminIsRtl() {
    const root = document.getElementById('admin-center-root');
    if (root?.getAttribute('dir')) return root.getAttribute('dir') === 'rtl';
    return adminCenterLangRtl !== false;
}

function adminI18n(key, vars = {}) {
    const entry = ADMIN_I18N[key];
    if (!entry) return key;
    let text = adminIsRtl() ? entry.ar : entry.en;
    Object.entries(vars).forEach(([k, v]) => { text = text.replace(`{${k}}`, v); });
    return text;
}

function adminT(ar, en) { return adminIsRtl() ? ar : en; }

function summarizeNhpLocalServers(servers = []) {
    const list = Array.isArray(servers) ? servers : [];
    const enabled = list.filter((item) => !item.disabled);
    const onlineEnabled = enabled.filter((item) => item.online).length;
    const disabledCount = list.filter((item) => item.disabled).length;
    const offlineEnabled = enabled.filter((item) => !item.online).map((item) => item.label || item.id);
    return {
        onlineEnabled,
        enabledTotal: enabled.length,
        total: list.length,
        disabledCount,
        offlineEnabled,
        allEnabledOnline: enabled.length > 0 && onlineEnabled === enabled.length
    };
}

function formatNhpLocalServersStatusMessage(servers = []) {
    const summary = summarizeNhpLocalServers(servers);
    if (summary.disabledCount > 0) {
        return adminT(
            `${summary.onlineEnabled} / ${summary.enabledTotal} نشطة (${summary.disabledCount} معطّلة)`,
            `${summary.onlineEnabled} / ${summary.enabledTotal} active (${summary.disabledCount} disabled)`
        );
    }
    return adminT(
        `${summary.onlineEnabled} / ${summary.total} سيرفرات متصلة`,
        `${summary.onlineEnabled} / ${summary.total} servers online`
    );
}

function nhpLocalServersStatusTone(servers = []) {
    const summary = summarizeNhpLocalServers(servers);
    if (summary.enabledTotal === 0) return 'slate';
    return summary.allEnabledOnline ? 'emerald' : (summary.onlineEnabled > 0 ? 'slate' : 'rose');
}

function nhpLocalServerStatusBadge(server = {}) {
    if (server.disabled) {
        if (server.online) {
            return `<span class="ac-badge warn">${adminEscapeHtml(adminT('معطّل (يعمل)', 'Disabled (running)'))}</span>`;
        }
        return `<span class="ac-badge">${adminEscapeHtml(adminI18n('statusDisabled'))}</span>`;
    }
    if (server.online) {
        return `<span class="ac-badge ok">${adminEscapeHtml(adminI18n('statusOnline'))}</span>`;
    }
    return `<span class="ac-badge fail">${adminEscapeHtml(adminI18n('statusOffline'))}</span>`;
}

function loadAdminCenterStyles() {
    if (document.getElementById('admin-center-styles')) return;
    const link = document.createElement('link');
    link.id = 'admin-center-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('modules/admin/admin-center.css');
    document.head.appendChild(link);
}

function applyAdminCenterI18n() {
    const root = document.getElementById('admin-center-root');
    if (!root) return;
    root.setAttribute('dir', adminIsRtl() ? 'rtl' : 'ltr');
    root.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (key && ADMIN_I18N[key]) el.textContent = adminI18n(key);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.placeholder = adminI18n(key);
    });
    const langBtn = document.getElementById('btn-admin-lang-toggle');
    if (langBtn) langBtn.textContent = adminIsRtl() ? 'EN' : 'AR';
}

const ADMIN_CENTER_TAB_IDS = ['overview', 'account', 'sync', 'preferences', 'services', 'integrations', 'diagnostics'];

function resolveAdminCenterTabId(tabBtn) {
    if (!tabBtn) return '';
    const fromData = tabBtn.getAttribute('data-admin-tab');
    if (fromData && ADMIN_CENTER_TAB_IDS.includes(fromData)) return fromData;
    const fromId = String(tabBtn.id || '')
        .replace(/^admin-tab-btn-/, '')
        .replace(/^admin-tab-/, '');
    return ADMIN_CENTER_TAB_IDS.includes(fromId) ? fromId : '';
}

function getAdminCenterTabButton(tabId) {
    return document.getElementById(`admin-tab-btn-${tabId}`)
        || document.getElementById(`admin-tab-${tabId}`)
        || document.querySelector(`.ac-tabs [data-admin-tab="${tabId}"]`);
}

function getAdminCenterTabPanel(tabId) {
    return document.getElementById(`admin-tab-panel-${tabId}`)
        || document.querySelector(`.ac-tab-panel[data-admin-panel="${tabId}"]`);
}

function bindAdminCenterTabHandlers() {
    const root = document.getElementById('admin-center-root');
    if (!root || root.dataset.adminTabsBound === '1') return;
    root.dataset.adminTabsBound = '1';
    root.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.ac-tab-btn[data-admin-tab], .ac-tab-btn[id^="admin-tab-btn-"], .ac-tab-btn[id^="admin-tab-"]');
        if (!tabBtn || !root.contains(tabBtn)) return;
        const tabId = resolveAdminCenterTabId(tabBtn);
        if (!tabId) return;
        e.preventDefault();
        switchAdminCenterTab(tabId);
    });
}

function switchAdminCenterTab(tabId) {
    if (!ADMIN_CENTER_TAB_IDS.includes(tabId)) return;
    adminCenterActiveTab = tabId;
    ADMIN_CENTER_TAB_IDS.forEach((id) => {
        const btn = getAdminCenterTabButton(id);
        const panel = getAdminCenterTabPanel(id);
        const active = id === tabId;
        btn?.classList.toggle('is-active', active);
        btn?.setAttribute('aria-selected', active ? 'true' : 'false');
        panel?.classList.toggle('is-active', active);
    });
    if (tabId === 'overview') refreshAdminSystemStatus(true).catch(() => {});
}

function setAdminKpiDot(dotId, tone) {
    const dot = document.getElementById(dotId);
    if (dot) dot.className = `ac-status-dot ${tone || 'gray'}`;
}

function formatAdminRelativeTime(isoOrMs) {
    if (!isoOrMs) return adminI18n('statusNever');
    const date = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
    if (Number.isNaN(date.getTime())) return adminI18n('statusNever');
    try {
        return date.toLocaleString(adminIsRtl() ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' });
    } catch (_) { return date.toISOString(); }
}

async function fetchAdminSetupStatus(forceRefresh = false) {
    try {
        const snapshot = await chrome.runtime.sendMessage({ action: 'nhp_setup_api', endpoint: 'status', forceRefresh });
        if (snapshot?.success !== false) {
            adminSetupStatusSnapshot = snapshot;
            adminLastStatusCheckedAt = snapshot.checkedAt || new Date().toISOString();
            return snapshot;
        }
    } catch (_) { /* ignore */ }
    return adminSetupStatusSnapshot;
}

function getAdminActiveServers(servers = adminLastServersSnapshot?.servers || []) {
    return servers.filter((s) => !s.disabled);
}

function summarizeAdminServices(servers = adminLastServersSnapshot?.servers || []) {
    const summary = summarizeNhpLocalServers(servers);
    return {
        online: summary.onlineEnabled,
        total: summary.enabledTotal || summary.total || 8,
        offline: summary.offlineEnabled
    };
}

function isAdminNativeHostOk(snapshot = adminSetupStatusSnapshot) {
    if (snapshot?.nativeHost?.ok === true) return true;
    return !!(snapshot?.native?.registered && !snapshot?.native?.stale);
}

function isAdminDeviceReady(snapshot = adminSetupStatusSnapshot) {
    if (!snapshot) return false;
    if (snapshot.deviceReady === true || snapshot.firstRunComplete === true) return true;
    if (snapshot.overallState === 'ready') return true;
    return false;
}

function adminStatusCheckedLabel() {
    if (!adminLastStatusCheckedAt) return '';
    return `${adminI18n('statusCheckedAt')}: ${formatAdminRelativeTime(adminLastStatusCheckedAt)}`;
}

function isAdminCloudSyncConfigured() {
    if (typeof window.GitHubSync === 'undefined') return false;
    if (typeof window.GitHubSync.hasValidToken === 'function') {
        return window.GitHubSync.hasValidToken();
    }
    const token = window.GitHubSync?.config?.token;
    return !!String(token || '').trim() && token !== 'YOUR_GITHUB_TOKEN';
}

async function refreshAdminLocalServersSnapshot() {
    try {
        const snapshot = await chrome.runtime.sendMessage({ action: 'get_nhp_local_servers_status' });
        if (snapshot?.success) {
            adminLastServersSnapshot = snapshot;
            return snapshot;
        }
    } catch (_) { /* ignore */ }
    return adminLastServersSnapshot;
}

async function refreshAdminSystemStatus(forceRefresh = false) {
    if (adminStatusRefreshInFlight) return;
    adminStatusRefreshInFlight = true;
    try {
        await Promise.all([
            fetchAdminSetupStatus(forceRefresh),
            refreshAdminLocalServersSnapshot()
        ]);
        renderAdminOverviewStatus();
        updateAdminKpiCards();
    } finally {
        adminStatusRefreshInFlight = false;
    }
}

function startAdminStatusAutoRefresh() {
    if (adminStatusRefreshTimer) return;
    adminStatusRefreshTimer = setInterval(() => {
        if (!isAdminPanelActive()) return;
        refreshAdminSystemStatus(false).catch(() => {});
    }, 20000);
    if (adminCenterUiInitialized && !window.__nhpAdminStatusVisibilityBound) {
        window.__nhpAdminStatusVisibilityBound = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && isAdminPanelActive()) {
                refreshAdminSystemStatus(true).catch(() => {});
            }
        });
    }
}

function renderAdminAlerts() {
    const host = document.getElementById('admin-alerts-card');
    if (!host) return;
    const alerts = [];
    const { online, total, offline } = summarizeAdminServices();
    if (total > 0 && online < total) {
        const detail = offline.length ? `: ${offline.slice(0, 4).join(', ')}${offline.length > 4 ? '…' : ''}` : '';
        alerts.push({ tone: 'warn', text: `${adminI18n('alertServicesDown')} (${online}/${total})${detail}` });
    }
    if (adminSetupStatusSnapshot && !isAdminNativeHostOk()) {
        alerts.push({
            tone: 'danger',
            text: adminSetupStatusSnapshot.nativeHost?.error || adminSetupStatusSnapshot.native?.error || adminI18n('alertNative')
        });
    }
    if (adminSetupStatusSnapshot && !isAdminDeviceReady()) {
        alerts.push({ tone: 'info', text: adminI18n('firstRunIncomplete') });
    }
    host.innerHTML = alerts.length
        ? alerts.map((a) => `<div class="ac-alert ${a.tone === 'danger' ? 'danger' : ''}">${adminEscapeHtml(a.text)}</div>`).join('')
        : `<div class="ac-alert info">${adminEscapeHtml(adminI18n('alertsEmpty'))}</div>`;
}

function renderAdminOverviewStatus() {
    const body = document.getElementById('admin-overview-status-body');
    if (!body) return;
    const rows = [];
    const pushRow = (component, statusText, badgeClass, details) => {
        rows.push(`<tr>
            <td data-label="${adminEscapeHtml(adminI18n('colComponent'))}">${adminEscapeHtml(component)}</td>
            <td data-label="${adminEscapeHtml(adminI18n('colStatus'))}"><span class="ac-badge ${badgeClass}">${adminEscapeHtml(statusText)}</span></td>
            <td data-label="${adminEscapeHtml(adminI18n('colDetails'))}">${adminEscapeHtml(details || '—')}</td>
        </tr>`);
    };
    const servers = adminLastServersSnapshot?.servers || [];
    const summary = summarizeNhpLocalServers(servers);
    const servicesTotal = summary.enabledTotal || summary.total || 8;
    const servicesDetails = summary.offlineEnabled.length
        ? `${adminT('متوقف', 'Offline')}: ${summary.offlineEnabled.join(', ')} · ${adminStatusCheckedLabel()}`
        : `${adminT('سيرفرات NHP', 'NHP servers')} · ${adminStatusCheckedLabel()}`;
    pushRow(
        adminT('الخدمات المحلية', 'Local services'),
        adminLastServersSnapshot ? `${summary.onlineEnabled}/${servicesTotal}` : '—',
        !adminLastServersSnapshot ? 'info' : (summary.allEnabledOnline ? 'ok' : (summary.onlineEnabled > 0 ? 'warn' : 'fail')),
        servicesDetails.trim() || '—'
    );

    const nativeOk = isAdminNativeHostOk();
    pushRow(
        'Native Messaging',
        nativeOk ? adminI18n('statusOnline') : adminI18n('statusOffline'),
        nativeOk ? 'ok' : 'fail',
        nativeOk ? adminStatusCheckedLabel() : (adminSetupStatusSnapshot?.nativeHost?.error || adminSetupStatusSnapshot?.native?.error || '—')
    );

    const deviceReady = isAdminDeviceReady();
    pushRow(
        adminT('التشغيل الأول', 'First run'),
        deviceReady ? adminI18n('firstRunComplete') : adminI18n('firstRunIncomplete'),
        deviceReady ? 'ok' : 'warn',
        deviceReady ? adminStatusCheckedLabel() : adminT('رابط التهيئة في الأعلى', 'Setup link above')
    );

    chrome.storage.local.get(['cloudSyncEnabled', 'smartSyncEnabled'], (res) => {
        const cloudOn = res.cloudSyncEnabled !== false;
        const cloudConfigured = isAdminCloudSyncConfigured();
        pushRow(
            adminT('المزامنة السحابية', 'Cloud sync'),
            !cloudOn ? adminI18n('statusDisabled') : (cloudConfigured ? adminI18n('statusOnline') : adminI18n('statusNotConfigured')),
            !cloudOn ? 'info' : (cloudConfigured ? 'ok' : 'warn'),
            !cloudOn ? adminT('المزامنة السحابية معطّلة', 'Cloud sync disabled') : (cloudConfigured ? adminT('GitHub مهيّأ', 'GitHub configured') : adminT('GitHub — أضف التوكن', 'GitHub — add token'))
        );

        const smartOn = res.smartSyncEnabled !== false;
        const hasFolder = !!workspaceHandle;
        pushRow(
            adminT('المزامنة الذكية', 'Smart sync'),
            !smartOn ? adminI18n('statusDisabled') : (hasFolder ? adminI18n('statusOnline') : adminI18n('statusEnabled')),
            !smartOn ? 'info' : (hasFolder ? 'ok' : 'warn'),
            !smartOn ? adminT('Smart Sync معطّل', 'Smart Sync disabled') : (hasFolder ? adminT('مجلد مربوط', 'Linked folder') : adminT('مفعّل — بدون مجلد', 'Enabled — no folder'))
        );
        body.innerHTML = rows.join('');
        renderAdminAlerts();
        const statusBadge = document.querySelector('#admin-tab-panel-overview .ac-card-head .ac-badge.info');
        if (statusBadge && adminLastStatusCheckedAt) {
            statusBadge.textContent = adminStatusCheckedLabel();
        }
    });
}

async function updateAdminKpiCards() {
    const servers = adminLastServersSnapshot?.servers || [];
    const summary = summarizeNhpLocalServers(servers);
    const servicesTotal = summary.enabledTotal || summary.total || 8;
    const servicesVal = document.getElementById('admin-kpi-services-value');
    if (servicesVal) servicesVal.textContent = adminLastServersSnapshot ? `${summary.onlineEnabled}/${servicesTotal}` : '—';
    setAdminKpiDot(
        'admin-kpi-services-dot',
        !adminLastServersSnapshot ? 'gray' : (summary.allEnabledOnline ? 'green' : (summary.onlineEnabled > 0 ? 'amber' : 'red'))
    );
    chrome.storage.local.get(['cloudSyncEnabled', 'smartSyncEnabled'], (res) => {
        const syncVal = document.getElementById('admin-kpi-sync-value');
        const cloudOn = res.cloudSyncEnabled !== false;
        const smartOn = res.smartSyncEnabled !== false;
        if (syncVal) syncVal.textContent = cloudOn && smartOn ? adminT('سحابي + محلي', 'Cloud + local') : (cloudOn ? adminT('سحابي', 'Cloud') : (smartOn ? adminT('محلي', 'Local') : adminT('متوقف', 'Off')));
        setAdminKpiDot('admin-kpi-sync-dot', cloudOn || smartOn ? 'green' : 'gray');
    });
    try {
        const user = await window.AuthManager?.getCurrentUser?.();
        const accountVal = document.getElementById('admin-kpi-account-value');
        if (accountVal) accountVal.textContent = user ? (user.nickname || user.email || adminI18n('statusSignedIn')) : adminI18n('statusGuest');
        setAdminKpiDot('admin-kpi-account-dot', user ? 'green' : 'gray');
    } catch (_) {
        const accountVal = document.getElementById('admin-kpi-account-value');
        if (accountVal) accountVal.textContent = adminI18n('statusGuest');
        setAdminKpiDot('admin-kpi-account-dot', 'gray');
    }
    const scanPct = document.getElementById('admin-full-scan-percent')?.textContent || '0%';
    const scanVal = document.getElementById('admin-kpi-scan-value');
    if (scanVal) scanVal.textContent = scanPct === '0%' ? adminI18n('statusReady') : scanPct;
    setAdminKpiDot('admin-kpi-scan-dot', scanPct === '100%' ? 'green' : (scanPct !== '0%' ? 'blue' : 'gray'));
    const lastSyncVal = document.getElementById('admin-kpi-lastsync-value');
    if (lastSyncVal) lastSyncVal.textContent = lastSmartSyncTime ? formatAdminRelativeTime(lastSmartSyncTime) : adminI18n('statusNever');
    setAdminKpiDot('admin-kpi-lastsync-dot', lastSmartSyncTime ? 'blue' : 'gray');
}

function appendAdminScanResultRow(level, title, details = '') {
    adminScanResultRows.push({ level, title, details });
    if (adminScanResultRows.length > 500) adminScanResultRows.shift();
    renderAdminScanResults();
}

function renderAdminScanResults() {
    const body = document.getElementById('admin-scan-results-body');
    if (!body) return;
    if (!adminScanResultRows.length) { body.innerHTML = `<tr><td colspan="3">${adminEscapeHtml(adminI18n('scanNoResults'))}</td></tr>`; return; }
    const badgeFor = (l) => (l === 'OK' ? 'ok' : l === 'WARN' ? 'warn' : l === 'FAIL' ? 'fail' : 'info');
    body.innerHTML = adminScanResultRows.slice(-200).map((row) => `
        <tr>
            <td data-label="${adminEscapeHtml(adminI18n('colLevel'))}"><span class="ac-badge ${badgeFor(row.level)}">${adminEscapeHtml(row.level)}</span></td>
            <td data-label="${adminEscapeHtml(adminI18n('colItem'))}">${adminEscapeHtml(row.title)}</td>
            <td data-label="${adminEscapeHtml(adminI18n('colDetails'))}">${adminEscapeHtml(row.details || '—')}</td>
        </tr>`).join('');
}

function appendAdminDiagnosticLog(level, message) {
    adminDiagnosticLogRows.push({ level, message, time: new Date().toISOString() });
    if (adminDiagnosticLogRows.length > 200) adminDiagnosticLogRows.shift();
    renderAdminDiagnosticLogs();
}

function renderAdminDiagnosticLogs() {
    const body = document.getElementById('admin-logs-table-body');
    if (!body) return;
    if (!adminDiagnosticLogRows.length) { body.innerHTML = `<tr><td colspan="3">${adminEscapeHtml(adminI18n('logsEmpty'))}</td></tr>`; return; }
    body.innerHTML = adminDiagnosticLogRows.slice(-100).reverse().map((row) => `
        <tr>
            <td data-label="${adminEscapeHtml(adminI18n('colTime'))}">${adminEscapeHtml(formatAdminRelativeTime(row.time))}</td>
            <td data-label="${adminEscapeHtml(adminI18n('colLevel'))}"><span class="ac-badge info">${adminEscapeHtml(row.level)}</span></td>
            <td data-label="${adminEscapeHtml(adminI18n('colMessage'))}">${adminEscapeHtml(row.message)}</td>
        </tr>`).join('');
}

function filterAdminServicesTable() {
    const query = String(document.getElementById('admin-services-search')?.value || '').trim().toLowerCase();
    document.querySelectorAll('#nhp-local-servers-list tr[data-server-id]').forEach((row) => {
        row.style.display = !query || `${row.dataset.serverId} ${row.textContent}`.toLowerCase().includes(query) ? '' : 'none';
    });
}

function closeAdminServiceMenus() {
    document.querySelectorAll('.ac-menu-wrap.is-open').forEach((el) => el.classList.remove('is-open'));
}

function getAdminViewFromHash() {
    const raw = String(window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
    if (ADMIN_SETUP_HASHES.has(raw) || raw.endsWith('/setup')) return 'setup';
    return 'main';
}

function updateAdminHashForView(view) {
    const next = view === 'setup' ? '#setup' : '#admin';
    if (window.location.hash !== next) {
        try { history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`); }
        catch (_) { window.location.hash = view === 'setup' ? 'setup' : 'admin'; }
    }
}

async function loadAdminSetupPanel(showToast) {
    const host = document.getElementById('admin-setup-host');
    if (!host || adminSetupLoaded) return;
    try {
        const htmlUrl = chrome.runtime.getURL('modules/admin/setup.html?v=setup_wizard_v3');
        const res = await fetch(htmlUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        host.innerHTML = await res.text();
        const setupMod = await import('./setup.js');
        await setupMod.initAdminSetupModule({ showToast });
        adminSetupLoaded = true;
    } catch (error) {
        host.innerHTML = `<p class="ac-row-desc" style="padding:1rem;">${adminEscapeHtml(error?.message || 'Setup load failed')}</p>`;
    }
}

export function switchAdminView(view, options = {}) {
    const nextView = view === 'setup' ? 'setup' : 'main';
    adminCurrentView = nextView;
    const mainEl = document.getElementById('admin-view-main');
    const setupEl = document.getElementById('admin-view-setup');
    const showMain = nextView === 'main';
    const showSetup = nextView === 'setup';
    document.getElementById('admin-nav-dashboard')?.classList.toggle('is-active', showMain);
    document.getElementById('admin-nav-setup')?.classList.toggle('is-active', showSetup);
    if (mainEl) {
        mainEl.classList.toggle('is-hidden', !showMain);
        mainEl.hidden = !showMain;
        mainEl.setAttribute('aria-hidden', showMain ? 'false' : 'true');
    }
    if (setupEl) {
        setupEl.classList.toggle('is-active', showSetup);
        setupEl.hidden = !showSetup;
        setupEl.setAttribute('aria-hidden', showSetup ? 'false' : 'true');
    }
    if (options.updateHash !== false) updateAdminHashForView(nextView);
    if (showSetup) {
        loadAdminSetupPanel(options.showToast).then(() => {
            import('./setup.js').then((m) => m.activateAdminSetupPanel?.()).catch(() => {});
        }).catch(() => {});
    } else if (showMain) {
        refreshAdminSystemStatus(true).catch(() => {});
    }
}

function initAdminSubNav(showToast) {
    document.getElementById('admin-nav-dashboard')?.addEventListener('click', () => switchAdminView('main', { showToast }));
    document.getElementById('admin-nav-setup')?.addEventListener('click', () => switchAdminView('setup', { showToast }));
    window.addEventListener('hashchange', () => {
        if (!isAdminPanelActive()) return;
        switchAdminView(getAdminViewFromHash(), { updateHash: false, showToast });
    });
}

function initAdminCenterUi(showToast) {
    loadAdminCenterStyles();
    applyAdminCenterI18n();
    bindAdminCenterTabHandlers();
    if (adminCenterUiInitialized) return;
    adminCenterUiInitialized = true;
    document.getElementById('btn-admin-lang-toggle')?.addEventListener('click', () => {
        adminCenterLangRtl = !adminIsRtl();
        applyAdminCenterI18n();
        renderAdminOverviewStatus();
        updateAdminKpiCards();
    });
    document.getElementById('admin-link-setup')?.addEventListener('click', (e) => { e.preventDefault(); switchAdminView('setup', { showToast }); });
    document.getElementById('admin-services-search')?.addEventListener('input', filterAdminServicesTable);
    document.addEventListener('click', (e) => { if (!e.target.closest('.ac-menu-wrap')) closeAdminServiceMenus(); });
    switchAdminCenterTab('overview');
    switchAdminView(getAdminViewFromHash(), { updateHash: false, showToast });
    refreshAdminSystemStatus(true).catch(() => {});
    startAdminStatusAutoRefresh();
    renderAdminDiagnosticLogs();
}

function isAdminPanelActive() {
    return !!document.getElementById('panel-admin')?.classList.contains('active');
}
const SYNC_FILE_NAME = 'nhp_smart_sync.json';
const browserSessionId = Math.random().toString(36).substr(2, 9);
const NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY = 'nhpInternalGeminiKey';
const SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY = 'seoInternalGeminiKey';
const LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY = 'customGeminiKey';
const ADMIN_AI_KEYS_STORAGE_KEY = 'nhpAdminAiKeys';
const CURSOR_API_KEY_STORAGE_KEY = 'nhpCursorApiKey';
const GPT_API_KEY_STORAGE_KEY = 'nhpGptApiKey';
const NHP_PROXY_BASE_URL_STORAGE_KEY = 'nhpProxyBaseUrl';
const DEFAULT_INTERNAL_GEMINI_API_KEY = '';
const DEFAULT_CURSOR_API_KEY = '';
const DEFAULT_NHP_PROXY_BASE_URL = 'https://cliproxyapi-ywrp.onrender.com/v1';
const DEFAULT_RENDER_NHP_PROXY_BASE_URL = 'https://cliproxyapi-ywrp.onrender.com/v1';
/** Keys must be set in admin panel — never ship defaults in source. */
const DEFAULT_NHP_API_KEY = '';

function adminEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateAdminGptKeyWarning(gptKey, baseUrl = '') {
    const warn = document.getElementById('admin-ai-key-gpt-warning');
    if (!warn) return;
    const key = String(gptKey || '').trim();
    const base = String(baseUrl || document.getElementById('admin-ai-base-url')?.value || '').trim();
    const isLocal = /:(8317)(\/|$)/.test(base) && /127\.0\.0\.1|localhost/i.test(base);
    const looksLikeGoogleGeminiKey = /^AIza[0-9A-Za-z_\-]{10,}$/.test(key);

    if (looksLikeGoogleGeminiKey) {
        warn.hidden = false;
        warn.classList.remove('hidden');
        warn.textContent = '⚠️ هذا يبدو مفتاح Google Gemini (AIza…) — لا يصلح كـ Bearer لـ CLIProxy. للمحلي ضع: nhp-local-cliproxy-key';
        return;
    }
    if (!key && isLocal) {
        warn.hidden = false;
        warn.classList.remove('hidden');
        warn.textContent = 'ℹ️ محلي (8317): سيُستخدم nhp-local-cliproxy-key تلقائياً إن تركت الحقل فارغاً.';
        return;
    }
    if (!key) {
        warn.hidden = false;
        warn.classList.remove('hidden');
        warn.textContent = '⚠️ مفتاح NHP API غير مُعدّ. أدخل المفتاح من CLI Proxy ثم احفظ — بدونه لن يعمل Prompt Bag ولا توليد الصور.';
        return;
    }
    warn.hidden = true;
    warn.classList.add('hidden');
}

async function probeAdminCliProxyCodexStatus() {
    const statusEl = document.getElementById('admin-cliproxy-codex-status');
    if (!statusEl) return;
    const baseInput = document.getElementById('admin-ai-base-url');
    const keyInput = document.getElementById('admin-ai-key-gpt');
    let base = String(baseInput?.value || DEFAULT_NHP_PROXY_BASE_URL).trim().replace(/\/+$/, '');
    if (!/\/v1$/i.test(base)) base = `${base}/v1`;
    const isLocal = /:(8317)(\/|$)/.test(base) && /127\.0\.0\.1|localhost/i.test(base);
    let key = String(keyInput?.value || '').trim();
    if (isLocal && (!key || /^AIza[0-9A-Za-z_\-]{10,}$/.test(key) || key === 'nhp-local-cli-proxy-key')) {
        key = 'nhp-local-cliproxy-key';
    }
    statusEl.hidden = false;
    statusEl.classList.remove('hidden');
    statusEl.textContent = 'جاري فحص CLIProxy وCodex...';
    statusEl.className = 'rounded-lg border border-slate-600/40 bg-slate-950/40 px-2 py-1.5 text-[0.625rem] text-slate-300 leading-snug';
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`${base}/models`, {
            headers: key ? { Authorization: `Bearer ${key}` } : {},
            signal: controller.signal
        });
        clearTimeout(timer);
        if (res.status === 401 || res.status === 403) {
            statusEl.className = 'rounded-lg border border-rose-500/40 bg-rose-950/30 px-2 py-1.5 text-[0.625rem] text-rose-200 leading-snug';
            statusEl.textContent = isLocal
                ? '❌ مفتاح CLIProxy مرفوض — ضع nhp-local-cliproxy-key ثم احفظ.'
                : '❌ مفتاح CLIProxy مرفوض — طابقه مع api-keys في config.yaml.';
            return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const ids = (Array.isArray(data?.data) ? data.data : [])
            .map((m) => String(m?.id || m || '').trim())
            .filter(Boolean);
        const hasCodexImage = ids.some((id) => /^gpt-image-/i.test(id));
        const hasGeminiImage = ids.some((id) => /gemini/i.test(id) && /image/i.test(id));
        if (hasCodexImage) {
            statusEl.className = 'rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-2 py-1.5 text-[0.625rem] text-emerald-200 leading-snug';
            statusEl.textContent = `✅ Codex جاهز (${ids.filter((id) => /^gpt-image-/i.test(id)).join(', ')})${hasGeminiImage ? ' · Gemini image متاح' : ''}`;
            return;
        }
        statusEl.className = 'rounded-lg border border-amber-500/40 bg-amber-950/30 px-2 py-1.5 text-[0.625rem] text-amber-200 leading-snug';
        statusEl.innerHTML = '⚠️ لا يوجد gpt-image-* — سجّل دخول Codex مرة واحدة من '
            + '<a href="http://127.0.0.1:8317/management.html#/login" target="_blank" rel="noopener" class="underline text-amber-100">لوحة CLIProxy</a>'
            + ' (Add Auth → Codex).';
    } catch (err) {
        statusEl.className = 'rounded-lg border border-rose-500/40 bg-rose-950/30 px-2 py-1.5 text-[0.625rem] text-rose-200 leading-snug';
        statusEl.textContent = isLocal
            ? '❌ CLIProxy المحلي غير متاح على :8317 — شغّله من السيرفرات المحلية ثم أعد الفحص.'
            : `❌ تعذّر فحص CLIProxy: ${err?.message || 'error'}`;
    }
}

async function ensureNhpRuntimeConfigLoaded() {
    if (window.NhpRuntimeConfig) await window.NhpRuntimeConfig.loadFromStorage();
}

async function nhpAdminLocalUrl(port, path = '') {
    await ensureNhpRuntimeConfigLoaded();
    if (window.NhpRuntimeConfig) return window.NhpRuntimeConfig.localUrl(port, path);
    const pathStr = path ? (String(path).startsWith('/') ? path : `/${path}`) : '';
    return `http://127.0.0.1:${port}${pathStr}`;
}

async function nhpAdminDefaultProxyBaseUrl() {
    await ensureNhpRuntimeConfigLoaded();
    if (window.NhpRuntimeConfig) return window.NhpRuntimeConfig.defaultProxyBaseUrl();
    return DEFAULT_NHP_PROXY_BASE_URL;
}
const AUTO_LITE_ASSIST_KEY = 'nhpAutoLiteAssist';
const FORCE_I3_MODE_KEY = 'nhpForceI3Ram2GbMode';
const PROMPT_BAG_OVERLAY_ENABLED_KEY = 'nhpPromptBagOverlayEnabled';
const isLowSpecModeEnabled = () => !!window.NHP_IS_LIGHT_MODE || !!window.NHP_LOW_SPEC_MODE;
let latestFullScanReportText = '';
const NHP_UI_DIAG_LOG_LIMIT = 220;
const nhpUiDiagnosticLogs = Array.isArray(window.__NHP_UI_DIAGNOSTIC_LOGS__) ? window.__NHP_UI_DIAGNOSTIC_LOGS__ : [];
window.__NHP_UI_DIAGNOSTIC_LOGS__ = nhpUiDiagnosticLogs;

function addUiDiagnosticLog(level, message) {
    nhpUiDiagnosticLogs.push({
        ts: Date.now(),
        level: String(level || 'info').toUpperCase(),
        text: String(message || '').slice(0, 1600)
    });
    if (nhpUiDiagnosticLogs.length > NHP_UI_DIAG_LOG_LIMIT) {
        nhpUiDiagnosticLogs.splice(0, nhpUiDiagnosticLogs.length - NHP_UI_DIAG_LOG_LIMIT);
    }
    appendAdminDiagnosticLog(String(level || 'info').toUpperCase(), String(message || '').slice(0, 1600));
}

function ensureUiDiagnosticCollectors() {
    if (window.__NHP_UI_DIAG_PATCHED__) return;
    const origWarn = console.warn?.bind(console);
    const origError = console.error?.bind(console);
    console.warn = (...args) => {
        addUiDiagnosticLog('warn', args.map((x) => {
            try { return typeof x === 'string' ? x : JSON.stringify(x); } catch (_) { return String(x); }
        }).join(' | '));
        return origWarn ? origWarn(...args) : undefined;
    };
    console.error = (...args) => {
        addUiDiagnosticLog('error', args.map((x) => {
            try { return typeof x === 'string' ? x : JSON.stringify(x); } catch (_) { return String(x); }
        }).join(' | '));
        return origError ? origError(...args) : undefined;
    };
    window.addEventListener('error', (event) => {
        const msg = `${event?.message || 'window error'} @ ${event?.filename || 'unknown'}:${event?.lineno || 0}:${event?.colno || 0}`;
        addUiDiagnosticLog('error', msg);
    });
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event?.reason;
        const text = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason || 'unhandled rejection');
        addUiDiagnosticLog('error', `unhandledrejection: ${text}`);
    });
    window.__NHP_UI_DIAG_PATCHED__ = true;
}

async function getInternalGeminiApiKey() {
    return await new Promise((resolve) => {
        try {
            chrome.storage.local.get([
                NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY,
                SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY,
                LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY
            ], (res) => {
                const key = String(
                    res?.[NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY]
                    || res?.[SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY]
                    || res?.[LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY]
                    || DEFAULT_INTERNAL_GEMINI_API_KEY
                ).trim();
                resolve(key);
            });
        } catch (_) {
            resolve('');
        }
    });
}

function normalizeAdminAiKeys(input) {
    const source = input && typeof input === 'object' ? input : {};
    let rawBaseUrl = String(source.baseUrl || '').trim();
    if (typeof NhpStorageMigrate !== 'undefined' && NhpStorageMigrate.migratePortInUrl) {
        rawBaseUrl = NhpStorageMigrate.migratePortInUrl(rawBaseUrl);
    } else {
        rawBaseUrl = rawBaseUrl.replace(/:8517(\/|$)/g, ':8317$1');
    }
    let gpt = String(source.gpt || '').trim();
    if (typeof NhpStorageMigrate !== 'undefined' && NhpStorageMigrate.normalizeLocalGatewayKey) {
        gpt = NhpStorageMigrate.normalizeLocalGatewayKey(gpt);
    } else if (gpt === 'nhp-local-cli-proxy-key') {
        gpt = 'nhp-local-cliproxy-key';
    }
    return {
        gemini: String(source.gemini || '').trim(),
        cursor: String(source.cursor || '').trim(),
        gpt,
        baseUrl: rawBaseUrl
    };
}

async function getStoredAdminAiKeys() {
    const fallbackBaseUrl = await nhpAdminDefaultProxyBaseUrl();
    return await new Promise((resolve) => {
        try {
            chrome.storage.local.get([
                ADMIN_AI_KEYS_STORAGE_KEY,
                NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY,
                SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY,
                LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY,
                CURSOR_API_KEY_STORAGE_KEY,
                GPT_API_KEY_STORAGE_KEY,
                NHP_PROXY_BASE_URL_STORAGE_KEY
            ], (res) => {
                const directAiKeys = normalizeAdminAiKeys(res?.[ADMIN_AI_KEYS_STORAGE_KEY]);
                const geminiFallback = String(
                    directAiKeys.gemini
                    || res?.[NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY]
                    || res?.[SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY]
                    || res?.[LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY]
                    || DEFAULT_INTERNAL_GEMINI_API_KEY
                ).trim();
                resolve({
                    gemini: geminiFallback,
                    cursor: String(directAiKeys.cursor || res?.[CURSOR_API_KEY_STORAGE_KEY] || DEFAULT_CURSOR_API_KEY).trim(),
                    gpt: String(directAiKeys.gpt || res?.[GPT_API_KEY_STORAGE_KEY] || '').trim(),
                    baseUrl: String(directAiKeys.baseUrl || res?.[NHP_PROXY_BASE_URL_STORAGE_KEY] || fallbackBaseUrl).trim()
                });
            });
        } catch (_) {
            resolve({ gemini: '', cursor: '', gpt: '', baseUrl: fallbackBaseUrl });
        }
    });
}

async function saveAdminAiKeys(aiKeys) {
    const cleanKeys = normalizeAdminAiKeys(aiKeys);
    return await new Promise((resolve) => {
        try {
            chrome.storage.local.set({
                [ADMIN_AI_KEYS_STORAGE_KEY]: cleanKeys,
                [NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY]: cleanKeys.gemini,
                [SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY]: cleanKeys.gemini,
                [CURSOR_API_KEY_STORAGE_KEY]: cleanKeys.cursor,
                [GPT_API_KEY_STORAGE_KEY]: cleanKeys.gpt,
                [NHP_PROXY_BASE_URL_STORAGE_KEY]: cleanKeys.baseUrl || DEFAULT_NHP_PROXY_BASE_URL
            }, () => resolve(cleanKeys));
        } catch (_) {
            resolve(cleanKeys);
        }
    });
}

const PRIVATE_PROFILE_VERSION = 1;
const PRIVATE_PREFERENCE_KEY_WHITELIST = [
    'theme',
    'uiLaunchMode',
    'nhpDefaultTabModeApplied',
    'nhpTabDefaultRestoredV3',
    'pipeline-enable-analysis',
    'pipeline-enable-tmhunt',
    'pipeline-enable-uspto',
    'cloudSyncEnabled',
    'smartSyncEnabled',
    AUTO_LITE_ASSIST_KEY,
    FORCE_I3_MODE_KEY,
    PROMPT_BAG_OVERLAY_ENABLED_KEY,
    'nhpPerformanceMode'
];

const PRIVATE_PREFERENCE_KEY_EXCLUSIONS = new Set([
    ADMIN_AI_KEYS_STORAGE_KEY,
    NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY,
    SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY,
    LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY,
    CURSOR_API_KEY_STORAGE_KEY,
    GPT_API_KEY_STORAGE_KEY,
    'savedDesignQueue',
    'ap_accounts',
    'teepublic_manager_data',
    'usptoHistory',
    'tpHistory',
    'tmhHistory',
    'nicheArchiveBundle',
    'localSalesData',
    'lastFullSync',
    'syncQueue',
    'workspacePath',
    'workspaceHandle'
]);

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function collectPrivatePreferencesFromStorage(allData) {
    const preferences = {};
    if (!allData || typeof allData !== 'object') return preferences;

    PRIVATE_PREFERENCE_KEY_WHITELIST.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(allData, key)) {
            preferences[key] = allData[key];
        }
    });

    Object.keys(allData).forEach((key) => {
        if (PRIVATE_PREFERENCE_KEY_EXCLUSIONS.has(key)) return;
        if (
            /(default.*(button|btn)|selected.*button|preferred.*button|personal(ization|isation)?|preference)/i.test(key)
            && Object.prototype.hasOwnProperty.call(preferences, key) === false
        ) {
            const value = allData[key];
            const valueTypeOk = value == null || ['string', 'number', 'boolean'].includes(typeof value) || isPlainObject(value);
            if (valueTypeOk) {
                preferences[key] = value;
            }
        }
    });

    return preferences;
}

// IndexedDB Helper to store Folder Handles (Chrome storage can't store them)
const IDB = {
    dbName: 'NHP_WorkspaceDB',
    storeName: 'handles',
    getDB: function () {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(this.storeName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    set: async function (key, val) {
        const db = await this.getDB();
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(val, key);
        return new Promise(r => tx.oncomplete = r);
    },
    get: async function (key) {
        const db = await this.getDB();
        const tx = db.transaction(this.storeName, 'readonly');
        const request = tx.objectStore(this.storeName).get(key);
        return new Promise(r => request.onsuccess = () => r(request.result));
    }
};

/**
 * Update Auth UI based on current user session
 */
export async function updateAuthUI() {
    const userInfo = document.getElementById('userInfo');
    const authBox = document.getElementById('authBox');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const proActiveMsg = document.getElementById('proActiveMsg');
    const proUpgradeBtn = document.getElementById('proUpgradeBtn');
    const userInfoHeader = document.getElementById('userInfoHeader');

    if (!userInfo) return;

    try {
        const user = await window.AuthManager.getCurrentUser();
        if (user) {
            userInfo.style.display = 'block';
            authBox.style.display = 'none';
            userEmailDisplay.textContent = user.nickname || user.email;

            if (proActiveMsg) proActiveMsg.style.display = 'block';
            if (proUpgradeBtn) proUpgradeBtn.style.display = 'none';
            if (userInfoHeader) {
                userInfoHeader.style.display = 'block';
                userInfoHeader.title = `Connected as ${user.nickname || user.email}`;
            }

            // تفعيل لوحة المدير إذا كان هو خالد
            const adminPanel = document.getElementById('admin-panel');
            if (adminPanel) {
                const isAdmin = user.email === 'maggouri@gmail.com' || user.nickname?.toLowerCase() === 'admin' || user.nickname?.toLowerCase() === 'khalid';
                adminPanel.style.display = isAdmin ? 'block' : 'none';
                if (isAdmin) refreshAdminUsers();
            }
            await updateAdminKpiCards();
        } else {
            userInfo.style.display = 'none';
            authBox.style.display = 'block';
            if (proActiveMsg) proActiveMsg.style.display = 'none';
            if (proUpgradeBtn) proUpgradeBtn.style.display = 'flex';
            if (userInfoHeader) userInfoHeader.style.display = 'none';

            const adminPanel = document.getElementById('admin-panel');
            if (adminPanel) adminPanel.style.display = 'none';
        }
        await updateAdminKpiCards();
    } catch (e) {
        console.error('Update Auth UI Error:', e);
    }
}

/**
 * Fetch and refresh the active users list for the administrator
 */
export async function refreshAdminUsers() {
    const container = document.getElementById('admin-users-list');
    if (!container || typeof window.GitHubSync === 'undefined') return;

    try {
        const users = await window.GitHubSync.getAllRegisteredUsers();
        if (!users || users.length === 0) {
            container.innerHTML = '<div style="font-size:10px; color:var(--text-muted); padding:5px; text-align:center;">لا يوجد أعضاء مسجلون حالياً في السجل</div>';
            return;
        }

        const visibleUsers = isLowSpecModeEnabled() ? users.slice(0, 120) : users;
        container.innerHTML = visibleUsers.map(u => {
            const email = adminEscapeHtml(u.email || '');
            const nickname = adminEscapeHtml(u.nickname || u.email || '');
            const date = adminEscapeHtml(u.registeredAt ? new Date(u.registeredAt).toLocaleDateString() : 'غير معروف');
            const passMark = u.password ? '🔑 كلمة سر مُفعّلة' : '❌ لا توجد كلمة سر';
            return `
        <div class="admin-user-item" data-admin-email="${email}"
             style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; margin-bottom:5px; border:1px solid rgba(255,255,255,0.1); cursor:pointer;">
          <div style="flex:1;">
            <div style="font-size:10px; color:var(--text); font-weight:bold;">
              <i class="fa-solid fa-user-check" style="color:var(--safe); margin-left:5px;"></i> ${nickname}
            </div>
            <div style="font-size:9px; color:var(--primary); margin-top:2px;">
              ${passMark}
            </div>
            <div style="font-size:8px; color:var(--text-muted); margin-top:2px;">
              <i class="fa-solid fa-calendar-days" style="margin-left:3px;"></i> السجل: ${date}
            </div>
          </div>
          <i class="fa-solid fa-user-gear" style="font-size:12px; color:var(--warning); opacity:0.8;"></i>
        </div>
      `;
        }).join('');

        container.querySelectorAll('.admin-user-item[data-admin-email]').forEach((el) => {
            el.addEventListener('click', () => {
                const email = el.getAttribute('data-admin-email') || '';
                const target = document.getElementById('admin-target-email');
                if (target) target.value = email;
                const matched = visibleUsers.find((u) => String(u.email || '') === email);
                if (matched) window.lastSelectedUser = matched;
                showToast(`✅ تم اختيار: ${matched?.nickname || email}`);
            });
        });

    } catch (e) {
        console.error('Admin Users Load Error:', e);
        container.innerHTML = '<div style="font-size:10px; color:var(--warning); padding:5px; text-align:center;">فشل جلب قائمة الأعضاء من السجل</div>';
    }
}

/**
 * Workspace Initializer
 */
async function initWorkspace(helpers) {
    const { updateWorkspaceUI } = helpers;
    try {
        workspaceHandle = await IDB.get('root');
        window.NHP_WorkspaceHandle = workspaceHandle;
        if (workspaceHandle) {
            const permission = await workspaceHandle.queryPermission();
            if (permission === 'granted') {
                updateWorkspaceUI(true, workspaceHandle.name);
            } else {
                updateWorkspaceUI(false, "انقر لتفعيل الصلاحية");
            }
        }
    } catch (e) { console.error('Workspace Init Error:', e); }
}

/**
 * Refresh Design Library from Cloud
 */
export async function refreshLibrary() {
    const container = document.getElementById('library-container');
    if (!container || typeof window.GitHubSync === 'undefined') return;

    try {
        const files = await window.GitHubSync.fetchLibrary();
        if (files.length === 0) {
            container.innerHTML = '<div class="empty-msg" style="grid-column: span 4;">المكتبة فارغة حالياً</div>';
            return;
        }

        container.innerHTML = files.map(file => {
            const safeName = adminEscapeHtml(file.name || '');
            const safePath = adminEscapeHtml(file.path || '');
            const safeSha = adminEscapeHtml(file.sha || '');
            const safeGitUrl = adminEscapeHtml(file.git_url || '');
            const safeDownload = adminEscapeHtml(file.download_url || '');
            return `
      <div class="library-item" title="${safeName}" data-git-url="${safeGitUrl}" data-path="${safePath}" data-sha="${safeSha}">
        <input type="checkbox" class="lib-item-checkbox" data-git-url="${safeGitUrl}" data-name="${safeName}">
        <img src="${safeDownload}" loading="lazy" onerror="this.src='icon.png'; this.style.opacity=0.5;">
        <button class="lib-delete-btn" title="حذف من السحابة">✕</button>
      </div>
    `;
        }).join('');

        const selectAllCheck = document.getElementById('lib-select-all');
        const bulkImportBtn = document.getElementById('btn-lib-bulk-import');

        function updateBulkUI() {
            const checked = container.querySelectorAll('.lib-item-checkbox:checked').length;
            if (bulkImportBtn) bulkImportBtn.style.display = checked > 0 ? 'flex' : 'none';
            if (selectAllCheck) selectAllCheck.checked = checked === files.length && files.length > 0;
        }

        container.querySelectorAll('.library-item').forEach(item => {
            const cb = item.querySelector('.lib-item-checkbox');
            if (cb) {
                cb.addEventListener('change', updateBulkUI);
                cb.addEventListener('click', (e) => e.stopPropagation());
            }

            const delBtn = item.querySelector('.lib-delete-btn');
            if (delBtn) {
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm('هل أنت متأكد من حذف هذا التصميم نهائياً من سحابة GitHub؟')) return;

                    const path = item.getAttribute('data-path');
                    const sha = item.getAttribute('data-sha');

                    item.style.opacity = '0.3';
                    item.style.transform = 'scale(0.8)';
                    item.style.pointerEvents = 'none';
                    window.showToast('⏳ جاري الحذف من السحابة في الخلفية...');

                    setTimeout(() => {
                        if (item && item.parentNode) {
                            item.style.width = '0';
                            item.style.margin = '0';
                            setTimeout(() => {
                                item.remove();
                                updateBulkUI();
                            }, 320);
                        }
                    }, 320);

                    const res = await window.GitHubSync.deleteFile(path, sha);
                    if (!(res && res.success)) {
                        window.showToast('❌ فشل الحذف الفعلي من GitHub');
                        refreshLibrary();
                    }
                });
            }

            item.addEventListener('click', async () => {
                const cb = item.querySelector('.lib-item-checkbox');
                if (cb) {
                    cb.checked = !cb.checked;
                    updateBulkUI();
                }
            });
        });

        if (selectAllCheck) {
            selectAllCheck.onclick = () => {
                container.querySelectorAll('.lib-item-checkbox').forEach(cb => cb.checked = selectAllCheck.checked);
                updateBulkUI();
            };
        }

        if (bulkImportBtn) {
            bulkImportBtn.onclick = async () => {
                const selected = container.querySelectorAll('.lib-item-checkbox:checked');
                if (selected.length === 0) return;

                window.showToast(`⏳ جاري استيراد ${selected.length} تصميماً...`);
                const token = window.GitHubSync.config.token;

                const promises = Array.from(selected).map(async (cb) => {
                    const gitUrl = cb.getAttribute('data-git-url');
                    const name = cb.getAttribute('data-name').split('_').slice(1).join('_') || 'exported_design.png';

                    return new Promise((resolve) => {
                        chrome.runtime.sendMessage({ action: 'github_download', url: gitUrl, token: token }, (res) => {
                            if (res && res.success && res.data && res.data.content) {
                                const base64 = res.data.content.replace(/\n/g, '');
                                const newDesign = {
                                    id: 'lib_' + Date.now() + Math.random(),
                                    file: { name: name, type: 'image/png' },
                                    base64: base64,
                                    status: 'idle',
                                    meta: null
                                };
                                window.designQueue.push(newDesign);
                                resolve(true);
                            } else resolve(false);
                        });
                    });
                });

                await Promise.all(promises);
                window.renderQueue();
                const seoQueueContainer = document.getElementById('seo-queue-container');
                if (seoQueueContainer) seoQueueContainer.classList.remove('hidden');
                window.saveQueueToStorage();
                window.showToast('✅ تم استيراد الكل بنجاح');

                if (selectAllCheck) selectAllCheck.checked = false;
                updateBulkUI();
            };
        }

    } catch (e) {
        console.error('Library Load Error:', e);
    }
}

/**
 * Initialize Admin Module
 */
export function activateAdminPanel() {
    if (typeof updateAuthUI === 'function') updateAuthUI();
    bindAdminCenterTabHandlers();
    applyAdminCenterI18n();
    switchAdminCenterTab(adminCenterActiveTab || 'overview');
    const view = getAdminViewFromHash();
    switchAdminView(view, { updateHash: false, showToast: typeof window.showToast === 'function' ? window.showToast : null });
    if (adminCenterActiveTab === 'overview') refreshAdminSystemStatus(true).catch(() => {});
}

function initAdminAccordions() {
    document.querySelectorAll('.admin-accordion-trigger').forEach((trigger) => {
        if (trigger.dataset.accordionBound === '1') return;
        trigger.dataset.accordionBound = '1';
        trigger.addEventListener('click', () => {
            const accordion = trigger.closest('.admin-accordion');
            if (!accordion) return;
            const isOpen = accordion.classList.toggle('is-open');
            trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    });
}

export async function initAdminModule(helpers) {
    if (adminModuleInitialized) return;
    adminModuleInitialized = true;

    const { showToast, switchTab, updateWorkspaceUI, refreshLocalLibrary, saveQueueToStorage, backgroundSyncData, initNoteModule } = helpers;
    window.NHP_activateAdminPanel = activateAdminPanel;
    window.NHP_switchAdminView = switchAdminView;
    ensureUiDiagnosticCollectors();
    initAdminCenterUi(showToast);
    initAdminSubNav(showToast);
    initAdminAccordions();

    // --- Auth Listeners ---
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    const btnGoogleLogin = document.getElementById('btnGoogleLogin');
    const authNickname = document.getElementById('authNickname');
    const authPassword = document.getElementById('authPassword');
    const authStatus = document.getElementById('authStatus');
    const googleAuthHint = document.getElementById('googleAuthHint');
    const authLoginDivider = document.getElementById('authLoginDivider');

    const setAuthStatus = (html, tone = 'info') => {
        if (!authStatus) return;
        authStatus.style.display = 'block';
        authStatus.innerHTML = html;
        if (tone === 'error') {
            authStatus.style.background = 'rgba(239, 68, 68, 0.1)';
            authStatus.style.color = 'var(--banned)';
        } else if (tone === 'ok') {
            authStatus.style.background = 'rgba(16, 185, 129, 0.12)';
            authStatus.style.color = '#10b981';
        } else {
            authStatus.style.background = 'rgba(108, 99, 255, 0.1)';
            authStatus.style.color = 'var(--primary)';
        }
    };

    const refreshGoogleAuthAvailability = () => {
        chrome.runtime.sendMessage({ action: 'EMAILCORE_GOOGLE_AUTH_STATUS' }, (response) => {
            if (chrome.runtime.lastError) {
                if (btnGoogleLogin) btnGoogleLogin.hidden = true;
                if (authLoginDivider) authLoginDivider.hidden = true;
                if (googleAuthHint) {
                    googleAuthHint.hidden = false;
                    googleAuthHint.textContent = adminI18n('googleNotConfigured');
                }
                return;
            }
            const enabled = !!response?.enabled;
            if (btnGoogleLogin) {
                btnGoogleLogin.hidden = !enabled;
                btnGoogleLogin.disabled = !enabled;
            }
            if (authLoginDivider) authLoginDivider.hidden = !enabled;
            if (googleAuthHint) {
                googleAuthHint.hidden = enabled;
                if (!enabled) {
                    googleAuthHint.textContent = response?.message
                        || adminI18n('googleNotConfigured');
                }
            }
        });
    };
    refreshGoogleAuthAvailability();

    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const nickname = authNickname.value.trim();
            const password = authPassword.value.trim();

            if (!nickname) return showToast('⚠️ يرجى إدخال الاسم المستعار');

            setAuthStatus(adminIsRtl() ? '⏳ جاري التحقق...' : '⏳ Checking…');

            try {
                await window.AuthManager.loginWithNickname(nickname, password);
                showToast(`✨ مرحباً بك ${nickname}! تم الدخول بنجاح`);
                authPassword.value = '';
                updateAuthUI();
            } catch (e) {
                if (e.message === 'REQUIRED_PASSWORD') {
                    setAuthStatus(adminIsRtl()
                        ? '⚠️ هذا الاسم محمي، يرجى إدخال كلمة المرور للمتابعة'
                        : '⚠️ This nickname is protected — enter the password', 'error');
                    authPassword.focus();
                } else if (e.message === 'NEW_USER_PASSWORD_REQUIRED') {
                    setAuthStatus(adminIsRtl()
                        ? '🔑 اسم جديد! يرجى تعيين كلمة مرور لحماية اسمك مستقبلاً'
                        : '🔑 New nickname — set a password to protect it', 'error');
                    authPassword.focus();
                } else {
                    setAuthStatus(`❌ ${e.message}`, 'error');
                }
            }
        });
    }

    btnGoogleLogin?.addEventListener('click', async () => {
        if (btnGoogleLogin.disabled) return;
        btnGoogleLogin.disabled = true;
        setAuthStatus(`⏳ ${adminI18n('googleSigningIn')}`);
        chrome.runtime.sendMessage({ action: 'EMAILCORE_EXTENSION_GOOGLE_LOGIN' }, async (response) => {
            btnGoogleLogin.disabled = false;
            if (chrome.runtime.lastError) {
                setAuthStatus(`❌ ${chrome.runtime.lastError.message}`, 'error');
                showToast(`❌ ${adminI18n('googleSignInFailed')}`);
                return;
            }
            if (!response?.ok) {
                if (response?.code === 'firebase_not_configured' || response?.code === 'google_not_configured') {
                    refreshGoogleAuthAvailability();
                    setAuthStatus(`⚠️ ${adminI18n('googleNotConfigured')}`, 'error');
                } else if (response?.code === 'pending') {
                    setAuthStatus(`⏳ ${adminI18n('googlePending')}`, 'error');
                } else {
                    setAuthStatus(`❌ ${response?.error || adminI18n('googleSignInFailed')}`, 'error');
                }
                showToast(`❌ ${response?.error || adminI18n('googleSignInFailed')}`);
                return;
            }
            try {
                if (window.AuthManager?.loginWithGoogleProfile) {
                    await window.AuthManager.loginWithGoogleProfile({
                        email: response.email,
                        username: response.username,
                        userId: response.userId,
                    });
                }
            } catch (_) { /* local profile is best-effort */ }
            setAuthStatus(`✅ ${response.username || response.email || ''}`, 'ok');
            showToast(adminIsRtl()
                ? `✨ مرحباً بك ${response.username || ''}! تم الدخول عبر Google`
                : `✨ Welcome ${response.username || ''}! Signed in with Google`);
            updateAuthUI();
            try {
                const mod = await import('../creaty/emailcore-library.js');
                await mod.refreshEmailCoreConnectionStatus?.();
                if (response.creatyTokenSynced !== false) {
                    await mod.refreshEmailCoreLibrary?.({ silent: true });
                }
            } catch (_) { /* CREATY panel may not be loaded yet */ }
        });
    });

    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await window.AuthManager.logout();
            chrome.runtime.sendMessage({ action: 'EMAILCORE_EXTENSION_LOGOUT' }, () => {
                void chrome.runtime.lastError;
            });
            showToast(adminIsRtl() ? '🚪 تم تسجيل الخروج' : '🚪 Signed out');
            updateAuthUI();
            refreshGoogleAuthAvailability();
        });
    }

    document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert(adminIsRtl()
            ? 'نسيت كلمة السر؟\n\nيرجى التواصل مع المدير (Owner) لتزويده باسمك المستعار وسيقوم بإعادة تعيين كلمة السر لك من لوحة التحكم الخاصة به.'
            : 'Forgot password?\n\nContact the owner with your nickname so they can reset your password from the admin panel.');
    });

    // --- Private Customization (AI keys + profile import/export) ---
    const aiKeyGeminiInput = document.getElementById('admin-ai-key-gemini');
    const aiKeyCursorInput = document.getElementById('admin-ai-key-cursor');
    const aiKeyGptInput = document.getElementById('admin-ai-key-gpt');
    const aiBaseUrlInput = document.getElementById('admin-ai-base-url');
    const aiKeysVisibilityToggle = document.getElementById('toggle-ai-keys-visibility');
    const btnSaveAiKeys = document.getElementById('btn-admin-save-ai-keys');
    const btnPrivateProfileExport = document.getElementById('btn-private-profile-export');
    const btnPrivateProfileImport = document.getElementById('btn-private-profile-import');
    const privateProfileImportInput = document.getElementById('private-profile-import-input');

    const loadAdminAiKeysIntoForm = async () => {
        if (!aiKeyGeminiInput || !aiKeyCursorInput || !aiKeyGptInput) return;
        const storedKeys = await getStoredAdminAiKeys();
        aiKeyGeminiInput.value = storedKeys.gemini || '';
        aiKeyCursorInput.value = storedKeys.cursor || '';
        aiKeyGptInput.value = storedKeys.gpt || '';
        if (aiBaseUrlInput) aiBaseUrlInput.value = storedKeys.baseUrl || await nhpAdminDefaultProxyBaseUrl();
        updateAdminGptKeyWarning(storedKeys.gpt, storedKeys.baseUrl || aiBaseUrlInput?.value);
        probeAdminCliProxyCodexStatus();
    };

    const setAiKeyFieldsVisibility = (isVisible) => {
        const targetType = isVisible ? 'text' : 'password';
        [aiKeyGeminiInput, aiKeyCursorInput, aiKeyGptInput].forEach((input) => {
            if (input) input.type = targetType;
        });
    };

    if (aiKeysVisibilityToggle) {
        aiKeysVisibilityToggle.checked = false;
        aiKeysVisibilityToggle.addEventListener('change', (e) => {
            setAiKeyFieldsVisibility(!!e.target.checked);
        });
    }
    setAiKeyFieldsVisibility(false);
    loadAdminAiKeysIntoForm();

    aiKeyGptInput?.addEventListener('input', () => {
        updateAdminGptKeyWarning(aiKeyGptInput.value, aiBaseUrlInput?.value);
    });
    aiBaseUrlInput?.addEventListener('change', () => {
        updateAdminGptKeyWarning(aiKeyGptInput?.value, aiBaseUrlInput.value);
        probeAdminCliProxyCodexStatus();
    });
    document.getElementById('btn-admin-probe-cliproxy-codex')?.addEventListener('click', () => {
        probeAdminCliProxyCodexStatus();
    });

    if (btnSaveAiKeys) {
        btnSaveAiKeys.addEventListener('click', async () => {
            try {
                let gptVal = String(aiKeyGptInput?.value || '').trim();
                const baseVal = String(aiBaseUrlInput?.value || DEFAULT_NHP_PROXY_BASE_URL).trim();
                const isLocal = /:(8317)(\/|$)/.test(baseVal) && /127\.0\.0\.1|localhost/i.test(baseVal);
                if (isLocal && /^AIza[0-9A-Za-z_\-]{10,}$/.test(gptVal)) {
                    showToast('⚠️ مفتاح Google (AIza) لا يصلح لـ CLIProxy — استُبدل بـ nhp-local-cliproxy-key');
                    gptVal = 'nhp-local-cliproxy-key';
                    if (aiKeyGptInput) aiKeyGptInput.value = gptVal;
                }
                if (isLocal && (!gptVal || gptVal === 'nhp-local-cli-proxy-key')) {
                    gptVal = 'nhp-local-cliproxy-key';
                    if (aiKeyGptInput) aiKeyGptInput.value = gptVal;
                }
                updateAdminGptKeyWarning(gptVal, baseVal);
                const saved = await saveAdminAiKeys({
                    gemini: aiKeyGeminiInput?.value || '',
                    cursor: aiKeyCursorInput?.value || '',
                    gpt: gptVal,
                    baseUrl: baseVal || DEFAULT_NHP_PROXY_BASE_URL
                });
                updateAdminGptKeyWarning(saved.gpt, saved.baseUrl);
                probeAdminCliProxyCodexStatus();
                showToast(gptVal ? '✅ تم حفظ إعدادات NHP API' : '⚠️ تم الحفظ بدون مفتاح API — أضف المفتاح لتفعيل AI');
            } catch (error) {
                showToast(`❌ فشل حفظ مفاتيح AI: ${error?.message || 'unknown error'}`);
            }
        });
    }

    const emailcoreApiInput = document.getElementById('admin-emailcore-api');
    const emailcoreUserInput = document.getElementById('admin-emailcore-username');
    const emailcorePassInput = document.getElementById('admin-emailcore-password');
    const emailcoreStatusEl = document.getElementById('admin-emailcore-session-status');
    const btnEmailcoreLogin = document.getElementById('btn-admin-emailcore-login');
    const btnEmailcoreLogout = document.getElementById('btn-admin-emailcore-logout');
    const btnEmailcoreRefreshLib = document.getElementById('btn-admin-emailcore-refresh-lib');

    const updateEmailcoreSessionUi = async () => {
        const stored = await new Promise((resolve) => chrome.storage.local.get([
            'emailcore_creaty_api_base',
            'emailcore_session_token',
            'emailcore_session_username',
            'emailcore_session_role',
            'emailcore_session_tier',
            'emailcore_session_expires_at',
        ], resolve));
        if (emailcoreApiInput) {
            emailcoreApiInput.value = String(stored.emailcore_creaty_api_base || 'https://emailcore.app').replace(/\/+$/, '');
        }
        const hasSession = !!String(stored.emailcore_session_token || '').trim();
        if (emailcoreStatusEl) {
            if (hasSession) {
                const roleLabel = stored.emailcore_session_role === 'admin' ? 'مدير' : 'مستخدم';
                const tierRaw = String(stored.emailcore_session_tier || 'bronze').trim();
                const tierLabels = { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي' };
                const tierLabel = stored.emailcore_session_role === 'admin'
                    ? ''
                    : ` · ${tierLabels[tierRaw] || tierRaw}`;
                emailcoreStatusEl.textContent = `✅ متصل: ${stored.emailcore_session_username || '—'} (${roleLabel}${tierLabel})`;
            } else {
                emailcoreStatusEl.textContent = 'غير متصل — أدخل بيانات الموقع وسجّل الدخول';
            }
        }
        if (btnEmailcoreLogout) btnEmailcoreLogout.hidden = !hasSession;
        if (btnEmailcoreRefreshLib) btnEmailcoreRefreshLib.hidden = !hasSession;
        if (emailcorePassInput && hasSession) emailcorePassInput.value = '';
    };

    btnEmailcoreLogin?.addEventListener('click', async () => {
        const apiBase = String(emailcoreApiInput?.value || 'https://emailcore.app').trim().replace(/\/+$/, '');
        const username = String(emailcoreUserInput?.value || '').trim();
        const password = String(emailcorePassInput?.value || '');
        if (!username || !password) {
            showToast('⚠️ أدخل اسم المستخدم وكلمة المرور');
            return;
        }
        if (emailcoreStatusEl) emailcoreStatusEl.textContent = '⏳ جاري تسجيل الدخول...';
        chrome.runtime.sendMessage({
            action: 'EMAILCORE_EXTENSION_LOGIN',
            apiBase,
            username,
            password,
        }, async (response) => {
            if (chrome.runtime.lastError) {
                showToast(`❌ ${chrome.runtime.lastError.message}`);
                await updateEmailcoreSessionUi();
                return;
            }
            if (!response?.ok) {
                showToast(`❌ ${response?.error || 'فشل تسجيل الدخول'}`);
                await updateEmailcoreSessionUi();
                return;
            }
            if (emailcorePassInput) emailcorePassInput.value = '';
            showToast(`✅ تم الاتصال بـ EmailCore (${response.username})`);
            await updateEmailcoreSessionUi();
            try {
                const mod = await import('../creaty/emailcore-library.js');
                await mod.refreshEmailCoreConnectionStatus?.();
                if (response.creatyTokenSynced !== false) {
                    await mod.refreshEmailCoreLibrary?.({ silent: true });
                }
            } catch (_) { /* CREATY panel may not be loaded yet */ }
        });
    });

    btnEmailcoreLogout?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'EMAILCORE_EXTENSION_LOGOUT' }, async (response) => {
            if (chrome.runtime.lastError || !response?.ok) {
                showToast(`❌ ${chrome.runtime.lastError?.message || response?.error || 'فشل تسجيل الخروج'}`);
                return;
            }
            showToast('🚪 تم قطع اتصال EmailCore');
            await updateEmailcoreSessionUi();
        });
    });

    btnEmailcoreRefreshLib?.addEventListener('click', async () => {
        try {
            const mod = await import('../creaty/emailcore-library.js');
            await mod.refreshEmailCoreLibrary?.();
            showToast('✅ تم تحديث مكتبة EmailCore');
        } catch (err) {
            showToast(`❌ ${err?.message || 'فشل تحديث المكتبة'}`);
        }
    });

    updateEmailcoreSessionUi();

    const buildPrivateProfilePayload = async () => {
        const allData = await new Promise((resolve) => chrome.storage.local.get(null, resolve));
        const aiKeys = await getStoredAdminAiKeys();
        return {
            version: PRIVATE_PROFILE_VERSION,
            exportedAt: new Date().toISOString(),
            aiKeys,
            preferences: collectPrivatePreferencesFromStorage(allData)
        };
    };

    const isPlainObjectSafe = (value) => isPlainObject(value);

    const sanitizeImportedPreferences = (rawPreferences) => {
        if (!isPlainObjectSafe(rawPreferences)) {
            throw new Error('preferences must be an object');
        }
        const sanitized = {};
        Object.keys(rawPreferences).forEach((key) => {
            if (!key || PRIVATE_PREFERENCE_KEY_EXCLUSIONS.has(key)) return;
            const value = rawPreferences[key];
            const allowedValue =
                value == null
                || ['string', 'number', 'boolean'].includes(typeof value)
                || isPlainObjectSafe(value);
            const allowedKey = PRIVATE_PREFERENCE_KEY_WHITELIST.includes(key)
                || /(default.*(button|btn)|selected.*button|preferred.*button|personal(ization|isation)?|preference|pipeline-enable|uiLaunchMode)/i.test(key);
            if (allowedKey && allowedValue) sanitized[key] = value;
        });
        return sanitized;
    };

    const applyImportedPrivateProfile = async (profile) => {
        if (!isPlainObjectSafe(profile)) throw new Error('Invalid profile payload');
        const importedAiKeys = normalizeAdminAiKeys(profile.aiKeys || {});
        const importedPreferences = sanitizeImportedPreferences(profile.preferences || {});

        await saveAdminAiKeys(importedAiKeys);
        if (Object.keys(importedPreferences).length > 0) {
            await new Promise((resolve) => chrome.storage.local.set(importedPreferences, resolve));
        }
        await loadAdminAiKeysIntoForm();

        const currentLaunchMode = importedPreferences.uiLaunchMode;
        if (typeof currentLaunchMode === 'string') {
            const modeRadio = document.querySelector(`input[name="ui-launch-mode"][value="${currentLaunchMode}"]`);
            if (modeRadio) modeRadio.checked = true;
        }
        ['pipeline-enable-analysis', 'pipeline-enable-tmhunt', 'pipeline-enable-uspto'].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(importedPreferences, key)) {
                const el = document.getElementById(key);
                if (el) el.checked = importedPreferences[key] !== false;
            }
        });
        if (Object.prototype.hasOwnProperty.call(importedPreferences, AUTO_LITE_ASSIST_KEY)) {
            const autoLiteEl = document.getElementById('toggle-auto-lite-assist');
            if (autoLiteEl) autoLiteEl.checked = importedPreferences[AUTO_LITE_ASSIST_KEY] !== false;
        }
        if (Object.prototype.hasOwnProperty.call(importedPreferences, FORCE_I3_MODE_KEY)) {
            const i3ModeEl = document.getElementById('toggle-i3-ram-2gb-mode');
            if (i3ModeEl) i3ModeEl.checked = importedPreferences[FORCE_I3_MODE_KEY] === true;
        }
        if (Object.prototype.hasOwnProperty.call(importedPreferences, PROMPT_BAG_OVERLAY_ENABLED_KEY)) {
            const promptBagEl = document.getElementById('toggle-prompt-bag-overlay');
            if (promptBagEl) promptBagEl.checked = importedPreferences[PROMPT_BAG_OVERLAY_ENABLED_KEY] !== false;
        }
        if (Object.prototype.hasOwnProperty.call(importedPreferences, 'cloudSyncEnabled')) {
            const cloudEl = document.getElementById('toggle-cloud-sync');
            if (cloudEl) cloudEl.checked = importedPreferences.cloudSyncEnabled !== false;
        }
        if (Object.prototype.hasOwnProperty.call(importedPreferences, 'smartSyncEnabled')) {
            const smartEl = document.getElementById('toggle-smart-sync');
            if (smartEl) smartEl.checked = importedPreferences.smartSyncEnabled !== false;
        }

        return {
            importedAiCount: Object.values(importedAiKeys).filter(Boolean).length,
            importedPrefCount: Object.keys(importedPreferences).length
        };
    };

    if (btnPrivateProfileExport) {
        btnPrivateProfileExport.addEventListener('click', async () => {
            try {
                const payload = await buildPrivateProfilePayload();
                const json = JSON.stringify(payload, null, 2);
                const fileName = `NHP_Private_Profile_${new Date().toISOString().split('T')[0]}.json`;

                if (workspaceHandle) {
                    try {
                        const fileHandle = await workspaceHandle.getFileHandle('nhp_private_profile.json', { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(json);
                        await writable.close();
                        showToast('✅ تم تصدير الإعدادات الخاصة إلى المجلد المحلي');
                        return;
                    } catch (error) {
                        console.warn('Private profile workspace export failed, fallback to browser download:', error);
                    }
                }

                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                showToast('✅ تم تنزيل ملف الإعدادات الخاصة');
            } catch (error) {
                showToast(`❌ فشل تصدير الإعدادات الخاصة: ${error?.message || 'unknown error'}`);
            }
        });
    }

    if (btnPrivateProfileImport && privateProfileImportInput) {
        btnPrivateProfileImport.addEventListener('click', () => privateProfileImportInput.click());

        privateProfileImportInput.addEventListener('change', async (event) => {
            const inputFile = event.target?.files?.[0];
            if (!inputFile) return;

            try {
                const text = await inputFile.text();
                const parsed = JSON.parse(text);
                if (!parsed || typeof parsed !== 'object') throw new Error('صيغة JSON غير صالحة');

                if (!confirm('سيتم دمج مفاتيح AI والإعدادات الشخصية المتوافقة مع وضعك الحالي. هل تريد المتابعة؟')) {
                    privateProfileImportInput.value = '';
                    return;
                }

                const result = await applyImportedPrivateProfile(parsed);
                showToast(`✅ تم استيراد الإعدادات الخاصة (AI: ${result.importedAiCount}, Prefs: ${result.importedPrefCount})`);
            } catch (error) {
                showToast(`❌ فشل استيراد الإعدادات الخاصة: ${error?.message || 'unknown error'}`);
            } finally {
                privateProfileImportInput.value = '';
            }
        });
    }

    // --- Admin Panel Listeners ---
    document.getElementById('btn-admin-reset-pass')?.addEventListener('click', async () => {
        const targetEmail = document.getElementById('admin-target-email').value.trim();
        const userData = window.lastSelectedUser;

        if (!targetEmail || !userData) {
            return showToast('⚠️ يرجى اختيار عضو من القائمة أولاً');
        }

        const newPass = prompt(`أدخل كلمة السر الجديدة للعضو (${userData.nickname || userData.email}):`, '123456');
        if (newPass === null || newPass.trim() === '') return;

        try {
            showToast('⏳ جاري إعادة التعيين...');
            if (window.GitHubSync) {
                await window.GitHubSync.registerUserGlobal(userData.email, userData.uid, userData.nickname, newPass.trim(), true);
                showToast('✅ تم إعادة تعيين كلمة السر بنجاح!');
                refreshAdminUsers();
            }
        } catch (e) {
            showToast('❌ فشل إعادة التعيين: ' + e.message);
        }
    });

    const btnAdminSend = document.getElementById('btn-admin-send-queue');
    if (btnAdminSend) {
        btnAdminSend.addEventListener('click', async () => {
            const targetEmail = document.getElementById('admin-target-email').value.trim();
            if (!targetEmail) return showToast('⚠️ يرجى إدخال بريد العضو المستلم');

            if (typeof window.designQueue === 'undefined' || window.designQueue.length === 0) {
                return showToast('⚠️ القائمة الحالية فارغة! أضف تصاميم أولاً');
            }

            if (typeof window.GitHubSync === 'undefined') {
                return showToast('❌ محرك المزامنة غير متوفر، يرجى تحديث الصفحة');
            }

            btnAdminSend.disabled = true;
            showToast(`⏳ جاري إرسال ${window.designQueue.length} تصميم للعضو ${targetEmail}...`);

            try {
                const res = await window.GitHubSync.shareQueueToUser(targetEmail, { savedDesignQueue: window.designQueue });
                if (res) {
                    showToast('🚀 تم إرسال حزمة التصاميم بنجاح لسحابة العضو!');
                    document.getElementById('admin-target-email').value = '';
                } else {
                    showToast('❌ حدث خطأ غير معروف أثناء الإرسال');
                }
            } catch (e) {
                console.error('Admin Send Error:', e);
                showToast('❌ فشل الإرسال: ' + e.message);
            } finally {
                btnAdminSend.disabled = false;
            }
        });
    }

    const btnSyncLegacy = document.getElementById('btn-sync-legacy-users');
    if (btnSyncLegacy) {
        btnSyncLegacy.addEventListener('click', async () => {
            btnSyncLegacy.style.animation = 'spin 1s linear infinite';
            showToast('⏳ جاري فحص الأعضاء القدامى في السحابة...');

            try {
                const res = await window.GitHubSync.migrateLegacyUsers();
                if (res.success) {
                    showToast(`✅ اكتملت المزامنة! تم العثور على ${res.count} سجل.`);
                    refreshAdminUsers();
                } else {
                    showToast('❌ فشل الفحص: ' + (res.error || 'خطأ غير معروف'));
                }
            } catch (e) {
                showToast('❌ خطأ أثناء المزامنة');
            } finally {
                btnSyncLegacy.style.animation = '';
            }
        });
    }

    // --- Full System Scan ---
    const btnAdminFullScan = document.getElementById('btn-admin-full-scan');
    const btnAdminDownloadConsoleReport = document.getElementById('btn-admin-download-console-report');
    const fullScanProgressBar = document.getElementById('admin-full-scan-progress');
    const fullScanPercentLabel = document.getElementById('admin-full-scan-percent');
    const fullScanStatus = document.getElementById('admin-full-scan-status');

    const scanSetProgress = (percent, statusText) => {
        const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
        if (fullScanProgressBar) {
            fullScanProgressBar.style.width = `${safePercent}%`;
            fullScanProgressBar.style.minWidth = safePercent > 0 ? '2px' : '0';
            fullScanProgressBar.style.opacity = safePercent > 0 ? '1' : '0.9';
        }
        if (fullScanPercentLabel) fullScanPercentLabel.textContent = `${safePercent}%`;
        if (fullScanStatus && typeof statusText === 'string' && statusText) fullScanStatus.textContent = statusText;
        updateAdminKpiCards();
    };

    const scanNowStamp = () => {
        try { return new Date().toISOString(); } catch (_) { return String(Date.now()); }
    };

    const maskSecret = (value) => {
        const text = String(value || '');
        if (!text) return 'missing';
        if (text.length <= 8) return `${'*'.repeat(Math.max(0, text.length - 2))}${text.slice(-2)}`;
        return `${text.slice(0, 3)}***${text.slice(-3)}`;
    };

    const runFullSystemScan = async () => {
        const logs = [];
        const sectionLatencyRecords = [];
        let okCount = 0;
        let warnCount = 0;
        let failCount = 0;

        const push = (level, title, details = '') => {
            const line = `[${scanNowStamp()}] [${level}] ${title}${details ? ` :: ${details}` : ''}`;
            logs.push(line);
            appendAdminScanResultRow(level, title, details);
            if (level === 'OK') okCount += 1;
            else if (level === 'WARN') warnCount += 1;
            else if (level === 'FAIL') failCount += 1;
        };

        const steps = [];
        const addStep = (label, fn) => steps.push({ label, fn });

        addStep('فحص البنية العامة للواجهة', async () => {
            const requiredDomIds = [
                'btn-launch-merchghost',
                'btn-start-nonautopilot-servers',
                'btn-stop-nonautopilot-servers',
                'btn-download-startup-bat',
                'btn-download-startup-sh',
                'btn-start-ai-chrome-session',
                'btn-restart-ai-chrome-session',
                'btn-github-export',
                'btn-github-import',
                'btn-local-export',
                'btn-local-import',
                'toggle-cloud-sync',
                'toggle-smart-sync',
                'toggle-auto-lite-assist',
                'toggle-i3-ram-2gb-mode',
                'toggle-prompt-bag-overlay',
                'admin-ai-key-gemini',
                'admin-ai-key-cursor',
                'admin-ai-key-gpt',
                'btn-admin-save-ai-keys',
                'btn-private-profile-export',
                'btn-private-profile-import'
            ];
            let missing = 0;
            requiredDomIds.forEach((id) => {
                const el = document.getElementById(id);
                if (el) push('OK', `DOM:${id}`, 'exists');
                else {
                    missing += 1;
                    push('FAIL', `DOM:${id}`, 'missing');
                }
            });
            if (missing === 0) push('OK', 'واجهة الأدمن', 'all required controls found');
        });

        addStep('فحص جميع الأقسام قسمًا بقسم + الأزرار', async () => {
            const sections = [
                { name: 'Trend', tabId: 'tab-trend', panelId: 'panel-trend', criticalButtons: ['trend-fetch-btn', 'trend-copy-all-btn', 'trend-clear-cache-btn'] },
                { name: 'TMH', tabId: 'tab-tmh', panelId: 'panel-tmh', criticalButtons: ['tmh-startBtn'], readySelectors: ['#tmh-module-container'], maxWaitMs: 9000, optionalWhenHidden: true },
                { name: 'USPTO', tabId: 'tab-uspto', panelId: 'panel-uspto', criticalButtons: [] },
                { name: 'TeePublic Analysis', tabId: 'tab-teepublic', panelId: 'panel-teepublic', criticalButtons: [] },
                { name: 'Note', tabId: 'tab-note', panelId: 'panel-note', criticalButtons: [] },
                { name: 'Radar/Lab', tabId: 'tab-lab', panelId: 'panel-lab', criticalButtons: [] },
                { name: 'SEO', tabId: 'tab-seo', panelId: 'panel-seo', criticalButtons: ['seo-genBtn'] },
                { name: 'Studio', tabId: 'tab-studio', panelId: 'panel-studio', criticalButtons: [] },
                { name: 'Autopilot', tabId: 'tab-autopilot', panelId: 'panel-autopilot', criticalButtons: [] },
                { name: 'Admin', tabId: 'tab-admin', panelId: 'panel-admin', criticalButtons: ['btn-admin-full-scan', 'btn-admin-download-console-report'] },
                { name: 'Social', tabId: 'tab-social', panelId: 'panel-social', criticalButtons: [] },
                { name: 'Redbubble', tabId: 'tab-redbubble', panelId: 'panel-redbubble', criticalButtons: [] },
                { name: 'Amazon', tabId: 'tab-amazon', panelId: 'panel-amazon', criticalButtons: [] }
            ];
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const activateSection = async (panelName) => {
                try {
                    if (typeof window.switchTab === 'function') {
                        window.switchTab(panelName);
                    } else {
                        const tab = document.getElementById(`tab-${panelName}`);
                        if (tab) tab.click();
                    }
                } catch (_) { }
                // Lazy-loaded panels need a short delay for html injection + init
                await sleep(420);
            };
            const collectPanelControlStats = (panel) => {
                const buttonCount = panel.querySelectorAll('button').length;
                const inputCount = panel.querySelectorAll('input,select,textarea').length;
                const controlCount = panel.querySelectorAll('button,input,select,textarea,a[href],label').length;
                return { buttonCount, inputCount, controlCount };
            };
            const waitForPanelReady = async (panel, section) => {
                const criticalIds = Array.isArray(section?.criticalButtons) ? section.criticalButtons : [];
                const readySelectors = Array.isArray(section?.readySelectors) ? section.readySelectors : [];
                const maxWaitMs = Math.max(1200, Number(section?.maxWaitMs || 4200));
                const stepMs = 180;
                const startedAt = Date.now();
                let stats = collectPanelControlStats(panel);
                while ((Date.now() - startedAt) < maxWaitMs) {
                    const criticalReady = criticalIds.some((id) => !!document.getElementById(id));
                    const selectorReady = readySelectors.some((selector) => {
                        try { return !!panel.querySelector(selector); } catch (_) { return false; }
                    });
                    if (stats.controlCount > 0 || criticalReady || selectorReady) {
                        return { ...stats, waitedMs: Date.now() - startedAt, criticalReady, selectorReady };
                    }
                    await sleep(stepMs);
                    stats = collectPanelControlStats(panel);
                }
                return { ...stats, waitedMs: Date.now() - startedAt, timeout: true };
            };

            for (const section of sections) {
                const panelName = String(section.panelId || '').replace('panel-', '');
                if (panelName) {
                    await activateSection(panelName);
                }
                const tab = document.getElementById(section.tabId);
                const panel = document.getElementById(section.panelId);
                push(tab ? 'OK' : 'FAIL', `Section:${section.name}:tab`, tab ? 'exists' : 'missing');
                push(panel ? 'OK' : 'FAIL', `Section:${section.name}:panel`, panel ? 'exists' : 'missing');
                if (!panel) continue;
                const tabHidden = !!tab && (tab.offsetParent === null || getComputedStyle(tab).display === 'none' || getComputedStyle(tab).visibility === 'hidden');
                if (section.optionalWhenHidden && tabHidden) {
                    push('OK', `Section:${section.name}:controls`, 'skipped (optional section hidden in current UI mode)');
                    sectionLatencyRecords.push({ name: section.name, waitedMs: 0, controlCount: 1 });
                    continue;
                }

                const ready = await waitForPanelReady(panel, section);
                const buttonCount = ready.buttonCount;
                const inputCount = ready.inputCount;
                const controlCount = ready.controlCount;
                if (controlCount === 0) {
                    if (ready.selectorReady || ready.criticalReady) {
                        push('OK', `Section:${section.name}:controls`, `container ready (selector/critical) with deferred controls, waited=${ready.waitedMs}ms`);
                        sectionLatencyRecords.push({ name: section.name, waitedMs: Number(ready.waitedMs || 0), controlCount: 1 });
                        continue;
                    }
                    const hint = ready.timeout
                        ? `no controls after ${ready.waitedMs}ms (lazy-load timeout or module init issue)`
                        : `no controls found after ${ready.waitedMs}ms`;
                    push('WARN', `Section:${section.name}:controls`, hint);
                } else {
                    push('OK', `Section:${section.name}:controls`, `buttons=${buttonCount}, inputs=${inputCount}, total=${controlCount}, waited=${ready.waitedMs}ms`);
                }
                sectionLatencyRecords.push({ name: section.name, waitedMs: Number(ready.waitedMs || 0), controlCount: Number(controlCount || 0) });

                if (Array.isArray(section.criticalButtons) && section.criticalButtons.length > 0) {
                    for (const controlId of section.criticalButtons) {
                        const control = document.getElementById(controlId);
                        push(control ? 'OK' : 'WARN', `Section:${section.name}:btn:${controlId}`, control ? 'ready' : 'not found');
                    }
                }
            }
        });

        addStep('فحص الوحدات والواجهات البرمجية', async () => {
            const checks = [
                ['AuthManager', !!window.AuthManager],
                ['GitHubSync', !!window.GitHubSync],
                ['AICentralBrain', !!window.AICentralBrain],
                ['designQueue(Array)', Array.isArray(window.designQueue)],
                ['renderQueue(fn)', typeof window.renderQueue === 'function'],
                ['saveQueueToStorage(fn)', typeof window.saveQueueToStorage === 'function'],
                ['NHP mode flag', (typeof window.NHP_LOW_SPEC_MODE !== 'undefined' || typeof window.NHP_IS_LIGHT_MODE !== 'undefined')]
            ];
            checks.forEach(([name, passed]) => {
                push(passed ? 'OK' : 'WARN', `Module:${name}`, passed ? 'ready' : 'not detected');
            });
        });

        addStep('فحص التخزين المحلي والاعدادات الحرجة', async () => {
            const keys = [
                'cloudSyncEnabled',
                'smartSyncEnabled',
                AUTO_LITE_ASSIST_KEY,
                FORCE_I3_MODE_KEY,
                PROMPT_BAG_OVERLAY_ENABLED_KEY,
                'nhpPerformanceMode',
                'savedDesignQueue',
                'teepublic_manager_data',
                NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY,
                SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY,
                LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY
            ];
            const data = await chrome.storage.local.get(keys);
            push('OK', 'storage.local access', 'read success');
            push('OK', 'Setting:cloudSyncEnabled', String(data.cloudSyncEnabled));
            push('OK', 'Setting:smartSyncEnabled', String(data.smartSyncEnabled));
            push('OK', `Setting:${AUTO_LITE_ASSIST_KEY}`, String(data[AUTO_LITE_ASSIST_KEY]));
            push('OK', `Setting:${FORCE_I3_MODE_KEY}`, String(data[FORCE_I3_MODE_KEY]));
            push('OK', `Setting:${PROMPT_BAG_OVERLAY_ENABLED_KEY}`, String(data[PROMPT_BAG_OVERLAY_ENABLED_KEY]));
            push('OK', 'Setting:nhpPerformanceMode', String(data.nhpPerformanceMode || 'performance(default)'));
            push(Array.isArray(data.savedDesignQueue) ? 'OK' : 'WARN', 'savedDesignQueue', Array.isArray(data.savedDesignQueue) ? `items=${data.savedDesignQueue.length}` : 'not array');
            const keyCandidate = String(
                data[NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY]
                || data[SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY]
                || data[LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY]
                || ''
            ).trim();
            push(keyCandidate ? 'OK' : 'WARN', 'Gemini key presence', maskSecret(keyCandidate));
        });

        addStep('فحص background runtime message bridge', async () => {
            try {
                const response = await chrome.runtime.sendMessage({ action: 'PING' });
                if (response && (response.success || response.ok || response.status)) {
                    push('OK', 'runtime PING', JSON.stringify(response).slice(0, 180));
                } else {
                    push('WARN', 'runtime PING', 'no standard success payload');
                }
            } catch (error) {
                push('WARN', 'runtime PING', error?.message || 'failed');
            }
        });

        addStep('فحص Click-Through آمن للأقسام والأزرار', async () => {
            const safeClickableIds = [
                'tab-trend', 'tab-tmh', 'tab-uspto', 'tab-teepublic', 'tab-note', 'tab-lab', 'tab-seo', 'tab-studio',
                'tab-autopilot', 'tab-admin', 'tab-social', 'tab-redbubble', 'tab-amazon',
                'btn-admin-full-scan'
            ];
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            let clicked = 0;
            for (const id of safeClickableIds) {
                const el = document.getElementById(id);
                if (!el) {
                    push('WARN', `ClickThrough:${id}`, 'element not found');
                    continue;
                }
                if (el.disabled) {
                    push('OK', `ClickThrough:${id}`, 'skipped (disabled by current state)');
                    continue;
                }
                try {
                    el.click();
                    clicked += 1;
                    await sleep(120);
                    push('OK', `ClickThrough:${id}`, 'clicked');
                } catch (error) {
                    push('WARN', `ClickThrough:${id}`, error?.message || 'click failed');
                }
            }
            push(clicked > 0 ? 'OK' : 'WARN', 'ClickThrough summary', `clicked=${clicked}/${safeClickableIds.length}`);
        });

        addStep('فحص سلامة Queue والتخزين المحلي', async () => {
            const queue = Array.isArray(window.designQueue) ? window.designQueue : [];
            const idSet = new Set();
            let duplicateIds = 0;
            let missingBase64 = 0;
            let missingFileName = 0;
            let invalidItems = 0;

            for (const item of queue) {
                if (!item || typeof item !== 'object') {
                    invalidItems += 1;
                    continue;
                }
                const id = String(item.id || '');
                if (!id) invalidItems += 1;
                else if (idSet.has(id)) duplicateIds += 1;
                else idSet.add(id);

                const status = String(item.status || '').toLowerCase();
                const hasBase64 = !!item.base64 && typeof item.base64 === 'string';
                const hasAltImageSource = !!item.file || !!item.dataUrl || !!item.url || !!item.blobUrl || !!item.localPath;
                const requireBase64 = !['idle', 'pending', 'new', 'file-only', 'local_only'].includes(status) && !hasAltImageSource;
                if (requireBase64 && !hasBase64) missingBase64 += 1;
                if (!item.file || !item.file.name) missingFileName += 1;
            }

            const queueOk = invalidItems === 0 && duplicateIds === 0 && missingBase64 === 0;
            push(queueOk ? 'OK' : 'WARN', 'Queue integrity', `size=${queue.length}, invalid=${invalidItems}, duplicateIds=${duplicateIds}, missingBase64=${missingBase64}, missingFileName=${missingFileName}`);

            try {
                const allLocal = await chrome.storage.local.get(null);
                const json = JSON.stringify(allLocal || {});
                const approxBytes = new Blob([json]).size;
                const approxMb = (approxBytes / (1024 * 1024)).toFixed(2);
                const manifest = chrome.runtime.getManifest?.() || {};
                const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
                const hasUnlimitedStorage = permissions.includes('unlimitedStorage');
                const warnThresholdBytes = hasUnlimitedStorage ? (300 * 1024 * 1024) : (4.5 * 1024 * 1024);
                if (approxBytes > warnThresholdBytes) {
                    push('WARN', 'storage.local size', `${approxMb}MB (${hasUnlimitedStorage ? 'high usage with unlimitedStorage' : 'near quota'})`);
                } else {
                    push('OK', 'storage.local size', `${approxMb}MB${hasUnlimitedStorage ? ' (unlimitedStorage)' : ''}`);
                }
            } catch (error) {
                push('WARN', 'storage.local size', error?.message || 'unable to estimate');
            }
        });

        addStep('فحص سرعة الأقسام (Ranking)', async () => {
            if (!Array.isArray(sectionLatencyRecords) || sectionLatencyRecords.length === 0) {
                push('WARN', 'Section speed ranking', 'no timing data');
                return;
            }
            const sorted = [...sectionLatencyRecords].sort((a, b) => (b.waitedMs - a.waitedMs));
            const topSlow = sorted.slice(0, 3);
            topSlow.forEach((entry, index) => {
                const tone = entry.waitedMs > 2500 ? 'WARN' : 'OK';
                push(tone, `SlowSection#${index + 1}`, `${entry.name} waited=${entry.waitedMs}ms controls=${entry.controlCount}`);
            });
            const avg = Math.round(sorted.reduce((acc, item) => acc + Number(item.waitedMs || 0), 0) / Math.max(1, sorted.length));
            push(avg > 1200 ? 'WARN' : 'OK', 'Section speed average', `${avg}ms across ${sorted.length} sections`);
        });

        addStep('فحص تحذيرات وأخطاء Google Chrome للإضافة', async () => {
            try {
                const bg = await chrome.runtime.sendMessage({ action: 'GET_NHP_DIAGNOSTIC_LOGS' });
                const bgLogs = Array.isArray(bg?.logs) ? bg.logs : [];
                const uiLogs = nhpUiDiagnosticLogs.slice(-60);
                const merged = [...bgLogs, ...uiLogs].slice(-120);
                const warnCountLocal = merged.filter((x) => String(x?.level || '').toUpperCase() === 'WARN').length;
                const errCountLocal = merged.filter((x) => String(x?.level || '').toUpperCase() === 'ERROR').length;

                push((errCountLocal > 0 || warnCountLocal > 0) ? 'WARN' : 'OK',
                    'Chrome extension errors/warnings',
                    `errors=${errCountLocal}, warnings=${warnCountLocal}, samples=${merged.length}`);

                merged.slice(-12).forEach((entry) => {
                    const level = String(entry?.level || 'INFO').toUpperCase();
                    const stamp = Number(entry?.ts || 0);
                    const t = Number.isFinite(stamp) && stamp > 0 ? new Date(stamp).toISOString() : 'n/a';
                    const text = String(entry?.text || '').slice(0, 220);
                    const logLevel = level === 'ERROR' ? 'WARN' : (level === 'WARN' ? 'WARN' : 'OK');
                    push(logLevel, `ChromeLog:${level}`, `${t} :: ${text}`);
                });
            } catch (error) {
                push('WARN', 'Chrome extension errors/warnings', error?.message || 'unable to collect');
            }
        });

        addStep('فحص سيرفر Ghost (3019)', async () => {
            try {
                const res = await fetch(await nhpAdminLocalUrl(3019, '/ping'), { method: 'GET' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text().catch(() => '');
                push('OK', 'Ghost Server 3019', `online ${text.slice(0, 80)}`);
            } catch (error) {
                push('WARN', 'Ghost Server 3019', error?.message || 'offline/unreachable');
            }
        });

        addStep('فحص سيرفر AI Bridge (3031)', async () => {
            try {
                const res = await fetch(await nhpAdminLocalUrl(3031, '/ping'), { method: 'GET' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text().catch(() => '');
                push('OK', 'AI Bridge 3031', `online ${text.slice(0, 80)}`);
            } catch (error) {
                push('WARN', 'AI Bridge 3031', error?.message || 'offline/unreachable');
            }
        });

        addStep('فحص أدوات التحكم بالسيرفرات', async () => {
            try {
                const res = await chrome.runtime.sendMessage({ action: 'control_non_autopilot_servers', command: 'start' });
                if (res?.success && res?.online === true) push('OK', 'control_non_autopilot_servers:start', JSON.stringify(res).slice(0, 160));
                else if (res?.success && res?.online === false) push('WARN', 'control_non_autopilot_servers:start', `started but offline ping (${JSON.stringify(res).slice(0, 130)})`);
                else push('WARN', 'control_non_autopilot_servers:start', res?.error || 'failed');
            } catch (error) {
                push('WARN', 'control_non_autopilot_servers:start', error?.message || 'failed');
            }

            try {
                const res = await chrome.runtime.sendMessage({ action: 'control_ai_chrome_session', command: 'start' });
                if (res?.success && res?.online === true) push('OK', 'control_ai_chrome_session:start', JSON.stringify(res).slice(0, 160));
                else if (res?.success && res?.online === false) push('WARN', 'control_ai_chrome_session:start', `started but debug endpoint offline (${JSON.stringify(res).slice(0, 130)})`);
                else push('WARN', 'control_ai_chrome_session:start', res?.error || 'failed');
            } catch (error) {
                push('WARN', 'control_ai_chrome_session:start', error?.message || 'failed');
            }
        });

        addStep('فحص AICentralBrain bridge', async () => {
            if (window.AICentralBrain && typeof window.AICentralBrain._callAI === 'function') {
                push('OK', 'AICentralBrain._callAI', 'function detected');
            } else {
                push('WARN', 'AICentralBrain._callAI', 'not callable from current context');
            }
        });

        addStep('فحص قائمة المكونات وملخص الأداء', async () => {
            const queueLen = Array.isArray(window.designQueue) ? window.designQueue.length : 0;
            const storedPerf = await chrome.storage.local.get(['nhpPerformanceMode']);
            const mode = String(window.currentPerformanceMode || storedPerf?.nhpPerformanceMode || 'unknown');
            const mem = Number(navigator.deviceMemory || 0);
            push('OK', 'Queue size', String(queueLen));
            push('OK', 'Performance mode(runtime)', mode);
            push('OK', 'Device memory hint', mem ? `${mem}GB` : 'unavailable');
        });

        addStep('فحص السلاسة وسرعة الاستجابة', async () => {
            const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
            const ms = (value) => `${Math.max(0, Math.round(Number(value) || 0))}ms`;

            // 1) Runtime bridge latency
            try {
                const t0 = now();
                const response = await chrome.runtime.sendMessage({ action: 'PING' });
                const dt = now() - t0;
                if (response?.success && dt <= 150) push('OK', 'Latency:runtime PING', ms(dt));
                else if (response?.success) push('WARN', 'Latency:runtime PING', `${ms(dt)} (higher than ideal)`);
                else push('WARN', 'Latency:runtime PING', `${ms(dt)} (unexpected response)`);
            } catch (error) {
                push('FAIL', 'Latency:runtime PING', error?.message || 'failed');
            }

            // 2) storage read/write latency
            try {
                const readStart = now();
                await chrome.storage.local.get(['savedDesignQueue', 'nhpPerformanceMode']);
                const readMs = now() - readStart;
                if (readMs <= 80) push('OK', 'Latency:storage read', ms(readMs));
                else push('WARN', 'Latency:storage read', ms(readMs));
            } catch (error) {
                push('FAIL', 'Latency:storage read', error?.message || 'failed');
            }
            try {
                const probeKey = `nhp_scan_probe_${Date.now()}`;
                const writeStart = now();
                await chrome.storage.local.set({ [probeKey]: Date.now() });
                const writeMs = now() - writeStart;
                await chrome.storage.local.remove(probeKey);
                if (writeMs <= 120) push('OK', 'Latency:storage write', ms(writeMs));
                else push('WARN', 'Latency:storage write', ms(writeMs));
            } catch (error) {
                push('FAIL', 'Latency:storage write', error?.message || 'failed');
            }

            // 3) event-loop lag sample (UI smoothness hint)
            try {
                const samples = [];
                for (let i = 0; i < 4; i += 1) {
                    const start = now();
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    const drift = Math.max(0, (now() - start) - 50);
                    samples.push(drift);
                }
                const sorted = [...samples].sort((a, b) => a - b);
                const median = sorted[Math.floor(sorted.length / 2)] || 0;
                const max = Math.max(...samples, 0);
                const hidden = document.visibilityState === 'hidden';
                if (hidden) {
                    push('WARN', 'UI smoothness:event-loop lag', `${ms(median)} median, ${ms(max)} max (tab hidden/throttled)`);
                } else if (median <= 20) {
                    push('OK', 'UI smoothness:event-loop lag', `${ms(median)} median`);
                } else if (median <= 60) {
                    push('WARN', 'UI smoothness:event-loop lag', `${ms(median)} median (medium lag)`);
                } else {
                    push('WARN', 'UI smoothness:event-loop lag', `${ms(median)} median, ${ms(max)} max (high lag)`);
                }
            } catch (error) {
                push('WARN', 'UI smoothness:event-loop lag', error?.message || 'probe failed');
            }

            // 4) light render stress probe (admin panel)
            try {
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
                const items = [];
                for (let i = 0; i < 300; i += 1) {
                    items.push(`<div class="x" style="height:12px;width:100%;margin:1px 0;border-radius:4px;background:rgba(255,255,255,0.05)">${i}</div>`);
                }
                const renderStart = now();
                host.innerHTML = items.join('');
                document.body.appendChild(host);
                const renderMs = now() - renderStart;
                host.remove();
                if (renderMs <= 35) push('OK', 'UI smoothness:DOM render probe', ms(renderMs));
                else if (renderMs <= 90) push('WARN', 'UI smoothness:DOM render probe', `${ms(renderMs)} (moderate)`);
                else push('WARN', 'UI smoothness:DOM render probe', `${ms(renderMs)} (heavy)`);
            } catch (error) {
                push('WARN', 'UI smoothness:DOM render probe', error?.message || 'probe failed');
            }

            // 5) memory signal if available
            try {
                if (performance && performance.memory) {
                    const usedMb = Math.round((performance.memory.usedJSHeapSize || 0) / (1024 * 1024));
                    const limitMb = Math.round((performance.memory.jsHeapSizeLimit || 0) / (1024 * 1024));
                    const ratio = limitMb > 0 ? (usedMb / limitMb) : 0;
                    if (ratio >= 0.82) push('WARN', 'Memory pressure', `${usedMb}/${limitMb}MB (high)`);
                    else push('OK', 'Memory pressure', `${usedMb}/${limitMb}MB`);
                } else {
                    push('WARN', 'Memory pressure', 'performance.memory unavailable in this context');
                }
            } catch (error) {
                push('WARN', 'Memory pressure', error?.message || 'unavailable');
            }
        });

        scanSetProgress(0, 'بدء الفحص الشامل...');
        for (let i = 0; i < steps.length; i += 1) {
            const step = steps[i];
            const base = Math.round((i / steps.length) * 100);
            scanSetProgress(base, step.label);
            try {
                await step.fn();
            } catch (error) {
                push('FAIL', step.label, error?.message || 'unexpected step failure');
            }
            const done = Math.round(((i + 1) / steps.length) * 100);
            scanSetProgress(done, `${step.label} - تم`);
            await new Promise((resolve) => setTimeout(resolve, 120));
        }

        const header = [
            'NHP FULL SYSTEM DIAGNOSTIC REPORT',
            `Generated: ${scanNowStamp()}`,
            `URL: ${location.href}`,
            `UserAgent: ${navigator.userAgent}`,
            `Totals => OK:${okCount} WARN:${warnCount} FAIL:${failCount}`,
            '------------------------------------------------------------'
        ];
        latestFullScanReportText = [...header, ...logs].join('\n');

        if (btnAdminDownloadConsoleReport) btnAdminDownloadConsoleReport.disabled = false;
        if (failCount > 0) {
            scanSetProgress(100, `اكتمل الفحص: ${failCount} أخطاء تحتاج إصلاح`);
            showToast(`⚠️ انتهى الفحص: ${failCount} أخطاء | ${warnCount} تحذيرات`);
        } else if (warnCount > 0) {
            scanSetProgress(100, `اكتمل الفحص: بدون أخطاء حرجة (${warnCount} تحذير)`);
            showToast(`✅ انتهى الفحص بدون أخطاء حرجة (${warnCount} تحذير)`);
        } else {
            scanSetProgress(100, 'اكتمل الفحص: كل شيء سليم');
            showToast('✅ انتهى الفحص: لا توجد مشاكل مكتشفة');
        }
    };

    if (btnAdminFullScan) {
        btnAdminFullScan.addEventListener('click', async () => {
            btnAdminFullScan.disabled = true;
            if (btnAdminDownloadConsoleReport) btnAdminDownloadConsoleReport.disabled = true;
            latestFullScanReportText = '';
            adminScanResultRows = [];
            renderAdminScanResults();
            try {
                await runFullSystemScan();
            } catch (error) {
                scanSetProgress(100, 'فشل أثناء تشغيل الفحص');
                showToast(`❌ فشل الفحص: ${error?.message || 'unknown error'}`);
            } finally {
                btnAdminFullScan.disabled = false;
            }
        });
    }

    if (btnAdminDownloadConsoleReport) {
        btnAdminDownloadConsoleReport.addEventListener('click', async () => {
            if (!latestFullScanReportText) {
                showToast('⚠️ لا يوجد تقرير بعد. شغل الفحص أولاً.');
                return;
            }
            const blob = new Blob([latestFullScanReportText], { type: 'text/plain;charset=utf-8' });
            const fileName = `nhp_console_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
            try {
                if (workspaceHandle) {
                    const fileHandle = await workspaceHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    showToast('✅ تم حفظ تقرير الفحص في المجلد المحلي');
                    return;
                }
            } catch (error) {
                console.warn('Saving scan report to workspace failed:', error);
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast('📄 تم تنزيل تقرير الفحص بنجاح');
        });
    }

    // --- AI TeePublic Tags Artisan Modal ---
    const btnOpenTpAi = document.getElementById('btn-open-tp-ai-tags');
    const tpAiModal = document.getElementById('tp-ai-modal');
    const tpAiClose = document.getElementById('tp-ai-close');
    const tpAiGenerateBtn = document.getElementById('tp-ai-generate-btn');
    const tpAiResult = document.getElementById('tp-ai-result');
    const tpAiCopyBtn = document.getElementById('tp-ai-copy-btn');
    const tpAiNicheInput = document.getElementById('tp-ai-niche');

    if (btnOpenTpAi) {
        btnOpenTpAi.addEventListener('click', () => {
            tpAiModal.style.display = tpAiModal.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (tpAiClose) {
        tpAiClose.addEventListener('click', () => {
            tpAiModal.style.display = 'none';
        });
    }

    if (tpAiGenerateBtn) {
        tpAiGenerateBtn.addEventListener('click', async () => {
            const niche = tpAiNicheInput.value.trim();
            if (!niche) return showToast('⚠️ أدخل اسم النيش أولاً');

            tpAiResult.value = '⏳ جاري توليد 25 تاق مستهدف لـ TeePublic باستخدام Gemini 2.5...';
            tpAiGenerateBtn.disabled = true;
            tpAiCopyBtn.style.display = 'none';
            
            const prompt = `You are a professional TeePublic seller expert. Give me exactly 25 top trending and highly searched SEO tags for a design about "${niche}" on TeePublic.
            RULES:
            1. ONLY RETURN A COMMA SEPARATED LIST OF 25 TAGS.
            2. Do not number them.
            3. Do not include any intro or outro text.
            4. Make them relevant and highly searchable on teepublic.`;

            try {
                const apiKey = await getInternalGeminiApiKey();
                if (!apiKey) {
                    throw new Error('Gemini key is missing in local storage.');
                }
                const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);

                const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                
                // Clean the response
                let cleanTags = aiText.replace(/\n/g, ',').replace(/\s+/g, ' ').replace(/"/g, '').trim();
                const tagArray = cleanTags.split(',').map(t => t.trim()).filter(t => t.length > 0 && t.length < 30).slice(0, 25);
                
                tpAiResult.value = tagArray.join(', ');
                tpAiCopyBtn.style.display = 'block';
                showToast('✅ تم التوليد بنجاح! انسخ التاجز الآن.');
                
            } catch (e) {
                tpAiResult.value = '❌ فشل الاتصال: ' + e.message;
                showToast('❌ حدث خطأ أثناء التوليد');
            } finally {
                tpAiGenerateBtn.disabled = false;
            }
        });
    }

    if (tpAiCopyBtn) {
        tpAiCopyBtn.addEventListener('click', () => {
            if (tpAiResult.value) {
                navigator.clipboard.writeText(tpAiResult.value).then(() => {
                    showToast('📑 تم نسخ 25 تاق بنجاح!');
                    const originalText = tpAiCopyBtn.innerHTML;
                    tpAiCopyBtn.innerHTML = '<i class="fa-solid fa-check"></i> تم النسخ!';
                    setTimeout(() => tpAiCopyBtn.innerHTML = originalText, 2000);
                });
            }
        });
    }

    // --- Launchers ---
    const btnLaunchMerchGhost = document.getElementById('btn-launch-merchghost');
    if (btnLaunchMerchGhost) {
        btnLaunchMerchGhost.addEventListener('click', () => {
            chrome.windows.create({
                url: chrome.runtime.getURL('modules/merchghost/popup_new.html'),
                type: 'popup',
                width: 450,
                height: 650,
                focused: false
            });
            showToast('👻 جاري فتح لوحة تحكم MerchGhost...');
        });
    }

    const btnOpenCliProxyManager = document.getElementById('btn-open-cliproxy-manager');
    if (btnOpenCliProxyManager) {
        btnOpenCliProxyManager.addEventListener('click', async () => {
            const localMgmt = (typeof NhpCliProxyManagement !== 'undefined' && NhpCliProxyManagement.LOCAL_MANAGEMENT_URL)
                ? NhpCliProxyManagement.LOCAL_MANAGEMENT_URL
                : 'http://127.0.0.1:8317/management.html#/login';
            try {
                const res = await chrome.runtime.sendMessage({
                    action: 'open_cliproxy_management',
                    url: localMgmt
                });
                if (!res?.success) throw new Error(res?.error || 'تعذر فتح لوحة الإدارة');
            } catch (_) {
                chrome.tabs.create({ url: localMgmt, active: true });
            }
            showToast('✅ تم فتح واجهة CLIProxyAPI المحلية (8317)');
        });
    }

    const btnStartNonAutopilotServers = document.getElementById('btn-start-nonautopilot-servers');
    const btnStartAiImageSenderButtons = Array.from(document.querySelectorAll('#btn-start-ai-image-sender, #btn-start-ai-image-sender-top'));
    const btnStartAiImageSender = btnStartAiImageSenderButtons[0] || null;
    const btnStopNonAutopilotServers = document.getElementById('btn-stop-nonautopilot-servers');
    const nonAutopilotServersStatus = document.getElementById('nonautopilot-servers-status');
    const nonAutopilotStatusClasses = {
        slate: 'text-[11px] text-slate-400 text-center min-h-[18px]',
        cyan: 'text-[11px] text-cyan-300 text-center min-h-[18px]',
        emerald: 'text-[11px] text-emerald-300 text-center min-h-[18px]',
        rose: 'text-[11px] text-rose-300 text-center min-h-[18px]'
    };
    const setNonAutopilotServersStatus = (message, tone = 'slate') => {
        if (!nonAutopilotServersStatus) return;
        nonAutopilotServersStatus.textContent = message;
        nonAutopilotServersStatus.className = nonAutopilotStatusClasses[tone] || nonAutopilotStatusClasses.slate;
    };
    const controlNonAutopilotServers = async (command) => {
        const isStart = command === 'start';
        const button = isStart ? btnStartNonAutopilotServers : btnStopNonAutopilotServers;
        if (button) button.disabled = true;
        setNonAutopilotServersStatus(isStart ? 'جاري تشغيل سيرفرات AI...' : 'جاري إيقاف سيرفرات AI...', 'cyan');
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'control_non_autopilot_servers',
                command
            });
            if (response?.success) {
                setNonAutopilotServersStatus(isStart ? `سيرفرات AI تعمل على البورت ${response.port || 3031}` : 'تم إيقاف سيرفرات AI', isStart ? 'emerald' : 'rose');
                showToast(isStart ? '✅ تم تشغيل سيرفرات AI المنفصلة' : '🛑 تم إيقاف سيرفرات AI المنفصلة');
            } else {
                setNonAutopilotServersStatus(response?.error || 'تعذر تنفيذ الأمر', 'rose');
                showToast(`❌ ${response?.error || 'تعذر تنفيذ الأمر'}`);
            }
        } catch (error) {
            setNonAutopilotServersStatus(error?.message || 'تعذر تنفيذ الأمر', 'rose');
            showToast(`❌ ${error?.message || 'تعذر تنفيذ الأمر'}`);
        } finally {
            if (button) button.disabled = false;
        }
    };
    if (btnStartNonAutopilotServers) {
        btnStartNonAutopilotServers.addEventListener('click', () => controlNonAutopilotServers('start'));
    }
    if (btnStartAiImageSenderButtons.length) {
        btnStartAiImageSenderButtons.forEach((button) => button.addEventListener('click', async () => {
            btnStartAiImageSenderButtons.forEach((btn) => { btn.disabled = true; });
            setNonAutopilotServersStatus('جاري تشغيل AI Bridge 3031...', 'cyan');
            setAiChromeSessionStatus('جاري تشغيل Chrome 9331...', 'cyan');
            showToast('جاري تشغيل سيرفر إرسال الصور...');
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'control_ai_image_sender_stack',
                    interactive: true
                });
                if (response?.success) {
                    const bridgeAttempt = response.bridge3031?.attempt ? ` · محاولة ${response.bridge3031.attempt}` : '';
                    const chromeAttempt = response.chrome9331?.attempt ? ` · محاولة ${response.chrome9331.attempt}` : '';
                    setNonAutopilotServersStatus(`AI Bridge 3031 جاهز${bridgeAttempt}`, 'emerald');
                    setAiChromeSessionStatus(`Chrome 9331 جاهز${chromeAttempt}`, 'emerald');
                    showToast('✅ سيرفر إرسال الصور جاهز');
                    return;
                }
                const errorText = response?.error || 'تعذر تشغيل سيرفر إرسال الصور';
                setNonAutopilotServersStatus(response?.bridge3031?.online ? 'AI Bridge 3031 جاهز' : errorText, response?.bridge3031?.online ? 'emerald' : 'rose');
                setAiChromeSessionStatus(response?.chrome9331?.online ? 'Chrome 9331 جاهز' : errorText, response?.chrome9331?.online ? 'emerald' : 'rose');
                showToast(`❌ ${errorText}`);
            } catch (error) {
                const errorText = error?.message || 'تعذر تشغيل سيرفر إرسال الصور';
                setNonAutopilotServersStatus(errorText, 'rose');
                setAiChromeSessionStatus(errorText, 'rose');
                showToast(`❌ ${errorText}`);
            } finally {
                btnStartAiImageSenderButtons.forEach((btn) => { btn.disabled = false; });
            }
        }));
    }
    if (btnStopNonAutopilotServers) {
        btnStopNonAutopilotServers.addEventListener('click', () => controlNonAutopilotServers('stop'));
    }

    const nhpLocalServersList = document.getElementById('nhp-local-servers-list');
    const nhpLocalServersStatus = document.getElementById('nhp-local-servers-status');
    const nhpNativeHostBanner = document.getElementById('nhp-native-host-banner');
    const nhpNativeHostBannerTitle = document.getElementById('nhp-native-host-banner-title');
    const nhpNativeHostBannerBody = document.getElementById('nhp-native-host-banner-body');
    const btnNhpCopyRegisterCmd = document.getElementById('btn-nhp-copy-register-cmd');
    const btnNhpVerifyNativeHost = document.getElementById('btn-nhp-verify-native-host');
    const btnNhpServersStartAll = document.getElementById('btn-nhp-servers-start-all');
    const btnNhpServersRestartAll = document.getElementById('btn-nhp-servers-restart-all');
    const btnNhpServersStopAll = document.getElementById('btn-nhp-servers-stop-all');
    let nhpNativeHostSnapshot = null;
    let nhpNativeHostOk = false;

    const nhpServerControlButtons = () => [
        btnNhpServersStartAll,
        btnNhpServersRestartAll,
        btnNhpServersStopAll
    ].filter(Boolean);

    const setNhpServerControlsEnabled = (enabled) => {
        nhpNativeHostOk = enabled === true;
        nhpServerControlButtons().forEach((btn) => {
            btn.disabled = !nhpNativeHostOk;
            btn.classList.toggle('opacity-40', !nhpNativeHostOk);
            btn.classList.toggle('pointer-events-none', !nhpNativeHostOk);
        });
        if (nhpLocalServersList) {
            nhpLocalServersList.querySelectorAll('.nhp-server-start, .nhp-server-stop, .nhp-server-restart, .nhp-server-terminal').forEach((btn) => {
                btn.disabled = !nhpNativeHostOk;
                btn.classList.toggle('opacity-40', !nhpNativeHostOk);
                btn.classList.toggle('pointer-events-none', !nhpNativeHostOk);
            });
        }
    };

    const nativeHostBannerTitleFor = (snapshot) => {
        const kind = snapshot?.nativeHost?.errorKind;
        if (kind === 'forbidden') {
            return 'Native Messaging مرفوض — معرّف الإضافة لا يطابق';
        }
        if (kind === 'host_outdated') {
            return 'Native Messaging مسجّل — أعد تشغيل سكربت التسجيل ثم أعد تحميل الإضافة';
        }
        if (kind === 'permission_missing') {
            return 'Native Messaging — صلاحية الإضافة ناقصة';
        }
        if (kind === 'host_error') {
            return 'Native Messaging — خطأ في الاتصال بالمضيف';
        }
        return 'Native Messaging غير مسجّل — أزرار التشغيل لن تعمل';
    };

    const renderNhpNativeHostBanner = (snapshot) => {
        nhpNativeHostSnapshot = snapshot || null;
        if (!nhpNativeHostBanner) return;
        const ok = snapshot?.nativeHost?.ok === true;
        setNhpServerControlsEnabled(ok);
        if (ok) {
            nhpNativeHostBanner.style.display = 'none';
            return;
        }
        nhpNativeHostBanner.style.display = 'block';
        nhpNativeHostBanner.className = 'ac-native-banner';
        if (nhpNativeHostBannerTitle) {
            nhpNativeHostBannerTitle.textContent = nativeHostBannerTitleFor(snapshot);
        }
        const registerScript = snapshot?.registerScript || 'addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.cmd';
        const registerCommand = snapshot?.registerCommand || `addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.cmd ${snapshot?.extensionId || ''}`.trim();
        const bridgeNote = snapshot?.localBridgeOnline
            ? 'جسر 3009 متصل (اختياري).'
            : 'جسر 3009 غير مشغّل (اختياري — Native Messaging هو الطريقة الأساسية).';
        const reloadNote = snapshot?.nativeHost?.errorKind === 'not_registered'
            ? 'بعد التسجيل الناجح: أعد تحميل الإضافة من chrome://extensions ثم اضغط زر التحقق.'
            : '';
        const bodyText =
            `${snapshot?.nativeHost?.error || 'شغّل سكربت التسجيل مرة واحدة ثم أعد تحميل الإضافة.'}\n` +
            `${reloadNote ? `${reloadNote}\n` : ''}` +
            `المسار:\n${registerScript}\n` +
            `الأمر:\n${registerCommand}\n` +
            bridgeNote;
        if (nhpNativeHostBannerBody) nhpNativeHostBannerBody.textContent = bodyText;
    };

    const refreshNhpNativeHostBanner = async (forceRefresh = false) => {
        try {
            const snapshot = await chrome.runtime.sendMessage({
                action: 'get_nhp_native_host_status',
                forceRefresh
            });
            if (snapshot?.success) renderNhpNativeHostBanner(snapshot);
        } catch (_) { /* ignore */ }
    };

    btnNhpCopyRegisterCmd?.addEventListener('click', async () => {
        const cmd = nhpNativeHostSnapshot?.registerCommand
            || `addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.cmd ${nhpNativeHostSnapshot?.extensionId || ''}`.trim();
        try {
            await navigator.clipboard.writeText(cmd);
            showToast('📋 تم نسخ أمر تسجيل Native Messaging');
        } catch (_) {
            showToast('❌ تعذر النسخ — انسخ المسار من البانر يدوياً');
        }
    });

    btnNhpVerifyNativeHost?.addEventListener('click', async () => {
        if (btnNhpVerifyNativeHost) btnNhpVerifyNativeHost.disabled = true;
        setNhpLocalServersStatus('جاري فحص Native Messaging...', 'cyan');
        try {
            const response = await chrome.runtime.sendMessage({ action: 'verify_nhp_native_host' });
            if (response?.success) {
                showToast('✅ Native Messaging مسجّل ويعمل');
                await refreshNhpNativeHostBanner();
            } else {
                showToast(`❌ ${response?.nativeHost?.error || response?.error || 'Native Messaging غير متاح'}`);
                await refreshNhpNativeHostBanner();
            }
        } catch (error) {
            showToast(`❌ ${error?.message || 'فشل فحص Native Messaging'}`);
        } finally {
            if (btnNhpVerifyNativeHost) btnNhpVerifyNativeHost.disabled = false;
            await refreshNhpLocalServersPanel();
        }
    });

    const setNhpLocalServersStatus = (message, tone = 'slate') => {
        if (!nhpLocalServersStatus) return;
        nhpLocalServersStatus.textContent = message;
        const toneClass = {
            slate: 'text-[0.625rem] text-slate-400 text-center min-h-[1rem] leading-snug mt-1',
            cyan: 'text-[0.625rem] text-cyan-300 text-center min-h-[1rem] leading-snug mt-1',
            emerald: 'text-[0.625rem] text-emerald-300 text-center min-h-[1rem] leading-snug mt-1',
            rose: 'text-[0.625rem] text-rose-300 text-center min-h-[1rem] leading-snug mt-1'
        };
        nhpLocalServersStatus.className = toneClass[tone] || toneClass.slate;
    };

    const renderNhpLocalServersList = (servers = []) => {
        if (!nhpLocalServersList) return;
        nhpLocalServersList.innerHTML = '';
        servers.forEach((server) => {
            const row = document.createElement('tr');
            row.dataset.serverId = server.id;
            const statusBadge = nhpLocalServerStatusBadge(server);
            row.innerHTML = `
                <td data-label="${adminEscapeHtml(adminI18n('colService'))}">${adminEscapeHtml(server.label || server.id)}</td>
                <td data-label="${adminEscapeHtml(adminI18n('colPort'))}">${adminEscapeHtml(String(server.port || '—'))}</td>
                <td data-label="${adminEscapeHtml(adminI18n('colStatus'))}">${statusBadge}</td>
                <td data-label="${adminEscapeHtml(adminI18n('colActions'))}">
                    <div class="ac-menu-wrap">
                        <button type="button" class="ac-btn ac-btn-sm ac-menu-btn ac-service-menu-trigger"><i class="fa-solid fa-ellipsis"></i></button>
                        <div class="ac-menu-panel">
                            <button type="button" class="nhp-server-start" data-server-id="${adminEscapeHtml(server.id)}"><i class="fa-solid fa-play"></i> ${adminEscapeHtml(adminI18n('menuStart'))}</button>
                            <button type="button" class="nhp-server-stop" data-server-id="${adminEscapeHtml(server.id)}"><i class="fa-solid fa-stop"></i> ${adminEscapeHtml(adminI18n('menuStop'))}</button>
                            <button type="button" class="nhp-server-restart" data-server-id="${adminEscapeHtml(server.id)}"><i class="fa-solid fa-rotate"></i> ${adminEscapeHtml(adminI18n('menuRestart'))}</button>
                            <button type="button" class="nhp-server-terminal" data-server-id="${adminEscapeHtml(server.id)}"><i class="fa-solid fa-terminal"></i> ${adminEscapeHtml(adminI18n('menuTerminal'))}</button>
                            <button type="button" class="nhp-server-disable" data-server-id="${adminEscapeHtml(server.id)}"><i class="fa-solid fa-ban"></i> ${adminEscapeHtml(adminI18n('menuToggle'))}</button>
                        </div>
                    </div>
                </td>`;
            nhpLocalServersList.appendChild(row);
        });
        nhpLocalServersList.querySelectorAll('.ac-service-menu-trigger').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wrap = btn.closest('.ac-menu-wrap');
                const wasOpen = wrap?.classList.contains('is-open');
                closeAdminServiceMenus();
                if (wrap && !wasOpen) wrap.classList.add('is-open');
            });
        });
        setNhpServerControlsEnabled(nhpNativeHostOk);
        nhpLocalServersList.querySelectorAll('.nhp-server-restart').forEach((btn) => {
            btn.addEventListener('click', () => { closeAdminServiceMenus(); controlNhpLocalServer(btn.dataset.serverId, 'restart'); });
        });
        nhpLocalServersList.querySelectorAll('.nhp-server-stop').forEach((btn) => {
            btn.addEventListener('click', () => { closeAdminServiceMenus(); controlNhpLocalServer(btn.dataset.serverId, 'stop'); });
        });
        nhpLocalServersList.querySelectorAll('.nhp-server-start').forEach((btn) => {
            btn.addEventListener('click', () => { closeAdminServiceMenus(); controlNhpLocalServer(btn.dataset.serverId, 'start'); });
        });
        nhpLocalServersList.querySelectorAll('.nhp-server-terminal').forEach((btn) => {
            btn.addEventListener('click', () => { closeAdminServiceMenus(); controlNhpLocalServer(btn.dataset.serverId, 'terminal'); });
        });
        nhpLocalServersList.querySelectorAll('.nhp-server-disable').forEach((btn) => {
            btn.addEventListener('click', () => { closeAdminServiceMenus(); toggleNhpLocalServerDisabled(btn.dataset.serverId); });
        });
        filterAdminServicesTable();
    };

    const refreshNhpLocalServersPanel = async () => {
        try {
            const snapshot = await chrome.runtime.sendMessage({ action: 'get_nhp_local_servers_status' });
            if (!snapshot?.success) {
                setNhpLocalServersStatus(snapshot?.error || 'تعذر قراءة حالة السيرفرات', 'rose');
                return;
            }
            adminLastServersSnapshot = snapshot;
            renderNhpLocalServersList(snapshot.servers || []);
            setNhpLocalServersStatus(
                formatNhpLocalServersStatusMessage(snapshot.servers || []),
                nhpLocalServersStatusTone(snapshot.servers || [])
            );
            renderAdminOverviewStatus();
            updateAdminKpiCards();
        } catch (error) {
            setNhpLocalServersStatus(error?.message || 'تعذر قراءة حالة السيرفرات', 'rose');
        }
    };

    const controlNhpLocalServer = async (serverId, command) => {
        setNhpLocalServersStatus(`جاري ${command} — ${serverId}...`, 'cyan');
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'control_nhp_local_server',
                serverId,
                command,
                interactive: true
            });
            if (!response?.success && response?.error) {
                const errText = response.nativeHostRequired
                    ? (response.error || 'Native Messaging غير مسجّل')
                    : response.error;
                setNhpLocalServersStatus(errText, 'rose');
                showToast(response.nativeHostRequired
                    ? `⚠️ ${errText}\n${response.registerScript || ''}`
                    : `❌ ${errText}`);
                if (response.nativeHostRequired) await refreshNhpNativeHostBanner();
            } else if (command === 'terminal') {
                showToast(response?.success ? `🖥️ ${serverId}: terminal` : `⚠️ ${serverId}: terminal`);
            } else if (response?.reEnabled) {
                showToast(response?.online
                    ? `✅ تم تفعيل ${serverId} وتشغيله`
                    : `⚠️ تم تفعيل ${serverId} — ${command} (تحقق من الحالة)`);
            } else {
                showToast(response?.online ? `✅ ${serverId} جاهز` : `⚠️ ${serverId}: ${command}`);
            }
        } catch (error) {
            setNhpLocalServersStatus(error?.message || 'فشل التحكم بالسيرفر', 'rose');
        } finally {
            await refreshNhpLocalServersPanel();
        }
    };

    const toggleNhpLocalServerDisabled = async (serverId) => {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'control_nhp_local_server',
                serverId,
                toggleDisabled: true
            });
            showToast(response?.disabled ? `تم تعطيل ${serverId}` : `تم تفعيل ${serverId}`);
        } catch (error) {
            showToast(`❌ ${error?.message || 'تعذر تغيير حالة التعطيل'}`);
        } finally {
            await refreshNhpLocalServersPanel();
        }
    };

    const controlNhpLocalServersBulk = async (command) => {
        setNhpLocalServersStatus(command === 'stop' ? 'جاري إيقاف جميع السيرفرات...' : 'جاري تشغيل جميع السيرفرات...', 'cyan');
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'control_nhp_local_servers_bulk',
                command
            });
            if (!response?.success) {
                setNhpLocalServersStatus(response?.error || 'فشل الأمر الجماعي', 'rose');
                showToast(`❌ ${response?.error || 'فشل الأمر الجماعي'}`);
                return;
            }
            showToast(command === 'stop' ? '🛑 تم إيقاف السيرفرات' : '✅ تم تشغيل السيرفرات');
            renderNhpLocalServersList(response.servers || []);
            setNhpLocalServersStatus(
                formatNhpLocalServersStatusMessage(response.servers || []),
                nhpLocalServersStatusTone(response.servers || [])
            );
        } catch (error) {
            setNhpLocalServersStatus(error?.message || 'فشل الأمر الجماعي', 'rose');
        }
    };

    btnNhpServersStartAll?.addEventListener('click', () => controlNhpLocalServersBulk('start'));
    btnNhpServersRestartAll?.addEventListener('click', () => controlNhpLocalServersBulk('restart'));
    btnNhpServersStopAll?.addEventListener('click', () => controlNhpLocalServersBulk('stop'));
    if (nhpLocalServersList) {
        setNhpServerControlsEnabled(false);
        refreshNhpNativeHostBanner(true);
        refreshNhpLocalServersPanel();
        setInterval(() => {
            refreshNhpNativeHostBanner().catch(() => {});
            refreshNhpLocalServersPanel().catch(() => {});
        }, 20000);
    }

    const btnDownloadStartupBat = document.getElementById('btn-download-startup-bat');
    const btnDownloadStartupSh = document.getElementById('btn-download-startup-sh');

    const downloadNhpStartupScript = async (format) => {
        const ext = format === 'sh' ? 'sh' : 'bat';
        const btn = ext === 'sh' ? btnDownloadStartupSh : btnDownloadStartupBat;
        if (btn) btn.disabled = true;
        try {
            const result = await chrome.runtime.sendMessage({ action: 'download_startup_script', format: ext });
            if (!result?.success) {
                throw new Error(result?.error || 'تعذر تنزيل السكربت');
            }
            const label = (ext === 'cmd' || ext === 'bat') ? 'NHP_Start_All_Servers.cmd' : 'NHP_Start_All_Servers.sh';
            if (result.source === 'bridge') {
                showToast(`✅ تم تنزيل ${label} — إن ظهر «téléchargement» غيّر الاسم إلى .bat وفعّل Débloquer`);
            } else {
                showToast(`✅ تم تنزيل ${label} — أو شغّل الملف من مجلد المشروع مباشرة`);
            }
        } catch (error) {
            showToast(`❌ ${error?.message || 'تعذر تنزيل السكربت. أعد تحميل الإضافة من chrome://extensions ثم حاول مجدداً.'}`);
        } finally {
            if (btn) btn.disabled = false;
        }
    };
    if (btnDownloadStartupBat) {
        btnDownloadStartupBat.addEventListener('click', () => downloadNhpStartupScript('bat'));
    }
    if (btnDownloadStartupSh) {
        btnDownloadStartupSh.addEventListener('click', () => downloadNhpStartupScript('sh'));
    }

    const btnStartAiChromeSession = document.getElementById('btn-start-ai-chrome-session');
    const btnRestartAiChromeSession = document.getElementById('btn-restart-ai-chrome-session');
    const btnRepairLocalServices = document.getElementById('btn-repair-local-services');
    const aiChromeSessionStatus = document.getElementById('ai-chrome-session-status');
    const setAiChromeSessionStatus = (message, tone = 'slate') => {
        if (!aiChromeSessionStatus) return;
        aiChromeSessionStatus.textContent = message;
        aiChromeSessionStatus.className = nonAutopilotStatusClasses[tone] || nonAutopilotStatusClasses.slate;
    };
    const controlAiChromeSession = async (command) => {
        const isRestart = command === 'restart';
        const button = isRestart ? btnRestartAiChromeSession : btnStartAiChromeSession;
        if (button) button.disabled = true;
        setAiChromeSessionStatus(isRestart ? 'جاري إعادة تشغيل Chrome الرئيسي بوضع AI...' : 'جاري فتح Chrome الرئيسي بوضع AI...', 'cyan');
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'control_ai_chrome_session',
                command
            });
            if (response?.success) {
                setAiChromeSessionStatus(response.online ? 'Chrome الرئيسي جاهز على البورت 9331' : 'Chrome مفتوح مسبقاً؛ استخدم إعادة تشغيل Chrome الرئيسي', response.online ? 'emerald' : 'amber');
                showToast(response.online ? '✅ Chrome الرئيسي جاهز لـ AI' : '⚠️ إذا كان Chrome مفتوحاً مسبقاً اضغط إعادة تشغيل Chrome الرئيسي');
            } else {
                setAiChromeSessionStatus(response?.error || 'تعذر تشغيل جلسة Chrome AI', 'rose');
                showToast(`❌ ${response?.error || 'تعذر تشغيل جلسة Chrome AI'}`);
            }
        } catch (error) {
            setAiChromeSessionStatus(error?.message || 'تعذر تشغيل جلسة Chrome AI', 'rose');
            showToast(`❌ ${error?.message || 'تعذر تشغيل جلسة Chrome AI'}`);
        } finally {
            if (button) button.disabled = false;
        }
    };
    if (btnStartAiChromeSession) {
        btnStartAiChromeSession.addEventListener('click', () => controlAiChromeSession('start'));
    }
    if (btnRestartAiChromeSession) {
        btnRestartAiChromeSession.addEventListener('click', () => controlAiChromeSession('restart'));
    }
    if (btnRepairLocalServices) {
        btnRepairLocalServices.addEventListener('click', async () => {
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const diag = (level, text, extra = null) => {
                const suffix = extra ? ` | ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : '';
                addUiDiagnosticLog(level, `[RepairLocalServices] ${text}${suffix}`);
            };
            const pingJson = async (url, attempts = 10, delayMs = 1000) => {
                let lastError = null;
                for (let i = 0; i < attempts; i += 1) {
                    try {
                        const response = await fetch(url, { method: 'GET' });
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        const text = await response.text().catch(() => '');
                        diag('info', `Ping success ${url}`, { attempt: i + 1, text: String(text).slice(0, 120) });
                        return { ok: true, text };
                    } catch (error) {
                        lastError = error;
                        diag('warn', `Ping retry ${url}`, { attempt: i + 1, error: error?.message || 'unknown' });
                        await sleep(delayMs);
                    }
                }
                diag('error', `Ping failed ${url}`, { error: lastError?.message || 'offline' });
                return { ok: false, error: lastError?.message || 'offline' };
            };

            btnRepairLocalServices.disabled = true;
            setNonAutopilotServersStatus('بدء إصلاح الخدمات المحلية...', 'cyan');
            setAiChromeSessionStatus('بدء إصلاح 9331...', 'cyan');
            showToast('🛠️ جاري إصلاح خدمات 3031/9331...');
            diag('info', 'Repair flow started');

            try {
                const stop3031 = await chrome.runtime.sendMessage({ action: 'control_non_autopilot_servers', command: 'stop', interactive: true }).catch((e) => ({ success: false, error: e?.message || 'stop failed' }));
                diag(stop3031?.success ? 'info' : 'warn', 'Stop 3031 request', stop3031);
                await sleep(900);

                const start3031 = await chrome.runtime.sendMessage({ action: 'control_non_autopilot_servers', command: 'start', interactive: true }).catch((e) => ({ success: false, error: e?.message || 'start failed' }));
                diag(start3031?.success ? 'info' : 'error', 'Start 3031 request', start3031);
                if (!start3031?.success) {
                    setNonAutopilotServersStatus(`تعذر تشغيل 3031: ${start3031?.error || 'unknown'}`, 'rose');
                }
                const bridgePing = await pingJson(await nhpAdminLocalUrl(3031, '/ping'), 16, 1000);
                if (bridgePing.ok) {
                    setNonAutopilotServersStatus('✅ AI Bridge 3031 جاهز', 'emerald');
                } else {
                    setNonAutopilotServersStatus(`⚠️ 3031 غير جاهز: ${bridgePing.error}`, 'rose');
                }

                const restartChrome = await chrome.runtime.sendMessage({ action: 'control_ai_chrome_session', command: 'restart', interactive: true }).catch((e) => ({ success: false, error: e?.message || 'restart failed' }));
                diag(restartChrome?.success ? 'info' : 'error', 'Restart 9331 request', restartChrome);
                if (!restartChrome?.success) {
                    setAiChromeSessionStatus(`تعذر إعادة تشغيل 9331: ${restartChrome?.error || 'unknown'}`, 'rose');
                }
                const chromePing = await pingJson(await nhpAdminLocalUrl(9331, '/json/version'), 18, 1000);
                if (chromePing.ok) {
                    setAiChromeSessionStatus('✅ AI Chrome 9331 جاهز', 'emerald');
                } else {
                    setAiChromeSessionStatus(`⚠️ 9331 غير جاهز: ${chromePing.error}`, 'rose');
                }

                if (bridgePing.ok && chromePing.ok) {
                    diag('info', 'Repair flow finished: success');
                    showToast('✅ اكتمل إصلاح الخدمات: 3031 و 9331 جاهزان');
                } else {
                    diag('warn', 'Repair flow finished: partial', { bridgeOk: bridgePing.ok, chromeOk: chromePing.ok });
                    showToast('⚠️ اكتمل الإصلاح جزئياً. راجع الحالة أسفل الأزرار.');
                }
            } catch (error) {
                diag('error', 'Repair flow crashed', { error: error?.message || 'unknown' });
                setNonAutopilotServersStatus(error?.message || 'خطأ غير متوقع', 'rose');
                setAiChromeSessionStatus(error?.message || 'خطأ غير متوقع', 'rose');
                showToast(`❌ فشل الإصلاح: ${error?.message || 'unknown'}`);
            } finally {
                diag('info', 'Repair flow ended');
                btnRepairLocalServices.disabled = false;
            }
        });
    }

    const btnLaunchScreenToolkit = document.getElementById('btn-launch-screen-toolkit');
    if (btnLaunchScreenToolkit) {
        btnLaunchScreenToolkit.addEventListener('click', () => {
            chrome.windows.create({
                url: chrome.runtime.getURL('screeeeenvme/popup.html'),
                type: 'popup',
                width: 430,
                height: 860,
                focused: false
            });
            showToast('📸 جاري فتح لوحة الشاشة المحلية...');
        });
    }

    const btnLaunchScreenAnnotator = document.getElementById('btn-launch-screen-annotator');
    if (btnLaunchScreenAnnotator) {
        btnLaunchScreenAnnotator.addEventListener('click', async () => {
            try {
                const response = await chrome.runtime.sendMessage({ action: 'open-annotator' });
                if (response?.ok) {
                    showToast('🖊️ تم فتح محرر الرسم المحلي');
                } else {
                    showToast(`❌ ${response?.error || 'تعذر فتح محرر الرسم المحلي'}`);
                }
            } catch (error) {
                console.error('Screen Annotator Launch Error:', error);
                showToast('❌ تعذر فتح محرر الرسم المحلي');
            }
        });
    }

    // --- Workspace Listeners ---
    const btnSelectWorkspace = document.getElementById('btn-select-workspace');
    if (btnSelectWorkspace) {
        btnSelectWorkspace.addEventListener('click', async () => {
            try {
                workspaceHandle = await window.showDirectoryPicker();
                window.NHP_WorkspaceHandle = workspaceHandle;
                await IDB.set('root', workspaceHandle);
                updateWorkspaceUI(true, workspaceHandle.name);
                refreshLocalLibrary();
                showToast('✅ تم ربط المجلد المحلي بنجاح!');
            } catch (e) {
                if (e.name !== 'AbortError') showToast('❌ فشل اختيار المجلد');
            }
        });
    }

    const btnLocalExport = document.getElementById('btn-local-export');
    if (btnLocalExport) {
        btnLocalExport.addEventListener('click', async () => {
            chrome.storage.local.get(null, async (allData) => {
                let archiveBundle = null;
                try {
                    const { exportArchiveBundle } = await import('../niche-archive.js');
                    const archiveResponse = await exportArchiveBundle();
                    archiveBundle = archiveResponse.bundle || null;
                } catch (error) {
                    console.warn('Archive export bundle fallback:', error);
                }

                const backupData = {
                    savedDesignQueue: allData.savedDesignQueue || [],
                    ap_accounts: allData.ap_accounts || [],
                    teepublic_manager_data: allData.teepublic_manager_data || { niches: [], doneHistory: [], history: [] },
                    usptoHistory: allData.usptoHistory || {},
                    tpHistory: allData.tpHistory || {},
                    tmhHistory: allData.tmhHistory || {},
                    nicheArchiveBundle: archiveBundle,
                    timestamp: new Date().toISOString(),
                    version: "12.0-Pro"
                };

                const jsonStr = JSON.stringify(backupData, null, 2);

                if (workspaceHandle) {
                    try {
                        const fileHandle = await workspaceHandle.getFileHandle('nhp_backup.json', { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(jsonStr);
                        await writable.close();
                        showToast('💾 تم حفظ النسخة في المجلد المحلي بنجاح!');
                        return;
                    } catch (e) { console.error('Local File Save Failed:', e); }
                }

                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `NHP_Local_Export_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                showToast('📥 تم التصدير عبر المتصفح (المجلد المحلي غير مفعل)');
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            });
        });
    }

    const btnLocalImport = document.getElementById('btn-local-import');
    if (btnLocalImport) {
        btnLocalImport.addEventListener('click', async () => {
            if (workspaceHandle) {
                try {
                    const fileHandle = await workspaceHandle.getFileHandle('nhp_backup.json');
                    const file = await fileHandle.getFile();
                    const text = await file.text();
                    processImportedData(text);
                    return;
                } catch (e) {
                    console.log('No nhp_backup.json in workspace, falling back to file picker');
                }
            }

            const [fileHandle] = await window.showOpenFilePicker({
                types: [{ description: 'NHP Backup', accept: { 'application/json': ['.json'] } }]
            });
            const file = await fileHandle.getFile();
            const text = await file.text();
            processImportedData(text);
        });
    }

    function processImportedData(jsonText) {
        try {
            const data = JSON.parse(jsonText);
            if (!data.savedDesignQueue && !data.ap_accounts && !data.nicheArchiveBundle) throw new Error('بيانات غير صالحة');

            if (confirm('سيتم دمج البيانات المكتشفة مع مكتبتك الحالية. هل أنت متأكد؟')) {
                chrome.storage.local.get(['savedDesignQueue', 'ap_accounts', 'teepublic_manager_data', 'usptoHistory', 'tpHistory', 'tmhHistory'], async (res) => {
                    const currentQueue = res.savedDesignQueue || [];
                    const currentAccs = res.ap_accounts || [];
                    const currentNotes = res.teepublic_manager_data || { niches: [], doneHistory: [], history: [] };

                    const newQueue = [...currentQueue];
                    if (data.savedDesignQueue) {
                        data.savedDesignQueue.forEach(item => {
                            if (!newQueue.some(i => i.id === item.id)) newQueue.push(item);
                        });
                    }

                    const newAccs = [...currentAccs];
                    if (data.ap_accounts) {
                        data.ap_accounts.forEach(acc => {
                            if (!newAccs.some(a => a.email === acc.email)) newAccs.push(acc);
                        });
                    }

                    const mergedNotes = {
                        niches: [...(currentNotes.niches || [])],
                        doneHistory: [...(currentNotes.doneHistory || [])],
                        history: [...(currentNotes.history || [])]
                    };

                    if (data.teepublic_manager_data?.niches) {
                        data.teepublic_manager_data.niches.forEach(item => {
                            if (!mergedNotes.niches.some(existing => existing.text?.toLowerCase() === item.text?.toLowerCase())) {
                                mergedNotes.niches.push(item);
                            }
                        });
                    }
                    if (data.teepublic_manager_data?.doneHistory) {
                        mergedNotes.doneHistory = [...new Set([...(mergedNotes.doneHistory || []), ...data.teepublic_manager_data.doneHistory])];
                    }
                    if (data.teepublic_manager_data?.history) {
                        mergedNotes.history.push(...data.teepublic_manager_data.history);
                    }

                    const mergedUsptoHistory = { ...(res.usptoHistory || {}), ...(data.usptoHistory || {}) };
                    const mergedTpHistory = { ...(res.tpHistory || {}), ...(data.tpHistory || {}) };
                    const mergedTmhHistory = { ...(res.tmhHistory || {}), ...(data.tmhHistory || {}) };

                    if (data.nicheArchiveBundle) {
                        try {
                            const { importArchiveBundle } = await import('../niche-archive.js');
                            await importArchiveBundle(data.nicheArchiveBundle, 'merge');
                        } catch (archiveError) {
                            console.error('Archive import failed:', archiveError);
                        }
                    }

                    chrome.storage.local.set({
                        savedDesignQueue: newQueue,
                        ap_accounts: newAccs,
                        teepublic_manager_data: mergedNotes,
                        usptoHistory: mergedUsptoHistory,
                        tpHistory: mergedTpHistory,
                        tmhHistory: mergedTmhHistory
                    }, () => {
                        showToast('✅ تم استيراد ودمج البيانات بنجاح!');
                        window.designQueue = newQueue;
                        window.renderQueue();
                        if (window.designQueue.length > 0) {
                            const seoContainer = document.getElementById('seo-queue-container');
                            if (seoContainer) seoContainer.classList.remove('hidden');
                            window.showDesignPreview(window.designQueue[0].id);
                        }
                    });
                });
            }
        } catch (err) {
            showToast('❌ فشل الاستيراد: ' + err.message);
        }
    }

    // --- Smart Sync Listeners ---
    const toggleSmartSync = document.getElementById('toggle-smart-sync');
    if (toggleSmartSync) {
        chrome.storage.local.get(['smartSyncEnabled'], (res) => {
            let enabled = res.smartSyncEnabled;
            if (typeof enabled === 'undefined') {
                enabled = true;
                chrome.storage.local.set({ smartSyncEnabled: true });
            }
            toggleSmartSync.checked = !!enabled;
            if (enabled) startSmartSyncPolling();
        });

        toggleSmartSync.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            chrome.storage.local.set({ smartSyncEnabled: enabled });
            if (enabled) {
                startSmartSyncPolling();
                showToast('🔄 تم تفعيل المزامنة الذكية');
            } else {
                stopSmartSyncPolling();
                showToast('⏸ تم إيقاف المزامنة الذكية');
            }
        });
    }

    function startSmartSyncPolling() {
        if (smartSyncInterval) clearInterval(smartSyncInterval);
        smartSyncPermissionDenied = false;
        smartSyncPermissionWarned = false;
        smartSyncInterval = setInterval(pollSmartSyncFile, isLowSpecModeEnabled() ? 30000 : 15000);
        pollSmartSyncFile();
    }

    function stopSmartSyncPolling() {
        if (smartSyncInterval) clearInterval(smartSyncInterval);
        smartSyncInterval = null;
    }

    async function pollSmartSyncFile() {
        if (!workspaceHandle || !toggleSmartSync?.checked || smartSyncPollInProgress || smartSyncPermissionDenied) return;
        if (!isAdminPanelActive()) return;

        try {
            smartSyncPollInProgress = true;
            const permission = await workspaceHandle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                smartSyncPermissionDenied = true;
                stopSmartSyncPolling();
                if (!smartSyncPermissionWarned) {
                    smartSyncPermissionWarned = true;
                    showToast('⚠️ تم إيقاف Smart Sync مؤقتاً لأن صلاحية المجلد غير مفعلة');
                }
                return;
            }
            const fileHandle = await workspaceHandle.getFileHandle(SYNC_FILE_NAME, { create: false });
            const file = await fileHandle.getFile();
            if (file.lastModified <= lastSmartSyncTime) return;

            const text = await file.text();
            const data = JSON.parse(text);
            if (data.sourceId === browserSessionId) {
                lastSmartSyncTime = file.lastModified;
                return;
            }

            console.log('🔄 Smart Sync: New data detected from another instance');
            mergeSmartSyncData(data);
            lastSmartSyncTime = file.lastModified;
        } catch (e) {
            if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
                smartSyncPermissionDenied = true;
                stopSmartSyncPolling();
                if (!smartSyncPermissionWarned) {
                    smartSyncPermissionWarned = true;
                    showToast('⚠️ تم إيقاف Smart Sync لأن المتصفح رفض الوصول إلى المجلد في هذا السياق');
                }
                return;
            }
            if (e.name !== 'NotFoundError') console.error('Smart Sync Poll Error:', e);
        } finally {
            smartSyncPollInProgress = false;
        }
    }

    function mergeSmartSyncData(data) {
        chrome.storage.local.get(['savedDesignQueue', 'ap_accounts', 'teepublic_manager_data'], (res) => {
            const currentQueue = res.savedDesignQueue || [];
            const currentAccs = res.ap_accounts || [];
            const currentNoteData = res.teepublic_manager_data || { niches: [], doneHistory: [], history: [] };

            let hasChanges = false;
            const newQueue = [...currentQueue];
            if (data.designs) {
                data.designs.forEach(item => {
                    if (!newQueue.some(i => i.id === item.id)) {
                        newQueue.push(item);
                        hasChanges = true;
                    }
                });
            }

            const newAccs = [...currentAccs];
            if (data.accounts) {
                data.accounts.forEach(acc => {
                    if (!newAccs.some(a => a.email === acc.email)) {
                        newAccs.push(acc);
                        hasChanges = true;
                    }
                });
            }

            const newNoteData = { ...currentNoteData };
            if (data.notes) {
                if (data.notes.niches) {
                    data.notes.niches.forEach(n => {
                        if (!newNoteData.niches.some(en => en.text.toLowerCase() === n.text.toLowerCase())) {
                            newNoteData.niches.push(n);
                            hasChanges = true;
                        }
                    });
                }
                if (data.notes.doneHistory) {
                    const mergedDone = [...new Set([...(newNoteData.doneHistory || []), ...data.notes.doneHistory])];
                    if (mergedDone.length !== (newNoteData.doneHistory || []).length) {
                        newNoteData.doneHistory = mergedDone;
                        hasChanges = true;
                    }
                }
            }

            if (hasChanges) {
                chrome.storage.local.set({
                    savedDesignQueue: newQueue,
                    ap_accounts: newAccs,
                    teepublic_manager_data: newNoteData
                }, () => {
                    window.designQueue = newQueue;
                    window.renderQueue();
                    if (typeof initNoteModule === 'function') initNoteModule();
                    showToast('✨ تم تحديث البيانات تلقائياً من المجلد المحلي');
                });
            }
        });
    }

    async function writeSmartSyncFile() {
        if (!workspaceHandle || !toggleSmartSync?.checked || smartSyncPermissionDenied) return;

        try {
            const permission = await workspaceHandle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') return;
            chrome.storage.local.get(['savedDesignQueue', 'ap_accounts', 'teepublic_manager_data'], async (res) => {
                const syncData = {
                    designs: res.savedDesignQueue || [],
                    accounts: res.ap_accounts || [],
                    notes: res.teepublic_manager_data || null,
                    sourceId: browserSessionId,
                    timestamp: new Date().toISOString()
                };

                const fileHandle = await workspaceHandle.getFileHandle(SYNC_FILE_NAME, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify(syncData, null, 2));
                await writable.close();

                const file = await fileHandle.getFile();
                lastSmartSyncTime = file.lastModified;
            });
        } catch (e) {
            if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
                smartSyncPermissionDenied = true;
                stopSmartSyncPolling();
                if (!smartSyncPermissionWarned) {
                    smartSyncPermissionWarned = true;
                    showToast('⚠️ تم إيقاف Smart Sync لأن صلاحية المجلد لم تعد متاحة');
                }
                return;
            }
            console.error('Smart Sync Write Error:', e);
        }
    }

    // --- GitHub Listeners ---
    const btnGithubExport = document.getElementById('btn-github-export');
    const btnGithubImport = document.getElementById('btn-github-import');

    if (btnGithubExport) {
        btnGithubExport.addEventListener('click', () => {
            chrome.storage.local.get(['cloudSyncEnabled'], (store) => {
                if (store.cloudSyncEnabled === false) {
                    showToast('⚠️ المزامنة معطلة من الإعدادات. يرجى تفعيلها أولاً لتتمكن من المناورة سحابياً.');
                    return;
                }
                showToast('⏳ بدأ تصدير البيانات للسحابة... يمكنك متابعة عملك');
                chrome.storage.local.get(null, (data) => {
                    if (typeof window.GitHubSync !== 'undefined') {
                        window.GitHubSync.syncData(data)
                            .then(() => showToast('✅ اكتمل التصدير السحابي بنجاح!'))
                            .catch(e => {
                                console.error('Export Error:', e);
                                showToast(`❌ فشل تصدير البيانات: ${e.message}`);
                            });
                    }
                });
            });
        });
    }

    if (btnGithubImport) {
        btnGithubImport.addEventListener('click', async () => {
            chrome.storage.local.get(['cloudSyncEnabled'], async (store) => {
                if (store.cloudSyncEnabled === false) {
                    return showToast('⚠️ المزامنة معطلة. فعّلها أولاً لتتمكن من المناورة سحابياً.');
                }
                showToast('⏳ جاري استيراد البيانات من GitHub...');
                if (typeof window.GitHubSync !== 'undefined') {
                    try {
                        const cloudData = await window.GitHubSync.getData();
                        if (cloudData) {
                            chrome.storage.local.clear(() => {
                                chrome.storage.local.set(cloudData, () => {
                                    showToast('✅ تم استيراد البيانات وتحديث الإضافة!');
                                    setTimeout(() => location.reload(), 1500);
                                });
                            });
                        } else showToast('⚠️ لا توجد بيانات محفوظة في سحابة GitHub');
                    } catch (e) { showToast('❌ فشل الاستيراد، تأكد من اتصالك'); }
                }
            });
        });
    }

    const toggleCloudSync = document.getElementById('toggle-cloud-sync');
    if (toggleCloudSync) {
        chrome.storage.local.get(['cloudSyncEnabled'], (res) => {
            toggleCloudSync.checked = res.cloudSyncEnabled !== false;
        });
        toggleCloudSync.addEventListener('change', (e) => {
            chrome.storage.local.set({ cloudSyncEnabled: e.target.checked });
            showToast(e.target.checked ? '☁️ تم تفعيل المزامنة السحابية' : '⏸ تم إيقاف المزامنة السحابية');
        });
    }

    const adminGithubTokenInput = document.getElementById('admin-github-token');
    const btnAdminSaveGithubToken = document.getElementById('btn-admin-save-github-token');
    if (adminGithubTokenInput) {
        chrome.storage.local.get(['githubToken'], (res) => {
            if (res.githubToken) adminGithubTokenInput.placeholder = '•••••• (محفوظ — اتركه فارغاً للإبقاء)';
        });
        if (typeof window.GitHubSync !== 'undefined') {
            window.GitHubSync.loadTokenFromStorage().then(() => {
                if (window.GitHubSync.hasValidToken()) {
                    adminGithubTokenInput.placeholder = '•••••• (محفوظ — اتركه فارغاً للإبقاء)';
                }
            }).catch(() => {});
        }
    }
    if (btnAdminSaveGithubToken && adminGithubTokenInput) {
        btnAdminSaveGithubToken.addEventListener('click', () => {
            const raw = adminGithubTokenInput.value.trim();
            if (!raw) {
                showToast('ℹ️ لم يُدخل توكن — اترك الحقل فارغاً أو الصق PAT جديد');
                return;
            }
            if (typeof window.GitHubSync === 'undefined') {
                showToast('❌ محرك GitHub Sync غير جاهز');
                return;
            }
            window.GitHubSync.setToken(raw);
            adminGithubTokenInput.value = '';
            adminGithubTokenInput.placeholder = '•••••• (محفوظ)';
            showToast('✅ تم حفظ توكن GitHub محلياً');
            updateAdminKpiCards();
        });
    }

    const toggleEmailCoreSearchToolsSync = document.getElementById('toggle-emailcore-search-tools-sync');
    if (toggleEmailCoreSearchToolsSync) {
        const ST_SYNC_KEY = 'nhpEmailCoreSearchToolsSyncEnabled';
        chrome.storage.local.get([ST_SYNC_KEY], (res) => {
            toggleEmailCoreSearchToolsSync.checked = res[ST_SYNC_KEY] !== false;
        });
        toggleEmailCoreSearchToolsSync.addEventListener('change', (e) => {
            const enabled = !!e.target.checked;
            chrome.storage.local.set({ [ST_SYNC_KEY]: enabled }, () => {
                showToast(enabled
                    ? '🔄 تم تفعيل مزامنة Search Tools من EmailCore (بدل الجلب القديم للترندات)'
                    : '⏸ تم إيقاف مزامنة EmailCore — الجلب القديم للترندات متاح مجدداً');
            });
        });
    }

    const toggleAutoLiteAssist = document.getElementById('toggle-auto-lite-assist');
    if (toggleAutoLiteAssist) {
        chrome.storage.local.get([AUTO_LITE_ASSIST_KEY], (res) => {
            toggleAutoLiteAssist.checked = res[AUTO_LITE_ASSIST_KEY] !== false;
        });
        toggleAutoLiteAssist.addEventListener('change', (e) => {
            const enabled = !!e.target.checked;
            chrome.storage.local.set({ [AUTO_LITE_ASSIST_KEY]: enabled }, () => {
                showToast(enabled ? '⚙️ تم تفعيل Auto Lite Assist' : '⏸ تم تعطيل Auto Lite Assist');
            });
        });
    }

    const toggleI3Ram2GbMode = document.getElementById('toggle-i3-ram-2gb-mode');
    if (toggleI3Ram2GbMode) {
        chrome.storage.local.get([FORCE_I3_MODE_KEY], (res) => {
            toggleI3Ram2GbMode.checked = res[FORCE_I3_MODE_KEY] === true;
        });
        toggleI3Ram2GbMode.addEventListener('change', (e) => {
            const enabled = !!e.target.checked;
            chrome.storage.local.set({ [FORCE_I3_MODE_KEY]: enabled }, () => {
                showToast(enabled
                    ? '🐢 تم تفعيل وضع I3 RAM 2GB (Ultra Lite)'
                    : '⚡ تم تعطيل وضع I3 RAM 2GB');
            });
        });
    }

    const togglePromptBagOverlay = document.getElementById('toggle-prompt-bag-overlay');
    if (togglePromptBagOverlay) {
        chrome.storage.local.get([PROMPT_BAG_OVERLAY_ENABLED_KEY], (res) => {
            togglePromptBagOverlay.checked = res[PROMPT_BAG_OVERLAY_ENABLED_KEY] !== false;
        });
        togglePromptBagOverlay.addEventListener('change', (e) => {
            const enabled = !!e.target.checked;
            chrome.storage.local.set({ [PROMPT_BAG_OVERLAY_ENABLED_KEY]: enabled }, () => {
                showToast(enabled
                    ? '🎒 تم تفعيل حقيبة البرومبت العائمة'
                    : '⏸ تم إخفاء حقيبة البرومبت العائمة');
            });
        });
    }

    // --- UI Mode Listeners ---
    const uiLaunchRadios = document.getElementsByName('ui-launch-mode');
    if (uiLaunchRadios.length > 0) {
        chrome.storage.local.get(['uiLaunchMode', 'nhpDefaultTabModeApplied', 'nhpTabDefaultRestoredV3'], (res) => {
            const allowedModes = new Set(['popup', 'window', 'tab']);
            const shouldForceTabDefault = !res.nhpDefaultTabModeApplied || !res.nhpTabDefaultRestoredV3;
            const mode = shouldForceTabDefault
                ? 'tab'
                : (allowedModes.has(res.uiLaunchMode) ? res.uiLaunchMode : 'tab');

            if (res.uiLaunchMode !== mode || shouldForceTabDefault) {
                chrome.storage.local.set({
                    uiLaunchMode: mode,
                    nhpDefaultTabModeApplied: true,
                    nhpTabDefaultRestoredV3: true,
                    nhpExpandedDefaultV301: true,
                    nhpExplicitPopupLaunchV301: mode === 'popup'
                });
            }

            uiLaunchRadios.forEach(radio => {
                if (radio.value === mode) radio.checked = true;
            });
        });

        uiLaunchRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const mode = e.target.value;
                chrome.storage.local.set({
                    uiLaunchMode: mode,
                    nhpExplicitPopupLaunchV301: mode === 'popup'
                }, () => {
                    const modeLabels = { 'popup': 'نافذة صغيرة', 'window': 'نافذة تطبيق كبيرة', 'tab': 'تبويب موسيّع' };
                    showToast(`✅ تم تفعيل: ${modeLabels[mode]}`);
                    
                    const targetUrl = chrome.runtime.getURL('popup.html?mode=tab');

                    if (mode === 'popup') {
                        chrome.action.setPopup({ popup: 'popup.html' });
                    } else if (mode === 'window') {
                        chrome.action.setPopup({ popup: 'launcher.html' });
                        chrome.windows.create({
                            url: targetUrl,
                            type: 'popup',
                            width: 1280,
                            height: 850,
                            focused: false
                        });
                        // Optional: close current popup after a delay
                        setTimeout(() => window.close(), 1000);
                    } else if (mode === 'tab') {
                        chrome.action.setPopup({ popup: 'launcher.html' });
                        chrome.tabs.create({ url: targetUrl });
                        window.close();
                    }
                });
            });
        });
    }

    // --- Automation Pipeline Listeners ---
    const pipelineToggles = ['pipeline-enable-analysis', 'pipeline-enable-tmhunt', 'pipeline-enable-uspto'];
    pipelineToggles.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            chrome.storage.local.get([id], (res) => {
                // Default to true if never set
                el.checked = res[id] !== false;
            });
            el.addEventListener('change', (e) => {
                const val = e.target.checked;
                chrome.storage.local.set({ [id]: val });
                const labels = {
                    'pipeline-enable-analysis': 'تحليل المنافسة',
                    'pipeline-enable-tmhunt': 'فحص TMHunt',
                    'pipeline-enable-uspto': 'فحص USPTO'
                };
                showToast(`${val ? '✅ تفعيل' : '⏸ تعطيل'} ${labels[id]} في التحليل الشامل`);
            });
        }
    });

    // --- Global extension UI theme (synced) ---
    const btnNeonTheme = document.getElementById('btn-toggle-neon-gamer-theme');
    function refreshNeonThemeButtonLabel() {
        if (!btnNeonTheme) return;
        chrome.storage.sync.get(['theme'], (res) => {
            const on = res.theme === 'neon-gamer';
            btnNeonTheme.setAttribute('aria-pressed', on ? 'true' : 'false');
            btnNeonTheme.textContent = on
                ? 'إيقاف واجهة النيون (عودة للافتراضي)'
                : 'واجهة نيون (لاعب)';
        });
    }
    if (btnNeonTheme) {
        refreshNeonThemeButtonLabel();
        btnNeonTheme.addEventListener('click', () => {
            chrome.storage.sync.get(['theme'], (res) => {
                const next = res.theme === 'neon-gamer' ? 'default' : 'neon-gamer';
                if (window.NHP_EXTENSION_THEME && typeof window.NHP_EXTENSION_THEME.persist === 'function') {
                    window.NHP_EXTENSION_THEME.persist(next, () => {
                        refreshNeonThemeButtonLabel();
                        showToast(next === 'neon-gamer'
                            ? '🎮 تم تفعيل واجهة النيون على كل الإضافة'
                            : '✅ تم العودة للمظهر الافتراضي');
                    });
                } else {
                    try {
                        localStorage.setItem('nhp_extension_theme_v1', next === 'neon-gamer' ? 'neon-gamer' : 'default');
                    } catch (_) {}
                    chrome.storage.sync.set({ theme: next }, () => {
                        if (next === 'neon-gamer') {
                            document.documentElement.setAttribute('data-theme', 'neon-gamer');
                        } else {
                            document.documentElement.removeAttribute('data-theme');
                        }
                        refreshNeonThemeButtonLabel();
                        showToast(next === 'neon-gamer'
                            ? '🎮 تم تفعيل واجهة النيون على كل الإضافة'
                            : '✅ تم العودة للمظهر الافتراضي');
                    });
                }
            });
        });
    }

    const btnAddToLocalLib = document.getElementById('btn-add-to-local-lib');
    if (btnAddToLocalLib) {
        btnAddToLocalLib.addEventListener('click', async () => {
            if (!workspaceHandle) return showToast('⚠️ يرجى تفعيل المجلد المحلي أولاً');
            if (!window.designQueue || window.designQueue.length === 0) return showToast('⚠️ طابور التصاميم فارغ');

            showToast('⏳ جاري إضافة التصاميم للمجلد المحلي...');
            let addedCount = 0;
            try {
                for (const design of window.designQueue) {
                    const byteCharacters = atob(design.base64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'image/png' });

                    const fileName = design.file.name || `design_${Date.now()}.png`;
                    const fileHandle = await workspaceHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    addedCount++;
                }
                showToast(`✅ تم إضافة ${addedCount} تصميماً للمجلد بنجاح`);
                refreshLocalLibrary();
            } catch (err) { showToast('❌ حدث خطأ أثناء الحفظ المحلي: ' + err.message); }
        });
    }

    const btnUploadToLib = document.getElementById('btn-upload-to-lib');
    const libFileInput = document.getElementById('lib-file-input');
    if (btnUploadToLib && libFileInput) {
        btnUploadToLib.addEventListener('click', () => libFileInput.click());
        libFileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            if (typeof window.GitHubSync === 'undefined') return showToast('❌ محرك المزامنة غير جاهز');

            showToast(`⏳ جاري رفع ${files.length} تصميم للسحابة...`);

            for (const file of files) {
                (async () => {
                    try {
                        const reader = new FileReader();
                        const base64 = await new Promise(r => {
                            reader.onload = () => r(reader.result.split(',')[1]);
                            reader.readAsDataURL(file);
                        });
                        await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
                        const res = await window.GitHubSync.uploadImage(base64, file.name);
                        if (res && res.success) {
                            showToast(`✅ تم رفع: ${file.name}`);
                        } else {
                            showToast(`❌ فشل رفع: ${file.name}`);
                        }
                    } catch (err) {
                        showToast(`❌ فشل رفع: ${file.name}`);
                    }
                })();
            }
            libFileInput.value = '';
        });
    }

    // Unified sync is centralized in popup.js (NHP_scheduleUnifiedSync) to avoid duplicate work.
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && typeof window.NHP_scheduleUnifiedSync === 'function') {
            window.NHP_scheduleUnifiedSync(changes);
        }
    });

    // Initializations
    initWorkspace(helpers);
    updateAuthUI();
}
