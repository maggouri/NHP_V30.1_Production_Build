
// --- Helper: Global Toast (if popup module hasn't exposed it yet) ---
const nc_toast = (msg) => {
    if (window.showToast) {
        window.showToast(msg);
    } else {
        console.log("TOAST:", msg);
    }
};

// --- State ---
let NC_state = {
    niches: [],
    doneHistory: [],
    history: [] // [{ timestamp: "...", niches: [...] }]
};

// --- Storage Functions ---
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

// --- UI Functions ---
window.NC_renderList = function (filter = "") {
    const container = document.getElementById('niche-container');
    if (!container) return;

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

    const fragment = document.createDocumentFragment();
    const MAX_RENDER = 300;
    const toRender = filtered.slice(0, MAX_RENDER);

    toRender.forEach(niche => {
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
                window.NC_copyNicheText(niche.id, niche.text);
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
        const delBtn = div.querySelector('.btn-delete');
        const donBtn = div.querySelector('.btn-done');
        const preBtn = div.querySelector('.btn-preview');

        const radarBtn = div.querySelector('.btn-radar');

        if (delBtn) {
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.NC_deleteNiche(niche.id);
            });
        }

        if (donBtn) {
            donBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.NC_toggleDone(niche.id);
            });
        }

        if (radarBtn) {
            radarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const scanInput = document.getElementById('lab-scan-query');
                const startBtn = document.getElementById('lab-start-scan');
                if (scanInput && startBtn) {
                    scanInput.value = niche.text;
                    if (window.switchTab) window.switchTab('lab');
                    setTimeout(() => startBtn.click(), 300);
                }
            });
        }

        const gBtn = div.querySelector('.btn-google');
        if (gBtn) {
            gBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                chrome.storage.local.set({
                    nhp_current_niche_context: niche.text,
                    nhp_current_niche_context_at: Date.now()
                });
                const url = `https://www.google.com/search?q=${encodeURIComponent(niche.text)}&tbm=isch&tbs=qdr:d`;
                window.open(url, '_blank');
            });
        }

        const pBtn = div.querySelector('.btn-pinterest');
        if (pBtn) {
            pBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                chrome.storage.local.set({
                    nhp_current_niche_context: niche.text,
                    nhp_current_niche_context_at: Date.now()
                });
                const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(niche.text)}&rs=typed`;
                window.open(url, '_blank');
            });
        }

        if (preBtn) {
            preBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                chrome.storage.local.set({
                    nhp_current_niche_context: niche.text,
                    nhp_current_niche_context_at: Date.now()
                });
                const url = `https://www.teepublic.com/t-shirts?query=${encodeURIComponent(niche.text)}`;
                window.open(url, '_blank');
            });
        }

        fragment.appendChild(div);
    });

    if (filtered.length > MAX_RENDER) {
        const moreDiv = document.createElement('div');
        moreDiv.className = 'text-center py-3 text-slate-500 text-xs';
        moreDiv.textContent = `+${filtered.length - MAX_RENDER} نيش آخر (تم إخفاؤها لتسريع الواجهة)`;
        fragment.appendChild(moreDiv);
    }

    container.innerHTML = "";
    container.appendChild(fragment);
}

window.NC_renderHistory = function () {
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
                <button class="interactive p-1.5 bg-white/5 rounded hover:bg-white/20" title="تحميل TXT" onclick="NC_downloadBatch(${actualIdx})">
                    <i class="fa-solid fa-download text-[10px] text-white"></i>
                </button>
                <button class="interactive p-1.5 bg-red-500/10 rounded hover:bg-red-500/20" title="حذف من السجل" onclick="NC_deleteHistoryItem(${actualIdx})">
                    <i class="fa-solid fa-trash-can text-[10px] text-red-400"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.NC_downloadBatch = (idx) => {
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
    nc_toast('📥 جاري تحميل الملف...');
};

window.NC_deleteHistoryItem = async (idx) => {
    if (!confirm('هل تريد حذف هذه الدفعة من السجل؟')) return;
    NC_state.history.splice(idx, 1);
    await NC_saveToLocal();
    window.NC_renderHistory();
    nc_toast('🗑️ تم الحذف من السجل');
};

window.NC_copyNicheText = (id, text) => {
    navigator.clipboard.writeText(text).then(() => {
        nc_toast('📋 تم النسخ: ' + text);
        // Find the element and flash it
        const card = Array.from(document.querySelectorAll('.nc-task-card')).find(el => el.textContent.includes(text));
        if (card) {
            card.classList.add('nc-copy-flash');
            setTimeout(() => card.classList.remove('nc-copy-flash'), 500);
        }
    });
};

window.NC_toggleDone = async (id) => {
    console.log("NC: Toggling done for", id);
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
    window.NC_renderList(document.getElementById('nc-search')?.value || "");
};

window.NC_deleteNiche = async (id) => {
    console.log("NC: Deleting niche", id);
    NC_state.niches = NC_state.niches.filter(n => n.id !== id);
    const bulkTextarea = document.getElementById('bulk-text');
    if (bulkTextarea) {
        bulkTextarea.value = NC_state.niches.map(n => n.text).join('\n');
    }
    await NC_saveToLocal();
    window.NC_renderList(document.getElementById('nc-search')?.value || "");
};

window.NC_updateBulk = async () => {
    console.log("NC: Updating bulk list");
    const bulkTextarea = document.getElementById('bulk-text');
    if (!bulkTextarea) return;

    const textStr = bulkTextarea.value;
    const allLines = textStr.split('\n').map(l => l.trim()).filter(l => l);

    // Remove duplicates from lines first
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
        window.NC_renderList(document.getElementById('nc-search')?.value || "");
        nc_toast('✅ تم تحديث قائمة النيشات');
    });
};

