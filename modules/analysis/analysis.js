// ══════════════════════════════════════════════════════
//  ████████  ANALYSIS (TEEPUBLIC) MODULE  ████████
// ══════════════════════════════════════════════════════

import { bindSearchToolsSyncStatus } from '../creaty/search-tools-sync-ui.js';
import {
    NHP_NICHE_CACHE_STORAGE_KEY,
    buildCacheFromStorageData,
    splitNichesByNicheCache,
} from '../../utils/niche-cache-ttl-shared.js';

let tpAutoTransferred = false;
let analysisInputUiAttached = false;
let tpPanelBootstrapped = false;
let analysisModuleInitialized = false;
let tpUpdateFingerprint = '';
let tpDetailPanelFingerprint = '';
let tpHelpersRef = null;
let tpDetailSearchTimer = null;
/** Throttle Full-Auto programmatic starts — avoids refresh storms during stalled pipelines. */
let tpFullAutoKickLastMs = 0;
/** Active per-column reanalyze: { bucket, keys:Set, total, label } */
let tpColumnRecheck = null;

const TP_BUCKET_STORAGE = Object.freeze({
    excel: 'tpExcel',
    med: 'tpMed',
    sat: 'tpSat',
    emp: 'tpEmp',
});

const TP_BUCKET_LABEL_AR = Object.freeze({
    excel: 'ممتاز',
    med: 'متوسط',
    sat: 'مشبع',
    emp: 'غير معروف',
});

const TP_COLUMN_REANALYZE_BTNS = Object.freeze({
    excel: 'tp-reanalyzeExcel',
    med: 'tp-reanalyzeMed',
    sat: 'tp-reanalyzeSat',
    emp: 'tp-reanalyzeEmp',
});

const TP_DETAIL_MAX_BY_MODE = { performance: 120, balanced: 80, lite: 48, ultra: 32 };
const TP_LIST_MAX_BY_MODE = { performance: 60, balanced: 40, lite: 24, ultra: 16 };

function normalizeTpHistoryKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function isTeepublicPanelActive() {
    return !!document.getElementById('panel-teepublic')?.classList.contains('active');
}

function getTpDetailMaxRender() {
    const mode = window.NHP_PERFORMANCE_MODE || 'balanced';
    return TP_DETAIL_MAX_BY_MODE[mode] || TP_DETAIL_MAX_BY_MODE.balanced;
}

function getTpListMaxRender() {
    const mode = window.NHP_PERFORMANCE_MODE || 'balanced';
    return TP_LIST_MAX_BY_MODE[mode] || TP_LIST_MAX_BY_MODE.balanced;
}

function buildTpUpdateFingerprint(data) {
    const excel = data.tpExcel || [];
    const med = data.tpMed || [];
    const sat = data.tpSat || [];
    const emp = data.tpEmp || [];
    const done = excel.length + med.length + sat.length + emp.length;
    const col = tpColumnRecheck
        ? `${tpColumnRecheck.bucket}:${tpColumnRecheck.total}`
        : '0';
    const pageCounts = data.tpPageCounts && typeof data.tpPageCounts === 'object'
        ? Object.keys(data.tpPageCounts).length
        : 0;
    return [
        data.tpRunning ? '1' : '0',
        data.tpTotal || 0,
        done,
        (data.tpPending || []).length,
        data.tpCurrent || '',
        excel.length,
        med.length,
        sat.length,
        emp.length,
        col,
        pageCounts
    ].join('|');
}

/** Unified bottom panel: filter + combined list (popup + luxury embed share these IDs). */
let tpDetailFilter = '';
let tpDetailVisibleLines = [];

function tpEscapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildTpDetailRows(excel, med, sat, emp, pageCounts = {}) {
    const withMeta = (n, label, cls) => {
        const key = normalizeTpHistoryKey(n);
        const pages = pageCounts[key];
        const pageCount = Number.isFinite(Number(pages)) ? Number(pages) : null;
        return {
            niche: n,
            label,
            cls,
            pageCount,
            title: pageCount != null ? `pages: ${pageCount}` : String(n || ''),
        };
    };
    return [
        ...excel.map((n) => withMeta(n, 'ممتاز', 'tp-detail-badge--excel')),
        ...med.map((n) => withMeta(n, 'متوسط', 'tp-detail-badge--med')),
        ...sat.map((n) => withMeta(n, 'مشبع', 'tp-detail-badge--sat')),
        ...emp.map((n) => withMeta(n, 'غير معروف', 'tp-detail-badge--emp')),
    ];
}

