import {
    createEmptyArchiveIndex,
    escapeHtml,
    formatArchiveDate,
    getArchiveIndexFromStorage,
    getArchiveRecord,
    recordTrendSnapshot,
    refreshArchiveIndex
} from './niche-archive.js';
import { bindSearchToolsSyncStatus, readCreatySearchToolsSyncReplacingOldTrends } from './creaty/search-tools-sync-ui.js';

let allDailyTrends = [];
let trendArchiveIndex = createEmptyArchiveIndex();
let trendArchiveHydrated = false;
let trendStorageListenerAttached = false;
let trendFetchPromise = null;
let trendDisplayOrder = [];
let trendPendingOrder = null;
let trendReorderTimer = null;
let trendHeaderUiAttached = false;
let trendScrollNavAttached = false;
let trendCheckedHistoryMap = {};
let trendResetInProgress = false;
let trendPanelBootstrapped = false;
let trendModuleInitialized = false;
let trendRenderFingerprint = '';
let trendStorageRenderTimer = null;
let trendListDelegationBound = false;
let trendListRendering = false;
let trendShowToastRef = null;
let trendScheduleSyncFab = null;
let trendRefreshProgressTimer = null;
let trendRefreshProgressValue = 0;
const TREND_REORDER_BATCH_MS = 15000;
const TREND_MAX_RENDER = Number.MAX_SAFE_INTEGER;
const TREND_NOISE_TERMS = new Set([
    'design', 'designs', 'for men', 'for women', 'men', 'women', 'kids', 'system', 'systems',
    't shirt', 't shirts', 'tee', 'tees', 'shirt', 'shirts', 'gift', 'gifts', 'shop',
    'newest', 'popular', 'staff picks', 'tag directory', 'trending tags'
]);
const TREND_NOISE_REGEX = [
    /\b(t[\s-]?shirt|tee|hoodie|sweatshirt|tank top|sticker|poster|mug)\b/i,
    /\b(for men|for women|for kids)\b/i,
    /^(new|popular|trending|best|shop)$/i
];

const PIPELINE_STAGE_KEYS = ['trend', 'tmhunt', 'uspto', 'analysis', 'note'];

const TREND = {
    panel: document.getElementById('panel-trend'),
    fetchBtn: document.getElementById('trend-fetch-btn'),
    fetchAndAutoBtn: document.getElementById('btn-fetch-and-full-auto'),
    listContainer: document.getElementById('trend-list-container'),
    filterInput: document.getElementById('trend-filter-input'),
    copyAllBtn: document.getElementById('trend-copy-all-btn'),
    clearCacheBtn: document.getElementById('trend-clear-cache-btn'),
    resetCheckedBtn: document.getElementById('trend-reset-checked-btn'),
    lastUpdateSpan: document.getElementById('trend-last-update'),
    btnText: document.querySelector('#trend-fetch-btn .btn-text'),
    loader: document.querySelector('#trend-fetch-btn .spinner-small'),
    fullAutoBtn: document.getElementById('btn-full-auto'),
    searchToggle: document.getElementById('trend-search-toggle'),
    moreToggle: document.getElementById('trend-more-toggle')
};

function isTrendPanelActive() {
    return !!TREND.panel?.classList.contains('active');
}

function getTrendMaxRender() {
    return TREND_MAX_RENDER;
}

function getTrendFilterDebounceMs() {
    return (window.NHP_IS_LIGHT_MODE || window.NHP_LOW_SPEC_MODE) ? 400 : 280;
}

function buildTrendRenderFingerprint(displayList, filterVal) {
    const slice = (displayList || []).slice(0, 48);
    const checkedSig = slice.map((n) => (isNicheChecked(n) ? '1' : '0')).join('');
    return [
        slice.length,
        filterVal,
        trendArchiveHydrated ? '1' : '0',
        checkedSig,
        trendDisplayOrder.length
    ].join('|');
}

function scheduleTrendStorageRerender(showToast) {
    if (!isTrendPanelActive()) return;
    clearTimeout(trendStorageRenderTimer);
    trendStorageRenderTimer = setTimeout(() => {
        trendRenderFingerprint = '';
        if (allDailyTrends.length > 0) renderTrendNiches(allDailyTrends, showToast);
    }, 500);
}

function bindTrendListDelegation(showToast) {
    if (trendListDelegationBound || !TREND.listContainer) return;
    trendListDelegationBound = true;
    TREND.listContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const card = target.closest('.trend-card');
        if (!card) return;
        const niche = card.dataset.niche || '';
        if (!niche) return;
        if (target.closest('.ai-niche-btn')) {
            e.preventDefault();
            generateDesignIdea(niche, showToast);
            return;
        }
        copyTextWithFallback(niche).then((ok) => {
            showToast(ok ? `✅ تم نسخ: ${niche}` : '❌ تعذّر النسخ للحافظة');
        });
    });
}

