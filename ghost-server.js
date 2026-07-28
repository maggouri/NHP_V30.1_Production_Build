const fs = require('fs');
const path = require('path');
const Module = require('module');

// ✅ ضمان العثور على مكتبات Node.js (مثل express و puppeteer) في المسار القديم إذا تم نقل المجلد
const extraNodePaths = [
    path.join(__dirname, 'node_modules')
].filter((dir) => fs.existsSync(dir));

if (extraNodePaths.length) {
    process.env.NODE_PATH = [process.env.NODE_PATH, ...extraNodePaths].filter(Boolean).join(path.delimiter);
    Module._initPaths();
}

const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const profileLock = require('./server/profile-browser-lock');
const seqUploadGuard = require('./utils/seq-upload-guard.js');
const {
    sanitizeChromeArgs,
    patchNavigatorWebdriver,
    createLaunchBrowserWithFallback,
    buildGhostChromeLaunchArgs,
    configureCreatyStealthPlugin,
    gracefulCloseGhostBrowser,
} = require('./server/chrome-launch-shared');

puppeteer.use(configureCreatyStealthPlugin(StealthPlugin));

const app = express();
const PORT = Number(process.env.NHP_GHOST_PORT || process.env.PORT) || 3019;

function resolveGhostHeadless(isVisual) {
    if (isVisual === true) return false;
    if (isVisual === false) return 'new';
    if (process.env.NHP_HEADLESS === '1' || process.env.CREATTY_HEADLESS === '1') return 'new';
    return process.platform === 'win32' ? false : 'new';
}
const { resolveNhpProjectRoot, countLibraryDesigns } = require('./server/library-fs');
const { getPortablePaths } = require('./utils/nhp-portable-paths');
function resolveNhpRootDir() {
    return resolveNhpProjectRoot(
        __dirname,
        process.env.NHP_ROOT_DIR,
        process.env.NHP_ROOT,
        process.env.NHP_APP_ROOT
    );
}
const ROOT_DIR = resolveNhpRootDir();
const portable = getPortablePaths({ appRootHint: ROOT_DIR, ensure: true });
const APP_ROOT = portable.appRoot;
const DATA_ROOT = portable.dataRoot;
if (ROOT_DIR !== __dirname) {
    console.warn(`[NHP] ROOT_DIR=${ROOT_DIR} (ghost-server.js dir=${__dirname})`);
}
console.log(`[NHP] APP_ROOT=${APP_ROOT}`);
console.log(`[NHP] DATA_ROOT=${DATA_ROOT}`);
try {
    const { runDataCleanup } = require('./utils/nhp-data-cleanup');
    const cleanupReport = runDataCleanup(portable, { dryRun: false });
    const purged = (cleanupReport.temp || []).reduce((n, t) => n + (t.purged?.length || 0), 0);
    if (purged || (cleanupReport.logs || []).length) {
        console.log(`[NHP] Data cleanup: tempPurged=${purged} logsRotated=${(cleanupReport.logs || []).length}`);
    }
} catch (e) {
    console.warn('[NHP] Data cleanup skipped:', e?.message || e);
}
const TEMP_DIR = portable.get('temp_uploads');
const LOG_DIR = portable.get('server_logs');
const PROFILES_DIR = portable.get('server_profiles');
const BACKUPS_DIR = portable.get('profile_backups');
const LEGACY_METADATA_DIR = path.join(APP_ROOT, '_metadata');
const METADATA_DIR = portable.get('metadata_store');
const NICHE_MEMORY_FILE = path.join(METADATA_DIR, 'niche-analysis-memory.json');
const NICHE_MEMORY_BACKUP_FILE = path.join(METADATA_DIR, 'niche-analysis-memory.backup.json');
const NICHE_ARCHIVE_DIR = path.join(METADATA_DIR, 'niche_archive');
const NICHE_ARCHIVE_INDEX_FILE = path.join(NICHE_ARCHIVE_DIR, 'niche-archive-index.json');
const NICHE_ARCHIVE_INDEX_BACKUP_FILE = path.join(NICHE_ARCHIVE_DIR, 'niche-archive-index.backup.json');
const NICHE_ARCHIVE_SNAPSHOTS_DIR = path.join(NICHE_ARCHIVE_DIR, 'trend_snapshots');

[TEMP_DIR, LOG_DIR, PROFILES_DIR, BACKUPS_DIR, METADATA_DIR].forEach(d => {
    portable.assertNotExtensionWrite(d);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

if (fs.existsSync(LEGACY_METADATA_DIR)) {
    const legacyEntries = fs.readdirSync(LEGACY_METADATA_DIR, { withFileTypes: true });
    legacyEntries.forEach((entry) => {
        const fromPath = path.join(LEGACY_METADATA_DIR, entry.name);
        const safeName = `legacy_${entry.name.replace(/^_+/, '')}`;
        const toPath = path.join(METADATA_DIR, safeName);
        if (!fs.existsSync(toPath)) {
            fs.cpSync(fromPath, toPath, { recursive: true });
        }
    });
}

[TEMP_DIR, LOG_DIR, PROFILES_DIR, BACKUPS_DIR, METADATA_DIR, NICHE_ARCHIVE_DIR, NICHE_ARCHIVE_SNAPSHOTS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const logFile = path.join(LOG_DIR, 'server.log');

function ensureTempUploadDir() {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (origin.startsWith('chrome-extension://')) return cb(null, true);
        if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) return cb(null, true);
        return cb(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-NHP-Api-Key',
        'X-NHP-Gpt-Api-Key',
        'X-NHP-Proxy-Base-Url',
        'X-NHP-Gemini-Api-Key',
        'X-NHP-Gemini-Base-Url',
        'X-NHP-Ai-Provider'
    ]
}));
app.use(express.json({ limit: '150mb' }));

app.post('/api/background/log', (req, res) => {
    const { message, level } = req.body || {};
    if (message) {
        logToFile(`[BACKGROUND] ${message}`, level || 'INFO');
    }
    res.json({ success: true });
});

// تسجيل الأخطاء القاتلة لتفادي الانهيار الصامت في الخلفية
process.on('uncaughtException', (err) => {
    logToFile(`🔥 CRASH ERROR: ${err.message}\n${err.stack}`, 'FATAL');
});
process.on('unhandledRejection', (reason) => {
    logToFile(`🔥 UNHANDLED PROMISE: ${reason}`, 'FATAL');
});

async function rotateWifiIp() {
    logToFile('📱 جاري تفعيل وضع الطيران لتغيير الـ IP...');
    try {
        await execAsync('adb shell cmd connectivity airplane-mode enable');
        logToFile('✈️ الهاتف في وضع الطيران. ننتظر 3 ثوانٍ...');
        await new Promise(r => setTimeout(r, 3000));
        await execAsync('adb shell cmd connectivity airplane-mode disable');
        logToFile('📡 تم إيقاف وضع الطيران. ننتظر 8 ثوانٍ لعودة الإنترنت...');
        await new Promise(r => setTimeout(r, 8000));
        logToFile('✅ تم تغيير الـ IP بنجاح وحصلنا على شبكة نظيفة!');
        return true;
    } catch (e) {
        logToFile(`❌ فشل الاتصال بالهاتف: ${e.message}`, 'ERROR');
        return false;
    }
}

function logToFile(msg, type = 'INFO') {
    const entry = `[${new Date().toISOString()}] [${type}] ${msg}\n`;
    try { fs.appendFileSync(logFile, entry); } catch (e) { }
    console.log(entry.trim());
}

// NHP Generate + library smart-rename (routes v3+): must load before /ping so stale Ghost is detectable.
let generateApiRoutesVersion = 0;
try {
    require('./server/library-smart-rename');
    const { registerGenerateApi, GENERATE_API_ROUTES_VERSION } = require('./server/generate-api');
    registerGenerateApi(app, { rootDir: ROOT_DIR, logFn: logToFile });
    generateApiRoutesVersion = Number(GENERATE_API_ROUTES_VERSION) || 0;
    logToFile(`Generate API mounted (library-smart-rename, routes v${generateApiRoutesVersion})`, 'INFO');
} catch (genErr) {
    logToFile(`Generate API mount FAILED: ${genErr.message}\n${String(genErr.stack || '').slice(0, 1200)}`, 'ERROR');
}

let canvaApiRoutesVersion = 0;
try {
    const { registerCanvaRoutes, CANVA_API_ROUTES_VERSION } = require('./server/canva/canva-routes');
    registerCanvaRoutes(app, { rootDir: ROOT_DIR, logFn: logToFile });
    canvaApiRoutesVersion = Number(CANVA_API_ROUTES_VERSION) || 0;
    logToFile(`Canva Bridge API mounted (routes v${canvaApiRoutesVersion})`, 'INFO');
} catch (canvaErr) {
    logToFile(`Canva Bridge mount FAILED: ${canvaErr.message}`, 'WARN');
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

function getChromePath() {
    const p = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"];
    for (let path of p) if (fs.existsSync(path)) return path;
    return null;
}

function openChromeWindowFallback({ userDataDir, targetUrl }) {
    return new Promise((resolve, reject) => {
        const chromePath = getChromePath();
        if (!chromePath) {
            return reject(new Error('Chrome executable not found'));
        }

        const chromeArgs = sanitizeChromeArgs([
            '--new-window',
            '--no-first-run',
            '--disable-features=Translate',
            `--user-data-dir=${userDataDir}`,
            targetUrl || 'https://www.teepublic.com/users/sign_in'
        ], 'openChromeWindowFallback', logToFile);
        const quotePs = (value) => `'${String(value).replace(/'/g, "''")}'`;
        const psArgs = chromeArgs.map((arg) => quotePs(arg)).join(', ');
        const command = `Start-Process -FilePath ${quotePs(chromePath)} -ArgumentList @(${psArgs}) -WorkingDirectory ${quotePs(path.dirname(chromePath))}`;

        exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${command}"`, { windowsHide: true }, (error) => {
            if (error) return reject(error);
            resolve({ opened: true, mode: 'powershell_chrome' });
        });
    });
}

const GHOST_IGNORE_DEFAULT_ARGS = ['--enable-automation', '--disable-blink-features=AutomationControlled'];

const launchBrowserWithFallback = createLaunchBrowserWithFallback({
    puppeteer,
    getChromePath,
    logFn: (msg, type) => logToFile(msg, type || 'WARN'),
    profileLock,
});

function getProfileDirForEmail(email) {
    const safeEmail = String(email || '').replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(PROFILES_DIR, safeEmail);
}

async function isChromeProcessRunningForProfile(profileDir) {
    if (!profileDir) return false;
    const dirEscaped = profileDir.replace(/'/g, "''");
    const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*${dirEscaped}*' } | Select-Object -First 1 -ExpandProperty ProcessId`;
    try {
        const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`, { timeout: 15000 });
        return /^\s*\d+\s*$/.test(String(stdout || ''));
    } catch (_) {
        return false;
    }
}

async function releaseProfileLockForEmail(email) {
    const profileDir = getProfileDirForEmail(email);
    const result = { ok: true, email, profileDir, locksRemoved: [], chromeKillAttempted: false };

    if (!fs.existsSync(profileDir)) {
        return { ...result, skipped: true, reason: 'profile_dir_missing' };
    }

    const lockNames = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
    for (const name of lockNames) {
        const lockPath = path.join(profileDir, name);
        try {
            if (fs.existsSync(lockPath)) {
                fs.unlinkSync(lockPath);
                result.locksRemoved.push(name);
            }
        } catch (err) {
            logToFile(`⚠️ Could not remove ${name} for ${email}: ${err.message}`, 'WARN');
        }
    }

    await new Promise((r) => setTimeout(r, 2000));
    const chromeStillRunning = await isChromeProcessRunningForProfile(profileDir);
    if (chromeStillRunning) {
        const dirEscaped = profileDir.replace(/'/g, "''");
        const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${dirEscaped}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
        try {
            await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`, { timeout: 20000 });
            result.chromeKillAttempted = true;
        } catch (err) {
            logToFile(`⚠️ Chrome kill for profile ${email}: ${err.message}`, 'WARN');
        }
    }

    logToFile(`🔓 Profile lock released for ${email} (${result.locksRemoved.join(', ') || 'no lock files'})`);
    return result;
}

function makeTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function sanitizeBackupName(name) {
    return String(name || 'autopilot_backup')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60) || 'autopilot_backup';
}

function getBackupDir(backupId) {
    const safeId = sanitizeBackupName(backupId);
    return path.join(BACKUPS_DIR, safeId);
}

function ensureEmptyDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        return;
    }
    for (const entry of fs.readdirSync(dirPath)) {
        fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
    }
}

