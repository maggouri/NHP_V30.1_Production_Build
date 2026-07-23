let tmhModuleInitialized = false;
let tmhUiFingerprint = '';
const TMH_LIST_MAX_BY_MODE = { performance: 200, balanced: 120, lite: 72, ultra: 48 };

function isTmhPanelActive() {
    return !!document.getElementById('panel-tmh')?.classList.contains('active');
}

function getTmhListMax() {
    const mode = window.NHP_PERFORMANCE_MODE || 'balanced';
    return TMH_LIST_MAX_BY_MODE[mode] || TMH_LIST_MAX_BY_MODE.balanced;
}

function escapeTmhHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function initTMHuntModule({ showToast, switchTab }) {
    if (tmhModuleInitialized) return;
    tmhModuleInitialized = true;

    const isLowSpecModeEnabled = () => !!window.NHP_IS_LIGHT_MODE || !!window.NHP_LOW_SPEC_MODE;
    // UI Elements with tmh- prefix
    const startBtn = document.getElementById('tmh-startBtn');
    const nichesInput = document.getElementById('tmh-nichesInput');
    const progressStatus = document.getElementById('tmh-progressStatus');
    const progressBar = document.getElementById('tmh-progressBar');
    const uPct = document.getElementById('tmh-u-pct');
    const uTotal = document.getElementById('tmh-u-total');
    const uPend = document.getElementById('tmh-u-pend');
    const uStatusDot = document.getElementById('tmh-u-statusDot');

    const safeCount = document.getElementById('tmh-safeCount');
    const restrictedCount = document.getElementById('tmh-restrictedCount');
    const safeList = document.getElementById('tmh-safeList');
    const restrictedList = document.getElementById('tmh-restrictedList');

    const toggleWindowBtn = document.getElementById('tmh-toggleWindowBtn');
    const pauseBtn = document.getElementById('tmh-pauseBtn');
    const resetBtn = document.getElementById('tmh-resetBtn');
    const transferBtn = document.getElementById('tmh-transferBtn');

    if (toggleWindowBtn) {
        toggleWindowBtn.onclick = () => chrome.runtime.sendMessage({ action: 'TMH_TOGGLE_WINDOW' });
    }

    if (pauseBtn) {
        pauseBtn.onclick = () => chrome.runtime.sendMessage({ action: 'TMH_TOGGLE_PAUSE' });
    }

    if (resetBtn) {
        resetBtn.onclick = async () => {
            if (!confirm("هل أنت متأكد من إعادة ضبط كل شيء؟")) return;
            chrome.runtime.sendMessage({ action: 'TMH_RESET_SEARCH' });
            nichesInput.value = '';
            safeList.innerHTML = '';
            restrictedList.innerHTML = '';
            document.getElementById('tmh-progressArea').classList.add('hidden');
            document.querySelector('.tmh-results-container').classList.add('hidden');
        };
    }

    if (transferBtn) {
        transferBtn.onclick = () => {
             chrome.storage.local.get(['tmh_safeNiches'], (data) => {
                const safe = data.tmh_safeNiches || [];
                if (safe.length === 0) return showToast("⚠️ لا توجد نيتشات آمنة للمسح");
                
                const uInput = document.getElementById('u-niches');
                if (uInput) {
                    uInput.value = safe.join('\n');
                    showToast("✅ تم نقل النيتشات الآمنة إلى USPTO");
                    // Keep the user's current section; USPTO queue is updated in the background.
                }
            });
        };
    }

    async function refreshUI(force = false) {
        chrome.storage.local.get(['tmh_searchStatus', 'tmh_processedCount', 'tmh_totalNiches', 'tmh_safeNiches', 'tmh_restrictedNiches', 'pipeline_log'], (data) => {
            const safeListData = data.tmh_safeNiches || [];
            const restrictedListData = data.tmh_restrictedNiches || [];
            const fp = [
                data.tmh_searchStatus || '',
                data.tmh_processedCount || 0,
                data.tmh_totalNiches || 0,
                safeListData.length,
                restrictedListData.length,
                data.pipeline_log || ''
            ].join('|');
            if (!force && fp === tmhUiFingerprint) return;
            tmhUiFingerprint = fp;

            const hasResults = (safeListData.length > 0 || restrictedListData.length > 0);
            
            // Show/Hide results based on content
            if (hasResults || data.tmh_searchStatus === 'RUNNING') {
                document.querySelector('.tmh-results-container')?.classList.remove('hidden');
            }

            if (data.tmh_searchStatus === 'RUNNING' || data.tmh_searchStatus === 'PAUSED') {
                document.getElementById('tmh-progressArea')?.classList.remove('hidden');
                if (pauseBtn) pauseBtn.classList.remove('hidden');
                if (nichesInput) nichesInput.disabled = true;
                if (startBtn) startBtn.disabled = true;
                if (uStatusDot) uStatusDot.classList.add('active');

                const progress = Math.round((data.tmh_processedCount / data.tmh_totalNiches) * 100) || 0;
                if (progressBar) progressBar.style.width = progress + '%';
                if (uPct) uPct.innerText = progress + '%';
                if (uTotal) uTotal.innerText = data.tmh_totalNiches || 0;
                if (uPend) uPend.innerText = (data.tmh_totalNiches - data.tmh_processedCount) || 0;
                
                if (data.tmh_searchStatus === 'PAUSED') {
                    if (pauseBtn) {
                        pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> استئناف';
                        pauseBtn.style.color = "var(--safe)";
                        pauseBtn.style.borderColor = "var(--safe)";
                    }
                    if (progressStatus) progressStatus.innerText = "تم إيقاف التحليل مؤقتاً";
                } else {
                    if (pauseBtn) {
                        pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> إيقاف';
                        pauseBtn.style.color = "var(--warning)";
                        pauseBtn.style.borderColor = "var(--warning)";
                    }
                    if (progressStatus) progressStatus.innerText = data.pipeline_log || `جاري التحليل... ${data.tmh_processedCount} / ${data.tmh_totalNiches}`;
                }
            } else {
                if (nichesInput) nichesInput.disabled = false;
                if (startBtn) startBtn.disabled = false;
                if (pauseBtn) pauseBtn.classList.add('hidden');
                if (uStatusDot) uStatusDot.classList.remove('active');
                if (uTotal) uTotal.innerText = data.tmh_totalNiches || 0;
                if (uPend) uPend.innerText = "0";
                
                if (data.tmh_searchStatus === 'IDLE' && data.tmh_totalNiches > 0) {
                    if (progressStatus) progressStatus.innerText = data.pipeline_log || "اكتمل التحليل بنجاح!";
                    if (uPct) uPct.innerText = "100%";
                    if (progressBar) progressBar.style.width = "100%";
                } else {
                    if (progressStatus) progressStatus.innerText = data.pipeline_log || "في انتظار النيتشات...";
                    if (uPct) uPct.innerText = "0%";
                    if (progressBar) progressBar.style.width = "0%";
                    if (!hasResults) document.querySelector('.tmh-results-container')?.classList.add('hidden');
                }
            }

            if (safeListData.length) {
                if (safeCount) safeCount.innerText = safeListData.length;
                if (safeList) {
                    const max = getTmhListMax();
                    const visibleSafeNiches = safeListData.slice(0, max);
                    safeList.innerHTML = visibleSafeNiches.map((n) => {
                        const safe = escapeTmhHtml(n);
                        return `<div class="card-item tmh-item flex justify-between items-center group" title="${safe}">
                            <span>${safe}</span>
                            <i class="fa-solid fa-shield-halved ai-tmh-audit" data-niche="${safe}" title="فحص الأمان الذكي (AI)" style="font-size: 10px; color: var(--safe); opacity: 0.5; cursor: pointer;"></i>
                        </div>`;
                    }).join('');
                }
                window.lastSafeNiches = safeListData;
            }
            if (restrictedListData.length) {
                if (restrictedCount) restrictedCount.innerText = restrictedListData.length;
                if (restrictedList) {
                    const max = getTmhListMax();
                    const visibleRestrictedNiches = restrictedListData.slice(0, max);
                    restrictedList.innerHTML = visibleRestrictedNiches.map((n) => {
                        const safe = escapeTmhHtml(n);
                        return `<div class="card-item tmh-item flex justify-between items-center group" title="${safe}">
                            <span style="color:var(--banned)">${safe}</span>
                            <i class="fa-solid fa-shield-halved ai-tmh-audit" data-niche="${safe}" title="اقتراح بديل آمن (AI)" style="font-size: 10px; color: var(--banned); opacity: 0.5; cursor: pointer;"></i>
                        </div>`;
                    }).join('');
                }
                window.lastRestrictedNiches = restrictedListData;
            }
        });
    }

    window.NHP_activateTmhPanel = () => {
        tmhUiFingerprint = '';
        refreshUI(true);
    };

    setInterval(() => {
        chrome.storage.local.get(['tmh_searchStatus'], (pollData) => {
            const isRunning = pollData.tmh_searchStatus === 'RUNNING' || pollData.tmh_searchStatus === 'PAUSED';
            if (document.hidden && !isRunning) return;
            if (!isTmhPanelActive() && !isRunning) return;
            refreshUI(false);
        });
    }, isLowSpecModeEnabled() ? 4200 : 2500);

    // LISTENER FOR AI AUDIT IN TMHUNT
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('ai-tmh-audit')) {
            const niche = e.target.getAttribute('data-niche');
            if (!niche) return;
            
            showToast(`🛡️ جاري تحليل الأمان الذكي لـ "${niche}"...`);
            if (window.AICentralBrain) {
                const report = await window.AICentralBrain.checkTrademarkRisk(niche);
                alert(`🛡️ تقرير الحارس القانوني (AI):\n\n${report || 'فشل جلب التقرير'}`);
            }
        }
    });

    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            const niches = nichesInput.value.split('\n').map(n => n.trim()).filter(n => n.length > 0);
            if (niches.length === 0) return showToast("⚠️ يرجى إدخال نيتشات للبحث أولاً");
            
            chrome.runtime.sendMessage({ action: 'TMH_START_SEARCH', niches: niches });
            showToast(`🎯 جاري فحص ${niches.length} نيش يدوياً...`);
        });
    }

    // LISTENER FOR PIPELINE COMPLETION
    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === 'PIPELINE_COMPLETED_NOTIFY') {
            showToast("✅ اكتمل تحليل TMHunt بنجاح!");
            refreshUI(true);
        }
    });

    // COPY/DOWNLOAD Logic
    const copySafe = document.querySelector('.tmh-copySafe');
    const copyRestricted = document.querySelector('.tmh-copyRestricted');
    const downloadSafe = document.querySelector('.tmh-downloadSafe');
    const downloadRestricted = document.querySelector('.tmh-downloadRestricted');

    if (copySafe) copySafe.onclick = () => copyText(window.lastSafeNiches?.join('\n'));
    if (copyRestricted) copyRestricted.onclick = () => copyText(window.lastRestrictedNiches?.join('\n'));
    if (downloadSafe) downloadSafe.onclick = () => download(window.lastSafeNiches?.join('\n'), 'safe.txt');
    if (downloadRestricted) downloadRestricted.onclick = () => download(window.lastRestrictedNiches?.join('\n'), 'restricted.txt');

    function copyText(t) {
        if (!t) return;
        navigator.clipboard.writeText(t);
        showToast("✅ تم النسخ!");
    }
    function download(t, f) {
        if (!t) return;
        const b = new Blob([t], {type: 'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b); a.download = f; a.click();
    }
}

