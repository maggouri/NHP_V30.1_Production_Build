/**
 * Creaty Server — TeePublic account creation (port 3020)
 * Full pipeline: fill → submit → CAPTCHA → activation email → activate → DONE
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const extraNodePaths = [
    path.join(__dirname, 'node_modules'),
    path.join('C:', 'Users', 'maggouri', 'Desktop', '_ORGANIZED_NHP', 'Current', 'Niche Hunter Pro v9.0 Final 2026', 'node_modules'),
].filter((dir) => fs.existsSync(dir));

if (extraNodePaths.length) {
    process.env.NODE_PATH = [process.env.NODE_PATH, ...extraNodePaths].filter(Boolean).join(path.delimiter);
    Module._initPaths();
}

const express = require('express');
const { traceSignupPipeline, maskToken } = require('./creaty-signup-trace.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');

const {
    configureCreatyStealthPlugin,
    patchNavigatorWebdriver,
    buildGhostChromeLaunchArgs,
    createLaunchBrowserWithFallback,
    createStablePage: createStablePageBase,
} = require('./server/chrome-launch-shared');

const stealthPlugin = configureCreatyStealthPlugin(StealthPlugin);
puppeteer.use(stealthPlugin);

const {
    generateStealthProfile,
    generateSyntheticFingerprint,
    applyStealthProfile,
    applySyntheticFingerprint,
} = require('./server/browser-stealth-profile');
const profileClone = require('./server/profile-clone');

const orchestrator = require('./creaty-server-orchestrator');
const profileLock = require('./server/profile-browser-lock');

const app = express();
const PORT = Number(process.env.NHP_CREATY_PORT || process.env.PORT) || 3020;
const GHOST_PORT = Number(process.env.NHP_GHOST_PORT) || 3019;
const ROOT_DIR = __dirname;
const LOG_DIR = path.join(ROOT_DIR, 'server_logs');
const PROFILES_DIR = path.join(ROOT_DIR, 'server_profiles_creaty');
const GHOST_PROFILES_DIR = path.join(ROOT_DIR, 'server_profiles');
const PREVIEW_PROFILES_DIR = path.join(ROOT_DIR, 'server_profiles_creaty_preview');
const LOG_FILE = path.join(LOG_DIR, 'creaty-server.log');
const SIGNUP_TRACE_BUFFER_MAX = 80;
/** @type {Array<{ ts: string, stage: string, line: string }>} */
const signupTraceBuffer = [];
const SIGNUP_URL = 'https://www.teepublic.com/users/sign_up';
const SIGNUP_REFERRAL_URL = 'https://tee.pub/lic/kYzmK-N8hGk';
const LOGIN_URL = 'https://www.teepublic.com/users/sign_in';
const ACTIVATION_POLL_MS = 3000;
// @FROZEN registration-activation — edits require unlock key 693400 (see REGISTRATION_ACTIVATION_FROZEN.manifest.json)
const ACTIVATION_MAX_POLLS = 80;
const ACTIVATION_POLL_BACKOFF_MAX_MS = 30000;
const ACTIVATION_NAV_TIMEOUT_MS = 60000;
const ACTIVATION_NAV_RETRIES = 3;
let referralUrlCursor = 0;

[LOG_DIR, PROFILES_DIR, GHOST_PROFILES_DIR, PREVIEW_PROFILES_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors({ origin: true }));
app.use(express.json({ limit: '100mb' }));

/** @type {{ status: string, phase: string, email: string, message: string, stopRequested: boolean, startedAt: string|null, skipReason: string, filledFields: Record<string, boolean>, showBrowser: boolean, keepBrowserOpen: boolean }} */
const jobState = {
    status: 'idle',
    phase: 'IDLE',
    email: '',
    message: '',
    stopRequested: false,
    startedAt: null,
    skipReason: '',
    filledFields: {},
    showBrowser: true,
    keepBrowserOpen: false,
    clonedFromAut: false,
    browserLaunching: false,
    signupPageResolving: false,
    manualCloudflareContinue: false,
    ghostCompatMode: false,
    deferredActivation: false,
};

/** @type {{ sessionId: string, apiBase: string, token: string, userId: string, email?: string, inboxToken?: string }} */
let currentJobMeta = {
    sessionId: '',
    apiBase: '',
    token: '',
    userId: '',
    email: '',
    inboxToken: '',
};

const EMAILCORE_INBOX_SECRET = String(
    process.env.EMAILCORE_INBOX_SECRET
    || process.env.EXTENSION_BRIDGE_SECRET
    || process.env.SESSION_SECRET
    || 'emailcore-dev-secret-change-in-production'
).trim();
const EMAILCORE_INBOX_SCOPE = 'inbox';

const storeAutomationState = {
    status: 'idle',
    phase: 'IDLE',
    email: '',
    message: '',
    startedAt: null,
    finishedAt: null,
    error: '',
    result: null,
};

let activeSessionCardInfo = null;

function buildSharedSessionCardBootstrapScript(sessionInfo = {}) {
    const payload = JSON.stringify(sessionInfo || {}).replace(/</g, '\\u003c');
    const sessionCardSource = fs.readFileSync(path.join(ROOT_DIR, 'creaty-session-card.js'), 'utf8');
    const sourcePayload = JSON.stringify(sessionCardSource).replace(/</g, '\\u003c');
    return `
(() => {
    const bootstrapSession = ${payload};
    const sessionCardSource = ${sourcePayload};
    const STORAGE_KEY = 'nhp_session_info';
    const PROFILE_SYNC_KEY = 'creaty_last_store_profile_update';
    const listeners = [];
    const memoryStore = {
        [STORAGE_KEY]: bootstrapSession,
    };

    function clone(value) {
        try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
    }

    function emitStorageChange(key, oldValue, newValue) {
        const changes = { [key]: { oldValue: clone(oldValue), newValue: clone(newValue) } };
        listeners.forEach((listener) => {
            try { listener(changes, 'local'); } catch (_) {}
        });
    }

    function titleCaseWords(text) {
        return String(text || '')
            .trim()
            .split(/\\s+/)
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    function slugWords(text) {
        return String(text || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function buildLocalFallbackProfile(rawNiche) {
        const current = memoryStore[STORAGE_KEY] || bootstrapSession || {};
        const existing = current.storeProfile || {};
        const niches = ['Retro Gaming', 'Cute Pets', 'Anime Humor', 'Nature Hiking', 'Fitness Motivation', 'Music Lovers', 'Vintage Sports', 'Space Science'];
        const seed = String(current.email || 'creaty');
        let total = 0;
        for (let i = 0; i < seed.length; i += 1) total += seed.charCodeAt(i);
        const niche = titleCaseWords(rawNiche || existing.niche || niches[total % niches.length]);
        const mailName = String(current.email || '').split('@')[0] || 'creator';
        const handle = slugWords(mailName) || 'creator';
        const title = titleCaseWords(niche + ' Studio').slice(0, 60);
        return {
            title,
            bio: title + ' is a curated TeePublic shop focused on ' + niche.toLowerCase() + ' artwork, clean themed collections, and recognizable visual identity for fans of this niche.',
            niche,
            country: existing.country || 'United States',
            source: 'preview_local_fallback',
            links: {
                instagram: 'https://instagram.com/' + handle,
                twitter: 'https://x.com/' + handle,
                facebook: 'https://facebook.com/' + handle,
                pinterest: 'https://pinterest.com/' + handle,
            },
            socialLinks: {
                instagram: 'https://instagram.com/' + handle,
                twitter: 'https://x.com/' + handle,
                facebook: 'https://facebook.com/' + handle,
                pinterest: 'https://pinterest.com/' + handle,
            },
            imagePrompts: {
                avatar: 'Bold ' + niche + ' avatar icon, centered subject, premium merch branding.',
                cover: 'Wide ' + niche + ' banner art, panoramic layout, premium TeePublic store look.',
            },
            avatarDataUrl: existing.avatarDataUrl || null,
            coverDataUrl: existing.coverDataUrl || null,
            generatedAt: new Date().toISOString(),
        };
    }

    function callbackLater(callback, payload) {
        if (typeof callback === 'function') {
            setTimeout(() => callback(payload), 0);
        }
    }

    const chromeShim = window.chrome || {};
    const localStorageShim = chromeShim.storage && chromeShim.storage.local ? chromeShim.storage.local : {};
    localStorageShim.get = function(keys, callback) {
        let result = {};
        if (keys == null) {
            result = clone(memoryStore) || {};
        } else if (typeof keys === 'string') {
            result[keys] = clone(memoryStore[keys]);
        } else if (Array.isArray(keys)) {
            keys.forEach((key) => { result[key] = clone(memoryStore[key]); });
        } else if (typeof keys === 'object') {
            Object.keys(keys).forEach((key) => {
                result[key] = Object.prototype.hasOwnProperty.call(memoryStore, key) ? clone(memoryStore[key]) : keys[key];
            });
        }
        callbackLater(callback, result);
    };
    localStorageShim.set = function(items, callback) {
        Object.entries(items || {}).forEach(([key, value]) => {
            const oldValue = memoryStore[key];
            memoryStore[key] = clone(value);
            emitStorageChange(key, oldValue, value);
        });
        callbackLater(callback);
    };
    localStorageShim.remove = function(keys, callback) {
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((key) => {
            const oldValue = memoryStore[key];
            delete memoryStore[key];
            emitStorageChange(key, oldValue, undefined);
        });
        callbackLater(callback);
    };

    chromeShim.storage = chromeShim.storage || {};
    chromeShim.storage.local = localStorageShim;
    chromeShim.storage.onChanged = chromeShim.storage.onChanged || {
        addListener(listener) {
            if (typeof listener === 'function' && !listeners.includes(listener)) listeners.push(listener);
        },
        removeListener(listener) {
            const index = listeners.indexOf(listener);
            if (index >= 0) listeners.splice(index, 1);
        },
    };

    chromeShim.runtime = chromeShim.runtime || {};
    chromeShim.runtime.sendMessage = function(message, callback) {
        const request = message || {};
        const active = memoryStore[STORAGE_KEY] || bootstrapSession || {};

        if (request.action === 'CREATY_GET_ACTIVE_SESSION_CARD') {
            callbackLater(callback, { success: true, session: active });
            return;
        }

        if (request.action === 'CREATY_LOAD_STORE_PROFILE') {
            callbackLater(callback, { success: true, profile: active.storeProfile || null });
            return;
        }

        if (request.action === 'CREATY_SAVE_STORE_PROFILE') {
            const nextSession = { ...active, storeProfile: request.profile || {} };
            const oldSession = memoryStore[STORAGE_KEY];
            memoryStore[STORAGE_KEY] = nextSession;
            emitStorageChange(STORAGE_KEY, oldSession, nextSession);
            emitStorageChange(PROFILE_SYNC_KEY, null, {
                email: request.email || request.accountEmail || active.email || '',
                profile: nextSession.storeProfile,
                ts: Date.now(),
            });
            callbackLater(callback, { success: true, profile: nextSession.storeProfile });
            return;
        }

        if (request.action === 'CREATY_GENERATE_STORE') {
            const profile = buildLocalFallbackProfile(request.niche || active.storeProfile?.niche || '');
            const nextSession = { ...active, storeProfile: profile };
            const oldSession = memoryStore[STORAGE_KEY];
            memoryStore[STORAGE_KEY] = nextSession;
            emitStorageChange(STORAGE_KEY, oldSession, nextSession);
            callbackLater(callback, { success: true, profile, fallback: true });
            return;
        }

        callbackLater(callback, { success: false, error: 'unsupported_preview_action', action: request.action || '' });
    };
    window.chrome = chromeShim;
    window.nhpSessionInfo = bootstrapSession;

    const emitSession = () => {
        window.postMessage({
            type: 'NHP_RESPONSE_SESSION_INFO',
            detail: memoryStore[STORAGE_KEY] || bootstrapSession,
        }, '*');
    };
    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data || event.data.type !== 'nhp-request-session-info') return;
        emitSession();
    });
    setTimeout(emitSession, 0);

    function mountPersistentPreviewCard() {
        const session = memoryStore[STORAGE_KEY] || bootstrapSession || {};
        if (!session.email) return;
        if (!document.body || !document.head) {
            setTimeout(mountPersistentPreviewCard, 60);
            return;
        }
        const legacyCard = document.getElementById('nhp-creaty-session-card');
        if (legacyCard) legacyCard.remove();
        const legacyStyle = document.getElementById('nhp-creaty-session-card-styles');
        if (legacyStyle) legacyStyle.remove();

        const ROOT_ID = 'nhp-creaty-session-card-preview';
        const STYLE_ID = 'nhp-creaty-session-card-preview-style';
        const RESTORE_ID = 'nhp-creaty-session-card-restore';
        const STATE_KEY = 'nhp-creaty-session-card-preview-state';
        const PROFILE_KEY = 'nhp-creaty-session-card-preview-profile-' + String(session.email || 'account').toLowerCase();
        const WINDOW_STATE_PREFIX = '__NHP_CREATY_CARD_STATE__';
        const labels = {
            title: '\\u062c\\u0644\\u0633\\u0629 \\u062d\\u0633\\u0627\\u0628 Creaty',
            account: '\\u0627\\u0644\\u062d\\u0633\\u0627\\u0628',
            store: '\\u0627\\u0644\\u0645\\u062a\\u062c\\u0631',
            assets: '\\u0627\\u0644\\u0631\\u0648\\u0627\\u0628\\u0637 \\u0648\\u0627\\u0644\\u0635\\u0648\\u0631',
            ai: '\\u062a\\u0648\\u0644\\u064a\\u062f \\u0627\\u0644\\u0630\\u0643\\u0627\\u0621',
            email: '\\u0627\\u0644\\u0628\\u0631\\u064a\\u062f \\u0627\\u0644\\u0625\\u0644\\u0643\\u062a\\u0631\\u0648\\u0646\\u064a',
            password: '\\u0643\\u0644\\u0645\\u0629 \\u0627\\u0644\\u0645\\u0631\\u0648\\u0631',
            first: '\\u0627\\u0644\\u0627\\u0633\\u0645 \\u0627\\u0644\\u0623\\u0648\\u0644',
            last: '\\u0627\\u0644\\u0627\\u0633\\u0645 \\u0627\\u0644\\u0623\\u062e\\u064a\\u0631',
            storeName: '\\u0627\\u0633\\u0645 \\u0627\\u0644\\u0645\\u062a\\u062c\\u0631',
            niche: '\\u0627\\u0644\\u0646\\u064a\\u0634',
            bio: '\\u0646\\u0628\\u0630\\u0629 \\u0627\\u0644\\u0645\\u062a\\u062c\\u0631',
            empty: '-',
            done: '\\u062a\\u0645',
            ready: '\\u062c\\u0627\\u0647\\u0632',
            generate: '\\u062a\\u0648\\u0644\\u064a\\u062f \\u0627\\u0644\\u0647\\u0648\\u064a\\u0629',
        };
        function readWindowState() {
            const raw = String(window.name || '');
            if (!raw.startsWith(WINDOW_STATE_PREFIX)) return {};
            try {
                return JSON.parse(raw.slice(WINDOW_STATE_PREFIX.length)) || {};
            } catch (_) {
                return {};
            }
        }
        function writeWindowState(patch) {
            const next = { ...readWindowState(), ...(patch || {}) };
            try { window.name = WINDOW_STATE_PREFIX + JSON.stringify(next); } catch (_) {}
            return next;
        }
        function readState() {
            try {
                const local = JSON.parse(sessionStorage.getItem(STATE_KEY) || '{}') || {};
                return { ...(readWindowState().state || {}), ...local };
            } catch (_) {}
            return readWindowState().state || {};
        }
        function writeState(patch) {
            const next = { ...readState(), ...(patch || {}) };
            try { sessionStorage.setItem(STATE_KEY, JSON.stringify(next)); } catch (_) {}
            const win = readWindowState();
            writeWindowState({ ...win, state: next });
            return next;
        }
        function readSavedProfile() {
            try {
                const saved = JSON.parse(sessionStorage.getItem(PROFILE_KEY) || 'null');
                if (saved && typeof saved === 'object') return saved;
            } catch (_) {}
            const profiles = readWindowState().profiles || {};
            if (profiles[PROFILE_KEY] && typeof profiles[PROFILE_KEY] === 'object') return profiles[PROFILE_KEY];
            return session.storeProfile && typeof session.storeProfile === 'object' ? session.storeProfile : {};
        }
        function writeSavedProfile(profile) {
            const clean = profile && typeof profile === 'object' ? profile : {};
            session.storeProfile = clean;
            memoryStore[STORAGE_KEY] = session;
            try { sessionStorage.setItem(PROFILE_KEY, JSON.stringify(clean)); } catch (_) {}
            const win = readWindowState();
            writeWindowState({ ...win, profiles: { ...(win.profiles || {}), [PROFILE_KEY]: clean } });
            return clean;
        }

        function esc(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }
        function valueText(value) {
            const text = String(value == null ? '' : value).trim();
            return text || labels.empty;
        }
        function row(label, rawValue) {
            const shown = valueText(rawValue);
            const copy = shown === labels.empty ? '' : shown;
            return '<div class="nhp-pv-row"><div class="nhp-pv-label">' + esc(label) + '</div>'
                + '<div class="nhp-pv-wrap">'
                + '<button type="button" class="nhp-pv-mini" data-copy="' + esc(copy) + '">{..}</button>'
                + '<button type="button" class="nhp-pv-mini" data-copy="' + esc(copy) + '">\\u2398</button>'
                + '<div class="nhp-pv-value" dir="auto">' + esc(shown) + '</div>'
                + '</div></div>';
        }
        function removeRestoreButton() {
            const existing = document.getElementById(RESTORE_ID);
            if (existing) existing.remove();
        }
        function showRestoreButton() {
            if (document.getElementById(RESTORE_ID)) return;
            const btn = document.createElement('button');
            btn.id = RESTORE_ID;
            btn.type = 'button';
            btn.textContent = 'C';
            btn.title = 'Restore Creaty card';
            btn.addEventListener('click', () => {
                writeState({ closed: false, minimized: false });
                btn.remove();
                const old = document.getElementById(ROOT_ID);
                if (old) old.remove();
                mountPersistentPreviewCard();
            });
            document.body.appendChild(btn);
        }
        function applyCardState(root) {
            const state = readState();
            root.classList.toggle('is-minimized', state.minimized === true);
            root.classList.toggle('is-maximized', state.maximized === true);
            if (Number.isFinite(state.left) && Number.isFinite(state.top)) {
                root.style.left = Math.max(4, Math.min(state.left, window.innerWidth - 44)) + 'px';
                root.style.top = Math.max(4, Math.min(state.top, window.innerHeight - 44)) + 'px';
                root.style.right = 'auto';
            } else {
                root.style.top = '68px';
                root.style.right = '12px';
                root.style.left = 'auto';
            }
        }
        function titleCase(text) {
            return String(text || '')
                .replace(/[_-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase()
                .replace(/\b[a-z]/g, (m) => m.toUpperCase());
        }
        function inferNiche(manualValue) {
            const profileNow = readSavedProfile();
            const candidates = [
                manualValue,
                profileNow.niche,
                profileNow.mainTag,
                profileNow.category,
                profileNow.storeProfileSummary,
                profileNow.title,
                profileNow.storeTitle,
                profileNow.bio,
                session.storeProfileSummary,
                session.storeProfileTitle,
                session.storeName,
                session.nickname,
                session.displayName,
                session.display_name,
                String(session.email || '').split('@')[0],
            ].map((v) => String(v || '').trim()).filter(Boolean);
            const joined = candidates.join(' ').toLowerCase();
            const rules = [
                ['Technology', ['tech', 'technology', 'computer', 'coding', 'programming', 'gadget', 'retro pc']],
                ['Pet Lovers', ['pet', 'cat', 'dog', 'animal', 'puppy', 'kitten']],
                ['Gaming', ['game', 'gaming', 'gamer', 'console', 'arcade']],
                ['Anime', ['anime', 'manga', 'kawaii', 'otaku']],
                ['Fitness Motivation', ['fitness', 'gym', 'workout', 'yoga', 'running']],
                ['Music Lovers', ['music', 'guitar', 'band', 'dj', 'rock']],
                ['Nature Hiking', ['nature', 'hiking', 'camping', 'mountain', 'forest']],
                ['Funny Quotes', ['funny', 'humor', 'joke', 'sarcasm', 'meme']],
                ['Sports', ['sport', 'basketball', 'football', 'baseball', 'soccer']],
                ['Vintage Style', ['vintage', 'retro', 'nostalgia', 'classic']],
            ];
            for (const [label, words] of rules) {
                if (words.some((word) => joined.includes(word))) return label;
            }
            const firstUseful = candidates
                .map((item) => item.replace(/@.*$/, '').replace(/emailcore\.app/ig, '').replace(/[^a-z0-9\s_-]/ig, ' '))
                .map(titleCase)
                .find((item) => item && item.length >= 3 && !/^[a-z]+\d+$/i.test(item));
            return firstUseful || 'Creator Art';
        }
        function svgDataUrl(svg) {
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        }
        function makeAvatarDataUrl(niche, title) {
            const short = String(niche || 'Art').split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'C';
            return svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#4ade80"/><stop offset=".52" stop-color="#38bdf8"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs><rect width="500" height="500" rx="86" fill="#111827"/><circle cx="250" cy="210" r="138" fill="url(#g)" opacity=".95"/><circle cx="188" cy="184" r="20" fill="#fff"/><circle cx="312" cy="184" r="20" fill="#fff"/><path d="M168 290c48 48 116 48 164 0" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round"/><text x="250" y="430" font-family="Segoe UI,Arial,sans-serif" font-size="58" font-weight="900" text-anchor="middle" fill="#f8fafc">' + esc(short) + '</text><text x="250" y="466" font-family="Segoe UI,Arial,sans-serif" font-size="22" font-weight="700" text-anchor="middle" fill="#bbf7d0">' + esc(String(title || niche || 'Creaty').slice(0, 28)) + '</text></svg>');
        }
        function makeCoverDataUrl(niche, title) {
            return svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="480" viewBox="0 0 1920 480"><defs><linearGradient id="bg" x1="0" x2="1"><stop stop-color="#111827"/><stop offset=".5" stop-color="#312e81"/><stop offset="1" stop-color="#064e3b"/></linearGradient><radialGradient id="r" cx=".72" cy=".45" r=".5"><stop stop-color="#4ade80" stop-opacity=".9"/><stop offset="1" stop-color="#4ade80" stop-opacity="0"/></radialGradient></defs><rect width="1920" height="480" fill="url(#bg)"/><rect width="1920" height="480" fill="url(#r)"/><circle cx="1540" cy="120" r="190" fill="#38bdf8" opacity=".18"/><circle cx="260" cy="390" r="230" fill="#6366f1" opacity=".22"/><text x="120" y="205" font-family="Segoe UI,Arial,sans-serif" font-size="86" font-weight="900" fill="#f8fafc">' + esc(String(title || 'Creaty Studio').slice(0, 36)) + '</text><text x="124" y="300" font-family="Segoe UI,Arial,sans-serif" font-size="42" font-weight="800" fill="#bbf7d0">' + esc(String(niche || 'Creator Art').slice(0, 42)) + '</text><text x="124" y="372" font-family="Segoe UI,Arial,sans-serif" font-size="28" font-weight="700" fill="#cbd5e1">Original themed merch, curated collections, and clean visual identity.</text></svg>');
        }
        function renderImageRows(profileValue) {
            const avatar = profileValue.avatarDataUrl || '';
            const cover = profileValue.coverDataUrl || '';
            return '<div class="nhp-pv-images">'
                + '<button type="button" class="nhp-pv-image-box" data-copy-image="avatar">' + (avatar ? '<img src="' + esc(avatar) + '" alt="Avatar">' : '<span>Avatar</span>') + '</button>'
                + '<button type="button" class="nhp-pv-image-box is-cover" data-copy-image="cover">' + (cover ? '<img src="' + esc(cover) + '" alt="Cover">' : '<span>Cover</span>') + '</button>'
                + '</div>'
                + '<div class="nhp-pv-image-tools">'
                + '<select id="nhp-pv-image-target"><option value="avatar">Avatar</option><option value="cover">Cover</option></select>'
                + '<button type="button" id="nhp-pv-paste-image">Paste</button>'
                + '<label><input id="nhp-pv-file-image" type="file" accept="image/*"> File</label>'
                + '</div>'
                + '<div class="nhp-pv-status" id="nhp-pv-image-status">Paste an image here or click File.</div>';
        }

        if (!document.getElementById(STYLE_ID)) {
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = [
                '#' + ROOT_ID + '{position:fixed;top:68px;right:12px;z-index:2147483647;width:390px;max-width:calc(100vw - 24px);background:rgba(26,26,46,.82);color:#f1f5f9;border:1px solid rgba(74,222,128,.45);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.45);font:12.5px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;direction:rtl;text-align:right;overflow:hidden;backdrop-filter:blur(9px);opacity:.84;transition:opacity .16s ease,width .16s ease,height .16s ease}',
                '#' + ROOT_ID + ':hover{opacity:.97}',
                '#' + ROOT_ID + ' *{box-sizing:border-box}',
                '#' + ROOT_ID + '.is-minimized{width:48px;height:48px;border-radius:999px;cursor:pointer}',
                '#' + ROOT_ID + '.is-minimized .nhp-pv-tabs,#' + ROOT_ID + '.is-minimized .nhp-pv-body,#' + ROOT_ID + '.is-minimized .nhp-pv-title,#' + ROOT_ID + '.is-minimized .nhp-pv-controls{display:none}',
                '#' + ROOT_ID + '.is-minimized .nhp-pv-head{height:48px;padding:0;justify-content:center;cursor:pointer}',
                '#' + ROOT_ID + '.is-minimized .nhp-pv-head:before{content:"C";font-weight:900;color:#4ade80;font-size:18px}',
                '#' + ROOT_ID + '.is-maximized{width:min(620px,calc(100vw - 24px))}',
                '#' + RESTORE_ID + '{position:fixed;right:12px;top:68px;z-index:2147483647;width:38px;height:38px;border-radius:999px;border:1px solid rgba(74,222,128,.65);background:rgba(26,26,46,.78);color:#4ade80;font:800 15px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;box-shadow:0 6px 16px rgba(0,0,0,.42);cursor:pointer;backdrop-filter:blur(8px)}',
                '#' + ROOT_ID + ' .nhp-pv-head{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:rgba(15,23,42,.35);border-bottom:1px solid rgba(74,222,128,.16);cursor:move;user-select:none}',
                '#' + ROOT_ID + ' .nhp-pv-title{font-weight:800;color:#4ade80;font-size:13px}',
                '#' + ROOT_ID + ' .nhp-pv-controls{display:flex;align-items:center;gap:5px;direction:ltr}',
                '#' + ROOT_ID + ' .nhp-pv-control{width:24px;height:24px;border:0;border-radius:6px;background:rgba(255,255,255,.07);color:#cbd5e1;cursor:pointer;font-weight:900;line-height:1}',
                '#' + ROOT_ID + ' .nhp-pv-control:hover{background:rgba(255,255,255,.14);color:white}',
                '#' + ROOT_ID + ' .nhp-pv-control.is-close:hover{background:rgba(239,68,68,.22);color:#fecaca}',
                '#' + ROOT_ID + ' .nhp-pv-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:rgba(15,23,42,.25);border-bottom:1px solid rgba(255,255,255,.06)}',
                '#' + ROOT_ID + ' .nhp-pv-tab{border:0;background:transparent;color:#94a3b8;padding:8px 4px;font-weight:700;font-size:11px;cursor:pointer;border-bottom:2px solid transparent}',
                '#' + ROOT_ID + ' .nhp-pv-tab.is-active{color:#4ade80;border-bottom-color:#4ade80;background:rgba(74,222,128,.06)}',
                '#' + ROOT_ID + ' .nhp-pv-body{display:grid;gap:10px;padding:12px;max-height:58vh;overflow:auto}',
                '#' + ROOT_ID + ' .nhp-pv-row{display:grid;gap:4px}',
                '#' + ROOT_ID + ' .nhp-pv-label{color:#94a3b8;font-weight:700;font-size:11px}',
                '#' + ROOT_ID + ' .nhp-pv-wrap{display:grid;grid-template-columns:36px 36px minmax(0,1fr);border:1px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden;background:rgba(15,23,42,.35)}',
                '#' + ROOT_ID + ' .nhp-pv-value{padding:10px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
                '#' + ROOT_ID + ' .nhp-pv-mini{border:0;border-left:1px solid rgba(255,255,255,.08);background:rgba(15,23,42,.35);color:#a5b4fc;cursor:pointer;font-weight:800}',
                '#' + ROOT_ID + ' .nhp-pv-ai{display:grid;gap:8px}',
                '#' + ROOT_ID + ' .nhp-pv-ai input{width:100%;border:1px solid rgba(255,255,255,.12);background:#111827;color:#e5e7eb;border-radius:8px;padding:9px 10px}',
                '#' + ROOT_ID + ' .nhp-pv-ai button{border:0;border-radius:8px;background:#4f46e5;color:white;font-weight:800;padding:9px 10px;cursor:pointer}',
                '#' + ROOT_ID + ' .nhp-pv-status{color:#86efac;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.22);border-radius:8px;padding:8px 10px}',
                '#' + ROOT_ID + ' .nhp-pv-images{display:grid;grid-template-columns:92px minmax(0,1fr);gap:8px}',
                '#' + ROOT_ID + ' .nhp-pv-image-box{min-height:92px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;overflow:hidden;color:#94a3b8;font-weight:800;cursor:pointer;padding:0}',
                '#' + ROOT_ID + ' .nhp-pv-image-box.is-cover{min-height:92px}',
                '#' + ROOT_ID + ' .nhp-pv-image-box img{width:100%;height:100%;object-fit:cover;display:block}',
                '#' + ROOT_ID + ' .nhp-pv-image-tools{display:grid;grid-template-columns:1fr 72px 86px;gap:8px;align-items:center}',
                '#' + ROOT_ID + ' .nhp-pv-image-tools select,#' + ROOT_ID + ' .nhp-pv-image-tools button,#' + ROOT_ID + ' .nhp-pv-image-tools label{border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(15,23,42,.45);color:#e5e7eb;padding:8px 9px;font-weight:800;text-align:center;cursor:pointer}',
                '#' + ROOT_ID + ' .nhp-pv-image-tools input{display:none}',
            ].join('');
            document.head.appendChild(style);
        }

        let root = document.getElementById(ROOT_ID);
        const state = readState();
        if (state.closed === true) {
            if (root) root.remove();
            showRestoreButton();
            return;
        }
        removeRestoreButton();
        if (!root) {
            root = document.createElement('div');
            root.id = ROOT_ID;
            document.body.appendChild(root);
        }
        applyCardState(root);
        if (root.dataset.bound === '1') return;
        root.dataset.bound = '1';

        const initialProfile = readSavedProfile();
        if (initialProfile && Object.keys(initialProfile).length) writeSavedProfile(initialProfile);
        function buildSections() {
            const profile = readSavedProfile();
            const links = profile.links || profile.socialLinks || {};
            return {
                account: row(labels.email, session.email) + row(labels.password, session.password) + row(labels.first, session.firstName) + row(labels.last, session.lastName),
                store: row(labels.storeName, profile.title) + row(labels.niche, profile.niche) + row(labels.bio, profile.bio),
                assets: row('Pinterest', links.pinterest) + row('Instagram', links.instagram) + row('Twitter/X', links.twitter) + row('Facebook', links.facebook) + renderImageRows(profile),
                ai: '<div class="nhp-pv-ai"><input id="nhp-pv-niche" value="' + esc(profile.niche || '') + '" placeholder="Auto niche from account data"><button type="button" id="nhp-pv-generate">' + labels.generate + '</button><div class="nhp-pv-status" id="nhp-pv-status">' + labels.ready + '</div></div>',
            };
        }

        function render(tab) {
            const active = tab || root.dataset.tab || 'account';
            const sections = buildSections();
            root.dataset.tab = active;
            root.innerHTML = '<div class="nhp-pv-head" data-drag-handle="1"><div class="nhp-pv-title">' + labels.title + '</div><div class="nhp-pv-controls">'
                + '<button type="button" class="nhp-pv-control" data-card-action="min" title="Minimize">-</button>'
                + '<button type="button" class="nhp-pv-control" data-card-action="max" title="Resize">□</button>'
                + '<button type="button" class="nhp-pv-control is-close" data-card-action="close" title="Close">x</button>'
                + '</div></div>'
                + '<div class="nhp-pv-tabs">'
                + '<button class="nhp-pv-tab ' + (active === 'account' ? 'is-active' : '') + '" data-tab="account">' + labels.account + '</button>'
                + '<button class="nhp-pv-tab ' + (active === 'store' ? 'is-active' : '') + '" data-tab="store">' + labels.store + '</button>'
                + '<button class="nhp-pv-tab ' + (active === 'assets' ? 'is-active' : '') + '" data-tab="assets">' + labels.assets + '</button>'
                + '<button class="nhp-pv-tab ' + (active === 'ai' ? 'is-active' : '') + '" data-tab="ai">' + labels.ai + '</button>'
                + '</div><div class="nhp-pv-body">' + (sections[active] || sections.account) + '</div>';
            root.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => render(button.getAttribute('data-tab') || 'account')));
            root.querySelectorAll('[data-card-action]').forEach((button) => button.addEventListener('click', (event) => {
                event.stopPropagation();
                const action = button.getAttribute('data-card-action');
                const current = readState();
                if (action === 'min') {
                    writeState({ minimized: !current.minimized });
                    applyCardState(root);
                    return;
                }
                if (action === 'max') {
                    writeState({ maximized: !current.maximized, minimized: false });
                    applyCardState(root);
                    return;
                }
                if (action === 'close') {
                    writeState({ closed: true });
                    root.remove();
                    showRestoreButton();
                }
            }));
            root.querySelector('.nhp-pv-head')?.addEventListener('click', () => {
                if (!root.classList.contains('is-minimized')) return;
                writeState({ minimized: false });
                applyCardState(root);
            });
            root.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
                const copyValue = String(button.getAttribute('data-copy') || '');
                if (!copyValue) return;
                try {
                    await navigator.clipboard.writeText(copyValue);
                    const old = button.textContent;
                    button.textContent = labels.done;
                    setTimeout(() => { button.textContent = old; }, 800);
                } catch (_) {}
            }));
            async function blobToDataUrl(blob) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            }
            function setImageOnProfile(target, dataUrl) {
                if (!dataUrl) return;
                const currentProfile = readSavedProfile();
                const next = {
                    ...currentProfile,
                    [target === 'cover' ? 'coverDataUrl' : 'avatarDataUrl']: dataUrl,
                    updatedAt: new Date().toISOString(),
                };
                writeSavedProfile(next);
                const status = document.getElementById('nhp-pv-image-status');
                if (status) status.textContent = target === 'cover' ? 'Cover saved' : 'Avatar saved';
                render('assets');
            }
            async function pasteImageFromClipboard() {
                const target = String(root.querySelector('#nhp-pv-image-target')?.value || 'avatar');
                try {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                        const type = item.types.find((kind) => kind.startsWith('image/'));
                        if (!type) continue;
                        const blob = await item.getType(type);
                        setImageOnProfile(target, await blobToDataUrl(blob));
                        return true;
                    }
                } catch (_) {}
                const status = document.getElementById('nhp-pv-image-status');
                if (status) status.textContent = 'No image found in clipboard';
                return false;
            }
            root.querySelector('#nhp-pv-paste-image')?.addEventListener('click', pasteImageFromClipboard);
            root.querySelector('#nhp-pv-file-image')?.addEventListener('change', async (event) => {
                const file = event.target?.files?.[0];
                const target = String(root.querySelector('#nhp-pv-image-target')?.value || 'avatar');
                if (file) setImageOnProfile(target, await blobToDataUrl(file));
            });
            root.querySelectorAll('[data-copy-image]').forEach((button) => button.addEventListener('click', async () => {
                const profileForImage = readSavedProfile();
                const kind = button.getAttribute('data-copy-image') || 'avatar';
                const dataUrl = kind === 'cover' ? profileForImage.coverDataUrl : profileForImage.avatarDataUrl;
                if (!dataUrl) return;
                try {
                    const blob = await (await fetch(dataUrl)).blob();
                    await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
                } catch (_) {
                    try { await navigator.clipboard.writeText(dataUrl); } catch (_) {}
                }
            }));
            root.addEventListener('paste', async (event) => {
                const file = Array.from(event.clipboardData?.items || [])
                    .map((item) => item.kind === 'file' ? item.getAsFile() : null)
                    .find((fileItem) => fileItem && fileItem.type.startsWith('image/'));
                if (!file) return;
                event.preventDefault();
                const target = String(root.querySelector('#nhp-pv-image-target')?.value || 'avatar');
                setImageOnProfile(target, await blobToDataUrl(file));
            });
            const generate = root.querySelector('#nhp-pv-generate');
            if (generate) {
                generate.addEventListener('click', () => {
                    const status = root.querySelector('#nhp-pv-status');
                    if (status) status.textContent = labels.done;
                    const profile = readSavedProfile();
                    const nicheInput = root.querySelector('#nhp-pv-niche');
                    const niche = inferNiche(nicheInput?.value || '');
                    const handle = String(session.email || 'creator').split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'creator';
                    const title = (niche + ' Studio').slice(0, 60);
                    const generatedProfile = {
                        ...profile,
                        title,
                        niche,
                        country: profile.country || 'United States',
                        source: 'preview_ai',
                        bio: title + ' is a curated TeePublic shop focused on ' + niche.toLowerCase() + ' artwork, clean themed collections, and recognizable visual identity.',
                        links: {
                            instagram: 'https://instagram.com/' + handle,
                            twitter: 'https://x.com/' + handle,
                            facebook: 'https://facebook.com/' + handle,
                            pinterest: 'https://pinterest.com/' + handle,
                        },
                        socialLinks: {
                            instagram: 'https://instagram.com/' + handle,
                            twitter: 'https://x.com/' + handle,
                            facebook: 'https://facebook.com/' + handle,
                            pinterest: 'https://pinterest.com/' + handle,
                        },
                        avatarDataUrl: profile.avatarDataUrl || makeAvatarDataUrl(niche, title),
                        coverDataUrl: profile.coverDataUrl || makeCoverDataUrl(niche, title),
                        generatedAt: new Date().toISOString(),
                    };
                    writeSavedProfile(generatedProfile);
                    setTimeout(() => render('store'), 250);
                });
            }
        }
        render(root.dataset.tab || 'account');
        if (root.dataset.dragBound !== '1') {
            root.dataset.dragBound = '1';
            let dragging = false;
            let startX = 0;
            let startY = 0;
            let startLeft = 0;
            let startTop = 0;
            root.addEventListener('mousedown', (event) => {
                if (!event.target.closest('[data-drag-handle]') || event.target.closest('button')) return;
                const rect = root.getBoundingClientRect();
                dragging = true;
                startX = event.clientX;
                startY = event.clientY;
                startLeft = rect.left;
                startTop = rect.top;
                event.preventDefault();
            });
            window.addEventListener('mousemove', (event) => {
                if (!dragging) return;
                const nextLeft = Math.max(4, Math.min(startLeft + event.clientX - startX, window.innerWidth - 44));
                const nextTop = Math.max(4, Math.min(startTop + event.clientY - startY, window.innerHeight - 44));
                root.style.left = nextLeft + 'px';
                root.style.top = nextTop + 'px';
                root.style.right = 'auto';
            });
            window.addEventListener('mouseup', () => {
                if (!dragging) return;
                dragging = false;
                const rect = root.getBoundingClientRect();
                writeState({ left: rect.left, top: rect.top });
            });
        }
    }

    mountPersistentPreviewCard();
    document.addEventListener('DOMContentLoaded', mountPersistentPreviewCard);
    window.addEventListener('load', mountPersistentPreviewCard);
    window.addEventListener('pageshow', mountPersistentPreviewCard);
    setInterval(mountPersistentPreviewCard, 1200);

    function injectSharedCardSource() {
        // The preview window now uses the persistent in-page card above.
        // Keep the shared extension card disabled here to avoid showing two cards.
        window.__NHP_CREATY_PREVIEW_CARD_LOADED__ = true;
    }

    try {
        injectSharedCardSource();
    } catch (err) {
        console.error('[CREATY preview card] failed to load shared session card', err);
    }
})();
`;
    return `
(() => {
    const sessionInfo = ${payload};
    const ROOT_ID = 'nhp-creaty-session-card-inline';
    const STYLE_ID = 'nhp-creaty-session-card-inline-styles';
    const STORAGE_KEY = 'nhp-creaty-session-card-inline-min';

    function safe(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function imageBox(label, dataUrl, wide) {
        if (!dataUrl) return '<div class="nhp-card-image-empty">' + label + '</div>';
        return '<img src="' + safe(dataUrl) + '" alt="' + safe(label) + '"' + (wide ? ' class="is-wide"' : '') + '>';
    }

    function mount() {
        if (!sessionInfo || !sessionInfo.email) return;
        if (!document.documentElement) {
            setTimeout(mount, 80);
            return;
        }
        if (!document.head) {
            const head = document.createElement('head');
            document.documentElement.insertBefore(head, document.body || null);
        }
        if (!document.body) {
            setTimeout(mount, 80);
            return;
        }
        if (!document.getElementById(STYLE_ID)) {
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = [
                '#' + ROOT_ID + '{position:fixed;top:72px;right:14px;z-index:2147483647;width:360px;max-width:calc(100vw - 28px);background:rgba(10,14,26,.97);color:#e5eefc;border:1px solid rgba(96,165,250,.35);border-radius:14px;box-shadow:0 16px 42px rgba(0,0,0,.45);overflow:hidden;font:12px/1.45 Segoe UI,Tahoma,sans-serif;direction:rtl;text-align:right}',
                '#' + ROOT_ID + '.is-collapsed{width:58px;height:58px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}',
                '#' + ROOT_ID + ' *{box-sizing:border-box}',
                '#' + ROOT_ID + ' .nhp-card-bag{display:none;font-size:22px}',
                '#' + ROOT_ID + '.is-collapsed .nhp-card-bag{display:block}',
                '#' + ROOT_ID + '.is-collapsed .nhp-card-head,#' + ROOT_ID + '.is-collapsed .nhp-card-body{display:none}',
                '#' + ROOT_ID + ' .nhp-card-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08)}',
                '#' + ROOT_ID + ' .nhp-card-title{font-weight:800;color:#86efac;font-size:12px}',
                '#' + ROOT_ID + ' .nhp-card-actions{display:flex;gap:6px}',
                '#' + ROOT_ID + ' .nhp-card-btn{border:none;background:rgba(255,255,255,.08);color:#dbeafe;border-radius:8px;padding:5px 8px;cursor:pointer;font-size:11px}',
                '#' + ROOT_ID + ' .nhp-card-btn.is-danger:hover{background:rgba(239,68,68,.22);color:#fecaca}',
                '#' + ROOT_ID + ' .nhp-card-body{padding:12px;display:grid;gap:10px}',
                '#' + ROOT_ID + ' .nhp-card-row{display:grid;gap:4px}',
                '#' + ROOT_ID + ' .nhp-card-label{font-size:10px;color:#93c5fd;font-weight:700}',
                '#' + ROOT_ID + ' .nhp-card-value-wrap{display:flex;align-items:center;gap:6px}',
                '#' + ROOT_ID + ' .nhp-card-value{flex:1;background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:7px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
                '#' + ROOT_ID + ' .nhp-copy-btn{border:none;background:rgba(74,222,128,.14);color:#86efac;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:10px;font-weight:700}',
                '#' + ROOT_ID + ' .nhp-card-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
                '#' + ROOT_ID + ' .nhp-card-pill{background:rgba(59,130,246,.14);border:1px solid rgba(96,165,250,.22);border-radius:10px;padding:8px;min-height:58px}',
                '#' + ROOT_ID + ' .nhp-card-pill strong{display:block;color:#93c5fd;font-size:10px;margin-bottom:4px}',
                '#' + ROOT_ID + ' .nhp-card-images{display:grid;grid-template-columns:92px 1fr;gap:8px}',
                '#' + ROOT_ID + ' .nhp-card-image{background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden;min-height:72px;display:flex;align-items:center;justify-content:center}',
                '#' + ROOT_ID + ' .nhp-card-image img{width:100%;height:100%;object-fit:cover;display:block}',
                '#' + ROOT_ID + ' .nhp-card-image.is-cover{min-height:72px}',
                '#' + ROOT_ID + ' .nhp-card-image-empty{color:#94a3b8;font-size:10px;padding:8px;text-align:center}'
            ].join('');
            document.head.appendChild(style);
        }

        let root = document.getElementById(ROOT_ID);
        if (!root) {
            root = document.createElement('div');
            root.id = ROOT_ID;
            document.body.appendChild(root);
        }
        const profile = sessionInfo.storeProfile || {};
        const collapsed = sessionStorage.getItem(STORAGE_KEY) === '1';
        root.className = collapsed ? 'is-collapsed' : '';
        root.innerHTML = ''
            + '<div class="nhp-card-bag">📁</div>'
            + '<div class="nhp-card-head">'
            + '  <div class="nhp-card-title">حقيبة جلسة الحساب</div>'
            + '  <div class="nhp-card-actions">'
            + '    <button type="button" class="nhp-card-btn" data-action="toggle">' + (collapsed ? 'فتح' : 'تصغير') + '</button>'
            + '    <button type="button" class="nhp-card-btn is-danger" data-action="close">إغلاق</button>'
            + '  </div>'
            + '</div>'
            + '<div class="nhp-card-body">'
            + '  <div class="nhp-card-row"><div class="nhp-card-label">البريد</div><div class="nhp-card-value-wrap"><div class="nhp-card-value" dir="ltr">' + safe(sessionInfo.email || '') + '</div><button type="button" class="nhp-copy-btn" data-copy="' + safe(sessionInfo.email || '') + '">نسخ</button></div></div>'
            + '  <div class="nhp-card-row"><div class="nhp-card-label">كلمة المرور</div><div class="nhp-card-value-wrap"><div class="nhp-card-value" dir="ltr">' + safe(sessionInfo.password || '') + '</div><button type="button" class="nhp-copy-btn" data-copy="' + safe(sessionInfo.password || '') + '">نسخ</button></div></div>'
            + '  <div class="nhp-card-meta">'
            + '    <div class="nhp-card-pill"><strong>الاسم الأول</strong><span>' + safe(sessionInfo.firstName || '-') + '</span></div>'
            + '    <div class="nhp-card-pill"><strong>الاسم الأخير</strong><span>' + safe(sessionInfo.lastName || '-') + '</span></div>'
            + '    <div class="nhp-card-pill"><strong>اسم المتجر</strong><span>' + safe(profile.title || '-') + '</span></div>'
            + '    <div class="nhp-card-pill"><strong>النيش</strong><span>' + safe(profile.niche || '-') + '</span></div>'
            + '  </div>'
            + '  <div class="nhp-card-images">'
            + '    <div class="nhp-card-image">' + imageBox('Avatar', profile.avatarDataUrl, false) + '</div>'
            + '    <div class="nhp-card-image is-cover">' + imageBox('Cover', profile.coverDataUrl, true) + '</div>'
            + '  </div>'
            + '</div>';

        root.querySelectorAll('.nhp-copy-btn').forEach((btn) => {
            btn.onclick = async () => {
                const value = String(btn.getAttribute('data-copy') || '');
                if (!value) return;
                try {
                    await navigator.clipboard.writeText(value);
                    const prev = btn.textContent;
                    btn.textContent = 'تم';
                    setTimeout(() => { btn.textContent = prev; }, 900);
                } catch (_) {}
            };
        });
        root.querySelector('[data-action="toggle"]')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const next = !root.classList.contains('is-collapsed');
            sessionStorage.setItem(STORAGE_KEY, next ? '1' : '0');
            mount();
        });
        root.querySelector('[data-action="close"]')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            root.remove();
        });
        root.onclick = () => {
            if (!root.classList.contains('is-collapsed')) return;
            sessionStorage.setItem(STORAGE_KEY, '0');
            mount();
        };
    }

    mount();
    document.addEventListener('DOMContentLoaded', mount, { once: true });
    window.addEventListener('load', mount, { once: true });
    window.addEventListener('pageshow', mount, { once: true });
})();
`;
}