function copyDirContents(sourceDir, destinationDir) {
    if (!fs.existsSync(sourceDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
        return;
    }
    fs.mkdirSync(destinationDir, { recursive: true });
    for (const entry of fs.readdirSync(sourceDir)) {
        fs.cpSync(path.join(sourceDir, entry), path.join(destinationDir, entry), { recursive: true, force: true });
    }
}

function countAccountSnapshot(snapshot = {}) {
    const arrays = [
        Array.isArray(snapshot.ap_accounts_teepublic) ? snapshot.ap_accounts_teepublic : (Array.isArray(snapshot.ap_accounts) ? snapshot.ap_accounts : []),
        Array.isArray(snapshot.ap_accounts_redbubble) ? snapshot.ap_accounts_redbubble : [],
        Array.isArray(snapshot.ap_accounts_amazon) ? snapshot.ap_accounts_amazon : [],
        Array.isArray(snapshot.ap_accounts_pinterest) ? snapshot.ap_accounts_pinterest : []
    ];
    return arrays.reduce((total, list) => total + list.length, 0);
}

function countProfileDirs(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    return fs.readdirSync(dirPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
}

function writeBackupManifest(backupDir, manifest) {
    fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

function readBackupManifest(backupDir) {
    const manifestPath = path.join(backupDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function listBackups() {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    return fs.readdirSync(BACKUPS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
            const backupDir = path.join(BACKUPS_DIR, entry.name);
            const manifest = readBackupManifest(backupDir);
            if (!manifest) return null;
            return {
                backupId: manifest.backupId || entry.name,
                createdAt: manifest.createdAt || null,
                profileCount: manifest.profileCount || 0,
                accountCount: manifest.accountCount || 0,
                backupDir,
                safetyBackup: !!manifest.safetyBackup
            };
        })
        .filter(Boolean)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function createEmptyNicheMemory() {
    return {
        version: 1,
        updatedAt: null,
        uspto: {},
        teepublic: {}
    };
}

function normalizeMemoryStatusMap(source = {}, allowedStatuses = []) {
    const normalized = {};
    if (!source || typeof source !== 'object') return normalized;
    for (const [rawKey, rawValue] of Object.entries(source)) {
        const key = String(rawKey || '').trim().toLowerCase();
        const value = String(rawValue || '').trim().toLowerCase();
        if (!key || !allowedStatuses.includes(value)) continue;
        normalized[key] = value;
    }
    return normalized;
}

function normalizeNicheMemory(rawMemory = {}) {
    return {
        version: 1,
        updatedAt: typeof rawMemory.updatedAt === 'string' ? rawMemory.updatedAt : null,
        uspto: normalizeMemoryStatusMap(rawMemory.uspto, ['safe', 'banned']),
        teepublic: normalizeMemoryStatusMap(rawMemory.teepublic, ['excel', 'med', 'sat', 'emp'])
    };
}

function readNicheMemory() {
    if (!fs.existsSync(NICHE_MEMORY_FILE)) return createEmptyNicheMemory();
    try {
        const parsed = JSON.parse(fs.readFileSync(NICHE_MEMORY_FILE, 'utf8'));
        return normalizeNicheMemory(parsed);
    } catch (err) {
        logToFile(`Niche memory read warning: ${err.message}`, 'WARN');
        return createEmptyNicheMemory();
    }
}

function writeNicheMemory(memory) {
    const normalized = normalizeNicheMemory(memory);
    normalized.updatedAt = new Date().toISOString();

    if (fs.existsSync(NICHE_MEMORY_FILE)) {
        try {
            fs.copyFileSync(NICHE_MEMORY_FILE, NICHE_MEMORY_BACKUP_FILE);
        } catch (err) {
            logToFile(`Niche memory backup warning: ${err.message}`, 'WARN');
        }
    }

    fs.writeFileSync(NICHE_MEMORY_FILE, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
}

function createEmptyNicheArchive() {
    return {
        version: 1,
        updatedAt: null,
        snapshotCount: 0,
        lastSnapshotId: null,
        niches: {}
    };
}

function sanitizeArchiveRecord(rawKey, rawRecord = {}) {
    const text = String(rawRecord.text || rawKey || '').trim();
    if (!text) return null;
    const numericOrNull = (value) => Number.isFinite(value) && value > 0 ? Math.floor(value) : null;

    return {
        text,
        firstSeenAt: typeof rawRecord.firstSeenAt === 'string' ? rawRecord.firstSeenAt : null,
        lastSeenAt: typeof rawRecord.lastSeenAt === 'string' ? rawRecord.lastSeenAt : null,
        firstSeenDate: typeof rawRecord.firstSeenDate === 'string' ? rawRecord.firstSeenDate : null,
        lastSeenDate: typeof rawRecord.lastSeenDate === 'string' ? rawRecord.lastSeenDate : null,
        appearances: Number.isFinite(rawRecord.appearances) && rawRecord.appearances > 0 ? Math.floor(rawRecord.appearances) : 0,
        bestRank: numericOrNull(rawRecord.bestRank),
        latestRank: numericOrNull(rawRecord.latestRank),
        firstSnapshotId: typeof rawRecord.firstSnapshotId === 'string' ? rawRecord.firstSnapshotId : null,
        lastSnapshotId: typeof rawRecord.lastSnapshotId === 'string' ? rawRecord.lastSnapshotId : null,
        lastSource: typeof rawRecord.lastSource === 'string' ? rawRecord.lastSource : null,
        lastQuality: typeof rawRecord.lastQuality === 'string' ? rawRecord.lastQuality : null,
        stages: {
            trend: rawRecord.stages?.trend === 'captured' ? 'captured' : null,
            tmhunt: ['safe', 'restricted'].includes(rawRecord.stages?.tmhunt) ? rawRecord.stages.tmhunt : null,
            uspto: ['safe', 'banned'].includes(rawRecord.stages?.uspto) ? rawRecord.stages.uspto : null,
            analysis: ['excel', 'med', 'sat', 'emp'].includes(rawRecord.stages?.analysis) ? rawRecord.stages.analysis : null,
            note: ['queued', 'done', 'manual', 'removed'].includes(rawRecord.stages?.note) ? rawRecord.stages.note : null
        }
    };
}

function sanitizeNicheArchive(rawArchive = {}) {
    const clean = createEmptyNicheArchive();
    clean.updatedAt = typeof rawArchive.updatedAt === 'string' ? rawArchive.updatedAt : null;
    clean.snapshotCount = Number.isFinite(rawArchive.snapshotCount) && rawArchive.snapshotCount > 0 ? Math.floor(rawArchive.snapshotCount) : 0;
    clean.lastSnapshotId = typeof rawArchive.lastSnapshotId === 'string' ? rawArchive.lastSnapshotId : null;

    const sourceNiches = rawArchive.niches && typeof rawArchive.niches === 'object' ? rawArchive.niches : {};
    for (const [rawKey, rawRecord] of Object.entries(sourceNiches)) {
        const key = String(rawKey || rawRecord?.text || '').trim().toLowerCase();
        const record = sanitizeArchiveRecord(key, rawRecord);
        if (!key || !record) continue;
        clean.niches[key] = record;
    }

    return clean;
}

function mergeNicheArchiveRecords(baseRecord, incomingRecord) {
    const base = sanitizeArchiveRecord(baseRecord?.text || incomingRecord?.text, baseRecord || {}) || sanitizeArchiveRecord(incomingRecord?.text, incomingRecord || {});
    const incoming = sanitizeArchiveRecord(incomingRecord?.text || baseRecord?.text, incomingRecord || {});
    if (!base && !incoming) return null;
    if (!base) return incoming;
    if (!incoming) return base;

    const chooseEarlier = (a, b) => {
        if (!a) return b;
        if (!b) return a;
        return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
    };
    const chooseLater = (a, b) => {
        if (!a) return b;
        if (!b) return a;
        return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
    };

    return {
        text: incoming.text || base.text,
        firstSeenAt: chooseEarlier(base.firstSeenAt, incoming.firstSeenAt),
        lastSeenAt: chooseLater(base.lastSeenAt, incoming.lastSeenAt),
        firstSeenDate: chooseEarlier(base.firstSeenDate, incoming.firstSeenDate),
        lastSeenDate: chooseLater(base.lastSeenDate, incoming.lastSeenDate),
        appearances: Math.max(base.appearances || 0, incoming.appearances || 0),
        bestRank: Math.min(base.bestRank || Number.MAX_SAFE_INTEGER, incoming.bestRank || Number.MAX_SAFE_INTEGER) === Number.MAX_SAFE_INTEGER
            ? null
            : Math.min(base.bestRank || Number.MAX_SAFE_INTEGER, incoming.bestRank || Number.MAX_SAFE_INTEGER),
        latestRank: incoming.latestRank || base.latestRank || null,
        firstSnapshotId: base.firstSnapshotId || incoming.firstSnapshotId || null,
        lastSnapshotId: incoming.lastSnapshotId || base.lastSnapshotId || null,
        lastSource: incoming.lastSource || base.lastSource || null,
        lastQuality: incoming.lastQuality || base.lastQuality || null,
        stages: {
            trend: incoming.stages?.trend || base.stages?.trend || null,
            tmhunt: incoming.stages?.tmhunt || base.stages?.tmhunt || null,
            uspto: incoming.stages?.uspto || base.stages?.uspto || null,
            analysis: incoming.stages?.analysis || base.stages?.analysis || null,
            note: incoming.stages?.note || base.stages?.note || null
        }
    };
}

function mergeNicheArchives(...sources) {
    const merged = createEmptyNicheArchive();
    sources.forEach((source) => {
        const clean = sanitizeNicheArchive(source);
        merged.snapshotCount = Math.max(merged.snapshotCount, clean.snapshotCount || 0);
        merged.lastSnapshotId = clean.lastSnapshotId || merged.lastSnapshotId;
        merged.updatedAt = clean.updatedAt || merged.updatedAt;

        Object.entries(clean.niches).forEach(([key, record]) => {
            merged.niches[key] = mergeNicheArchiveRecords(merged.niches[key], record);
        });
    });
    merged.updatedAt = new Date().toISOString();
    return sanitizeNicheArchive(merged);
}

function sanitizeTrendSnapshot(rawSnapshot = {}) {
    const fetchedAt = typeof rawSnapshot.fetchedAt === 'string' ? rawSnapshot.fetchedAt : new Date().toISOString();
    const dateKey = typeof rawSnapshot.dateKey === 'string' && rawSnapshot.dateKey ? rawSnapshot.dateKey : fetchedAt.slice(0, 10);
    const snapshotId = typeof rawSnapshot.snapshotId === 'string' && rawSnapshot.snapshotId ? rawSnapshot.snapshotId : `${dateKey}_${Date.now()}`;
    const source = typeof rawSnapshot.source === 'string' && rawSnapshot.source.trim() ? rawSnapshot.source.trim() : 'manual_fetch';
    const trends = Array.isArray(rawSnapshot.trends) ? rawSnapshot.trends : [];
    const cleanTrends = [];
    const seen = new Set();

    trends.forEach((entry, index) => {
        const text = String(typeof entry === 'string' ? entry : entry?.text || entry?.title || '').trim();
        const key = text.toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        const rawRank = Number.isFinite(entry?.rank) ? entry.rank : index + 1;
        cleanTrends.push({
            text,
            rank: Math.max(1, Math.floor(rawRank)),
            priority: Math.max(1, Math.floor(rawRank))
        });
    });

    return {
        version: 1,
        snapshotId,
        fetchedAt,
        dateKey,
        source,
        count: cleanTrends.length,
        trends: cleanTrends
    };
}

function getSnapshotFilePath(snapshotId, dateKey) {
    return path.join(NICHE_ARCHIVE_SNAPSHOTS_DIR, `${dateKey}__${snapshotId}.json`);
}

function writeTrendSnapshot(rawSnapshot) {
    const snapshot = sanitizeTrendSnapshot(rawSnapshot);
    fs.writeFileSync(getSnapshotFilePath(snapshot.snapshotId, snapshot.dateKey), JSON.stringify(snapshot, null, 2), 'utf8');
    return snapshot;
}

function listTrendSnapshots() {
    if (!fs.existsSync(NICHE_ARCHIVE_SNAPSHOTS_DIR)) return [];
    return fs.readdirSync(NICHE_ARCHIVE_SNAPSHOTS_DIR)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            const filePath = path.join(NICHE_ARCHIVE_SNAPSHOTS_DIR, name);
            try {
                const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return sanitizeTrendSnapshot(parsed);
            } catch (err) {
                logToFile(`Snapshot read warning: ${err.message}`, 'WARN');
                return null;
            }
        })
        .filter(Boolean)
        .sort((a, b) => String(a.fetchedAt || '').localeCompare(String(b.fetchedAt || '')));
}

function readNicheArchive() {
    if (!fs.existsSync(NICHE_ARCHIVE_INDEX_FILE)) return createEmptyNicheArchive();
    try {
        return sanitizeNicheArchive(JSON.parse(fs.readFileSync(NICHE_ARCHIVE_INDEX_FILE, 'utf8')));
    } catch (err) {
        logToFile(`Niche archive read warning: ${err.message}`, 'WARN');
        return createEmptyNicheArchive();
    }
}

function writeNicheArchive(index) {
    const normalized = sanitizeNicheArchive(index);
    normalized.updatedAt = new Date().toISOString();

    if (fs.existsSync(NICHE_ARCHIVE_INDEX_FILE)) {
        try {
            fs.copyFileSync(NICHE_ARCHIVE_INDEX_FILE, NICHE_ARCHIVE_INDEX_BACKUP_FILE);
        } catch (err) {
            logToFile(`Niche archive backup warning: ${err.message}`, 'WARN');
        }
    }

    fs.writeFileSync(NICHE_ARCHIVE_INDEX_FILE, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
}

function importNicheArchiveBundle(bundle, mode = 'merge') {
    const cleanMode = mode === 'replace' ? 'replace' : 'merge';
    const importedArchive = sanitizeNicheArchive(bundle?.archive || {});
    const currentArchive = readNicheArchive();
    const finalArchive = cleanMode === 'replace'
        ? importedArchive
        : mergeNicheArchives(currentArchive, importedArchive);

    if (cleanMode === 'replace' && fs.existsSync(NICHE_ARCHIVE_SNAPSHOTS_DIR)) {
        fs.readdirSync(NICHE_ARCHIVE_SNAPSHOTS_DIR).forEach((entry) => {
            const target = path.join(NICHE_ARCHIVE_SNAPSHOTS_DIR, entry);
            fs.rmSync(target, { recursive: true, force: true });
        });
    }

    const snapshots = Array.isArray(bundle?.snapshots) ? bundle.snapshots : [];
    snapshots.forEach((snapshot) => writeTrendSnapshot(snapshot));

    return writeNicheArchive(finalArchive);
}

async function createStablePage(browser) {
    const pages = await browser.pages().catch(() => []);
    let page = pages.find((p) => {
        const url = p.url();
        return url && url !== 'about:blank';
    }) || pages[0] || null;
    if (!page) page = await browser.newPage();

    for (const extra of pages) {
        if (extra === page) continue;
        if (extra.url() === 'about:blank') {
            await extra.close().catch(() => null);
        }
    }
    await page.setViewport({ width: 1280, height: 950 });
    return page;
}

async function applyGhostStealthToPage(page, email = '') {
    if (!page || page.isClosed()) return;
    await patchNavigatorWebdriver(page).catch(() => null);
    return;
}

async function createGhostPage(browser, email = '') {
    const page = await createStablePage(browser);
    await applyGhostStealthToPage(page, email);
    return page;
}

function dataUrlToTempImageFile(dataUrl, prefix = 'ai_bridge') {
    const value = String(dataUrl || '');
    const match = value.match(/^data:(image\/[^;,]+)?(;base64)?,(.*)$/);
    if (!match) throw new Error('Invalid image data URL');
    const mimeType = match[1] || 'image/png';
    const isBase64 = !!match[2];
    const payload = match[3] || '';
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg'
        : mimeType.includes('webp') ? 'webp'
        : mimeType.includes('gif') ? 'gif'
        : 'png';
    const buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'binary');
    const filePath = path.join(TEMP_DIR, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
    ensureTempUploadDir();
    fs.writeFileSync(filePath, buffer);
    return { filePath, mimeType, bytes: buffer.length };
}

function getAiBridgeProfileName(targetUrl = '') {
    const url = String(targetUrl || '').toLowerCase();
    if (url.includes('chatgpt.com')) return 'ai_bridge_chatgpt';
    return 'ai_bridge_gemini';
}

function getAiBridgeBrowserArgs(targetUrl = '') {
    const args = [
        '--window-size=1280,950',
        '--no-sandbox',
        '--disable-features=Translate'
    ];
    if (fs.existsSync(path.join(ROOT_DIR, 'manifest.json'))) {
        args.push(`--load-extension=${ROOT_DIR}`);
    }
    return args;
}

async function waitForAiComposer(page, timeoutMs = 60000) {
    const start = Date.now();
    const selectors = [
        'textarea',
        'div[contenteditable="true"]',
        '[role="textbox"]',
        'rich-textarea div[contenteditable="true"]',
        'ms-chat-turn textarea'
    ];
    while ((Date.now() - start) < timeoutMs) {
        for (const selector of selectors) {
            const handle = await page.$(selector).catch(() => null);
            if (!handle) continue;
            const visible = await handle.evaluate((node) => {
                const rect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                return rect.width > 5 && rect.height > 5 && style.visibility !== 'hidden' && style.display !== 'none';
            }).catch(() => false);
            if (visible) return handle;
        }
        await new Promise((resolve) => setTimeout(resolve, 700));
    }
    throw new Error('AI composer was not found');
}

async function setAiComposerText(page, promptText) {
    const composer = await waitForAiComposer(page, 70000);
    await composer.evaluate((node, text) => {
        node.focus();
        if ('value' in node) {
            node.value = text;
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
        node.textContent = '';
        node.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }));
        node.textContent = text;
        node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }, String(promptText || ''));
    return composer;
}

async function clickAiAttachButtonIfNeeded(page) {
    const selectors = [
        'button[aria-label*="Upload" i]',
        'button[aria-label*="Attach" i]',
        'button[aria-label*="Add files" i]',
        'button[aria-label*="Image" i]',
        'button:has(mat-icon)',
        '[role="button"][aria-label*="Upload" i]',
        '[role="button"][aria-label*="Attach" i]'
    ];
    for (const selector of selectors) {
        const handle = await page.$(selector).catch(() => null);
        if (!handle) continue;
        const text = await handle.evaluate((node) => `${node.getAttribute('aria-label') || ''} ${node.textContent || ''}`.toLowerCase()).catch(() => '');
        if (!/upload|attach|file|image|add|إرفاق|تحميل|صورة/.test(text)) continue;
        await handle.click().catch(() => null);
        await new Promise((resolve) => setTimeout(resolve, 800));
        return true;
    }
    return false;
}

async function uploadAiBridgeImage(page, filePath) {
    let input = await page.$('input[type="file"]').catch(() => null);
    if (!input) {
        await clickAiAttachButtonIfNeeded(page);
        input = await page.waitForSelector('input[type="file"]', { timeout: 20000 }).catch(() => null);
    }
    if (!input) throw new Error('AI file input was not found');
    await input.uploadFile(filePath);
    await new Promise((resolve) => setTimeout(resolve, 3500));
    return true;
}

async function clickAiSendButton(page) {
    const selectors = [
        'button[aria-label*="Send" i]',
        'button[data-testid*="send" i]',
        'button:has(svg)',
        '[role="button"][aria-label*="Send" i]'
    ];
    for (let attempt = 0; attempt < 20; attempt += 1) {
        for (const selector of selectors) {
            const handle = await page.$(selector).catch(() => null);
            if (!handle) continue;
            const usable = await handle.evaluate((node) => {
                const label = `${node.getAttribute('aria-label') || ''} ${node.getAttribute('data-testid') || ''} ${node.textContent || ''}`.toLowerCase();
                const rect = node.getBoundingClientRect();
                return rect.width > 4 && rect.height > 4 && !node.disabled && /send|submit|إرسال/.test(label);
            }).catch(() => false);
            if (!usable) continue;
            await handle.click();
            return true;
        }
        await page.keyboard.press('Enter').catch(() => null);
        await new Promise((resolve) => setTimeout(resolve, 900));
    }
    throw new Error('AI send button was not found');
}

async function extractLatestAiResponseText(page, promptText = '') {
    return await page.evaluate((prompt) => {
        const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const promptHead = normalize(prompt).slice(0, 120);
        const selectors = [
            '[data-message-author-role="model"]',
            '[data-message-author-role="assistant"]',
            'model-response',
            'message-content',
            '.model-response-text',
            '.response-content',
            'article',
            '.markdown',
            '[data-response-id]'
        ];
        const candidates = [];
        selectors.forEach((selector, selectorIndex) => {
            document.querySelectorAll(selector).forEach((node, nodeIndex) => {
                const rect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                if (rect.width <= 5 || rect.height <= 5 || style.display === 'none' || style.visibility === 'hidden') return;
                const text = normalize(node.innerText || node.textContent || '');
                if (!text || text.length < 3) return;
                if (promptHead && text.includes(promptHead)) return;
                candidates.push({ text, selectorIndex, nodeIndex, length: text.length });
            });
        });
        if (!candidates.length) return '';
        candidates.sort((a, b) => {
            if (a.selectorIndex !== b.selectorIndex) return a.selectorIndex - b.selectorIndex;
            if (a.nodeIndex !== b.nodeIndex) return b.nodeIndex - a.nodeIndex;
            return b.length - a.length;
        });
        return candidates[0].text;
    }, String(promptText || '')).catch(() => '');
}

async function waitForAiResponseText(page, promptText = '', timeoutMs = 180000) {
    const startedAt = Date.now();
    let lastText = '';
    let stablePasses = 0;
    while ((Date.now() - startedAt) < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        const currentText = await extractLatestAiResponseText(page, promptText);
        if (currentText && currentText !== lastText) {
            lastText = currentText;
            stablePasses = 0;
            continue;
        }
        if (currentText) stablePasses += 1;
        if (lastText && stablePasses >= 2) {
            return lastText;
        }
    }
    return lastText;
}

async function runLocalAiImageBridge({ targetUrl, dataUrl, promptText, headless = false }) {
    const finalUrl = targetUrl || 'https://gemini.google.com/';
    const tempImage = dataUrlToTempImageFile(dataUrl, 'ai_bridge_upload');
    const profileName = getAiBridgeProfileName(finalUrl);
    const userProfileDir = getProfileDirForEmail(profileName);
    const args = getAiBridgeBrowserArgs(finalUrl);

    const browserLaunch = await launchBrowserWithFallback({
        launchOptions: {
            executablePath: getChromePath() || undefined,
            headless: headless ? 'new' : false,
            userDataDir: userProfileDir,
            ignoreDefaultArgs: GHOST_IGNORE_DEFAULT_ARGS,
            args
        },
        debugSeed: `${profileName}_local_ai_bridge`,
        targetUrl: finalUrl,
        fallbackArgs: args,
        fallbackHeadless: !!headless
    });
    try {
        const browser = browserLaunch.browser;
        const page = await createStablePage(browser);
        page.on('console', (message) => logToFile(`[AI-BRIDGE] ${message.text()}`));

        await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => null);
        await waitForAiComposer(page, 90000);
        await uploadAiBridgeImage(page, tempImage.filePath);
        if (String(promptText || '').trim()) {
            await setAiComposerText(page, promptText);
        }
        await clickAiSendButton(page);

        const responseText = await waitForAiResponseText(page, promptText, 180000);
        logToFile(`[AI-BRIDGE] sent image to ${finalUrl} | bytes=${tempImage.bytes} | response=${responseText ? responseText.slice(0, 80) : 'none'} | mode=${browserLaunch.mode}${browserLaunch.port ? ` port=${browserLaunch.port}` : ''}`);
        return {
            success: true,
            bridge: 'local-server',
            mode: browserLaunch.mode,
            port: browserLaunch.port || null,
            bytes: tempImage.bytes,
            responseText
        };
    } finally {
        try {
            if (tempImage.filePath && fs.existsSync(tempImage.filePath)) {
                fs.unlinkSync(tempImage.filePath);
            }
        } catch (cleanupError) {
            logToFile(`AI bridge temp cleanup warning: ${cleanupError.message}`, 'WARN');
        }
    }
}

async function waitForTeePublicGateToClear(page, timeout = 45000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
        const gated = await page.evaluate(() => {
            const title = String(document.title || '').toLowerCase();
            const text = String(document.body?.innerText || '').toLowerCase();
            return title.includes('just a moment')
                || text.includes('performing security verification')
                || text.includes('security verification')
                || text.includes('verify you are human')
                || text.includes('checking your browser')
                || text.includes('cloudflare');
        }).catch(() => false);
        if (!gated) return true;
        await new Promise((r) => setTimeout(r, 1200));
    }
    return false;
}

function detectTeePublicLoggedOutMessage(bodyText = '') {
    const lower = String(bodyText || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!lower) return false;
    return lower.includes('must be logged in')
        || lower.includes('you must be logged in')
        || lower.includes('log in to edit')
        || lower.includes('sign in to edit')
        || lower.includes('logged in to edit')
        || (lower.includes('create account') && lower.includes('logged in'));
}

async function readTeePublicSessionState(page) {
    const info = await page.evaluate(() => {
        const hrefMatches = (pattern) => Array.from(document.querySelectorAll('a[href], form[action]')).some((node) => {
            const raw = node.getAttribute('href') || node.getAttribute('action') || '';
            return pattern.test(String(raw));
        });
        const loginForm = !!document.querySelector('#user_email, #email, #user_password, #password, form[action*="sign_in"]');
        const emailFilled = String(document.querySelector('#user_email, #email')?.value || '').trim();
        const signOut = hrefMatches(/sign[_-]?out/i);
        const avatar = !!document.querySelector('.nav-user-avatar, .m-nav-avatar, img[alt*="profile" i], img[alt*="avatar" i]');
        const accountArea = hrefMatches(/\/account(\/|$)|\/account\/store|\/account\/storefront|\/users\/edit|\/dashboard/i);
        const storeEditor = Array.from(document.querySelectorAll(
            'input[name="store[name]"], #store_name, textarea[name="store[bio]"], #store_bio, form[action*="/account/store"]'
        )).some((el) => {
            if (el.tagName === 'FORM') return true;
            if (el.disabled || el.readOnly) return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        const authError = !!document.querySelector('.alert, .flash, .error, .errors, .field_with_errors');
        const bodyText = String(document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400);
        return { loginForm, emailFilled, signOut, avatar, accountArea, storeEditor, authError, bodyText };
    }).catch(() => ({
        loginForm: false,
        emailFilled: '',
        signOut: false,
        avatar: false,
        accountArea: false,
        storeEditor: false,
        authError: false,
        bodyText: ''
    }));

    const url = String(page.url() || '');
    const onSignIn = /\/users\/sign_in\b/i.test(url);
    const loggedOutBanner = detectTeePublicLoggedOutMessage(info.bodyText);
    const loggedIn = !loggedOutBanner && !!(
        info.signOut
        || info.avatar
        || info.accountArea
    );

    return {
        ...info,
        url,
        onSignIn,
        loggedOutBanner,
        loggedIn,
    };
}

function isTeePublicAccountSurface(state = {}) {
    const url = String(state?.url || '');
    const onAccountUrl = /\/account(\/|$)|\/account\/store|\/account\/storefront|\/users\/edit|\/dashboard/i.test(url);
    return !!(!state.onSignIn && !state.loginForm && (state.storeEditor || onAccountUrl));
}

async function verifyTeePublicAccountAccess(page) {
    try {
        await page.goto('https://www.teepublic.com/account/store', { waitUntil: 'domcontentloaded', timeout: 90000 });
        await waitForTeePublicGateToClear(page, 20000);
        await new Promise((r) => setTimeout(r, 1500));
        const state = await readTeePublicSessionState(page);
        const allowed = isTeePublicAccountSurface(state);
        return { allowed, state };
    } catch (err) {
        return {
            allowed: false,
            state: {
                url: page.url(),
                onSignIn: /\/users\/sign_in\b/i.test(String(page.url() || '')),
                loginForm: false,
                error: err.message,
            }
        };
    }
}

async function clearTeePublicAuthState(page, email = 'unknown') {
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
        logToFile(`[AUTH] Cleared TeePublic auth state for ${email}`, 'WARN');
    } catch (err) {
        logToFile(`[AUTH] Clear auth state warning for ${email}: ${err.message}`, 'WARN');
    }
}

async function ensureTeePublicSession(page, account, autoLogin = true, options = {}) {
    const requireAccountStoreAccess = options.requireAccountStoreAccess !== false;
    await page.goto('https://www.teepublic.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await waitForTeePublicGateToClear(page, 45000);

    let state = await readTeePublicSessionState(page);
    if (state.loggedIn) {
        if (!requireAccountStoreAccess) {
            logToFile(`[AUTH] Existing basic TeePublic session accepted for ${account?.email || 'unknown'} | url=${state.url}`);
            return true;
        }
        const verified = await verifyTeePublicAccountAccess(page);
        if (verified.allowed) {
            logToFile(`[AUTH] Existing TeePublic session detected for ${account?.email || 'unknown'} | url=${verified.state?.url || state.url}`);
            return true;
        }
        logToFile(`[AUTH] Existing-session signal failed account/store verification for ${account?.email || 'unknown'} | url=${verified.state?.url || state.url}`, 'WARN');
        await clearTeePublicAuthState(page, account?.email || 'unknown');
        state = await readTeePublicSessionState(page);
    }

    if (!autoLogin) {
        logToFile(`[AUTH] Auto-login disabled for ${account?.email || 'unknown'} | url=${state.url}`, 'WARN');
        return false;
    }

    let emIn = null;
    for (let loginAttempt = 1; loginAttempt <= 2; loginAttempt += 1) {
        await page.goto('https://www.teepublic.com/users/sign_in', { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => null);
        await waitForTeePublicGateToClear(page, 45000);
        emIn = await page.waitForSelector('#user_email, #email', { timeout: 18000 }).catch(() => null);
        if (emIn) break;
        logToFile(`[AUTH] Login form not found attempt ${loginAttempt} for ${account?.email || 'unknown'} | url=${page.url()}`, 'WARN');
        await new Promise((r) => setTimeout(r, 1200));
    }
    if (!emIn) {
        logToFile(`[AUTH] Login form not found for ${account?.email || 'unknown'} | url=${page.url()}`, 'WARN');
        return false;
    }

    await emIn.click({ clickCount: 3 }).catch(() => { });
    await emIn.press('Backspace').catch(() => { });
    await emIn.type(account.email || '', { delay: 15 });

    const pwSelector = '#user_password, #password';
    const pwIn = await page.waitForSelector(pwSelector, { timeout: 10000 }).catch(() => null);
    if (!pwIn) {
        logToFile(`[AUTH] Password field not found for ${account?.email || 'unknown'} | url=${page.url()}`, 'WARN');
        return false;
    }
    await pwIn.click({ clickCount: 3 }).catch(() => { });
    await pwIn.press('Backspace').catch(() => { });
    await pwIn.type(account.pass || '', { delay: 15 });

    await Promise.all([
        page.click('button[type="submit"], input[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
    ]);

    await waitForTeePublicGateToClear(page, 45000);
    await new Promise((r) => setTimeout(r, 2500));

    state = await readTeePublicSessionState(page);
    if (!state.loggedIn && state.onSignIn && !state.authError) {
        await page.goto('https://www.teepublic.com/', { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => null);
        await waitForTeePublicGateToClear(page, 30000);
        await new Promise((r) => setTimeout(r, 1500));
        state = await readTeePublicSessionState(page);
    }

    if (state.loggedIn && requireAccountStoreAccess) {
        const verified = await verifyTeePublicAccountAccess(page);
        if (!verified.allowed) {
            state = { ...state, loggedIn: false, accountVerificationFailed: true, url: verified.state?.url || state.url };
        } else {
            state = { ...state, url: verified.state?.url || state.url };
        }
    } else if (state.loggedIn) {
        logToFile(`[AUTH] Basic TeePublic session accepted for ${account?.email || 'unknown'} | url=${state.url}`);
    }

    logToFile(`[AUTH] ${account?.email || 'unknown'} | loggedIn=${state.loggedIn} | onSignIn=${state.onSignIn} | loginForm=${state.loginForm} | signOut=${state.signOut} | avatar=${state.avatar} | accountArea=${state.accountArea} | accountCheckFailed=${state.accountVerificationFailed === true} | url=${state.url}`);
    if (!state.loggedIn) {
        logToFile(`[AUTH] Body snapshot for ${account?.email || 'unknown'}: ${state.bodyText || 'empty'}`, 'WARN');
    }
    return state.loggedIn;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  GHOST SERVER v31.1 - SUPREME DNA SYNERGY (NO SHORTCUTS)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const TEEPUBLIC_QUICK_CREATE_URL = 'https://www.teepublic.com/design/quick_create';
const activeUploadJobs = new Map();
/** One active Ghost upload session at a time — accounts run sequentially, never in parallel windows. */
let globalUploadChain = Promise.resolve();

function withGlobalUploadMutex(fn) {
    const prev = globalUploadChain;
    const run = prev.catch(() => null).then(() => fn());
    globalUploadChain = run.catch(() => null);
    return run;
}

const _withGlobalUploadMutexCore = withGlobalUploadMutex;
async function guardedWithGlobalUploadMutex(fn) {
    const check = await seqUploadGuard.assertSeqGuard({
        ghostMutex: { fn: _withGlobalUploadMutexCore, needles: seqUploadGuard.MARKERS.ghostMutex }
    }, 'withGlobalUploadMutex');
    if (!check.ok) {
        throw new Error('SEQ_UPLOAD_GUARD: Ghost upload mutex compromised — unlock with key 693400');
    }
    return _withGlobalUploadMutexCore(fn);
}
withGlobalUploadMutex = guardedWithGlobalUploadMutex;

seqUploadGuard.sealWhenLocked({ withGlobalUploadMutex: guardedWithGlobalUploadMutex }).catch(() => {});

function updateActiveUploadJob(jobId, status, extra = {}) {
    if (!jobId) return;
    activeUploadJobs.set(jobId, {
        status,
        updatedAt: Date.now(),
        ...extra
    });
}

function clearActiveUploadJob(jobId) {
    if (!jobId) return;
    activeUploadJobs.delete(jobId);
}

function getActiveUploadJob(jobId) {
    if (!jobId) return null;
    return activeUploadJobs.get(jobId) || null;
}

function buildServerUploadJobId(account, design, index) {
    const raw = String(
        design?.jobId ||
        design?.meta?.jobId ||
        design?.meta?.title ||
        design?.file?.name ||
        `design-${index + 1}`
    );
    const safe = raw.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || `design-${index + 1}`;
    const accountPart = String(account?.email || 'account').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 24) || 'account';
    return `srv-${accountPart}-${safe}-${index + 1}`;
}

function dataUrlToTempImageFile(dataUrl, label = 'img') {
    const raw = String(dataUrl || '').trim();
    const match = raw.match(/^data:(image\/[^;]+);base64,(.+)$/i);
    if (!match) return null;
    const mime = match[1].toLowerCase();
    const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
    const buf = Buffer.from(match[2], 'base64');
    if (!buf.length) return null;
    ensureTempUploadDir();
    const filePath = path.join(TEMP_DIR, `store_${label}_${Date.now()}.${ext}`);
    fs.writeFileSync(filePath, buf);
    return filePath;
}

function resolveStoreProfileTitle(storeProfile) {
    const title = String(storeProfile?.title || storeProfile?.storeTitle || '').trim();
    if (title) return title.slice(0, 60);
    const prefixes = ['PureGraph', 'DigitalVibe', 'NexusPulse', 'FreshVibe', 'EliteCraft'];
    return prefixes[Math.floor(Math.random() * prefixes.length)] + '_' + Math.floor(1000 + Math.random() * 9000);
}

async function clickTeePublicSellYourArt(page) {
    const result = await page.evaluate(() => {
        const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const nodes = Array.from(document.querySelectorAll('a[href], button, [role="link"]'));
        const hit = nodes.find((el) => {
            const text = norm(el.textContent || el.getAttribute('aria-label') || '');
            const href = norm(el.getAttribute('href') || '');
            return text.includes('sell your art')
                || (text.includes('sell') && text.includes('art'))
                || href.includes('/design/quick_create')
                || href.includes('/sell');
        });
        if (!hit) return { clicked: false };
        hit.click();
        return { clicked: true, label: norm(hit.textContent || hit.getAttribute('href') || '') };
    });
    if (result.clicked) {
        logToFile(`[Foundation] Sell Your Art clicked: ${result.label || 'link'}`);
        await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null),
            new Promise((r) => setTimeout(r, 4000)),
        ]);
    }
    return result.clicked;
}

async function clickTeePublicSingleFileUpload(page) {
    const clicked = await page.evaluate(() => {
        const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const clickNode = (el) => {
            if (!el) return false;
            const target = el.closest('a, button, [role="button"], label, [onclick], [class*="upload"]') || el;
            target.click();
            return true;
        };
        const nodes = Array.from(document.querySelectorAll('a, button, label, [role="button"], div, section, article'));
        const hit = nodes.find((el) => {
            const text = norm(el.textContent || el.getAttribute('aria-label') || '');
            return text.includes('single file upload')
                || text === 'single file'
                || (text.includes('single') && text.includes('upload') && text.includes('file'));
        });
        if (clickNode(hit)) return true;

        const uploadCards = Array.from(document.querySelectorAll('a, button, [role="button"], div[class], section[class]'));
        const card = uploadCards.find((el) => {
            const text = norm(el.textContent || el.getAttribute('aria-label') || '');
            const cls = norm(el.className || '');
            return (text.includes('upload') || cls.includes('upload')) && (text.includes('png') || text.includes('file'));
        });
        return clickNode(card);
    });
    if (clicked) {
        logToFile('[Foundation] Single File Upload selected');
        await Promise.race([
            page.waitForSelector('input[type="file"]', { timeout: 20000 }).catch(() => null),
            page.waitForFunction(
                () => /upload a design|drop one file|click to upload/i.test(document.body?.innerText || ''),
                { timeout: 20000 }
            ).catch(() => null),
        ]);
        await new Promise((r) => setTimeout(r, 1000));
    }
    return clicked;
}

const STORE_SETUP_SELECTORS = '#design_store_name, .jsStoreName, input[name*="store_name"], input[name="store[name]"], #store_name, input[name*="store"], input[placeholder*="Store Name" i]';

async function navigateTeePublicFoundationEntry(page, storeProfile = null, supervisorCtx = null) {
    await page.goto('https://www.teepublic.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1500));

    const sellClicked = await clickTeePublicSellYourArt(page);
    if (!sellClicked) {
        logToFile('[Foundation] Sell Your Art not found — fallback quick_create', 'WARN');
        await page.goto(TEEPUBLIC_QUICK_CREATE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    }

    await waitForQuickCreateSurface(page, 20000);
    await new Promise((r) => setTimeout(r, 1500));
    await clickTeePublicSingleFileUpload(page);

    const state = await inspectTeePublicQuickCreate(page).catch(() => null);
    if (state?.storeSetup) {
        await maybeCompleteTeePublicStoreSetup(page, storeProfile, supervisorCtx);
    }
    logToFile(`[Foundation] entry ready | url=${page.url()}`);
    return true;
}

async function maybeCompleteTeePublicStoreSetup(page, storeProfile = null, supervisorCtx = null) {
    const storeFlag = await page.evaluate((sel) => !!document.querySelector(sel), STORE_SETUP_SELECTORS);
    if (!storeFlag) return false;

    const rName = resolveStoreProfileTitle(storeProfile);
    const email = String(supervisorCtx?.email || storeProfile?.email || '').trim();
    logToFile(`Store setup detected. Completing with name: ${rName}`);

    let fillOk = false;
    const storeInput = await page.$(STORE_SETUP_SELECTORS).catch(() => null);
    if (storeInput) {
        await storeInput.click({ clickCount: 3 }).catch(() => null);
        await storeInput.type(rName, { delay: 60 });
        fillOk = true;
    } else {
        const filled = await page.evaluate((name, selectors) => {
            const candidates = Array.from(document.querySelectorAll('input, textarea'));
            const input = candidates.find((el) => {
                const text = `${el.id || ''} ${el.name || ''} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
                return text.includes('store') || text.includes('shop') || text.includes('name');
            }) || document.querySelector(selectors);
            if (!input) return false;
            input.focus();
            input.value = name;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.blur();
            return true;
        }, rName, STORE_SETUP_SELECTORS).catch(() => false);
        fillOk = filled === true;
    }

    if (!fillOk) return false;

    await new Promise((r) => setTimeout(r, 1200));
    const continued = await page.evaluate(() => {
        const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const nodes = Array.from(document.querySelectorAll('button, input[type="submit"], a, [role="button"]'));
        const hit = nodes.find((el) => {
            const label = norm(`${el.textContent || ''} ${el.value || ''} ${el.getAttribute('aria-label') || ''}`);
            const idName = norm(`${el.id || ''} ${el.className || ''}`);
            return label.includes('continue')
                || label.includes('next')
                || label.includes('start selling')
                || label.includes('save')
                || idName.includes('save_store_name')
                || idName.includes('storecreationcontinue');
        });
        if (!hit) return false;
        hit.click();
        return true;
    }).catch(() => false);
    if (!continued) {
        const btnH = await page.waitForSelector('#design_save_store_name, .jsStoreCreationContinue, button[type="submit"]', { visible: true, timeout: 15000 }).catch(() => null);
        if (!btnH) throw new Error('store_setup_continue_button_not_found');
        const box = await btnH.boundingBox();
        if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => { });
    logToFile('Store setup completed. Stabilizing before upload...');
    if (aiSupervisor?.appendJournal) {
        aiSupervisor.appendJournal(ROOT_DIR, {
            email,
            phase: supervisorCtx?.phase || 'foundation',
            url: page.url(),
            step: 'store_setup_continue',
            action: 'click',
            selector: '#design_save_store_name',
            success: true,
            storeName: rName,
            notes: 'Store setup form submitted',
        }, logToFile);
    }
    await new Promise((r) => setTimeout(r, 7000));
    return true;
}

async function applyTeePublicStoreDetails(page, storeProfile = {}) {
    const profile = {
        title: String(storeProfile?.title || storeProfile?.storeTitle || '').trim(),
        bio: String(storeProfile?.bio || storeProfile?.description || '').trim(),
        links: storeProfile?.links && typeof storeProfile.links === 'object' ? storeProfile.links : {},
    };
    await page.goto('https://www.teepublic.com/account/store', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(
        () => !!document.querySelector('form, textarea, input[type="text"]'),
        { timeout: 30000 }
    ).catch(() => null);
    await new Promise((r) => setTimeout(r, 1500));

    const applied = await page.evaluate((data) => {
        function setField(selectors, value, hints = []) {
            const text = String(value || '').trim();
            if (!text) return false;
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.type === 'hidden')) {
                    el.focus();
                    el.value = text;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.blur();
                    return true;
                }
            }
            const normalizedHints = hints.map((hint) => String(hint || '').toLowerCase()).filter(Boolean);
            if (normalizedHints.length) {
                const fields = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea'));
                for (const el of fields) {
                    const id = el.id || '';
                    const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
                    const context = [
                        el.name,
                        el.id,
                        el.placeholder,
                        el.getAttribute('aria-label'),
                        label?.textContent,
                        el.closest('label')?.textContent,
                        el.parentElement?.textContent,
                    ].join(' ').toLowerCase();
                    if (!normalizedHints.some((hint) => context.includes(hint))) continue;
                    if (!(el.offsetWidth > 0 || el.offsetHeight > 0)) continue;
                    el.focus();
                    el.value = text;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.blur();
                    return true;
                }
            }
            return false;
        }
        const result = {};
        result.title = setField(
            ['input[name="store[name]"]', 'input[name*="store_name"]', '#store_name', 'input[placeholder*="Store Name" i]'],
            data.title,
            ['store name', 'shop name', 'display name']
        );
        result.bio = setField(
            ['textarea[name="store[bio]"]', 'textarea[name*="bio"]', '#store_bio', 'textarea[placeholder*="bio" i]', 'textarea[placeholder*="description" i]', 'textarea[placeholder*="about" i]'],
            data.bio,
            ['bio', 'description', 'about', 'store description']
        );
        const links = data.links || {};
        result.instagram = setField(['input[name*="instagram" i]', 'input[id*="instagram" i]'], links.instagram, ['instagram']);
        result.twitter = setField(['input[name*="twitter" i]', 'input[id*="twitter" i]', 'input[name*="x.com" i]'], links.twitter, ['twitter', 'x.com', 'x / twitter']);
        result.facebook = setField(['input[name*="facebook" i]', 'input[id*="facebook" i]'], links.facebook, ['facebook']);
        result.pinterest = setField(['input[name*="pinterest" i]', 'input[id*="pinterest" i]'], links.pinterest, ['pinterest']);

        const saveBtn = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn')).find((btn) => {
            const label = `${btn.textContent || ''} ${btn.value || ''}`.trim().toLowerCase();
            return /save all changes|save changes|update store|حفظ/.test(label);
        });
        if (saveBtn) {
            saveBtn.click();
            result.saved = true;
        }
        return result;
    }, profile);

    await new Promise((r) => setTimeout(r, 3000));
    logToFile(`[StoreProfile] account/store applied: ${JSON.stringify(applied)}`);
    return applied;
}

async function applyTeePublicStoreDetailsV2(page, storeProfile = {}, account = null) {
    const profile = {
        title: String(storeProfile?.title || storeProfile?.storeTitle || '').trim(),
        bio: String(storeProfile?.bio || storeProfile?.description || '').trim(),
        links: storeProfile?.links && typeof storeProfile.links === 'object' ? storeProfile.links : {},
    };
    let navigated = false;
    let lastNavError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            await page.goto('https://www.teepublic.com/account/store', { waitUntil: 'domcontentloaded', timeout: 90000 });
            await waitForTeePublicGateToClear(page, 20000);
            navigated = true;
            break;
        } catch (err) {
            lastNavError = err;
            logToFile(`[StoreProfile] account/store navigation attempt ${attempt} failed for ${account?.email || 'unknown'}: ${err.message}`, 'WARN');
            await page.goto('https://www.teepublic.com/', { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => null);
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
    if (!navigated && lastNavError) throw lastNavError;
    await page.waitForFunction(
        () => !!document.querySelector('form, textarea, input[type="text"], input[type="url"]'),
        { timeout: 30000 }
    ).catch(() => null);
    await new Promise((r) => setTimeout(r, 1500));

    const accessState = await readTeePublicSessionState(page);
    if (!isTeePublicAccountSurface(accessState)) {
        logToFile(`[StoreProfile] account/store surface invalid for ${account?.email || 'unknown'} | url=${accessState.url} | onSignIn=${accessState.onSignIn} | loginForm=${accessState.loginForm} | storeEditor=${accessState.storeEditor} | accountArea=${accessState.accountArea}`, 'WARN');
        return {
            title: false,
            bio: false,
            instagram: false,
            twitter: false,
            facebook: false,
            pinterest: false,
            saved: false,
            url: accessState.url,
            authBounce: true,
            fieldSummary: []
        };
    }

    const applied = await page.evaluate((data) => {
        function isUsableField(el) {
            return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !el.disabled && !el.readOnly);
        }
        function fieldContext(el) {
            const id = el.id || '';
            const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
            return [
                el.name,
                el.id,
                el.placeholder,
                el.getAttribute('aria-label'),
                el.getAttribute('data-testid'),
                label?.textContent,
                el.closest('label')?.textContent,
                el.parentElement?.textContent,
                el.closest('section, form, div')?.textContent,
            ].join(' ').toLowerCase();
        }
        function setNativeValue(el, text) {
            const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
            if (descriptor && typeof descriptor.set === 'function') descriptor.set.call(el, text);
            else el.value = text;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        function setField(selectors, value, hints = []) {
            const text = String(value || '').trim();
            if (!text) return false;
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (isUsableField(el)) {
                    el.focus();
                    setNativeValue(el, text);
                    return true;
                }
            }
            const normalizedHints = hints.map((hint) => String(hint || '').toLowerCase()).filter(Boolean);
            if (normalizedHints.length) {
                const fields = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea'));
                for (const el of fields) {
                    if (!isUsableField(el)) continue;
                    const context = fieldContext(el);
                    if (!normalizedHints.some((hint) => context.includes(hint))) continue;
                    el.focus();
                    setNativeValue(el, text);
                    return true;
                }
            }
            return false;
        }
        const result = {};
        result.title = setField(
            ['input[name="store[name]"]', 'input[name*="store_name"]', 'input[name*="[name]"]', '#store_name', 'input[placeholder*="Store Name" i]', 'input[placeholder*="shop name" i]', 'input[placeholder*="display name" i]'],
            data.title,
            ['store name', 'shop name', 'display name']
        );
        result.bio = setField(
            ['textarea[name="store[bio]"]', 'textarea[name*="bio"]', 'textarea[name*="description"]', '#store_bio', 'textarea[placeholder*="bio" i]', 'textarea[placeholder*="description" i]', 'textarea[placeholder*="about" i]'],
            data.bio,
            ['bio', 'description', 'about', 'store description']
        );
        const links = data.links || {};
        result.instagram = setField(['input[name*="instagram" i]', 'input[id*="instagram" i]'], links.instagram, ['instagram']);
        result.twitter = setField(['input[name*="twitter" i]', 'input[id*="twitter" i]', 'input[name*="x" i]'], links.twitter, ['twitter', 'x.com', 'x / twitter']);
        result.facebook = setField(['input[name*="facebook" i]', 'input[id*="facebook" i]'], links.facebook, ['facebook']);
        result.pinterest = setField(['input[name*="pinterest" i]', 'input[id*="pinterest" i]'], links.pinterest, ['pinterest']);
        const saveBtn = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn')).find((btn) => {
            const label = `${btn.textContent || ''} ${btn.value || ''}`.trim().toLowerCase();
            return /save all changes|save changes|update store|save|submit|Ø­ÙØ¸/.test(label);
        });
        if (saveBtn) {
            saveBtn.click();
            result.saved = true;
        }
        result.url = window.location.href;
        result.fieldSummary = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea')).slice(0, 40).map((el) => fieldContext(el).slice(0, 180));
        return result;
    }, profile);

    await new Promise((r) => setTimeout(r, 3000));
    logToFile(`[StoreProfile] account/store applied V2: ${JSON.stringify(applied)}`);
    return applied;
}

async function clickStorefrontTrigger(page, triggerSelectors, textHints = []) {
    for (const sel of triggerSelectors) {
        const handle = await page.$(sel).catch(() => null);
        if (!handle) continue;
        const visible = await handle.evaluate((el) => !!(el.offsetWidth > 0 || el.offsetHeight > 0)).catch(() => false);
        if (!visible) continue;
        await handle.click().catch(() => null);
        return true;
    }
    if (!textHints.length) return false;
    return page.evaluate((hints) => {
        const nodes = Array.from(document.querySelectorAll('a, button, [role="button"]'));
        const hit = nodes.find((el) => {
            const label = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`.trim().toLowerCase();
            return hints.some((h) => label.includes(String(h).toLowerCase()));
        });
        if (!hit) return false;
        hit.click();
        return true;
    }, textHints).catch(() => false);
}

async function findStorefrontFileInput(page, target) {
    const handle = await page.evaluateHandle((targetName) => {
        const directSelector = targetName === 'cover'
            ? '#uploader_Store_header input[type="file"], #uploader_Store_cover input[type="file"], #uploader_Store_hero input[type="file"], .jsCoverUpload input[type="file"], .m-store-head__hero input[type="file"], .m-store-head__cover input[type="file"]'
            : '#uploader_Store_avatar input[type="file"], .jsAvatarUpload input[type="file"], .m-store-head__avatar-upload input[type="file"], .m-store-head__avatar input[type="file"]';
        const direct = document.querySelector(directSelector);
        if (direct) return direct;

        const targetHints = targetName === 'cover'
            ? ['cover', 'banner', 'header']
            : ['avatar', 'profile', 'portrait', 'user image', 'store image'];
        const rejectHints = targetName === 'cover'
            ? ['avatar', 'profile', 'portrait']
            : ['cover', 'banner', 'header'];
        function contextFor(el) {
            const id = el.id || '';
            const label = id && window.CSS?.escape ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
            const ancestors = [];
            let node = el.parentElement;
            for (let i = 0; node && i < 5; i += 1, node = node.parentElement) {
                ancestors.push(`${node.id || ''} ${node.className || ''} ${node.getAttribute?.('aria-label') || ''}`);
            }
            return [
                el.name,
                el.id,
                el.className,
                el.accept,
                el.getAttribute('aria-label'),
                label?.textContent,
                el.closest('label')?.textContent,
                el.parentElement?.textContent,
                el.closest('[class]')?.className,
                ancestors.join(' '),
            ].join(' ').toLowerCase();
        }
        const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
        const scored = inputs.map((input, index) => {
            const ctx = contextFor(input);
            const targetScore = targetHints.reduce((sum, hint) => sum + (ctx.includes(hint) ? 1 : 0), 0);
            const rejectScore = rejectHints.reduce((sum, hint) => sum + (ctx.includes(hint) ? 1 : 0), 0);
            return { input, index, targetScore, rejectScore };
        }).filter((item) => item.targetScore > 0 && item.rejectScore === 0);
        if (scored.length) return scored.sort((a, b) => b.targetScore - a.targetScore || b.index - a.index)[0].input;
        return inputs.length === 1 ? inputs[0] : null;
    }, target);
    const element = handle.asElement();
    if (element) return element;
    await handle.dispose().catch(() => null);
    return null;
}

async function uploadStorefrontImage(page, target, filePath, triggerSelectors, textHints = []) {
    const targetFileInputSelector = target === 'avatar'
        ? '#uploader_Store_avatar input[type="file"], .jsAvatarUpload input[type="file"], .m-store-uploader__image--avatar input[type="file"], .m-store-head__avatar-upload input[type="file"], .m-store-head__avatar input[type="file"]'
        : '#uploader_Store_header input[type="file"], #uploader_Store_cover input[type="file"], #uploader_Store_hero input[type="file"], .jsCoverUpload input[type="file"], .m-store-head__hero input[type="file"], .m-store-head__cover input[type="file"]';
    const beforeSrc = target === 'avatar'
        ? await page.evaluate(() => document.querySelector('.m-store-head__avatar img, .jsAvatarUpload img, img[alt*="Profile" i]')?.src || '').catch(() => '')
        : await page.evaluate(() => document.querySelector('.m-store-head__hero img, .m-store-head__cover img, img[alt*="cover" i]')?.src || '').catch(() => '');

    await new Promise((r) => setTimeout(r, target === 'cover' ? 1100 : 800));
    await clickStorefrontTrigger(page, triggerSelectors, textHints);
    await page.waitForSelector(targetFileInputSelector, { timeout: target === 'cover' ? 18000 : 15000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, target === 'cover' ? 1400 : 1000));

    let input = await findStorefrontFileInput(page, target);
    if (input) {
        await new Promise((r) => setTimeout(r, 700));
        await input.uploadFile(filePath);
        await input.evaluate((el) => {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }).catch(() => null);
    } else {
        const chooserPromise = page.waitForFileChooser({ timeout: 10000 }).catch(() => null);
        const triggered = await clickStorefrontTrigger(page, triggerSelectors, textHints);
        if (!triggered) return false;
        const chooser = await chooserPromise;
        if (chooser) {
            await new Promise((r) => setTimeout(r, 650));
            await chooser.accept([filePath]);
        } else {
            await new Promise((r) => setTimeout(r, 1200));
            await page.waitForSelector(targetFileInputSelector, { timeout: 8000 }).catch(() => null);
            input = await findStorefrontFileInput(page, target);
            if (!input) return false;
            await new Promise((r) => setTimeout(r, 700));
            await input.uploadFile(filePath);
            await input.evaluate((el) => {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }).catch(() => null);
        }
    }

    const uploaded = await page.waitForFunction((targetName, previousSrc) => {
        if (targetName === 'avatar') {
            const hidden = document.querySelector('input[name="store[avatar]"], input[name*="avatar"][type="hidden"], input[data-cloudinary-field*="avatar"]');
            const img = document.querySelector('.m-store-head__avatar img, .jsAvatarUpload img, img[alt*="Profile" i]');
            const src = img?.src || '';
            return !!(
                (hidden?.value && hidden.value.trim()) ||
                (src && src !== previousSrc && !src.includes('store_avatar_default'))
            );
        }
        const input = document.querySelector('#uploader_Store_header input[type="file"], #uploader_Store_cover input[type="file"], #uploader_Store_hero input[type="file"], .jsCoverUpload input[type="file"], .m-store-head__hero input[type="file"], .m-store-head__cover input[type="file"]');
        const hidden = document.querySelector('input[name="store[cover]"], input[name*="cover"][type="hidden"], input[name*="header"][type="hidden"], input[data-cloudinary-field*="cover"], input[data-cloudinary-field*="header"]');
        const img = document.querySelector('.m-store-head__hero img, .m-store-head__cover img, img[alt*="cover" i]');
        const src = img?.src || '';
        return !!(
            (input?.files && input.files.length > 0) ||
            (hidden?.value && hidden.value.trim()) ||
            (src && src !== previousSrc)
        );
    }, { timeout: target === 'avatar' ? 90000 : 45000 }, target, beforeSrc).then(() => true).catch(() => false);

    if (!uploaded) return false;
    await new Promise((r) => setTimeout(r, 2000));

    const saved = await page.evaluate(() => {
        const saveBtn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find((btn) => {
            const label = `${btn.textContent || ''} ${btn.value || ''}`.trim().toLowerCase();
            return /^save$|save changes|حفظ/.test(label);
        });
        if (saveBtn) {
            saveBtn.click();
            return true;
        }
        return false;
    });
    if (!saved) return false;

    if (target === 'avatar') {
        const verified = await page.waitForFunction((previousSrc) => {
            const img = document.querySelector('.m-store-head__avatar img, .jsAvatarUpload img, img[alt*="Profile" i]');
            const src = img?.src || '';
            return !!(src && src !== previousSrc && !src.includes('store_avatar_default'));
        }, { timeout: 30000 }, beforeSrc).then(() => true).catch(() => false);
        await new Promise((r) => setTimeout(r, 2000));
        return verified;
    }

    const verified = await page.waitForFunction((previousSrc) => {
        const hidden = document.querySelector('input[name="store[cover]"], input[name*="cover"][type="hidden"], input[name*="header"][type="hidden"], input[data-cloudinary-field*="cover"], input[data-cloudinary-field*="header"]');
        const img = document.querySelector('.m-store-head__hero img, .m-store-head__cover img, img[alt*="cover" i]');
        const src = img?.src || '';
        return !!(
            (hidden?.value && hidden.value.trim()) ||
            (src && src !== previousSrc)
        );
    }, { timeout: 30000 }, beforeSrc).then(() => true).catch(() => false);
    await new Promise((r) => setTimeout(r, 2000));
    return verified;
}

async function applyTeePublicStoreImages(page, storeProfile = {}) {
    const avatarPath = storeProfile?.avatarDataUrl ? dataUrlToTempImageFile(storeProfile.avatarDataUrl, 'avatar') : null;
    const coverPath = storeProfile?.coverDataUrl ? dataUrlToTempImageFile(storeProfile.coverDataUrl, 'cover') : null;
    if (!avatarPath && !coverPath) return { avatar: false, cover: false };

    await page.goto('https://www.teepublic.com/account/storefront', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));

    const result = { avatar: false, cover: false };
    if (avatarPath) {
        result.avatar = await uploadStorefrontImage(page, 'avatar', avatarPath, [
            '#uploader_Store_avatar',
            '.jsAvatarUpload',
            '.m-store-head__avatar-upload',
            '.store-avatar img', '.avatar img', 'img.avatar', '.profile-avatar img',
            '.storefront-avatar', '.user-avatar img', '[class*="avatar"]', '[class*="profile"]',
            'button[aria-label*="avatar" i]', 'button[aria-label*="profile" i]',
        ], ['avatar', 'profile image', 'profile picture', 'store image', 'صورة']);
        try { fs.unlinkSync(avatarPath); } catch (_) { /* ignore */ }
        await page.goto('https://www.teepublic.com/account/storefront', { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => null);
        await new Promise((r) => setTimeout(r, 2000));
    }
    if (coverPath) {
        result.cover = await uploadStorefrontImage(page, 'cover', coverPath, [
            '#uploader_Store_header',
            '#uploader_Store_cover',
            '#uploader_Store_hero',
            '.jsCoverUpload',
            '[class*="edit-cover"]', 'a[href*="cover"]', 'button[aria-label*="cover" i]',
            '[class*="cover"]', '[class*="banner"]', '[class*="header"]',
        ], ['edit cover', 'cover', 'banner', 'header image', 'غلاف']);
        try { fs.unlinkSync(coverPath); } catch (_) { /* ignore */ }
    }
    logToFile(`[StoreProfile] storefront images: ${JSON.stringify(result)}`);
    return result;
}

async function applyTeePublicStoreProfile(page, account, storeProfile = {}) {
    if (!storeProfile || typeof storeProfile !== 'object') {
        throw new Error('storeProfile missing');
    }
    const title = String(storeProfile?.title || storeProfile?.storeTitle || '').trim();
    if (!title) {
        throw new Error('storeProfile.title required for Artisan foundation');
    }

    let details = await applyTeePublicStoreDetailsV2(page, storeProfile, account);
    if (details?.authBounce || String(details?.url || '').includes('/users/sign_in')) {
        logToFile(`[StoreProfile] account/store invalid surface for ${account.email}; re-authenticating`, 'WARN');
        const relogged = await ensureTeePublicSession(page, account, true);
        if (relogged) {
            details = await applyTeePublicStoreDetailsV2(page, storeProfile, account);
        }
    }
    if (details?.authBounce || String(details?.url || '').includes('/users/sign_in')) {
        throw new Error('Auth');
    }
    let images = { avatar: false, cover: false };
    if (storeProfile.avatarDataUrl || storeProfile.coverDataUrl) {
        images = await applyTeePublicStoreImages(page, storeProfile);
    }

    return {
        success: true,
        title,
        details,
        images,
        appliedFields: {
            title: !!details?.title,
            bio: !!details?.bio,
            instagram: !!details?.instagram,
            twitter: !!details?.twitter,
            facebook: !!details?.facebook,
            pinterest: !!details?.pinterest,
            avatar: !!images?.avatar,
            cover: !!images?.cover,
        },
    };
}

async function inspectTeePublicQuickCreate(page) {
    return page.evaluate(() => {
        const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
        const lowerText = bodyText.toLowerCase();
        const currentUrl = window.location.href;
        const loginForm = !!document.querySelector('#user_email, #email, #user_password, #password');
        const loggedOutBanner = /must be logged in|you must be logged in|log(?:ged)? in to edit|sign in to edit/i.test(lowerText)
            || (/create account/i.test(lowerText) && /logged in/i.test(lowerText));
        return {
            url: currentUrl,
            title: document.title || '',
            uploadReady: !!document.querySelector('input[type="file"], input[type="file"][name], .file-upload input[type="file"]'),
            storeSetup: !!document.querySelector('#design_store_name, .jsStoreName, input[name*="store_name"], input[name="store[name]"], #store_name, input[name*="store"], input[placeholder*="Store Name" i]'),
            needsLogin: loginForm || loggedOutBanner,
            loggedOutBanner,
            publishFormReady: !!document.querySelector('input[name="title"], input[name="design[design_title]"], #design_title, #design_design_title'),
            homepageRedirect: /^https:\/\/www\.teepublic\.com\/?(?:\?.*)?$/.test(currentUrl),
            dailyLimitHint:
                lowerText.includes('daily limit') ||
                lowerText.includes('upload limit') ||
                lowerText.includes('come back tomorrow') ||
                lowerText.includes('try again tomorrow') ||
                lowerText.includes('maximum number of designs') ||
                lowerText.includes('too many designs') ||
                lowerText.includes('limit reached'),
            snippet: bodyText.slice(0, 220)
        };
    });
}

function isTeePublicEditUrl(url = '') {
    return /^https:\/\/www\.teepublic\.com\/designs\/\d+\/edit(?:\?.*)?$/i.test(String(url || '').trim());
}

function isRecoverableUploadNavigationError(error, browser = null) {
    const message = String(error?.message || '');
    const isTargetClosed = /target closed/i.test(message);
    if (isTargetClosed) {
        return !!(browser && browser.isConnected());
    }
    return /detached frame|frame.*detached|execution context was destroyed|cannot find context|node is detached|protocol error|runtime\.callfunctionon|promise was collected|navigating frame was detached/i.test(message);
}

async function getOrRecoverTeePublicPage(browser) {
    if (!browser || !browser.isConnected()) {
        throw new Error('Browser is disconnected');
    }
    
    const pages = await browser.pages().catch(() => []);
    let targetPage = null;
    
    // Find an existing page that is not closed and is on teepublic.com
    for (const p of pages) {
        try {
            if (p.isClosed()) continue;
            const url = p.url();
            if (url && (url.includes('teepublic.com') || url.includes('designs') || url.includes('quick_create'))) {
                targetPage = p;
                break;
            }
        } catch (_) {}
    }
    
    // If no teepublic.com page, find any open page that is not closed and not on a special system url
    if (!targetPage) {
        for (const p of pages) {
            try {
                if (p.isClosed()) continue;
                const url = p.url();
                if (url && !url.startsWith('chrome:') && url !== 'about:blank' && url !== '') {
                    targetPage = p;
                    break;
                }
            } catch (_) {}
        }
    }
    
    // Create new page if none exists
    if (!targetPage) {
        targetPage = await browser.newPage();
    }
    
    if (targetPage.isClosed()) {
        targetPage = await browser.newPage();
    }
    
    await targetPage.bringToFront().catch(() => {});
    return targetPage;
}

async function inspectTeePublicUploadSurface(page) {
    return page.evaluate(() => {
        const isVisible = (el) => {
            if (!el) return false;
            try {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 &&
                    rect.height > 0 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    style.opacity !== '0';
            } catch (_) {
                return false;
            }
        };

        const uploadInputSelectors = [
            'input[type="file"]',
            'input[type="file"][name]',
            '.file-upload input[type="file"]',
            '.m-dropzone input[type="file"]',
            '.upload-dropzone input[type="file"]',
            '.uploader input[type="file"]',
            '.jsUploaderFileInput',
            '.m-uploader__dropzone-input'
        ];
        const clickableSelectors = [
            '.m-uploader__dropzone-clickable',
            '.jsUploaderDropzone',
            '.m-uploader__dropzone',
            '.upload-dropzone',
            '.dropzone',
            '[data-upload-zone]',
            '.uploader',
            '.file-upload'
        ];
        const loadingSelectors = [
            '.m-uploader__loading-overlay',
            '.jsLoadingOverlay',
            '[class*="loading-overlay"]',
            '[class*="uploading"]'
        ];

        const uploadInput = document.querySelector(uploadInputSelectors.join(', '));
        const clickableTrigger = document.querySelector(clickableSelectors.join(', '));
        const loadingOverlay = Array.from(document.querySelectorAll(loadingSelectors.join(', '))).find(isVisible) || null;
        const titleField = document.querySelector('input[name="title"], input[name="design[design_title]"], #design_title, #design_design_title');
        const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();

        return {
            url: window.location.href,
            title: document.title || '',
            uploadReady: !!uploadInput,
            uploadInputVisible: isVisible(uploadInput),
            uploadInputHasFiles: !!(uploadInput && uploadInput.files && uploadInput.files.length > 0),
            dropzoneVisible: isVisible(clickableTrigger),
            loadingVisible: !!loadingOverlay,
            titleReady: !!titleField,
            titleVisible: isVisible(titleField),
            triggerLabel: clickableTrigger
                ? ((clickableTrigger.textContent || clickableTrigger.innerText || clickableTrigger.id || clickableTrigger.className || '').trim().slice(0, 120))
                : '',
            snippet: bodyText.slice(0, 260)
        };
    });
}

async function waitForTeePublicUploadObservation(page, timeoutMs, predicate) {
    const startedAt = Date.now();
    let lastSnapshot = null;

    while ((Date.now() - startedAt) < timeoutMs) {
        try {
            lastSnapshot = await inspectTeePublicUploadSurface(page);
        } catch (err) {
            // Tolerate all standard Puppeteer transient navigation/context errors
            // that occur when the page navigates (e.g. dropzone → design form).
            // These are NOT fatal here — the outer per-design retry loop will catch
            // them if recovery ultimately fails.
            if (/detached frame|frame.*detached|execution context was destroyed|cannot find context|node is detached|navigating frame was detached|promise was collected|protocol error|runtime\.callfunctionon/i.test(err?.message || '')) {
                await new Promise(r => setTimeout(r, 800));
                continue;
            }
            throw err;
        }

        if (lastSnapshot && predicate(lastSnapshot)) {
            return lastSnapshot;
        }

        await new Promise(r => setTimeout(r, 500));
    }

    return lastSnapshot;
}

async function clickTeePublicUploadTrigger(page, reason = 'upload', jobId = null) {
    const jobState = getActiveUploadJob(jobId);
    if (jobState && ['trigger_clicked', 'uploading', 'upload_committed', 'filling_form', 'awaiting_publish'].includes(jobState.status)) {
        return { clicked: false, reason: `job-${jobState.status}` };
    }

    const clickOutcome = await page.evaluate((clickReason) => {
        const isVisible = (el) => {
            if (!el) return false;
            try {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 &&
                    rect.height > 0 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    style.opacity !== '0';
            } catch (_) {
                return false;
            }
        };

        const loadingVisible = Array.from(document.querySelectorAll(
            '.m-uploader__loading-overlay, .jsLoadingOverlay, [class*="loading-overlay"], [class*="uploading"]'
        )).some(isVisible);
        const titleReady = !!document.querySelector('input[name="title"], input[name="design[design_title]"], #design_title, #design_design_title');
        if (loadingVisible || titleReady) {
            return { clicked: false, reason: 'upload-already-progressing' };
        }

        const clickCooldownMs = 30000;
        const now = Date.now();
        if (window.__nhpLastUploadTriggerClickAt && (now - window.__nhpLastUploadTriggerClickAt) < clickCooldownMs) {
            return { clicked: false, reason: 'cooldown-active' };
        }

        const selectors = [
            '.m-uploader__dropzone-clickable',
            '.jsUploaderDropzone',
            '.m-uploader__dropzone',
            '.upload-dropzone',
            '.dropzone',
            '[data-upload-zone]',
            '.uploader',
            '.file-upload',
            'label[for*="file"]'
        ];

        let chosenTrigger = null;
        for (const selector of selectors) {
            const candidate = Array.from(document.querySelectorAll(selector)).find(isVisible);
            if (candidate) {
                chosenTrigger = candidate;
                break;
            }
        }

        if (!chosenTrigger) {
            return { clicked: false, reason: 'trigger-not-found' };
        }

        window.__nhpLastUploadTriggerClickAt = now;
        window.__nhpLastUploadTriggerReason = clickReason;

        const rect = chosenTrigger.getBoundingClientRect();
        chosenTrigger.scrollIntoView({ block: 'center', inline: 'center' });
        try { chosenTrigger.focus?.(); } catch (_) { }
        try {
            chosenTrigger.click();
        } catch (_) {
            try {
                chosenTrigger.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                }));
            } catch (_) { }
        }

        return {
            clicked: true,
            reason: 'clicked',
            label: (chosenTrigger.textContent || chosenTrigger.innerText || chosenTrigger.id || chosenTrigger.className || '').trim().slice(0, 120),
            rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            }
        };
    }, reason);

    if (clickOutcome?.clicked) {
        updateActiveUploadJob(jobId, 'trigger_clicked', { reason, label: clickOutcome.label || '' });
    }

    return clickOutcome;
}

async function waitForTeePublicUploadCommit(page, reason = 'upload-commit') {
    const startState = await waitForTeePublicUploadObservation(
        page,
        20000,
        (state) => state.uploadInputHasFiles || state.loadingVisible || state.titleReady
    );

    logToFile(
        `[UploadCommit] start (${reason}) | hasFiles=${!!startState?.uploadInputHasFiles} | loading=${!!startState?.loadingVisible} | titleReady=${!!startState?.titleReady} | url=${startState?.url || 'n/a'}`
    );

    if (!startState || (!startState.uploadInputHasFiles && !startState.loadingVisible && !startState.titleReady)) {
        throw new Error(`Upload did not start after file attach (${reason})`);
    }

    const settledState = startState?.titleReady
        ? startState
        : await waitForTeePublicUploadObservation(
            page,
            120000,
            (state) => state.titleReady
        );

    logToFile(
        `[UploadCommit] settled (${reason}) | hasFiles=${!!settledState?.uploadInputHasFiles} | loading=${!!settledState?.loadingVisible} | titleReady=${!!settledState?.titleReady} | snippet=${settledState?.snippet || ''}`
    );

    if (!settledState || !settledState.titleReady) {
        throw new Error(`Upload did not settle into the publish form (${reason})`);
    }

    return settledState;
}

async function waitForQuickCreateSurface(page, timeoutMs = 25000) {
    return page.waitForFunction(() => {
        return !!document.querySelector(
            'input[type="file"], #design_store_name, .jsStoreName, input[name*="store_name"], #user_email, #email, input[name="title"], input[name="design[design_title]"], #design_title, #design_design_title'
        );
    }, { timeout: timeoutMs }).catch(() => null);
}

async function ensureQuickCreateReady(page, account, reason = 'unknown', jobId = null, supervisorCtx = null) {
    let lastState = null;
    let lastError = null;

    try {
        const currentState = await inspectTeePublicQuickCreate(page);
        const currentUrl = currentState?.url || page.url();
        const isEditUrl = isTeePublicEditUrl(currentUrl);
        const currentSurfaceReady =
            !!currentState &&
            (currentState.uploadReady || currentState.publishFormReady || isEditUrl || currentState.storeSetup || currentState.needsLogin || currentState.loggedOutBanner);
        if (currentSurfaceReady) {
            logToFile(
                `[QuickCreate] reusing current surface (${reason}) | url=${currentState.url} | uploadReady=${currentState.uploadReady} | storeSetup=${currentState.storeSetup} | needsLogin=${currentState.needsLogin} | loggedOutBanner=${currentState.loggedOutBanner} | publishFormReady=${currentState.publishFormReady} | isEditUrl=${isEditUrl}`
            );
            if (currentState.needsLogin || currentState.loggedOutBanner) {
                // Upload path: never visit /account/store — basic session + quick_create is enough
                const relogged = await ensureTeePublicSession(page, account, true, {
                    requireAccountStoreAccess: false
                });
                if (!relogged) throw new Error('Auth');
            }

            if (currentState.storeSetup && !currentState.uploadReady && !currentState.publishFormReady && !isEditUrl) {
                await maybeCompleteTeePublicStoreSetup(page, account?.storeProfile || null, supervisorCtx);
            }

            return;
        }
    } catch (err) {
        logToFile(`[QuickCreate] current surface inspection warning (${reason}): ${err.message}`, 'WARN');
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
        let navError = null;
        const activeJob = getActiveUploadJob(jobId);
        const shouldSkipGoto = !!(
            activeJob &&
            ['trigger_clicked', 'uploading', 'upload_committed', 'filling_form', 'awaiting_publish'].includes(activeJob.status)
        );

        try {
            if (shouldSkipGoto) {
                logToFile(`[QuickCreate] skipping goto on attempt ${attempt} (${reason}) because job ${jobId} is ${activeJob.status}`);
            } else {
                await page.goto(TEEPUBLIC_QUICK_CREATE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
            }
        } catch (err) {
            navError = err;
            lastError = err;
            logToFile(`[QuickCreate] navigation warning on attempt ${attempt} (${reason}): ${err.message}`, 'WARN');
        }

        try {
            await waitForQuickCreateSurface(page, attempt === 1 ? 20000 : 30000);
            await new Promise(r => setTimeout(r, 1500));
            lastState = await inspectTeePublicQuickCreate(page);
        } catch (err) {
            lastError = err;
            logToFile(`[QuickCreate] frame warning on attempt ${attempt} (${reason}): ${err.message}`, 'WARN');
            if (/detached frame|frame.*detached/i.test(err.message || '')) {
                await new Promise(r => setTimeout(r, 2500));
                continue;
            }
            throw err;
        }

        logToFile(
            `[QuickCreate] attempt ${attempt} (${reason}) | url=${lastState.url} | uploadReady=${lastState.uploadReady} | storeSetup=${lastState.storeSetup} | needsLogin=${lastState.needsLogin} | publishFormReady=${lastState.publishFormReady} | snippet=${lastState.snippet}`
        );

        if (lastState.uploadReady || lastState.publishFormReady || isTeePublicEditUrl(lastState.url)) return;

        if (lastState.loggedOutBanner && !lastState.needsLogin) {
            logToFile(`[QuickCreate] logged-out banner detected (${reason}) — forcing re-auth | snippet=${lastState.snippet}`, 'WARN');
            lastState.needsLogin = true;
        }

        if (lastState.needsLogin) {
            // Upload path: never visit /account/store during re-auth
            const relogged = await ensureTeePublicSession(page, account, true, {
                requireAccountStoreAccess: false
            });
            if (!relogged) throw new Error('Auth');
            await new Promise(r => setTimeout(r, 1500));
            continue;
        }

        if (lastState.storeSetup) {
            await maybeCompleteTeePublicStoreSetup(page, account?.storeProfile || null, supervisorCtx);
            continue;
        }

        const blockedByHomepageRedirect =
            lastState.homepageRedirect &&
            !lastState.uploadReady &&
            !lastState.publishFormReady &&
            !lastState.needsLogin &&
            !lastState.storeSetup;

        if (lastState.dailyLimitHint || (attempt >= 2 && blockedByHomepageRedirect)) {
            throw new Error(`TEEPUBLIC_DAILY_LIMIT_REACHED | url=${lastState.url} | title=${lastState.title} | snippet=${lastState.snippet}`);
        }

        if (!navError || /ERR_ABORTED/i.test(navError.message || '')) {
            await new Promise(r => setTimeout(r, 2500));
            continue;
        }
    }

    const finalBits = [];
    if (lastState?.url) finalBits.push(`url=${lastState.url}`);
    if (lastState?.title) finalBits.push(`title=${lastState.title}`);
    if (lastState?.snippet) finalBits.push(`snippet=${lastState.snippet}`);
    if (lastError?.message) finalBits.push(`lastError=${lastError.message}`);
    throw new Error(`quick_create not ready after retries | ${finalBits.join(' | ')}`);
}

async function acquireTeePublicUploadInput(page, account, reason = 'upload', jobId = null) {
    const uploadSelectors = [
        'input[type="file"]',
        'input[type="file"][name]',
        '.file-upload input[type="file"]',
        '.m-dropzone input[type="file"]',
        '.upload-dropzone input[type="file"]',
        '.uploader input[type="file"]',
        '.jsUploaderFileInput',
        '.m-uploader__dropzone-input'
    ];
    const uploadSelectorText = uploadSelectors.join(', ');
    let lastSnapshot = null;
    let nodeClickCooldown = 0;

    for (let attempt = 1; attempt <= 3; attempt++) {
        if (nodeClickCooldown && (Date.now() - nodeClickCooldown) < 15000) {
            await new Promise(r => setTimeout(r, 4000));
        }

        await ensureQuickCreateReady(page, account, `${reason}-ready-${attempt}`, jobId);

        const inputHandle = await page.waitForSelector(uploadSelectorText, {
            timeout: attempt === 1 ? 15000 : 30000
        }).catch(() => null);
        if (inputHandle) {
            logToFile(`[UploadInput] ready on attempt ${attempt} (${reason})`);
            return inputHandle;
        }

        lastSnapshot = await inspectTeePublicUploadSurface(page);

        const passiveObservation = await waitForTeePublicUploadObservation(
            page,
            attempt === 1 ? 5000 : 9000,
            (state) => state.uploadReady || state.loadingVisible || state.titleReady || state.dropzoneVisible
        );
        if (passiveObservation) {
            lastSnapshot = passiveObservation;
        }

        if (lastSnapshot?.uploadReady) {
            const delayedHandle = await page.waitForSelector(uploadSelectorText, { timeout: 4000 }).catch(() => null);
            if (delayedHandle) {
                logToFile(`[UploadInput] appeared during passive observation on attempt ${attempt} (${reason})`);
                return delayedHandle;
            }
        }

        if (lastSnapshot?.loadingVisible || lastSnapshot?.titleReady) {
            logToFile(
                `[UploadInput] upload surface already transitioning on attempt ${attempt} (${reason}) | loading=${lastSnapshot.loadingVisible} | titleReady=${lastSnapshot.titleReady}`,
                'WARN'
            );
            const settledDuringObservation = await waitForTeePublicUploadObservation(
                page,
                12000,
                (state) => state.uploadReady || state.titleReady
            );
            if (settledDuringObservation) {
                lastSnapshot = settledDuringObservation;
            }
            if (lastSnapshot?.uploadReady) {
                const settledHandle = await page.waitForSelector(uploadSelectorText, { timeout: 4000 }).catch(() => null);
                if (settledHandle) return settledHandle;
            }
        }

        const now = Date.now();
        if (nodeClickCooldown && (now - nodeClickCooldown) < 40000) {
            logToFile(`[UploadInput] Skipping trigger click due to Node-side cooldown on attempt ${attempt} (${reason})`, 'WARN');
            await new Promise(r => setTimeout(r, 6000));
            continue;
        }

        if (isTeePublicEditUrl(page.url())) {
            logToFile(`[UploadInput] Already on edit URL, skipping dropzone click on attempt ${attempt}`);
            await new Promise(r => setTimeout(r, 3000));
            continue;
        }

        nodeClickCooldown = now;
        const clickOutcome = await clickTeePublicUploadTrigger(page, `${reason}-attempt-${attempt}`, jobId);
        const clickedLabel = clickOutcome?.label || lastSnapshot?.triggerLabel || '';

        logToFile(
            `[UploadInput] attempt ${attempt} (${reason}) | url=${lastSnapshot?.url || 'n/a'} | clicked=${!!clickOutcome?.clicked} | clickReason=${clickOutcome?.reason || 'none'} | triggerLabel=${clickedLabel}`,
            'WARN'
        );

        try {
            await Promise.race([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
                new Promise(r => setTimeout(r, 8000))
            ]);
        } catch (e) { }

        const postClickState = await waitForTeePublicUploadObservation(
            page,
            clickOutcome?.clicked ? 8000 : 5000,
            (state) => state.uploadReady || state.loadingVisible || state.titleReady
        );
        if (postClickState) {
            lastSnapshot = postClickState;

            const postClickHandle = await page.waitForSelector(uploadSelectorText, { timeout: 6000 }).catch(() => null);
            if (postClickHandle) {
                logToFile(`[UploadInput] became available after monitored trigger handling on attempt ${attempt} (${reason})`);
                return postClickHandle;
            }
        }

        await new Promise(r => setTimeout(r, 2500));
    }

    const finalBits = [];
    if (lastSnapshot?.url) finalBits.push(`url=${lastSnapshot.url}`);
    if (lastSnapshot?.title) finalBits.push(`title=${lastSnapshot.title}`);
    if (lastSnapshot?.snippet) finalBits.push(`snippet=${lastSnapshot.snippet}`);
    throw new Error(`Upload input not available after retries | ${finalBits.join(' | ')}`);
}

    app.post('/browse-account', async (req, res) => {
        try {
            const { email, pass, autoLogin = true, targetUrl } = req.body || {};
            if (!email) return res.status(400).json({ success: false, error: 'Email' });

            const userProfileDir = getProfileDirForEmail(email);
            logToFile(`🌐 Opening dedicated manual session for: ${email}`);

            const browserLaunch = await profileLock.withProfileBrowserMutex(email, ROOT_DIR, async () => launchBrowserWithFallback({
                launchOptions: {
                    executablePath: getChromePath() || undefined,
                    headless: false,
                    userDataDir: userProfileDir,
                    ignoreDefaultArgs: GHOST_IGNORE_DEFAULT_ARGS,
                    args: buildGhostChromeLaunchArgs(false)
                },
                debugSeed: `${email}_upload`,
                targetUrl: 'about:blank',
                fallbackArgs: buildGhostChromeLaunchArgs(false),
                fallbackHeadless: false,
                profileEmail: email,
            }));
            const browser = browserLaunch.browser;
            logToFile(`[BrowseBrowser] mode=${browserLaunch.mode}${browserLaunch.port ? ` port=${browserLaunch.port}` : ''}`);

            const page = await createGhostPage(browser, email);
            page.on('console', m => logToFile(`[BROWSE] ${m.text()}`));

            const loggedIn = await ensureTeePublicSession(page, { email, pass }, autoLogin);
            if (!loggedIn && autoLogin) {
                logToFile(`❌ Manual session login failed for ${email}`, 'ERROR');
                return res.status(401).json({ success: false, error: 'Auth' });
            }

            await page.goto(targetUrl || 'https://www.teepublic.com/design/quick_create', {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            }).catch(() => { });

            browser.on('disconnected', () => {
                logToFile(`🔒 Manual session closed for: ${email}`);
            });

            res.json({ success: true, opened: true });
        } catch (err) {
            logToFile(`❌ Browse Account Error: ${err.message}`, 'ERROR');

            const fallbackTargetUrl = req.body?.targetUrl || 'https://www.teepublic.com/design/quick_create';
            const fallbackProfileDir = getProfileDirForEmail(req.body?.email || 'manual_browser');

            if (/spawn|EPERM|Failed to launch/i.test(String(err.message || ''))) {
                try {
                    await openChromeWindowFallback({
                        userDataDir: fallbackProfileDir,
                        targetUrl: fallbackTargetUrl
                    });
                    logToFile(`⚠️ Fallback Chrome open used for: ${req.body?.email || 'manual_browser'}`, 'WARN');
                    return res.json({ success: true, opened: true, fallbackMode: 'powershell_chrome' });
                } catch (fallbackErr) {
                    logToFile(`❌ Fallback Chrome open failed: ${fallbackErr.message}`, 'ERROR');
                    return res.status(500).json({ success: false, error: fallbackErr.message });
                }
            }

            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/apply-store-profile', async (req, res) => {
        let browser;
        let browserLaunchMode = 'puppeteer_launch';
        let keepAlive = req.body?.keepAlive === true;
        const profileEmail = String(req.body?.account?.email || '').trim();
        try {
            const { account, storeProfile, isVisual } = req.body || {};
            if (!account?.email) return res.status(400).json({ success: false, error: 'Email' });
            if (!storeProfile?.title && !storeProfile?.storeTitle) {
                return res.status(400).json({ success: false, error: 'storeProfile.title required' });
            }

            await profileLock.withProfileBrowserMutex(account.email, ROOT_DIR, async () => {
                const userProfileDir = getProfileDirForEmail(account.email);
                const headless = resolveGhostHeadless(isVisual);
                const puppeteerArgs = buildGhostChromeLaunchArgs(headless);
                const browserLaunch = await launchBrowserWithFallback({
                    launchOptions: {
                        executablePath: getChromePath() || undefined,
	                        headless,
	                        userDataDir: userProfileDir,
	                        ignoreDefaultArgs: GHOST_IGNORE_DEFAULT_ARGS,
	                        protocolTimeout: 300000,
	                        args: puppeteerArgs,
                        defaultViewport: headless ? { width: 1280, height: 1050 } : null,
                    },
                    debugSeed: `${account.email}_store_profile`,
                    targetUrl: 'about:blank',
                    fallbackArgs: puppeteerArgs,
                    fallbackHeadless: !!headless,
                    profileEmail: account.email,
                });
                browser = browserLaunch.browser;
                browserLaunchMode = browserLaunch.mode;
                const page = await createGhostPage(browser, account.email);
                page.on('console', (m) => logToFile(`[STORE_PROFILE] ${m.text()}`));

                const loggedIn = await ensureTeePublicSession(page, account, true);
                if (!loggedIn) {
                    if (isVisual) keepAlive = true;
                    const authDebug = {
                        success: false,
                        error: 'Auth',
                        keptOpen: keepAlive,
                        url: page.url(),
                    };
                    logToFile(`⚠️ apply-store-profile auth check failed for ${account.email} | keepAlive=${keepAlive} | url=${page.url()}`, 'WARN');
                    res.status(401).json(authDebug);
                    return;
                }

                const result = await applyTeePublicStoreProfile(page, account, storeProfile);
                logToFile(`✅ Store profile applied for ${account.email}: ${result.title}`);
                res.json(result);
            });
        } catch (err) {
            logToFile(`❌ apply-store-profile error: ${err.message}`, 'ERROR');
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: err.message });
            }
        } finally {
            if (browser && !keepAlive) {
                await gracefulCloseGhostBrowser(browser, browserLaunchMode, logToFile);
                if (profileEmail) {
                    await releaseProfileLockForEmail(profileEmail).catch((releaseErr) => {
                        logToFile(`Profile lock release after apply-store-profile: ${releaseErr.message}`, 'WARN');
                    });
                }
            }
        }
    });

app.post('/internal/seq-guard/unlock', async (req, res) => {
    try {
        const result = await seqUploadGuard.unlock(req.body?.key);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/internal/seq-guard/lock', async (req, res) => {
    try {
        const result = await seqUploadGuard.lock();
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/internal/seq-guard/status', async (req, res) => {
    try {
        const unlocked = await seqUploadGuard.readUnlockState();
        res.json({ success: true, unlocked, ttlMs: seqUploadGuard.UNLOCK_TTL_MS });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/upload', async (req, res) => {
    let browser;
    let browserLaunchMode = 'puppeteer_launch';
    let keepAlive = false;
    let currentJobId = null;
    let responsePayload = { statusCode: 200, body: { success: true } };
    const uploadEmail = String(req.body?.account?.email || '').trim();
    if (!uploadEmail) return res.status(400).json({ success: false, error: 'Email' });

    try {
        await withGlobalUploadMutex(async () => profileLock.withProfileBrowserMutex(uploadEmail, ROOT_DIR, async () => {
        try {
            const { account, designs, actionType, defaultColor, isVisual, foundationEntry, storeProfile: bodyStoreProfile, keepAlive: requestedKeepAlive, applyStoreProfileAfterPublish } = req.body;
            if (requestedKeepAlive) keepAlive = true;
            const storeProfile = bodyStoreProfile || account?.storeProfile || null;
            if (!account?.email) {
                responsePayload = { statusCode: 400, body: { success: false, error: 'Email' } };
                return;
            }

            const userProfileDir = getProfileDirForEmail(account.email);

            logToFile(`🚀 [v31.1] Supreme DNA Synergy for: ${account.email}`);

            const headless = resolveGhostHeadless(isVisual);
            const puppeteerArgs = buildGhostChromeLaunchArgs(headless);
            let proxyUser, proxyPass;
            let requireWifiRotate = false;
            if (account.proxy) {
                const proxyStr = String(account.proxy).trim();
                if (proxyStr.toUpperCase() === 'WIFI') {
                    requireWifiRotate = true;
                } else {
                    const parts = proxyStr.split(':');
                    if (parts.length >= 2) puppeteerArgs.push(`--proxy-server=${parts[0]}:${parts[1]}`);
                    if (parts.length === 4) { proxyUser = parts[2]; proxyPass = parts[3]; }
                }
            }

            const browserLaunch = await launchBrowserWithFallback({
                launchOptions: {
                    executablePath: getChromePath() || undefined,
                    headless,
                    userDataDir: userProfileDir,
                    ignoreDefaultArgs: GHOST_IGNORE_DEFAULT_ARGS,
                    protocolTimeout: 300000,
                    args: puppeteerArgs,
                    defaultViewport: headless ? { width: 1280, height: 1050 } : null,
                },
                debugSeed: `${account.email}_upload`,
                targetUrl: 'about:blank',
                fallbackArgs: puppeteerArgs,
                fallbackHeadless: !!headless,
                profileEmail: account.email,
            });
            browser = browserLaunch.browser;
            browserLaunchMode = browserLaunch.mode;
            logToFile(`[UploadBrowser] mode=${browserLaunch.mode}${browserLaunch.port ? ` port=${browserLaunch.port}` : ''}`);

            let page = await createGhostPage(browser, account.email);
            if (proxyUser && proxyPass) await page.authenticate({ username: proxyUser, password: proxyPass });
            page.on('console', m => logToFile(`[INTERNAL] ${m.text()}`));
            let pendingBagsPrimaryAlert = false;
            page.on('dialog', async (dialog) => {
                const msg = String(dialog.message() || '');
                logToFile(`[DIALOG] ${msg.slice(0, 240)}`);
                if (/primary\s*color\s*for\s*bags/i.test(msg) || /choose\s+a\s+primary\s+color.*bag/i.test(msg)) {
                    pendingBagsPrimaryAlert = true;
                    logToFile('[DIALOG] Bags primary-color alert captured — will auto-correct after dismiss');
                }
                try { await dialog.accept(); } catch (_) { try { await dialog.dismiss(); } catch (__) {} }
            });
            let lastObservedPageFingerprint = '';
            const logObservedPageState = async (reason) => {
                try {
                    const url = page.url();
                    const title = await page.title().catch(() => '');
                    const fingerprint = `${reason}|${url}|${title}`;
                    if (fingerprint === lastObservedPageFingerprint) return;
                    lastObservedPageFingerprint = fingerprint;
                    logToFile(`[OBSERVE] ${reason} | url=${url} | title=${title}`);
                } catch (err) {
                    logToFile(`[OBSERVE] ${reason} | failed=${err.message}`, 'WARN');
                }
            };
            page.on('framenavigated', (frame) => {
                if (frame === page.mainFrame()) {
                    logToFile(`[OBSERVE] framenavigated | url=${frame.url()}`);
                }
            });
            page.on('domcontentloaded', () => {
                logObservedPageState('domcontentloaded').catch(() => { });
            });
            page.on('load', () => {
                logObservedPageState('load').catch(() => { });
            });

            if (requireWifiRotate) {
                await page.goto('about:blank');
                await rotateWifiIp();
            }

            const failAuth = () => {
                logToFile('Authentication Failed.');
                if (isVisual || requestedKeepAlive) keepAlive = true;
                responsePayload = {
                    statusCode: 401,
                    body: {
                        success: false,
                        error: 'Auth',
                        message: 'TeePublic login required — session cookies missing or password invalid'
                    }
                };
            };

            // --- Phase 1: Authentication Guard ---
            // Upload path: do NOT navigate to /account/store for session verification
            const loggedIn = await ensureTeePublicSession(page, account, true, {
                requireAccountStoreAccess: false,
            });
            if (!loggedIn) { failAuth(); return; }

            const supervisorCtx = {
                email: account.email,
                phase: foundationEntry === true ? 'foundation' : 'upload',
                req,
            };

            // --- Phase 2: Foundation (Sell Your Art) or Quick Create ---
            if (foundationEntry === true) {
                logToFile(`[Foundation] Login → Sell Your Art → store name → design 1 for ${account.email}`);
                await navigateTeePublicFoundationEntry(page, storeProfile, supervisorCtx);
                await logObservedPageState('after-foundation-entry');
            } else {
                await page.goto('https://www.teepublic.com/design/quick_create', { waitUntil: 'domcontentloaded', timeout: 60000 });
                await logObservedPageState('after-initial-quick-create');
                const storeFlag = await page.evaluate((sel) => !!document.querySelector(sel), STORE_SETUP_SELECTORS);
                if (storeFlag) {
                    logToFile(`Store setup on quick_create — using store profile title`);
                    await maybeCompleteTeePublicStoreSetup(page, storeProfile, supervisorCtx);
                }
            }

            // Final Sync
            const initialSurface = await inspectTeePublicQuickCreate(page).catch(() => null);
            if (!initialSurface || (!initialSurface.uploadReady && !initialSurface.publishFormReady && !isTeePublicEditUrl(initialSurface.url || page.url()))) {
                if (!page.url().includes('quick_create')) await page.goto('https://www.teepublic.com/design/quick_create', { waitUntil: 'networkidle2' });
            }
            await ensureQuickCreateReady(page, account, 'initial-setup', null, supervisorCtx);

            // --- Phase 3: Supreme SEO DNA (Direct Graft) ---
            const designList = Array.isArray(designs) ? designs : [];
            if (!designList.length) {
                throw new Error('No designs payload for upload — refusing empty account session');
            }
            const results = [];
            try {
                for (let i = 0; i < designList.length; i++) {
                    const des = designList[i]; const m = des.meta || {};
                    const jobId = buildServerUploadJobId(account, des, i);
                    currentJobId = jobId;
                    updateActiveUploadJob(jobId, 'preparing', { title: m.title || '', index: i + 1 });
                    
                    let publishResult = { status: 'failed', error: '' };
                    let tP = '';
                    let urlBeforeUpload = '';
                    let urlAfterPublish = '';
                    let finalAttemptNumber = 1;
                    
                    try {
                        const rawBase64 = String(des.base64 || '').trim();
                        const cleanBase64 = rawBase64.replace(/^data:image\/\w+;base64,/, '');
                        const mimeType = des.file?.type || (rawBase64.startsWith('data:') ? (rawBase64.match(/^data:(image\/[^;]+);/i) || [])[1] : '') || 'image/png';
                        const extension = mimeType === 'image/jpeg' ? 'jpg' : ((mimeType.split('/')[1] || 'png').replace('+xml', ''));
                        if (!cleanBase64) {
                            throw new Error(`Missing image payload`);
                        }
                        const imageBuffer = Buffer.from(cleanBase64, 'base64');
                        if (!imageBuffer.length) {
                            throw new Error(`Empty image buffer`);
                        }
                        tP = path.join(TEMP_DIR, `up_${Date.now()}_${i}.${extension}`);
                        ensureTempUploadDir();
                        fs.writeFileSync(tP, imageBuffer);

                        // Safe recovery / verification before design upload
                        if (!browser || !browser.isConnected()) {
                            throw new Error('Browser is not connected');
                        }
                        page = await getOrRecoverTeePublicPage(browser);
                        
                        const currentUrl = page.url();
                        const isInvalidUrl = !currentUrl || currentUrl.startsWith('chrome:') || currentUrl === 'about:blank' || currentUrl === '';
                        const isUploadOrEdit = currentUrl.includes('quick_create') || isTeePublicEditUrl(currentUrl);
                        
                        if (isInvalidUrl || !isUploadOrEdit) {
                            logToFile(`[PageRecovery] Pre-upload navigation to quick_create. Current URL: ${currentUrl}`);
                            await page.goto('https://www.teepublic.com/design/quick_create', { waitUntil: 'domcontentloaded', timeout: 90000 });
                        }
                        
                        urlBeforeUpload = page.url();

                        // 2 attempts per design for recoverable navigation/frame/page-state errors
                        const maxAttempts = 2;
                        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                            finalAttemptNumber = attempt;
                            try {
                                logToFile(`📦 Design [${i + 1}/${designList.length}] | Email: ${account.email} | Attempt: ${attempt}/${maxAttempts} | URL Before: ${urlBeforeUpload}`);
                                
                                const currentUploadSurface = await inspectTeePublicQuickCreate(page).catch(() => null);
                                const canReuseCurrentPageForFirstDesign =
                                    i === 0 &&
                                    currentUploadSurface &&
                                    (currentUploadSurface.uploadReady || currentUploadSurface.publishFormReady) &&
                                    isTeePublicEditUrl(currentUploadSurface.url || page.url());

                                if (!canReuseCurrentPageForFirstDesign && !page.url().includes('quick_create')) {
                                    await page.goto('https://www.teepublic.com/design/quick_create', { waitUntil: 'domcontentloaded', timeout: 90000 });
                                }

                                const inp = await acquireTeePublicUploadInput(page, account, `design-${i + 1}`, jobId);
                                let uploadTransitionError = null;
                                try {
                                    updateActiveUploadJob(jobId, 'uploading', { title: m.title || '', index: i + 1 });
                                    await inp.uploadFile(tP);
                                    await logObservedPageState(`after-uploadFile-design-${i + 1}`);
                                } catch (err) {
                                    if (!isRecoverableUploadNavigationError(err, browser)) {
                                        throw err;
                                    }
                                    uploadTransitionError = err;
                                    logToFile(`[UploadInput] uploadFile navigation race tolerated for design-${i + 1}: ${err.message}`, 'WARN');
                                }
                                await waitForTeePublicUploadCommit(page, `design-${i + 1}`);
                                updateActiveUploadJob(jobId, 'upload_committed', { title: m.title || '', index: i + 1 });
                                await logObservedPageState(`after-upload-commit-design-${i + 1}`);
                                if (uploadTransitionError) {
                                    logToFile(`[UploadInput] upload commit confirmed after navigation race for design-${i + 1}`, 'INFO');
                                }
                                await new Promise(r => setTimeout(r, 2500));

                                logToFile(`🧬 GRAFTING SUPREME SEO DNA LOGIC...`);
                                updateActiveUploadJob(jobId, 'filling_form', { title: m.title || '', index: i + 1 });
                                const fillRes = await page.evaluate(async (data) => {
                                    const delay = ms => new Promise(res => setTimeout(res, ms));
                                    const log = m => console.log(`[SUPREME_DNA] ${m}`);

                                    async function waitForSelectorDNA(selector, timeout = 120000) {
                                        const el = document.querySelector(selector);
                                        if (el && (el.offsetWidth > 0 || el.offsetHeight > 0)) return el;
                                        return new Promise((resolve) => {
                                            const observer = new MutationObserver(() => {
                                                const el = document.querySelector(selector);
                                                if (el && (el.offsetWidth > 0 || el.offsetHeight > 0)) { observer.disconnect(); resolve(el); }
                                            });
                                            observer.observe(document.body, { childList: true, subtree: true });
                                            setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
                                        });
                                    }

                                    function forceValueDNA(selector, value) {
                                        const el = document.querySelector(selector);
                                        if (!el) return false;
                                        el.focus(); el.value = value;
                                        el.dispatchEvent(new Event('input', { bubbles: true }));
                                        el.dispatchEvent(new Event('change', { bubbles: true }));
                                        el.blur(); return true;
                                    }

                                    try {
                                        log("Waiting for form appearance (Milestone 1)...");
                                        const titleF = await waitForSelectorDNA('input[name="title"], input[name="design[design_title]"], #design_title, #design_design_title', 240000);
                                        if (!titleF) return { status: 'timeout' };

                                        log("Filling Metadata...");
                                        forceValueDNA('input[name="title"], input[name="design[design_title]"], #design_title, #design_design_title', data.title); await delay(500);
                                        forceValueDNA('textarea[name="description"], textarea[name="design[design_description]"], #design_description, #design_design_description', data.description || ""); await delay(500);
                                        let finalMainTag = data.main_tag || "";
                                        if (finalMainTag.length > 38) finalMainTag = finalMainTag.substring(0, 38).trim();
                                        forceValueDNA('input[name="primary_tag"], input[name="design[primary_tag]"], #design_primary_tag, #primary_tag', finalMainTag); await delay(500);

                                        const tagsIn = document.querySelector('.taggle_input, #design_tags, #design_tag_list, input[name="tags"], input[name="design[tag_list]"]');
                                        if (tagsIn) {
                                            tagsIn.focus(); tagsIn.value = '';
                                            const tsS = Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || "");
                                            if (tsS) {
                                                tagsIn.value = tsS;
                                                tagsIn.dispatchEvent(new Event('input', { bubbles: true }));
                                                tagsIn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                                            }
                                            tagsIn.blur();
                                        }
                                        await delay(1000);

                                        log("Setting Content Options...");
                                        const mn = document.getElementById('design_content_flag_false') || document.querySelector('input[name*="mature"][value="false"]');
                                        if (mn && !mn.checked) mn.click();
                                        const ts = document.getElementById('terms') || document.querySelector('input[name*="tos"]');
                                        if (ts && !ts.checked) ts.click();
                                        await delay(500);

                                        log("Waiting for Submit Buttons...");
                                        const submitSels = [
                                            'button.publish-and-promote-button',
                                            'button[value="publish" i]',
                                            'input[type="submit"][value*="Publish" i]',
                                            'input[type="submit"][value*="Save" i]',
                                            '.save-design-btn',
                                            '#publish-btn',
                                            'button[name="commit"]',
                                            'button[name="commit"][value="publish"]',
                                            'form.edit_design input[type="submit"]',
                                            'form.new_design input[type="submit"]'
                                        ];
                                        let submitReady = false;
                                        for (let n = 0; n < 120; n++) {
                                            if (submitSels.some(s => {
                                                const el = document.querySelector(s);
                                                return el && (el.offsetWidth > 0 || el.offsetHeight > 0);
                                            })) {
                                                submitReady = true;
                                                break;
                                            }
                                            await delay(1000);
                                        }

                                        log("Waiting for color controls...");
                                        const colorReadySelectors = [
                                            '.m-uploader-product',
                                            '.m-uploader-product .swatch',
                                            '.color-swatch',
                                            '.color-spot',
                                            '.dd-select',
                                            '.dd-option',
                                            '.m-uploader-product select',
                                            'select.js-uploader-color-select',
                                            'select[name*="color"]',
                                            'input[name="design[default_color]"]'
                                        ];
                                        let colorControlsReady = false;
                                        for (let n = 0; n < 90; n++) {
                                            if (colorReadySelectors.some((sel) => {
                                                const els = Array.from(document.querySelectorAll(sel));
                                                return els.some((el) => el && (el.offsetWidth > 0 || el.offsetHeight > 0));
                                            })) {
                                                colorControlsReady = true;
                                                break;
                                            }
                                            await delay(1000);
                                        }

                                        log("Setting Default Color (auto-correct candidates)...");
                                        const preferredColor = String(data.defaultColor || 'Black');
                                        const colorCandidates = Array.from(new Set([
                                            preferredColor,
                                            ...(Array.isArray(data.colorFallbacks) ? data.colorFallbacks : ['Black', 'White', 'Navy', 'Red'])
                                        ].map((c) => String(c || '').trim()).filter(Boolean)));
                                        const hexByName = {
                                            black: '#000000',
                                            white: '#ffffff',
                                            navy: '#001f3f',
                                            red: '#c41e3a'
                                        };

                                        function colorAppliedFor(colorName) {
                                            const tCol = String(colorName || '').toLowerCase();
                                            const fallbackBg = hexByName[tCol] || (tCol === 'white' ? '#ffffff' : '#000000');
                                            const selects = Array.from(document.querySelectorAll('.m-uploader-product select, select.js-uploader-color-select, select[name*="color"]'));
                                            if (selects.some((sel) => {
                                                const opt = sel.options?.[sel.selectedIndex];
                                                return String(opt?.textContent || opt?.value || sel.value || '').toLowerCase().includes(tCol);
                                            })) return true;

                                            const checkedRadios = Array.from(document.querySelectorAll('.m-uploader-product input[type="radio"]:checked, input[type="radio"][name*="color"]:checked'));
                                            if (checkedRadios.some((radio) => {
                                                const label = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : radio.closest('label');
                                                return `${radio.value || ''} ${label?.textContent || ''} ${label?.title || ''}`.toLowerCase().includes(tCol);
                                            })) return true;

                                            const hiddenValues = Array.from(document.querySelectorAll('.m-uploader-product input[type="hidden"][name*="color"], input.hex-input, input[name="design[default_color]"]'))
                                                .map((input) => String(input.value || '').toLowerCase());
                                            if (hiddenValues.some((value) => value.includes(tCol) || value === fallbackBg)) return true;

                                            const selectedLike = Array.from(document.querySelectorAll('.selected, .active, [aria-checked="true"], [aria-selected="true"]'));
                                            return selectedLike.some((el) => `${el.textContent || ''} ${el.title || ''} ${el.getAttribute('data-color') || ''}`.toLowerCase().includes(tCol));
                                        }

                                        async function applyColorCandidate(colorName) {
                                            const tCol = String(colorName || '').toLowerCase();
                                            const fallbackBg = hexByName[tCol] || (tCol === 'white' ? '#ffffff' : '#000000');
                                            log(`Applying color candidate: ${colorName}`);

                                            for (const dd of document.querySelectorAll('.dd-select')) {
                                                try {
                                                    dd.click();
                                                    await delay(400);
                                                    const b = dd.closest('.dd-container') || dd.parentElement;
                                                    const opt = Array.from(b.querySelectorAll('.dd-option')).find(o => o.textContent.toLowerCase().includes(tCol));
                                                    if (opt) {
                                                        opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                                                        opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                                                        opt.click();
                                                        await delay(300);
                                                    }
                                                } catch (e) { }
                                            }

                                            const nativeDropdowns = document.querySelectorAll('.m-uploader-product select, select.js-uploader-color-select, select[name*="color"]');
                                            nativeDropdowns.forEach(dropdown => {
                                                try {
                                                    const options = Array.from(dropdown.options || []);
                                                    const targetOption = options.find(opt => opt.textContent.toLowerCase().includes(tCol))
                                                        || options.find(opt => String(opt.value || '').toLowerCase().includes(tCol))
                                                        || options[1]
                                                        || options[0];
                                                    if (targetOption && dropdown.value !== targetOption.value) {
                                                        dropdown.value = targetOption.value;
                                                        dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                                                        dropdown.dispatchEvent(new Event('input', { bubbles: true }));
                                                    }
                                                } catch (e) { }
                                            });

                                            const hexInputs = document.querySelectorAll('.m-uploader-product input[type="hidden"][name*="color"], input.hex-input, input[name="design[default_color]"]');
                                            hexInputs.forEach(input => {
                                                input.value = fallbackBg;
                                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                            });

                                            const radioInputs = document.querySelectorAll('.m-uploader-product input[type="radio"], input[type="radio"][name*="color"]');
                                            radioInputs.forEach((radio) => {
                                                try {
                                                    const label = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : radio.closest('label');
                                                    const labelText = (label?.textContent || label?.getAttribute('title') || '').toLowerCase();
                                                    const radioValue = String(radio.value || '').toLowerCase();
                                                    if (labelText.includes(tCol) || radioValue.includes(tCol)) {
                                                        radio.checked = true;
                                                        radio.dispatchEvent(new Event('change', { bubbles: true }));
                                                        radio.dispatchEvent(new Event('input', { bubbles: true }));
                                                        if (label) label.click();
                                                    }
                                                } catch (e) { }
                                            });

                                            const targetSwatches = document.querySelectorAll(
                                                `[title="${colorName}" i], [data-color="${colorName}" i], [aria-label*="${colorName}" i], [title*="${colorName}" i]`
                                            );
                                            targetSwatches.forEach(sw => {
                                                try {
                                                    sw.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                                                    sw.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                                                    sw.click();
                                                } catch (e) { }
                                            });

                                            let confirmed = colorAppliedFor(colorName);
                                            for (let n = 0; !confirmed && n < 4; n++) {
                                                await delay(400);
                                                confirmed = colorAppliedFor(colorName);
                                            }
                                            return confirmed;
                                        }

                                        function isProductEnabled(root) {
                                            if (!root) return false;
                                            const hidden = root.querySelector('.on-off.canvas-enable input[type="hidden"], input[type="hidden"][name*="enabled"], input[type="hidden"][name*="active"]');
                                            if (hidden && /^(true|1|on)$/i.test(String(hidden.value || '').trim())) return true;
                                            const span = root.querySelector('.on-off span, .on-off.canvas-enable span');
                                            if (span) {
                                                if (span.classList.contains('enabled') || span.classList.contains('on')) return true;
                                                if (/^\s*on\s*$/i.test(span.textContent || '')) return true;
                                            }
                                            const onOff = root.querySelector('.on-off');
                                            if (onOff && /\bon\b/i.test(onOff.textContent || '') && !/\boff\b/i.test(onOff.textContent || '')) return true;
                                            return root.classList.contains('enabled') || root.classList.contains('selected');
                                        }

                                        function findBagOrToteRoots() {
                                            const sels = [
                                                '.canvas.bag', '.canvas[data-canvas="bag"]', 'tr[data-canvas="bag"]',
                                                '.canvas.tote', '.canvas[data-canvas="tote"]', 'tr[data-canvas="tote"]',
                                                '.canvas[data-product-name="Bags"]', '.canvas[data-product-name="Totes"]',
                                                '.canvas[data-product-name="Bag"]', '.canvas[data-product-name="Tote"]'
                                            ];
                                            const roots = [];
                                            for (const sel of sels) {
                                                document.querySelectorAll(sel).forEach((el) => {
                                                    if (!roots.includes(el)) roots.push(el);
                                                });
                                            }
                                            document.querySelectorAll('.canvas, .main_row, [data-product-name]').forEach((el) => {
                                                const label = `${el.getAttribute('data-product-name') || ''} ${el.querySelector('.canvas_label')?.textContent || ''} ${el.textContent || ''}`.toLowerCase();
                                                if (/\b(bags?|totes?)\b/.test(label) && !roots.includes(el)) roots.push(el);
                                            });
                                            return roots;
                                        }

                                        async function setPrimaryColorDropdown(productKey, preferred) {
                                            const bagCandidates = Array.from(new Set([
                                                preferred,
                                                ...colorCandidates,
                                                'Black', 'White', 'Navy', 'Red', 'Oxford', 'Light Grey'
                                            ].map((c) => String(c || '').trim()).filter(Boolean)));
                                            const canvas = document.querySelector(`.canvas.${productKey}, .canvas[data-canvas="${productKey}"], tr[data-canvas="${productKey}"]`);
                                            if (canvas) {
                                                try { canvas.click(); await delay(450); } catch (e) { }
                                            }
                                            const ddSelectors = [
                                                `#primary_color_${productKey} .dd-select`,
                                                `#primary_color_${productKey} .dd-selected`,
                                                `.canvas.${productKey} .dd-select`,
                                                `tr[data-canvas="${productKey}"] .dd-select`
                                            ];
                                            let dd = null;
                                            for (const sel of ddSelectors) {
                                                dd = document.querySelector(sel);
                                                if (dd) break;
                                            }
                                            if (!dd) return false;
                                            try {
                                                dd.click();
                                                dd.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                                            } catch (e) { }
                                            await delay(400);
                                            const container = document.querySelector(`#primary_color_${productKey}`) || dd.closest('.dd-container') || dd.parentElement;
                                            let options = Array.from((container || document).querySelectorAll('.dd-option'));
                                            if (!options.length) options = Array.from(document.querySelectorAll('.dd-option'));
                                            if (!options.length) return false;
                                            for (const cand of bagCandidates) {
                                                const t = cand.toLowerCase();
                                                const opt = options.find((o) => (o.querySelector('.dd-option-text')?.textContent || o.textContent || '').toLowerCase().includes(t));
                                                if (opt) {
                                                    try {
                                                        opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                                                        opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                                                        opt.click();
                                                    } catch (e) { }
                                                    await delay(300);
                                                    return true;
                                                }
                                            }
                                            const first = options.find((o) => !/select|choose|default|primary/i.test(o.textContent || '')) || options[0];
                                            if (first) {
                                                try { first.click(); } catch (e) { }
                                                await delay(300);
                                                return true;
                                            }
                                            return false;
                                        }

                                        async function setHexBgForProduct(productKey, hex) {
                                            const canvas = document.querySelector(`.canvas.${productKey}, .canvas[data-canvas="${productKey}"], tr[data-canvas="${productKey}"]`);
                                            if (canvas) {
                                                try { canvas.click(); await delay(500); } catch (e) { }
                                            }
                                            const scoped = canvas
                                                ? canvas.querySelectorAll('input.hex-input, input[type="text"][name*="color"], input[type="hidden"][name*="color"], input[name*="bg"]')
                                                : [];
                                            const globalHex = document.querySelectorAll('input.hex-input, input[name*="background"], input[name*="bg_color"]');
                                            const inputs = [...scoped, ...globalHex];
                                            let touched = false;
                                            inputs.forEach((input) => {
                                                try {
                                                    input.value = hex;
                                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                                    input.dispatchEvent(new Event('change', { bubbles: true }));
                                                    touched = true;
                                                } catch (e) { }
                                            });
                                            return touched;
                                        }

                                        function bagsPrimaryLooksUnset() {
                                            const selected = document.querySelector('#primary_color_bag .dd-selected-text, #primary_color_bag .dd-selected, #primary_color_bag .dd-select');
                                            if (!selected && !document.querySelector('#primary_color_bag, .canvas.bag')) return false;
                                            if (!selected) return !!document.querySelector('#primary_color_bag, .canvas.bag');
                                            const text = (selected.textContent || '').trim().toLowerCase();
                                            return !text || /select|choose|primary|default|—|-/.test(text);
                                        }

                                        async function ensureBagsTotesPrimaryColor() {
                                            const roots = findBagOrToteRoots();
                                            const anyEnabled = roots.some(isProductEnabled) || bagsPrimaryLooksUnset();
                                            const bagRoot = document.querySelector('.canvas.bag, .canvas[data-canvas="bag"], tr[data-canvas="bag"], .canvas[data-product-name="Bags"], .canvas[data-product-name="Bag"]');
                                            const toteRoot = document.querySelector('.canvas.tote, .canvas[data-canvas="tote"], tr[data-canvas="tote"], .canvas[data-product-name="Totes"], .canvas[data-product-name="Tote"]');
                                            const bagOn = isProductEnabled(bagRoot) || !!document.querySelector('#primary_color_bag');
                                            const toteOn = isProductEnabled(toteRoot);
                                            if (!anyEnabled && !bagOn && !toteOn) {
                                                // Still guard when Bags/Totes UI is present and may default ON
                                                if (!document.querySelector('.canvas.bag, .canvas.tote, #primary_color_bag, #primary_color_tote')) {
                                                    return { applied: false, reason: 'no-bags-totes' };
                                                }
                                            }
                                            log('Ensuring primary color for bags/totes...');
                                            let applied = false;
                                            const hex = hexByName[String(preferredColor || 'Black').toLowerCase()] || '#000000';
                                            if (bagOn || bagRoot || document.querySelector('#primary_color_bag') || anyEnabled) {
                                                applied = (await setPrimaryColorDropdown('bag', preferredColor)) || applied;
                                            }
                                            if (toteOn || toteRoot || document.querySelector('#primary_color_tote')) {
                                                applied = (await setPrimaryColorDropdown('tote', preferredColor)) || applied;
                                                applied = (await setHexBgForProduct('tote', hex)) || applied;
                                            }
                                            // Final pass: if bag dropdown still looks empty, force Black/Navy/etc.
                                            if (bagsPrimaryLooksUnset()) {
                                                for (const cand of ['Black', 'Navy', 'White', 'Red', 'Oxford', 'Light Grey', preferredColor]) {
                                                    if (await setPrimaryColorDropdown('bag', cand)) {
                                                        applied = true;
                                                        break;
                                                    }
                                                }
                                            }
                                            return { applied, bagOn: !!bagOn, toteOn: !!toteOn };
                                        }

                                        function productHasSelectedColor(root) {
                                            if (!root) return false;
                                            const selectedSwatch = root.querySelector(
                                                '.swatch.selected, .swatch.active, .color-swatch.selected, .color-spot.selected, [aria-checked="true"], [aria-selected="true"], .dd-selected-text, .dd-selected'
                                            );
                                            if (selectedSwatch) {
                                                const t = (selectedSwatch.textContent || selectedSwatch.title || '').trim();
                                                if (t && !/select|choose|primary|default|—|-/i.test(t)) return true;
                                                if (selectedSwatch.classList?.contains('selected') || selectedSwatch.classList?.contains('active')) return true;
                                            }
                                            const select = root.querySelector('select.js-uploader-color-select, select[name*="color"], select');
                                            if (select && select.value && select.selectedIndex > 0) return true;
                                            const radio = root.querySelector('input[type="radio"][name*="color"]:checked');
                                            if (radio) return true;
                                            const hidden = root.querySelector('input[type="hidden"][name*="color"], input.hex-input');
                                            if (hidden && String(hidden.value || '').trim()) return true;
                                            const ddText = root.querySelector('.dd-selected-text, .dd-selected');
                                            if (ddText) {
                                                const t = (ddText.textContent || '').trim();
                                                if (t && !/select|choose|primary|default|—|-/i.test(t)) return true;
                                            }
                                            return false;
                                        }

                                        function listEnabledProductRoots() {
                                            const roots = Array.from(document.querySelectorAll(
                                                '.m-uploader-product, .canvas[data-canvas], .canvas[data-product-name], tr[data-canvas], .js-product-row'
                                            ));
                                            const enabled = roots.filter((root) => {
                                                if (!(root.offsetWidth > 0 || root.offsetHeight > 0)) return false;
                                                return isProductEnabled(root) || !!root.querySelector('.dd-select, select[name*="color"], .swatch, .color-swatch');
                                            });
                                            return enabled.length ? enabled : roots.filter((r) => r.offsetWidth > 0 || r.offsetHeight > 0);
                                        }

                                        function enabledProductsMissingColors() {
                                            const enabled = listEnabledProductRoots();
                                            if (!enabled.length) return [];
                                            return enabled.filter((root) => !productHasSelectedColor(root));
                                        }

                                        async function waitUntilAllProductColorsReady(maxWaitMs = 90000) {
                                            const started = Date.now();
                                            let missing = enabledProductsMissingColors();
                                            let pass = 0;
                                            while (missing.length > 0 && (Date.now() - started) < maxWaitMs) {
                                                pass += 1;
                                                log(`Waiting for product colors (${missing.length} missing) pass=${pass}`);
                                                await applyColorCandidate(appliedColor || preferredColor);
                                                await ensureBagsTotesPrimaryColor();
                                                for (const key of ['tshirt', 'hoodie', 'tank', 'crewneck', 'longsleeve', 'kids', 'bag', 'tote']) {
                                                    if (document.querySelector(`#primary_color_${key}, .canvas.${key}`)) {
                                                        await setPrimaryColorDropdown(key, appliedColor || preferredColor);
                                                    }
                                                }
                                                await delay(1200);
                                                missing = enabledProductsMissingColors();
                                            }
                                            return {
                                                ready: missing.length === 0,
                                                missingCount: missing.length,
                                                enabledCount: listEnabledProductRoots().length
                                            };
                                        }

                                        let colorConfirmed = false;
                                        let appliedColor = preferredColor;
                                        let colorsStatus = 'failed';
                                        for (let ci = 0; ci < colorCandidates.length; ci++) {
                                            const candidate = colorCandidates[ci];
                                            colorConfirmed = await applyColorCandidate(candidate);
                                            if (colorConfirmed) {
                                                appliedColor = candidate;
                                                colorsStatus = ci === 0 ? 'ok' : 'corrected';
                                                if (ci > 0) log(`Color auto-correct succeeded with fallback: ${candidate}`);
                                                break;
                                            }
                                        }

                                        const bagsFix = await ensureBagsTotesPrimaryColor();
                                        if (bagsFix?.applied) {
                                            log(`Bags/totes primary color ensured (bagOn=${!!bagsFix.bagOn}, toteOn=${!!bagsFix.toteOn})`);
                                        }

                                        // Gate: every enabled product must have a color before Publish.
                                        const allColorsGate = await waitUntilAllProductColorsReady(90000);
                                        if (!allColorsGate.ready) {
                                            log(`Product colors still incomplete after wait (${allColorsGate.missingCount}/${allColorsGate.enabledCount}) — retry once`);
                                            await applyColorCandidate(appliedColor || preferredColor);
                                            await ensureBagsTotesPrimaryColor();
                                            await delay(2000);
                                            const retryGate = await waitUntilAllProductColorsReady(45000);
                                            if (!retryGate.ready) {
                                                return {
                                                    status: 'colors_failed',
                                                    colorsStatus: 'failed',
                                                    appliedColor: appliedColor || preferredColor,
                                                    bagsPrimaryEnsured: !!bagsFix?.applied,
                                                    msg: `Colors not ready for all products (${retryGate.missingCount} missing of ${retryGate.enabledCount})`
                                                };
                                            }
                                            colorsStatus = colorsStatus === 'ok' ? 'corrected' : colorsStatus;
                                        } else if (allColorsGate.enabledCount > 0) {
                                            colorConfirmed = true;
                                            if (colorsStatus === 'failed') colorsStatus = 'ok';
                                            log(`All product colors ready (${allColorsGate.enabledCount} products)`);
                                        }

                                        if (!submitReady) return { status: 'submit_not_found', colorsStatus, appliedColor, bagsPrimaryEnsured: !!bagsFix?.applied };
                                        if (!colorControlsReady) return { status: 'colors_not_ready', colorsStatus, appliedColor, bagsPrimaryEnsured: !!bagsFix?.applied };
                                        if (!colorConfirmed) {
                                            log('Color auto-correct exhausted all candidates — skipping design (fail-soft).');
                                            return {
                                                status: 'colors_failed',
                                                colorsStatus: 'failed',
                                                appliedColor: preferredColor,
                                                bagsPrimaryEnsured: !!bagsFix?.applied,
                                                msg: `Color selection failed after trying: ${colorCandidates.join(', ')}`
                                            };
                                        }
                                        return {
                                            status: 'success',
                                            colorsStatus,
                                            appliedColor,
                                            bagsPrimaryEnsured: !!bagsFix?.applied,
                                            productsColored: allColorsGate.enabledCount || 0
                                        };
                                    } catch (e) { return { status: 'error', msg: e.message }; }
                                }, {
                                    title: m.title,
                                    description: m.description,
                                    main_tag: m.main_tag || m.title,
                                    tags: m.tags || [],
                                    defaultColor: defaultColor || 'Black',
                                    colorFallbacks: ['Black', 'White', 'Navy', 'Red']
                                });

                                logToFile(`Batch Result: ${fillRes.status} | colors=${fillRes.colorsStatus || 'n/a'} | color=${fillRes.appliedColor || defaultColor || 'Black'}`);
                                await logObservedPageState(`after-fill-form-design-${i + 1}`);

                                if (fillRes.status === 'colors_failed') {
                                    throw new Error(fillRes.msg || 'Color selection failed after auto-correct attempts');
                                }
                                if (fillRes.status !== 'success') {
                                    throw new Error(fillRes.msg || `TeePublic form did not become publish-ready (${fillRes.status})`);
                                }
                                let colorsStatusForResult = fillRes.colorsStatus || 'ok';
                                let colorCorrected = colorsStatusForResult === 'corrected';

                                if (actionType === 'publish') {
                                    const submitSelectors = [
                                        'button.publish-and-promote-button',
                                        'button[value="publish" i]',
                                        'input[type="submit"][value*="Publish" i]',
                                        'input[type="submit"][value*="Save" i]',
                                        '.save-design-btn',
                                        '#publish-btn',
                                        'button[name="commit"]',
                                        'button[name="commit"][value="publish"]',
                                        'form.edit_design input[type="submit"]',
                                        'form.new_design input[type="submit"]'
                                    ];

                                    await page.waitForFunction((selectors) => {
                                        return selectors.some((sel) => {
                                            const el = document.querySelector(sel);
                                            return !!(el && (el.offsetWidth > 0 || el.offsetHeight > 0));
                                        });
                                    }, { timeout: 90000 }, submitSelectors);

                                    const clickPublish = async () => {
                                        const clickResult = await page.evaluate(async (selectors) => {
                                            const delay = ms => new Promise(res => setTimeout(res, ms));
                                            let saveBtn = null;
                                            for (const sel of selectors) {
                                                const btn = document.querySelector(sel);
                                                if (btn && (btn.offsetWidth > 0 || btn.offsetHeight > 0)) {
                                                    saveBtn = btn;
                                                    break;
                                                }
                                            }
                                            if (!saveBtn) return { clicked: false, reason: 'submit-not-found' };

                                            saveBtn.removeAttribute('disabled');
                                            saveBtn.classList.remove('disabled');
                                            saveBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
                                            await delay(1200);

                                            const events = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
                                            events.forEach(evt => {
                                                try {
                                                    saveBtn.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
                                                } catch (_) { }
                                            });

                                            try { saveBtn.click(); } catch (_) { }

                                            setTimeout(() => {
                                                const body = (document.body?.innerText || '').toLowerCase();
                                                if (body.includes('successfully') || body.includes('congrats')) return;
                                                const form = saveBtn.closest('form');
                                                if (form) {
                                                    try { form.submit(); } catch (_) { }
                                                }
                                            }, 3000);

                                            return { clicked: true, text: (saveBtn.innerText || saveBtn.value || '').trim() };
                                        }, submitSelectors);
                                        return clickResult;
                                    };

                                    const waitPublishOutcome = async (timeoutMs = 90000) => {
                                        return Promise.race([
                                            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: timeoutMs }).then(() => 'navigated').catch(() => null),
                                            page.waitForFunction(() => {
                                                const body = (document.body?.innerText || '').toLowerCase();
                                                return body.includes('successfully') ||
                                                    body.includes('congrats') ||
                                                    body.includes('promote your design') ||
                                                    !window.location.href.includes('quick_create');
                                            }, { timeout: timeoutMs }).then(() => 'success-marker').catch(() => null)
                                        ]);
                                    };

                                    const fixBagsPrimaryInPage = async () => {
                                        return page.evaluate(async (preferred) => {
                                            const delay = ms => new Promise(res => setTimeout(res, ms));
                                            const candidates = Array.from(new Set([
                                                preferred, 'Black', 'White', 'Navy', 'Red', 'Oxford', 'Light Grey'
                                            ].map((c) => String(c || '').trim()).filter(Boolean)));
                                            const hexByName = { black: '#000000', white: '#ffffff', navy: '#001f3f', red: '#c41e3a' };
                                            async function setPrimary(productKey) {
                                                const canvas = document.querySelector(`.canvas.${productKey}, .canvas[data-canvas="${productKey}"], tr[data-canvas="${productKey}"]`);
                                                if (canvas) { try { canvas.click(); await delay(400); } catch (_) {} }
                                                const dd = document.querySelector(`#primary_color_${productKey} .dd-select, #primary_color_${productKey} .dd-selected, .canvas.${productKey} .dd-select`);
                                                if (!dd) return false;
                                                try { dd.click(); } catch (_) {}
                                                await delay(350);
                                                const container = document.querySelector(`#primary_color_${productKey}`) || dd.closest('.dd-container') || document;
                                                const options = Array.from(container.querySelectorAll('.dd-option'));
                                                if (!options.length) return false;
                                                for (const cand of candidates) {
                                                    const t = cand.toLowerCase();
                                                    const opt = options.find((o) => (o.textContent || '').toLowerCase().includes(t));
                                                    if (opt) {
                                                        try { opt.click(); } catch (_) {}
                                                        await delay(250);
                                                        return true;
                                                    }
                                                }
                                                const first = options.find((o) => !/select|choose|default/i.test(o.textContent || '')) || options[0];
                                                if (first) { try { first.click(); } catch (_) {} await delay(250); return true; }
                                                return false;
                                            }
                                            async function setToteHex() {
                                                const tote = document.querySelector('.canvas.tote, .canvas[data-canvas="tote"]');
                                                if (tote) { try { tote.click(); await delay(400); } catch (_) {} }
                                                const hex = hexByName[String(preferred || 'Black').toLowerCase()] || '#000000';
                                                let touched = false;
                                                document.querySelectorAll('input.hex-input, input[name*="color"][type="text"], input[name*="bg"]').forEach((input) => {
                                                    try {
                                                        input.value = hex;
                                                        input.dispatchEvent(new Event('input', { bubbles: true }));
                                                        input.dispatchEvent(new Event('change', { bubbles: true }));
                                                        touched = true;
                                                    } catch (_) {}
                                                });
                                                return touched;
                                            }
                                            const bagOk = await setPrimary('bag');
                                            const toteDd = await setPrimary('tote');
                                            const toteHex = await setToteHex();
                                            return { bagOk, toteDd, toteHex };
                                        }, defaultColor || 'Black');
                                    };

                                    logToFile(`🚀 Clicking Publish (colors gated)...`);
                                    // Final gate: never publish until enabled products still show colors.
                                    const prePublishColorGate = await page.evaluate(async (preferred) => {
                                        const delay = ms => new Promise(res => setTimeout(res, ms));
                                        function isEnabled(root) {
                                            if (!root) return false;
                                            const hidden = root.querySelector('.on-off.canvas-enable input[type="hidden"], input[type="hidden"][name*="enabled"]');
                                            if (hidden && /^(true|1|on)$/i.test(String(hidden.value || '').trim())) return true;
                                            const span = root.querySelector('.on-off span, .on-off.canvas-enable span');
                                            if (span && (span.classList.contains('enabled') || span.classList.contains('on') || /^\s*on\s*$/i.test(span.textContent || ''))) return true;
                                            return root.classList.contains('enabled') || root.classList.contains('selected');
                                        }
                                        function hasColor(root) {
                                            const selected = root.querySelector('.swatch.selected, .swatch.active, .color-swatch.selected, [aria-checked="true"], .dd-selected-text, .dd-selected');
                                            if (selected) {
                                                const t = (selected.textContent || selected.title || '').trim();
                                                if (t && !/select|choose|primary|default/i.test(t)) return true;
                                                if (selected.classList?.contains('selected') || selected.classList?.contains('active')) return true;
                                            }
                                            const select = root.querySelector('select[name*="color"], select.js-uploader-color-select');
                                            if (select && select.value && select.selectedIndex > 0) return true;
                                            const hidden = root.querySelector('input[type="hidden"][name*="color"], input.hex-input');
                                            return !!(hidden && String(hidden.value || '').trim());
                                        }
                                        const roots = Array.from(document.querySelectorAll('.m-uploader-product, .canvas[data-canvas], tr[data-canvas]'))
                                            .filter((r) => (r.offsetWidth > 0 || r.offsetHeight > 0) && (isEnabled(r) || r.querySelector('.dd-select, .swatch')));
                                        let missing = roots.filter((r) => !hasColor(r));
                                        for (let n = 0; n < 8 && missing.length; n++) {
                                            for (const dd of document.querySelectorAll('.dd-select')) {
                                                try {
                                                    dd.click();
                                                    await delay(250);
                                                    const opt = Array.from((dd.closest('.dd-container') || document).querySelectorAll('.dd-option'))
                                                        .find((o) => (o.textContent || '').toLowerCase().includes(String(preferred || 'black').toLowerCase()))
                                                        || Array.from((dd.closest('.dd-container') || document).querySelectorAll('.dd-option'))[0];
                                                    if (opt) opt.click();
                                                    await delay(200);
                                                } catch (_) {}
                                            }
                                            await delay(800);
                                            missing = roots.filter((r) => !hasColor(r));
                                        }
                                        return { ready: missing.length === 0, missing: missing.length, total: roots.length };
                                    }, defaultColor || 'Black');
                                    logToFile(`[ColorGate] pre-publish ready=${prePublishColorGate?.ready} missing=${prePublishColorGate?.missing}/${prePublishColorGate?.total}`);
                                    if (!prePublishColorGate?.ready) {
                                        throw new Error(`Publish blocked: colors still missing on ${prePublishColorGate?.missing || '?'} products`);
                                    }
                                    await new Promise(r => setTimeout(r, 2500));
                                    pendingBagsPrimaryAlert = false;

                                    let clickResult = await clickPublish();
                                    if (!clickResult?.clicked) {
                                        throw new Error(`Publish button could not be clicked (${clickResult?.reason || 'unknown'})`);
                                    }

                                    try {
                                        urlAfterPublish = page.url();
                                    } catch (_) {}

                                    let publishOutcome = await waitPublishOutcome(45000);

                                    // Alert recovery: dismiss already handled by page.on('dialog'); select bags color + retry PUBLISH
                                    if (pendingBagsPrimaryAlert || !publishOutcome) {
                                        await new Promise(r => setTimeout(r, 800));
                                        if (pendingBagsPrimaryAlert || !publishOutcome) {
                                            logToFile(`[BagsPrimary] Alert/no-confirm after publish — auto-fixing bags/totes primary color then retrying PUBLISH`);
                                            pendingBagsPrimaryAlert = false;
                                            const fixRes = await fixBagsPrimaryInPage();
                                            logToFile(`[BagsPrimary] fix result: ${JSON.stringify(fixRes)}`);
                                            await new Promise(r => setTimeout(r, 1200));
                                            clickResult = await clickPublish();
                                            if (!clickResult?.clicked) {
                                                throw new Error(`Publish retry failed after bags primary fix (${clickResult?.reason || 'unknown'})`);
                                            }
                                            publishOutcome = await waitPublishOutcome(90000);
                                            if (publishOutcome) {
                                                colorsStatusForResult = 'corrected';
                                                colorCorrected = true;
                                                logToFile('[BagsPrimary] Publish succeeded after bags primary-color auto-correct');
                                            }
                                        }
                                    }

                                    if (!publishOutcome) {
                                        throw new Error(pendingBagsPrimaryAlert
                                            ? 'Publish blocked: bags primary color still missing after auto-correct'
                                            : 'Publish click did not lead to confirmation or page transition');
                                    }

                                    logToFile(`Publish confirmed via: ${publishOutcome}`);
                                    try {
                                        urlAfterPublish = page.url();
                                    } catch (_) {}
                                    await new Promise(r => setTimeout(r, 8000));
                                }

                                // Upload path: never visit /account/store (post-publish store profile skipped).
                                // Use dedicated POST /apply-store-profile outside the upload pipeline if needed.
                                if (applyStoreProfileAfterPublish && storeProfile) {
                                    logToFile(`[StoreProfile] skipped post-publish /account/store step during upload for ${account.email} (use /apply-store-profile separately)`);
                                }

                                publishResult = {
                                    status: 'published',
                                    error: '',
                                    colorsStatus: typeof colorsStatusForResult !== 'undefined' ? colorsStatusForResult : 'ok',
                                    corrected: !!colorCorrected,
                                    appliedColor: fillRes?.appliedColor || defaultColor || 'Black'
                                };
                                break; // Success, break out of attempt loop
                            } catch (attemptErr) {
                                logToFile(`⚠️ Design [${i + 1}/${designList.length}] | Attempt ${attempt} failed (will retry or skip — fail-soft): ${attemptErr.message}`, 'WARN');
                                const recoverable = isRecoverableUploadNavigationError(attemptErr, browser);
                                if (!recoverable || attempt === maxAttempts) {
                                    throw attemptErr; // Caught by per-design try/catch — does NOT abort remaining designs
                                }
                                
                                // Recover page and navigate back to quick_create for retry
                                try {
                                    page = await getOrRecoverTeePublicPage(browser);
                                    if (!page.url().includes('quick_create')) {
                                        await page.goto('https://www.teepublic.com/design/quick_create', { waitUntil: 'domcontentloaded', timeout: 90000 });
                                    }
                                } catch (recRetryErr) {
                                    logToFile(`[PageRecovery] Recovery retry fail: ${recRetryErr.message}`, 'WARN');
                                }
                                await new Promise(r => setTimeout(r, 3000));
                            }
                        }
                    } catch (err) {
                        // Fail-soft: log + skip this design, continue remaining designs in the batch.
                        logToFile(`❌ Error uploading design ${i + 1} — skipping and continuing batch: ${err.message}`, 'ERROR');
                        const isColorFail = /color/i.test(String(err.message || ''));
                        publishResult = {
                            status: 'failed',
                            error: err.message,
                            colorsStatus: isColorFail ? 'failed' : (publishResult.colorsStatus || 'unknown'),
                            corrected: false,
                            skippedContinue: true
                        };
                        // Reset surface so the next design is not blocked by a broken form.
                        try {
                            page = await getOrRecoverTeePublicPage(browser);
                            if (!page.url().includes('quick_create')) {
                                await page.goto('https://www.teepublic.com/design/quick_create', { waitUntil: 'domcontentloaded', timeout: 90000 });
                            }
                            logToFile(`[FailSoft] Recovered quick_create after design ${i + 1} failure — continuing batch`);
                        } catch (recErr) {
                            logToFile(`[FailSoft] Page recovery after skip failed (will retry on next design): ${recErr.message}`, 'WARN');
                        }
                    } finally {
                        try { if (tP && fs.existsSync(tP)) fs.unlinkSync(tP); } catch { }
                        clearActiveUploadJob(jobId);
                        logToFile(`📊 Design Summary [${i + 1}/${designList.length}] | Account: ${account.email} | Attempt: ${finalAttemptNumber} | URL Before: ${urlBeforeUpload} | URL After: ${urlAfterPublish} | Status: ${publishResult.status} | colors=${publishResult.colorsStatus || 'n/a'} | Error: ${publishResult.error || 'None'}`);
                    }
                    
                    results.push({
                        queueItemId: des.queueItemId || des.id,
                        status: publishResult.status,
                        error: publishResult.error,
                        colorsStatus: publishResult.colorsStatus || null,
                        corrected: !!publishResult.corrected,
                        appliedColor: publishResult.appliedColor || null,
                        skippedContinue: !!publishResult.skippedContinue
                    });
                    // Explicit continue-on-error: never break/return here — next design runs regardless.
                }
            } catch (loopErr) {
                // Outer safety net only — per-design errors must not reach here.
                logToFile(`❌ Ghost Loop Error (unexpected): ${loopErr.message} — marking remaining as skipped_failed and continuing response`, 'ERROR');
                for (let i = results.length; i < designList.length; i++) {
                    const des = designList[i];
                    results.push({
                        queueItemId: des.queueItemId || des.id,
                        status: 'failed',
                        error: `Loop interrupted (fail-soft skip): ${loopErr.message}`,
                        skippedContinue: true
                    });
                }
            }
            responsePayload = { statusCode: 200, body: { success: true, results } };
        } catch (err) {
            logToFile(`❌ Ghost Error: ${err.message}`, 'ERROR');
            responsePayload = { statusCode: 500, body: { success: false, error: err.message } };
        } finally {
            clearActiveUploadJob(currentJobId);
            if (browser && !keepAlive) {
                await gracefulCloseGhostBrowser(browser, browserLaunchMode, logToFile);
                if (!browser.isConnected()) {
                    logToFile(`[UploadTeardown] Browser closed successfully for ${uploadEmail}`);
                }
                await releaseProfileLockForEmail(uploadEmail).catch((releaseErr) => {
                    logToFile(`Profile lock release after upload: ${releaseErr.message}`, 'WARN');
                });
                await new Promise(r => setTimeout(r, 2500));
            }
            if (!res.headersSent) {
                res.status(responsePayload.statusCode).json(responsePayload.body);
            }
        }
        }));
    } catch (mutexErr) {
        logToFile(`❌ Upload mutex/lock error: ${mutexErr.message}`, 'ERROR');
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: mutexErr.message });
        }
    }
});


    app.get('/profiles-backup/list', (req, res) => {
        try {
            res.json({ success: true, backups: listBackups() });
        } catch (err) {
            logToFile(`❌ Backup List Error: ${err.message}`, 'ERROR');
            responsePayload = { statusCode: 500, body: { success: false, error: err.message } };
        }
    });

    app.post('/profiles-backup/export', (req, res) => {
        try {
            const { backupName, snapshot } = req.body || {};
            const backupId = `${sanitizeBackupName(backupName)}_${makeTimestamp()}`;
            const backupDir = getBackupDir(backupId);
            const profilesBackupDir = path.join(backupDir, 'server_profiles');

            fs.mkdirSync(backupDir, { recursive: true });
            copyDirContents(PROFILES_DIR, profilesBackupDir);

            const manifest = {
                version: 1,
                type: 'autopilot_session_backup',
                backupId,
                createdAt: new Date().toISOString(),
                profileCount: countProfileDirs(profilesBackupDir),
                accountCount: countAccountSnapshot(snapshot || {}),
                snapshot: snapshot || {}
            };

            writeBackupManifest(backupDir, manifest);
            logToFile(`💾 Backup exported: ${backupId} (${manifest.profileCount} profiles)`);
            res.json({
                success: true,
                backupId,
                backupDir,
                profileCount: manifest.profileCount,
                accountCount: manifest.accountCount
            });
        } catch (err) {
            logToFile(`❌ Backup Export Error: ${err.message}`, 'ERROR');
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/profiles-backup/import', (req, res) => {
        try {
            const { backupId, currentSnapshot } = req.body || {};
            if (!backupId) return res.status(400).json({ success: false, error: 'backupId required' });

            const backupDir = getBackupDir(backupId);
            const manifest = readBackupManifest(backupDir);
            const sourceProfilesDir = path.join(backupDir, 'server_profiles');

            if (!manifest || !fs.existsSync(sourceProfilesDir)) {
                return res.status(404).json({ success: false, error: 'Backup not found' });
            }

            const safetyBackupId = `pre_restore_${makeTimestamp()}`;
            const safetyBackupDir = getBackupDir(safetyBackupId);
            const safetyProfilesDir = path.join(safetyBackupDir, 'server_profiles');
            fs.mkdirSync(safetyBackupDir, { recursive: true });
            copyDirContents(PROFILES_DIR, safetyProfilesDir);
            writeBackupManifest(safetyBackupDir, {
                version: 1,
                type: 'autopilot_session_backup',
                backupId: safetyBackupId,
                createdAt: new Date().toISOString(),
                profileCount: countProfileDirs(safetyProfilesDir),
                accountCount: countAccountSnapshot(currentSnapshot || {}),
                safetyBackup: true,
                snapshot: currentSnapshot || {}
            });

            ensureEmptyDir(PROFILES_DIR);
            copyDirContents(sourceProfilesDir, PROFILES_DIR);

            logToFile(`📥 Backup restored: ${backupId} -> profiles:${countProfileDirs(PROFILES_DIR)} | safety:${safetyBackupId}`);
            res.json({
                success: true,
                backupId,
                safetyBackupId,
                profileCount: countProfileDirs(PROFILES_DIR),
                snapshot: manifest.snapshot || {}
            });
        } catch (err) {
            logToFile(`❌ Backup Import Error: ${err.message}`, 'ERROR');
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/niche-memory', (req, res) => {
        try {
            const memory = readNicheMemory();
            res.json({
                success: true,
                memory,
                memoryPath: NICHE_MEMORY_FILE,
                backupPath: NICHE_MEMORY_BACKUP_FILE
            });
        } catch (err) {
            logToFile(`Niche memory fetch error: ${err.message}`, 'ERROR');
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/niche-memory/save', (req, res) => {
        try {
            const { memory } = req.body || {};
            const savedMemory = writeNicheMemory(memory || {});
            logToFile(`Niche memory saved (${Object.keys(savedMemory.uspto).length} uspto, ${Object.keys(savedMemory.teepublic).length} analysis)`);
            res.json({
                success: true,
                memory: savedMemory,
                memoryPath: NICHE_MEMORY_FILE,
                backupPath: NICHE_MEMORY_BACKUP_FILE
            });
        } catch (err) {
            logToFile(`Niche memory save error: ${err.message}`, 'ERROR');
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/niche-archive', (req, res) => {
        try {
            const index = readNicheArchive();
            res.json({
                success: true,
                index,
                indexPath: NICHE_ARCHIVE_INDEX_FILE,
                snapshotDir: NICHE_ARCHIVE_SNAPSHOTS_DIR
            });
        } catch (err) {
            logToFile(`Niche archive fetch error: ${err.message}`, 'ERROR');
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/niche-archive/save', (req, res) => {
        try {
            const { index, snapshot, reason } = req.body || {};
            const currentIndex = readNicheArchive();
            const mergedIndex = mergeNicheArchives(currentIndex, index || {});
            let writtenSnapshot = null;

            if (snapshot) {
                writtenSnapshot = writeTrendSnapshot(snapshot);
            }

            const savedIndex = writeNicheArchive(mergedIndex);
            logToFile(`Niche archive saved (${Object.keys(savedIndex.niches).length} niches, reason=${reason || 'sync'})`);
            res.json({
                success: true,
                index: savedIndex,
                snapshot: writtenSnapshot,
                indexPath: NICHE_ARCHIVE_INDEX_FILE,
                snapshotDir: NICHE_ARCHIVE_SNAPSHOTS_DIR
            });
        } catch (err) {
            logToFile(`Niche archive save error: ${err.message}`, 'ERROR');
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/niche-archive/export', (req, res) => {
        try {
            const bundle = {
                version: 1,
                exportedAt: new Date().toISOString(),
                archive: readNicheArchive(),
                snapshots: listTrendSnapshots()
            };
            res.json({
                success: true,
                bundle,
                indexPath: NICHE_ARCHIVE_INDEX_FILE,
                snapshotDir: NICHE_ARCHIVE_SNAPSHOTS_DIR
            });
        } catch (err) {
            logToFile(`Niche archive export error: ${err.message}`, 'ERROR');
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/niche-archive/import', (req, res) => {
        try {
            const { bundle, mode } = req.body || {};
            const savedIndex = importNicheArchiveBundle(bundle || {}, mode || 'merge');
            res.json({
                success: true,
                index: savedIndex,
                indexPath: NICHE_ARCHIVE_INDEX_FILE,
                snapshotDir: NICHE_ARCHIVE_SNAPSHOTS_DIR
            });
        } catch (err) {
            logToFile(`Niche archive import error: ${err.message}`, 'ERROR');
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/shutdown', (req, res) => {
        res.json({ ok: true, shuttingDown: true });
        setTimeout(() => process.exit(0), 150);
    });

    app.post('/api/ghost/restart', (req, res) => {
        res.json({ ok: true, message: 'جاري إعادة التشغيل...' });
        const restartScript = path.join(ROOT_DIR, 'Restart_Ghost_3019.cmd');
        try {
            if (fs.existsSync(restartScript)) {
                const child = spawn('cmd.exe', ['/c', restartScript], {
                    detached: true,
                    stdio: 'ignore',
                    cwd: ROOT_DIR,
                    windowsHide: true
                });
                child.unref();
                logToFile(`Ghost restart spawned: ${restartScript}`, 'INFO');
            } else {
                logToFile(`Ghost restart script missing: ${restartScript}`, 'ERROR');
            }
        } catch (err) {
            logToFile(`Ghost restart spawn failed: ${err.message}`, 'ERROR');
        }
        setTimeout(() => process.exit(0), 500);
    });

    app.get('/ping', (req, res) => res.json({
        ok: true,
        generateApi: generateApiRoutesVersion > 0,
        generateApiRoutesVersion,
        librarySmartRename: generateApiRoutesVersion >= 3,
        canvaApi: canvaApiRoutesVersion > 0,
        canvaApiRoutesVersion,
        port: PORT,
        rootDir: ROOT_DIR,
        libraryDir: path.join(DATA_ROOT, 'generated_designs', 'library'),
        libraryDesignCount: countLibraryDesigns(DATA_ROOT)
    }));

    app.get('/status', (req, res) => res.json({
        ok: true,
        service: 'ghost',
        port: PORT
    }));

    app.post('/release-profile-lock', async (req, res) => {
        try {
            const email = String(req.body?.email || req.body?.accountEmail || '').trim();
            if (!email) return res.status(400).json({ ok: false, error: 'email_required' });
            const result = await releaseProfileLockForEmail(email);
            res.json(result);
        } catch (err) {
            logToFile(`❌ release-profile-lock: ${err.message}`, 'ERROR');
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // مسار جديد لتغيير الـ IP عبر الهاتف المحمول
    app.post('/rotate-ip', async (req, res) => {
        try {
            const success = await rotateWifiIp();
            if (success) {
                return res.json({ success: true, message: 'IP Rotated Successfully' });
            }

            return res.status(500).json({ success: false, error: 'Failed to rotate IP via ADB' });
        } catch (err) {
            logToFile(`❌ Rotate IP route error: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    const server = app.listen(PORT, () => {
        profileLock.pruneStaleCrossProcessLocks(ROOT_DIR, logToFile);
        logToFile(`🚀 Ghost Server v31.1 Ready on Port ${PORT}`);
    });

    // إعادة المحاولة تلقائياً إذا كان المنفذ مشغولاً
    server.on('error', (e) => {
        logToFile(`❌ Server Error: ${e.code}`, 'ERROR');
        if (e.code === 'EADDRINUSE') {
        logToFile(`⚠️ المنفذ ${PORT} مشغول. جاري إغلاق الخادم للمحاولة من جديد...`, 'WARN');
            setTimeout(() => process.exit(0), 500);
        }
    });
