/**
 * AI CREATY Floating Session Card — Chrome extension content script.
 * Displays account & store information, handles fast-copy and direct injection,
 * and allows store profile generation using AI directly from the overlay.
 */
(function initCreatySessionCard() {
    'use strict';

    const STORAGE_KEY = 'nhp_session_info';
    const MINIMIZED_KEY = 'nhp_session_card_minimized';
    const POSITION_KEY = 'nhp_session_card_position';
    const PROFILE_SYNC_KEY = 'creaty_last_store_profile_update';

    let sessionInfo = null;
    let cardElement = null;
    let dragOffset = { x: 0, y: 0 };
    let isDragging = false;
    let activeInjectionValue = null;
    let activeInjectionLabel = '';
    let injectionOverlay = null;

    function titleCaseWords(text) {
        return String(text || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    function slugWords(text) {
        return String(text || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function buildLocalFallbackProfile(rawNiche) {
        const niches = ['Retro Gaming', 'Cute Pets', 'Anime Humor', 'Nature Hiking', 'Fitness Motivation', 'Music Lovers', 'Vintage Sports', 'Space Science'];
        const seed = String(sessionInfo?.email || 'creaty');
        let total = 0;
        for (let i = 0; i < seed.length; i += 1) total += seed.charCodeAt(i);
        const niche = titleCaseWords(rawNiche || sessionInfo?.storeProfile?.niche || niches[total % niches.length]);
        const mailName = String(sessionInfo?.email || '').split('@')[0] || 'creator';
        const handle = slugWords(mailName) || 'creator';
        const title = titleCaseWords(niche + ' Studio').slice(0, 60);
        return {
            title,
            bio: `${title} is a curated TeePublic shop focused on ${niche.toLowerCase()} artwork, clean themed collections, and recognizable visual identity for fans of this niche.`,
            niche,
            country: 'United States',
            source: 'local_fallback',
            links: {
                instagram: `https://instagram.com/${handle}`,
                twitter: `https://x.com/${handle}`,
                facebook: `https://facebook.com/${handle}`,
                pinterest: `https://pinterest.com/${handle}`,
            },
            socialLinks: {
                instagram: `https://instagram.com/${handle}`,
                twitter: `https://x.com/${handle}`,
                facebook: `https://facebook.com/${handle}`,
                pinterest: `https://pinterest.com/${handle}`,
            },
            imagePrompts: {
                avatar: `Bold ${niche} avatar icon, centered subject, premium merch branding.`,
                cover: `Wide ${niche} banner art, panoramic layout, premium TeePublic store look.`,
            },
            avatarDataUrl: sessionInfo?.storeProfile?.avatarDataUrl || null,
            coverDataUrl: sessionInfo?.storeProfile?.coverDataUrl || null,
            generatedAt: new Date().toISOString(),
        };
    }

    // SVG Icons
    const SVG_DRAG = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>`;
    const SVG_MINIMIZE = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    const SVG_CLOSE = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    const SVG_COPY = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const SVG_INJECT = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10m0 0l-4-4m4 4l4-4M4 22h16"></path></svg>`;
    const SVG_SPINNER = `<svg class="nhp-spinner" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10" stroke-dasharray="40" stroke-dashoffset="10"></circle></svg>`;
    const SVG_SPARKLES = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"></path></svg>`;
    const SVG_DOWNLOAD = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5l5 5 5-5m-5 5V3"></path></svg>`;

    // CSS Styling
    const STYLES = `
        #nhp-creaty-session-card {
            position: fixed;
            z-index: 2147483647;
            width: 320px;
            max-height: 80vh;
            background: #1a1a2e;
            border: 1px solid rgba(74, 222, 128, 0.45);
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.05);
            color: #f1f5f9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 12.5px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            direction: rtl;
            text-align: right;
            box-sizing: border-box;
            transition: width 0.3s ease, height 0.3s ease, border-radius 0.3s ease;
        }

        #nhp-creaty-session-card * {
            box-sizing: border-box;
        }

        #nhp-creaty-session-card.nhp-minimized {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            cursor: pointer;
            background: #1a1a2e;
            border: 1px solid #4ade80;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            overflow: hidden;
        }

        #nhp-creaty-session-card.nhp-minimized .nhp-card-header,
        #nhp-creaty-session-card.nhp-minimized .nhp-card-tabs,
        #nhp-creaty-session-card.nhp-minimized .nhp-card-body {
            display: none !important;
        }

        #nhp-creaty-session-card.nhp-minimized::before {
            content: "👤";
            font-size: 16px;
        }

        .nhp-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: rgba(15, 23, 42, 0.3);
            border-bottom: 1px solid rgba(74, 222, 128, 0.15);
            cursor: move;
            user-select: none;
        }

        .nhp-card-title {
            font-weight: 700;
            font-size: 13px;
            color: #4ade80;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .nhp-card-controls {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .nhp-control-btn {
            background: none;
            border: none;
            color: #94a3b8;
            padding: 4px;
            border-radius: 6px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
        }

        .nhp-control-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
        }

        .nhp-control-btn.nhp-close:hover {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
        }

        .nhp-card-tabs {
            display: flex;
            background: rgba(15, 23, 42, 0.3);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .nhp-tab-btn {
            flex: 1;
            background: none;
            border: none;
            color: #94a3b8;
            padding: 8px 4px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
            border-bottom: 2px solid transparent;
        }

        .nhp-tab-btn:hover {
            color: #e2e8f0;
            background: rgba(255, 255, 255, 0.02);
        }

        .nhp-tab-btn.active {
            color: #4ade80;
            border-bottom-color: #4ade80;
            background: rgba(74, 222, 128, 0.05);
        }

        .nhp-card-body {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }

        .nhp-card-tab-content {
            display: none;
        }

        .nhp-card-tab-content.active {
            display: block;
        }

        .nhp-card-row {
            margin-bottom: 10px;
        }

        .nhp-card-row-label {
            font-size: 10.5px;
            color: #94a3b8;
            margin-bottom: 3px;
            font-weight: 600;
        }

        .nhp-card-row-val-wrap {
            display: flex;
            background: rgba(15, 23, 42, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 8px;
            overflow: hidden;
            align-items: center;
        }

        .nhp-card-row-val {
            flex: 1;
            padding: 6px 10px;
            font-family: inherit;
            color: #e2e8f0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            user-select: text;
        }

        .nhp-card-row-val.nhp-bio {
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            height: 52px;
            overflow-y: auto;
        }

        .nhp-row-actions {
            display: flex;
            border-right: 1px solid rgba(255, 255, 255, 0.06);
        }

        .nhp-action-btn {
            background: none;
            border: none;
            color: #a5b4fc;
            padding: 6px 8px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
        }

        .nhp-action-btn:hover {
            background: rgba(99, 102, 241, 0.15);
            color: #ffffff;
        }

        .nhp-action-btn.nhp-copied {
            color: #34d399 !important;
            background: rgba(52, 211, 153, 0.15) !important;
        }

        .nhp-action-btn.nhp-injecting {
            color: #22d3ee !important;
            background: rgba(34, 211, 238, 0.15) !important;
            animation: nhp-pulse 1.5s infinite;
        }

        @keyframes nhp-pulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
        }

        .nhp-image-gallery {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 5px;
        }

        .nhp-image-card {
            background: rgba(15, 23, 42, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 8px;
            padding: 6px;
            text-align: center;
        }

        .nhp-image-thumb-wrap {
            width: 100%;
            height: 90px;
            border-radius: 6px;
            overflow: hidden;
            background: rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 5px;
            position: relative;
        }

        .nhp-image-thumb {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        .nhp-image-empty {
            font-size: 10px;
            color: #64748b;
        }

        .nhp-image-actions {
            display: flex;
            justify-content: center;
            gap: 4px;
        }

        .nhp-image-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 4px;
            color: #cbd5e1;
            padding: 3px 6px;
            font-size: 10px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 3px;
        }

        .nhp-image-btn:hover {
            background: rgba(74, 222, 128, 0.2);
            border-color: rgba(74, 222, 128, 0.4);
            color: #ffffff;
        }

        /* AI Tab Styles */
        .nhp-ai-form {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .nhp-ai-input {
            width: 100%;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(74, 222, 128, 0.3);
            border-radius: 8px;
            color: #ffffff;
            padding: 8px 10px;
            font-size: 12px;
            outline: none;
            text-align: right;
            transition: border-color 0.15s ease;
        }

        .nhp-ai-input:focus {
            border-color: #4ade80;
        }

        .nhp-ai-checkbox-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            user-select: none;
            font-size: 11.5px;
            color: #cbd5e1;
        }

        .nhp-ai-checkbox {
            margin: 0;
            accent-color: #4ade80;
            cursor: pointer;
        }

        .nhp-ai-btn {
            width: 100%;
            background: linear-gradient(135deg, #15803d 0%, #06b6d4 100%);
            border: none;
            border-radius: 8px;
            color: #ffffff;
            padding: 9px 12px;
            font-weight: 700;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: transform 0.1s ease, filter 0.2s ease;
            box-shadow: 0 4px 12px rgba(21, 128, 61, 0.3);
        }

        .nhp-ai-btn:hover {
            filter: brightness(1.1);
        }

        .nhp-ai-btn:active {
            transform: scale(0.98);
        }

        .nhp-ai-btn:disabled {
            background: #334155;
            color: #64748b;
            cursor: not-allowed;
            box-shadow: none;
        }

        /* Spinner rotation */
        .nhp-spinner {
            animation: nhp-spin 0.8s linear infinite;
        }

        @keyframes nhp-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(-360deg); }
        }

        /* Injection overlay banner */
        #nhp-injection-banner {
            position: fixed;
            top: 15px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2147483647;
            background: rgba(22, 78, 99, 0.9);
            border: 1px solid #0891b2;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
            padding: 8px 18px;
            border-radius: 20px;
            color: #ecfeff;
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 12px;
            direction: rtl;
            pointer-events: auto;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            animation: nhp-slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes nhp-slide-down {
            from { transform: translate(-50%, -30px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }

        .nhp-injection-cancel {
            background: #ef4444;
            border: none;
            color: #ffffff;
            border-radius: 12px;
            padding: 2px 8px;
            font-size: 10px;
            cursor: pointer;
            font-weight: 700;
        }

        .nhp-injection-cancel:hover {
            background: #dc2626;
        }
    `;

    // Inject styles into page
    function injectStyles() {
        const styleId = 'nhp-creaty-session-card-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    // Handle session info storage loading
    function loadSessionAndRender() {
        chrome.storage.local.get(STORAGE_KEY, (data) => {
            const info = data[STORAGE_KEY];
            if (info && info.showSessionCard) {
                sessionInfo = info;
                injectStyles();
                renderCard();
            } else if (cardElement) {
                cardElement.remove();
                cardElement = null;
            }
        });
    }

    // Set up dragging listeners
    function initDragging(header) {
        header.addEventListener('mousedown', (e) => {
            if (cardElement.classList.contains('nhp-minimized')) return;
            // Ignore if clicking buttons inside header
            if (e.target.closest('.nhp-control-btn')) return;

            isDragging = true;
            dragOffset.x = e.clientX - cardElement.offsetLeft;
            dragOffset.y = e.clientY - cardElement.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });

        function onMouseMove(e) {
            if (!isDragging) return;
            let left = e.clientX - dragOffset.x;
            let top = e.clientY - dragOffset.y;

            // Restrict bounds
            const maxLeft = window.innerWidth - cardElement.offsetWidth - 10;
            const maxTop = window.innerHeight - cardElement.offsetHeight - 10;
            left = Math.max(10, Math.min(left, maxLeft));
            top = Math.max(10, Math.min(top, maxTop));

            cardElement.style.left = left + 'px';
            cardElement.style.top = top + 'px';
            cardElement.style.right = 'auto';
            cardElement.style.bottom = 'auto';
        }

        function onMouseUp() {
            if (isDragging) {
                isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                // Save position
                const pos = { left: cardElement.style.left, top: cardElement.style.top };
                sessionStorage.setItem(POSITION_KEY, JSON.stringify(pos));
            }
        }
    }

    // Clipboard Copy Helper
    function copyText(text, btn) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            btn.classList.add('nhp-copied');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '✓';
            setTimeout(() => {
                btn.classList.remove('nhp-copied');
                btn.innerHTML = originalHtml;
            }, 1200);
        }).catch((err) => {
            console.error('Failed to copy:', err);
        });
    }

    // Clipboard Image Copy Helper
    function copyImageToClipboard(dataUrl, btn) {
        if (!dataUrl) return;
        fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
                navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                ]).then(() => {
                    const originalText = btn.textContent;
                    btn.textContent = '✓ نسخ!';
                    setTimeout(() => { btn.textContent = originalText; }, 1200);
                });
            })
            .catch(err => console.error('Image copy failed:', err));
    }

    // Image Downloader
    function downloadImage(dataUrl, filename) {
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // Injection Mode toggle
    function startInjection(value, label, btn) {
        if (activeInjectionValue === value) {
            stopInjection();
            return;
        }

        // Reset previous buttons
        document.querySelectorAll('.nhp-action-btn.nhp-injecting').forEach(b => {
            b.classList.remove('nhp-injecting');
        });

        activeInjectionValue = value;
        activeInjectionLabel = label;
        btn.classList.add('nhp-injecting');
        document.body.style.cursor = 'crosshair';

        renderInjectionBanner();
    }

    function stopInjection() {
        activeInjectionValue = null;
        activeInjectionLabel = '';
        document.body.style.cursor = '';
        
        document.querySelectorAll('.nhp-action-btn.nhp-injecting').forEach(b => {
            b.classList.remove('nhp-injecting');
        });

        if (injectionOverlay) {
            injectionOverlay.remove();
            injectionOverlay = null;
        }
    }

    function renderInjectionBanner() {
        if (injectionOverlay) injectionOverlay.remove();

        injectionOverlay = document.createElement('div');
        injectionOverlay.id = 'nhp-injection-banner';
        injectionOverlay.innerHTML = `
            <span>وضع الحقن نشط لقيمة: <strong style="color: #67e8f9;">${activeInjectionLabel}</strong>. انقر فوق حقل إدخال لحقن القيمة...</span>
            <button class="nhp-injection-cancel">إلغاء</button>
        `;
        
        injectionOverlay.querySelector('.nhp-injection-cancel').addEventListener('click', (e) => {
            e.stopPropagation();
            stopInjection();
        });

        document.body.appendChild(injectionOverlay);
    }

    // Render HTML card
    function renderCard() {
        if (!sessionInfo) return;

        let card = document.getElementById('nhp-creaty-session-card');
        if (!card) {
            card = document.createElement('div');
            card.id = 'nhp-creaty-session-card';
            document.body.appendChild(card);
            cardElement = card;

            // Restore minimized state if saved
            const isMin = sessionStorage.getItem(MINIMIZED_KEY) === 'true';
            if (isMin) {
                card.classList.add('nhp-minimized');
            }

            updateCardPosition();
            startPositionTracking();
        }

        const profile = sessionInfo.storeProfile || {};
        const links = profile.links || {};

        card.innerHTML = `
            <!-- Header -->
            <div class="nhp-card-header">
                <div class="nhp-card-title">${SVG_DRAG} جلسة حساب Creaty</div>
                <div class="nhp-card-controls">
                    <button class="nhp-control-btn nhp-minimize" title="تصغير">${SVG_MINIMIZE}</button>
                    <button class="nhp-control-btn nhp-close" title="إغلاق الجلسة">${SVG_CLOSE}</button>
                </div>
            </div>

            <!-- Tabs -->
            <div class="nhp-card-tabs">
                <button class="nhp-tab-btn active" data-tab="account">الحساب</button>
                <button class="nhp-tab-btn" data-tab="store">المتجر</button>
                <button class="nhp-tab-btn" data-tab="assets">الروابط والصور</button>
                <button class="nhp-tab-btn" data-tab="ai" style="display: flex; align-items: center; justify-content: center; gap: 3px;">
                    ${SVG_SPARKLES} توليد الذكاء
                </button>
            </div>

            <!-- Body -->
            <div class="nhp-card-body">
                <!-- Tab: Account -->
                <div class="nhp-card-tab-content active" id="nhp-tab-account">
                    ${renderRow('البريد الإلكتروني', sessionInfo.email)}
                    ${renderRow('كلمة المرور', sessionInfo.password)}
                    ${renderRow('الاسم الأول', sessionInfo.firstName)}
                    ${renderRow('الاسم الأخير', sessionInfo.lastName)}
                </div>

                <!-- Tab: Store Details -->
                <div class="nhp-card-tab-content" id="nhp-tab-store">
                    ${renderRow('اسم المتجر', profile.title || '')}
                    ${renderRow('النيش', profile.niche || '')}
                    ${renderRow('الوصف السيرة الذاتية', profile.bio || '', true)}
                </div>

                <!-- Tab: Assets -->
                <div class="nhp-card-tab-content" id="nhp-tab-assets">
                    <div style="font-weight: 700; font-size: 11px; margin-bottom: 5px; color: #818cf8;">روابط التواصل الاجتماعي:</div>
                    ${renderRow('بنترست', links.pinterest || '')}
                    ${renderRow('انستغرام', links.instagram || '')}
                    ${renderRow('تويتر', links.twitter || '')}
                    ${renderRow('فيسبوك', links.facebook || '')}

                    <div style="font-weight: 700; font-size: 11px; margin: 10px 0 5px 0; color: #818cf8;">الصور المولدة:</div>
                    <div class="nhp-image-gallery">
                        <div class="nhp-image-card">
                            <div class="nhp-image-thumb-wrap">
                                ${profile.avatarDataUrl 
                                    ? `<img src="${profile.avatarDataUrl}" class="nhp-image-thumb" />` 
                                    : `<span class="nhp-image-empty">لا يوجد صورة (Avatar)</span>`}
                            </div>
                            <div class="nhp-image-actions">
                                <button class="nhp-image-btn nhp-copy-img" data-type="avatar" ${profile.avatarDataUrl ? '' : 'disabled'}>نسخ</button>
                                <button class="nhp-image-btn nhp-dl-img" data-type="avatar" ${profile.avatarDataUrl ? '' : 'disabled'}>تحميل</button>
                            </div>
                        </div>
                        <div class="nhp-image-card">
                            <div class="nhp-image-thumb-wrap">
                                ${profile.coverDataUrl 
                                    ? `<img src="${profile.coverDataUrl}" class="nhp-image-thumb" />` 
                                    : `<span class="nhp-image-empty">لا يوجد غلاف (Banner)</span>`}
                            </div>
                            <div class="nhp-image-actions">
                                <button class="nhp-image-btn nhp-copy-img" data-type="cover" ${profile.coverDataUrl ? '' : 'disabled'}>نسخ</button>
                                <button class="nhp-image-btn nhp-dl-img" data-type="cover" ${profile.coverDataUrl ? '' : 'disabled'}>تحميل</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tab: AI -->
                <div class="nhp-card-tab-content" id="nhp-tab-ai">
                    <div class="nhp-ai-form">
                        <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">توليد هوية متجر جديدة بالذكاء الاصطناعي:</div>
                        <input type="text" class="nhp-ai-input" id="nhp-ai-niche" placeholder="النيش (مثال: Cute cats, retro gaming...)" value="${profile.niche || ''}" />
                        
                        <label class="nhp-ai-checkbox-wrap">
                            <input type="checkbox" class="nhp-ai-checkbox" id="nhp-ai-images" checked />
                            <span>توليد صور المتجر (Avatar & Banner)</span>
                        </label>

                        <button type="button" class="nhp-ai-btn" id="nhp-ai-generate">
                            ${SVG_SPARKLES} توليد الهوية
                        </button>
                        <div id="nhp-ai-status" style="font-size: 11px; color: #a5b4fc; text-align: center; margin-top: 3px; display: none;">
                            جاري توليد الهوية بالذكاء الاصطناعي...
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Register drag handle
        initDragging(card.querySelector('.nhp-card-header'));

        // Register minimization toggle
        card.querySelector('.nhp-minimize').addEventListener('click', (e) => {
            e.stopPropagation();
            card.classList.add('nhp-minimized');
            sessionStorage.setItem(MINIMIZED_KEY, 'true');
        });

        card.addEventListener('click', (e) => {
            if (card.classList.contains('nhp-minimized')) {
                card.classList.remove('nhp-minimized');
                sessionStorage.setItem(MINIMIZED_KEY, 'false');
            }
        });

        // Close/Exit session card
        card.querySelector('.nhp-close').addEventListener('click', (e) => {
            e.stopPropagation();
            stopInjection();
            stopPositionTracking();
            chrome.storage.local.remove(STORAGE_KEY, () => {
                card.remove();
                cardElement = null;
            });
        });

        // Tab switches
        card.querySelectorAll('.nhp-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                card.querySelectorAll('.nhp-tab-btn').forEach(b => b.classList.remove('active'));
                card.querySelectorAll('.nhp-card-tab-content').forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                card.querySelector(`#nhp-tab-${btn.dataset.tab}`).classList.add('active');
            });
        });

        // Bind copy and inject click listeners inside tabs
        card.querySelectorAll('.nhp-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = decodeURIComponent(btn.dataset.val);
                const label = btn.dataset.label;
                if (btn.classList.contains('nhp-copy')) {
                    copyText(value, btn);
                } else if (btn.classList.contains('nhp-inject')) {
                    startInjection(value, label, btn);
                }
            });
        });

        // Bind image actions
        card.querySelectorAll('.nhp-copy-img').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = btn.dataset.type;
                const dataUrl = type === 'avatar' ? profile.avatarDataUrl : profile.coverDataUrl;
                copyImageToClipboard(dataUrl, btn);
            });
        });

        card.querySelectorAll('.nhp-dl-img').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = btn.dataset.type;
                const dataUrl = type === 'avatar' ? profile.avatarDataUrl : profile.coverDataUrl;
                downloadImage(dataUrl, `${sessionInfo.email}_${type}.png`);
            });
        });

        // Bind AI generation
        const generateBtn = card.querySelector('#nhp-ai-generate');
        if (generateBtn) {
            generateBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const nicheInput = card.querySelector('#nhp-ai-niche');
                const imagesCheckbox = card.querySelector('#nhp-ai-images');
                const statusDiv = card.querySelector('#nhp-ai-status');

                const nicheVal = nicheInput.value.trim();
                const includeImages = imagesCheckbox.checked;

                generateBtn.disabled = true;
                generateBtn.innerHTML = `${SVG_SPINNER} جاري التوليد...`;
                statusDiv.style.display = 'block';

                chrome.runtime.sendMessage({
                    action: 'CREATY_GENERATE_STORE',
                    accountEmail: sessionInfo.email,
                    email: sessionInfo.email,
                    niche: nicheVal,
                    includeImages: includeImages
                }, (response) => {
                    if (response && response.success && response.profile) {
                        const newProfile = response.profile;
                        
                        // Save generated profile
                        chrome.runtime.sendMessage({
                            action: 'CREATY_SAVE_STORE_PROFILE',
                            email: sessionInfo.email,
                            accountEmail: sessionInfo.email,
                            profile: newProfile
                        }, (saveResponse) => {
                            sessionInfo.storeProfile = newProfile;
                            chrome.storage.local.set({ [STORAGE_KEY]: sessionInfo }, () => {
                                renderCard();
                            });
                        });
                    } else {
                        generateBtn.disabled = false;
                        generateBtn.innerHTML = `${SVG_SPARKLES} توليد الهوية`;
                        statusDiv.style.display = 'none';
                        alert('فشل توليد الهوية بالذكاء الاصطناعي: ' + (response?.error || 'خطأ غير معروف'));
                    }
                });
            });
        }
    }

    function renderRow(label, value, isBio = false) {
        if (!value) value = '';
        const encodedVal = encodeURIComponent(value);
        return `
            <div class="nhp-card-row">
                <div class="nhp-card-row-label">${label}</div>
                <div class="nhp-card-row-val-wrap">
                    <div class="nhp-card-row-val ${isBio ? 'nhp-bio' : ''}">${value || '<span style="color: #64748b; font-style: italic;">فارغ</span>'}</div>
                    ${value ? `
                        <div class="nhp-row-actions">
                            <button type="button" class="nhp-action-btn nhp-copy" data-val="${encodedVal}" title="نسخ إلى الحافظة">${SVG_COPY}</button>
                            <button type="button" class="nhp-action-btn nhp-inject" data-val="${encodedVal}" data-label="${label}" title="حقن في حقل">{..}</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Intercept page clicks for Direct Injection (Capture phase)
    document.addEventListener('click', (e) => {
        if (activeInjectionValue === null) return;

        // Verify if target is an input field
        const target = e.target.closest('input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]');
        if (target) {
            e.preventDefault();
            e.stopPropagation();

            if (target.isContentEditable) {
                target.innerText = activeInjectionValue;
            } else {
                target.value = activeInjectionValue;
            }

            // Dispatch input and change events for framework reconciliation (React/Angular/etc)
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));

            // Force focus and blur to run target validators
            target.focus();
            setTimeout(() => {
                target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
                target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
                target.blur();
            }, 100);

            stopInjection();
        } else {
            // Cancel injection if clicked outside input & not on the overlay itself
            if (!e.target.closest('#nhp-creaty-session-card') && !e.target.closest('#nhp-injection-banner')) {
                stopInjection();
            }
        }
    }, true); // Capture phase is critical!

    // Parse URL Hash Session Data (Robust handshake)
    function parseUrlHashAndSave() {
        if (location.hash && location.hash.includes('nhp-session=')) {
            try {
                const index = location.hash.indexOf('nhp-session=');
                const raw = decodeURIComponent(location.hash.substring(index + 'nhp-session='.length));
                const data = JSON.parse(raw);
                if (data && data.showSessionCard) {
                    chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
                        // Clear the hash from the address bar
                        try {
                            const cleanUrl = window.location.pathname + window.location.search;
                            history.replaceState("", document.title, cleanUrl);
                        } catch (_) {}

                        // Request store details dynamically from the background script
                        chrome.runtime.sendMessage({
                            action: 'CREATY_LOAD_STORE_PROFILE',
                            email: data.email
                        }, (response) => {
                            if (response && response.success && response.profile) {
                                data.storeProfile = response.profile;
                                chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
                                    loadSessionAndRender();
                                });
                            } else {
                                loadSessionAndRender();
                            }
                        });
                    });
                }
            } catch (err) {
                console.error('[CREATY] Failed to parse URL hash session:', err);
            }
        }
    }

    // Automatically dock the card under the badge
    function updateCardPosition() {
        if (!cardElement) return;

        // If user is actively dragging, don't override
        if (isDragging) return;

        const overlay = document.getElementById('nhp-creaty-overlay');
        if (overlay) {
            const rect = overlay.getBoundingClientRect();
            cardElement.style.top = (rect.bottom + 6) + 'px';
            cardElement.style.right = '12px';
            cardElement.style.left = 'auto';
            cardElement.style.bottom = 'auto';
            cardElement.style.width = '320px';
        } else {
            // Default position if no overlay
            const savedPos = sessionStorage.getItem(POSITION_KEY);
            if (savedPos) {
                try {
                    const pos = JSON.parse(savedPos);
                    cardElement.style.left = pos.left;
                    cardElement.style.top = pos.top;
                    cardElement.style.right = 'auto';
                    cardElement.style.bottom = 'auto';
                    return;
                } catch (_) {}
            }
            cardElement.style.top = '58px';
            cardElement.style.right = '12px';
            cardElement.style.left = 'auto';
            cardElement.style.bottom = 'auto';
            cardElement.style.width = '320px';
        }
    }

    // Start position tracking timer
    let positionTimer = null;
    function startPositionTracking() {
        if (positionTimer) clearInterval(positionTimer);
        positionTimer = setInterval(updateCardPosition, 250);
    }

    function stopPositionTracking() {
        if (positionTimer) {
            clearInterval(positionTimer);
            positionTimer = null;
        }
    }

    let loggedNoActiveSession = false;

    function queryActiveSessionFromServer() {
        chrome.runtime.sendMessage({ action: 'CREATY_GET_ACTIVE_SESSION_CARD' }, (response) => {
            if (response && response.success && response.session) {
                loggedNoActiveSession = false;
                const data = response.session;
                chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
                    sessionInfo = data;
                    
                    // Request store details dynamically from the background script
                    chrome.runtime.sendMessage({
                        action: 'CREATY_LOAD_STORE_PROFILE',
                        email: data.email
                    }, (profileRes) => {
                        if (profileRes && profileRes.success && profileRes.profile) {
                            sessionInfo.storeProfile = profileRes.profile;
                            chrome.storage.local.set({ [STORAGE_KEY]: sessionInfo }, () => {
                                loadSessionAndRender();
                            });
                        } else {
                            loadSessionAndRender();
                        }
                    });
                });
            } else if (!loggedNoActiveSession) {
                loggedNoActiveSession = true;
                console.debug('[CREATY-CARD] No active CREATY session (extension not connected)');
            }
        });
    }

    // Set up handshake listeners for page context (Fallback)
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NHP_RESPONSE_SESSION_INFO') {
            const info = event.data.detail;
            if (info && info.showSessionCard) {
                chrome.storage.local.get(STORAGE_KEY, (stored) => {
                    const current = stored[STORAGE_KEY];
                    if (!current || current.email !== info.email || JSON.stringify(current.storeProfile) !== JSON.stringify(info.storeProfile)) {
                        chrome.storage.local.set({ [STORAGE_KEY]: info }, () => {
                            loadSessionAndRender();
                        });
                    }
                });
            }
        }
        if (event.source !== window || !event.data || event.data.type !== 'NHP_CREATY_SESSION_BRIDGE_REQUEST') {
            return;
        }
        const requestId = String(event.data.requestId || '').trim();
        const action = String(event.data.action || '').trim();
        const payload = event.data.payload && typeof event.data.payload === 'object' ? event.data.payload : {};
        if (!requestId || !action) return;

        const reply = (response) => {
            window.postMessage({
                type: 'NHP_CREATY_SESSION_BRIDGE_RESPONSE',
                requestId,
                action,
                response,
            }, '*');
        };

        if (action === 'load_profile') {
            chrome.runtime.sendMessage({
                action: 'CREATY_LOAD_STORE_PROFILE',
                accountEmail: payload.email,
                email: payload.email,
            }, (response) => reply(response || { success: false, error: 'empty_response' }));
            return;
        }

        if (action === 'generate_store') {
            chrome.runtime.sendMessage({
                action: 'CREATY_GENERATE_STORE',
                accountEmail: payload.email,
                email: payload.email,
                niche: payload.niche || '',
                includeImages: payload.includeImages !== false,
            }, (response) => reply(response || { success: false, error: 'empty_response' }));
            return;
        }

        if (action === 'save_profile') {
            chrome.runtime.sendMessage({
                action: 'CREATY_SAVE_STORE_PROFILE',
                accountEmail: payload.email,
                email: payload.email,
                profile: payload.profile || {},
            }, (response) => {
                if (response?.success && sessionInfo && String(sessionInfo.email || '').trim().toLowerCase() === String(payload.email || '').trim().toLowerCase()) {
                    sessionInfo.storeProfile = response.profile || payload.profile || {};
                    const syncPayload = {
                        email: String(payload.email || '').trim(),
                        profile: sessionInfo.storeProfile,
                        ts: Date.now(),
                    };
                    chrome.storage.local.set({
                        [STORAGE_KEY]: sessionInfo,
                        [PROFILE_SYNC_KEY]: syncPayload,
                    }, () => {
                        try {
                            chrome.runtime.sendMessage({
                                action: 'CREATY_STORE_PROFILE_SAVED',
                                email: syncPayload.email,
                                profile: syncPayload.profile,
                                ts: syncPayload.ts,
                                log: `Store profile synced: ${syncPayload.email}`,
                            });
                        } catch (_) {}
                        reply(response);
                    });
                    return;
                }
                reply(response || { success: false, error: 'empty_response' });
            });
        }
    });

    // Listen for local storage changes (in case state is modified by other pages/popup)
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[STORAGE_KEY]) {
            loadSessionAndRender();
        }
    });

    // Initial load sequence
    parseUrlHashAndSave();
    loadSessionAndRender();
    queryActiveSessionFromServer();

    // Trigger initial handshake request to the page context
    window.postMessage({ type: 'nhp-request-session-info' }, '*');
})();
