const fs = require('fs');
const path = require('path');
const Module = require('module');
const { spawn } = require('child_process');

const extraNodePaths = [
    path.join(__dirname, 'node_modules')
].filter((dir) => fs.existsSync(dir));

if (extraNodePaths.length) {
    process.env.NODE_PATH = [process.env.NODE_PATH, ...extraNodePaths].filter(Boolean).join(path.delimiter);
    Module._initPaths();
}

const express = require('express');
const cors = require('cors');
const { buildStartupScript } = require('./startup-script-generator');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const {
    installExternalProtocolGuard,
    wireExternalProtocolGuard,
} = require('./server/chrome-launch-shared');

puppeteer.use(StealthPlugin());

const app = express();
const { getPortablePaths } = require('./utils/nhp-portable-paths');
const portable = getPortablePaths({ appRootHint: __dirname, ensure: true });
const ROOT_DIR = portable.appRoot;
const PORT = Number(process.env.NHP_AI_BRIDGE_PORT || 3031);
const DEBUG_PORT = Number(process.env.NHP_AI_BRIDGE_DEBUG_PORT || 9331);
const TEMP_DIR = portable.get('temp_uploads_ai_bridge');
const LOG_DIR = portable.get('server_logs');
const LOG_FILE = path.join(LOG_DIR, 'ai-bridge-server.log');
const LISTEN_HOST = String(process.env.NHP_AI_BRIDGE_HOST || process.env.NHP_LISTEN_HOST || '127.0.0.1').trim() || '127.0.0.1';
const REALESRGAN_TIMEOUT_MS = Number(process.env.NHP_REALESRGAN_TIMEOUT_MS || 10 * 60 * 1000);

console.log(`[NHP AI-Bridge] APP_ROOT=${ROOT_DIR}`);
console.log(`[NHP AI-Bridge] DATA_ROOT=${portable.dataRoot}`);
[TEMP_DIR, LOG_DIR].forEach((dir) => {
    portable.assertNotExtensionWrite(dir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json({ limit: '150mb' }));

function log(message, level = 'INFO') {
    const line = `[${new Date().toISOString()}] [${level}] ${message}`;
    console.log(line);
    try {
        fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
    } catch (_) { }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureTempUploadDir() {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const RESTRICTIVE_EXTENSION_FLAGS = [
    '--disable-extensions',
    '--disable-extensions-except='
];

function sanitizeChromeArgs(args = [], context = 'ai-bridge-launch') {
    const safe = [];
    const blocked = [];
    for (const arg of (Array.isArray(args) ? args : [])) {
        const text = String(arg || '').trim();
        if (!text) continue;
        const lower = text.toLowerCase();
        if (lower === RESTRICTIVE_EXTENSION_FLAGS[0] || lower.startsWith(RESTRICTIVE_EXTENSION_FLAGS[1])) {
            blocked.push(text);
            continue;
        }
        safe.push(text);
    }
    if (blocked.length > 0) {
        log(`[ChromeGuard] Removed restrictive extension flags in ${context}: ${blocked.join(' | ')}`, 'WARN');
    }
    return safe;
}

function dataUrlToTempImageFile(dataUrl, prefix = 'ai_bridge') {
    const value = String(dataUrl || '');
    const match = value.match(/^data:(image\/[^;,]+)?(;base64)?,(.*)$/);
    if (!match) throw new Error('Invalid image data URL');
    const mimeType = match[1] || 'image/png';
    const isBase64 = !!match[2];
    const payload = match[3] || '';
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg'
        : mimeType.includes('webp') ? 'webp'
        : mimeType.includes('gif') ? 'gif'
        : 'png';
    const buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'binary');
    ensureTempUploadDir();
    const filePath = path.join(TEMP_DIR, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
    fs.writeFileSync(filePath, buffer);
    return { filePath, mimeType, bytes: buffer.length };
}

function tempImageFileToDataUrl(filePath, mimeType = 'image/png') {
    const buffer = fs.readFileSync(filePath);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function resolveExecutableFromPath(exeName) {
    const pathParts = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
    for (const dir of pathParts) {
        const candidate = path.join(dir, exeName);
        if (fs.existsSync(candidate)) return candidate;
    }
    return '';
}

function resolveRealEsrganExecutable() {
    const candidates = [
        process.env.NHP_REALESRGAN_EXE,
        path.join(ROOT_DIR, 'tools', 'realesrgan-ncnn-vulkan', 'realesrgan-ncnn-vulkan.exe'),
        path.join(ROOT_DIR, 'tools', 'realesrgan', 'realesrgan-ncnn-vulkan.exe'),
        path.join(ROOT_DIR, 'realesrgan-ncnn-vulkan.exe'),
        resolveExecutableFromPath('realesrgan-ncnn-vulkan.exe'),
        resolveExecutableFromPath('realesrgan-ncnn-vulkan')
    ].filter(Boolean);

    return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd || ROOT_DIR,
            windowsHide: true
        });
        let stdout = '';
        let stderr = '';
        const timeout = setTimeout(() => {
            try {
                child.kill();
            } catch (_) { }
            reject(new Error(`Command timed out after ${options.timeoutMs || REALESRGAN_TIMEOUT_MS}ms`));
        }, options.timeoutMs || REALESRGAN_TIMEOUT_MS);

        child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
        child.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        child.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }
            reject(new Error(stderr.trim() || stdout.trim() || `Command exited with code ${code}`));
        });
    });
}

