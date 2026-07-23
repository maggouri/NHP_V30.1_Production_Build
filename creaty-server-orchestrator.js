/**
 * Creaty Server — Artisan schedule orchestrator (Node timers + Ghost 3019)
 * Used by creaty-server.js on port 3020.
 */
const fs = require('fs');
const path = require('path');

const GHOST_PORT = Number(process.env.NHP_GHOST_PORT) || 3019;
const ARTISAN_PLAN_DAYS = 12;
const ARTISAN_MAX_DESIGNS = 5;
const GROUP_SIZE = 5;
const MAX_RETRY = 3;
const RETRY_DELAY_MS = 15 * 60 * 1000;

const ARTISAN_PHASE_DEFS = [
    { id: 'foundation', dayStart: 1, dayEnd: 2, isDesign: false },
    { id: 'design1', dayStart: 3, dayEnd: 4, isDesign: true, designIndex: 0 },
    { id: 'design2', dayStart: 5, dayEnd: 6, isDesign: true, designIndex: 1 },
    { id: 'design3', dayStart: 7, dayEnd: 8, isDesign: true, designIndex: 2 },
    { id: 'design4', dayStart: 9, dayEnd: 10, isDesign: true, designIndex: 3 },
    { id: 'design5_review', dayStart: 11, dayEnd: 12, isDesign: true, designIndex: 4 },
];

/** 5-stage supervision board — maps UI stages → orchestrator phases */
const WORKFLOW_STAGES = [
    { id: 'foundation', phaseIds: ['foundation'] },
    { id: 'design1', phaseIds: ['design1'] },
    { id: 'design2', phaseIds: ['design2'] },
    { id: 'design3', phaseIds: ['design3'] },
    { id: 'design45', phaseIds: ['design4', 'design5_review'] },
];

/** @type {Map<string, object>} */
const schedules = new Map();
/** @type {Map<string, NodeJS.Timeout>} */
const timers = new Map();
/** @type {Map<string, { abortController: AbortController, stopRequested: boolean }>} */
const activeStageRuns = new Map();
/** @type {Array<{ ts: string, email: string, level: string, message: string }>} */
const recentLogs = [];

let persistPath = '';
let logFn = (msg, type = 'INFO') => console.log(`[ORCH][${type}] ${msg}`);

function setOrchestratorPaths(rootDir) {
    persistPath = path.join(rootDir, 'server_logs', 'orchestrate-schedules.json');
}

function setOrchestratorLogger(fn) {
    if (typeof fn === 'function') logFn = fn;
}

function normEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function orchLog(email, message, level = 'info') {
    const entry = { ts: new Date().toISOString(), email: email || '', level, message };
    recentLogs.unshift(entry);
    if (recentLogs.length > 200) recentLogs.length = 200;
    logFn(`${email ? `[${email}] ` : ''}${message}`, level === 'error' ? 'ERROR' : level === 'warn' ? 'WARN' : 'INFO');
}

function parseIsoDate(iso) {
    const parts = String(iso || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function daysSinceStart(schedule) {
    const start = parseIsoDate(schedule?.startDate);
    if (!start) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today - start) / 86400000));
}

function calendarDayFromSchedule(schedule) {
    if (!schedule?.started || schedule.paused) return schedule?.currentDay || 1;
    const gap = Math.max(1, Number(schedule.daysBetween) || 2);
    const elapsed = daysSinceStart(schedule);
    const computed = Math.min(ARTISAN_PLAN_DAYS, Math.floor(elapsed / gap) + 1);
    return Math.max(schedule.currentDay || 1, computed);
}

function phaseForDay(day, schedule) {
    const designCount = Math.min(ARTISAN_MAX_DESIGNS, Number(schedule?.designCount) || ARTISAN_MAX_DESIGNS);
    const allowedIds = new Set(
        ARTISAN_PHASE_DEFS.filter((d) => d.isDesign).slice(0, designCount).map((d) => d.id)
    );
    return ARTISAN_PHASE_DEFS.find((def) => {
        if (def.isDesign && !allowedIds.has(def.id)) return false;
        return day >= def.dayStart && day <= def.dayEnd;
    }) || null;
}

function nextPendingDesignPhase(schedule) {
    const designCount = Math.min(ARTISAN_MAX_DESIGNS, Number(schedule?.designCount) || ARTISAN_MAX_DESIGNS);
    const designPhases = ARTISAN_PHASE_DEFS.filter((d) => d.isDesign).slice(0, designCount);
    for (const def of designPhases) {
        const stored = schedule.phases?.find((p) => p.id === def.id);
        if (!stored || (stored.status !== 'done' && stored.status !== 'skipped')) return def;
    }
    return null;
}

function computeNextUploadMs(schedule, phaseDef) {
    const gap = Math.max(1, Number(schedule.daysBetween) || 2);
    const start = parseIsoDate(schedule.startDate);
    if (!start || !phaseDef) return gap * 86400000;
    const targetDay = phaseDef.dayStart;
    const targetDate = new Date(start);
    targetDate.setDate(targetDate.getDate() + (targetDay - 1) * gap);
    targetDate.setHours(9, 0, 0, 0);
    const ms = targetDate.getTime() - Date.now();
    return ms > 60000 ? ms : 60000;
}

function isManualMode(schedule) {
    return String(schedule?.phaseAdvanceMode || schedule?.phaseMode || 'auto').toLowerCase() === 'manual';
}

function defaultPhases() {
    return ARTISAN_PHASE_DEFS.map((def) => ({
        id: def.id,
        status: 'pending',
        checklist: {},
        lastRunAt: null,
        nextRunAt: null,
    }));
}

function mergeAbortSignals(...signals) {
    const controller = new AbortController();
    for (const sig of signals) {
        if (!sig) continue;
        if (sig.aborted) {
            controller.abort(sig.reason);
            break;
        }
        sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
    }
    return controller.signal;
}

function stageRunKey(email, stageId) {
    return `${normEmail(email)}|${String(stageId || '').trim()}`;
}

function getStageAbortSignal(email, stageId) {
    return activeStageRuns.get(stageRunKey(email, stageId))?.abortController?.signal || null;
}