async function copyTextWithFallback(text) {
    const normalized = String(text || '');
    if (!normalized) return false;
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(normalized);
            return true;
        }
    } catch (_) {
        // Fallback below for environments where clipboard API rejects.
    }

    try {
        const ta = document.createElement('textarea');
        ta.value = normalized;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        ta.style.pointerEvents = 'none';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return !!ok;
    } catch (_) {
        return false;
    }
}

function setupTrendCompactHeaderUi() {
    if (!TREND.panel || trendHeaderUiAttached) return;
    trendHeaderUiAttached = true;

    const closeMore = () => TREND.panel.classList.remove('trend-more-open');
    const closeSearch = () => TREND.panel.classList.remove('trend-search-open');

    TREND.searchToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        TREND.panel.classList.toggle('trend-search-open');
        closeMore();
        if (TREND.panel.classList.contains('trend-search-open') && TREND.filterInput) {
            setTimeout(() => TREND.filterInput?.focus(), 10);
        }
    });

    TREND.moreToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        TREND.panel.classList.toggle('trend-more-open');
        closeSearch();
    });

    TREND.filterInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearch();
            TREND.searchToggle?.focus();
        }
    });

    document.addEventListener('click', (e) => {
        if (!(e.target instanceof Element)) return;
        if (!e.target.closest('#panel-trend .trend-more-wrap')) closeMore();
        if (!e.target.closest('#panel-trend .trend-search-wrap')) closeSearch();
    });

    TREND.panel.querySelectorAll('.trend-more-item[data-trend-target]').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetId = item.getAttribute('data-trend-target');
            const targetBtn = targetId ? document.getElementById(targetId) : null;
            if (targetBtn) targetBtn.click();
            closeMore();
        });
    });
}

function setupTrendListScrollNav() {
    if (trendScrollNavAttached) return;
    const el = TREND.listContainer;
    const up = document.getElementById('trend-scroll-up');
    const down = document.getElementById('trend-scroll-down');
    if (!el || !up || !down) return;
    trendScrollNavAttached = true;

    const wrap = el.closest('.trend-list-scroll-wrap');
    const fab = wrap?.querySelector('.trend-scroll-fab');

    const syncFab = () => {
        const overflow = el.scrollHeight > el.clientHeight + 2;
        if (fab) {
            fab.style.display = overflow ? 'flex' : 'none';
        }
        wrap?.classList.toggle('trend-scroll--overflow', overflow);
    };

    const scrollByDir = (dir) => {
        const step = Math.max(160, Math.floor(el.clientHeight * 0.82));
        el.scrollBy({ top: dir === 'up' ? -step : step, behavior: 'smooth' });
    };

    up.addEventListener('click', () => scrollByDir('up'));
    down.addEventListener('click', () => scrollByDir('down'));

    el.addEventListener('scroll', () => {
        syncFab();
    }, { passive: true });

    window.addEventListener('resize', syncFab);

    let fabSyncTimer = null;
    const scheduleSyncFab = () => {
        if (trendListRendering) return;
        clearTimeout(fabSyncTimer);
        fabSyncTimer = setTimeout(() => requestAnimationFrame(syncFab), 150);
    };
    trendScheduleSyncFab = scheduleSyncFab;

    if (typeof MutationObserver !== 'undefined') {
        const mo = new MutationObserver(scheduleSyncFab);
        mo.observe(el, { childList: true });
    }

    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(scheduleSyncFab);
        ro.observe(el);
    }

    syncFab();
}

function countPipelineStages(stages) {
    let filled = 0;
    PIPELINE_STAGE_KEYS.forEach((key) => {
        if (stages && stages[key]) filled += 1;
    });
    return { filled, total: PIPELINE_STAGE_KEYS.length };
}

function pipelineMetricPresentation(archiveRecord) {
    if (!archiveRecord) {
        return {
            label: '—',
            pctCss: 0,
            ringMod: ' trend-ring--muted',
            title: 'لم يُعثر على هذا النيتش في الأرشيف بعد آخر مزامنة.'
        };
    }
    const { filled, total } = countPipelineStages(archiveRecord.stages);
    const pct = Math.round((filled / total) * 100);
    return {
        label: `${pct}%`,
        pctCss: pct,
        ringMod: '',
        title: `تقدّم المسار عبر الأداة: ${filled}/${total} مراحل مكتملة (ترند، TMH، USPTO، تحليل، ملاحظات).`
    };
}

function setTrendRefreshProgress(pct, label) {
    const fill = document.getElementById('trend-refresh-fill');
    const labelEl = document.getElementById('trend-refresh-label');
    const pctEl = document.getElementById('trend-refresh-percent');
    const next = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    trendRefreshProgressValue = next;
    if (fill) fill.style.width = `${next}%`;
    if (labelEl && label) labelEl.textContent = label;
    if (pctEl) pctEl.textContent = `${next}%`;
}

function stopTrendRefreshProgressAnimation() {
    if (trendRefreshProgressTimer) {
        clearInterval(trendRefreshProgressTimer);
        trendRefreshProgressTimer = null;
    }
}

