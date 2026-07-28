/**

 * Shared TeePublic listing HTML → design records (DOM tiles + raw HTML).

 * Extraction shared by scan + hunt; fetch URLs differ — hunt: Relevance+Popular+Newest consensus; scan: sort=newest+popular.

 */

(function initNhpTeepublicExtract(root) {

    const g = root || (typeof globalThis !== 'undefined' ? globalThis : self);



    /** Full derived preview URL (commas in filename are valid — do not truncate). */

    const TEEPUBLIC_DERIVED_DESIGN_URL_RE = /https?:\/\/images\.teepublic\.com\/derived\/production\/designs\/\d+(?:_\d+)?\/\d+\/[^\s"'<>]+\.(?:webp|jpe?g|png)(?:\?[^\s"'<>]*)?/gi;

    const TEEPUBLIC_DERIVED_DESIGN_ID_RE = /\/derived\/production\/designs\/(\d{4,})(?:_\d+)?\//i;



    function decodeTeepublicScanHtml(html) {

        return String(html || '')

            .replace(/\\u002F/g, '/')

            .replace(/\\\//g, '/')

            .replace(/&quot;/g, '"')

            .replace(/&#39;/g, "'")

            .replace(/&amp;/g, '&');

    }



    function findTeepublicDerivedDesignUrlInText(value) {

        const text = decodeTeepublicScanHtml(value);

        TEEPUBLIC_DERIVED_DESIGN_URL_RE.lastIndex = 0;

        const match = TEEPUBLIC_DERIVED_DESIGN_URL_RE.exec(text);

        return match ? match[0] : '';

    }



    /** Parse src/srcset without splitting on commas inside i_pic_/i_pcc_ filenames. */

    function pickTeepublicImageUrlFromSrcAttr(value) {

        const text = decodeTeepublicScanHtml(value).trim();

        if (!text) return '';



        const direct = findTeepublicDerivedDesignUrlInText(text);

        if (direct) return direct;



        const parts = text.split(/,(?=\s*(?:https?:\/\/|\/\/))/);

        for (const part of parts) {

            const token = part.trim().split(/\s+/)[0];

            const fromToken = findTeepublicDerivedDesignUrlInText(token);

            if (fromToken) return fromToken;

            const normalized = normalizeTeepublicDesignImageUrl(token);

            if (isUsableTeepublicDesignImageUrl(normalized)) return normalized;

        }

        return '';

    }



    function normalizeTeepublicDesignImageUrl(src) {

        const value = decodeTeepublicScanHtml(src).trim();

        if (!value || value.startsWith('data:') || value.startsWith('blob:')) return '';



        const fromDerived = findTeepublicDerivedDesignUrlInText(value);

        if (fromDerived) return fromDerived;



        const first = value.split(/\s+/)[0].replace(/[,]+$/, '');

        if (first.startsWith('//')) return `https:${first}`;

        if (first.startsWith('/')) return `https://www.teepublic.com${first}`;

        return /^https?:\/\//i.test(first) ? first : '';

    }



    function isUsableTeepublicDesignImageUrl(src) {

        const lower = String(src || '').toLowerCase();

        if (!TEEPUBLIC_DERIVED_DESIGN_ID_RE.test(lower)) return false;

        return !lower.includes('logo') &&

            !lower.includes('favicon') &&

            !lower.includes('teepublicons') &&

            !lower.includes('teepublicon') &&

            !lower.includes('/icon/') &&

            !lower.includes('/icons/') &&

            !lower.includes('placeholder') &&

            !lower.includes('icon.png') &&

            !lower.includes('auto-teepublic') &&

            !lower.includes('auto_teepublic') &&

            !lower.includes('lightbulb') &&

            !lower.includes('/sprite') &&

            !lower.includes('/assets/') &&

            !lower.endsWith('.svg') &&

            !/\.svg(?:\?|$)/i.test(lower);

    }



    function isRejectedTeepublicTileImgElement(img) {

        if (!img) return true;

        const cls = String(img.className || '').toLowerCase();

        const alt = String(img.getAttribute('alt') || '').toLowerCase();

        if (/teepublicon|tp-icon|icon-|__icon|sprite|avatar|badge|logo/i.test(cls)) return true;

        if (/teepublicon|favicon|logo/i.test(alt)) return true;

        return false;

    }



    function extractNumericDesignId(value) {

        const raw = String(value || '').trim();

        if (/^\d{4,}$/.test(raw)) return raw;

        const fromDerived = raw.match(TEEPUBLIC_DERIVED_DESIGN_ID_RE);

        if (fromDerived) return fromDerived[1];

        const fromLegacy = raw.match(/\/designs\/(\d{4,})(?:_\d+)?/i) || raw.match(/design[_-]?id["']?\s*[:=]\s*["']?(\d{4,})/i);

        return fromLegacy ? fromLegacy[1] : '';

    }



    function normalizeDesignSlug(value) {

        return String(value || '')

            .toLowerCase()

            .replace(/^\d+[-_]?/, '')

            .replace(/[^a-z0-9]+/g, '-')

            .replace(/^-+|-+$/g, '');

    }



    function getTeepublicDesignMatchKey(design) {

        if (!design) return '';

        const numeric = extractNumericDesignId(design.id) || extractNumericDesignId(design.img);

        if (numeric) return `n:${numeric}`;

        const slug = normalizeDesignSlug(design.id) || normalizeDesignSlug(design.title);

        if (slug.length >= 2) return `s:${slug}`;

        return '';

    }



    function titleFromTeepublicSlug(slug) {

        return String(slug || '')

            .replace(/^\d+[-_]?/, '')

            .replace(/[-_]+/g, ' ')

            .replace(/\s+/g, ' ')

            .trim();

    }



    function mergeTeepublicDesignRecord(bucket, design) {

        const key = getTeepublicDesignMatchKey(design);

        if (!key) return;

        const prev = bucket.get(key);

        if (!prev) {

            bucket.set(key, { ...design, matchKey: key });

            return;

        }

        const numeric = extractNumericDesignId(design.id) || extractNumericDesignId(design.img);

        if (numeric) prev.id = numeric;

        if (!prev.img && design.img) prev.img = design.img;

        if ((!prev.title || prev.title === 'بدون عنوان') && design.title) prev.title = design.title;

    }



    function resolveTeepublicTileImageUrl(tile) {

        if (!tile) return '';



        const tileDataSrc = tile.getAttribute('data-src');

        if (tileDataSrc) {

            const fromTile = pickTeepublicImageUrlFromSrcAttr(tileDataSrc);

            if (isUsableTeepublicDesignImageUrl(fromTile)) return fromTile;

        }



        const priorityImgs = tile.querySelectorAll(

            'img.tp-design-tile__image, img.saa-highlight-img, picture img.tp-design-tile__image, .tp-design-tile__seo-content-wrap img'

        );

        for (const img of priorityImgs) {

            if (isRejectedTeepublicTileImgElement(img)) continue;

            for (const attr of ['src', 'data-src', 'srcset', 'data-srcset']) {

                const raw = img.getAttribute(attr) || '';

                const picked = pickTeepublicImageUrlFromSrcAttr(raw);

                if (isUsableTeepublicDesignImageUrl(picked)) return picked;

            }

        }



        for (const img of tile.querySelectorAll('img')) {

            if (isRejectedTeepublicTileImgElement(img)) continue;

            for (const attr of ['data-src', 'srcset', 'data-srcset', 'src']) {

                const raw = img.getAttribute(attr) || img.src || '';

                const picked = pickTeepublicImageUrlFromSrcAttr(raw);

                if (isUsableTeepublicDesignImageUrl(picked)) return picked;

            }

        }

        return '';

    }



    function extractDesignIdFromCard(card) {

        const directId = card.getAttribute('data-design-id')

            || card.closest?.('[data-design-id]')?.getAttribute('data-design-id')

            || card.querySelector('[data-design-id]')?.getAttribute('data-design-id');

        const directStr = String(directId || '').trim();

        if (/^\d{4,}$/.test(directStr)) return directStr;



        const imgUrl = resolveTeepublicTileImageUrl(card);

        const fromImg = extractNumericDesignId(imgUrl);

        if (fromImg) return fromImg;



        for (const img of card.querySelectorAll('img.tp-design-tile__image, img')) {

            if (isRejectedTeepublicTileImgElement(img)) continue;

            for (const attr of ['data-src', 'src', 'srcset', 'data-srcset']) {

                const numeric = extractNumericDesignId(img.getAttribute(attr) || '');

                if (numeric) return numeric;

            }

        }



        const href = card.querySelector('a[href*="/t-shirt/"], a[href*="/hoodie/"], a[href*="/tank-top/"]')?.getAttribute('href')

            || card.querySelector('a')?.getAttribute('href')

            || '';

        if (!href) return directStr || '';



        const cleanHref = href.split('#')[0].split('?')[0].replace(/\/+$/, '');

        if (!cleanHref) return directStr || '';



        const segments = cleanHref.split('/').filter(Boolean);

        const slug = segments[segments.length - 1] || directStr || '';

        return extractNumericDesignId(slug) || slug;

    }



    function extractTitleFromTeepublicTile(card) {

        const titleMatch = card.querySelector('.tp-design-tile__title a')

            || card.querySelector('.design-tile__title a')

            || card.querySelector('.m-tile__title')

            || card.querySelector('.tiles__tile-title a')

            || card.querySelector('h3')

            || card.querySelector('a[title]')

            || card.querySelector('.m-tile__link');

        let title = titleMatch ? (titleMatch.innerText || titleMatch.getAttribute('title') || '').trim() : '';

        if (!title) {

            const altImg = card.querySelector('img.tp-design-tile__image, img');

            if (altImg) title = (altImg.getAttribute('alt') || '').trim();

        }

        return title || 'بدون عنوان';

    }



    function extractTeepublicDesignsFromRawHtml(html, maxDesigns = 120) {

        const text = decodeTeepublicScanHtml(html);

        const designs = [];

        const add = (id, title = '', img = '') => {

            const numericId = extractNumericDesignId(id) || String(id || '').trim();

            const safeId = numericId || String(id || '').trim();

            const safeImg = normalizeTeepublicDesignImageUrl(img) || pickTeepublicImageUrlFromSrcAttr(img);

            const matchKey = getTeepublicDesignMatchKey({ id: safeId, img: safeImg });

            const existing = designs.find((d) => getTeepublicDesignMatchKey(d) === matchKey && matchKey);

            if (existing) {

                if (!existing.img && isUsableTeepublicDesignImageUrl(safeImg)) existing.img = safeImg;

                if ((!existing.title || existing.title.startsWith('ID:')) && title) existing.title = String(title).trim();

                return;

            }

            if (!safeId && !safeImg) return;

            designs.push({

                id: safeId || extractNumericDesignId(safeImg) || '',

                title: String(title || titleFromTeepublicSlug(safeId) || (safeId ? `ID: ${safeId}` : 'بدون عنوان')).trim(),

                img: isUsableTeepublicDesignImageUrl(safeImg) ? safeImg : ''

            });

        };



        TEEPUBLIC_DERIVED_DESIGN_URL_RE.lastIndex = 0;

        for (const match of text.matchAll(TEEPUBLIC_DERIVED_DESIGN_URL_RE)) {

            add(extractNumericDesignId(match[0]), '', match[0]);

        }

        for (const match of text.matchAll(/data-design-id=["']?(\d{4,})/gi)) add(match[1]);

        for (const match of text.matchAll(/["']design_id["']\s*:\s*["']?(\d{4,})/gi)) add(match[1]);

        for (const match of text.matchAll(/\/(?:t-shirt|tank-top|hoodie|sticker|poster|phone-case|kids-t-shirt)\/([^"'?#<\s]+)/gi)) {

            add(match[1], titleFromTeepublicSlug(match[1]));

        }

        for (const match of text.matchAll(/\/designs?\/(\d{4,})(?:_\d+)?[^"'<\s]*(?:["'][^>]*>\s*([^<]{2,120})\s*<)?/gi)) {

            add(match[1], match[2] || '');

        }



        return designs.filter((d) => d.id || d.img).slice(0, maxDesigns);

    }



    function collectTeepublicListingTiles(doc) {

        const seen = new Set();

        const tiles = [];

        const selectors = [

            '.tp-design-tile[data-design-id]',

            '.tp-design-tile',

            '.design-tile[data-design-id]',

            '.design-tile',

            '[data-design-id].tiles__tile',

            '.tiles__tile[data-design-id]',

            '.m-tile[data-design-id]',

            '[data-design-id]'

        ];

        for (const sel of selectors) {

            doc.querySelectorAll(sel).forEach((node) => {

                const card = node.closest?.('.tp-design-tile, .design-tile, .tiles__tile, .m-tile') || node;

                if (!card || seen.has(card)) return;

                seen.add(card);

                tiles.push(card);

            });

        }

        return tiles;

    }



    function extractTeepublicDesignsFromListingHtml(html, options = {}) {

        const maxDesigns = Math.max(1, Number(options.maxDesigns) || 120);

        const bucket = new Map();

        try {

            const parser = new DOMParser();

            const doc = parser.parseFromString(String(html || ''), 'text/html');

            collectTeepublicListingTiles(doc).forEach((card) => {

                const img = resolveTeepublicTileImageUrl(card);

                const id = extractDesignIdFromCard(card) || extractNumericDesignId(img);

                if (!id && !img) return;

                mergeTeepublicDesignRecord(bucket, {

                    id: id || extractNumericDesignId(img),

                    img,

                    title: extractTitleFromTeepublicTile(card)

                });

            });

        } catch (_) { /* raw HTML fallback still runs */ }



        extractTeepublicDesignsFromRawHtml(html, maxDesigns).forEach((item) => mergeTeepublicDesignRecord(bucket, item));

        return Array.from(bucket.values()).filter((d) => d && (d.id || d.img)).slice(0, maxDesigns);

    }



    function collectTeepublicDesignsFromPages(pages, options = {}) {

        const bucket = new Map();

        (Array.isArray(pages) ? pages : []).forEach((html) => {

            if (!html) return;

            extractTeepublicDesignsFromListingHtml(html, options).forEach((design) => mergeTeepublicDesignRecord(bucket, design));

        });

        return Array.from(bucket.values());

    }



    const api = {

        decodeTeepublicScanHtml,

        normalizeTeepublicDesignImageUrl,

        pickTeepublicImageUrlFromSrcAttr,

        isUsableTeepublicDesignImageUrl,

        extractNumericDesignId,

        getTeepublicDesignMatchKey,

        extractTeepublicDesignsFromRawHtml,

        extractTeepublicDesignsFromListingHtml,

        collectTeepublicDesignsFromPages,

        mergeTeepublicDesignRecord

    };



    g.NHP_TeepublicExtract = api;



    if (typeof module !== 'undefined' && module.exports) {

        module.exports = api;

    }

})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);


