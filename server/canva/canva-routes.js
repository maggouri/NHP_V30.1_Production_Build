'use strict';

/** Bump when Canva API routes change (settings modal reads v2+). */
const CANVA_API_ROUTES_VERSION = 6;

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
    getCanvaConfig,
    getCanvaSettingsPublic,
    updateCanvaEnvFile,
    isValidCanvaClientId,
    getDefaultCanvaRedirectUri,
    clearCanvaTokens,
    getRequiredScopesList,
    getStoredTokenScopes,
    tokenScopesAreStale,
    CANVA_OAUTH_SCOPES
} = require('./canva-config');
const {
    buildAuthStartUrl,
    exchangeCodeForTokens,
    mockConnect,
    peekOAuthState,
    deletePendingState,
    buildOAuthStateErrorHtml,
    buildOAuthCallbackErrorHtml,
    buildOAuthCallbackSuccessHtml
} = require('./canva-oauth');
const { uploadAssetFromFile, formatCanvaUploadError } = require('./canva-assets');
const { createDesignFromAsset, createBlankDesign, openDesign } = require('./canva-designs');
const { exportAndDownloadDesignPng } = require('./canva-export');
const {
    sanitizeDisplayName,
    sanitizeLibraryFileName,
    safeLibraryFileSegment
} = require('../library-smart-rename');
const {
    parseLibraryDesignId,
    resolveLibraryDesignFilePath
} = require('../library-design-files');

const sessionStore = new Map();

function resolveLibraryPaths(rootDir) {
    const generatedDir = path.join(rootDir, 'generated_designs');
    const libraryDir = path.join(generatedDir, 'library');
    const libraryIndex = path.join(libraryDir, 'index.json');
    return { generatedDir, libraryDir, libraryIndex };
}