function startTrendRefreshProgressAnimation() {
    stopTrendRefreshProgressAnimation();
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const lite = !!(window.NHP_IS_LIGHT_MODE || window.NHP_LOW_SPEC_MODE);
    setTrendRefreshProgress(8, 'جاري الاتصال بـ TeePublic...');
    if (reducedMotion || lite) return;

    trendRefreshProgressTimer = setInterval(() => {
        if (trendRefreshProgressValue >= 92) return;
        const bump = trendRefreshProgressValue < 30 ? 2.0 : (trendRefreshProgressValue < 60 ? 1.0 : 0.35);
        const next = Math.min(92, trendRefreshProgressValue + bump);
        let label = 'جاري تحميل صفحة الترندات...';
        if (next >= 75) label = 'جارٍ تجربة المسارات الاحتياطية (تبويب / Oracle)...';
        else if (next >= 55) label = 'قد يستغرق وقتاً عند حماية Cloudflare — انتظر قليلاً';
        else if (next >= 30) label = 'جاري تحميل صفحة الترندات من TeePublic...';
        setTrendRefreshProgress(next, label);
    }, 520);
}

function setTrendListRefreshing(busy) {
    const panel = document.getElementById('trend-refresh-panel');
    if (panel) {
        panel.classList.toggle('hidden', !busy);
        panel.classList.toggle('is-active', !!busy);
        panel.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
    if (TREND.fetchBtn) TREND.fetchBtn.classList.toggle('trend-fetch-btn--loading', !!busy);
    if (TREND.listContainer) TREND.listContainer.classList.toggle('trend-list--refreshing', !!busy);

    if (busy) {
        startTrendRefreshProgressAnimation();
        const hasCards = !!TREND.listContainer?.querySelector('.trend-card');
        if (!hasCards && TREND.listContainer) {
            TREND.listContainer.innerHTML = `
                <div class="trend-refresh-placeholder">
                    <i class="fa-solid fa-cloud-arrow-down"></i>
                    <span>جاري جلب أحدث الترندات...</span>
                </div>`;
        }
        return;
    }

    stopTrendRefreshProgressAnimation();
    setTrendRefreshProgress(0, 'جاري جلب الترندات من TeePublic...');
}

function finishTrendRefreshProgress(success) {
    stopTrendRefreshProgressAnimation();
    if (success) {
        setTrendRefreshProgress(100, 'تم تحديث الترندات بنجاح');
        return;
    }
    setTrendRefreshProgress(0, 'توقف التحديث');
}

function scheduleTrendReorderCommit(showToast) {
    if (trendReorderTimer) return;
    trendReorderTimer = setTimeout(() => {
        trendReorderTimer = null;
        if (!Array.isArray(trendPendingOrder) || trendPendingOrder.length === 0) return;
        trendDisplayOrder = [...trendPendingOrder];
        trendPendingOrder = null;
        if (isTrendPanelActive()) renderTrendNiches(allDailyTrends, showToast);
    }, TREND_REORDER_BATCH_MS);
}

function buildTrendDisplayList(sourceList, showToast) {
    const source = Array.isArray(sourceList) ? sourceList : [];
    if (source.length === 0) {
        trendDisplayOrder = [];
        trendPendingOrder = null;
        return source;
    }

    const isFiltering = !!String(TREND.filterInput?.value || '').trim();
    if (isFiltering) return source;

    if (!trendDisplayOrder.length) {
        trendDisplayOrder = [...source];
        return [...trendDisplayOrder];
    }

    const sourceSet = new Set(source);
    const persisted = trendDisplayOrder.filter((item) => sourceSet.has(item));
    const persistedSet = new Set(persisted);
    const newcomers = source.filter((item) => !persistedSet.has(item));
    const stabilized = [...persisted, ...newcomers];

    const sameOrder = stabilized.length === source.length && stabilized.every((item, idx) => item === source[idx]);
    if (!sameOrder) {
        trendPendingOrder = [...source];
        scheduleTrendReorderCommit(showToast);
    } else {
        trendPendingOrder = null;
        trendDisplayOrder = [...source];
    }

    trendDisplayOrder = [...stabilized];
    return stabilized;
}

function normalizeTrendHistoryKey(value) {
    return String(value || '').trim().toLowerCase();
}

function isNicheChecked(niche) {
    const key = normalizeTrendHistoryKey(niche);
    return !!key && !!trendCheckedHistoryMap[key];
}

async function hydrateTrendCheckedHistory() {
    const data = await chrome.storage.local.get(['usptoHistory']);
    trendCheckedHistoryMap = data?.usptoHistory || {};
}

function buildTrendCardHtml(niche, i) {
    const archiveRecord = getArchiveRecord(trendArchiveIndex, niche);
    const isFresh = !archiveRecord || archiveRecord.appearances <= 1;
    const firstSeenLabel = archiveRecord?.firstSeenAt ? formatArchiveDate(archiveRecord.firstSeenAt) : 'اليوم';
    const repeatLabel = archiveRecord?.appearances > 1 ? `ظهر ${archiveRecord.appearances} مرات` : 'ظهور جديد';

    let metricLabel = '—';
    let successPct = 0;
    let metricTitle = 'لم يُحمَّل فهرس الأرشيف بعد؛ انتظر لحظات أو اضغط تحديث.';
    if (trendArchiveHydrated) {
        const m = pipelineMetricPresentation(archiveRecord);
        metricLabel = m.label;
        successPct = m.pctCss;
        metricTitle = m.title;
    }
    const archiveStrength = archiveRecord?.appearances ? Math.min(100, 35 + (archiveRecord.appearances * 12)) : 0;
    const rankStrength = Math.max(0, Math.min(100, 100 - (i * 4)));
    const strengthPct = trendArchiveHydrated
        ? Math.max(archiveStrength, rankStrength)
        : rankStrength;
    const rankText = `#${String(i + 1).padStart(2, '0')}`;
    const successClass = successPct >= 60 ? 'trend-pct-good' : (successPct >= 40 ? 'trend-pct-mid' : 'trend-pct-low');
    const strengthClass = strengthPct >= 60 ? 'trend-pct-good' : (strengthPct >= 40 ? 'trend-pct-mid' : 'trend-pct-low');
    const dateLabel = archiveRecord?.lastSeenAt
        ? `${escapeHtml(firstSeenLabel)} -> ${escapeHtml(formatArchiveDate(archiveRecord.lastSeenAt))}`
        : `Since ${escapeHtml(firstSeenLabel)}`;

    const safeNiche = escapeHtml(niche);
    const nicheChecked = isNicheChecked(niche);
    const newBadgeHtml = nicheChecked
        ? ''
        : '<span class="trend-new-badge" title="نيتش جديد غير مفحوص بعد">NEW</span>';
    const animDelay = (window.NHP_IS_LIGHT_MODE || i > 24) ? '' : ` style="animation-delay:${i * 0.03}s"`;

    return `<div class="trend-card" data-niche="${safeNiche}" title="${safeNiche}&#10;Dates: ${dateLabel}&#10;Rank: ${rankText}${isFresh ? ' • New' : ' • Seen'}&#10;${escapeHtml(repeatLabel)}"${animDelay}>
            <div class="trend-card-name">${safeNiche}${newBadgeHtml}</div>
            <div class="trend-pct-cell ${successClass}" title="${escapeHtml(metricTitle)}">
                <span class="np-bar"><span class="np-bar-fill" style="width:${successPct}%;"></span></span>
                <span class="trend-pct-value">${trendArchiveHydrated ? escapeHtml(metricLabel) : '—'}</span>
            </div>
            <div class="trend-pct-cell ${strengthClass}" title="${escapeHtml(repeatLabel)}">
                <span class="np-bar"><span class="np-bar-fill" style="width:${strengthPct}%;"></span></span>
                <span class="trend-pct-value">${strengthPct}%</span>
            </div>
            <div class="trend-card-actions">
                <i class="fa-solid fa-wand-sparkles ai-niche-btn" title="توليد فكرة تصميم"></i>
                <i class="fa-regular fa-copy trend-copy-ico" title="نسخ النيتش"></i>
            </div>
        </div>`;
}

function renderTrendNiches(list, showToast, options = {}) {
    if (!TREND.listContainer) return;
    const force = options.force === true;

    if (!list || list.length === 0) {
        trendRenderFingerprint = '';
        TREND.listContainer.innerHTML = '<div class="empty-msg">لا يوجد نتائج</div>';
        if (typeof trendScheduleSyncFab === 'function') trendScheduleSyncFab();
        return;
    }

    const filterVal = String(TREND.filterInput?.value || '').trim().toLowerCase();
    const displayList = buildTrendDisplayList(list, showToast).slice(0, getTrendMaxRender());
    const fp = buildTrendRenderFingerprint(displayList, filterVal);
    if (!force && fp === trendRenderFingerprint) return;
    trendRenderFingerprint = fp;

    const cardsHtml = displayList.map((niche, i) => buildTrendCardHtml(niche, i)).join('');

    trendListRendering = true;
    TREND.listContainer.innerHTML = cardsHtml;
    trendListRendering = false;
    if (typeof trendScheduleSyncFab === 'function') trendScheduleSyncFab();
}

async function generateDesignIdea(niche, showToast) {
    const ideaBox = document.getElementById('ai-design-idea');
    const ideaText = document.getElementById('ai-design-text');
    if (!ideaBox || !ideaText) return;

    ideaBox.classList.remove('hidden');
    ideaText.innerHTML = `⏳ جاري تحليل النيتش "${escapeHtml(niche)}" واستخراج فكرة رابحة...`;

    try {
        if (window.AICentralBrain) {
            const prompt = `Give me a creative, high-selling design idea and a short description for a T-shirt about "${niche}". Focus on minimalism and what works on TeePublic.`;
            const instruction = 'Design Strategist: Return a clear idea and short artistic description.';
            const res = await window.AICentralBrain._callAI(prompt, instruction);
            ideaText.textContent = res || '❌ فشل استخراج الفكرة.';
        } else {
            ideaText.textContent = '❌ العقل المركزي للذكاء الاصطناعي غير متصل أو غير مفعل.';
        }
    } catch (err) {
        ideaText.textContent = '❌ خطأ في الاتصال بالذكاء.';
    }
}

async function hydrateTrendArchive(showToast) {
    try {
        trendArchiveIndex = await getArchiveIndexFromStorage();
    } catch (error) {
        console.warn('Trend archive load failed:', error);
        trendArchiveIndex = createEmptyArchiveIndex();
    } finally {
        trendArchiveHydrated = true;
        if (allDailyTrends.length > 0 && isTrendPanelActive()) {
            trendRenderFingerprint = '';
            renderTrendNiches(allDailyTrends, showToast);
        }
    }
}

function bootstrapTrendPanel(showToast) {
    hydrateTrendCheckedHistory().catch(() => {
        trendCheckedHistoryMap = {};
    });
    hydrateTrendArchive(showToast);

    chrome.storage.local.get(['dailyTrends', 'trendLastUpdate', 'trendLastFetchDate', 'trendLastSource'], (result) => {
        if (result.dailyTrends) {
            allDailyTrends = result.dailyTrends;
            trendRenderFingerprint = '';
            renderTrendNiches(allDailyTrends, showToast, { force: true });
        }
        if (result.trendLastUpdate && TREND.lastUpdateSpan) {
            const srcBadge = result.trendLastSource === 'emailcore' ? ' · EmailCore' : '';
            TREND.lastUpdateSpan.textContent = `\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b: ${result.trendLastUpdate}${srcBadge}`;
        }
        bindSearchToolsSyncStatus(document.getElementById('trend-emailcore-sync'));

        // Old auto-fetch (TeePublic scrape / Oracle) — skipped when CREATY Search Tools sync replaces it.
        // Manual Refresh button still works.
        if (shouldAutoFetchTrends(result.dailyTrends, result.trendLastFetchDate) && isTrendPanelActive()) {
            readCreatySearchToolsSyncReplacingOldTrends().then((creatyReplaces) => {
                if (!creatyReplaces) fetchAndRenderTrends(showToast);
            }).catch(() => {
                fetchAndRenderTrends(showToast);
            });
        }
    });
}

function activateTrendPanel() {
    const showToast = trendShowToastRef;
    if (!showToast) return;
    if (!trendPanelBootstrapped) {
        trendPanelBootstrapped = true;
        bootstrapTrendPanel(showToast);
        return;
    }
    if (allDailyTrends.length > 0) {
        trendRenderFingerprint = '';
        renderTrendNiches(allDailyTrends, showToast, { force: true });
    }
}

function shouldAutoFetchTrends(cachedTrends, lastFetchDate) {
    if (!Array.isArray(cachedTrends) || cachedTrends.length === 0) return true;
    return lastFetchDate !== new Date().toDateString();
}

function normalizeTrendCandidate(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/^#+/, '')
        .replace(/[|•·]+/g, ' ')
        .replace(/\s+t-?shirt$/i, '')
        .trim();
}

function isValidTrendCandidate(value) {
    const text = normalizeTrendCandidate(value);
    const key = text.toLowerCase();
    if (!text || text.length < 3 || text.length > 60) return false;
    if (TREND_NOISE_TERMS.has(key)) return false;
    if (TREND_NOISE_REGEX.some((pattern) => pattern.test(text))) return false;
    if (/^\d+$/.test(text)) return false;
    if (!/[a-z]/i.test(text)) return false;
    if (/^(for|and|the|with|from|shop)\b/i.test(text) && text.split(/\s+/).length <= 3) return false;
    return true;
}

function cleanTrendCandidates(list) {
    const clean = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((item) => {
        const text = normalizeTrendCandidate(item);
        const key = text.toLowerCase();
        if (!isValidTrendCandidate(text) || seen.has(key)) return;
        seen.add(key);
        clean.push(text);
    });
    return clean;
}

function isSuspiciousTrendList(list) {
    const clean = cleanTrendCandidates(list);
    if (clean.length < 5) return true;
    const original = Array.isArray(list) ? list : [];
    const noiseCount = original.filter((item) => !isValidTrendCandidate(item)).length;
    return original.length > 0 && noiseCount / original.length > 0.35;
}

function extractTrendsFromStructuredPayload(payload) {
    const trends = Array.isArray(payload?.trends) ? payload.trends : [];
    return cleanTrendCandidates(
        trends.map((entry) => (typeof entry === 'string' ? entry : (entry?.title || entry?.text || '')))
    );
}

function sendTrendFetchMessage(attempt = 1, maxAttempts = 4) {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ action: 'fetch_trends' }, (response) => {
                const lastErr = chrome.runtime.lastError;
                if (!lastErr) {
                    if (response == null) {
                        if (attempt < maxAttempts) {
                            setTimeout(() => {
                                sendTrendFetchMessage(attempt + 1, maxAttempts).then(resolve);
                            }, 500 * attempt);
                            return;
                        }
                        return resolve({ success: false, error: 'Empty response from background worker' });
                    }
                    return resolve(response);
                }
                if (attempt >= maxAttempts) {
                    return resolve({ success: false, error: lastErr.message });
                }
                setTimeout(() => {
                    sendTrendFetchMessage(attempt + 1, maxAttempts).then(resolve);
                }, 500 * attempt);
            });
        } catch (error) {
            resolve({ success: false, error: error?.message || String(error) });
        }
    });
}

