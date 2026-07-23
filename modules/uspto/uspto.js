// ══════════════════════════════════════════════════════
//  ████████  USPTO MODULE  ████████
// ══════════════════════════════════════════════════════

import { bindSearchToolsSyncStatus } from '../creaty/search-tools-sync-ui.js';
import {
    NHP_NICHE_CACHE_STORAGE_KEY,
    buildCacheFromStorageData,
    splitNichesByNicheCache,
} from '../../utils/niche-cache-ttl-shared.js';

let usptoAutoTransferred = false;
let usptoCompactUiAttached = false;
let usptoPanelBootstrapped = false;
let usptoModuleInitialized = false;
let usptoUpdateFingerprint = '';
let usptoHelpersRef = null;
/** Throttle Full-Auto programmatic starts — avoids tight refreshAll → click loops while storage flickers. */
let usptoFullAutoKickLastMs = 0;

/** Snapshot for activity log (avoid spamming refresh cycles). */
let usptoPrevSnap = null;

function isUsptoPanelActive() {
    return !!document.getElementById('panel-uspto')?.classList.contains('active');
}

function buildUsptoUpdateFingerprint(data) {
    const safe = data.uSafe || [];
    const banned = data.uBanned || [];
    const pending = data.uPending || [];
    const errors = data.uErrors || [];
    const total = data.uTotal || 0;
    const done = safe.length + banned.length + errors.length;
    return [
        data.uRunning ? '1' : '0',
        total,
        done,
        pending.length,
        data.uCurrent || '',
        safe.length,
        banned.length,
        data.usptoFastWorkerTarget || '',
        data.usptoFastWorkerActive || '',
        data.usptoRunMode || ''
    ].join('|');
}

function appendUsptoActivityLine(message) {
    const pre = document.getElementById('u-activityLog');
    if (!pre || !message) return;
    const ts = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const line = `[${ts}] ${message}`;
    pre.textContent = pre.textContent ? `${pre.textContent}\n${line}` : line;
    pre.scrollTop = pre.scrollHeight;
}

function updateInputDupHint() {
    const dupEl = document.getElementById('u-dupLineInput');
    if (!dupEl || !U.input) return;
    const raw = U.input.value.split('\n').map(l => l.trim()).filter(Boolean);
    const seen = new Set();
    let dupCount = 0;
    for (const line of raw) {
        const k = line.toLowerCase();
        if (seen.has(k)) dupCount++;
        else seen.add(k);
    }
    if (raw.length === 0) {
        dupEl.textContent = 'لا توجد أسطر بعد';
    } else if (dupCount === 0) {
        dupEl.textContent = `أسطر فريدة: ${seen.size}`;
    } else {
        dupEl.textContent = `أسطر فريدة: ${seen.size} — تكرارات في الإدخال: ${dupCount}`;
    }
}

