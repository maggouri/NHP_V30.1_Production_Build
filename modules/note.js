// ══════════════════════════════════════════════════════
//  ████████  NOTE MODULE (NICHE COMMANDER)  ████████
// ══════════════════════════════════════════════════════

/**
 * State and Store
 */
let NC_state = {
    niches: [],
    doneHistory: [],
    history: [] // [{ timestamp: "...", niches: [...] }]
};

let showToastRef = (msg) => console.log("TOAST:", msg);
let switchTabRef = (name) => console.log("SWITCH TAB:", name);

function NC_openIsolatedPopup(url) {
    const popupWidth = 800;
    const popupHeight = 600;

    if (typeof chrome !== 'undefined' && chrome.windows?.create) {
        const screenWidth = typeof screen !== 'undefined' && Number.isFinite(screen.availWidth) ? screen.availWidth : popupWidth;
        const screenHeight = typeof screen !== 'undefined' && Number.isFinite(screen.availHeight) ? screen.availHeight : popupHeight;
        const left = Math.round((screenWidth - popupWidth) / 2);
        const top = Math.round((screenHeight - popupHeight) / 2);
        chrome.windows.create({
            url,
            type: 'popup',
            width: popupWidth,
            height: popupHeight,
            left,
            top,
            focused: true
        });
        return;
    }

    // Fallback for environments without chrome.windows.
    if (typeof window !== 'undefined') {
        const fallbackLeft = Math.round(((window.screen?.availWidth || popupWidth) - popupWidth) / 2);
        const fallbackTop = Math.round(((window.screen?.availHeight || popupHeight) - popupHeight) / 2);
        window.open(
            url,
            '_blank',
            `popup=yes,width=${popupWidth},height=${popupHeight},left=${fallbackLeft},top=${fallbackTop},noopener,noreferrer`
        );
    }
}

/**
 * Storage Functions
 */
async function NC_saveToLocal() {
    return new Promise(resolve => {
        const dataToSave = {
            niches: NC_state.niches,
            doneHistory: NC_state.doneHistory,
            history: NC_state.history
        };
        chrome.storage.local.set({ 'teepublic_manager_data': dataToSave }, () => {
            console.log("NC: Saved to local storage");
            resolve();
        });
    });
}

async function NC_loadFromLocal() {
    return new Promise(resolve => {
        chrome.storage.local.get(['teepublic_manager_data'], (res) => {
            const data = res.teepublic_manager_data;
            if (data) {
                NC_state.niches = data.niches || [];
                NC_state.doneHistory = data.doneHistory || [];
                NC_state.history = data.history || [];
            } else {
                NC_state.niches = [];
                NC_state.history = [];
            }
            resolve();
        });
    });
}

/**
 * UI Functions
 */
