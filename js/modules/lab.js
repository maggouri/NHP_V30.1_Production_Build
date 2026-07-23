const LAB = {
  // Rising Star Elements
  scanQueryInput: document.getElementById('lab-scan-query'),
  noteSelect: document.getElementById('lab-note-select'),
  syncNotesBtn: document.getElementById('lab-sync-notes'),
  startScanBtn: document.getElementById('lab-start-scan'),
  scanStatus: document.getElementById('lab-scan-status'),
  scanStatusText: document.getElementById('lab-scan-status-text'),
  scanResults: document.getElementById('lab-scan-results'),
  relatedTagsContainer: document.getElementById('lab-related-tags-container'),
  relatedTagsList: document.getElementById('lab-related-tags'),
  copyTagsBtn: document.getElementById('lab-copy-tags'),
  viewGridBtn: document.getElementById('lab-view-grid'),
  viewListBtn: document.getElementById('lab-view-list'),
  zoomOutBtn: document.getElementById('lab-zoom-out'),
  zoomInBtn: document.getElementById('lab-zoom-in'),
  colLabel: document.getElementById('lab-col-count'),

  globalHunterBtn: document.getElementById('lab-global-hunter'),

  // State
  currentResults: [],
  viewMode: 'grid',
  colCount: 5,

  init() {
    if (!this.startScanBtn) return;

    this.refreshNotes();
    if (this.syncNotesBtn) this.syncNotesBtn.onclick = () => this.refreshNotes();
    this.startScanBtn.onclick = () => this.startRisingStarScan(false);

    // Add logic for global hunter button
    if (this.globalHunterBtn) {
      this.globalHunterBtn.onclick = () => {
        this.scanQueryInput.value = ''; // Clear input visually
        this.startRisingStarScan(true);
      };
    }

    this.noteSelect.onchange = (e) => {
      if (e.target.value) {
        this.scanQueryInput.value = e.target.value;
      }
    };

    if (this.copyTagsBtn) {
      this.copyTagsBtn.onclick = () => {
        const text = Array.from(this.relatedTagsList.querySelectorAll('span')).map(s => s.innerText).join(', ');
        if (text) {
          navigator.clipboard.writeText(text);
          showToast('📋 تم نسخ الكلمات المفتاحية');
        }
      };
    }

    // View Controls
    if (this.viewGridBtn) this.viewGridBtn.onclick = () => this.setViewMode('grid');
    if (this.viewListBtn) this.viewListBtn.onclick = () => this.setViewMode('list');
    if (this.zoomOutBtn) this.zoomOutBtn.onclick = () => this.adjustZoom(-1);
    if (this.zoomInBtn) this.zoomInBtn.onclick = () => this.adjustZoom(1);

    // Initial state apply
    this.setViewMode(this.viewMode);
  },

  setViewMode(mode) {
    this.viewMode = mode;
    if (mode === 'grid') {
      this.viewGridBtn?.classList.add('bg-pink-600/20', 'text-pink-500');
      this.viewListBtn?.classList.remove('bg-pink-600/20', 'text-pink-500');
      this.scanResults.style.display = 'grid';
      this.scanResults.style.gridTemplateColumns = `repeat(${this.colCount}, minmax(0, 1fr))`;
      this.scanResults.style.gap = '8px';
    } else {
      this.viewListBtn?.classList.add('bg-pink-600/20', 'text-pink-500');
      this.viewGridBtn?.classList.remove('bg-pink-600/20', 'text-pink-500');
      this.scanResults.style.display = 'flex';
      this.scanResults.style.flexDirection = 'column';
      this.scanResults.style.gap = '8px';
    }
    this.renderRisingStars(this.currentResults);
  },

  adjustZoom(delta) {
    const newCount = this.colCount - delta;
    if (newCount >= 1 && newCount <= 8) {
      this.colCount = newCount;
      if (this.colLabel) this.colLabel.textContent = newCount;
      if (this.viewMode === 'grid') {
        this.scanResults.style.gridTemplateColumns = `repeat(${this.colCount}, minmax(0, 1fr))`;
      }
    }
  },

  async refreshNotes() {
    const res = await new Promise(r => chrome.storage.local.get(['teepublic_manager_data'], r));
    const niches = res.teepublic_manager_data?.niches || [];

    if (this.noteSelect) {
      this.noteSelect.innerHTML = '<option value="">-- اختر نيش للفحص --</option>';
      niches.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n.text;
        opt.textContent = n.text.substring(0, 30) + (n.text.length > 30 ? '...' : '');
        this.noteSelect.appendChild(opt);
      });
      showToast('🔄 تم تحديث النيتشات من المفكرة');
    }
  },

  async startRisingStarScan(isGlobal = false) {
    const query = isGlobal ? "" : this.scanQueryInput.value.trim();
    if (!isGlobal && !query) return showToast('⚠️ أدخل الكلمة المفتاحية أو اختر من القائمة');

    this.startScanBtn.disabled = true;
    if (this.globalHunterBtn) this.globalHunterBtn.disabled = true;

    this.scanStatus.classList.remove('hidden');
    this.scanResults.innerHTML = '';
    this.relatedTagsContainer.classList.add('hidden');
    this.relatedTagsList.innerHTML = '';

    this.scanStatusText.textContent = isGlobal ? `جاري الفحص العالمي لأحدث التصاميم...` : `جاري فحص النيش: ${query}...`;

    try {
      showToast('⏳ جاري جلب البيانات العميقة من TeePublic...');

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'lab_perform_scan', query: query }, (res) => {
          console.log('[Lab Scan] Full Raw Response:', res);
          if (res) console.dir(res);

          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!res) {
            reject(new Error("الرد من الخلفية فارغ (Empty Response)"));
          } else if (res.success === false || res.error) {
            reject(new Error(res.error || "خطأ غير معروف في الخلفية"));
          } else {
            resolve(res);
          }
        });
      });

      if (!response.newestPages || !response.popularPages) {
        throw new Error("البيانات المستلمة ناقصة (Missing Pages)");
      }

      // Extract each page and combine
      let arrayNewest = [];
      let allTags = new Set();

      response.newestPages.forEach(html => {
        arrayNewest = arrayNewest.concat(this.extractDesignData(html));
        // Extract tags too!
        const tags = this.extractRelatedTags(html);
        tags.forEach(t => allTags.add(t));
      });

      let arrayPopular = [];
      response.popularPages.forEach(html => {
        arrayPopular = arrayPopular.concat(this.extractDesignData(html));
        const tags = this.extractRelatedTags(html);
        tags.forEach(t => allTags.add(t));
      });

      // Render Tags
      this.renderRelatedTags(Array.from(allTags));

      console.log(`[Lab] Found: ${arrayNewest.length} Newest items, ${arrayPopular.length} Popular items | Tags: ${allTags.size}`);

      // De-duplicate items (just in case they overlap between pages)
      const uniqueNewest = [];
      const seenN = new Set();
      arrayNewest.forEach(d => { if (!seenN.has(d.id)) { seenN.add(d.id); uniqueNewest.push(d); } });

      const uniquePopular = [];
      const seenP = new Set();
      arrayPopular.forEach(d => { if (!seenP.has(d.id)) { seenP.add(d.id); uniquePopular.push(d); } });

      // Intersection Strategy - Look for Newer designs present in Popular list
      const risingStars = [];
      const totalCount = uniquePopular.length || 48; // Baseline for scoring

      uniqueNewest.forEach((design, newestRank) => {
        const popRank = uniquePopular.findIndex(p => p.id === design.id);
        if (popRank !== -1) {
          // New Score Logic: (Max - PopularRank) + (Max - NewestRank) mapped to 100
          // This ensures #1 in both = ~100%, #last in both = ~5%
          const score = Math.round(((totalCount - popRank) + (totalCount - newestRank)) / (totalCount * 2) * 100);

          risingStars.push({
            ...design,
            newestRank: newestRank + 1,
            popularRank: popRank + 1,
            heatScore: Math.min(100, Math.max(5, score)) // Cap between 5% and 100%
          });
        }
      });

      // Sort by best score
      risingStars.sort((a, b) => b.heatScore - a.heatScore);
      this.currentResults = risingStars;
      this.renderRisingStars(risingStars);

    } catch (err) {
      console.error('[Scan Error]', err);
      if (err.message.includes('Cloudflare')) {
        showToast('⚠️ تم حجب الطلب (Cloudflare). يرجى فتح موقع TeePublic يدوياً ثم المحاولة.');
      } else if (err.message.includes('403') || err.message.includes('429')) {
        showToast('⚠️ تم تقييد الوصول مؤقتاً من الموقع. حاول بعد قليل.');
      } else {
        showToast('❌ خطأ في عملية الفحص: ' + err.message, 'danger');
      }
    } finally {
      this.startScanBtn.disabled = false;
      if (this.globalHunterBtn) this.globalHunterBtn.disabled = false;
      this.scanStatus.classList.add('hidden');
    }
  },

  extractDesignData(html) {
    const designs = [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Selective selectors for TeePublic designs
      const cards = doc.querySelectorAll('.design-tile, [data-design-id], .tiles__tile, .m-tile');
      cards.forEach(card => {
        const id = card.getAttribute('data-design-id') || card.querySelector('[data-design-id]')?.getAttribute('data-design-id') || card.querySelector('a')?.getAttribute('href')?.split('/').pop();
        if (!id) return;

        // Smart image finder: find the biggest img or specific class, skip small icons
        const imgs = Array.from(card.querySelectorAll('img'));
        let mainImg = null;
        for (const img of imgs) {
          const src = img.getAttribute('data-src') || img.src || "";
          // Skip tracking pixels and icons (like the blue heart/favorite icon)
          if (src.toLowerCase().includes('heart') || src.toLowerCase().includes('icon') || src.toLowerCase().includes('pixel') || src.toLowerCase().includes('placeholder') || src.includes('avatar')) continue;
          mainImg = img;
          break;
        }

        const img = mainImg ? (mainImg.getAttribute('data-src') || mainImg.getAttribute('srcset')?.split(' ')[0] || mainImg.src) : '';
        const titleMatch = card.querySelector('.design-tile__title a') || card.querySelector('.m-tile__title') || card.querySelector('.tiles__tile-title a') || card.querySelector('h3') || card.querySelector('a[title]') || card.querySelector('.m-tile__link');
        let title = titleMatch ? (titleMatch.innerText || titleMatch.getAttribute('title') || '').trim() : '';

        // Final fallback: use image alt
        if (!title && mainImg) title = (mainImg.getAttribute('alt') || '').trim();
        if (!title) title = 'بدون عنوان';

        if (!designs.some(d => d.id === id)) {
          designs.push({ id, img, title });
        }
      });

      // Fallback regex if selectors fail
      if (designs.length === 0) {
        const regex = /data-design-id="(\d+)"/g;
        let m;
        while ((m = regex.exec(html)) !== null && designs.length < 100) {
          if (!designs.some(d => d.id === m[1])) {
            designs.push({ id: m[1], img: '', title: `ID: ${m[1]}` });
          }
        }
      }
    } catch (err) {
      console.error('[Lab Extract Error]', err);
    }
    return designs;
  },

  extractRelatedTags(html) {
    const tags = [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Selectors based on your finding: .m-search__related .link-collection__content a.gtmSearchRelated
      const tagEls = doc.querySelectorAll('.m-search__related .link-collection__content a.gtmSearchRelated');

      tagEls.forEach(el => {
        const tagText = el.getAttribute('data-link-label') || el.innerText.trim();
        if (tagText && !tags.includes(tagText)) {
          tags.push(tagText);
        }
      });

      // Note: Current page logic (just for log)
      const currentPageEl = doc.querySelector('span.page.current');
      if (currentPageEl) {
        console.log(`[Lab] Parsing Page: ${currentPageEl.innerText.trim()}`);
      }

    } catch (err) {
      console.error('[Lab Tags Error]', err);
    }
    return tags;
  },

  renderRelatedTags(tags) {
    if (!tags || tags.length === 0) {
      this.relatedTagsContainer.classList.add('hidden');
      return;
    }
    this.relatedTagsContainer.classList.remove('hidden');
    this.relatedTagsList.innerHTML = '';

    tags.forEach(tag => {
      const span = document.createElement('span');
      // Updated Tag style: rounded, light background, cleaner
      span.className = 'px-2 py-1 bg-white/10 text-slate-200 text-[9px] rounded-md border border-white/10 hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all cursor-pointer font-bold';
      span.innerText = tag;
      span.onclick = () => {
        navigator.clipboard.writeText(tag);
        showToast(`📋 تم نسخ الكلمة: ${tag}`);
      };
      this.relatedTagsList.appendChild(span);
    });
  },

  renderRisingStars(list) {
    if (!list || list.length === 0) {
      this.scanResults.innerHTML = `
        <div class="text-center py-10 opacity-60 col-span-full">
          <i class="fa-solid fa-ghost text-4xl mb-3"></i>
          <p class="text-xs">لم يتم العثور على Rising Stars حالياً لهذا النيش.</p>
        </div>`;
      return;
    }

    this.scanResults.innerHTML = '';

    // Force CSS Grid on every render
    if (this.viewMode === 'grid') {
      this.scanResults.style.display = 'grid';
      this.scanResults.style.gridTemplateColumns = `repeat(${this.colCount}, minmax(0, 1fr))`;
      this.scanResults.style.gap = '8px';
    } else {
      this.scanResults.style.display = 'flex';
      this.scanResults.style.flexDirection = 'column';
      this.scanResults.style.gap = '8px';
    }

    list.forEach((item, idx) => {
      const div = document.createElement('div');

      if (this.viewMode === 'list') {
        div.className = 'flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-pink-500/30 transition-all cursor-pointer group shadow-lg';
        div.innerHTML = `
          <div class="relative w-14 h-14 rounded-lg overflow-hidden bg-black/40 flex-shrink-0 border border-white/5">
             <img src="${item.img || 'icon.png'}" class="w-full h-full object-contain p-1" onerror="this.src='icon.png'">
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[11px] font-bold text-white truncate group-hover:text-pink-400 transition-colors mb-1">${item.title}</div>
            <div class="flex items-center gap-3">
               <!-- Engagement Bar -->
               <div class="flex-1 bg-white/5 h-1 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-orange-400 to-red-500" style="width: ${item.heatScore}%"></div>
               </div>
               <span class="text-[10px] font-black text-pink-500 whitespace-nowrap">${item.heatScore}%</span>
            </div>
            <div class="flex gap-4 mt-1 text-slate-400 text-[9px]">
              <div class="flex items-center gap-1"><i class="fa-regular fa-clock text-[8px]"></i> #${item.newestRank}</div>
              <div class="flex items-center gap-1"><i class="fa-regular fa-star text-[8px]"></i> #${item.popularRank}</div>
            </div>
          </div>
        `;
      } else {
        div.className = 'flex flex-col gap-1.5 p-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-pink-500/40 transition-all cursor-pointer group relative overflow-hidden h-full shadow-md';
        div.innerHTML = `
          <!-- Image Section -->
          <div class="relative aspect-square w-full rounded-lg overflow-hidden bg-black/40 border border-white/10">
             <img src="${item.img || 'icon.png'}" class="w-full h-full object-contain p-1.5 group-hover:scale-110 transition-transform duration-500" onerror="this.src='icon.png'">
          </div>
          
          <div class="px-0.5 py-1">
             <!-- Stats Line: Newest, Popular, Heat -->
             <div class="flex items-center justify-center gap-2.5 text-[9px] font-black">
                <div class="flex items-center gap-1 text-indigo-400" title="Newest Rank">
                   <i class="fa-regular fa-clock"></i>
                   <span>${item.newestRank}</span>
                </div>
                <div class="flex items-center gap-1 text-amber-400" title="Popular Rank">
                   <i class="fa-regular fa-star"></i>
                   <span>${item.popularRank}</span>
                </div>
                <div class="flex items-center gap-1 text-pink-500" title="Heat Score">
                   <i class="fa-solid fa-bolt"></i>
                   <span>${item.heatScore}%</span>
                </div>
             </div>
             
             <!-- Title -->
             <div class="text-[8px] text-white/60 truncate mt-1 text-center uppercase tracking-tighter">
                ${item.title}
             </div>
          </div>
        `;
      }

      div.style.animation = `fadeSlideIn 0.3s ease forwards ${idx * 0.05}s`;
      div.style.opacity = '0';
      div.onclick = () => window.open(`https://www.teepublic.com/t-shirt/${item.id}`, '_blank');
      this.scanResults.appendChild(div);
    });
  }
};

// Global expose
window.LAB = LAB;

// Re-init on DOMContentLoaded for Lab
document.addEventListener('DOMContentLoaded', () => {
  LAB.init();
});
