/**
 * CREATY AI Orchestrator (extension) — prepare account data via CLIProxyAPI + IndexedDB,
 * then delegate schedule automation to creaty-server (3020).
 */
(function initCreatyAiOrchestrator(global) {
    'use strict';

    if (global.CreatyAiOrchestrator) return;

    const CREATY_SERVER_BASE = 'http://127.0.0.1:3020';
    const CREATY_GHOST_PORT = 3024;
    const GENERATE_GHOST_PORT = 3019;
    const DL_DB_NAME = 'creaty-design-library';
    const DL_META_STORE = 'designs';
    const DL_BLOB_STORE = 'blobs';
    const DL_GROUP_SIZE = 5;
    const DL_READY_STATUS = 'ready';
    const STORE_ASSETS_DB = 'creaty-store-assets-library';
    const STORE_ASSETS_STORE = 'assets';
    const STORE_ASSETS_BLOB_STORE = 'blobs';
    const GENERATE_DESIGN_COUNT = 8;
    const BEGINNER_STYLE_PROMPT = [
        'Create a cohesive collection of simple print-ready T-shirt graphics.',
        'Style: beginner illustrator, naive hand drawn, childlike drawing, playful, imperfect but charming.',
        'Keep one unified theme, one unified palette, and one unified visual language across the collection.',
        'Use solid black background, centered apparel composition, bold readable silhouettes.',
        'No mockups, no shirts, no product photos, no watermarks, no copyrighted characters, no celebrity references.',
        'Each design should be simple enough to look like a beginner artist or childrens drawing, but still clean for POD.'
    ].join(' ');
    const SCHEDULE_READY_PREFIX = 'creaty_schedule_ready_';

    function normEmail(email) {
        return String(email || '').trim().toLowerCase();
    }

    function scheduleReadyKey(email) {
        return `${SCHEDULE_READY_PREFIX}${normEmail(email).replace(/[^a-z0-9@._-]/g, '_')}`;
    }

    function getScheduler() {
        return global.CreatyUploadScheduler || null;
    }

    function ensureStoreGenLoaded() {
        if (typeof global.CreatyStoreGenerator !== 'undefined') return true;
        try {
            importScripts('creaty-store-generator.js');
        } catch (err) {
            console.error('[CREATY AI] store generator import failed', err);
        }
        return typeof global.CreatyStoreGenerator !== 'undefined';
    }

    function broadcastLog(message, level = 'info', email = null) {
        try {
            chrome.runtime.sendMessage({
                action: 'CREATY_SCHEDULE_UPDATE',
                email,
                log: message,
                level,
            });
        } catch (_) { /* no listeners */ }
    }

    function payloadByteSize(body) {
        if (typeof body !== 'string' || !body) return 0;
        try {
            return new TextEncoder().encode(body).length;
        } catch (_) {
            return body.length;
        }
    }

    async function fetchCreatyServer(path, options = {}) {
        const url = `${CREATY_SERVER_BASE}${path}`;
        const bodyStr = typeof options.body === 'string' ? options.body : '';
        const bodyBytes = payloadByteSize(bodyStr);
        if (bodyBytes > 0) {
            const kb = (bodyBytes / 1024).toFixed(1);
            broadcastLog(
                `📦 طلب Creaty ${path} — ${kb} KB / payload ${kb} KB`,
                bodyBytes > 2 * 1024 * 1024 ? 'warn' : 'info'
            );
        }
        const res = await fetch(url, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            signal: AbortSignal.timeout(options.timeoutMs || 120000),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const sizeHint = bodyBytes > 0 ? ` (~${(bodyBytes / 1024).toFixed(1)} KB payload)` : '';
            const errMsg = data.error || `Creaty server HTTP ${res.status}${sizeHint}`;
            if (res.status === 413) {
                broadcastLog(`⛔ HTTP 413 — حجم الحمولة كبير جداً${sizeHint}`, 'error');
            }
            throw new Error(errMsg);
        }
        return data;
    }

    async function pingCreatyServer() {
        try {
            const res = await fetch(`${CREATY_SERVER_BASE}/ping`, { signal: AbortSignal.timeout(3000) });
            return res.ok;
        } catch (_) {
            return false;
        }
    }

    async function blobToBase64(blob) {
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    async function blobToDataUrl(blob) {
        const mime = blob?.type || 'image/png';
        const b64 = await blobToBase64(blob);
        return b64 ? `data:${mime};base64,${b64}` : '';
    }

    function openStoreAssetsDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(STORE_ASSETS_DB, 1);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_ASSETS_STORE)) {
                    const store = db.createObjectStore(STORE_ASSETS_STORE, { keyPath: 'id' });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('topic', 'topic', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                if (!db.objectStoreNames.contains(STORE_ASSETS_BLOB_STORE)) {
                    db.createObjectStore(STORE_ASSETS_BLOB_STORE, { keyPath: 'id' });
                }
            };
        });
    }

    function topicScore(assetTopic, wantedTopic) {
        const a = String(assetTopic || '').toLowerCase();
        const w = String(wantedTopic || '').toLowerCase();
        if (!a || !w) return 0;
        if (a === w) return 100;
        if (a.includes(w) || w.includes(a)) return 75;
        const words = w.split(/[^a-z0-9]+/i).filter((x) => x.length > 2);
        return words.reduce((score, word) => score + (a.includes(word) ? 10 : 0), 0);
    }

    async function findStoreAssetDataUrl(type, topic) {
        let db = null;
        try {
            db = await openStoreAssetsDb();
            const rows = await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_ASSETS_STORE, 'readonly');
                const req = tx.objectStore(STORE_ASSETS_STORE).getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
            const wanted = String(type || '').toLowerCase();
            const picked = rows
                .filter((row) => String(row.type || '').toLowerCase() === wanted)
                .map((row) => ({ row, score: topicScore(row.topic, topic) }))
                .filter((item) => item.score > 0 || !topic)
                .sort((a, b) => b.score - a.score || new Date(b.row.createdAt) - new Date(a.row.createdAt))[0]?.row;
            if (!picked?.id) return null;
            const blob = await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_ASSETS_BLOB_STORE, 'readonly');
                const req = tx.objectStore(STORE_ASSETS_BLOB_STORE).get(String(picked.id));
                req.onsuccess = () => resolve(req.result?.blob || null);
                req.onerror = () => reject(req.error);
            });
            if (!blob) return null;
            return { dataUrl: await blobToDataUrl(blob), asset: picked };
        } catch (err) {
            broadcastLog(`⚠️ Store asset library read failed: ${err.message}`, 'warn');
            return null;
        } finally {
            try { db?.close?.(); } catch (_) { /* ignore */ }
        }
    }

    function safeDesignId() {
        return `cd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function safeGroupId() {
        return `cg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function dataUrlToBlob(dataUrl, fallbackType = 'image/png') {
        const raw = String(dataUrl || '').trim();
        const match = raw.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return null;
        try {
            const binary = atob(match[2]);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            return new Blob([bytes], { type: match[1] || fallbackType });
        } catch (_) {
            return null;
        }
    }

    function openDesignDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DL_DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(DL_META_STORE)) {
                    const store = db.createObjectStore(DL_META_STORE, { keyPath: 'id' });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    store.createIndex('groupId', 'groupId', { unique: false });
                    store.createIndex('assignedAccountId', 'assignedAccountId', { unique: false });
                    store.createIndex('sourceSeoId', 'sourceSeoId', { unique: false });
                }
                if (!db.objectStoreNames.contains(DL_BLOB_STORE)) {
                    db.createObjectStore(DL_BLOB_STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function addGeneratedQuintetToDesignLibrary(email, images = [], meta = {}) {
        const selected = images.slice(0, DL_GROUP_SIZE);
        if (selected.length < DL_GROUP_SIZE) {
            throw new Error('auto_quintet_not_enough_images');
        }
        const db = await openDesignDb();
        const groupId = safeGroupId();
        const createdAt = new Date().toISOString();
        const accountEmail = normEmail(email);
        const rows = [];

        await new Promise((resolve, reject) => {
            const tx = db.transaction([DL_META_STORE, DL_BLOB_STORE], 'readwrite');
            const metaStore = tx.objectStore(DL_META_STORE);
            const blobStore = tx.objectStore(DL_BLOB_STORE);

            selected.forEach((img, index) => {
                const blob = dataUrlToBlob(img.dataUrl || img.base64 || '', img.mimeType || 'image/png');
                if (!blob) return;
                const id = safeDesignId();
                const title = `${meta.titleBase || meta.niche || 'Beginner Art'} ${index + 1}`;
                const row = {
                    id,
                    filename: img.filename || `creaty-beginner-${index + 1}.png`,
                    title,
                    description: `Simple beginner-style POD illustration for ${meta.niche || 'a playful niche'}.`,
                    mainTag: meta.niche || 'beginner art',
                    tags: [meta.niche, 'beginner art', 'childlike drawing', 'simple illustration', 'cute art'].filter(Boolean),
                    niche: meta.niche || '',
                    status: DL_READY_STATUS,
                    mimeType: blob.type || 'image/png',
                    size: blob.size,
                    groupId,
                    groupIndex: index,
                    assignedAccountId: accountEmail,
                    sourceSeoId: `autogen:${accountEmail}:${Date.now()}:${index + 1}`,
                    pulledBy: null,
                    pulledAt: null,
                    createdAt,
                    updatedAt: createdAt,
                };
                metaStore.put(row);
                blobStore.put({ id, blob });
                rows.push(row);
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        if (rows.length < DL_GROUP_SIZE) {
            throw new Error('auto_quintet_blob_decode_failed');
        }

        try {
            chrome.runtime.sendMessage({
                action: 'CREATY_ARCHIVE_QUEUE_DESIGNS',
                accountEmails: [accountEmail],
            });
        } catch (_) { /* background unavailable */ }

        return { groupId, designs: rows };
    }

    async function getGeneratePort() {
        const ports = [GENERATE_GHOST_PORT, CREATY_GHOST_PORT];
        for (const port of ports) {
            try {
                const res = await fetch(`http://127.0.0.1:${port}/api/generate/health`, {
                    signal: AbortSignal.timeout(3500),
                });
                if (res.status !== 404) return port;
            } catch (_) { /* try next */ }
        }
        return GENERATE_GHOST_PORT;
    }

    function buildAutoQuintetPrompt({ email, niche, storeProfile } = {}) {
        const storeTitle = String(storeProfile?.title || storeProfile?.storeTitle || '').trim();
        return [
            BEGINNER_STYLE_PROMPT,
            niche ? `Theme/niche: ${niche}.` : '',
            storeTitle ? `Store identity: ${storeTitle}.` : '',
            `Account label for internal grouping: ${email}.`,
            'Generate variations that feel like one small collection: same topic, same mood, same simple drawing style.',
            'Avoid text unless it is extremely short and clean.'
        ].filter(Boolean).join(' ');
    }

    async function generateQuintetViaGenerateApi(email, storeResult, options = {}) {
        const ai = typeof NhpAiCliproxy !== 'undefined' ? NhpAiCliproxy : null;
        const settings = ai?.getNhpAiCliproxySettings ? await ai.getNhpAiCliproxySettings() : {};
        if (!settings?.apiKey) throw new Error('auto_quintet_no_api_key');

        const port = Number(options.generateGhostPort) || await getGeneratePort();
        const prompt = buildAutoQuintetPrompt({
            email,
            niche: storeResult?.niche || options.niche || '',
            storeProfile: storeResult?.profile || null,
        });
        const form = new FormData();
        form.append('prompt', prompt);
        form.append('mode', 'text');
        form.append('aiProvider', 'auto');
        form.append('count', String(GENERATE_DESIGN_COUNT));
        form.append('quality', 'balanced');
        form.append('styleMode', 'auto');
        form.append('sync', '1');
        form.append('apiKey', settings.apiKey);
        form.append('baseUrl', settings.baseUrl || '');
        if (settings.requestedImageModel) form.append('imageModel', settings.requestedImageModel);

        broadcastLog('🎨 GENERAT: توليد 5 تصاميم بسيطة للحساب…', 'info', email);
        const res = await fetch(`http://127.0.0.1:${port}/api/generate`, {
            method: 'POST',
            headers: { 'X-NHP-Api-Key': settings.apiKey },
            body: form,
            signal: AbortSignal.timeout(720000),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            throw new Error(data?.error || `generate_http_${res.status}`);
        }
        const allImages = Array.isArray(data.images) ? data.images : [];
        const splitImages = allImages.filter((img) => /^design_\d+\.png$/i.test(String(img.filename || '')));
        const picked = (splitImages.length >= DL_GROUP_SIZE ? splitImages : allImages)
            .filter((img) => img?.dataUrl)
            .slice(0, DL_GROUP_SIZE);
        if (picked.length < DL_GROUP_SIZE) throw new Error('auto_quintet_not_enough_images');

        const group = await addGeneratedQuintetToDesignLibrary(email, picked, {
            niche: storeResult?.niche || options.niche || '',
            titleBase: storeResult?.profile?.title || 'Creaty Beginner Art',
        });
        broadcastLog(`✅ GENERAT → CREATY: ${picked.length}/5 تصاميم محفوظة ومربوطة`, 'success', email);
        return group;
    }

    function summarizeQuintetForStoreImages(quintet, storeResult) {
        const titles = (quintet?.designs || [])
            .map((d) => d.title || d.filename || '')
            .filter(Boolean)
            .slice(0, DL_GROUP_SIZE)
            .join(', ');
        return [
            storeResult?.niche ? `Theme: ${storeResult.niche}.` : '',
            titles ? `Generated design set: ${titles}.` : '',
            'Use the same naive beginner illustrator style, childlike simple shapes, playful cohesive palette, and gentle handmade look.'
        ].filter(Boolean).join(' ');
    }

    async function ensureStoreImagesAfterQuintet(email, storeResult, quintet, options = {}) {
        if (!ensureStoreGenLoaded()) return storeResult;
        const Store = global.CreatyStoreGenerator;
        const profile = { ...(storeResult.profile || {}) };
        if (profile.avatarDataUrl && profile.coverDataUrl) return storeResult;

        const topic = storeResult.niche || profile.niche || options.niche || '';
        const patchFromLibrary = {};
        if (!profile.avatarDataUrl) {
            const picked = await findStoreAssetDataUrl('avatar', topic);
            if (picked?.dataUrl) {
                patchFromLibrary.avatarDataUrl = picked.dataUrl;
                patchFromLibrary.avatarRef = `library:${picked.asset.id}`;
                broadcastLog(`🖼️ Avatar من مكتبة العمود 3: ${picked.asset.topic}`, 'success', email);
            }
        }
        if (!profile.coverDataUrl) {
            const picked = await findStoreAssetDataUrl('cover', topic);
            if (picked?.dataUrl) {
                patchFromLibrary.coverDataUrl = picked.dataUrl;
                patchFromLibrary.coverRef = `library:${picked.asset.id}`;
                broadcastLog(`🖼️ Cover من مكتبة العمود 3: ${picked.asset.topic}`, 'success', email);
            }
        }
        if (patchFromLibrary.avatarDataUrl || patchFromLibrary.coverDataUrl) {
            const merged = { ...profile, ...patchFromLibrary, niche: topic };
            await Store.saveStoreProfile(email, merged);
            if (merged.avatarDataUrl && merged.coverDataUrl) {
                return { ...storeResult, profile: merged };
            }
            Object.assign(profile, merged);
        }

        if (!options.generateImages) {
            return { ...storeResult, profile };
        }

        const visualContext = summarizeQuintetForStoreImages(quintet, storeResult);
        profile.imagePrompts = {
            ...(profile.imagePrompts || {}),
            avatar: [profile.imagePrompts?.avatar || '', visualContext, 'Avatar should feel like the face of this exact design collection.'].filter(Boolean).join(' '),
            cover: [profile.imagePrompts?.cover || '', visualContext, 'Cover should look like a wide banner made from the same collection mood.'].filter(Boolean).join(' '),
        };

        broadcastLog('🖼️ توليد Avatar/Cover بعد تثبيت التصاميم…', 'info', email);
        const images = await Store.generateStoreImages({
            accountEmail: email,
            email,
            niche: storeResult.niche,
            profile,
            avatarOnly: !profile.avatarDataUrl && !!profile.coverDataUrl,
            coverOnly: !profile.coverDataUrl && !!profile.avatarDataUrl,
        });
        if (images?.success && images.profilePatch) {
            const merged = { ...profile, ...images.profilePatch };
            await Store.saveStoreProfile(email, merged);
            broadcastLog('✅ تم توليد Avatar/Cover بنفس رؤية التصاميم', 'success', email);
            return { ...storeResult, profile: merged };
        }
        if (images?.error) {
            broadcastLog(`⚠️ Avatar/Cover لم يكتمل: ${images.error}`, 'warn', email);
        }
        return { ...storeResult, profile };
    }

    async function buildQuintetPayload(email, options = {}) {
        const sched = getScheduler();
        if (!sched?.findQuintetForAccount) return null;

        let quintet = await sched.findQuintetForAccount(email);
        if (!quintet && options.autoAssignQuintet !== false && sched.assignUnassignedQuintetToAccount) {
            const assign = await sched.assignUnassignedQuintetToAccount(email);
            if (assign?.success) quintet = assign.group || await sched.findQuintetForAccount(email);
        }
        if (!quintet?.designs?.length) return null;

        const designs = [];
        for (const d of quintet.designs) {
            let base64 = d.base64 || '';
            if (!base64 && sched.getDesignBlob) {
                const blob = await sched.getDesignBlob(d.id);
                if (blob) base64 = await blobToBase64(blob);
            }
            designs.push({
                id: d.id,
                title: d.title || d.filename || '',
                description: d.description || '',
                tags: Array.isArray(d.tags) ? d.tags : [],
                mainTag: d.mainTag || '',
                niche: d.niche || '',
                filename: d.filename || 'design.png',
                mimeType: d.mimeType || 'image/png',
                status: d.status || 'ready',
                base64,
            });
        }
        return { groupId: quintet.groupId, designs };
    }

    async function prepareStoreInExtension(email, options = {}) {
        if (!ensureStoreGenLoaded()) {
            return { ok: false, error: 'store_generator_unavailable' };
        }
        const Store = global.CreatyStoreGenerator;
        let profile = null;
        let niche = String(options.niche || '').trim();

        const loaded = await Store.loadStoreProfile(email);
        profile = loaded?.profile || null;

        if (!profile?.title && options.prepareStore !== false) {
            broadcastLog(`🤖 AI: generating store / توليد المتجر…`, 'info', email);
            const wantImages = false;
            if (wantImages) {
                broadcastLog(`🖼️ Including images / تضمين توليد الصور…`, 'info', email);
            }
            const gen = await Store.generateStoreProfile({
                accountEmail: email,
                email,
                niche: niche || undefined,
                includeImages: wantImages,
            });
            if (!gen?.success) return { ok: false, error: gen?.error || 'store_generate_failed' };
            profile = gen.profile;
            niche = String(gen.niche || niche || profile?.niche || '').trim();
            if (wantImages && gen.imagesGenerated === false && gen.imageError) {
                broadcastLog(`⚠️ Store text OK, images failed: ${gen.imageError}`, 'warn', email);
            }
            await Store.saveStoreProfile(email, { ...profile, niche });
            broadcastLog(`✅ Store saved / تم حفظ المتجر`, 'success', email);
        } else if (!niche && profile?.niche) {
            niche = String(profile.niche).trim();
        }

        if (!profile?.title) return { ok: false, error: 'store_profile_required' };
        return { ok: true, profile, niche };
    }

    async function loadAccountCredentials(email) {
        const stored = await chrome.storage.local.get(['ap_accounts_teepublic', 'ap_accounts']);
        const accounts = Array.isArray(stored.ap_accounts_teepublic)
            ? stored.ap_accounts_teepublic
            : (Array.isArray(stored.ap_accounts) ? stored.ap_accounts : []);
        const acc = accounts.find((a) => normEmail(a?.email) === normEmail(email));
        if (!acc) return null;
        return {
            email: String(acc.email).trim(),
            pass: String(acc.pass || acc.password || '').trim(),
            account: acc,
        };
    }

    async function markAccountScheduleReady(email, ready = true, meta = {}) {
        const key = scheduleReadyKey(email);
        if (ready) {
            await chrome.storage.local.set({
                [key]: { email: normEmail(email), scheduleReady: true, markedAt: new Date().toISOString(), ...meta },
            });
        } else {
            await chrome.storage.local.remove(key);
        }
    }

    function slimPayloadForPrepare(payload, options = {}) {
        const stageId = String(options.stageId || options.stage || '').trim();
        let storeProfile = payload.storeProfile ? { ...payload.storeProfile } : null;
        let quintet = payload.quintet;

        // Keep avatar/cover data URLs for executable stages; strip only prepare-only payloads.
        if (storeProfile && !stageId) {
            const { avatarDataUrl, coverDataUrl, ...slimStore } = storeProfile;
            storeProfile = {
                ...slimStore,
                hasAvatar: !!(avatarDataUrl || slimStore.hasAvatar),
                hasCover: !!(coverDataUrl || slimStore.hasCover),
            };
        }

        const stripQuintetBlobs = options.prepareOnly === true && !stageId;
        if (stripQuintetBlobs && quintet?.designs?.length) {
            quintet = {
                ...quintet,
                designs: quintet.designs.map((d) => {
                    const { base64, ...meta } = d;
                    return { ...meta, hasBase64: !!base64 };
                }),
            };
        }

        return {
            email: payload.email,
            pass: payload.pass,
            niche: payload.niche,
            storeProfile,
            quintet,
        };
    }

    async function buildAccountPayload(email, options = {}) {
        const sched = getScheduler();
        const normalized = normEmail(email);
        const creds = await loadAccountCredentials(normalized);
        if (!creds?.email) {
            return { email: normalized, ok: false, error: 'account_not_found' };
        }

        if (sched?.assessAccountScheduleReadiness) {
            const check = await sched.assessAccountScheduleReadiness(normalized, { strictStore: false });
            if (!check.activated) {
                return { email: normalized, ok: false, error: 'account_not_activated', reason: check.reason };
            }
        }

        let storeResult = await prepareStoreInExtension(normalized, options);
        if (!storeResult.ok) {
            return { email: normalized, ok: false, error: storeResult.error };
        }

        let quintet = await buildQuintetPayload(normalized, options);
        if ((!quintet?.designs?.length || quintet.designs.length < 5) && options.autoGenerateQuintet !== false) {
            try {
                await generateQuintetViaGenerateApi(normalized, storeResult, options);
                quintet = await buildQuintetPayload(normalized, { ...options, autoAssignQuintet: true });
            } catch (err) {
                broadcastLog(`❌ GENERAT quintet failed: ${err.message}`, 'error', normalized);
                return { email: normalized, ok: false, error: String(err.message || err) };
            }
        }
        if (!quintet?.designs?.length || quintet.designs.length < 5) {
            return { email: normalized, ok: false, error: 'quintet_required' };
        }
        const missingBlob = quintet.designs.some((d) => !d.base64);
        if (missingBlob) {
            return { email: normalized, ok: false, error: 'quintet_blob_missing' };
        }

        storeResult = await ensureStoreImagesAfterQuintet(normalized, storeResult, quintet, options);

        await markAccountScheduleReady(normalized, true, {
            niche: storeResult.niche,
            storeTitle: storeResult.profile?.title || '',
            groupId: quintet.groupId,
        });

        return {
            ok: true,
            email: normalized,
            pass: creds.pass,
            storeProfile: storeResult.profile,
            niche: storeResult.niche,
            quintet,
        };
    }

    async function orchestrateBatch(request = {}) {
        const serverOnline = await pingCreatyServer();
        if (!serverOnline) {
            return { success: false, error: 'creaty_server_offline', hint: 'Start Creaty Server on port 3020' };
        }

        const options = request.options && typeof request.options === 'object'
            ? request.options
            : {
                phaseMode: request.phaseMode || request.phaseAdvanceMode || 'auto',
                prepareOnly: true,
                startPhase1: false,
                prepareStore: request.prepareStore !== false,
                generateImages: request.generateImages === true,
                autoGenerateQuintet: request.autoGenerateQuintet !== false,
                autoAssignQuintet: request.autoAssignQuintet !== false,
                daysBetween: request.daysBetween,
                designCount: request.designCount,
                startDate: request.startDate,
                skipStoreSetup: request.skipStoreSetup === true,
                ghostPort: request.ghostPort || CREATY_GHOST_PORT,
            };

        const mode = String(request.selectionMode || request.mode || 'single').toLowerCase();
        const countLimit = Math.min(50, Math.max(1, Number(request.accountCount || request.countLimit) || 1));
        const singleEmail = String(request.accountEmail || request.email || '').trim();
        const multiEmails = Array.isArray(request.accountEmails)
            ? request.accountEmails.map((e) => String(e || '').trim()).filter(Boolean)
            : [];

        let emails = [];
        if (mode === 'all') {
            const sched = getScheduler();
            if (sched?.listActivatedAccounts) {
                const activated = await sched.listActivatedAccounts();
                emails = activated.map((a) => String(a.email).trim());
            }
        } else if (mode === 'multi') {
            emails = multiEmails.length ? multiEmails : (singleEmail ? [singleEmail] : []);
        } else {
            emails = singleEmail ? [singleEmail] : [];
        }

        const seen = new Set();
        emails = emails.filter((e) => {
            const k = normEmail(e);
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return true;
        }).slice(0, countLimit);

        if (!emails.length) {
            return { success: false, error: 'no_accounts_selected' };
        }

        broadcastLog(`🎯 AI Prepare — ${emails.length} account(s) → Creaty Server / إرسال للسيرفر…`, 'info');

        const accounts = [];
        const skipped = [];
        for (const email of emails) {
            broadcastLog(`📋 Preparing ${email}… / تجهيز…`, 'info', email);
            const payload = await buildAccountPayload(email, {
                ...options,
                niche: options.niche || request.niche || '',
            });
            if (!payload.ok) {
                skipped.push({ email, error: payload.error });
                broadcastLog(`⏭️ Skip ${email}: ${payload.error}`, 'warn', email);
                continue;
            }
            accounts.push(slimPayloadForPrepare({
                email: payload.email,
                pass: payload.pass,
                niche: payload.niche,
                storeProfile: payload.storeProfile,
                quintet: payload.quintet,
            }, { ...options, prepareOnly: options.prepareOnly !== false }));
        }

        if (!accounts.length) {
            return { success: false, error: 'no_ready_payloads', skipped };
        }

        try {
            const serverResult = await fetchCreatyServer('/orchestrate/prepare', {
                method: 'POST',
                body: JSON.stringify({ accounts, options }),
                timeoutMs: 300000,
            });

            broadcastLog(
                `✅ Creaty Server: ${serverResult.started || 0}/${serverResult.total || accounts.length} started / بدأ ${serverResult.started || 0}`,
                serverResult.ok ? 'success' : 'warn'
            );

            return {
                success: serverResult.ok !== false,
                server: serverResult,
                prepared: accounts.length,
                skipped,
                phaseMode: options.phaseMode,
            };
        } catch (err) {
            broadcastLog(`❌ Creaty Server error: ${err.message}`, 'error');
            return { success: false, error: String(err.message || err), skipped };
        }
    }

    async function advancePhaseOnServer(email) {
        const serverOnline = await pingCreatyServer();
        if (!serverOnline) return { success: false, error: 'creaty_server_offline' };
        try {
            const result = await fetchCreatyServer('/orchestrate/advance-phase', {
                method: 'POST',
                body: JSON.stringify({ email, accountEmail: email }),
                timeoutMs: 3600000,
            });
            broadcastLog(`▶️ Phase advanced for ${email} / تمت المرحلة التالية`, 'success', email);
            return { success: result.ok !== false, ...result };
        } catch (err) {
            return { success: false, error: String(err.message || err) };
        }
    }

    async function ensureAccountPreparedOnServer(email, options = {}) {
        const normalized = normEmail(email);
        const stageId = String(options.stageId || options.stage || '').trim();
        const status = await getServerOrchestrateStatus(normalized);
        const schedule = status?.schedule;
        const quintetReady = (schedule?.quintet?.designs?.length || 0) >= 5;
        const foundationPhase = schedule?.phases?.find((p) => p.id === 'foundation');
        const foundationPending = foundationPhase
            && foundationPhase.status !== 'done'
            && foundationPhase.status !== 'skipped';

        const quintetMissingBlobs = (schedule?.quintet?.designs || []).some((d) => !d.base64);

        // Foundation must always sync fresh credentials + store profile to Ghost (status API strips account.pass).
        const mustRefreshPayload = !quintetReady
            || stageId === 'foundation'
            || (foundationPending && !schedule?.storeProfileAppliedAt)
            || (stageId && stageId !== 'foundation' && quintetMissingBlobs);

        if (quintetReady && !mustRefreshPayload) {
            return { ok: true, prepared: true, cached: true };
        }

        const payload = await buildAccountPayload(normalized, options);
        if (!payload.ok) return { ok: false, error: payload.error };
        if (!payload.pass) return { ok: false, error: 'account_credentials_missing' };

        const slim = slimPayloadForPrepare(payload, options);
        const serverResult = await fetchCreatyServer('/orchestrate/prepare', {
            method: 'POST',
            body: JSON.stringify({
                accounts: [slim],
                options: {
                    prepareOnly: true,
                    startPhase1: false,
                    phaseMode: 'manual',
                    skipStoreSetup: options.skipStoreSetup === true,
                    autoGenerateQuintet: options.autoGenerateQuintet !== false,
                    ghostPort: options.ghostPort || CREATY_GHOST_PORT,
                },
            }),
            timeoutMs: 300000,
        });
        if (serverResult.ok === false) {
            const err = serverResult.results?.find((r) => r.error)?.error || serverResult.error || 'prepare_failed';
            return { ok: false, error: err, server: serverResult };
        }
        return { ok: true, prepared: true, server: serverResult };
    }

    async function runStageOnServer(email, stageId, options = {}) {
        const normalized = normEmail(email);
        const stage = String(stageId || '').trim();
        if (!normalized || !stage) return { success: false, error: 'email_and_stage_required' };

        const serverOnline = await pingCreatyServer();
        if (!serverOnline) return { success: false, error: 'creaty_server_offline' };

        const prep = await ensureAccountPreparedOnServer(normalized, { ...options, stageId: stage });
        if (!prep.ok) return { success: false, error: prep.error || 'prepare_failed' };

        broadcastLog(`▶️ Stage ${stage} — ${normalized} / بدء المرحلة`, 'info', normalized);
        try {
            const result = await fetchCreatyServer('/orchestrate/run-stage', {
                method: 'POST',
                body: JSON.stringify({ email: normalized, accountEmail: normalized, stageId: stage }),
                timeoutMs: 3600000,
            });
            if (result.ok) {
                broadcastLog(`✅ Stage ${stage} done / اكتملت المرحلة`, 'success', normalized);
            } else {
                const errText = result.error || result.results?.find((r) => r.error)?.error || 'stage_failed';
                broadcastLog(`❌ Stage ${stage} failed: ${errText}`, 'error', normalized);
            }
            return { success: result.ok !== false, ...result };
        } catch (err) {
            return { success: false, error: String(err.message || err) };
        }
    }

    async function resetPhaseOnServer(email, stageId) {
        const normalized = normEmail(email);
        const stage = String(stageId || '').trim();
        if (!normalized || !stage) return { success: false, error: 'email_and_stage_required' };

        const serverOnline = await pingCreatyServer();
        if (!serverOnline) return { success: false, error: 'creaty_server_offline' };

        try {
            const result = await fetchCreatyServer('/orchestrate/reset-stage', {
                method: 'POST',
                body: JSON.stringify({ email: normalized, accountEmail: normalized, stageId: stage }),
                timeoutMs: 30000,
            });
            broadcastLog(`↩️ Stage reset ${stage} — ${normalized} / إعادة تعيين المرحلة`, 'warn', normalized);
            return { success: result.ok !== false, ...result };
        } catch (err) {
            return { success: false, error: String(err.message || err) };
        }
    }

    async function stopStageOnServer(email, stageId) {
        const normalized = normEmail(email);
        const stage = String(stageId || '').trim();
        if (!normalized || !stage) return { success: false, error: 'email_and_stage_required' };

        const serverOnline = await pingCreatyServer();
        if (!serverOnline) return { success: false, error: 'creaty_server_offline' };

        broadcastLog(`⏹️ Stop stage ${stage} — ${normalized} / إيقاف المرحلة`, 'warn', normalized);
        try {
            const result = await fetchCreatyServer('/orchestrate/stop-stage', {
                method: 'POST',
                body: JSON.stringify({ email: normalized, accountEmail: normalized, stageId: stage }),
                timeoutMs: 30000,
            });
            return { success: result.ok !== false, ...result };
        } catch (err) {
            return { success: false, error: String(err.message || err) };
        }
    }

    async function getServerOrchestrateStatus(email = null) {
        const q = email ? `?email=${encodeURIComponent(email)}` : '';
        try {
            return await fetchCreatyServer(`/orchestrate/status${q}`, { method: 'GET', timeoutMs: 8000 });
        } catch (err) {
            return { ok: false, error: String(err.message || err) };
        }
    }

    async function handleAction(request) {
        const action = request?.action;
        if (action === 'CREATY_AI_ORCHESTRATE') {
            return orchestrateBatch(request);
        }
        if (action === 'CREATY_AI_ORCHESTRATE_STATUS') {
            const email = String(request?.accountEmail || request?.email || '').trim();
            return getServerOrchestrateStatus(email || null);
        }
        if (action === 'CREATY_AI_ADVANCE_PHASE') {
            const email = String(request?.accountEmail || request?.email || '').trim();
            if (!email) return { success: false, error: 'email_required' };
            return advancePhaseOnServer(email);
        }
        if (action === 'CREATY_AI_RUN_STAGE') {
            const email = String(request?.accountEmail || request?.email || '').trim();
            const stageId = String(request?.stageId || request?.stage || '').trim();
            if (!email) return { success: false, error: 'email_required' };
            if (!stageId) return { success: false, error: 'stage_required' };
            return runStageOnServer(email, stageId, request.options || {});
        }
        if (action === 'CREATY_AI_STOP_STAGE') {
            const email = String(request?.accountEmail || request?.email || '').trim();
            const stageId = String(request?.stageId || request?.stage || '').trim();
            if (!email) return { success: false, error: 'email_required' };
            if (!stageId) return { success: false, error: 'stage_required' };
            return stopStageOnServer(email, stageId);
        }
        if (action === 'CREATY_AI_RESET_PHASE') {
            const email = String(request?.accountEmail || request?.email || '').trim();
            const stageId = String(request?.stageId || request?.stage || '').trim();
            if (!email) return { success: false, error: 'email_required' };
            if (!stageId) return { success: false, error: 'stage_required' };
            return resetPhaseOnServer(email, stageId);
        }
        return null;
    }

    global.CreatyAiOrchestrator = {
        handleAction,
        orchestrateBatch,
        buildAccountPayload,
        advancePhaseOnServer,
        runStageOnServer,
        stopStageOnServer,
        resetPhaseOnServer,
        ensureAccountPreparedOnServer,
        getServerOrchestrateStatus,
        pingCreatyServer,
        CREATY_SERVER_BASE,
    };
})(typeof self !== 'undefined' ? self : globalThis);
