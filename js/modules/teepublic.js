/**
 * NICHE HUNTER PRO - TEEPUBLIC MODULE
 * Handles analyzing competition on TeePublic.
 */

import { showToast, renderList, parseNiches } from '../utils.js';
import { switchTab } from '../ui.js';

export let TP = {};

let tpAutoTransferred = false;

export function initTeePublicModule() {
    // Re-acquire elements to be safe
    TP = {
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

    if (TP.input) {
        TP.input.addEventListener('input', () => {
            if (TP.inputCountEl) TP.inputCountEl.textContent = parseNiches('tp-niches').length;
        });
    }

    if (TP.clearBtn) {
        TP.clearBtn.addEventListener('click', () => {
            if (TP.input) {
                TP.input.value = '';
                if (TP.inputCountEl) TP.inputCountEl.textContent = 0;
            }
        });
    }

    if (TP.startBtn) TP.startBtn.addEventListener('click', tpStartAnalysis);
    if (TP.stopBtn) TP.stopBtn.addEventListener('click', tpStopAnalysis);
    if (TP.resetBtn) TP.resetBtn.addEventListener('click', tpResetAnalysis);

    const formatBtn = document.getElementById('tp-formatBtn');
    if (formatBtn) {
        formatBtn.addEventListener('click', () => window.formatNiches('tp-niches', 'tp-inputCount'));
    }

    const copyExcelBtn = document.getElementById('tp-copyExcel');
    if (copyExcelBtn) {
        copyExcelBtn.addEventListener('click', () => window.copyList('tpExcel', 'الممتازة'));
    }

    const copyMedBtn = document.getElementById('tp-copyMed');
    if (copyMedBtn) {
        copyMedBtn.addEventListener('click', () => window.copyList('tpMed', 'المتوسطة'));
    }

    const copySatBtn = document.getElementById('tp-copySat');
    if (copySatBtn) {
        copySatBtn.addEventListener('click', () => window.copyList('tpSat', 'المشبعة'));
    }

    const copyEmpBtn = document.getElementById('tp-copyEmp');
    if (copyEmpBtn) {
        copyEmpBtn.addEventListener('click', () => window.copyList('tpEmp', 'الفارغة'));
    }

    const expExcelBtn = document.getElementById('tp-expExcel');
    if (expExcelBtn) {
        expExcelBtn.addEventListener('click', () =>
            chrome.storage.local.get('tpExcel', d => window.exportTxt(d.tpExcel, 'excellent_niches.txt')));
    }

    const expMedBtn = document.getElementById('tp-expMed');
    if (expMedBtn) {
        expMedBtn.addEventListener('click', () =>
            chrome.storage.local.get('tpMed', d => window.exportTxt(d.tpMed, 'medium_niches.txt')));
    }

    const expAllBtn = document.getElementById('tp-expAll');
    if (expAllBtn) {
        expAllBtn.addEventListener('click', exportTeePublicReport);
    }
}

export function updateTeePublic(data) {
    if (!TP.statusEl) return;

    const excel = data.tpExcel || [];
    const med = data.tpMed || [];
    const sat = data.tpSat || [];
    const emp = data.tpEmp || [];
    const pending = data.tpPending || [];
    const total = data.tpTotal || 0;
    const current = data.tpCurrent || null;
    const running = data.tpRunning || false;
    const done = excel.length + med.length + sat.length + emp.length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;

    if (TP.excelEl) TP.excelEl.textContent = excel.length;
    if (TP.medEl) TP.medEl.textContent = med.length;
    if (TP.satEl) TP.satEl.textContent = sat.length;
    if (TP.empEl) TP.empEl.textContent = emp.length;
    if (TP.excelCountEl) TP.excelCountEl.textContent = excel.length;
    if (TP.medCountEl) TP.medCountEl.textContent = med.length;
    if (TP.satCountEl) TP.satCountEl.textContent = sat.length;
    if (TP.empCountEl) TP.empCountEl.textContent = emp.length;
    if (TP.barEl) TP.barEl.style.width = pct + '%';
    if (TP.pctEl) TP.pctEl.textContent = pct + '%';

    const tabCount = document.getElementById('tpTabCount');
    if (tabCount) tabCount.textContent = excel.length;

    renderList(excel, 'tp-excelList');
    renderList(med, 'tp-medList');
    renderList(sat, 'tp-satList');
    renderList(emp, 'tp-empList');

    if (running) {
        if (TP.dotEl) TP.dotEl.classList.add('active');
        if (TP.startBtn) {
            TP.startBtn.disabled = true;
            TP.startBtn.innerHTML = '<div class="spinner"></div> جاري التحليل...';
        }
        if (TP.stopBtn) TP.stopBtn.classList.remove('hidden');
        if (TP.alertEl) TP.alertEl.style.display = 'none';
        if (current) {
            if (TP.statusEl) TP.statusEl.textContent = `تحليل: "${current}" — ${done}/${total}`;
            if (TP.badgeEl) {
                TP.badgeEl.textContent = current;
                TP.badgeEl.classList.remove('hidden');
            }
        }
    } else {
        if (TP.dotEl) TP.dotEl.classList.remove('active');
        if (TP.startBtn) {
            TP.startBtn.disabled = false;
            if (done === 0) {
                TP.startBtn.innerHTML = '📊 بدء التحليل';
                if (TP.statusEl) TP.statusEl.textContent = 'في انتظار بدء التحليل...';
                tpAutoTransferred = false;
            } else if (done === total && total > 0) {
                TP.startBtn.innerHTML = '📊 تحليل جديد';
                if (TP.statusEl) TP.statusEl.textContent = `✅ اكتمل — ${excel.length} ممتاز، ${med.length} متوسط، ${sat.length} مشبع`;

                // --- AUTO-TRANSFER TO NOTE SECTION ---
                if (!tpAutoTransferred) {
                    tpAutoTransferred = true;
                    if (excel.length > 0 || med.length > 0) {
                        if (window.NC_importFromAnalysis) {
                            window.NC_importFromAnalysis();
                            showToast('✅ اكتمل التحليل! تم نقل النتائج الممتازة والمتوسطة إلى NOTE...');
                            setTimeout(() => switchTab('note'), 1500);
                        } else {
                            const targetNiches = [...excel, ...med];
                            if (typeof window.updateSeoNicheDropdown === 'function') {
                                window.updateSeoNicheDropdown(targetNiches);
                                showToast('✅ اكتمل التحليل! تم تجهيز النيتشات للذكاء الاصطناعي...');
                                setTimeout(() => switchTab('seo'), 1500);
                            }
                        }
                    }
                }
            } else {
                TP.startBtn.innerHTML = '▶️ استئناف';
                if (TP.statusEl) TP.statusEl.textContent = `⏸ متوقف — ${done}/${total}`;
            }
        }
        if (TP.stopBtn) TP.stopBtn.classList.add('hidden');
        if (TP.badgeEl) TP.badgeEl.classList.add('hidden');
    }

    // --- FULL AUTO SCAN SUPPORT ---
    if (data.isFullAuto) {
        if (!running && done === 0 && total > 0 && pending.length > 0) {
            if (TP.startBtn) TP.startBtn.click();
        } else if (done === total && total > 0) {
            chrome.storage.local.set({ isFullAuto: false });
        }
    }
}

// Make globally available
window.UPDATE_TEEPUBLIC = updateTeePublic;

export function tpStartAnalysis() {
    chrome.storage.local.get(['tpRunning'], d => {
        if (d.tpRunning) return;

        const arr = parseNiches('tp-niches');
        if (!arr.length) {
            if (TP.alertEl) {
                TP.alertEl.style.display = 'block';
                TP.alertEl.textContent = '⚠️ أدخل نيتش واحد على الأقل.';
            }
            return;
        }

        if (TP.alertEl) TP.alertEl.style.display = 'none';
        chrome.storage.local.set({
            tpRunning: true,
            tpPending: arr,
            tpExcel: [],
            tpMed: [],
            tpSat: [],
            tpEmp: [],
            tpCurrent: null,
            tpTotal: arr.length
        }, () => chrome.runtime.sendMessage({ action: 'tp_start' }));
    });
}

export function tpStopAnalysis() {
    chrome.storage.local.set({ tpRunning: false, isFullAuto: false });
    chrome.runtime.sendMessage({ action: 'tp_stop' });
    showToast('⏸ تم إيقاف التحليل');
}

export function tpResetAnalysis() {
    if (!confirm('إعادة تعيين نتائج TeePublic؟')) return;
    chrome.storage.local.set({
        tpRunning: false, tpPending: [], tpExcel: [], tpMed: [], tpSat: [], tpEmp: [],
        tpCurrent: null, tpTotal: 0
    });
    showToast('♻️ تمت إعادة التعيين');
}

function exportTeePublicReport() {
    chrome.storage.local.get(['tpExcel', 'tpMed', 'tpSat', 'tpEmp'], d => {
        const ex = d.tpExcel || [], me = d.tpMed || [], sa = d.tpSat || [], em = d.tpEmp || [];
        const report = [
            '==========================================',
            '   تقرير تحليل المنافسة - TeePublic       ',
            '==========================================',
            `التاريخ: ${new Date().toLocaleDateString('ar-EG')}`,
            ``,
            `--- ⭐ ممتاز - منافسة ضعيفة (${ex.length}) ---`,
            ...ex.map((n, i) => `${i + 1}. ${n}`),
            ``,
            `--- 📊 متوسط - منافسة معتدلة (${me.length}) ---`,
            ...me.map((n, i) => `${i + 1}. ${n}`),
            ``,
            `--- 🔥 مشبع - منافسة شرسة (${sa.length}) ---`,
            ...sa.map((n, i) => `${i + 1}. ${n}`),
            ``,
            `--- ❓ فارغ - لا يوجد طلب (${em.length}) ---`,
            ...em.map((n, i) => `${i + 1}. ${n}`),
        ].join('\n');
        window.exportTxt(report, 'teepublic_report.txt');
    });
}
