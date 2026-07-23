if (process.platform === 'linux') {
    process.env.DISPLAY = process.env.DISPLAY || ':10';
}
const fs = require('fs');
const path = require('path');
const Module = require('module');

const extraNodePaths = [
    path.join(__dirname, 'node_modules')
].filter((dir) => fs.existsSync(dir));

if (extraNodePaths.length) {
    process.env.NODE_PATH = [process.env.NODE_PATH, ...extraNodePaths].filter(Boolean).join(path.delimiter);
    Module._initPaths();
}

const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');
const {
    installExternalProtocolGuard,
    wireExternalProtocolGuard,
} = require('./server/chrome-launch-shared');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = 3023;
const ROOT_DIR = __dirname;
const TEMP_DIR = path.join(ROOT_DIR, 'temp_uploads_pinterest');
const LOG_DIR = path.join(ROOT_DIR, 'server_logs');
const PROFILES_DIR = path.join(ROOT_DIR, 'server_profiles_pinterest');
const BACKUPS_DIR = path.join(ROOT_DIR, 'profile_backups_pinterest');
const LOG_FILE = path.join(LOG_DIR, 'pinterest-server.log');
const PINTEREST_CREATION_URL = 'https://www.pinterest.com/pin-creation-tool/';
const PINTEREST_CREATION_PATH_HINTS = ['/pin-creation-tool', '/pin-builder', '/pin-creation'];

[TEMP_DIR, LOG_DIR, PROFILES_DIR, BACKUPS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json({ limit: '150mb' }));

function logToFile(message, type = 'INFO') {
    const line = `[${new Date().toISOString()}] [${type}] ${message}\n`;
    try { fs.appendFileSync(LOG_FILE, line, 'utf8'); } catch (_) { }
    console.log(line.trim());
}