function buildFloatingSessionCardBootstrapScript(sessionInfo = {}) {
    return buildSharedSessionCardBootstrapScript(sessionInfo);
    const payload = JSON.stringify(sessionInfo || {}).replace(/</g, '\\u003c');
    return `
(() => {
    const sessionInfo = ${payload};
    const ROOT_ID = 'nhp-creaty-session-card-inline';
    const STYLE_ID = 'nhp-creaty-session-card-inline-styles';
    const STORAGE_KEY = 'nhp-creaty-session-card-inline-min';
    let activeTab = 'account';
    let bridgeSeq = 0;

    function safe(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function asText(v, fallback = '-') {
        const value = String(v == null ? '' : v).trim();
        return value || fallback;
    }

    function getProfile() {
        if (!sessionInfo.storeProfile || typeof sessionInfo.storeProfile !== 'object') {
            sessionInfo.storeProfile = {};
        }
        return sessionInfo.storeProfile;
    }

    function imageBox(label, dataUrl, wide) {
        if (!dataUrl) {
            return '<div class="nhp-card-image-empty"><span>' + safe(label) + '</span></div>';
        }
        return '<img src="' + safe(dataUrl) + '" alt="' + safe(label) + '"' + (wide ? ' class="is-wide"' : '') + '>';
    }

    function row(label, value, copy) {
        const text = asText(value, '-');
        return ''
            + '<div class="nhp-card-row">'
            + '  <div class="nhp-card-label">' + safe(label) + '</div>'
            + '  <div class="nhp-card-value-wrap">'
            + '    <div class="nhp-card-value' + (copy ? ' nhp-copyable' : '') + '" dir="auto"' + (copy ? ' data-copy="' + safe(text) + '"' : '') + '>' + safe(text) + '</div>'
            +      (copy ? '<button type="button" class="nhp-copy-btn" data-copy="' + safe(text) + '">\\u0646\\u0633\\u062e</button>' : '')
            + '  </div>'
            + '</div>';
    }

    function linkRow(label, value) {
        const text = String(value == null ? '' : value).trim();
        if (!text) {
            return ''
                + '<div class="nhp-card-link">'
                + '  <strong>' + safe(label) + '</strong>'
                + '  <div class="nhp-card-link-main"><span>-</span><button type="button" class="nhp-copy-btn nhp-copy-btn-link" disabled>\\u0646\\u0633\\u062e</button></div>'
                + '</div>';
        }
        return ''
            + '<div class="nhp-card-link">'
            + '  <strong>' + safe(label) + '</strong>'
            + '  <div class="nhp-card-link-main">'
            + '    <a class="nhp-copyable" data-copy="' + safe(text) + '" href="' + safe(text) + '" target="_blank" rel="noopener noreferrer">' + safe(text) + '</a>'
            + '    <button type="button" class="nhp-copy-btn nhp-copy-btn-link" data-copy="' + safe(text) + '">\\u0646\\u0633\\u062e</button>'
            + '  </div>'
            + '</div>';
    }

    function isSuccess(response) {
        return !!(response && (response.ok || response.success));
    }

    function titleCaseWords(text) {
        return String(text || '')
            .trim()
            .split(/\\s+/)
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    function slugWords(text) {
        return String(text || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function inferLocalNiche(seedText) {
        const niches = ['Retro Gaming', 'Cute Pets', 'Anime Humor', 'Nature Hiking', 'Fitness Motivation', 'Music Lovers', 'Vintage Sports', 'Space Science'];
        const seed = String(seedText || sessionInfo.email || 'creaty');
        let total = 0;
        for (let i = 0; i < seed.length; i += 1) total += seed.charCodeAt(i);
        return niches[total % niches.length];
    }

    function buildLocalFallbackProfile(rawNiche) {
        const niche = titleCaseWords(rawNiche || getProfile().niche || inferLocalNiche());
        const mailName = String(sessionInfo.email || '').split('@')[0] || 'creator';
        const handle = slugWords(mailName) || 'creator';
        const title = titleCaseWords(niche + ' Studio').slice(0, 60);
        return {
            title,
            bio: title + ' is a curated TeePublic shop focused on ' + niche.toLowerCase() + ' artwork, clean themed collections, and recognizable visual identity for fans of this niche.',
            niche,
            country: 'United States',
            source: 'local_fallback',
            links: {
                instagram: 'https://instagram.com/' + handle,
                twitter: 'https://x.com/' + handle,
                facebook: 'https://facebook.com/' + handle,
                pinterest: 'https://pinterest.com/' + handle,
            },
            socialLinks: {
                instagram: 'https://instagram.com/' + handle,
                twitter: 'https://x.com/' + handle,
                facebook: 'https://facebook.com/' + handle,
                pinterest: 'https://pinterest.com/' + handle,
            },
            imagePrompts: {
                avatar: 'Bold ' + niche + ' avatar icon, centered subject, premium merch branding.',
                cover: 'Wide ' + niche + ' banner art, panoramic layout, premium TeePublic store look.',
            },
            avatarDataUrl: getProfile().avatarDataUrl || null,
            coverDataUrl: getProfile().coverDataUrl || null,
            generatedAt: new Date().toISOString(),
        };
    }

    function bridge(action, payload) {
        return new Promise((resolve) => {
            const requestId = 'nhp-creaty-bridge-' + (++bridgeSeq) + '-' + Date.now();
            const timer = setTimeout(() => {
                window.removeEventListener('message', onMessage);
                resolve({ ok: false, error: 'timeout' });
            }, 15000);

            function onMessage(event) {
                const data = event && event.data;
                if (!data || data.type !== 'NHP_CREATY_SESSION_BRIDGE_RESPONSE' || data.requestId !== requestId) return;
                clearTimeout(timer);
                window.removeEventListener('message', onMessage);
                const raw = data.response && typeof data.response === 'object' ? data.response : data;
                resolve(raw || {});
            }

            window.addEventListener('message', onMessage);
            window.postMessage({
                type: 'NHP_CREATY_SESSION_BRIDGE_REQUEST',
                requestId,
                action,
                payload: payload || {},
            }, '*');
        });
    }

    function renderTabContent() {
        const profile = getProfile();
        const social = profile.socialLinks || profile.links || {};

        if (activeTab === 'store') {
            return ''
                + '<div class="nhp-card-grid">'
                + '  <div class="nhp-card-pill"><strong>\\u0627\\u0633\\u0645 \\u0627\\u0644\\u0645\\u062a\\u062c\\u0631</strong><span class="nhp-copyable" data-copy="' + safe(asText(profile.title)) + '">' + safe(asText(profile.title)) + '</span></div>'
                + '  <div class="nhp-card-pill"><strong>\\u0627\\u0644\\u0646\\u064a\\u0634</strong><span class="nhp-copyable" data-copy="' + safe(asText(profile.niche)) + '">' + safe(asText(profile.niche)) + '</span></div>'
                + '  <div class="nhp-card-pill"><strong>\\u0627\\u0644\\u0628\\u0644\\u062f</strong><span class="nhp-copyable" data-copy="' + safe(asText(profile.country)) + '">' + safe(asText(profile.country)) + '</span></div>'
                + '  <div class="nhp-card-pill"><strong>\\u0627\\u0644\\u0645\\u0635\\u062f\\u0631</strong><span class="nhp-copyable" data-copy="' + safe(asText(profile.source)) + '">' + safe(asText(profile.source)) + '</span></div>'
                + '</div>'
                + '<div class="nhp-card-row">'
                + '  <div class="nhp-card-label">\\u0646\\u0628\\u0630\\u0629 \\u0627\\u0644\\u0645\\u062a\\u062c\\u0631</div>'
                + '  <div class="nhp-card-bio nhp-copyable" data-copy="' + safe(asText(profile.bio, '-')) + '">' + safe(asText(profile.bio, '-')) + '</div>'
                + '</div>';
        }

        if (activeTab === 'assets') {
            return ''
                + '<div class="nhp-card-links">'
                +       linkRow('Instagram', social.instagram)
                +       linkRow('Twitter/X', social.twitter)
                +       linkRow('Facebook', social.facebook)
                +       linkRow('Pinterest', social.pinterest)
                + '</div>'
                + '<div class="nhp-card-images-grid">'
                + '  <div class="nhp-card-image is-avatar">' + imageBox('Avatar', profile.avatarDataUrl, false) + '</div>'
                + '  <div class="nhp-card-image is-cover">' + imageBox('Cover', profile.coverDataUrl, true) + '</div>'
                + '</div>';
        }

        if (activeTab === 'ai') {
            return ''
                + '<div class="nhp-ai-box">'
                + '  <label class="nhp-card-label" for="nhp-card-ai-niche">\\u0646\\u064a\\u0634 \\u0627\\u0644\\u062a\\u0648\\u0644\\u064a\\u062f</label>'
                + '  <input id="nhp-card-ai-niche" class="nhp-ai-input" type="text" value="' + safe(profile.niche || '') + '" placeholder="Pets, Gaming, Anime...">'
                + '  <label class="nhp-ai-check"><input id="nhp-card-ai-images" type="checkbox"' + (profile.avatarDataUrl || profile.coverDataUrl ? ' checked' : '') + '> <span>\\u062a\\u0636\\u0645\\u064a\\u0646 \\u0635\\u0648\\u0631 Avatar/Cover</span></label>'
                + '  <div class="nhp-ai-actions">'
                + '    <button type="button" class="nhp-card-btn nhp-card-btn-primary" data-action="generate-ai">\\u062a\\u0648\\u0644\\u064a\\u062f \\u0628\\u0627\\u0644\\u0630\\u0643\\u0627\\u0621</button>'
                + '    <button type="button" class="nhp-card-btn" data-action="reload-profile">\\u062a\\u062d\\u062f\\u064a\\u062b \\u0627\\u0644\\u0628\\u064a\\u0627\\u0646\\u0627\\u062a</button>'
                + '    <button type="button" class="nhp-card-btn" data-action="save-profile">\\u062d\\u0641\\u0638 \\u0627\\u0644\\u0645\\u0644\\u0641</button>'
                + '  </div>'
                + '  <div class="nhp-ai-status" id="nhp-card-ai-status">\\u062c\\u0627\\u0647\\u0632</div>'
                + '</div>';
        }

        return ''
            + row('\\u0627\\u0644\\u0628\\u0631\\u064a\\u062f', sessionInfo.email || '', true)
            + row('\\u0643\\u0644\\u0645\\u0629 \\u0627\\u0644\\u0645\\u0631\\u0648\\u0631', sessionInfo.password || '', true)
            + '<div class="nhp-card-grid">'
            + '  <div class="nhp-card-pill"><strong>\\u0627\\u0644\\u0627\\u0633\\u0645 \\u0627\\u0644\\u0623\\u0648\\u0644</strong><span class="nhp-copyable" data-copy="' + safe(asText(sessionInfo.firstName)) + '">' + safe(asText(sessionInfo.firstName)) + '</span></div>'
            + '  <div class="nhp-card-pill"><strong>\\u0627\\u0644\\u0627\\u0633\\u0645 \\u0627\\u0644\\u0623\\u062e\\u064a\\u0631</strong><span class="nhp-copyable" data-copy="' + safe(asText(sessionInfo.lastName)) + '">' + safe(asText(sessionInfo.lastName)) + '</span></div>'
            + '  <div class="nhp-card-pill"><strong>\\u0627\\u0633\\u0645 \\u0627\\u0644\\u0645\\u062a\\u062c\\u0631</strong><span class="nhp-copyable" data-copy="' + safe(asText(profile.title)) + '">' + safe(asText(profile.title)) + '</span></div>'
            + '  <div class="nhp-card-pill"><strong>\\u0627\\u0644\\u0646\\u064a\\u0634</strong><span class="nhp-copyable" data-copy="' + safe(asText(profile.niche)) + '">' + safe(asText(profile.niche)) + '</span></div>'
            + '</div>';
    }

    function renderRoot() {
        const collapsed = sessionStorage.getItem(STORAGE_KEY) === '1';
        return ''
            + '<div class="nhp-card-bag">\\u25a3</div>'
            + '<div class="nhp-card-head">'
            + '  <div class="nhp-card-title">\\u062d\\u0642\\u064a\\u0628\\u0629 \\u062c\\u0644\\u0633\\u0629 \\u0627\\u0644\\u062d\\u0633\\u0627\\u0628</div>'
            + '  <div class="nhp-card-actions">'
            + '    <button type="button" class="nhp-card-btn" data-action="toggle">' + (collapsed ? '\\u0641\\u062a\\u062d' : '\\u062a\\u0635\\u063a\\u064a\\u0631') + '</button>'
            + '    <button type="button" class="nhp-card-btn is-danger" data-action="close">\\u0625\\u063a\\u0644\\u0627\\u0642</button>'
            + '  </div>'
            + '</div>'
            + '<div class="nhp-card-body">'
            + '  <div class="nhp-card-tabs">'
            + '    <button type="button" class="nhp-card-tab' + (activeTab === 'account' ? ' is-active' : '') + '" data-tab="account">\\u0627\\u0644\\u062d\\u0633\\u0627\\u0628</button>'
            + '    <button type="button" class="nhp-card-tab' + (activeTab === 'store' ? ' is-active' : '') + '" data-tab="store">\\u0627\\u0644\\u0645\\u062a\\u062c\\u0631</button>'
            + '    <button type="button" class="nhp-card-tab' + (activeTab === 'assets' ? ' is-active' : '') + '" data-tab="assets">\\u0627\\u0644\\u0623\\u0635\\u0648\\u0644</button>'
            + '    <button type="button" class="nhp-card-tab' + (activeTab === 'ai' ? ' is-active' : '') + '" data-tab="ai">AI</button>'
            + '  </div>'
            + '  <div class="nhp-card-tabpanel">' + renderTabContent() + '</div>'
            + '</div>';
    }

    function setStatus(root, text, isError) {
        const el = root && root.querySelector('#nhp-card-ai-status');
        if (!el) return;
        el.textContent = text;
        el.className = isError ? 'nhp-ai-status is-error' : 'nhp-ai-status';
    }

    async function handleAction(root, action) {
        const profile = getProfile();

        if (action === 'reload-profile') {
            setStatus(root, '\\u062c\\u0627\\u0631\\u064a \\u062a\\u062d\\u062f\\u064a\\u062b \\u0628\\u064a\\u0627\\u0646\\u0627\\u062a \\u0627\\u0644\\u0645\\u062a\\u062c\\u0631...', false);
            const response = await bridge('load_profile', { email: sessionInfo.email });
            if (!isSuccess(response)) {
                setStatus(root, '\\u062a\\u0639\\u0630\\u0631 \\u062a\\u062d\\u062f\\u064a\\u062b \\u0627\\u0644\\u0645\\u0644\\u0641', true);
                return;
            }
            sessionInfo.storeProfile = response.profile || profile;
            activeTab = 'store';
            mount();
            const freshRoot = document.getElementById(ROOT_ID);
            setStatus(freshRoot || root, '\\u062a\\u0645 \\u062a\\u062d\\u062f\\u064a\\u062b \\u0628\\u064a\\u0627\\u0646\\u0627\\u062a \\u0627\\u0644\\u0645\\u062a\\u062c\\u0631', false);
            return;
        }

        if (action === 'save-profile') {
            setStatus(root, '\\u062c\\u0627\\u0631\\u064a \\u062d\\u0641\\u0638 \\u0627\\u0644\\u0645\\u0644\\u0641...', false);
            const response = await bridge('save_profile', { email: sessionInfo.email, profile });
            setStatus(root, isSuccess(response) ? '\\u062a\\u0645 \\u062d\\u0641\\u0638 \\u0627\\u0644\\u0645\\u0644\\u0641' : '\\u062a\\u0639\\u0630\\u0631 \\u062d\\u0641\\u0638 \\u0627\\u0644\\u0645\\u0644\\u0641', !isSuccess(response));
            return;
        }

        if (action === 'generate-ai') {
            const nicheInput = root.querySelector('#nhp-card-ai-niche');
            const includeImagesInput = root.querySelector('#nhp-card-ai-images');
            const niche = nicheInput ? nicheInput.value.trim() : '';
            const includeImages = !!(includeImagesInput && includeImagesInput.checked);
            setStatus(root, '\\u062c\\u0627\\u0631\\u064a \\u0627\\u0644\\u062a\\u0648\\u0644\\u064a\\u062f \\u0628\\u0627\\u0644\\u0630\\u0643\\u0627\\u0621...', false);
            const response = await bridge('generate_store', {
                email: sessionInfo.email,
                niche: niche || profile.niche || '',
                includeImages,
            });
            if (!isSuccess(response) || !response.profile) {
                const localProfile = buildLocalFallbackProfile(niche || profile.niche || '');
                sessionInfo.storeProfile = localProfile;
                const saveFallback = await bridge('save_profile', { email: sessionInfo.email, profile: localProfile });
                activeTab = 'store';
                mount();
                const freshRoot = document.getElementById(ROOT_ID);
                setStatus(freshRoot || root,
                    isSuccess(saveFallback)
                        ? '\\u062a\\u0645 \\u0625\\u0646\\u0634\\u0627\\u0621 \\u0645\\u0644\\u0641 \\u0645\\u062a\\u062c\\u0631 \\u0627\\u062d\\u062a\\u064a\\u0627\\u0637\\u064a \\u0648\\u062d\\u0641\\u0638\\u0647'
                        : '\\u0641\\u0634\\u0644 \\u0627\\u0644\\u062a\\u0648\\u0644\\u064a\\u062f \\u0648\\u0627\\u0644\\u062d\\u0641\\u0638',
                    !isSuccess(saveFallback));
                return;
            }
            sessionInfo.storeProfile = response.profile;
            const saveResponse = await bridge('save_profile', { email: sessionInfo.email, profile: response.profile });
            activeTab = 'store';
            mount();
            const freshRoot = document.getElementById(ROOT_ID);
            const finalNiche = response.niche || response.profile?.niche || niche || profile.niche || '';
            setStatus(freshRoot || root, isSuccess(saveResponse)
                ? ('\\u062a\\u0645 \\u0627\\u0644\\u062a\\u0648\\u0644\\u064a\\u062f \\u0648\\u0627\\u0644\\u062d\\u0641\\u0638 \\u0628\\u0646\\u062c\\u0627\\u062d' + (response.autoNiche && finalNiche ? ' | Niche: ' + finalNiche : ''))
                : '\\u062a\\u0645 \\u0627\\u0644\\u062a\\u0648\\u0644\\u064a\\u062f \\u0648\\u0644\\u0643\\u0646 \\u0627\\u0644\\u062d\\u0641\\u0638 \\u0641\\u0634\\u0644',
                !isSuccess(saveResponse));
        }
    }

    function bindRoot(root) {
        root.querySelectorAll('.nhp-copy-btn').forEach((btn) => {
            btn.onclick = async () => {
                const value = String(btn.getAttribute('data-copy') || '');
                if (!value || value === '-') return;
                try {
                    await navigator.clipboard.writeText(value);
                    const prev = btn.textContent;
                    btn.textContent = '\\u062a\\u0645';
                    setTimeout(() => { btn.textContent = prev; }, 900);
                } catch (_) {}
            };
        });

        root.querySelectorAll('.nhp-copyable').forEach((el) => {
            el.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const value = String(el.getAttribute('data-copy') || '').trim();
                if (!value || value === '-') return;
                try {
                    await navigator.clipboard.writeText(value);
                    const prev = el.getAttribute('data-copy-label') || '';
                    el.setAttribute('data-copy-label', prev || el.textContent || '');
                    el.classList.add('is-copied');
                    setTimeout(() => el.classList.remove('is-copied'), 700);
                } catch (_) {}
            });
        });

        root.querySelectorAll('[data-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                activeTab = btn.getAttribute('data-tab') || 'account';
                mount();
            });
        });

        root.querySelector('[data-action="toggle"]')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const next = !root.classList.contains('is-collapsed');
            sessionStorage.setItem(STORAGE_KEY, next ? '1' : '0');
            mount();
        });

        root.querySelector('[data-action="close"]')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            root.remove();
        });

        root.querySelectorAll('[data-action="reload-profile"],[data-action="save-profile"],[data-action="generate-ai"]').forEach((btn) => {
            btn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                btn.disabled = true;
                try {
                    await handleAction(root, btn.getAttribute('data-action') || '');
                } finally {
                    btn.disabled = false;
                }
            });
        });

        root.onclick = () => {
            if (!root.classList.contains('is-collapsed')) return;
            sessionStorage.setItem(STORAGE_KEY, '0');
            mount();
        };
    }

    function mount() {
        if (!sessionInfo || !sessionInfo.email) return;
        if (!document.documentElement) {
            setTimeout(mount, 80);
            return;
        }
        if (!document.head) {
            const head = document.createElement('head');
            document.documentElement.insertBefore(head, document.body || null);
        }
        if (!document.body) {
            setTimeout(mount, 80);
            return;
        }
        if (!document.getElementById(STYLE_ID)) {
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = [
                '#' + ROOT_ID + '{position:fixed;top:72px;right:14px;z-index:2147483647;width:430px;max-width:calc(100vw - 28px);background:rgba(10,14,26,.97);color:#e5eefc;border:1px solid rgba(96,165,250,.35);border-radius:18px;box-shadow:0 18px 44px rgba(0,0,0,.45);overflow:hidden;font:12px/1.45 Segoe UI,Tahoma,sans-serif;direction:rtl;text-align:right;backdrop-filter:blur(14px)}',
                '#' + ROOT_ID + '.is-collapsed{width:58px;height:58px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}',
                '#' + ROOT_ID + ' *{box-sizing:border-box}',
                '#' + ROOT_ID + ' .nhp-card-bag{display:none;font-size:22px}',
                '#' + ROOT_ID + '.is-collapsed .nhp-card-bag{display:block}',
                '#' + ROOT_ID + '.is-collapsed .nhp-card-head,#' + ROOT_ID + '.is-collapsed .nhp-card-body{display:none}',
                '#' + ROOT_ID + ' .nhp-card-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08)}',
                '#' + ROOT_ID + ' .nhp-card-title{font-weight:800;color:#86efac;font-size:18px}',
                '#' + ROOT_ID + ' .nhp-card-actions{display:flex;gap:6px}',
                '#' + ROOT_ID + ' .nhp-card-btn{border:none;background:rgba(255,255,255,.08);color:#dbeafe;border-radius:10px;padding:7px 10px;cursor:pointer;font-size:11px}',
                '#' + ROOT_ID + ' .nhp-card-btn:hover{background:rgba(255,255,255,.14)}',
                '#' + ROOT_ID + ' .nhp-card-btn:disabled{opacity:.6;cursor:wait}',
                '#' + ROOT_ID + ' .nhp-card-btn-primary{background:rgba(59,130,246,.22);color:#bfdbfe}',
                '#' + ROOT_ID + ' .nhp-card-btn.is-danger:hover{background:rgba(239,68,68,.22);color:#fecaca}',
                '#' + ROOT_ID + ' .nhp-card-body{padding:12px;display:grid;gap:10px}',
                '#' + ROOT_ID + ' .nhp-card-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}',
                '#' + ROOT_ID + ' .nhp-card-tab{border:none;background:rgba(15,23,42,.72);color:#cbd5e1;border-radius:10px;padding:9px 8px;cursor:pointer;font-weight:700}',
                '#' + ROOT_ID + ' .nhp-card-tab.is-active{background:rgba(99,102,241,.24);color:#ffffff;border:1px solid rgba(129,140,248,.45)}',
                '#' + ROOT_ID + ' .nhp-card-tabpanel{display:grid;gap:10px}',
                '#' + ROOT_ID + ' .nhp-card-row{display:grid;gap:4px}',
                '#' + ROOT_ID + ' .nhp-card-label{font-size:10px;color:#93c5fd;font-weight:700}',
                '#' + ROOT_ID + ' .nhp-card-value-wrap{display:flex;align-items:center;gap:6px}',
                '#' + ROOT_ID + ' .nhp-card-value{flex:1;background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:7px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
                '#' + ROOT_ID + ' .nhp-copyable{cursor:pointer;transition:background-color .18s ease,color .18s ease}',
                '#' + ROOT_ID + ' .nhp-copyable:hover{color:#86efac}',
                '#' + ROOT_ID + ' .nhp-copyable.is-copied{color:#86efac}',
                '#' + ROOT_ID + ' .nhp-copy-btn{border:none;background:rgba(74,222,128,.14);color:#86efac;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:10px;font-weight:700}',
                '#' + ROOT_ID + ' .nhp-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
                '#' + ROOT_ID + ' .nhp-card-pill{background:rgba(59,130,246,.14);border:1px solid rgba(96,165,250,.22);border-radius:10px;padding:8px;min-height:58px}',
                '#' + ROOT_ID + ' .nhp-card-pill strong{display:block;color:#93c5fd;font-size:10px;margin-bottom:4px}',
                '#' + ROOT_ID + ' .nhp-card-bio{background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;white-space:pre-wrap;min-height:74px}',
                '#' + ROOT_ID + ' .nhp-card-links{display:grid;gap:8px}',
                '#' + ROOT_ID + ' .nhp-card-link{display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 10px}',
                '#' + ROOT_ID + ' .nhp-card-link-main{display:flex;align-items:center;gap:8px;min-width:0;flex:1;justify-content:flex-end}',
                '#' + ROOT_ID + ' .nhp-card-link strong{color:#93c5fd;font-size:10px}',
                '#' + ROOT_ID + ' .nhp-card-link a{color:#bfdbfe;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px;direction:ltr}',
                '#' + ROOT_ID + ' .nhp-copy-btn-link{flex:0 0 auto}',
                '#' + ROOT_ID + ' .nhp-card-images-grid{display:grid;grid-template-columns:110px 1fr;gap:8px}',
                '#' + ROOT_ID + ' .nhp-card-image{background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden;min-height:72px;display:flex;align-items:center;justify-content:center}',
                '#' + ROOT_ID + ' .nhp-card-image img{width:100%;height:100%;object-fit:cover;display:block}',
                '#' + ROOT_ID + ' .nhp-card-image.is-avatar{min-height:108px}',
                '#' + ROOT_ID + ' .nhp-card-image.is-cover{min-height:108px}',
                '#' + ROOT_ID + ' .nhp-card-image-empty{color:#94a3b8;font-size:10px;padding:8px;text-align:center}',
                '#' + ROOT_ID + ' .nhp-ai-box{display:grid;gap:10px;background:rgba(15,23,42,.42);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px}',
                '#' + ROOT_ID + ' .nhp-ai-input{width:100%;border:1px solid rgba(255,255,255,.12);background:rgba(2,6,23,.72);color:#e2e8f0;border-radius:10px;padding:9px 10px;outline:none}',
                '#' + ROOT_ID + ' .nhp-ai-check{display:flex;align-items:center;gap:8px;color:#cbd5e1}',
                '#' + ROOT_ID + ' .nhp-ai-actions{display:flex;flex-wrap:wrap;gap:8px}',
                '#' + ROOT_ID + ' .nhp-ai-status{font-size:11px;color:#86efac;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.2);border-radius:10px;padding:8px 10px}',
                '#' + ROOT_ID + ' .nhp-ai-status.is-error{color:#fecaca;background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.2)}'
            ].join('');
            document.head.appendChild(style);
        }

        let root = document.getElementById(ROOT_ID);
        if (!root) {
            root = document.createElement('div');
            root.id = ROOT_ID;
            document.body.appendChild(root);
        }
        const collapsed = sessionStorage.getItem(STORAGE_KEY) === '1';
        root.className = collapsed ? 'is-collapsed' : '';
        root.innerHTML = renderRoot();
        bindRoot(root);
    }

    mount();
    document.addEventListener('DOMContentLoaded', mount, { once: true });
    window.addEventListener('load', mount, { once: true });
    window.addEventListener('pageshow', mount, { once: true });
})();
`;
}

