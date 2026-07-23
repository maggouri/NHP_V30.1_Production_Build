let showToast;
let currentBase64Image = null;
let socialQueue = [];
let activeSocialId = null;
let socialModuleInitialized = false;
let socialQueueRenderFp = '';
const SOCIAL_QUEUE_CAP_LOW = 80;
const SOCIAL_QUEUE_CAP_DEFAULT = 120;

function isSocialPanelActive() {
    return !!document.getElementById('panel-social')?.classList.contains('active');
}

function buildSocialQueueFingerprint(queue, activeId) {
    const capped = (Array.isArray(queue) ? queue : []).slice(0, 48);
    return [
        capped.length,
        activeId || '',
        capped.map((item) => `${item.id}:${item.status || ''}`).join('|')
    ].join('::');
}
const PINTEREST_TITLE_LIMIT = 100;
const PINTEREST_DESCRIPTION_LIMIT = 800;
const PINTEREST_TITLE_SOFT_LIMIT = 80;
const DEFAULT_PINTEREST_WATERMARK_TEXT = 'maggouristore';
const PINTEREST_SELECTOR_MEMORY_KEY = 'nhp_pinterest_selector_memory_v1';
const PINTEREST_AI_DIAG_KEY = 'nhp_pinterest_ai_diagnostics_v1';
const isLowSpecModeEnabled = () => !!window.NHP_IS_LIGHT_MODE || !!window.NHP_LOW_SPEC_MODE;

function clampNumber(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(Math.max(value, min), max);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
    ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
    ctx.arcTo(x, y + height, x, y, safeRadius);
    ctx.arcTo(x, y, x + width, y, safeRadius);
    ctx.closePath();
}

async function detectImageTransparency(img) {
    const sampleWidth = Math.max(1, Math.min(img.width || 1, 220));
    const sampleHeight = Math.max(1, Math.round((img.height || 1) * (sampleWidth / Math.max(img.width || 1, 1))));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    ctx.clearRect(0, 0, sampleWidth, sampleHeight);
    ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);

    const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    for (let i = 3; i < imageData.length; i += 4) {
        if (imageData[i] < 250) return true;
    }
    return false;
}

async function resizeImageForAI(base64, maxWidth = 800) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const scale = Math.min(maxWidth / img.width, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
}

async function buildPinterestReadyImage(base64, watermarkOptions = {}) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
            const targetWidth = 1000;
            const targetHeight = 1500;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) return resolve(base64);

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            const hasTransparency = await detectImageTransparency(img);
            ctx.fillStyle = hasTransparency ? '#000000' : '#ffffff';
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
            const drawWidth = Math.max(1, Math.round(img.width * scale));
            const drawHeight = Math.max(1, Math.round(img.height * scale));
            const drawX = Math.round((targetWidth - drawWidth) / 2);
            const drawY = Math.round((targetHeight - drawHeight) / 2);
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

            const watermarkText = (watermarkOptions.text || '').trim();
            if (watermarkOptions.enabled && watermarkText) {
                const shortestSide = Math.min(targetWidth, targetHeight);
                const padding = Math.max(18, Math.round(shortestSide * 0.035));
                let fontSize = Math.max(22, Math.round(shortestSide * 0.06));
                const maxBadgeWidth = Math.round(targetWidth * 0.72);

                ctx.font = `700 ${fontSize}px Arial`;
                while (ctx.measureText(watermarkText).width > maxBadgeWidth && fontSize > 16) {
                    fontSize -= 2;
                    ctx.font = `700 ${fontSize}px Arial`;
                }

                const textMetrics = ctx.measureText(watermarkText);
                const badgeHeight = Math.round(fontSize * 2);
                const badgeWidth = Math.round(textMetrics.width + fontSize * 1.6);
                const position = watermarkOptions.position || 'bottom-right';
                const badgeRadius = Math.max(12, Math.round(fontSize * 0.45));
                const opacity = clampNumber(Number(watermarkOptions.opacity), 0.2, 0.9, 0.68);

                let x = targetWidth - badgeWidth - padding;
                let y = targetHeight - badgeHeight - padding;

                if (position === 'bottom-left') x = padding;
                if (position === 'top-right') y = padding;
                if (position === 'top-left') {
                    x = padding;
                    y = padding;
                }
                if (position === 'center') {
                    x = Math.round((targetWidth - badgeWidth) / 2);
                    y = Math.round((targetHeight - badgeHeight) / 2);
                }

                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
                ctx.shadowBlur = Math.max(8, Math.round(fontSize * 0.45));
                ctx.shadowOffsetY = Math.max(3, Math.round(fontSize * 0.12));

                ctx.globalAlpha = Math.min(opacity + 0.18, 0.96);
                ctx.fillStyle = '#ffffff';
                drawRoundedRect(ctx, x, y, badgeWidth, badgeHeight, badgeRadius);
                ctx.fill();

                const accentWidth = Math.max(10, Math.round(fontSize * 0.38));
                ctx.fillStyle = '#E60023';
                drawRoundedRect(ctx, x, y, accentWidth, badgeHeight, badgeRadius);
                ctx.fill();

                ctx.shadowColor = 'transparent';
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#111827';
                ctx.font = `700 ${fontSize}px Arial`;
                ctx.textBaseline = 'middle';
                ctx.fillText(watermarkText, x + accentWidth + Math.round(fontSize * 0.45), y + (badgeHeight / 2));
                ctx.restore();
            }

            resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
}

