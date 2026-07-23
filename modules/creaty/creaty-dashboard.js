/** CREATY supervision dashboard — data merge, render, actions */

import { fetchEmailCoreAccountRemote, hasEmailCoreCredentials, isEmailCoreManagedEmail } from './emailcore-library.js';

export const CREATY_PORT = 3020;
export const CREATY_SCHEDULE_PREFIX = 'creaty_artisan_schedule_';
export const CREATY_POLL_MS = 12000;

/** Filter pill keys — matches creaty.html data-filter values */
export const STAGE_KEYS = ['pending', 'artisan', 'apprentice', 'design', 'active', 'done'];

/** Manual account stages — المرحلة dropdown (matches creaty.js phaseHint) */
export const ACCOUNT_SIGNUP_PHASES = [
    'PENDING',
    'ARTISAN',
    'APPRENTICE',
    'DESIGN 1',
    'DESIGN 2',
    'DESIGN 3',
    'DESIGN 4',
    'DESIGN 5',
    'ACTIVE',
    'DONE',
];

/** Display labels for dropdown options */
export const PHASE_DISPLAY_LABELS = {
    PENDING: 'PENDING',
    ARTISAN: 'artisan',
    APPRENTICE: 'apprentice',
    'DESIGN 1': 'design 1',
    'DESIGN 2': 'design 2',
    'DESIGN 3': 'design 3',
    'DESIGN 4': 'design 4',
    'DESIGN 5': 'design 5',
    ACTIVE: 'active',
    DONE: 'DONE',
};

/** Legacy automation phases (signup pipeline) — kept for DB backward compat */
const LEGACY_AUTOMATION_PHASES = new Set([
    'OPENING',
    'CLOUDFLARE_WAIT',
    'FILLING',
    'CAPTCHA',
    'WAIT_EMAIL',
    'WAITING_EMAIL',
    'ACTIVATING',
    'SUBMITTING',
    'QUEUED',
    'SKIPPED',
    'IDLE',
    'FOUNDATION',
    'WARMING',
    'WARMUP',
    'DESIGN_UPLOAD',
    'UPLOADING',
    'FAILED',
    'ERROR',
]);

const PHASE_TO_STAGE = {
    PENDING: 'pending',
    IDLE: 'pending',
    QUEUED: 'pending',
    ARTISAN: 'artisan',
    APPRENTICE: 'apprentice',
    'DESIGN 1': 'design',
    'DESIGN 2': 'design',
    'DESIGN 3': 'design',
    'DESIGN 4': 'design',
    'DESIGN 5': 'design',
    DESIGN_1: 'design',
    DESIGN_2: 'design',
    DESIGN_3: 'design',
    DESIGN_4: 'design',
    DESIGN_5: 'design',
    DESIGN1: 'design',
    DESIGN2: 'design',
    DESIGN3: 'design',
    DESIGN4: 'design',
    DESIGN5: 'design',
    ACTIVE: 'active',
    DONE: 'done',
    SKIPPED: 'done',
    // Legacy signup automation → pending (in-flight) or done
    OPENING: 'pending',
    CLOUDFLARE_WAIT: 'pending',
    FILLING: 'pending',
    CAPTCHA: 'pending',
    WAIT_EMAIL: 'pending',
    WAITING_EMAIL: 'pending',
    ACTIVATING: 'pending',
    SUBMITTING: 'pending',
    FOUNDATION: 'artisan',
    WARMING: 'artisan',
    WARMUP: 'artisan',
    DESIGN_UPLOAD: 'design',
    UPLOADING: 'design',
    DESIGN: 'design',
    FAILED: 'pending',
    ERROR: 'pending',
};

const PHASE_TO_CSS = {
    PENDING: 'pending',
    ARTISAN: 'artisan',
    APPRENTICE: 'apprentice',
    'DESIGN 1': 'design-1',
    'DESIGN 2': 'design-2',
    'DESIGN 3': 'design-3',
    'DESIGN 4': 'design-4',
    'DESIGN 5': 'design-5',
    ACTIVE: 'active',
    DONE: 'done',
    SKIPPED: 'done',
    OPENING: 'pending',
    CLOUDFLARE_WAIT: 'pending',
    FILLING: 'pending',
    CAPTCHA: 'pending',
    WAIT_EMAIL: 'pending',
    WAITING_EMAIL: 'pending',
    ACTIVATING: 'pending',
    SUBMITTING: 'pending',
    QUEUED: 'pending',
    IDLE: 'pending',
    FAILED: 'pending',
    ERROR: 'pending',
};

export function phaseDisplayLabel(phase) {
    const key = String(phase || '').trim().toUpperCase();
    if (PHASE_DISPLAY_LABELS[key]) return PHASE_DISPLAY_LABELS[key];
    if (LEGACY_AUTOMATION_PHASES.has(key)) return key;
    return String(phase || 'PENDING');
}

export function getPhaseCssKey(phase) {
    const key = String(phase || '').trim().toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
    if (PHASE_TO_CSS[key]) return PHASE_TO_CSS[key];
    const compact = key.replace(/\s+/g, '');
    if (/^DESIGN[1-5]$/.test(compact)) return `design-${compact.slice(-1)}`;
    if (key.includes('DESIGN')) return 'design-1';
    if (key.includes('OPEN') || key.includes('FILL') || key.includes('CAPTCHA') || key.includes('WAIT') || key.includes('ACTIV')) return 'pending';
    if (key.includes('DONE') || key.includes('SKIP')) return 'done';
    if (key.includes('ARTISAN') || key.includes('FOUND') || key.includes('WARM')) return 'artisan';
    if (key.includes('APPRENT')) return 'apprentice';
    if (key.includes('ACTIVE')) return 'active';
    return 'pending';
}