function normalizeReferralUrls(value) {
    const rawItems = Array.isArray(value)
        ? value
        : String(value || '').split(/\r?\n|,/);
    const seen = new Set();
    const urls = [];
    rawItems.forEach((item) => {
        const url = String(item || '').trim();
        if (!/^https?:\/\//i.test(url)) return;
        const key = url.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        urls.push(url);
    });
    return urls;
}

function resolveSignupEntryUrl(body = {}) {
    const overrideUrl = String(body.signupEntryUrl || '').trim();
    if (/^https?:\/\//i.test(overrideUrl)) return overrideUrl;

    const referralUrls = normalizeReferralUrls(body.referralUrls || body.referral_links || body.referralLinks || '');
    if (!referralUrls.length) return SIGNUP_REFERRAL_URL;

    const index = referralUrlCursor % referralUrls.length;
    referralUrlCursor = (referralUrlCursor + 1) % referralUrls.length;
    return referralUrls[index];
}

let activeBrowser = null;
let activePage = null;
let activeBrowserEmail = '';
let activeStealthProfile = null;
let activeProxyAuth = null;
/** @type {string|null} temp userDataDir for current signup job */
let activeUserDataDir = null;
let jobChain = Promise.resolve();
let activationSideChain = Promise.resolve();
/** @type {Map<string, { meta: object, body: object, startedAt: number }>} */
const pendingDeferredActivations = new Map();
/** @type {Promise<import('puppeteer').Page>|null} */
let activeBrowserLaunchPromise = null;
/** @type {Promise<import('puppeteer').Page>|null} */
let signupPageResolvePromise = null;

function verifyStealthEvasionsAtLaunch(logFn = logToFile) {
    const enabled = [...stealthPlugin.enabledEvasions].sort();
    const hasWebdriverEvasion = stealthPlugin.enabledEvasions.has('navigator.webdriver');
    logFn(`Stealth evasions active (${enabled.length}): ${enabled.join(', ')}`, 'INFO');
    if (hasWebdriverEvasion) {
        logFn('Stealth warning: navigator.webdriver evasion enabled may add unsupported Chrome flag', 'WARN');
    } else {
        logFn('Stealth OK: navigator.webdriver evasion disabled; patchNavigatorWebdriver handles it without unsupported flag', 'INFO');
    }
    return { enabled, webdriverEvasionDisabled: !hasWebdriverEvasion };
}

function safeDecodeProxyPart(value) {
    const text = String(value || '').trim();
    try {
        return decodeURIComponent(text);
    } catch (_) {
        return text;
    }
}

async function verifyStealthOnPage(page, logFn = logToFile) {
    if (!page || page.isClosed()) return false;
    const probe = await page.evaluate(() => ({
        webdriver: navigator.webdriver,
        platform: navigator.platform,
        languages: navigator.languages?.length || 0,
    })).catch(() => null);
    if (!probe) return false;
    const ok = probe.webdriver !== true;
    logFn(`Stealth page probe: webdriver=${String(probe.webdriver)} platform=${probe.platform} langs=${probe.languages}`, 'INFO');
    if (!ok) logFn('Stealth page probe FAILED: navigator.webdriver is true', 'WARN');
    return ok;
}

function parseAccountProxy(proxyStr) {
    const proxy = String(proxyStr || '').trim();
    if (!proxy) {
        return { proxyServer: null, proxyUser: null, proxyPass: null, isWifi: false, raw: '' };
    }
    if (proxy.toUpperCase() === 'WIFI') {
        return { proxyServer: null, proxyUser: null, proxyPass: null, isWifi: true, raw: proxy };
    }

    const clean = proxy
        .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
        .replace(/\/.*$/, '')
        .trim();

    const authAtHost = clean.match(/^([^:\s]+):([^@\s]+)@([^:\s]+):(\d{1,5})$/);
    if (authAtHost) {
        const [, user, pass, host, port] = authAtHost;
        const numericPort = Number(port);
        if (numericPort >= 1 && numericPort <= 65535) {
            return {
                proxyServer: `${host.trim()}:${port.trim()}`,
                proxyUser: safeDecodeProxyPart(user),
                proxyPass: safeDecodeProxyPart(pass),
                isWifi: false,
                raw: proxy,
            };
        }
    }

    const hostPortAuth = clean.match(/^([^:\s]+):(\d{1,5}):([^:\s]+):(.+)$/);
    if (hostPortAuth) {
        const [, host, port, user, pass] = hostPortAuth;
        const numericPort = Number(port);
        if (numericPort >= 1 && numericPort <= 65535) {
            return {
                proxyServer: `${host.trim()}:${port.trim()}`,
                proxyUser: safeDecodeProxyPart(user),
                proxyPass: safeDecodeProxyPart(pass),
                isWifi: false,
                raw: proxy,
            };
        }
    }

    const hostPort = clean.match(/^([^:\s]+):(\d{1,5})$/);
    if (hostPort) {
        const [, host, port] = hostPort;
        return {
            proxyServer: `${host.trim()}:${port.trim()}`,
            proxyUser: null,
            proxyPass: null,
            isWifi: false,
            raw: proxy,
        };
    }

    return { proxyServer: null, proxyUser: null, proxyPass: null, isWifi: false, raw: proxy };
}

async function applyProxyAuthToPage(page, contextLabel = 'page') {
    if (!page || page.isClosed() || !activeProxyAuth) return false;
    try {
        await page.authenticate(activeProxyAuth);
        logToFile(`Proxy auth applied (${contextLabel}) user=${activeProxyAuth.username}`, 'INFO');
        return true;
    } catch (err) {
        logToFile(`فشل مصادقة البروكسي (${contextLabel}): ${err.message}`, 'ERROR');
        return false;
    }
}

function attachProxy407Logger(page) {
    if (!page || page.isClosed() || page.__nhpProxy407Hook) return;
    page.__nhpProxy407Hook = true;
    page.on('response', (response) => {
        if (response.status() !== 407) return;
        logToFile(
            `HTTP 407 Proxy Authentication Required — ${response.url()} (تحقق من user:pass في host:port:user:pass)`,
            'ERROR'
        );
    });
}

function wireProxyAuthOnBrowser(browser, email = '') {
    if (!browser || !activeProxyAuth) return;
    if (browser.__nhpProxyAuthWired) return;
    browser.__nhpProxyAuthWired = true;

    browser.on('targetcreated', async (target) => {
        try {
            const page = await target.page();
            if (!page || page.isClosed()) return;
            await applyProxyAuthToPage(page, 'targetcreated');
            await applyPageStealthHooks(page, email || activeBrowserEmail || jobState.email);
            attachProxy407Logger(page);
        } catch (err) {
            logToFile(`targetcreated proxy hook failed: ${err.message}`, 'WARN');
        }
    });

    browser.pages().then((pages) => {
        for (const page of pages) {
            if (!page || page.isClosed()) continue;
            applyProxyAuthToPage(page, 'existing-tab')
                .then(() => applyPageStealthHooks(page, email || activeBrowserEmail || jobState.email))
                .catch(() => null);
            attachProxy407Logger(page);
        }
    }).catch(() => null);
}

function resolveCaptchaOptions(body = {}) {
    const provider = String(
        body.nhpCaptchaProvider
        || body.captchaProvider
        || process.env.NHP_CAPTCHA_PROVIDER
        || ''
    ).trim().toLowerCase();
    const capsolverKey = String(
        body.capsolverApiKey
        || body.CAPSOLVER_API_KEY
        || process.env.CAPSOLVER_API_KEY
        || ''
    ).trim();
    const twoCaptchaKey = String(
        body.twoCaptchaApiKey
        || body.twocaptchaApiKey
        || body.TWOCAPTCHA_API_KEY
        || process.env.TWOCAPTCHA_API_KEY
        || ''
    ).trim();
    const genericKey = String(body.nhpCaptchaApiKey || body.captchaApiKey || '').trim();

    let apiKey = '';
    let resolvedProvider = provider;
    if (provider === 'capsolver' && capsolverKey) {
        apiKey = capsolverKey;
        resolvedProvider = 'capsolver';
    } else if ((provider === '2captcha' || provider === 'twocaptcha') && twoCaptchaKey) {
        apiKey = twoCaptchaKey;
        resolvedProvider = '2captcha';
    } else if (capsolverKey && !twoCaptchaKey) {
        apiKey = capsolverKey;
        resolvedProvider = 'capsolver';
    } else if (twoCaptchaKey) {
        apiKey = twoCaptchaKey;
        resolvedProvider = '2captcha';
    } else if (genericKey) {
        apiKey = genericKey;
        resolvedProvider = provider || '2captcha';
    }

    return { apiKey, provider: resolvedProvider };
}

function logCloudflareEvent(step, message, extra = {}) {
    logToFile(`[Cloudflare] ${step}: ${message}`, step === 'error' ? 'ERROR' : 'INFO');
}

/** @type {Array<{ email: string, body: object }>} */
const signupQueue = [];

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function findQueueIndex(email) {
    const key = normalizeEmail(email);
    return signupQueue.findIndex((item) => normalizeEmail(item.email) === key);
}

function removeFromSignupQueue(email) {
    const idx = findQueueIndex(email);
    if (idx >= 0) signupQueue.splice(idx, 1);
}

function getQueueSnapshot() {
    return signupQueue.map((item, index) => ({
        email: item.email,
        position: index + 1,
        phase: 'QUEUED',
    }));
}

function isJobActive() {
    return jobState.status === 'running' && !!jobState.email;
}

function logToFile(msg, type = 'INFO') {
    const line = `[${new Date().toISOString()}] [${type}] ${msg}\n`;
    try { fs.appendFileSync(LOG_FILE, line, 'utf8'); } catch (_) { /* ignore */ }
    console.log(line.trim());
}

function emitSignupTrace(stage, payload = {}, extra = {}) {
    const traced = traceSignupPipeline(stage, payload, { extra });
    if (!traced) return null;
    logToFile(traced.full, 'TRACE');
    signupTraceBuffer.unshift({
        ts: new Date().toISOString(),
        stage: traced.stage,
        line: traced.line,
    });
    if (signupTraceBuffer.length > SIGNUP_TRACE_BUFFER_MAX) {
        signupTraceBuffer.length = SIGNUP_TRACE_BUFFER_MAX;
    }
    return traced;
}

function deriveStoreNameFromEmail(email) {
    const local = String(email || '').split('@')[0] || 'account';
    return `${local}_Store`;
}

orchestrator.setOrchestratorPaths(ROOT_DIR);
orchestrator.setOrchestratorLogger((msg, type) => logToFile(msg, type));
orchestrator.loadPersistedSchedules();

function setPhase(phase, message = '') {
    jobState.phase = String(phase || 'IDLE').toUpperCase();
    if (message) jobState.message = String(message);
    logToFile(`Phase → ${jobState.phase}${message ? ` | ${message}` : ''}`);
}

function resetJobState() {
    jobState.status = 'idle';
    jobState.phase = 'IDLE';
    jobState.email = '';
    jobState.message = '';
    jobState.stopRequested = false;
    jobState.startedAt = null;
    jobState.skipReason = '';
    jobState.filledFields = {};
    jobState.showBrowser = true;
    jobState.keepBrowserOpen = false;
    jobState.clonedFromAut = false;
    jobState.manualCloudflareContinue = false;
    jobState.ghostCompatMode = false;
    jobState.deferredActivation = false;
    currentJobMeta = { sessionId: '', apiBase: '', token: '', userId: '', email: '', inboxToken: '' };
}

function setStoreAutomationPhase(phase, message = '') {
    storeAutomationState.phase = String(phase || 'IDLE').toUpperCase();
    if (message) storeAutomationState.message = String(message);
    logToFile(`Store automation -> ${storeAutomationState.phase}${message ? ` | ${message}` : ''}`);
}

function resetStoreAutomationState() {
    storeAutomationState.status = 'idle';
    storeAutomationState.phase = 'IDLE';
    storeAutomationState.email = '';
    storeAutomationState.message = '';
    storeAutomationState.startedAt = null;
    storeAutomationState.finishedAt = null;
    storeAutomationState.error = '';
    storeAutomationState.result = null;
}

function imageFileToUploadBase64(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath).toString('base64');
}

function findDefaultFoundationDesignFile() {
    const roots = [
        path.join(os.homedir(), 'Desktop', 'Nouveau dossier (3)', 'التصاميم 5000-5000'),
        path.join(os.homedir(), 'Desktop', 'Nouveau dossier (3)', 'Ø§Ù„ØªØµØ§Ù…ÙŠÙ… 5000-5000'),
        path.join(os.homedir(), 'Desktop', 'Nouveau dossier (3)'),
    ];
    for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        const files = fs.readdirSync(root)
            .filter((name) => /\.(png|webp|jpe?g)$/i.test(name))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (files.length) return path.join(root, files[0]);
    }
    return null;
}

function buildFoundationDesign(body = {}, storeProfile = {}) {
    const supplied = Array.isArray(body.designs) && body.designs.length ? body.designs[0] : null;
    if (supplied) return supplied;

    const explicitPath = String(body.designPath || body.imagePath || '').trim();
    const designPath = explicitPath || findDefaultFoundationDesignFile();
    const base64 = imageFileToUploadBase64(designPath);
    if (!base64) {
        throw new Error('foundation design image missing');
    }

    const title = String(
        body.designTitle
        || storeProfile.designTitle
        || storeProfile.title
        || storeProfile.storeTitle
        || 'TeePublic Starter Design'
    ).trim();
    const description = String(
        body.designDescription
        || storeProfile.designDescription
        || storeProfile.bio
        || storeProfile.description
        || title
    ).trim();
    const mainTag = String(
        body.mainTag
        || storeProfile.mainTag
        || storeProfile.niche
        || 'art'
    ).trim();
    const tags = Array.isArray(body.tags) && body.tags.length
        ? body.tags
        : Array.isArray(storeProfile.tags) && storeProfile.tags.length
            ? storeProfile.tags
            : [mainTag, 'art', 'design', 'creative', 'illustration'];

    return {
        id: `foundation_${Date.now()}`,
        file: { name: path.basename(designPath || 'starter-design.png'), type: 'image/png' },
        base64,
        meta: {
            title,
            description,
            mainTag,
            tags,
            niche: storeProfile.niche || mainTag,
            storeTitle: storeProfile.title || storeProfile.storeTitle || '',
        },
    };
}

async function runStoreAutomationJob(body = {}) {
    const email = String(body.email || body.display_email || body.accountEmail || '').trim();
    const password = String(body.password || body.pass || '').trim();
    const storeProfile = body.storeProfile && typeof body.storeProfile === 'object' ? body.storeProfile : null;

    if (!email) throw new Error('email is required');
    if (!password) throw new Error('password is required');
    if (!storeProfile?.title && !storeProfile?.storeTitle) throw new Error('storeProfile.title required');
    if (storeAutomationState.status === 'running') {
        throw new Error(`store automation already running for ${storeAutomationState.email || 'another account'}`);
    }

    resetStoreAutomationState();
    storeAutomationState.status = 'running';
    storeAutomationState.email = email;
    storeAutomationState.startedAt = new Date().toISOString();
    setStoreAutomationPhase('STARTING', `Preparing live store automation for ${email}`);

    try {
        const design = buildFoundationDesign(body, storeProfile);
        setStoreAutomationPhase('OPENING', 'Opening foundation upload through Ghost Server');
        const res = await fetch(`http://127.0.0.1:${GHOST_PORT}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account: { email, pass: password, password, storeProfile },
                designs: [design],
                storeProfile,
                foundationEntry: true,
                isVisual: body.showBrowser !== false,
                actionType: body.actionType || 'publish',
                defaultColor: body.defaultColor || 'Black',
                keepAlive: body.showBrowser !== false,
                platform: 'teepublic',
                applyStoreProfileAfterPublish: true,
            }),
            signal: AbortSignal.timeout(3600000),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) {
            throw new Error(data?.error || res.statusText || `Ghost HTTP ${res.status}`);
        }
        setStoreAutomationPhase('VERIFYING', 'Verifying foundation upload and store data on TeePublic');
        const published = data?.success === true || data?.results?.some?.((item) => item?.success === true);
        if (!published) throw new Error('foundation upload was not verified');

        storeAutomationState.status = 'done';
        storeAutomationState.finishedAt = new Date().toISOString();
        storeAutomationState.result = data;
        setStoreAutomationPhase('DONE', `Store automation completed for ${email}`);
        return { ok: true, success: true, state: { ...storeAutomationState }, result: data };
    } catch (err) {
        storeAutomationState.status = 'error';
        storeAutomationState.finishedAt = new Date().toISOString();
        storeAutomationState.error = String(err.message || err);
        setStoreAutomationPhase('ERROR', storeAutomationState.error);
        throw err;
    }
}

function getChromePath() {
    const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    return candidates.find((p) => fs.existsSync(p)) || null;
}

function getProfileDirForEmail(email) {
    const safe = String(email || 'creaty_session').replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(PROFILES_DIR, safe);
}

function getGhostCompatProfileDirForEmail(email) {
    const safe = String(email || 'creaty_session').replace(/[^a-zA-Z0-9]/g, '_');
    const dir = path.join(GHOST_PROFILES_DIR, safe);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/** Ghost launchBrowserWithFallback — shared with ghost-server pattern */
const launchBrowserWithFallback = createLaunchBrowserWithFallback({
    puppeteer,
    getChromePath,
    logFn: (msg, type) => logToFile(msg, type || 'WARN'),
    profileLock,
});

function getFreshProfileDirForJob(email) {
    const safe = String(email || 'creaty_session').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 48);
    const unique = `${safe}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const dir = path.join(os.tmpdir(), 'nhp_creaty_profiles', unique);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * Fresh temp profile, or clone from Ghost server_profiles when borrowAutProfile is set.
 * Never writes to the source userDataDir.
 */
function resolveUserDataDirForJob(email, options = {}) {
    const freshSession = options.freshSession !== false;
    if (!freshSession) {
        return { userDataDir: getProfileDirForEmail(email), clonedFromAut: false };
    }

    const shouldBorrow = resolveBorrowAutProfile(email, options);
    if (!shouldBorrow) {
        return { userDataDir: getFreshProfileDirForJob(email), clonedFromAut: false };
    }

    const sourcePath = profileClone.resolveSourceProfilePath(
        {
            sourceProfilePath: options.sourceProfilePath,
            borrowProfileFrom: options.borrowProfileFrom || email,
            sourceProfileEmail: options.sourceProfileEmail || email,
            trustProfileEmail: options.trustProfileEmail || email,
            userDataDir: options.sourceUserDataDir,
        },
        ROOT_DIR
    );

    if (!sourcePath) {
        logToFile('borrowAutProfile — مصدر الملف غير موجود، استخدام ملف مؤقت نظيف', 'WARN');
        return { userDataDir: getFreshProfileDirForJob(email), clonedFromAut: false };
    }

    const clonedPath = profileClone.cloneChromeProfile(
        sourcePath,
        options.sessionId || email,
        (msg, type) => logToFile(msg, type || 'INFO')
    );
    return { userDataDir: clonedPath, clonedFromAut: true, sourceProfilePath: sourcePath };
}

/** Default ON when Ghost server_profiles/{email} exists (unless borrowAutProfile:false). */
function resolveBorrowAutProfile(email, options = {}) {
    if (options.borrowAutProfile === false) return false;
    if (profileClone.shouldBorrowAutProfile(options)) return true;
    const ghostDir = profileClone.getGhostProfileDirForEmail(email, ROOT_DIR);
    return !!(ghostDir && fs.existsSync(ghostDir));
}

function deleteProfileDirQuietly(dir) {
    if (!dir || !fs.existsSync(dir)) return;
    try {
        fs.rmSync(dir, { recursive: true, force: true });
        logToFile(`Cleaned temp profile: ${dir}`, 'INFO');
    } catch (err) {
        logToFile(`Profile cleanup failed (${dir}): ${err.message}`, 'WARN');
    }
}

async function clearBrowserSessionData(page) {
    if (!page || page.isClosed()) return;
    try {
        const client = await page.createCDPSession();
        await client.send('Network.clearBrowserCookies').catch(() => null);
        await client.send('Network.clearBrowserCache').catch(() => null);
        await client.send('Storage.clearDataForOrigin', {
            origin: 'https://www.teepublic.com',
            storageTypes: 'cookies,local_storage,session_storage,indexeddb,cache_storage,service_workers',
        }).catch(() => null);
        await client.detach().catch(() => null);
        logToFile('Browser session cleared (cookies/cache/storage) before signup navigation', 'INFO');
    } catch (err) {
        logToFile(`Session clear warning: ${err.message}`, 'WARN');
    }
}

async function applySyntheticFingerprintToPage(page, email, options = {}) {
    if (!page || page.isClosed()) return;
    await patchNavigatorWebdriver(page);
    if (
        options.skipFingerprint === true
        || options.ghostCompatMode === true
        || jobState.ghostCompatMode === true
        || jobState.clonedFromAut === true
    ) {
        logToFile(`Ghost-compatible mode: synthetic fingerprint skipped for ${email}`, 'INFO');
        return;
    }

    if (!activeStealthProfile) {
        activeStealthProfile = generateSyntheticFingerprint(`${email}:${Date.now()}`);
    }
    const profile = activeStealthProfile;
    await applySyntheticFingerprint(page, profile);

    if (profile.timezone) {
        try {
            const client = await page.createCDPSession();
            await client.send('Emulation.setTimezoneOverride', { timezoneId: profile.timezone });
            await client.detach().catch(() => null);
        } catch (err) {
            logToFile(`Timezone CDP override warning: ${err.message}`, 'WARN');
        }
    }

    const uaShort = String(profile.userAgent || '').slice(0, 72);
    const webglShort = String(profile.webgl?.renderer || profile.webgl?.vendor || '').slice(0, 72);
    const screenLabel = profile.screen ? `${profile.screen.width}x${profile.screen.height}` : 'native';
    logToFile(
        `Synthetic fingerprint: UA=${uaShort} WebGL=${webglShort} TZ=${profile.timezone || 'default'} Screen=${screenLabel} clonedFromAut=${jobState.clonedFromAut === true}`,
        'INFO'
    );
}

/** @deprecated use applySyntheticFingerprintToPage */
async function applyPageStealthHooks(page, email, options = {}) {
    return applySyntheticFingerprintToPage(page, email, options);
}

async function createStablePage(browser, email) {
    return createStablePageBase(browser, {
        viewport: { width: 1280, height: 1050 },
        onPage: async (page) => {
            if (activeProxyAuth) {
                await applyProxyAuthToPage(page, 'new-page');
            }
            await applyPageStealthHooks(page, email);
            attachProxy407Logger(page);
        },
    });
}

async function preparePageBeforeNavigation(page, email, options = {}) {
    if (!page || page.isClosed()) return;
    await applyPageStealthHooks(page, email, options);
    if (activeProxyAuth) {
        await applyProxyAuthToPage(page, 'pre-navigation');
    }
    attachProxy407Logger(page);
    const preserveCfTrust = options.preserveCloudflareTrust === true
        || options.ghostCompatMode === true
        || jobState.ghostCompatMode === true
        || jobState.clonedFromAut === true;
    if (preserveCfTrust) {
        logToFile('Preserving TeePublic cookies/storage for manual Cloudflare trust', 'INFO');
    } else {
        setPhase('OPENING', `Preparing clean signup session for ${email}`);
        await clearBrowserSessionData(page);
    }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Randomized human delay — use after page load / Cloudflare clears before form interaction */
async function humanPause(minMs = 2000, maxMs = 4000) {
    const ms = randomBetween(minMs, maxMs);
    logToFile(`Human pause ${ms}ms (settling before interaction)`, 'INFO');
    await delay(ms);
}

/** Light mouse move on visible viewport — no ghost-cursor required */
function isTransientProxyNavigationError(err) {
    return /407|proxy authentication|net::ERR_PROXY|ERR_TUNNEL|timeout|timed out|navigation timeout/i
        .test(String(err?.message || err || ''));
}

function isRecoverableFrameError(err) {
    return /detached frame|frame.*detached|execution context was destroyed|cannot find context|node is detached|navigating frame was detached|promise was collected|protocol error|runtime\.callfunctionon/i
        .test(String(err?.message || err || ''));
}

async function isPageFrameLive(page) {
    if (!page || page.isClosed()) return false;
    try {
        await page.evaluate(() => true);
        return true;
    } catch (err) {
        if (isRecoverableFrameError(err)) return false;
        throw err;
    }
}

async function resolveLivePage(browser, preferredPage = null) {
    if (!browser) {
        throw new Error('Browser is not available for login preview');
    }
    if (preferredPage && !preferredPage.isClosed() && await isPageFrameLive(preferredPage)) {
        return preferredPage;
    }
    const pages = (await browser.pages().catch(() => [])).filter((candidate) => candidate && !candidate.isClosed());
    for (const candidate of pages) {
        if (await isPageFrameLive(candidate)) return candidate;
    }
    const freshPage = await browser.newPage();
    await ensurePageFront(freshPage);
    return freshPage;
}

async function evaluateWithFrameRecovery(browser, page, evaluator, options = {}) {
    const maxAttempts = Math.max(1, Number(options.maxAttempts || 3));
    const label = options.label || 'page-evaluate';
    let activePage = page;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        activePage = await resolveLivePage(browser, activePage);
        await ensurePageFront(activePage);
        try {
            const result = await evaluator(activePage);
            return { page: activePage, result };
        } catch (err) {
            lastError = err;
            if (!isRecoverableFrameError(err) || attempt >= maxAttempts) throw err;
            logToFile(`${label} transient frame error (${err.message}) — retry ${attempt}/${maxAttempts}`, 'WARN');
            await delay(650);
        }
    }

    throw lastError || new Error(`${label} failed`);
}

async function runNavigationWithProxyRetry(page, label, navigateFn, options = {}) {
    const maxAttempts = Math.max(1, Number(options.maxAttempts || 2));
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            if (activeProxyAuth) {
                await applyProxyAuthToPage(page, `${label}:attempt-${attempt}`);
            }
            const result = await navigateFn(attempt);
            await delay(randomBetween(450, 900));
            if (typeof page.waitForNetworkIdle === 'function') {
                await page.waitForNetworkIdle({ idleTime: 800, timeout: 10000 }).catch(() => null);
            }
            return result;
        } catch (err) {
            lastError = err;
            const transient = isTransientProxyNavigationError(err);
            logToFile(
                `Navigation ${label} attempt ${attempt}/${maxAttempts} failed: ${err.message}${transient ? ' (proxy/timeout retry)' : ''}`,
                transient ? 'WARN' : 'ERROR'
            );
            if (!transient || attempt >= maxAttempts) break;
            if (activeProxyAuth) {
                await applyProxyAuthToPage(page, `${label}:retry-auth`);
            }
            await delay(randomBetween(900, 1800));
        }
    }

    throw lastError || new Error(`Navigation ${label} failed`);
}

async function lightHumanMouseMove(page) {
    if (!page || page.isClosed()) return;
    try {
        const vp = page.viewport() || { width: 1280, height: 900 };
        const w = vp.width || 1280;
        const h = vp.height || 900;
        const x = randomBetween(Math.floor(w * 0.12), Math.floor(w * 0.88));
        const y = randomBetween(Math.floor(h * 0.1), Math.floor(h * 0.78));
        await page.mouse.move(x, y, { steps: randomBetween(6, 16) });
        logToFile(`Light mouse move → (${x}, ${y})`, 'INFO');
    } catch (_) { /* ignore */ }
}

function resolveSignupFormTimeoutMs(options = {}) {
    if (options.formTimeoutMs) return options.formTimeoutMs;
    return randomBetween(SIGNUP_FORM_READY_TIMEOUT_MIN_MS, SIGNUP_FORM_READY_TIMEOUT_MAX_MS);
}

/** Post-CF / post-load settle: pause → mouse → wait for first-name input */
async function postCfHumanSettle(page, options = {}) {
    setPhase('OPENING', `Signup page reached — waiting for form`);
    await humanPause(1200, 2400);
    await lightHumanMouseMove(page);
    const formTimeout = resolveSignupFormTimeoutMs(options);
    await waitForVisibleSignupForm(page, formTimeout);
    logToFile(`Signup first-name input visible (waited up to ${formTimeout}ms)`, 'INFO');
    return formTimeout;
}

async function isSignupFormVisible(page) {
    if (!page || page.isClosed()) return false;
    return page.evaluate(() => {
        const selectors = [
            'input#user_first_name',
            'input[name="user[first_name]"]',
            'input[autocomplete="given-name"]',
            'input[type="email"]',
            'input[name="user[email]"]',
            'input[type="password"]',
        ];
        return selectors.some((selector) => {
            const input = document.querySelector(selector);
            if (!input || input.disabled || input.readOnly) return false;
            const rect = input.getBoundingClientRect();
            const style = window.getComputedStyle(input);
            return rect.width > 20 && rect.height > 10
                && style.visibility !== 'hidden'
                && style.display !== 'none'
                && style.opacity !== '0';
        });
    }).catch(() => false);
}

async function waitForVisibleSignupForm(page, timeoutMs = 25000) {
    const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || 25000);
    while (Date.now() < deadline) {
        if (await isSignupFormVisible(page)) return true;
        await delay(350);
    }
    throw new Error('Signup form fields not visible');
}

function isSignupUrl(url) {
    const u = String(url || '').toLowerCase();
    if (!u.includes('teepublic.com')) return false;
    if (u.includes('/signup/designer/') || u.includes('sell-art-online')) return false;
    return u.includes('/users/sign_up')
        || u.includes('/signup?')
        || u.includes('customer_sign_up');
}

function isReferralLandingUrl(url) {
    const u = String(url || '').toLowerCase();
    if (!u.includes('teepublic.com')) return false;
    return u.includes('/signup/designer/')
        || u.includes('sell-art-online')
        || u.includes('designer-signup');
}

async function isReferralLandingReady(page) {
    if (!page || page.isClosed()) return false;
    return page.evaluate(() => {
        const email = document.querySelector('input[type="email"], input[placeholder*="email" i]');
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
        const cta = buttons.find((node) => /get started/i.test((node.textContent || node.value || '').trim()));
        return !!email && !!cta;
    }).catch(() => false);
}

async function completeReferralEntry(page, email) {
    const targetEmail = String(email || '').trim();
    if (!page || page.isClosed() || !targetEmail) return false;

    const marked = await page.evaluate(() => {
        document.querySelectorAll('[data-nhp-creaty-get-started], [data-nhp-creaty-referral-email]').forEach((node) => {
            node.removeAttribute('data-nhp-creaty-get-started');
            node.removeAttribute('data-nhp-creaty-referral-email');
        });

        const isNewsletterContext = (node) => {
            const container = node?.closest?.('form, section, footer, aside, div') || node?.parentElement;
            const hint = `${node?.name || ''} ${node?.id || ''} ${node?.placeholder || ''} ${container?.textContent || ''}`.toLowerCase();
            if (/newsletter|mailing list|subscribe to our|stay in the loop|footer-subscribe/.test(hint)) return true;
            const form = node?.closest?.('form');
            const submitBtn = form?.querySelector?.('button, input[type="submit"]');
            const btnText = String(submitBtn?.textContent || submitBtn?.value || '').toLowerCase();
            return /subscribe/.test(btnText) && !/get started/.test(btnText);
        };

        const nodes = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
        const cta = nodes.find((node) => {
            const text = String(node.textContent || node.value || '').trim().toLowerCase();
            if (!/get started/.test(text)) return false;
            if (/subscribe|newsletter/.test(text)) return false;
            return !isNewsletterContext(node);
        });
        if (!cta) return { ok: false, reason: 'no_cta' };

        const ctaForm = cta.closest('form');
        const ctaSection = cta.closest('section, main, [class*="hero"], [class*="signup"], [class*="designer"]') || document.body;
        const emailInputs = Array.from(document.querySelectorAll('input[type="email"], input[name*="email" i], input[placeholder*="email" i]'));

        let emailInput = ctaForm?.querySelector?.('input[type="email"], input[name*="email" i], input[placeholder*="email" i]') || null;
        if (!emailInput) {
            emailInput = emailInputs.find((input) => {
                if (isNewsletterContext(input)) return false;
                const rect = input.getBoundingClientRect();
                if (rect.width < 20 || rect.height < 10) return false;
                return ctaSection.contains(input);
            }) || null;
        }
        if (!emailInput) {
            emailInput = emailInputs.find((input) => !isNewsletterContext(input)) || null;
        }
        if (!emailInput) return { ok: false, reason: 'no_email' };

        emailInput.setAttribute('data-nhp-creaty-referral-email', '1');
        cta.setAttribute('data-nhp-creaty-get-started', '1');
        cta.scrollIntoView({ block: 'center', behavior: 'instant' });
        return {
            ok: true,
            emailSelector: '[data-nhp-creaty-referral-email="1"]',
            ctaSelector: '[data-nhp-creaty-get-started="1"]',
        };
    }).catch(() => ({ ok: false, reason: 'evaluate_failed' }));

    if (!marked?.ok) {
        logToFile(`Referral landing targets not found for ${targetEmail}: ${marked?.reason || 'unknown'}`, 'WARN');
        return false;
    }

    const emailSelector = marked.emailSelector;
    const ctaSelector = marked.ctaSelector;
    await page.waitForSelector(emailSelector, { visible: true, timeout: 5000 });
    await page.click(emailSelector, { clickCount: 3 }).catch(() => null);
    await page.keyboard.press('Backspace').catch(() => null);
    await delay(randomBetween(80, 160));
    await page.type(emailSelector, targetEmail, { delay: 100 });

    try {
        await page.waitForSelector(ctaSelector, { visible: true, timeout: 5000 });
        await page.focus(ctaSelector);
        await delay(randomBetween(120, 260));
        await page.keyboard.press('Enter');
    } catch (clickError) {
        const fallbackClicked = await page.evaluate((selector) => {
            const hit = document.querySelector(selector);
            if (!hit) return false;
            hit.click();
            return true;
        }, ctaSelector).catch(() => false);
        if (!fallbackClicked) {
            logToFile('Referral GET STARTED click failed for ' + targetEmail + ': ' + clickError.message, 'WARN');
            return false;
        }
    }
    logToFile('Referral entry completed for ' + targetEmail + ' via GET STARTED hero field', 'INFO');
    await delay(randomBetween(1200, 2200));
    return true;
}

async function getPageUrl(page) {
    try {
        return page.url();
    } catch (_) {
        return '';
    }
}

async function isBlankOrStartupPage(page) {
    const url = await getPageUrl(page);
    if (!url || url === 'about:blank' || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
        return true;
    }
    return false;
}

async function ensurePageFront(page) {
    if (!page || page.isClosed()) return false;
    try {
        await page.bringToFront();
        return true;
    } catch (_) {
        return false;
    }
}

async function purgeAboutBlankTabs(browser, keepPage) {
    if (!browser) return 0;
    const pages = (await browser.pages().catch(() => [])).filter((p) => !p.isClosed());
    if (!pages.length) return 0;
    let closed = 0;
    for (const p of pages) {
        if (p === keepPage || p.isClosed()) continue;
        const url = await getPageUrl(p);
        if (url !== 'about:blank' && url !== '') continue;
        const alive = (await browser.pages().catch(() => [])).filter((x) => !x.isClosed());
        if (alive.length <= 1) {
            logToFile('purgeAboutBlank: keeping sole about:blank tab (only page)', 'INFO');
            continue;
        }
        const others = alive.filter((x) => x !== p);
        if (!others.length) continue;
        try {
            await p.close();
            closed += 1;
        } catch (_) { /* ignore */ }
    }
    if (closed > 0) {
        logToFile(`Purged ${closed} about:blank tab(s)`, 'INFO');
    }
    return closed;
}

async function closeExtraTabs(browser, keepPage) {
    if (!browser) return 0;
    const pages = await browser.pages().catch(() => []);
    let closed = 0;
    for (const p of pages) {
        if (p === keepPage || p.isClosed()) continue;
        try {
            await p.close();
            closed += 1;
        } catch (_) { /* ignore */ }
    }
    if (closed > 0) {
        logToFile(`Closed ${closed} extra browser tab(s)`, 'INFO');
    }
    return closed;
}

