/**
 * Niche → filename helpers (IIFE for service worker + classic scripts).
 * Preserves spaces; no underscores or (1) suffixes in Prompt Bag names.
 */
(function (global) {
    'use strict';

    function stripExtension(name) {
        return String(name || '').trim().replace(/\.(png|jpe?g|webp)$/i, '').trim();
    }

    function sanitizeNicheTitle(title) {
        return String(title || '')
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function nicheKey(title) {
        return sanitizeNicheTitle(stripExtension(title)).toLowerCase();
    }

    function nicheTitleToFileName(title) {
        const base = sanitizeNicheTitle(stripExtension(title));
        return base ? `${base}.png` : 'reference.png';
    }

    function nicheTitleFromFileName(name) {
        return sanitizeNicheTitle(stripExtension(name));
    }

    function isLegacyRadarBagName(name) {
        return /^(Radar|Google|Bing|Pinterest|TeePublic|Redbubble|Etsy)-\d+$/i.test(stripExtension(name));
    }

    global.NHP_nicheTitleToFileName = nicheTitleToFileName;
    global.NHP_nicheTitleFromFileName = nicheTitleFromFileName;
    global.NHP_sanitizeNicheTitle = sanitizeNicheTitle;
    global.NHP_nicheKey = nicheKey;
    global.NHP_isLegacyRadarBagName = isLegacyRadarBagName;
})(typeof self !== 'undefined' ? self : window);