function NC_renderList(filter = "") {
    const container = document.getElementById('niche-container');
    if (!container) return;
    container.innerHTML = "";

    const filtered = NC_state.niches.filter(n => n.text.toLowerCase().includes(filter.toLowerCase()));

    const statsEl = document.getElementById('nc-stats');
    if (statsEl) {
        statsEl.innerText = `${filtered.length} نيش`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 opacity-30">
                <i class="fa-solid fa-cloud-upload-alt text-4xl mb-3 text-slate-500"></i>
                <p class="text-[10px] text-slate-400 uppercase tracking-widest font-bold">لصق النيشات للبدء</p>
            </div>
        `;
        return;
    }

    filtered.forEach(niche => {
        const div = document.createElement('div');
        const cleanLower = niche.text.trim().toLowerCase();
        const isPreviouslyDone = NC_state.doneHistory.includes(cleanLower);
        const isActuallyDone = niche.done || isPreviouslyDone;

        div.className = `nc-task-card ${isActuallyDone ? 'niche-done' : ''}`;

        // Get Quality Badge
        let qBadge = '';
        if (niche.quality === 'excellent') {
            qBadge = '<span style="background:var(--safe); color:#fff; font-size:7px; padding:1px 3px; border-radius:2px; margin-right:5px; font-weight:700;">EXC</span>';
        } else if (niche.quality === 'average') {
            qBadge = '<span style="background:var(--warning); color:#fff; font-size:7px; padding:1px 3px; border-radius:2px; margin-right:5px; font-weight:700;">MED</span>';
        }
        
        let rankBadge = '';
        if (niche.rank && niche.rank !== 999999) {
            rankBadge = `<span style="background:#4f46e5; color:#fff; font-size:7px; padding:1px 4px; border-radius:2px; margin-right:5px; font-weight:700;">#${niche.rank}</span>`;
        }

        // One-click copy
        div.onclick = (e) => {
            if (!e.target.closest('.interactive')) {
                NC_copyNicheText(niche.id, niche.text);
            }
        };

        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="nc-btn-group flex items-center gap-1.5">
                    <button class="interactive nc-action-btn btn-delete px-1.5" title="حذف">
                        <i class="fa-solid fa-ban text-[9px]"></i>
                    </button>
                    <button class="interactive nc-action-btn btn-google px-2" title="Google Images (24h)" style="background:rgba(66,133,244,0.1); color:#4285F4; border:1px solid rgba(66,133,244,0.2);">
                        <i class="fa-brands fa-google text-[9px] font-bold">G</i>
                    </button>
                    <button class="interactive nc-action-btn btn-pinterest px-2" title="Pinterest Search" style="background:rgba(230,0,35,0.1); color:#E60023; border:1px solid rgba(230,0,35,0.2);">
                        <i class="fa-brands fa-pinterest text-[9px] font-bold">P</i>
                    </button>
                    <button class="interactive nc-action-btn btn-radar px-1.5" title="Radar Scan" style="background:rgba(236,72,153,0.1); color:#ec4899; border:1px solid rgba(236,72,153,0.2);">
                        <i class="fa-solid fa-magnifying-glass text-[9px]"></i>
                    </button>
                    <button class="interactive nc-action-btn btn-preview px-1.5" title="معاينة على TeePublic">
                        <i class="fa-solid fa-eye text-[9px]"></i>
                    </button>
                    <button class="interactive nc-action-btn btn-done px-1.5" title="إنجاز">
                        <i class="fa-solid fa-check text-[9px]"></i>
                    </button>
                </div>
            </div>
            <div class="flex-1 flex justify-end items-center overflow-hidden pr-3">
                ${rankBadge}
                ${qBadge}
                <span class="task-text text-right mr-3" style="font-weight:700;">${niche.text}</span>
                 <div class="w-2.5 h-2.5 rounded-full ${isActuallyDone ? 'bg-slate-700' : 'bg-blue-500'} shadow-lg shadow-blue-500/20"></div>
            </div>
        `;

        // Attach event listeners after innerHTML is set
        div.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            NC_deleteNiche(niche.id);
        });

        div.querySelector('.btn-done').addEventListener('click', (e) => {
            e.stopPropagation();
            NC_toggleDone(niche.id);
        });

        div.querySelector('.btn-radar').addEventListener('click', (e) => {
            e.stopPropagation();
            const scanInput = document.getElementById('lab-scan-query');
            const startBtn = document.getElementById('lab-start-scan');
            if (scanInput && startBtn) {
                scanInput.value = niche.text;
                switchTabRef('lab');
                setTimeout(() => startBtn.click(), 300);
            }
        });

        div.querySelector('.btn-google').addEventListener('click', (e) => {
            e.stopPropagation();
            const url = `https://www.google.com/search?q=${encodeURIComponent(niche.text)}&tbm=isch&tbs=qdr:d`;
            NC_openIsolatedPopup(url);
        });

        div.querySelector('.btn-pinterest').addEventListener('click', (e) => {
            e.stopPropagation();
            const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(niche.text)}&rs=typed`;
            NC_openIsolatedPopup(url);
        });

        div.querySelector('.btn-preview').addEventListener('click', (e) => {
            e.stopPropagation();
            const url = `https://www.teepublic.com/t-shirts?query=${encodeURIComponent(niche.text)}`;
            NC_openIsolatedPopup(url);
        });

        container.appendChild(div);
    });
}