async function runLocalRealEsrganUpscale({ dataUrl, scale = 2, model = 'realesrgan-x4plus', tile = 128 }) {
    if (!dataUrl) throw new Error('Missing image data');
    const executable = resolveRealEsrganExecutable();
    if (!executable) {
        throw new Error('Real-ESRGAN executable not found. Put realesrgan-ncnn-vulkan.exe in tools/realesrgan-ncnn-vulkan or set NHP_REALESRGAN_EXE.');
    }

    const safeScale = [2, 3, 4].includes(Number(scale)) ? Number(scale) : 2;
    const safeTile = Math.max(64, Math.min(256, Number(tile) || 128));
    const input = dataUrlToTempImageFile(dataUrl, 'studio_upscale_input');
    const outputPath = path.join(TEMP_DIR, `studio_upscale_output_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`);

    try {
        await runCommand(executable, [
            '-i', input.filePath,
            '-o', outputPath,
            '-n', String(model || 'realesrgan-x4plus'),
            '-s', String(safeScale),
            '-t', String(safeTile)
        ], {
            cwd: path.dirname(executable),
            timeoutMs: REALESRGAN_TIMEOUT_MS
        });

        if (!fs.existsSync(outputPath)) {
            throw new Error('Real-ESRGAN did not produce an output image.');
        }

        return {
            success: true,
            dataUrl: tempImageFileToDataUrl(outputPath, 'image/png'),
            scale: safeScale,
            model: String(model || 'realesrgan-x4plus'),
            tile: safeTile,
            executable
        };
    } finally {
        for (const filePath of [input.filePath, outputPath]) {
            try {
                if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (error) {
                log(`Real-ESRGAN temp cleanup warning: ${error.message}`, 'WARN');
            }
        }
    }
}

function getBrowserArgs() {
    const args = [
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--window-size=1280,950',
        '--no-sandbox',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=Translate'
    ];
    if (fs.existsSync(path.join(ROOT_DIR, 'manifest.json'))) {
        args.push(`--load-extension=${ROOT_DIR}`);
    }
    return sanitizeChromeArgs(args, 'getBrowserArgs');
}

async function getDebugWebSocketUrl() {
    try {
        const debugHost = LISTEN_HOST === '0.0.0.0' ? '127.0.0.1' : LISTEN_HOST;
        const response = await fetch(`http://${debugHost}:${DEBUG_PORT}/json/version`, { signal: AbortSignal.timeout(1500) });
        if (!response.ok) return '';
        const data = await response.json();
        return data.webSocketDebuggerUrl || '';
    } catch (_) {
        return '';
    }
}

async function ensureBrowser() {
    const wsUrl = await getDebugWebSocketUrl();
    if (wsUrl) {
        const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
        await wireExternalProtocolGuard(browser, logToFile);
        return { browser, connected: true, mode: 'existing-debug-browser', port: DEBUG_PORT };
    }
    throw new Error(`Main Chrome is not available on debug port ${DEBUG_PORT}. The AI bridge will not open an isolated Chrome window.`);
}

async function waitForAiComposer(page, timeoutMs = 60000) {
    const start = Date.now();
    const selectors = [
        'textarea',
        'div[contenteditable="true"]',
        '[role="textbox"]',
        'rich-textarea div[contenteditable="true"]',
        'ms-chat-turn textarea'
    ];
    while ((Date.now() - start) < timeoutMs) {
        for (const selector of selectors) {
            const handle = await page.$(selector).catch(() => null);
            if (!handle) continue;
            const visible = await handle.evaluate((node) => {
                const rect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                return rect.width > 5 && rect.height > 5 && style.visibility !== 'hidden' && style.display !== 'none';
            }).catch(() => false);
            if (visible) return handle;
        }
        await delay(700);
    }
    throw new Error('AI composer was not found');
}

async function assertAiSessionReady(page, targetUrl = '') {
    const state = await page.evaluate(() => {
        const visibleText = (node) => {
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            if (rect.width <= 4 || rect.height <= 4 || style.display === 'none' || style.visibility === 'hidden') return '';
            return `${node.getAttribute('aria-label') || ''} ${node.innerText || node.textContent || ''}`.trim();
        };
        const buttons = [...document.querySelectorAll('button,a,[role="button"]')].map(visibleText).filter(Boolean);
        return {
            url: location.href,
            hasSignIn: buttons.some((text) => /sign in|تسجيل الدخول|connexion/i.test(text)),
            hasUpload: buttons.some((text) => /upload|attach|file|image|تحميل|إرفاق|صورة|ملف/i.test(text))
        };
    }).catch(() => ({ url: page.url(), hasSignIn: false, hasUpload: false }));

    if (state.hasSignIn) {
        throw new Error(`Gemini/ChatGPT session is not signed in for this controlled browser. Open the AI bridge browser with your logged-in session first. URL: ${state.url || targetUrl}`);
    }
    return state;
}

async function setAiComposerText(page, promptText) {
    const composer = await waitForAiComposer(page, 70000);
    await composer.evaluate((node, text) => {
        node.focus();
        if ('value' in node) {
            node.value = text;
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
        node.textContent = '';
        node.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }));
        node.textContent = text;
        node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }, String(promptText || ''));
    return composer;
}

