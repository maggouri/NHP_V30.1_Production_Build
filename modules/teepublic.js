// ══════════════════════════════════════════════════════
//  ████████  TEEPUBLIC MODULE  ████████
// ══════════════════════════════════════════════════════

let tpAutoTransferred = false;

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

function formatNiches(inputId, countId, showToast, parseNiches) {
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
    showToast(`✅ تم تنظيم ${unique.length} نيتش!`);
}


export function updateTeePublic(data, renderList, showToast, switchTab, updateSeoNicheDropdown) {
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
    document.getElementById('tpTabCount').textContent = excel.length;

    renderList(excel, 'tp-excelList');
    renderList(med, 'tp-medList');
    renderList(sat, 'tp-satList');
    renderList(emp, 'tp-empList');

    if (running) {
        TP.dotEl.classList.add('active');
        TP.startBtn.disabled = true;
        TP.startBtn.innerHTML = '<div class="spinner"></div> جاري التحليل...';
        TP.stopBtn.classList.remove('hidden');
        TP.alertEl.style.display = 'none';
        if (current) {
            TP.statusEl.textContent = `تحليل: "${current}" — ${done}/${total}`;
            TP.badgeEl.textContent = current;
            TP.badgeEl.classList.remove('hidden');
        }
    } else {
        TP.dotEl.classList.remove('active');
        TP.startBtn.disabled = false;
        TP.stopBtn.classList.add('hidden');
        TP.badgeEl.classList.add('hidden');
        if (done === 0) {
            TP.startBtn.innerHTML = '📊 بدء التحليل';
            TP.statusEl.textContent = 'في انتظار بدء التحليل...';
            tpAutoTransferred = false; // Reset
        } else if (done === total && total > 0) {
            TP.startBtn.innerHTML = '📊 تحليل جديد';
            TP.statusEl.textContent = `✅ اكتمل — ${excel.length} ممتاز، ${med.length} متوسط، ${sat.length} مشبع`;

            if (!tpAutoTransferred) {
                tpAutoTransferred = true;
                if (excel.length > 0 || med.length > 0) {
                    if (window.NC_importFromAnalysis) {
                        window.NC_importFromAnalysis();
                        showToast('✅ اكتمل التحليل! تم نقل النتائج الممتازة والمتوسطة إلى NOTE...');
                        // Keep the current section; results are available in Notes when the user opens it.
                    } else {
                        const targetNiches = [...excel, ...med];
                        updateSeoNicheDropdown(targetNiches);
                        showToast('✅ اكتمل التحليل! تم تجهيز النيتشات للذكاء الاصطناعي...');
                        // Keep the current section; SEO data is prepared without stealing focus.
                    }
                }
            }
        } else {
            TP.startBtn.innerHTML = '▶️ استئناف';
            TP.statusEl.textContent = `⏸ متوقف — ${done}/${total}`;
        }
    }

    if (data.isFullAuto) {
        if (!running && done === 0 && total > 0 && pending.length > 0) {
            TP.startBtn.click();
        } else if (done === total && total > 0) {
            chrome.storage.local.set({ isFullAuto: false });
        }
    }
}

export function initTeePublicModule(helpers) {
    const { parseNiches, showToast, copyList, exportTxt, renderList, switchTab, updateSeoNicheDropdown } = helpers;

    if(!TP.startBtn) return;

    TP.input.addEventListener('input', () => {
        TP.inputCountEl.textContent = parseNiches('tp-niches').length;
    });
    TP.clearBtn.addEventListener('click', () => { TP.input.value = ''; TP.inputCountEl.textContent = 0; });
    document.getElementById('tp-formatBtn').addEventListener('click',
        () => formatNiches('tp-niches', 'tp-inputCount', showToast, parseNiches));

    TP.startBtn.addEventListener('click', () => {
        chrome.storage.local.get(['tpRunning'], d => {
            if (d.tpRunning) return;

            const arr = parseNiches('tp-niches');
            if (!arr.length) {
                TP.alertEl.style.display = 'block';
                TP.alertEl.textContent = '⚠️ أدخل نيتش واحد على الأقل.';
                return;
            }

            chrome.storage.local.get('isPro', licenseData => {
                const isPro = true; 
                if (!isPro && arr.length > 5) {
                    TP.alertEl.style.display = 'block';
                    TP.alertEl.innerHTML = '⚠️ النسخة المجانية تسمح بفحص 5 نيتشات كحد أقصى.<br><br><a href="https://maggouriverse.gumroad.com/l/yjgby" target="_blank" style="color:var(--primary); text-decoration:none; cursor:pointer; font-weight:bold; background:rgba(108, 99, 255, 0.1); padding:5px 10px; border-radius:5px; margin-top:5px; display:inline-block;">💎 الترقية للنسخة Pro الآن</a>';
                    return;
                }

                TP.alertEl.style.display = 'none';
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
        });
    });

    TP.stopBtn.addEventListener('click', () => {
        chrome.storage.local.set({ tpRunning: false, isFullAuto: false });
        chrome.runtime.sendMessage({ action: 'tp_stop' });
        showToast('⏸ تم إيقاف التحليل');
    });

    TP.resetBtn.addEventListener('click', () => {
        if (!confirm('إعادة تعيين نتائج TeePublic؟')) return;
        chrome.storage.local.set({
            tpRunning: false, tpPending: [], tpExcel: [], tpMed: [], tpSat: [], tpEmp: [],
            tpCurrent: null, tpTotal: 0
        });
        showToast('♻️ تمت إعادة التعيين');
    });

    document.getElementById('tp-copyExcel').addEventListener('click', () => copyList('tpExcel', 'الممتازة'));
    document.getElementById('tp-copyMed').addEventListener('click', () => copyList('tpMed', 'المتوسطة'));
    document.getElementById('tp-copySat').addEventListener('click', () => copyList('tpSat', 'المشبعة'));
    document.getElementById('tp-copyEmp').addEventListener('click', () => copyList('tpEmp', 'الفارغة'));

    document.getElementById('tp-expExcel').addEventListener('click', () =>
        chrome.storage.local.get('tpExcel', d => exportTxt(d.tpExcel, 'excellent_niches.txt')));
    document.getElementById('tp-expMed').addEventListener('click', () =>
        chrome.storage.local.get('tpMed', d => exportTxt(d.tpMed, 'medium_niches.txt')));
    document.getElementById('tp-expAll').addEventListener('click', () => {
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
                ``, `--- 📊 متوسط - منافسة معتدلة (${me.length}) ---`,
                ...me.map((n, i) => `${i + 1}. ${n}`),
                ``, `--- 🔥 مشبع - منافسة شرسة (${sa.length}) ---`,
                ...sa.map((n, i) => `${i + 1}. ${n}`),
                ``, `--- ❓ فارغ - لا يوجد طلب (${em.length}) ---`,
                ...em.map((n, i) => `${i + 1}. ${n}`),
            ].join('\n');
            exportTxt(report, 'teepublic_report.txt');
        });
    });
}
