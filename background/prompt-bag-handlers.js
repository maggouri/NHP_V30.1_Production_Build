/**
 * Prompt Bag — storage, paste, and manager helpers (background service worker).
 * Loaded via importScripts from background.js; exposes globals for legacy callers.
 */
(function (global) {
    'use strict';

    global.NHP_PROMPT_BAG_MENU_ROOT_ID = 'nhp-prompt-bag-root';
    global.NHP_PROMPT_BAG_PROMPTS_ROOT_ID = 'nhp-prompt-bag-prompts-root';
    global.NHP_PROMPT_BAG_IMAGES_ROOT_ID = 'nhp-prompt-bag-images-root';
    global.NHP_PROMPT_BAG_SAVE_SELECTION_ID = 'nhp-prompt-bag-save-selection';
    global.NHP_PROMPT_BAG_PASTE_LAST_PROMPT_ID = 'nhp-prompt-bag-paste-last-prompt';
    global.NHP_PROMPT_BAG_MANAGE_ID = 'nhp-prompt-bag-manage';
    global.NHP_PROMPT_BAG_SAVE_IMAGE_ID = 'nhp-prompt-bag-save-image';
    global.NHP_PROMPT_BAG_SEND_LAST_GEMINI_ID = 'nhp-prompt-bag-send-last-gemini';
    global.NHP_PROMPT_BAG_SEND_LAST_GPT_ID = 'nhp-prompt-bag-send-last-gpt';
    global.NHP_PROMPT_BAG_PROMPTS_KEY = 'nhpPromptBagPrompts';
    global.NHP_PROMPT_BAG_IMAGES_KEY = 'nhpPromptBagImages';
    global.NHP_PROMPT_BAG_MAX_PROMPTS = 120;
    global.NHP_PROMPT_BAG_MAX_IMAGES = 80;

    let promptBagWriteQueue = Promise.resolve();

    function enqueuePromptBagWrite(task) {
        const run = promptBagWriteQueue.then(() => task());
        promptBagWriteQueue = run.catch(() => {});
        return run;
    }

    function normalizePromptBagSourceUrl(value) {
        return String(value || '').trim();
    }

    let promptBagLastTargetTabId = null;

    global.openPromptBagManager = async function openPromptBagManager(sourceTab = null) {
        if (Number.isFinite(sourceTab?.id)) {
            promptBagLastTargetTabId = sourceTab.id;
        }
        await chrome.windows.create({
            url: chrome.runtime.getURL('prompt_bag.html'),
            type: 'popup',
            width: 980,
            height: 720,
            focused: true
        });
    };

    global.getPromptBagPrompts = async function getPromptBagPrompts() {
        const data = await chrome.storage.local.get([global.NHP_PROMPT_BAG_PROMPTS_KEY]);
        return Array.isArray(data?.[global.NHP_PROMPT_BAG_PROMPTS_KEY]) ? data[global.NHP_PROMPT_BAG_PROMPTS_KEY] : [];
    };

    global.setPromptBagPrompts = async function setPromptBagPrompts(prompts) {
        const clean = (Array.isArray(prompts) ? prompts : [])
            .filter((item) => item && String(item.text || '').trim())
            .slice(0, global.NHP_PROMPT_BAG_MAX_PROMPTS);
        await chrome.storage.local.set({ [global.NHP_PROMPT_BAG_PROMPTS_KEY]: clean });
        return clean;
    };

    global.getPromptBagImages = async function getPromptBagImages() {
        const data = await chrome.storage.local.get([global.NHP_PROMPT_BAG_IMAGES_KEY]);
        return Array.isArray(data?.[global.NHP_PROMPT_BAG_IMAGES_KEY]) ? data[global.NHP_PROMPT_BAG_IMAGES_KEY] : [];
    };

    global.setPromptBagImages = async function setPromptBagImages(images) {
        const clean = (Array.isArray(images) ? images : [])
            .filter((item) => item && String(item.dataUrl || '').startsWith('data:image/'))
            .slice(0, global.NHP_PROMPT_BAG_MAX_IMAGES);
        await chrome.storage.local.set({ [global.NHP_PROMPT_BAG_IMAGES_KEY]: clean });
        return clean;
    };

    global.addPromptBagImage = async function addPromptBagImage(image) {
        return enqueuePromptBagWrite(async () => {
            if (!image || !String(image.dataUrl || '').startsWith('data:image/')) {
                throw new Error('Invalid Prompt Bag image.');
            }
            const images = await global.getPromptBagImages();
            const sourceUrl = normalizePromptBagSourceUrl(image.sourceUrl || image.url || '');
            if (sourceUrl) {
                const duplicate = images.find((row) => normalizePromptBagSourceUrl(row.sourceUrl) === sourceUrl);
                if (duplicate) {
                    return { images, overwritten: false, added: false, duplicate: true };
                }
            }
            const normalize = typeof global.normalizeAiImageDataUrl === 'function'
                ? global.normalizeAiImageDataUrl
                : async (url) => url;
            const estimateBytes = typeof global.estimateDataUrlBytes === 'function'
                ? global.estimateDataUrlBytes
                : () => 0;
            const normalized = await normalize(image.dataUrl);
            const nicheTitle = typeof global.NHP_sanitizeNicheTitle === 'function'
                ? global.NHP_sanitizeNicheTitle(image.niche || image.nicheTitle || '')
                : String(image.niche || image.nicheTitle || '').trim();
            const fileName = nicheTitle
                ? (typeof global.NHP_nicheTitleToFileName === 'function'
                    ? global.NHP_nicheTitleToFileName(nicheTitle)
                    : `${nicheTitle}.png`)
                : (image.name || `prompt-bag-${Date.now()}.png`);
            function nicheTitleFromBagName(name) {
                if (typeof global.NHP_nicheTitleFromFileName === 'function') {
                    return global.NHP_nicheTitleFromFileName(name);
                }
                return String(name || '').replace(/\.(png|jpe?g|webp)$/i, '').trim();
            }
            const item = {
                id: image.id || `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                name: fileName,
                niche: nicheTitle || nicheTitleFromBagName(fileName),
                sourceUrl,
                dataUrl: normalized,
                originalBytes: Number(image.originalBytes || estimateBytes(image.dataUrl)) || 0,
                storedBytes: estimateBytes(normalized),
                createdAt: Number(image.createdAt || Date.now())
            };
            if (!item.niche) item.niche = nicheTitleFromBagName(item.name);
            const saved = await global.setPromptBagImages([item, ...images]);
            return { images: saved, overwritten: false, added: true, duplicate: false };
        });
    };

    global.saveSelectionToPromptBag = async function saveSelectionToPromptBag(selectionText = '') {
        const text = String(selectionText || '').trim();
        if (!text) return { success: false, error: 'No selected text.' };
        const prompts = await global.getPromptBagPrompts();
        const item = {
            id: `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title: text.split(/\s+/).slice(0, 8).join(' ').slice(0, 80),
            text,
            tag: 'selection',
            favorite: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await global.setPromptBagPrompts([item, ...prompts.filter((prompt) => prompt.text !== text)]);
        return { success: true, item };
    };

    global.getImageDataUrlFromPage = async function getImageDataUrlFromPage(tabId, srcUrl, extraUrls = []) {
        if (!tabId || !srcUrl) return null;
        const candidates = [srcUrl, ...(Array.isArray(extraUrls) ? extraUrls : [])]
            .map((value) => String(value || '').trim())
            .filter(Boolean);
        if (!candidates.length) return null;
        try {
            const [result] = await chrome.scripting.executeScript({
                target: { tabId },
                func: async (targetCandidates) => {
                    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
                    const urlsMatch = (a, b) => String(a || '').trim() === String(b || '').trim();
                    const canvasFromImg = (img) => {
                        if (!img?.naturalWidth || !img?.naturalHeight) return '';
                        const maxSide = 1200;
                        const width = img.naturalWidth;
                        const height = img.naturalHeight;
                        const scale = Math.min(1, maxSide / Math.max(width, height));
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.max(1, Math.round(width * scale));
                        canvas.height = Math.max(1, Math.round(height * scale));
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL('image/png');
                        return dataUrl.startsWith('data:image/') ? dataUrl : '';
                    };
                    const findImg = () => {
                        const images = Array.from(document.images || []);
                        for (const candidate of targetCandidates) {
                            const hit = images.find((item) => item.currentSrc === candidate || item.src === candidate);
                            if (hit) return hit;
                        }
                        for (const card of document.querySelectorAll('[data-full], .nhp-dg-modal__card, .nhp-feed__card')) {
                            const full = card.getAttribute('data-full') || '';
                            const thumb = card.getAttribute('data-thumb') || '';
                            if (!targetCandidates.some((candidate) => urlsMatch(candidate, full) || urlsMatch(candidate, thumb))) {
                                continue;
                            }
                            const img = card.querySelector('img');
                            if (img) return img;
                        }
                        return null;
                    };
                    const img = findImg();
                    if (!img) return { success: false, error: 'Image element not found on page.' };
                    if (!img.complete || !img.naturalWidth) {
                        await sleep(350);
                    }
                    const dataUrl = canvasFromImg(img);
                    if (!dataUrl) return { success: false, error: 'Image canvas capture failed.' };
                    return {
                        success: true,
                        dataUrl,
                        width: img.naturalWidth || img.width,
                        height: img.naturalHeight || img.height
                    };
                },
                args: [candidates]
            });
            return result?.result?.success ? result.result : null;
        } catch (_) {
            return null;
        }
    };

    global.saveImageToPromptBagFromContext = async function saveImageToPromptBagFromContext(info, tab = null) {
        const imageUrl = info?.srcUrl || info?.linkUrl || info?.pageUrl || '';
        if (!imageUrl) return { success: false, error: 'No image URL.' };
        const estimateBytes = typeof global.estimateDataUrlBytes === 'function'
            ? global.estimateDataUrlBytes
            : () => 0;
        let fetched = null;
        try {
            fetched = await global.fetchImageAsDataUrlFromCandidates([imageUrl], info?.pageUrl);
        } catch (error) {
            const pageResult = await global.getImageDataUrlFromPage(tab?.id, imageUrl);
            if (!pageResult?.dataUrl) throw error;
            fetched = {
                dataUrl: pageResult.dataUrl,
                sourceUrl: imageUrl,
                mimeType: 'image/png',
                filename: `page-image-${Date.now()}.png`
            };
        }
        const item = {
            id: `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: fetched.filename || `prompt-bag-${Date.now()}.png`,
            sourceUrl: imageUrl,
            dataUrl: fetched.dataUrl,
            originalBytes: estimateBytes(fetched.dataUrl),
            storedBytes: estimateBytes(fetched.dataUrl),
            createdAt: Date.now()
        };
        await global.addPromptBagImage(item);
        return { success: true, item };
    };

    global.pastePromptBagTextIntoTab = async function pastePromptBagTextIntoTab(tabId, text) {
        if (!tabId || !String(text || '').trim()) return { success: false, error: 'Missing target tab or text.' };
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: (value) => {
                const text = String(value || '');
                const active = document.activeElement;
                const setNativeValue = (element, nextValue) => {
                    const proto = element instanceof HTMLTextAreaElement
                        ? HTMLTextAreaElement.prototype
                        : HTMLInputElement.prototype;
                    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
                    if (descriptor?.set) descriptor.set.call(element, nextValue);
                    else element.value = nextValue;
                };
                if (active && (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)) {
                    const start = Number.isFinite(active.selectionStart) ? active.selectionStart : active.value.length;
                    const end = Number.isFinite(active.selectionEnd) ? active.selectionEnd : active.value.length;
                    const nextValue = `${active.value.slice(0, start)}${text}${active.value.slice(end)}`;
                    setNativeValue(active, nextValue);
                    const cursor = start + text.length;
                    active.setSelectionRange?.(cursor, cursor);
                    active.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
                    active.dispatchEvent(new Event('change', { bubbles: true }));
                    return { success: true, mode: 'input' };
                }
                if (active?.isContentEditable) {
                    active.focus();
                    document.execCommand('insertText', false, text);
                    active.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
                    return { success: true, mode: 'contenteditable' };
                }
                return { success: false, error: 'Focus an input field first.' };
            },
            args: [text]
        });
        return result?.result || { success: false, error: 'Paste script did not return a result.' };
    };

    global.pasteLastPromptFromBag = async function pasteLastPromptFromBag(tab) {
        const prompts = await global.getPromptBagPrompts();
        const prompt = prompts.find((item) => item.favorite) || prompts[0];
        if (!prompt) {
            await global.openPromptBagManager(tab);
            return { success: false, error: 'Prompt bag is empty.' };
        }
        return global.pastePromptBagTextIntoTab(tab?.id, prompt.text);
    };

    global.getPromptBagTargetTabId = async function getPromptBagTargetTabId() {
        if (Number.isFinite(promptBagLastTargetTabId)) {
            try {
                const tab = await chrome.tabs.get(promptBagLastTargetTabId);
                if (tab?.id && !String(tab.url || '').startsWith(chrome.runtime.getURL(''))) {
                    return tab.id;
                }
            } catch (_) {
            }
        }
        const tabs = await chrome.tabs.query({});
        const candidate = tabs
            .filter((tab) => tab?.active && tab.id && !String(tab.url || '').startsWith(chrome.runtime.getURL('')))
            .sort((left, right) => Number(right.lastAccessed || 0) - Number(left.lastAccessed || 0))[0]
            || tabs
                .filter((tab) => tab?.id && /^https?:/i.test(String(tab.url || '')))
                .sort((left, right) => Number(right.lastAccessed || 0) - Number(left.lastAccessed || 0))[0];
        return candidate?.id || null;
    };

    global.setPromptBagLastTargetTabId = function setPromptBagLastTargetTabId(tabId) {
        if (Number.isFinite(tabId)) promptBagLastTargetTabId = tabId;
    };
})(typeof globalThis !== 'undefined' ? globalThis : self);