function syncUsptoBottomPanel(data) {
    const footer = document.getElementById('u-scanSummaryFooter');
    const sumProg = document.getElementById('u-sumProgress');
    const sumSafe = document.getElementById('u-sumSafe');
    const sumBan = document.getElementById('u-sumBanned');
    const sumPend = document.getElementById('u-sumPending');

    const safe = data.uSafe || [];
    const banned = data.uBanned || [];
    const pending = data.uPending || [];
    const errors = data.uErrors || [];
    const total = data.uTotal || 0;
    const done = safe.length + banned.length + errors.length;
    const running = !!data.uRunning;

    if (sumProg) sumProg.textContent = total > 0 ? `${done} / ${total}` : '—';
    if (sumSafe) sumSafe.textContent = String(safe.length);
    if (sumBan) sumBan.textContent = String(banned.length);
    if (sumPend) sumPend.textContent = String(pending.length);

    if (footer) {
        if (!running && done === 0) {
            footer.textContent = 'أدخل النيتشات ثم اضغط «بدء الفحص». النتائج المحفوظة في الذاكرة تُستخدم تلقائياً لتسريع الفحص القادم.';
        } else if (running) {
            const cur = data.uCurrent ? `"${data.uCurrent}"` : '…';
            footer.textContent = `جاري المعالجة: ${cur} — تقدّم ${done} من ${total}. يمكن إيقاف الفحص مؤقتاً ثم الاستئناف لاحقاً.`;
        } else if (total > 0 && pending.length === 0 && done === total) {
            footer.textContent = `اكتمل الفحص: ${safe.length} آمنة، ${banned.length} محظورة، ${errors.length} أخطاء. استخدم التصدير أو انسخ القوائم أعلاه.`;
        } else if (total > 0) {
            footer.textContent = `متوقف مؤقتاً: تم فحص ${done} من ${total}. المتبقي ${pending.length}. يمكنك الاستئناف أو إنهاء ونقل الآمن إلى TeePublic.`;
        } else {
            footer.textContent = '';
        }
    }

    const snap = {
        running,
        current: data.uCurrent || '',
        done,
        total,
        pending: pending.length,
        safeN: safe.length,
        banN: banned.length,
        errorN: errors.length
    };

    if (!usptoPrevSnap) {
        usptoPrevSnap = snap;
        return;
    }
    const prev = usptoPrevSnap;
    if (prev.running !== snap.running) {
        appendUsptoActivityLine(snap.running ? '▶ بدء الفحص' : '⏹ توقف الفحص');
    }
    if (snap.running && snap.current && snap.current !== prev.current) {
        appendUsptoActivityLine(`فحص: ${snap.current}`);
    }
    if (prev.running && !snap.running && snap.total > 0 && snap.pending === 0 && snap.done === snap.total) {
        appendUsptoActivityLine(`✅ اكتمال — آمن ${snap.safeN} | محظور ${snap.banN} | أخطاء ${snap.errorN}`);
    }
    if (prev.running && !snap.running && snap.pending > 0) {
        appendUsptoActivityLine(`⏸ إيقاف مؤقت — متبقي ${snap.pending}`);
    }
    usptoPrevSnap = snap;
}

function attachUsptoCompactUi() {
    if (usptoCompactUiAttached) return;
    usptoCompactUiAttached = true;

    const panel = document.getElementById('panel-uspto');
    const startBtn = document.getElementById('u-startBtn');
    const resetBtn = document.getElementById('u-resetBtn');
    const inputToggleBtn = document.getElementById('u-inputToggleBtn');
    const logToggleBtn = document.getElementById('u-logToggleBtn');
    const logModal = document.getElementById('u-logModal');
    const logDialog = logModal ? logModal.querySelector('.u-log-dialog') : null;
    if (!panel || !startBtn) return;

    const collapseInput = () => {
        panel.classList.add('uspto-input-collapsed');
        inputToggleBtn?.classList.remove('hidden');
    };
    const toggleInput = () => panel.classList.toggle('uspto-input-collapsed');

    const openLog = () => {
        if (!logModal) return;
        logModal.classList.remove('hidden');
        logModal.setAttribute('aria-hidden', 'false');
    };
    const closeLog = () => {
        if (!logModal) return;
        logModal.classList.add('hidden');
        logModal.setAttribute('aria-hidden', 'true');
    };

    window.NHP_usptoCollapseInput = collapseInput;
    resetBtn?.addEventListener('click', () => {
        panel.classList.remove('uspto-input-collapsed');
    });
    inputToggleBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleInput();
    });
    logToggleBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLog();
    });
    logModal?.addEventListener('click', (e) => {
        if (!logDialog || !e.target.closest('.u-log-dialog')) closeLog();
    });
    logDialog?.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLog();
    });
}

const U = {
    startBtn: document.getElementById('u-startBtn'),
    stopBtn: document.getElementById('u-stopBtn'),
    resetBtn: document.getElementById('u-resetBtn'),
    clearBtn: document.getElementById('u-clearBtn'),
    input: document.getElementById('u-niches'),
    dotEl: document.getElementById('u-statusDot'),
    statusEl: document.getElementById('u-statusText'),
    badgeEl: document.getElementById('u-currentBadge'),
    barEl: document.getElementById('u-bar'),
    pctEl: document.getElementById('u-pct'),
    alertEl: document.getElementById('u-alert'),
    totalEl: document.getElementById('u-total'),
    safeEl: document.getElementById('u-safe'),
    bannedEl: document.getElementById('u-banned'),
    pendEl: document.getElementById('u-pend'),
    safeCountEl: document.getElementById('u-safeCount'),
    banCountEl: document.getElementById('u-bannedCount'),
    inputCountEl: document.getElementById('u-inputCount'),
    transferBtn: document.getElementById('u-transferBtn'),
    previewBtn: document.getElementById('u-previewBtn'),
    modeSelect: document.getElementById('u-runMode'),
    workerCountInput: document.getElementById('u-workerCount'),
    applyWorkersBtn: document.getElementById('u-applyWorkersBtn'),
    addWorkerBtn: document.getElementById('u-addWorkerBtn'),
    workerActiveEl: document.getElementById('u-workerActive')
};

