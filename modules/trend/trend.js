// ══════════════════════════════════════════════════════
//  ████████  TREND TEEPUBLIC MODULE  ████████
// ══════════════════════════════════════════════════════

let allDailyTrends = [];
let TREND = {};

function renderTrendNiches(list, showToast) {
    if (!TREND.listContainer) return;
    TREND.listContainer.innerHTML = '';
    
    if (!list || list.length === 0) {
        TREND.listContainer.innerHTML = `
            <div class="empty-msg" style="text-align: center; padding: 40px; font-size: 11px; color: var(--tr-text-dim);">
                <i class="fa-solid fa-radar" style="font-size: 30px; display: block; margin-bottom: 15px; opacity: 0.2;"></i>
                لا توجد نتائج حالية، اضغط على زر الجلب للمحاولة
            </div>`;
        return;
    }

    list.forEach((niche, i) => {
        const div = document.createElement('div');
        div.className = 'trend-card animate-staggered';
        div.style.animationDelay = `${i * 0.03}s`;

        div.innerHTML = `
            <span style="font-size: 12px; font-weight: 800; color: #fff;">
                <span style="color: var(--tr-primary); margin-left: 8px; opacity: 0.6; font-size: 10px;">#${String(i + 1).padStart(2, '0')}</span>
                ${niche}
            </span>
            <i class="fa-solid fa-copy"></i>
        `;

        div.onclick = () => {
            navigator.clipboard.writeText(niche);
            showToast(`✨ تم نسخ النيتش: ${niche}`);
            
            // Visual feedback
            const icon = div.querySelector('i');
            icon.className = 'fa-solid fa-check';
            icon.style.color = 'var(--tr-accent)';
            setTimeout(() => {
                icon.className = 'fa-solid fa-copy';
                icon.style.color = '';
            }, 1000);
        };

        TREND.listContainer.appendChild(div);
    });
}