function refreshTpCombinedDetailPanel(excel, med, sat, emp, ctx) {
    const listEl = document.getElementById('tp-detailList');
    const metaEl = document.getElementById('tp-bottomMeta');
    if (!listEl || !metaEl) return;

    const timeEl = document.getElementById('tp-bottomTime');
    const hintEl = document.getElementById('tp-bottomHint');
    const { running = false, total = 0, done = 0, pageCounts = {} } = ctx || {};

    const allRows = buildTpDetailRows(excel, med, sat, emp, pageCounts);
    const totalClassified = allRows.length;
    const q = tpDetailFilter.trim().toLowerCase();
    const filtered = q
        ? allRows.filter((r) => String(r.niche).toLowerCase().includes(q))
        : allRows;

    tpDetailVisibleLines = filtered.map((r) => {
        const pagesSuffix = r.pageCount != null ? ` (pages: ${r.pageCount})` : '';
        return `[${r.label}] ${r.niche}${pagesSuffix}`;
    });

    if (totalClassified === 0) {
        metaEl.textContent = running && total > 0
            ? `جاري العمل… ${done}/${total} — القائمة الموحّدة تتحدّث مع كل نيش.`
            : 'لا توجد نتائج بعد — أدخل النيتشات واضغط «بدء التحليل». بعد الاكتمال يمكنك التصدير من الأزرار أعلاه أو نسخ القائمة من هنا.';
        if (timeEl) timeEl.textContent = '';
        listEl.innerHTML = '';
        if (hintEl) hintEl.classList.remove('hidden');
        return;
    }

    if (hintEl) hintEl.classList.add('hidden');

    const now = new Date();
    if (timeEl) {
        timeEl.textContent = `آخر تحديث للوحة: ${now.toLocaleString('ar-EG', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })}`;
    }

    let metaLine = `${totalClassified} نيش مصنّفة · ممتاز ${excel.length} · متوسط ${med.length} · مشبع ${sat.length} · غير معروف ${emp.length}`;
    if (q && filtered.length !== totalClassified) {
        metaLine += ` — معروض بعد البحث: ${filtered.length}`;
    }
    metaEl.textContent = metaLine;

    const pagesFp = filtered.slice(0, 40).map((r) => `${r.niche}:${r.pageCount ?? ''}`).join(',');
    const detailFp = `${totalClassified}|${q}|${filtered.length}|${running}|${done}|${total}|${pagesFp}`;
    if (detailFp === tpDetailPanelFingerprint) return;
    tpDetailPanelFingerprint = detailFp;

    const maxRows = getTpDetailMaxRender();
    const slice = filtered.slice(0, maxRows);
    const rowsHtml = slice.map((r) => `
        <li class="tp-detail-row" role="listitem" title="${tpEscapeHtml(r.title)}">
            <span class="tp-detail-badge ${r.cls}">${tpEscapeHtml(r.label)}</span>
            <span class="tp-detail-name">${tpEscapeHtml(r.niche)}</span>
        </li>
    `).join('');
    const moreHtml = filtered.length > slice.length
        ? `<li class="tp-detail-row" style="opacity:0.7;font-size:10px;">+${filtered.length - slice.length} مخفية لتحسين الأداء</li>`
        : '';
    listEl.innerHTML = rowsHtml + moreHtml;
}

function buildTpAutoTransferSignature(excel = [], med = []) {
    const normalize = (items) => items
        .map(item => String(item || '').trim().toLowerCase())
        .filter(Boolean)
        .sort();

    return JSON.stringify({
        excel: normalize(excel),
        med: normalize(med)
    });
}

function renderTpCompactList(arr, containerId, tone, pageCounts = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const pagesSig = (arr || []).slice(0, 20).map((n) => {
        const key = normalizeTpHistoryKey(n);
        const pages = pageCounts[key];
        return `${n}:${Number.isFinite(Number(pages)) ? pages : ''}`;
    }).join('|');
    const sig = arr ? `${arr.length}-${arr[0]}-${arr[arr.length - 1]}-${pagesSig}` : 'empty';
    if (el._renderSig === sig) return;
    el._renderSig = sig;

    if (!arr || arr.length === 0) {
        el.innerHTML = '<div class="empty-msg">لا توجد نتائج</div>';
        return;
    }

    const dot = tone || 'var(--text-muted)';
    const max = getTpListMaxRender();
    const slice = arr.slice(0, max);
    const rows = slice.map((n) => {
        const key = normalizeTpHistoryKey(n);
        const pages = pageCounts[key];
        const pageCount = Number.isFinite(Number(pages)) ? Number(pages) : null;
        const title = pageCount != null ? `pages: ${pageCount}` : String(n || '');
        return `
        <div class="ana-item" title="${tpEscapeHtml(title)}">
            <span class="ana-item-dot" style="background:${dot}"></span>
            <span class="ana-item-text">${tpEscapeHtml(n)}</span>
        </div>
    `;
    }).join('');
    const more = arr.length > slice.length
        ? `<div class="empty-msg" style="font-size:10px;opacity:0.75;">+${arr.length - slice.length} عنصر</div>`
        : '';

    el.innerHTML = rows + more;
}