/** TeePublic signup tab only — close duplicates and non-matching tabs, bringToFront winner */
async function findSignupPage(browser) {
    if (!browser) return null;
    const pages = (await browser.pages().catch(() => [])).filter((p) => !p.isClosed());
    let signupPage = null;
    for (const p of pages) {
        const url = await getPageUrl(p);
        if (isSignupUrl(url)) {
            if (!signupPage) signupPage = p;
        }
    }
    if (!signupPage) return null;

    let closed = 0;
    for (const p of pages) {
        if (p === signupPage || p.isClosed()) continue;
        try {
            await p.close();
            closed += 1;
        } catch (_) { /* ignore */ }
    }
    if (closed > 0) {
        logToFile(`findSignupPage: closed ${closed} non-signup tab(s)`, 'INFO');
    }
    await ensurePageFront(signupPage);
    return signupPage;
}

async function pickOrCreateWorkingPage(browser) {
    if (activeProxyAuth) {
        const page = await createStablePage(browser, activeBrowserEmail || jobState.email || 'creaty');
        await applyProxyAuthToPage(page, 'fresh-authenticated-page');
        attachProxy407Logger(page);
        await closeExtraTabs(browser, page);
        await ensurePageFront(page);
        return page;
    }

    const existingSignup = await findSignupPage(browser);
    if (existingSignup) return existingSignup;

    const pages = (await browser.pages().catch(() => [])).filter((p) => !p.isClosed());
    const keeper = pages[0] || null;
    await purgeAboutBlankTabs(browser, keeper);

    const afterPurge = (await browser.pages().catch(() => [])).filter((p) => !p.isClosed());
    if (afterPurge.length === 1) return afterPurge[0];
    if (afterPurge.length > 1) {
        const nonBlank = [];
        for (const p of afterPurge) {
            if (!(await isBlankOrStartupPage(p))) nonBlank.push(p);
        }
        if (nonBlank.length === 1) return nonBlank[0];
        if (nonBlank.length > 1) return nonBlank[0];
    }

    const page = await createStablePage(browser, activeBrowserEmail || jobState.email || 'creaty');
    if (activeProxyAuth) {
        await applyProxyAuthToPage(page, 'new-page');
    }
    attachProxy407Logger(page);
    return page;
}

