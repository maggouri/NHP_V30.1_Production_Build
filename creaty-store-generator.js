/**
 * CREATY Column 2 Tab 2 — Store profile generation via CLIProxyAPI (OpenAI-compatible).
 * Generates title, bio, fake social links, and image prompts for TeePublic store setup.
 * When niche is empty, auto-picks niche via CLIProxyAPI from account + quintet SEO (Column 3).
 */
(function initCreatyStoreGenerator(global) {
    'use strict';

    if (global.CreatyStoreGenerator) return;

    const Ai = () => (typeof NhpAiCliproxy !== 'undefined' ? NhpAiCliproxy : null);
    /** TeePublic store image targets — avatar is square; cover is wide banner (4:1). */
    const CREATY_STORE_IMAGE_SPECS = Object.freeze({
        avatar: {
            width: 500,
            height: 500,
            aspect: '1:1',
            /** OpenAI/CLIProxy square generation size (resize target noted in prompt). */
            apiSize: '1024x1024',
            label: '500×500',
        },
        cover: {
            width: 1920,
            height: 480,
            aspect: '4:1',
            /** Wide landscape — closest supported banner ratio via CLIProxy images API. */
            apiSize: '1792x1024',
            label: '1920×480',
        },
    });
    const PROFILE_KEY_PREFIX = 'creaty_store_profile_';
    const NICHE_HISTORY_KEY = 'creaty_used_niches';
    const DL_DB_NAME = 'creaty-design-library';
    const DL_META_STORE = 'designs';
    const GROUP_SIZE = 5;
    const DESIGN_STATUS = { READY: 'ready' };

    let dlDbPromise = null;

    function safeEmailKey(email) {
        return String(email || '').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
    }

    function profileStorageKey(email) {
        return `${PROFILE_KEY_PREFIX}${safeEmailKey(email)}`;
    }

    async function readStorage(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (items) => resolve(items || {}));
        });
    }

    async function writeStorage(patch) {
        return new Promise((resolve) => {
            chrome.storage.local.set(patch, () => resolve());
        });
    }
    async function removeStorage(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.remove(keys, () => resolve());
        });
    }

    async function getCliProxySettings() {
        const ai = Ai();
        if (ai?.getNhpAiCliproxySettings) {
            return ai.getNhpAiCliproxySettings();
        }
        return { baseUrl: '', apiKey: '', textModel: 'auto', imageModel: 'gpt-image-2', requestedImageModel: 'auto' };
    }

    function buildAvatarImagePrompt({ basePrompt = '', niche = '', storeTitle = '', bio = '' } = {}) {
        const spec = CREATY_STORE_IMAGE_SPECS.avatar;
        return [
            'Generate a professional TeePublic print-on-demand store avatar/profile image.',
            `EXACT output dimensions: ${spec.width}x${spec.height} pixels, square (${spec.aspect} aspect ratio).`,
            niche ? `Niche/theme: ${niche}.` : '',
            storeTitle ? `Store name: ${storeTitle}.` : '',
            basePrompt ? `Visual style: ${basePrompt}` : '',
            bio ? `Brand tone: ${String(bio).trim().slice(0, 220)}` : '',
            'High quality, vibrant, readable at small sizes, centered subject, no watermark, no text overlay, no borders, suitable for circular crop on TeePublic.',
        ].filter(Boolean).join(' ');
    }

    function buildCoverImagePrompt({ basePrompt = '', niche = '', storeTitle = '', bio = '' } = {}) {
        const spec = CREATY_STORE_IMAGE_SPECS.cover;
        return [
            'Generate a professional TeePublic store cover banner image.',
            `EXACT output dimensions: ${spec.width}x${spec.height} pixels, wide banner (${spec.aspect} aspect ratio).`,
            niche ? `Niche/theme: ${niche}.` : '',
            storeTitle ? `Store name: ${storeTitle}.` : '',
            basePrompt ? `Visual style: ${basePrompt}` : '',
            bio ? `Brand tone: ${String(bio).trim().slice(0, 220)}` : '',
            'Panoramic horizontal composition, cohesive with store niche, no watermark, no text overlay, clean edges, suitable as TeePublic store header banner.',
        ].filter(Boolean).join(' ');
    }

    async function callCliProxyImageGeneration(prompt, settings, size = '1024x1024') {
        const ai = Ai();
        if (ai?.callNhpAiImageGeneration) {
            return ai.callNhpAiImageGeneration(prompt, {
                settings,
                size,
                imageModel: settings.requestedImageModel || settings.imageModel,
            });
        }
        return { success: false, error: 'nhp_ai_cliproxy_unavailable' };
    }

    function parseStoreProfileJson(text) {
        const raw = String(text || '').trim();
        if (!raw) return null;
        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch (_) { /* fall through */ }
        return null;
    }

    function normalizeLinks(links = {}) {
        const src = links && typeof links === 'object' ? links : {};
        return {
            instagram: String(src.instagram || src.Instagram || '').trim(),
            twitter: String(src.twitter || src.x || src.Twitter || '').trim(),
            facebook: String(src.facebook || src.Facebook || '').trim(),
            pinterest: String(src.pinterest || src.Pinterest || '').trim(),
        };
    }

    function normalizeProfile(parsed, niche) {
        const links = normalizeLinks(parsed?.links);
        const imagePrompts = parsed?.imagePrompts && typeof parsed.imagePrompts === 'object'
            ? parsed.imagePrompts
            : {};
        return {
            title: String(parsed?.storeTitle || parsed?.title || '').trim().slice(0, 120),
            bio: String(parsed?.bio || parsed?.description || '').trim().slice(0, 2000),
            links,
            imagePrompts: {
                avatar: String(imagePrompts.avatar || parsed?.avatarPrompt || '').trim(),
                cover: String(imagePrompts.cover || parsed?.coverPrompt || '').trim(),
            },
            niche: String(niche || parsed?.niche || '').trim(),
            generatedAt: new Date().toISOString(),
            avatarRef: null,
            coverRef: null,
        };
    }

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

    function extractCandidatePhrases(values = []) {
        const stop = new Set(['the', 'and', 'for', 'with', 'from', 'your', 'that', 'this', 'tee', 'teepublic']);
        const out = [];
        values.forEach((value) => {
            const clean = String(value || '')
                .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (!clean) return;
            const words = clean.split(' ').filter((w) => w && !stop.has(w.toLowerCase()));
            if (words.length >= 2) out.push(words.slice(0, 3).join(' '));
            if (words.length >= 1) out.push(words[0]);
        });
        return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
    }

    function inferLocalNiche({ email, quintet = {}, usedNiches = [] } = {}) {
        const candidates = [
            ...(quintet.niches || []),
            ...(quintet.tags || []),
            ...extractCandidatePhrases(quintet.titles || []),
        ].map((v) => String(v || '').trim()).filter(Boolean);
        const usedSet = new Set((usedNiches || []).map((v) => String(v || '').trim().toLowerCase()));

        const picked = candidates.find((item) => !usedSet.has(item.toLowerCase()) && item.length >= 3);
        if (picked) {
            return { niche: titleCaseWords(picked), reason: 'local_context' };
        }

        const seeded = [
            'Retro Gaming',
            'Cute Pets',
            'Nature Hiking',
            'Anime Humor',
            'Fitness Motivation',
            'Music Lovers',
            'Space Science',
            'Vintage Sports',
            'Dark Aesthetic',
            'Cozy Kawaii',
        ];
        const choice = seeded[hashSeed(email || 'creaty') % seeded.length];
        return { niche: choice, reason: 'seeded_fallback' };
    }

    function buildFallbackProfile({ niche, email, displayName, quintet = {} } = {}) {
        const cleanNiche = titleCaseWords(niche || 'Creative Niche');
        const seedBase = slugWords(cleanNiche) || 'creative-shop';
        const mailSeed = slugWords(String(email || '').split('@')[0]) || 'creator';
        const firstTitle = String(quintet.titles?.[0] || '').trim();
        const storeTitle = titleCaseWords(
            firstTitle
                ? `${cleanNiche} Atelier`
                : `${cleanNiche} Studio`
        ).slice(0, 60);
        const persona = displayName ? titleCaseWords(displayName) : titleCaseWords(mailSeed.replace(/-/g, ' '));
        const bio = [
            `${storeTitle} is a curated TeePublic shop focused on ${cleanNiche.toLowerCase()} designs.`,
            `${persona} builds playful, clean artwork collections made for fans who want a strong niche identity.`,
            firstTitle ? `Current collection energy includes: ${firstTitle}.` : 'Each collection is built to feel consistent, giftable, and easy to recognize.',
        ].join(' ').slice(0, 2000);
        return {
            title: storeTitle,
            bio,
            links: {
                instagram: `https://instagram.com/${seedBase}_${mailSeed}`.slice(0, 120),
                twitter: `https://x.com/${seedBase}_${mailSeed}`.slice(0, 120),
                facebook: `https://facebook.com/${seedBase}.${mailSeed}`.slice(0, 120),
                pinterest: `https://pinterest.com/${seedBase}_${mailSeed}`.slice(0, 120),
            },
            imagePrompts: {
                avatar: `Bold ${cleanNiche} avatar icon, clean composition, centered subject, vivid print-on-demand branding.`,
                cover: `Wide ${cleanNiche} banner art for TeePublic store, cohesive collection mood, panoramic layout, premium merchandising feel.`,
            },
            niche: cleanNiche,
            generatedAt: new Date().toISOString(),
            avatarRef: null,
            coverRef: null,
            source: 'local_fallback',
        };
    }

    function hashSeed(text) {
        let h = 0;
        const s = String(text || '');
        for (let i = 0; i < s.length; i += 1) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    }

    function openDesignDb() {
        if (dlDbPromise) return dlDbPromise;
        dlDbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DL_DB_NAME, 1);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dlDbPromise;
    }

    async function listAllDesigns() {
        const db = await openDesignDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DL_META_STORE, 'readonly');
            const req = tx.objectStore(DL_META_STORE).getAll();
            req.onsuccess = () => resolve((req.result || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
            req.onerror = () => reject(req.error);
        });
    }

    async function getQuintetContextForAccount(accountEmail) {
        const email = String(accountEmail || '').trim().toLowerCase();
        if (!email) return { titles: [], tags: [], niches: [], descriptions: [] };
        try {
            const all = await listAllDesigns();
            const byGroup = new Map();
            for (const d of all) {
                const gid = d.groupId || 'ungrouped';
                if (!byGroup.has(gid)) byGroup.set(gid, []);
                byGroup.get(gid).push(d);
            }
            for (const designs of byGroup.values()) {
                const sorted = designs.sort((a, b) => (a.groupIndex ?? 0) - (b.groupIndex ?? 0));
                const assigned = String(sorted[0]?.assignedAccountId || '').trim().toLowerCase();
                const isComplete = sorted.length >= GROUP_SIZE;
                const allReady = sorted.every((d) => d.status === DESIGN_STATUS.READY);
                if (isComplete && allReady && assigned === email) {
                    const titles = [];
                    const tags = [];
                    const niches = [];
                    const descriptions = [];
                    sorted.forEach((d) => {
                        if (d.title) titles.push(String(d.title).trim());
                        if (d.description) descriptions.push(String(d.description).trim().slice(0, 120));
                        if (d.niche) niches.push(String(d.niche).trim());
                        if (d.mainTag) tags.push(String(d.mainTag).trim());
                        if (Array.isArray(d.tags)) tags.push(...d.tags.map((t) => String(t).trim()).filter(Boolean));
                    });
                    return {
                        titles: titles.slice(0, 5),
                        tags: [...new Set(tags)].slice(0, 20),
                        niches: [...new Set(niches)].slice(0, 5),
                        descriptions: descriptions.slice(0, 5),
                    };
                }
            }
        } catch (_) { /* IndexedDB unavailable in some contexts */ }
        return { titles: [], tags: [], niches: [], descriptions: [] };
    }

    async function loadUsedNiches(excludeEmail = '') {
        const exclude = String(excludeEmail || '').trim().toLowerCase();
        const used = new Set();
        const stored = await readStorage([NICHE_HISTORY_KEY, 'ap_accounts_teepublic']);
        (Array.isArray(stored[NICHE_HISTORY_KEY]) ? stored[NICHE_HISTORY_KEY] : []).forEach((n) => {
            const v = String(n || '').trim();
            if (v) used.add(v);
        });
        const accounts = Array.isArray(stored.ap_accounts_teepublic) ? stored.ap_accounts_teepublic : [];
        accounts.forEach((acc) => {
            const email = String(acc?.email || '').trim().toLowerCase();
            if (exclude && email === exclude) return;
            const niche = String(acc?.storeProfile?.niche || '').trim();
            if (niche) used.add(niche);
        });
        const allKeys = await readStorage(null);
        Object.keys(allKeys || {}).forEach((key) => {
            if (!key.startsWith(PROFILE_KEY_PREFIX)) return;
            const profile = allKeys[key];
            const niche = String(profile?.niche || '').trim();
            if (niche) used.add(niche);
        });
        return [...used].slice(0, 40);
    }

    async function rememberUsedNiche(niche) {
        const value = String(niche || '').trim();
        if (!value) return;
        const stored = await readStorage([NICHE_HISTORY_KEY]);
        const list = Array.isArray(stored[NICHE_HISTORY_KEY]) ? [...stored[NICHE_HISTORY_KEY]] : [];
        if (!list.some((n) => String(n).toLowerCase() === value.toLowerCase())) {
            list.unshift(value);
        }
        await writeStorage({ [NICHE_HISTORY_KEY]: list.slice(0, 80) });
    }

    function buildAutoNichePrompt({ email, displayName, quintet = {}, usedNiches = [] }) {
        const varietySeed = hashSeed(email) % 997;
        const styleHints = [
            'humor & pop culture', 'minimalist nature', 'retro gaming', 'motivational quotes',
            'pet lovers', 'fitness & gym', 'music & bands', 'science & space',
            'horror & dark art', 'cute kawaii', 'sports fandom', 'spiritual & zen',
        ];
        const styleHint = styleHints[varietySeed % styleHints.length];
        return [
            'You are a TeePublic niche strategist. Pick ONE profitable, specific print-on-demand niche for this seller account.',
            'Reply with JSON only (no markdown): {"niche":"...","reason":"..."}',
            'Rules:',
            '- niche: 2-5 words, specific sub-niche (not generic "funny shirts")',
            '- Must fit the design titles/tags if provided',
            '- Pick a DIFFERENT niche from already-used list when possible',
            '- Vary style across accounts — use variety seed for uniqueness',
            `- Account email: ${email}`,
            displayName ? `- Display name: ${displayName}` : '',
            `- Variety seed: ${varietySeed} — lean toward: ${styleHint}`,
            quintet.titles?.length ? `- Assigned design titles: ${quintet.titles.join('; ')}` : '',
            quintet.tags?.length ? `- Design tags: ${quintet.tags.slice(0, 15).join(', ')}` : '',
            quintet.niches?.length ? `- Design SEO niches: ${quintet.niches.join('; ')}` : '',
            quintet.descriptions?.length ? `- Design descriptions: ${quintet.descriptions.join(' | ')}` : '',
            usedNiches.length ? `- Already used niches (AVOID repeating): ${usedNiches.join('; ')}` : '',
        ].filter(Boolean).join('\n');
    }

    function buildCombinedNicheAndProfilePrompt({ email, displayName, quintet = {}, usedNiches = [] }) {
        const varietySeed = hashSeed(email) % 997;
        const titles = (quintet.titles || []).filter(Boolean).slice(0, 5);
        return [
            'You are a TeePublic store branding expert. Pick a niche AND generate a full store identity in one response.',
            'Reply with JSON only (no markdown):',
            '{"niche":"...","storeTitle":"...","bio":"...","links":{"instagram":"https://...","twitter":"https://...","facebook":"https://...","pinterest":"https://..."},"imagePrompts":{"avatar":"...","cover":"..."}}',
            'Rules:',
            '- niche: 2-5 words, specific sub-niche matching the assigned designs',
            '- storeTitle: catchy, niche-specific, max 60 chars',
            '- bio: 2-4 sentences, consistent niche voice',
            '- links: realistic placeholder URLs (fake handles)',
            `- imagePrompts: short prompts for avatar (${CREATY_STORE_IMAGE_SPECS.avatar.width}x${CREATY_STORE_IMAGE_SPECS.avatar.height}px square) and cover (${CREATY_STORE_IMAGE_SPECS.cover.width}x${CREATY_STORE_IMAGE_SPECS.cover.height}px banner)`,
            '- Avoid niches already used by other accounts when possible',
            `- Account email: ${email}`,
            displayName ? `- Display name: ${displayName}` : '',
            `- Variety seed: ${varietySeed}`,
            titles.length ? `- Design titles: ${titles.join('; ')}` : '',
            quintet.tags?.length ? `- Tags: ${quintet.tags.slice(0, 15).join(', ')}` : '',
            usedNiches.length ? `- Avoid these niches: ${usedNiches.join('; ')}` : '',
        ].filter(Boolean).join('\n');
    }

    function buildGenerationPrompt({ niche, email, displayName, designTitles = [] }) {
        const titles = (designTitles || []).filter(Boolean).slice(0, 5);
        return [
            'You are a TeePublic store branding expert. Generate a cohesive store identity for a print-on-demand seller.',
            'Reply with JSON only (no markdown):',
            '{"storeTitle":"...","bio":"...","links":{"instagram":"https://...","twitter":"https://...","facebook":"https://...","pinterest":"https://..."},"imagePrompts":{"avatar":"...","cover":"..."}}',
            'Rules:',
            '- storeTitle: catchy, niche-specific, max 60 chars, suitable for TeePublic store name',
            '- bio: 2-4 sentences, consistent niche voice, authentic tone, no spam',
            '- links: realistic-looking placeholder URLs (fake handles matching persona, not real people)',
            `- imagePrompts.avatar: short prompt for square TeePublic avatar (${CREATY_STORE_IMAGE_SPECS.avatar.width}x${CREATY_STORE_IMAGE_SPECS.avatar.height}px)`,
            `- imagePrompts.cover: short prompt for wide TeePublic banner (${CREATY_STORE_IMAGE_SPECS.cover.width}x${CREATY_STORE_IMAGE_SPECS.cover.height}px, ${CREATY_STORE_IMAGE_SPECS.cover.aspect})`,
            `- Niche: ${niche}`,
            `- Account email: ${email}`,
            displayName ? `- Display name hint: ${displayName}` : '',
            titles.length ? `- Design titles in queue: ${titles.join('; ')}` : '',
        ].filter(Boolean).join('\n');
    }

    async function callCliProxy(prompt, settings, maxTokens = 900) {
        const ai = Ai();
        if (ai?.callNhpAiChat) {
            return ai.callNhpAiChat(prompt, {
                settings,
                textModel: settings.textModel,
                maxTokens,
                temperature: 0.75,
            });
        }
        return { success: false, error: 'nhp_ai_cliproxy_unavailable' };
    }

    async function pickNicheAutomatically(payload = {}) {
        const email = String(payload.accountEmail || payload.email || '').trim();
        if (!email) return { success: false, error: 'store_account_required' };

        const settings = await getCliProxySettings();
        if (!settings.apiKey) return { success: false, error: 'store_no_api_key' };

        const quintet = await getQuintetContextForAccount(email);
        const usedNiches = await loadUsedNiches(email);
        const prompt = buildAutoNichePrompt({
            email,
            displayName: payload.displayName || payload.display_name || '',
            quintet,
            usedNiches,
        });

        const result = await callCliProxy(prompt, settings, 280);
        if (!result.success) return result;

        const parsed = parseStoreProfileJson(result.text);
        const niche = String(parsed?.niche || '').trim();
        if (!niche) {
            return { success: false, error: 'store_niche_parse_failed', raw: result.text };
        }

        await rememberUsedNiche(niche);
        return {
            success: true,
            niche,
            reason: String(parsed?.reason || '').trim(),
            quintetTitles: quintet.titles,
            source: 'cliproxyapi',
            apiCalls: 1,
        };
    }

    async function attachImagesIfRequested(email, profile, niche, payload, baseResult) {
        const includeImages = payload.includeImages === true;
        if (!includeImages || !profile?.title) return baseResult;

        const imgs = await generateStoreImages({
            accountEmail: email,
            email,
            profile,
            niche: niche || profile.niche || '',
        });
        const result = { ...baseResult, apiCalls: (baseResult.apiCalls || 0) + (imgs.apiCalls || 0) };
        if (imgs?.success) {
            result.profile = {
                ...profile,
                ...(imgs.profilePatch || {}),
                avatarDataUrl: imgs.avatarDataUrl ?? profile.avatarDataUrl ?? null,
                coverDataUrl: imgs.coverDataUrl ?? profile.coverDataUrl ?? null,
            };
            result.imagesGenerated = true;
            result.imagesPartial = imgs.partial === true;
            if (imgs.partial) result.imageErrors = imgs.errors;
        } else {
            result.imagesGenerated = false;
            result.imageError = imgs?.error || 'store_images_failed';
            if (imgs?.errors) result.imageErrors = imgs.errors;
        }
        return result;
    }

    async function generateStoreProfile(payload = {}) {
        const email = String(payload.accountEmail || payload.email || '').trim();
        let niche = String(payload.niche || '').trim();
        if (!email) return { success: false, error: 'store_account_required' };

        const settings = await getCliProxySettings();
        const quintet = await getQuintetContextForAccount(email);
        const usedNiches = await loadUsedNiches(email);
        let apiCalls = 0;
        let autoNicheReason = '';
        const canUseAi = !!settings.apiKey;

        const buildLocalSuccess = async (reason) => {
            if (!niche) {
                const localPick = inferLocalNiche({ email, quintet, usedNiches });
                niche = localPick.niche;
                autoNicheReason = autoNicheReason || localPick.reason;
            }
            await rememberUsedNiche(niche);
            const profile = buildFallbackProfile({
                niche,
                email,
                displayName: payload.displayName || payload.display_name || '',
                quintet,
            });
            return {
                success: true,
                profile,
                niche,
                autoNiche: !String(payload.niche || '').trim(),
                nicheReason: autoNicheReason || reason || 'local_fallback',
                source: 'local_fallback',
                fallback: true,
                apiCalls,
            };
        };

        if (!niche) {
            if (canUseAi) {
                const combinedPrompt = buildCombinedNicheAndProfilePrompt({
                    email,
                    displayName: payload.displayName || payload.display_name || '',
                    quintet,
                    usedNiches,
                });
                const combined = await callCliProxy(combinedPrompt, settings, 950);
                apiCalls += 1;
                if (combined.success) {
                    const parsed = parseStoreProfileJson(combined.text);
                    niche = String(parsed?.niche || '').trim();
                    if (niche && parsed?.storeTitle && parsed?.bio) {
                        await rememberUsedNiche(niche);
                        const profile = normalizeProfile(parsed, niche);
                        return attachImagesIfRequested(email, profile, niche, payload, {
                            success: true,
                            profile,
                            niche,
                            autoNiche: true,
                            nicheReason: String(parsed?.reason || '').trim(),
                            source: 'cliproxyapi',
                            apiCalls,
                        });
                    }
                }
            }

            if (canUseAi) {
                const picked = await pickNicheAutomatically(payload);
                apiCalls += picked.apiCalls || 1;
                if (picked.success) {
                    niche = picked.niche;
                    autoNicheReason = picked.reason || '';
                } else {
                    const localPick = inferLocalNiche({ email, quintet, usedNiches });
                    niche = localPick.niche;
                    autoNicheReason = picked.error || localPick.reason || 'store_niche_auto_failed';
                }
            } else {
                const localPick = inferLocalNiche({ email, quintet, usedNiches });
                niche = localPick.niche;
                autoNicheReason = localPick.reason;
            }
        }

        const designTitles = payload.designTitles?.length
            ? payload.designTitles
            : quintet.titles;

        if (!canUseAi) {
            return buildLocalSuccess('store_no_api_key');
        }

        const prompt = buildGenerationPrompt({
            niche,
            email,
            displayName: payload.displayName || payload.display_name || '',
            designTitles,
        });

        const result = await callCliProxy(prompt, settings, 900);
        apiCalls += 1;
        if (!result.success) {
            return buildLocalSuccess(result.error || 'store_generation_failed');
        }
        const parsed = parseStoreProfileJson(result.text);
        if (!parsed) {
            return buildLocalSuccess('store_parse_failed');
        }
        const profile = normalizeProfile(parsed, niche);
        if (!profile.title || !profile.bio) {
            return buildLocalSuccess('store_incomplete_response');
        }
        await rememberUsedNiche(niche);
        return attachImagesIfRequested(email, profile, niche, payload, {
            success: true,
            profile,
            niche,
            autoNiche: !String(payload.niche || '').trim(),
            nicheReason: autoNicheReason,
            source: 'cliproxyapi',
            apiCalls,
        });
    }

    async function generateStoreImages(payload = {}) {
        const email = String(payload.accountEmail || payload.email || '').trim();
        const profileIn = payload.profile && typeof payload.profile === 'object' ? payload.profile : {};
        const niche = String(payload.niche || profileIn.niche || '').trim();
        const storeTitle = String(profileIn.title || profileIn.storeTitle || '').trim();
        const bio = String(profileIn.bio || '').trim();
        const prompts = profileIn.imagePrompts && typeof profileIn.imagePrompts === 'object'
            ? profileIn.imagePrompts
            : {};

        if (!storeTitle && !prompts.avatar && !prompts.cover) {
            return { success: false, error: 'store_profile_required' };
        }

        const settings = await getCliProxySettings();
        if (!settings.apiKey) {
            return { success: false, error: 'store_no_api_key' };
        }

        const avatarSpec = CREATY_STORE_IMAGE_SPECS.avatar;
        const coverSpec = CREATY_STORE_IMAGE_SPECS.cover;
        const avatarPrompt = buildAvatarImagePrompt({
            basePrompt: prompts.avatar,
            niche,
            storeTitle,
            bio,
        });
        const coverPrompt = buildCoverImagePrompt({
            basePrompt: prompts.cover,
            niche,
            storeTitle,
            bio,
        });

        const targets = [];
        if (payload.avatarOnly) {
            targets.push({ key: 'avatar', prompt: avatarPrompt, size: avatarSpec.apiSize });
        } else if (payload.coverOnly) {
            targets.push({ key: 'cover', prompt: coverPrompt, size: coverSpec.apiSize });
        } else {
            targets.push(
                { key: 'avatar', prompt: avatarPrompt, size: avatarSpec.apiSize },
                { key: 'cover', prompt: coverPrompt, size: coverSpec.apiSize },
            );
        }

        const images = {};
        const errors = [];
        let apiCalls = 0;

        for (const target of targets) {
            const result = await callCliProxyImageGeneration(target.prompt, settings, target.size);
            apiCalls += 1;
            if (result.success && result.dataUrl) {
                images[target.key] = result.dataUrl;
            } else {
                errors.push({ type: target.key, error: result.error || 'store_image_failed' });
            }
        }

        if (!images.avatar && !images.cover) {
            return {
                success: false,
                error: errors[0]?.error || 'store_images_failed',
                errors,
                apiCalls,
                endpoint: '/images/generations',
                model: settings.imageModel,
            };
        }

        const patch = {
            avatarDataUrl: images.avatar || profileIn.avatarDataUrl || null,
            coverDataUrl: images.cover || profileIn.coverDataUrl || null,
            avatarRef: images.avatar ? 'inline_avatar' : (profileIn.avatarRef || null),
            coverRef: images.cover ? 'inline_cover' : (profileIn.coverRef || null),
            imagesGeneratedAt: new Date().toISOString(),
        };

        return {
            success: true,
            partial: errors.length > 0,
            avatarDataUrl: patch.avatarDataUrl,
            coverDataUrl: patch.coverDataUrl,
            profilePatch: { ...patch, niche },
            errors: errors.length ? errors : undefined,
            source: 'cliproxyapi',
            endpoint: '/images/generations',
            model: settings.imageModel,
            specs: CREATY_STORE_IMAGE_SPECS,
            apiCalls,
        };
    }

    async function patchAccountStoreProfile(email, profile) {
        const platformKey = 'ap_accounts_teepublic';
        const stored = await readStorage([platformKey, 'ap_accounts']);
        let accounts = Array.isArray(stored[platformKey]) ? stored[platformKey] : [];
        if (!accounts.length && Array.isArray(stored.ap_accounts)) accounts = stored.ap_accounts;
        const idx = accounts.findIndex(
            (a) => String(a?.email || '').trim().toLowerCase() === email.toLowerCase()
        );
        if (idx >= 0) {
            accounts[idx] = { ...accounts[idx], storeProfile: profile, storeName: profile.title || accounts[idx].storeName };
            await writeStorage({ [platformKey]: accounts });
        }
    }

    async function saveStoreProfile(email, profilePatch = {}) {
        const key = profileStorageKey(email);
        const stored = await readStorage([key]);
        const existing = stored[key] && typeof stored[key] === 'object' ? stored[key] : {};
        const profile = {
            ...existing,
            ...profilePatch,
            links: normalizeLinks(profilePatch.links || existing.links),
            imagePrompts: {
                ...(existing.imagePrompts || {}),
                ...(profilePatch.imagePrompts || {}),
            },
            niche: String(profilePatch.niche || existing.niche || '').trim(),
            updatedAt: new Date().toISOString(),
        };
        if (!profile.generatedAt) profile.generatedAt = profile.updatedAt;

        await writeStorage({ [key]: profile });
        await patchAccountStoreProfile(email, profile);

        try {
            chrome.runtime.sendMessage({
                action: 'CREATY_STORE_PROFILE_SAVED',
                email,
                profile,
            });
        } catch (_) { /* no listeners */ }

        if (typeof CreatyAccountArchive !== 'undefined' && CreatyAccountArchive.queueSave) {
            CreatyAccountArchive.queueSave(email, 'store_profile_saved');
        }

        return { success: true, profile };
    }

    async function deleteStoreProfile(email) {
        const normalizedEmail = String(email || '').trim();
        if (!normalizedEmail) return { success: false, error: 'store_account_required' };

        const key = profileStorageKey(normalizedEmail);
        const stored = await readStorage(['ap_accounts_teepublic']);
        const accounts = Array.isArray(stored.ap_accounts_teepublic) ? stored.ap_accounts_teepublic : [];
        const nextAccounts = accounts.map((account) => {
            const accountEmail = String(account?.email || account?.display_email || '').trim().toLowerCase();
            if (accountEmail !== normalizedEmail.toLowerCase()) return account;
            const next = { ...account, storeProfile: null };
            delete next.storeGeneratedAt;
            return next;
        });

        await removeStorage(key);
        if (accounts.length) await writeStorage({ ap_accounts_teepublic: nextAccounts });
        return { success: true, email: normalizedEmail, removedKey: key };
    }
    async function loadStoreProfile(email) {
        const key = profileStorageKey(email);
        const stored = await readStorage([key, 'ap_accounts_teepublic']);
        let profile = stored[key] || null;
        if (!profile) {
            const accounts = stored.ap_accounts_teepublic || [];
            const acc = accounts.find(
                (a) => String(a?.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase()
            );
            profile = acc?.storeProfile || null;
        }
        return { success: true, profile };
    }

    async function handleAction(request) {
        const action = request?.action;
        const email = String(request?.accountEmail || request?.email || '').trim();

        if (action === 'CREATY_GENERATE_STORE') {
            return generateStoreProfile(request);
        }
        if (action === 'CREATY_GENERATE_STORE_IMAGES') {
            return generateStoreImages(request);
        }
        if (action === 'CREATY_PICK_NICHE') {
            return pickNicheAutomatically(request);
        }
        if (action === 'CREATY_SAVE_STORE_PROFILE') {
            if (!email) return { success: false, error: 'store_account_required' };
            return saveStoreProfile(email, request.profile || {});
        }
        if (action === 'CREATY_LOAD_STORE_PROFILE') {
            if (!email) return { success: false, error: 'store_account_required' };
            return loadStoreProfile(email);
        }
        if (action === 'CREATY_DELETE_STORE_PROFILE') {
            if (!email) return { success: false, error: 'store_account_required' };
            return deleteStoreProfile(email);
        }
        return null;
    }

    global.CreatyStoreGenerator = {
        handleAction,
        generateStoreProfile,
        generateStoreImages,
        pickNicheAutomatically,
        getQuintetContextForAccount,
        saveStoreProfile,
        loadStoreProfile,
        deleteStoreProfile,
        profileStorageKey,
        PROFILE_KEY_PREFIX,
        CREATY_STORE_IMAGE_SPECS,
    };
})(typeof self !== 'undefined' ? self : globalThis);
