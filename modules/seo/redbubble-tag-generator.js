/**
 * BubbleSpider-style Redbubble tag generation (GraphQL + frequency ranking).
 * Ported from BubbleSpider extension v1.4.0 tag generator logic.
 */

export const BUBBLE_SPIDER_EXTENSION_ID = 'adkappjdekgefnmlalhahdnnhiifkgof';
export const RB_GRAPHQL_URL = 'https://www.redbubble.com/boom/graphql';

const RB_SEARCH_RESULTS_QUERY = `query withSearchResults($query: String!, $queryParams: QueryParams, $locale: String!, $country: String!, $currency: String!, $previewTypeIds: [String!], $experience: String) {
  searchResults(query: $query, queryParams: $queryParams, locale: $locale, country: $country, currency: $currency, previewTypeIds: $previewTypeIds, experience: $experience) {
    ...Results
  }
}
fragment Results on SearchResults {
  results {
    work(locale: $locale) {
      tags
    }
  }
}`;

/**
 * Rank tags by how often they appear across Redbubble search results (same as BubbleSpider UI).
 * @param {string[][]} tagMatrix - array of tag arrays per design
 * @param {number} resultsLimit - how many search results to include (BubbleSpider: 10/25/50/100)
 * @returns {string[]}
 */
export function aggregateRedbubbleTagFrequency(tagMatrix, resultsLimit = 100) {
    const slice = (tagMatrix || []).slice(0, resultsLimit);
    const workCount = slice.length || 1;
    const frequency = {};

    slice
        .map((arr) => [...new Set(Array.isArray(arr) ? arr : [])])
        .join(',')
        .split(',')
        .forEach((raw, index) => {
            const tag = String(raw || '').trim();
            if (!tag) return;
            if (frequency[tag]) {
                frequency[tag][0] += 1;
            } else {
                frequency[tag] = [1, index];
            }
        });

    return Object.entries(frequency)
        .sort((a, b) => {
            const countDiff = a[1][0] - b[1][0];
            if (countDiff !== 0) return countDiff;
            return b[1][1] - a[1][1];
        })
        .reverse()
        .map(([tag]) => tag);
}

/**
 * @param {string[][]} tagMatrix
 * @param {number} resultsLimit
 * @param {number} copyCount - BubbleSpider copy count (10–50); NHP uses 14–15 for TeePublic
 */
export function pickTopRedbubbleTags(tagMatrix, resultsLimit = 100, copyCount = 15) {
    const ranked = aggregateRedbubbleTagFrequency(tagMatrix, resultsLimit);
    const limit = Math.max(1, Math.min(Number(copyCount) || 15, ranked.length));
    return ranked.slice(0, limit);
}

export async function fetchRedbubbleSearchTagMatrix(keyword, locale = 'en') {
    const query = String(keyword || '').trim();
    if (!query) return [];

    const payload = {
        operationName: 'withSearchResults',
        variables: {
            query,
            queryParams: {
                pageSize: 100,
                queryParamItems: [{ name: 'query', values: query }],
                searchType: 'find'
            },
            locale,
            country: 'US',
            currency: 'USD',
            previewTypeIds: [],
            experience: 'srp'
        },
        query: RB_SEARCH_RESULTS_QUERY
    };

    const res = await fetch(RB_GRAPHQL_URL, {
        headers: {
            accept: '*/*',
            'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
            'content-type': 'application/json'
        },
        referrerPolicy: 'strict-origin-when-cross-origin',
        body: JSON.stringify(payload),
        method: 'POST',
        mode: 'cors',
        credentials: 'include'
    });

    if (!res.ok) {
        throw new Error(`Redbubble GraphQL HTTP ${res.status}`);
    }

    const json = await res.json();
    const results = json?.data?.searchResults?.results;
    if (!Array.isArray(results)) {
        throw new Error('Redbubble GraphQL: invalid response');
    }

    return results
        .map((item) => item?.work?.tags)
        .filter((tags) => Array.isArray(tags) && tags.length > 0);
}

/**
 * Ask installed BubbleSpider extension (if messaging is allowed).
 * @returns {string[][]|null}
 */
export async function tryBubbleSpiderExtensionTagMatrix(keyword) {
    if (!chrome?.runtime?.sendMessage) return null;
    const query = String(keyword || '').trim();
    if (!query) return null;

    try {
        const res = await chrome.runtime.sendMessage(BUBBLE_SPIDER_EXTENSION_ID, {
            type: 'get-tags',
            keywords: query
        });
        if (!res?.tags || !Array.isArray(res.tags)) return null;
        return res.tags;
    } catch {
        return null;
    }
}

/**
 * Generate top tags using BubbleSpider algorithm (extension bridge or direct GraphQL).
 */
export async function generateBubbleSpiderStyleTags(keyword, options = {}) {
    const tagCount = options.tagCount ?? 15;
    const resultsLimit = options.resultsLimit ?? 100;
    const locale = options.locale ?? 'en';

    let matrix = await tryBubbleSpiderExtensionTagMatrix(keyword);
    if (!matrix?.length) {
        matrix = await fetchRedbubbleSearchTagMatrix(keyword, locale);
    }

    if (!matrix?.length) {
        throw new Error('No Redbubble tag data');
    }

    return pickTopRedbubbleTags(matrix, resultsLimit, tagCount);
}