async function getAiVisibleActionSnapshot(page) {
    return await page.evaluate(() => {
        const output = [];
        const visit = (root) => {
            if (!root || !root.querySelectorAll) return;
            for (const node of root.querySelectorAll('button,[role="button"],[role="menuitem"],label,input,textarea')) {
                output.push(node);
            }
            for (const node of root.querySelectorAll('*')) {
                if (node.shadowRoot) visit(node.shadowRoot);
            }
        };
        visit(document);
        return output.map((node) => {
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            return {
                tag: String(node.tagName || '').toLowerCase(),
                type: String(node.getAttribute('type') || '').toLowerCase(),
                aria: String(node.getAttribute('aria-label') || ''),
                accept: String(node.getAttribute('accept') || ''),
                text: String(node.innerText || node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
                visible: rect.width > 2 && rect.height > 2 && style.display !== 'none' && style.visibility !== 'hidden'
            };
        }).filter((item) => item.aria || item.text || item.type === 'file').slice(0, 80);
    }).catch(() => []);
}

async function findDeepFileInput(page, requireVisible = false) {
    const handle = await page.evaluateHandle((visibleOnly) => {
        const candidates = [];
        const visit = (root) => {
            if (!root || !root.querySelectorAll) return;
            for (const node of root.querySelectorAll('input[type="file"],input[accept*="image"],input[accept*="png"],input[accept*="jpg"],input[accept*="jpeg"]')) {
                candidates.push(node);
            }
            for (const node of root.querySelectorAll('*')) {
                if (node.shadowRoot) visit(node.shadowRoot);
            }
        };
        visit(document);
        for (const node of candidates) {
            if (!visibleOnly) return node;
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            if (rect.width > 2 && rect.height > 2 && style.display !== 'none' && style.visibility !== 'hidden') {
                return node;
            }
        }
        return null;
    }, !!requireVisible).catch(() => null);
    if (!handle) return null;
    const element = handle.asElement ? handle.asElement() : null;
    if (!element) {
        await handle.dispose().catch(() => null);
        return null;
    }
    return element;
}

async function clickAiAttachButtonIfNeeded(page) {
    const selectors = [
        'button[aria-label*="Open upload file menu" i]',
        'button[aria-label*="upload file menu" i]',
        'button[aria-label*="Upload" i]',
        'button[aria-label*="Attach" i]',
        'button[aria-label*="Add files" i]',
        'button[aria-label*="Image" i]',
        'button[aria-label*="Photo" i]',
        'button[aria-label*="Tools" i]',
        'button[aria-label*="Add" i]',
        'button[aria-label*="Plus" i]',
        '[role="button"][aria-label*="Upload" i]',
        '[role="button"][aria-label*="Attach" i]',
        '[role="button"][aria-label*="Tools" i]',
        '[role="button"][aria-label*="Add" i]'
    ];
    for (const selector of selectors) {
        const handle = await page.$(selector).catch(() => null);
        if (!handle) continue;
        const text = await handle.evaluate((node) =>             `${node.getAttribute('aria-label') || ''} ${node.textContent || ''}`.toLowerCase()        ).catch(() => '');
        if (!/upload|attach|file|image|photo|add|plus|tools|\u0631\u0641\u0639|\u062a\u062d\u0645\u064a\u0644|\u0623\u062f\u0648\u0627\u062a|\u0625\u0636\u0627\u0641\u0629|\u0645\u0644\u0641/.test(text)) continue;
        await handle.click().catch(() => null);
        await delay(800);
        return true;
    }
    return await page.evaluate(() => {
        const candidates = [];
        const visit = (root) => {
            if (!root || !root.querySelectorAll) return;
            for (const node of root.querySelectorAll('button,[role="button"],label,div,span')) {
                candidates.push(node);
            }
            for (const node of root.querySelectorAll('*')) {
                if (node.shadowRoot) visit(node.shadowRoot);
            }
        };
        visit(document);
        for (const node of candidates) {
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            if (rect.width <= 3 || rect.height <= 3 || style.display === 'none' || style.visibility === 'hidden') continue;
            const text = `${node.getAttribute('aria-label') || ''} ${node.innerText || node.textContent || ''}`.trim();
            if (!/upload|attach|image|photo|file|files|add|plus|tools|your computer|from computer|computer|device|gallery|\u0631\u0641\u0639|\u062a\u062d\u0645\u064a\u0644|\u0625\u0631\u0641\u0627\u0642|\u0635\u0648\u0631\u0629|\u0645\u0644\u0641|\u0645\u0644\u0641\u0627\u062a|\u0625\u0636\u0627\u0641\u0629|\u0623\u062f\u0648\u0627\u062a|\u062c\u0647\u0627\u0632\u0643|\u0627\u0644\u0643\u0645\u0628\u064a\u0648\u062a\u0631/.test(text)) continue;
            node.click();
            return true;
        }
        return false;
    }).catch(() => false);
}

async function clickAiUploadMenuItem(page) {
    const handles = await page.$$('button,[role="button"],[role="menuitem"],li,div,span').catch(() => []);
    for (const handle of handles) {
        const info = await handle.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            return {
                text: `${node.getAttribute('aria-label') || ''} ${node.innerText || node.textContent || ''}`.trim(),
                visible: rect.width > 4 && rect.height > 4 && style.display !== 'none' && style.visibility !== 'hidden'
            };
        }).catch(() => null);
        if (!info || !info.visible) continue;
        if (!/upload files?|upload from computer|file upload|attach files?|add files?|add photos?|image upload|your computer|computer|device|gallery|\u062a\u062d\u0645\u064a\u0644|\u0631\u0641\u0639|\u0645\u0644\u0641|\u0645\u0644\u0641\u0627\u062a|\u062c\u0647\u0627\u0632\u0643|\u0627\u0644\u062c\u0647\u0627\u0632|\u0627\u0644\u0643\u0645\u0628\u064a\u0648\u062a\u0631|\u0635\u0648\u0631|\u0625\u0636\u0627\u0641\u0629/.test(info.text)) continue;
        await handle.click().catch(() => null);
        return true;
    }
    return false;
}