function getUsptoWorkerInputValue() {
    const raw = parseInt(U.workerCountInput?.value || '4', 10);
    if (!Number.isFinite(raw)) return 4;
    return Math.max(1, Math.min(10, raw));
}

/**
 * Organize niches by splitting camelCase, trimming, and removing duplicates
 */
function formatNiches(inputId, countId, showToast) {
    const el = document.getElementById(inputId);
    if (!el) return;

    let text = el.value;
    text = text.replace(/([a-z])([A-Z])/g, '$1\n$2');
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const seen = new Set();
    const unique = lines.filter(line => {
        const key = line.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    el.value = unique.join('\n');
    el.dispatchEvent(new Event('input'));
    document.getElementById(countId).textContent = unique.length;
    if (showToast) showToast(`✅ تم تنظيم ${unique.length} نيتش!`);
}

function handleUsptoPipelineSideEffects(data, helpers) {
    const { showToast } = helpers;
    if (!window.__nhpInitComplete || !U.startBtn) return;

    const safe = data.uSafe || [];
    const pending = data.uPending || [];
    const errors = data.uErrors || [];
    const total = data.uTotal || 0;
    const running = data.uRunning || false;
    const done = safe.length + (data.uBanned || []).length + errors.length;

    if (data.isFullAuto && !running && (done === 0 || pending.length > 0) && total > 0) {
        const now = Date.now();
        if (now - usptoFullAutoKickLastMs >= 2800) {
            usptoFullAutoKickLastMs = now;
            queueMicrotask(() => {
                try {
                    U.startBtn.click();
                } catch (e) {
                    console.warn('USPTO full-auto kick:', e);
                }
            });
        }
    }

    if (!running && done === total && total > 0 && !usptoAutoTransferred && safe.length > 0) {
        usptoAutoTransferred = true;
        const tpNichesInput = document.getElementById('tp-niches');
        if (tpNichesInput) {
            tpNichesInput.value = safe.join('\n');
            const countEl = document.getElementById('tp-inputCount');
            if (countEl) countEl.textContent = safe.length;
            showToast('✅ اكتمل الفحص! تم نقل النيتشات الآمنة للتحليل...');
            setTimeout(() => {
                setTimeout(() => {
                    const tpStart = document.getElementById('tp-startBtn');
                    if (tpStart) tpStart.click();
                }, 800);
            }, 1500);
        }
    }
}

function bindUsptoListDelegation(showToast) {
    ['u-safeList', 'u-bannedList'].forEach((containerId) => {
        const el = document.getElementById(containerId);
        if (!el || el._usptoDelegationBound) return;
        el._usptoDelegationBound = true;
        el.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            const item = target.closest('.card-item');
            if (!item) return;
            const niche = item.dataset.niche || '';
            if (!niche) return;
            if (target.closest('.ai-global-audit')) {
                e.stopPropagation();
                showToast(`🛡️ جاري تحليل الأمان لـ "${niche}"...`);
                if (window.AICentralBrain) {
                    window.AICentralBrain.checkTrademarkRisk(niche).then((report) => {
                        alert(`🛡️ تقرير الحارس القانوني (AI):\n\n${report || 'فشل جلب التقرير'}`);
                    });
                }
                return;
            }
            navigator.clipboard.writeText(niche).then(() => showToast(`✅ تم نسخ: ${niche}`));
        });
    });
}

function bootstrapUsptoPanel(helpers) {
    if (U.modeSelect) {
        chrome.storage.local.get(['usptoRunMode'], (storageData) => {
            const mode = storageData.usptoRunMode === 'strict-visible' ? 'strict-visible' : 'silent-fast';
            U.modeSelect.value = mode;
            if (!storageData.usptoRunMode) {
                if (typeof window.NHP_markStorageEchoSuppress === 'function') {
                    window.NHP_markStorageEchoSuppress(['usptoRunMode']);
                }
                chrome.storage.local.set({ usptoRunMode: 'silent-fast' });
            }
        });
    }

    chrome.storage.local.get(
        ['uRunning', 'uPending', 'uSafe', 'uBanned', 'uErrors', 'uTotal', 'uCurrent', 'usptoFastWorkerTarget', 'usptoFastWorkerActive', 'usptoRunMode', 'isFullAuto'],
        (storageData) => updateUSPTO(storageData, helpers, { force: true })
    );
}