function NC_renderHistory() {
    const container = document.getElementById('nc-history-list');
    if (!container) return;
    container.innerHTML = "";

    if (!NC_state.history || NC_state.history.length === 0) {
        container.innerHTML = `<div class="text-center py-4 text-[10px] text-white/20">لا يوجد سجل حالياً</div>`;
        return;
    }

    // Show last 10 batches
    const reversedHistory = [...NC_state.history].reverse().slice(0, 10);

    reversedHistory.forEach((batch, idx) => {
        const actualIdx = NC_state.history.length - 1 - idx;
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-2 mb-1 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all";
        div.innerHTML = `
            <div class="flex flex-col">
                <span style="font-size:10px; font-weight:700; color:var(--primary);">${batch.timestamp}</span>
                <span style="font-size:9px; color:var(--text-muted);">${batch.niches.length} نيش</span>
            </div>
            <div class="flex gap-2">
                <button class="interactive p-1.5 bg-white/5 rounded hover:bg-white/20 btn-download-batch" title="تحميل TXT">
                    <i class="fa-solid fa-download text-[10px] text-white"></i>
                </button>
                <button class="interactive p-1.5 bg-red-500/10 rounded hover:bg-red-500/20 btn-delete-history" title="حذف من السجل">
                    <i class="fa-solid fa-trash-can text-[10px] text-red-400"></i>
                </button>
            </div>
        `;

        div.querySelector('.btn-download-batch').addEventListener('click', () => NC_downloadBatch(actualIdx));
        div.querySelector('.btn-delete-history').addEventListener('click', () => NC_deleteHistoryItem(actualIdx));

        container.appendChild(div);
    });
}