export const I18N = {
    ar: {
        'creaty.title': 'NHP EMAILCORE',
        'creaty.subtitle': 'Creaty Artisan — أتمتة TeePublic',
        'creaty.col.accounts': 'الحسابات',
        'creaty.col.artisan': 'جدولة Artisan',
        'creaty.col.status': 'الحالة السريعة',
        'creaty.tab.schedule': 'جدولة الرفع',
        'creaty.tab.store': 'توليد المتجر',
        'creaty.tab.dashboard': 'لوحة الإشراف',
        'creaty.filter.all': 'الكل',
        'creaty.filter.pending': 'قيد الانتظار',
        'creaty.filter.artisan': 'artisan',
        'creaty.filter.apprentice': 'apprentice',
        'creaty.filter.design': 'التصاميم',
        'creaty.filter.active': 'active',
        'creaty.filter.done': 'مكتمل',
        'creaty.dash.accounts': 'حساب',
        'creaty.col.email': 'البريد',
        'creaty.col.stage': 'المرحلة',
        'creaty.col.designs': 'التصاميم المرفوعة',
        'creaty.col.lastUpload': 'آخر رفع',
        'creaty.col.remaining': 'المتبقي',
        'creaty.col.nextScheduled': 'الجدولة التالية',
        'creaty.col.actions': 'إجراءات',
        'creaty.dash.loading': 'جاري التحميل…',
        'creaty.dash.empty': 'لا توجد حسابات للعرض',
        'creaty.accounts.empty': 'لا توجد حسابات TeePublic',
        'creaty.schedule.hint': 'اضبط مواعيد الرفع لكل حساب. اختر حساباً من العمود الأول ثم حدّد الجدول.',
        'creaty.store.hint': 'توليد المتجر والألبومات — يُدار من هذا التبويب.',
        'creaty.status.hint': 'اختر حساباً لعرض تفاصيله.',
        'creaty.stage.pending': 'قيد الانتظار',
        'creaty.stage.artisan': 'artisan',
        'creaty.stage.apprentice': 'apprentice',
        'creaty.stage.design': 'التصاميم',
        'creaty.stage.active': 'active',
        'creaty.stage.done': 'مكتمل',
        'creaty.action.play': 'تشغيل / متابعة',
        'creaty.action.edit': 'تعديل الجدول',
        'creaty.action.deleteStore': 'حذف توليد المتجر',
        'creaty.action.delete': 'إعادة ضبط',
        'creaty.time.never': '—',
        'creaty.time.now': 'الآن',
        'creaty.designs.showMore': 'المزيد +{n}',
        'creaty.designs.showLess': 'عرض أقل',
        'creaty.designs.modalTitle': 'كل التصاميم',
        'creaty.dash.stage.foundation': 'إعداد المتجر',
        'creaty.dash.stage.foundationActions': 'صورة، غلاف، نبذة، روابط اجتماعية، بحث النيش',
        'creaty.dash.stage.design1': 'رفع تصميم 1',
        'creaty.dash.stage.design1Actions': '4500×5400، 300dpi، عنوان، وصف، 15 وسم',
        'creaty.dash.stage.design2': 'رفع تصميم 2',
        'creaty.dash.stage.design2Actions': 'نفس الجودة، بدون stock أو تكرار',
        'creaty.dash.stage.design3': 'رفع تصميم 3',
        'creaty.dash.stage.design3Actions': 'متغيرات داكن/فاتح، وضع يدوي لكل المنتجات',
        'creaty.dash.stage.design45': 'رفع تصميم 4+5 + مراجعة',
        'creaty.dash.stage.design45Actions': 'long-tail، مراجعة المتجر، Pinterest',
        'creaty.dash.stage.start': 'بدء',
        'creaty.dash.stage.stop': 'إيقاف',
        'creaty.dash.stage.edit': 'تعديل',
        'creaty.dash.stage.status.pending': 'معلّق',
        'creaty.dash.stage.status.running': 'جاري',
        'creaty.dash.stage.status.done': 'مكتمل',
        'creaty.dash.stage.status.error': 'خطأ',
        'creaty.dash.stage.status.stopped': 'متوقف',
        'creaty.dash.row.expand': 'عرض مراحل الرفع',
        'creaty.dash.row.collapse': 'إخفاء مراحل الرفع',
        'creaty.dash.accountInfo.title': 'معلومات الحساب',
        'creaty.dash.accountInfo.fullName': 'الاسم الكامل',
        'creaty.dash.accountInfo.email': 'البريد',
        'creaty.dash.accountInfo.password': 'كلمة المرور',
        'creaty.dash.accountInfo.status': 'الحالة الحالية',
        'creaty.dash.accountInfo.regDate': 'تاريخ التسجيل',
        'creaty.dash.accountInfo.activation': 'حالة التفعيل',
        'creaty.dash.accountInfo.activated': 'مُفعّل',
        'creaty.dash.accountInfo.notActivated': 'غير مُفعّل',
        'creaty.dash.accountInfo.copyEmail': 'نسخ البريد',
        'creaty.dash.accountInfo.copyPassword': 'نسخ كلمة المرور',
        'creaty.dash.accountInfo.copyCredentials': 'نسخ بيانات الدخول',
        'creaty.dash.accountInfo.openSession': 'فتح الجلسة',
        'creaty.dash.accountInfo.activate': 'تفعيل الحساب',
        'creaty.dash.accountInfo.expand': 'عرض معلومات الحساب',
        'creaty.dash.accountInfo.collapse': 'إخفاء معلومات الحساب',
        'creaty.dash.accountInfo.loading': 'جاري جلب البيانات من EmailCore…',
        'creaty.dash.accountInfo.fetchError': 'تعذّر التحديث — عرض البيانات المحلية',
        'creaty.source.creaty': 'Creaty',
        'creaty.source.imported': 'مستورد',
        'importedLoginPreview': 'فتح تسجيل الدخول',
        'importedApplyStore': 'فتح توليد المتجر',
        'importedDelete': 'حذف الحساب',
    },
    en: {
        'creaty.title': 'NHP EMAILCORE',
        'creaty.subtitle': 'Creaty Artisan — TeePublic automation',
        'creaty.col.accounts': 'Accounts',
        'creaty.col.artisan': 'Artisan schedule',
        'creaty.col.status': 'Quick status',
        'creaty.tab.schedule': 'Upload schedule',
        'creaty.tab.store': 'Store generation',
        'creaty.tab.dashboard': 'Dashboard',
        'creaty.filter.all': 'All',
        'creaty.filter.pending': 'Pending',
        'creaty.filter.artisan': 'artisan',
        'creaty.filter.apprentice': 'apprentice',
        'creaty.filter.design': 'Designs',
        'creaty.filter.active': 'active',
        'creaty.filter.done': 'Done',
        'creaty.dash.accounts': 'account(s)',
        'creaty.col.email': 'Email',
        'creaty.col.stage': 'Stage',
        'creaty.col.designs': 'Designs uploaded',
        'creaty.col.lastUpload': 'Last upload',
        'creaty.col.remaining': 'Remaining',
        'creaty.col.nextScheduled': 'Next scheduled',
        'creaty.col.actions': 'Actions',
        'creaty.dash.loading': 'Loading…',
        'creaty.dash.empty': 'No accounts to display',
        'creaty.accounts.empty': 'No TeePublic accounts',
        'creaty.schedule.hint': 'Set upload times per account. Pick an account in column 1.',
        'creaty.store.hint': 'Store and album generation — managed in this tab.',
        'creaty.status.hint': 'Select an account to view details.',
        'creaty.stage.pending': 'Pending',
        'creaty.stage.artisan': 'artisan',
        'creaty.stage.apprentice': 'apprentice',
        'creaty.stage.design': 'Designs',
        'creaty.stage.active': 'active',
        'creaty.stage.done': 'Done',
        'creaty.action.play': 'Resume / advance',
        'creaty.action.edit': 'Edit schedule',
        'creaty.action.deleteStore': 'Delete store generation',
        'creaty.action.delete': 'Reset schedule',
        'creaty.time.never': '—',
        'creaty.time.now': 'Now',
        'creaty.designs.showMore': 'More +{n}',
        'creaty.designs.showLess': 'Show less',
        'creaty.designs.modalTitle': 'All designs',
        'creaty.dash.stage.foundation': 'Store setup',
        'creaty.dash.stage.foundationActions': 'Avatar, cover, bio, social links, niche research',
        'creaty.dash.stage.design1': 'Upload design 1',
        'creaty.dash.stage.design1Actions': '4500×5400, 300dpi, title, description, 15 tags',
        'creaty.dash.stage.design2': 'Upload design 2',
        'creaty.dash.stage.design2Actions': 'Same quality, no stock or duplicates',
        'creaty.dash.stage.design3': 'Upload design 3',
        'creaty.dash.stage.design3Actions': 'Dark/light variants, manual placement',
        'creaty.dash.stage.design45': 'Upload designs 4+5 + review',
        'creaty.dash.stage.design45Actions': 'Long-tail, store review, Pinterest',
        'creaty.dash.stage.start': 'Start',
        'creaty.dash.stage.stop': 'Stop',
        'creaty.dash.stage.edit': 'Edit',
        'creaty.dash.stage.status.pending': 'Pending',
        'creaty.dash.stage.status.running': 'Running',
        'creaty.dash.stage.status.done': 'Done',
        'creaty.dash.stage.status.error': 'Error',
        'creaty.dash.stage.status.stopped': 'Stopped',
        'creaty.dash.row.expand': 'Expand upload stages',
        'creaty.dash.row.collapse': 'Collapse upload stages',
        'creaty.dash.accountInfo.title': 'Account information',
        'creaty.dash.accountInfo.fullName': 'Full name',
        'creaty.dash.accountInfo.email': 'Email',
        'creaty.dash.accountInfo.password': 'Password',
        'creaty.dash.accountInfo.status': 'Current status',
        'creaty.dash.accountInfo.regDate': 'Registration date',
        'creaty.dash.accountInfo.activation': 'Activation status',
        'creaty.dash.accountInfo.activated': 'Activated',
        'creaty.dash.accountInfo.notActivated': 'Not activated',
        'creaty.dash.accountInfo.copyEmail': 'Copy email',
        'creaty.dash.accountInfo.copyPassword': 'Copy password',
        'creaty.dash.accountInfo.copyCredentials': 'Copy credentials',
        'creaty.dash.accountInfo.openSession': 'Open session',
        'creaty.dash.accountInfo.activate': 'Activate account',
        'creaty.dash.accountInfo.expand': 'Show account info',
        'creaty.dash.accountInfo.collapse': 'Hide account info',
        'creaty.dash.accountInfo.loading': 'Fetching from EmailCore…',
        'creaty.dash.accountInfo.fetchError': 'Could not refresh — showing local data',
        'creaty.source.creaty': 'Creaty',
        'creaty.source.imported': 'Imported',
        'importedLoginPreview': 'Open Login Preview',
        'importedApplyStore': 'Open Store Generator',
        'importedDelete': 'Delete Account',
    },
};