function hashSeed(text) {
    let h = 0;
    const s = String(text || '');
    for (let i = 0; i < s.length; i += 1) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function createTypingProfile(seedText) {
    const h = hashSeed(seedText);
    return {
        charMin: 40 + (h % 35),
        charMax: 90 + (h % 50),
        fieldPauseMin: 300 + (h % 250),
        fieldPauseMax: 650 + (h % 350),
        startDelay: 1000 + (h % 1000),
        reviewPauseMin: 500 + (h % 400),
        reviewPauseMax: 1100 + (h % 400),
    };
}

function stripHtml(html) {
    return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// @FROZEN registration-activation — edits require unlock key 693400 (see REGISTRATION_ACTIVATION_FROZEN.manifest.json)
function logActivationPollPhase(phase, details = {}) {
    const parts = [`[ACTIVATION-POLL] phase=${phase}`];
    for (const [key, value] of Object.entries(details)) {
        if (value === undefined || value === null || value === '') continue;
        parts.push(`${key}=${String(value).replace(/\s+/g, ' ').slice(0, 240)}`);
    }
    logToFile(parts.join(' | '), 'INFO');
}

function decodeHtmlEntities(text) {
    return String(text || '')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeQuotedPrintable(text) {
    let raw = String(text || '');
    if (!/=[0-9A-F]{2}/i.test(raw) && !/=\r?\n/.test(raw)) return raw;
    raw = raw.replace(/=\r?\n/g, '');
    return raw.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeEmailBodyContent(raw) {
    let next = decodeQuotedPrintable(String(raw || ''));
    next = decodeHtmlEntities(next);
    return next.trim();
}

function normalizeEmailMessageBodies(msg = {}) {
    const htmlRaw = msg.body_html || msg.htmlBody || msg.html_body || msg.html || '';
    const textRaw = msg.body_text || msg.textBody || msg.text_body || msg.text || '';
    const html = decodeEmailBodyContent(htmlRaw);
    const text = decodeEmailBodyContent(textRaw) || stripHtml(html);
    return {
        html,
        text,
        subject: decodeEmailBodyContent(msg.subject || ''),
        from: String(msg.from_addr || msg.from || msg.sender || '').trim(),
        to: String(msg.to_addr || msg.to || msg.recipient_addr || msg.recipient || msg.session_email || '').trim(),
        messageId: String(msg.id || msg.messageId || msg.message_id || msg.uid || '').trim(),
        receivedAt: msg.received_at || msg.receivedAt || msg.date || msg.timestamp || null,
        hasHtml: !!html,
        hasText: !!text,
    };
}

function normalizeEmailForMatch(email) {
    return String(email || '').trim().toLowerCase();
}

function messageMatchesRecipient(msg, targetEmail) {
    const target = normalizeEmailForMatch(targetEmail);
    if (!target) return true;
    const norm = normalizeEmailMessageBodies(msg);
    const candidates = [
        norm.to,
        msg.recipient_addr,
        msg.session_email,
        msg.email,
        msg.mailbox,
    ].map((v) => normalizeEmailForMatch(v)).filter(Boolean);
    if (!candidates.length) return true;
    return candidates.some((c) => c === target || c.includes(target) || target.includes(c));
}

function getMessageReceivedTimestamp(msg) {
    const norm = normalizeEmailMessageBodies(msg);
    const raw = norm.receivedAt;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw < 1e12 ? raw * 1000 : raw;
    }
    const parsed = Date.parse(String(raw || ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function filterActivationMessages(messages, options = {}) {
    if (!Array.isArray(messages)) return [];
    const sinceMs = Number(options.sinceMs || 0);
    const targetEmail = String(options.email || '').trim();
    return messages
        .filter((msg) => messageMatchesRecipient(msg, targetEmail))
        .filter((msg) => {
            if (!sinceMs) return true;
            const ts = getMessageReceivedTimestamp(msg);
            return !ts || ts >= sinceMs - 120000;
        })
        .sort((a, b) => getMessageReceivedTimestamp(b) - getMessageReceivedTimestamp(a));
}

const TEEPUBLIC_ACTIVATION_URL_PATTERNS = [
    /href=["'](https?:\/\/links\.teepublic\.com\/[^"']+)["']/gi,
    /href=["'](https?:\/\/[^"']*teepublic\.com[^"']*(?:confirm|verification|verify|activate)[^"']*)["']/gi,
    /href=["'](https?:\/\/[^"']*teepublic\.com[^"']*confirmation[^"']*)["']/gi,
    /href=["'](https?:\/\/[^"']*teepublic\.com\/users\/confirmation[^"']*)["']/gi,
    /(https?:\/\/links\.teepublic\.com\/[^\s<>"']+)/gi,
    /(https?:\/\/[^\s<>"']*teepublic\.com\/users\/confirmation[^\s<>"']*)/gi,
    /(https?:\/\/[^\s<>"']*teepublic\.com[^\s<>"']*(?:confirm|confirmation|verification|verify|activate)[^\s<>"']*)/gi,
];

function cleanExtractedUrl(url) {
    return decodeHtmlEntities(String(url || ''))
        .replace(/["'<>]/g, '')
        .replace(/[.,;)]+$/g, '')
        .trim();
}

function isTeePublicReferralOrSignupUrl(url) {
    const value = cleanExtractedUrl(url);
    if (!value) return true;
    try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        const pathHay = `${parsed.pathname}${parsed.search}`.toLowerCase();
        if (host === 'tee.pub' || host.endsWith('.tee.pub')) return true;
        // Reject activation links that point at signup/sign-in — not post-activation sign_in landings.
        if (/sign[_-]?up|sign[_-]?in|register|\/lic\/|\/refer/i.test(pathHay)) return true;
        if (/\/signup\/designer\/|sell-art-online|designer-signup/i.test(pathHay)) return true;
        if (/[?&](ref|referral|invite)=/i.test(parsed.search)) return true;
        if (host.endsWith('teepublic.com') && (pathHay === '/' || pathHay === '')) return true;
        return false;
    } catch (_) {
        return true;
    }
}

function isTeePublicBadActivationLandingUrl(url) {
    const value = cleanExtractedUrl(url);
    if (!value) return true;
    try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        const pathHay = `${parsed.pathname}${parsed.search}`.toLowerCase();
        if (host === 'tee.pub' || host.endsWith('.tee.pub')) return true;
        if (/\/lic\//i.test(pathHay)) return true;
        if (/sign[_-]?up|register/i.test(pathHay) && !/\/users\/sign_in/i.test(pathHay)) return true;
        if (/\/signup\/designer\/|sell-art-online|designer-signup/i.test(pathHay)) return true;
        if (/[?&](ref|referral|invite)=/i.test(parsed.search)) return true;
        if (host.endsWith('teepublic.com') && (pathHay === '/' || pathHay === '')) return true;
        return false;
    } catch (_) {
        return true;
    }
}

function isTeePublicTrackingLink(url) {
    const value = cleanExtractedUrl(url);
    if (!value) return false;
    try {
        return /links\.teepublic\.com$/i.test(new URL(value).hostname);
    } catch (_) {
        return false;
    }
}

function isValidTeePublicActivationUrl(url) {
    const value = cleanExtractedUrl(url);
    if (!value || isTeePublicReferralOrSignupUrl(value)) return false;
    if (isTeePublicTrackingLink(value)) return false;
    try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        if (!host.endsWith('teepublic.com')) return false;
        const pathHay = `${parsed.pathname}${parsed.search}`.toLowerCase();
        return /(confirm|verification|verify|activate|confirmation|users\/confirmation)/.test(pathHay)
            || /(?:confirmation_)?token=/.test(parsed.search);
    } catch (_) {
        return false;
    }
}

function extractTeePublicUrlsFromContent(html, text) {
    const found = [];
    const haystacks = [String(html || ''), String(text || '')];
    for (const re of TEEPUBLIC_ACTIVATION_URL_PATTERNS) {
        for (const hay of haystacks) {
            re.lastIndex = 0;
            let match = re.exec(hay);
            while (match) {
                const candidate = cleanExtractedUrl(match[1] || match[0]);
                if (candidate && !found.includes(candidate)) found.push(candidate);
                match = re.exec(hay);
            }
        }
    }
    return found;
}

async function resolveWrappedActivationUrl(url) {
    const cleaned = cleanExtractedUrl(url);
    if (!cleaned) return '';
    if (!isTeePublicTrackingLink(cleaned)) return cleaned;

    const pickConfirmationFromHtml = (html) => {
        const urls = extractTeePublicUrlsFromContent(String(html || ''), String(html || ''));
        for (const candidate of urls) {
            if (isValidTeePublicActivationUrl(candidate)) return candidate;
        }
        return '';
    };

    for (const method of ['GET', 'HEAD']) {
        try {
            const res = await fetch(cleaned, {
                method,
                redirect: 'follow',
                signal: AbortSignal.timeout(15000),
                headers: {
                    Accept: 'text/html,application/xhtml+xml',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
            });
            const finalUrl = String(res.url || cleaned).trim();
            if (isValidTeePublicActivationUrl(finalUrl)) {
                logToFile(`Activation tracking link resolved via ${method}: ${finalUrl.slice(0, 160)}`, 'INFO');
                return finalUrl;
            }
            if (method === 'GET') {
                const body = await res.text().catch(() => '');
                const fromHtml = pickConfirmationFromHtml(body);
                if (fromHtml) {
                    logToFile(`Activation tracking link resolved from HTML via GET: ${fromHtml.slice(0, 160)}`, 'INFO');
                    return fromHtml;
                }
            }
        } catch (err) {
            logToFile(`Activation link unwrap ${method} failed: ${err.message}`, 'WARN');
        }
    }
    return '';
}

async function parseAndValidateActivationLink(rawLink) {
    const cleaned = cleanExtractedUrl(rawLink);
    if (!cleaned) return '';
    const unwrapped = await resolveWrappedActivationUrl(cleaned);
    const candidate = unwrapped || cleaned;
    if (!isValidTeePublicActivationUrl(candidate)) {
        logActivationPollPhase('LINK_PARSED', { status: 'invalid', url: candidate.slice(0, 120) });
        return '';
    }
    logActivationPollPhase('LINK_PARSED', { status: 'valid', url: candidate.slice(0, 120) });
    return candidate;
}

function computeActivationPollDelay(attempt) {
    const base = ACTIVATION_POLL_MS + randomBetween(0, 1500);
    const backoff = Math.min(ACTIVATION_POLL_BACKOFF_MAX_MS, base * Math.pow(1.35, Math.max(0, attempt - 1)));
    return Math.round(backoff);
}

function countMessagesInPayload(payload) {
    if (!payload || typeof payload !== 'object') return 0;
    let total = 0;
    for (const bucket of collectMessagesFromResponse(payload)) {
        total += bucket.length;
    }
    if (Array.isArray(payload.messages)) total = Math.max(total, payload.messages.length);
    return total;
}

function logActivationEmailMessages(messages, email, attempt) {
    if (!Array.isArray(messages)) return;
    logActivationPollPhase('WAIT_EMAIL', {
        email,
        attempt,
        messageCount: messages.length,
    });
    if (!messages.length) return;
    for (const msg of messages.slice(0, 8)) {
        const norm = normalizeEmailMessageBodies(msg);
        const receivedMs = getMessageReceivedTimestamp(msg);
        const receivedAt = receivedMs
            ? new Date(receivedMs).toISOString()
            : String(norm.receivedAt || '—');
        const phase = isTeePublicConfirmMessage(msg) ? 'EMAIL_FOUND' : 'WAIT_EMAIL';
        logActivationPollPhase(phase, {
            email,
            attempt,
            subject: norm.subject.slice(0, 120),
            sender: norm.from.slice(0, 80),
            messageId: norm.messageId || '—',
            receivedAt,
            body: norm.hasHtml ? 'html+text' : (norm.hasText ? 'text' : 'empty'),
        });
    }
}

function isTeePublicConfirmMessage(msg) {
    const norm = normalizeEmailMessageBodies(msg);
    const from = norm.from.toLowerCase();
    const subject = norm.subject.toLowerCase();
    const body = `${norm.text} ${stripHtml(norm.html)}`.toLowerCase();
    const hay = `${from} ${subject} ${body}`;
    if (!/teepublic/.test(hay)) return false;
    return /(confirm|verification|verify|activate|activation|email address)/i.test(hay);
}

function extractTeePublicConfirmLink(msg) {
    if (!msg) return null;
    const norm = normalizeEmailMessageBodies(msg);
    const urls = extractTeePublicUrlsFromContent(norm.html, norm.text);
    for (const url of urls) {
        if (isValidTeePublicActivationUrl(url)) return url;
    }
    return null;
}

async function findActivationLink(messages, options = {}) {
    if (!Array.isArray(messages)) return null;
    const filtered = filterActivationMessages(messages, options);
    logActivationEmailMessages(filtered, options.email || '', options.attempt || 0);

    for (const msg of filtered) {
        if (!isTeePublicConfirmMessage(msg)) continue;
        const link = extractTeePublicConfirmLink(msg);
        if (link) {
            const valid = await parseAndValidateActivationLink(link);
            if (valid) return valid;
        }
    }
    for (const msg of filtered) {
        const link = extractTeePublicConfirmLink(msg);
        if (link) {
            const valid = await parseAndValidateActivationLink(link);
            if (valid) return valid;
        }
    }
    for (const msg of filtered) {
        const norm = normalizeEmailMessageBodies(msg);
        const urls = extractTeePublicUrlsFromContent(norm.html, norm.text);
        for (const url of urls) {
            const valid = await parseAndValidateActivationLink(url);
            if (valid) return valid;
        }
    }
    return null;
}

async function findActivationLinkInSource(source, options = {}) {
    if (!source || typeof source !== 'object') return null;

    const directKeys = [
        'link',
        'activationLink',
        'activation_link',
        'confirmLink',
        'confirm_link',
        'confirmationLink',
        'confirmation_link',
        'verificationLink',
        'verification_link',
        'latestMessageLink',
        'latest_message_link',
        'confirmUrl',
        'confirm_url',
        'verificationUrl',
        'verification_url',
        'activationUrl',
        'activation_url',
        'activationOverride',
        'activation_override',
    ];

    for (const key of directKeys) {
        const value = String(source[key] || '').trim();
        if (value && /teepublic/i.test(value)) {
            const valid = await parseAndValidateActivationLink(value);
            if (valid) return valid;
        }
    }

    const messageBuckets = [
        source.messages,
        source.emailMessages,
        source.inboxMessages,
        source.mailMessages,
        source.latestMessage ? [source.latestMessage] : null,
        source.lastMessage ? [source.lastMessage] : null,
    ].filter(Array.isArray);

    for (const bucket of messageBuckets) {
        const link = await findActivationLink(bucket, options);
        if (link) return link;
    }

    return null;
}

function collectMessagesFromResponse(payload) {
    const buckets = [];
    const pushBucket = (value) => {
        if (Array.isArray(value) && value.length) buckets.push(value);
    };
    if (!payload || typeof payload !== 'object') return buckets;

    pushBucket(payload.messages);
    pushBucket(payload.items);
    pushBucket(payload.results);
    pushBucket(payload.emails);
    pushBucket(payload.mailMessages);
    pushBucket(payload.inboxMessages);

    if (payload.data && typeof payload.data === 'object') {
        pushBucket(payload.data.messages);
        pushBucket(payload.data.items);
        pushBucket(payload.data.results);
        pushBucket(payload.data.emails);
        pushBucket(payload.data.mailMessages);
        pushBucket(payload.data.inboxMessages);
    }

    return buckets;
}

async function extractActivationLinkFromResponse(payload, options = {}) {
    if (!payload || typeof payload !== 'object') return null;
    const direct = await findActivationLinkInSource(payload, options);
    if (direct) return direct;
    if (payload.data && typeof payload.data === 'object') {
        const nested = await findActivationLinkInSource(payload.data, options);
        if (nested) return nested;
    }
    const buckets = collectMessagesFromResponse(payload);
    for (const bucket of buckets) {
        const link = await findActivationLink(bucket, options);
        if (link) return link;
    }
    return null;
}

async function closeActiveBrowser(options = {}) {
    const force = options.force === true;
    const reason = String(
        options.reason
        || (options.onError ? 'خطأ أثناء التسجيل' : 'إنهاء مهمة Creaty')
    ).trim();
    if (jobState.keepBrowserOpen && !force) {
        logToFile(
            `[CreatyClose] تخطي الإغلاق — showBrowser=true | reason=${reason}`,
            'INFO'
        );
        return;
    }
    logToFile(`[CreatyClose] reason=${reason}`, 'INFO');
    try {
        if (activePage && !activePage.isClosed()) {
            await activePage.close().catch(() => null);
        }
    } catch (_) { /* ignore */ }
    activePage = null;
    try {
        if (activeBrowser) {
            await activeBrowser.close().catch(() => null);
        }
    } catch (_) { /* ignore */ }
    activeBrowser = null;
    activeBrowserEmail = '';
    activeStealthProfile = null;
    activeProxyAuth = null;

    const profileDir = activeUserDataDir;
    activeUserDataDir = null;
    if (profileDir && !jobState.keepBrowserOpen) {
        deleteProfileDirQuietly(profileDir);
    } else if (profileDir && jobState.keepBrowserOpen) {
        logToFile(`Temp profile kept (keepBrowserOpen): ${profileDir}`, 'INFO');
    }
}

function resolveHeadless(showBrowser) {
    if (showBrowser === true) return false;
    if (showBrowser === false) return 'new';
    if (process.env.NHP_HEADLESS === '1' || process.env.CREATTY_HEADLESS === '1') return 'new';
    return false;
}

async function detectCloudflareChallenge(page) {
    if (!page || page.isClosed()) return false;
    try {
        const title = await page.title().catch(() => '');
        if (/just a moment/i.test(title)) return true;
        return await page.evaluate(() => {
            return !!(
                document.querySelector('#challenge-stage, .cf-turnstile-wrapper, [data-turnstile], iframe[src*="challenges.cloudflare"]')
            );
        });
    } catch (err) {
        if (isRecoverableFrameError(err)) return false;
        throw err;
    }
}

async function showCloudflareOverlay(page, message) {
    await page.evaluate((msg) => {
        let el = document.getElementById('nhp-creaty-cloudflare-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'nhp-creaty-cloudflare-overlay';
            el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;background:#1e1b4b;color:#fbbf24;padding:18px 22px;border-radius:12px;font:16px/1.5 sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.55);max-width:420px;text-align:center;border:2px solid #f59e0b;';
            document.body.appendChild(el);
        }
        el.textContent = msg;
    }, message).catch(() => null);
}

async function extractTurnstileSitekey(page) {
    if (!page || page.isClosed()) return null;
    return page.evaluate(() => {
        const el = document.querySelector('[data-sitekey], .cf-turnstile[data-sitekey], [data-turnstile]');
        if (el) {
            const key = el.getAttribute('data-sitekey') || el.getAttribute('data-turnstile');
            if (key) return key;
        }
        const iframe = document.querySelector('iframe[src*="challenges.cloudflare"], iframe[src*="turnstile"]');
        if (iframe?.src) {
            const m = iframe.src.match(/[?&]sitekey=([^&]+)/i) || iframe.src.match(/\/(0x[A-Za-z0-9_-]+)/);
            if (m?.[1]) return decodeURIComponent(m[1]);
        }
        const scripts = Array.from(document.querySelectorAll('script')).map((s) => s.textContent || '').join('\n');
        const inline = scripts.match(/sitekey['":\s]+(0x[A-Za-z0-9_-]+)/i);
        return inline?.[1] || null;
    }).catch(() => null);
}

async function injectTurnstileToken(page, token) {
    if (!page || page.isClosed() || !token) return false;
    return page.evaluate((tkn) => {
        const inputs = document.querySelectorAll('[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]');
        inputs.forEach((input) => { input.value = tkn; });
        const callbacks = [
            window.turnstileCallback,
            window.onloadTurnstileCallback,
            window.cfCallback,
        ].filter((fn) => typeof fn === 'function');
        callbacks.forEach((fn) => {
            try { fn(tkn); } catch (_) { /* ignore */ }
        });
        return inputs.length > 0 || callbacks.length > 0;
    }, token).catch(() => false);
}

async function attemptTurnstileSolve(page, sitekey, captchaOptions = {}) {
    const apiKey = String(captchaOptions.apiKey || '').trim();
    const provider = String(captchaOptions.provider || '2captcha').toLowerCase();
    if (!apiKey || !sitekey) {
        return { success: false, error: 'missing_api_key_or_sitekey' };
    }

    const pageUrl = await getPageUrl(page);
    logToFile(`Attempting Turnstile solve via ${provider} (sitekey=${sitekey.slice(0, 12)}...)`, 'INFO');

    try {
        if (provider === 'capsolver') {
            const createRes = await fetch('https://api.capsolver.com/createTask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientKey: apiKey,
                    task: {
                        type: 'AntiTurnstileTaskProxyLess',
                        websiteURL: pageUrl,
                        websiteKey: sitekey,
                    },
                }),
            });
            const createData = await createRes.json().catch(() => ({}));
            if (createData.errorId) {
                return { success: false, error: createData.errorDescription || 'capsolver_create_failed', provider };
            }
            const taskId = createData.taskId;
            if (!taskId) return { success: false, error: 'capsolver_no_task_id', provider };

            for (let i = 0; i < 60; i += 1) {
                await delay(3000);
                const pollRes = await fetch('https://api.capsolver.com/getTaskResult', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientKey: apiKey, taskId }),
                });
                const pollData = await pollRes.json().catch(() => ({}));
                if (pollData.status === 'ready' && pollData.solution?.token) {
                    const injected = await injectTurnstileToken(page, pollData.solution.token);
                    return { success: injected, token: pollData.solution.token, provider };
                }
                if (pollData.status === 'failed' || pollData.errorId) {
                    return { success: false, error: pollData.errorDescription || 'capsolver_failed', provider };
                }
            }
            return { success: false, error: 'capsolver_timeout', provider };
        }

        const form = new URLSearchParams({
            key: apiKey,
            method: 'turnstile',
            sitekey,
            pageurl: pageUrl,
            json: '1',
        });
        const inRes = await fetch(`https://2captcha.com/in.php?${form.toString()}`);
        const inData = await inRes.json().catch(() => ({}));
        if (inData.status !== 1 || !inData.request) {
            return { success: false, error: inData.request || '2captcha_submit_failed', provider: '2captcha' };
        }
        const taskId = inData.request;

        for (let i = 0; i < 60; i += 1) {
            await delay(3000);
            const pollRes = await fetch(
                `https://2captcha.com/res.php?key=${encodeURIComponent(apiKey)}&action=get&id=${encodeURIComponent(taskId)}&json=1`
            );
            const pollData = await pollRes.json().catch(() => ({}));
            if (pollData.status === 1 && pollData.request) {
                const injected = await injectTurnstileToken(page, pollData.request);
                return { success: injected, token: pollData.request, provider: '2captcha' };
            }
            if (pollData.request && pollData.request !== 'CAPCHA_NOT_READY') {
                return { success: false, error: pollData.request, provider: '2captcha' };
            }
        }
        return { success: false, error: '2captcha_timeout', provider: '2captcha' };
    } catch (err) {
        return { success: false, error: err.message, provider };
    }
}

async function waitForCloudflareResolution(page, options = {}) {
    const showBrowser = options.showBrowser !== false;
    const timeoutMs = Number(options.timeoutMs) || 300000;
    const captchaOptions = options.captchaOptions || {};
    const readySelector = options.readySelector === undefined ? SIGNUP_FIRST_NAME_READY_SELECTOR : options.readySelector;
    const contextLabel = options.contextLabel || 'TeePublic signup';
    const updateJobPhase = options.updateJobPhase !== false;

    // Wait and check up to 6 times (3 seconds total) for the Cloudflare Turnstile challenge to appear
    let challenged = false;
    for (let i = 0; i < 6; i++) {
        challenged = await detectCloudflareChallenge(page);
        if (challenged) break;
        await delay(500);
    }
    if (!challenged) return { resolved: true, method: 'none' };

    logCloudflareEvent('detected', `Cloudflare Turnstile challenge on ${contextLabel}`);
    logToFile('Cloudflare challenge detected — attempting resolution', 'WARN');

    const sitekey = await extractTurnstileSitekey(page);
    if (sitekey && captchaOptions.apiKey) {
        const apiResult = await attemptTurnstileSolve(page, sitekey, captchaOptions);
        if (apiResult.success) {
            logCloudflareEvent('api_solved', `Turnstile solved via ${apiResult.provider}`);
            await delay(2500);
            const still = await detectCloudflareChallenge(page);
            const hasReadyTarget = readySelector ? await page.$(readySelector).catch(() => null) : true;
            if (!still && hasReadyTarget) {
                return { resolved: true, method: apiResult.provider };
            }
        } else {
            logCloudflareEvent('api_failed', apiResult.error || 'captcha_api_failed', { provider: apiResult.provider });
            logToFile(`Captcha API solve failed: ${apiResult.error || 'unknown'}`, 'WARN');
        }
    } else if (!captchaOptions.apiKey) {
        logToFile('No captcha API key — manual Cloudflare resolution only', 'INFO');
    }

    if (!showBrowser) {
        throw new Error('Cloudflare challenge in headless mode — set showBrowser:true or configure CAPSOLVER_API_KEY / TWOCAPTCHA_API_KEY');
    }

    if (updateJobPhase) {
        setPhase('CLOUDFLARE_WAIT', 'Cloudflare challenge — solve manually');
    }
    await showCloudflareOverlay(page, 'حل تحدي Cloudflare يدوياً ثم انتظر...');
    logToFile('CLOUDFLARE_WAIT — solve challenge manually in browser (max 5 min)', 'WARN');

    if (updateJobPhase) {
        jobState.manualCloudflareContinue = false;
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (updateJobPhase && jobState.stopRequested) throw new Error('Stop requested');
        if (updateJobPhase && jobState.manualCloudflareContinue === true) {
            jobState.manualCloudflareContinue = false;
            logCloudflareEvent('manual_continue', `User confirmed Cloudflare was solved; continuing ${contextLabel}`);
            await showFillOverlay(page, 'Creaty: continuing after manual Cloudflare confirmation').catch(() => null);
            return { resolved: true, method: 'manual-confirmed' };
        }

        let stillChallenge = false;
        let hasReadyTarget = !readySelector;
        try {
            stillChallenge = await detectCloudflareChallenge(page);
            hasReadyTarget = readySelector ? !!(await page.$(readySelector).catch(() => null)) : true;
        } catch (err) {
            if (isRecoverableFrameError(err)) {
                logToFile(`Cloudflare wait: transient frame error (${err.message}) — retrying`, 'WARN');
                await delay(800);
                continue;
            }
            throw err;
        }

        if (!stillChallenge && hasReadyTarget) {
            logCloudflareEvent('resolved', `Manual Cloudflare resolution — ${contextLabel} ready`);
            await showFillOverlay(page, 'Creaty: تم تجاوز Cloudflare — جاري التعبئة…').catch(() => null);
            return { resolved: true, method: 'manual' };
        }

        await delay(2000);
    }

    logCloudflareEvent('timeout', `Cloudflare wait timeout after ${Math.round(timeoutMs / 1000)}s`);
    throw new Error(`Cloudflare challenge timeout (${Math.round(timeoutMs / 1000)}s) — solve manually and retry`);
}

async function launchBrowserForEmail(email, options = {}) {
    const normEmail = normalizeEmail(email);
    const freshSession = options.freshSession !== false;
    if (
        !freshSession
        && activeBrowser
        && activePage
        && !activePage.isClosed()
        && normalizeEmail(activeBrowserEmail) === normEmail
    ) {
        await ensurePageFront(activePage);
        await purgeAboutBlankTabs(activeBrowser, activePage);
        await closeExtraTabs(activeBrowser, activePage);
        logToFile(`Reusing active browser for ${email}`, 'INFO');
        return activePage;
    }

    if (jobState.browserLaunching && activeBrowserLaunchPromise) {
        logToFile('فتح متصفح قيد التنفيذ — انتظار اكتماله قبل فتح نافذة جديدة', 'INFO');
        try {
            return await activeBrowserLaunchPromise;
        } catch (_) {
            /* fall through to fresh launch */
        }
    }

    const launchTask = profileLock.withProfileBrowserMutex(email, ROOT_DIR, async () => {
        jobState.browserLaunching = true;
        try {
        if (options.showBrowser !== false) {
            jobState.showBrowser = true;
            jobState.keepBrowserOpen = true;
        }
        const detachedDeferred = await detachBrowserForDeferredActivation();
        if (!detachedDeferred) {
            await closeActiveBrowser({
                force: true,
                reason: 'بدء متصفح جديد — إغلاق الجلسة السابقة',
            });
        }
        const profileResolved = options.ghostCompatMode === true
            ? { userDataDir: getGhostCompatProfileDirForEmail(email), clonedFromAut: false, ghostCompat: true }
            : (freshSession
                ? resolveUserDataDirForJob(email, options)
                : { userDataDir: getProfileDirForEmail(email), clonedFromAut: false });
        const userDataDir = profileResolved.userDataDir;
        jobState.clonedFromAut = profileResolved.clonedFromAut === true;
        jobState.ghostCompatMode = profileResolved.ghostCompat === true;
        activeUserDataDir = userDataDir;
        if (profileResolved.clonedFromAut) {
            logToFile(
                `AUT profile clone active for ${email} (source=${profileResolved.sourceProfilePath})`,
                'INFO'
            );
        }
        const chromePath = getChromePath();
        const headless = resolveHeadless(options.showBrowser);
        const proxyParsed = options.proxyParsed || parseAccountProxy(options.proxy || '');
        activeProxyAuth = null;

        verifyStealthEvasionsAtLaunch();
        activeStealthProfile = jobState.ghostCompatMode
            ? null
            : generateSyntheticFingerprint(`${email}:${Date.now()}`);

        const launchArgs = buildGhostChromeLaunchArgs(headless);
        if (proxyParsed.proxyServer) {
            launchArgs.push(`--proxy-server=${proxyParsed.proxyServer}`);
            logToFile(`Proxy enabled for ${email}: ${proxyParsed.proxyServer}`, 'INFO');
            if (proxyParsed.proxyUser && proxyParsed.proxyPass) {
                activeProxyAuth = { username: proxyParsed.proxyUser, password: proxyParsed.proxyPass };
            } else {
                logToFile(
                    `تحذير: بروكسي ${proxyParsed.proxyServer} بدون user:pass — متوقع HTTP 407 عند التصفح`,
                    'WARN'
                );
            }
        } else if (proxyParsed.isWifi) {
            logToFile(`Proxy=WIFI for ${email} — no --proxy-server (rotate WiFi manually if needed)`, 'INFO');
        } else {
            logToFile(`تحذير: لا يوجد بروكسي للحساب ${email} — IP مركز بيانات قد يُحجب بواسطة Cloudflare. يُفضّل بروكسي سكني (residential).`, 'WARN');
        }

        const launchOptions = {
            executablePath: chromePath || undefined,
            headless,
            userDataDir,
            ignoreDefaultArgs: ['--enable-automation'],
            args: launchArgs,
            defaultViewport: headless ? { width: 1280, height: 1050 } : null,
        };
        const uaHint = activeStealthProfile?.userAgent?.slice(0, 48) || 'native-chrome-profile';
        logToFile(
            `Browser launching ${headless ? 'headless' : 'visible'} for ${email} (freshProfile=${freshSession}, clonedFromAut=${jobState.clonedFromAut}, ghostCompat=${jobState.ghostCompatMode}, showBrowser=${options.showBrowser !== false}, UA=${uaHint}...)`,
            'INFO'
        );

        const browserLaunch = await launchBrowserWithFallback({
            launchOptions,
            debugSeed: `${email}_creaty_signup`,
            targetUrl: null,
            fallbackArgs: launchArgs,
            fallbackHeadless: headless === 'new' || headless === true,
            profileEmail: email,
        });
        activeBrowser = browserLaunch.browser;
        logToFile(
            `[CreatyBrowser] mode=${browserLaunch.mode}${browserLaunch.port ? ` port=${browserLaunch.port}` : ''}`,
            'INFO'
        );
        activeBrowser.on('disconnected', () => {
            if (activeBrowser) activeBrowser.__nhpProxyAuthWired = false;
            activeBrowser = null;
            activePage = null;
            activeBrowserEmail = '';
            activeStealthProfile = null;
            activeProxyAuth = null;
        });
        wireProxyAuthOnBrowser(activeBrowser, email);
        await delay(400);

        const signupTab = await findSignupPage(activeBrowser);
        if (signupTab && !activeProxyAuth) {
            activePage = signupTab;
        } else {
            const initialPages = await activeBrowser.pages().catch(() => []);
            logToFile(`Browser opened with ${initialPages.length} tab(s) — single target tab`, 'INFO');
            activePage = await pickOrCreateWorkingPage(activeBrowser);
        }

        await applyPageStealthHooks(activePage, email);
        await applyProxyAuthToPage(activePage, 'launch');
        attachProxy407Logger(activePage);
        await verifyStealthOnPage(activePage);
        await purgeAboutBlankTabs(activeBrowser, activePage);
        await closeExtraTabs(activeBrowser, activePage);
        await ensurePageFront(activePage);

        const launchUrl = await getPageUrl(activePage);
        if (!(await isBlankOrStartupPage(activePage)) && !isSignupUrl(launchUrl)) {
            const openTabs = (await activeBrowser.pages().catch(() => [])).filter((p) => !p.isClosed());
            if (openTabs.length <= 1) {
                logToFile(`Keeping sole tab (will navigate later): ${launchUrl}`, 'INFO');
            } else {
                logToFile(`Closing stale restored tab on launch: ${launchUrl}`, 'INFO');
                try {
                    await activePage.close();
                } catch (_) { /* ignore */ }
                activePage = await pickOrCreateWorkingPage(activeBrowser);
                await applyPageStealthHooks(activePage, email);
                await applyProxyAuthToPage(activePage, 'launch-repick');
                attachProxy407Logger(activePage);
                await ensurePageFront(activePage);
            }
        }

        activeBrowserEmail = email;
        logToFile(`Browser ready for ${email} (single tab, profile=${userDataDir})`, 'INFO');
        return activePage;
        } finally {
            jobState.browserLaunching = false;
        }
    });

    activeBrowserLaunchPromise = launchTask;
    try {
        return await launchTask;
    } finally {
        if (activeBrowserLaunchPromise === launchTask) {
            activeBrowserLaunchPromise = null;
        }
    }
}

/** CREATTY-style field discovery + setNativeValue — runs in browser context */
const BROWSER_FILL_HELPERS = `
    var FIELD_LABELS = {
        firstName: ['first name', 'first'],
        lastName: ['last name', 'last'],
        email: ['email address', 'email'],
        password: ['password'],
    };

    var TEEPUBLIC_SELECTORS = {
        firstName: [
            '#user_first_name',
            'input[name="user[first_name]"]',
            'input[name*="first_name"]',
            'input[autocomplete="given-name"]',
            'input[placeholder*="first" i]',
        ],
        lastName: [
            '#user_last_name',
            'input[name="user[last_name]"]',
            'input[name*="last_name"]',
            'input[autocomplete="family-name"]',
            'input[placeholder*="last" i]',
        ],
        email: [
            '#user_email',
            'input[name="user[email]"]',
            'input[type="email"]',
            'input[name*="email"]',
            'input[placeholder*="email" i]',
        ],
        password: [
            '#user_password',
            'input[name="user[password]"]',
            'input[type="password"]',
            'input[name*="password"]',
        ],
    };

    function normalizeText(value) {
        return String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    }

    function queryFirst(selectors) {
        for (var i = 0; i < selectors.length; i += 1) {
            var hit = document.querySelector(selectors[i]);
            if (hit) return hit;
        }
        return null;
    }

    function isVisibleInput(input) {
        if (!input || input.disabled || input.readOnly) return false;
        var type = String(input.getAttribute('type') || 'text').toLowerCase();
        if (['hidden', 'checkbox', 'radio', 'submit', 'button'].includes(type)) return false;
        var rect = input.getBoundingClientRect();
        var style = window.getComputedStyle(input);
        return rect.width > 20 && rect.height > 10 && style.visibility !== 'hidden' && style.display !== 'none';
    }

    function getInputByLabel(labelWords) {
        var labels = Array.from(document.querySelectorAll('label'));
        for (var i = 0; i < labels.length; i += 1) {
            var label = labels[i];
            var text = normalizeText(label.textContent);
            if (!labelWords.some(function (word) { return text.includes(word); })) continue;
            var nestedInput = label.querySelector('input');
            if (nestedInput && isVisibleInput(nestedInput)) return nestedInput;
            var htmlFor = label.getAttribute('for');
            if (htmlFor) {
                var linkedInput = document.getElementById(htmlFor);
                if (linkedInput && isVisibleInput(linkedInput)) return linkedInput;
            }
        }
        return null;
    }

    function getInputByPlaceholder(fieldName) {
        var inputs = Array.from(document.querySelectorAll('input')).filter(isVisibleInput);
        var hints = {
            firstName: ['first name', 'first'],
            lastName: ['last name', 'last'],
            email: ['email'],
            password: ['password'],
        };
        var words = hints[fieldName] || [];
        return inputs.find(function (input) {
            var ph = normalizeText(input.getAttribute('placeholder') || '');
            return words.some(function (word) { return ph.includes(word); });
        }) || null;
    }

    function getInputByVisualOrder(name) {
        var email = document.querySelector('#user_email, input[type="email"], input[name*="email" i]');
        var password = document.querySelector('#user_password, input[type="password"], input[name*="password" i]');
        var form = (email && email.closest('form')) || (password && password.closest('form')) || document;
        var inputs = Array.from(form.querySelectorAll('input')).filter(isVisibleInput);
        if (name === 'email') {
            return email || inputs.find(function (input) {
                return String(input.getAttribute('type') || '').toLowerCase() === 'email';
            }) || null;
        }
        if (name === 'password') {
            return password || inputs.find(function (input) {
                return String(input.getAttribute('type') || '').toLowerCase() === 'password';
            }) || null;
        }
        var emailIndex = email ? inputs.indexOf(email) : inputs.length;
        var beforeEmail = inputs.slice(0, emailIndex < 0 ? inputs.length : emailIndex).filter(function (input) {
            var type = String(input.getAttribute('type') || 'text').toLowerCase();
            return ['text', 'search', ''].includes(type) || !input.getAttribute('type');
        });
        if (name === 'firstName') return beforeEmail[0] || null;
        if (name === 'lastName') return beforeEmail[1] || null;
        return null;
    }

    function getInputByFallback(name) {
        return queryFirst(TEEPUBLIC_SELECTORS[name] || []) || getInputByPlaceholder(name) || getInputByVisualOrder(name);
    }

    function setNativeValue(input, value) {
        var prototype = Object.getPrototypeOf(input);
        var descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor && descriptor.set) {
            descriptor.set.call(input, value);
        } else {
            input.value = value;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function findFieldInput(fieldName) {
        var teepublic = queryFirst(TEEPUBLIC_SELECTORS[fieldName] || []);
        if (teepublic && isVisibleInput(teepublic)) return teepublic;
        var labels = FIELD_LABELS[fieldName];
        if (!labels) return null;
        return getInputByLabel(labels) || getInputByFallback(fieldName);
    }

    function findCreateButton() {
        var buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        return buttons.find(function (button) {
            return normalizeText(button.textContent || button.value).includes('create account');
        });
    }
`;

/** TeePublic sign_up — direct input selectors (no form#new_user dependency) */
const TEEPUBLIC_SIGNUP_SELECTORS = {
    firstName: [
        'input#user_first_name',
        'input[name="user[first_name]"]',
        'input[autocomplete="given-name"]',
        'input[aria-label*="First" i]',
    ],
    lastName: [
        'input#user_last_name',
        'input[name="user[last_name]"]',
        'input[autocomplete="family-name"]',
        'input[aria-label*="Last" i]',
    ],
    email: [
        'input#user_email',
        'input[name="user[email]"]',
        'input[type="email"]',
        'input[autocomplete="email"]',
    ],
    password: [
        'input#user_password',
        'input[name="user[password]"]',
        'input[type="password"]',
        'input[autocomplete="new-password"]',
    ],
    submit: ['button[type="submit"].auth-layout__button', 'button[type="submit"]'],
};
const SIGNUP_FIRST_NAME_READY_SELECTOR = 'input#user_first_name, input[name="user[first_name]"], input[autocomplete="given-name"]';
const SIGNUP_SELECTOR_TIMEOUT_MS = 20000;
const SIGNUP_FIELD_INTERACTION_TIMEOUT_MS = 5000;
const SIGNUP_FORM_READY_TIMEOUT_MIN_MS = 15000;
const SIGNUP_FORM_READY_TIMEOUT_MAX_MS = 30000;
const SIGNUP_FIELD_ORDER = ['firstName', 'lastName', 'email', 'password'];
const TEEPUBLIC_PASSWORD_MIN = 12;

function capitalizeSignupName(word) {
    const s = String(word || '').trim();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function looksLikeStoreHandle(value) {
    const s = String(value || '').trim();
    if (!s) return false;
    if (/_?(store|shop|studio)$/i.test(s)) return true;
    if (/_[a-z0-9]+$/i.test(s) && !/\s/.test(s)) return true;
    if (/[_]/.test(s) && !/\s/.test(s)) return true;
    return false;
}

function nameLooksLikeStoreAlias(name, storeName) {
    const value = String(name || '').trim();
    if (!value) return true;
    if (looksLikeStoreHandle(value)) return true;
    const store = String(storeName || '').trim();
    if (store && value.toLowerCase() === store.toLowerCase()) return true;
    if (/^[^@\s]+_(store|shop|studio)$/i.test(value)) return true;
    return false;
}

function pickValidSignupPersonName(candidate, storeName, fallback) {
    const value = String(candidate || '').trim();
    if (value && !nameLooksLikeStoreAlias(value, storeName)) return value;
    return fallback;
}

function splitPersonNameFromEmail(email) {
    let local = String(email || '').split('@')[0] || '';
    local = local.replace(/_(store|shop|studio)$/i, '');
    const cleaned = local.replace(/[._+\-0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length >= 2) {
        return {
            firstName: capitalizeSignupName(parts[0]),
            lastName: capitalizeSignupName(parts.slice(1).join(' ')),
        };
    }
    if (parts.length === 1 && parts[0].length > 4) {
        const mid = Math.ceil(parts[0].length / 2);
        return {
            firstName: capitalizeSignupName(parts[0].slice(0, mid)),
            lastName: capitalizeSignupName(parts[0].slice(mid)),
        };
    }
    return { firstName: capitalizeSignupName(parts[0] || 'Alex'), lastName: 'Brooks' };
}

function resolveSignupIdentity(body = {}) {
    const email = String(body.email || body.display_email || '').trim();
    const storeName = String(body.storeName || body.store_name || body.nickname || '').trim();
    let firstName = String(body.firstName || body.first_name || '').trim();
    let lastName = String(body.lastName || body.last_name || '').trim();
    if (firstName && lastName
        && !nameLooksLikeStoreAlias(firstName, storeName)
        && !nameLooksLikeStoreAlias(lastName, storeName)) {
        return { firstName, lastName, email };
    }
    if (firstName && !lastName && !nameLooksLikeStoreAlias(firstName, storeName)) {
        return { firstName, lastName: firstName, email };
    }

    const displayName = String(body.displayName || body.display_name || body.name || '').trim();
    if (displayName && !looksLikeStoreHandle(displayName) && displayName.toLowerCase() !== storeName.toLowerCase()) {
        const parts = displayName.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return { firstName: parts[0], lastName: parts.slice(1).join(' '), email };
        }
        if (parts.length === 1 && !looksLikeStoreHandle(parts[0])) {
            return { firstName: parts[0], lastName: parts[0], email };
        }
    }

    const fromEmail = splitPersonNameFromEmail(email);
    return {
        firstName: pickValidSignupPersonName(firstName, storeName, fromEmail.firstName),
        lastName: pickValidSignupPersonName(lastName, storeName, fromEmail.lastName),
        email,
    };
}

/** Earliest server-side normalization — used by /start-signup and runSignupJob before any fill. */
// @FROZEN registration-activation — edits require unlock key 693400 (see REGISTRATION_ACTIVATION_FROZEN.manifest.json)
function sanitizeSignupJobBody(body = {}) {
    const email = String(body.email || body.display_email || '').trim();
    let storeName = String(body.storeName || body.store_name || body.nickname || '').trim();
    if (!storeName && email) storeName = deriveStoreNameFromEmail(email);
    const identity = resolveSignupIdentity({ ...body, email, storeName, nickname: storeName });
    const password = ensureCompliantSignupPassword(body.password || body.pass || body.secret || '', email);
    const sanitized = {
        ...body,
        email,
        display_email: email,
        storeName,
        nickname: storeName,
        firstName: identity.firstName,
        lastName: identity.lastName,
        first_name: identity.firstName,
        last_name: identity.lastName,
        password,
        pass: password,
    };
    emitSignupTrace('server.sanitizeSignupJobBody', sanitized);
    return sanitized;
}

function isLikelyLocalSessionId(sessionId, email) {
    const sid = String(sessionId || '').trim();
    if (!sid) return true;
    if (/^acc_/i.test(sid)) return true;
    const em = String(email || '').trim().toLowerCase();
    if (em && sid.toLowerCase() === em) return true;
    return false;
}

function normalizeQueueRowEmail(row = {}) {
    const candidates = [
        row.email,
        row.display_email,
        row.account?.email,
        row.account?.display_email,
        row.inboxEmail,
        row.mailbox,
    ];
    for (const value of candidates) {
        const em = String(value || '').trim().toLowerCase();
        if (em) return em;
    }
    return '';
}

function pickRemoteSessionId(payload = {}) {
    const candidates = [
        payload.sessionId,
        payload.id,
        payload.emailcoreSessionId,
        payload.account?.sessionId,
        payload.account?.id,
        payload.session?.id,
        payload.session?.sessionId,
    ];
    for (const value of candidates) {
        const sid = String(value || '').trim();
        if (sid && !isLikelyLocalSessionId(sid, payload.email || payload.display_email)) return sid;
    }
    for (const value of candidates) {
        const sid = String(value || '').trim();
        if (sid) return sid;
    }
    return '';
}

function deriveInboxToken(sessionId, email, secret = EMAILCORE_INBOX_SECRET) {
    const sid = String(sessionId || '').trim();
    const em = String(email || '').trim().toLowerCase();
    if (!sid || !em) return '';
    const sig = crypto.createHmac('sha256', String(secret || EMAILCORE_INBOX_SECRET))
        .update(`${sid}|${em}|${EMAILCORE_INBOX_SCOPE}`)
        .digest('hex');
    return sig.slice(0, 48);
}

function appendCacheBust(urlObj) {
    const url = urlObj instanceof URL ? urlObj : new URL(String(urlObj || ''));
    url.searchParams.set('_cb', String(Date.now()));
    return url;
}

function syncResolvedActivationMeta(meta = {}, resolvedSessionId = '') {
    const nextId = String(resolvedSessionId || meta.sessionId || meta.id || '').trim();
    if (!nextId) return meta;
    const email = String(meta.email || meta.display_email || currentJobMeta.email || '').trim();
    const next = {
        ...meta,
        sessionId: nextId,
        id: nextId,
        email,
        inboxToken: deriveInboxToken(nextId, email) || String(meta.inboxToken || '').trim(),
    };
    if (currentJobMeta && (
        !currentJobMeta.sessionId
        || isLikelyLocalSessionId(currentJobMeta.sessionId, email)
        || currentJobMeta.sessionId !== nextId
    )) {
        currentJobMeta = { ...currentJobMeta, ...next };
    }
    return next;
}

async function fetchEmailCorePipelinePhase(meta = {}) {
    const apiBase = String(meta.apiBase || '').replace(/\/+$/, '');
    const token = String(meta.token || '').trim();
    const userId = String(meta.userId || '').trim();
    const email = String(meta.email || meta.display_email || '').trim();
    const sessionId = String(meta.sessionId || meta.id || '').trim();
    if (!apiBase || !token || !userId || (!email && !sessionId)) return null;

    try {
        const url = new URL(`${apiBase}/api/creaty/pipeline-phase`);
        url.searchParams.set('token', token);
        url.searchParams.set('userId', userId);
        if (sessionId) url.searchParams.set('sessionId', sessionId);
        if (email) url.searchParams.set('email', email);
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            emitSignupTrace('server.fetchEmailCorePipelinePhase.error', {
                email,
                sessionId,
                apiBase,
                token,
                userId,
                httpStatus: res.status,
                responseSnippet: data.error || JSON.stringify(data).slice(0, 180),
            });
            return null;
        }
        return data;
    } catch (err) {
        logToFile(`Pipeline-phase lookup failed for ${email || sessionId}: ${err.message}`, 'WARN');
        return null;
    }
}

async function lookupEmailCoreSessionIdFromLibrary(meta = {}) {
    const apiBase = String(meta.apiBase || '').replace(/\/+$/, '');
    const token = String(meta.token || '').trim();
    const userId = String(meta.userId || '').trim();
    const email = String(meta.email || meta.display_email || '').trim().toLowerCase();
    const sentSessionId = String(meta.sessionId || meta.id || meta.localSessionId || '').trim();
    if (!apiBase || !token || !userId || (!email && !sentSessionId)) return '';

    try {
        const url = new URL(`${apiBase}/api/creaty/library/sessions`);
        url.searchParams.set('token', token);
        url.searchParams.set('userId', userId);
        const res = await fetch(url.toString(), {
            headers: { Accept: 'application/json', 'x-creaty-token': token },
            signal: AbortSignal.timeout(15000),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            logToFile(`Library session lookup HTTP ${res.status} for ${email || sentSessionId}: ${data.error || 'no details'}`, 'WARN');
            return '';
        }
        const sessions = Array.isArray(data.sessions) ? data.sessions : [];
        let hit = sentSessionId && !isLikelyLocalSessionId(sentSessionId, email)
            ? sessions.find((row) => {
                const rowIds = [row.id, row.sessionId, row.emailcoreSessionId]
                    .map((value) => String(value || '').trim())
                    .filter(Boolean);
                return rowIds.includes(sentSessionId);
            })
            : null;
        if (!hit && email) {
            hit = sessions.find((row) => normalizeQueueRowEmail(row) === email);
        }
        const resolved = pickRemoteSessionId(hit ? { ...hit, email } : {});
        if (resolved) {
            logToFile(`Resolved EmailCore sessionId ${resolved} for ${email || sentSessionId} via library/sessions`, 'INFO');
            return resolved;
        }
    } catch (err) {
        logToFile(`Library session lookup failed for ${email || sentSessionId}: ${err.message}`, 'WARN');
    }
    return '';
}

async function ensureEmailCoreSessionRow(meta = {}) {
    const apiBase = String(meta.apiBase || '').replace(/\/+$/, '');
    const token = String(meta.token || '').trim();
    const userId = String(meta.userId || '').trim();
    const email = String(meta.email || meta.display_email || '').trim().toLowerCase();
    if (!apiBase || !token || !userId || !email) return '';

    const existing = await lookupEmailCoreSessionIdFromLibrary({ ...meta, email });
    if (existing) return existing;

    try {
        const url = `${apiBase}/api/creaty/library/sessions/manual`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'x-creaty-token': token,
            },
            body: JSON.stringify({
                token,
                userId,
                email,
                displayName: meta.display_name || meta.displayName || meta.firstName || '',
            }),
            signal: AbortSignal.timeout(15000),
        });
        const data = await res.json().catch(() => ({}));
        const createdId = String(data.session?.id || data.id || '').trim();
        if (res.ok && createdId) {
            logToFile(`Created EmailCore session ${createdId} for ${email} via library/sessions/manual`, 'INFO');
            return createdId;
        }
        if (res.status !== 409) {
            logToFile(`EmailCore session ensure HTTP ${res.status} for ${email}: ${data.error || 'no details'}`, 'WARN');
        }
    } catch (err) {
        logToFile(`EmailCore session ensure failed for ${email}: ${err.message}`, 'WARN');
    }
    return '';
}

async function lookupEmailCoreSessionIdByEmail(meta = {}) {
    const apiBase = String(meta.apiBase || '').replace(/\/+$/, '');
    const token = String(meta.token || '').trim();
    const userId = String(meta.userId || '').trim();
    const email = String(meta.email || meta.display_email || '').trim().toLowerCase();
    const sentSessionId = String(meta.sessionId || meta.id || meta.localSessionId || '').trim();
    if (!apiBase || !token || !userId || !email) return '';

    const pipelineMeta = {
        ...meta,
        email,
        sessionId: sentSessionId || meta.localSessionId || meta.sessionId || meta.id || '',
        id: sentSessionId || meta.localSessionId || meta.sessionId || meta.id || '',
    };
    const pipeline = await fetchEmailCorePipelinePhase(pipelineMeta);
    const fromPipeline = pickRemoteSessionId({ ...pipeline, email });
    if (fromPipeline && !isLikelyLocalSessionId(fromPipeline, email)) {
        return fromPipeline;
    }

    const fromLibrary = await lookupEmailCoreSessionIdFromLibrary({ ...meta, email });
    if (fromLibrary) return fromLibrary;

    const findQueueHit = (queue = []) => queue.find((row) => {
        const rowEmail = normalizeQueueRowEmail(row);
        if (rowEmail && rowEmail === email) return true;
        const rowIds = [
            row.id,
            row.sessionId,
            row.emailcoreSessionId,
            row.localSessionId,
            row.account?.id,
            row.account?.sessionId,
        ].map((value) => String(value || '').trim()).filter(Boolean);
        return sentSessionId && rowIds.includes(sentSessionId);
    });

    try {
        const pageSize = 200;
        let scanned = 0;
        for (let page = 0; page < 5; page += 1) {
            const url = appendCacheBust(new URL(`${apiBase}/api/creaty/signup-queue`));
            url.searchParams.set('token', token);
            url.searchParams.set('userId', userId);
            url.searchParams.set('limit', String(pageSize));
            url.searchParams.set('offset', String(page * pageSize));
            url.searchParams.set('email', email);
            if (sentSessionId) url.searchParams.set('sessionId', sentSessionId);
            const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
            const data = await res.json().catch(() => ({}));
            const queue = Array.isArray(data.queue) ? data.queue : (Array.isArray(data.sessions) ? data.sessions : []);
            scanned += queue.length;
            const hit = findQueueHit(queue);
            const resolved = String(hit?.id || hit?.sessionId || hit?.emailcoreSessionId || '').trim();
            if (resolved) {
                logToFile(`Resolved EmailCore sessionId ${resolved} for ${email} via signup-queue lookup`, 'INFO');
                return resolved;
            }
            if (!res.ok) {
                logToFile(`Signup-queue lookup HTTP ${res.status} for ${email}: ${data.error || 'no details'}`, 'WARN');
                break;
            }
            if (queue.length < pageSize) break;
        }
        logToFile(`Signup-queue lookup: no row for ${email} among ${scanned} scanned session(s)`, 'WARN');
    } catch (err) {
        logToFile(`SessionId lookup by email failed for ${email}: ${err.message}`, 'WARN');
    }

    if (fromPipeline) return fromPipeline;
    if (fromLibrary) return fromLibrary;

    const ensured = await ensureEmailCoreSessionRow({ ...meta, email });
    if (ensured) return ensured;

    return sentSessionId;
}

async function resolveActivationMetaSessionId(meta = {}) {
    const apiBase = String(meta.apiBase || '').replace(/\/+$/, '');
    const token = String(meta.token || '').trim();
    const userId = String(meta.userId || '').trim();
    const email = String(meta.email || meta.display_email || '').trim().toLowerCase();
    let sessionId = String(meta.sessionId || meta.id || meta.emailcoreSessionId || '').trim();

    if (!isLikelyLocalSessionId(sessionId, email) && sessionId) return sessionId;
    if (!apiBase || !token || !userId || !email) return sessionId;

    const resolved = await lookupEmailCoreSessionIdByEmail({ ...meta, email, sessionId });
    if (resolved && resolved !== sessionId) {
        logToFile(`Resolved EmailCore sessionId ${resolved} for ${email} (was: ${sessionId || 'empty'})`, 'INFO');
        emitSignupTrace('server.resolveActivationMetaSessionId', {
            email,
            apiBase,
            token,
            userId,
            sessionId: resolved,
            sentSessionId: sessionId,
            expectedSessionId: resolved,
        });
        return resolved;
    }
    if (resolved && !isLikelyLocalSessionId(resolved, email)) return resolved;
    if (isLikelyLocalSessionId(sessionId, email)) {
        emitSignupTrace('server.resolveActivationMetaSessionId.unresolved', {
            email,
            apiBase,
            token,
            userId,
            sessionId,
            sentSessionId: sessionId,
            responseSnippet: 'local acc_* sessionId — will retry lookup + inbox fallback during poll',
        });
    }
    return sessionId || email;
}

function buildActivationJobMeta(body = {}, overrides = {}) {
    const email = String(overrides.email || body.email || body.display_email || '').trim();
    const localSessionId = String(
        overrides.localSessionId || body.localSessionId || body.sessionId || body.id || ''
    ).trim();
    const sessionId = String(
        overrides.sessionId || body.sessionId || body.id || body.emailcoreSessionId || localSessionId || email
    ).trim();
    const apiBase = String(overrides.apiBase || body.apiBase || '').replace(/\/+$/, '');
    const token = String(overrides.token || body.token || '').trim();
    const userId = String(overrides.userId || body.userId || '').trim();
    const inboxToken = String(overrides.inboxToken || body.inboxToken || '').trim()
        || deriveInboxToken(sessionId, email);
    return {
        sessionId,
        id: sessionId,
        localSessionId,
        emailcoreSessionId: String(body.emailcoreSessionId || '').trim(),
        apiBase,
        token,
        userId,
        email,
        display_email: email,
        inboxToken,
    };
}

async function resolveActivationJobMeta(body = {}, overrides = {}) {
    const email = String(overrides.email || body.email || body.display_email || '').trim();
    const localSessionId = String(
        overrides.localSessionId || body.localSessionId || body.sessionId || body.id || ''
    ).trim();
    const apiBase = String(body.apiBase || '').replace(/\/+$/, '');
    const token = String(body.token || '').trim();
    const userId = String(body.userId || '').trim();
    const sessionId = await resolveActivationMetaSessionId({
        ...body,
        email,
        apiBase,
        token,
        userId,
        sessionId: localSessionId,
        id: localSessionId,
    });
    return syncResolvedActivationMeta(buildActivationJobMeta(body, {
        ...overrides,
        email,
        sessionId,
        localSessionId,
        apiBase,
        token,
        userId,
    }), sessionId);
}

function ensureCompliantSignupPassword(password, seed = '') {
    let next = String(password || '').trim();
    if (!next) {
        const base = String(seed || Math.random()).replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'Ec9';
        next = `Ec${base}Aa1!`;
    }
    const suffix = 'Aa1!';
    while (next.length < TEEPUBLIC_PASSWORD_MIN) {
        next += suffix;
    }
    return next;
}

/**
 * Single-tab signup navigation: reuse existing sign_up tab, close duplicates, bringToFront, wait first-name input.
 * Retries once by closing the hung tab and picking another page.
 */
async function resolveSignupPage(browser, signupUrl = SIGNUP_URL, options = {}) {
    if (jobState.signupPageResolving && signupPageResolvePromise) {
        logToFile('resolveSignupPage: انتظار اكتمال محاولة سابقة…', 'INFO');
        try {
            const prior = await signupPageResolvePromise;
            if (prior && !prior.isClosed() && isSignupUrl(await getPageUrl(prior))) {
                activePage = prior;
                return prior;
            }
        } catch (_) {
            /* retry below */
        }
        await delay(1200);
    }

    const resolveTask = (async () => {
    const maxAttempts = (options.retries ?? 1) + 1;
    const formTimeout = resolveSignupFormTimeoutMs(options);
    const gotoTimeout = options.gotoTimeoutMs || 60000;
    const entryUrl = options.signupEntryUrl || SIGNUP_REFERRAL_URL || signupUrl;
    let lastError = null;
    let page = null;

    jobState.signupPageResolving = true;
    try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            if (!page || page.isClosed()) {
                page = await findSignupPage(browser);
                if (!page) {
                    page = await pickOrCreateWorkingPage(browser);
                }
            }
            activePage = page;
            await purgeAboutBlankTabs(browser, page);
            await closeExtraTabs(browser, page);
            await ensurePageFront(page);
            await preparePageBeforeNavigation(page, options.email || jobState.email, {
                preserveCloudflareTrust: options.preserveCloudflareTrust,
                ghostCompatMode: options.ghostCompatMode,
            });

            const currentUrl = await getPageUrl(page);
            const onBlank = await isBlankOrStartupPage(page);
            if (!isSignupUrl(currentUrl)) {
                if (onBlank) {
                    logToFile(`Navigating blank tab to signup entry (attempt ${attempt}): ${entryUrl}`, 'INFO');
                } else {
                    logToFile(`Navigating to signup entry (attempt ${attempt}): ${entryUrl}`, 'INFO');
                }
                setPhase('OPENING', `Opening signup referral for ${options.email || jobState.email || 'account'}`);
                await runNavigationWithProxyRetry(
                    page,
                    `signup-goto-${attempt}`,
                    () => page.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: gotoTimeout })
                );
            } else if (attempt > 1) {
                logToFile(`Reloading signup tab (attempt ${attempt}): ${currentUrl}`, 'INFO');
                await runNavigationWithProxyRetry(
                    page,
                    `signup-reload-${attempt}`,
                    () => page.reload({ waitUntil: 'domcontentloaded', timeout: gotoTimeout })
                );
            } else {
                logToFile(`Reusing tab already on signup: ${currentUrl}`, 'INFO');
                const hasFirstName = await page.$(SIGNUP_FIRST_NAME_READY_SELECTOR).catch(() => null);
                if (!hasFirstName) {
                    logToFile('Signup URL open but first-name input missing — reloading', 'WARN');
                    await runNavigationWithProxyRetry(
                        page,
                        'signup-missing-form-reload',
                        () => page.reload({ waitUntil: 'domcontentloaded', timeout: gotoTimeout })
                    );
                }
            }

            await ensurePageFront(page);

            await waitForCloudflareResolution(page, {
                showBrowser: options.showBrowser ?? jobState.showBrowser,
                timeoutMs: options.cloudflareTimeoutMs || 300000,
                captchaOptions: options.captchaOptions || resolveCaptchaOptions(options.body || {}),
            });

            const afterEntryUrl = await getPageUrl(page);
            if (!isSignupUrl(afterEntryUrl) && (isReferralLandingUrl(afterEntryUrl) || await isReferralLandingReady(page))) {
                setPhase('OPENING', `Referral page opened — entering TeePublic signup`);
                const crossedReferral = await completeReferralEntry(page, options.email || jobState.email);
                if (!crossedReferral) {
                    throw new Error('Referral landing opened but GET STARTED flow did not complete');
                }
                await runNavigationWithProxyRetry(
                    page,
                    `signup-referral-wait-${attempt}`,
                    async () => {
                        const deadline = Date.now() + gotoTimeout;
                        while (Date.now() < deadline) {
                            const urlNow = await getPageUrl(page);
                            if (isSignupUrl(urlNow)) return true;
                            await delay(350);
                        }
                        throw new Error('Referral flow did not reach signup page');
                    },
                    { maxAttempts: 1 }
                );
                await waitForCloudflareResolution(page, {
                    showBrowser: options.showBrowser ?? jobState.showBrowser,
                    timeoutMs: options.cloudflareTimeoutMs || 300000,
                    captchaOptions: options.captchaOptions || resolveCaptchaOptions(options.body || {}),
                });
            }

            await postCfHumanSettle(page, { formTimeoutMs: formTimeout });
            page = await findSignupPage(browser) || page;
            activePage = page;
            await purgeAboutBlankTabs(browser, page);
            await closeExtraTabs(browser, page);
            await ensurePageFront(page);
            logToFile('Signup page ready (first-name input visible)', 'INFO');
            return page;
        } catch (err) {
            lastError = err;
            const is407 = /407|proxy authentication/i.test(String(err.message || ''));
            logToFile(
                `resolveSignupPage attempt ${attempt}/${maxAttempts} failed: ${err.message}${is407 ? ' — تحقق من بيانات البروكسي' : ''}`,
                'WARN'
            );
            if (page && !page.isClosed()) {
                const openPages = (await browser.pages().catch(() => [])).filter((p) => !p.isClosed());
                if (openPages.length > 1) {
                    try {
                        await page.close();
                    } catch (_) { /* ignore */ }
                    if (activePage === page) activePage = null;
                    page = null;
                }
            }
            if (/Cloudflare challenge timeout/i.test(String(err.message || ''))) break;
            if (attempt >= maxAttempts) break;
            await delay(1500);
        }
    }

    throw lastError || new Error('Failed to resolve signup page');
    } finally {
        jobState.signupPageResolving = false;
    }
    })();

    signupPageResolvePromise = resolveTask;
    try {
        return await resolveTask;
    } finally {
        if (signupPageResolvePromise === resolveTask) {
            signupPageResolvePromise = null;
        }
    }
}
const SIGNUP_FIELD_LABELS = {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    password: 'Password',
};

async function waitForTeePublicSelector(page, candidates, timeoutMs = 10000) {
    await ensurePageFront(page);
    const list = Array.isArray(candidates) ? candidates : [candidates];
    const perSelector = Math.max(2500, Math.floor(timeoutMs / Math.max(list.length, 1)));
    for (const sel of list) {
        try {
            await page.waitForSelector(sel, { visible: true, timeout: perSelector });
            const visible = await page.evaluate((s) => {
                const el = document.querySelector(s);
                if (!el || el.disabled || el.readOnly) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 10 && rect.height > 8
                    && style.visibility !== 'hidden' && style.display !== 'none';
            }, sel);
            if (visible) return sel;
        } catch (_) { /* try next selector */ }
    }
    return null;
}

async function resolveManualActivationMeta(meta = {}) {
    const email = String(meta.email || meta.display_email || jobState.email || '').trim();
    const pending = pendingDeferredActivations.get(normalizeEmail(email));
    const baseMeta = {
        ...(pending?.meta || {}),
        ...(meta || {}),
        email,
        localSessionId: meta.localSessionId || pending?.meta?.localSessionId || meta.sessionId || meta.id || '',
    };
    return resolveActivationJobMeta(pending?.body || meta, baseMeta);
}

async function fetchManualActivationLink(meta = {}) {
    const effectiveMeta = await resolveManualActivationMeta(meta);
    logToFile(
        `Manual ACTIVE poll for ${effectiveMeta.email || ''} sessionId=${effectiveMeta.sessionId || '-'} localSessionId=${effectiveMeta.localSessionId || '-'}`,
        'INFO'
    );
    let link = await fetchActivationLinkOnce(effectiveMeta).catch(() => '');
    if (link) return link;
    await requestEmailCoreResend(effectiveMeta).catch(() => false);
    for (let attempt = 0; attempt < 8; attempt += 1) {
        if (jobState.stopRequested) throw new Error('Stop requested');
        await delay(attempt === 0 ? 1200 : 2500);
        const retryMeta = await resolveManualActivationMeta(meta);
        link = await fetchActivationLinkOnce(retryMeta).catch(() => '');
        if (link) return link;
    }
    return '';
}

async function installManualActivationButton(page, meta = {}) {
    if (!page || page.isClosed()) return false;
    try {
        await page.exposeFunction('nhpCreatyFetchActivationLink', async () => {
            try {
                const link = await fetchManualActivationLink(meta);
                if (!link) return { success: false, error: 'Activation link not found yet' };
                logToFile('Manual ACTIVE link fetched for ' + String(meta.email || jobState.email || ''), 'INFO');
                return { success: true, link };
            } catch (error) {
                logToFile('Manual ACTIVE failed: ' + error.message, 'WARN');
                return { success: false, error: error.message || 'Activation lookup failed' };
            }
        });
    } catch (error) {
        if (!/already exists|already registered|binding/i.test(String(error.message || error))) throw error;
    }

    const injectButton = () => {
        const mount = () => {
            if (!document.body || document.getElementById('nhp-creaty-active-button')) return;
            const button = document.createElement('button');
            button.id = 'nhp-creaty-active-button';
            button.type = 'button';
            button.textContent = 'ACTIVE';
            button.title = 'Fetch activation link and open it in this tab';
            button.style.cssText = ['position:fixed','right:16px','bottom:16px','z-index:2147483647','min-width:108px','height:44px','padding:0 18px','border:1px solid rgba(134,239,172,.9)','border-radius:999px','background:#14532d','color:#f0fdf4','font:800 13px/1 Arial,sans-serif','letter-spacing:.08em','box-shadow:0 8px 28px rgba(0,0,0,.45)','cursor:pointer'].join(';');
            button.addEventListener('click', async () => {
                if (button.disabled) return;
                button.disabled = true;
                button.textContent = 'FETCHING...';
                button.style.background = '#1d4ed8';
                try {
                    if (typeof window.nhpCreatyFetchActivationLink !== 'function') throw new Error('Activation bridge is not ready');
                    const result = await window.nhpCreatyFetchActivationLink();
                    if (!result || !result.success || !result.link) throw new Error(result && result.error ? result.error : 'Activation link not found');
                    button.textContent = 'OPENING...';
                    button.style.background = '#15803d';
                    window.location.assign(result.link);
                } catch (error) {
                    button.textContent = 'NO LINK';
                    button.style.background = '#991b1b';
                    button.title = error && error.message ? error.message : 'Activation failed';
                    setTimeout(() => {
                        button.disabled = false;
                        button.textContent = 'ACTIVE';
                        button.style.background = '#14532d';
                    }, 2400);
                }
            });
            document.body.appendChild(button);
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
        else mount();
    };
    await page.evaluateOnNewDocument(injectButton);
    await page.evaluate(injectButton).catch(() => null);
    return true;
}

async function showFillOverlay(page, message) {
    await page.evaluate((msg) => {
        let el = document.getElementById('nhp-creaty-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'nhp-creaty-overlay';
            el.style.cssText = 'position:fixed;top:12px;right:12px;z-index:999999;background:#1a1a2e;color:#4ade80;padding:10px 14px;border-radius:8px;font:14px/1.4 sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.45);max-width:320px;';
            document.body.appendChild(el);
        }
        el.textContent = msg;
    }, message).catch(() => null);
}

/** Sequential fill: strict wait visible → click → page.type with human delay. */
async function mountLoginPreviewSessionCard(browser, page, sessionInfo = {}) {
    const mountEvaluator = (activePage) => activePage.evaluate((session) => {
        if (!session || !session.email || !document.body) return;
        const ROOT_ID = 'nhp-creaty-session-card-preview';
        const STYLE_ID = 'nhp-creaty-session-card-preview-style';
        const existingPersistent = document.getElementById(ROOT_ID);
        if (existingPersistent?.dataset?.bound === '1') return;
        const overlay = document.getElementById('nhp-creaty-overlay');
        const overlayRect = overlay ? overlay.getBoundingClientRect() : null;
        const profile = session.storeProfile && typeof session.storeProfile === 'object' ? session.storeProfile : {};
        const links = profile.links || profile.socialLinks || {};
        const text = {
            title: '\u062c\u0644\u0633\u0629 \u062d\u0633\u0627\u0628 Creaty',
            account: '\u0627\u0644\u062d\u0633\u0627\u0628',
            store: '\u0627\u0644\u0645\u062a\u062c\u0631',
            assets: '\u0627\u0644\u0631\u0648\u0627\u0628\u0637 \u0648\u0627\u0644\u0635\u0648\u0631',
            ai: '\u062a\u0648\u0644\u064a\u062f \u0627\u0644\u0630\u0643\u0627\u0621',
            email: '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
            password: '\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631',
            first: '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0623\u0648\u0644',
            last: '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0623\u062e\u064a\u0631',
            storeName: '\u0627\u0633\u0645 \u0627\u0644\u0645\u062a\u062c\u0631',
            niche: '\u0627\u0644\u0646\u064a\u0634',
            bio: '\u0646\u0628\u0630\u0629 \u0627\u0644\u0645\u062a\u062c\u0631',
            empty: '\u0641\u0627\u0631\u063a',
            done: '\u062a\u0645',
            ready: '\u062c\u0627\u0647\u0632',
            generate: '\u062a\u0648\u0644\u064a\u062f \u0627\u0644\u0647\u0648\u064a\u0629',
        };

        function safe(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }
        function shown(value) {
            const out = String(value == null ? '' : value).trim();
            return out || text.empty;
        }
        function row(label, rawValue) {
            const value = shown(rawValue);
            const copy = value === text.empty ? '' : value;
            return '<div class="nhp-pv-row"><div class="nhp-pv-label">' + safe(label) + '</div>'
                + '<div class="nhp-pv-wrap">'
                + '<button type="button" class="nhp-pv-mini" data-copy="' + safe(copy) + '">{..}</button>'
                + '<button type="button" class="nhp-pv-mini" data-copy="' + safe(copy) + '">\u2398</button>'
                + '<div class="nhp-pv-value" dir="auto">' + safe(value) + '</div>'
                + '</div></div>';
        }
        function titleCase(textValue) {
            return String(textValue || '')
                .replace(/[_-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase()
                .replace(/\b[a-z]/g, (m) => m.toUpperCase());
        }
        function inferNiche(manualValue) {
            const candidates = [
                manualValue,
                profile.niche,
                profile.mainTag,
                profile.category,
                profile.storeProfileSummary,
                profile.title,
                profile.storeTitle,
                profile.bio,
                session.storeProfileSummary,
                session.storeProfileTitle,
                session.storeName,
                session.nickname,
                session.displayName,
                session.display_name,
                String(session.email || '').split('@')[0],
            ].map((v) => String(v || '').trim()).filter(Boolean);
            const joined = candidates.join(' ').toLowerCase();
            const rules = [
                ['Technology', ['tech', 'technology', 'computer', 'coding', 'programming', 'gadget', 'retro pc']],
                ['Pet Lovers', ['pet', 'cat', 'dog', 'animal', 'puppy', 'kitten']],
                ['Gaming', ['game', 'gaming', 'gamer', 'console', 'arcade']],
                ['Anime', ['anime', 'manga', 'kawaii', 'otaku']],
                ['Fitness Motivation', ['fitness', 'gym', 'workout', 'yoga', 'running']],
                ['Music Lovers', ['music', 'guitar', 'band', 'dj', 'rock']],
                ['Nature Hiking', ['nature', 'hiking', 'camping', 'mountain', 'forest']],
                ['Funny Quotes', ['funny', 'humor', 'joke', 'sarcasm', 'meme']],
                ['Sports', ['sport', 'basketball', 'football', 'baseball', 'soccer']],
                ['Vintage Style', ['vintage', 'retro', 'nostalgia', 'classic']],
            ];
            for (const [label, words] of rules) {
                if (words.some((word) => joined.includes(word))) return label;
            }
            return candidates.map((item) => item.replace(/@.*$/, '').replace(/emailcore\.app/ig, '').replace(/[^a-z0-9\s_-]/ig, ' ')).map(titleCase).find((item) => item && item.length >= 3) || 'Creator Art';
        }

        if (!document.getElementById(STYLE_ID)) {
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = [
                '#' + ROOT_ID + '{position:fixed;z-index:1000000;width:390px;max-width:calc(100vw - 24px);background:#1a1a2e;color:#f1f5f9;border:1px solid rgba(74,222,128,.45);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.55);font:12.5px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;direction:rtl;text-align:right;overflow:hidden}',
                '#' + ROOT_ID + ' *{box-sizing:border-box}',
                '#' + ROOT_ID + ' .nhp-pv-head{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(15,23,42,.35);border-bottom:1px solid rgba(74,222,128,.16)}',
                '#' + ROOT_ID + ' .nhp-pv-title{font-weight:800;color:#4ade80;font-size:13px}',
                '#' + ROOT_ID + ' .nhp-pv-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:rgba(15,23,42,.25);border-bottom:1px solid rgba(255,255,255,.06)}',
                '#' + ROOT_ID + ' .nhp-pv-tab{border:0;background:transparent;color:#94a3b8;padding:8px 4px;font-weight:700;font-size:11px;cursor:pointer;border-bottom:2px solid transparent}',
                '#' + ROOT_ID + ' .nhp-pv-tab.is-active{color:#4ade80;border-bottom-color:#4ade80;background:rgba(74,222,128,.06)}',
                '#' + ROOT_ID + ' .nhp-pv-body{display:grid;gap:10px;padding:12px;max-height:58vh;overflow:auto}',
                '#' + ROOT_ID + ' .nhp-pv-row{display:grid;gap:4px}',
                '#' + ROOT_ID + ' .nhp-pv-label{color:#94a3b8;font-weight:700;font-size:11px}',
                '#' + ROOT_ID + ' .nhp-pv-wrap{display:grid;grid-template-columns:36px 36px minmax(0,1fr);border:1px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden;background:rgba(15,23,42,.35)}',
                '#' + ROOT_ID + ' .nhp-pv-value{padding:10px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
                '#' + ROOT_ID + ' .nhp-pv-mini{border:0;border-left:1px solid rgba(255,255,255,.08);background:rgba(15,23,42,.35);color:#a5b4fc;cursor:pointer;font-weight:800}',
                '#' + ROOT_ID + ' .nhp-pv-ai{display:grid;gap:8px}',
                '#' + ROOT_ID + ' .nhp-pv-ai input{width:100%;border:1px solid rgba(255,255,255,.12);background:#111827;color:#e5e7eb;border-radius:8px;padding:9px 10px}',
                '#' + ROOT_ID + ' .nhp-pv-ai button{border:0;border-radius:8px;background:#4f46e5;color:white;font-weight:800;padding:9px 10px;cursor:pointer}',
                '#' + ROOT_ID + ' .nhp-pv-status{color:#86efac;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.22);border-radius:8px;padding:8px 10px}',
            ].join('');
            document.head.appendChild(style);
        }

        let root = document.getElementById(ROOT_ID);
        if (!root) {
            root = document.createElement('div');
            root.id = ROOT_ID;
            document.body.appendChild(root);
        }

        const sections = {
            account: row(text.email, session.email) + row(text.password, session.password) + row(text.first, session.firstName) + row(text.last, session.lastName),
            store: row(text.storeName, profile.title) + row(text.niche, profile.niche) + row(text.bio, profile.bio),
            assets: row('Pinterest', links.pinterest) + row('Instagram', links.instagram) + row('Twitter/X', links.twitter) + row('Facebook', links.facebook),
            ai: '<div class="nhp-pv-ai"><input id="nhp-pv-niche" value="' + safe(profile.niche || '') + '" placeholder="Pets, Gaming, Anime..."><button type="button" id="nhp-pv-generate">' + text.generate + '</button><div class="nhp-pv-status" id="nhp-pv-status">' + text.ready + '</div></div>',
        };

        function render(tab = 'account') {
            root.innerHTML = '<div class="nhp-pv-head"><div class="nhp-pv-title">' + text.title + '</div><div style="color:#94a3b8">⋮⋮</div></div>'
                + '<div class="nhp-pv-tabs">'
                + '<button class="nhp-pv-tab ' + (tab === 'account' ? 'is-active' : '') + '" data-tab="account">' + text.account + '</button>'
                + '<button class="nhp-pv-tab ' + (tab === 'store' ? 'is-active' : '') + '" data-tab="store">' + text.store + '</button>'
                + '<button class="nhp-pv-tab ' + (tab === 'assets' ? 'is-active' : '') + '" data-tab="assets">' + text.assets + '</button>'
                + '<button class="nhp-pv-tab ' + (tab === 'ai' ? 'is-active' : '') + '" data-tab="ai">' + text.ai + '</button>'
                + '</div><div class="nhp-pv-body">' + sections[tab] + '</div>';
            root.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => render(button.getAttribute('data-tab') || 'account')));
            root.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
                const copyValue = String(button.getAttribute('data-copy') || '');
                if (!copyValue) return;
                try {
                    await navigator.clipboard.writeText(copyValue);
                    const old = button.textContent;
                    button.textContent = text.done;
                    setTimeout(() => { button.textContent = old; }, 800);
                } catch (_) {}
            }));
            const generate = root.querySelector('#nhp-pv-generate');
            if (generate) {
                generate.addEventListener('click', () => {
                    const status = root.querySelector('#nhp-pv-status');
                    if (status) status.textContent = text.done;
                    const nicheInput = root.querySelector('#nhp-pv-niche');
                    const niche = inferNiche(nicheInput?.value || '');
                    const handle = String(session.email || 'creator').split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'creator';
                    const generatedProfile = {
                        ...profile,
                        title: (niche + ' Studio').slice(0, 60),
                        niche,
                        bio: (niche + ' Studio') + ' is a curated TeePublic shop focused on ' + niche.toLowerCase() + ' artwork, clean themed collections, and recognizable visual identity.',
                        links: {
                            instagram: 'https://instagram.com/' + handle,
                            twitter: 'https://x.com/' + handle,
                            facebook: 'https://facebook.com/' + handle,
                            pinterest: 'https://pinterest.com/' + handle,
                        },
                        source: 'preview_ai',
                        generatedAt: new Date().toISOString(),
                    };
                    session.storeProfile = generatedProfile;
                    sections.store = row(text.storeName, generatedProfile.title) + row(text.niche, generatedProfile.niche) + row(text.bio, generatedProfile.bio);
                    sections.assets = row('Pinterest', generatedProfile.links.pinterest) + row('Instagram', generatedProfile.links.instagram) + row('Twitter/X', generatedProfile.links.twitter) + row('Facebook', generatedProfile.links.facebook);
                    setTimeout(() => render('store'), 250);
                });
            }
        }

        root.style.top = (overlayRect ? Math.max(12, overlayRect.bottom + 8) : 64) + 'px';
        root.style.right = (overlayRect ? Math.max(12, window.innerWidth - overlayRect.right) : 12) + 'px';
        root.style.left = 'auto';
        render('account');
    }, sessionInfo);

    try {
        const { page: livePage } = await evaluateWithFrameRecovery(browser, page, mountEvaluator, {
            label: 'login-preview-card-mount',
            maxAttempts: 4,
        });
        return livePage;
    } catch (err) {
        logToFile(`Login preview card mount failed: ${err.message}`, 'WARN');
        return page;
    }
}