function NC_downloadBatch(idx) {
    const batch = NC_state.history[idx];
    if (!batch) return;

    const content = batch.niches.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `niches_batch_${batch.timestamp.replace(/[:\/ ]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToastRef('📥 جاري تحميل الملف...');
}

async function NC_deleteHistoryItem(idx) {
    if (!confirm('هل تريد حذف هذه الدفعة من السجل؟')) return;
    NC_state.history.splice(idx, 1);
    await NC_saveToLocal();
    NC_renderHistory();
    showToastRef('🗑️ تم الحذف من السجل');
}

function NC_copyNicheText(id, text) {
    navigator.clipboard.writeText(text).then(() => {
        showToastRef('📋 تم النسخ: ' + text);
        const card = Array.from(document.querySelectorAll('.nc-task-card')).find(el => el.textContent.includes(text));
        if (card) {
            card.classList.add('nc-copy-flash');
            setTimeout(() => card.classList.remove('nc-copy-flash'), 500);
        }
    });
}

async function NC_toggleDone(id) {
    const nicheIndex = NC_state.niches.findIndex(n => n.id === id);
    if (nicheIndex === -1) return;

    NC_state.niches[nicheIndex].done = !NC_state.niches[nicheIndex].done;
    const cleanLower = NC_state.niches[nicheIndex].text.trim().toLowerCase();

    if (NC_state.niches[nicheIndex].done) {
        if (!NC_state.doneHistory.includes(cleanLower)) {
            NC_state.doneHistory.push(cleanLower);
        }
    } else {
        NC_state.doneHistory = NC_state.doneHistory.filter(h => h !== cleanLower);
    }

    await NC_saveToLocal();
    NC_renderList(document.getElementById('nc-search')?.value || "");
}

async function NC_deleteNiche(id) {
    NC_state.niches = NC_state.niches.filter(n => n.id !== id);
    const bulkTextarea = document.getElementById('bulk-text');
    if (bulkTextarea) {
        bulkTextarea.value = NC_state.niches.map(n => n.text).join('\n');
    }
    await NC_saveToLocal();
    NC_renderList(document.getElementById('nc-search')?.value || "");
}

async function NC_updateBulk() {
    const bulkTextarea = document.getElementById('bulk-text');
    if (!bulkTextarea) return;

    const textStr = bulkTextarea.value;
    const allLines = textStr.split('\n').map(l => l.trim()).filter(l => l);

    const seenLocal = new Set();
    const uniqueLines = allLines.filter(line => {
        const lower = line.toLowerCase();
        if (seenLocal.has(lower)) return false;
        seenLocal.add(lower);
        return true;
    });

    chrome.storage.local.get(['dailyTrends'], async (data) => {
        const dailyTrends = data.dailyTrends || [];
        const trendRankMap = new Map();
        dailyTrends.forEach((t, i) => {
            const tText = typeof t === 'string' ? t : (t.text || t.title || '');
            trendRankMap.set(tText.trim().toLowerCase(), i + 1);
        });

        const oldNichesMap = new Map(NC_state.niches.map(n => [n.text.toLowerCase(), n]));

        NC_state.niches = uniqueLines.map(line => {
            const lower = line.toLowerCase();
            const rank = trendRankMap.get(lower) || 999999;
            
            if (oldNichesMap.has(lower)) {
                const old = oldNichesMap.get(lower);
                old.rank = rank;
                return old;
            }

            const isPreviouslyDone = NC_state.doneHistory.includes(lower);

            return {
                id: 'nc_' + Math.random().toString(36).substr(2, 9),
                text: line,
                done: isPreviouslyDone,
                rank: rank
            };
        });

        NC_state.niches.sort((a, b) => (a.rank || 999999) - (b.rank || 999999));

        await NC_saveToLocal();
        NC_renderList(document.getElementById('nc-search')?.value || "");
        showToastRef('✅ تم تحديث قائمة النيشات');
    });
}

function NC_exportData() {
    if (NC_state.niches.length === 0 && NC_state.history.length === 0) {
        return showToastRef('⚠️ لا توجد بيانات لتصديرها');
    }
    const dataStr = JSON.stringify(NC_state, null, 2);
    const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NHP_Note_Backup_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToastRef('📤 تم تصدير نسخة احتياطية (TXT)');
}

function NC_importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.niches || data.history) {
                NC_state.niches = data.niches || [];
                NC_state.doneHistory = data.doneHistory || [];
                NC_state.history = data.history || [];

                await NC_saveToLocal();
                NC_renderList();
                NC_renderHistory();

                const bulkTextarea = document.getElementById('bulk-text');
                if (bulkTextarea) {
                    bulkTextarea.value = NC_state.niches.map(n => n.text).join('\n');
                }
                showToastRef('✅ تم استيراد النسخة الاحتياطية بنجاح');
            } else {
                throw new Error('Invalid format');
            }
        } catch (err) {
            showToastRef('❌ فشل الاستيراد: الملف غير صالح');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

async function NC_clearAll() {
    if (!confirm('⚠️ هل أنت متأكد من حذف جميع النيتشات في الملاحظات؟')) return;
    NC_state.niches = [];
    const bulkTextarea = document.getElementById('bulk-text');
    if (bulkTextarea) bulkTextarea.value = '';
    await NC_saveToLocal();
    NC_renderList();
    showToastRef('🗑️ تم إخلاء الملاحظات بالكامل');
}

export async function NC_importFromAnalysis() {
    chrome.storage.local.get(['tpExcel', 'tpMed', 'dailyTrends'], async (data) => {
        const excel = data.tpExcel || [];
        const med = data.tpMed || [];
        const dailyTrends = data.dailyTrends || [];

        const trendRankMap = new Map();
        dailyTrends.forEach((t, i) => {
            const tText = typeof t === 'string' ? t : (t.text || t.title || '');
            trendRankMap.set(tText.trim().toLowerCase(), i + 1);
        });

        const excelItems = excel.map(n => ({ text: n, quality: 'excellent', rank: trendRankMap.get(n.trim().toLowerCase()) || 999999 }));
        const medItems = med.map(n => ({ text: n, quality: 'average', rank: trendRankMap.get(n.trim().toLowerCase()) || 999999 }));

        const combinedRaw = [...excelItems, ...medItems];
        const seenCombined = new Set();
        const combined = combinedRaw.filter(item => {
            const lower = item.text.trim().toLowerCase();
            if (seenCombined.has(lower)) return false;
            seenCombined.add(lower);
            return true;
        });

        if (combined.length === 0) {
            showToastRef('⚠️ لا توجد نيتشات في قسم التحليل (ممتازة أو متوسطة)');
            return;
        }

        if (combined.length >= 5) {
            const now = new Date();
            const timestamp = now.toLocaleDateString('ar-EG') + ' ' + now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

            if (!NC_state.history) NC_state.history = [];
            NC_state.history.push({
                timestamp: timestamp,
                niches: combined.map(i => i.text)
            });

            NC_state.niches = [];
        }

        const existingTexts = new Set(NC_state.niches.map(n => n.text.toLowerCase()));
        let addedCount = 0;

        combined.forEach(item => {
            const lower = item.text.trim().toLowerCase();
            if (!existingTexts.has(lower)) {
                const isPreviouslyDone = NC_state.doneHistory.includes(lower);
                NC_state.niches.push({
                    id: 'nc_' + Math.random().toString(36).substr(2, 9),
                    text: item.text.trim(),
                    done: isPreviouslyDone,
                    quality: item.quality,
                    rank: item.rank
                });
                existingTexts.add(lower);
                addedCount++;
            } else {
                const existingItem = NC_state.niches.find(n => n.text.toLowerCase() === lower);
                if (existingItem) existingItem.rank = item.rank;
            }
        });

        NC_state.niches.sort((a, b) => (a.rank || 999999) - (b.rank || 999999));

        if (addedCount > 0) {
            await NC_saveToLocal();
            NC_renderList(document.getElementById('nc-search')?.value || "");

            const bulkTextarea = document.getElementById('bulk-text');
            if (bulkTextarea) {
                bulkTextarea.value = NC_state.niches.map(n => n.text).join('\n');
            }

            showToastRef(`✅ تم استيراد ${addedCount} نيش جديد!`);
        } else {
            showToastRef('ℹ️ جميع النيتشات موجودة بالفعل في القائمة');
        }
    });
}

export const initNoteModule = async (helpers) => {
    const { showToast, switchTab } = helpers;
    showToastRef = showToast;
    switchTabRef = switchTab;

    console.log("NC: Initializing...");

    await NC_loadFromLocal();

    chrome.storage.local.get(['dailyTrends'], async (data) => {
        const dailyTrends = data.dailyTrends || [];
        const trendRankMap = new Map();
        dailyTrends.forEach((t, i) => {
            const tText = typeof t === 'string' ? t : (t.text || t.title || '');
            trendRankMap.set(tText.trim().toLowerCase(), i + 1);
        });

        let changed = false;
        NC_state.niches.forEach(n => {
            const currentRank = trendRankMap.get(n.text.trim().toLowerCase()) || 999999;
            if (n.rank !== currentRank) {
                n.rank = currentRank;
                changed = true;
            }
        });

        NC_state.niches.sort((a, b) => (a.rank || 999999) - (b.rank || 999999));
        
        if (changed) {
            await NC_saveToLocal();
        }

        const searchInput = document.getElementById('nc-search');
        if (searchInput) {
            let searchTimeout;
            searchInput.oninput = (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => NC_renderList(e.target.value), 300); // تأخير 300ms
            };
        }

        const bulkUpdateBtn = document.getElementById('nc-update-bulk');
        if (bulkUpdateBtn) {
            bulkUpdateBtn.onclick = NC_updateBulk;
        }

        const importAnalysisBtn = document.getElementById('btn-import-analysis');
        if (importAnalysisBtn) {
            importAnalysisBtn.onclick = NC_importFromAnalysis;
        }

        const clearNoteBtn = document.getElementById('btn-clear-note');
        if (clearNoteBtn) {
            clearNoteBtn.onclick = NC_clearAll;
        }

        const exportNoteBtn = document.getElementById('btn-export-note');
        if (exportNoteBtn) {
            exportNoteBtn.onclick = NC_exportData;
        }

        const importNoteBtn = document.getElementById('btn-import-note');
        const importNoteInput = document.getElementById('nc-import-input');
        if (importNoteBtn && importNoteInput) {
            importNoteBtn.onclick = () => importNoteInput.click();
            importNoteInput.onchange = NC_importData;
        }

        const bulkTextarea = document.getElementById('bulk-text');
        if (bulkTextarea) {
            bulkTextarea.value = NC_state.niches.map(n => n.text).join('\n');
        }

        NC_renderList();
        NC_renderHistory();
    });
};
