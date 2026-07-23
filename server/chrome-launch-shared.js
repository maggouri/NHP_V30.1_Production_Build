/**
 * Shared Chrome launch + stealth helpers — Ghost (3019) working pattern for Creaty (3020).
 * Do NOT add --disable-blink-features=AutomationControlled (unsupported-flag infobar).
 * On Windows, omit --no-sandbox (unsupported-flag infobar + worse Cloudflare score).
 */
const { exec } = require('child_process');
const path = require('path');

const RESTRICTIVE_EXTENSION_FLAGS = [
    '--disable-extensions',
    '--disable-extensions-except=',
];

const UNSUPPORTED_CHROME_FLAGS = [
    '--disable-blink-features=automationcontrolled',
];

function normalizeBlinkFeaturesArg(arg) {
    const text = String(arg || '').trim();
    const match = text.match(/^--disable-blink-features=(.+)$/i);
    if (!match) return { keep: true, value: text };
    const features = match[1]
        .split(',')
        .map((feature) => feature.trim())
        .filter((feature) => feature && feature.toLowerCase() !== 'automationcontrolled');
    if (features.length === 0) return { keep: false, value: text };
    return { keep: true, value: `--disable-blink-features=${features.join(',')}` };
}

function sanitizeChromeArgs(args = [], context = 'chrome-launch', logFn = null) {
    const safe = [];
    const blocked = [];
    for (const arg of (Array.isArray(args) ? args : [])) {
        const text = String(arg || '').trim();
        if (!text) continue;
        const lower = text.toLowerCase();
        if (
            lower === RESTRICTIVE_EXTENSION_FLAGS[0]
            || lower.startsWith(RESTRICTIVE_EXTENSION_FLAGS[1])
            || UNSUPPORTED_CHROME_FLAGS.includes(lower)
        ) {
            blocked.push(text);
            continue;
        }
        if (lower.startsWith('--disable-blink-features=')) {
            const normalized = normalizeBlinkFeaturesArg(text);
            if (!normalized.keep) {
                blocked.push(text);
                continue;
            }
            if (normalized.value !== text) blocked.push(text);
            safe.push(normalized.value);
            continue;
        }
        safe.push(text);
    }
    if (blocked.length > 0) {
        logFn?.(`[ChromeGuard] Removed unsupported/restrictive Chrome flags in ${context}: ${blocked.join(' | ')}`, 'WARN');
    }
    return safe;
}

/**
 * Ghost-server launch args — proven CF evasion on TeePublic.
 * @param {boolean|string} headless
 * @param {{ extraArgs?: string[] }} [options]
 */
function buildGhostChromeLaunchArgs(headless, options = {}) {
    const isHeadless = headless === true || headless === 'new';
    const isWin32 = process.platform === 'win32';
    const sandboxFlag = isWin32 ? [] : ['--no-sandbox', '--disable-setuid-sandbox'];
    const rdpFlags = isWin32 ? [] : [
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--password-store=basic'
    ];
    const base = isHeadless
        ? ['--window-size=1280,1050', ...sandboxFlag, ...rdpFlags, '--disable-infobars']
        : ['--start-maximized', '--window-size=1280,1050', ...sandboxFlag, ...rdpFlags, '--disable-infobars'];
    const extra = Array.isArray(options.extraArgs) ? options.extraArgs : [];
    return [...base, ...extra];
}

/** @deprecated use buildGhostChromeLaunchArgs */
function buildChromeLaunchArgs(headless, options = {}) {
    return buildGhostChromeLaunchArgs(headless, options);
}

function configureCreatyStealthPlugin(StealthPlugin) {
    const stealthPlugin = StealthPlugin();
    stealthPlugin.enabledEvasions.delete('navigator.webdriver');
    return stealthPlugin;
}

async function patchNavigatorWebdriver(page) {
    if (!page || page.isClosed()) return;
    const patch = () => {
        try {
            Object.defineProperty(Navigator.prototype, 'webdriver', {
                get: () => false,
                configurable: true,
            });
        } catch (_) {
            try {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false,
                    configurable: true,
                });
            } catch (__) {
                try {
                    delete Object.getPrototypeOf(navigator).webdriver;
                } catch (___) { /* ignore */ }
            }
        }
    };
    await page.evaluateOnNewDocument(patch);
    await page.evaluate(patch).catch(() => null);
}