// --- NEW: Export/Import Note State ---
window.NC_exportData = () => {
    if (NC_state.niches.length === 0 && NC_state.history.length === 0) {
        return nc_toast('⚠️ لا توجد بيانات لتصديرها');
    }
    const dataStr = JSON.stringify(NC_state, null, 2);
    const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NHP_Note_Backup_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    nc_toast('📤 تم تصدير نسخة احتياطية (TXT)');
};

window.NC_importData = (e) => {
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
                window.NC_renderList();
                window.NC_renderHistory();

                const bulkTextarea = document.getElementById('bulk-text');
                if (bulkTextarea) {
                    bulkTextarea.value = NC_state.niches.map(n => n.text).join('\n');
                }
                nc_toast('✅ تم استيراد النسخة الاحتياطية بنجاح');
            } else {
                throw new Error('Invalid format');
            }
        } catch (err) {
            nc_toast('❌ فشل الاستيراد: الملف غير صالح');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
};

// --- Initialization ---
window.NC_clearAll = async () => {
    if (!confirm('⚠️ هل أنت متأكد من حذف جميع النيتشات في الملاحظات؟')) return;
    NC_state.niches = [];
    const bulkTextarea = document.getElementById('bulk-text');
    if (bulkTextarea) bulkTextarea.value = '';
    await NC_saveToLocal();
    const searchInput = document.getElementById('nc-search');
    window.NC_renderList(searchInput ? searchInput.value : "");
    nc_toast('🗑️ تم إخلاء الملاحظات بالكامل');
};

// --- Actions ---
window.NC_importFromAnalysis = async () => {
    chrome.storage.local.get(['tpExcel', 'tpMed'], async (data) => {
        const excel = data.tpExcel || [];
        const med = data.tpMed || [];

        // Map niches with their status and remove duplicates in source
        const excelItems = excel.map(n => ({ text: n, quality: 'excellent' }));
        const medItems = med.map(n => ({ text: n, quality: 'average' }));

        const combinedRaw = [...excelItems, ...medItems];
        const seenCombined = new Set();
        const combined = combinedRaw.filter(item => {
            const lower = item.text.trim().toLowerCase();
            if (seenCombined.has(lower)) return false;
            seenCombined.add(lower);
            return true;
        });

        if (combined.length === 0) {
            nc_toast('⚠️ لا توجد نيتشات في قسم التحليل (ممتازة أو متوسطة)');
            return;
        }

        // --- NEW: Clear if 5 or more niches imported ---
        if (combined.length >= 5) {
            console.log("NC: Clear-on-import triggered (count >= 5)");

            // --- NEW: Store in History ---
            const now = new Date();
            const timestamp = now.toLocaleDateString('ar-EG') + ' ' + now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

            if (!NC_state.history) NC_state.history = [];
            NC_state.history.push({
                timestamp: timestamp,
                niches: combined.map(i => i.text) // Store texts only in history
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
            window.NC_renderList(document.getElementById('nc-search')?.value || "");

            // Sync bulk textarea
            const bulkTextarea = document.getElementById('bulk-text');
            if (bulkTextarea) {
                bulkTextarea.value = NC_state.niches.map(n => n.text).join('\n');
            }

            nc_toast(`✅ تم استيراد ${addedCount} نيش جديد!`);
        } else {
            nc_toast('ℹ️ جميع النيتشات موجودة بالفعل في القائمة');
        }
    });
};

const NC_INIT = async () => {
    console.log("NC: Initializing...");

    // Load saved state
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
            searchInput.oninput = (e) => window.NC_renderList(e.target.value);
        }

        const bulkUpdateBtn = document.getElementById('nc-update-bulk');
        if (bulkUpdateBtn) {
            bulkUpdateBtn.onclick = window.NC_updateBulk;
        }

        const importAnalysisBtn = document.getElementById('btn-import-analysis');
        if (importAnalysisBtn) {
            importAnalysisBtn.onclick = window.NC_importFromAnalysis;
        }

        const clearNoteBtn = document.getElementById('btn-clear-note');
        if (clearNoteBtn) {
            clearNoteBtn.onclick = window.NC_clearAll;
        }

        const exportNoteBtn = document.getElementById('btn-export-note');
        if (exportNoteBtn) {
            exportNoteBtn.onclick = window.NC_exportData;
        }

        const importNoteBtn = document.getElementById('btn-import-note');
        const importNoteInput = document.getElementById('nc-import-input');
        if (importNoteBtn && importNoteInput) {
            importNoteBtn.onclick = () => importNoteInput.click();
            importNoteInput.onchange = window.NC_importData;
        }

        const bulkTextarea = document.getElementById('bulk-text');
        if (bulkTextarea) {
            bulkTextarea.value = NC_state.niches.map(n => n.text).join('\n');
        }

        window.NC_renderList();
        window.NC_renderHistory();
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', NC_INIT);
} else {
    NC_INIT();
}
