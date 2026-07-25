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

    /** Strip Ghost/compress suffixes so "Cliff Burton_opt" / "Cliff Burton_opt_2" → "Cliff Burton" / "Cliff Burton_2". */
    function stripPipelineNameNoise(name) {
        return sanitizeNicheTitle(
            stripExtension(name)
                .replace(/(_opt)+(?=(?:_\d+)?$)/i, '')
                .trim()
        );
    }

    function isPipelineTempFileStem(name) {
        const raw = sanitizeNicheTitle(stripExtension(name));
        if (!raw) return true;
        const stem = stripPipelineNameNoise(raw) || raw;
        const compact = stem.replace(/[\s_-]+/g, '_').toLowerCase();
        if (/^(reference|prompt_bag|prompt-bag|image|img|upload|input|composite|composite_grid|composite_batch|untitled|temp|tmp)$/i.test(compact)) {
            return true;
        }
        if (/^reference(_retry|_opt|_\d+)*$/i.test(compact)) return true;
        if (/^retry(_opt|_\d+)*$/i.test(compact)) return true;
        if (/^reference_retry/i.test(compact)) return true;
        if (/^retry_opt/i.test(compact)) return true;
        // File-like stems only (no spaces): design_1, split_2, nhp_ref, …
        if (!/\s/.test(stem) && /^(design|split|gallery|nhp|nhp_ref|nhp_result|nhp_grid|nhp_generate)(_?\d+)?$/i.test(compact)) {
            return true;
        }
        if (/^composite(_batch)?(_\d+)?$/i.test(compact)) return true;
        return false;
    }

    global.NHP_nicheTitleToFileName = nicheTitleToFileName;
    global.NHP_nicheTitleFromFileName = nicheTitleFromFileName;
    global.NHP_sanitizeNicheTitle = sanitizeNicheTitle;
    global.NHP_nicheKey = nicheKey;
    global.NHP_isLegacyRadarBagName = isLegacyRadarBagName;
    global.NHP_stripPipelineNameNoise = stripPipelineNameNoise;
    global.NHP_isPipelineTempFileStem = isPipelineTempFileStem;
})(typeof self !== 'undefined' ? self : window);