// @FROZEN registration-activation — edits require unlock key 693400 (see REGISTRATION_ACTIVATION_FROZEN.manifest.json)
async function fillSignupFieldSequential(page, fieldName, value) {
    const text = String(value || '').trim();
    if (!text) return { filled: false, reason: 'empty value' };

    await ensurePageFront(page);
    const selectorCandidates = TEEPUBLIC_SIGNUP_SELECTORS[fieldName] || [];
    const selector = await waitForTeePublicSelector(page, selectorCandidates, SIGNUP_FIELD_INTERACTION_TIMEOUT_MS);
    if (!selector) {
        const reason = `field not found (${selectorCandidates.join(' | ')})`;
        logToFile(`فشل العثور على حقل ${fieldName}: ${reason}`, 'ERROR');
        return { filled: false, reason };
    }

    try {
        await page.waitForSelector(selector, { visible: true, timeout: SIGNUP_FIELD_INTERACTION_TIMEOUT_MS });
        await page.evaluate((sel) => {
            const input = document.querySelector(sel);
            if (input) input.scrollIntoView({ block: 'center', behavior: 'instant' });
        }, selector);
        await delay(randomBetween(80, 180));
        await page.click(selector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await delay(randomBetween(60, 120));
        await page.type(selector, text, { delay: 100 });
        await page.evaluate((sel) => {
            const input = document.querySelector(sel);
            if (!input) return;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        }, selector).catch(() => null);

        const typedOk = await page.evaluate((sel, val) => {
            const input = document.querySelector(sel);
            return !!(input && String(input.value || '').trim() === String(val || '').trim());
        }, selector, text);

        if (typedOk) {
            return {
                filled: true,
                selector,
                valueLen: text.length,
                method: 'page.type',
            };
        }
        logToFile(`فشل التحقق من تعبئة حقل ${fieldName} بعد الكتابة`, 'ERROR');
        return { filled: false, reason: 'type verification failed', selector };
    } catch (typeErr) {
        logToFile(`خطأ أثناء تعبئة حقل ${fieldName} [${selector}]: ${typeErr.stack || typeErr.message}`, 'ERROR');
        return { filled: false, reason: `type failed: ${typeErr.message}`, selector };
    }
}

async function getSignupFieldSnapshot(page) {
    return page.evaluate(({ helpers }) => {
        // eslint-disable-next-line no-eval
        eval(helpers);
        const out = {};
        for (const name of Object.keys(FIELD_LABELS)) {
            const input = findFieldInput(name);
            out[name] = {
                found: !!input,
                valueLen: input ? String(input.value || '').trim().length : 0,
                id: input?.id || '',
                name: input?.getAttribute?.('name') || '',
            };
        }
        return out;
    }, { helpers: BROWSER_FILL_HELPERS }).catch(() => ({}));
}

/** CREATTY-style field discovery — returns CSS selectors (for click/submit helpers) */
async function locateSignupFieldSelectors(page) {
    return page.evaluate(({ helpers }) => {
        // eslint-disable-next-line no-eval
        eval(helpers);

        function selectorForInput(input) {
            if (!input) return null;
            if (input.id) return `#${CSS.escape(input.id)}`;
            const name = input.getAttribute('name');
            if (name) return `input[name="${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
            return null;
        }

        const selectors = {};
        for (const name of Object.keys(FIELD_LABELS)) {
            selectors[name] = selectorForInput(findFieldInput(name));
        }

        const createBtn = findCreateButton();
        let createButton = null;
        if (createBtn) {
            if (createBtn.id) createButton = `#${CSS.escape(createBtn.id)}`;
            else if (createBtn.type === 'submit') createButton = 'button[type="submit"]';
            else createButton = 'button';
        }

        return { selectors, createButton };
    }, { helpers: BROWSER_FILL_HELPERS });
}

async function fillSignupForm(page, payload, profile) {
    const filled = {};
    const missing = {};

    const storeName = String(payload.storeName || payload.nickname || '').trim();
    const email = String(payload.email || '').trim();
    const identity = resolveSignupIdentity({ ...payload, storeName, email });
    const sanitizedPayload = {
        ...payload,
        email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        password: ensureCompliantSignupPassword(payload.password || payload.pass || '', email),
    };
    logToFile(`Fill payload sanitized for ${email}: first=${sanitizedPayload.firstName}, last=${sanitizedPayload.lastName}`, 'INFO');
    emitSignupTrace('server.fillSignupForm', sanitizedPayload);

    jobState.filledFields = {};
    logToFile('Sequential TeePublic fill: firstName → lastName → email → password', 'INFO');
    await lightHumanMouseMove(page);
    await showFillOverlay(page, 'Creaty: filling signup form…');

    try {
        for (const name of SIGNUP_FIELD_ORDER) {
            if (jobState.stopRequested) throw new Error('Stop requested');

            const value = String(sanitizedPayload[name] || '').trim();
            const label = SIGNUP_FIELD_LABELS[name] || name;
            if (!value) {
                missing[name] = 'empty payload';
                logToFile(`Field skipped (empty payload): ${name}`, 'WARN');
                continue;
            }

            await ensurePageFront(page);
            await showFillOverlay(page, `Creaty: ${label}…`);
            logToFile(`Filling field: ${name} (${label})`, 'INFO');

            let result;
            try {
                result = await fillSignupFieldSequential(page, name, value);
            } catch (fieldErr) {
                missing[name] = fieldErr.message;
                logToFile(`استثناء أثناء تعبئة ${label}: ${fieldErr.stack || fieldErr.message}`, 'ERROR');
                continue;
            }
            if (result.filled) {
                filled[name] = {
                    selector: result.selector,
                    valueLen: result.valueLen,
                    method: result.method || 'type',
                };
                jobState.filledFields[name] = true;
                logToFile(`Field filled: ${name} via ${result.method} [${result.selector}]`, 'INFO');
                delete missing[name];
            } else {
                missing[name] = result.reason || 'not found';
                logToFile(`فشل تعبئة ${label} — ${missing[name]}`, 'ERROR');
            }

            if (name !== 'password') {
                await delay(randomBetween(200, 400));
            }
        }
    } catch (fillErr) {
        logToFile(`fillSignupForm interrupted: ${fillErr.message}`, 'ERROR');
        await showFillOverlay(page, `Creaty ERROR: ${fillErr.message}`).catch(() => null);
        throw fillErr;
    }

    const allFour = !!(filled.firstName && filled.lastName && filled.email && filled.password);
    const submitSelector = TEEPUBLIC_SIGNUP_SELECTORS.submit?.[0] || null;

    if (!allFour) {
        const snapshot = await getSignupFieldSnapshot(page);
        logToFile(`Fill incomplete — snapshot: ${JSON.stringify(snapshot)}`, 'ERROR');
        await showFillOverlay(page, `Creaty: fill incomplete — ${Object.keys(missing).join(', ')}`);
    } else {
        await showFillOverlay(
            page,
            `Creaty: verified ${sanitizedPayload.firstName} / ${sanitizedPayload.lastName} — ready to submit`
        );
    }

    return {
        filled,
        missing,
        hasCreateButton: !!submitSelector,
        createButtonSelector: submitSelector,
        ok: allFour,
        sanitizedPayload,
    };
}

async function fillLoginPreviewForm(browser, page, email, password, sessionInfo = {}) {
    let activePage = await resolveLivePage(browser, page);
    await ensurePageFront(activePage);
    await waitForCloudflareResolution(activePage, {
        showBrowser: true,
        timeoutMs: 300000,
        captchaOptions: {},
        readySelector: null,
        contextLabel: 'TeePublic login preview',
        updateJobPhase: false,
    }).catch((err) => {
        logToFile(`Login preview Cloudflare wait warning for ${email}: ${err.message}`, 'WARN');
    });

    activePage = await resolveLivePage(browser, activePage);
    await showFillOverlay(activePage, 'Creaty: login preview ready');
    activePage = await mountLoginPreviewSessionCard(browser, activePage, {
        ...sessionInfo,
        email,
        password,
        showSessionCard: true,
    });

    const fillPayload = { helpers: BROWSER_FILL_HELPERS, emailValue: email, passwordValue: password };
    try {
        const { page: filledPage } = await evaluateWithFrameRecovery(browser, activePage, (livePage) => livePage.evaluate(({ helpers, emailValue, passwordValue }) => {
            // eslint-disable-next-line no-eval
            eval(helpers);
            const path = String(location.pathname || '').toLowerCase();
            const isLoginPage = /\/users\/sign_in|\/sign_in|\/login/.test(path);
            if (!isLoginPage) return;
            const emailInput = findFieldInput('email')
                || document.querySelector('input#user_email, input[name="user[email]"]');
            const passwordInput = findFieldInput('password')
                || document.querySelector('input#user_password, input[name="user[password]"], input[type="password"]');
            if (!passwordInput) return;
            if (emailInput) setNativeValue(emailInput, emailValue);
            if (passwordInput) setNativeValue(passwordInput, passwordValue);
            if (passwordInput) passwordInput.focus();
            else if (emailInput) emailInput.focus();
        }, fillPayload), { label: 'login-preview-fill', maxAttempts: 4 });
        activePage = filledPage;
    } catch (err) {
        logToFile(`Login preview fill warning for ${email}: ${err.message}`, 'WARN');
    }

    try {
        const { result } = await evaluateWithFrameRecovery(browser, activePage, (livePage) => livePage.evaluate(() => {
            const emailInput = document.querySelector('input#user_email, input[name="user[email]"]');
            const passwordInput = document.querySelector('input#user_password, input[name="user[password]"], input[type="password"]');
            return {
                url: location.href,
                emailFilled: !!(emailInput && String(emailInput.value || '').trim()),
                passwordFilled: !!(passwordInput && String(passwordInput.value || '').trim()),
            };
        }), { label: 'login-preview-status', maxAttempts: 3 });
        return result;
    } catch (err) {
        logToFile(`Login preview status read warning for ${email}: ${err.message}`, 'WARN');
        return { url: '', emailFilled: false, passwordFilled: false };
    }
}

const activePreviewBrowsers = new Map();

async function pickLoginPreviewPage(browser) {
    const pages = (await browser.pages().catch((err) => {
        logToFile(`Login preview could not read initial pages: ${err.message}`, 'WARN');
        return [];
    })).filter((candidate) => candidate && !candidate.isClosed());
    let page = pages[0] || await browser.newPage();
    await purgeAboutBlankTabs(browser, page);
    const afterPurge = (await browser.pages().catch(() => [])).filter((p) => !p.isClosed());
    if (afterPurge.length === 1) {
        page = afterPurge[0];
    } else if (afterPurge.length > 1) {
        await closeExtraTabs(browser, page);
        page = (await browser.pages().catch(() => [])).filter((p) => !p.isClosed())[0] || page;
    }
    await ensurePageFront(page);
    return page;
}

async function launchIndependentLoginPreviewPage(email, options = {}) {
    const normEmail = normalizeEmail(email);

    const existingBrowser = activePreviewBrowsers.get(normEmail);
    if (existingBrowser) {
        try {
            if (existingBrowser.isConnected()) {
                const page = await resolveLivePage(existingBrowser, await pickLoginPreviewPage(existingBrowser));
                logToFile(`Reusing existing preview browser/tab for ${email}`, 'INFO');
                return { browser: existingBrowser, page };
            }
        } catch (err) {
            logToFile(`Failed to reuse existing browser for ${email}: ${err.message}. Re-launching.`, 'WARN');
        }
        activePreviewBrowsers.delete(normEmail);
        try { await existingBrowser.close(); } catch (_) { /* ignore */ }
    }

    const safe = String(email || 'login_preview').replace(/[^a-zA-Z0-9]/g, '_');
    const trustedUserDataDir = getGhostCompatProfileDirForEmail(email);
    const fallbackUserDataDir = path.join(PREVIEW_PROFILES_DIR, `${safe}_${Date.now()}`);

    const chromePath = getChromePath();
    const proxyParsed = parseAccountProxy(options.proxy || '');
    const launchArgs = buildGhostChromeLaunchArgs(false);
    if (proxyParsed.proxyServer) {
        launchArgs.push(`--proxy-server=${proxyParsed.proxyServer}`);
        logToFile(`Login preview proxy enabled for ${email}: ${proxyParsed.proxyServer}`, 'INFO');
    }

    const buildLaunchOptions = (userDataDir) => ({
        executablePath: chromePath || undefined,
        headless: false,
        userDataDir,
        ignoreDefaultArgs: ['--enable-automation'],
        args: launchArgs,
        defaultViewport: null,
    });

    let userDataDir = trustedUserDataDir;
    let browser;
    try {
        const browserLaunch = await launchBrowserWithFallback({
            launchOptions: buildLaunchOptions(userDataDir),
            debugSeed: `${email}_creaty_login_preview`,
            targetUrl: null,
            fallbackArgs: launchArgs,
            fallbackHeadless: false,
            profileEmail: email,
        });
        browser = browserLaunch.browser;
        logToFile(
            `[LoginPreview] mode=${browserLaunch.mode}${browserLaunch.port ? ` port=${browserLaunch.port}` : ''}`,
            'INFO'
        );
    } catch (err) {
        const canFallback = /already running|userdatadir|profile/i.test(String(err.message || ''));
        if (!canFallback) throw err;
        fs.mkdirSync(fallbackUserDataDir, { recursive: true });
        userDataDir = fallbackUserDataDir;
        logToFile(`Trusted preview profile busy for ${email}; using temporary preview profile`, 'WARN');
        const browserLaunch = await launchBrowserWithFallback({
            launchOptions: buildLaunchOptions(userDataDir),
            debugSeed: `${email}_creaty_login_preview_fallback`,
            targetUrl: null,
            fallbackArgs: launchArgs,
            fallbackHeadless: false,
            profileEmail: email,
        });
        browser = browserLaunch.browser;
    }

    activePreviewBrowsers.set(normEmail, browser);

    browser.on('disconnected', () => {
        if (activePreviewBrowsers.get(normEmail) === browser) {
            activePreviewBrowsers.delete(normEmail);
        }
    });

    const initialPages = (await browser.pages().catch(() => [])).filter((p) => !p.isClosed());
    logToFile(`Login preview browser opened with ${initialPages.length} tab(s) — single target tab`, 'INFO');

    const page = await pickLoginPreviewPage(browser);
    await page.setBypassCSP(true).catch(() => null);
    if (proxyParsed.proxyUser && proxyParsed.proxyPass) {
        await page.authenticate({
            username: proxyParsed.proxyUser,
            password: proxyParsed.proxyPass,
        }).catch((err) => {
            logToFile(`Login preview proxy auth failed: ${err.message}`, 'WARN');
        });
    }
    await applySyntheticFingerprintToPage(page, email, { ghostCompatMode: true, skipFingerprint: true }).catch((err) => {
        logToFile(`Failed to apply preview stealth hooks: ${err.message}`, 'WARN');
    });
    await delay(randomBetween(350, 800));
    logToFile(`Independent login preview browser opened for ${email} (profile=${userDataDir})`, 'INFO');
    return { browser, page };
}

async function openLoginPreviewJob(body = {}) {
    const email = String(body.email || body.display_email || '').trim();
    const password = ensureCompliantSignupPassword(body.password || body.pass || '', email);
    const accountProxy = String(body.proxy || body.accountProxy || '').trim();
    const identity = resolveSignupIdentity(body);
    const firstName = identity.firstName;
    const lastName = identity.lastName;
    const displayName = String(body.displayName || body.display_name || '').trim();
    const storeName = String(body.storeName || body.store_name || body.nickname || '').trim();
    const storeProfileSummary = String(body.storeProfileSummary || body.store_profile_summary || '').trim();
    const storeProfileTitle = String(body.storeProfileTitle || body.store_profile_title || '').trim();
    const storeProfile = body.storeProfile || null;
    const showSessionCard = body.showSessionCard === true;

    if (!email || !password) {
        throw new Error('email and password are required');
    }
    if (password.length < TEEPUBLIC_PASSWORD_MIN) {
        throw new Error(`password must contain at least ${TEEPUBLIC_PASSWORD_MIN} characters`);
    }

    let targetUrl = body.targetUrl || LOGIN_URL;
    if (showSessionCard) {
        activeSessionCardInfo = {
            email,
            password,
            firstName,
            lastName,
            displayName,
            storeName,
            storeProfileSummary,
            storeProfileTitle,
            storeProfile,
            showSessionCard: true,
        };
        targetUrl = body.targetUrl || LOGIN_URL;
    }

    logToFile(`Opening independent login preview for ${email}`, 'INFO');
    const sessionPayload = {
        email, password, firstName, lastName, displayName, storeName,
        storeProfileSummary, storeProfileTitle, storeProfile, showSessionCard,
    };
    let { browser, page } = await launchIndependentLoginPreviewPage(email, { proxy: accountProxy });

    await evaluateWithFrameRecovery(browser, page, async (livePage) => {
        await livePage.evaluateOnNewDocument((session) => {
            window.nhpSessionInfo = session;

            const emit = () => {
                window.postMessage({
                    type: 'NHP_RESPONSE_SESSION_INFO',
                    detail: session,
                }, '*');
            };

            window.addEventListener('message', (event) => {
                if (event.source !== window || !event.data || event.data.type !== 'nhp-request-session-info') return;
                emit();
            });

            const interval = setInterval(emit, 1000);
            setTimeout(() => clearInterval(interval), 10000);
        }, sessionPayload);
        return livePage;
    }, { label: 'login-preview-session-bridge', maxAttempts: 3 });

    const sessionCardScript = showSessionCard ? buildFloatingSessionCardBootstrapScript({
        email,
        password,
        firstName,
        lastName,
        displayName,
        storeName,
        storeProfileSummary,
        storeProfileTitle,
        storeProfile,
        showSessionCard: true,
    }) : '';

    if (showSessionCard && sessionCardScript) {
        await evaluateWithFrameRecovery(browser, page, async (livePage) => {
            await livePage.evaluateOnNewDocument((inlineScript) => {
                // eslint-disable-next-line no-eval
                eval(inlineScript);
            }, sessionCardScript);
            return livePage;
        }, { label: 'login-preview-card-bootstrap', maxAttempts: 3 });
    }

    const navigation = await evaluateWithFrameRecovery(browser, page, async (livePage) => {
        await runNavigationWithProxyRetry(
            livePage,
            'login-preview-goto',
            () => livePage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
        );
        return livePage;
    }, { label: 'login-preview-goto', maxAttempts: 3 });
    page = navigation.page;

    if (showSessionCard && sessionCardScript) {
        const injection = await evaluateWithFrameRecovery(browser, page, async (livePage) => {
            await livePage.evaluate((inlineScript) => {
                if (window.__NHP_CREATY_PREVIEW_CARD_LOADED__) return;
                // eslint-disable-next-line no-eval
                eval(inlineScript);
            }, sessionCardScript);
            return livePage;
        }, { label: 'login-preview-card-inject', maxAttempts: 4 });
        page = injection.page;
    }

    const filled = await fillLoginPreviewForm(browser, page, email, password, {
        firstName,
        lastName,
        displayName,
        storeName,
        storeProfileSummary,
        storeProfileTitle,
        storeProfile,
    });
    logToFile(`Login preview open for ${email} (${filled.emailFilled ? 'email' : 'no-email'}, ${filled.passwordFilled ? 'password' : 'no-password'})`, 'INFO');
    return {
        success: true,
        email,
        phase: 'LOGIN_PREVIEW_READY',
        targetUrl: filled.url || LOGIN_URL,
        emailFilled: filled.emailFilled === true,
        passwordFilled: filled.passwordFilled === true,
    };
}

async function readSignupFieldValues(page) {
    return page.evaluate(({ helpers }) => {
        // eslint-disable-next-line no-eval
        eval(helpers);
        const out = {};
        for (const name of ['firstName', 'lastName', 'email', 'password']) {
            const input = findFieldInput(name);
            out[name] = input ? String(input.value || '').trim() : '';
        }
        return out;
    }, { helpers: BROWSER_FILL_HELPERS }).catch(() => ({}));
}

async function detectSignupValidationErrors(page) {
    return page.evaluate(() => {
        const form = document.querySelector('form') || document;
        const bodyText = (document.body?.innerText || '').slice(0, 8000);
        const errorNodes = Array.from(form.querySelectorAll(
            '.error, .field-error, .form-error, .invalid-feedback, [class*="error"], [role="alert"], .text-danger, .auth-layout__error'
        ));
        const errorText = errorNodes.map((node) => String(node.textContent || '').trim()).filter(Boolean).join(' ');
        const hay = `${bodyText} ${errorText}`.toLowerCase();
        const passwordTooShort = /(?:password|mot de passe|caract[eè]res?).{0,80}(?:at least|minimum|au moins|trop court|too short|compte actuellement\s*\d{1,2}|must be at least)/i.test(hay)
            || /compte actuellement\s*(?:1[01]|[0-9])\b/i.test(hay);
        const nameError = /(?:first name|last name|pr[eé]nom|nom).{0,60}(?:invalid|required|trop|too)/i.test(hay);
        const hasVisibleError = errorNodes.some((node) => {
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            return rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        });
        const pw = document.querySelector('input[type="password"]');
        const pwLen = pw ? String(pw.value || '').length : 0;
        return {
            passwordTooShort: passwordTooShort || pwLen < 12,
            nameError,
            hasVisibleError,
            passwordLength: pwLen,
            onSignupPage: /\/users\/sign_up|\/signup|customer_sign_up/i.test(location.href),
        };
    }).catch(() => ({
        passwordTooShort: false,
        nameError: false,
        hasVisibleError: false,
        passwordLength: 0,
        onSignupPage: false,
    }));
}

async function validateAndFixSignupFieldsBeforeSubmit(page, payload, typingProfile) {
    const storeName = String(payload.storeName || payload.nickname || '').trim();
    let firstName = String(payload.firstName || '').trim();
    let lastName = String(payload.lastName || '').trim();
    const email = String(payload.email || '').trim();
    let password = ensureCompliantSignupPassword(payload.password || payload.pass || '', email);

    if (nameLooksLikeStoreAlias(firstName, storeName) || nameLooksLikeStoreAlias(lastName, storeName)) {
        const fixed = splitPersonNameFromEmail(email);
        firstName = fixed.firstName;
        lastName = fixed.lastName;
        logToFile(`Names looked like store alias — derived from email: ${firstName} / ${lastName}`, 'WARN');
    }

    const current = await readSignupFieldValues(page);
    const needsRefill = {
        firstName: nameLooksLikeStoreAlias(current.firstName, storeName) || current.firstName !== firstName,
        lastName: nameLooksLikeStoreAlias(current.lastName, storeName) || current.lastName !== lastName,
        password: (current.password || '').length < TEEPUBLIC_PASSWORD_MIN || current.password !== password,
    };

    if (needsRefill.firstName || needsRefill.lastName || needsRefill.password) {
        logToFile(`Pre-submit field fix for ${email}: ${Object.keys(needsRefill).filter((k) => needsRefill[k]).join(', ')}`, 'WARN');
        const fixPayload = { firstName, lastName, email, password };
        for (const field of ['firstName', 'lastName', 'password']) {
            if (!needsRefill[field]) continue;
            await fillSignupFieldSequential(page, field, fixPayload[field]);
            await delay(randomBetween(200, 450));
        }
        password = ensureCompliantSignupPassword(password, email);
    }

    const snapshot = await readSignupFieldValues(page);
    const validation = await detectSignupValidationErrors(page);
    const ok = snapshot.firstName
        && snapshot.lastName
        && snapshot.email
        && (snapshot.password || '').length >= TEEPUBLIC_PASSWORD_MIN
        && !nameLooksLikeStoreAlias(snapshot.firstName, storeName)
        && !nameLooksLikeStoreAlias(snapshot.lastName, storeName)
        && !validation.passwordTooShort;

    emitSignupTrace('server.validateAndFixSignupFieldsBeforeSubmit', {
        ...payload,
        firstName,
        lastName,
        email,
        password,
    }, {
        extra: {
            responseSnippet: `domFirst=${snapshot.firstName || ''} domLast=${snapshot.lastName || ''} ok=${ok}`,
        },
    });

    if (ok) {
        await showFillOverlay(page, `Creaty: verified ${firstName} / ${lastName} — ready to submit`).catch(() => null);
    } else {
        await showFillOverlay(page, 'Creaty ERROR: name/password validation failed before submit').catch(() => null);
    }

    return {
        ok,
        firstName,
        lastName,
        email,
        password,
        snapshot,
        validation,
    };
}

async function waitForPasswordValidation(page, timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (jobState.stopRequested) throw new Error('Stop requested');
        const state = await page.evaluate(() => {
            const pw = document.querySelector('input[type="password"]');
            const pwLen = pw ? String(pw.value || '').length : 0;
            if (!pw || pwLen < 6) return { ok: false, pwLen };
            const form = pw.closest('form') || document;
            const bodyText = (document.body?.innerText || '').toLowerCase();
            const passwordError = /compte actuellement\s*(?:1[01]|[0-9])\b|too short|trop court|at least 12|au moins 12/i.test(bodyText);
            if (passwordError) return { ok: false, pwLen, passwordError: true };
            const reds = form.querySelectorAll(
                '.error, .field-error, .invalid-feedback, [class*="error"]:not(input), .text-danger, [role="alert"]'
            );
            const visibleRed = Array.from(reds).some((node) => {
                const rect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                return rect.height > 0 && style.display !== 'none' && /password|mot de passe/i.test(node.textContent || '');
            });
            if (visibleRed) return { ok: false, pwLen, passwordError: true };
            if (pwLen >= 12) return { ok: true, pwLen };
            const greens = form.querySelectorAll(
                '.fa-check, .icon-check, [class*="success"], [class*="valid"]:not(input), .text-success, svg[class*="check"]'
            );
            if (greens.length > 0 && pwLen >= 12) return { ok: true, pwLen };
            return { ok: false, pwLen };
        }).catch(() => ({ ok: false, pwLen: 0 }));
        if (state.ok) return true;
        await delay(350);
    }
    return false;
}

async function clickCreateAccountButton(page, selectorHint) {
    await ensurePageFront(page);
    const candidates = [
        selectorHint,
        ...(TEEPUBLIC_SIGNUP_SELECTORS.submit || []),
    ].filter(Boolean);

    for (const sel of candidates) {
        try {
            await ensurePageFront(page);
            await page.waitForSelector(sel, { visible: true, timeout: 15000 });
            const btn = await page.$(sel);
            if (!btn) continue;

            await btn.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'smooth' }));
            await delay(randomBetween(120, 320));
            const box = await btn.boundingBox();
            if (box) {
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: randomBetween(8, 18) });
                await delay(randomBetween(80, 200));
            }
            await btn.click({ delay: randomBetween(60, 160) });
            logToFile(`Submit clicked via ${sel}`, 'INFO');
            return true;
        } catch (_) { /* try next */ }
    }

    return false;
}

