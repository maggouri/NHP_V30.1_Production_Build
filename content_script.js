/**
 * Content Script - USPTO Niche Checker Pro
 * يُزرع هذا السكريبت داخل صفحة USPTO تلقائياً.
 * يُبلّغ الـ background عند اكتمال التحميل.
 */

(function () {
    'use strict';

    // Prevent running inside hidden TeePublic iframes (analytics, ads, Auth)
    if (window.top !== window.self) return;

    // أعلم الـ background أن الصفحة جاهزة
    function notifyReady() {
        chrome.runtime.sendMessage({ action: 'pageReady', url: window.location.href }).catch(() => { });
    }

    // عند اكتمال تحميل DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { notifyReady(); });
    } else {
        notifyReady();
    }

    // Inject floating UI tracker element with Progress Bar
    function updateOnPageTracker(msg, progress = -1) {
        if (!window.location.hostname.includes('teepublic') && !window.location.hostname.includes('facebook') && !window.location.hostname.includes('redbubble')) return;
        let tracker = document.getElementById('nh-progress-tracker');
        if (!tracker) {
            tracker = document.createElement('div');
            tracker.id = 'nh-progress-tracker';
            tracker.style.cssText = 'position:fixed; bottom:30px; left:30px; z-index:2147483647; background:rgba(18, 18, 23, 0.98); color:#fff; padding:20px; border-radius:15px; font-family:"Inter", "Roboto", "Segoe UI", sans-serif; direction:rtl; box-shadow:0 15px-40px rgba(0,0,0,0.7); border:1px solid #6366f1; min-width:300px; backdrop-filter:blur(10px); border-left:5px solid #6366f1; transition:all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);';
            document.body.appendChild(tracker);
        }

        let progressHtml = '';
        if (progress >= 0) {
            progressHtml = `<div style="width:100%; height:8px; background:#2d2d3a; border-radius:10px; margin-top:10px; overflow:hidden;">
                <div style="width:${progress}%; height:100%; background:linear-gradient(90deg, #6366f1, #a855f7); transition:width 0.5s ease;"></div>
            </div>`;
        }

        tracker.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:5px;">
                <div style="width:10px; height:10px; background:#6366f1; border-radius:50%; box-shadow:0 0 10px #6366f1; animation:pulseNH 1.5s infinite;"></div>
                <span style="font-size:12px; opacity:0.7; letter-spacing:1px; color:#a855f7;">NICHE HUNTER PRO</span>
            </div>
            <div style="font-size:15px; font-weight:600; color:#eff1f5;">${msg}</div>
            ${progressHtml}
            <style>
                @keyframes pulseNH { 0% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(1.2); } 100% { opacity:1; transform:scale(1); } }
            </style>
        `;
    }

    // Inject robust MAIN world script to bypass React's event pooling and isolated world restrictions
    function injectMainWorldScript() {
        if (document.getElementById('nh-main-script')) return;
        const script = document.createElement('script');
        script.id = 'nh-main-script';
        script.src = chrome.runtime.getURL('main_inject.js');
        document.documentElement.appendChild(script);
    }
    injectMainWorldScript();

    const teePublicUploadState = {
        active: false,
        jobId: null,
        status: 'idle',
        phase: 'idle',
        startedAt: 0,
        updatedAt: 0,
        title: '',
        lastError: '',
        lastCompletedJobId: null,
        lastFailedJobId: null
    };

    function buildTeePublicJobId(req = {}) {
        if (req.jobId) return String(req.jobId);
        const base = String(req.title || req.main_tag || 'teepublic-job')
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40) || 'teepublic-job';
        return `${base}-${Date.now()}`;
    }

    function setTeePublicUploadState(patch = {}) {
        Object.assign(teePublicUploadState, patch, { updatedAt: Date.now() });
    }

    function startTeePublicUploadJob(jobId, req = {}) {
        setTeePublicUploadState({
            active: true,
            jobId,
            status: 'in_progress',
            phase: 'received',
            startedAt: Date.now(),
            title: String(req.title || '').slice(0, 120),
            lastError: ''
        });
        try {
            chrome.storage.local.set({ tpReadyForNext: false, tpActiveUploadJobId: jobId, tpLastUploadJobId: null });
        } catch (_) { }
    }

    function setTeePublicUploadPhase(jobId, phase, status = 'in_progress', extra = {}) {
        if (teePublicUploadState.jobId !== jobId) return;
        setTeePublicUploadState({ phase, status, ...extra });
    }

    function completeTeePublicUploadJob(jobId, phase = 'completed', extra = {}) {
        if (teePublicUploadState.jobId !== jobId && teePublicUploadState.lastCompletedJobId !== jobId) return;
        setTeePublicUploadState({
            active: false,
            jobId,
            status: 'completed',
            phase,
            lastCompletedJobId: jobId,
            lastError: '',
            ...extra
        });
    }

    function failTeePublicUploadJob(jobId, error) {
        const message = error?.message || String(error || 'Unknown upload error');
        setTeePublicUploadState({
            active: false,
            jobId,
            status: 'failed',
            phase: 'failed',
            lastFailedJobId: jobId,
            lastError: message
        });
    }

    function getTeePublicUploadStatus(jobId) {
        if (jobId) {
            if (teePublicUploadState.jobId === jobId) {
                return { ...teePublicUploadState };
            }
            if (teePublicUploadState.lastCompletedJobId === jobId) {
                return {
                    active: false,
                    jobId,
                    status: 'completed',
                    phase: 'completed',
                    startedAt: teePublicUploadState.startedAt,
                    updatedAt: teePublicUploadState.updatedAt,
                    lastError: ''
                };
            }
            if (teePublicUploadState.lastFailedJobId === jobId) {
                return {
                    active: false,
                    jobId,
                    status: 'failed',
                    phase: 'failed',
                    startedAt: teePublicUploadState.startedAt,
                    updatedAt: teePublicUploadState.updatedAt,
                    lastError: teePublicUploadState.lastError || 'Upload failed'
                };
            }
            if (teePublicUploadState.active && teePublicUploadState.jobId !== jobId) {
                return {
                    active: true,
                    jobId: teePublicUploadState.jobId,
                    status: 'busy',
                    phase: teePublicUploadState.phase,
                    startedAt: teePublicUploadState.startedAt,
                    updatedAt: teePublicUploadState.updatedAt,
                    lastError: teePublicUploadState.lastError || ''
                };
            }
            return {
                active: false,
                jobId,
                status: 'idle',
                phase: 'idle',
                startedAt: 0,
                updatedAt: teePublicUploadState.updatedAt || 0,
                lastError: ''
            };
        }

        return { ...teePublicUploadState };
    }

    // استماع لرسائل تعبئة فورم أو إدارة الجلسات في TeePublic
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        if (req.action === 'tp_upload_status') {
            sendResponse(getTeePublicUploadStatus(req.jobId ? String(req.jobId) : null));
            return true;
        }

        if (req.action === 'tp_fill_form') {
            const jobId = buildTeePublicJobId(req);
            const safeTitle = String(req.title || '').substring(0, 20);

            if (teePublicUploadState.active && teePublicUploadState.jobId === jobId) {
                sendResponse({ status: 'in_progress', jobId, phase: teePublicUploadState.phase });
                return true;
            }

            if (teePublicUploadState.active && teePublicUploadState.jobId !== jobId) {
                sendResponse({ status: 'busy', jobId: teePublicUploadState.jobId, phase: teePublicUploadState.phase });
                return true;
            }

            if (teePublicUploadState.lastCompletedJobId === jobId) {
                sendResponse({ status: 'already_completed', jobId, phase: 'completed' });
                return true;
            }

            startTeePublicUploadJob(jobId, req);
            updateOnPageTracker(`📤 جاري معالجة التصميم: ${safeTitle || 'بدون عنوان'}...`, 50);

            // استدعاء دالة التعبئة والرفع الحقيقية
            fillTeePublicForm({ ...req, jobId }).then(() => {
                if (teePublicUploadState.jobId === jobId && teePublicUploadState.status === 'in_progress') {
                    completeTeePublicUploadJob(jobId, 'completed');
                }
                updateOnPageTracker(`✅ تم تعبئة البيانات والرفع بنجاح!`, 100);
            }).catch(err => {
                console.error("Fill Error:", err);
                failTeePublicUploadJob(jobId, err);
                updateOnPageTracker(`❌ خطأ في التعبئة: ${err.message}`, -1);
            });

            sendResponse({ status: 'started', jobId, phase: 'received' });
            return true;
        }

        if (req.action === 'tp_auto_auth') {
            handleTeePublicAuth(req).then(res => {
                sendResponse(res);
            });
            return true; // Keep channel open for async response
        }
    });

    async function handleTeePublicAuth(data) {
        const { email, pass } = data;
        const delay = ms => new Promise(r => setTimeout(r, ms));

        // 1. Check if on sign_out - if so, we are already logout, NH should handle next step
        if (window.location.href.includes('/sign_out')) {
            return { status: 'logged_out_success' };
        }

        // 2. Check for login form
        const emailInput = document.querySelector('#user_email, input[type="email"], input[name*="email"]');
        const passInput = document.querySelector('#user_password, input[type="password"], input[name*="password"]');

        if (emailInput && passInput) {
            updateOnPageTracker(`🔐 جاري تسجيل الدخول لـ ${email}...`, 30);

            emailInput.focus();
            emailInput.value = email;
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            emailInput.dispatchEvent(new Event('change', { bubbles: true }));

            await delay(1000);
            updateOnPageTracker(`🔑 إدخال كلمة المرور...`, 60);

            passInput.focus();
            passInput.value = pass;
            passInput.dispatchEvent(new Event('input', { bubbles: true }));
            passInput.dispatchEvent(new Event('change', { bubbles: true }));

            await delay(1200);
            const submitBtn = document.querySelector('#login, button[type="submit"], .btn-login, #login_btn');
            if (submitBtn) {
                updateOnPageTracker(`🚀 جاري الضغط على زر الدخول...`, 90);
                submitBtn.focus();
                submitBtn.click();
            }
            return { status: 'logging_in' };
        }

        return { status: 'form_not_found', currentUrl: window.location.href };
    }

    async function fillTeePublicForm(data) {
        const delay = ms => new Promise(res => setTimeout(res, ms));
        const uploadInputSelector = '.jsUploaderFileInput, input[type="file"], .m-uploader__dropzone-input';
        const uploadDropzoneSelector = '.jsUploaderDropzone, .m-uploader__dropzone, .dropzone, [data-upload-zone]';
        const jobId = data.jobId ? String(data.jobId) : null;
        const markUploadPhase = (phase, status = 'in_progress', extra = {}) => {
            if (!jobId) return;
            setTeePublicUploadPhase(jobId, phase, status, extra);
        };

        async function waitForSelector(selector, timeout = 60000) {
            const el = document.querySelector(selector);
            if (el && (el.offsetWidth > 0 || el.offsetHeight > 0)) return el;

            return new Promise((resolve) => {
                let timerId;
                const observer = new MutationObserver(() => {
                    const el = document.querySelector(selector);
                    if (el && (el.offsetWidth > 0 || el.offsetHeight > 0)) {
                        observer.disconnect();
                        clearTimeout(timerId);
                        resolve(el);
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                timerId = setTimeout(() => {
                    observer.disconnect(); resolve(null);
                }, timeout);
            });
        }

        async function waitForUploadSurface(timeout = 15000) {
            const startedAt = Date.now();
            while ((Date.now() - startedAt) < timeout) {
                const uploadInput = document.querySelector(uploadInputSelector);
                const dropzone = document.querySelector(uploadDropzoneSelector);
                if (uploadInput || dropzone) return { uploadInput, dropzone };
                await delay(500);
            }
            return { uploadInput: null, dropzone: null };
        }

        function createUploadTransfer(cleanBase64) {
            const byteCharacters = atob(cleanBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: "image/png" });
            const file = new File([blob], "design.png", { type: "image/png" });
            const dt = new DataTransfer();
            dt.items.add(file);
            return dt;
        }

        async function executeMainWorldUpload(cleanBase64, timeout = 15000) {
            return new Promise((resolve, reject) => {
                let settled = false;
                let timerId = null;

                const cleanup = () => {
                    if (timerId) clearTimeout(timerId);
                    window.removeEventListener('NH_UPLOAD_SUCCESS', onSuccess);
                    window.removeEventListener('NH_UPLOAD_ERROR', onError);
                };

                const onSuccess = () => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    resolve(true);
                };

                const onError = (event) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    reject(new Error(event?.detail || 'MAIN_WORLD_UPLOAD_FAILED'));
                };

                timerId = setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    reject(new Error('MAIN_WORLD_UPLOAD_TIMEOUT'));
                }, timeout);

                window.addEventListener('NH_UPLOAD_SUCCESS', onSuccess);
                window.addEventListener('NH_UPLOAD_ERROR', onError);
                window.dispatchEvent(new CustomEvent('NH_EXECUTE_UPLOAD', { detail: { base64: cleanBase64 } }));
            });
        }

        async function executeNativeUploadFallback(uploadInput, cleanBase64) {
            if (!uploadInput) throw new Error('UPLOAD_INPUT_NOT_AVAILABLE_FOR_FALLBACK');
            const dt = createUploadTransfer(cleanBase64);
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set;
            if (nativeSetter) {
                nativeSetter.call(uploadInput, dt.files);
            } else {
                uploadInput.files = dt.files;
            }
            uploadInput.dispatchEvent(new Event('input', { bubbles: true }));
            uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function forceValue(selector, value) {
            const el = document.querySelector(selector);
            if (!el) return false;
            el.focus();
            el.value = value;
            const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(el, value);
            else el.value = value;
            el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: value, inputType: 'insertText' }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.blur();
            return true;
        }

        const sendProgress = (msg) => {
            chrome.runtime.sendMessage({ action: 'tp_progress', text: msg }).catch(() => { });
            updateOnPageTracker(`🤖 ${msg}`);
        };

        console.log("[Niche Hunter] Scaling automation engine...");
        markUploadPhase('starting');
        sendProgress('جاري التهيئة ورفع الصورة... 10% ⏳');

        // 1. Image Upload via Drag & Drop simulation (Most reliable for Dropzone-like uploaders)
        if (data.imageData) {
            console.log("[Niche Hunter] Simulating file upload...");
            markUploadPhase('locating_upload_surface');

            const { uploadInput, dropzone } = await waitForUploadSurface(15000);

            if (uploadInput || dropzone) {
                try {
                    const cleanBase64 = data.imageData.includes(',') ? data.imageData.split(',')[1] : data.imageData;

                    let usedFallback = false;
                    try {
                        console.log("[Niche Hunter] Executing upload in MAIN world...");
                        markUploadPhase('uploading_image');
                        await executeMainWorldUpload(cleanBase64, 15000);
                    } catch (err) {
                        console.warn("[Niche Hunter] Main world upload failed, using one fallback path only...", err);
                        await executeNativeUploadFallback(uploadInput, cleanBase64);
                        usedFallback = true;
                    }

                    data.imageData = null;
                    console.log(`[Niche Hunter] Upload signal dispatched${usedFallback ? ' via fallback' : ''}. Waiting for TeePublic to process and show form...`);

                    // تفريغ الذاكرة الضخمة فوراً


                    // MILESTONE 1: Wait for Title field to appear (This shows when upload starts)
                    const titleField = await waitForSelector('input[name="title"], #design_title, #design_design_title', 90000); // 90 seconds for heavy images
                    if (!titleField) {
                        console.error("[Niche Hunter] Milestone 1 Failed: Text fields did not appear.");
                        sendProgress('❌ خطأ: لم تظهر خانات إدخال البيانات (العنوان)');
                        throw new Error('TITLE_FIELDS_NOT_FOUND_AFTER_UPLOAD');
                    }
                    console.log("[Niche Hunter] Milestone 1 Success: Text fields detected!");

                } catch (e) {
                    console.error("Upload dispatcher error:", e);
                }
            } else {
                console.log("[Niche Hunter] Upload input not found on initial pass.");
            }
        }

        // Final verification check for form elements before proceeding
        const finalFormCheck = document.querySelector('input[name="title"], #design_title, #design_design_title');
        if (!finalFormCheck) {
            console.log("[Niche Hunter] Could not start filling text: Form missing.");
            throw new Error('FINAL_FORM_CHECK_FAILED');
        }

        // 2. Text Data
        console.log("[Niche Hunter] Filling text fields...");
        markUploadPhase('filling_metadata');
        sendProgress('جاري كتابة العنوان والوصف والتاجات... 40% ✍️');
        forceValue('input[name="title"], #design_title, #design_design_title', data.title);
        await delay(500);

        forceValue('textarea[name="description"], #design_description, #design_design_description', data.description || data.desc || "");
        await delay(500);

        const mTag = data.main_tag || data.mainTag || (data.tags && data.tags.length > 0 ? (Array.isArray(data.tags) ? data.tags[0] : data.tags.split(',')[0]) : "");
        let finalMainTag = mTag;
        if (finalMainTag && finalMainTag.length > 38) {
            finalMainTag = finalMainTag.substring(0, 38).trim();
        }
        forceValue('input[name="primary_tag"], #design_primary_tag, #primary_tag', finalMainTag);
        await delay(500);

        // Tags - robust clearing and filling
        const tagsInput = document.querySelector('.taggle_input, #design_tags, input[name="tags"]');
        if (tagsInput) {
            // Remove existing tags if any (clear input)
            tagsInput.focus();
            tagsInput.value = '';
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(tagsInput, ''); else tagsInput.value = '';

            const tagsStr = Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || "");
            if (tagsStr) {
                tagsInput.value = tagsStr;
                if (setter) setter.call(tagsInput, tagsStr); else tagsInput.value = tagsStr;
                tagsInput.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: tagsStr, inputType: 'insertText' }));
                tagsInput.dispatchEvent(new Event('input', { bubbles: true }));
                tagsInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            }
            tagsInput.blur();
        }
        await delay(1000);

        // MILESTONE 2: Wait for Color fields/Submit button (This shows when upload FINISHES)
        markUploadPhase('waiting_upload_commit');
        sendProgress('⏳ جاري انتظار اكتمال رفع الملف للوصول لخيارات الألوان... 55% ⏱️');
        const submitBtnSelectors = [
            'button.publish-and-promote-button',
            'button[value="publish" i]',
            '.save-design-btn',
            '#publish-btn'
        ];

        // Wait for ANY of the submit buttons to become visible, which indicates upload completion
        let uploadFinished = false;
        for (let i = 0; i < 90; i++) { // Max 90s wait
            if (submitBtnSelectors.some(sel => {
                const el = document.querySelector(sel);
                return el && (el.offsetWidth > 0 || el.offsetHeight > 0);
            })) {
                uploadFinished = true;
                break;
            }
            if (i % 10 === 0) console.log(`[Niche Hunter] Still waiting for upload completion (${i}s)...`);
            await delay(1000);
        }

        if (!uploadFinished) {
            console.warn("[Niche Hunter] Milestone 2 Failed: Upload took too long or fields never appeared.");
            sendProgress('⚠️ اكتمل ملء النص لكن الألوان لم تظهر بعد. أكمل يدوياً.');
        }

        // 3. Design Options & Mature Content
        console.log("[Niche Hunter] Checking options...");
        markUploadPhase('checking_publish_options');
        sendProgress('الموافقة على الشروط والمحتوى... 60% ✅');
        const matureNo = document.getElementById('design_content_flag_false') || document.querySelector('input[name="mature_content"][value="false"]');
        if (matureNo && !matureNo.checked) matureNo.click();

        const termsCheckbox = document.getElementById('terms') || document.querySelector('#design_tos, input[name*="tos"]');
        if (termsCheckbox && !termsCheckbox.checked) termsCheckbox.click();
        await delay(500);

        // --- Aggressive Color Selection (Framework Aware) ---
        // Sequence: keep products ON → set primary first → tiny delay → then secondary colors.
        // Never click already-selected/primary swatches (TeePublic: "cannot be disabled...primary on other products").
        console.log("[Niche Hunter] Aggressive Color Filling for all products...");
        markUploadPhase('applying_colors');
        sendProgress('جاري اختيار وضبط الألوان الافتراضية للمنتجات... 75% 🎨');

        const preferredColorName = data.defaultColor || 'Black';
        const colorFallbacks = Array.isArray(data.colorFallbacks) && data.colorFallbacks.length
            ? data.colorFallbacks
            : ['Black', 'White', 'Navy', 'Red'];
        const bagColorCandidates = Array.from(new Set([
            preferredColorName,
            ...colorFallbacks,
            'Oxford',
            'Light Grey'
        ].map((c) => String(c || '').trim()).filter(Boolean)));
        const hexByName = {
            black: '#000000',
            white: '#ffffff',
            navy: '#001f3f',
            red: '#c41e3a'
        };
        const fallbackBg = data.bgColor
            || hexByName[String(preferredColorName).toLowerCase()]
            || ((preferredColorName === 'White') ? '#ffffff' : '#000000');
        const SEQ_GAP_MS = 100; // tiny gap between primary → secondary (race/timing only)

        function installTpPrimaryAlertHook() {
            // Page-world: auto-dismiss OK for primary-color alerts so AUT never hangs
            try {
                const hook = document.createElement('script');
                hook.textContent = `(() => {
                    if (window.__nhpAlertHooked) return;
                    window.__nhpAlertHooked = true;
                    const orig = window.alert.bind(window);
                    window.alert = function(msg) {
                        const text = String(msg || '');
                        const bags = /primary\\s*color\\s*for\\s*bags/i.test(text) || /choose\\s+a\\s+primary\\s+color.*bag/i.test(text);
                        const sharedPrimary = /cannot\\s+be\\s+disabled/i.test(text) || /primary\\s+color\\s+on\\s+other\\s+products/i.test(text);
                        if (bags || sharedPrimary) {
                            document.documentElement.setAttribute(bags ? 'data-nhp-bags-alert' : 'data-nhp-primary-alert', '1');
                            console.warn('[NHP] Suppressed TeePublic primary-color alert (OK):', text);
                            return; // fail-soft continue (native alert OK dismissed)
                        }
                        return orig(msg);
                    };
                })();`;
                (document.documentElement || document.head).appendChild(hook);
                hook.remove();
            } catch (e) { }
        }

        async function clearSuppressedPrimaryAlertFlag() {
            const hit = document.documentElement.getAttribute('data-nhp-primary-alert') === '1'
                || document.documentElement.getAttribute('data-nhp-bags-alert') === '1';
            if (!hit) return false;
            document.documentElement.removeAttribute('data-nhp-primary-alert');
            document.documentElement.removeAttribute('data-nhp-bags-alert');
            await delay(SEQ_GAP_MS);
            return true;
        }

        function isColorControlSelected(el) {
            if (!el) return false;
            if (el.classList.contains('selected') || el.classList.contains('active') || el.classList.contains('is-selected')
                || el.classList.contains('checked') || el.getAttribute('aria-checked') === 'true'
                || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('data-selected') === 'true') {
                return true;
            }
            const input = el.matches('input') ? el : (el.control || el.querySelector?.('input[type="checkbox"], input[type="radio"]')
                || (el.htmlFor ? document.getElementById(el.htmlFor) : null)
                || el.previousElementSibling);
            if (input && (input.type === 'checkbox' || input.type === 'radio') && input.checked) return true;
            return false;
        }

        function safeClickColorControl(el) {
            // Never click an already-selected color — that tries to disable a primary shared across products
            if (!el || isColorControlSelected(el)) return false;
            try {
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                el.click();
                return true;
            } catch (e) {
                return false;
            }
        }

        async function setPrimaryColorDropdown(productKey) {
            const canvas = document.querySelector(`.canvas.${productKey}, .canvas[data-canvas="${productKey}"], tr[data-canvas="${productKey}"]`);
            if (canvas) {
                try { canvas.click(); await delay(400); } catch (e) { }
            }
            const dd = document.querySelector(
                `#primary_color_${productKey} .dd-select, #primary_color_${productKey} .dd-selected, .canvas.${productKey} .dd-select, tr[data-canvas="${productKey}"] .dd-select`
            );
            if (!dd) return false;
            try {
                dd.click();
                dd.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            } catch (e) { }
            await delay(350);
            const container = document.querySelector(`#primary_color_${productKey}`) || dd.closest('.dd-container') || dd.parentElement;
            let options = Array.from((container || document).querySelectorAll('.dd-option'));
            if (!options.length) options = Array.from(document.querySelectorAll('.dd-option'));
            if (!options.length) return false;
            for (const cand of bagColorCandidates) {
                const t = cand.toLowerCase();
                const opt = options.find((o) => (o.querySelector('.dd-option-text')?.textContent || o.textContent || '').toLowerCase().includes(t));
                if (opt) {
                    try {
                        opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        opt.click();
                    } catch (e) { }
                    await delay(250);
                    return true;
                }
            }
            const first = options.find((o) => !/select|choose|default|primary/i.test(o.textContent || '')) || options[0];
            if (first) {
                try { first.click(); } catch (e) { }
                await delay(250);
                return true;
            }
            return false;
        }

        function isProductEnabled(root) {
            if (!root) return false;
            const hidden = root.querySelector('.on-off.canvas-enable input[type="hidden"], input[type="hidden"][name*="enabled"]');
            if (hidden && /^(true|1|on)$/i.test(String(hidden.value || '').trim())) return true;
            const span = root.querySelector('.on-off span, .on-off.canvas-enable span');
            if (span && (span.classList.contains('enabled') || span.classList.contains('on') || /^\s*on\s*$/i.test(span.textContent || ''))) return true;
            if (span && (span.classList.contains('disabled') || span.classList.contains('off') || /^\s*off\s*$/i.test(span.textContent || ''))) return false;
            return root.classList.contains('enabled') || root.classList.contains('selected');
        }

        async function ensureAllProductsEnabled() {
            // Keep Hoodie/Tank/Crewneck/etc. ON — only click toggles that are currently OFF
            const roots = document.querySelectorAll(
                '.canvas, tr[data-canvas], .m-uploader-product, [data-product-name], .js-product-row'
            );
            let turnedOn = 0;
            for (const root of roots) {
                const toggle = root.querySelector('.on-off.canvas-enable, .on-off');
                if (!toggle) continue;
                if (isProductEnabled(root)) continue;
                try {
                    const clickTarget = toggle.querySelector('span, a, button, input') || toggle;
                    clickTarget.click();
                    turnedOn++;
                    await delay(80);
                } catch (e) { }
            }
            if (turnedOn) console.log('[Niche Hunter] Enabled products (ON):', turnedOn);
            return turnedOn;
        }

        async function ensureBagsTotesPrimaryColor() {
            const bagRoot = document.querySelector('.canvas.bag, .canvas[data-canvas="bag"], tr[data-canvas="bag"], .canvas[data-product-name="Bags"], .canvas[data-product-name="Bag"]');
            const toteRoot = document.querySelector('.canvas.tote, .canvas[data-canvas="tote"], tr[data-canvas="tote"], .canvas[data-product-name="Totes"], .canvas[data-product-name="Tote"]');
            const bagUi = !!document.querySelector('#primary_color_bag, .canvas.bag');
            const toteUi = !!document.querySelector('#primary_color_tote, .canvas.tote');
            const bagOn = isProductEnabled(bagRoot) || bagUi;
            const toteOn = isProductEnabled(toteRoot) || toteUi;
            if (!bagOn && !toteOn) return { applied: false };

            sendProgress('جاري ضبط اللون الأساسي للحقائب/التوتس... 78% 🎨');
            console.log('[Niche Hunter] Ensuring bags/totes primary color...');
            let applied = false;
            if (bagOn) applied = (await setPrimaryColorDropdown('bag')) || applied;
            await delay(SEQ_GAP_MS);
            if (toteOn) {
                applied = (await setPrimaryColorDropdown('tote')) || applied;
                if (toteRoot) {
                    try { toteRoot.click(); await delay(400); } catch (e) { }
                }
                document.querySelectorAll('input.hex-input, input[name*="bg"], input[type="text"][name*="color"]').forEach((input) => {
                    try {
                        if (!input.value) {
                            input.value = fallbackBg;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            applied = true;
                        }
                    } catch (e) { }
                });
            }
            return { applied, bagOn, toteOn };
        }

        installTpPrimaryAlertHook();
        await ensureAllProductsEnabled();
        await delay(SEQ_GAP_MS);

        // 0. PRIMARY FIRST (before any swatch enable/disable) — bags/totes + apparel primary dropdowns
        const bagsPrimaryResult = await ensureBagsTotesPrimaryColor();
        if (bagsPrimaryResult.applied) {
            console.log('[Niche Hunter] Bags/totes primary color applied (before secondary):', bagsPrimaryResult);
        }
        const apparelPrimaryKeys = [
            'tshirt', 'hoodie', 'tank', 'crewneck', 'longsleeve', 'kids',
            'baseballtee', 'kids_hoodie', 'kids_longsleeve'
        ];
        for (const key of apparelPrimaryKeys) {
            if (!document.querySelector(`#primary_color_${key}, .canvas.${key}, tr[data-canvas="${key}"]`)) continue;
            await setPrimaryColorDropdown(key);
            await delay(SEQ_GAP_MS);
        }
        await delay(SEQ_GAP_MS); // tiny settle before secondary color clicks
        await clearSuppressedPrimaryAlertFlag();

        // 1. Generic swatches — select preferred only; never click already-selected (would disable primary)
        const preferredLower = String(preferredColorName).toLowerCase();
        const genericSwatches = document.querySelectorAll('.m-uploader-product .swatch, .color-swatch, .color-spot');
        genericSwatches.forEach(swatch => {
            const label = (swatch.getAttribute('title') || swatch.getAttribute('data-color')
                || swatch.getAttribute('aria-label') || swatch.textContent || '').toLowerCase();
            if (!label.includes(preferredLower)) return;
            safeClickColorControl(swatch);
        });
        document.querySelectorAll(`[title="${preferredColorName}" i], [data-color="${preferredColorName}" i]`).forEach((sw) => {
            safeClickColorControl(sw);
        });

        // 2. Label based color pickers — skip already checked
        const labelSwatches = document.querySelectorAll('.m-uploader-product input[type="radio"] + label, label.color-swatch, label.swatch, .color-swatch-container label');
        labelSwatches.forEach(label => {
            const text = (label.getAttribute('title') || label.getAttribute('data-color') || label.textContent || '').toLowerCase();
            if (!text.includes(preferredLower)) return;
            safeClickColorControl(label);
        });

        await delay(SEQ_GAP_MS);

        // 3. Custom Dropdowns (dd-select) used by TeePublic — set primary/target color
        const customDropdowns = document.querySelectorAll('.dd-select');
        for (const dd of customDropdowns) {
            try {
                const container = dd.closest('.dd-container') || dd.parentElement;
                const hiddenInput = container ? container.querySelector('input[type="hidden"]') : null;

                dd.click();
                dd.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

                await delay(250);

                if (container) {
                    const optionsList = container.querySelectorAll('.dd-option');
                    const targetColorName = preferredColorName;
                    let targetOption = Array.from(optionsList).find(opt => opt.textContent.toLowerCase().includes(targetColorName.toLowerCase()));
                    if (!targetOption && optionsList.length > 0) {
                        targetOption = optionsList[0];
                    }

                    if (targetOption) {
                        targetOption.click();
                        targetOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

                        if (hiddenInput) {
                            const optionValue = targetOption.querySelector('.dd-option-value');
                            if (optionValue) {
                                hiddenInput.value = optionValue.value;
                                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    }
                }

                await delay(SEQ_GAP_MS);
                await clearSuppressedPrimaryAlertFlag();
            } catch (e) { }
        }

        // Fallback for standard native Selects
        const dropdowns = document.querySelectorAll('.m-uploader-product select, select.js-uploader-color-select, select[name*="color"]');
        dropdowns.forEach(dropdown => {
            if (dropdown.options.length > 1 && (!dropdown.value || dropdown.value === '' || dropdown.value === 'none')) {
                dropdown.value = dropdown.options[1].value;
                dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                dropdown.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // 4. Hex Inputs & Primary Color configurations
        const hexInputsX = document.querySelectorAll('.m-uploader-product input[type="hidden"][name*="color"], input.hex-input, input[name="design[default_color]"]');
        hexInputsX.forEach(input => {
            if (!input.value || input.value === '') {
                input.value = fallbackBg;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // Re-assert products still ON after color ops (never turn OFF)
        await ensureAllProductsEnabled();
        await delay(SEQ_GAP_MS);
        await clearSuppressedPrimaryAlertFlag();

        await delay(2000);

        sendProgress('يتم الآن الانتظار حتى اكتمال ألوان كل المنتجات... 90% ⏱️');

        function productRootHasColor(root) {
            if (!root) return false;
            const selected = root.querySelector('.swatch.selected, .swatch.active, .color-swatch.selected, [aria-checked="true"], .dd-selected-text, .dd-selected');
            if (selected) {
                const t = (selected.textContent || selected.title || '').trim();
                if (t && !/select|choose|primary|default/i.test(t)) return true;
                if (selected.classList?.contains('selected') || selected.classList?.contains('active')) return true;
            }
            const select = root.querySelector('select[name*="color"], select.js-uploader-color-select');
            if (select && select.value && select.selectedIndex > 0) return true;
            const hidden = root.querySelector('input[type="hidden"][name*="color"], input.hex-input');
            return !!(hidden && String(hidden.value || '').trim());
        }

        async function waitAllProductColorsBeforePublish(maxMs = 60000) {
            const started = Date.now();
            while ((Date.now() - started) < maxMs) {
                const roots = Array.from(document.querySelectorAll('.m-uploader-product, .canvas[data-canvas], tr[data-canvas]'))
                    .filter((r) => (r.offsetWidth > 0 || r.offsetHeight > 0) && (isProductEnabled(r) || r.querySelector('.dd-select, .swatch')));
                const missing = roots.filter((r) => !productRootHasColor(r));
                if (!missing.length) return true;
                console.log('[Niche Hunter] Colors incomplete — waiting/retrying:', missing.length);
                await ensureBagsTotesPrimaryColor();
                for (const key of apparelPrimaryKeys) {
                    if (document.querySelector(`#primary_color_${key}, .canvas.${key}`)) {
                        await setPrimaryColorDropdown(key);
                        await delay(SEQ_GAP_MS);
                    }
                }
                await delay(1500);
            }
            return false;
        }

        const colorsReadyForPublish = await waitAllProductColorsBeforePublish(60000);
        if (!colorsReadyForPublish) {
            console.warn('[Niche Hunter] Publish gated — colors still incomplete after wait; one more bags/apparel pass');
            await ensureBagsTotesPrimaryColor();
            await ensureAllProductsEnabled();
            await delay(2000);
            const ready2 = await waitAllProductColorsBeforePublish(30000);
            if (!ready2) {
                sendProgress('تعذر اكتمال ألوان كل المنتجات — لن يتم النشر الآن ❌');
                markUploadPhase('colors_failed');
                throw new Error('Publish blocked: colors not selected for all products');
            }
        }
        await delay(2000);

        // 4. Auto Publish
        if (data.submit || data.actionType === 'publish') {
            console.log("[Niche Hunter] Auto-submitting (colors verified)...");
            markUploadPhase('submitting', 'submitting');
            sendProgress('جاري النقر على زر النشر... 95% 🔥');

            const submitSelectors = [
                'button.publish-and-promote-button',
                'button[value="publish" i]',
                'input[type="submit"][value*="Publish" i]',
                '.save-design-btn',
                '#publish-btn',
                'form.edit_design input[type="submit"]',
                'form.new_design input[type="submit"]'
            ];

            let saveBtn = null;
            for (const sel of submitSelectors) {
                saveBtn = document.querySelector(sel);
                if (saveBtn) break;
            }

            if (saveBtn) {
                // Remove disabled if stuck
                saveBtn.removeAttribute('disabled');
                saveBtn.classList.remove('disabled');

                saveBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await delay(2000);

                installTpPrimaryAlertHook();

                const clickPublishBtn = (btn) => {
                    const events = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
                    events.forEach(evt => {
                        btn.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
                    });
                    try { btn.click(); } catch (e) { }
                };

                chrome.storage.local.set({ tpReadyForNext: true, tpLastUploadJobId: jobId }, async () => {
                    completeTeePublicUploadJob(jobId, 'publish_triggered');
                    console.log("[Niche Hunter] Executing clicks on:", saveBtn);

                    document.documentElement.removeAttribute('data-nhp-bags-alert');
                    document.documentElement.removeAttribute('data-nhp-primary-alert');
                    clickPublishBtn(saveBtn);
                    await delay(1500);

                    if (document.documentElement.getAttribute('data-nhp-bags-alert') === '1') {
                        document.documentElement.removeAttribute('data-nhp-bags-alert');
                        console.warn('[Niche Hunter] Bags primary-color alert — fixing and retrying PUBLISH');
                        sendProgress('تنبيه الحقائب: جاري اختيار اللون الأساسي ثم إعادة النشر... ✎');
                        await ensureBagsTotesPrimaryColor();
                        await delay(SEQ_GAP_MS);
                        await ensureAllProductsEnabled();
                        await delay(800);
                        const retryBtn = document.querySelector(
                            'button.publish-and-promote-button, button[value="publish" i], input[type="submit"][value*="Publish" i], .save-design-btn, #publish-btn'
                        ) || saveBtn;
                        clickPublishBtn(retryBtn);
                        try {
                            chrome.runtime.sendMessage({
                                action: 'tp_progress',
                                text: '✎ تم تصحيح لون الحقائب وإعادة النشر (corrected)'
                            }).catch(() => { });
                        } catch (e) { }
                    } else if (document.documentElement.getAttribute('data-nhp-primary-alert') === '1') {
                        // Fail-soft: alert already dismissed via hook — continue pipeline
                        document.documentElement.removeAttribute('data-nhp-primary-alert');
                        console.warn('[Niche Hunter] Shared primary-color alert dismissed — continuing upload');
                        await delay(SEQ_GAP_MS);
                        await ensureAllProductsEnabled();
                    }

                    // Direct invocation fallback
                    setTimeout(() => {
                        if (document.body.innerText.toLowerCase().includes('successfully') ||
                            document.body.innerText.toLowerCase().includes('congrats')) return;

                        const form = saveBtn.closest('form');
                        if (form) {
                            console.log("[Niche Hunter] Fallback: Directly submitting form.");
                            form.submit();
                        }
                    }, 3000);

                    sendProgress('تم الضغط على النشر! جاري المتابعة... 100% 🚀');
                });
            } else {
                console.error("[Niche Hunter] Submit button NOT FOUND after all attempts.");
                setTeePublicUploadPhase(jobId, 'awaiting_manual_publish', 'awaiting_manual_publish');
                sendProgress('⚠️ لم يتم العثور على زر النشر! يرجى الضغط عليه يدوياً للمتابعة.');
            }
        } else {
            // Track manual publishing to continue queue
            setTeePublicUploadPhase(jobId, 'awaiting_manual_publish', 'awaiting_manual_publish');
            const publishForm = document.querySelector('form.edit_design, form.new_design');
            if (publishForm) {
                publishForm.addEventListener('submit', () => {
                    chrome.storage.local.set({ tpReadyForNext: true, tpLastUploadJobId: jobId });
                    completeTeePublicUploadJob(jobId, 'manual_publish_triggered');
                }, { once: true });
            }
            const saveBtnRaw = document.querySelector('button.publish-and-promote-button, button[value="publish" i], input[type="submit"][value*="Publish" i], input[type="submit"][value*="Save" i], .save-design-btn');
            if (saveBtnRaw) {
                saveBtnRaw.addEventListener('click', () => {
                    chrome.storage.local.set({ tpReadyForNext: true, tpLastUploadJobId: jobId });
                    completeTeePublicUploadJob(jobId, 'manual_publish_triggered');
                }, { once: true });
            }
            sendProgress('اكتملت التعبئة بنجاح! يرجى مراجعة التصميم ثم نشره يدوياً للمتابعة 🚀');
        }

        console.log('[Niche Hunter] TeePublic Auto-Fill Routine Finished.');
    }

    // ── GEMINI CAPTURE INTEGRATION ──
    if (window.location.hostname.includes('gemini.google.com')) {
        console.log('[Niche Hunter] Gemini Capture Logic Active.');

        document.addEventListener('click', async (e) => {
            // Find if the clicked element is the download button or icon
            const target = e.target.closest('button, a');
            if (!target) return;

            const icon = target.querySelector('[data-mat-icon-name="download"]');
            if (!icon && !target.innerHTML.includes('download')) return;

            console.log('[Niche Hunter] Gemini Download Button Clicked');

            // Find the image in the same card/container
            // Gemini structure: the button is inside an action group, which is inside a card
            const card = target.closest('.model-response-text, .image-container, .img-container, g-img, ai-image-card') ||
                target.parentElement.parentElement.parentElement;

            if (!card) return;

            const img = card.querySelector('img');
            if (img && img.src) {
                console.log('[Niche Hunter] Image found:', img.src);

                // Try to get high-res original if it's a thumbnail
                let imageUrl = img.src;

                // Gemini images are often served via googleusercontent.com
                // We can sometimes improve resolution by changing parameters, but here we just want to bridge it.

                try {
                    // Send message to background to handle fetch and studio addition
                    chrome.runtime.sendMessage({
                        action: 'call_gemini_studio_bridge', // Custom bridge action
                        imageUrl: imageUrl,
                        filename: `gemini_studio_${Date.now()}.png`
                    });

                    // Show a small feedback on page if possible
                    updateOnPageTracker('✨ جاري إرسال التصميم إلى Studio...', 50);
                    setTimeout(() => {
                        const tracker = document.getElementById('nh-progress-tracker');
                        if (tracker) tracker.style.display = 'none';
                    }, 3000);

                } catch (err) {
                    console.error('[Niche Hunter] Bridge failed:', err);
                }
            }
        }, true); // Use capture phase to ensure we see the click
    }

    // ==========================================
    // FACEBOOK UI AUTOMATOR (MARKETING MODULE)
    // بناءً على تحليل ButtonAnalyzer Pro
    // ==========================================
    if (window.location.hostname.includes('facebook.com')) {
        console.log('[Niche Hunter] 🤖 Facebook UI Automator Active.');

        class FBAutomator {
            static async sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

            // باحث ذكي يعتمد على الـ Accessibility لتخطي تشفير كلاسات Tailwind في فيسبوك
            static async findSmartElement(label, type = 'aria-label', timeout = 10000) {
                return new Promise((resolve) => {
                    let selector = '';
                    if (type === 'aria-label') selector = `[aria-label^="${label}"]`;
                    else if (type === 'placeholder') selector = `input[placeholder="${label}"]`;
                    else if (type === 'role') selector = `[role="${label}"]`;

                    const el = document.querySelector(selector);
                    if (el && (el.offsetWidth > 0 || el.offsetHeight > 0)) return resolve(el);

                    let timerId;
                    const observer = new MutationObserver(() => {
                        const el = document.querySelector(selector);
                        if (el && (el.offsetWidth > 0 || el.offsetHeight > 0)) {
                            observer.disconnect();
                            clearTimeout(timerId);
                            resolve(el);
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                    timerId = setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
                });
            }

            static async typeReactInput(element, text) {
                element.focus();
                // فيسبوك يستخدم Draft.js / Lexical, الطريقة الوحيدة المستقرة هي insertText
                document.execCommand('insertText', false, text);
                element.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // حملة نشر مباشر (Publish Campaign)
            static async runPublishCampaign(data, hideTracker = true) {
                updateOnPageTracker('🚀 بدء حملة النشر التلقائية على فيسبوك...', 10);

                await this.sleep(3000);

                // 1. فتح صندوق النشر (Create Post)
                updateOnPageTracker(`📝 جاري البحث عن صندوق النشر...`, 20);

                let createPostBtn = await this.findSmartElement('Create a post', 'aria-label', 3000) ||
                    await this.findSmartElement('Créer une publication', 'aria-label', 3000) ||
                    await this.findSmartElement('إنشاء منشور', 'aria-label', 3000) ||
                    await this.findSmartElement('Write something', 'aria-label', 3000) ||
                    await this.findSmartElement('Écrivez quelque chose', 'aria-label', 3000) ||
                    await this.findSmartElement('اكتب شيئًا', 'aria-label', 3000);

                if (!createPostBtn) {
                    const btns = Array.from(document.querySelectorAll('div[role="button"]'));
                    createPostBtn = btns.find(el => {
                        const txt = el.textContent.toLowerCase();
                        return txt.includes('بم تفكر') || txt.includes("what's on your mind") ||
                            txt.includes('que voulez-vous dire') || txt.includes('write something') ||
                            txt.includes('اكتب شيئًا') || txt.includes('créer une publication') ||
                            txt.includes('create a post') || txt.includes('photo/vidéo') ||
                            txt.includes('صورة/فيديو') || txt.includes('photo/video');
                    });
                }

                if (createPostBtn) {
                    createPostBtn.click();
                    await this.sleep(3000);
                }

                // 2. العثور على المربع النصي (Textbox)
                updateOnPageTracker(`✍️ جاري كتابة المنشور...`, 40);
                const textBox = document.querySelector('div[role="textbox"][contenteditable="true"]');

                if (!textBox) {
                    updateOnPageTracker('⚠️ لم يتم العثور على مربع النص الخاص بالنشر.', -1);
                    return;
                }

                await this.typeReactInput(textBox, data.message);
                await this.sleep(2000);

                // 3. إضافة الصورة (Paste Base64 as File)
                if (data.base64Image) {
                    updateOnPageTracker(`🖼️ جاري إرفاق الصورة...`, 60);
                    try {
                        const cleanBase64 = data.base64Image.includes(',') ? data.base64Image.split(',')[1] : data.base64Image;
                        const mimeType = data.base64Image.includes('data:') ? data.base64Image.match(/data:(.*?);/)[1] : 'image/png';

                        const byteCharacters = atob(cleanBase64);
                        const byteArray = new Uint8Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteArray[i] = byteCharacters.charCodeAt(i);
                        }
                        const blob = new Blob([byteArray], { type: mimeType });
                        const file = new File([blob], "design.png", { type: mimeType });

                        const clipboardData = new DataTransfer();
                        clipboardData.items.add(file);
                        const pasteEvent = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true });
                        textBox.dispatchEvent(pasteEvent);

                        await this.sleep(4000);
                    } catch (e) { console.error('Image Paste Error:', e); }
                }

                // 4. النقر على زر النشر
                updateOnPageTracker(`🚀 جاري النشر الآن...`, 80);
                const postBtn = await this.findSmartElement('Post', 'aria-label', 2000) ||
                    await this.findSmartElement('Publier', 'aria-label', 2000) ||
                    await this.findSmartElement('نشر', 'aria-label', 2000);

                if (!postBtn) {
                    const spans = Array.from(document.querySelectorAll('div[role="button"] span'));
                    const publishSpan = spans.find(s => s.textContent.trim() === 'Post' || s.textContent.trim() === 'Publier' || s.textContent.trim() === 'نشر');
                    if (publishSpan) {
                        publishSpan.closest('div[role="button"]').click();
                    } else {
                        updateOnPageTracker('⚠️ لم يتم العثور على زر النشر. يرجى النقر يدوياً.', 90);
                        return;
                    }
                } else {
                    postBtn.click();
                }

                updateOnPageTracker('✅ تم النشر بنجاح!', 100);

                if (hideTracker) {
                    setTimeout(() => {
                        const tracker = document.getElementById('nh-progress-tracker');
                        if (tracker) tracker.style.display = 'none';
                    }, 4000);
                }
            }

            // الوكيل الذكي المستقل (Autonomous AI Agent) - يقرأ، يحلل، ثم يتفاعل
            static async runSmartAIAgent(persona) {
                updateOnPageTracker('🤖 الوكيل الذكي: جاري مسح الصفحة الحالية وقراءة المنشورات...', 10);

                // تمرير الصفحة للأسفل لإجبار فيسبوك على تحميل المنشورات
                window.scrollBy({ top: 1200, behavior: 'smooth' });
                await this.sleep(5000);

                // محاولة إيجاد منشورات تحتوي على نصوص حقيقية (نتجاهل الإعلانات القصيرة)
                const postSelectors = 'div[data-ad-preview="message"], div[data-testid="post_message"], div[dir="auto"]';
                const posts = Array.from(document.querySelectorAll(postSelectors)).filter(el => {
                    const text = el.innerText.trim();
                    // تجاهل النصوص الموجودة داخل الأزرار أو الروابط لضمان دقة الاختيار
                    if (el.closest('div[role="button"]') || el.closest('a')) return false;
                    return text.length > 25;
                });

                if (posts.length === 0) {
                    updateOnPageTracker('⚠️ لم أجد منشورات صالحة للقراءة للتفاعل معها.', -1);
                    return;
                }

                // اختيار أول أو ثاني منشور للابتعاد عن صندوق "بم تفكر"
                const targetPost = posts[Math.floor(Math.random() * Math.min(3, posts.length))];
                const postText = targetPost.innerText.trim();

                updateOnPageTracker('🧠 الوكيل الذكي: جاري إرسال المنشور لـ Gemini لتحليله وصياغة رد...', 40);

                const prompt = `أنت تتصرف كشخص حقيقي، خبير ومهتم جداً بمجال "${persona}".
قرأت للتو هذا المنشور على فيسبوك:
"${postText}"

المطلوب: اكتب تعليقاً طبيعياً، ودياً، وتفاعلياً للرد على هذا المنشور وكأنك مستخدم فيسبوك عادي. 
لا تبدُ كروبوت ذكاء اصطناعي. استخدم إيموجي واحد أو اثنين بالكثير. الرد يجب أن يكون قصيراً (سطر إلى سطرين كحد أقصى).
أخرج النص مباشرة بدون مقدمات.`;

                // إرسال الطلب للخلفية للاتصال بـ Gemini
                chrome.runtime.sendMessage({ action: 'call_gemini', prompt: prompt }, async (response) => {
                    if (chrome.runtime.lastError) {
                        updateOnPageTracker('❌ خطأ: فقدان الاتصال بالخادم الذكي (Background Worker Asleep).', -1);
                        return;
                    }
                    const res = response;
                    if (res && res.success) {
                        // تنظيف الرد من أي مسافات زائدة
                        const commentText = (res.data.result || res.data.message || res.data).replace(/```json|```/g, '').trim();

                        updateOnPageTracker('✍️ الوكيل الذكي: جاري التفاعل وكتابة الرد...', 70);

                        // البحث عن حاوية المنشور لتحديد زر الإعجاب والتعليق التابعين له حصراً
                        const postContainer = targetPost.closest('div[data-pagelet^="FeedUnit"], div[role="article"]');
                        if (postContainer) {
                            const likeSelectors = '[aria-label="J’aime"], [aria-label="Like"], [aria-label="أعجبني"], [aria-label="Réagir"]';
                            const likeBtn = postContainer.querySelector(likeSelectors);
                            if (likeBtn && likeBtn.getAttribute('aria-pressed') !== 'true') {
                                likeBtn.click();
                                await this.sleep(1500);
                            }

                            const commentBtn = postContainer.querySelector('[aria-label="Laissez un commentaire"], [aria-label="Write a comment"], [aria-label="اكتب تعليقًا"], [aria-label="Commenter"], [aria-label="Comment"]');
                            if (commentBtn) {
                                commentBtn.click();
                                await this.sleep(2000);

                                // التركيز ينتقل تلقائياً لصندوق التعليق، نجلبه
                                const textBox = document.activeElement;
                                if (textBox && (textBox.getAttribute('role') === 'textbox' || textBox.contentEditable === 'true' || textBox.tagName === 'P')) {
                                    await this.typeReactInput(textBox, commentText);
                                    await this.sleep(1500);

                                    // محاكاة الضغط على Enter لإرسال التعليق
                                    textBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, shiftKey: false }));

                                    // محاولة إيجاد أيقونة الإرسال في حال لم يعمل Enter (تحديثات فيسبوك الجديدة)
                                    await this.sleep(1000);
                                    const sendIcon = postContainer.querySelector('[aria-label="Commenter"], [aria-label="Comment"], [aria-label="تعليق"]');
                                    if (sendIcon && sendIcon.tagName === 'DIV' && sendIcon.getAttribute('role') === 'button') {
                                        sendIcon.click();
                                    }

                                    updateOnPageTracker('✅ الوكيل الذكي: تم التفاعل بنجاح (إعجاب + تعليق)!', 100);
                                } else {
                                    updateOnPageTracker('⚠️ لم أتمكن من إيجاد صندوق النص للتعليق.', -1);
                                }
                            }
                        }
                    } else {
                        updateOnPageTracker('❌ فشل الذكاء الاصطناعي في توليد الرد.', -1);
                    }
                });
            }

            // الطيار الآلي الشامل (AI Pilot) - يجمع بين النشر والتسويق والتفاعل
            static async runAIPilot(data) {
                const { persona, pageId, base64Image, designId } = data;
                updateOnPageTracker('✈️ الطيار الآلي: جاري تحليل الصفحة وتحديد المهام التسويقية...', 10);
                await this.sleep(4000);

                // المهمة 1: النشر الذكي المعتمد على الصورة (إن وجدت)
                if (base64Image) {
                    updateOnPageTracker('✈️ الطيار الآلي: جاري صياغة محتوى تسويقي للصورة يعتمد على الندرة...', 20);

                    const prompt = `أنت خبير تسويق إلكتروني وتدير صفحة متجر يبيع تصاميم Print on Demand.
النيش المستهدف: "${persona}".
بناءً على الصورة المرفقة للتصميم، اكتب منشوراً ترويجياً احترافياً جداً يحاكي أسلوب البشر.
**قاعدة هامة:** استخدم أسلوب "الندرة" (Scarcity) وعرضاً مؤقتاً لخلق رغبة فورية في الشراء.
أضف Call to Action واضح لشراء التصميم، مع ترك مكان للرابط [ضع الرابط هنا].
استخدم الهاشتاجات المناسبة. أخرج نص المنشور فقط بدون أي مقدمات أو شروحات.`;

                    const res = await new Promise(resolve => {
                        chrome.runtime.sendMessage({ action: 'call_gemini', prompt: prompt, base64: base64Image }, (response) => {
                            if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
                            else resolve(response);
                        });
                    });

                    if (res && res.success) {
                        const postText = (res.data.result || res.data.message || res.data).replace(/```json|```/g, '').trim();
                        updateOnPageTracker('✈️ الطيار الآلي: تم تجهيز العرض، جاري النشر...', 40);

                        await this.runPublishCampaign({ message: postText, base64Image: base64Image, pageId: pageId }, false);

                        // تحديث حالة التصميم في الطابور إلى (تم النشر)
                        if (designId) {
                            chrome.storage.local.get(['savedDesignQueue'], (storage) => {
                                const q = storage.savedDesignQueue || [];
                                const item = q.find(i => i.id === designId);
                                if (item) item.status = 'done';
                                chrome.storage.local.set({ savedDesignQueue: q });
                            });
                        }

                        updateOnPageTracker('✈️ الطيار الآلي: استراحة قصيرة للتمويه البشري قبل بدء التفاعل...', 60);
                        await this.sleep(8000 + Math.random() * 4000);
                    }
                }

                // المهمة 2: التفاعل وجذب العملاء المحتملين (Lead Gen)
                updateOnPageTracker('✈️ الطيار الآلي: جاري البحث عن تعليقات أو منشورات لاصطياد العملاء...', 70);

                // تمرير الصفحة لتحديث البيانات قبل الاصطياد
                window.scrollBy({ top: 1200, behavior: 'smooth' });
                await this.sleep(4000);

                const popSelectors = 'div[data-ad-preview="message"], div[data-testid="post_message"], div[dir="auto"]';
                const posts = Array.from(document.querySelectorAll(popSelectors)).filter(el => {
                    const text = el.innerText.trim();
                    if (el.closest('div[role="button"]') || el.closest('a')) return false;
                    return text.length > 15;
                });
                if (posts.length > 0) {
                    // نختار منشور عشوائي للتفاعل معه لتجنب النمط الآلي
                    const targetPost = posts[Math.floor(Math.random() * Math.min(3, posts.length))];

                    const replyPrompt = `أنت مدير متجر مبيعات لتصاميم "${persona}". 
قرأت التعليق/المنشور التالي: "${targetPost.innerText.trim()}"
اكتب رداً بشرياً تفاعلياً واحداً فقط. إذا كان مناسباً، وجهه بلباقة لزيارة متجرك أو تفاعل مع كلامه بمرح لزيادة الارتباط (Engagement).`;

                    const replyRes = await new Promise(resolve => {
                        chrome.runtime.sendMessage({ action: 'call_gemini', prompt: replyPrompt }, (response) => {
                            if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
                            else resolve(response);
                        });
                    });
                    if (replyRes && replyRes.success) {
                        const commentText = (replyRes.data.result || replyRes.data.message || replyRes.data).replace(/```json|```/g, '').trim();
                        const postContainer = targetPost.closest('div[data-pagelet^="FeedUnit"], div[role="article"]');

                        if (postContainer) {
                            const likeBtn = postContainer.querySelector('[aria-label="J’aime"], [aria-label="Like"], [aria-label="أعجبني"], [aria-label="Réagir"]');
                            if (likeBtn && likeBtn.getAttribute('aria-pressed') !== 'true') {
                                likeBtn.click(); await this.sleep(2000);
                            }
                            const commentBtn = postContainer.querySelector('[aria-label="Laissez un commentaire"], [aria-label="Write a comment"], [aria-label="رد"], [aria-label="Comment"], [aria-label="اكتب تعليقًا"]');
                            if (commentBtn) {
                                commentBtn.click(); await this.sleep(2000);
                                const textBox = document.activeElement;
                                if (textBox && textBox.getAttribute('role') === 'textbox') {
                                    await this.typeReactInput(textBox, commentText); await this.sleep(1500);
                                    textBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, shiftKey: false }));
                                    await this.sleep(1000);
                                    const sendIcon = postContainer.querySelector('[aria-label="Commenter"], [aria-label="Comment"], [aria-label="تعليق"]');
                                    if (sendIcon && sendIcon.tagName === 'DIV' && sendIcon.getAttribute('role') === 'button') {
                                        sendIcon.click();
                                    }
                                }
                            }
                        }
                    }
                }
                updateOnPageTracker('✅ الطيار الآلي: تمت المهمة بنجاح، أنت الآن في وضع السيطرة.', 100);
                setTimeout(() => { document.getElementById('nh-progress-tracker').style.display = 'none'; }, 6000);
            }
        }

        // فحص وجود أوامر تسويق معلقة في التخزين المحلي (أكثر استقراراً من الرسائل المباشرة)
        chrome.storage.local.get(['fb_pending_engage'], (res) => {
            if (res.fb_pending_engage) {
                const data = res.fb_pending_engage;
                // التأكد من أن الأمر جديد (لم يمر عليه أكثر من دقيقتين) لتفادي تنفيذه بالخطأ لاحقاً
                if (Date.now() - data.timestamp < 120000) {
                    chrome.storage.local.remove('fb_pending_engage', () => {
                        // انتظار إضافي بسيط لضمان اكتمال تحميل واجهة فيسبوك بالكامل
                        setTimeout(() => {
                            FBAutomator.runPublishCampaign(data).catch(console.error);
                        }, 3000);
                    });
                } else {
                    chrome.storage.local.remove('fb_pending_engage');
                }
            }
        });

        // فحص وجود أمر إطلاق الوكيل الذكي
        chrome.storage.local.get(['fb_pending_agent'], (res) => {
            if (res.fb_pending_agent) {
                const data = res.fb_pending_agent;
                if (Date.now() - data.timestamp < 120000) {
                    chrome.storage.local.remove('fb_pending_agent', () => {
                        setTimeout(() => {
                            FBAutomator.runSmartAIAgent(data.persona).catch(console.error);
                        }, 3000);
                    });
                } else {
                    chrome.storage.local.remove('fb_pending_agent');
                }
            }
        });

        // فحص وجود أمر إطلاق الطيار الآلي الشامل
        chrome.storage.local.get(['fb_pending_pilot'], (res) => {
            if (res.fb_pending_pilot) {
                const data = res.fb_pending_pilot;
                if (Date.now() - data.timestamp < 120000) {
                    chrome.storage.local.remove('fb_pending_pilot', () => {
                        setTimeout(() => {
                            FBAutomator.runAIPilot(data).catch(console.error);
                        }, 3000);
                    });
                } else {
                    chrome.storage.local.remove('fb_pending_pilot');
                }
            }
        });

        // الاستماع لأوامر الإضافة (كطريقة احتياطية)
        chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
            if (req.action === 'fb_ui_publish') {
                FBAutomator.runPublishCampaign(req.data).then(() => {
                    sendResponse({ status: 'done' });
                }).catch(err => {
                    console.error(err);
                    sendResponse({ status: 'error', error: err.message });
                });
                return true;
            }
        });
    }

    // ==========================================
    // REDBUBBLE AUTOMATOR (MERCHGHOST INTEGRATION)
    // ==========================================
    if (window.location.hostname.includes('redbubble.com')) {
        console.log('[Niche Hunter / MerchGhost] 🔴 Redbubble Automator Active.');

        class RBAutomator {
            static async sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

            static async fillWorkForm(data) {
                updateOnPageTracker('🚀 بدء أتمتة Redbubble...', 10);

                // Title
                const titleInput = document.querySelector('.add-work-details__input--title, #work_title, [name="work[title]"]');
                if (titleInput && data.title) {
                    titleInput.value = data.title;
                    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    titleInput.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Tags
                const mainTagInput = document.querySelector('#main-tag-en');
                const supTagInput = document.querySelector('#supporting-tags-en');
                const tagsInput = document.querySelector('#work_tag_list, [name="work[tag_list]"]');

                const tagList = Array.isArray(data.tags) ? data.tags : (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);
                if (mainTagInput || supTagInput) {
                    if (mainTagInput && tagList.length > 0) {
                        mainTagInput.textContent = tagList[0] + ',';
                        mainTagInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    if (supTagInput && tagList.length > 1) {
                        supTagInput.textContent = tagList.slice(1).join(', ') + ',';
                        supTagInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } else if (tagsInput && data.tags) {
                    tagsInput.value = tagList.join(', ');
                    tagsInput.dispatchEvent(new Event('input', { bubbles: true }));
                }

                // Description
                const descInput = document.querySelector('.add-work-details__input--description, #work_description, [name="work[description]"]');
                if (descInput && data.description) {
                    descInput.value = data.description;
                    descInput.dispatchEvent(new Event('input', { bubbles: true }));
                    descInput.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Background Color
                if (data.defaultColor) {
                    const bgInput = document.querySelector('#work_default_color, [name="work[default_color]"], .swatch-hex-input');
                    if (bgInput) {
                        bgInput.value = data.defaultColor.startsWith('#') ? data.defaultColor : '#000000';
                        bgInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }

                updateOnPageTracker('✅ تم تعبئة بيانات التصميم (Redbubble)', 50);
            }

            static async applyMerchGhostPricing(pricingData) {
                updateOnPageTracker('👻 MerchGhost: جاري تطبيق الأسعار المخصصة...', 60);
                if (!pricingData || !Array.isArray(pricingData)) return;

                const inputs = document.querySelectorAll('input.markup-percentage, input[name^="work[product_configurations]"][name$="[markup]"], input[type="number"][min="0"]');

                let appliedCount = 0;
                inputs.forEach(input => {
                    const nameAttr = input.getAttribute('name') || '';
                    const dataProduct = input.getAttribute('data-product') || '';

                    const match = pricingData.find(p => nameAttr.includes(p.productName) || dataProduct === p.productName);
                    if (match) {
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        if (nativeInputValueSetter) {
                            nativeInputValueSetter.call(input, match.markup);
                        } else {
                            input.value = match.markup;
                        }
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        appliedCount++;
                    }
                });

                updateOnPageTracker(`✅ MerchGhost: تم تحديث أسعار ${appliedCount} منتج.`, 100);
                setTimeout(() => {
                    const tracker = document.getElementById('nh-progress-tracker');
                    if (tracker) tracker.style.display = 'none';
                }, 4000);
            }

            static async autoSubmit() {
                const rightsCheck = document.querySelector('#rightsDeclaration');
                if (rightsCheck && !rightsCheck.checked) rightsCheck.click();

                await this.sleep(500);
                const submitBtn = document.querySelector('#submit-work, [type="submit"][value*="Save"]');
                if (submitBtn) {
                    updateOnPageTracker('🚀 جاري النشر...', 90);
                    submitBtn.click();
                }
            }
        }

        // الاستماع للأوامر القادمة من MerchGhost أو الأوتوبايلوت
        chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
            if (req.action === 'rb_fill_form') {
                RBAutomator.fillWorkForm(req.data).then(() => {
                    if (req.data.submit) RBAutomator.autoSubmit();
                    sendResponse({ status: 'done' });
                });
                return true;
            }
            if (req.action === 'rb_apply_pricing') {
                RBAutomator.applyMerchGhostPricing(req.pricingData).then(() => {
                    sendResponse({ status: 'done' });
                });
                return true;
            }
        });

        // الاستماع لأوامر MerchGhost المعلقة في التخزين (لضمان التنفيذ بعد إعادة تحميل الصفحة)
        chrome.storage.local.get(['rb_pending_task'], (res) => {
            if (res.rb_pending_task) {
                const task = res.rb_pending_task;
                if (Date.now() - task.timestamp < 120000) {
                    chrome.storage.local.remove('rb_pending_task', () => {
                        if (task.type === 'fill_form') {
                            RBAutomator.fillWorkForm(task.data).then(() => { if (task.data.submit) RBAutomator.autoSubmit(); });
                        }
                        else if (task.type === 'apply_pricing') {
                            RBAutomator.applyMerchGhostPricing(task.pricingData);
                        }
                    });
                } else {
                    chrome.storage.local.remove('rb_pending_task');
                }
            }
        });
    }

})();