async function tryAiFileChooserUpload(page, filePath) {
    try {
        const chooserPromise = page.waitForFileChooser({ timeout: 8000 });
        const opened = await clickAiUploadMenuItem(page);
        if (!opened) return false;
        const chooser = await chooserPromise;
        await chooser.accept([filePath]);
        await delay(6500);
        return true;
    } catch (_) {
        return false;
    }
}

async function injectAiImageViaPage(page, dataUrl) {
    return await page.evaluate(async (base64Image) => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const isElementVisible = (element) => {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };
        const getElementLabel = (element) => {
            if (!element) return '';
            return [
                element.getAttribute?.('aria-label'),
                element.getAttribute?.('data-testid'),
                element.getAttribute?.('mattooltip'),
                element.getAttribute?.('title'),
                element.textContent
            ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
        };
        const resolveComposerCandidate = (element) => {
            if (!element) return null;
            if (element.matches?.('textarea, div[contenteditable="true"], [role="textbox"][contenteditable="true"]') && isElementVisible(element)) return element;
            const nested = element.querySelector?.('textarea, div[contenteditable="true"], [role="textbox"][contenteditable="true"]');
            if (nested && isElementVisible(nested)) return nested;
            const shadowNested = element.shadowRoot?.querySelector?.('textarea, div[contenteditable="true"], [role="textbox"][contenteditable="true"]');
            if (shadowNested && isElementVisible(shadowNested)) return shadowNested;
            return null;
        };
        const getComposer = () => {
            const selectors = [
                'textarea#prompt-textarea',
                'textarea[data-testid="prompt-textarea"]',
                'textarea[placeholder]',
                'rich-textarea div[contenteditable="true"]',
                'div[contenteditable="true"][role="textbox"]',
                'div[contenteditable="true"][aria-label]',
                'div[contenteditable="true"][data-placeholder]',
                'rich-textarea',
                'textarea'
            ];
            for (const selector of selectors) {
                for (const element of document.querySelectorAll(selector)) {
                    const composer = resolveComposerCandidate(element);
                    if (composer) return composer;
                }
            }
            return null;
        };
        const getFileInput = () => {
            const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
            return inputs.find((input) => {
                const accept = (input.getAttribute('accept') || '').toLowerCase();
                return !input.disabled && (accept.includes('image') || accept === '' || accept.includes('*/*'));
            }) || null;
        };
        const collectImageAttachmentPreviewKeys = () => {
            const selectors = [
                'img[src^="blob:"]',
                'img[src^="data:image/"]',
                '[data-testid*="attachment" i]',
                '[aria-label*="attachment" i]',
                '[aria-label*="image" i]',
                'button[aria-label*="Remove" i]'
            ];
            const keys = new Set();
            selectors.forEach((selector) => {
                try {
                    Array.from(document.querySelectorAll(selector))
                        .filter(isElementVisible)
                        .forEach((element, index) => {
                            const rect = element.getBoundingClientRect();
                            const src = element.getAttribute?.('src') || '';
                            const label = getElementLabel(element);
                            keys.add(`${selector}:${src.slice(0, 80)}:${label.slice(0, 80)}:${Math.round(rect.left)}:${Math.round(rect.top)}:${index}`);
                        });
                } catch (_) {}
            });
            return keys;
        };
        const hasImageAttachmentPreview = (previousKeys = null) => {
            const currentKeys = collectImageAttachmentPreviewKeys();
            if (!previousKeys) return currentKeys.size > 0;
            for (const key of currentKeys) {
                if (!previousKeys.has(key)) return true;
            }
            return currentKeys.size > previousKeys.size;
        };
        const waitForImageAttachment = async (timeoutMs = 6000, previousKeys = null) => {
            const startedAt = Date.now();
            while ((Date.now() - startedAt) < timeoutMs) {
                if (hasImageAttachmentPreview(previousKeys)) return true;
                await sleep(400);
            }
            return hasImageAttachmentPreview(previousKeys);
        };
        const acceptAiUploadDialogs = async (timeoutMs = 5000) => {
            const positiveLabels = ['accept', 'agree', 'continue', 'got it', 'accepter', 'continuer', 'j’accepte', "j'accepte", 'موافق', 'قبول', 'استمرار'];
            const negativeLabels = ['cancel', 'annuler', 'close', 'dismiss', 'إلغاء'];
            const startedAt = Date.now();
            while ((Date.now() - startedAt) < timeoutMs) {
                const candidates = Array.from(document.querySelectorAll('button,[role="button"]')).filter((button) => isElementVisible(button) && !button.disabled);
                const acceptButton = candidates.find((button) => {
                    const text = `${getElementLabel(button)} ${button.innerText || button.textContent || ''}`.toLowerCase();
                    return positiveLabels.some((label) => text.includes(label)) && !negativeLabels.some((label) => text.includes(label));
                });
                if (acceptButton) {
                    acceptButton.click();
                    await sleep(900);
                    return true;
                }
                await sleep(400);
            }
            return false;
        };
        const dispatchImageDrop = async (target, file, previousKeys = null) => {
            const dropTarget = target || getComposer() || document.body;
            if (!dropTarget) return false;
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            ['dragenter', 'dragover', 'drop'].forEach((type) => {
                dropTarget.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
            });
            return waitForImageAttachment(7000, previousKeys);
        };
        const dataUrlToFile = (value, fileName = 'design_reference.png') => {
            const match = String(value || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/);
            if (!match) throw new Error('Invalid image data URL.');
            const mimeType = match[1] || 'image/png';
            const isBase64 = !!match[2];
            const payload = match[3] || '';
            const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            return new File([bytes], fileName, { type: mimeType });
        };

        if (!base64Image || base64Image === 'null') return { success: true, mode: 'no-image' };
        const previousKeys = collectImageAttachmentPreviewKeys();
        const file = dataUrlToFile(base64Image, 'design_reference.png');

        const fileInput = getFileInput();
        if (fileInput) {
            const dt = new DataTransfer();
            dt.items.add(file);
            const filesSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set;
            if (filesSetter) filesSetter.call(fileInput, dt.files);
            else fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            if (await waitForImageAttachment(9000, previousKeys)) return { success: true, mode: 'file-input' };
        }

        let editor = getComposer();
        if (!editor || typeof editor.focus !== 'function') return { success: false, mode: 'composer-missing' };
        editor.focus();
        editor.click();
        await sleep(250);

        const clipboardData = new DataTransfer();
        clipboardData.items.add(file);
        const pasteEvent = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true });
        editor.dispatchEvent(pasteEvent);
        if (await waitForImageAttachment(9000, previousKeys)) return { success: true, mode: 'paste' };

        if (await acceptAiUploadDialogs(6000)) {
            await sleep(800);
            editor = getComposer() || editor;
            editor.focus?.();
            editor.click?.();
            const retryPasteEvent = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true });
            editor.dispatchEvent(retryPasteEvent);
            if (await waitForImageAttachment(9000, previousKeys)) return { success: true, mode: 'paste-after-dialog' };
        }

        if (await dispatchImageDrop(editor, file, previousKeys)) return { success: true, mode: 'drop-editor' };
        if (await acceptAiUploadDialogs(5000)) {
            await sleep(800);
            if (await dispatchImageDrop(getComposer() || editor, file, previousKeys)) return { success: true, mode: 'drop-after-dialog' };
        }
        const parent = editor.closest?.('[role="form"], form, main, section') || editor.parentElement || document.body;
        if (await dispatchImageDrop(parent, file, previousKeys)) return { success: true, mode: 'drop-parent' };
        return { success: false, mode: 'all-failed' };
    }, dataUrl).catch((error) => ({ success: false, mode: 'exception', error: error?.message || String(error) }));
}

