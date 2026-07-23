/**
 * NICHE HUNTER PRO - USPTO MODULE
 * Handles trademark checking automation via USPTO.
 */

import { showToast, renderList, parseNiches } from '../utils.js';
import { switchTab } from '../ui.js';

export let U = {};

let usptoAutoTransferred = false;

export function initUSPTOModule() {
    // Re-acquire elements to be safe
    U = {
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
        previewBtn: document.getElementById('u-previewBtn')
    };

    if (U.input) {
        U.input.addEventListener('input', () => {
            if (U.inputCountEl) U.inputCountEl.textContent = parseNiches('u-niches').length;
        });
    }

    if (U.clearBtn) {
        U.clearBtn.addEventListener('click', () => {
            if (U.input) {
                U.input.value = '';
                if (U.inputCountEl) U.inputCountEl.textContent = 0;
            }
        });
    }

    if (U.startBtn) U.startBtn.addEventListener('click', uStartSearch);
    if (U.stopBtn) U.stopBtn.addEventListener('click', uStopSearch);
    if (U.resetBtn) U.resetBtn.addEventListener('click', uResetSearch);

    if (U.previewBtn) U.previewBtn.addEventListener('click', uTogglePreview);
    if (U.transferBtn) U.transferBtn.addEventListener('click', uTransferSafe);

    const formatBtn = document.getElementById('u-formatBtn');
    if (formatBtn) {
        formatBtn.addEventListener('click', () => window.formatNiches('u-niches', 'u-inputCount'));
    }

    const copySafeBtn = document.getElementById('u-copySafe');
    if (copySafeBtn) {
        copySafeBtn.addEventListener('click', () => window.copyList('uSafe', 'الآمنة'));
    }

    const copyBannedBtn = document.getElementById('u-copyBanned');
    if (copyBannedBtn) {
        copyBannedBtn.addEventListener('click', () => window.copyList('uBanned', 'المحظورة'));
    }

    const expSafeBtn = document.getElementById('u-expSafe');
    if (expSafeBtn) {
        expSafeBtn.addEventListener('click', () =>
            chrome.storage.local.get('uSafe', d => window.exportTxt(d.uSafe, 'safe_niches.txt')));
    }

    const expBannedBtn = document.getElementById('u-expBanned');
    if (expBannedBtn) {
        expBannedBtn.addEventListener('click', () =>
            chrome.storage.local.get('uBanned', d => window.exportTxt(d.uBanned, 'banned_niches.txt')));
    }

    const expAllBtn = document.getElementById('u-expAll');
    if (expAllBtn) {
        expAllBtn.addEventListener('click', exportUSPTOReport);
    }
}

export function updateUSPTO(data) {
    if (!U.statusEl) return; // Not initialized or in another context

    const safe = data.uSafe || [];
    const banned = data.uBanned || [];
    const pending = data.uPending || [];
    const total = data.uTotal || 0;
    const current = data.uCurrent || null;
    const running = data.uRunning || false;
    const done = safe.length + banned.length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;

    if (U.totalEl) U.totalEl.textContent = total;
    if (U.safeEl) U.safeEl.textContent = safe.length;
    if (U.bannedEl) U.bannedEl.textContent = banned.length;
    if (U.pendEl) U.pendEl.textContent = pending.length;
    if (U.safeCountEl) U.safeCountEl.textContent = safe.length;
    if (U.banCountEl) U.banCountEl.textContent = banned.length;
    if (U.barEl) U.barEl.style.width = pct + '%';
    if (U.pctEl) U.pctEl.textContent = pct + '%';
    const tabCount = document.getElementById('usptoTabCount');
    if (tabCount) tabCount.textContent = safe.length;

    renderList(safe, 'u-safeList');
    renderList(banned, 'u-bannedList');

    if (running) {
        if (U.dotEl) U.dotEl.classList.add('active');
        if (U.startBtn) {
            U.startBtn.disabled = true;
            U.startBtn.innerHTML = '<div class="spinner"></div> جاري الفحص...';
        }
        if (U.stopBtn) U.stopBtn.classList.remove('hidden');
        if (U.transferBtn) U.transferBtn.classList.add('hidden');
        if (U.alertEl) U.alertEl.style.display = 'none';
        if (current) {
            if (U.statusEl) U.statusEl.textContent = `فحص: "${current}" — ${done}/${total}`;
            if (U.badgeEl) {
                U.badgeEl.textContent = current;
                U.badgeEl.classList.remove('hidden');
            }
        }
    } else {
        if (U.dotEl) U.dotEl.classList.remove('active');
        if (U.stopBtn) U.stopBtn.classList.add('hidden');

        // Show transfer button if we have safe results and not running
        if (U.transferBtn) {
            if (safe.length > 0) {
                U.transferBtn.classList.remove('hidden');
            } else {
                U.transferBtn.classList.add('hidden');
            }
        }

        if (U.startBtn) {
            U.startBtn.disabled = false;
            if (done === 0) {
                U.startBtn.innerHTML = '🚀 بدء الفحص';
                if (U.statusEl) U.statusEl.textContent = 'في انتظار بدء الفحص...';
                usptoAutoTransferred = false;
            } else if (done === total && total > 0) {
                U.startBtn.innerHTML = '🚀 فحص جديد';
                if (U.statusEl) U.statusEl.textContent = `✅ اكتمل — ${safe.length} آمن، ${banned.length} محظور`;

                // --- AUTO-TRANSFER SAFE NICHES TO TEEPUBLIC ---
                if (!usptoAutoTransferred && safe.length > 0) {
                    usptoAutoTransferred = true;
                    const tpNichesInput = document.getElementById('tp-niches');
                    if (tpNichesInput) {
                        tpNichesInput.value = safe.join('\n');
                        const countEl = document.getElementById('tp-inputCount');
                        if (countEl) countEl.textContent = safe.length;

                        showToast('✅ اكتمل الفحص! تم نقل النيتشات الآمنة للتحليل...');

                        setTimeout(() => {
                            switchTab('teepublic');
                            setTimeout(() => {
                                const tpStart = document.getElementById('tp-startBtn');
                                if (tpStart) tpStart.click();
                            }, 800);
                        }, 1500);
                    }
                }
            } else {
                U.startBtn.innerHTML = '▶️ استئناف';
                if (U.statusEl) U.statusEl.textContent = `⏸ متوقف — ${done}/${total}`;
            }
        }
        if (U.badgeEl) U.badgeEl.classList.add('hidden');
    }

    // --- FULL AUTO SCAN SUPPORT ---
    if (data.isFullAuto) {
        if (!running && done === 0 && total > 0 && pending.length > 0) {
            if (U.startBtn) U.startBtn.click();
        }
    }
}