function buildPinterestTitle(postText) {
    const cleanText = String(postText || '').replace(/\s+/g, ' ').trim();
    if (!cleanText) return 'Pinterest Design';

    const firstLine = cleanText.split('\n').map((line) => line.trim()).find(Boolean) || cleanText;
    const firstSentence = firstLine.split(/[.!?؟]/).map((part) => part.trim()).find(Boolean) || firstLine;
    const compactTitle = firstSentence.replace(/\s+/g, ' ').trim();
    const safeTitle = compactTitle.substring(0, PINTEREST_TITLE_SOFT_LIMIT).trim();
    return (safeTitle || compactTitle || 'Pinterest Design').substring(0, PINTEREST_TITLE_LIMIT);
}

function prioritizeEnglishText(text) {
    const parts = String(text || '')
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length <= 1) return String(text || '').trim();

    const englishParts = [];
    const otherParts = [];

    parts.forEach((part) => {
        const latinCount = (part.match(/[A-Za-z]/g) || []).length;
        const arabicCount = (part.match(/[\u0600-\u06FF]/g) || []).length;
        if (latinCount > 0 && latinCount >= arabicCount) englishParts.push(part);
        else otherParts.push(part);
    });

    return [...englishParts, ...otherParts].join('\n\n').trim();
}

function buildPinterestDraftPayloadFromSocial(postText, tags, link, imageDataUrl) {
    const cleanText = prioritizeEnglishText(postText);
    const cleanTags = String(tags || '').trim();
    const cleanLink = String(link || '').trim();

    let description = cleanText;
    if (cleanTags) description += `\n\n${cleanTags}`;
    description = description.substring(0, PINTEREST_DESCRIPTION_LIMIT);

    return {
        id: `pt_${Date.now()}`,
        title: buildPinterestTitle(cleanText),
        description,
        link: cleanLink,
        imageDataUrl,
        createdAt: new Date().toISOString(),
        source: 'social'
    };
}

function buildPinterestStatusHtml({ memory, diagnostics }) {
    const updatedAt = memory?.updatedAt || diagnostics?.at || '';
    const missing = Array.isArray(diagnostics?.missingPurposes) && diagnostics.missingPurposes.length
        ? diagnostics.missingPurposes.join(', ')
        : 'none';
    const titleCount = Array.isArray(memory?.title) ? memory.title.length : 0;
    const descriptionCount = Array.isArray(memory?.description) ? memory.description.length : 0;
    const linkCount = Array.isArray(memory?.link) ? memory.link.length : 0;
    const publishCount = Array.isArray(memory?.publish) ? memory.publish.length : 0;
    const source = diagnostics?.healed?.source || memory?.source || 'runtime';

    return `
        <div style="font-size:11px; line-height:1.6; color: var(--text-muted);">
            <div><strong style="color:var(--text-main);">Pinterest AI</strong> source: ${source}</div>
            <div>Selectors memory: title ${titleCount} | description ${descriptionCount} | link ${linkCount} | publish ${publishCount}</div>
            <div>Last missing fields: ${missing}</div>
            <div>Last update: ${updatedAt || 'not available'}</div>
        </div>
    `;
}