export function activateUsptoPanel() {
    if (!usptoHelpersRef) return;
    if (!usptoPanelBootstrapped) {
        usptoPanelBootstrapped = true;
        bootstrapUsptoPanel(usptoHelpersRef);
        return;
    }
    chrome.storage.local.get(
        ['uRunning', 'uPending', 'uSafe', 'uBanned', 'uErrors', 'uTotal', 'uCurrent', 'usptoFastWorkerTarget', 'usptoFastWorkerActive', 'usptoRunMode', 'isFullAuto'],
        (storageData) => updateUSPTO(storageData, usptoHelpersRef, { force: true })
    );
}

function computeUsptoMetrics(data = {}) {
    const safe = data.uSafe || [];
    const banned = data.uBanned || [];
    const pending = data.uPending || [];
    const errors = data.uErrors || [];
    const running = data.uRunning || false;
    const done = safe.length + banned.length + errors.length;
    const storedTotal = Math.max(0, Number(data.uTotal) || 0);
    const total = Math.max(storedTotal, done + pending.length);
    const pct = total > 0
        ? Math.min(100, Math.round((done / total) * 100))
        : (running ? 5 : 0);
    return { safe, banned, pending, errors, done, total, pct, running };
}

/**
 * Update USPTO UI based on background state
 */
export function updateUSPTO(data, helpers, options = {}) {
    const { showToast, switchTab, renderList } = helpers;
    if (!U.startBtn) return;

    handleUsptoPipelineSideEffects(data, helpers);

    const force = options.force === true;
    if (!force && !isUsptoPanelActive()) return;

    const fp = buildUsptoUpdateFingerprint(data);
    if (!force && fp === usptoUpdateFingerprint) return;
    usptoUpdateFingerprint = fp;

    const { safe, banned, pending, errors, done, total, pct, running } = computeUsptoMetrics(data);
    const current = data.uCurrent || null;
    const workerTarget = Math.max(1, Math.min(10, parseInt(data.usptoFastWorkerTarget || U.workerCountInput?.value || '4', 10) || 4));
    const workerActive = Math.max(0, parseInt(data.usptoFastWorkerActive || '0', 10) || 0);
    const runMode = data.usptoRunMode === 'strict-visible' ? 'strict-visible' : 'silent-fast';

    U.totalEl.textContent = total;
    U.safeEl.textContent = safe.length;
    U.bannedEl.textContent = banned.length;
    U.pendEl.textContent = pending.length;
    U.safeCountEl.textContent = safe.length;
    U.banCountEl.textContent = banned.length;
    U.barEl.style.width = pct + '%';
    U.pctEl.textContent = pct + '%';
    if (U.workerCountInput && document.activeElement !== U.workerCountInput) {
        U.workerCountInput.value = String(workerTarget);
    }
    if (U.workerActiveEl) {
        U.workerActiveEl.textContent = `${workerActive} active`;
    }
    if (U.modeSelect && document.activeElement !== U.modeSelect) {
        U.modeSelect.value = runMode;
    }
    const usptoTabCountEl = document.getElementById('usptoTabCount');
    if (usptoTabCountEl) usptoTabCountEl.textContent = safe.length;

    const panel = document.getElementById('panel-uspto');
    const inputToggleBtn = document.getElementById('u-inputToggleBtn');
    if (panel && (running || done > 0)) {
        panel.classList.add('uspto-input-collapsed');
        inputToggleBtn?.classList.remove('hidden');
    }

    renderList(safe, 'u-safeList');
    renderList(banned, 'u-bannedList');

    if (running) {
        U.dotEl.classList.add('active');
        U.startBtn.disabled = true;
        U.startBtn.innerHTML = '<div class="spinner"></div> جاري الفحص...';
        U.stopBtn.classList.remove('hidden');
        U.alertEl.style.display = 'none';
        U.barEl.classList.add('scanning-bar');

        if (current) {
            U.statusEl.textContent = `فحص: "${current}" — ${done}/${total}`;
            U.badgeEl.textContent = current;
            U.badgeEl.classList.remove('hidden');
            U.badgeEl.classList.add('pulse-active');
        } else {
            U.statusEl.textContent = `جاري التحميل... ${done}/${total}`;
            U.badgeEl.classList.add('hidden');
        }
    } else {
        U.dotEl.classList.remove('active');
        U.startBtn.disabled = false;
        U.stopBtn.classList.add('hidden');
        U.transferBtn.classList.add('hidden');
        U.badgeEl.classList.add('hidden');
        U.badgeEl.classList.remove('pulse-active');
        U.barEl.classList.remove('scanning-bar');

        if (done === 0) {
            U.startBtn.innerHTML = '🚀 بدء الفحص';
            U.statusEl.textContent = 'في انتظار بدء الفحص...';
            usptoAutoTransferred = false;
        } else if (done === total && total > 0) {
            U.startBtn.innerHTML = '🚀 بدء فحص جديد';
            U.statusEl.textContent = `✅ اكتمل — ${safe.length} آمن، ${banned.length} محظور، ${errors.length} خطأ`;

        } else {
            U.startBtn.innerHTML = '▶️ استئناف الفحص';
            U.statusEl.textContent = `⏸ متوقف — تم فحص ${done}/${total}`;
            U.transferBtn.classList.remove('hidden');
        }
    }

    syncUsptoBottomPanel(data);
}