// Make globally available
window.UPDATE_USPTO = updateUSPTO;

export function uStartSearch() {
    chrome.storage.local.get(['uRunning'], d => {
        if (d.uRunning) return;

        const arr = parseNiches('u-niches');
        if (!arr.length) {
            if (U.alertEl) {
                U.alertEl.style.display = 'block';
                U.alertEl.textContent = '⚠️ أدخل اسم نيتش واحد على الأقل.';
            }
            return;
        }

        if (U.alertEl) U.alertEl.style.display = 'none';
        chrome.storage.local.set({
            uRunning: true,
            uPending: arr,
            uSafe: [],
            uBanned: [],
            uCurrent: null,
            uTotal: arr.length
        }, () => chrome.runtime.sendMessage({ action: 'u_start' }));
    });
}

export function uStopSearch() {
    chrome.storage.local.set({ uRunning: false, isFullAuto: false });
    chrome.runtime.sendMessage({ action: 'u_stop' });
    showToast('⏸ تم إيقاف الفحص');
}

export function uResetSearch() {
    if (!confirm('إعادة تعيين نتائج فحص الترجمة؟')) return;
    chrome.storage.local.set({
        uRunning: false, uPending: [], uSafe: [], uBanned: [],
        uCurrent: null, uTotal: 0
    });
    showToast('♻️ تمت إعادة التعيين');
}

export function uTogglePreview() {
    chrome.runtime.sendMessage({ action: 'u_toggle_preview' });
}

export function uTransferSafe() {
    chrome.storage.local.get(['uSafe'], (res) => {
        const safe = res.uSafe || [];
        if (!safe.length) return showToast('⚠️ لا توجد نيتشات آمنة لنقلها');
        const tpInput = document.getElementById('tp-niches');
        if (tpInput) {
            tpInput.value = safe.join('\n');
            tpInput.dispatchEvent(new Event('input'));
            showToast('✅ تم نقل النيتشات الآمنة للتحليل');
            switchTab('teepublic');
        }
    });
}

function exportUSPTOReport() {
    chrome.storage.local.get(['uSafe', 'uBanned'], d => {
        const s = d.uSafe || [], b = d.uBanned || [];
        const report = [
            '====================================',
            '   تقرير فحص العلامات التجارية (USPTO)  ',
            '====================================',
            `التاريخ: ${new Date().toLocaleDateString('ar-EG')}`,
            ``,
            `--- ✅ نيتشات آمنة (${s.length}) ---`,
            ...s.map((n, i) => `${i + 1}. ${n}`),
            ``,
            `--- 🚫 نيتشات محظورة (${b.length}) ---`,
            ...b.map((n, i) => `${i + 1}. ${n}`),
        ].join('\n');
        window.exportTxt(report, 'uspto_report.txt');
    });
}