function isStageStopRequested(email, stageId) {
    const run = activeStageRuns.get(stageRunKey(email, stageId));
    return !!(run?.stopRequested || run?.abortController?.signal?.aborted);
}

function collectPhasesFromStageOnward(stageId) {
    const stageIdx = WORKFLOW_STAGES.findIndex((s) => s.id === stageId);
    const ids = new Set();
    if (stageIdx >= 0) {
        for (let i = stageIdx; i < WORKFLOW_STAGES.length; i += 1) {
            WORKFLOW_STAGES[i].phaseIds.forEach((pid) => ids.add(pid));
        }
    }
    return [...ids];
}

async function releaseGhostProfileLock(email) {
    const normalized = normEmail(email);
    try {
        const res = await fetch(`http://127.0.0.1:${GHOST_PORT}/release-profile-lock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalized, accountEmail: normalized }),
            signal: AbortSignal.timeout(25000),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            orchLog(normalized, `⚠️ Profile lock release: ${data.error || res.statusText}`, 'warn');
        } else {
            orchLog(normalized, '🔓 Profile lock released / تم تحرير قفل المتصفح', 'info');
        }
        return data;
    } catch (err) {
        orchLog(normalized, `⚠️ Profile lock release failed: ${err.message}`, 'warn');
        return { ok: false, error: String(err.message || err) };
    }
}

function phaseScheduledAt(schedule, phaseDef) {
    const start = parseIsoDate(schedule?.startDate);
    if (!start || !phaseDef) return null;
    const gap = Math.max(1, Number(schedule.daysBetween) || 2);
    const targetDate = new Date(start);
    targetDate.setDate(targetDate.getDate() + (phaseDef.dayStart - 1) * gap);
    targetDate.setHours(9, 0, 0, 0);
    return targetDate.toISOString();
}

function computePhaseNextRunAt(schedule, phaseId) {
    const phase = schedule?.phases?.find((p) => p.id === phaseId);
    if (!phase) return null;
    if (phase.status === 'done' || phase.status === 'skipped') return null;
    if (phase.status === 'running') return null;
    const phaseDef = ARTISAN_PHASE_DEFS.find((p) => p.id === phaseId);
    if (!phaseDef) return null;
    if (phase.lastRunAt && (phase.status === 'failed' || phase.status === 'stopped')) {
        return new Date(Date.now() + RETRY_DELAY_MS).toISOString();
    }
    return phaseScheduledAt(schedule, phaseDef);
}

function refreshPhaseScheduleTimes(schedule) {
    if (!schedule?.phases) return schedule;
    schedule.phases = schedule.phases.map((phase) => ({
        ...phase,
        nextRunAt: computePhaseNextRunAt(schedule, phase.id),
    }));
    return schedule;
}

function markPhaseRunning(schedule, email, phaseId, stageId) {
    const phase = schedule.phases?.find((p) => p.id === phaseId);
    if (!phase) return;
    if (isStageStopRequested(email, stageId)) return;
    phase.status = 'running';
    phase.lastRunAt = new Date().toISOString();
    phase.nextRunAt = null;
    schedules.set(normEmail(email), schedule);
    persistSchedules();
}

function markPhaseStopped(schedule, email, phaseIds) {
    for (const phaseId of phaseIds) {
        const phase = schedule.phases?.find((p) => p.id === phaseId);
        if (!phase || phase.status !== 'running') continue;
        phase.status = 'stopped';
        phase.lastRunAt = new Date().toISOString();
        phase.nextRunAt = computePhaseNextRunAt(schedule, phaseId);
    }
    schedule.lastError = 'stopped_by_user';
    schedules.set(normEmail(email), schedule);
    refreshPhaseScheduleTimes(schedule);
    persistSchedules();
}

function markPhaseFailed(schedule, email, phaseId, error) {
    const phase = schedule.phases?.find((p) => p.id === phaseId);
    if (!phase) return;
    phase.status = 'failed';
    phase.lastRunAt = new Date().toISOString();
    phase.nextRunAt = computePhaseNextRunAt(schedule, phaseId);
    schedule.lastError = String(error || 'phase_failed');
    schedules.set(normEmail(email), schedule);
    refreshPhaseScheduleTimes(schedule);
    persistSchedules();
}

function isFoundationVerified(schedule) {
    const phase = schedule?.phases?.find((p) => p.id === 'foundation');
    if (!phase) return false;
    if (phase.status === 'skipped') return true;
    if (phase.status === 'incomplete' || phase.status === 'pending'
        || phase.status === 'running' || phase.status === 'failed' || phase.status === 'stopped') {
        return false;
    }
    if (phase.status !== 'done') return false;
    if (schedule?.skipStoreSetup) return true;
    return !!schedule?.storeProfileAppliedAt;
}

function markPhaseDone(schedule, email, phaseId, reason) {
    const phase = schedule.phases?.find((p) => p.id === phaseId);
    if (!phase) return;
    phase.status = 'done';
    phase.lastRunAt = new Date().toISOString();
    phase.nextRunAt = null;
    phase.doneReason = String(reason || 'manual_stage_run');
    schedules.set(normEmail(email), schedule);
    refreshPhaseScheduleTimes(schedule);
    persistSchedules();
    orchLog(email, `✅ Phase ${phaseId} done — ${reason} / اكتملت المرحلة`, 'success');
}

function persistSchedules() {
    if (!persistPath) return;
    try {
        const dir = path.dirname(persistPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const obj = {};
        schedules.forEach((v, k) => { obj[k] = v; });
        fs.writeFileSync(persistPath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
        logFn(`Persist failed: ${err.message}`, 'WARN');
    }
}

function loadPersistedSchedules() {
    if (!persistPath || !fs.existsSync(persistPath)) return;
    try {
        const raw = JSON.parse(fs.readFileSync(persistPath, 'utf8'));
        Object.entries(raw || {}).forEach(([email, schedule]) => {
            schedules.set(normEmail(email), schedule);
            if (schedule?.started && !schedule.paused && schedule.automationEnabled && !isManualMode(schedule)) {
                restoreTimerForEmail(normEmail(email));
            }
        });
        logFn(`Restored ${schedules.size} orchestrate schedule(s)`, 'INFO');
    } catch (err) {
        logFn(`Load schedules failed: ${err.message}`, 'WARN');
    }
}

function clearTimer(email) {
    const key = normEmail(email);
    const t = timers.get(key);
    if (t) {
        clearTimeout(t);
        timers.delete(key);
    }
}

function scheduleTimer(email, delayMs, reason = '') {
    const key = normEmail(email);
    clearTimer(key);
    const ms = Math.max(5000, Number(delayMs) || 60000);
    const timer = setTimeout(() => {
        timers.delete(key);
        void tickAccount(key, { source: reason || 'timer' }).catch((err) => {
            orchLog(key, `Timer tick error: ${err.message}`, 'error');
        });
    }, ms);
    timers.set(key, timer);
    const schedule = schedules.get(key);
    if (schedule) {
        schedule.nextUploadAt = new Date(Date.now() + ms).toISOString();
        schedules.set(key, schedule);
        persistSchedules();
    }
}

function restoreTimerForEmail(email) {
    const schedule = schedules.get(normEmail(email));
    if (!schedule?.started || schedule.paused || !schedule.automationEnabled) return;
    if (isManualMode(schedule) && schedule.awaitingPhaseAdvance) return;
    const nextPhase = nextPendingDesignPhase(schedule);
    const foundation = schedule.phases?.find((p) => p.id === 'foundation');
    const foundationPending = foundation && foundation.status !== 'done' && foundation.status !== 'skipped';
    let ms = 60000;
    if (foundationPending) ms = 5000;
    else if (schedule.nextUploadAt) {
        ms = Math.max(60000, new Date(schedule.nextUploadAt).getTime() - Date.now());
    } else if (nextPhase) {
        ms = computeNextUploadMs(schedule, nextPhase);
    }
    scheduleTimer(email, ms, 'restore');
}

const DEFAULT_SHOW_BROWSER = process.platform === 'win32'
    && process.env.NHP_HEADLESS !== '1'
    && process.env.CREATTY_HEADLESS !== '1';

function resolveGhostVisual(options = {}) {
    if (options.isVisual === true) return true;
    if (options.isVisual === false) return false;
    return DEFAULT_SHOW_BROWSER;
}

async function pingGhost(port = GHOST_PORT) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/ping`, { signal: AbortSignal.timeout(3500) });
        return res.ok;
    } catch (_) {
        return false;
    }
}

