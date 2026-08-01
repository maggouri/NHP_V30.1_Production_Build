/**
 * Search URLs aligned with Note action buttons + Design Images marketplace hunt.
 * UTF-8 safe.
 */
'use strict';

export const NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE = 'احدث تصاميم القمصان متعلقة ب - {niche} -';

export function buildGoogleAiDesignsQuery(nicheText, template = NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE) {
    const niche = String(nicheText || '').trim();
    const tpl = String(template || NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE).trim() || NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE;
    if (tpl.includes('{niche}')) return tpl.replaceAll('{niche}', niche);
    return `${tpl} - ${niche} -`;
}

export function buildPinterestSearchUrl(nicheText) {
    const q = encodeURIComponent(String(nicheText || '').trim());
    return `https://www.pinterest.com/search/pins/?q=${q}`;
}

/** Google Images — last 24 hours (same as Note google-images-recent). */
export function buildGoogleImagesRecentUrl(nicheText) {
    const q = encodeURIComponent(String(nicheText || '').trim());
    return `https://www.google.com/search?tbm=isch&q=${q}&tbs=qdr:d`;
}

/** Google Images — all-time (Design Images marketplace volume). */
export function buildGoogleImagesSearchUrl(nicheText) {
    const q = encodeURIComponent(String(nicheText || '').trim());
    return `https://www.google.com/search?tbm=isch&q=${q}`;
}

/** Google AI Mode — last 24 hours (Note google-ai-designs + tbs=qdr:d). */
export function buildGoogleAiModeUrl(nicheText, aiTemplate) {
    const aiQuery = buildGoogleAiDesignsQuery(nicheText, aiTemplate);
    return `https://www.google.com/search?udm=50&q=${encodeURIComponent(aiQuery)}&tbs=qdr:d`;
}

/** Minimum valid TeePublic product thumbnails for Radar image hunt. */
export const RADAR_TEEPUBLIC_IMAGE_TARGET = 150;

/** Max TeePublic search listing pages when filling image hunt target. */
export const RADAR_TEEPUBLIC_MAX_LISTING_PAGES = 8;

/** Plain niche for ?query=; accepts pasted TeePublic listing URLs or percent-encoded text. */
export function normalizeRadarNicheQuery(raw) {
    let q = String(raw || '').trim();
    if (!q) return '';
    if (/teepublic\.com\/t-shirts/i.test(q)) {
        try {
            const href = q.startsWith('http') ? q : `https://${q.replace(/^\/+/, '')}`;
            const u = new URL(href);
            const fromQuery = u.searchParams.get('query');
            if (fromQuery) q = fromQuery;
        } catch (_) { /* keep */ }
    }
    if (/%[0-9A-Fa-f]{2}/.test(q)) {
        try {
            const decoded = decodeURIComponent(q);
            if (decoded && decoded !== q) q = decoded.trim();
        } catch (_) { /* keep */ }
    }
    return q.trim();
}

/** Image hunt TeePublic URL template. Default sort=relevance (omit param). */
export function buildTeepublicSearchUrl(nicheText, page = 1, sort = 'relevance') {
    const q = normalizeRadarNicheQuery(nicheText);
    const params = new URLSearchParams();
    params.set('query', q);
    const sortKey = String(sort || 'relevance').trim().toLowerCase();
    if (sortKey && sortKey !== 'relevance') params.set('sort', sortKey);
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    if (pageNum > 1) params.set('page', String(pageNum));
    return `https://www.teepublic.com/t-shirts?${params.toString()}`;
}

/** Relevance + Popular + Newest listing URLs for consensus ranking. */
export function buildTeepublicTripleSortUrls(nicheText, page = 1) {
    return {
        relevance: buildTeepublicSearchUrl(nicheText, page, 'relevance'),
        popular: buildTeepublicSearchUrl(nicheText, page, 'popular'),
        newest: buildTeepublicSearchUrl(nicheText, page, 'newest')
    };
}

/** Amazon apparel search (t-shirt query bias for design discovery). */
export function buildAmazonSearchUrl(nicheText, page = 1) {
    const q = encodeURIComponent(`${normalizeRadarNicheQuery(nicheText)} t-shirt`);
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const base = `https://www.amazon.com/s?k=${q}`;
    if (pageNum <= 1) return base;
    return `${base}&page=${pageNum}`;
}

/** Redbubble tee shop search. */
export function buildRedbubbleSearchUrl(nicheText, page = 1) {
    const q = encodeURIComponent(normalizeRadarNicheQuery(nicheText));
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const base = `https://www.redbubble.com/shop/?query=${q}&iaCode=u-tees`;
    if (pageNum <= 1) return base;
    return `${base}&page=${pageNum}`;
}

/** Etsy search biased toward t-shirt / apparel designs. */
export function buildEtsySearchUrl(nicheText, page = 1) {
    const q = encodeURIComponent(`${normalizeRadarNicheQuery(nicheText)} t-shirt`);
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const base = `https://www.etsy.com/search?q=${q}`;
    if (pageNum <= 1) return base;
    return `${base}&page=${pageNum}`;
}

/** Radar source keys for fetch API. */
export const RADAR_IMAGE_SOURCES = Object.freeze({
    pinterest: 'pinterest',
    googleImages: 'google_images',
    googleAi: 'google_ai',
    teepublic: 'teepublic',
    amazon: 'amazon',
    redbubble: 'redbubble',
    etsy: 'etsy',
    marketplace: 'marketplace',
    aggregator: 'aggregator'
});

/**
 * Resolve which image sources to query.
 * - marketplace / design_gallery: TeePublic + Amazon + Redbubble + Etsy + Google Images + Pinterest
 * - aggregator: Note UI default (includes Pinterest + Google AI + marketplaces)
 */
export function resolveRadarFetchSources(mode) {
    const key = String(mode || '').trim();
    if (key === RADAR_IMAGE_SOURCES.pinterest) return [RADAR_IMAGE_SOURCES.pinterest];
    if (key === RADAR_IMAGE_SOURCES.googleImages) return [RADAR_IMAGE_SOURCES.googleImages];
    if (key === RADAR_IMAGE_SOURCES.googleAi) return [RADAR_IMAGE_SOURCES.googleAi];
    if (key === RADAR_IMAGE_SOURCES.teepublic || key === 'teepublic') return ['teepublic'];
    if (key === RADAR_IMAGE_SOURCES.amazon) return ['amazon'];
    if (key === RADAR_IMAGE_SOURCES.redbubble) return ['redbubble'];
    if (key === RADAR_IMAGE_SOURCES.etsy) return ['etsy'];
    if (
        key === RADAR_IMAGE_SOURCES.marketplace
        || key === 'design_gallery'
        || key === 'design-images'
        || key === 'design_images'
    ) {
        return [
            'teepublic',
            'amazon',
            'redbubble',
            'etsy',
            RADAR_IMAGE_SOURCES.googleImages,
            RADAR_IMAGE_SOURCES.pinterest,
        ];
    }
    return [
        RADAR_IMAGE_SOURCES.pinterest,
        RADAR_IMAGE_SOURCES.googleImages,
        RADAR_IMAGE_SOURCES.googleAi,
        'teepublic',
        'amazon',
        'redbubble',
        'etsy'
    ];
}