async function fetchAndRenderTrends(showToast) {
    if (trendFetchPromise) return trendFetchPromise;

    TREND.btnText.classList.add('hidden');
    TREND.loader.classList.remove('hidden');
    TREND.fetchBtn.disabled = true;
    setTrendListRefreshing(true);

    trendFetchPromise = (async () => {
        let fetchSucceeded = false;
        try {
            const res = await sendTrendFetchMessage();
            setTrendRefreshProgress(Math.max(trendRefreshProgressValue, 52), 'تم الاتصال — جاري تحليل الصفحة...');

            if (!res || !res.success) {
                const detail = String(res?.error || '').trim();
                throw new Error(detail || 'فشل الجلب من الخلفية (لا رد من خدمة الترندات)');
            }

            let extracted = [];
            let cleanExtracted = [];

            if (typeof res.data === 'string') {
                const parser = new DOMParser();
                const doc = parser.parseFromString(res.data, 'text/html');
                const startMarker = 'The directory below has been automatically generated';
                const endMarker = 'Subscribe to Our Newsletter';
                const bodyText = doc.body.innerText;
                const startIndex = bodyText.indexOf(startMarker);
                const endIndex = bodyText.indexOf(endMarker);
                const elements = doc.querySelectorAll('.trending-tag .link_content, .trending-tag a, .trending-tags a, a[href*="/trending-tags"]');

                elements.forEach((el) => {
                    const text = normalizeTrendCandidate(el.innerText || el.textContent || '');
                    if (!text || text.length < 2) return;
                    const pos = startIndex !== -1 ? bodyText.indexOf(text, startIndex) : 0;
                    if (isValidTrendCandidate(text) && pos !== -1 && (endIndex === -1 || pos < endIndex) && !extracted.includes(text)) {
                        extracted.push(text);
                    }
                });
                cleanExtracted = cleanTrendCandidates(extracted);
            } else {
                cleanExtracted = extractTrendsFromStructuredPayload(res.data);
                extracted = [...cleanExtracted];
            }

            if (cleanExtracted.length > 0 && !isSuspiciousTrendList(extracted)) {
                allDailyTrends = cleanExtracted;
                const now = new Date().toLocaleString('ar-EG');
                if (typeof window.NHP_markStorageEchoSuppress === 'function') {
                    window.NHP_markStorageEchoSuppress(['dailyTrends', 'trendLastUpdate', 'trendLastFetchDate']);
                }
                await chrome.storage.local.set({
                    dailyTrends: allDailyTrends,
                    trendLastUpdate: now,
                    trendLastFetchDate: new Date().toDateString()
                });
                TREND.lastUpdateSpan.textContent = `\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b: ${now}`;

                try {
                    trendArchiveIndex = await recordTrendSnapshot(allDailyTrends, 'manual_fetch');
                } catch (archiveError) {
                    console.warn('Trend archive sync failed:', archiveError);
                    trendArchiveIndex = await getArchiveIndexFromStorage();
                }

                trendRenderFingerprint = '';
                renderTrendNiches(allDailyTrends, showToast, { force: true });
                fetchSucceeded = true;
                showToast('\u2705 \u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062a\u0631\u0646\u062f\u0627\u062a \u0648\u062d\u0641\u0638\u0647\u0627 \u0644\u0644\u0623\u0631\u0634\u0641\u0629 \u0648\u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629');
            } else {
                showToast('⚠️ تم رفض نتيجة الترندات لأنها تبدو عامة أو ملوثة، وتم الحفاظ على القائمة السابقة.');
            }
        } catch (error) {
            const msg = String(error?.message || error || 'فشل غير معروف');
            const shortMsg = msg.length > 160 ? `${msg.slice(0, 157)}...` : msg;
            setTrendRefreshProgress(Math.max(trendRefreshProgressValue, 0), `تعذر الجلب: ${shortMsg}`);
            showToast(`❌ خطأ في الجلب من الخلفية: ${shortMsg}`);
        } finally {
            TREND.btnText?.classList.remove('hidden');
            TREND.loader?.classList.add('hidden');
            finishTrendRefreshProgress(fetchSucceeded);
            const hideDelay = fetchSucceeded ? 500 : 2200;
            setTimeout(() => {
                if (TREND.fetchBtn) TREND.fetchBtn.disabled = false;
                setTrendListRefreshing(false);
                trendFetchPromise = null;
            }, hideDelay);
        }
    })();

    return trendFetchPromise;
}