async function uploadAiBridgeImage(page, filePath, dataUrl = null) {
    if (dataUrl) {
        const injected = await injectAiImageViaPage(page, dataUrl);
        if (injected?.success) return true;
    }
    let input = await findDeepFileInput(page, false);
    if (!input) {
        await clickAiAttachButtonIfNeeded(page);
        await delay(1200);
        input = await findDeepFileInput(page, false);
    }
    if (!input) {
        const uploadedByChooser = await tryAiFileChooserUpload(page, filePath);
        if (uploadedByChooser) return true;
        await delay(2200);
        input = await findDeepFileInput(page, false);
    }
    if (!input) {
        const snapshot = await getAiVisibleActionSnapshot(page);
        throw new Error(`AI file input was not found | snapshot=${JSON.stringify(snapshot)}`);
    }
    await input.uploadFile(filePath);
    await delay(6500);
    return true;
}

async function clickAiSendButton(page) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const clicked = await page.evaluate(() => {
            const isVisible = (element) => {
                if (!element) return false;
                const rect = element.getBoundingClientRect();
                const style = window.getComputedStyle(element);
                return rect.width > 4 && rect.height > 4 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const isDisabled = (element) => !!(
                !element
                || element.disabled
                || element.getAttribute('disabled') !== null
                || element.getAttribute('aria-disabled') === 'true'
            );
            const getLabel = (element) => [
                element.getAttribute?.('aria-label'),
                element.getAttribute?.('data-testid'),
                element.getAttribute?.('mattooltip'),
                element.getAttribute?.('title'),
                element.textContent
            ].filter(Boolean).join(' ').replace(/s+/g, ' ').trim().toLowerCase();
            const triggerClick = (element) => {
                element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
                element.focus?.({ preventScroll: true });
                const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
                for (const type of events) {
                    const EventCtor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
                    try {
                        element.dispatchEvent(new EventCtor(type, {
                            bubbles: true,
                            cancelable: true,
                            composed: true,
                            view: window,
                            button: 0,
                            buttons: 1,
                            pointerId: 1,
                            pointerType: 'mouse',
                            isPrimary: true
                        }));
                    } catch (_) {
                        element.dispatchEvent(new MouseEvent(type, {
                            bubbles: true,
                            cancelable: true,
                            composed: true,
                            view: window,
                            button: 0,
                            buttons: 1
                        }));
                    }
                }
                if (typeof element.click === 'function') element.click();
            };
            const selectors = [
                'button[aria-label*="Send prompt" i]',
                'button[aria-label*="Send" i]',
                'button[aria-label*="Send message" i]',
                'button[aria-label*="Run" i]',
                'button[aria-label*="Submit" i]',
                'button[aria-label*="\u0625\u0631\u0633\u0627\u0644" i]',
                'button[aria-label*="\u062A\u0634\u063A\u064A\u0644" i]',
                'button[mattooltip*="Send" i]',
                '[role="button"][aria-label*="Send" i]',
                '[role="button"][aria-label*="\u0625\u0631\u0633\u0627\u0644" i]',
                'button[data-testid="send-button"]',
                '[data-testid="send-button"]',
                '.send-button',
                'button[type="submit"]'
            ];
            for (const selector of selectors) {
                for (const element of document.querySelectorAll(selector)) {
                    const label = getLabel(element);
                    if (
                        !isDisabled(element)
                        && isVisible(element)
                        && !label.includes('download')
                        && !label.includes('voice')
                        && !label.includes('mic')
                        && !label.includes('upload')
                        && !label.includes('stop')
                        && !label.includes('cancel')
                        && !label.includes('abort')
                        && !label.includes('\u0625\u064a\u0642\u0627\u0641')
                        && !label.includes('\u0625\u0644\u063a\u0627\u0621')
                    ) {
                        triggerClick(element);
                        return true;
                    }
                }
            }
            const fallback = Array.from(document.querySelectorAll('button,[role="button"]')).find((button) => {
                if (isDisabled(button) || !isVisible(button)) return false;
                const label = getLabel(button);
                return (
                    (label.includes('send') || label.includes('submit') || label.includes('run') || label.includes('\u0627\u0631\u0633\u0627\u0644'))
                    && !label.includes('download')
                    && !label.includes('upload')
                    && !label.includes('stop')
                    && !label.includes('cancel')
                    && !label.includes('abort')
                    && !label.includes('\u0625\u064a\u0642\u0627\u0641')
                    && !label.includes('\u0625\u0644\u063a\u0627\u0621')
                );
            });
            if (fallback) {
                triggerClick(fallback);
                return true;
            }
            return false;
        }).catch(() => false);
        if (clicked) return true;
        await delay(900);
    }
    throw new Error('AI send button was not found');
}