function getDeterministicDebugPort(seed = '') {
    const basePort = 9322;
    const text = String(seed || 'default');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return basePort + (Math.abs(hash) % 200);
}

async function waitForDebugEndpoint(port, timeoutMs = 20000) {
    const start = Date.now();
    while ((Date.now() - start) < timeoutMs) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/version`, { method: 'GET' });
            if (response.ok) return true;
        } catch (_) { /* retry */ }
        await new Promise((resolve) => setTimeout(resolve, 600));
    }
    throw new Error(`Remote debugging endpoint not ready on port ${port}`);
}

async function connectToExistingDebugBrowser(puppeteer, port) {
    try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`, { method: 'GET' });
        if (!response.ok) return null;
        const browser = await puppeteer.connect({
            browserURL: `http://127.0.0.1:${port}`,
            defaultViewport: null,
        });
        return browser;
    } catch (_) {
        return null;
    }
}

function launchChromeDebugFallback({ getChromePath, userDataDir, targetUrl, args = [], headless = false, port, logFn }) {
    return new Promise((resolve, reject) => {
        const chromePath = getChromePath?.();
        if (!chromePath) {
            return reject(new Error('Chrome executable not found'));
        }

        const chromeArgs = sanitizeChromeArgs([
            `--remote-debugging-port=${port}`,
            '--no-first-run',
            '--disable-features=Translate',
            `--user-data-dir=${userDataDir}`,
            ...args,
        ], 'launchChromeDebugFallback', logFn);

        if (headless) chromeArgs.push('--headless=new');
        if (targetUrl) chromeArgs.push(targetUrl);

        if (process.platform === 'win32') {
            const quotePs = (value) => `'${String(value).replace(/'/g, "''")}'`;
            const psArgs = chromeArgs.map((arg) => quotePs(arg)).join(', ');
            const command = `Start-Process -FilePath ${quotePs(chromePath)} -ArgumentList @(${psArgs}) -WorkingDirectory ${quotePs(path.dirname(chromePath))}`;
            const cmdArgs = chromeArgs.map((arg) => `"${String(arg).replace(/"/g, '\\"')}"`).join(' ');

            exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${command}"`, { windowsHide: true }, (psError) => {
                if (!psError) {
                    resolve({ started: true, port, source: 'powershell' });
                    return;
                }

                logFn?.(`Chrome debug fallback via PowerShell failed: ${psError.message}`, 'WARN');
                exec(`cmd /c start "" "${chromePath}" ${cmdArgs}`, { windowsHide: true }, (cmdError) => {
                    if (cmdError) return reject(cmdError);
                    resolve({ started: true, port, source: 'cmd-start' });
                });
            });
        } else {
            // Linux / macOS: launch Chrome as a detached background process
            try {
                const { spawn } = require('child_process');
                const subprocess = spawn(chromePath, chromeArgs, {
                    detached: true,
                    stdio: 'ignore'
                });
                subprocess.unref();
                resolve({ started: true, port, source: 'spawn-detached' });
            } catch (err) {
                logFn?.(`Chrome debug fallback via spawn failed: ${err.message}`, 'WARN');
                reject(err);
            }
        }
    });
}

/**
 * Factory — same fallback launch path Ghost uses (puppeteer.launch → remote-debug fallback).
 */