function readLibraryIndex(libraryIndex) {
    try {
        if (!fs.existsSync(libraryIndex)) return [];
        const parsed = JSON.parse(fs.readFileSync(libraryIndex, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function writeLibraryIndex(libraryIndex, entries) {
    fs.mkdirSync(path.dirname(libraryIndex), { recursive: true });
    fs.writeFileSync(libraryIndex, JSON.stringify(entries.slice(0, 500), null, 2), 'utf8');
}

async function resolveDesignFilePath(rootDir, libraryId, fileNameHint = '') {
    const { libraryDir, libraryIndex } = resolveLibraryPaths(rootDir);
    const parsed = parseLibraryDesignId(libraryId);
    const libDir = path.join(libraryDir, parsed.storageId);

    const index = readLibraryIndex(libraryIndex);
    const indexEntry = index.find((e) => e.id === parsed.id || e.id === libraryId);

    let meta = null;
    try {
        const metaPath = path.join(libDir, 'meta.json');
        if (fs.existsSync(metaPath)) {
            meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }
    } catch (_) { /* ignore */ }

    const resolved = await resolveLibraryDesignFilePath(libDir, libraryId, {
        indexEntry,
        meta,
        fileNameHint
    });
    return { filePath: resolved.filePath, parsed: resolved.parsed, libDir };
}

function getSession(sessionId) {
    return sessionStore.get(String(sessionId || '')) || null;
}

function putSession(sessionId, data) {
    sessionStore.set(String(sessionId), { ...data, updatedAt: Date.now() });
    return sessionStore.get(String(sessionId));
}

const CANVA_MOCK_BLANK_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

function resolveLibraryDisplayNameForCanva(libraryIndex, libraryDir, rawId) {
    const parsed = parseLibraryDesignId(rawId);
    const id = String(rawId || '').trim();
    if (!id) return '';

    const index = readLibraryIndex(libraryIndex);
    const entry = index.find((e) => e.id === parsed.id || e.id === id);
    if (entry?.displayName) return sanitizeDisplayName(entry.displayName);
    if (entry?.title) return sanitizeDisplayName(entry.title);

    const libDir = path.join(libraryDir, parsed.storageId);
    let meta = null;
    try {
        const metaPath = path.join(libDir, 'meta.json');
        if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (_) { /* ignore */ }

    if (meta?.displayName) return sanitizeDisplayName(meta.displayName);
    if (parsed.isDesign && parsed.designIndex) {
        const di = parsed.designIndex - 1;
        if (Array.isArray(meta?.displayNames) && meta.displayNames[di]) {
            return sanitizeDisplayName(meta.displayNames[di]);
        }
        const splits = (meta?.files || []).filter((f) =>
            f.role === 'split' || /^design_\d+\.png$/i.test(f.name)
        );
        if (splits[di]?.displayName) return sanitizeDisplayName(splits[di].displayName);
    }
    if (meta?.promptPreview) return sanitizeDisplayName(meta.promptPreview);

    const origId = String(entry?.originalDesignId || meta?.originalDesignId || '').trim();
    if (origId && origId !== id && origId !== parsed.id) {
        const inherited = resolveLibraryDisplayNameForCanva(libraryIndex, libraryDir, origId);
        if (inherited) return inherited;
    }
    return '';
}

function saveCanvaVersionToLibrary(rootDir, {
    originalDesignId,
    canvaDesignId,
    sourceFilePath,
    promptPreview = '',
    versionLabel = 'Canva Edited',
    blankOriginal = false,
    displayName: overrideDisplayName = ''
}, log = () => {}) {
    const { libraryDir, libraryIndex } = resolveLibraryPaths(rootDir);
    const libId = `canva_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const libDir = path.join(libraryDir, libId);
    fs.mkdirSync(libDir, { recursive: true });

    let displayName = sanitizeDisplayName(overrideDisplayName);
    if (!displayName && !blankOriginal && originalDesignId) {
        displayName = resolveLibraryDisplayNameForCanva(libraryIndex, libraryDir, originalDesignId);
    }
    if (!displayName) {
        displayName = sanitizeDisplayName(promptPreview || versionLabel || 'Canva edited');
    }

    const fileName = sanitizeLibraryFileName(displayName);
    const destPath = path.join(libDir, fileName);
    fs.copyFileSync(sourceFilePath, destPath);
    const createdAt = new Date().toISOString();
    const preview = displayName.slice(0, 120);
    const meta = {
        id: libId,
        createdAt,
        prompt: displayName.slice(0, 2000),
        promptPreview: preview,
        displayName,
        source: 'canva',
        versionLabel,
        canvaDesignId,
        files: [{ name: fileName, role: 'split', displayName, url: `/api/library/${libId}/file/${fileName}` }]
    };
    if (blankOriginal) {
        meta.blankOriginal = true;
    } else {
        meta.originalDesignId = originalDesignId;
    }
    fs.writeFileSync(path.join(libDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
    const designId = `${libId}__d1`;
    const index = readLibraryIndex(libraryIndex);
    const indexEntry = {
        id: designId,
        storageId: libId,
        createdAt,
        promptPreview: preview,
        displayName,
        title: displayName,
        designIndex: 1,
        designTotal: 1,
        fileName,
        thumbUrl: `/api/library/${libId}/file/${fileName}`,
        role: 'design',
        source: 'canva',
        versionLabel,
        canvaDesignId
    };
    if (blankOriginal) {
        indexEntry.blankOriginal = true;
    } else {
        indexEntry.originalDesignId = originalDesignId;
    }
    index.unshift(indexEntry);
    writeLibraryIndex(libraryIndex, index);
    log(`Canva version saved to library: ${designId} (${fileName})`, 'INFO');
    return {
        libraryId: designId,
        storageId: libId,
        displayName,
        fileName,
        thumbUrl: `/api/library/${libId}/file/${fileName}`,
        meta
    };
}

function registerCanvaRoutes(app, { rootDir, logFn = console.log } = {}) {
    const log = (msg, type = 'INFO') => logFn(`[Canva] ${msg}`, type);

    app.get('/api/canva/status', (_req, res) => {
        const cfg = getCanvaConfig(rootDir);
        const requiredScopes = getRequiredScopesList();
        const grantedScopes = getStoredTokenScopes(rootDir);
        const scopesStale = cfg.connected && !cfg.mockMode && tokenScopesAreStale(rootDir);
        const needsReconnect = scopesStale;
        log('Status check', 'INFO');
        return res.json({
            success: true,
            mockMode: cfg.mockMode,
            connected: cfg.connected && !needsReconnect,
            connectedWithStaleScopes: cfg.connected && needsReconnect,
            hasClientId: !!cfg.clientId,
            hasSecret: !!cfg.clientSecret,
            redirectUri: cfg.redirectUri,
            scopes: CANVA_OAUTH_SCOPES,
            requiredScopes,
            grantedScopes,
            scopesStale,
            needsReconnect,
            message: cfg.mockMode
                ? 'Canva credentials not configured.'
                : (needsReconnect
                    ? 'Connected but token lacks required scopes — reconnect required'
                    : (cfg.connected ? 'Connected to Canva' : 'Not connected to Canva'))
        });
    });

    app.get('/api/canva/settings', (_req, res) => {
        try {
            const settings = getCanvaSettingsPublic(rootDir);
            log('Settings read', 'INFO');
            return res.json({ success: true, ...settings });
        } catch (err) {
            log(`Settings read failed: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/canva/settings', (req, res) => {
        try {
            const body = req.body || {};
            const clientId = String(body.clientId || '').trim();
            const clientSecretRaw = String(body.clientSecret || '').trim();
            const redirectUri = String(body.redirectUri || '').trim() || getDefaultCanvaRedirectUri();

            if (!clientId) {
                return res.status(400).json({ success: false, error: 'Client ID مطلوب' });
            }
            if (!isValidCanvaClientId(clientId)) {
                return res.status(400).json({
                    success: false,
                    error: 'صيغة Client ID غير صحيحة (مثال: OC-AZ8LCwZlJ92z)'
                });
            }

            const current = getCanvaConfig(rootDir);
            const keepExistingSecret = !clientSecretRaw
                || clientSecretRaw === '••••••'
                || /^•+$/.test(clientSecretRaw);
            const clientSecret = keepExistingSecret ? current.clientSecret : clientSecretRaw;

            if (!clientSecret) {
                return res.status(400).json({ success: false, error: 'Client Secret مطلوب' });
            }

            if (redirectUri && !/^https?:\/\//i.test(redirectUri)) {
                return res.status(400).json({ success: false, error: 'Redirect URI غير صالح' });
            }

            const cfg = updateCanvaEnvFile(rootDir, { clientId, clientSecret, redirectUri });
            log(`Settings saved (clientId=${clientId.slice(0, 5)}…)`, 'INFO');
            const settings = getCanvaSettingsPublic(rootDir);
            return res.json({
                success: true,
                mockMode: cfg.mockMode,
                ...settings,
                message: 'تم حفظ إعدادات Canva في ملف .env'
            });
        } catch (err) {
            log(`Settings save failed: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/api/canva/auth/start', (req, res) => {
        try {
            const start = buildAuthStartUrl(rootDir, log);
            if (start.mockMode && req.query.mock === '1') {
                mockConnect(rootDir, start.state, log);
                return res.json({
                    success: true,
                    mockMode: true,
                    connected: true,
                    message: 'Mock Canva connection established'
                });
            }
            log(`Auth start (mock=${start.mockMode})`, 'INFO');
            return res.json({ success: true, ...start });
        } catch (err) {
            log(`Auth start failed: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/api/canva/auth/callback', async (req, res) => {
        try {
            const { code, state, error } = req.query || {};
            if (error) {
                log(`OAuth callback error: ${error}`, 'ERROR');
                return res.status(400).send(buildOAuthCallbackErrorHtml({
                    title: 'رفض Canva التفويض',
                    message: 'ألغيتَ الربط أو رفضتَ الأذونات في Canva.',
                    code: String(error)
                }));
            }
            const entry = peekOAuthState(rootDir, state, log);
            if (!entry) {
                const reason = state ? 'expired' : 'missing';
                return res.status(400).send(buildOAuthStateErrorHtml(reason));
            }
            if (entry.mock) {
                mockConnect(rootDir, state, log);
                return res.send(buildOAuthCallbackSuccessHtml({
                    title: 'Canva mock connected',
                    message: 'Mock connection established — this window will close automatically.'
                }));
            }
            await exchangeCodeForTokens(rootDir, code, log, { codeVerifier: entry.codeVerifier });
            deletePendingState(rootDir, state, log);
            return res.send(buildOAuthCallbackSuccessHtml({
                title: 'تم ربط Canva',
                message: 'تم الاتصال بنجاح — يمكنك العودة إلى NHP HuntPro.'
            }));
        } catch (err) {
            log(`OAuth callback failed: ${err.message}`, 'ERROR');
            return res.status(err.status || 500).send(buildOAuthCallbackErrorHtml({
                title: 'فشل ربط Canva',
                message: err.message || 'تعذّر تبادل رمز OAuth مع Canva.',
                code: err.code || ''
            }));
        }
    });

    app.post('/api/canva/auth/disconnect', (_req, res) => {
        try {
            clearCanvaTokens(rootDir);
            log('Canva OAuth tokens cleared (json + .env + memory)', 'INFO');
            return res.json({
                success: true,
                connected: false,
                message: 'تم قطع الاتصال بـ Canva — اضغط Connect Canva أو «إعادة الربط» للحصول على توكن جديد بكل الصلاحيات'
            });
        } catch (err) {
            log(`Disconnect failed: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/canva/auth/reconnect', (req, res) => {
        try {
            clearCanvaTokens(rootDir);
            const start = buildAuthStartUrl(rootDir, log);
            if (start.mockMode && req.body?.mock === true) {
                mockConnect(rootDir, start.state, log);
                return res.json({
                    success: true,
                    mockMode: true,
                    connected: true,
                    message: 'Mock Canva reconnection established'
                });
            }
            log('Canva reconnect: tokens cleared, OAuth start issued', 'INFO');
            return res.json({
                success: true,
                disconnected: true,
                ...start,
                message: 'تم مسح التوكن القديم — أكمل تسجيل الدخول في نافذة Canva'
            });
        } catch (err) {
            log(`Reconnect failed: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/canva/upload-design', async (req, res) => {
        try {
            const { libraryId, sessionId, title, fileName: fileNameHint } = req.body || {};
            if (!libraryId) return res.status(400).json({ success: false, error: 'libraryId required' });
            const { filePath, parsed } = await resolveDesignFilePath(rootDir, libraryId, fileNameHint);
            const upload = await uploadAssetFromFile(rootDir, filePath, {
                name: parsed.fileName,
                log
            });
            const sid = sessionId || crypto.randomBytes(8).toString('hex');
            const session = putSession(sid, {
                libraryId: parsed.id,
                storageId: parsed.storageId,
                fileName: parsed.fileName,
                assetId: upload.assetId,
                title: title || 'NHP HuntPro Design',
                step: 'uploaded'
            });
            log(`Upload design ${parsed.id} → asset ${upload.assetId}`, 'INFO');
            return res.json({
                success: true,
                sessionId: sid,
                assetId: upload.assetId,
                mockMode: upload.mockMode,
                step: session.step
            });
        } catch (err) {
            log(`Upload design failed: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: formatCanvaUploadError(err) });
        }
    });

    app.post('/api/canva/create-design', async (req, res) => {
        try {
            const { sessionId, assetId, title, blank } = req.body || {};
            if (blank === true) {
                const sid = sessionId || crypto.randomBytes(8).toString('hex');
                const created = await createBlankDesign(rootDir, { title, log });
                putSession(sid, {
                    canvaDesignId: created.designId,
                    editUrl: created.editUrl,
                    step: 'created',
                    blank: true,
                    width: created.width,
                    height: created.height
                });
                log(`Create blank design ${created.designId}`, 'INFO');
                return res.json({ success: true, ...created, sessionId: sid, step: 'created' });
            }
            const session = getSession(sessionId);
            const resolvedAssetId = assetId || session?.assetId;
            if (!resolvedAssetId) return res.status(400).json({ success: false, error: 'assetId or sessionId required' });
            const created = await createDesignFromAsset(rootDir, resolvedAssetId, {
                title: title || session?.title,
                log
            });
            if (sessionId) {
                putSession(sessionId, {
                    ...session,
                    assetId: resolvedAssetId,
                    canvaDesignId: created.designId,
                    editUrl: created.editUrl,
                    step: 'created'
                });
            }
            log(`Create design ${created.designId}`, 'INFO');
            return res.json({ success: true, ...created, sessionId, step: 'created' });
        } catch (err) {
            log(`Create design failed: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/canva/create-blank-design', async (req, res) => {
        try {
            const { sessionId, title, width, height } = req.body || {};
            const sid = sessionId || crypto.randomBytes(8).toString('hex');
            const created = await createBlankDesign(rootDir, { title, width, height, log });
            putSession(sid, {
                canvaDesignId: created.designId,
                editUrl: created.editUrl,
                step: 'created',
                blank: true,
                width: created.width,
                height: created.height
            });
            log(`Create blank design ${created.designId} (${created.width}×${created.height})`, 'INFO');
            return res.json({
                success: true,
                ...created,
                sessionId: sid,
                step: 'created'
            });
        } catch (err) {
            log(`Create blank design failed: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/canva/open-design', async (req, res) => {
        try {
            const { sessionId, designId } = req.body || {};
            const session = getSession(sessionId);
            const resolvedDesignId = designId || session?.canvaDesignId;
            if (!resolvedDesignId) return res.status(400).json({ success: false, error: 'designId or sessionId required' });
            const opened = await openDesign(rootDir, resolvedDesignId, { log });
            if (sessionId) {
                putSession(sessionId, { ...session, canvaDesignId: opened.designId, editUrl: opened.editUrl, step: 'opened' });
            }
            log(`Open design ${opened.designId}`, 'INFO');
            return res.json({ success: true, ...opened, sessionId, step: 'opened' });
        } catch (err) {
            log(`Open design failed: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/canva/import-edited', async (req, res) => {
        try {
            const {
                sessionId,
                libraryId,
                canvaDesignId,
                originalDesignId,
                blank,
                title
            } = req.body || {};
            const session = getSession(sessionId);
            const designId = canvaDesignId || session?.canvaDesignId;
            const isBlank = !!(blank || session?.blank);
            const origId = originalDesignId || libraryId || session?.libraryId;

            if (!isBlank && !origId) {
                return res.status(400).json({ success: false, error: 'original library design id required' });
            }
            if (!designId) {
                return res.status(400).json({ success: false, error: 'Canva design id required' });
            }

            const cfg = getCanvaConfig(rootDir);
            const tempDir = path.join(rootDir, 'temp_uploads', 'canva_imports');
            fs.mkdirSync(tempDir, { recursive: true });
            const importPath = path.join(tempDir, `import_${Date.now()}.png`);

            let promptPreview = String(title || session?.title || '').trim();
            let resolvedOriginalId = null;
            let importTransparency = { hadNativeAlpha: false, bgRemovedLocally: false };

            if (isBlank) {
                if (cfg.mockMode) {
                    fs.writeFileSync(importPath, CANVA_MOCK_BLANK_PNG);
                    log(`Mock import blank Canva design ${designId}`, 'INFO');
                } else {
                    const dl = await exportAndDownloadDesignPng(rootDir, designId, importPath, { log });
                    if (!dl.downloaded) {
                        throw new Error('فشل تصدير التصميم الفارغ من Canva');
                    }
                    importTransparency = {
                        hadNativeAlpha: !!dl.hadNativeAlpha,
                        bgRemovedLocally: !!dl.bgRemovedLocally
                    };
                }
                if (!promptPreview) promptPreview = 'NHP Blank 5000×5000';
            } else {
                const { filePath: sourcePath, parsed } = await resolveDesignFilePath(rootDir, origId);
                resolvedOriginalId = parsed.id;

                if (cfg.mockMode) {
                    fs.copyFileSync(sourcePath, importPath);
                    log(`Mock import edited design from ${parsed.id}`, 'INFO');
                } else if (designId) {
                    const dl = await exportAndDownloadDesignPng(rootDir, designId, importPath, { log });
                    if (!dl.downloaded) {
                        throw new Error('فشل تصدير التصميم المعدّل من Canva');
                    }
                    importTransparency = {
                        hadNativeAlpha: !!dl.hadNativeAlpha,
                        bgRemovedLocally: !!dl.bgRemovedLocally
                    };
                } else {
                    fs.copyFileSync(sourcePath, importPath);
                }

                if (!promptPreview) {
                    try {
                        const metaPath = path.join(path.dirname(sourcePath), 'meta.json');
                        if (fs.existsSync(metaPath)) {
                            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                            promptPreview = meta.promptPreview || meta.prompt || '';
                        }
                    } catch (_) { /* ignore */ }
                }
            }

            if (sessionId) {
                putSession(sessionId, {
                    ...session,
                    importPath,
                    originalDesignId: resolvedOriginalId,
                    canvaDesignId: designId,
                    blank: isBlank,
                    promptPreview,
                    step: 'imported'
                });
            }

            return res.json({
                success: true,
                mockMode: cfg.mockMode,
                importPath,
                blank: isBlank,
                originalDesignId: resolvedOriginalId,
                canvaDesignId: designId,
                promptPreview,
                step: 'imported',
                hadNativeAlpha: importTransparency.hadNativeAlpha,
                bgRemovedLocally: importTransparency.bgRemovedLocally
            });
        } catch (err) {
            log(`Import edited failed: ${err.message}`, 'ERROR');
            const status = /required|not found/i.test(err.message) ? 400 : 500;
            return res.status(status).json({ success: false, error: err.message, step: 'import_failed' });
        }
    });

    app.post('/api/canva/save-version', async (req, res) => {
        try {
            const {
                sessionId,
                originalDesignId,
                canvaDesignId,
                importPath,
                promptPreview,
                versionLabel,
                blank,
                blankOriginal,
                title,
                displayName
            } = req.body || {};
            const session = getSession(sessionId);
            const isBlank = !!(blank || blankOriginal || session?.blank);
            const origId = originalDesignId || session?.libraryId || session?.originalDesignId;
            const srcPath = importPath || session?.importPath;
            if (!srcPath || !fs.existsSync(srcPath)) {
                return res.status(400).json({ success: false, error: 'importPath required' });
            }
            if (!isBlank && !origId) {
                return res.status(400).json({ success: false, error: 'importPath and originalDesignId required' });
            }
            const saved = saveCanvaVersionToLibrary(rootDir, {
                originalDesignId: origId,
                canvaDesignId: canvaDesignId || session?.canvaDesignId,
                sourceFilePath: srcPath,
                promptPreview: promptPreview || session?.promptPreview || title || 'NHP Blank 5000×5000',
                versionLabel: versionLabel || 'Canva Edited',
                blankOriginal: isBlank,
                displayName: displayName || title || session?.displayName || ''
            }, log);
            if (sessionId) {
                putSession(sessionId, { ...session, savedLibraryId: saved.libraryId, step: 'saved' });
            }
            return res.json({ success: true, ...saved, step: 'saved' });
        } catch (err) {
            log(`Save version failed: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/canva/send-to-seo', async (req, res) => {
        try {
            const { libraryId, sessionId, fileName: fileNameHint } = req.body || {};
            const session = getSession(sessionId);
            const targetId = libraryId || session?.savedLibraryId || session?.libraryId;
            if (!targetId) return res.status(400).json({ success: false, error: 'libraryId required' });
            const { filePath, parsed } = await resolveDesignFilePath(rootDir, targetId, fileNameHint);
            const imageBase64 = fs.readFileSync(filePath).toString('base64');
            const { libraryDir, libraryIndex } = resolveLibraryPaths(rootDir);
            const index = readLibraryIndex(libraryIndex);
            const indexEntry = index.find((e) => e.id === parsed.id || e.id === targetId);
            let meta = null;
            try {
                const metaPath = path.join(libraryDir, parsed.storageId, 'meta.json');
                if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            } catch (_) { /* ignore */ }
            const displayName = sanitizeDisplayName(
                indexEntry?.displayName
                || indexEntry?.title
                || meta?.displayName
                || meta?.promptPreview
                || ''
            );
            const fileName = parsed.fileName || indexEntry?.fileName || 'design.png';
            log(`Send to SEO payload prepared: ${parsed.id} (${displayName || fileName})`, 'INFO');
            return res.json({
                success: true,
                libraryId: parsed.id,
                storageId: parsed.storageId,
                displayName,
                fileName,
                thumbUrl: `/api/library/${parsed.storageId}/file/${fileName}`,
                imageBase64,
                step: 'seo_ready'
            });
        } catch (err) {
            log(`Send to SEO failed: ${err.message}`, 'ERROR');
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    log('Canva routes registered', 'INFO');
}

module.exports = { registerCanvaRoutes, saveCanvaVersionToLibrary, CANVA_API_ROUTES_VERSION };
