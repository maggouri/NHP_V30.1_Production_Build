/**
 * Synthetic browser fingerprint — per launch / per signup session.
 * Consistent fake profile via evaluateOnNewDocument (call BEFORE first navigation).
 */
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
];

const PLATFORMS = ['Win32'];
const HARDWARE_CONCURRENCY = [4, 8, 12, 16];
const DEVICE_MEMORY = [4, 8, 16];
const LANGUAGE_SETS = [
    ['en-US', 'en'],
    ['fr-FR', 'fr'],
    ['en-US', 'en', 'fr'],
    ['en-GB', 'en'],
];

const SCREEN_PRESETS = [
    { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1 },
    { width: 1366, height: 768, colorDepth: 24, pixelRatio: 1 },
    { width: 1536, height: 864, colorDepth: 24, pixelRatio: 1.25 },
    { width: 2560, height: 1440, colorDepth: 24, pixelRatio: 1 },
    { width: 1920, height: 1200, colorDepth: 24, pixelRatio: 1 },
];

const TIMEZONE_POOL = [
    'Europe/Paris',
    'Europe/London',
    'Europe/Berlin',
    'America/New_York',
];

const WEBGL_PROFILES = [
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
];

const WINDOWS_FONTS = [
    'Arial', 'Calibri', 'Cambria', 'Consolas', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana',
];

const CHROME_PLUGINS = [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
];