/** Collapsed dashboard row shows first design only */
export const DESIGN_LIST_PREVIEW = 1;
/** Use modal instead of inline expand when a row has more than this many designs */
export const DESIGN_LIST_MODAL_THRESHOLD = 8;

/** 5-stage supervision board — mirrors creaty-server-orchestrator WORKFLOW_STAGES */
export const DASH_UPLOAD_STAGES = [
    {
        id: 'foundation',
        titleKey: 'creaty.dash.stage.foundation',
        actionsKey: 'creaty.dash.stage.foundationActions',
        phaseIds: ['foundation'],
    },
    {
        id: 'design1',
        titleKey: 'creaty.dash.stage.design1',
        actionsKey: 'creaty.dash.stage.design1Actions',
        phaseIds: ['design1'],
    },
    {
        id: 'design2',
        titleKey: 'creaty.dash.stage.design2',
        actionsKey: 'creaty.dash.stage.design2Actions',
        phaseIds: ['design2'],
    },
    {
        id: 'design3',
        titleKey: 'creaty.dash.stage.design3',
        actionsKey: 'creaty.dash.stage.design3Actions',
        phaseIds: ['design3'],
    },
    {
        id: 'design45',
        titleKey: 'creaty.dash.stage.design45',
        actionsKey: 'creaty.dash.stage.design45Actions',
        phaseIds: ['design4', 'design5_review'],
    },
];

const DASH_COL_COUNT = 4;

export function creatyUrl(path = '') {
    const p = path ? (String(path).startsWith('/') ? path : `/${path}`) : '';
    return `http://127.0.0.1:${CREATY_PORT}${p}`;
}

export function mapPhaseToStage(phase) {
    const raw = String(phase || '').trim().toUpperCase();
    const key = raw.replace(/_/g, ' ').replace(/\s+/g, ' ');
    if (PHASE_TO_STAGE[key]) return PHASE_TO_STAGE[key];
    const compact = key.replace(/\s+/g, '');
    if (/^DESIGN[1-5]$/.test(compact)) return 'design';
    if (key.includes('DESIGN')) return 'design';
    if (key.includes('ARTISAN') || key.includes('FOUND') || key.includes('WARM')) return 'artisan';
    if (key.includes('APPRENT')) return 'apprentice';
    if (key.includes('ACTIVE')) return 'active';
    if (key.includes('DONE') || key.includes('SKIP')) return 'done';
    if (LEGACY_AUTOMATION_PHASES.has(key) || LEGACY_AUTOMATION_PHASES.has(raw)) return 'pending';
    return 'pending';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function designLabelFromEntry(entry, index) {
    if (typeof entry === 'string') return entry.trim();
    return String(entry?.title || entry?.filename || entry?.name || `Design ${index + 1}`).trim();
}

export function extractDesignNames(stored, orch) {
    const sources = [
        stored?.quintet?.designs,
        stored?.quintetDesigns,
        stored?.designs,
        orch?.quintet?.designs,
        orch?.quintetDesigns,
        orch?.designs,
    ];
    for (const src of sources) {
        if (!Array.isArray(src) || !src.length) continue;
        const names = src.map((d, i) => designLabelFromEntry(d, i)).filter(Boolean);
        if (names.length) return names;
    }
    return [];
}

export function buildDesignNamesByAccount(scheduleMap, emails) {
    const map = new Map();
    emails.forEach((email) => {
        const key = String(email || '').trim().toLowerCase();
        if (!key) return;
        const sk = scheduleStorageKey(email);
        const stored = scheduleMap[sk] || {};
        map.set(key, extractDesignNames(stored, {}));
    });
    return map;
}

function formatDesignsShowMore(lang, i18n, hiddenCount) {
    const tpl = i18n[lang]?.['creaty.designs.showMore'] || 'More +{n}';
    return tpl.replace('{n}', String(hiddenCount));
}

export function renderDesignsListHtml(designNames, email, lang, i18n, isExpanded) {
    if (!Array.isArray(designNames) || !designNames.length) return '';
    const limit = DESIGN_LIST_PREVIEW;
    const extraCount = Math.max(0, designNames.length - limit);
    const useModal = designNames.length > DESIGN_LIST_MODAL_THRESHOLD;
    const fullTitle = designNames.map((name) => String(name)).join(', ');

    let toggleBtn = '';
    if (extraCount > 0) {
        const label = isExpanded && !useModal
            ? (i18n[lang]?.['creaty.designs.showLess'] || 'Show less')
            : formatDesignsShowMore(lang, i18n, extraCount);
        const action = useModal ? 'designs-modal' : 'designs-toggle';
        const badgeCls = isExpanded && !useModal ? '' : ' creaty-designs-more-badge';
        toggleBtn = `<button type="button" class="creaty-designs-toggle${badgeCls}" id="creaty-designs-toggle-${escapeHtml(email)}" data-action="${action}" data-email="${escapeHtml(email)}" aria-expanded="${isExpanded ? 'true' : 'false'}" title="${escapeHtml(fullTitle)}">${escapeHtml(label)}</button>`;
    }

    if (isExpanded && !useModal) {
        const items = designNames.map((name) => (
            `<li class="creaty-designs-list__item" dir="ltr" title="${escapeHtml(name)}">${escapeHtml(name)}</li>`
        )).join('');
        return `<div class="creaty-designs-list creaty-designs-list--expanded" data-email="${escapeHtml(email)}" title="${escapeHtml(fullTitle)}"><ul class="creaty-designs-list__items">${items}</ul>${toggleBtn}</div>`;
    }

    const firstName = String(designNames[0]);
    const firstHtml = `<span class="creaty-designs-first" dir="ltr" title="${escapeHtml(firstName)}">${escapeHtml(firstName)}</span>`;
    return `<div class="creaty-designs-list" data-email="${escapeHtml(email)}" title="${escapeHtml(fullTitle)}"><div class="creaty-designs-list__row">${firstHtml}${toggleBtn}</div></div>`;
}

function normalizeEmail(acc) {
    if (typeof acc === 'string') return acc.trim();
    return String(acc?.email || acc?.display_email || '').trim();
}

export function scheduleStorageKey(email) {
    return `${CREATY_SCHEDULE_PREFIX}${String(email || '').trim().toLowerCase()}`;
}

export async function fetchCreatyJson(path, options = {}, timeoutMs = 3500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(creatyUrl(path), { ...options, signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

export async function loadAccountsFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['ap_accounts_teepublic', 'ap_accounts'], (data) => {
            const list = Array.isArray(data.ap_accounts_teepublic)
                ? data.ap_accounts_teepublic
                : (Array.isArray(data.ap_accounts) ? data.ap_accounts : []);
            resolve(list);
        });
    });
}

export async function loadScheduleMap(emails) {
    const keys = emails.map((e) => scheduleStorageKey(e));
    if (!keys.length) return {};
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (data) => resolve(data || {}));
    });
}