async function waitForFormReady(page, timeoutMs = 25000, options = {}) {
    if (jobState.stopRequested) throw new Error('Stop requested');
    await ensurePageFront(page);
    logToFile('Waiting for TeePublic first-name input', 'INFO');

    if (await detectCloudflareChallenge(page)) {
        await waitForCloudflareResolution(page, {
            showBrowser: options.showBrowser ?? jobState.showBrowser,
            timeoutMs: options.cloudflareTimeoutMs || 300000,
            captchaOptions: options.captchaOptions || {},
        });
        try {
            await postCfHumanSettle(page, {
                formTimeoutMs: Math.min(timeoutMs, SIGNUP_FORM_READY_TIMEOUT_MAX_MS),
            });
        } catch (_) {
            logToFile('لم يُعثر على حقل الاسم الأول بعد Cloudflare (انتهى المهلة)', 'ERROR');
            return false;
        }
    } else {
        try {
            await page.waitForSelector(SIGNUP_FIRST_NAME_READY_SELECTOR, {
                visible: true,
                timeout: resolveSignupFormTimeoutMs({
                    formTimeoutMs: Math.min(timeoutMs, SIGNUP_FORM_READY_TIMEOUT_MAX_MS),
                }),
            });
        } catch (_) {
            logToFile('لم يُعثر على حقل الاسم الأول — تحقق من الصفحة/البروكسي', 'ERROR');
            return false;
        }
    }

    const deadline = Date.now() + Math.max(8000, timeoutMs - 2000);
    for (const name of SIGNUP_FIELD_ORDER) {
        if (jobState.stopRequested) throw new Error('Stop requested');
        const remaining = deadline - Date.now();
        if (remaining <= 0) return false;
        const sel = await waitForTeePublicSelector(page, TEEPUBLIC_SIGNUP_SELECTORS[name], remaining);
        if (!sel) {
            const label = SIGNUP_FIELD_LABELS[name] || name;
            logToFile(`حقل التسجيل غير جاهز: ${label} — قد تكون الصفحة خاطئة أو محجوبة`, 'ERROR');
            return false;
        }
    }
    logToFile('TeePublic signup form ready (all 4 fields)', 'INFO');
    return true;
}

async function detectPageSignals(page) {
    return page.evaluate(() => {
        const url = location.href.toLowerCase();
        const hasCaptcha = !!document.querySelector(
            'iframe[src*="recaptcha"], iframe[src*="captcha"], .g-recaptcha, #captcha, [class*="recaptcha"]'
        );
        const onConfirmationPage = /teepublic\.com/i.test(url) && /\/users\/confirmation/i.test(url);
        const onSignupPage = /teepublic\.com/i.test(url) && (/\/users\/sign_up|\/signup|customer_sign_up/i.test(url));
        const leftSignup = onConfirmationPage || !onSignupPage;
        const bodyText = document.body?.innerText || '';
        const successHint = onConfirmationPage
            || /verify your email|verification email sent|confirm your email|check your email|thank you|we('ve| have) sent/i.test(bodyText);
        const emailTaken = !successHint
            && /email.*(already|taken|registered|in use|exists)|already.*(registered|taken|account)|has already been taken/i.test(bodyText);
        const redirectedLogin = url.includes('/sign_in') || url.includes('/login');
        return { url, hasCaptcha, leftSignup, successHint, emailTaken, redirectedLogin, onConfirmationPage };
    }).catch(() => ({
        url: '', hasCaptcha: false, leftSignup: false, successHint: false, emailTaken: false, redirectedLogin: false, onConfirmationPage: false,
    }));
}

async function isConfirmationPage(page) {
    const signals = await detectPageSignals(page);
    if (signals.onConfirmationPage) return true;
    const url = String(await getPageUrl(page) || '').toLowerCase();
    return /teepublic\.com/i.test(url) && /\/users\/confirmation/i.test(url);
}

async function detectAlreadyRegisteredOnPage(page, email, profile) {
    const browser = page.browser();
    page = await resolveSignupPage(browser, SIGNUP_URL);
    activePage = page;
    logToFile(`Signup tab resolved for registration check: ${email}`, 'INFO');

    const formReady = await waitForFormReady(page);
    if (!formReady) {
        const loginSignals = await detectPageSignals(page);
        if (loginSignals.redirectedLogin) {
            return { alreadyRegistered: true, reason: 'already_registered', source: 'redirect_login' };
        }
        return { alreadyRegistered: false };
    }

    const { selectors } = await locateSignupFieldSelectors(page);
    if (selectors.email || TEEPUBLIC_SIGNUP_SELECTORS.email?.length) {
        await fillSignupFieldSequential(page, 'email', email);
        await delay(randomBetween(1200, 2200));
        await page.keyboard.press('Tab').catch(() => null);
        await delay(randomBetween(800, 1500));
    }

    let signals = await detectPageSignals(page);
    if (signals.emailTaken || signals.redirectedLogin) {
        return {
            alreadyRegistered: true,
            reason: 'already_registered',
            source: signals.redirectedLogin ? 'redirect_login' : 'email_taken_message',
        };
    }

    // Backup: sign_in page with email field (no password brute-force)
    try {
        await page.goto(`${LOGIN_URL}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await delay(randomBetween(900, 1600));
        signals = await detectPageSignals(page);
        const onLogin = signals.redirectedLogin || page.url().toLowerCase().includes('/sign_in');
        if (onLogin) {
            const loginEmailSel = await page.evaluate(() => {
                const input = document.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]');
                if (!input) return null;
                if (input.id) return `#${CSS.escape(input.id)}`;
                const name = input.getAttribute('name');
                if (name) return `input[name="${name.replace(/"/g, '\\"')}"]`;
                return 'input[type="email"]';
            });
            if (loginEmailSel) {
                await page.evaluate(({ sel, emailValue, helpers }) => {
                    // eslint-disable-next-line no-eval
                    eval(helpers);
                    const input = document.querySelector(sel);
                    if (!input) return;
                    input.focus();
                    setNativeValue(input, emailValue);
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                }, { sel: loginEmailSel, emailValue: email, helpers: BROWSER_FILL_HELPERS });
                await delay(randomBetween(700, 1200));
            }
            const loginBody = await page.evaluate(() => (document.body?.innerText || '').toLowerCase());
            if (/welcome back|sign in to|log in to your account|enter your password/i.test(loginBody)) {
                return { alreadyRegistered: true, reason: 'already_registered', source: 'login_page_accepts_email' };
            }
        }
    } catch (err) {
        logToFile(`Login-page registration probe skipped: ${err.message}`, 'WARN');
    }

    page = await resolveSignupPage(browser, SIGNUP_URL);
    activePage = page;
    await waitForFormReady(page);
    return { alreadyRegistered: false };
}

function markJobSkipped(email, reason = 'already_registered', message = '') {
    jobState.status = 'idle';
    jobState.phase = 'SKIPPED';
    jobState.email = email;
    jobState.skipReason = reason;
    const defaultMsg = reason === 'no_activation_link'
        ? `تخطي — لا رابط: ${email}`
        : `Skipped — already registered: ${email}`;
    jobState.message = message || defaultMsg;
    setPhase('SKIPPED', jobState.message);
    logToFile(`SKIPPED: ${email} (${reason})`, 'INFO');
}

function markJobActivated(email, message = '') {
    jobState.status = 'idle';
    jobState.phase = 'DONE';
    jobState.email = email;
    jobState.skipReason = '';
    jobState.message = message || `مفعّل مسبقاً: ${email}`;
    setPhase('DONE', jobState.message);
    logToFile(`ALREADY_ACTIVATED: ${email}`, 'INFO');
}

async function waitAfterSubmitClick(page, email) {
    let captchaNotified = false;
    const monitorUntil = Date.now() + 15 * 60 * 1000;

    while (Date.now() < monitorUntil) {
        if (jobState.stopRequested) throw new Error('Stop requested');

        const validation = await detectSignupValidationErrors(page);
        if (validation.onSignupPage && (validation.passwordTooShort || validation.nameError || validation.hasVisibleError)) {
            const msg = validation.passwordTooShort
                ? `Password too short (${validation.passwordLength} chars) — signup blocked`
                : 'Signup form validation failed — not advancing to email wait';
            logToFile(`${msg} for ${email}`, 'ERROR');
            await showFillOverlay(page, `Creaty ERROR: ${msg}`).catch(() => null);
            setPhase('FILLING', msg);
            return 'validation_failed';
        }

        const signals = await detectPageSignals(page);

        if (signals.leftSignup || signals.successHint || signals.onConfirmationPage) {
            const recheck = await detectSignupValidationErrors(page);
            if (recheck.onSignupPage && (recheck.passwordTooShort || recheck.nameError)) {
                logToFile(`Signup success signal ignored — validation errors still visible for ${email}`, 'WARN');
                await delay(1500);
                continue;
            }
            setPhase('WAIT_EMAIL', `Signup submitted — waiting for activation email: ${email}`);
            if (signals.onConfirmationPage) {
                logToFile(`TeePublic confirmation page detected for ${email} — starting activation poll`, 'INFO');
            }
            return 'wait_email';
        }

        if (signals.emailTaken) {
            setPhase('WAIT_EMAIL', `Email may already exist — polling activation link: ${email}`);
            await showFillOverlay(page, 'Creaty: checking activation email…').catch(() => null);
            return 'wait_email';
        }

        if (signals.hasCaptcha && !captchaNotified) {
            captchaNotified = true;
            setPhase('CAPTCHA', `Complete CAPTCHA for ${email}`);
        }

        await delay(2000);
    }

    throw new Error('Timeout waiting for signup submit / CAPTCHA');
}

async function fetchActivationLinkOnce(meta, options = {}) {
    const attempt = Number(options.attempt || 0);
    const sinceMs = Number(options.sinceMs || Date.parse(jobState.startedAt || '') || 0);
    const resolvedSessionId = await resolveActivationMetaSessionId(meta);
    const resolvedMeta = syncResolvedActivationMeta({
        ...meta,
        sessionId: resolvedSessionId,
        id: resolvedSessionId,
    }, resolvedSessionId);
    const apiBase = String(resolvedMeta.apiBase || '').replace(/\/+$/, '');
    const token = String(resolvedMeta.token || '').trim();
    const userId = String(resolvedMeta.userId || '').trim();
    const sessionId = String(resolvedMeta.sessionId || '').trim();
    const accountId = String(resolvedMeta.localSessionId || meta.localSessionId || meta.sessionId || meta.id || sessionId).trim();
    const email = String(resolvedMeta.email || resolvedMeta.display_email || '').trim();
    const linkOptions = { email, sinceMs, attempt };
    const activationEndpoint = `${apiBase}/api/creaty/signup-queue/${encodeURIComponent(sessionId)}/activation-link`;

    logActivationPollPhase('WAIT_EMAIL', {
        email,
        accountId,
        attempt,
        sessionId,
        sentSessionId: meta.sessionId || meta.id || '',
        apiBase,
        token: maskToken(token),
        userId,
        endpoint: activationEndpoint,
    });
    emitSignupTrace('server.fetchActivationLinkOnce', {
        email,
        sessionId,
        sentSessionId: meta.sessionId || meta.id || '',
        apiBase,
        token,
        userId,
        extra: { attempt, accountId },
    });
    if (!apiBase || !token || !userId || !sessionId) {
        logActivationPollPhase('WAIT_EMAIL', {
            email,
            accountId,
            attempt,
            status: 'missing_creds',
            hasApiBase: !!apiBase,
            hasToken: !!token,
            hasUserId: !!userId,
            hasSessionId: !!sessionId,
        });
        return null;
    }

    const activationUrl = new URL(activationEndpoint);
    activationUrl.searchParams.set('token', token);
    activationUrl.searchParams.set('userId', userId);

    try {
        const res = await fetch(activationUrl.toString(), {
            headers: { Accept: 'application/json', 'x-creaty-token': token },
            signal: AbortSignal.timeout(12000),
        });
        const rawBody = await res.text().catch(() => '');
        const data = (() => {
            try { return JSON.parse(rawBody); } catch (_) { return {}; }
        })();
        if (res.ok && data.found && data.link) {
            const apiLink = await parseAndValidateActivationLink(String(data.link || '').trim());
            if (apiLink) {
                logActivationPollPhase('LINK_FOUND', { email, accountId, attempt, source: 'activation-link-api' });
                setPhase('ACTIVATING', `Activation link found for ${email}`);
                emitSignupTrace('server.fetchActivationLinkOnce.hit', {
                    email,
                    sessionId,
                    apiBase,
                    token,
                    userId,
                    httpStatus: res.status,
                    responseSnippet: String(apiLink).slice(0, 120),
                    extra: { source: 'activation-link-api' },
                });
                return apiLink;
            }
        }
        const directLink = await extractActivationLinkFromResponse(data, linkOptions);
        logActivationPollPhase('WAIT_EMAIL', {
            email,
            accountId,
            attempt,
            mailbox: email,
            endpoint: 'activation-link',
            url: activationUrl.toString().slice(0, 200),
            httpStatus: res.status,
            bodyLength: rawBody.length,
            messageCount: countMessagesInPayload(data),
            linkFound: !!directLink,
            polledAt: new Date().toISOString(),
        });
        if (res.ok && directLink) {
            logActivationPollPhase('LINK_FOUND', { email, accountId, attempt, source: 'activation-link' });
            setPhase('ACTIVATING', `Activation link found for ${email}`);
            emitSignupTrace('server.fetchActivationLinkOnce.hit', {
                email,
                sessionId,
                apiBase,
                token,
                userId,
                httpStatus: res.status,
                responseSnippet: String(directLink).slice(0, 120),
            });
            return String(directLink || '').trim();
        }
        if (!res.ok && res.status !== 404) {
            logToFile(`Activation-link endpoint HTTP ${res.status}: ${data.error || 'no details'}`, 'WARN');
            emitSignupTrace('server.fetchActivationLinkOnce.error', {
                email,
                sessionId,
                apiBase,
                token,
                userId,
                httpStatus: res.status,
                responseSnippet: data.error || JSON.stringify(data).slice(0, 180),
                extra: { requestUrl: activationUrl.pathname },
            });
        }
    } catch (err) {
        logToFile(`Activation-link endpoint error: ${err.message}`, 'WARN');
        logActivationPollPhase('WAIT_EMAIL', {
            email,
            accountId,
            attempt,
            endpoint: 'activation-link',
            error: err.message,
        });
        emitSignupTrace('server.fetchActivationLinkOnce.error', {
            email,
            sessionId,
            apiBase,
            token,
            userId,
            responseSnippet: err.message,
            extra: { requestUrl: activationUrl.pathname },
        });
    }

    try {
        const data = await fetchEmailCoreMessages(resolvedMeta, { attempt, sinceMs });
        const link = await extractActivationLinkFromResponse(data, linkOptions);
        logActivationPollPhase('WAIT_EMAIL', {
            email,
            accountId,
            attempt,
            endpoint: 'messages',
            messageCount: countMessagesInPayload(data),
            linkFound: !!link,
        });
        if (link) {
            logActivationPollPhase('LINK_FOUND', { email, accountId, attempt, source: 'messages' });
        }
        return link;
    } catch (err) {
        logActivationPollPhase('WAIT_EMAIL', {
            email,
            accountId,
            attempt,
            endpoint: 'messages',
            error: err.message,
        });
        if (!/session not found|invalid inbox token/i.test(String(err.message || ''))) {
            throw err;
        }
        return null;
    }
}

async function requestEmailCoreResend(meta) {
    const resolvedSessionId = await resolveActivationMetaSessionId(meta);
    const resolvedMeta = syncResolvedActivationMeta({ ...meta, sessionId: resolvedSessionId }, resolvedSessionId);
    const apiBase = String(resolvedMeta.apiBase || '').replace(/\/+$/, '');
    const token = String(resolvedMeta.token || '').trim();
    const userId = String(resolvedMeta.userId || '').trim();
    const sessionId = String(resolvedMeta.sessionId || '').trim();
    if (!apiBase || !token || !userId || !sessionId) return false;

    try {
        const url = `${apiBase}/api/creaty/signup-queue/${encodeURIComponent(sessionId)}/resend-activation`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-creaty-token': token },
            body: JSON.stringify({ token, userId }),
            signal: AbortSignal.timeout(20000),
        });
        if (res.status === 404) return false;
        const data = await res.json().catch(() => ({}));
        return res.ok && data.ok !== false;
    } catch (err) {
        logToFile(`EmailCore RESEND error: ${err.message}`, 'WARN');
        return false;
    }
}

async function tryResendOnConfirmationPage(page, email) {
    if (!page || page.isClosed()) return false;
    try {
        const onConfirm = await isConfirmationPage(page);
        if (!onConfirm) return false;

        const clicked = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a, button, input[type="submit"]'));
            const hit = anchors.find((el) => {
                const text = `${el.textContent || ''} ${el.value || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
                return /resend.*confirm|confirm.*resend|confirmation.*instructions|didn.?t receive|verify.*email|send.*again/i.test(text);
            });
            if (!hit) return false;
            hit.click();
            return true;
        });
        if (clicked) {
            logToFile(`TeePublic confirmation-page RESEND clicked for ${email}`, 'INFO');
            await delay(randomBetween(2000, 3500));
            return true;
        }
    } catch (err) {
        logToFile(`TeePublic confirmation-page RESEND failed: ${err.message}`, 'WARN');
    }
    return false;
}

async function tryResendActivationOnTeePublic(page, email, password) {
    if (!page || page.isClosed()) return false;
    try {
        if (await tryResendOnConfirmationPage(page, email)) return true;

        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await delay(randomBetween(900, 1600));

        const emailSel = await page.evaluate(() => {
            const input = document.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]');
            if (!input) return null;
            if (input.id) return `#${CSS.escape(input.id)}`;
            const name = input.getAttribute('name');
            if (name) return `input[name="${name.replace(/"/g, '\\"')}"]`;
            return 'input[type="email"]';
        });
        if (emailSel) {
            await page.evaluate(({ sel, emailValue, helpers }) => {
                // eslint-disable-next-line no-eval
                eval(helpers);
                const input = document.querySelector(sel);
                if (!input) return;
                input.focus();
                setNativeValue(input, emailValue);
                input.dispatchEvent(new Event('blur', { bubbles: true }));
            }, { sel: emailSel, emailValue: email, helpers: BROWSER_FILL_HELPERS });
            await delay(randomBetween(700, 1200));
        }

        const clicked = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a, button, input[type="submit"]'));
            const hit = anchors.find((el) => {
                const text = `${el.textContent || ''} ${el.value || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
                return /resend.*confirm|confirm.*resend|confirmation.*instructions|didn.?t receive|verify.*email/i.test(text);
            });
            if (!hit) return false;
            hit.click();
            return true;
        });
        if (clicked) {
            logToFile(`TeePublic RESEND clicked for ${email}`, 'INFO');
            await delay(randomBetween(2000, 3500));
            return true;
        }

        if (password) {
            const pwdSel = await page.evaluate(() => {
                const input = document.querySelector('input[type="password"]');
                if (!input) return null;
                if (input.id) return `#${CSS.escape(input.id)}`;
                return 'input[type="password"]';
            });
            if (pwdSel) {
                await page.evaluate(({ sel, pwd, helpers }) => {
                    // eslint-disable-next-line no-eval
                    eval(helpers);
                    const input = document.querySelector(sel);
                    if (!input) return;
                    setNativeValue(input, pwd);
                }, { sel: pwdSel, pwd: password, helpers: BROWSER_FILL_HELPERS });
                await delay(500);
                await page.keyboard.press('Enter').catch(() => null);
                await delay(randomBetween(1500, 2500));
                const resendAfterLogin = await page.evaluate(() => {
                    const anchors = Array.from(document.querySelectorAll('a, button'));
                    const hit = anchors.find((el) => /resend|confirm.*email|verification/i.test((el.textContent || '').toLowerCase()));
                    if (!hit) return false;
                    hit.click();
                    return true;
                });
                if (resendAfterLogin) {
                    logToFile(`TeePublic RESEND after login for ${email}`, 'INFO');
                    return true;
                }
            }
        }
    } catch (err) {
        logToFile(`TeePublic RESEND failed: ${err.message}`, 'WARN');
    }
    return false;
}

function hasActivationApiCreds(meta) {
    const apiBase = String(meta?.apiBase || '').replace(/\/+$/, '');
    const token = String(meta?.token || '').trim();
    const userId = String(meta?.userId || '').trim();
    const sessionId = String(meta?.sessionId || '').trim();
    return !!(apiBase && token && userId && sessionId);
}

async function resolveActivationLink(page, email, meta, password, options = {}) {
    const touchPhase = (phase, message = '') => {
        if (options.updateJobPhase !== false) setPhase(phase, message);
    };
    touchPhase('WAIT_EMAIL', `طلب رابط التفعيل: ${email}`);
    logToFile(`طلب رابط التفعيل: ${email}`, 'INFO');
    logActivationPollPhase('WAIT_EMAIL', {
        email,
        accountId: meta?.localSessionId || meta?.sessionId || meta?.id || '',
        sessionId: meta?.sessionId,
        apiBase: meta?.apiBase,
        token: maskToken(meta?.token),
        userId: meta?.userId,
    });
    emitSignupTrace('server.resolveActivationLink.enter', {
        email,
        sessionId: meta?.sessionId,
        apiBase: meta?.apiBase,
        token: meta?.token,
        userId: meta?.userId,
    });

    const sinceMs = Date.parse(jobState.startedAt || '') || (Date.now() - 120000);
    let hintedLink = await findActivationLinkInSource(options.body, { email, sinceMs });
    if (!hintedLink) hintedLink = await findActivationLinkInSource(meta, { email, sinceMs });
    if (hintedLink) {
        const valid = await parseAndValidateActivationLink(hintedLink);
        if (valid) {
            logActivationPollPhase('LINK_FOUND', { email, source: 'payload' });
            touchPhase('ACTIVATING', `Activation link found for ${email}`);
            logToFile(`Activation link recovered from imported/account payload for ${email}`, 'INFO');
            return valid;
        }
    }

    const apiEnabled = options.apiPollEnabled !== false && hasActivationApiCreds(meta);
    const preResendPollCount = Number(options.preResendPolls)
        || (options.afterSignupSubmit ? Math.min(ACTIVATION_MAX_POLLS, 30) : 3);
    let pollMeta = {
        ...currentJobMeta,
        ...meta,
        email,
        localSessionId: meta.localSessionId || meta.sessionId || meta.id || currentJobMeta.localSessionId || '',
    };
    if (!apiEnabled) {
        logToFile(`API poll disabled — TeePublic RESEND only for ${email}`, 'WARN');
    } else {
        for (let i = 0; i < preResendPollCount; i += 1) {
            if (jobState.stopRequested) throw new Error('Stop requested');
            if (options.afterSignupSubmit && i === 8) {
                await tryResendOnConfirmationPage(page, email).catch(() => false);
            }
            pollMeta = { ...pollMeta, ...currentJobMeta, email };
            try {
                const link = await fetchActivationLinkOnce(pollMeta, { attempt: i + 1, sinceMs });
                if (link) {
                    touchPhase('ACTIVATING', `Activation link found for ${email}`);
                    if (i > 0) {
                        logToFile(`Activation link found after ${i + 1} inbox poll(s) for ${email}`, 'INFO');
                    }
                    return link;
                }
            } catch (err) {
                logToFile(`Activation link fetch: ${err.message}`, 'WARN');
            }
            if (i < preResendPollCount - 1) {
                await delay(computeActivationPollDelay(i + 1));
            }
        }
    }

    touchPhase('WAIT_EMAIL', `إعادة إرسال RESEND: ${email}`);
    logToFile(`إعادة إرسال RESEND: ${email}`, 'INFO');

    const apiResend = apiEnabled ? await requestEmailCoreResend(pollMeta) : false;
    const tpResend = await tryResendActivationOnTeePublic(page, email, password);
    if (!apiResend && !tpResend) {
        markJobSkipped(email, 'no_activation_link', `تخطي — لا رابط: ${email}`);
        return null;
    }

    if (!apiEnabled) {
        logToFile(`RESEND sent — no EmailCore token/sessionId to poll inbox; holding browser for ${email}`, 'WARN');
        touchPhase('WAIT_EMAIL', `انتظار رابط التفعيل (RESEND بدون API): ${email}`);
        const holdSteps = options.noApiHoldSteps || 15;
        for (let i = 0; i < holdSteps; i += 1) {
            if (jobState.stopRequested) throw new Error('Stop requested');
            await delay(computeActivationPollDelay(i + 1));
        }
        markJobSkipped(email, 'no_activation_link', `تخطي — لا رابط: ${email}`);
        return null;
    }

    const maxPolls = options.maxPollsAfterResend || Math.min(ACTIVATION_MAX_POLLS, 24);
    for (let i = 0; i < maxPolls; i += 1) {
        if (jobState.stopRequested) throw new Error('Stop requested');
        pollMeta = { ...pollMeta, ...currentJobMeta, email };
        try {
            const link = await fetchActivationLinkOnce(pollMeta, { attempt: preResendPollCount + i + 1, sinceMs });
            if (link) {
                touchPhase('ACTIVATING', `Activation link found for ${email}`);
                logToFile(`Activation link found after RESEND for ${email}`, 'INFO');
                return link;
            }
        } catch (err) {
            logToFile(`Activation poll after RESEND: ${err.message}`, 'WARN');
        }
        await delay(computeActivationPollDelay(i + 1));
    }

    markJobSkipped(email, 'no_activation_link', `تخطي — لا رابط: ${email}`);
    return null;
}

async function fetchEmailCoreLibraryMessages(meta = {}, options = {}) {
    const apiBase = String(meta.apiBase || '').replace(/\/+$/, '');
    const token = String(meta.token || '').trim();
    const userId = String(meta.userId || '').trim();
    const email = String(meta.email || meta.display_email || '').trim().toLowerCase();
    const attempt = Number(options.attempt || 0);
    const sinceMs = Number(options.sinceMs || Date.parse(jobState.startedAt || '') || 0);
    if (!apiBase || !token || !userId) {
        throw new Error('apiBase, token, userId required for library/messages');
    }

    const url = appendCacheBust(new URL(`${apiBase}/api/creaty/library/messages`));
    url.searchParams.set('token', token);
    url.searchParams.set('userId', userId);
    url.searchParams.set('limit', '100');
    if (email) url.searchParams.set('email', email);
    if (sinceMs > 0) {
        url.searchParams.set('since', new Date(Math.max(0, sinceMs - 120000)).toISOString());
    }

    logActivationPollPhase('WAIT_EMAIL', {
        email,
        attempt,
        mailbox: email || '—',
        endpoint: 'library/messages',
        url: url.toString().slice(0, 200),
        apiBase,
        token: maskToken(token),
        userId,
        polledAt: new Date().toISOString(),
    });

    const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json', 'x-creaty-token': token },
        signal: AbortSignal.timeout(20000),
    });
    const rawBody = await res.text().catch(() => '');
    const data = (() => {
        try { return JSON.parse(rawBody); } catch (_) { return {}; }
    })();
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const filtered = email
        ? filterActivationMessages(messages, { email, sinceMs })
        : messages;
    const resultMessages = filtered.length ? filtered : messages;

    logActivationPollPhase('WAIT_EMAIL', {
        email,
        attempt,
        mailbox: email || '—',
        endpoint: 'library/messages',
        url: url.toString().slice(0, 200),
        httpStatus: res.status,
        bodyLength: rawBody.length,
        messageCount: resultMessages.length,
        polledAt: new Date().toISOString(),
    });
    if (!res.ok) {
        throw new Error(data.error || `library/messages HTTP ${res.status}`);
    }

    logActivationEmailMessages(resultMessages, email, attempt);
    return { ...data, messages: resultMessages };
}

async function fetchEmailCoreInboxMessages(meta, options = {}) {
    const apiBase = String(meta.apiBase || '').replace(/\/+$/, '');
    const email = String(meta.email || meta.display_email || '').trim().toLowerCase();
    const sessionId = String(options.sessionId || meta.sessionId || meta.id || '').trim();
    const attempt = Number(options.attempt || 0);
    if (!apiBase || !email || !sessionId) return null;

    const inboxToken = deriveInboxToken(sessionId, email)
        || String(options.inboxToken || meta.inboxToken || '').trim();
    if (!inboxToken) return null;

    const inboxUrl = appendCacheBust(new URL(`${apiBase}/api/extension/inbox/messages`));
    inboxUrl.searchParams.set('email', email);
    inboxUrl.searchParams.set('sessionId', sessionId);
    inboxUrl.searchParams.set('token', inboxToken);

    logActivationPollPhase('WAIT_EMAIL', {
        email,
        attempt,
        mailbox: email,
        endpoint: inboxUrl.pathname,
        url: inboxUrl.toString().slice(0, 200),
        sessionId,
        inboxToken: maskToken(inboxToken),
        apiBase,
        polledAt: new Date().toISOString(),
    });

    const inboxRes = await fetch(inboxUrl.toString(), { signal: AbortSignal.timeout(20000) });
    const rawBody = await inboxRes.text().catch(() => '');
    const inboxData = (() => {
        try { return JSON.parse(rawBody); } catch (_) { return {}; }
    })();
    logActivationPollPhase('WAIT_EMAIL', {
        email,
        attempt,
        mailbox: email,
        endpoint: 'inbox/messages',
        url: inboxUrl.toString().slice(0, 200),
        sessionId,
        httpStatus: inboxRes.status,
        bodyLength: rawBody.length,
        messageCount: countMessagesInPayload(inboxData),
        polledAt: new Date().toISOString(),
    });
    if (inboxRes.ok) {
        logToFile(`Activation inbox fallback succeeded for ${email} (sessionId=${sessionId})`, 'INFO');
        return inboxData;
    }

    const inboxErr = String(inboxData.error || `Inbox messages HTTP ${inboxRes.status}`);
    emitSignupTrace('server.fetchEmailCoreInboxMessages.error', {
        email,
        sessionId,
        apiBase,
        token: meta.token,
        userId: meta.userId,
        httpStatus: inboxRes.status,
        responseSnippet: inboxErr,
        extra: { inboxSessionId: sessionId },
    });
    const err = new Error(inboxErr);
    err.httpStatus = inboxRes.status;
    throw err;
}

async function fetchEmailCoreMessages(meta, options = {}) {
    const apiBase = String(meta.apiBase || '').replace(/\/+$/, '');
    const token = String(meta.token || '').trim();
    const userId = String(meta.userId || '').trim();
    const sessionId = String(meta.sessionId || '').trim();
    const email = String(meta.email || meta.display_email || '').trim().toLowerCase();
    const attempt = Number(options.attempt || 0);
    const messagesEndpoint = `${apiBase}/api/creaty/signup-queue/${encodeURIComponent(sessionId)}/messages`;

    logActivationPollPhase('WAIT_EMAIL', {
        email,
        attempt,
        sessionId,
        apiBase,
        token: maskToken(token),
        userId,
        endpoint: messagesEndpoint,
    });

    if (!apiBase || !token || !userId || !sessionId) {
        throw new Error('apiBase, token, userId, sessionId required for activation poll');
    }

    let lastError = null;

    try {
        const url = appendCacheBust(new URL(messagesEndpoint));
        url.searchParams.set('token', token);
        url.searchParams.set('userId', userId);

        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
        const rawBody = await res.text().catch(() => '');
        const data = (() => {
            try { return JSON.parse(rawBody); } catch (_) { return {}; }
        })();
        logActivationPollPhase('WAIT_EMAIL', {
            email,
            attempt,
            mailbox: email,
            endpoint: 'messages',
            url: url.toString().slice(0, 200),
            httpStatus: res.status,
            bodyLength: rawBody.length,
            messageCount: countMessagesInPayload(data),
            polledAt: new Date().toISOString(),
        });
        if (res.ok) {
            if (countMessagesInPayload(data) > 0) return data;
        } else {
        const errText = String(data.error || `EmailCore messages HTTP ${res.status}`);
        if (/session not found/i.test(errText)) {
            emitSignupTrace('server.fetchEmailCoreMessages.sessionNotFound', {
                email,
                sessionId,
                sentSessionId: sessionId,
                apiBase,
                token,
                userId,
                httpStatus: res.status,
                responseSnippet: errText,
            });
        } else {
            emitSignupTrace('server.fetchEmailCoreMessages.error', {
                email,
                sessionId,
                apiBase,
                token,
                userId,
                httpStatus: res.status,
                responseSnippet: errText,
            });
        }
        lastError = new Error(errText);
        }
    } catch (err) {
        lastError = err;
    }

    if (email) {
        try {
            const libData = await fetchEmailCoreLibraryMessages(meta, options);
            const libCount = countMessagesInPayload(libData);
            logActivationPollPhase('WAIT_EMAIL', {
                email,
                attempt,
                endpoint: 'library/messages',
                messageCount: libCount,
            });
            if (libCount > 0 || Array.isArray(libData.messages)) return libData;
        } catch (libErr) {
            logActivationPollPhase('WAIT_EMAIL', {
                email,
                attempt,
                endpoint: 'library/messages',
                error: libErr.message,
            });
            if (!lastError) lastError = libErr;
        }
    }

    if (apiBase && email) {
        const inboxSessionCandidates = [
            sessionId,
            String(meta.emailcoreSessionId || '').trim(),
            email,
            String(meta.sentSessionId || meta.localSessionId || '').trim(),
        ].filter((value, index, arr) => value && arr.indexOf(value) === index);

        for (const candidateId of inboxSessionCandidates) {
            try {
                return await fetchEmailCoreInboxMessages(meta, { sessionId: candidateId, attempt });
            } catch (err) {
                lastError = err;
                if (!/invalid inbox token|session not found/i.test(String(err.message || ''))) break;
            }
        }
    }

    throw lastError || new Error('Activation inbox fetch failed');
}

async function pollActivationEmail(page, email, meta) {
    setPhase('WAIT_EMAIL', `Polling inbox for activation email: ${email}`);
    logToFile(`Polling EmailCore API for activation: ${meta.apiBase}/api/creaty/signup-queue/${meta.sessionId}/messages`);
    const sinceMs = Date.parse(jobState.startedAt || '') || (Date.now() - 120000);

    for (let i = 0; i < ACTIVATION_MAX_POLLS; i += 1) {
        if (jobState.stopRequested) throw new Error('Stop requested');

        try {
            const link = await fetchActivationLinkOnce(meta, { attempt: i + 1, sinceMs });
            if (link) {
                logToFile(`Activation link found for ${email}`, 'INFO');
                return link;
            }
        } catch (err) {
            logToFile(`Activation poll error: ${err.message}`, 'WARN');
        }

        await delay(computeActivationPollDelay(i + 1));
    }

    throw new Error(`Activation email timeout for ${email}`);
}

