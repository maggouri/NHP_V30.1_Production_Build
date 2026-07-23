/**
 * Browser profile lock — kill stale Chrome, serialize per-email launches.
 * Shared by creaty-server.js and ghost-server.js.
 */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

const profileChains = new Map();
const LOCK_STALE_MS = 30 * 60 * 1000;
const LOCK_DEAD_PID_GRACE_MS = 5000;

function isPidAlive(pid) {
    const n = Number(pid);
    if (!Number.isInteger(n) || n <= 0) return false;
    try {
        process.kill(n, 0);
        return true;
    } catch (err) {
        return err && err.code === 'EPERM';
    }
}

function readLockFileMeta(lockFile) {
    try {
        const raw = fs.readFileSync(lockFile, 'utf8').trim().split(/\r?\n/);
        return {
            pid: Number.parseInt(raw[0], 10),
            createdAt: Number.parseInt(raw[1], 10) || 0,
            email: raw[2] || '',
        };
    } catch (_) {
        return null;
    }
}

function isStaleLockFile(lockFile) {
    try {
        const stat = fs.statSync(lockFile);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) return true;
    } catch (_) { /* ignore */ }
    const meta = readLockFileMeta(lockFile);
    if (!meta) return true;
    if (!isPidAlive(meta.pid)) {
        return Date.now() - (meta.createdAt || 0) > LOCK_DEAD_PID_GRACE_MS;
    }
    return false;
}

function normalizeEmailKey(email) {
    return String(email || 'session').trim().toLowerCase().replace(/[^a-z0-9]/g, '_') || 'session';
}

function isBrowserAlreadyRunningError(err) {
    return /browser is already running|user data directory is already in use|SingletonLock|profile appears to be in use/i
        .test(String(err?.message || err));
}

function isProfileDirLocked(userDataDir) {
    if (!userDataDir) return false;
    const lockNames = ['SingletonLock', 'SingletonCookie', 'lockfile'];
    return lockNames.some((name) => fs.existsSync(path.join(userDataDir, name)));
}

function clearProfileLockFiles(userDataDir) {
    if (!userDataDir) return;
    for (const name of ['SingletonLock', 'SingletonCookie', 'lockfile']) {
        try { fs.unlinkSync(path.join(userDataDir, name)); } catch (_) { /* ignore */ }
    }
}

async function killChromeProcessesForProfile(userDataDir, logFn) {
    if (!userDataDir) return;
    const escaped = userDataDir.replace(/'/g, "''");
    const psScript = [
        "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" -ErrorAction SilentlyContinue",
        `| Where-Object { $_.CommandLine -like '*${escaped}*' }`,
        '| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
    ].join(' ');
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    try {
        await execAsync(
            `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
            { windowsHide: true, timeout: 30000 },
        );
        logFn?.(`Killed orphaned Chrome for profile: ${userDataDir}`, 'WARN');
    } catch (err) {
        logFn?.(`killChromeProcessesForProfile: ${err.message}`, 'WARN');
    }
    clearProfileLockFiles(userDataDir);
}

async function prepareProfileForLaunch(userDataDir, options = {}) {
    const { logFn, forceKill = false } = options;
    if (!userDataDir) return;
    if (forceKill || isProfileDirLocked(userDataDir)) {
        logFn?.(`Profile lock detected — clearing: ${userDataDir}`, 'WARN');
        await killChromeProcessesForProfile(userDataDir, logFn);
        await new Promise((r) => setTimeout(r, 1500));
    }
}

async function launchWithProfileLockRetry(launchFn, userDataDir, options = {}) {
    const { logFn, maxRetries = 1 } = options;
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            await prepareProfileForLaunch(userDataDir, { logFn, forceKill: attempt > 0 });
            return await launchFn();
        } catch (err) {
            lastErr = err;
            if (attempt < maxRetries && isBrowserAlreadyRunningError(err)) {
                logFn?.(`Browser lock error — retry after kill (${attempt + 1}/${maxRetries}): ${err.message}`, 'WARN');
                await killChromeProcessesForProfile(userDataDir, logFn);
                await new Promise((r) => setTimeout(r, 2000));
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

function getLocksDir(rootDir) {
    return path.join(rootDir, 'profile_browser_locks');
}

function acquireCrossProcessLock(rootDir, email, timeoutMs = 180000) {
    const locksDir = getLocksDir(rootDir);
    fs.mkdirSync(locksDir, { recursive: true });
    const lockFile = path.join(locksDir, `${normalizeEmailKey(email)}.lock`);
    const start = Date.now();

    return new Promise((resolve, reject) => {
        const tryAcquire = () => {
            if (Date.now() - start >= timeoutMs) {
                reject(new Error(`Profile browser lock timeout for ${email}`));
                return;
            }
            try {
                const fd = fs.openSync(lockFile, 'wx');
                fs.writeFileSync(fd, `${process.pid}\n${Date.now()}\n${email}\n`, 'utf8');
                fs.closeSync(fd);
                resolve(lockFile);
            } catch (err) {
                if (err.code !== 'EEXIST') {
                    reject(err);
                    return;
                }
                try {
                    if (isStaleLockFile(lockFile)) {
                        fs.unlinkSync(lockFile);
                    }
                } catch (_) { /* ignore */ }
                setTimeout(tryAcquire, 400);
            }
        };
        tryAcquire();
    });
}

function releaseCrossProcessLock(lockFile) {
    if (!lockFile) return;
    try { fs.unlinkSync(lockFile); } catch (_) { /* ignore */ }
}

function pruneStaleCrossProcessLocks(rootDir, logFn) {
    const locksDir = getLocksDir(rootDir);
    let removed = 0;
    try {
        for (const name of fs.readdirSync(locksDir)) {
            if (!name.endsWith('.lock')) continue;
            const lockFile = path.join(locksDir, name);
            if (!isStaleLockFile(lockFile)) continue;
            try {
                fs.unlinkSync(lockFile);
                removed += 1;
                logFn?.(`Pruned stale profile lock: ${name}`, 'WARN');
            } catch (_) { /* ignore */ }
        }
    } catch (_) { /* ignore */ }
    return removed;
}

async function withProfileBrowserMutex(email, rootDir, fn) {
    const key = normalizeEmailKey(email);
    const prev = profileChains.get(key) || Promise.resolve();
    let lockFile = null;

    const run = async () => {
        lockFile = await acquireCrossProcessLock(rootDir, email);
        try {
            return await fn();
        } finally {
            releaseCrossProcessLock(lockFile);
            lockFile = null;
        }
    };

    const next = prev.catch(() => null).then(run);
    profileChains.set(key, next);
    try {
        return await next;
    } finally {
        if (profileChains.get(key) === next) {
            profileChains.delete(key);
        }
    }
}

module.exports = {
    normalizeEmailKey,
    isBrowserAlreadyRunningError,
    isProfileDirLocked,
    clearProfileLockFiles,
    killChromeProcessesForProfile,
    prepareProfileForLaunch,
    launchWithProfileLockRetry,
    withProfileBrowserMutex,
    acquireCrossProcessLock,
    releaseCrossProcessLock,
    pruneStaleCrossProcessLocks,
};