export async function fetchServerStatus() {
    try {
        const [status, orchestrate] = await Promise.all([
            fetchCreatyJson('/status'),
            fetchCreatyJson('/orchestrate/status'),
        ]);
        return { online: true, status, orchestrate };
    } catch (_) {
        return { online: false, status: null, orchestrate: null };
    }
}

export async function syncFromWebsiteIfToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['creaty_website_api_base', 'creaty_website_token', 'nhp_auth_token'], async (data) => {
            const base = String(data.creaty_website_api_base || '').replace(/\/$/, '');
            const token = data.creaty_website_token || data.nhp_auth_token;
            if (!base || !token) {
                resolve({ synced: false, reason: 'no-token' });
                return;
            }
            try {
                const res = await fetch(`${base}/api/schedule-sync`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const payload = await res.json();
                const schedules = Array.isArray(payload?.schedules) ? payload.schedules : (Array.isArray(payload) ? payload : []);
                const toSet = {};
                schedules.forEach((row) => {
                    const email = normalizeEmail(row);
                    if (!email) return;
                    toSet[scheduleStorageKey(email)] = { ...row, email, updatedAt: new Date().toISOString() };
                });
                if (Object.keys(toSet).length) {
                    await new Promise((r) => chrome.storage.local.set(toSet, r));
                }
                resolve({ synced: true, count: Object.keys(toSet).length });
            } catch (err) {
                resolve({ synced: false, reason: err.message });
            }
        });
    });
}

export function mergeAccountRows(accounts, scheduleMap, serverBundle) {
    const orchestrateByEmail = new Map();
    (serverBundle?.orchestrate?.accounts || []).forEach((row) => {
        const email = normalizeEmail(row);
        if (email) orchestrateByEmail.set(email.toLowerCase(), row);
    });

    const liveEmail = String(serverBundle?.status?.email || serverBundle?.orchestrate?.activeEmail || '').toLowerCase();
    const livePhase = serverBundle?.status?.phase || serverBundle?.orchestrate?.activePhase;

    return accounts.map((acc) => {
        const email = normalizeEmail(acc);
        const sk = scheduleStorageKey(email);
        const stored = scheduleMap[sk] || {};
        const orch = orchestrateByEmail.get(email.toLowerCase()) || {};
        const isLive = liveEmail && liveEmail === email.toLowerCase();

        const accountPhase = String(acc?.creaty_phase || '').trim().toUpperCase();
        let phase = stored.phase || orch.phase || accountPhase || (isLive ? livePhase : 'PENDING');
        let stage = stored.stage || mapPhaseToStage(phase);
        if (stored.stage && STAGE_KEYS.includes(stored.stage)) stage = stored.stage;
        if (isLive && livePhase) stage = mapPhaseToStage(livePhase);

        const designsTotal = Math.max(1, Number(stored.designsTotal ?? orch.designsTotal) || 5);
        const designsUploaded = Math.min(
            designsTotal,
            Math.max(0, Number(stored.designsUploaded ?? orch.designsUploaded) || 0)
        );
        const designNames = extractDesignNames(stored, orch);

        const isImported = !!(acc.emailcoreSource || acc.emailcoreSessionId || acc.sessionId || acc.cookie || acc.imported);
        const source = acc.source || (isImported ? 'Imported' : 'Creaty');

        return {
            email,
            stage,
            phase: String(phase || '').toUpperCase(),
            designsUploaded,
            designsTotal,
            designNames,
            phases: Array.isArray(stored.phases) ? stored.phases : (Array.isArray(orch.phases) ? orch.phases : []),
            storeProfileAppliedAt: stored.storeProfileAppliedAt || orch.storeProfileAppliedAt || null,
            lastUpload: stored.lastUpload || orch.lastUpload || null,
            remainingMs: stored.remainingMs ?? orch.remainingMs ?? null,
            nextScheduled: stored.nextScheduled || orch.nextScheduled || null,
            message: stored.message || orch.message || (isLive ? serverBundle?.status?.message : '') || '',
            raw: acc,
            source,
        };
    }).filter((r) => r.email);
}

export function formatRelativeTime(iso, lang, i18n) {
    if (!iso) return i18n[lang]['creaty.time.never'];
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return i18n[lang]['creaty.time.now'];
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return lang === 'ar' ? `منذ ${mins} د` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 48) return lang === 'ar' ? `منذ ${hrs} س` : `${hrs}h ago`;
    return d.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'en-GB', { month: 'short', day: 'numeric' });
}

export function formatRemaining(ms, lang) {
    if (ms == null || Number.isNaN(Number(ms))) return '—';
    const n = Math.max(0, Number(ms));
    const hrs = Math.floor(n / 3600000);
    const mins = Math.floor((n % 3600000) / 60000);
    if (hrs > 0) return lang === 'ar' ? `${hrs}س ${mins}د` : `${hrs}h ${mins}m`;
    return lang === 'ar' ? `${mins} د` : `${mins}m`;
}