/**
 * Initialize USPTO Module
 */
export function initUsptoModule(helpers) {
    const { parseNiches, showToast, copyList, exportTxt, renderList, switchTab } = helpers;
    if (!U.startBtn || usptoModuleInitialized) return;
    usptoModuleInitialized = true;
    usptoHelpersRef = helpers;

    attachUsptoCompactUi();
    bindUsptoListDelegation(showToast);
    window.NHP_activateUsptoPanel = activateUsptoPanel;
    bindSearchToolsSyncStatus(document.getElementById('u-emailcore-sync'));

    // Input listeners
    U.input.addEventListener('input', () => {
        U.inputCountEl.textContent = parseNiches('u-niches').length;
        updateInputDupHint();
    });

    U.clearBtn.addEventListener('click', () => {
        U.input.value = '';
        U.inputCountEl.textContent = 0;
        updateInputDupHint();
    });

    const clearLogBtn = document.getElementById('u-clearActivityLog');
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', () => {
            const pre = document.getElementById('u-activityLog');
            if (pre) pre.textContent = '';
        });
    }

    updateInputDupHint();

    document.getElementById('u-formatBtn').addEventListener('click', () => {
        formatNiches('u-niches', 'u-inputCount', showToast);
    });

    const applyWorkerCount = (count, toast = true) => {
        const nextCount = Math.max(1, Math.min(10, parseInt(count, 10) || 1));
        if (U.workerCountInput) U.workerCountInput.value = String(nextCount);
        chrome.runtime.sendMessage({ action: 'u_set_workers', count: nextCount }, (res) => {
            if (chrome.runtime.lastError) {
                showToast(`⚠️ ${chrome.runtime.lastError.message}`);
                return;
            }
            if (!res?.success) {
                showToast(`⚠️ ${res?.error || 'تعذر تغيير عدد نوافذ USPTO'}`);
                return;
            }
            if (toast) showToast(`✅ عدد نوافذ USPTO: ${res.count}`);
        });
    };

    U.applyWorkersBtn?.addEventListener('click', () => applyWorkerCount(getUsptoWorkerInputValue()));
    U.workerCountInput?.addEventListener('change', () => applyWorkerCount(getUsptoWorkerInputValue(), false));
    U.addWorkerBtn?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'u_add_worker' }, (res) => {
            if (chrome.runtime.lastError) {
                showToast(`⚠️ ${chrome.runtime.lastError.message}`);
                return;
            }
            if (!res?.success) {
                showToast(`⚠️ ${res?.error || 'تعذر فتح نافذة USPTO إضافية'}`);
                return;
            }
            if (U.workerCountInput) U.workerCountInput.value = String(res.count);
            showToast(`➕ تم رفع نوافذ USPTO إلى ${res.count}`);
        });
    });

    if (U.modeSelect) {
        U.modeSelect.addEventListener('change', () => {
            const mode = U.modeSelect.value === 'strict-visible' ? 'strict-visible' : 'silent-fast';
            chrome.runtime.sendMessage({ action: 'u_set_mode', mode }, (res) => {
                if (chrome.runtime.lastError) {
                    showToast(`⚠️ ${chrome.runtime.lastError.message}`);
                    return;
                }
                if (!res?.success) {
                    showToast(`⚠️ ${res?.error || 'Unable to change USPTO mode'}`);
                    return;
                }
                showToast(mode === 'strict-visible' ? 'USPTO Strict Visible enabled' : 'USPTO Silent Fast enabled');
            });
        });
    }

    // Start checking
    U.startBtn.addEventListener('click', () => {
        if (typeof window.NHP_usptoCollapseInput === 'function') {
            window.NHP_usptoCollapseInput();
        }
        const requestedWorkers = getUsptoWorkerInputValue();
        chrome.storage.local.get(['uRunning', 'uPending', 'uTotal', 'uSafe', 'uBanned', 'uErrors', NHP_NICHE_CACHE_STORAGE_KEY, 'usptoHistory'], d => {
            if (d.uRunning) return;

            const currentNiches = parseNiches('u-niches');
            if (!currentNiches.length) {
                showToast('⚠️ أدخل نيتش واحد على الأقل.');
                return;
            }

            const isResume = d.uPending && d.uPending.length > 0 && d.uTotal > 0 && ((d.uSafe || []).length + (d.uBanned || []).length + (d.uErrors || []).length > 0);

            if (isResume) {
                U.startBtn.disabled = true;
                U.startBtn.innerHTML = '<div class="spinner"></div> جاري الاستئناف...';
                chrome.storage.local.set({ uRunning: true, usptoFastWorkerTarget: requestedWorkers }, () => {
                    chrome.runtime.sendMessage({ action: 'u_start' });
                });
                return;
            }

            (() => {
                const cache = buildCacheFromStorageData(d);
                const split = splitNichesByNicheCache(currentNiches, cache, {
                    mode: 'uspto',
                    allowedStatuses: ['safe', 'banned'],
                });
                const pending = split.pending;
                const safe = split.buckets.safe || [];
                const banned = split.buckets.banned || [];
                const rememberedCount = split.rememberedCount;

                if (rememberedCount > 0) {
                    showToast(`🧠 تم تذكر ${rememberedCount} نيتش من عمليات سابقة`);
                }

                const updateData = {
                    uRunning: pending.length > 0,
                    uPending: pending,
                    uInFlight: [],
                    uCurrent: null,
                    uTotal: currentNiches.length,
                    uSafe: safe,
                    uBanned: banned,
                    uErrors: [],
                    usptoFastWorkerTarget: requestedWorkers,
                    usptoFastWorkerActive: 0
                };

                if (typeof window.NHP_markStorageEchoSuppress === 'function') {
                    window.NHP_markStorageEchoSuppress(Object.keys(updateData));
                }
                chrome.storage.local.set(updateData, () => {
                    usptoUpdateFingerprint = '';
                    if (pending.length > 0) {
                        chrome.runtime.sendMessage({ action: 'u_persist_batch' }, () => {
                            if (chrome.runtime.lastError) { /* optional */ }
                        });
                        chrome.runtime.sendMessage({ action: 'u_start' });
                    } else {
                        showToast('✅ جميع النيتشات تم فحصها مسبقاً!');
                        chrome.storage.local.get(['uSafe', 'uBanned', 'uErrors', 'uPending', 'uTotal', 'uCurrent', 'uRunning', 'isFullAuto'], (storageData) => updateUSPTO(storageData, helpers, { force: true }));
                    }
                });
            })();
        });
    });

    // Transfer results
    if (U.transferBtn) {
        U.transferBtn.addEventListener('click', () => {
            chrome.storage.local.get(['uSafe', 'uBanned', 'uErrors', 'uTotal'], d => {
                const safe = d.uSafe || [];
                const total = d.uTotal || 0;
                const done = safe.length + (d.uBanned || []).length + (d.uErrors || []).length;

                if (safe.length === 0) {
                    showToast('⚠️ لا توجد نيتشات آمنة لنقلها حالياً');
                    return;
                }

                if (confirm(`سيتم إنهاء الفحص ونقل ${safe.length} نيتش آمن إلى TeePublic. هل تريد المتابعة؟`)) {
                    chrome.storage.local.set({
                        uRunning: false,
                        uPending: [],
                        uTotal: done
                    }, () => {
                        chrome.runtime.sendMessage({ action: 'u_stop' });
                        usptoAutoTransferred = false;
                        chrome.storage.local.get(['uSafe', 'uBanned', 'uErrors', 'uPending', 'uTotal', 'uCurrent', 'uRunning', 'isFullAuto'], (data) => updateUSPTO(data, helpers));
                    });
                }
            });
        });
    }

    // Stop checking
    U.stopBtn.addEventListener('click', () => {
        chrome.storage.local.set({ uRunning: false, isFullAuto: false });
        chrome.runtime.sendMessage({ action: 'u_stop' });
        showToast('⏸ تم إيقاف الفحص');
    });

    // Preview browser toggle
    U.previewBtn.addEventListener('click', () => {
        const mode = U.modeSelect?.value === 'strict-visible' ? 'strict-visible' : 'silent-fast';
        if (mode !== 'strict-visible') {
            showToast('Silent Fast is active: USPTO runs without preview windows.');
            return;
        }
        chrome.tabs.query({ url: 'https://tmsearch.uspto.gov/*' }, tabs => {
            if (tabs.length === 0) {
                showToast('No active USPTO preview window.');
                return;
            }

            const tab = tabs.find((item) => item.windowId) || tabs[0];
            chrome.windows.get(tab.windowId, (win) => {
                if (chrome.runtime.lastError || !win) {
                    showToast('No active USPTO preview window.');
                    return;
                }
                chrome.tabs.update(tab.id, { active: true });
                chrome.windows.update(tab.windowId, {
                    state: 'normal',
                    focused: true,
                    top: 100,
                    left: 100,
                    width: 1024,
                    height: 800
                });
                showToast('USPTO preview window focused.');
            });
        });
    });

    // Reset
    U.resetBtn.addEventListener('click', () => {
        if (!confirm('إعادة تعيين نتائج USPTO؟')) return;
        appendUsptoActivityLine('♻ إعادة تعيين النتائج');
        usptoPrevSnap = null;
        usptoUpdateFingerprint = '';
        usptoAutoTransferred = false;
        if (typeof window.NHP_markStorageEchoSuppress === 'function') {
            window.NHP_markStorageEchoSuppress(['uRunning', 'uPending', 'uSafe', 'uBanned', 'uErrors', 'uCurrent', 'uTotal']);
        }
        chrome.storage.local.set({ uRunning: false, uPending: [], uSafe: [], uBanned: [], uErrors: [], uCurrent: null, uTotal: 0 });
        showToast('♻️ تمت إعادة التعيين');
    });

    // Action buttons (Copy/Export)
    document.getElementById('u-copySafe').addEventListener('click', () => copyList('uSafe', 'الآمنة'));
    document.getElementById('u-copyBanned').addEventListener('click', () => copyList('uBanned', 'المحظورة'));

    document.getElementById('u-expSafe').addEventListener('click', () => {
        chrome.storage.local.get('uSafe', d => exportTxt(d.uSafe, 'safe_niches.txt'));
    });

    document.getElementById('u-expBanned').addEventListener('click', () => {
        chrome.storage.local.get('uBanned', d => exportTxt(d.uBanned, 'banned_niches.txt'));
    });

    document.getElementById('u-expAll').addEventListener('click', () => {
        chrome.storage.local.get(['uSafe', 'uBanned', 'uErrors'], d => {
            const s = d.uSafe || [], b = d.uBanned || [], e = d.uErrors || [];
            const report = [
                '==========================================',
                '   تقرير فحص العلامات التجارية - USPTO    ',
                '==========================================',
                `التاريخ: ${new Date().toLocaleDateString('ar-EG')}`,
                ``,
                `--- ✅ الآمنة (${s.length}) ---`,
                ...s.map((n, i) => `${i + 1}. ${n}`),
                ``,
                `--- 🚫 المحظورة (${b.length}) ---`,
                ...b.map((n, i) => `${i + 1}. ${n}`),
                ``,
                `--- ⚠️ أخطاء الفحص (${e.length}) ---`,
                ...e.map((n, i) => `${i + 1}. ${n}`)
            ].join('\n');
            exportTxt(report, 'uspto_report.txt');
        });
    });
}
