/**
 * NICHE HUNTER PRO - TREND MODULE
 * Handles fetching and displaying TeePublic daily trends.
 */

import { showToast, renderList } from '../utils.js';
import { switchTab } from '../ui.js';

export let TREND = {};

let allDailyTrends = [];

export function initTrendModule() {
    // Re-acquire elements to be safe
    TREND = {
        fetchBtn: document.getElementById('trend-fetch-btn'),
        listContainer: document.getElementById('trend-list-container'),
        lastUpdateSpan: document.getElementById('trend-last-update'),
        filterInput: document.getElementById('trend-filter-input'),
        trendCopyAllBtn: document.getElementById('trend-copy-all-btn'),
        btnText: document.querySelector('#trend-fetch-btn .btn-text'),
        loader: document.querySelector('#trend-fetch-btn .spinner-small'),
        fullAutoBtn: document.getElementById('btn-full-auto')
    };

    chrome.storage.local.get(['dailyTrends', 'trendLastUpdate', 'trendLastFetchDate'], (result) => {
        if (result.dailyTrends) {
            allDailyTrends = result.dailyTrends;
            if (TREND.lastUpdateSpan) TREND.lastUpdateSpan.textContent = `آخر تحديث: ${result.trendLastUpdate || '-'} `;
            renderTrendNiches(allDailyTrends);
        }

        // Always fetch trends on startup to ensure fresh data and populate USPTO if needed
        if (TREND.fetchBtn) {
            TREND.fetchBtn.click();
        }
    });

    registerTrendListeners();
}

function registerTrendListeners() {
    if (TREND.fetchBtn) TREND.fetchBtn.addEventListener('click', fetchTrends);
    if (TREND.filterInput) {
        TREND.filterInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const filtered = allDailyTrends.filter(t => t.text.toLowerCase().includes(val));
            renderTrendNiches(filtered);
        });
    }

    if (TREND.trendCopyAllBtn) {
        TREND.trendCopyAllBtn.addEventListener('click', () => {
            if (!allDailyTrends.length) return showToast('⚠️ لا توجد ترندات لنسخها');
            const txt = allDailyTrends.map(t => t.text).join('\n');
            navigator.clipboard.writeText(txt).then(() => showToast('✅ تم نسخ جميع الترندات'));
        });
    }

    if (TREND.fullAutoBtn) {
        TREND.fullAutoBtn.addEventListener('click', () => {
            if (!confirm('سيقوم هذا بتنظيف USPTO وتحليل الترندات الحالية آلياً حتى قسم الملاحظات. هل أنت مستعد؟')) return;
            chrome.storage.local.set({ isFullAuto: true }, () => {
                showToast('⚡ بدء التحليل الآلي الكامل...');
                fetchTrends(true); // pass true for isFullAuto check inside fetchTrends
            });
        });
    }
}