export function initTrendModule(showToast, switchTab) {
    if (!TREND.fetchBtn || trendModuleInitialized) return;
    trendModuleInitialized = true;
    trendShowToastRef = showToast;

    setupTrendCompactHeaderUi();
    setupTrendListScrollNav();
    bindTrendListDelegation(showToast);

    window.NHP_activateTrendPanel = activateTrendPanel;

    if (!trendStorageListenerAttached) {
        trendStorageListenerAttached = true;
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (changes.nhp_niche_archive_index) {
                trendArchiveIndex = changes.nhp_niche_archive_index.newValue || createEmptyArchiveIndex();
                trendArchiveHydrated = true;
                scheduleTrendStorageRerender(showToast);
            }
            if (changes.usptoHistory) {
                trendCheckedHistoryMap = changes.usptoHistory.newValue || {};
                scheduleTrendStorageRerender(showToast);
            }
        });
    }

    TREND.fetchBtn.addEventListener('click', async () => {
        await fetchAndRenderTrends(showToast);
    });

    if (TREND.fetchAndAutoBtn) {
        TREND.fetchAndAutoBtn.addEventListener('click', async () => {
            if (TREND.fetchAndAutoBtn) TREND.fetchAndAutoBtn.disabled = true;
            if (TREND.fetchBtn) TREND.fetchBtn.disabled = true;
            if (TREND.fullAutoBtn) TREND.fullAutoBtn.disabled = true;

            const previousHtml = TREND.fetchAndAutoBtn.innerHTML;
            TREND.fetchAndAutoBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            showToast('🔄 جاري جلب النيتشات أولاً...');

            try {
                await fetchAndRenderTrends(showToast);
                const nichesToUse = allDailyTrends.length > 0 ? allDailyTrends : [];
                if (nichesToUse.length === 0) {
                    showToast('⚠️ لم يتم العثور على نيتشات للتحليل.');
                    return;
                }

                showToast(`🚀 تم جلب ${nichesToUse.length} نيتش. جاري بدء التحليل الكامل...`);
                const response = await chrome.runtime.sendMessage({ action: 'START_FULL_PIPELINE', niches: nichesToUse });
                if (response?.status === 'PIPELINE_STARTED') {
                    showToast('✅ تم بدء المسار الكامل بنجاح.');
                } else if (response?.error) {
                    showToast(`❌ فشل بدء المسار الكامل: ${response.error}`);
                } else {
                    showToast('⚠️ تم إرسال الطلب لكن لم يصل تأكيد واضح من الخلفية.');
                }
            } catch (error) {
                const message = error?.message || 'تعذّر التواصل مع خدمة الخلفية.';
                console.error('[Trend] Fetch and Auto failed:', error);
                showToast(`❌ ${message}`);
            } finally {
                if (TREND.fetchAndAutoBtn) {
                    TREND.fetchAndAutoBtn.disabled = false;
                    TREND.fetchAndAutoBtn.innerHTML = previousHtml;
                }
                if (TREND.fetchBtn) TREND.fetchBtn.disabled = false;
                if (TREND.fullAutoBtn) TREND.fullAutoBtn.disabled = false;
            }
        });
    }
    
    let filterTimeout;
    TREND.filterInput.addEventListener('input', (e) => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            const val = e.target.value.toLowerCase();
            const filtered = allDailyTrends.filter((niche) => niche.toLowerCase().includes(val));
            trendRenderFingerprint = '';
            renderTrendNiches(filtered, showToast, { force: true });
        }, getTrendFilterDebounceMs());
    });

    if (TREND.fullAutoBtn) {
        TREND.fullAutoBtn.addEventListener('click', async () => {
            const nichesToUse = allDailyTrends.length > 0 ? allDailyTrends : [];
            if (nichesToUse.length === 0) {
                try {
                    trendArchiveIndex = await refreshArchiveIndex();
                } catch (_) { }
            }

            TREND.fullAutoBtn.disabled = true;
            const previousHtml = TREND.fullAutoBtn.innerHTML;
            TREND.fullAutoBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التشغيل...';
            showToast(
                nichesToUse.length > 0
                    ? `🚀 جاري بدء المسار الكامل لـ ${nichesToUse.length} نيتش...`
                    : '🚀 جاري بدء المسار الكامل مع جلب ترندات جديدة...'
            );
            try {
                const response = await chrome.runtime.sendMessage({ action: 'START_FULL_PIPELINE', niches: nichesToUse });
                if (response?.status === 'PIPELINE_STARTED') {
                    showToast('✅ تم بدء المسار الكامل بنجاح.');
                } else if (response?.error) {
                    showToast(`❌ فشل بدء المسار الكامل: ${response.error}`);
                } else {
                    showToast('⚠️ تم إرسال الطلب لكن لم يصل تأكيد واضح من الخلفية.');
                }
            } catch (error) {
                const message = error?.message || 'تعذّر التواصل مع خدمة الخلفية.';
                console.error('[Trend] START_FULL_PIPELINE failed:', error);
                showToast(`❌ ${message}`);
            } finally {
                TREND.fullAutoBtn.disabled = false;
                TREND.fullAutoBtn.innerHTML = previousHtml;
            }
        });
    }

    if (TREND.resetCheckedBtn) {
        TREND.resetCheckedBtn.addEventListener('click', async () => {
            if (trendResetInProgress) return;
            const nichesToReset = Array.isArray(allDailyTrends)
                ? allDailyTrends.map((n) => String(n || '').trim()).filter(Boolean)
                : [];

            if (nichesToReset.length === 0) {
                showToast('⚠️ لا توجد نيشات حالية لإعادة الضبط');
                return;
            }

            trendResetInProgress = true;
            TREND.resetCheckedBtn.disabled = true;
            const previousHtml = TREND.resetCheckedBtn.innerHTML;
            TREND.resetCheckedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';

            try {
                const { usptoHistory, tpHistory } = await chrome.storage.local.get(['usptoHistory', 'tpHistory']);
                const nextUsptoHistory = { ...(usptoHistory || {}) };
                const nextTpHistory = { ...(tpHistory || {}) };
                let changedCount = 0;

                nichesToReset.forEach((niche) => {
                    const key = normalizeTrendHistoryKey(niche);
                    if (!key) return;
                    if (Object.prototype.hasOwnProperty.call(nextUsptoHistory, key)) {
                        delete nextUsptoHistory[key];
                        changedCount += 1;
                    }
                    if (Object.prototype.hasOwnProperty.call(nextTpHistory, key)) {
                        delete nextTpHistory[key];
                    }
                });

                await chrome.storage.local.set({
                    usptoHistory: nextUsptoHistory,
                    tpHistory: nextTpHistory
                });

                trendCheckedHistoryMap = nextUsptoHistory;
                trendRenderFingerprint = '';
                renderTrendNiches(allDailyTrends, showToast, { force: true });
                showToast(changedCount > 0
                    ? `✅ Reset checked state for ${changedCount} niches.`
                    : 'ℹ️ لا توجد نيشات مفحوصة لإعادة ضبطها ضمن القائمة الحالية.');
            } catch (error) {
                const msg = error?.message || 'Unknown error';
                showToast(`❌ فشل Reset Checked: ${msg}`);
            } finally {
                trendResetInProgress = false;
                TREND.resetCheckedBtn.disabled = false;
                TREND.resetCheckedBtn.innerHTML = previousHtml;
            }
        });
    }

    TREND.copyAllBtn.addEventListener('click', async () => {
        if (allDailyTrends.length === 0) {
            showToast('⚠️ القائمة فارغة');
            return;
        }
        const ok = await copyTextWithFallback(allDailyTrends.join('\n'));
        showToast(ok ? '✅ تم نسخ جميع الترندات!' : '❌ تعذّر نسخ الترندات');
    });

    if (TREND.clearCacheBtn) {
        TREND.clearCacheBtn.addEventListener('click', async () => {
            allDailyTrends = [];
            await chrome.storage.local.remove(['dailyTrends', 'trendLastUpdate', 'trendLastFetchDate']);
            if (TREND.lastUpdateSpan) TREND.lastUpdateSpan.textContent = 'آخر تحديث: لم يتم بعد';
            trendRenderFingerprint = '';
            renderTrendNiches([], showToast, { force: true });
            showToast('✅ تم مسح كاش الترندات اليومية فقط');
        });
    }

    const aiTrendBtn = document.getElementById('btn-ai-trend-analyze');
    const aiTrendResults = document.getElementById('ai-trend-results');
    const aiTrendText = document.getElementById('ai-trend-text');

    if (aiTrendBtn) {
        aiTrendBtn.addEventListener('click', async () => {
            if (allDailyTrends.length === 0) {
                showToast('⚠️ يرجى جلب الترندات أولاً');
                return;
            }

            aiTrendBtn.disabled = true;
            aiTrendResults.classList.remove('hidden');
            aiTrendText.innerHTML = '⏳ جاري تحليل الترندات واستخراج النيشات المدمجة...';

            try {
                if (window.AICentralBrain) {
                    const strategy = await window.AICentralBrain.analyzeTrends(allDailyTrends);
                    if (strategy) {
                        aiTrendText.textContent = strategy;
                        showToast('✨ تم استخراج الاستراتيجية الذكية بنجاح!');
                    } else {
                        aiTrendText.textContent = '❌ فشل تحليل الذكاء الاصطناعي';
                    }
                } else {
                    showToast('❌ العقل المركزي غير متصل');
                }
            } catch (err) {
                console.error('AI Trend Logic Error:', err);
                aiTrendText.textContent = `❌ حدث خطأ: ${err.message}`;
            } finally {
                aiTrendBtn.disabled = false;
            }
        });
    }

    const copyPromptBtn = document.getElementById('copy-design-prompt');
    const aiDesignText = document.getElementById('ai-design-text');
    if (copyPromptBtn && aiDesignText) {
        copyPromptBtn.addEventListener('click', () => {
            const text = aiDesignText.textContent;
            if (text && !text.includes('جاري')) {
                copyTextWithFallback(text).then((ok) => {
                    showToast(ok ? '✅ تم نسخ المقترح التصميمي!' : '❌ تعذّر نسخ المقترح');
                });
            }
        });
    }
}