function attachAnalysisCompactUi() {
    if (analysisInputUiAttached) return;
    analysisInputUiAttached = true;

    const panel = document.getElementById('panel-teepublic');
    const startBtn = document.getElementById('tp-startBtn');
    const inputToggleBtn = document.getElementById('tp-inputToggleBtn');
    const searchToggle = document.getElementById('tp-searchToggle');
    const detailSearch = document.getElementById('tp-detailSearch');
    if (!panel || !startBtn) return;

    const collapseInput = () => {
        panel.classList.add('analysis-input-collapsed');
        inputToggleBtn?.classList.remove('hidden');
    };
    const toggleInput = () => {
        panel.classList.toggle('analysis-input-collapsed');
    };
    const closeSearch = () => {
        panel.classList.remove('tp-search-open');
    };

    window.NHP_teepublicCollapseInput = collapseInput;

    inputToggleBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleInput();
    });

    searchToggle?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        panel.classList.toggle('tp-search-open');
        if (panel.classList.contains('tp-search-open') && detailSearch) {
            requestAnimationFrame(() => detailSearch.focus());
        }
    });

    detailSearch?.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#panel-teepublic .tp-search-wrap')) closeSearch();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSearch();
    });
}

const TP = {
    startBtn: document.getElementById('tp-startBtn'),
    stopBtn: document.getElementById('tp-stopBtn'),
    resetBtn: document.getElementById('tp-resetBtn'),
    clearBtn: document.getElementById('tp-clearBtn'),
    input: document.getElementById('tp-niches'),
    dotEl: document.getElementById('tp-statusDot'),
    statusEl: document.getElementById('tp-statusText'),
    badgeEl: document.getElementById('tp-currentBadge'),
    barEl: document.getElementById('tp-bar'),
    pctEl: document.getElementById('tp-pct'),
    alertEl: document.getElementById('tp-alert'),
    excelEl: document.getElementById('tp-excel'),
    medEl: document.getElementById('tp-med'),
    satEl: document.getElementById('tp-sat'),
    empEl: document.getElementById('tp-emp'),
    excelCountEl: document.getElementById('tp-excelCount'),
    medCountEl: document.getElementById('tp-medCount'),
    satCountEl: document.getElementById('tp-satCount'),
    empCountEl: document.getElementById('tp-empCount'),
    inputCountEl: document.getElementById('tp-inputCount'),
};