function createLaunchBrowserWithFallback({
    puppeteer,
    getChromePath,
    logFn,
    profileLock,
}) {
    return async function launchBrowserWithFallback({
        launchOptions,
        debugSeed,
        targetUrl,
        fallbackArgs = [],
        fallbackHeadless = false,
        profileEmail = '',
    }) {
        if (launchOptions && Array.isArray(launchOptions.args)) {
            launchOptions.args = sanitizeChromeArgs(launchOptions.args, 'puppeteer.launch', logFn);
        }
        fallbackArgs = sanitizeChromeArgs(fallbackArgs, 'fallbackArgs', logFn);
        const userDataDir = launchOptions?.userDataDir || '';
        const port = getDeterministicDebugPort(debugSeed);
        const existingBrowser = await connectToExistingDebugBrowser(puppeteer, port);
        if (existingBrowser) {
            logFn?.(`[ProfileLock] Reusing remote-debug browser for ${profileEmail || debugSeed} port=${port}`, 'INFO');
            return { browser: existingBrowser, mode: 'existing_remote_debug', port };
        }

        const launchCore = async () => {
            try {
                const browser = await puppeteer.launch(launchOptions);
                return { browser, mode: 'puppeteer_launch' };
            } catch (error) {
                if (profileLock?.isBrowserAlreadyRunningError?.(error)) {
                    throw error;
                }
                if (!/spawn|EPERM|Failed to launch|Could not find Chrome/i.test(String(error?.message || ''))) {
                    throw error;
                }

                try {
                    await launchChromeDebugFallback({
                        getChromePath,
                        userDataDir: launchOptions.userDataDir,
                        targetUrl,
                        args: fallbackArgs,
                        headless: fallbackHeadless,
                        port,
                        logFn,
                    });
                } catch (fallbackError) {
                    logFn?.(`Remote debug fallback retrying in visible mode: ${fallbackError.message}`, 'WARN');
                    await launchChromeDebugFallback({
                        getChromePath,
                        userDataDir: launchOptions.userDataDir,
                        targetUrl,
                        args: fallbackArgs,
                        headless: false,
                        port,
                        logFn,
                    });
                }
                await waitForDebugEndpoint(port);
                const browser = await puppeteer.connect({
                    browserURL: `http://127.0.0.1:${port}`,
                    defaultViewport: null,
                });
                return { browser, mode: 'remote_debug_fallback', port };
            }
        };

        return profileLock.launchWithProfileLockRetry(
            launchCore,
            userDataDir,
            { logFn: (msg, type) => logFn?.(msg, type || 'WARN'), maxRetries: 1 }
        );
    };
}

async function gracefulCloseGhostBrowser(browser, launchMode = 'puppeteer_launch', logFn = null) {
    if (!browser) return;
    const needsCdpQuit = launchMode === 'existing_remote_debug' || launchMode === 'remote_debug_fallback';
    try {
        if (browser.isConnected()) {
            const pages = (await browser.pages().catch(() => [])).filter((page) => page && !page.isClosed());
            const page = pages[0];
            if (page) {
                const client = await page.createCDPSession().catch(() => null);
                if (client) {
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                    if (needsCdpQuit) {
                        await client.send('Browser.close').catch(() => null);
                        await browser.disconnect().catch(() => null);
                    }
                    await client.detach().catch(() => null);
                }
            }
            if (!needsCdpQuit) {
                await browser.close().catch((err) => {
                    logFn?.(`Browser close warning: ${err.message}`, 'WARN');
                });
            }
        }
    } catch (err) {
        logFn?.(`Graceful browser close warning: ${err.message}`, 'WARN');
    }
    const settleMs = needsCdpQuit ? 8000 : 6000;
    await new Promise((resolve) => setTimeout(resolve, settleMs));
}

async function createStablePage(browser, hooks = {}) {
    const pages = (await browser.pages().catch((err) => {
        hooks.logFn?.(`[ChromeGuard] Could not read initial pages: ${err.message}`, 'WARN');
        return [];
    })).filter((page) => page && !page.isClosed());
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    const viewport = hooks.viewport || { width: 1280, height: 1050 };
    await page.setViewport(viewport);
    if (typeof hooks.onPage === 'function') {
        await hooks.onPage(page);
    }
    await page.bringToFront().catch((err) => {
        hooks.logFn?.(`[ChromeGuard] Could not focus page: ${err.message}`, 'WARN');
    });
    const settleMs = Number.isFinite(hooks.settleMs) ? hooks.settleMs : 350 + Math.floor(Math.random() * 450);
    if (settleMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, settleMs));
    }
    return page;
}

module.exports = {
    RESTRICTIVE_EXTENSION_FLAGS,
    UNSUPPORTED_CHROME_FLAGS,
    sanitizeChromeArgs,
    buildGhostChromeLaunchArgs,
    buildChromeLaunchArgs,
    configureCreatyStealthPlugin,
    patchNavigatorWebdriver,
    getDeterministicDebugPort,
    waitForDebugEndpoint,
    connectToExistingDebugBrowser,
    launchChromeDebugFallback,
    createLaunchBrowserWithFallback,
    gracefulCloseGhostBrowser,
    createStablePage,
};