export function renderTrendNiches(arr) {
    if (!TREND.listContainer) return;
    if (!arr || arr.length === 0) {
        TREND.listContainer.innerHTML = '<div class="empty-msg">لا توجد نتائج للبحث</div>';
        return;
    }

    TREND.listContainer.innerHTML = '';
    arr.forEach((trend, index) => {
        const div = document.createElement('div');
        div.className = 'card-item animate-scale-in';
        div.style.animationDelay = `${index * 0.03}s`;

        div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; direction: rtl; cursor: pointer;">
        <div style="display:flex; align-items:center; gap:8px; flex:1; overflow:hidden;">
          <i class="fa-solid fa-arrow-left-long trend-arrow"></i>
          <span class="niche-text" style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${index + 1}. ${trend.text}</span>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <button class="copy-mini" title="نسخ النيتش" onclick="event.stopPropagation();"><i class="fa-solid fa-copy"></i></button>
        </div>
      </div>
    `;

        // Click whole card to COPY and TRANSFER
        div.onclick = () => {
            navigator.clipboard.writeText(trend.text).then(() => {
                showToast(`✅ تم نسخ ونقل: ${trend.text}`);
                const usptoInput = document.getElementById('u-niches');
                if (usptoInput) {
                    usptoInput.value = trend.text;
                    usptoInput.dispatchEvent(new Event('input'));
                    setTimeout(() => switchTab('uspto'), 800);
                }
            });
        };

        TREND.listContainer.appendChild(div);
    });
}

export async function fetchTrends(forceFullAuto = false) {
    if (TREND.btnText) TREND.btnText.classList.add('hidden');
    if (TREND.loader) TREND.loader.classList.remove('hidden');
    if (TREND.fetchBtn) TREND.fetchBtn.disabled = true;

    try {
        const res = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'fetch_trends' }, resolve);
        });

        if (!res || !res.success) throw new Error(res?.error || 'فشل الجلب من الخلفية');

        const html = res.data;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Method 1: Try links (if from tag directory)
        const links = doc.querySelectorAll('a[href*="/t-shirts/"]');
        const extracted = [];
        const seen = new Set();
        const categoriesToExclude = [
            'politics', 'sci-fi', 'food', 'fantasy', 'drinks', 'anime', 'art', 'books', 'funny',
            'nature', 'sports', 'tv shows', 'movies', 'gaming', 'music', 'lifestyle', 'pop culture',
            'topics', 'tags', 'directory', 'baseball', 'television', 'vintage', 'animals', 'cars',
            'coffee', 'dogs', 'cats', 'cute', 'halloween', 'christmas', 'family', 'gifts', 'holiday',
            'hobbies', 'professions', 'sayings', 'typography', 'retro', 'cool', 'math', 'science',
            'school', 'teacher', 'nurse'
        ];

        let skipCount = 0; // Skip the first block of links which are just category headers on the new layout

        links.forEach(link => {
            const text = link.textContent.trim();

            const href = link.getAttribute('href');

            // Clean text and check if it's a category
            const lowerText = text.toLowerCase();
            const isCategory = categoriesToExclude.some(c => lowerText === c || lowerText.includes(c + ' ') || lowerText.includes(' ' + c));

            // TeePublic's new layout puts ~20-30 generic categories at the very top of the page before the actual niches
            if (skipCount < 50 && isCategory) {
                skipCount++;
                return; // Skip these initial categories entirely
            }

            if (text && text.length > 2 && text.length < 50 && !seen.has(lowerText)) {
                if (!isCategory && href.includes('/t-shirts/') && !href.includes('?')) {
                    extracted.push({ text: text, count: Math.floor(Math.random() * 500) + 50 });
                    seen.add(lowerText);
                }
            }
        });


        // Method 2: Fallback to image alt tags (if from popular page)
        if (extracted.length < 10) {
            const images = doc.querySelectorAll('img');
            images.forEach(img => {
                let alt = img.getAttribute('alt');
                if (alt) {
                    alt = alt.replace(/ T-Shirt/gi, '').replace(/ Design/gi, '').trim();
                    let lowerAlt = alt.toLowerCase();
                    if (alt.length > 3 && alt.length < 50 && !seen.has(lowerAlt)) {
                        extracted.push({ text: alt, count: Math.floor(Math.random() * 500) + 50 });
                        seen.add(lowerAlt);
                    }
                }
            });
        }

        if (extracted.length > 0) {
            // Heuristic: If we see categories in the first few items, skip them until we hit a real niche
            allDailyTrends = extracted.slice(0, 300);
            const now = new Date().toLocaleString('ar-EG');
            chrome.storage.local.set({
                dailyTrends: allDailyTrends,
                trendLastUpdate: now,
                trendLastFetchDate: new Date().toDateString()
            });
            if (TREND.lastUpdateSpan) TREND.lastUpdateSpan.textContent = `آخر تحديث: ${now} `;
            renderTrendNiches(allDailyTrends);

            // AUTO-IMPORT TO USPTO IF NEEDED
            chrome.storage.local.get(['isFullAuto'], (res) => {
                const usptoInput = document.getElementById('u-niches');
                if (usptoInput) {
                    const trendsText = allDailyTrends.map(t => t.text).join('\n');
                    // Always populate if it's currently empty, or we are in full auto mode
                    if (!usptoInput.value.trim() || res.isFullAuto || forceFullAuto === true) {
                        usptoInput.value = trendsText;
                        usptoInput.dispatchEvent(new Event('input'));
                    }
                }

                if (res.isFullAuto || forceFullAuto === true) {
                    showToast('✅ تم استوراد الترندات لـ USPTO وجاري بدء الفحص...');
                    setTimeout(() => {
                        switchTab('uspto');
                        const startBtn = document.getElementById('u-startBtn');
                        if (startBtn) startBtn.click();
                    }, 1000);
                } else {
                    // Even if not auto, show a small hint that they are ready in USPTO
                    showToast('✅ تم جلب الترندات وتحضيرها في قسم USPTO');
                }
            });
        } else {
            showToast('⚠️ لم يتم العثور على ترندات');
        }
    } catch (error) {
        showToast('❌ خطأ في الجلب: ' + error.message);
    } finally {
        if (TREND.btnText) TREND.btnText.classList.remove('hidden');
        if (TREND.loader) TREND.loader.classList.add('hidden');
        if (TREND.fetchBtn) TREND.fetchBtn.disabled = false;
    }
}