async function applyStoreProfileViaGhost(account, storeProfile, port = GHOST_PORT, options = {}) {
    const url = `http://127.0.0.1:${port}/apply-store-profile`;
    const signals = [AbortSignal.timeout(3600000)];
    if (options.signal) signals.push(options.signal);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            account: { email: account.email, pass: account.pass, storeProfile },
            storeProfile,
            isVisual: resolveGhostVisual(options),
            platform: 'teepublic',
        }),
        signal: mergeAbortSignals(...signals),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success !== true) {
        const detail = data?.error || res.statusText || String(res.status);
        throw new Error(`Ghost store profile failed (${res.status}) at ${url}: ${detail}`);
    }
    const titleApplied = data?.appliedFields?.title === true || !!String(data?.title || '').trim();
    if (!titleApplied) {
        throw new Error('Ghost store profile not verified — title not applied on TeePublic');
    }
    return data;
}

async function uploadDesignViaGhost(account, design, schedule, options = {}) {
    const port = schedule.ghostPort || GHOST_PORT;
    const storeProfile = options.storeProfile || account.storeProfile || schedule.storeProfile || null;
    const designIndex = Number(options.designIndex);
    const designTotal = Number(options.designTotal) || ARTISAN_MAX_DESIGNS;
    const title = design.title || design.filename || 'Untitled';
    const posLabel = Number.isFinite(designIndex)
        ? `Upload design ${designIndex + 1}/${designTotal} — ${title}`
        : `Upload design: ${title}`;
    orchLog(account.email, `⏳ ${posLabel} / جارٍ الرفع…`, 'info');

    if (!design.base64) throw new Error('Design base64 missing in payload');

    const tags = Array.isArray(design.tags) ? design.tags : [];
    const payload = {
        account: { email: account.email, pass: account.pass, storeProfile },
        designs: [{
            queueItemId: `creaty_orch_${design.id}_${Date.now()}`,
            file: { name: design.filename || 'design.png', type: design.mimeType || 'image/png' },
            base64: design.base64,
            meta: {
                title,
                description: design.description || storeProfile?.title || '',
                tags: tags.slice(0, 15),
                mainTag: design.mainTag || tags[0] || '',
                niche: design.niche || schedule.niche || '',
                storeTitle: storeProfile?.title || '',
            },
        }],
        actionType: 'publish',
        defaultColor: 'Black',
        isVisual: resolveGhostVisual(options),
        platform: 'teepublic',
        storeProfile,
        applyStoreProfileFirst: options.applyStoreProfileFirst === true,
        foundationEntry: options.foundationEntry === true,
    };

    const signals = [AbortSignal.timeout(3600000)];
    if (options.signal) signals.push(options.signal);
    const res = await fetch(`http://127.0.0.1:${port}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: mergeAbortSignals(...signals),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(body || `Ghost upload failed (${res.status})`);
    }
    return { success: true };
}

async function completeFoundationPhase(schedule, email, options = {}) {
    const phase = schedule.phases?.find((p) => p.id === 'foundation');
    if (!phase || phase.status === 'done' || phase.status === 'skipped') return;

    if (isStageStopRequested(email, options.stageId)) {
        markPhaseStopped(schedule, email, ['foundation']);
        throw new Error('stopped_by_user');
    }

    if (schedule.skipStoreSetup) {
        orchLog(email, 'Skip foundation — store already set / تخطي التأسيس', 'info');
        markPhaseDone(schedule, email, 'foundation', 'skip_store_setup');
        schedule.currentDay = Math.max(schedule.currentDay || 1, 3);
        schedule.retryCount = 0;
        schedule.scheduleReady = true;
        refreshPhaseScheduleTimes(schedule);
        schedules.set(normEmail(email), schedule);
        persistSchedules();
        return;
    } else {
        const storeProfile = schedule.storeProfile || schedule.account?.storeProfile || null;
        if (!storeProfile?.title) {
            orchLog(email, '⚠️ No store profile / لا يوجد ملف متجر', 'warn');
            schedule.lastError = 'store_profile_missing';
            markPhaseFailed(schedule, email, 'foundation', 'store_profile_missing');
            scheduleTimer(email, RETRY_DELAY_MS, 'store_retry');
            return;
        }
        const design = schedule.quintet?.designs?.[0];
        if (!design?.base64) {
            orchLog(email, '⚠️ Design 1 missing / التصميم 1 غير موجود', 'warn');
            schedule.lastError = 'design1_blob_missing';
            markPhaseFailed(schedule, email, 'foundation', 'design1_blob_missing');
            scheduleTimer(email, RETRY_DELAY_MS, 'design_retry');
            return;
        }
        const account = schedule.account || { email, pass: schedule.accountPass || '' };
        const designCount = Math.min(ARTISAN_MAX_DESIGNS, Number(schedule.designCount) || ARTISAN_MAX_DESIGNS);
        try {
            orchLog(email, '⏳ Foundation: login → Sell Your Art → store → design 1', 'info');
            await uploadDesignViaGhost(account, design, schedule, {
                storeProfile,
                designIndex: 0,
                designTotal: designCount,
                foundationEntry: true,
                signal: options.signal,
            });
            const doneAt = new Date().toISOString();
            schedule.storeProfileAppliedAt = doneAt;
            schedule.storeProfileTitle = storeProfile.title;
            schedule.lastError = null;
            markPhaseDone(schedule, email, 'foundation', 'foundation_sell_art_upload');
            const design1Phase = schedule.phases?.find((p) => p.id === 'design1');
            if (design1Phase && design1Phase.status !== 'done' && design1Phase.status !== 'skipped') {
                design1Phase.status = 'done';
                design1Phase.lastRunAt = doneAt;
                design1Phase.doneReason = 'included_in_foundation';
            }
            if (!schedule.design1StartedAt) schedule.design1StartedAt = doneAt;
            schedule.uploadsCompleted = Math.max(schedule.uploadsCompleted || 0, 1);
            schedule.designUploadIndex = 1;
            schedule.lastUploadAt = doneAt;
            schedule.currentDay = Math.max(schedule.currentDay || 1, 3);
            schedule.retryCount = 0;
            schedule.scheduleReady = true;
            refreshPhaseScheduleTimes(schedule);
            schedules.set(normEmail(email), schedule);
            persistSchedules();
            orchLog(email, '✅ Foundation complete — store + design 1 / اكتمل التأسيس', 'success');
            return;
        } catch (err) {
            if (isStageStopRequested(email, options.stageId) || err?.name === 'AbortError') {
                markPhaseStopped(schedule, email, ['foundation']);
                throw new Error('stopped_by_user');
            }
            schedule.lastError = String(err.message || err);
            schedule.retryCount = (schedule.retryCount || 0) + 1;
            orchLog(email, `❌ Foundation failed: ${schedule.lastError}`, 'error');
            markPhaseFailed(schedule, email, 'foundation', schedule.lastError);
            if (schedule.retryCount < MAX_RETRY) scheduleTimer(email, RETRY_DELAY_MS, 'foundation_retry');
            else schedule.paused = true;
            return;
        }
    }
}

async function markDesignPhaseDone(schedule, email, phaseDef) {
    const phase = schedule.phases?.find((p) => p.id === phaseDef.id);
    const doneAt = new Date().toISOString();
    if (phase) {
        phase.status = 'done';
        phase.lastRunAt = doneAt;
        phase.nextRunAt = null;
    }
    if (phaseDef.id === 'design1' && !schedule.design1StartedAt) {
        schedule.design1StartedAt = doneAt;
    }
    schedule.uploadsCompleted = (schedule.uploadsCompleted || 0) + 1;
    schedule.designUploadIndex = (phaseDef.designIndex ?? 0) + 1;
    schedule.lastUploadAt = doneAt;
    schedule.lastError = null;
    schedule.retryCount = 0;
    schedule.currentDay = Math.max(schedule.currentDay || 1, phaseDef.dayEnd + 1);
    refreshPhaseScheduleTimes(schedule);
    schedules.set(normEmail(email), schedule);
    persistSchedules();
}

async function tickAccount(email, options = {}) {
    const key = normEmail(email);
    const schedule = schedules.get(key);
    if (!schedule?.started || schedule.paused) return { skipped: true };
    if (!schedule.automationEnabled && !options.manualAdvance) return { skipped: true };

    const account = schedule.account || { email: key, pass: schedule.accountPass || '' };
    const ghostOnline = await pingGhost(schedule.ghostPort || GHOST_PORT);
    if (!ghostOnline) {
        orchLog(key, `Ghost offline — retry in 15m / Ghost غير متصل`, 'warn');
        schedule.lastError = 'ghost_offline';
        schedules.set(key, schedule);
        persistSchedules();
        scheduleTimer(key, RETRY_DELAY_MS, 'ghost_retry');
        return { error: 'ghost_offline' };
    }

    const calendarDay = calendarDayFromSchedule(schedule);
    const foundationPhase = schedule.phases?.find((p) => p.id === 'foundation');
    const foundationPending = foundationPhase && foundationPhase.status !== 'done' && foundationPhase.status !== 'skipped';

    if (foundationPending) {
        await completeFoundationPhase(schedule, key);
        const reloaded = schedules.get(key);
        const foundationAfter = reloaded?.phases?.find((p) => p.id === 'foundation');
        const foundationDone = foundationAfter?.status === 'done' || foundationAfter?.status === 'skipped';
        if (!foundationDone || reloaded?.paused) return { phase: 'foundation', done: foundationDone };

        const nextDesignPhase = nextPendingDesignPhase(reloaded);
        if (nextDesignPhase) {
            if (isManualMode(reloaded)) {
                reloaded.awaitingPhaseAdvance = nextDesignPhase.id;
                reloaded.automationEnabled = false;
                schedules.set(key, reloaded);
                persistSchedules();
                orchLog(key, `📋 Manual — next: ${nextDesignPhase.id} / انتظر «المرحلة التالية»`, 'info');
            } else {
                scheduleTimer(key, computeNextUploadMs(reloaded, nextDesignPhase), 'after_foundation');
            }
        }
        return { phase: 'foundation', done: true };
    }

    const targetPhase = nextPendingDesignPhase(schedule);
    if (!targetPhase) {
        orchLog(key, '✅ Artisan plan complete / اكتملت الخطة', 'success');
        schedule.automationEnabled = false;
        schedules.set(key, schedule);
        persistSchedules();
        clearTimer(key);
        return { complete: true };
    }

    if (!options.manualAdvance && calendarDay < targetPhase.dayStart && !options.force) {
        if (isManualMode(schedule)) {
            schedule.awaitingPhaseAdvance = targetPhase.id;
            schedule.automationEnabled = false;
            schedules.set(key, schedule);
            persistSchedules();
            orchLog(key, `🔔 Phase due (manual): ${targetPhase.id}`, 'warn');
            return { awaitingManual: targetPhase.id };
        }
        scheduleTimer(key, computeNextUploadMs(schedule, targetPhase), 'wait_calendar');
        return { waiting: targetPhase.id };
    }

    const quintet = schedule.quintet;
    const designIndex = targetPhase.designIndex ?? 0;
    const design = quintet?.designs?.[designIndex];
    if (!design) {
        orchLog(key, '⛔ Design missing in quintet / التصميم غير موجود', 'error');
        schedule.paused = true;
        schedule.lastError = 'design_missing';
        schedules.set(key, schedule);
        persistSchedules();
        return { error: 'design_missing' };
    }

    const storeProfile = schedule.storeProfile || account.storeProfile || null;
    const designCount = Math.min(ARTISAN_MAX_DESIGNS, Number(schedule.designCount) || ARTISAN_MAX_DESIGNS);

    try {
        await uploadDesignViaGhost(account, design, schedule, {
            storeProfile,
            designIndex,
            designTotal: designCount,
            applyStoreProfileFirst: designIndex === 0 && !schedule.storeProfileAppliedAt,
        });
        await markDesignPhaseDone(schedule, key, targetPhase);
        orchLog(key, `✅ Design ${designIndex + 1}/${designCount} uploaded / تم الرفع`, 'success');

        const updated = schedules.get(key);
        const nextPhase = nextPendingDesignPhase(updated);
        updated.awaitingPhaseAdvance = null;
        if (nextPhase) {
            if (isManualMode(updated)) {
                updated.awaitingPhaseAdvance = nextPhase.id;
                updated.automationEnabled = false;
                schedules.set(key, updated);
                persistSchedules();
                orchLog(key, `📋 Manual — next: ${nextPhase.id}`, 'info');
            } else {
                const gap = Math.max(1, Number(updated.daysBetween) || 2);
                updated.automationEnabled = true;
                schedules.set(key, updated);
                persistSchedules();
                scheduleTimer(key, gap * 86400000, 'after_upload');
            }
        } else {
            updated.automationEnabled = false;
            schedules.set(key, updated);
            persistSchedules();
            clearTimer(key);
        }
        return { phase: targetPhase.id, done: true };
    } catch (err) {
        const retry = (schedule.retryCount || 0) + 1;
        schedule.retryCount = retry;
        schedule.lastError = String(err.message || err);
        orchLog(key, `❌ Upload failed (${retry}/${MAX_RETRY}): ${schedule.lastError}`, 'error');
        schedules.set(key, schedule);
        persistSchedules();
        if (retry < MAX_RETRY) scheduleTimer(key, RETRY_DELAY_MS, 'upload_retry');
        else schedule.paused = true;
        return { error: schedule.lastError };
    }
}

function initScheduleFromAccountPayload(accountPayload, options = {}) {
    const email = normEmail(accountPayload.email);
    const phaseMode = String(options.phaseMode || options.mode || 'auto').toLowerCase() === 'manual' ? 'manual' : 'auto';
    let schedule = schedules.get(email);
    if (!schedule) {
        schedule = {
            accountEmail: email,
            niche: String(options.niche || accountPayload.niche || accountPayload.storeProfile?.niche || '').trim(),
            startDate: options.startDate || new Date().toISOString().slice(0, 10),
            daysBetween: Math.min(7, Math.max(1, Number(options.daysBetween) || 2)),
            designCount: Math.min(ARTISAN_MAX_DESIGNS, Math.max(1, Number(options.designCount) || ARTISAN_MAX_DESIGNS)),
            started: false,
            paused: false,
            currentDay: 1,
            phases: defaultPhases(),
        };
    }
    schedule.accountEmail = email;
    schedule.account = { email, pass: accountPayload.pass || accountPayload.password || '' };
    schedule.accountPass = schedule.account.pass;
    if (accountPayload.storeProfile) {
        const prev = schedule.storeProfile || {};
        const incoming = accountPayload.storeProfile;
        schedule.storeProfile = {
            ...prev,
            ...incoming,
            avatarDataUrl: incoming.avatarDataUrl || prev.avatarDataUrl || null,
            coverDataUrl: incoming.coverDataUrl || prev.coverDataUrl || null,
        };
    } else if (!schedule.storeProfile) {
        schedule.storeProfile = null;
    }
    if (accountPayload.quintet?.designs?.length) {
        const prevDesigns = schedule.quintet?.designs || [];
        schedule.quintet = {
            ...accountPayload.quintet,
            designs: accountPayload.quintet.designs.map((d, idx) => {
                const prev = prevDesigns.find((p) => p.id === d.id) || prevDesigns[idx];
                return {
                    ...(prev || {}),
                    ...d,
                    base64: d.base64 || prev?.base64 || '',
                };
            }),
        };
    } else if (!schedule.quintet) {
        schedule.quintet = null;
    }
    schedule.groupId = accountPayload.quintet?.groupId || schedule.groupId || null;
    schedule.niche = String(options.niche || accountPayload.niche || schedule.niche || schedule.storeProfile?.niche || '').trim();
    schedule.startDate = options.startDate || schedule.startDate;
    schedule.daysBetween = Math.min(7, Math.max(1, Number(options.daysBetween) || schedule.daysBetween || 2));
    schedule.designCount = Math.min(ARTISAN_MAX_DESIGNS, Math.max(1, Number(options.designCount) || schedule.designCount || ARTISAN_MAX_DESIGNS));
    schedule.skipStoreSetup = options.skipStoreSetup === true;
    schedule.phaseAdvanceMode = phaseMode;
    schedule.phaseMode = phaseMode;
    schedule.ghostPort = Number(options.ghostPort) || GHOST_PORT;
    schedule.storeProfileTitle = schedule.storeProfile?.title || schedule.storeProfileTitle || '';
    schedule.scheduleReady = true;
    schedule.updatedAt = new Date().toISOString();
    return schedule;
}

async function prepareAccounts(body = {}) {
    const accounts = Array.isArray(body.accounts) ? body.accounts : [];
    const options = body.options && typeof body.options === 'object' ? body.options : {};
    const prepareOnly = options.prepareOnly === true;
    // Batch/smart prepare only loads schedule data — foundation runs via workflow «بدء» only
    const startPhase1 = false;
    const phaseMode = 'manual';

    if (!accounts.length) {
        return { ok: false, error: 'accounts_required' };
    }

    const ghostOnline = await pingGhost(Number(options.ghostPort) || GHOST_PORT);

    const results = [];
    for (const acc of accounts) {
        const email = normEmail(acc.email);
        if (!email) {
            results.push({ email: '', success: false, error: 'email_required' });
            continue;
        }

        orchLog(email, `🚀 Prepare start / بدء التهيئة (${phaseMode})`, 'info');

        if (!acc.quintet?.designs?.length || acc.quintet.designs.length < GROUP_SIZE) {
            orchLog(email, '⛔ Quintet missing in payload / quintet غير مكتمل', 'error');
            results.push({ email, success: false, error: 'quintet_required' });
            continue;
        }
        if (!acc.storeProfile?.title && !options.skipStoreSetup) {
            orchLog(email, '⛔ Store profile missing / ملف المتجر غير موجود', 'error');
            results.push({ email, success: false, error: 'store_profile_required' });
            continue;
        }

        const schedule = initScheduleFromAccountPayload(acc, { ...options, phaseMode });
        schedule.started = !prepareOnly;
        schedule.paused = prepareOnly;
        schedule.automationEnabled = false;
        schedule.awaitingPhaseAdvance = null;
        refreshPhaseScheduleTimes(schedule);
        schedules.set(email, schedule);
        persistSchedules();

        orchLog(email, prepareOnly
            ? '✅ Marked schedule-ready (prepare only) / جاهز — بدون بدء'
            : '✅ Schedule ready — start stages manually / جاهز — ابدأ المراحل يدوياً', 'success');
        results.push({
            email,
            success: true,
            prepareOnly,
            scheduleReady: true,
            schedule: sanitizeScheduleForClient(schedules.get(email)),
        });
    }

    const okCount = results.filter((r) => r.success).length;
    orchLog(null, `🎯 Prepare batch: ${okCount}/${results.length} / اكتملت ${okCount}/${results.length}`, okCount ? 'info' : 'warn');

    return {
        ok: okCount > 0,
        started: okCount,
        total: results.length,
        phaseMode,
        prepareOnly,
        startPhase1,
        results,
        ghostOnline,
    };
}

async function runFoundationPhase(email, options = {}) {
    const key = normEmail(email);
    let schedule = schedules.get(key);
    if (!schedule) return { ok: false, error: 'schedule_not_found' };

    schedule.started = true;
    schedule.paused = false;
    schedule.automationEnabled = true;
    schedules.set(key, schedule);
    persistSchedules();

    const ghostOnline = await pingGhost(schedule.ghostPort || GHOST_PORT);
    if (!ghostOnline) return { ok: false, error: 'ghost_offline' };

    const foundation = schedule.phases?.find((p) => p.id === 'foundation');
    if (foundation?.status === 'skipped' || (foundation?.status === 'done' && isFoundationVerified(schedule))) {
        return { ok: true, phase: 'foundation', done: true, skipped: true };
    }
    if (foundation?.status === 'done' && !isFoundationVerified(schedule)) {
        foundation.status = 'incomplete';
        schedule.storeProfileAppliedAt = null;
        schedules.set(key, schedule);
        persistSchedules();
        orchLog(key, '↩️ Foundation marked done without Ghost verify — re-running / إعادة التأسيس', 'warn');
    }

    if (!schedule.skipStoreSetup) {
        const accountPass = String(schedule.account?.pass || schedule.accountPass || '').trim();
        const storeTitle = String(schedule.storeProfile?.title || schedule.account?.storeProfile?.title || '').trim();
        if (!accountPass) {
            orchLog(key, '⛔ Missing account password / كلمة المرور غير موجودة', 'error');
            markPhaseFailed(schedule, key, 'foundation', 'account_credentials_missing');
            return { ok: false, phase: 'foundation', error: 'account_credentials_missing' };
        }
        if (!storeTitle) {
            orchLog(key, '⛔ Missing store profile / ملف المتجر غير موجود', 'error');
            markPhaseFailed(schedule, key, 'foundation', 'store_profile_missing');
            return { ok: false, phase: 'foundation', error: 'store_profile_missing' };
        }
        orchLog(key, '⏳ Foundation: login → Sell Your Art → store → design 1', 'info');
    }

    markPhaseRunning(schedule, key, 'foundation', options.stageId || 'foundation');
    try {
        await completeFoundationPhase(schedule, key, options);
    } catch (err) {
        if (String(err.message || err) === 'stopped_by_user') {
            return { ok: false, phase: 'foundation', stopped: true, error: 'stopped_by_user' };
        }
        throw err;
    }
    const updated = schedules.get(key);
    const foundationAfter = updated?.phases?.find((p) => p.id === 'foundation');
    const done = foundationAfter?.status === 'done' || foundationAfter?.status === 'skipped';
    const stopped = foundationAfter?.status === 'stopped';
    return {
        ok: done,
        phase: 'foundation',
        done,
        stopped,
        error: done ? null : (updated?.lastError || 'foundation_failed'),
    };
}

async function runDesignPhaseById(email, phaseId, options = {}) {
    const key = normEmail(email);
    const schedule = schedules.get(key);
    if (!schedule) return { ok: false, error: 'schedule_not_found' };

    const phaseDef = ARTISAN_PHASE_DEFS.find((p) => p.id === phaseId);
    if (!phaseDef?.isDesign) return { ok: false, error: 'invalid_design_phase' };

    const stored = schedule.phases?.find((p) => p.id === phaseId);
    if (stored?.status === 'done' || stored?.status === 'skipped') {
        return { ok: true, phase: phaseId, done: true, skipped: true };
    }

    if (!isFoundationVerified(schedule)) return { ok: false, error: 'foundation_not_complete' };

    const ghostOnline = await pingGhost(schedule.ghostPort || GHOST_PORT);
    if (!ghostOnline) return { ok: false, error: 'ghost_offline' };

    const account = schedule.account || { email: key, pass: schedule.accountPass || '' };
    const designIndex = phaseDef.designIndex ?? 0;
    const design = schedule.quintet?.designs?.[designIndex];
    if (!design) return { ok: false, error: 'design_missing' };
    if (!design.base64) return { ok: false, error: 'design_blob_missing' };

    const storeProfile = schedule.storeProfile || account.storeProfile || null;
    const designCount = Math.min(ARTISAN_MAX_DESIGNS, Number(schedule.designCount) || ARTISAN_MAX_DESIGNS);

    markPhaseRunning(schedule, key, phaseId, options.stageId || phaseId);
    if (phaseId === 'design1' && !schedule.design1StartedAt) {
        schedule.design1StartedAt = new Date().toISOString();
        schedules.set(key, schedule);
        persistSchedules();
    }

    try {
        if (isStageStopRequested(key, options.stageId)) {
            markPhaseStopped(schedule, key, [phaseId]);
            return { ok: false, phase: phaseId, stopped: true, error: 'stopped_by_user' };
        }
        await uploadDesignViaGhost(account, design, schedule, {
            storeProfile,
            designIndex,
            designTotal: designCount,
            applyStoreProfileFirst: designIndex === 0 && !schedule.storeProfileAppliedAt,
            signal: options.signal,
        });
        await markDesignPhaseDone(schedule, key, phaseDef);
        orchLog(key, `✅ Stage upload: ${phaseId} / تم رفع ${phaseId}`, 'success');
        return { ok: true, phase: phaseId, done: true };
    } catch (err) {
        if (isStageStopRequested(key, options.stageId) || err?.name === 'AbortError') {
            markPhaseStopped(schedule, key, [phaseId]);
            return { ok: false, phase: phaseId, stopped: true, error: 'stopped_by_user' };
        }
        schedule.retryCount = (schedule.retryCount || 0) + 1;
        schedule.lastError = String(err.message || err);
        orchLog(key, `❌ Stage upload failed: ${schedule.lastError}`, 'error');
        markPhaseFailed(schedule, key, phaseId, schedule.lastError);
        return { ok: false, phase: phaseId, error: schedule.lastError };
    }
}

async function runStage(body = {}) {
    const email = normEmail(body.email || body.accountEmail);
    const stageId = String(body.stageId || body.stage || '').trim();
    if (!email || !stageId) return { ok: false, error: 'email_and_stage_required' };

    const stageDef = WORKFLOW_STAGES.find((s) => s.id === stageId);
    if (!stageDef) return { ok: false, error: 'unknown_stage' };

    let schedule = schedules.get(email);
    if (!schedule) return { ok: false, error: 'schedule_not_prepared', hint: 'prepare_account_first' };

    if (stageDef.phaseIds.includes('foundation')) {
        const ghostOnline = await pingGhost(schedule.ghostPort || GHOST_PORT);
        if (!ghostOnline) return { ok: false, error: 'ghost_offline', ghostPort: schedule.ghostPort || GHOST_PORT };
    }

    schedule.started = true;
    schedule.paused = false;
    schedule.awaitingPhaseAdvance = null;
    schedules.set(email, schedule);
    persistSchedules();

    const runKeyStr = stageRunKey(email, stageId);
    const abortController = new AbortController();
    activeStageRuns.set(runKeyStr, { abortController, stopRequested: false });
    const runOptions = { stageId, signal: abortController.signal };

    orchLog(email, `▶️ Run stage ${stageId} / بدء المرحلة ${stageId}`, 'info');

    const phaseResults = [];
    try {
        for (const phaseId of stageDef.phaseIds) {
            if (isStageStopRequested(email, stageId)) {
                markPhaseStopped(schedules.get(email) || schedule, email, [phaseId]);
                phaseResults.push({ phaseId, ok: false, stopped: true, error: 'stopped_by_user' });
                break;
            }
            const result = phaseId === 'foundation'
                ? await runFoundationPhase(email, runOptions)
                : await runDesignPhaseById(email, phaseId, runOptions);
            phaseResults.push({ phaseId, ...result });
            if (!result.ok && !result.skipped) break;
        }
    } finally {
        activeStageRuns.delete(runKeyStr);
    }

    const allOk = phaseResults.every((r) => r.ok || r.skipped);
    const stopped = phaseResults.some((r) => r.stopped);
    const failed = phaseResults.find((r) => !r.ok && !r.skipped && !r.stopped);
    const updated = schedules.get(email);
    refreshPhaseScheduleTimes(updated);
    persistSchedules();
    return {
        ok: allOk,
        email,
        stageId,
        stopped,
        error: stopped ? 'stopped_by_user' : (failed?.error || null),
        results: phaseResults,
        schedule: sanitizeScheduleForClient(updated),
    };
}

async function stopStage(body = {}) {
    const email = normEmail(body.email || body.accountEmail);
    const stageId = String(body.stageId || body.stage || '').trim();
    if (!email || !stageId) return { ok: false, error: 'email_and_stage_required' };

    const stageDef = WORKFLOW_STAGES.find((s) => s.id === stageId);
    if (!stageDef) return { ok: false, error: 'unknown_stage' };

    const runKeyStr = stageRunKey(email, stageId);
    const active = activeStageRuns.get(runKeyStr);
    if (active) {
        active.stopRequested = true;
        try { active.abortController.abort(); } catch (_) { /* ignore */ }
    }

    const schedule = schedules.get(email);
    if (schedule) {
        markPhaseStopped(schedule, email, stageDef.phaseIds);
        orchLog(email, `⏹️ Stage stopped ${stageId} / تم إيقاف المرحلة`, 'warn');
    }

    return {
        ok: true,
        stopped: true,
        email,
        stageId,
        wasRunning: !!active,
        schedule: sanitizeScheduleForClient(schedules.get(email)),
    };
}

async function resetPhase(body = {}) {
    const email = normEmail(body.email || body.accountEmail);
    const stageOrPhase = String(body.phaseId || body.stageId || '').trim();
    if (!email || !stageOrPhase) return { ok: false, error: 'email_and_phase_required' };

    const schedule = schedules.get(email);
    if (!schedule) return { ok: false, error: 'schedule_not_found' };

    const stageDef = WORKFLOW_STAGES.find((s) => s.id === stageOrPhase);
    const phaseIds = stageDef
        ? collectPhasesFromStageOnward(stageOrPhase)
        : [stageOrPhase];

    if (stageDef) {
        await stopStage({ email, accountEmail: email, stageId: stageOrPhase });
    }
    await releaseGhostProfileLock(email);

    for (const phaseId of phaseIds) {
        const phase = schedule.phases?.find((p) => p.id === phaseId);
        if (!phase) continue;
        phase.status = 'pending';
        phase.lastRunAt = null;
        phase.nextRunAt = null;
        phase.doneReason = null;
    }
    if (phaseIds.includes('foundation')) {
        schedule.storeProfileAppliedAt = null;
        schedule.storeProfileTitle = schedule.storeProfile?.title || schedule.storeProfileTitle || '';
        schedule.design1StartedAt = null;
        schedule.uploadsCompleted = 0;
        schedule.designUploadIndex = 0;
        schedule.lastUploadAt = null;
        const design1 = schedule.phases?.find((p) => p.id === 'design1');
        if (design1) {
            design1.status = 'pending';
            design1.lastRunAt = null;
            design1.nextRunAt = null;
            design1.doneReason = null;
        }
    }
    schedule.lastError = null;
    schedule.awaitingPhaseAdvance = null;
    schedule.retryCount = 0;
    schedules.set(email, schedule);
    refreshPhaseScheduleTimes(schedule);
    persistSchedules();
    orchLog(email, `↩️ Phase reset ${phaseIds.join(', ')} — pending / إعادة تعيين المرحلة`, 'warn');

    return {
        ok: true,
        email,
        phaseIds,
        schedule: sanitizeScheduleForClient(schedule),
    };
}

async function advancePhase(body = {}) {
    const email = normEmail(body.email || body.accountEmail);
    if (!email) return { ok: false, error: 'email_required' };

    const schedule = schedules.get(email);
    if (!schedule?.started) return { ok: false, error: 'schedule_not_started' };

    schedule.paused = false;
    schedule.automationEnabled = true;
    schedule.awaitingPhaseAdvance = null;
    schedules.set(email, schedule);
    persistSchedules();

    orchLog(email, '▶️ Manual advance phase / بدء المرحلة التالية', 'info');
    const tickResult = await tickAccount(email, { manualAdvance: true, force: true });
    const updated = schedules.get(email);

    return {
        ok: true,
        email,
        tickResult,
        schedule: sanitizeScheduleForClient(updated),
    };
}

function sanitizeScheduleForClient(schedule) {
    if (!schedule) return null;
    refreshPhaseScheduleTimes(schedule);
    const copy = { ...schedule, phases: (schedule.phases || []).map((p) => ({ ...p })) };
    if (copy.quintet?.designs) {
        copy.quintet = {
            ...copy.quintet,
            designs: copy.quintet.designs.map((d) => ({
                id: d.id,
                title: d.title,
                filename: d.filename,
                status: d.status,
                hasBase64: !!d.base64,
            })),
        };
    }
    if (copy.storeProfile) {
        const { avatarDataUrl, coverDataUrl, ...slimStore } = copy.storeProfile;
        copy.storeProfile = {
            ...slimStore,
            hasAvatar: !!avatarDataUrl,
            hasCover: !!coverDataUrl,
        };
    }
    delete copy.account;
    return copy;
}

function getOrchestrateStatus(email = null) {
    if (email) {
        const key = normEmail(email);
        const schedule = schedules.get(key);
        return {
            ok: true,
            email: key,
            schedule: sanitizeScheduleForClient(schedule),
            activeTimers: timers.has(key),
            logs: recentLogs.filter((l) => l.email === key).slice(0, 30),
        };
    }
    const all = [];
    schedules.forEach((schedule, key) => {
        all.push({
            email: key,
            scheduleReady: !!schedule.scheduleReady,
            started: !!schedule.started,
            paused: !!schedule.paused,
            phaseMode: schedule.phaseAdvanceMode || 'auto',
            awaitingPhaseAdvance: schedule.awaitingPhaseAdvance || null,
            storeProfileTitle: schedule.storeProfileTitle || schedule.storeProfile?.title || '',
            currentDay: schedule.currentDay || 1,
            uploadsCompleted: schedule.uploadsCompleted || 0,
            lastError: schedule.lastError || null,
            nextUploadAt: schedule.nextUploadAt || null,
        });
    });
    return {
        ok: true,
        count: all.length,
        accounts: all,
        activeTimerCount: timers.size,
        recentLogs: recentLogs.slice(0, 40),
        ghostPort: GHOST_PORT,
    };
}

function getOrchestrateSummaryForStatus() {
    const st = getOrchestrateStatus();
    const running = st.accounts.filter((a) => a.started && !a.paused).length;
    const awaiting = st.accounts.filter((a) => a.awaitingPhaseAdvance).length;
    return {
        orchestrateCount: st.count,
        orchestrateRunning: running,
        orchestrateAwaitingManual: awaiting,
        orchestrateActiveTimers: timers.size,
    };
}

module.exports = {
    setOrchestratorPaths,
    setOrchestratorLogger,
    loadPersistedSchedules,
    prepareAccounts,
    advancePhase,
    resetPhase,
    runStage,
    stopStage,
    isFoundationVerified,
    getOrchestrateStatus,
    getOrchestrateSummaryForStatus,
    tickAccount,
    pingGhost,
    WORKFLOW_STAGES,
    GHOST_PORT,
};
