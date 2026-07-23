/**
 * TeePublic signup pipeline for EmailCore Lite — isolated profiles + inbox confirm.
 */
(function initEmailCoreTeePublicPipeline() {
    if (self.__emailCoreTeePublicPipelineReady) return;
    self.__emailCoreTeePublicPipelineReady = true;

    const PENDING_SIGNUP_KEY = 'emailcore_pending_signup';
    const PIPELINE_PHASES = ['PENDING', 'FILLING', 'SUBMITTED', 'WAITING_EMAIL', 'CONFIRM_CLICKED', 'DONE', 'CAPTCHA_PAUSED', 'ERROR', 'IDLE'];

    let teepublicPipeline = {
        phase: 'IDLE',
        account: null,
        signupTabId: null,
        inboxTabId: null,
        windowId: null,
        confirmUrl: null,
        captchaPaused: false,
        fullAuto: true,
        apiBase: 'http://localhost:3000',
        startedAt: null,
        updatedAt: null,
    };

    function delay(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    function getHandlersApi() {
        return self.__emailCoreHandlersApi || {};
    }

    async function persistTeePublicPipeline() {
        await chrome.storage.local.set({
            teepublicPipeline: { ...teepublicPipeline, updatedAt: Date.now() },
        });
    }

    async function setTeePublicPipelinePhase(phase, extra = {}) {
        if (!PIPELINE_PHASES.includes(phase)) return;
        teepublicPipeline = {
            ...teepublicPipeline,
            phase,
            updatedAt: Date.now(),
            ...extra,
        };
        if (extra.account) teepublicPipeline.account = extra.account;
        await persistTeePublicPipeline();
        const api = getHandlersApi();
        api.appendAutomationLog?.(`TeePublic pipeline: ${phase}`, phase === 'ERROR' ? 'error' : 'info');
        api.postPipelineEventToServer?.(`Pipeline → ${phase}`, phase === 'ERROR' ? 'error' : 'info', phase);
    }

    async function postPipelineEventToServer(message, level = 'info', phase = null) {
        const account = teepublicPipeline.account || {};
        const email = account.email || account.display_email || '';
        if (!email) return;
        const apiBase = String(teepublicPipeline.apiBase || 'http://localhost:3000').replace(/\/+$/, '');
        try {
            await fetch(`${apiBase}/api/automation/pipeline-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    sessionId: account.sessionId || account.id || null,
                    message: String(message || ''),
                    level,
                    phase: phase || teepublicPipeline.phase,
                }),
            });
        } catch (_) { /* offline */ }
    }

    function storePendingSignup(payload) {
        return new Promise((resolve) => {
            chrome.storage.local.set({
                [PENDING_SIGNUP_KEY]: payload,
                emailcorePendingFill: true,
            }, () => resolve());
        });
    }

    function buildInboxViewerUrl(payload) {
        const qs = new URLSearchParams({
            email: payload.email || '',
            sessionId: String(payload.sessionId || ''),
            token: payload.inboxToken || '',
            apiBase: payload.apiBase || 'http://localhost:3000',
        });
        return chrome.runtime.getURL(`emailcore-inbox-viewer.html?${qs.toString()}`);
    }

    async function createInboxViewerTab(payload, options = {}) {
        const viewerUrl = buildInboxViewerUrl(payload);
        const createOpts = { url: viewerUrl, active: options.active !== false };
        if (options.windowId) createOpts.windowId = options.windowId;
        const tab = await chrome.tabs.create(createOpts);
        teepublicPipeline.inboxTabId = tab.id;
        teepublicPipeline.windowId = tab.windowId;
        getHandlersApi().appendAutomationLog?.(
            `EmailCore: inbox viewer for ${payload.email} — waiting TeePublic confirm`,
            'info'
        );
        return tab;
    }

    async function handleTeePublicSignupSubmitted(account, sender, autoConfirm = true) {
        const tabId = sender?.tab?.id || teepublicPipeline.signupTabId;
        if (sender?.tab?.windowId) teepublicPipeline.windowId = sender.tab.windowId;
        teepublicPipeline.signupTabId = tabId;

        let payload = account;
        const api = getHandlersApi();
        if (!payload?.inboxToken && api.buildSignupPayload) {
            payload = await api.buildSignupPayload(account, {
                apiBase: teepublicPipeline.apiBase || account.apiBase || 'http://localhost:3000',
            });
        }
        teepublicPipeline.account = payload;
        await storePendingSignup(payload);
        await setTeePublicPipelinePhase('SUBMITTED', { account: payload });
        api.appendAutomationLog?.(`TeePublic signup submitted: ${payload.email}`, 'success');
        postPipelineEventToServer(`Signup submitted: ${payload.email}`, 'success', 'SUBMITTED');

        if (autoConfirm !== false) {
            await createInboxViewerTab(payload, {
                windowId: teepublicPipeline.windowId,
                active: true,
            });
            await setTeePublicPipelinePhase('WAITING_EMAIL');
        }
    }

    async function handleTeePublicSignupFilled(account, autoConfirm) {
        const email = String(account?.email || account?.display_email || '').trim();
        teepublicPipeline.account = account;
        await setTeePublicPipelinePhase('FILLING', { account });
        getHandlersApi().appendAutomationLog?.(
            `TeePublic form filled for ${email} — click Create Account + CAPTCHA`,
            'success'
        );
        postPipelineEventToServer(`Signup form filled: ${email}`, 'success', 'FILLING');
        return { success: true, autoConfirm: autoConfirm !== false };
    }

    async function handleConfirmFound(confirmUrl, sender) {
        console.log('[EmailCore][Pipeline] handleConfirmFound called with:', {
            confirmUrl,
            senderTabId: sender?.tab?.id,
            signupTabId: teepublicPipeline.signupTabId,
            inboxTabId: teepublicPipeline.inboxTabId,
            phase: teepublicPipeline.phase,
        });

        if (!confirmUrl) {
            console.warn('[EmailCore][Pipeline] handleConfirmFound: confirmUrl is empty/null — aborting');
            return;
        }
        teepublicPipeline.confirmUrl = confirmUrl;
        await setTeePublicPipelinePhase('CONFIRM_CLICKED');
        await delay(500 + Math.floor(Math.random() * 1000));

        let targetTabId = teepublicPipeline.signupTabId || teepublicPipeline.inboxTabId || sender?.tab?.id;
        console.log('[EmailCore][Pipeline] Target tab for navigation:', targetTabId);

        // Verify the target tab actually exists before navigating
        if (targetTabId) {
            try {
                await chrome.tabs.get(targetTabId);
                console.log('[EmailCore][Pipeline] Tab', targetTabId, 'exists — navigating');
            } catch (tabCheckErr) {
                console.warn('[EmailCore][Pipeline] Tab', targetTabId, 'no longer exists:', tabCheckErr.message, '— will create new tab');
                targetTabId = null;
            }
        }

        try {
            if (targetTabId) {
                await chrome.tabs.update(targetTabId, { url: confirmUrl, active: true });
                console.log('[EmailCore][Pipeline] ✅ Tab', targetTabId, 'navigated to confirm URL');
            } else {
                console.log('[EmailCore][Pipeline] No valid target tab — creating new tab');
                const tab = await chrome.tabs.create({ url: confirmUrl, active: true });
                targetTabId = tab.id;
                console.log('[EmailCore][Pipeline] ✅ New tab created:', targetTabId);
            }
            teepublicPipeline.inboxTabId = targetTabId;
            await setTeePublicPipelinePhase('DONE');
            getHandlersApi().appendAutomationLog?.('Confirmation link opened', 'success');
            postPipelineEventToServer('Account confirmation complete', 'success', 'DONE');
        } catch (err) {
            console.error('[EmailCore][Pipeline] ❌ Confirm navigation FAILED:', err.message, err);
            // Last-resort fallback: try opening a brand-new tab
            try {
                const fallbackTab = await chrome.tabs.create({ url: confirmUrl, active: true });
                console.log('[EmailCore][Pipeline] Fallback tab created:', fallbackTab.id);
                teepublicPipeline.inboxTabId = fallbackTab.id;
                await setTeePublicPipelinePhase('DONE');
                getHandlersApi().appendAutomationLog?.('Confirmation link opened (fallback tab)', 'warning');
                postPipelineEventToServer('Confirm opened via fallback', 'warning', 'DONE');
            } catch (fallbackErr) {
                console.error('[EmailCore][Pipeline] ❌ Even fallback tab creation failed:', fallbackErr.message);
                await setTeePublicPipelinePhase('ERROR');
                getHandlersApi().appendAutomationLog?.(`Confirm navigation failed: ${err.message}`, 'error');
            }
        }
    }

    async function openInboxConfirmFlow(account, options = {}) {
        const email = String(account.email || account.display_email || '').trim();
        if (!email) throw new Error('Account email is required');

        const api = getHandlersApi();
        const apiBase = String(options.apiBase || teepublicPipeline.apiBase || 'http://localhost:3000').trim();
        const payload = api.buildSignupPayload
            ? await api.buildSignupPayload({ ...account, email }, { apiBase, ...options })
            : { ...account, email, apiBase };
        await storePendingSignup(payload);
        teepublicPipeline.account = payload;
        teepublicPipeline.apiBase = apiBase;

        const viewerUrl = buildInboxViewerUrl(payload);
        const launchResult = api.launchEmailcoreAccountBrowser
            ? await api.launchEmailcoreAccountBrowser({
                  account: { ...account, email, ...payload },
                  targetUrl: viewerUrl,
                  platform: options.platform || 'teepublic',
                  projectDir: options.projectDir,
              })
            : { success: false, error: 'launch unavailable' };

        if (!launchResult.success) {
            await createInboxViewerTab(payload, { active: true });
        }

        getHandlersApi().appendAutomationLog?.(
            `EmailCore: waiting TeePublic confirm for ${email}`,
            'info'
        );
        postPipelineEventToServer(`Inbox viewer opened: ${email}`, 'info', 'WAITING_EMAIL');
        return { success: true, mode: launchResult.mode || 'tab', viewerUrl };
    }

    function parseSignupHashFromUrl(url) {
        try {
            const parsed = new URL(url);
            const utils = self.EmailCoreAccountUtils;
            if (utils?.decodeSignupFromLocation) {
                return utils.decodeSignupFromLocation(parsed);
            }
            const hash = parsed.hash || '';
            if (hash.includes('emailcore=')) {
                const m = hash.match(/#emailcore=([^&]+)/i);
                if (m) {
                    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
                    const json = decodeURIComponent(escape(atob(b64)));
                    return JSON.parse(json);
                }
            }
            return utils ? utils.decodeSignupHash(hash) : null;
        } catch (_) {
            return null;
        }
    }

    async function loadAccountFromProfileFile(emailHint) {
        const hint = String(emailHint || '').trim();
        if (!hint) return null;
        const api = getHandlersApi();
        if (api?.readProfileSignupFromDisk) {
            return api.readProfileSignupFromDisk(hint);
        }
        return null;
    }

    function bootstrapPipelineFromTabUrl(tabId, url) {
        if (!url || !/\/users\/sign_up/i.test(url)) return;
        void (async () => {
            try {
                let account = parseSignupHashFromUrl(url);
                let emailHint = String(account?.email || '').trim();
                if (!emailHint) {
                    try {
                        const parsed = new URL(url);
                        emailHint = String(parsed.searchParams.get('ec_hint') || '').trim();
                    } catch (_) { /* ignore */ }
                }
                if (!account?.email && emailHint) {
                    account = await loadAccountFromProfileFile(emailHint);
                }
                if (!account?.email) return;
                teepublicPipeline.account = account;
                teepublicPipeline.fullAuto = account.autoConfirm !== false;
                teepublicPipeline.apiBase = account.apiBase || 'http://localhost:3000';
                teepublicPipeline.signupTabId = tabId;
                teepublicPipeline.startedAt = Date.now();
                await storePendingSignup(account);
                await setTeePublicPipelinePhase('PENDING', { account });
            } catch (err) {
                console.warn('[EmailCore] pipeline hash parse failed', err);
            }
        })();
    }

    function initPipelineForAccount(payload, options = {}) {
        teepublicPipeline = {
            phase: 'PENDING',
            account: payload,
            signupTabId: null,
            inboxTabId: null,
            windowId: null,
            confirmUrl: null,
            captchaPaused: false,
            fullAuto: options.fullAuto !== false,
            apiBase: payload.apiBase || options.apiBase || 'http://localhost:3000',
            startedAt: Date.now(),
            updatedAt: Date.now(),
        };
        return persistTeePublicPipeline();
    }

    self.EmailCoreTeePublicPipeline = {
        getState: () => ({ ...teepublicPipeline }),
        setTeePublicPipelinePhase,
        persistTeePublicPipeline,
        postPipelineEventToServer,
        storePendingSignup,
        buildInboxViewerUrl,
        createInboxViewerTab,
        handleTeePublicSignupSubmitted,
        handleTeePublicSignupFilled,
        handleConfirmFound,
        openInboxConfirmFlow,
        bootstrapPipelineFromTabUrl,
        initPipelineForAccount,
        PENDING_SIGNUP_KEY,
    };
})();