/**
 * Format niches (splitting camelCase, trimming, removing duplicates)
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

function getUniqueTpRecheckNiches(excel = [], med = []) {
    const seen = new Set();
    return [...excel, ...med]
        .map((item) => String(item || '').trim())
        .filter((item) => {
            const key = item.toLowerCase();
            if (!item || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function getUniqueTpNichesFromList(list = []) {
    const seen = new Set();
    return (list || [])
        .map((item) => String(item || '').trim())
        .filter((item) => {
            const key = normalizeTpHistoryKey(item);
            if (!item || !key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function ensureTpRecheckNoteButton() {
    let btn = document.getElementById('tp-recheckNoteBtn');
    if (btn) return btn;
    const resetBtn = document.getElementById('tp-resetBtn');
    if (!resetBtn?.parentElement) return null;
    btn = document.createElement('button');
    btn.id = 'tp-recheckNoteBtn';
    btn.className = resetBtn.className || 'luxury-btn btn-secondary';
    btn.style.cssText = resetBtn.style.cssText || 'flex:1;';
    btn.title = 'إعادة تحليل النيتشات الممتازة والمتوسطة (تجاهل الذاكرة السابقة)';
    btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Recheck';
    resetBtn.parentElement.appendChild(btn);
    return btn;
}

function setTpColumnRecheckButtonsIdle() {
    Object.entries(TP_COLUMN_REANALYZE_BTNS).forEach(([bucket, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = false;
        btn.classList.remove('is-busy');
        btn.innerHTML = '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> إعادة تحليل';
        btn.title = `إعادة تحليل نيتشات عمود ${TP_BUCKET_LABEL_AR[bucket] || bucket} فقط`;
    });
}

function refreshTpColumnRecheckButtons(data) {
    const running = !!data?.tpRunning;
    if (!tpColumnRecheck) {
        Object.values(TP_COLUMN_REANALYZE_BTNS).forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.disabled = running;
            btn.classList.remove('is-busy');
            btn.innerHTML = '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> إعادة تحليل';
        });
        return;
    }

    const pendingKeys = new Set((data?.tpPending || []).map(normalizeTpHistoryKey).filter(Boolean));
    if (data?.tpCurrent) {
        const cur = normalizeTpHistoryKey(data.tpCurrent);
        if (cur) pendingKeys.add(cur);
    }
    const remaining = [...tpColumnRecheck.keys].filter((k) => pendingKeys.has(k)).length;
    const done = Math.max(0, tpColumnRecheck.total - remaining);
    const pct = tpColumnRecheck.total > 0 ? Math.round((done / tpColumnRecheck.total) * 100) : 0;

    Object.entries(TP_COLUMN_REANALYZE_BTNS).forEach(([bucket, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (bucket === tpColumnRecheck.bucket) {
            btn.disabled = true;
            btn.classList.add('is-busy');
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> ${done}/${tpColumnRecheck.total} (${pct}%)`;
            btn.title = `جاري إعادة تحليل عمود ${tpColumnRecheck.label}: ${done}/${tpColumnRecheck.total}`;
        } else {
            btn.disabled = true;
            btn.classList.remove('is-busy');
            btn.innerHTML = '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> إعادة تحليل';
        }
    });

    if (!running) {
        tpColumnRecheck = null;
        setTpColumnRecheckButtonsIdle();
    }
}

function startTpColumnRecheck(bucket, showToast, helpers) {
    const storageKey = TP_BUCKET_STORAGE[bucket];
    if (!storageKey) return;

    chrome.storage.local.get(['tpRunning', storageKey], (d) => {
        if (d.tpRunning) {
            showToast('⚠️ انتظر حتى ينتهي التحليل الحالي ثم أعد المحاولة.');
            return;
        }
        const niches = getUniqueTpNichesFromList(d[storageKey] || []);
        if (!niches.length) {
            showToast(`لا توجد نيتشات في عمود «${TP_BUCKET_LABEL_AR[bucket] || bucket}» لإعادة التحليل.`);
            return;
        }

        const keys = new Set(niches.map(normalizeTpHistoryKey).filter(Boolean));
        tpColumnRecheck = {
            bucket,
            keys,
            total: niches.length,
            label: TP_BUCKET_LABEL_AR[bucket] || bucket,
        };
        tpAutoTransferred = false;
        refreshTpColumnRecheckButtons({ tpRunning: true, tpPending: niches });

        chrome.runtime.sendMessage({ action: 'tp_force_recheck', niches }, (result) => {
            if (chrome.runtime.lastError) {
                console.warn('TP column recheck failed:', chrome.runtime.lastError);
                tpColumnRecheck = null;
                setTpColumnRecheckButtonsIdle();
                showToast('⚠️ فشل طلب إعادة التحليل. أعد تحميل الإضافة.');
                return;
            }
            if (result?.error === 'already_running') {
                tpColumnRecheck = null;
                setTpColumnRecheckButtonsIdle();
                showToast('⚠️ التحليل قيد التشغيل بالفعل.');
                return;
            }
            if (!result?.success) {
                tpColumnRecheck = null;
                setTpColumnRecheckButtonsIdle();
                showToast('⚠️ لم يتم بدء إعادة التحليل.');
                return;
            }

            showToast(`🔄 إعادة تحليل عمود «${tpColumnRecheck.label}»: ${result.queued} نيتش`);
            chrome.storage.local.get(
                ['tpExcel', 'tpMed', 'tpSat', 'tpEmp', 'tpTotal', 'tpCurrent', 'tpRunning', 'tpPending', 'tpLastAutoImportSignature', 'tpPageCounts'],
                (data) => updateTeePublic(data, helpers)
            );
        });
    });
}

function handleTpPipelineSideEffects(data, helpers) {
    const { showToast } = helpers;
    if (!window.__nhpInitComplete || !TP.startBtn) return;

    const excel = data.tpExcel || [];
    const med = data.tpMed || [];
    const sat = data.tpSat || [];
    const emp = data.tpEmp || [];
    const total = data.tpTotal || 0;
    const running = data.tpRunning || false;
    const done = excel.length + med.length + sat.length + emp.length;
    const autoTransferSignature = buildTpAutoTransferSignature(excel, med);
    const alreadyTransferred = data.tpLastAutoImportSignature === autoTransferSignature;

    if (data.isFullAuto && !running && (done === 0 || total > done) && total > 0) {
        const now = Date.now();
        if (now - tpFullAutoKickLastMs >= 2800) {
            tpFullAutoKickLastMs = now;
            queueMicrotask(() => {
                try {
                    TP.startBtn.click();
                } catch (e) {
                    console.warn('TeePublic full-auto kick:', e);
                }
            });
        }
    }

    if (!running && done === total && total > 0 && !tpAutoTransferred && !alreadyTransferred) {
        if (excel.length > 0 || med.length > 0) {
            if (window.NC_importFromAnalysis) {
                tpAutoTransferred = true;
                if (typeof window.NHP_markStorageEchoSuppress === 'function') {
                    window.NHP_markStorageEchoSuppress(['tpLastAutoImportSignature', 'tpPendingAutoImportSignature']);
                }
                chrome.storage.local.set({
                    tpLastAutoImportSignature: autoTransferSignature,
                    tpPendingAutoImportSignature: null
                }, () => {
                    Promise.resolve(window.NC_importFromAnalysis({ source: 'auto', signature: autoTransferSignature }))
                        .catch((error) => console.warn('TP auto-transfer failed:', error));
                });
                showToast('✅ اكتمل التحليل! تم إرسال النتائج للمفكرة...');
            } else {
                tpAutoTransferred = true;
                chrome.storage.local.set({ tpPendingAutoImportSignature: autoTransferSignature });
            }
        }
    }
}

function bootstrapTeepublicPanel(helpers) {
    chrome.storage.local.get(
        ['tpRunning', 'tpPending', 'tpExcel', 'tpMed', 'tpSat', 'tpEmp', 'tpTotal', 'tpCurrent', 'isFullAuto', 'tpLastAutoImportSignature', 'tpPageCounts'],
        (storageData) => updateTeePublic(storageData, helpers, { force: true })
    );
}

export function activateTeepublicPanel() {
    if (!tpHelpersRef) return;
    if (!tpPanelBootstrapped) {
        tpPanelBootstrapped = true;
        bootstrapTeepublicPanel(tpHelpersRef);
        return;
    }
    chrome.storage.local.get(
        ['tpRunning', 'tpPending', 'tpExcel', 'tpMed', 'tpSat', 'tpEmp', 'tpTotal', 'tpCurrent', 'isFullAuto', 'tpLastAutoImportSignature', 'tpPageCounts'],
        (storageData) => updateTeePublic(storageData, tpHelpersRef, { force: true })
    );
}

/**
 * Update Analysis UI based on background state
 */