async function readAiResponseSnapshot(page, promptText = '') {
    return await page.evaluate((promptSeed) => {
        const isElementVisible = (element) => {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 4 && rect.height > 4 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const normalizeVisibleText = (node) => String(
            node?.innerText
            || node?.textContent
            || ''
        ).replace(/\s+/g, ' ').trim();
        const extractJsonSnippet = (text) => {
            const fencedMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/i);
            if (fencedMatch?.[1]) {
                const fencedJsonMatch = fencedMatch[1].match(/\{[\s\S]*\}/);
                if (fencedJsonMatch) return fencedJsonMatch[0];
            }
            const plainMatch = String(text || '').match(/\{[\s\S]*\}/);
            return plainMatch ? plainMatch[0] : '';
        };
        const isGenerationInProgress = () => !!document.querySelector(
            'button[aria-label*="Stop generating" i], button[aria-label*="Stop streaming" i], button[aria-label*="إيقاف التوليد" i], .stop-button, [active="true"] .generating-icon'
        );
        const selectors = [
            '[data-message-author-role="model"] .markdown',
            '[data-message-author-role="model"]',
            '[data-message-author-role="assistant"] .markdown',
            '[data-message-author-role="assistant"]',
            'model-response .markdown',
            'model-response',
            'message-content .markdown',
            'message-content',
            '.model-response-text',
            '.response-content',
            'article .markdown',
            'article [data-message-author-role="assistant"]',
            '.markdown',
            '[data-response-id]'
        ];
        const promptHead = String(promptSeed || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        const seedFull = String(promptSeed || '');
        // Ultra-short model replies (e.g. Islamic niche ruling "[حلال] - …") must not be discarded.
        const compactReplyPrompt = /احكم هل|أقواس فقط|الحكم بين أقواس|Print-on-Demand[^\n]{0,120}مسلم/i.test(seedFull);
        const minCandidateChars = compactReplyPrompt ? 6 : 80;
        const seen = new Set();
        const candidates = [];
        selectors.forEach((selector, selectorIndex) => {
            document.querySelectorAll(selector).forEach((node, nodeIndex) => {
                if (!isElementVisible(node)) return;
                const text = normalizeVisibleText(node);
                if (text.length < minCandidateChars) return;
                if (promptHead && text.startsWith(promptHead)) return;
                if (text.includes('Preparing Gemini Workspace')) return;
                const key = text.slice(0, 220);
                if (seen.has(key)) return;
                seen.add(key);
                candidates.push({
                    text,
                    selectorIndex,
                    nodeIndex,
                    score: selector.startsWith('[data-message-author-role="model"]') || selector.startsWith('model-response')
                        ? 3
                        : selector.includes('message-content')
                            ? 2
                            : 1
                });
            });
        });
        if (!candidates.length) {
            return { isGenerating: isGenerationInProgress(), text: '' };
        }
        const candidateWithJson = [...candidates].reverse().find((candidate) => extractJsonSnippet(candidate.text));
        if (candidateWithJson) {
            return { isGenerating: isGenerationInProgress(), text: extractJsonSnippet(candidateWithJson.text) };
        }
        const sorted = [...candidates].sort((left, right) => {
            if (left.score !== right.score) return right.score - left.score;
            if (left.selectorIndex !== right.selectorIndex) return right.selectorIndex - left.selectorIndex;
            return right.nodeIndex - left.nodeIndex;
        });
        return { isGenerating: isGenerationInProgress(), text: sorted[0]?.text || '' };
    }, promptText).catch(() => ({ isGenerating: false, text: '' }));
}

async function waitForAiTextResponse(page, promptText = '', timeoutMs = 180000) {
    let lastText = '';
    let stablePasses = 0;
    let waited = 0;

    while (waited < timeoutMs) {
        await delay(4000);
        waited += 4000;
        const snapshot = await readAiResponseSnapshot(page, promptText);
        const currentText = String(snapshot?.text || '').trim();
        if (currentText && currentText !== lastText) {
            lastText = currentText;
            stablePasses = 0;
        } else if (currentText) {
            stablePasses += 1;
        }
        if ((!snapshot?.isGenerating && lastText && stablePasses >= 2) || (waited > 45000 && lastText && stablePasses >= 1)) {
            return lastText;
        }
    }

    throw new Error('Timed out while waiting for Gemini text response.');
}

async function runLocalAiPromptBridge({ targetUrl, promptText, dataUrl }) {
    const finalUrl = targetUrl || 'https://gemini.google.com/';
    let tempImage = null;
    if (dataUrl) {
        tempImage = dataUrlToTempImageFile(dataUrl, 'ai_bridge_upload');
    }
    const browserSession = await ensureBrowser();

    try {
        const pages = await browserSession.browser.pages().catch(() => []);
        const normalizedFinalUrl = String(finalUrl || '').trim();
        let page = pages.slice().reverse().find((entry) => String(entry.url() || '').trim() === normalizedFinalUrl) || null;
        if (!page) {
            const finalUrlNoHash = normalizedFinalUrl.split('#')[0];
            page = pages.slice().reverse().find((entry) => String(entry.url() || '').split('#')[0].trim() === finalUrlNoHash) || null;
        }
        if (!page) {
            page = pages.slice().reverse().find((entry) => /gemini\.google\.com/i.test(entry.url() || '')) || null;
        }
        if (!page) {
            page = await browserSession.browser.newPage();
            await installExternalProtocolGuard(page, logToFile);
        }
        await page.setViewport({ width: 1280, height: 950 });
        page.on('console', (message) => log(`[PAGE] ${message.text()}`));

        await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => null);
        await assertAiSessionReady(page, finalUrl);
        await waitForAiComposer(page, 90000);
        if (tempImage?.filePath && dataUrl) {
            await uploadAiBridgeImage(page, tempImage.filePath, dataUrl);
        }
        if (String(promptText || '').trim()) {
            await setAiComposerText(page, promptText);
        }
        await clickAiSendButton(page);
        const responseText = await waitForAiTextResponse(page, promptText, 180000);

        const bytes = tempImage?.bytes ?? 0;
        log(`${tempImage ? `Sent image to ${finalUrl} | bytes=${bytes}` : `Sent text prompt to ${finalUrl}`} | mode=${browserSession.mode}`);
        return {
            success: true,
            bridge: 'ai-bridge-server',
            mode: browserSession.mode,
            port: PORT,
            debugPort: DEBUG_PORT,
            bytes,
            responseText
        };
    } finally {
        try {
            if (tempImage?.filePath && fs.existsSync(tempImage.filePath)) fs.unlinkSync(tempImage.filePath);
        } catch (error) {
            log(`Temp cleanup warning: ${error.message}`, 'WARN');
        }
        if (browserSession.connected) {
            await browserSession.browser.disconnect().catch(() => null);
        }
    }
}