export function initSocialModule(helpers) {
    if (socialModuleInitialized) {
        if (typeof window.NHP_activateSocialPanel === 'function') window.NHP_activateSocialPanel();
        return;
    }
    socialModuleInitialized = true;

    showToast = helpers.showToast;
    console.log('🚀 Social Publisher Module: Initializing...');

    const ui = {
        pageId: document.getElementById('social-page-id'),
        token: document.getElementById('social-access-token'),
        saveSettings: document.getElementById('social-save-settings'),
        uploadTrigger: document.getElementById('social-upload-trigger'),
        imageInput: document.getElementById('social-image-upload'),
        previewWrap: document.getElementById('social-preview-wrap'),
        imgPreview: document.getElementById('social-img-preview'),
        nicheHint: document.getElementById('social-niche-hint'),
        aiGenBtn: document.getElementById('social-ai-gen'),
        postText: document.getElementById('social-post-text'),
        postTags: document.getElementById('social-post-tags'),
        productLink: document.getElementById('social-product-link'),
        publishBtn: document.getElementById('social-publish-btn'),
        uiEngageBtn: document.getElementById('social-ui-engage-btn'),
        aiAgentBtn: document.getElementById('social-ai-agent-btn'),
        aiPilotBtn: document.getElementById('social-ai-pilot-btn'),
        
        // Pinterest Elements
        pinSaveSettings: document.getElementById('social-pin-save-settings'),
        pinPublishBtn: document.getElementById('social-pin-publish-btn'),
        pinWatermarkEnabled: document.getElementById('social-pin-watermark-enabled'),
        pinWatermarkText: document.getElementById('social-pin-watermark-text'),
        pinWatermarkPosition: document.getElementById('social-pin-watermark-position'),
        pinWatermarkOpacity: document.getElementById('social-pin-watermark-opacity'),
        pinWatermarkOpacityValue: document.getElementById('social-pin-watermark-opacity-value')
    };

    // Load Settings
    chrome.storage.local.get([
        'social_fb_page_id',
        'social_fb_token',
        'social_pin_watermark_enabled',
        'social_pin_watermark_text',
        'social_pin_watermark_position',
        'social_pin_watermark_opacity'
    ], (res) => {
        if (res.social_fb_page_id) ui.pageId.value = res.social_fb_page_id;
        if (res.social_fb_token) ui.token.value = res.social_fb_token;
        if (ui.pinWatermarkEnabled) ui.pinWatermarkEnabled.checked = res.social_pin_watermark_enabled !== false;
        if (ui.pinWatermarkText) ui.pinWatermarkText.value = res.social_pin_watermark_text || DEFAULT_PINTEREST_WATERMARK_TEXT;
        if (res.social_pin_watermark_position && ui.pinWatermarkPosition) ui.pinWatermarkPosition.value = res.social_pin_watermark_position;
        if (ui.pinWatermarkOpacity) {
            const opacityValue = clampNumber(Number(res.social_pin_watermark_opacity), 20, 90, 68);
            ui.pinWatermarkOpacity.value = String(opacityValue);
            if (ui.pinWatermarkOpacityValue) ui.pinWatermarkOpacityValue.textContent = `${opacityValue}%`;
        }
    });

    if (ui.pinWatermarkOpacity && ui.pinWatermarkOpacityValue) {
        ui.pinWatermarkOpacity.addEventListener('input', () => {
            ui.pinWatermarkOpacityValue.textContent = `${ui.pinWatermarkOpacity.value}%`;
        });
    }

    // إضافة زر الاكتشاف التلقائي لفيسبوك برمجياً (لكي لا نعدل HTML)
    let pinterestAiStatusEl = null;
    let pinterestAiInspectBtn = null;

    function ensurePinterestAiUi() {
        if (!ui.pinSaveSettings?.parentNode || pinterestAiStatusEl) return;

        pinterestAiInspectBtn = document.createElement('button');
        pinterestAiInspectBtn.type = 'button';
        pinterestAiInspectBtn.className = 'btn w-full bg-surface2 border border-primary text-[10px] py-1.5 hover:bg-white/5 mb-2';
        pinterestAiInspectBtn.innerHTML = '<i class="fa-solid fa-brain"></i> فحص Pinterest AI';
        pinterestAiInspectBtn.style.color = 'var(--primary)';

        pinterestAiStatusEl = document.createElement('div');
        pinterestAiStatusEl.id = 'social-pin-ai-status';
        pinterestAiStatusEl.style.cssText = 'margin:0 0 10px 0;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,0.03);';
        pinterestAiStatusEl.innerHTML = buildPinterestStatusHtml({ memory: null, diagnostics: null });

        ui.pinSaveSettings.parentNode.insertBefore(pinterestAiInspectBtn, ui.pinSaveSettings);
        ui.pinSaveSettings.parentNode.insertBefore(pinterestAiStatusEl, ui.pinSaveSettings);

        pinterestAiInspectBtn.addEventListener('click', refreshPinterestAiStatus);
    }

    function refreshPinterestAiStatus() {
        chrome.storage.local.get([PINTEREST_SELECTOR_MEMORY_KEY, PINTEREST_AI_DIAG_KEY], (res) => {
            const memory = res[PINTEREST_SELECTOR_MEMORY_KEY] || null;
            const diagnostics = res[PINTEREST_AI_DIAG_KEY] || null;
            if (pinterestAiStatusEl) {
                pinterestAiStatusEl.innerHTML = buildPinterestStatusHtml({ memory, diagnostics });
            }

            const missing = diagnostics?.missingPurposes || [];
            if (missing.includes('link')) {
                showToast('⚠️ Pinterest AI: حقل الرابط لم يُكتشف في آخر محاولة.');
            } else if (missing.includes('description')) {
                showToast('⚠️ Pinterest AI: حقل الوصف لم يُكتشف في آخر محاولة.');
            } else if (memory || diagnostics) {
                showToast('✅ تم تحديث حالة Pinterest AI من آخر جلسة.');
            } else {
                showToast('ℹ️ لا توجد بيانات تشخيص Pinterest محفوظة بعد.');
            }
        });
    }

    ensurePinterestAiUi();
    refreshPinterestAiStatus();

    const autoDetectBtn = document.createElement('button');
    autoDetectBtn.className = 'btn w-full bg-surface2 border border-primary text-[10px] py-1.5 hover:bg-white/5 mb-2';
    autoDetectBtn.innerHTML = '<i class="fa-solid fa-radar"></i> اكتشاف الصفحة والتوكن تلقائياً';
    autoDetectBtn.style.color = 'var(--primary)';
    ui.saveSettings.parentNode.insertBefore(autoDetectBtn, ui.saveSettings);

    autoDetectBtn.addEventListener('click', () => {
        autoDetectBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري البحث في تبويبات فيسبوك...';
        chrome.tabs.query({ url: ["*://business.facebook.com/*", "*://*.facebook.com/*"] }, (tabs) => {
            if (tabs.length === 0) {
                showToast('⚠️ يرجى فتح صفحة فيسبوك أو Meta Business Suite في تبويب آخر أولاً!');
                autoDetectBtn.innerHTML = '<i class="fa-solid fa-radar"></i> اكتشاف الصفحة والتوكن تلقائياً';
                return;
            }

            const targetTab = tabs.find(t => t.url.includes('business.facebook')) || tabs[0];
            try {
                chrome.scripting.executeScript({
                    target: { tabId: targetTab.id },
                    func: () => {
                        let token = null; let pageId = null;
                        const scripts = document.querySelectorAll('script');
                        for (let s of scripts) {
                            const tokenMatch = s.innerText.match(/["'](EAA[A-Z]\w+)["']/);
                            if (tokenMatch) token = tokenMatch[1];
                            const pageIdMatch = s.innerText.match(/"pageID":"(\d+)"/);
                            if (pageIdMatch) pageId = pageIdMatch[1];
                        }
                        if (!pageId) {
                            const meta = document.querySelector('meta[property="al:android:url"]');
                            if (meta) { const m = meta.content.match(/page\/(\d+)/); if (m) pageId = m[1]; }
                        }
                        return { token, pageId };
                    }
                }, (results) => {
                    autoDetectBtn.innerHTML = '<i class="fa-solid fa-radar"></i> اكتشاف الصفحة والتوكن تلقائياً';
                    if (chrome.runtime.lastError) return showToast('❌ خطأ في الصلاحيات. يرجى إدخال البيانات يدوياً.');
                    if (results && results[0] && results[0].result) {
                        const data = results[0].result; let found = false;
                        if (data.pageId) { ui.pageId.value = data.pageId; found = true; }
                        if (data.token) { ui.token.value = data.token; found = true; }
                        if (data.pageId && data.token) { showToast('✅ تم استخراج المعرف والتوكن بنجاح!'); ui.saveSettings.click(); }
                        else if (found) { showToast('⚠️ استخرجنا البعض. افتح Business Suite لاستخراج التوكن.'); }
                        else { showToast('❌ لم نتمكن من استخراج البيانات. تأكد من أنك داخل صفحة إدارة فيسبوك.'); }
                    }
                });
            } catch (err) { autoDetectBtn.innerHTML = '<i class="fa-solid fa-radar"></i> اكتشاف الصفحة والتوكن تلقائياً'; showToast('❌ ميزة الاكتشاف التلقائي غير مدعومة حالياً.'); }
        });
    });

    // Save Settings
    ui.saveSettings.addEventListener('click', () => {
        chrome.storage.local.set({
            social_fb_page_id: ui.pageId.value.trim(),
            social_fb_token: ui.token.value.trim()
        }, () => showToast('✅ تم حفظ إعدادات فيسبوك بنجاح!'));
    });

    // Save Pinterest Settings
    if (ui.pinSaveSettings) {
        ui.pinSaveSettings.addEventListener('click', () => {
            chrome.storage.local.set({
                social_pin_watermark_enabled: !!ui.pinWatermarkEnabled?.checked,
                social_pin_watermark_text: ui.pinWatermarkText?.value.trim() || DEFAULT_PINTEREST_WATERMARK_TEXT,
                social_pin_watermark_position: ui.pinWatermarkPosition?.value || 'bottom-right',
                social_pin_watermark_opacity: clampNumber(Number(ui.pinWatermarkOpacity?.value), 20, 90, 68)
            }, () => showToast('✅ تم حفظ إعدادات Pinterest بنجاح!'));
        });
    }

    // Image Upload (Bulk & Queue System)
    ui.uploadTrigger.addEventListener('click', () => ui.imageInput.click());
    ui.imageInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        let loadedCount = 0;
        files.forEach(file => {
            console.log('[NHP-IMG] picked', file.name, file.type || 'unknown', `${Math.round((file.size || 0) / 1024)}KB`);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const dataUrl = reader.result;
                const hasPrefix = typeof dataUrl === 'string' && dataUrl.startsWith('data:');
                const cleanBase64 = hasPrefix ? (dataUrl.split(',')[1] || '') : (dataUrl || '');
                console.log('[NHP-IMG] base64 ready', cleanBase64.length, hasPrefix);
                // توليد صورة مصغرة خفيفة جداً للواجهة لتجنب تشنج المتصفح
                const thumb = await resizeImageForAI(reader.result, isLowSpecModeEnabled() ? 110 : 150);
                socialQueue.push({
                    id: 'soc_' + Math.random().toString(36).substr(2, 9),
                    file: file,
                    base64: reader.result,
                    thumbnail: thumb,
                    status: 'pending',
                    message: '',
                    tags: '',
                    link: ''
                });
                loadedCount++;
                if (loadedCount === files.length) {
                    renderSocialQueue();
                    if (!activeSocialId) selectSocialImage(socialQueue[0].id);
                    showToast(`🖼️ تم تحميل ${files.length} تصميم، يمكنك البدء!`);
                }
            };
            reader.readAsDataURL(file);
        });
        ui.imageInput.value = ''; // Reset
    });

    const socialQueueEl = document.getElementById('social-queue');
    if (socialQueueEl && socialQueueEl.dataset.bound !== '1') {
        socialQueueEl.dataset.bound = '1';
        socialQueueEl.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.soc-remove-btn');
            const queueItem = e.target.closest('.queue-item');
            if (!queueItem) return;
            const id = queueItem.getAttribute('data-id');
            if (!id) return;
            if (removeBtn) {
                e.stopPropagation();
                socialQueue = socialQueue.filter((i) => i.id !== id);
                if (activeSocialId === id) {
                    activeSocialId = socialQueue.length > 0 ? socialQueue[0].id : null;
                    if (activeSocialId) selectSocialImage(activeSocialId);
                    else ui.previewWrap.classList.add('hidden');
                } else {
                    renderSocialQueue();
                }
                return;
            }
            selectSocialImage(id);
        });
    }

    function renderSocialQueue(force = false) {
        const container = document.getElementById('social-queue-container');
        const qEl = document.getElementById('social-queue');
        const countEl = document.getElementById('social-queue-count');
        if (!container || !qEl) return;

        if (countEl) countEl.textContent = `${socialQueue.length} تصميم`;

        if (!isSocialPanelActive() && !force) return;

        if (socialQueue.length === 0) {
            socialQueueRenderFp = '';
            container.classList.add('hidden');
            ui.previewWrap.classList.add('hidden');
            qEl.innerHTML = '';
            return;
        }

        const cap = isLowSpecModeEnabled() ? SOCIAL_QUEUE_CAP_LOW : SOCIAL_QUEUE_CAP_DEFAULT;
        const visibleQueue = socialQueue.slice(0, cap);
        const fp = buildSocialQueueFingerprint(visibleQueue, activeSocialId);
        if (!force && fp === socialQueueRenderFp) return;
        socialQueueRenderFp = fp;

        container.classList.remove('hidden');
        qEl.innerHTML = visibleQueue.map(item => `
            <div class="queue-item ${item.id === activeSocialId ? 'active' : ''}" data-id="${item.id}"
                 style="width: 48px; height: 48px; flex-shrink: 0; border-radius: 8px; border: 2px solid ${item.id === activeSocialId ? 'var(--primary)' : 'var(--border)'}; overflow: hidden; cursor: pointer; position: relative; transition: all 0.2s;">
                <img src="${item.thumbnail || item.base64}" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover;">
                ${item.status === 'done' ? '<div style="position:absolute; top:0; right:0; background:var(--safe); color:white; font-size:8px; padding:2px 4px; border-radius:0 0 0 6px;"><i class="fa-solid fa-check"></i></div>' : ''}
                <button type="button" class="soc-remove-btn" data-id="${item.id}" style="position:absolute; top:0; left:0; background:rgba(239,68,68,0.85); color:white; border:none; font-size:9px; width:16px; height:16px; cursor:pointer; border-radius:0 0 6px 0; display:flex; align-items:center; justify-content:center;">✕</button>
            </div>
        `).join('');
    }

    function selectSocialImage(id) {
        activeSocialId = id;
        const item = socialQueue.find(i => i.id === id);
        if (item) {
            currentBase64Image = item.base64;
            ui.imgPreview.src = item.thumbnail || currentBase64Image;
            ui.postText.value = item.message || '';
            ui.postTags.value = item.tags || '';
            ui.productLink.value = item.link || '';
            ui.previewWrap.classList.remove('hidden');
        }
        renderSocialQueue();
    }

    const clearBtn = document.getElementById('social-clear-queue-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (socialQueue.length === 0) return;
            socialQueue = [];
            activeSocialId = null;
            currentBase64Image = null;
            ui.previewWrap.classList.add('hidden');
            renderSocialQueue();
            showToast('🗑️ تم مسح طابور التسويق بنجاح');
        });
    }

    // Save inputs to current item automatically
    ui.postText.addEventListener('input', (e) => { const item = socialQueue.find(i => i.id === activeSocialId); if (item) item.message = e.target.value; });
    ui.postTags.addEventListener('input', (e) => { const item = socialQueue.find(i => i.id === activeSocialId); if (item) item.tags = e.target.value; });
    ui.productLink.addEventListener('input', (e) => { const item = socialQueue.find(i => i.id === activeSocialId); if (item) item.link = e.target.value; });

    // AI Generation (Gemini)
    ui.aiGenBtn.addEventListener('click', async () => {
        if (!currentBase64Image) return showToast('⚠️ يرجى رفع صورة أولاً!');

        const niche = ui.nicheHint.value.trim() || 'T-shirt design';
        const prompt = `أنت خبير تسويق إلكتروني (Social Media Manager).
قم بتحليل هذا التصميم الخاص بمجال "${niche}".
اكتب منشوراً تسويقياً قصيراً وجذاباً لهذا التصميم.
يجب أن يكون المنشور ثنائي اللغة، لكن يبدأ بالإنجليزية أولاً ثم العربية بعد سطر فارغ.
اجعل أول جملة بالإنجليزية قصيرة وقوية ومناسبة لعنوان Pinterest.
استخرج 5 هاشتاجات قوية، ويفضل أن تكون بالإنجليزية أولاً.

أعد النتيجة بصيغة JSON فقط كالتالي:
{"message": "English text here\\n\\nالنص العربي هنا", "tags": "#EnglishTag #AnotherTag #هاشتاج"}`;

        ui.aiGenBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الكتابة...';
        ui.aiGenBtn.disabled = true;

        // تصغير حجم الصورة قبل إرسالها للذكاء الاصطناعي لتجنب خطأ الحجم الزائد
        const beforeKB = Math.round(((currentBase64Image || '').length * 0.75) / 1024);
        const aiOptimizedImage = await resizeImageForAI(currentBase64Image, isLowSpecModeEnabled() ? 640 : 800);
        const afterKB = Math.round(((aiOptimizedImage || '').length * 0.75) / 1024);
        console.log('[NHP-IMG] resized', `${beforeKB}KB`, `${afterKB}KB`);

        const hasPrefix = typeof aiOptimizedImage === 'string' && aiOptimizedImage.startsWith('data:');
        const mimeType = hasPrefix
            ? (aiOptimizedImage.match(/^data:([^;,]+)[;,]/i)?.[1] || 'image/jpeg')
            : 'image/jpeg';
        const cleanBase64 = hasPrefix ? (aiOptimizedImage.split(',')[1] || '') : (aiOptimizedImage || '');
        console.log('[NHP-IMG] base64 ready', cleanBase64.length, hasPrefix);
        console.log('[NHP-IMG] sending', {
            host: 'generativelanguage.googleapis.com',
            hasInlineData: !!cleanBase64,
            mimeType,
            base64Length: cleanBase64.length,
            hasKey: true
        });

        chrome.runtime.sendMessage({
            action: 'call_gemini',
            payload: prompt,
            base64: aiOptimizedImage,
            mimeType
        }, (response) => {
            ui.aiGenBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> كتابة منشور تسويقي (AI)';
            ui.aiGenBtn.disabled = false;

            if (chrome.runtime.lastError) {
                console.warn('[NHP-IMG] error', chrome.runtime.lastError.message);
                return showToast('❌ خطأ في الاتصال بالخلفية: ' + chrome.runtime.lastError.message);
            }

            console.log('[NHP-IMG] response', response?.success ?? 'unknown');

            if (response && response.success && response.data) {
                ui.postText.value = response.data.message || response.data.result || '';
                ui.postTags.value = response.data.tags || '';
                const activeItem = socialQueue.find(i => i.id === activeSocialId);
                if (activeItem) {
                    activeItem.message = ui.postText.value;
                    activeItem.tags = ui.postTags.value;
                }
                showToast('✨ تم توليد المحتوى الإعلاني بنجاح!');
            } else {
                console.warn('[NHP-IMG] error body', response?.error || 'no response');
                console.error("Social AI Error:", response);
                showToast('❌ فشل: ' + (response?.error || 'تأكد من قوة الاتصال ومفتاح API'));
            }
        });
    });

    // Publish to Facebook
    ui.publishBtn.addEventListener('click', () => {
        const pageId = ui.pageId.value.trim();
        const token = ui.token.value.trim();
        let message = ui.postText.value.trim();
        const tags = ui.postTags.value.trim();
        const link = ui.productLink.value.trim();

        if (!pageId || !token) return showToast('⚠️ يرجى إدخال إعدادات صفحة فيسبوك أولاً!');
        if (!currentBase64Image) return showToast('⚠️ يرجى رفع صورة للنشر!');
        if (!message) return showToast('⚠️ نص المنشور فارغ!');

        if (tags) message += '\n\n' + tags;
        if (link) message += '\n\n🛒 رابط الحصول على التصميم:\n' + link;

        ui.publishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري النشر...';
        ui.publishBtn.disabled = true;

        chrome.runtime.sendMessage({ action: 'publish_to_facebook', data: { pageId, token, message, base64Image: currentBase64Image } }, (res) => {
            ui.publishBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> نشر الآن على فيسبوك';
            ui.publishBtn.disabled = false;

            if (chrome.runtime.lastError) {
                return showToast('❌ خطأ في الاتصال بالخلفية: ' + chrome.runtime.lastError.message);
            }

            if (res && res.success) {
                showToast('🚀 تم النشر على فيسبوك بنجاح!');
                const activeItem = socialQueue.find(i => i.id === activeSocialId);
                if (activeItem) activeItem.status = 'done';
                renderSocialQueue();
                const nextPending = socialQueue.find(i => i.status === 'pending');
                if (nextPending) setTimeout(() => selectSocialImage(nextPending.id), 1000);
            }
            else { showToast('❌ خطأ في النشر: ' + (res.error || 'Unknown Error')); }
        });
    });

    // Publish to Pinterest
    if (ui.pinPublishBtn) {
        ui.pinPublishBtn.addEventListener('click', async () => {
            const defaultPinButtonLabel = ui.pinPublishBtn.dataset.defaultLabel || ui.pinPublishBtn.innerHTML;
            ui.pinPublishBtn.dataset.defaultLabel = defaultPinButtonLabel;
            const postText = ui.postText.value.trim();
            const boardId = 'browser-session';
            const token = 'browser-session';
            let description = postText;
            const tags = ui.postTags.value.trim();
            const link = ui.productLink.value.trim();
            const watermarkEnabled = !!ui.pinWatermarkEnabled?.checked;
            const watermarkText = ui.pinWatermarkText?.value.trim() || DEFAULT_PINTEREST_WATERMARK_TEXT;
            const watermarkPosition = ui.pinWatermarkPosition?.value || 'bottom-right';
            const watermarkOpacity = clampNumber(Number(ui.pinWatermarkOpacity?.value), 20, 90, 68) / 100;

            if (!boardId || !token) return showToast('⚠️ يرجى إدخال إعدادات Pinterest (البورد والتوكن) أولاً!');
            if (!currentBase64Image) return showToast('⚠️ يرجى رفع صورة للنشر!');
            if (!description) return showToast('⚠️ نص المنشور فارغ!');
            if (watermarkEnabled && !watermarkText) return showToast('⚠️ اكتب نص العلامة المائية أو عطّلها قبل النشر على Pinterest.');

            // Title in Pinterest takes up to 100 chars, we'll take the first line of the generated message
            const title = description.split('\n')[0].substring(0, 100);
            if (tags) description += '\n\n' + tags;
            description = description.substring(0, 800);

            ui.pinPublishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري النشر...';
            ui.pinPublishBtn.disabled = true;

            try {
                const pinterestImage = await buildPinterestReadyImage(currentBase64Image, {
                    enabled: watermarkEnabled,
                    text: watermarkText,
                    position: watermarkPosition,
                    opacity: watermarkOpacity
                });

                const payload = buildPinterestDraftPayloadFromSocial(ui.postText.value.trim(), tags, link, pinterestImage);
                chrome.storage.local.set({ pt_pending_publish: payload }, () => {
                    refreshPinterestAiStatus();
                    ui.pinPublishBtn.innerHTML = '<i class="fa-brands fa-pinterest"></i> نشر الآن على Pinterest';
                    ui.pinPublishBtn.innerHTML = defaultPinButtonLabel;
                    ui.pinPublishBtn.disabled = false;

                    if (chrome.runtime.lastError) {
                        showToast('فشل تجهيز أمر Pinterest: ' + chrome.runtime.lastError.message);
                        return;
                    }

                    chrome.runtime.sendMessage({
                        action: 'open_account_browser',
                        platform: 'pinterest',
                        account: { id: payload.id, email: 'session@pinterest.local', displayName: 'Pinterest Session' }
                    }, () => {
                        refreshPinterestAiStatus();
                        if (chrome.runtime.lastError) {
                            showToast('تعذر فتح Pinterest: ' + chrome.runtime.lastError.message);
                            return;
                        }
                        showToast('تم تجهيز مسودة Pinterest على نفس جلسة Chrome.');
                    });
                });
                return;

                chrome.runtime.sendMessage({
                    action: 'publish_to_pinterest',
                    data: { boardId, token, title, description, link, base64Image: pinterestImage }
                }, (res) => {
                    ui.pinPublishBtn.innerHTML = '<i class="fa-brands fa-pinterest"></i> نشر الآن على Pinterest';
                    ui.pinPublishBtn.disabled = false;

                    if (chrome.runtime.lastError) return showToast('❌ خطأ في الاتصال بالخلفية: ' + chrome.runtime.lastError.message);

                    if (res && res.success) {
                        showToast('🚀 تم النشر على Pinterest بنجاح!');
                        const activeItem = socialQueue.find(i => i.id === activeSocialId);
                        if (activeItem) activeItem.status = 'done';
                        renderSocialQueue();
                    } else {
                        showToast('❌ خطأ في النشر: ' + (res.error || 'Unknown Error'));
                    }
                });
            } catch (err) {
                ui.pinPublishBtn.innerHTML = '<i class="fa-brands fa-pinterest"></i> نشر الآن على Pinterest';
                ui.pinPublishBtn.disabled = false;
                showToast('❌ تعذر تجهيز صورة Pinterest: ' + (err?.message || 'Unknown Error'));
            }
        });
    }

    // Facebook UI Automator (Human-like Engagement)
    if (ui.uiEngageBtn) {
        ui.uiEngageBtn.addEventListener('click', () => {
            const message = ui.postText.value.trim();
            const tags = ui.postTags.value.trim();
            const link = ui.productLink.value.trim();
            const pageId = ui.pageId.value.trim();

            let fullMessage = message;
            if (tags) fullMessage += '\n\n' + tags;
            if (link) fullMessage += '\n\n🛒 رابط الحصول على التصميم:\n' + link;

            if (!fullMessage) return showToast('⚠️ يرجى توليد أو كتابة نص المنشور أولاً');
            if (!currentBase64Image) return showToast('⚠️ يرجى رفع صورة للنشر!');

            showToast('🤖 جاري إطلاق البوت... سيتم فتح فيسبوك الآن');

            const targetUrl = pageId ? `https://web.facebook.com/${pageId}` : 'https://web.facebook.com/';

            // استخدام التخزين المحلي بدلاً من إرسال الرسائل المباشرة لضمان عدم ضياع الأمر عند تحميل الصفحة
            chrome.storage.local.set({
                fb_pending_engage: {
                    message: fullMessage,
                    base64Image: currentBase64Image,
                    pageId: pageId,
                    timestamp: Date.now()
                }
            }, () => {
                chrome.tabs.create({ url: targetUrl });
            });
        });
    }

    // AI Autonomous Agent (Read & React)
    if (ui.aiAgentBtn) {
        ui.aiAgentBtn.addEventListener('click', () => {
            const niche = ui.nicheHint.value.trim() || 'Print on Demand';

            showToast('🧠 جاري إيقاظ الوكيل الذكي... سيتم فتح فيسبوك للتفاعل المستقل!');

            chrome.storage.local.set({
                fb_pending_agent: {
                    persona: niche,
                    timestamp: Date.now()
                }
            }, () => {
                // يفضل فتح الصفحة الرئيسية لفيسبوك أو المجموعات للتفاعل
                chrome.tabs.create({ url: 'https://web.facebook.com/' });
            });
        });
    }

    // الطيار الآلي الشامل (AI Pilot)
    if (ui.aiPilotBtn) {
        ui.aiPilotBtn.addEventListener('click', () => {
            const niche = ui.nicheHint.value.trim() || 'Print on Demand';
            const pageId = ui.pageId.value.trim();
            const queue = getDesignQueue();
            
            // سحب أول تصميم غير منشور من الطابور
            const pendingDesign = queue.find(d => d.status !== 'done');
            let base64Image = null;
            if (pendingDesign) {
                base64Image = pendingDesign.thumbnail || pendingDesign.base64;
            }

            showToast('✈️ جاري إقلاع الطيار الآلي... سيقوم بتوليد العرض، النشر، والتفاعل!');
            
            chrome.storage.local.set({
                fb_pending_pilot: {
                    persona: niche,
                    pageId: pageId,
                    base64Image: base64Image,
                    designId: pendingDesign ? pendingDesign.id : null,
                    timestamp: Date.now()
                }
            }, () => {
                const targetUrl = pageId ? `https://web.facebook.com/${pageId}` : 'https://web.facebook.com/';
                chrome.tabs.create({ url: targetUrl });
            });
        });
    }

    window.NHP_activateSocialPanel = function activateSocialPanel() {
        socialQueueRenderFp = '';
        renderSocialQueue(true);
    };

    if (isSocialPanelActive()) {
        window.NHP_activateSocialPanel();
    }
}