async function verifyActivationSuccess(page) {
    return page.evaluate(() => {
        const url = location.href.toLowerCase();
        const text = (document.body?.innerText || '').toLowerCase();
        const successBanner = /confirmed|verified|thank you|thanks for verifying|you may now sign in|welcome|successfully|email has been confirmed|account has been activated/i;

        if (successBanner.test(text)) return true;
        if (url.includes('/dashboard') || url.includes('/stores') || url.includes('/design')) return true;
        if (/\/users\/sign_in|\/sign_in/.test(url) && successBanner.test(text)) return true;
        if (/users\/confirmation|\/confirm|verification|activate/.test(url) && successBanner.test(text)) return true;

        if (/tee\.pub|\/lic\//.test(url)) return false;
        if (/sign[_-]?up|register/.test(url) && !/\/users\/sign_in/.test(url)) return false;
        if (/[?&](ref|referral|invite)=/.test(url)) return false;
        if (/\/signup\/designer\/|sell-art-online|designer-signup/.test(url)) return false;
        return false;
    }).catch(() => false);
}

async function activateAccountInSession(page, activationUrl, email) {
    const validUrl = await parseAndValidateActivationLink(activationUrl);
    if (!validUrl) {
        logActivationPollPhase('FAILED', { email, reason: 'invalid_activation_url' });
        logActivationPollPhase('FAILED_ACTIVATION', { email, reason: 'invalid_activation_url' });
        throw new Error(`Invalid activation URL for ${email}`);
    }

    setPhase('ACTIVATING', `Opening activation link for ${email}`);
    logActivationPollPhase('ACTIVATING', { email, url: validUrl.slice(0, 120) });
    logToFile(`Navigating to activation URL in same session: ${validUrl}`);

    const browser = activeBrowser;
    if (!page || page.isClosed()) {
        if (browser && browser.isConnected()) {
            page = await resolveLivePage(browser, activePage);
            activePage = page;
            logToFile(`Recovered live page for activation: ${email}`, 'WARN');
        } else {
            logActivationPollPhase('FAILED_ACTIVATION', { email, reason: 'page_closed' });
            throw new Error(`No live browser page for activation: ${email}`);
        }
    }
    if (!browser || !browser.isConnected()) {
        logActivationPollPhase('FAILED_ACTIVATION', { email, reason: 'browser_disconnected' });
        throw new Error('Browser disconnected before activation');
    }

    const navigateActivation = async (livePage) => {
        await ensurePageFront(livePage);
        await livePage.goto(validUrl, { waitUntil: 'networkidle2', timeout: ACTIVATION_NAV_TIMEOUT_MS });
        return livePage;
    };

    let lastNavError = null;
    for (let attempt = 1; attempt <= ACTIVATION_NAV_RETRIES; attempt += 1) {
        try {
            if (browser) {
                const nav = await evaluateWithFrameRecovery(browser, page, navigateActivation, {
                    label: 'activation-goto',
                    maxAttempts: 4,
                });
                page = nav.page;
                activePage = page;
            } else {
                await ensurePageFront(page);
                await navigateActivation(page);
            }
            lastNavError = null;
            break;
        } catch (err) {
            lastNavError = err;
            logToFile(`Activation navigation attempt ${attempt}/${ACTIVATION_NAV_RETRIES} failed: ${err.message}`, 'WARN');
            if (attempt >= ACTIVATION_NAV_RETRIES) break;
            if (browser && browser.isConnected()) {
                page = await resolveLivePage(browser, page);
                activePage = page;
            }
            await delay(randomBetween(1200, 2400));
        }
    }
    if (lastNavError) {
        logActivationPollPhase('FAILED_ACTIVATION', { email, reason: lastNavError.message });
        setPhase('FAILED_ACTIVATION', `Activation navigation failed: ${email}`);
        throw lastNavError;
    }

    await delay(randomBetween(1500, 3000));

    const landedUrl = String(page.url() || '').trim();
    logToFile(`Activation landed at: ${landedUrl}`, 'INFO');

    if (await detectCloudflareChallenge(page)) {
        await waitForCloudflareResolution(page, {
            showBrowser: jobState.showBrowser,
            timeoutMs: 900000,
            readySelector: null,
            contextLabel: 'TeePublic activation',
        });
        await delay(randomBetween(1500, 3000));
    }

    let verified = await verifyActivationSuccess(page);
    if (!verified) {
        await delay(3000);
        verified = await verifyActivationSuccess(page);
    }
    if (!verified) {
        if (isTeePublicBadActivationLandingUrl(landedUrl) || isTeePublicTrackingLink(landedUrl)) {
            logActivationPollPhase('FAILED_ACTIVATION', { email, reason: 'landed_on_referral_not_confirmation', url: landedUrl.slice(0, 120) });
            setPhase('FAILED_ACTIVATION', `Activation landed on referral/signup page: ${email}`);
            throw new Error(`Activation navigated to referral/signup page instead of confirmation for ${email}`);
        }
        logToFile(`Activation page loaded but success not confirmed for ${email}`, 'WARN');
        logActivationPollPhase('FAILED_ACTIVATION', { email, reason: 'success_not_confirmed', url: landedUrl.slice(0, 120) });
        setPhase('FAILED_ACTIVATION', `Activation opened but not confirmed: ${email}`);
        throw new Error(`Activation not confirmed for ${email}`);
    }

    logActivationPollPhase('ACTIVATED', { email });
    setPhase('DONE', `Account activated: ${email}`);
    logToFile(`Activation complete for ${email}`, 'INFO');
    return true;
}

// @FROZEN registration-activation — edits require unlock key 693400 (see REGISTRATION_ACTIVATION_FROZEN.manifest.json)
async function runActivationOnlyJob(body = {}) {
    body = sanitizeSignupJobBody(body);
    const email = String(body.email || body.display_email || '').trim();
    const password = String(body.password || body.pass || '').trim();
    let sessionId = String(body.sessionId || body.id || '').trim();
    const apiBase = String(body.apiBase || 'http://localhost:3000').replace(/\/+$/, '');
    const token = String(body.token || '').trim();
    const userId = String(body.userId || '').trim();

    if (!email) throw new Error('email is required');

    currentJobMeta = await resolveActivationJobMeta(body, { email });
    sessionId = currentJobMeta.sessionId;
    emitSignupTrace('server.runActivationOnlyJob.sessionResolved', {
        email,
        sessionId,
        apiBase: currentJobMeta.apiBase,
        token: currentJobMeta.token,
        userId: currentJobMeta.userId,
    });

    jobState.status = 'running';
    jobState.email = email;
    jobState.stopRequested = false;
    jobState.startedAt = new Date().toISOString();
    jobState.skipReason = '';

    const showBrowser = body.showBrowser !== false;
    jobState.showBrowser = showBrowser;
    jobState.keepBrowserOpen = showBrowser === true;

    setPhase('OPENING', `تفعيل — فتح متصفح TeePublic: ${email}`);
    const accountProxy = String(body.proxy || body.accountProxy || '').trim();
    const page = await launchBrowserForEmail(email, { showBrowser, proxy: accountProxy });
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((err) => {
        logToFile(`Activation navigate warning: ${err.message}`, 'WARN');
    });

    currentJobMeta = await resolveActivationJobMeta(body, { email });
    sessionId = currentJobMeta.sessionId;
    if (!(await detectCloudflareChallenge(page))) {
        await installManualActivationButton(page, currentJobMeta).catch(() => null);
    }
    const apiEnabled = hasActivationApiCreds(currentJobMeta);
    if (!apiEnabled) {
        logToFile(`Activation API creds missing for ${email} — browser RESEND only`, 'WARN');
    }

    const activationLink = await resolveActivationLink(page, email, currentJobMeta, password, {
        apiPollEnabled: apiEnabled,
        body,
    });
    if (!activationLink) {
        await closeActiveBrowser({ reason: 'تفعيل — لا رابط تفعيل' });
        return {
            success: true,
            skipped: true,
            email,
            phase: 'SKIPPED',
            skipReason: jobState.skipReason || 'no_activation_link',
        };
    }

    await activateAccountInSession(page, activationLink, email);
    await closeActiveBrowser({
        force: !jobState.keepBrowserOpen,
        reason: 'تفعيل مكتمل — إغلاق المتصفح',
    });
    return { success: true, email, phase: 'DONE' };
}

async function detachBrowserForDeferredActivation() {
    const normEmail = normalizeEmail(activeBrowserEmail);
    const pending = pendingDeferredActivations.get(normEmail);
    if (!pending || !activeBrowser) return false;
    pending.browser = activeBrowser;
    pending.page = activePage && !activePage.isClosed() ? activePage : pending.page;
    pending.browserEmail = activeBrowserEmail;
    pending.userDataDir = activeUserDataDir;
    activeBrowser = null;
    activePage = null;
    activeBrowserEmail = '';
    activeUserDataDir = null;
    activeStealthProfile = null;
    activeProxyAuth = null;
    logToFile(`[Deferred activation] browser detached (kept open) for ${pending.browserEmail || normEmail}`, 'INFO');
    return true;
}

async function resolveDeferredActivationPage(taskPage, email) {
    const normEmail = normalizeEmail(email);
    const pending = pendingDeferredActivations.get(normEmail);
    const browser = pending?.browser || activeBrowser;
    const preferredPage = taskPage && !taskPage.isClosed()
        ? taskPage
        : (pending?.page && !pending.page.isClosed() ? pending.page : activePage);
    if (preferredPage && !preferredPage.isClosed()) {
        if (browser?.isConnected()) {
            const livePage = await resolveLivePage(browser, preferredPage).catch(() => preferredPage);
            if (pending) pending.page = livePage;
            activePage = livePage;
            return livePage;
        }
        return preferredPage;
    }
    if (browser?.isConnected()) {
        const livePage = await resolveLivePage(browser, activePage).catch(() => null);
        if (livePage && !livePage.isClosed()) {
            if (pending) pending.page = livePage;
            activePage = livePage;
            return livePage;
        }
    }
    return null;
}

function scheduleDeferredSignupActivation(task) {
    const email = String(task.email || '').trim();
    const normEmail = normalizeEmail(email);
    if (email) {
        pendingDeferredActivations.set(normEmail, {
            meta: { ...(task.meta || {}) },
            body: { ...(task.body || {}) },
            startedAt: Date.now(),
            browser: activeBrowser,
            page: task.page && !task.page.isClosed() ? task.page : activePage,
            browserEmail: email,
            userDataDir: activeUserDataDir,
        });
    }
    logToFile(`[Deferred activation] scheduled for ${email}`, 'INFO');
    activationSideChain = activationSideChain.then(() => completeDeferredSignupActivation(task)).catch((err) => {
        logToFile(`[Deferred activation] chain error for ${task.email}: ${err.message}`, 'ERROR');
    });
}

async function completeDeferredSignupActivation(task) {
    const email = String(task.email || '').trim();
    const normEmail = normalizeEmail(email);
    if (!email) return;

    const body = { ...task.body };
    const password = String(task.password || '').trim();
    const showBrowser = task.showBrowser !== false;
    const keepBrowserOpen = showBrowser === true;
    const accountProxy = String(body.proxy || body.accountProxy || '').trim();
    const localSessionId = String(
        task.meta?.localSessionId || body.localSessionId || body.sessionId || body.id || ''
    ).trim();
    const meta = await resolveActivationJobMeta(body, {
        email,
        ...task.meta,
        localSessionId,
    });
    pendingDeferredActivations.set(normEmail, {
        ...(pendingDeferredActivations.get(normEmail) || {}),
        meta,
        body,
        startedAt: Date.now(),
        browser: pendingDeferredActivations.get(normEmail)?.browser || activeBrowser,
        page: (task.page && !task.page.isClosed())
            ? task.page
            : (pendingDeferredActivations.get(normEmail)?.page || activePage),
        browserEmail: email,
        userDataDir: pendingDeferredActivations.get(normEmail)?.userDataDir || activeUserDataDir,
    });

    jobState.status = 'running';
    jobState.email = email;
    jobState.showBrowser = showBrowser;
    jobState.keepBrowserOpen = keepBrowserOpen;
    jobState.deferredActivation = true;
    currentJobMeta = { ...currentJobMeta, ...meta };
    setPhase('WAIT_EMAIL', `تفعيل بالخلفية — انتظار رابط: ${email}`);
    logToFile(
        `[Deferred activation] START ${email} sessionId=${meta.sessionId || '-'} localSessionId=${meta.localSessionId || localSessionId || '-'}`,
        'INFO'
    );

    let page = null;
    try {
        page = await resolveDeferredActivationPage(task.page, email);
        if (page && !page.isClosed()) {
            await tryResendOnConfirmationPage(page, email).catch(() => false);
            await showFillOverlay(page, 'Creaty: polling EmailCore for activation link…').catch(() => null);
        } else {
            logToFile(`[Deferred activation] confirmation page unavailable for ${email} — API poll only`, 'WARN');
        }

        let activationLink = task.hintedLink || null;
        if (activationLink) {
            const valid = await parseAndValidateActivationLink(activationLink);
            activationLink = valid || null;
        }
        if (!activationLink) {
            activationLink = await resolveActivationLink(page, email, meta, password, {
                body,
                apiPollEnabled: hasActivationApiCreds(meta),
                afterSignupSubmit: task.afterSignupSubmit === true,
                updateJobPhase: true,
            });
        }
        if (!activationLink) {
            logActivationPollPhase('FAILED_ACTIVATION', { email, reason: 'no_activation_link', deferred: true });
            logToFile(`[Deferred activation] FAILED — no link for ${email}`, 'WARN');
            if (page && !page.isClosed()) {
                await showFillOverlay(page, 'Creaty: no activation link yet — click ACTIVE to retry').catch(() => null);
            }
            setPhase('WAIT_EMAIL', `لا رابط تفعيل بعد: ${email}`);
            return;
        }

        if (!page || page.isClosed()) {
            const pending = pendingDeferredActivations.get(normEmail);
            const heldBrowser = pending?.browser;
            if (heldBrowser?.isConnected() && pending?.page && !pending.page.isClosed()) {
                page = await resolveLivePage(heldBrowser, pending.page).catch(() => pending.page);
                pending.page = page;
            } else {
                page = await launchBrowserForEmail(email, {
                    showBrowser,
                    proxy: accountProxy,
                    freshSession: false,
                });
            }
        }
        await activateAccountInSession(page, activationLink, email);
        if (!keepBrowserOpen) {
            await closeActiveBrowser({
                force: true,
                reason: `تفعيل مكتمل (خلفية): ${email}`,
            });
        } else if (page && !page.isClosed()) {
            await showFillOverlay(page, 'Creaty: account activated ✓').catch(() => null);
        }
        logActivationPollPhase('ACTIVATED', { email, deferred: true });
        logToFile(`[Deferred activation] COMPLETE for ${email}`, 'INFO');
    } catch (err) {
        logActivationPollPhase('FAILED_ACTIVATION', { email, reason: err.message, deferred: true });
        logToFile(`[Deferred activation] FAILED for ${email}: ${err.message}`, 'ERROR');
        if (page && !page.isClosed()) {
            await showFillOverlay(page, `Creaty ERROR: ${err.message}`).catch(() => null);
        }
        if (normalizeEmail(jobState.email) === normEmail) {
            setPhase('ERROR', err.message);
        }
    } finally {
        const pending = pendingDeferredActivations.get(normEmail);
        if (pending?.browser?.isConnected() && !keepBrowserOpen) {
            await pending.browser.close().catch(() => null);
        }
        pendingDeferredActivations.delete(normEmail);
        jobState.deferredActivation = false;
        if (normalizeEmail(jobState.email) === normEmail) {
            if (jobState.phase === 'DONE') {
                jobState.status = 'idle';
                jobState.phase = 'IDLE';
                jobState.email = '';
                jobState.message = '';
            } else if (jobState.phase === 'ERROR') {
                jobState.status = 'idle';
            } else {
                jobState.status = 'running';
            }
        }
    }
}

// @FROZEN registration-activation — edits require unlock key 693400 (see REGISTRATION_ACTIVATION_FROZEN.manifest.json)
async function runSignupJob(body = {}) {
    body = sanitizeSignupJobBody(body);
    const email = String(body.email || body.display_email || '').trim();
    let password = ensureCompliantSignupPassword(body.password || body.pass || '', email);
    const storeName = String(body.storeName || body.store_name || body.nickname || '').trim();
    const identity = resolveSignupIdentity({ ...body, storeName, nickname: storeName });
    const firstName = identity.firstName;
    const lastName = identity.lastName;
    const displayName = String(body.displayName || body.display_name || '').trim();
    let sessionId = String(body.sessionId || body.id || '').trim();
    const apiBase = String(body.apiBase || 'http://localhost:3000').replace(/\/+$/, '');
    const token = String(body.token || '').trim();
    const userId = String(body.userId || '').trim();
    emitSignupTrace('server.runSignupJob.enter', {
        ...body,
        firstName,
        lastName,
        storeName,
        sessionId,
        apiBase,
        token,
        userId,
    });
    const skipAlreadyRegistered = body.skipAlreadyRegistered === true;
    const accountMode = String(body.accountMode || 'new_signup').trim().toLowerCase();
    const showBrowser = body.showBrowser !== false;
    const accountProxy = String(body.proxy || body.accountProxy || '').trim();
    const signupEntryUrl = resolveSignupEntryUrl(body);
    const captchaOptions = resolveCaptchaOptions(body);
    const borrowAutProfile = resolveBorrowAutProfile(email, body);
    const manualTrustMode = body.fillOnly === true
        || body.manualSubmit === true
        || body.preserveCloudflareTrust === true
        || body.reuseTrustedProfile === true;
    const ghostCompatMode = body.ghostCompatMode !== false && (
        showBrowser === true
        || manualTrustMode
        || borrowAutProfile
        || body.useGhostProfile === true
        || body.useAutProfile === true
    );
    const signupFlowOptions = {
        showBrowser,
        captchaOptions,
        cloudflareTimeoutMs: manualTrustMode ? 900000 : 300000,
        body,
        email,
        signupEntryUrl,
        preserveCloudflareTrust: manualTrustMode || borrowAutProfile,
        ghostCompatMode,
    };

    if (!email || !password) {
        throw new Error('email and password are required');
    }
    if (password.length < TEEPUBLIC_PASSWORD_MIN) {
        throw new Error(`password must contain at least ${TEEPUBLIC_PASSWORD_MIN} characters`);
    }

    if (accountMode === 'already_activated') {
        markJobActivated(email);
        return { success: true, email, phase: 'DONE', alreadyActivated: true };
    }

    if (accountMode === 'needs_activation') {
        return runActivationOnlyJob(body);
    }

    currentJobMeta = await resolveActivationJobMeta(body, { email, sessionId });
    sessionId = currentJobMeta.sessionId;
    body = {
        ...body,
        sessionId,
        id: sessionId,
        localSessionId: currentJobMeta.localSessionId || String(body.sessionId || body.id || '').trim(),
    };
    emitSignupTrace('server.runSignupJob.sessionResolved', {
        email,
        sessionId,
        apiBase,
        token,
        userId,
        firstName,
        lastName,
        storeName,
        password,
    });

    const resolvedFirst = firstName;
    const resolvedLast = lastName;
    logToFile(`Resolved names for ${email}: first=${resolvedFirst}, last=${resolvedLast} (identity from account/email)`, 'INFO');

    jobState.status = 'running';
    jobState.email = email;
    jobState.stopRequested = false;
    jobState.startedAt = new Date().toISOString();
    jobState.skipReason = '';
    jobState.showBrowser = showBrowser;
    jobState.keepBrowserOpen = showBrowser === true;
    jobState.clonedFromAut = false;

    const typingProfile = createTypingProfile(email);

    setPhase('OPENING', `Launching browser for ${email}`);
    let page = await launchBrowserForEmail(email, {
        showBrowser,
        proxy: accountProxy,
        freshSession: !(manualTrustMode || ghostCompatMode),
        ghostCompatMode,
        borrowAutProfile,
        sourceProfilePath: body.sourceProfilePath,
        borrowProfileFrom: body.borrowProfileFrom || email,
        sourceProfileEmail: body.sourceProfileEmail || email,
        trustProfileEmail: body.trustProfileEmail || email,
        sourceUserDataDir: body.sourceUserDataDir,
        sessionId,
    });

    if (skipAlreadyRegistered) {
        setPhase('OPENING', `Checking if ${email} is already registered`);
        const regCheck = await detectAlreadyRegisteredOnPage(page, email, typingProfile);
        if (regCheck.alreadyRegistered) {
            if (!sessionId || !token || !userId) {
                markJobSkipped(email, 'already_registered', `تخطي — مسجّل مسبقاً: ${email}`);
                await closeActiveBrowser({ reason: 'مسجّل مسبقاً — تخطي التسجيل' });
                return { success: true, skipped: true, email, phase: 'SKIPPED', skipReason: 'already_registered' };
            }
            logToFile(`Registered on TeePublic — switching to activation flow: ${email}`, 'INFO');
            const activationLink = await resolveActivationLink(page, email, currentJobMeta, password, { body });
            if (!activationLink) {
                await closeActiveBrowser({ reason: 'مسجّل مسبقاً — لا رابط تفعيل' });
                return {
                    success: true,
                    skipped: true,
                    email,
                    phase: 'SKIPPED',
                    skipReason: jobState.skipReason || 'no_activation_link',
                };
            }
            await activateAccountInSession(page, activationLink, email);
            await closeActiveBrowser({
                force: !jobState.keepBrowserOpen,
                reason: 'تفعيل بعد اكتشاف حساب مسجّل',
            });
            return { success: true, email, phase: 'DONE' };
        }
    }

    try {
        page = await resolveSignupPage(activeBrowser, SIGNUP_URL, signupFlowOptions);
        activePage = page;
        await installManualActivationButton(page, currentJobMeta).catch(() => null);
        logToFile(`Signup tab ready for ${email}`);

        const formReady = await waitForFormReady(page, 25000, signupFlowOptions);
        if (!formReady) {
            throw new Error('Signup form fields not found on TeePublic');
        }

        await delay(typingProfile.startDelay);
        setPhase('FILLING', `Sequential fill for ${email} (first=${resolvedFirst}, last=${resolvedLast})`);
        logToFile(`FILLING all 4 fields for ${email}: firstName, lastName, email, password`, 'INFO');

        let fillResult = await fillSignupForm(page, {
            firstName: resolvedFirst,
            lastName: resolvedLast,
            email,
            password,
            storeName,
            nickname: storeName,
        }, typingProfile);

        if (fillResult?.sanitizedPayload) {
            password = fillResult.sanitizedPayload.password || password;
        }

        if (!fillResult?.ok) {
            const postFillSignals = await detectPageSignals(page);
            if (postFillSignals.emailTaken) {
                if (sessionId && token && userId) {
                    logToFile(`Email taken — activation flow for ${email}`, 'INFO');
                    const activationLink = await resolveActivationLink(page, email, currentJobMeta, password, { body });
                    if (activationLink) {
                        await activateAccountInSession(page, activationLink, email);
                        await closeActiveBrowser({
                            force: !jobState.keepBrowserOpen,
                            reason: 'البريد مستخدم — تفعيل مكتمل',
                        });
                        return { success: true, email, phase: 'DONE' };
                    }
                    await closeActiveBrowser({ reason: 'البريد مستخدم — لا رابط تفعيل' });
                    return {
                        success: true,
                        skipped: true,
                        email,
                        phase: 'SKIPPED',
                        skipReason: jobState.skipReason || 'no_activation_link',
                    };
                }
                markJobSkipped(email, 'already_registered', `تخطي — مسجّل مسبقاً: ${email}`);
                await closeActiveBrowser({ reason: 'البريد مستخدم — تخطي' });
                return { success: true, skipped: true, email, phase: 'SKIPPED', skipReason: 'already_registered' };
            }
            const missingKeys = Object.keys(fillResult?.missing || {});
            const filledKeys = Object.keys(fillResult?.filled || {});
            logToFile(`Form fill incomplete for ${email}: filled=[${filledKeys.join(', ')}] missing=[${missingKeys.join(', ')}]`, 'ERROR');
            await showFillOverlay(page, `Creaty ERROR: missing ${missingKeys.join(', ') || 'fields'}`);
            throw new Error(`Form fill incomplete: missing ${missingKeys.join(', ') || 'unknown fields'}`);
        }

        logToFile(`Form filled (sequential type) for ${email}: ${Object.keys(fillResult.filled).join(', ')}`, 'INFO');

        const preSubmit = await validateAndFixSignupFieldsBeforeSubmit(page, {
            firstName: resolvedFirst,
            lastName: resolvedLast,
            email,
            password,
            storeName,
            nickname: storeName,
        }, typingProfile);
        password = preSubmit.password;
        if (!preSubmit.ok) {
            const reason = preSubmit.validation?.passwordTooShort
                ? `password length ${preSubmit.snapshot?.password?.length || preSubmit.validation?.passwordLength || 0} < ${TEEPUBLIC_PASSWORD_MIN}`
                : 'invalid first/last name or password';
            await showFillOverlay(page, `Creaty ERROR: ${reason}`);
            throw new Error(`Pre-submit validation failed: ${reason}`);
        }

        const passwordValid = await waitForPasswordValidation(page);
        if (!passwordValid) {
            logToFile(`Password validation not green — refilling compliant password for ${email}`, 'WARN');
            password = ensureCompliantSignupPassword(password, email);
            await fillSignupFieldSequential(page, 'password', password);
            await delay(randomBetween(500, 900));
            const retryValid = await waitForPasswordValidation(page, 12000);
            if (!retryValid) {
                await showFillOverlay(page, `Creaty ERROR: password must be ${TEEPUBLIC_PASSWORD_MIN}+ chars`);
                throw new Error(`Password validation failed (${TEEPUBLIC_PASSWORD_MIN}+ chars required)`);
            }
        }
        await delay(randomBetween(typingProfile.reviewPauseMin, typingProfile.reviewPauseMax));

        if (body.fillOnly === true || body.manualSubmit === true) {
            setPhase('FILLED', `Fields injected — manual submit required for ${email}`);
            await showFillOverlay(page, 'Creaty: fields injected — submit manually');
            logToFile(`Fill-only test complete for ${email}; Create Account was not clicked`, 'INFO');
            return {
                success: true,
                email,
                phase: 'FILLED',
                filledOnly: true,
                filledFields: Object.keys(fillResult.filled),
            };
        }

        setPhase('SUBMITTING', `Clicking Create Account for ${email}`);
        await showFillOverlay(page, 'Creaty: submitting…');
        const clicked = await clickCreateAccountButton(page, fillResult.createButtonSelector);
        if (!clicked) {
            await showFillOverlay(page, 'Creaty ERROR: submit button not found');
            throw new Error('Create Account button not found or not clickable');
        }
        logToFile(`Create Account clicked for ${email}`, 'INFO');

        const submitResult = await waitAfterSubmitClick(page, email);
        if (submitResult === 'validation_failed') {
            throw new Error('Signup form rejected — password or name validation visible on TeePublic');
        }
        if (submitResult === 'already_registered') {
            await closeActiveBrowser({
                force: !jobState.keepBrowserOpen,
                reason: 'البريد مسجّل مسبقاً — تخطي إلى الحساب التالي',
            });
            return { success: true, skipped: true, email, phase: 'SKIPPED', skipReason: 'already_registered' };
        }

        const landedOnConfirmation = submitResult === 'wait_email' || await isConfirmationPage(page);
        if (landedOnConfirmation) {
            setPhase('WAIT_EMAIL', `Signup submitted — waiting for activation email: ${email}`);
            await showFillOverlay(page, 'Creaty: polling EmailCore for activation link…').catch(() => null);
        }

        if (!sessionId || !token || !userId) {
            throw new Error('sessionId, token, userId required for activation — pass from extension');
        }

        const hintedActivationLink = await findActivationLinkInSource(body, { email });
        if (hintedActivationLink) {
            const validHint = await parseAndValidateActivationLink(hintedActivationLink);
            if (validHint) {
                logToFile(`Activation link reused from imported/account payload for ${email}`, 'INFO');
                await activateAccountInSession(page, validHint, email);
                await closeActiveBrowser({
                    force: !jobState.keepBrowserOpen,
                    reason: 'تفعيل من payload',
                });
                return { success: true, email, phase: 'DONE' };
            }
        }

        jobState.deferredActivation = true;
        scheduleDeferredSignupActivation({
            page,
            email,
            password,
            meta: {
                ...currentJobMeta,
                localSessionId: currentJobMeta.localSessionId || sessionId,
            },
            body: { ...body, localSessionId: sessionId },
            showBrowser,
            afterSignupSubmit: landedOnConfirmation,
            hintedLink: null,
        });
        return { success: true, email, phase: 'WAIT_EMAIL', deferredActivation: true };
    } catch (signupFlowErr) {
        logToFile(`Signup flow error for ${email}: ${signupFlowErr.message}`, 'ERROR');
        if (page && !page.isClosed()) {
            await showFillOverlay(page, `Creaty ERROR: ${signupFlowErr.message}`).catch(() => null);
        }
        if (jobState.keepBrowserOpen) {
            logToFile('Signup failed — browser left open (showBrowser=true). Close manually or POST /stop', 'WARN');
        }
        throw signupFlowErr;
    }
}

function enqueueSignupJob(body) {
    const email = String(body.email || body.display_email || '').trim();
    const accountMode = String(body.accountMode || 'new_signup').trim().toLowerCase();
    logToFile(`Queue job starting: ${email} (mode=${accountMode}, showBrowser=${body.showBrowser !== false})`, 'INFO');
    jobChain = jobChain.then(async () => {
        removeFromSignupQueue(email);
        try {
            await runSignupJob(body);
        } catch (err) {
            logToFile(`Signup job error: ${err.message}`, 'ERROR');
            if (jobState.phase !== 'SKIPPED') {
                setPhase('ERROR', err.message);
            }
            if (jobState.keepBrowserOpen) {
                logToFile('Signup failed — browser left open (showBrowser=true). Close manually or POST /stop', 'WARN');
            }
        } finally {
            if (jobState.deferredActivation) {
                logToFile(`Queue released — deferred activation continues for ${jobState.email || 'unknown'}`, 'INFO');
            } else if (jobState.phase === 'SKIPPED') {
                jobState.status = 'idle';
            } else if (jobState.phase === 'ERROR' || jobState.stopRequested) {
                jobState.status = 'idle';
            } else if (jobState.phase === 'DONE' || jobState.phase === 'FILLED') {
                jobState.status = 'idle';
            } else if (['CAPTCHA', 'CLOUDFLARE_WAIT', 'WAIT_EMAIL', 'ACTIVATING', 'FILLING', 'SUBMITTING', 'OPENING'].includes(jobState.phase)) {
                jobState.status = 'running';
            } else {
                jobState.status = 'idle';
            }
        }
    }).catch((err) => {
        logToFile(`Queue chain error: ${err.message}`, 'ERROR');
    });
    return jobChain;
}

function applySignupSelectorPatch(selectors = {}) {
    if (!selectors || typeof selectors !== 'object') return { updated: [] };
    const updated = [];
    for (const [field, value] of Object.entries(selectors)) {
        if (!Array.isArray(value) || !value.length) continue;
        TEEPUBLIC_SIGNUP_SELECTORS[field] = value.map((s) => String(s || '').trim()).filter(Boolean);
        updated.push(field);
    }
    return { updated, selectors: TEEPUBLIC_SIGNUP_SELECTORS };
}

const aiSupervisor = (() => {
    try {
        return require('./server/nhp-ai-supervisor');
    } catch (err) {
        logToFile(`AI Supervisor module load FAILED: ${err.message}`, 'WARN');
        return null;
    }
})();
if (aiSupervisor?.registerSupervisorApi) {
    aiSupervisor.registerSupervisorApi(app, { rootDir: ROOT_DIR, logFn: logToFile });
}

const CREATY_SERVER_BUILD = '2026-06-25-activation-signin-success';

app.get('/ping', (_req, res) => {
    res.json({ ok: true, service: 'creaty', port: PORT, build: CREATY_SERVER_BUILD });
});

app.get('/status', (_req, res) => {
    const orch = orchestrator.getOrchestrateSummaryForStatus();
    res.json({
        ok: true,
        service: 'creaty',
        status: jobState.status,
        phase: jobState.phase,
        email: jobState.email,
        currentEmail: jobState.email || '',
        message: jobState.message,
        stopRequested: jobState.stopRequested,
        manualCloudflareContinue: jobState.manualCloudflareContinue === true,
        canContinueCloudflare: jobState.phase === 'CLOUDFLARE_WAIT',
        startedAt: jobState.startedAt,
        skipReason: jobState.skipReason || '',
        sessionId: currentJobMeta.sessionId || '',
        filledFields: jobState.filledFields || {},
        ghostCompatMode: jobState.ghostCompatMode === true,
        queueLength: signupQueue.length,
        queue: getQueueSnapshot(),
        orchestrate: orch,
        storeAutomation: { ...storeAutomationState },
        signupTrace: signupTraceBuffer.slice(0, 20),
    });
});

app.get('/store-automation/status', (_req, res) => {
    res.json({ ok: true, service: 'creaty-store-automation', ...storeAutomationState });
});

app.post('/cloudflare/continue', (_req, res) => {
    if (jobState.phase !== 'CLOUDFLARE_WAIT') {
        return res.status(409).json({
            ok: false,
            phase: jobState.phase,
            error: 'not_waiting_for_cloudflare',
        });
    }
    jobState.manualCloudflareContinue = true;
    logToFile('Manual Cloudflare continue requested by user', 'INFO');
    return res.json({
        ok: true,
        phase: jobState.phase,
        continuing: true,
        email: jobState.email || '',
    });
});

app.get('/orchestrate/status', (req, res) => {
    const email = String(req.query?.email || req.query?.accountEmail || '').trim();
    try {
        const data = orchestrator.getOrchestrateStatus(email || null);
        res.json(data);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post('/orchestrate/prepare', express.json({ limit: '100mb' }), async (req, res) => {
    try {
        const raw = JSON.stringify(req.body || {});
        const kb = (Buffer.byteLength(raw, 'utf8') / 1024).toFixed(1);
        logToFile(`Orchestrate prepare — ${kb} KB / ${(req.body?.accounts || []).length} account(s)`);
        const result = await orchestrator.prepareAccounts(req.body || {});
        res.json({ ok: result.ok !== false, ...result });
    } catch (err) {
        logToFile(`Orchestrate prepare error: ${err.message}`, 'ERROR');
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post('/orchestrate/advance-phase', async (req, res) => {
    try {
        const result = await orchestrator.advancePhase(req.body || {});
        res.json(result);
    } catch (err) {
        logToFile(`Orchestrate advance error: ${err.message}`, 'ERROR');
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post('/orchestrate/run-stage', async (req, res) => {
    try {
        const result = await orchestrator.runStage(req.body || {});
        res.json(result);
    } catch (err) {
        logToFile(`Orchestrate run-stage error: ${err.message}`, 'ERROR');
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post('/orchestrate/stop-stage', async (req, res) => {
    try {
        const result = await orchestrator.stopStage(req.body || {});
        res.json(result);
    } catch (err) {
        logToFile(`Orchestrate stop-stage error: ${err.message}`, 'ERROR');
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post('/orchestrate/reset-phase', async (req, res) => {
    try {
        const result = await orchestrator.resetPhase(req.body || {});
        res.json(result);
    } catch (err) {
        logToFile(`Orchestrate reset-phase error: ${err.message}`, 'ERROR');
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post('/orchestrate/reset-stage', async (req, res) => {
    try {
        const result = await orchestrator.resetPhase(req.body || {});
        res.json(result);
    } catch (err) {
        logToFile(`Orchestrate reset-stage error: ${err.message}`, 'ERROR');
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('/active-session-card', (_req, res) => {
    res.json({ success: true, session: activeSessionCardInfo });
});

app.post('/open-login-preview', async (req, res) => {
    try {
        const result = await openLoginPreviewJob(req.body || {});
        res.json(result);
    } catch (err) {
        logToFile(`Login preview error: ${err.message}`, 'ERROR');
        res.status(500).json({ ok: false, success: false, error: err.message });
    }
});

app.post('/store-automation/start', async (req, res) => {
    try {
        const result = await runStoreAutomationJob(req.body || {});
        res.json(result);
    } catch (err) {
        logToFile(`Store automation error: ${err.message}`, 'ERROR');
        res.status(500).json({
            ok: false,
            success: false,
            error: err.message,
            state: { ...storeAutomationState },
        });
    }
});

app.post('/start-signup', (req, res) => {
    const body = sanitizeSignupJobBody(req.body || {});
    const email = String(body.email || body.display_email || '').trim();

    if (!email) {
        return res.status(400).json({ ok: false, error: 'email is required' });
    }

    logToFile(`/start-signup ${email}: sanitized names first=${body.firstName}, last=${body.lastName}`, 'INFO');
    emitSignupTrace('server.start-signup', body);
    const jobBody = { ...body, email };

    if (isJobActive() && normalizeEmail(jobState.email) === normalizeEmail(email)) {
        return res.json({
            ok: true,
            accepted: false,
            alreadyRunning: true,
            phase: jobState.phase,
            email: jobState.email,
            currentEmail: jobState.email,
            queueLength: signupQueue.length,
            queue: getQueueSnapshot(),
        });
    }

    const existingIdx = findQueueIndex(email);
    if (existingIdx >= 0) {
        const position = existingIdx + 1;
        return res.json({
            ok: true,
            queued: true,
            position,
            email,
            phase: 'QUEUED',
            currentEmail: jobState.email,
            queueLength: signupQueue.length,
            queue: getQueueSnapshot(),
        });
    }

    if (isJobActive()) {
        signupQueue.push({ email, body: jobBody });
        const position = signupQueue.length;
        logToFile(`Queued signup #${position} for ${email} (active: ${jobState.email})`);
        enqueueSignupJob(jobBody);
        return res.json({
            ok: true,
            queued: true,
            position,
            email,
            phase: 'QUEUED',
            currentEmail: jobState.email,
            queueLength: signupQueue.length,
            queue: getQueueSnapshot(),
        });
    }

    resetJobState();
    jobState.status = 'running';
    jobState.email = email;
    jobState.phase = 'QUEUED';
    jobState.showBrowser = body.showBrowser !== false;
    jobState.keepBrowserOpen = jobState.showBrowser === true;

    enqueueSignupJob(jobBody);

    res.json({ ok: true, accepted: true, email, phase: 'QUEUED', queueLength: 0 });
});

app.post('/stop', async (_req, res) => {
    jobState.stopRequested = true;
    signupQueue.length = 0;
    setPhase('IDLE', 'Stop requested');
    jobState.status = 'idle';
    jobState.keepBrowserOpen = false;
    await closeActiveBrowser({ force: true, reason: 'طلب إيقاف من المستخدم (POST /stop)' });
    resetJobState();
    res.json({ ok: true, stopped: true });
});

app.get('/shutdown', async (_req, res) => {
    jobState.stopRequested = true;
    jobState.keepBrowserOpen = false;
    await closeActiveBrowser({ force: true, reason: 'إيقاف السيرفر (GET /shutdown)' });
    res.json({ ok: true, shuttingDown: true });
    setTimeout(() => process.exit(0), 300);
});

// Supervisor status/journal — same routes as Ghost so Creaty :3020 does not 404.
try {
    const aiSupervisor = require('./server/nhp-ai-supervisor');
    if (aiSupervisor?.registerSupervisorApi) {
        aiSupervisor.registerSupervisorApi(app, { rootDir: ROOT_DIR, logFn: logToFile });
    }
} catch (supErr) {
    logToFile(`AI Supervisor mount skipped on Creaty: ${supErr.message}`, 'WARN');
}

process.on('uncaughtException', (err) => {
    logToFile(`CRASH: ${err.message}\n${err.stack}`, 'FATAL');
});
process.on('unhandledRejection', (reason) => {
    logToFile(`UNHANDLED: ${reason}`, 'FATAL');
});

verifyStealthEvasionsAtLaunch();

const server = app.listen(PORT, () => {
    profileLock.pruneStaleCrossProcessLocks(ROOT_DIR, logToFile);
    logToFile(`Creaty Server ready on http://127.0.0.1:${PORT}`);
});

server.on('error', (err) => {
    logToFile(`Server error: ${err.code || err.message}`, 'ERROR');
    if (err.code === 'EADDRINUSE') {
        logToFile(`Port ${PORT} is in use — stop the existing Creaty process first`, 'WARN');
        setTimeout(() => process.exit(1), 500);
    }
});