async function runLocalAiImageBridge({ targetUrl, dataUrl, promptText }) {
    if (!dataUrl) throw new Error('Missing image data');
    return runLocalAiPromptBridge({ targetUrl, promptText, dataUrl });
}

app.get('/ping', (_req, res) => {
    res.json({
        ok: true,
        service: 'ai-bridge',
        port: PORT,
        debugPort: DEBUG_PORT,
        routes: ['/ping', '/ai-image-bridge', '/ai-text-bridge', '/studio-ai-upscale', '/studio-ai-upscale/status']
    });
});

app.get('/studio-ai-upscale/status', (_req, res) => {
    const executable = resolveRealEsrganExecutable();
    res.json({
        success: true,
        available: !!executable,
        executable: executable || null,
        expectedLocations: [
            'tools/realesrgan-ncnn-vulkan/realesrgan-ncnn-vulkan.exe',
            'tools/realesrgan/realesrgan-ncnn-vulkan.exe',
            'NHP_REALESRGAN_EXE'
        ]
    });
});

app.post('/studio-ai-upscale', async (req, res) => {
    try {
        const { dataUrl, scale, model, tile } = req.body || {};
        const result = await runLocalRealEsrganUpscale({ dataUrl, scale, model, tile });
        res.json(result);
    } catch (error) {
        log(`Real-ESRGAN upscale failed: ${error.stack || error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message || 'Real-ESRGAN upscale failed' });
    }
});

app.post('/ai-image-bridge', async (req, res) => {
    try {
        const { targetUrl, dataUrl, promptText } = req.body || {};
        if (!dataUrl) return res.status(400).json({ success: false, error: 'Missing image data' });
        const result = await runLocalAiImageBridge({ targetUrl, dataUrl, promptText });
        res.json(result);
    } catch (error) {
        log(`Bridge failed: ${error.stack || error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message || 'AI bridge failed' });
    }
});