export function initTrendModule(params) {
    const { showToast, switchTab, updateUSPTO } = params;

    // Initialize UI references inside the init function
    TREND = {
        fetchBtn: document.getElementById('trend-fetch-btn'),
        listContainer: document.getElementById('trend-list-container'),
        filterInput: document.getElementById('trend-filter-input'),
        copyAllBtn: document.getElementById('trend-copy-all-btn'),
        lastUpdateSpan: document.getElementById('trend-last-update'),
        btnText: document.querySelector('#trend-fetch-btn .btn-text'),
        loader: document.querySelector('#trend-fetch-btn .spinner-small'),
        fullAutoBtn: document.getElementById('btn-full-auto')
    };

    if (!TREND.fetchBtn) return;

    chrome.storage.local.get(['dailyTrends', 'trendLastUpdate', 'trendLastFetchDate'], (result) => {
        if (result.dailyTrends) {
            allDailyTrends = result.dailyTrends;
            renderTrendNiches(allDailyTrends, showToast);
        }
        if (result.trendLastUpdate) {
            TREND.lastUpdateSpan.textContent = `آخر تحديث: ${result.trendLastUpdate}`;
        }

        // Auto-fetch if first time or fresh session (optional, but requested by logic)
        // Check if data is from today
        const todayStr = new Date().toDateString();
        if (!result.dailyTrends || result.trendLastFetchDate !== todayStr) {
             TREND.fetchBtn.click();
        }
    });

    TREND.fetchBtn.addEventListener('click', async () => {
        TREND.btnText.classList.add('hidden');
        TREND.loader.classList.remove('hidden');
        TREND.fetchBtn.disabled = true;

        try {
            const res = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'fetch_trends' }, resolve);
            });

            if (!res || !res.success) throw new Error(res?.error || 'فشل الاتصال بسيرفر الترندات');

            const html = res.data;
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const startMarker = "The directory below has been automatically generated";
            const endMarker = "Subscribe to Our Newsletter";

            const bodyText = doc.body.innerText;
            const startIndex = bodyText.indexOf(startMarker);
            const endIndex = bodyText.indexOf(endMarker);

            const extracted = [];
            let elements = doc.querySelectorAll('.trending-tag .link_content, .trending-tag a, .trending-tags a');
            if (elements.length === 0) elements = doc.querySelectorAll('a[href*="/t-shirt/"]');

            elements.forEach(el => {
                const text = el.innerText.trim();
                if (!text || text.length < 2) return;
                const pos = startIndex !== -1 ? bodyText.indexOf(text, startIndex) : 0;
                if (pos !== -1 && (endIndex === -1 || pos < endIndex)) {
                    if (!extracted.includes(text)) extracted.push(text);
                }
            });

            if (extracted.length > 0) {
                allDailyTrends = extracted;
                const now = new Date().toLocaleString('ar-EG');
                chrome.storage.local.set({
                    dailyTrends: allDailyTrends,
                    trendLastUpdate: now,
                    trendLastFetchDate: new Date().toDateString()
                });
                TREND.lastUpdateSpan.textContent = `آخر تحديث: ${now}`;
                renderTrendNiches(allDailyTrends, showToast);

                // --- AUTO-IMPORT TRENDS TO USPTO ---
                const uInput = document.getElementById('u-niches');
                if (uInput) {
                    uInput.value = allDailyTrends.join('\n');
                    const uInputCount = document.getElementById('u-inputCount');
                    if (uInputCount) uInputCount.textContent = allDailyTrends.length;
                }

                chrome.storage.local.get(['isFullAuto', 'usptoHistory'], (st) => {
                    if (st.isFullAuto) {
                        const history = st.usptoHistory || {};
                        const pending = [];
                        const safe = [];
                        const banned = [];
                        let rememberedCount = 0;

                        allDailyTrends.forEach(n => {
                            const key = n.toLowerCase().trim();
                            if (history[key]) {
                                if (history[key] === 'safe') safe.push(n);
                                else banned.push(n);
                                rememberedCount++;
                            } else {
                                pending.push(n);
                            }
                        });

                        if (rememberedCount > 0) showToast(`🧠 تم تذكر ${rememberedCount} نيتش سابقاً`);
                        showToast('⚡ بدء الفحص التلقائي لـ USPTO...');

                        chrome.storage.local.set({
                            uRunning: pending.length > 0,
                            uPending: pending,
                            uSafe: safe,
                            uBanned: banned,
                            uCurrent: null,
                            uTotal: allDailyTrends.length
                        }, () => {
                            if (pending.length > 0) chrome.runtime.sendMessage({ action: 'u_start' });
                            else {
                                showToast('✅ جميع الترندات تم التحقق منها مسبقاً');
                                if (typeof updateUSPTO === 'function') updateUSPTO();
                            }
                            // Keep the user's current section; USPTO is prepared in the background.
                        });
                    } else showToast('📈 تم تحديث الترندات وتحضيرها للفحص');
                });
            } else showToast('⚠️ لم يتم العثور على ترندات متاحة حالياً');
        } catch (error) {
            showToast('❌ خطأ في الجلب: ' + error.message);
        } finally {
            TREND.btnText.classList.remove('hidden');
            TREND.loader.classList.add('hidden');
            TREND.fetchBtn.disabled = false;
        }
    });

    TREND.filterInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = allDailyTrends.filter(n => n.toLowerCase().includes(val));
        renderTrendNiches(filtered, showToast);
    });

    if (TREND.fullAutoBtn) {
        TREND.fullAutoBtn.addEventListener('click', () => {
            chrome.storage.local.set({ isFullAuto: true }, () => {
                showToast('⚡ التحليل الآلي الشامل قيد التشغيل...');
                TREND.fetchBtn.click();
            });
        });
    }

    TREND.copyAllBtn.addEventListener('click', () => {
        if (allDailyTrends.length === 0) return showToast('⚠️ القائمة فارغة');
        navigator.clipboard.writeText(allDailyTrends.join('\n'));
        showToast('✅ تم نسخ جميع الترندات بنجاح');
    });
}

