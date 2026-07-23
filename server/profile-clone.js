/**
 * Clone AUT/GHOST Chrome userDataDir into a temp dir for Creaty signup.
 * Never writes back to the source profile.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const GHOST_PROFILES_DIR_NAME = 'server_profiles';
const TEMP_PROFILES_SUBDIR = 'nhp_creaty_profiles';

/** Cloudflare trust cookies — never delete */
const CLOUDFLARE_PRESERVE_COOKIES = [
    'cf_clearance',
    '__cf_bm',
    '__cflb',
    '__cfduid',
    '_cfuvid',
];

/** TeePublic session/auth cookie name hints */
const TEEPUBLIC_AUTH_COOKIE_NAMES = [
    '_teepublic_session',
    'teepublic_session',
    'session',
    'remember',
    'remember_user_token',
    'remember_token',
    '_session_id',
    'auth_token',
    'user_id',
    'logged_in',
    'tp_session',
    'rack.session',
];

const TEEPUBLIC_AUTH_PREFIXES = ['_teepublic', 'teepublic_'];

const SKIP_PROFILE_ENTRIES = new Set([
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket',
    'lockfile',
    'LOCK',
]);

function safeEmailDirName(email) {
    return String(email || '').replace(/[^a-zA-Z0-9]/g, '_');
}

function getGhostProfileDirForEmail(email, rootDir) {
    const safe = safeEmailDirName(email);
    if (!safe) return null;
    return path.join(rootDir, GHOST_PROFILES_DIR_NAME, safe);
}

/**
 * Resolve AUT/GHOST source userDataDir from explicit path or borrow email.
 * @returns {string|null}
 */
function resolveSourceProfilePath(options = {}, rootDir = process.cwd()) {
    const explicit = String(options.sourceProfilePath || options.userDataDir || '').trim();
    if (explicit) {
        const resolved = path.resolve(explicit);
        if (fs.existsSync(resolved)) return resolved;
    }

    const borrowEmail = String(
        options.borrowProfileFrom
        || options.sourceProfileEmail
        || options.trustProfileEmail
        || ''
    ).trim();

    if (borrowEmail) {
        const ghostDir = getGhostProfileDirForEmail(borrowEmail, rootDir);
        if (ghostDir && fs.existsSync(ghostDir)) return ghostDir;
    }

    return null;
}

function shouldBorrowAutProfile(options = {}) {
    if (options.borrowAutProfile === true) return true;
    return !!(
        options.sourceProfilePath
        || options.borrowProfileFrom
        || options.sourceProfileEmail
        || options.trustProfileEmail
        || options.userDataDir
    );
}

/**
 * Copy Chrome profile to os.tmpdir — source is read-only (no writes to source).
 * @returns {string} tempProfilePath
 */
function cloneChromeProfile(sourceUserDataDir, sessionId = '', logFn = null) {
    if (!sourceUserDataDir || !fs.existsSync(sourceUserDataDir)) {
        throw new Error(`Source profile not found: ${sourceUserDataDir || '(empty)'}`);
    }

    const safeSession = safeEmailDirName(sessionId || 'creaty').slice(0, 32) || 'creaty';
    const tempProfilePath = path.join(
        os.tmpdir(),
        TEMP_PROFILES_SUBDIR,
        `session_${safeSession}_${Date.now()}`
    );
    fs.mkdirSync(tempProfilePath, { recursive: true });

    const entries = fs.readdirSync(sourceUserDataDir, { withFileTypes: true });
    for (const entry of entries) {
        if (SKIP_PROFILE_ENTRIES.has(entry.name)) continue;
        const from = path.join(sourceUserDataDir, entry.name);
        const to = path.join(tempProfilePath, entry.name);
        fs.cpSync(from, to, { recursive: true, force: true });
    }

    logFn?.('نسخ ملف تعريف مؤقت — المصدر لم يُعدَّل', 'INFO');
    logFn?.(
        `Cloned AUT profile → ${tempProfilePath} (source=${sourceUserDataDir}, read-only)`,
        'INFO'
    );
    return tempProfilePath;
}

function isCloudflarePreserveCookie(name) {
    const n = String(name || '').toLowerCase();
    if (CLOUDFLARE_PRESERVE_COOKIES.some((p) => n === p.toLowerCase())) return true;
    return n.startsWith('__cf');
}

function isTeepublicAuthCookie(name, domain) {
    const n = String(name || '').toLowerCase();
    const d = String(domain || '').toLowerCase();

    if (isCloudflarePreserveCookie(n)) return false;

    if (TEEPUBLIC_AUTH_PREFIXES.some((prefix) => n.startsWith(prefix))) return true;
    if (TEEPUBLIC_AUTH_COOKIE_NAMES.some((auth) => n === auth || n.includes(auth))) {
        return d.includes('teepublic');
    }

    if (d.includes('teepublic')) {
        if (n.includes('session') || n.includes('remember') || n.includes('auth') || n.includes('token')) {
            return true;
        }
    }

    return false;
}

/**
 * Delete TeePublic auth cookies only; preserve Cloudflare trust cookies.
 */
async function clearTeepublicAuthCookies(page, logFn = null) {
    if (!page || page.isClosed()) return { deleted: 0 };

    const cookies = await page.cookies().catch(() => []);
    const toDelete = [];

    for (const c of cookies) {
        if (isCloudflarePreserveCookie(c.name)) continue;
        if (isTeepublicAuthCookie(c.name, c.domain)) {
            toDelete.push(c);
        }
    }

    if (toDelete.length > 0) {
        await page.deleteCookie(...toDelete).catch(() => null);
    }

    logFn?.(
        `Cleared ${toDelete.length} TeePublic auth cookie(s) — CF trust preserved (${CLOUDFLARE_PRESERVE_COOKIES.join(', ')})`,
        'INFO'
    );
    return { deleted: toDelete.length };
}

function cleanupTempProfile(tempProfilePath, logFn = null) {
    if (!tempProfilePath || !fs.existsSync(tempProfilePath)) return;
    try {
        fs.rmSync(tempProfilePath, { recursive: true, force: true });
        logFn?.(`Cleaned cloned temp profile: ${tempProfilePath}`, 'INFO');
    } catch (err) {
        logFn?.(`Profile cleanup failed (${tempProfilePath}): ${err.message}`, 'WARN');
    }
}

module.exports = {
    CLOUDFLARE_PRESERVE_COOKIES,
    TEEPUBLIC_AUTH_COOKIE_NAMES,
    GHOST_PROFILES_DIR_NAME,
    getGhostProfileDirForEmail,
    resolveSourceProfilePath,
    shouldBorrowAutProfile,
    cloneChromeProfile,
    isCloudflarePreserveCookie,
    isTeepublicAuthCookie,
    clearTeepublicAuthCookies,
    cleanupTempProfile,
};