export function formatScheduled(iso, lang) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(lang === 'ar' ? 'ar-MA' : 'en-GB', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function phaseStatusMap(phases) {
    const map = new Map();
    (Array.isArray(phases) ? phases : []).forEach((phase) => {
        if (phase?.id) map.set(phase.id, String(phase.status || 'pending'));
    });
    return map;
}

export function deriveWorkflowStageStatus(phases, stageDef) {
    const statusById = phaseStatusMap(phases);
    const statuses = (stageDef?.phaseIds || []).map((id) => statusById.get(id) || 'pending');
    if (!statuses.length) return 'pending';
    if (statuses.some((s) => s === 'failed' || s === 'error')) return 'error';
    if (statuses.some((s) => s === 'in_progress' || s === 'running')) return 'running';
    if (statuses.some((s) => s === 'stopped')) return 'stopped';
    if (statuses.every((s) => s === 'done' || s === 'skipped')) return 'done';
    return 'pending';
}

function stageStatusLabel(status, lang, i18n) {
    const key = `creaty.dash.stage.status.${status}`;
    return i18n[lang]?.[key] || i18n.en?.[key] || status;
}

export function renderStagesPanelHtml(row, lang, i18n) {
    const phases = row.phases || [];
    const startLabel = i18n[lang]?.['creaty.dash.stage.start'] || 'Start';
    const stopLabel = i18n[lang]?.['creaty.dash.stage.stop'] || 'Stop';
    const editLabel = i18n[lang]?.['creaty.dash.stage.edit'] || 'Edit';

    const cards = DASH_UPLOAD_STAGES.map((stageDef, index) => {
        const status = deriveWorkflowStageStatus(phases, stageDef);
        const title = i18n[lang]?.[stageDef.titleKey] || stageDef.id;
        const actions = i18n[lang]?.[stageDef.actionsKey] || '';
        const statusText = stageStatusLabel(status, lang, i18n);
        const isLast = index === DASH_UPLOAD_STAGES.length - 1;
        return `<div class="creaty-stages-stepper__item creaty-stages-stepper__item--${escapeHtml(status)}" data-stage-id="${escapeHtml(stageDef.id)}">
            <div class="creaty-stages-stepper__marker" aria-hidden="true">
                <span class="creaty-stages-stepper__dot"></span>
                ${isLast ? '' : '<span class="creaty-stages-stepper__line"></span>'}
            </div>
            <article class="creaty-stages-card creaty-stages-card--${escapeHtml(status)}">
                <header class="creaty-stages-card__head">
                    <h4 class="creaty-stages-card__title">${escapeHtml(title)}</h4>
                    <span class="creaty-stages-card__status">${escapeHtml(statusText)}</span>
                </header>
                <p class="creaty-stages-card__desc">${escapeHtml(actions)}</p>
                <div class="creaty-stages-card__actions">
                    <button type="button" class="creaty-stage-action creaty-stage-action--start" data-action="stage-start" data-stage-id="${escapeHtml(stageDef.id)}" data-email="${escapeHtml(row.email)}" title="${escapeHtml(startLabel)}"><i class="fa-solid fa-play" aria-hidden="true"></i><span>${escapeHtml(startLabel)}</span></button>
                    <button type="button" class="creaty-stage-action creaty-stage-action--stop" data-action="stage-stop" data-stage-id="${escapeHtml(stageDef.id)}" data-email="${escapeHtml(row.email)}" title="${escapeHtml(stopLabel)}"><i class="fa-solid fa-stop" aria-hidden="true"></i><span>${escapeHtml(stopLabel)}</span></button>
                    <button type="button" class="creaty-stage-action creaty-stage-action--edit" data-action="stage-edit" data-stage-id="${escapeHtml(stageDef.id)}" data-email="${escapeHtml(row.email)}" title="${escapeHtml(editLabel)}"><i class="fa-solid fa-pen" aria-hidden="true"></i><span>${escapeHtml(editLabel)}</span></button>
                </div>
            </article>
        </div>`;
    }).join('');

    const actionBox = `
    <div class="creaty-row-actions-box">
        <div class="creaty-row-actions-box__title">${lang === 'ar' ? 'الإجراءات المتاحة للحساب' : 'Available Account Actions'}</div>
        <div class="creaty-row-actions-box__buttons">
            <button type="button" class="creaty-btn creaty-imported-preview-btn" data-action="login-preview" data-login-preview-email="${escapeHtml(row.email)}" title="${escapeHtml(i18n[lang]['importedLoginPreview'] || 'Login Preview')}">
                <i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> <span>${escapeHtml(i18n[lang]['importedLoginPreview'] || 'Login Preview')}</span>
            </button>
            <button type="button" class="creaty-btn creaty-imported-session-card-btn" data-action="login-session-card" data-email="${escapeHtml(row.email)}" title="${lang === 'ar' ? 'فتح الجلسة مع بطاقة المعلومات العائمة' : 'Open Session with Floating Card'}">
                <i class="fa-solid fa-address-card" aria-hidden="true"></i> <span>${lang === 'ar' ? 'فتح الجلسة بالبطاقة' : 'Login with Card'}</span>
            </button>
            <button type="button" class="creaty-btn creaty-imported-signup-btn" data-action="play" data-email="${escapeHtml(row.email)}" title="${escapeHtml(i18n[lang]['creaty.action.play'] || 'Start Signup')}">
                <i class="fa-solid fa-play" aria-hidden="true"></i> <span>${escapeHtml(i18n[lang]['creaty.action.play'] || 'Play')}</span>
            </button>
            <button type="button" class="creaty-btn" data-action="stage-edit" data-stage-id="foundation" data-email="${escapeHtml(row.email)}" title="${escapeHtml(i18n[lang]['importedApplyStore'] || 'Store Generator')}">
                <i class="fa-solid fa-store" aria-hidden="true"></i> <span>${escapeHtml(i18n[lang]['importedApplyStore'] || 'Store')}</span>
            </button>
            <button type="button" class="creaty-btn creaty-btn--danger" data-action="delete" data-email="${escapeHtml(row.email)}" title="${escapeHtml(i18n[lang]['creaty.action.delete'] || 'Reset Schedule')}">
                <i class="fa-solid fa-rotate-left" aria-hidden="true"></i> <span>${escapeHtml(i18n[lang]['creaty.action.delete'] || 'Reset')}</span>
            </button>
            <button type="button" class="creaty-btn creaty-btn--danger" data-action="delete-account" data-delete-email="${escapeHtml(row.email)}" title="${escapeHtml(i18n[lang]['importedDelete'] || 'Delete Account')}">
                <i class="fa-solid fa-trash" aria-hidden="true"></i> <span>${escapeHtml(i18n[lang]['importedDelete'] || 'Delete')}</span>
            </button>
        </div>
    </div>`;

    return `<div class="creaty-stages-shell"><div class="creaty-stages-panel"><div class="creaty-stages-stepper" role="list">${cards}</div>${actionBox}</div></div>`;
}

function renderPhaseSelectHtml(row, lang) {
    const current = String(row.phase || 'PENDING').toUpperCase();
    const phases = ACCOUNT_SIGNUP_PHASES.includes(current)
        ? ACCOUNT_SIGNUP_PHASES
        : [current, ...ACCOUNT_SIGNUP_PHASES.filter((p) => p !== current)];
    const cssKey = getPhaseCssKey(current);
    const label = lang === 'ar' ? 'المرحلة' : 'Phase';
    const options = phases.map((phase) => {
        const selected = phase === current ? ' selected' : '';
        const display = phaseDisplayLabel(phase);
        return `<option value="${escapeHtml(phase)}"${selected}>${escapeHtml(display)}</option>`;
    }).join('');
    return `<select class="creaty-select creaty-phase-select creaty-phase-select--${escapeHtml(cssKey)}" data-email="${encodeURIComponent(row.email)}" aria-label="${escapeHtml(label)} — ${escapeHtml(row.email)}">${options}</select>`;
}

export function deriveAccountActivation(row) {
    const raw = row?.raw || {};
    const status = String(raw.teepublic_status || raw.tp_status || raw.status || '').toLowerCase();
    if (['active', 'artisan'].includes(status)) return true;
    if (raw.tpActivated) return true;
    if (String(raw.creaty_phase || row.phase || '').toUpperCase() === 'DONE') return true;
    return false;
}

/** Account can be refreshed from EmailCore when credentials exist (library / pipeline). */
export function isEmailCoreRemoteAccount(raw = {}) {
    if (raw?.emailcoreSource === true) return true;
    const email = String(raw.email || raw.display_email || '').trim().toLowerCase();
    if (isEmailCoreManagedEmail(email)) return true;
    const emailcoreSid = String(raw.emailcoreSessionId || '').trim();
    if (emailcoreSid && !/^acc_/i.test(emailcoreSid) && emailcoreSid.toLowerCase() !== email) return true;
    const sessionId = String(raw.sessionId || raw.id || '').trim();
    if (sessionId && !/^acc_/i.test(sessionId) && sessionId.toLowerCase() !== email) return true;
    return false;
}

/** In-memory cache of EmailCore account fields keyed by normalized email (survives table re-renders). */
const remoteAccountInfoCache = new Map();

function accountInfoCacheKey(rowOrEmail) {
    if (typeof rowOrEmail === 'string') {
        return String(rowOrEmail || '').trim().toLowerCase();
    }
    const raw = rowOrEmail?.raw || {};
    return String(rowOrEmail?.email || raw.email || raw.display_email || '').trim().toLowerCase();
}

function findLiveAccountInfoPanel(email) {
    if (typeof document === 'undefined') return null;
    const tbody = document.getElementById('creaty-dash-tbody');
    if (!tbody) return null;
    const escaped = typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(String(email || '').trim())
        : String(email || '').trim().replace(/["\\]/g, '\\$&');
    const sub = tbody.querySelector(`tr.creaty-dash-subrow--open[data-subrow-for="${escaped}"]`);
    return sub?.querySelector('.creaty-account-info-panel') || null;
}

function resolveAccountInfoForPanel(row) {
    const key = accountInfoCacheKey(row);
    const cached = key ? remoteAccountInfoCache.get(key) : null;
    if (cached) {
        patchRowRawFromAccountInfo(row, cached);
        return { info: cached, fromCache: true };
    }
    return { info: extractAccountInfo(row), fromCache: false };
}

/** True when accordion should call EmailCore (same keys as Email Library bar). */
export async function shouldHydrateAccountFromRemote(raw = {}) {
    if (!raw || typeof raw !== 'object') return false;
    const email = String(raw.email || raw.display_email || '').trim().toLowerCase();
    if (!email) return false;
    return hasEmailCoreCredentials();
}

function extractAccountInfo(row) {
    const raw = row?.raw || {};
    const firstName = String(raw.firstName || raw.first_name || '').trim();
    const lastName = String(raw.lastName || raw.last_name || '').trim();
    const displayName = String(raw.displayName || raw.display_name || row.storeTitle || row.displayName || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || displayName || '—';
    const email = String(row.email || raw.email || raw.display_email || '').trim();
    const password = String(raw.password || raw.pass || raw.secret || '').trim();
    const status = String(row.phase || raw.creaty_phase || raw.teepublic_status || raw.status || row.stage || '—').trim();
    const regIso = raw.createdAt || raw.created_at || raw.registeredAt || raw.registered_at || raw.phaseSetAt || raw.updatedAt || raw.addedAt || null;
    const activated = deriveAccountActivation(row);
    return { fullName, email, password, status, regIso, activated };
}

export function mapRemoteSessionToAccountInfo(remoteWrap, row) {
    const session = remoteWrap?.session || {};
    const local = extractAccountInfo(row);
    const firstName = String(session.firstName || session.first_name || '').trim();
    const lastName = String(session.lastName || session.last_name || '').trim();
    const displayName = String(session.displayName || session.display_name || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || displayName || local.fullName;
    const email = String(session.display_email || session.email || local.email).trim();
    const password = String(session.password || session.pass || session.secret || local.password).trim();
    const status = String(
        session.creaty_phase || session.phase || session.teepublic_status || session.tp_status || session.status || local.status
    ).trim() || '—';
    const regIso = session.created_at || session.createdAt || session.registered_at || session.registeredAt
        || session.added_at || session.addedAt || local.regIso;
    const activated = deriveAccountActivation({
        raw: session,
        phase: session.creaty_phase || session.phase,
    });
    return { fullName, email, password, status, regIso, activated };
}

function patchRowRawFromAccountInfo(row, info) {
    if (!row?.raw || !info) return;
    const raw = row.raw;
    if (info.password) {
        raw.password = info.password;
        raw.pass = info.password;
    }
    if (info.fullName && info.fullName !== '—') {
        const parts = info.fullName.split(/\s+/).filter(Boolean);
        if (parts[0]) {
            raw.firstName = parts[0];
            raw.first_name = parts[0];
        }
        if (parts.length > 1) {
            const last = parts.slice(1).join(' ');
            raw.lastName = last;
            raw.last_name = last;
        }
        raw.displayName = info.fullName;
        raw.display_name = info.fullName;
    }
    if (info.status && info.status !== '—') {
        raw.creaty_phase = info.status;
        raw.teepublic_status = info.status;
    }
    if (info.regIso) {
        raw.created_at = info.regIso;
        raw.createdAt = info.regIso;
    }
    raw.tpActivated = info.activated === true;
}

function accountInfoLabel(key, fallback, lang, i18n) {
    return escapeHtml(i18n[lang]?.[key] || i18n.en?.[key] || fallback);
}

function formatAccountRegDate(iso, lang) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(lang === 'ar' ? 'ar-MA' : 'en-GB', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function buildAccountInfoMetaRowsHtml(info, lang, i18n) {
    const activatedLabel = accountInfoLabel('creaty.dash.accountInfo.activated', 'Activated', lang, i18n);
    const notActivatedLabel = accountInfoLabel('creaty.dash.accountInfo.notActivated', 'Not activated', lang, i18n);
    const activationText = info.activated ? activatedLabel : notActivatedLabel;
    const passwordDisplay = info.password || '—';
    const regDate = formatAccountRegDate(info.regIso, lang);
    const rows = [
        ['creaty.dash.accountInfo.fullName', 'Full name', info.fullName],
        ['creaty.dash.accountInfo.email', 'Email', info.email],
        ['creaty.dash.accountInfo.password', 'Password', passwordDisplay],
        ['creaty.dash.accountInfo.status', 'Current status', info.status],
        ['creaty.dash.accountInfo.regDate', 'Registration date', regDate],
        ['creaty.dash.accountInfo.activation', 'Activation status', activationText],
    ];
    return rows.map(([key, fallback, value]) => `
        <div class="creaty-account-info__meta-row">
            <span>${accountInfoLabel(key, fallback, lang, i18n)}</span>
            <strong dir="${key.includes('email') || key.includes('password') ? 'ltr' : 'auto'}">${escapeHtml(value)}</strong>
        </div>`).join('');
}

function buildAccountInfoActivateHtml(info, row, lang, i18n) {
    const activatedLabel = accountInfoLabel('creaty.dash.accountInfo.activated', 'Activated', lang, i18n);
    if (info.activated) {
        return `<span class="creaty-account-info__activated-badge" aria-label="${activatedLabel}"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> ${activatedLabel}</span>`;
    }
    return `<button type="button" class="creaty-btn creaty-btn--primary creaty-account-info__activate-btn" data-action="activate-account" data-email="${escapeHtml(row.email)}" title="${accountInfoLabel('creaty.dash.accountInfo.activate', 'Activate account', lang, i18n)}"><i class="fa-solid fa-bolt" aria-hidden="true"></i> <span>${accountInfoLabel('creaty.dash.accountInfo.activate', 'Activate account', lang, i18n)}</span></button>`;
}

export function updateAccountInfoPanelDom(panelEl, row, info, lang, i18n) {
    if (!panelEl || !info) return;
    const shell = panelEl.closest('.creaty-account-info-shell') || panelEl;
    const grid = panelEl.querySelector('.creaty-account-info__grid');
    const actionsRow = panelEl.querySelector('.creaty-row-actions-box__buttons');
    if (grid) grid.innerHTML = buildAccountInfoMetaRowsHtml(info, lang, i18n);
    if (actionsRow) {
        const activateSlot = actionsRow.querySelector('.creaty-account-info__activate-btn, .creaty-account-info__activated-badge');
        const activateHtml = buildAccountInfoActivateHtml(info, row, lang, i18n);
        if (activateSlot) {
            activateSlot.outerHTML = activateHtml;
        } else {
            actionsRow.insertAdjacentHTML('beforeend', activateHtml);
        }
    }
    shell.classList.remove('creaty-account-info-shell--activated', 'creaty-account-info-shell--inactive');
    shell.classList.add(info.activated ? 'creaty-account-info-shell--activated' : 'creaty-account-info-shell--inactive');
}

/** Lazy-fetch EmailCore account fields when the accordion opens (uses Email Library access keys). */
export async function hydrateAccountInfoFromRemote(panelEl, row, lang, i18n) {
    if (!panelEl || !row) {
        return { skipped: true };
    }
    if (!(await shouldHydrateAccountFromRemote(row.raw))) {
        return { skipped: true };
    }

    const cacheKey = accountInfoCacheKey(row);
    const cached = cacheKey ? remoteAccountInfoCache.get(cacheKey) : null;
    if (cached) {
        patchRowRawFromAccountInfo(row, cached);
        const livePanel = findLiveAccountInfoPanel(row.email) || panelEl;
        updateAccountInfoPanelDom(livePanel, row, cached, lang, i18n);
        if (livePanel) livePanel.dataset.remoteLoaded = 'done';
        return { ok: true, source: 'cache' };
    }

    const loadState = panelEl.dataset.remoteLoaded || '';
    if (loadState === 'done' || loadState === 'loading') {
        return { skipped: true, state: loadState };
    }

    panelEl.dataset.remoteLoaded = 'loading';
    const grid = panelEl.querySelector('.creaty-account-info__grid');
    const titleEl = panelEl.querySelector('.creaty-account-info-panel__title');
    const baseTitle = accountInfoLabel('creaty.dash.accountInfo.title', 'Account information', lang, i18n);
    const loadingHint = i18n[lang]?.['creaty.dash.accountInfo.loading'] || i18n.en?.['creaty.dash.accountInfo.loading'] || 'Loading…';
    if (grid) grid.classList.add('creaty-account-info__grid--loading');
    if (titleEl) titleEl.textContent = `${baseTitle} — ${loadingHint}`;

    try {
        const remote = await fetchEmailCoreAccountRemote(row.raw);
        if (!remote?.session) {
            panelEl.dataset.remoteLoaded = 'local';
            if (titleEl) titleEl.textContent = baseTitle;
            return { fallback: true };
        }
        const info = mapRemoteSessionToAccountInfo(remote, row);
        if (cacheKey) remoteAccountInfoCache.set(cacheKey, info);
        patchRowRawFromAccountInfo(row, info);
        const livePanel = findLiveAccountInfoPanel(row.email) || panelEl;
        updateAccountInfoPanelDom(livePanel, row, info, lang, i18n);
        if (livePanel) livePanel.dataset.remoteLoaded = 'done';
        if (titleEl) titleEl.textContent = baseTitle;
        return { ok: true, source: remote.source };
    } catch (_) {
        panelEl.dataset.remoteLoaded = 'error';
        const errHint = i18n[lang]?.['creaty.dash.accountInfo.fetchError'] || i18n.en?.['creaty.dash.accountInfo.fetchError'] || 'Could not refresh';
        if (titleEl) titleEl.textContent = `${baseTitle} · ${errHint}`;
        return { error: true, fallback: true };
    } finally {
        if (grid) grid.classList.remove('creaty-account-info__grid--loading');
    }
}

export function renderAccountInfoPanelHtml(row, lang, i18n) {
    const { info, fromCache } = resolveAccountInfoForPanel(row);
    const title = accountInfoLabel('creaty.dash.accountInfo.title', 'Account information', lang, i18n);
    const activationTone = info.activated ? 'activated' : 'inactive';
    const metaRows = buildAccountInfoMetaRowsHtml(info, lang, i18n);
    const activateBtn = buildAccountInfoActivateHtml(info, row, lang, i18n);
    const remoteLoadedAttr = fromCache ? ' data-remote-loaded="done"' : '';

    return `<div class="creaty-stages-shell creaty-account-info-shell creaty-account-info-shell--${activationTone}">
        <div class="creaty-account-info-panel creaty-stages-panel" data-account-email="${escapeHtml(row.email)}"${remoteLoadedAttr}>
            <h4 class="creaty-account-info-panel__title">${title}</h4>
            <div class="creaty-account-info__grid">${metaRows}</div>
            <div class="creaty-row-actions-box creaty-account-info__actions">
                <div class="creaty-row-actions-box__title">${lang === 'ar' ? 'إجراءات سريعة' : 'Quick actions'}</div>
                <div class="creaty-row-actions-box__buttons">
                    <button type="button" class="creaty-btn" data-action="copy-email" data-email="${escapeHtml(row.email)}" title="${accountInfoLabel('creaty.dash.accountInfo.copyEmail', 'Copy email', lang, i18n)}"><i class="fa-regular fa-copy" aria-hidden="true"></i> <span>${accountInfoLabel('creaty.dash.accountInfo.copyEmail', 'Copy email', lang, i18n)}</span></button>
                    <button type="button" class="creaty-btn" data-action="copy-password" data-email="${escapeHtml(row.email)}" title="${accountInfoLabel('creaty.dash.accountInfo.copyPassword', 'Copy password', lang, i18n)}"><i class="fa-regular fa-copy" aria-hidden="true"></i> <span>${accountInfoLabel('creaty.dash.accountInfo.copyPassword', 'Copy password', lang, i18n)}</span></button>
                    <button type="button" class="creaty-btn" data-action="copy-credentials" data-email="${escapeHtml(row.email)}" title="${accountInfoLabel('creaty.dash.accountInfo.copyCredentials', 'Copy credentials', lang, i18n)}"><i class="fa-solid fa-key" aria-hidden="true"></i> <span>${accountInfoLabel('creaty.dash.accountInfo.copyCredentials', 'Copy credentials', lang, i18n)}</span></button>
                    <button type="button" class="creaty-btn creaty-imported-preview-btn" data-action="open-session" data-email="${escapeHtml(row.email)}" title="${accountInfoLabel('creaty.dash.accountInfo.openSession', 'Open session', lang, i18n)}"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> <span>${accountInfoLabel('creaty.dash.accountInfo.openSession', 'Open session', lang, i18n)}</span></button>
                    ${activateBtn}
                </div>
            </div>
        </div>
    </div>`;
}

function renderEmailCellHtml(row, lang, i18n, isExpanded) {
    const email = escapeHtml(row.email);
    const expandLabel = isExpanded
        ? (i18n[lang]?.['creaty.dash.accountInfo.collapse'] || 'Hide account info')
        : (i18n[lang]?.['creaty.dash.accountInfo.expand'] || 'Show account info');
    const openCls = isExpanded ? ' creaty-email-badge--open' : '';
    return `<td class="creaty-email-cell" title="${email}"><button type="button" class="creaty-email-badge creaty-email-badge--toggle${openCls}" data-action="account-info-toggle" data-email="${email}" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-label="${escapeHtml(expandLabel)} — ${email}" title="${email}"><span class="creaty-email-badge__text" dir="ltr">${email}</span></button></td>`;
}

function renderRowActionsHtml(row, lang, i18n) {
    const email = escapeHtml(row.email);
    const label = (key, fallback) => escapeHtml(i18n[lang]?.[key] || i18n.en?.[key] || fallback);
    const loginLabel = label('importedLoginPreview', 'Open login');
    const cardLabel = lang === 'ar' ? 'فتح الجلسة بالبطاقة' : 'Open session card';
    const runLabel = label('creaty.action.play', 'Run / resume');
    const resetLabel = label('creaty.action.delete', 'Reset');
    const deleteLabel = label('importedDelete', 'Delete account');

    return `<div class="creaty-row-actions-inline" role="group" aria-label="${lang === 'ar' ? 'إجراءات الحساب' : 'Account actions'}">
        <button type="button" class="creaty-row-action-btn" data-action="login-preview" data-email="${email}" title="${loginLabel}"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i><span>${loginLabel}</span></button>
        <button type="button" class="creaty-row-action-btn" data-action="login-session-card" data-email="${email}" title="${cardLabel}"><i class="fa-solid fa-address-card" aria-hidden="true"></i><span>${cardLabel}</span></button>
        <button type="button" class="creaty-row-action-btn creaty-row-action-btn--primary" data-action="play" data-email="${email}" title="${runLabel}"><i class="fa-solid fa-play" aria-hidden="true"></i><span>${runLabel}</span></button>
        
        <button type="button" class="creaty-row-action-btn creaty-row-action-btn--danger" data-action="reset-account" data-email="${email}" title="${resetLabel}"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i><span>${resetLabel}</span></button>
        <button type="button" class="creaty-row-action-btn creaty-row-action-btn--danger" data-action="delete-account" data-email="${email}" title="${deleteLabel}"><i class="fa-solid fa-trash" aria-hidden="true"></i><span>${deleteLabel}</span></button>
    </div>`;
}
export function renderDashboardTable(tbody, rows, filter, lang, i18n, expandedEmails = new Set(), expandedRowIds = new Set(), selectedEmails = new Set()) {
    if (!tbody) return 0;
    const filtered = filter === 'all'
        ? rows
        : rows.filter((r) => r.stage === filter);

    if (!filtered.length) {
        tbody.innerHTML = `<tr class="creaty-empty-row"><td colspan="${DASH_COL_COUNT}">${escapeHtml(i18n[lang]['creaty.dash.empty'])}</td></tr>`;
        return 0;
    }

    const maxRows = 50;
    const visibleRows = filtered.slice(0, maxRows);

    let html = visibleRows.map((row) => {
        const emailKey = String(row.email).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
        const isChecked = selectedEmails.has(emailKey) ? ' checked' : '';
        const isInfoExpanded = expandedRowIds.has(row.email);

        const mainRow = `<tr data-email="${escapeHtml(row.email)}">
            <td class="creaty-imported-cell creaty-imported-cell--select" style="text-align: center; vertical-align: middle;">
                <input type="checkbox" class="creaty-imported-checkbox creaty-dash-row-check" data-select-email="${encodeURIComponent(row.email)}"${isChecked} aria-label="Select ${escapeHtml(row.email)}">
            </td>
            ${renderEmailCellHtml(row, lang, i18n, isInfoExpanded)}
            <td class="creaty-phase-cell">${renderPhaseSelectHtml(row, lang)}</td>
            <td class="creaty-actions-cell">
                ${renderRowActionsHtml(row, lang, i18n)}
            </td>
        </tr>`;
        const subRow = `<tr class="creaty-dash-subrow${isInfoExpanded ? ' creaty-dash-subrow--open' : ''}" data-email="${escapeHtml(row.email)}" data-subrow-for="${escapeHtml(row.email)}">
            <td colspan="${DASH_COL_COUNT}">
                ${renderAccountInfoPanelHtml(row, lang, i18n)}
            </td>
        </tr>`;
        return mainRow + subRow;
    }).join('');

    if (filtered.length > maxRows) {
        const remainingCount = filtered.length - maxRows;
        html += `<tr class="creaty-load-more-row"><td colspan="4" style="text-align: center; padding: 0.5rem;"><button type="button" class="creaty-btn creaty-btn--compact" onclick="this.closest('tr').style.display='none'; const siblingRows=this.closest('tbody').querySelectorAll('.creaty-hidden-row'); siblingRows.forEach(r=>r.style.display='table-row');" style="margin: 0 auto; font-size: 0.7rem; padding: 0.25rem 0.5rem;">👇 عرض المتبقي (${remainingCount} حسابات إضافية)</button></td></tr>`;

        const hiddenRows = filtered.slice(maxRows);
        html += hiddenRows.map((row) => {
            const emailKey = String(row.email).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
            const isChecked = selectedEmails.has(emailKey) ? ' checked' : '';
            const isInfoExpanded = expandedRowIds.has(row.email);

            const mainRow = `<tr data-email="${escapeHtml(row.email)}" class="creaty-hidden-row" style="display: none;">
                <td class="creaty-imported-cell creaty-imported-cell--select" style="text-align: center; vertical-align: middle;">
                    <input type="checkbox" class="creaty-imported-checkbox creaty-dash-row-check" data-select-email="${encodeURIComponent(row.email)}"${isChecked} aria-label="Select ${escapeHtml(row.email)}">
                </td>
                ${renderEmailCellHtml(row, lang, i18n, isInfoExpanded)}
                <td class="creaty-phase-cell">${renderPhaseSelectHtml(row, lang)}</td>
                <td class="creaty-actions-cell">
                    ${renderRowActionsHtml(row, lang, i18n)}
                </td>
            </tr>`;
            const subRow = `<tr class="creaty-dash-subrow creaty-hidden-row${isInfoExpanded ? ' creaty-dash-subrow--open' : ''}" data-email="${escapeHtml(row.email)}" data-subrow-for="${escapeHtml(row.email)}" style="display: none;">
                <td colspan="${DASH_COL_COUNT}">
                    ${renderAccountInfoPanelHtml(row, lang, i18n)}
                </td>
            </tr>`;
            return mainRow + subRow;
        }).join('');
    }

    tbody.innerHTML = html;

    return filtered.length;
}

export async function actionPlay(email, accountRaw) {
    await chrome.runtime.sendMessage({ action: 'wake_creaty_server' }).catch(() => null);
    const body = typeof accountRaw === 'object' && accountRaw ? accountRaw : { email };
    chrome.runtime.sendMessage({
        action: 'CREATY_SIGNUP_TRACE',
        stage: 'dashboard.actionPlay',
        payload: body,
    }).catch(() => null);
    await fetchCreatyJson('/orchestrate/advance-phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    }, 5000).catch(() => null);

    return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(result || { success: false, error: 'Creaty returned no response' });
        };
        const timer = setTimeout(() => {
            finish({ success: false, error: 'انتهت مهلة تشغيل الحساب — تحقق من Creaty Server 3020' });
        }, 30000);

        chrome.runtime.sendMessage({ action: 'CREATY_RUN_SIGNUP', account: body }, (response) => {
            const runtimeError = chrome.runtime.lastError;
            if (runtimeError) {
                finish({ success: false, error: runtimeError.message });
                return;
            }
            finish(response);
        });
    });
}

async function patchAccountCreatyPhase(email, phase) {
    const emailKey = String(email || '').trim().toLowerCase();
    if (!emailKey) return false;
    return new Promise((resolve) => {
        chrome.storage.local.get(['ap_accounts_teepublic', 'ap_accounts'], (data) => {
            const patchList = (list) => (Array.isArray(list) ? list : []).map((acc) => {
                if (String(acc?.email || '').trim().toLowerCase() !== emailKey) return acc;
                return { ...acc, creaty_phase: phase, updatedAt: new Date().toISOString() };
            });
            const teepublic = patchList(data.ap_accounts_teepublic);
            const legacy = Array.isArray(data.ap_accounts) && data.ap_accounts.length
                ? patchList(data.ap_accounts)
                : teepublic;
            chrome.storage.local.set({ ap_accounts_teepublic: teepublic, ap_accounts: legacy }, () => resolve(true));
        });
    });
}

export async function actionSetAccountPhase(email, phase) {
    const normalizedPhase = String(phase || '').trim().toUpperCase();
    if (!normalizedPhase) return { ok: false, error: 'invalid_phase' };

    const stage = mapPhaseToStage(normalizedPhase);
    const cssKey = getPhaseCssKey(normalizedPhase);
    const sk = scheduleStorageKey(email);
    const scheduleMap = await loadScheduleMap([email]);
    const existing = scheduleMap[sk] || {};
    const updated = {
        ...existing,
        email: String(email || '').trim(),
        phase: normalizedPhase,
        stage,
        phaseSetManually: true,
        phaseSetAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    await new Promise((resolve) => {
        chrome.storage.local.set({ [sk]: updated }, resolve);
    });
    await patchAccountCreatyPhase(email, normalizedPhase);

    return { ok: true, phase: normalizedPhase, stage, cssKey };
}

export async function actionDeleteSchedule(email) {
    const key = scheduleStorageKey(email);
    await fetchCreatyJson('/orchestrate/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    }, 4000).catch(() => null);
    return new Promise((resolve) => {
        chrome.storage.local.remove(key, resolve);
    });
}

export async function actionRunStage(email, stageId) {
    const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'CREATY_AI_RUN_STAGE',
            email,
            accountEmail: email,
            stageId
        }, (response) => {
            const err = chrome.runtime.lastError;
            if (err) {
                resolve({ ok: false, error: err.message });
            } else {
                resolve(response);
            }
        });
    });
    if (res && res.success !== undefined && res.ok === undefined) {
        res.ok = res.success;
    }
    return res;
}

export async function actionStopStage(email, stageId) {
    const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'CREATY_AI_STOP_STAGE',
            email,
            accountEmail: email,
            stageId
        }, (response) => {
            const err = chrome.runtime.lastError;
            if (err) {
                resolve({ ok: false, error: err.message });
            } else {
                resolve(response);
            }
        });
    });
    if (res && res.success !== undefined && res.ok === undefined) {
        res.ok = res.success;
    }
    return res;
}

export async function actionResetStage(email, stageId) {
    const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'CREATY_AI_RESET_PHASE',
            email,
            accountEmail: email,
            stageId
        }, (response) => {
            const err = chrome.runtime.lastError;
            if (err) {
                resolve({ ok: false, error: err.message });
            } else {
                resolve(response);
            }
        });
    });
    if (res && res.success !== undefined && res.ok === undefined) {
        res.ok = res.success;
    }
    return res;
}

export function applyI18n(root, lang, i18n) {
    if (!root) return;
    root.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        const text = i18n[lang]?.[key];
        if (text) el.textContent = text;
    });
}