function hashSeed(text) {
    let h = 0;
    const s = String(text || '');
    for (let i = 0; i < s.length; i += 1) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function pickFrom(list, seed, salt = 0) {
    const idx = (hashSeed(`${seed}:${salt}`)) % list.length;
    return list[idx];
}

/**
 * @param {string} [seed] — email or session id for stable-ish profile per account
 */
function generateStealthProfile(seed = '') {
    const jitter = `${seed}:${Date.now()}:${Math.random()}`;
    const screen = { ...pickFrom(SCREEN_PRESETS, jitter, 7) };
    return {
        userAgent: pickFrom(USER_AGENTS, jitter, 1),
        platform: pickFrom(PLATFORMS, jitter, 2),
        hardwareConcurrency: pickFrom(HARDWARE_CONCURRENCY, jitter, 3),
        deviceMemory: pickFrom(DEVICE_MEMORY, jitter, 4),
        languages: [...pickFrom(LANGUAGE_SETS, jitter, 5)],
        screen,
        timezone: pickFrom(TIMEZONE_POOL, jitter, 8),
        webgl: { ...pickFrom(WEBGL_PROFILES, jitter, 6) },
        canvasSeed: (hashSeed(`${jitter}:canvas`) % 251) + 3,
        audioContextNoise: ((hashSeed(`${jitter}:audio`) % 1000) / 100000),
        fonts: WINDOWS_FONTS.slice(0, 6 + (hashSeed(jitter) % 3)),
        seed: String(seed || ''),
    };
}

/** @alias generateStealthProfile */
const generateSyntheticFingerprint = generateStealthProfile;

/**
 * Apply synthetic fingerprint patches (call once per page BEFORE first navigation).
 * @param {import('puppeteer').Page} page
 * @param {ReturnType<typeof generateStealthProfile>} profile
 */
async function applyStealthProfile(page, profile) {
    if (!page || page.isClosed() || !profile) return;

    const screen = profile.screen || { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1 };
    await page.setUserAgent(profile.userAgent);
    await page.setViewport({
        width: screen.width,
        height: screen.height,
        deviceScaleFactor: screen.pixelRatio || 1,
    }).catch(() => null);

    await page.evaluateOnNewDocument((fp) => {
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
            } catch (__) { /* ignore */ }
        }

        try {
            Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => fp.deviceMemory });
            Object.defineProperty(navigator, 'languages', { get: () => fp.languages.slice() });
            Object.defineProperty(navigator, 'language', { get: () => fp.languages[0] });
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
            Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
        } catch (_) { /* ignore */ }

        const scr = fp.screen || {};
        try {
            const patchScreen = (prop, val) => {
                try { Object.defineProperty(screen, prop, { get: () => val, configurable: true }); } catch (_) { /* ignore */ }
            };
            patchScreen('width', scr.width || 1920);
            patchScreen('height', scr.height || 1080);
            patchScreen('availWidth', scr.width || 1920);
            patchScreen('availHeight', (scr.height || 1080) - 40);
            patchScreen('colorDepth', scr.colorDepth || 24);
            patchScreen('pixelDepth', scr.colorDepth || 24);
            Object.defineProperty(window, 'devicePixelRatio', {
                get: () => scr.pixelRatio || 1,
                configurable: true,
            });
            Object.defineProperty(window, 'outerWidth', { get: () => scr.width || 1920, configurable: true });
            Object.defineProperty(window, 'outerHeight', { get: () => (scr.height || 1080) + 85, configurable: true });
            Object.defineProperty(window, 'innerWidth', { get: () => scr.width || 1920, configurable: true });
            Object.defineProperty(window, 'innerHeight', { get: () => (scr.height || 1080) - 120, configurable: true });
        } catch (_) { /* ignore */ }

        try {
            const origQuery = navigator.permissions?.query?.bind(navigator.permissions);
            if (origQuery) {
                navigator.permissions.query = (parameters) => {
                    if (parameters?.name === 'notifications') {
                        return Promise.resolve({ state: Notification.permission, onchange: null });
                    }
                    return origQuery(parameters);
                };
            }
        } catch (_) { /* ignore */ }

        try {
            const pluginData = [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
            ];
            const fakePlugins = pluginData.map((p, i) => ({
                ...p,
                length: 1,
                item: () => null,
                namedItem: () => null,
                [i]: p,
            }));
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const arr = fakePlugins;
                    arr.item = (idx) => arr[idx] || null;
                    arr.namedItem = (name) => arr.find((pl) => pl.name === name) || null;
                    arr.refresh = () => undefined;
                    return arr;
                },
            });
            Object.defineProperty(navigator, 'mimeTypes', {
                get: () => {
                    const mimes = [{ type: 'application/pdf', suffixes: 'pdf', description: '', enabledPlugin: fakePlugins[0] }];
                    mimes.item = (idx) => mimes[idx] || null;
                    mimes.namedItem = (name) => mimes.find((m) => m.type === name) || null;
                    return mimes;
                },
            });
        } catch (_) { /* ignore */ }

        try {
            if (!window.chrome) window.chrome = {};
            if (!window.chrome.runtime) {
                window.chrome.runtime = {
                    connect: () => ({ onDisconnect: { addListener: () => {} }, postMessage: () => {} }),
                    sendMessage: () => {},
                    id: undefined,
                };
            }
        } catch (_) { /* ignore */ }

        try {
            if (navigator.connection) {
                Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 + (fp.hardwareConcurrency % 40) });
            }
        } catch (_) { /* ignore */ }

        const webgl = fp.webgl || {};
        const patchWebGL = (proto) => {
            if (!proto || proto.__nhpPatched) return;
            const original = proto.getParameter;
            proto.getParameter = function patchedGetParameter(param) {
                const UNMASKED_VENDOR_WEBGL = 0x9245;
                const UNMASKED_RENDERER_WEBGL = 0x9246;
                if (param === UNMASKED_VENDOR_WEBGL) return webgl.vendor || original.call(this, param);
                if (param === UNMASKED_RENDERER_WEBGL) return webgl.renderer || original.call(this, param);
                return original.call(this, param);
            };
            proto.__nhpPatched = true;
        };
        try {
            patchWebGL(WebGLRenderingContext?.prototype);
            patchWebGL(WebGL2RenderingContext?.prototype);
        } catch (_) { /* ignore */ }

        const noise = fp.canvasSeed || 1;
        try {
            const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function nhpToDataURL(...args) {
                if (this.width > 0 && this.height > 0) {
                    const ctx = this.getContext('2d');
                    if (ctx) {
                        const x = (fp.hardwareConcurrency || 4) % Math.min(this.width, 12);
                        const y = (fp.deviceMemory || 8) % Math.min(this.height, 12);
                        const img = ctx.getImageData(x, y, 1, 1);
                        if (img?.data) {
                            img.data[0] = (img.data[0] + noise) % 256;
                            img.data[1] = (img.data[1] + 1) % 256;
                        }
                        ctx.putImageData(img, x, y);
                    }
                }
                return origToDataURL.apply(this, args);
            };
        } catch (_) { /* ignore */ }

        try {
            const patchReadPixels = (proto) => {
                if (!proto || proto.__nhpReadPixelsPatched) return;
                const orig = proto.readPixels;
                proto.readPixels = function nhpReadPixels(...args) {
                    const result = orig.apply(this, args);
                    const pixels = args[6];
                    if (pixels && pixels.length > 4) {
                        pixels[0] = (pixels[0] + noise) % 256;
                    }
                    return result;
                };
                proto.__nhpReadPixelsPatched = true;
            };
            patchReadPixels(WebGLRenderingContext?.prototype);
            patchReadPixels(WebGL2RenderingContext?.prototype);
        } catch (_) { /* ignore */ }

        try {
            const audioNoise = fp.audioContextNoise || 0.00001;
            const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
            if (OrigAudioContext) {
                const PatchedCtx = function NhpAudioContext(...args) {
                    const ctx = new OrigAudioContext(...args);
                    const origCreateAnalyser = ctx.createAnalyser.bind(ctx);
                    ctx.createAnalyser = function nhpCreateAnalyser() {
                        const analyser = origCreateAnalyser();
                        const origGetFloat = analyser.getFloatFrequencyData.bind(analyser);
                        analyser.getFloatFrequencyData = function nhpGetFloatFrequencyData(array) {
                            origGetFloat(array);
                            if (array && array.length > 0) {
                                array[0] += audioNoise;
                            }
                        };
                        return analyser;
                    };
                    return ctx;
                };
                PatchedCtx.prototype = OrigAudioContext.prototype;
                window.AudioContext = PatchedCtx;
                if (window.webkitAudioContext) window.webkitAudioContext = PatchedCtx;
            }
        } catch (_) { /* ignore */ }

        try {
            const fontList = Array.isArray(fp.fonts) ? fp.fonts : [];
            if (document.fonts && fontList.length && !document.fonts.__nhpPatched) {
                const origCheck = document.fonts.check.bind(document.fonts);
                document.fonts.check = (font, text) => {
                    const family = String(font || '').replace(/['"]/g, '').split(/\s+/).pop() || '';
                    if (fontList.some((f) => family.toLowerCase().includes(f.toLowerCase()))) return true;
                    return origCheck(font, text);
                };
                document.fonts.__nhpPatched = true;
            }
        } catch (_) { /* ignore */ }

        try {
            const tz = fp.timezone;
            if (tz) {
                const OrigDateTimeFormat = Intl.DateTimeFormat;
                Intl.DateTimeFormat = function NhpDateTimeFormat(locales, options) {
                    const opts = { ...(options || {}), timeZone: options?.timeZone || tz };
                    return new OrigDateTimeFormat(locales, opts);
                };
                Intl.DateTimeFormat.prototype = OrigDateTimeFormat.prototype;
                Intl.DateTimeFormat.supportedLocalesOf = OrigDateTimeFormat.supportedLocalesOf;
            }
        } catch (_) { /* ignore */ }
    }, { ...profile, screen });
}

/** @alias applyStealthProfile */
const applySyntheticFingerprint = applyStealthProfile;

module.exports = {
    generateStealthProfile,
    generateSyntheticFingerprint,
    applyStealthProfile,
    applySyntheticFingerprint,
    USER_AGENTS,
    CHROME_PLUGINS,
    SCREEN_PRESETS,
    TIMEZONE_POOL,
    WEBGL_PROFILES,
};