app.post('/ai-text-bridge', async (req, res) => {
    try {
        const { targetUrl, promptText } = req.body || {};
        if (!String(promptText || '').trim()) {
            return res.status(400).json({ success: false, error: 'Missing promptText' });
        }
        const result = await runLocalAiPromptBridge({ targetUrl, promptText, dataUrl: null });
        res.json(result);
    } catch (error) {
        log(`Text bridge failed: ${error.stack || error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message || 'AI text bridge failed' });
    }
});

app.post('/shutdown', (_req, res) => {
    res.json({ ok: true, shuttingDown: true });
    setTimeout(() => process.exit(0), 150);
});

app.get('/shutdown', (_req, res) => {
    res.json({ ok: true, shuttingDown: true });
    setTimeout(() => process.exit(0), 150);
});

app.get('/addon/nhp-start-all-servers.bat', (_req, res) => {
    try {
        const body = buildStartupScript(ROOT_DIR, 'bat');
        res.setHeader('Content-Type', 'application/x-msdownload');
        res.setHeader('Content-Disposition', 'attachment; filename=NHP_Start_All_Servers.cmd');
        res.send(Buffer.from(body, 'utf8'));
    } catch (error) {
        log(`startup-script bat failed: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message || 'Unable to build startup script.' });
    }
});

app.get('/addon/nhp-start-all-servers.sh', (_req, res) => {
    try {
        const body = buildStartupScript(ROOT_DIR, 'sh');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="NHP_Start_All_Servers.sh"');
        res.send(Buffer.from(body, 'utf8'));
    } catch (error) {
        log(`startup-script sh failed: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message || 'Unable to build startup script.' });
    }
});


function isWslRuntime() {
    if (process.platform !== 'linux') return false;
    try {
        return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
    } catch (_) {
        return false;
    }
}
app.listen(PORT, LISTEN_HOST, () => {
    const label = isWslRuntime() ? 'WSL' : 'local';
    log(`AI Bridge Server listening on http://${LISTEN_HOST}:${PORT} (${label})`);
});