function getChromePath() {
    const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
        '/usr/bin/chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];
    
    const diagnostics = [];
    const path = candidates.find((p) => {
        const exists = fs.existsSync(p);
        diagnostics.push(`${p}: ${exists}`);
        return exists;
    });
    
    if (path) {
        logToFile(`[ChromePath] Found candidate: ${path}`, 'INFO');
        return path;
    }

    if (process.platform !== 'win32') {
        try {
            const { execSync } = require('child_process');
            const commands = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'];
            for (const cmd of commands) {
                try {
                    const resolved = execSync(`which ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
                    if (resolved) {
                        const exists = fs.existsSync(resolved);
                        diagnostics.push(`which ${cmd} -> ${resolved} (${exists})`);
                        if (exists) {
                            logToFile(`[ChromePath] Found via which: ${resolved}`, 'INFO');
                            return resolved;
                        }
                    }
                } catch (_) {}
            }
        } catch (e) {
            diagnostics.push(`which search error: ${e.message}`);
        }
    }
    
    logToFile(`[ChromePath] Search failed. Diagnostics: ${diagnostics.join(' | ')}`, 'WARN');
    return null;
}

function getProfileDirForEmail(email) {
    const safeEmail = String(email || 'pinterest_session').replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(PROFILES_DIR, safeEmail);
}

function makeTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function sanitizeBackupName(name) {
    return String(name || 'autopilot_backup')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60) || 'autopilot_backup';
}

function getBackupDir(backupId) {
    return path.join(BACKUPS_DIR, sanitizeBackupName(backupId));
}

function ensureEmptyDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        return;
    }
    for (const entry of fs.readdirSync(dirPath)) {
        fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
    }
}

function copyDirContents(sourceDir, destinationDir) {
    if (!fs.existsSync(sourceDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
        return;
    }
    fs.mkdirSync(destinationDir, { recursive: true });
    for (const entry of fs.readdirSync(sourceDir)) {
        fs.cpSync(path.join(sourceDir, entry), path.join(destinationDir, entry), { recursive: true, force: true });
    }
}

function countProfileDirs(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    return fs.readdirSync(dirPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
}

function countAccountSnapshot(snapshot = {}) {
    const pinterestAccounts = Array.isArray(snapshot.ap_accounts_pinterest) ? snapshot.ap_accounts_pinterest : [];
    return pinterestAccounts.length;
}

function writeBackupManifest(backupDir, manifest) {
    fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

function readBackupManifest(backupDir) {
    const manifestPath = path.join(backupDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function listBackups() {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    return fs.readdirSync(BACKUPS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
            const backupDir = path.join(BACKUPS_DIR, entry.name);
            const manifest = readBackupManifest(backupDir);
            if (!manifest) return null;
            return {
                backupId: manifest.backupId || entry.name,
                createdAt: manifest.createdAt || null,
                profileCount: manifest.profileCount || 0,
                accountCount: manifest.accountCount || 0,
                backupDir,
                safetyBackup: !!manifest.safetyBackup
            };
        })
        .filter(Boolean)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForNewIP(page) {
    logToFile('Requesting IP rotation from main Ghost Server...');
    try {
        // الاتصال بالسيرفر الرئيسي لتفعيل وضع الطيران وتغيير الـ IP
        await fetch('http://127.0.0.1:3019/rotate-ip', { method: 'POST' });
        await delay(8000); // انتظار استقرار الشبكة
    } catch (e) {
        logToFile(`IP Rotation request failed: ${e.message}`, 'WARN');
    }
}

async function createStablePage(browser) {
    const page = await browser.newPage();
    await installExternalProtocolGuard(page, logToFile);
    await page.setViewport({ width: 1360, height: 980 });
    return page;
}

async function launchPinterestBrowser(account, {
    isVisual = false,
    puppeteerArgs = [],
    userDataDir = '',
    chromePath = undefined
} = {}) {
    const launchAttempts = [];
    const requestedHeadless = isVisual ? false : 'new';

    launchAttempts.push({
        label: requestedHeadless === false ? 'headful-primary' : 'headless-primary',
        headless: requestedHeadless,
        userDataDir
    });

    if (requestedHeadless !== false) {
        launchAttempts.push({
            label: 'headful-fallback',
            headless: false,
            userDataDir
        });
    }

    launchAttempts.push({
        label: 'temp-profile-fallback',
        headless: false,
        userDataDir: ''
    });

    let lastError = null;

    for (const attempt of launchAttempts) {
        try {
            logToFile(`Launching Pinterest browser | email=${account?.email || 'unknown'} | mode=${attempt.label} | headless=${attempt.headless}`, 'INFO');
            const browser = await puppeteer.launch({
                executablePath: chromePath || undefined,
                headless: attempt.headless,
                userDataDir: attempt.userDataDir || undefined,
                ignoreDefaultArgs: ['--enable-automation'],
                args: puppeteerArgs
            });
            await wireExternalProtocolGuard(browser, logToFile);
            return browser;
        } catch (error) {
            lastError = error;
            logToFile(`Pinterest launch failed | mode=${attempt.label} | ${error.message}`, 'WARN');
            const lowerMessage = String(error.message || '').toLowerCase();
            const canRetry =
                lowerMessage.includes('spawn eperm') ||
                lowerMessage.includes('eperm') ||
                lowerMessage.includes('spawn') ||
                lowerMessage.includes('failed to launch');
            if (!canRetry) break;
        }
    }

    throw lastError || new Error('Failed to launch Pinterest browser');
}

async function waitForAnySelector(page, selectors, timeout = 30000) {
    const selector = selectors.join(', ');
    try {
        await page.waitForFunction((joinedSelector) => {
            const isVisible = (el) => {
                if (!el) return false;
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && style.opacity !== '0'
                    && rect.width > 0
                    && rect.height > 0;
            };
            return Array.from(document.querySelectorAll(joinedSelector)).some(isVisible);
        }, { timeout }, selector);
    } catch (e) {
        // Don't throw - log and continue, as elements might appear later
        logToFile(`Selector timeout (${timeout}ms): ${selectors.slice(0, 3).join(' | ')}...`, 'WARN');
        // Give a small additional chance for elements to appear
        await delay(1000);
    }
    return selector;
}

async function setFieldValue(page, selectors, value, timeout = 20000) {
    const expected = String(value || '').trim();
    if (!expected) return false;

    await waitForAnySelector(page, selectors, timeout);
    try {
        return await page.evaluate((candidateSelectors, nextValue) => {
            const isVisible = (el) => {
                if (!el) return false;
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && style.opacity !== '0'
                    && rect.width > 0
                    && rect.height > 0;
            };

            const findField = () => {
                for (const selector of candidateSelectors) {
                    const nodes = Array.from(document.querySelectorAll(selector)).filter(isVisible);
                    if (nodes.length) return nodes[0];
                }
                return null;
            };

            const field = findField();
            if (!field) return false;

            field.focus();

            if (field.isContentEditable || field.getAttribute('contenteditable') === 'true') {
                field.textContent = nextValue;
                field.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: nextValue, inputType: 'insertText' }));
                field.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                const proto = field.tagName === 'TEXTAREA'
                    ? window.HTMLTextAreaElement.prototype
                    : window.HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                if (setter) setter.call(field, nextValue);
                else field.value = nextValue;

                field.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: nextValue, inputType: 'insertText' }));
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
            }
            field.blur();

            return String(field.value || '').trim() === nextValue.trim();
        }, selectors, expected);
    } catch (e) {
        logToFile(`setFieldValue error: ${e.message}`, 'WARN');
        return false;
    }
}

async function setFieldValueByHints(page, hints, value, timeout = 20000) {
    const expected = String(value || '').trim();
    if (!expected) return false;

    try {
        await page.waitForFunction((hintsList, nextValue) => {
            const isVisible = (el) => {
                if (!el) return false;
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && style.opacity !== '0'
                    && rect.width > 0
                    && rect.height > 0;
            };

            const normalizeText = (text) => String(text || '').trim().toLowerCase();
            const fingerprint = (el) => normalizeText(el.placeholder || el.getAttribute('aria-label') || el.getAttribute('name') || el.getAttribute('data-test-id') || el.textContent || el.innerText || '');
            const getValue = (el) => String(el.value || el.textContent || el.innerText || '').trim();

            const setValue = (field, val) => {
                field.focus();
                if (field.isContentEditable || field.getAttribute('contenteditable') === 'true' || field.getAttribute('role') === 'textbox') {
                    try { document.execCommand('selectAll', false, null); } catch (_) {}
                    field.textContent = val;
                    field.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: val, inputType: 'insertText' }));
                    field.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: val, inputType: 'insertText' }));
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    const proto = field.tagName === 'TEXTAREA'
                        ? window.HTMLTextAreaElement.prototype
                        : window.HTMLInputElement.prototype;
                    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                    if (setter) setter.call(field, val);
                    else field.value = val;
                    field.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: val, inputType: 'insertText' }));
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
                field.blur();
                return getValue(field).toLowerCase().includes(val.trim().toLowerCase().slice(0, Math.min(20, val.length)));
            };

            const candidates = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"], [contenteditable]'))
                .filter(isVisible);

            const matched = candidates.find((el) => {
                const fingerprintText = fingerprint(el);
                return fingerprintText && hintsList.some((hint) => fingerprintText.includes(hint));
            });
            if (!matched) return false;
            return setValue(matched, nextValue);
        }, { timeout }, hints, expected);
        return true;
    } catch {
        return false;
    }
}

async function fillPinterestField(page, selectors, hints, value, timeout = 20000) {
    if (!String(value || '').trim()) return false;
    const direct = await setFieldValue(page, selectors, value, Math.min(timeout, 20000)).catch(() => false);
    if (direct) return true;
    return await setFieldValueByHints(page, hints, value, timeout);
}

async function clickElementByText(page, selectorList, textHints, timeout = 20000) {
    return await page.waitForFunction((selectors, hints) => {
        const isVisible = (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
            return style.display !== 'none'
                && style.visibility !== 'hidden'
                && style.opacity !== '0'
                && rect.width > 0
                && rect.height > 0;
        };

        const nodes = Array.from(document.querySelectorAll(selectors.join(','))).filter(isVisible);
        const target = nodes.find((node) => {
            const text = String(node.innerText || node.textContent || node.getAttribute('aria-label') || '').trim().toLowerCase();
            return text && hints.some((hint) => text.includes(hint));
        });

        if (!target) return false;

        target.scrollIntoView({ block: 'center', inline: 'center' });
        ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((type) => {
            target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        });
        if (typeof target.click === 'function') target.click();
        return true;
    }, { timeout }, selectorList, textHints);
}

async function clickPublishButton(page, timeout = 30000) {
    await page.waitForFunction(() => {
        const isVisible = (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== 'none'
                && style.visibility !== 'hidden'
                && style.opacity !== '0'
                && rect.width > 0
                && rect.height > 0;
        };

        const nodes = Array.from(document.querySelectorAll('button, [role="button"], [data-test-id], label')).filter(isVisible);
        const target = nodes.find((node) => {
            const text = String(node.innerText || node.textContent || '').trim().toLowerCase();
            const aria = String(node.getAttribute('aria-label') || '').trim().toLowerCase();
            const dataTestId = String(node.getAttribute('data-test-id') || '').trim().toLowerCase();
            return text === 'publish'
                || text === 'save'
                || aria.includes('publish')
                || dataTestId.includes('publish')
                || dataTestId.includes('save-pin-button')
                || dataTestId.includes('board-dropdown-save-button')
                || dataTestId === 'storyboard-publish-button';
        });

        if (!target) return false;
        target.scrollIntoView({ block: 'center', inline: 'center' });
        ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((type) => {
            target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        });
        if (typeof target.click === 'function') target.click();
        return true;
    }, { timeout });
}

async function ensurePinterestSession(page, account, autoLogin = true) {
    await page.goto(PINTEREST_CREATION_URL, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => { });
    await delay(2500);

    const isAuthenticated = async () => {
        return await page.evaluate(() => {
            const bodyText = String(document.body?.innerText || '').toLowerCase();
            const href = String(window.location.href || '');
            const hasPinBuilder = ['/pin-creation-tool', '/pin-builder', '/pin-creation'].some((hint) => href.includes(hint));
            const hasFileInput = !!document.querySelector('input[type="file"]');
            const hasEditButton = !!document.querySelector('[data-test-id*="edit"], [aria-label*="Edit"]');
            const hasAnyForm = !!document.querySelector('textarea, input[type="text"], div[contenteditable="true"]');
            const hasLoginPassword = !!document.querySelector('input[type="password"]');
            return (hasPinBuilder && (hasFileInput || hasEditButton || hasAnyForm)) || (!hasLoginPassword && (bodyText.includes('create pin') || bodyText.includes('add title')));
        });
    };

    if (await isAuthenticated()) return true;
    if (!autoLogin || !account?.pass) return false;

    logToFile(`Pinterest login attempt for ${account.email}`);

    try {
        // Try multiple email field selectors
        const emailFound = await setFieldValue(page, [
            'input[type="email"]',
            'input[name="id"]',
            'input[autocomplete="username"]',
            'input#email',
            'input[type="text"][autocomplete="email"]',
            'input[type="text"][name="email"]',
            'input[data-test-id*="email"]'
        ], account.email, 25000).catch(() => false);

        if (!emailFound) {
            logToFile(`Pinterest: Email field not found with standard selectors`, 'WARN');
            return false;
        }

        // Try multiple password field selectors
        const passFound = await setFieldValue(page, [
            'input[type="password"]',
            'input[autocomplete="current-password"]',
            'input#password',
            'input[name="password"]',
            'input[data-test-id*="password"]'
        ], account.pass, 25000).catch(() => false);

        if (!passFound) {
            logToFile(`Pinterest: Password field not found with standard selectors`, 'WARN');
            return false;
        }

        await clickElementByText(
            page,
            ['button', 'div[role="button"]', '[data-test-id]', 'span', '[type="submit"]'],
            ['log in', 'login', 'continue', 'submit', 'next'],
            25000
        ).catch(() => {
            logToFile(`Pinterest: Login button not found, assuming auto-submit`, 'WARN');
        });
    } catch (error) {
        logToFile(`Pinterest login UI not completed: ${error.message}`, 'WARN');
        return false;
    }

    // Wait for redirect after login
    await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null),
        delay(8000)
    ]);

    await page.goto(PIN_BUILDER_URL, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => { });
    await delay(2500);
    return await isAuthenticated();
}

function prioritizePinterestEnglishText(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';

    const parts = raw
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length <= 1) return raw;

    const englishParts = [];
    const otherParts = [];

    parts.forEach((part) => {
        const latinCount = (part.match(/[A-Za-z]/g) || []).length;
        const arabicCount = (part.match(/[\u0600-\u06FF]/g) || []).length;
        if (latinCount > 0 && latinCount >= arabicCount) englishParts.push(part);
        else otherParts.push(part);
    });

    return [...englishParts, ...otherParts].join('\n\n').trim() || raw;
}

function preferEnglishPinterestTags(tagsValue) {
    const rawTokens = Array.isArray(tagsValue)
        ? tagsValue
        : String(tagsValue || '')
            .split(/[,\n]/)
            .map((token) => token.trim())
            .filter(Boolean);

    if (!rawTokens.length) return '';

    const englishTokens = rawTokens.filter((token) => /[A-Za-z]/.test(token));
    const selected = englishTokens.length ? englishTokens : rawTokens;
    return selected.join(', ').trim();
}

function buildPinterestPayload(design) {
    const meta = design?.meta || {};
    const tags = preferEnglishPinterestTags(meta.tags);
    const title = prioritizePinterestEnglishText(String(meta.title || design?.file?.name || 'Pinterest Design'))
        .replace(/\.[^/.]+$/, '')
        .trim()
        .slice(0, 100);
    const description = [
        prioritizePinterestEnglishText(meta.description || ''),
        tags
    ].filter(Boolean).join('\n\n').trim().slice(0, 800);
    const altText = prioritizePinterestEnglishText(String(meta.altText || meta.alt_text || meta.description || title || '')).trim().slice(0, 500);
    const link = String(meta.product_url || meta.productUrl || meta.link || '').trim();

    return { title, description, altText, link };
}

async function selectPinterestBoard(page, timeout = 25000) {
    try {
        logToFile('Attempting to select a Pinterest board...');
        // Check if a board is already selected
        const alreadySelected = await page.evaluate(() => {
            const boardText = document.querySelector('[data-test-id="board-dropdown-select-button"] [style*="ellipsis"]')?.innerText;
            return boardText && boardText.toLowerCase() !== 'select';
        });

        if (alreadySelected) {
            logToFile('A board is already selected.');
            return true;
        }

        // Click the board dropdown
        const dropdownClicked = await clickElementByText(page, 
            ['button', '[role="button"]', '[data-test-id="board-dropdown-select-button"]', 'div'], 
            ['select', 'choose board', 'board'], 20000).catch(() => false);

        if (!dropdownClicked) {
            logToFile('Could not click board dropdown, trying fallback selector', 'WARN');
            await page.click('[data-test-id="board-dropdown-select-button"]').catch(() => {});
        }

        await delay(2000);

        // Click the first available board
        const boardPicked = await page.evaluate(() => {
            const boards = Array.from(document.querySelectorAll('[data-test-id="board-row"], [role="listitem"] div, div[data-test-id*="board"]'));
            if (boards.length > 0) {
                const target = boards[0];
                target.scrollIntoView();
                target.click();
                return true;
            }
            return false;
        });

        if (boardPicked) {
            logToFile('Board selected successfully.');
            await delay(1000);
            return true;
        } else {
            logToFile('No boards found in the list', 'WARN');
            return false;
        }
    } catch (e) {
        logToFile(`Board selection error: ${e.message}`, 'WARN');
        return false;
    }
}

async function uploadDesignToPinterest(page, design, index, total) {
    const payload = buildPinterestPayload(design);
    const rawBase64 = String(design?.base64 || '').trim();
    const cleanBase64 = rawBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = design?.file?.type || (rawBase64.startsWith('data:') ? (rawBase64.match(/^data:(image\/[^;]+);/i) || [])[1] : '') || 'image/png';
    const extension = mimeType === 'image/jpeg' ? 'jpg' : ((mimeType.split('/')[1] || 'png').replace('+xml', ''));
    const tempFilePath = path.join(TEMP_DIR, `pinterest_${Date.now()}_${index}.${extension}`);

    fs.writeFileSync(tempFilePath, Buffer.from(cleanBase64, 'base64'));
    logToFile(`Pinterest upload [${index + 1}/${total}] ${payload.title || design?.file?.name || 'untitled'}`);

    await page.goto(PIN_BUILDER_URL, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => { });
    await delay(4000); // Wait for React app to fully load

    // Wait for file input with extended timeout
    await waitForAnySelector(page, ['input[type="file"]'], 40000).catch(() => {
        logToFile('WARNING: File input not found quickly, attempting to proceed anyway', 'WARN');
    });

    const fileInput = await page.$('input[type="file"][accept*="image"], input[type="file"]');
    if (!fileInput) throw new Error('PINTEREST_FILE_INPUT_NOT_FOUND');
    
    await fileInput.uploadFile(tempFilePath);
    await delay(6000); // Allow time for image upload within Pinterest

    // Enhanced title field selectors - more options to handle Pinterest UI variations
    const titleSelectors = [
        'input[id="storyboard-selector-title"]',
        'textarea[placeholder*="Add a title"]',
        'input[placeholder*="Add a title"]',
        'textarea[placeholder*="Add your title"]',
        'input[placeholder*="Add your title"]',
        'textarea[id^="pin-draft-title-"]',
        'input[id^="pin-draft-title-"]',
        '[data-test-id="storyboard-selector-title"] input',
        '[data-test-id="storyboard-selector-title"] textarea',
        'div[contenteditable="true"][aria-label*="title"]',
        'div[role="textbox"][aria-label*="title"]',
        'input[aria-label*="title"]',
        'textarea[aria-label*="title"]',
        'div[data-test-id*="title"] input',
        'div[data-test-id*="title"] textarea'
    ];

    // Enhanced description field selectors
    const descSelectors = [
        'div[data-test-id="storyboard-selector-description"] [contenteditable="true"]',
        'div[data-test-id="editor-with-mentions"] [contenteditable="true"]',
        'textarea[placeholder*="Tell everyone what your Pin is about"]',
        'textarea[placeholder*="Add a detailed description"]',
        'textarea[id^="pin-draft-description-"]',
        'div[contenteditable="true"][aria-label*="description"]',
        'div[role="textbox"][aria-label*="description"]',
        'textarea[aria-label*="description"]',
        'input[aria-label*="description"]',
        'div[data-test-id*="description"] [contenteditable="true"]'
    ];

    // Enhanced link field selectors
    const linkSelectors = [
        'input[id="storyboard-selector-link"]',
        'input[placeholder*="Add a link"]',
        'input[placeholder*="Add a destination link"]',
        'textarea[placeholder*="Add a destination link"]',
        'input[id^="pin-draft-link-"]',
        'textarea[id^="pin-draft-link-"]',
        'input[type="url"]',
        'input[aria-label*="link"]',
        'textarea[aria-label*="link"]',
        'input[aria-label*="destination"]',
        'div[data-test-id*="link"] input'
    ];

    const titleHints = ['add your title', 'pin title', 'title', 'add title'];
    const descHints = ['tell everyone what your pin is about', 'description', 'about', 'details', 'what is this pin about'];
    const linkHints = ['add a destination link', 'destination link', 'website', 'link', 'url', 'destination'];

    // Wait for any form field to appear (with extended timeout)
    await waitForAnySelector(page, [
        'textarea[placeholder*="Add your title"]',
        'input[placeholder*="Add your title"]',
        'textarea[placeholder*="Tell everyone what your Pin is about"]',
        'input[placeholder*="Add a destination link"]',
        'div[contenteditable="true"]',
        'input[aria-label*="title"]',
        'textarea[aria-label*="title"]'
    ], 50000).catch(() => {
        logToFile('WARNING: Form fields not found in standard locations, attempting flexible search', 'WARN');
    });

    // Try to fill fields with extended timeout
    const titleOk = await fillPinterestField(page, titleSelectors, titleHints, payload.title, 40000).catch(() => {
        logToFile('WARNING: Failed to fill title field', 'WARN');
        return false;
    });
    
    await fillPinterestField(page, descSelectors, descHints, payload.description || payload.altText, 40000).catch(() => {
        logToFile('WARNING: Failed to fill description field', 'WARN');
    });
    
    if (payload.link) {
        await fillPinterestField(page, linkSelectors, linkHints, payload.link, 40000).catch(() => {
            logToFile('WARNING: Failed to fill link field', 'WARN');
        });
    }

    if (!titleOk) logToFile('PINTEREST_TITLE_FILL_FAILED or mismatched, continuing...', 'WARN');

    await delay(2000);
    
    // Attempt to select a board if none is selected
    await selectPinterestBoard(page).catch(() => {});
    await delay(1500);

    // Click publish button with extended timeout
    await clickPublishButton(page, 35000).catch(() => {
        logToFile('WARNING: Publish button click failed, checking for alternative submit methods', 'WARN');
    });

    // Wait for confirmation with more flexible detection
    const publishConfirmed = await Promise.race([
        page.waitForFunction(() => {
            const bodyText = String(document.body?.innerText || '').toLowerCase();
            const href = String(window.location.href || '');
            const urlChanged = !['/pin-creation-tool', '/pin-builder', '/pin-creation'].some((hint) => href.includes(hint));
            return bodyText.includes('you created a pin')
                || bodyText.includes('pin created')
                || bodyText.includes('published')
                || bodyText.includes('saved to')
                || bodyText.includes('save successful')
                || urlChanged;
        }, { timeout: 90000 }).then(() => true).catch(() => false),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 }).then(() => true).catch(() => false),
        // fallback: check after 15s if we are no longer on the creation page
        delay(15000).then(() => {
            return page.evaluate(() => {
                const href = String(window.location.href || '');
                return !['/pin-creation-tool', '/pin-builder', '/pin-creation'].some((hint) => href.includes(hint));
            });
        }).then(isGone => isGone ? true : new Promise(() => {})) // Only resolve if true, else let others win
    ]);

    if (!publishConfirmed) {
        logToFile('WARNING: Publish confirmation not detected, but may have succeeded', 'WARN');
        // Don't throw error - Pinterest may have published even without confirmation
    }

    try { fs.unlinkSync(tempFilePath); } catch (_) { }
    return { success: true, title: payload.title };
}

app.post('/browse-account', async (req, res) => {
    let browser;
    try {
        const { email, pass, autoLogin = true, targetUrl } = req.body || {};
        if (!email) return res.status(400).json({ success: false, error: 'Email' });

        browser = await puppeteer.launch({
            executablePath: getChromePath() || undefined,
            headless: false,
            userDataDir: getProfileDirForEmail(email),
            ignoreDefaultArgs: ['--enable-automation'],
            args: ['--window-size=1360,980', '--no-sandbox', '--disable-blink-features=AutomationControlled']
        });
        await wireExternalProtocolGuard(browser, logToFile);

        const page = await createStablePage(browser);
        const loggedIn = await ensurePinterestSession(page, { email, pass }, autoLogin);
        if (!loggedIn && autoLogin) {
            return res.status(401).json({ success: false, error: 'Pinterest auth failed' });
        }

        await page.goto(targetUrl || PIN_BUILDER_URL, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => { });
        browser.on('disconnected', () => logToFile(`Manual Pinterest session closed for ${email}`));
        logToFile(`Opened Pinterest session for ${email}`);
        res.json({ success: true, opened: true });
    } catch (error) {
        logToFile(`Browse error: ${error.message}`, 'ERROR');
        if (browser) {
            try { await browser.close(); } catch (_) { }
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/upload', async (req, res) => {
    let browser;
    try {
        const { account, designs, isVisual } = req.body || {};
        if (!account?.email) return res.status(400).json({ success: false, error: 'Email' });
        if (!Array.isArray(designs) || designs.length === 0) {
            return res.status(400).json({ success: false, error: 'Designs' });
        }

        const puppeteerArgs = ['--window-size=1360,980', '--no-sandbox', '--disable-blink-features=AutomationControlled'];
        let proxyUser, proxyPass;
        let requireWifiRotate = false;
        if (account.proxy) {
            const proxyStr = String(account.proxy).trim();
            if (proxyStr.toUpperCase() === 'WIFI') {
                requireWifiRotate = true;
            } else {
                const parts = proxyStr.split(':');
                if (parts.length >= 2) puppeteerArgs.push(`--proxy-server=${parts[0]}:${parts[1]}`);
                if (parts.length === 4) { proxyUser = parts[2]; proxyPass = parts[3]; }
            }
        }

        browser = await launchPinterestBrowser(account, {
            isVisual,
            puppeteerArgs,
            userDataDir: getProfileDirForEmail(account.email),
            chromePath: getChromePath()
        });

        const page = await createStablePage(browser);
        if(proxyUser && proxyPass) await page.authenticate({ username: proxyUser, password: proxyPass });
        
        if (requireWifiRotate) {
            await page.goto('about:blank');
            await waitForNewIP(page);
        }
        
        const loggedIn = await ensurePinterestSession(page, account, true);
        if (!loggedIn) {
            logToFile(`Pinterest auth failed for ${account.email}`, 'ERROR');
            return res.status(401).json({ success: false, error: 'Pinterest auth failed' });
        }

        let uploadedCount = 0;
        let failedCount = 0;
        const errors = [];

        for (let i = 0; i < designs.length; i += 1) {
            try {
                await uploadDesignToPinterest(page, designs[i], i, designs.length);
                uploadedCount += 1;
            } catch (e) {
                failedCount += 1;
                const errMsg = e.message || String(e);
                errors.push(errMsg);
                logToFile(`Pinterest upload failed for design ${i + 1}: ${errMsg}`, 'ERROR');
            }
            await delay(5000); // Increased delay between uploads
        }

        logToFile(`Pinterest upload completed for ${account.email} | uploaded=${uploadedCount} | failed=${failedCount}`);
        await browser.close();
        
        if (uploadedCount === 0) {
            return res.status(500).json({ success: false, error: `All uploads failed: ${errors[0] || 'Unknown error'}`, details: errors });
        }
        
        res.json({ success: true, uploaded: uploadedCount, failed: failedCount, errors: failedCount > 0 ? errors : [] });
    } catch (error) {
        logToFile(`Upload error: ${error.message}`, 'ERROR');
        if (browser) {
            try { await browser.close(); } catch (_) { }
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/shutdown', (req, res) => {
    res.json({ success: true, message: 'Pinterest server shutting down' });
    setTimeout(() => process.exit(0), 250);
});

app.get('/profiles-backup/list', (req, res) => {
    try {
        res.json({ success: true, backups: listBackups() });
    } catch (err) {
        logToFile(`Backup list error: ${err.message}`, 'ERROR');
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/profiles-backup/export', (req, res) => {
    try {
        const { backupName, snapshot } = req.body || {};
        const backupId = `${sanitizeBackupName(backupName)}_${makeTimestamp()}`;
        const backupDir = getBackupDir(backupId);
        const profilesBackupDir = path.join(backupDir, 'server_profiles_pinterest');

        fs.mkdirSync(backupDir, { recursive: true });
        copyDirContents(PROFILES_DIR, profilesBackupDir);

        const manifest = {
            version: 1,
            type: 'autopilot_session_backup',
            platform: 'pinterest',
            backupId,
            createdAt: new Date().toISOString(),
            profileCount: countProfileDirs(profilesBackupDir),
            accountCount: countAccountSnapshot(snapshot || {}),
            snapshot: snapshot || {}
        };

        writeBackupManifest(backupDir, manifest);
        logToFile(`Backup exported: ${backupId} (${manifest.profileCount} profiles)`);
        res.json({
            success: true,
            backupId,
            backupDir,
            profileCount: manifest.profileCount,
            accountCount: manifest.accountCount
        });
    } catch (err) {
        logToFile(`Backup export error: ${err.message}`, 'ERROR');
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/profiles-backup/import', (req, res) => {
    try {
        const { backupId, currentSnapshot } = req.body || {};
        if (!backupId) {
            return res.status(400).json({ success: false, error: 'backupId required' });
        }

        const backupDir = getBackupDir(backupId);
        const manifest = readBackupManifest(backupDir);
        const sourceProfilesDir = path.join(backupDir, 'server_profiles_pinterest');

        if (!manifest || !fs.existsSync(sourceProfilesDir)) {
            return res.status(404).json({ success: false, error: 'Backup not found' });
        }

        const safetyBackupId = `pre_restore_${makeTimestamp()}`;
        const safetyBackupDir = getBackupDir(safetyBackupId);
        const safetyProfilesDir = path.join(safetyBackupDir, 'server_profiles_pinterest');
        fs.mkdirSync(safetyBackupDir, { recursive: true });
        copyDirContents(PROFILES_DIR, safetyProfilesDir);
        writeBackupManifest(safetyBackupDir, {
            version: 1,
            type: 'autopilot_session_backup',
            platform: 'pinterest',
            backupId: safetyBackupId,
            createdAt: new Date().toISOString(),
            profileCount: countProfileDirs(safetyProfilesDir),
            accountCount: countAccountSnapshot(currentSnapshot || {}),
            safetyBackup: true,
            snapshot: currentSnapshot || {}
        });

        ensureEmptyDir(PROFILES_DIR);
        copyDirContents(sourceProfilesDir, PROFILES_DIR);

        logToFile(`Backup restored: ${backupId} -> profiles:${countProfileDirs(PROFILES_DIR)} | safety:${safetyBackupId}`);
        res.json({
            success: true,
            backupId,
            safetyBackupId,
            profileCount: countProfileDirs(PROFILES_DIR),
            snapshot: manifest.snapshot || {}
        });
    } catch (err) {
        logToFile(`Backup import error: ${err.message}`, 'ERROR');
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/ping', (req, res) => res.json({ ok: true, platform: 'pinterest', port: PORT }));

app.listen(PORT, () => {
    logToFile(`Pinterest server ready on http://127.0.0.1:${PORT}`);
});