export function updateTeePublic(data, helpers, options = {}) {
    const { showToast } = helpers;
    if (!TP.startBtn) return;

    handleTpPipelineSideEffects(data, helpers);

    const force = options.force === true;
    if (!force && !isTeepublicPanelActive()) return;

    const fp = buildTpUpdateFingerprint(data);
    if (!force && fp === tpUpdateFingerprint) return;
    tpUpdateFingerprint = fp;

    const excel = data.tpExcel || [];
    const med = data.tpMed || [];
    const sat = data.tpSat || [];
    const emp = data.tpEmp || [];
    const pageCounts = data.tpPageCounts && typeof data.tpPageCounts === 'object' ? data.tpPageCounts : {};
    const total = data.tpTotal || 0;
    const current = data.tpCurrent || null;
    const running = data.tpRunning || false;
    const done = excel.length + med.length + sat.length + emp.length;
    const pct = total > 0 ? Math.round(done / total * 100) : (running ? 5 : 0);

    TP.excelEl.textContent = excel.length;
    TP.medEl.textContent = med.length;
    TP.satEl.textContent = sat.length;
    TP.empEl.textContent = emp.length;
    TP.excelCountEl.textContent = excel.length;
    TP.medCountEl.textContent = med.length;
    TP.satCountEl.textContent = sat.length;
    TP.empCountEl.textContent = emp.length;
    TP.barEl.style.width = pct + '%';
    TP.pctEl.textContent = pct + '%';

    const teepublicTabCountEl = document.getElementById('tpTabCount');
    if (teepublicTabCountEl) teepublicTabCountEl.textContent = excel.length;

    renderTpCompactList(excel, 'tp-excelList', 'var(--excellent)', pageCounts);
    renderTpCompactList(med, 'tp-medList', 'var(--medium)', pageCounts);
    renderTpCompactList(sat, 'tp-satList', 'var(--saturated)', pageCounts);
    renderTpCompactList(emp, 'tp-empList', 'var(--empty)', pageCounts);

    if (running) {
        TP.dotEl.classList.add('active');
        TP.startBtn.disabled = true;
        TP.startBtn.innerHTML = '<div class="spinner"></div> جاري التحليل...';
        TP.stopBtn.classList.remove('hidden');
        TP.alertEl.style.display = 'none';
        TP.barEl.classList.add('scanning-bar');

        if (current) {
            TP.statusEl.textContent = `تحليل: "${current}" — ${done}/${total}`;
            TP.badgeEl.textContent = current;
            TP.badgeEl.classList.remove('hidden');
            TP.badgeEl.classList.add('pulse-active');
        } else {
            TP.statusEl.textContent = `جاري التحميل... ${done}/${total}`;
            TP.badgeEl.classList.add('hidden');
        }
    } else {
        TP.dotEl.classList.remove('active');
        TP.startBtn.disabled = false;
        TP.stopBtn.classList.add('hidden');
        TP.badgeEl.classList.add('hidden');
        TP.badgeEl.classList.remove('pulse-active');
        TP.barEl.classList.remove('scanning-bar');

        if (done === 0) {
            TP.startBtn.innerHTML = '📊 بدء التحليل';
            TP.statusEl.textContent = 'في انتظار بدء التحليل...';
            tpAutoTransferred = false;
        } else if (done === total && total > 0) {
            TP.startBtn.innerHTML = '📊 بدء تحليل جديد';
            TP.statusEl.textContent = `✅ اكتمل — ${excel.length} ممتاز، ${med.length} متوسط`;

        } else {
            TP.startBtn.innerHTML = '▶️ استئناف التحليل';
            TP.statusEl.textContent = `⏸ متوقف — تم تحليل ${done}/${total}`;
        }
    }

    refreshTpCombinedDetailPanel(excel, med, sat, emp, { running, total, done, pageCounts });
    refreshTpColumnRecheckButtons({
        tpRunning: running,
        tpPending: data.tpPending || [],
        tpCurrent: current,
    });
}

