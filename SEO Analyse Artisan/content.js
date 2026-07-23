// SEO Analyse Artisan - Content Script
// Injects the UI and handles logic automatically upon page load.

(() => {
  if (document.getElementById('seo-analyse-artisan-panel')) return;

  const colorsList = ['#FF5722', '#E91E63', '#9C27B0', '#00BCD4', '#FFC107', '#4CAF50', '#F44336', '#E0E0E0', '#1A1A1A'];
  const fetchRandomColors = () => colorsList.sort(() => 0.5 - Math.random()).slice(0, 4);
  let pageNiche = "";
  let isAnalyzed = false;
  let globalAutoEnabled = true;
  let styledElements = new Set(); // Keep track of elements styled by Trademark scanner

  // --- 1. Create Core UI Elements ---

  // Floating FAB toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.id = 'nhp-saa-fab';
  toggleBtn.className = 'nhp-saa-fab';
  toggleBtn.title = 'SEO Analyse Artisan';
  toggleBtn.setAttribute('aria-label', 'فتح / إغلاق SEO Analyse Artisan');
  toggleBtn.textContent = '✨';
  document.body.appendChild(toggleBtn);

  // Message listener to trigger from popup
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'TOGGLE_ARTI_PANEL') {
      togglePanel();
      sendResponse({ success: true });
    }
  });

  // Panel
  const panel = document.createElement('div');
  panel.id = 'seo-analyse-artisan-panel';
  panel.className = 'nhp-saa-panel saa-hidden';
  panel.innerHTML = `
    <header class="nhp-saa-header">
      <div class="nhp-saa-title">
        <span aria-hidden="true">✨</span>
        <span>SEO Analyse Artisan</span>
      </div>
      <button type="button" class="nhp-saa-close" id="nhp-saa-close" title="إغلاق" aria-label="إغلاق">×</button>
    </header>
    <nav class="nhp-saa-tabs" role="tablist">
      <button type="button" class="nhp-saa-tab is-active" data-saa-tab="analysis" role="tab">📊 تحليل</button>
      <button type="button" class="nhp-saa-tab" data-saa-tab="chat" role="tab">🤖 محادثة</button>
      <button type="button" class="nhp-saa-tab" data-saa-tab="protection" role="tab">🛡️ حماية</button>
      <button type="button" class="nhp-saa-tab" data-saa-tab="auto" role="tab">⚙️ تلقائي</button>
    </nav>
    <section class="nhp-saa-panes">
      <div class="nhp-saa-pane is-active" data-saa-pane="analysis"></div>
      <div class="nhp-saa-pane" data-saa-pane="chat"></div>
      <div class="nhp-saa-pane" data-saa-pane="protection"></div>
      <div class="nhp-saa-pane" data-saa-pane="auto"></div>
    </section>
    <div class="saa-sections-pool" style="display:none;">
      <div class="saa-section" data-saa-section="master-control" style="background: rgba(2, 136, 209, 0.1); border: 1px solid #0288d1; border-radius: 8px; padding: 10px; margin-bottom: 15px;">
        <div style="display:flex; justify-content: space-between; align-items:center;">
          <div style="font-weight: bold; color: #FFF;">⚡ التحليل الشامل الديناميكي</div>
          <button class="saa-btn" id="saa-master-auto-btn" style="width: auto; padding: 2px 10px; background: #00c853;">مُفعَّل 🟢</button>
        </div>
        <div style="font-size: 11px; color: #bbb; margin-top: 5px;">
          يستخرج (Tags + Prompt + Trademark + Copyright) تلقائياً بمجرد دخولك للصفحة دون تدخل منك.
        </div>
      </div>

      <!-- News & Trends Radar (Relocated to TOP - Enhanced) -->
      <div class="saa-section" id="saa-news-section" data-saa-section="news-radar" style="border: 1px solid #673ab7; background: rgba(103, 58, 183, 0.05); margin-bottom: 20px;">
        <div class="saa-section-title">📰 رادار الأخبار والترند العالمي</div>
        
        <!-- AI Intelligence Screen -->
        <div id="saa-news-display-screen" style="background:#000; border-radius:8px; padding:12px; min-height:100px; margin-bottom:10px; border: 1px solid #333; position:relative; overflow:hidden;">
            <div id="saa-news-screen-content" style="font-size:12px; color:#eee; line-height:1.6;">
                <div style="text-align:center; color:#666; padding-top:20px;">
                    <div style="font-size:24px; margin-bottom:10px;">📡</div>
                    بانتظار اختيار نيتش لتحليل الأخبار...
                </div>
            </div>
            <div id="saa-news-screen-loader" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; flex-direction:column; gap:10px; z-index:5;">
                <span class="saa-loader" style="font-size:14px; color:#673ab7;">تحليل النبض العالمي للنيتش...</span>
            </div>
        </div>

        <div style="display:flex; gap: 8px;">
          <input type="text" class="saa-input" id="saa-news-input" placeholder="أدخل النيتش..." style="margin-bottom:0; flex:1;" />
          <button class="saa-btn" id="saa-fetch-news-btn" style="width: auto; padding: 0 15px; background: #673ab7;">تحليل 🚀</button>
        </div>
        <div id="saa-news-results" style="margin-top: 10px; max-height:80px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 6px; display:none;"></div>
      </div>

      <!-- Live Tasks Progress Log -->
      <div class="saa-section" data-saa-section="tasks-log" style="border-right: 3px solid #ff4081;">
        <div class="saa-section-title">📊 سجل المهام (Live Progress)</div>
        <div id="saa-tasks-log" style="background:#0a0a0a; border-radius:6px; padding:8px; height:80px; overflow-y:auto; font-size:10px; color:#ccc; display:flex; flex-direction:column; gap:4px; font-family:monospace;">
           <div style="color:#666; font-style:italic;">-- النظام يعمل في صمت، المهام ستظهر هنا --</div>
        </div>
      </div>

      <!-- Trend Hunter -->
      <div class="saa-section" data-saa-section="trend-hunter">
        <div class="saa-section-title">🦅 صائد الترندات الحصرية (200 Niche)</div>
        <div class="saa-dynamic-text" style="font-size: 11px;">
          يقوم بمسح حي (Google, Pinterest, TeePublic) لاستخراج 200 نيتش حقيقي دائم 
          ويقوم بفلترتها محلياً لتجنب حقوق الملكية (يأخذ فقط الآمن 🟢).
        </div>
        <div style="display:flex; gap: 8px; margin-top: 8px;">
           <button class="saa-btn" id="saa-fetch-trends-btn" style="flex: 2; background: linear-gradient(135deg, #ff4081, #d50000);">تحديث الترندات يدوياً 🔄</button>
           <button class="saa-btn" id="saa-copy-all-trends-btn" style="flex: 1; background: #333; display:none;">نسخ الكل 📋</button>
        </div>
        <div id="saa-trends-container" style="display:block; margin-top: 10px; max-height: 300px; overflow-y: auto; background: #111; border-radius:8px; padding:8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
           <div style="grid-column: span 2; text-align:center; color:#666; font-size:11px;">جاري تحميل المعرض التلقائي...</div>
        </div>
      </div>

      <!-- Discovered Patterns -->
      <div class="saa-section" data-saa-section="patterns">
        <div class="saa-section-title">🔍 الأنماط المكتشفة (Visual Patterns)</div>
        <div class="saa-dynamic-text" id="saa-visual-patterns">
          جاري التحليل التلقائي... بانتظار تحميل الصفحة.
        </div>
      </div>

      <!-- Trademark Checker -->
      <div class="saa-section" data-saa-section="trademark-checker">
        <div class="saa-section-title">🛡️ رادار حقوق الملكية (Trademark)</div>
        <input type="text" class="saa-input" id="saa-tm-input" placeholder="أدخل فكرة أو جملة للتأكد منها..." />
        <button class="saa-btn" id="saa-tm-btn">فحص الحقوق (Check Trademark)</button>
        <div id="saa-tm-result" class="saa-alert" style="display: none;"></div>
      </div>

      <!-- AI Advisor Chat -->
      <div class="saa-section" data-saa-section="chat">
        <div class="saa-section-title">💬 المستشار الذكي (AI Chat)</div>
        <div class="saa-chat-box" id="saa-chat-history">
           <div class="saa-msg saa-bot">مرحباً! أنا مستشارك الذكي المدعوم بالذكاء الاصطناعي. اسألني عن أي تصميم في هذه الصفحة، أو اطلب أفكاراً، تقديرات أرباح، أو استراتيجيات لـ TeePublic وسأجيبك فوراً معتمداً على معلومات الصفحة.</div>
        </div>
        <div class="saa-chat-input-wrapper">
          <input type="text" class="saa-input" id="saa-chat-input" placeholder="اسألني عن الصفحة أو التصاميم..." />
          <button class="saa-btn" id="saa-chat-send" style="width: auto;">إرسال 🚀</button>
        </div>
      </div>

      <!-- Copyright & Trademark Analyzer -->
      <div class="saa-section" data-saa-section="copyright-radar">
        <div class="saa-section-title">🛡️ رادار حقوق الملكية (Copyright Bot)</div>
        <div class="saa-dynamic-text" style="font-size: 11px;">
           يفحص تصاميم الصفحة الحالية ويسلط ضوء (LED) لمعرفة الخطورة:
           <span style="color:#00e676;">🟢 آمن</span> | 
           <span style="color:#ff9800;">🟠 متوسط</span> | 
           <span style="color:#ff1744;">🔴 خطر</span>
        </div>
        <div style="display:flex; gap: 8px; margin-top: 8px;">
          <button class="saa-btn" id="saa-scan-tm-btn" style="flex:1; background: linear-gradient(135deg, #1e3c72, #2a5298);">فحص الآن 🔍</button>
          <button class="saa-btn" id="saa-toggle-auto-tm-btn" style="flex:1; background: var(--saa-surface); border: 1px solid var(--saa-border);">آلي: معطل ❌</button>
        </div>
      </div>

      <!-- Store & Albums AI Manager -->
      <div class="saa-section" data-saa-section="autopilot">
        <div class="saa-section-title">🤖 الطيار الآلي للألبومات (Auto-Pilot)</div>
        <div class="saa-dynamic-text" id="saa-album-status" style="font-size: 11px;">
          سيتكفل الـ Bot بقراءة صفحات متجرك (بشكل متتالي)، وتجنب الألبومات السابقة، وسؤال الذكاء الاصطناعي، ثم إنشاء الألبومات وإضافة التصاميم تلقائياً!
        </div>
        <div style="display:flex; gap: 8px;">
          <button class="saa-btn" id="saa-start-autopilot-btn" style="flex:1; background: linear-gradient(135deg, #0288d1, #00c853);">بدء المهمة آلياً 🚀</button>
          <button class="saa-btn" id="saa-stop-autopilot-btn" style="flex:1; background: linear-gradient(135deg, #d32f2f, #f44336);">إيقاف 🛑</button>
        </div>
        <!-- شريط التتبع التلقائي للوقت والحالة -->
        <div id="saa-action-ticker-container" style="display:none; margin-top: 10px; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; border-right: 3px solid #00e676;">
           <div id="saa-action-title" style="font-size: 11px; color:#00e676; font-weight:bold; margin-bottom: 4px;">جاري العمل...</div>
           <div id="saa-action-desc" style="font-size: 10px; color:#fff;"></div>
        </div>
        <div id="saa-album-results" style="margin-top: 10px; font-size:12px; color:var(--saa-text-muted); direction: ltr; text-align: left;"></div>
      </div>

    </div>
  `;
  document.body.appendChild(panel);

  function organizeWidgetSections() {
    const analysisPane = panel.querySelector('[data-saa-pane="analysis"]');
    const chatPane = panel.querySelector('[data-saa-pane="chat"]');
    const protectionPane = panel.querySelector('[data-saa-pane="protection"]');
    const autoPane = panel.querySelector('[data-saa-pane="auto"]');
    if (!analysisPane || !chatPane || !protectionPane || !autoPane) return;

    const section = (name) => panel.querySelector(`[data-saa-section="${name}"]`);
    [
      section('master-control'),
      section('news-radar'),
      section('trend-hunter'),
      section('patterns')
    ].filter(Boolean).forEach((node) => analysisPane.appendChild(node));
    [section('chat')].filter(Boolean).forEach((node) => chatPane.appendChild(node));
    [section('trademark-checker'), section('copyright-radar')].filter(Boolean).forEach((node) => protectionPane.appendChild(node));
    [section('autopilot'), section('tasks-log')].filter(Boolean).forEach((node) => autoPane.appendChild(node));
  }

  function togglePanel(force) {
    const willShow = typeof force === 'boolean' ? force : !panel.classList.contains('is-visible');
    panel.classList.toggle('is-visible', willShow);
    panel.classList.toggle('saa-hidden', !willShow);
    if (willShow && !isAnalyzed) autoAnalyzePage();
    if (!willShow) clearArtisanEffect();
    try { localStorage.setItem('nhp_saa_open', willShow ? '1' : '0'); } catch (_) {}
  }

  function setupSaaUi() {
    const closeBtn = document.getElementById('nhp-saa-close');
    const tabs = panel.querySelectorAll('.nhp-saa-tab');
    const panes = panel.querySelectorAll('.nhp-saa-pane');

    toggleBtn.addEventListener('click', () => togglePanel());
    closeBtn?.addEventListener('click', () => togglePanel(false));

    tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.saaTab;
        tabs.forEach((b) => b.classList.toggle('is-active', b === btn));
        panes.forEach((p) => p.classList.toggle('is-active', p.dataset.saaPane === target));
        try { localStorage.setItem('nhp_saa_tab', target); } catch (_) {}
      });
    });

    try {
      if (localStorage.getItem('nhp_saa_open') === '1') togglePanel(true);
      const lastTab = localStorage.getItem('nhp_saa_tab');
      if (lastTab) {
        const target = panel.querySelector(`.nhp-saa-tab[data-saa-tab="${lastTab}"]`);
        target?.click();
      }
    } catch (_) {}
  }

  organizeWidgetSections();
  setupSaaUi();

  // --- 1.2 State & Effect Management ---

  function clearArtisanEffect() {
    // 1. Remove classes
    document.querySelectorAll('.saa-highlight-img, .saa-highlight-text').forEach(el => {
      el.classList.remove('saa-highlight-img', 'saa-highlight-text');
    });
    // 2. Clear Trademark inline styles
    styledElements.forEach(el => {
      if (el) {
        el.style.boxShadow = '';
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.borderRadius = '';
        el.style.transition = '';
        el.style.position = '';
        el.style.zIndex = '';
        el.removeAttribute('data-tm-scanned');
      }
    });
    styledElements.clear();
    // 3. Hide tooltips
    if (tooltip) tooltip.style.opacity = '0';
    if (typeof podTooltip !== 'undefined') podTooltip.style.display = 'none';
    isAnalyzed = false;
    window.saaGlobalAutoRan = false;
  }

  // Custom Interactive Tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'saa-tooltip';
  document.body.appendChild(tooltip);

  // --- 2. Notification & Tooltip Systems (SILENT MODE) ---

  // Gets the new internal task log container instead of global body toasts
  const internalTaskLog = panel.querySelector('#saa-tasks-log');

  function showToast(message, type = 'info', duration = 0) {
    if (!internalTaskLog) return;

    // Remove the initial placeholder if present
    if (internalTaskLog.innerHTML.includes('-- النظام يعمل')) {
      internalTaskLog.innerHTML = '';
    }

    const logEntry = document.createElement('div');
    logEntry.style.padding = '4px 6px';
    logEntry.style.borderRadius = '4px';
    logEntry.style.borderRight = '2px solid transparent';
    logEntry.style.backgroundColor = 'rgba(255,255,255,0.03)';
    logEntry.style.animation = 'saa-fade-in 0.3s ease';

    let icon = 'ℹ️';
    let color = '#ccc';
    if (type === 'success') { icon = '✅'; logEntry.style.borderRightColor = '#00e676'; color = '#00e676'; }
    if (type === 'warning') { icon = '⚠️'; logEntry.style.borderRightColor = '#ff9800'; color = '#ff9800'; }
    if (type === 'danger') { icon = '🛡️'; logEntry.style.borderRightColor = '#ff1744'; color = '#ff1744'; }

    // Current Time
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    logEntry.innerHTML = `<span style="color:#666; margin-left:4px;">[${timeStr}]</span> <span>${icon}</span> <span style="color:${color};">${message}</span>`;

    internalTaskLog.appendChild(logEntry);

    // Auto scroll to bottom smoothly
    internalTaskLog.scrollTop = internalTaskLog.scrollHeight;
  }

  function showTooltip(text) {
    tooltip.innerHTML = text;
    tooltip.style.opacity = '1';
  }

  function hideTooltip() {
    tooltip.style.opacity = '0';
  }

  document.addEventListener('mousemove', (e) => {
    if (tooltip.style.opacity === '1') {
      tooltip.style.top = (e.clientY + window.scrollY + 10) + 'px';
      tooltip.style.left = (e.clientX + window.scrollX + 15) + 'px';
    }
  });

  // --- 3. Automatic Page Analysis (Highlighting) ---

  function autoAnalyzePage() {
    if (isAnalyzed) return;
    isAnalyzed = true;

    showToast('بدء التحليل التلقائي: جارٍ رصد الأنماط البصرية والـ SEO...', 'info', 3000);

    setTimeout(() => {
      let imageCount = 0;
      let headingCount = 0;

      // 1. Highlight Repeating Images (Visual Patterns)
      // Logic: Only pick reasonably sized images, maybe skipping very small icons
      const images = Array.from(document.querySelectorAll('img'));
      images.forEach(img => {
        if (img.width > 120 && img.height > 120 && !img.closest('#seo-analyse-artisan-panel') && !img.classList.contains('saa-highlight-img')) {
          img.classList.add('saa-highlight-img');

          let titleReason = 'نمط بصري متكرر: تصميم عالي الجودة يقبل الطباعة';
          let cleanTitle = (img.alt || img.title || "").replace(/ T-Shirt/gi, '').replace(/ Design/gi, '').trim();

          img.setAttribute('data-saa-reason', titleReason);

          // Removal of redundant tooltip listener - podTooltip will handle it
          // img.addEventListener('mouseenter', () => ...

          // Auto-fetch news on click
          img.addEventListener('click', (e) => {
            if (cleanTitle.length > 3) {
              const newsInput = document.getElementById('saa-news-input');
              const fetchBtn = document.getElementById('saa-fetch-news-btn');
              if (newsInput && fetchBtn) {
                newsInput.value = cleanTitle;
                // Open panel if hidden
                if (panel.classList.contains('saa-hidden')) {
                  toggleBtn.click();
                }
                // Scroll news section into view within panel
                newsInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                fetchBtn.click();
                showToast(`جاري جلب أخبار النيتش: ${cleanTitle}`, 'info');
              }
            }
          });

          imageCount++;
        }
      });

      // Special Case: If we are on a product page, auto-fetch for the main H1
      const mainH1 = document.querySelector('h1');
      if (mainH1 && mainH1.innerText.trim().length > 3 && !window.location.href.includes('/search')) {
        const newsInput = document.getElementById('saa-news-input');
        const fetchBtn = document.getElementById('saa-fetch-news-btn');
        if (newsInput && fetchBtn && newsInput.value === '') {
          const cleanH1 = mainH1.innerText.replace(/ T-Shirt/gi, '').replace(/ Design/gi, '').trim();
          pageNiche = cleanH1;
          newsInput.value = cleanH1;
          fetchBtn.click();
          showToast(`تم رصد نيتش الصفحة تلقائياً: ${cleanH1}`, 'success');
        }
      }

      // 2. Highlight SEO Strategy in Text/Titles
      const headings = document.querySelectorAll('h1, h2, h3, h4');
      headings.forEach(heading => {
        if (!heading.closest('#seo-analyse-artisan-panel') && heading.innerText.trim().length > 5 && !heading.classList.contains('saa-highlight-text')) {
          heading.classList.add('saa-highlight-text');

          heading.addEventListener('mouseenter', () => {
            if (!globalAutoEnabled || panel.classList.contains('saa-hidden')) return;
            showTooltip(`📈 فرصة SEO: نص يحتوي على كلمات مفتاحية قوية<br><small style="color:var(--saa-text-muted)">يمكنك استخراج Tags من هذه العناوين عبر الإضافة</small>`)
          });
          heading.addEventListener('mouseleave', hideTooltip);
          headingCount++;
        }
      });

      // Feed Results back to the User and Dashboard
      if (imageCount > 0) {
        setTimeout(() => {
          showToast(`تم تظليل ${imageCount} عنصر من الأنماط البصرية الناجحة كأفكار (POD).`, 'success', 5000);
        }, 1000);
        document.getElementById('saa-visual-patterns').innerHTML =
          `تم رصد وتظليل <b>${imageCount}</b> صورة.<br/> الأنماط مظللة بحدود <b>زرقاء متوهجة</b> في الشاشة. <i>مرر الماوس فوقها لمعرفة المزيد عن ميزاتها.</i>`;
      } else {
        document.getElementById('saa-visual-patterns').innerHTML =
          "لم يتم رصد أنماط بصرية (أكبر من 120px) في هذه الصفحة. جرب Pinterest أو Google Images.";
      }

      setTimeout(() => {
        if (headingCount > 0) {
          showToast(`تم إبراز ${headingCount} نصوص تحتوي على كلمات حيوية لمحركات البحث.`, 'warning', 6000);
        }
      }, 3500);

    }, 2500); // 2.5s delay allows for Pinterest/Google Images to dynamically load images
  }

  // --- 4. Event Listeners ---

  // API Call - Trademark Checker
  document.getElementById('saa-tm-btn').addEventListener('click', () => {
    const phrase = document.getElementById('saa-tm-input').value;
    const resultBox = document.getElementById('saa-tm-result');
    if (!phrase) return;

    chrome.runtime.sendMessage({ type: 'CHECK_TRADEMARK', payload: phrase }, (response) => {
      resultBox.style.display = 'flex';
      if (response && response.safe) {
        resultBox.className = 'saa-alert safe';
        resultBox.innerHTML = '✅ آمنة! يمكنك استخدامها كعنوان.';
        showToast(`الكلمة "${phrase}" نظيفة من حقوق الملكية المبرمجة`, 'success');
      } else {
        resultBox.className = 'saa-alert danger';
        resultBox.innerHTML = '⚠️ محذرة! قد تحتوي الكلمة على انتهاك حقوق.';
        showToast(`احترس! "${phrase}" قد تغلق حسابك، تجنبها.`, 'danger', 6000);
      }
    });
  });

  // --- Extracted Tags & Prompt logic removed as per user request ---

  // --- 4.5 Trend Hunter Auto-Gallery Logic ---
  const fetchTrendsBtn = document.getElementById('saa-fetch-trends-btn');
  const copyAllTrendsBtn = document.getElementById('saa-copy-all-trends-btn');
  const trendsContainer = document.getElementById('saa-trends-container');
  let currentLoadedNiches = [];

  function loadAndDisplayTrends(forceUpdate = false) {
    if (fetchTrendsBtn) {
      fetchTrendsBtn.innerHTML = '<span class="saa-loader">جاري السحب...</span>';
      fetchTrendsBtn.disabled = true;
    }

    chrome.runtime.sendMessage({ type: 'FETCH_TRENDS', force: forceUpdate }, (response) => {
      if (fetchTrendsBtn) {
        fetchTrendsBtn.innerHTML = 'تحديث الترندات يدوياً 🔄';
        fetchTrendsBtn.disabled = false;
      }

      if (response && response.error) {
        showToast("حدث خطأ أثناء سحب الترندات.", "danger");
        if (trendsContainer) trendsContainer.innerHTML = '<div style="grid-column: span 2; text-align:center; color:#ff1744; font-size:11px;">فشل تحميل المعرض.</div>';
        return;
      }

      if (response && response.trends && response.trends.length > 0) {
        const rawTrends = response.trends;
        const titles = rawTrends.map(t => t.title);

        const radarResults = window.SaaLocalEngine.radarScan(titles);
        const safeNiches = [];
        rawTrends.forEach(trend => {
          const riskObj = radarResults.find(r => r.title === trend.title);
          if (riskObj && riskObj.risk === 'green') {
            safeNiches.push(trend);
          }
        });

        if (safeNiches.length === 0) {
          if (trendsContainer) trendsContainer.innerHTML = '<div style="grid-column: span 2; text-align:center; color:#ff9800; font-size:11px;">جميع الترندات الحالية ذات خطورة عالية للملكية.</div>';
          return;
        }

        const displayNiches = safeNiches.slice(0, 200);
        currentLoadedNiches = displayNiches.map(n => n.title);

        if (copyAllTrendsBtn) copyAllTrendsBtn.style.display = 'block';

        if (trendsContainer) {
          trendsContainer.innerHTML = '';
          trendsContainer.style.display = 'grid';

          displayNiches.forEach((niche, idx) => {
            const card = document.createElement('div');
            card.style.background = 'rgba(255,255,255,0.05)';
            card.style.borderRadius = '6px';
            card.style.padding = '6px';
            card.style.fontSize = '10px';
            card.style.border = '1px solid #00e676';
            card.innerHTML = `
                   <div style="font-weight:bold; color:#00e676; margin-bottom: 4px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;" title="${niche.title}">${idx + 1}. ${niche.title}</div>
                   <div style="display:flex; align-items:center; justify-content:space-between;">
                     <span style="background:#222; padding:2px 4px; border-radius:4px; font-size:9px;">${niche.source}</span>
                     <div style="display:flex; gap: 4px; align-items:center;">
                         <button class="saa-small-copy-btn" data-title="${niche.title}" style="background:#0288d1; border:none; color:#fff; border-radius:3px; cursor:pointer; padding:2px 4px; font-size:9px;" title="نسخ النيتش">📋</button>
                         <img src="${niche.image}" style="width:24px; height:24px; object-fit:cover; border-radius:4px;">
                     </div>
                   </div>
                `;

            // Setup copy action
            const copyBtn = card.querySelector('.saa-small-copy-btn');
            copyBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(niche.title);
              showToast("تم النسخ: " + niche.title, "success", 2000);
            });

            // Click card to Auto-Analyze News
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
              const newsInput = document.getElementById('saa-news-input');
              const fetchBtn = document.getElementById('saa-fetch-news-btn');
              if (newsInput && fetchBtn) {
                newsInput.value = niche.title;
                newsInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                fetchBtn.click();
              }
            });

            trendsContainer.appendChild(card);
          });
        }
      } else {
        if (trendsContainer) trendsContainer.innerHTML = '<div style="grid-column: span 2; text-align:center; color:#ff9800; font-size:11px;">لم يتم العثور على ترندات، جرب التحديث.</div>';
      }
    });
  }

  // Fire automatically when panel UI runs
  if (trendsContainer) {
    loadAndDisplayTrends(false);
  }

  if (fetchTrendsBtn) {
    fetchTrendsBtn.addEventListener('click', () => {
      loadAndDisplayTrends(true);
    });
  }

  if (copyAllTrendsBtn) {
    copyAllTrendsBtn.addEventListener('click', () => {
      if (currentLoadedNiches.length > 0) {
        navigator.clipboard.writeText(currentLoadedNiches.join('\\n'));
        showToast("تم نسخ جميع الترندات الجاهزة!", "success");
      }
    });
  }

  // --- 5. Interactive Chat Logic ---
  const chatSendBtn = document.getElementById('saa-chat-send');
  const chatInput = document.getElementById('saa-chat-input');
  const chatHistory = document.getElementById('saa-chat-history');

  function addChatMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `saa-msg saa-${sender}`;
    msgDiv.innerHTML = text; // allow basic HTML like linebreaks or loaders
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return msgDiv;
  }

  function handleChatSubmit() {
    const query = chatInput.value.trim();
    if (!query) return;

    // 1. Show user msg
    addChatMessage(query, 'user');
    chatInput.value = '';

    // 2. Show loader for bot
    const loaderMsg = addChatMessage('<span class="saa-loader">جاري التفكير وجمع المعلومات</span>', 'bot');

    // 3. Gather Page Context (So the AI actually knows what you're asking about)
    let contextStr = `أنت الآن مستشار ذكي تفاعلي في مجال الطباعة عند الطلب (POD - TeePublic). 
المستخدم يتصفح الآن صفحة بعنوان: "${document.title}".
`;
    // Add highlighted images to context
    const tagsContainer = document.getElementById('saa-tags-output');
    if (tagsContainer && tagsContainer.innerText) {
      contextStr += `الكلمات المفتاحية النشطة في الصفحة: ${tagsContainer.innerText}\n`;
    }

    const images = Array.from(document.querySelectorAll('.saa-highlight-img'));
    let discoveredItems = [];
    images.forEach(img => {
      if (img.alt || img.title) discoveredItems.push(img.alt || img.title);
    });

    if (discoveredItems.length > 0) {
      contextStr += `يوجد في الشاشة حالياً صور وتصاميم تحمل الوصف التالي: ${discoveredItems.slice(0, 5).join(' | ')}. \n`;
    }

    contextStr += `\nسؤال المستخدم: "${query}"\n\nقم بالرد كنصيحة خبير بلغة احترافية، وقدم تقديرات وإجابات مباشرة لسؤاله بناء على المعطيات إن طلبها (مثل تقدير أرباح أو أفكار). كن دقيقاً ومختصراً ولا تستخدم صياغات مملة.`;

    // 4. Call Gemini
    chrome.runtime.sendMessage({ type: 'CALL_GEMINI', prompt: contextStr }, (response) => {
      if (response && response.error) {
        loaderMsg.innerHTML = `⚠️ عذراً: ${response.error}`;
        loaderMsg.style.borderColor = '#ff1744';
      } else if (response && response.result) {
        // Convert simple markdown-like things to HTML (e.g., bolding)
        let formattedText = response.result.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        loaderMsg.innerHTML = formattedText;
      } else {
        loaderMsg.innerHTML = `⚠️ خطأ في الاستجابة. جرب إرسال السؤال مجدداً.`;
      }
    });
  }

  chatSendBtn.addEventListener('click', handleChatSubmit);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChatSubmit();
  });




  // --- 5.5 News Radar Logic (ENHANCED) ---
  const fetchNewsBtn = document.getElementById('saa-fetch-news-btn');
  const newsInput = document.getElementById('saa-news-input');
  const newsResults = document.getElementById('saa-news-results');
  const newsScreenContent = document.getElementById('saa-news-screen-content');
  const newsScreenLoader = document.getElementById('saa-news-screen-loader');

  function updateNewsScreen(html) {
    if (newsScreenContent) newsScreenContent.innerHTML = html;
  }

  if (fetchNewsBtn) {
    fetchNewsBtn.addEventListener('click', () => {
      const query = newsInput.value.trim();
      if (!query) {
        showToast("يرجى إدخال اسم النيتش أولاً.", "warning");
        return;
      }

      // Reset UI for new request
      if (newsScreenLoader) newsScreenLoader.style.display = 'flex';
      if (newsResults) {
        newsResults.style.display = 'none';
        newsResults.innerHTML = '';
      }

      chrome.runtime.sendMessage({ type: 'FETCH_NEWS', payload: query }, (response) => {
        if (response && response.items && response.items.length > 0) {
          if (newsResults) {
            newsResults.style.display = 'block';
            newsResults.innerHTML = '<div style="font-size:10px; color:#673ab7; margin-bottom:5px; border-bottom:1px solid #333; padding-bottom:2px;">المصادر المجلوبة:</div>';
          }

          const newsTitles = response.items.map(item => {
            const itemDiv = document.createElement('div');
            itemDiv.style.padding = '5px';
            itemDiv.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
            itemDiv.innerHTML = `<a href="${item.link}" target="_blank" style="color:#666; text-decoration:none; font-size:10px; display:block;">• ${item.title}</a>`;
            if (newsResults) newsResults.appendChild(itemDiv);
            return item.title;
          }).join('\\n');

          // Trigger AI Summary directly
          const prompt = `أنت خبير في تحليل الترندات العالمية ونيتشات الـ POD. 
بناءً على عناوين الأخبار التالية حول نيتش "${query}":
${newsTitles}

اشرح لي باختصار شديد جداً كملخص "شاشة إخبارية" ذكية:
1. السبب الرئيسي للترند (لماذا الآن؟).
2. فكرة تصميم واحدة عبقرية.
اجعل الرد باللغة العربية بأسلوب "موجز إخباري" سريع ومبهر.`;

          chrome.runtime.sendMessage({ type: 'CALL_GEMINI', prompt: prompt }, (aiRes) => {
            if (newsScreenLoader) newsScreenLoader.style.display = 'none';
            if (aiRes && aiRes.result) {
              let formattedText = aiRes.result.replace(/\\n/g, '<br>').replace(/\\*\\*(.*?)\\*\\*/g, '<b style="color:#673ab7;">$1</b>');
              updateNewsScreen(`<div style="border-right: 3px solid #673ab7; padding-right:10px;">${formattedText}</div>`);
              showToast(`اكتمل تحليل الترند لـ ${query}`, "success");
            } else {
              updateNewsScreen('<div style="color:#ff1744">⚠️ فشل تحليل الذكاء الاصطناعي للملخص.</div>');
            }
          });
        } else {
          if (newsScreenLoader) newsScreenLoader.style.display = 'none';
          updateNewsScreen('<div style="color:#ff9800; text-align:center;">لم يتم العثور على أخبار حديثة لهذا النيتش.</div>');
          showToast("لم يتم العثور على أخبار.", "warning");
        }
      });
    });
  }

  // --- 6. The End-to-End Autopilot State Machine ---
  const albumStatusText = document.getElementById('saa-album-status');
  const startAutopilotBtn = document.getElementById('saa-start-autopilot-btn');
  const stopAutopilotBtn = document.getElementById('saa-stop-autopilot-btn');
  const albumResults = document.getElementById('saa-album-results');
  const currentUrl = window.location.href;
  window.saaBotAborted = false;

  if (stopAutopilotBtn) {
    stopAutopilotBtn.addEventListener('click', () => {
      window.saaBotAborted = true; // Interrupt any pending timeouts
      chrome.storage.local.set({ saaScrape: { active: false }, saaAuto: { active: false } }, () => {
        showToast("🛑 تم إيقاف الـ Bot. يمكنك التدخل يدوياً الآن.", "warning", 8000);
        if (startAutopilotBtn) {
          startAutopilotBtn.innerHTML = "بدء المهمة آلياً 🚀";
          startAutopilotBtn.disabled = false;
        }
        if (albumStatusText) albumStatusText.innerHTML = "تم الإيقاف.";
      });
    });
  }

  if (startAutopilotBtn) {
    startAutopilotBtn.addEventListener('click', () => {
      window.saaBotAborted = false;
      // Initialize Master Scrape State
      startAutopilotBtn.innerHTML = "بدء العمل الآلي...";
      startAutopilotBtn.disabled = true;
      chrome.storage.local.set({
        saaScrape: { active: true, phase: 'ALBUMS', designs: [], albums: [] },
        saaAuto: { active: false }, // ensure creation bot is off
        saaAutopilotStatus: {
          active: true,
          stage: 'STARTED',
          message: 'Organizer started from in-page button',
          retryCount: 0,
          updatedAt: new Date().toISOString()
        }
      }, () => {
        window.location.href = "https://www.teepublic.com/account/store/albums";
      });
    });
  }

  // --- Core Scraper & Automation Functions ---

  function callLocalForPlan(designsList, existingAlbums) {
    showToast("🤖 الـ Bot: يقوم الآن بتحليل وتصنيف التصاميم وبناء الألبومات محلياً...", "info", 5000);

    setTimeout(() => {
      try {
        const plan = window.SaaLocalEngine.generateAlbumPlan(designsList, existingAlbums);

        if (!plan || plan.length === 0) {
          showToast("لم يتمكن النظام من إيجاد تصنيفات كافية.", "danger");
          chrome.storage.local.set({ saaScrape: { active: false } });
          return;
        }

        showToast("🎉 الـ Bot: الخطة جاهزة! سأبدأ عملية إنشاء الألبومات وإضافة التصاميم الآن...", "success", 5000);

        // Turn OFF scrape state, Turn ON creation state
        chrome.storage.local.set({
          saaScrape: { active: false },
          saaAuto: { active: true, plan: plan, index: 0, step: 'CREATE' }
        }, () => {
          window.location.href = "https://www.teepublic.com/account/store/albums/new";
        });
      } catch (e) {
        showToast("حدث خطأ في محرك معالجة اللغات المحلي.", "danger");
        chrome.storage.local.set({ saaScrape: { active: false } });
      }
    }, 1500); // give user time to read toast
  }

  // --- Bot Wait Helper with UI Ticker ---
  function botWait(ms, actionName, description, callback) {
    if (window.saaBotAborted) return;
    const container = document.getElementById('saa-action-ticker-container');
    const titleEl = document.getElementById('saa-action-title');
    const descEl = document.getElementById('saa-action-desc');

    if (container) {
      container.style.display = 'block';
      titleEl.innerText = actionName;

      let secondsLeft = Math.ceil(ms / 1000);
      descEl.innerText = `${description} (انتظار: ${secondsLeft} ثواني)`;

      let interval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft > 0) {
          descEl.innerText = `${description} (انتظار: ${secondsLeft} ثواني)`;
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(interval);
        if (window.saaBotAborted) return;
        if (container) container.style.display = 'none'; // reset for next
        callback();
      }, ms);
    } else {
      setTimeout(() => {
        if (window.saaBotAborted) return;
        callback();
      }, ms);
    }
  }

  function runAutopilotBot() {
    // 1. SCAPE PHASE
    chrome.storage.local.get(['saaScrape', 'saaAuto'], (res) => {
      const scrape = res.saaScrape;
      const auto = res.saaAuto;
      const isSignInPage = currentUrl.includes('/users/sign_in') || currentUrl.includes('/login');
      const onAlbumsRoot = currentUrl.includes('/account/store/albums') && !currentUrl.includes('/new') && !currentUrl.includes('/edit');
      const onStoreLikePage = currentUrl.includes('/t-shirts') || currentUrl.includes('teepublic.com/user') || currentUrl.includes('/account/storefront');

      // --> A. Handle Scraping State <--
      if (scrape && scrape.active) {
        if (scrape.phase === 'ALBUMS' && isSignInPage) {
          chrome.storage.local.set({
            saaScrape: { active: false },
            saaAutopilotStatus: {
              active: false,
              stage: 'AUTH_REQUIRED',
              message: 'TeePublic requires sign-in before albums organizer can run',
              url: currentUrl,
              updatedAt: new Date().toISOString()
            }
          });
          showToast("⚠️ تم فتح صفحة تسجيل الدخول. سجّل الدخول للحساب ثم أعد تشغيل منظم الألبومات.", "warning", 9000);
          if (albumStatusText) albumStatusText.innerHTML = "⚠️ يلزم تسجيل الدخول أولاً قبل تنظيم الألبومات.";
          return;
        }

        if (onAlbumsRoot && scrape.phase === 'ALBUMS') {
          chrome.storage.local.set({
            saaAutopilotStatus: {
              active: true,
              stage: 'SCRAPING_ALBUMS',
              message: 'Reading existing albums',
              url: currentUrl,
              updatedAt: new Date().toISOString()
            }
          });
          showToast("🤖 الـ Bot: يقرأ الألبومات الحالية لتفادي التكرار...", "warning", 3000);
          botWait(2500, "قراءة الألبومات", "يحلل الألبومات الموجودة لعدم تكرار الأسماء...", () => {
            // Grab all texts that look like albums
            const albumsText = Array.from(document.querySelectorAll('a, h3, div')).map(e => e.innerText.trim()).filter(t => t.length > 2);
            const cleanedAlbums = Array.from(new Set(albumsText));

            chrome.storage.local.set({
              saaScrape: { ...scrape, phase: 'STORE', albums: cleanedAlbums }
            }, () => {
              window.location.href = "https://www.teepublic.com/account/storefront";
            });
          });
        }
        else if (onStoreLikePage && scrape.phase === 'STORE') {
          showToast("🤖 الـ Bot: يقرأ ويستخرج تصاميم الصفحة...", "warning", 3000);
          botWait(3000, "سحب التصاميم", "يستقرئ التصاميم بالصفحة الحالية...", () => {
            const imgs = Array.from(document.querySelectorAll('img'));
            const uniqueTitles = new Set();

            imgs.forEach(img => {
              if (img.alt && img.alt.length > 5 && !img.alt.includes('Profile') && !img.alt.includes('Cover') && !img.src.includes('avatar')) {
                const title = img.alt.replace(/ Design T-Shirt/i, '').replace(/ T-Shirt/i, '').trim();
                if (title) uniqueTitles.add(title);
              }
            });

            const newExtracted = Array.from(uniqueTitles);
            const allDesigns = Array.from(new Set(scrape.designs.concat(newExtracted))); // Merge and dedup

            // Look for pagination
            const nextLink = document.querySelector('a[rel="next"], .pagination a.next, a.next_page, .next-page a');

            if (nextLink && nextLink.href) {
              showToast(`🤖 الـ Bot: ينتقل للصفحة التالية. الإجمالي حتى الآن: ${allDesigns.length}`, "info");
              chrome.storage.local.set({
                saaScrape: { ...scrape, designs: allDesigns }
              }, () => {
                window.location.href = nextLink.href;
              });
            } else {
              // Scrape fully complete
              showToast(`🤖 الـ Bot: انتهى المسح! تم تجميع ${allDesigns.length} تصميم بالكامل. جاري تصنيفها بخوارزمية الذكاء المحلي...`, "success", 4000);
              callLocalForPlan(allDesigns, scrape.albums);
            }
          });
        } else if (scrape.phase === 'ALBUMS' && !onAlbumsRoot) {
          chrome.storage.local.get(['saaAutopilotStatus'], (statusRes) => {
            const prev = statusRes.saaAutopilotStatus || {};
            const retryCount = Math.min((parseInt(prev.retryCount, 10) || 0) + 1, 3);
            chrome.storage.local.set({
              saaAutopilotStatus: {
                active: true,
                stage: retryCount >= 3 ? 'FAILED_ROUTE' : 'WAITING_ALBUMS_PAGE',
                message: retryCount >= 3
                  ? 'Unable to reach albums page automatically'
                  : 'Waiting for albums page to load',
                retryCount,
                url: currentUrl,
                updatedAt: new Date().toISOString()
              }
            }, () => {
              if (retryCount >= 3) {
                chrome.storage.local.set({ saaScrape: { active: false } });
                showToast("❌ تعذر الوصول لصفحة الألبومات تلقائياً. افتح صفحة الألبومات للحساب ثم أعد المحاولة.", "danger", 9000);
                if (albumStatusText) albumStatusText.innerHTML = "❌ فشل الوصول لصفحة الألبومات بعد عدة محاولات.";
                return;
              }
              showToast("⏳ بانتظار فتح صفحة ألبومات TeePublic الصحيحة... إعادة المحاولة.", "info", 5000);
              setTimeout(() => {
                if (!window.saaBotAborted) window.location.href = "https://www.teepublic.com/account/store/albums";
              }, 1400);
            });
          });
        }
      }

      // --> B. Handle Creation Automation State <--
      if (auto && auto.active) {
        const currentAlbum = auto.plan[auto.index];

        if (!currentAlbum) {
          // Reached end of plan!
          chrome.storage.local.set({ saaAuto: { active: false } });
          showToast("🎉 الـ Bot: لقد تم الانتهاء بنجاح! الألبومات جاهزة.", "success", 10000);
          if (albumStatusText) albumStatusText.innerHTML = "🎉 المهمة اكتملت بالكامل.";
          return;
        }

        showToast(`🤖 الـ Bot: يعمل الآن لإنشاء ألبوم 📂 [${currentAlbum.albumName}]`, "warning", 6000);

        // Phase B1: Create Page
        if (currentUrl.includes('/account/store/albums/new') && auto.step === 'CREATE') {
          botWait(3500, "إنشاء الألبوم", "إعداد وكتابة اسم الألبوم...", () => {
            const titleInput = document.querySelector('#store_album_name, input[name="store_album[name]"]');
            // prioritising .submit-album to avoid clicking global search or other buttons
            const submitBtn = document.querySelector('.submit-album, input[type=submit][value="Continue" i], input[name="commit"].submit-album');

            if (titleInput && submitBtn) {
              titleInput.value = currentAlbum.albumName;
              titleInput.dispatchEvent(new Event('input', { bubbles: true }));
              titleInput.dispatchEvent(new Event('change', { bubbles: true }));

              // Advancing state immediately just before click
              chrome.storage.local.set({
                saaAuto: { ...auto, step: 'WAIT_FOR_EDIT_PAGE' }
              }, () => {
                submitBtn.click(); // This click inherently triggers a page redirect to edit page
              });
            } else {
              showToast("لم يتم العثور على حقل الإدخال لإنشاء الألبوم.", "danger");
            }
          });
        }

        // Phase B1.5: Intercepting the redirect from TeePublic after creating name
        else if (auto.step === 'WAIT_FOR_EDIT_PAGE') {
          botWait(2000, "تحميل ألبومك الجديد", "بانتظار تجهيز صفحة التعديل من المنصة...", () => {
            // If we landed on an edit page successfully, transition step
            if (currentUrl.includes('/edit') || document.querySelector('.add-button, a.add')) {
              chrome.storage.local.set({
                saaAuto: { ...auto, step: 'ADD_DESIGNS' }
              }, () => {
                window.location.reload(); // reload to flush state and begin exact phase B2
              });
            } else if (!currentUrl.includes('albums/new')) {
              // Force navigation if it somehow dumped us on the main page
              // This is a safety catch if TeePublic's redirect changes
              showToast("لم تهبط الصفحة بالشكل المتوقع، سنحاول إيجاد الألبوم...", "warning");
              chrome.storage.local.set({ saaAuto: { ...auto, index: auto.index + 1, step: 'CREATE' } }, () => {
                setTimeout(() => window.location.href = "https://www.teepublic.com/account/store/albums/new", 2000);
              });
            }
          });
        }

        // Phase B2: Edit (Add designs) Page
        else if (auto.step === 'ADD_DESIGNS' && (currentUrl.includes('/account/store/albums/') && currentUrl.includes('/edit'))) {
          botWait(4000, "تحليل التصاميم", "جاري تحليل الصفحة لمطابقة التصاميم المطلوبة...", async () => {
            const addButtons = Array.from(document.querySelectorAll('a.add[href*="act=add"], .add_toggle a.add, .add-button, button.add'));
            const matchingCandidates = [];

            // 1. Prepare Match Criteria
            const targetDesigns = (currentAlbum.designs || []).map(d => d.toLowerCase().trim()).filter(d => d.length > 2);
            // Extract the core keyword (e.g., from "Flower Collection" get "flower")
            const albumKeyword = (currentAlbum.albumName || "").replace(/Collection|Album|Store|My|Group/gi, "").toLowerCase().trim();

            showToast(`جاري البحث عن نيتش: ${albumKeyword || "التصاميم المخططة"}...`, "info");

            addButtons.forEach(btn => {
              const container = btn.closest('.album-design, li, div.design, .design-item, .card, .tp-store-album-design');
              if (container) {
                const img = container.querySelector('img');
                const textContent = (container.innerText || "").toLowerCase();
                const alt = (img ? (img.alt || img.title || "") : "").toLowerCase();

                // Skip if already in album (TeePublic usually hides 'add' or shows 'remove' btn)
                if (btn.classList.contains('remove') || btn.innerText.toLowerCase().includes('remove') || btn.style.display === 'none') {
                  container.style.opacity = "0.6";
                  return;
                }

                // Match Logic:
                // A. Exact match from the plan
                let isMatch = targetDesigns.some(d => (alt.includes(d) || textContent.includes(d)));

                // B. Fallback: Word match based on album name keyword (if full title match fails)
                if (!isMatch && albumKeyword.length > 2) {
                  if (alt.includes(albumKeyword) || textContent.includes(albumKeyword)) {
                    isMatch = true;
                  }
                }

                if (isMatch) {
                  matchingCandidates.push({ btn, container });
                  container.style.boxShadow = "0 0 15px rgba(2, 136, 209, 0.6)"; // Blue glow for discovery
                }
              }
            });

            if (matchingCandidates.length === 0) {
              showToast("لم يتم العثور على تصاميم مطابقة. قد تكون التصاميم في صفحات أخرى.", "warning");
              proceedToNextOrSave();
              return;
            }

            showToast(`تم العثور على ${matchingCandidates.length} تصاميم مطابقة. جاري الإضافة...`, "success");

            // Sequential clicking with Human-like delays
            for (let i = 0; i < matchingCandidates.length; i++) {
              if (window.saaBotAborted) return;

              const { btn, container } = matchingCandidates[i];

              // 1. Scroll into view
              container.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await new Promise(r => setTimeout(r, 1000 + Math.random() * 800));

              if (window.saaBotAborted) return;

              // 2. Click
              btn.click();
              container.style.border = "3px solid #00e676";
              container.style.boxShadow = "0 0 20px rgba(0, 230, 118, 0.4)";

              if (albumStatusText) albumStatusText.innerHTML = `جاري الإضافة: (${i + 1}/${matchingCandidates.length})`;
            }

            // Pause before proceeding
            await new Promise(r => setTimeout(r, 2000));
            proceedToNextOrSave();
          });

          // Helper internal function to manage the transition
          function proceedToNextOrSave() {
            if (window.saaBotAborted) return;

            botWait(2500, "المراجعة والانتقال", "تقييم الصفحة التالية أو الحفظ النهائي...", () => {
              const nextLink = document.querySelector('a[rel="next"], .pagination a.next, a.next_page, .next-page a, a.next_page_link, .js-pagination-next');

              if (nextLink && nextLink.href) {
                showToast(`🤖 الـ Bot: ينتقل للصفحة التالية لمواصلة إضافة تصاميم الألبوم...`, "info");
                chrome.storage.local.set({ saaAuto: { ...auto, step: 'ADD_DESIGNS' } }, () => {
                  window.location.href = nextLink.href;
                });
              } else {
                showToast(`🤖 الـ Bot: تم إنهاء المسح. جاري حفظ الألبوم والانتقال للتالي...`, "success");
                const saveBtn = document.querySelector('input.submit-album[value*="Save" i], .submit-album, input[type="submit"][value*="Save" i]');

                chrome.storage.local.set({ saaAuto: { ...auto, index: auto.index + 1, step: 'CREATE' } }, () => {
                  if (saveBtn) {
                    saveBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                      saveBtn.click();
                      setTimeout(() => { if (!window.saaBotAborted) window.location.href = "https://www.teepublic.com/account/store/albums/new"; }, 4000);
                    }, 1500);
                  } else {
                    window.location.href = "https://www.teepublic.com/account/store/albums/new";
                  }
                });
              }
            });
          }
        }
      }
    });
  }

  // --- 8. Trademark & Copyright Scanner Logic ---
  const scanTmBtn = document.getElementById('saa-scan-tm-btn');
  const toggleAutoTmBtn = document.getElementById('saa-toggle-auto-tm-btn');
  let autoTmInterval = null;
  let isScanningTM = false;

  function performTrademarkScan(isManual = false) {
    if (isScanningTM) return;

    const imgs = Array.from(document.querySelectorAll('img:not([data-tm-scanned="true"]):not([data-tm-scanned="pending"])'));
    const designInfoList = [];

    imgs.forEach(img => {
      if (img.alt && img.alt.length > 5 && !img.alt.includes('Profile') && !img.alt.includes('Cover') && !img.src.includes('avatar')) {
        const title = img.alt.replace(/ Design T-Shirt/i, '').replace(/ T-Shirt/i, '').trim();
        if (title) {
          designInfoList.push({ title: title, element: img });
          img.setAttribute('data-tm-scanned', 'pending'); // Block from being queued again
        }
      }
    });

    const uniqueTitles = Array.from(new Set(designInfoList.map(d => d.title)));

    if (uniqueTitles.length === 0) {
      if (isManual) showToast('لم يتم العثور على تصاميم جديدة غير مفحوصة في الصفحة.', 'warning');
      return;
    }

    isScanningTM = true;
    if (scanTmBtn) scanTmBtn.innerHTML = '<span class="saa-loader">يحلل...</span>';
    if (isManual) showToast(`تم اكتشاف ${uniqueTitles.length} تصاميم جديدة. جاري الفحص...`, 'info', 4000);

    setTimeout(() => {
      isScanningTM = false;
      if (scanTmBtn) scanTmBtn.innerHTML = 'فحص الآن 🔍';

      try {
        const riskData = window.SaaLocalEngine.radarScan(uniqueTitles);
        let safe = 0, medium = 0, danger = 0;

        designInfoList.forEach(design => {
          design.element.setAttribute('data-tm-scanned', 'true');
          const riskInfo = riskData.find(r => r.title === design.title);

          if (riskInfo) {
            let shadowColor = '', borderColor = '';
            if (riskInfo.risk === 'red') {
              shadowColor = 'rgba(255, 23, 68, 0.8)'; borderColor = '#ff1744'; danger++;
            } else if (riskInfo.risk === 'orange') {
              shadowColor = 'rgba(255, 152, 0, 0.8)'; borderColor = '#ff9800'; medium++;
            } else {
              shadowColor = 'rgba(0, 230, 118, 0.8)'; borderColor = '#00e676'; safe++;
            }

            const target = design.element.closest('li, div.design, .design-item, .card') || design.element;
            target.style.setProperty('box-shadow', `0 0 25px 8px ${shadowColor}`, 'important');
            target.style.setProperty('outline', `4px solid ${borderColor}`, 'important');
            target.style.setProperty('outline-offset', '2px', 'important');
            target.style.setProperty('border-radius', '12px', 'important');
            target.style.setProperty('transition', 'all 0.4s ease', 'important');
            target.style.setProperty('position', 'relative', 'important');
            target.style.setProperty('z-index', '10', 'important');
            styledElements.add(target);
          }
        });

        // Only toast if it's manual, OR if we found danger during auto-scan
        if (isManual || danger > 0) {
          showToast(`📊 رادار الملكية (محلياً): 🟢 ${safe} | 🟠 ${medium} | 🔴 ${danger}`, 'info', 6000);
        }
      } catch (e) {
        if (isManual) showToast("فشل الرادار في قراءة البيانات المحلية.", "danger");
        designInfoList.forEach(d => d.element.removeAttribute('data-tm-scanned'));
      }
    }, 500);
  }

  if (scanTmBtn) {
    scanTmBtn.addEventListener('click', () => performTrademarkScan(true));
  }

  function updateAutoTmUI(isActive) {
    if (isActive) {
      if (toggleAutoTmBtn) {
        toggleAutoTmBtn.innerHTML = 'أوتو: يعمل 🟢';
        toggleAutoTmBtn.style.background = 'linear-gradient(135deg, #0288d1, #00c853)';
        toggleAutoTmBtn.style.border = 'none';
      }
      performTrademarkScan(false);
      if (!autoTmInterval) autoTmInterval = setInterval(() => performTrademarkScan(false), 8000);
    } else {
      if (toggleAutoTmBtn) {
        toggleAutoTmBtn.innerHTML = 'آلي: معطل ❌';
        toggleAutoTmBtn.style.background = 'var(--saa-surface)';
        toggleAutoTmBtn.style.border = '1px solid var(--saa-border)';
      }
      if (autoTmInterval) {
        clearInterval(autoTmInterval);
        autoTmInterval = null;
      }
    }
  }

  if (toggleAutoTmBtn) {
    chrome.storage.local.get(['saaAutoScanTM'], (res) => {
      updateAutoTmUI(res.saaAutoScanTM || false);
    });

    toggleAutoTmBtn.addEventListener('click', () => {
      chrome.storage.local.get(['saaAutoScanTM'], (res) => {
        const newState = !(res.saaAutoScanTM || false);
        chrome.storage.local.set({ saaAutoScanTM: newState }, () => {
          updateAutoTmUI(newState);
          if (newState) showToast("تم تفعيل رادار الملكية التلقائي (العمل في الخلفية).", "success");
          else showToast("تم إيقاف الرادار التلقائي.", "warning");
        });
      });
    });
  }

  // --- 8.5 Master Global Auto Logic ---

  function runGlobalAutoFeatures() {
    if (window.saaGlobalAutoRan) return;
    window.saaGlobalAutoRan = true;

    showToast("⚡ انطلاق التحليل الشامل: جاري سحب الأفكار وفحصها بالذكاء الاصطناعي...", 'info', 4000);

    setTimeout(() => {
      if (!globalAutoEnabled) return;

      if (pageNiche) {
        // 3. Trademark Check
        const tmInput = document.getElementById('saa-tm-input');
        const tmBtn = document.getElementById('saa-tm-btn');
        if (tmInput && tmBtn) {
          tmInput.value = pageNiche;
          tmBtn.click();
        }

        // 4. Auto-News Radar Analysis
        const newsInput = document.getElementById('saa-news-input');
        const fetchNewsBtn = document.getElementById('saa-fetch-news-btn');
        if (newsInput && fetchNewsBtn) {
          newsInput.value = pageNiche;
          fetchNewsBtn.click();
        }
      }

      // 5. Run Copyright TM Scan once
      if (typeof performTrademarkScan === 'function') {
        performTrademarkScan(false);
      }

    }, 3500); // Wait for visual pattern highlights to finish
  }

  function initMasterAuto() {
    const masterAutoBtn = document.getElementById('saa-master-auto-btn');

    const updateMasterAutoUI = () => {
      if (masterAutoBtn) {
        if (globalAutoEnabled) {
          masterAutoBtn.innerHTML = 'مُفعَّل 🟢';
          masterAutoBtn.style.background = '#00c853';
        } else {
          masterAutoBtn.innerHTML = 'مُعطَّل ❌';
          masterAutoBtn.style.background = '#d32f2f';
        }
      }
    };

    chrome.storage.local.get(['saaGlobalAuto'], (res) => {
      globalAutoEnabled = res.saaGlobalAuto !== false; // true by default
      updateMasterAutoUI();
      if (globalAutoEnabled) {
        runGlobalAutoFeatures();
      }
    });

    if (masterAutoBtn) {
      masterAutoBtn.addEventListener('click', () => {
        globalAutoEnabled = !globalAutoEnabled;
        chrome.storage.local.set({ saaGlobalAuto: globalAutoEnabled });
        updateMasterAutoUI();
        if (globalAutoEnabled) {
          window.saaGlobalAutoRan = false; // Reset to allow rerun
          if (!isAnalyzed) autoAnalyzePage();
          runGlobalAutoFeatures();
        } else {
          clearArtisanEffect();
          showToast("تم تعطيل التحليل الآلي الشامل.", "warning");
        }
      });
    }
  }

  // --- 9. Start Initializations ---
  let readyFired = false;
  const initAnalysis = () => {
    if (readyFired) return;
    readyFired = true;
    autoAnalyzePage();
    runAutopilotBot(); // Boots up the automation brain if active
    initMasterAuto(); // Evaluates and runs dynamic background analyzers
  };

  if (document.readyState === 'complete') {
    initAnalysis();
  } else {
    window.addEventListener('load', initAnalysis);
  }

  // ==========================================
  // Global Hover Tooltip Logic (POD Master Eye) 👁️
  // ==========================================
  const podTooltip = document.createElement('div');
  podTooltip.className = 'saa-pod-tooltip';
  podTooltip.style.position = 'fixed';
  podTooltip.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
  podTooltip.style.color = '#fff';
  podTooltip.style.padding = '10px';
  podTooltip.style.borderRadius = '8px';
  podTooltip.style.border = '1px solid #00e676';
  podTooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
  podTooltip.style.pointerEvents = 'none';
  podTooltip.style.zIndex = '10000000';
  podTooltip.style.display = 'none';
  podTooltip.style.maxWidth = '250px';
  podTooltip.style.fontSize = '12px';
  podTooltip.style.direction = 'ltr';
  podTooltip.style.fontFamily = 'monospace';
  document.body.appendChild(podTooltip);

  document.addEventListener('mouseover', (e) => {
    // Check if tool is enabled and panel is visible
    if (!globalAutoEnabled || panel.classList.contains('saa-hidden')) return;

    // Must not trigger inside the UI Panel itself to avoid annoying the user
    if (e.target.closest('#seo-analyse-artisan-panel')) return;

    if (e.target && e.target.tagName === 'IMG') {
      const img = e.target;
      const w = img.width || img.clientWidth;
      const h = img.height || img.clientHeight;
      // Only show for decent sized images (likely artwork not icons)
      if (w > 120 && h > 120) {
        let title = img.alt || img.title || '';
        title = title.replace(/T-Shirt|Design|Shirt|Classic|Mug|Sticker|Hoodie|Sweatshirt/gi, '').trim();
        if (title.length > 5 && !title.includes('profile') && !title.includes('avatar')) {
          // Instant Local Scan
          const radarRes = window.SaaLocalEngine.radarScan([title])[0];
          let flag = '✅ Safe (Evergreen)';
          let flagColor = '#00e676';
          if (radarRes.risk === 'red') { flag = '❌ Danger (Trademark)'; flagColor = '#ff1744'; }
          if (radarRes.risk === 'orange') { flag = '⚠️ Medium (Trend/Quote)'; flagColor = '#ff9800'; }

          const words = title.toLowerCase().replace(/[^a-z0-9\s]/gi, '').split(/\s+/).filter(w => w.length > 3).slice(0, 6);
          const reasonAttr = img.getAttribute('data-saa-reason');
          const reasonHtml = reasonAttr ? `<div style="margin-top:6px; padding-top:4px; border-top:1px dashed #444; color:#ffda44; font-size:11px;">✨ ${reasonAttr}</div>` : '';

          podTooltip.innerHTML = `
                    <div style="font-weight:bold; margin-bottom:5px; border-bottom:1px solid #333; padding-bottom:4px; text-align:center;">👁️ POD Analytics</div>
                    <div style="margin-bottom:3px;"><span style="color:#aaa;">Idea:</span> <span style="color:#0288d1; font-weight:bold;">${title}</span></div>
                    <div style="margin-bottom:3px;"><span style="color:#aaa;">Status:</span> <span style="color:${flagColor}; font-weight:bold;">${flag}</span></div>
                    <div><span style="color:#aaa;">Tags:</span> <span style="background:#222; padding:2px; border-radius:3px;">${words.join(', ')}</span></div>
                    ${reasonHtml}
                    ${reasonAttr ? '<div style="font-size:9px; color:#aaa; margin-top:4px;">(اضغط لجلب الأخبار 📰)</div>' : ''}
                  `;
          podTooltip.style.display = 'block';
        }
      }
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (podTooltip.style.display === 'block') {
      podTooltip.style.left = (e.clientX + 15) + 'px';
      podTooltip.style.top = (e.clientY + 15) + 'px';
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (e.target && e.target.tagName === 'IMG') {
      podTooltip.style.display = 'none';
    }
  });

  // --- Tracker logic removed as per user request ---

})();