/**
 * Initialize Analysis Module
 */
export function initAnalysisModule(helpers) {
    const { parseNiches, showToast, copyList, exportTxt, switchTab } = helpers;

    if (!TP.startBtn || analysisModuleInitialized) return;
    analysisModuleInitialized = true;
    tpHelpersRef = helpers;

    attachAnalysisCompactUi();
    window.NHP_activateTeepublicPanel = activateTeepublicPanel;
    bindSearchToolsSyncStatus(document.getElementById('tp-emailcore-sync'));
    const recheckNoteBtn = ensureTpRecheckNoteButton();

    // Input listeners
    TP.input.addEventListener('input', () => {
        TP.inputCountEl.textContent = parseNiches('tp-niches').length;
    });

    TP.clearBtn.addEventListener('click', () => {
        TP.input.value = '';
        TP.inputCountEl.textContent = 0;
    });

    document.getElementById('tp-formatBtn').addEventListener('click', () => {
        formatNiches('tp-niches', 'tp-inputCount', showToast);
    });

    // Start analysis
    TP.startBtn.addEventListener('click', () => {
        if (typeof window.NHP_teepublicCollapseInput === 'function') {
            window.NHP_teepublicCollapseInput();
        }
        chrome.storage.local.get(['tpRunning', 'tpPending', 'tpTotal', 'tpExcel', 'tpMed', 'tpSat', 'tpEmp', NHP_NICHE_CACHE_STORAGE_KEY, 'tpHistory'], d => {
            if (d.tpRunning) return;

            const currentNiches = parseNiches('tp-niches');
            if (!currentNiches.length) {
                showToast('⚠️ أدخل نيتش واحد على الأقل.');
                return;
            }

            const cache = buildCacheFromStorageData(d);
            const split = splitNichesByNicheCache(currentNiches, cache, {
                mode: 'analysis',
                allowedStatuses: ['excel', 'med', 'sat'],
            });
            const pending = split.pending;
            const excel = split.buckets.excel || [];
            const med = split.buckets.med || [];
            const sat = split.buckets.sat || [];
            const emp = [];
            const rememberedCount = split.rememberedCount;

            if (rememberedCount > 0) {
                showToast(`🧠 تم تذكر ${rememberedCount} نيش من التحليلات السابقة`);
            }

            const isResume = d.tpPending && d.tpPending.length > 0 && d.tpTotal > 0 && (d.tpExcel.length + d.tpMed.length > 0);

            if (isResume) {
                TP.startBtn.disabled = true;
                TP.startBtn.innerHTML = '<div class="spinner"></div> جاري الاستئناف...';
                chrome.storage.local.set({ tpRunning: true }, () => {
                    chrome.runtime.sendMessage({ action: 'tp_start' });
                });
                return;
            }

            chrome.storage.local.set({
                tpRunning: pending.length > 0,
                tpPending: pending,
                tpCurrent: null,
                tpTotal: split.totalUnique,
                tpExcel: excel,
                tpMed: med,
                tpSat: sat,
                tpEmp: emp,
                tpLastAutoImportSignature: null
            }, () => {
                if (pending.length > 0) {
                    chrome.runtime.sendMessage({ action: 'tp_start' });
                } else {
                    showToast('✅ جميع النيتشات تم تحليلها مسبقاً');
                    chrome.storage.local.get(['tpExcel', 'tpMed', 'tpSat', 'tpEmp', 'tpTotal', 'tpCurrent', 'tpRunning', 'tpLastAutoImportSignature', 'tpPageCounts'], (data) => updateTeePublic(data, helpers));
                }
            });
        });
    });

    // Stop analysis
    TP.stopBtn.addEventListener('click', () => {
        chrome.storage.local.set({ tpRunning: false, isFullAuto: false });
        chrome.runtime.sendMessage({ action: 'tp_stop' });
        showToast('⏸ تم إيقاف التحليل');
    });

    // Reset analysis
    TP.resetBtn.addEventListener('click', () => {
        if (!confirm('إعادة تعيين نتائج التحليل؟')) return;
        const ds = document.getElementById('tp-detailSearch');
        if (ds) {
            ds.value = '';
            tpDetailFilter = '';
        }
        chrome.storage.local.set({
            tpRunning: false,
            tpPending: [],
            tpExcel: [],
            tpMed: [],
            tpSat: [],
            tpEmp: [],
            tpCurrent: null,
            tpTotal: 0,
            tpLastAutoImportSignature: null,
            tpPendingAutoImportSignature: null
        });
        showToast('♻️ تمت إعادة التعيين');
    });

    recheckNoteBtn?.addEventListener('click', () => {
        chrome.storage.local.get(['tpExcel', 'tpMed', 'tpRunning'], (d) => {
            if (d.tpRunning) {
                showToast('⚠️ انتظر حتى ينتهي التحليل الحالي ثم أعد المحاولة.');
                return;
            }

            const recheckNiches = getUniqueTpRecheckNiches(d.tpExcel || [], d.tpMed || []);
            if (!recheckNiches.length) {
                showToast('لا توجد نيتشات ممتازة أو متوسطة لإعادة التحليل.');
                return;
            }

            tpAutoTransferred = false;
            chrome.runtime.sendMessage({ action: 'tp_force_recheck', niches: recheckNiches }, async (result) => {
                if (chrome.runtime.lastError) {
                    console.warn('TP force recheck failed:', chrome.runtime.lastError);
                    showToast('⚠️ فشل طلب إعادة التحليل. أعد تحميل الإضافة.');
                    return;
                }
                if (result?.error === 'already_running') {
                    showToast('⚠️ التحليل قيد التشغيل بالفعل.');
                    return;
                }
                if (!result?.success) {
                    showToast('⚠️ لم يتم بدء إعادة التحليل.');
                    return;
                }

                showToast(`🔄 جاري إعادة تحليل ${result.queued} نيتش (تم تجاهل الذاكرة السابقة)`);
                chrome.storage.local.get(
                    ['tpExcel', 'tpMed', 'tpSat', 'tpEmp', 'tpTotal', 'tpCurrent', 'tpRunning', 'tpPending', 'tpLastAutoImportSignature', 'tpPageCounts'],
                    (data) => updateTeePublic(data, helpers)
                );

                const request = {
                    niches: recheckNiches,
                    createdAt: new Date().toISOString(),
                    source: 'analysis_recheck'
                };
                chrome.storage.local.set({ tpRecheckNoteRequest: request }, async () => {
                    try {
                        if (window.NC_importFromAnalysis) {
                            await Promise.resolve(window.NC_importFromAnalysis({ source: 'recheck', recheck: true }));
                        }
                    } catch (error) {
                        console.warn('TP recheck note import failed:', error);
                    }
                });
            });
        });
    });

    Object.entries(TP_COLUMN_REANALYZE_BTNS).forEach(([bucket, id]) => {
        document.getElementById(id)?.addEventListener('click', () => {
            startTpColumnRecheck(bucket, showToast, helpers);
        });
    });

    // Action buttons (Copy/Export)
    document.getElementById('tp-copyExcel')?.addEventListener('click', () => copyList('tpExcel', 'الممتازة'));
    document.getElementById('tp-copyMed')?.addEventListener('click', () => copyList('tpMed', 'المتوسطة'));
    document.getElementById('tp-copySat')?.addEventListener('click', () => copyList('tpSat', 'المشبعة'));
    document.getElementById('tp-copyEmp')?.addEventListener('click', () => copyList('tpEmp', 'غير المعروفة'));

    document.getElementById('tp-expExcel')?.addEventListener('click', () => {
        chrome.storage.local.get('tpExcel', d => exportTxt(d.tpExcel, 'excellent_niches.txt'));
    });

    document.getElementById('tp-expMed')?.addEventListener('click', () => {
        chrome.storage.local.get('tpMed', d => exportTxt(d.tpMed, 'medium_niches.txt'));
    });

    const detailSearch = document.getElementById('tp-detailSearch');
    if (detailSearch) {
        detailSearch.addEventListener('input', () => {
            tpDetailFilter = detailSearch.value;
            tpDetailPanelFingerprint = '';
            clearTimeout(tpDetailSearchTimer);
            tpDetailSearchTimer = setTimeout(() => {
                if (!isTeepublicPanelActive()) return;
                chrome.storage.local.get(
                    ['tpExcel', 'tpMed', 'tpSat', 'tpEmp', 'tpRunning', 'tpTotal'],
                    (d) => {
                        const ex = d.tpExcel || [];
                        const md = d.tpMed || [];
                        const st = d.tpSat || [];
                        const em = d.tpEmp || [];
                        const t = d.tpTotal || 0;
                        const dn = ex.length + md.length + st.length + em.length;
                        refreshTpCombinedDetailPanel(ex, md, st, em, {
                            running: !!d.tpRunning,
                            total: t,
                            done: dn,
                        });
                    }
                );
            }, (window.NHP_IS_LIGHT_MODE ? 400 : 280));
        });
    }

    document.getElementById('tp-copyDetailVisible')?.addEventListener('click', async () => {
        if (!tpDetailVisibleLines.length) {
            showToast('لا يوجد أسطر للنسخ.');
            return;
        }
        try {
            await navigator.clipboard.writeText(tpDetailVisibleLines.join('\n'));
            showToast(`✅ تم نسخ ${tpDetailVisibleLines.length} سطراً`);
        } catch (_) {
            showToast('تعذّر النسخ — تحقق من أذونات الحافظة.');
        }
    });

    document.getElementById('tp-expAll')?.addEventListener('click', () => {
        chrome.storage.local.get(['tpExcel', 'tpMed', 'tpSat', 'tpEmp'], d => {
            const e = d.tpExcel || [], m = d.tpMed || [], s = d.tpSat || [], em = d.tpEmp || [];
            const report = [
                '==========================================',
                '   تقرير تحليل النيتشات - TeePublic     ',
                '==========================================',
                `التاريخ: ${new Date().toLocaleDateString('ar-EG')}`,
                ``,
                `--- ⭐ الممتازة (${e.length}) ---`,
                ...e.map((n, i) => `${i + 1}. ${n}`),
                ``,
                `--- 📊 المتوسطة (${m.length}) ---`,
                ...m.map((n, i) => `${i + 1}. ${n}`),
                ``,
                `--- 🔥 المشبعة (${s.length}) ---`,
                ...s.map((n, i) => `${i + 1}. ${n}`),
                ``,
                `--- ❓ غير المعروفة (${em.length}) ---`,
                ...em.map((n, i) => `${i + 1}. ${n}`)
            ].join('\n');
            exportTxt(report, 'analysis_report.txt');
        });
    });
}
