/**
 * TeePublic triple-sort consensus ranking for Radar / Design Images hunt.
 * Sorts: Relevance (default) + Popular + Newest — designs high in multiple sorts rank first.
 * Adapted from Radar buildRisingStarsFromComparison (New×Popular heatScore).
 */
(function initNhpTeepublicTripleSortRank(root) {
    const g = root || (typeof globalThis !== 'undefined' ? globalThis : self);

    const SORTS = Object.freeze(['relevance', 'popular', 'newest']);
    /** Top N designs taken from each sort listing before consensus scoring. */
    const TOP_N = 36;
    /** Mild boost so Popular rank weighs slightly more than Relevance/Newest. */
    const POPULAR_WEIGHT = 1.15;

    function buildRankIndex(items, getKey) {
        const index = new Map();
        (Array.isArray(items) ? items : []).forEach((item, rank) => {
            const key = typeof getKey === 'function' ? getKey(item) : '';
            if (key && !index.has(key)) index.set(key, rank);
        });
        return index;
    }

    function averageRank(sortRanks) {
        const vals = Object.values(sortRanks || {}).map((n) => Number(n)).filter((n) => n > 0);
        if (!vals.length) return 999;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    /**
     * @param {Record<string, object[]>} buckets - { relevance, popular, newest } ordered lists
     * @param {{ getKey?: (item: object) => string, topN?: number, sorts?: string[] }} [options]
     * @returns {object[]} ranked copies with sortHits, sortRanks, consensusScore, topAcrossSorts
     */
    function rankTeepublicTripleSortConsensus(buckets, options = {}) {
        const getKey = typeof options.getKey === 'function'
            ? options.getKey
            : (item) => String(item?.matchKey || item?.id || '').trim();
        const topN = Math.max(1, Number(options.topN) || TOP_N);
        const sorts = Array.isArray(options.sorts) && options.sorts.length
            ? options.sorts.map((s) => String(s || '').trim().toLowerCase()).filter(Boolean)
            : [...SORTS];

        const capped = {};
        const indexes = {};
        let maxLen = 48;
        for (const sort of sorts) {
            const list = (Array.isArray(buckets?.[sort]) ? buckets[sort] : []).slice(0, topN);
            capped[sort] = list;
            indexes[sort] = buildRankIndex(list, getKey);
            maxLen = Math.max(maxLen, list.length, 48);
        }

        const itemByKey = new Map();
        // Prefer Relevance tile as canonical image, then Popular, then Newest.
        for (const sort of sorts) {
            for (const item of capped[sort]) {
                const key = getKey(item);
                if (key && !itemByKey.has(key)) itemByKey.set(key, item);
            }
        }

        const ranked = [];
        for (const [key, item] of itemByKey.entries()) {
            const sortRanks = {};
            let sortsHit = 0;
            let weightedPosSum = 0;
            let weightSum = 0;
            for (const sort of sorts) {
                const zeroBased = indexes[sort].get(key);
                if (zeroBased === undefined) continue;
                sortsHit += 1;
                sortRanks[sort] = zeroBased + 1;
                const w = sort === 'popular' ? POPULAR_WEIGHT : 1;
                weightedPosSum += (maxLen - zeroBased) * w;
                weightSum += w;
            }
            if (sortsHit === 0) continue;

            // Rising-stars style position component + primary weight on multi-sort presence.
            const positionScore = weightSum > 0
                ? (weightedPosSum / (maxLen * weightSum)) * 100
                : 0;
            const consensusScore = Math.round(sortsHit * 100 + positionScore);

            ranked.push({
                ...item,
                matchKey: key,
                sortHits: sortsHit,
                sortRanks,
                consensusScore: Math.min(400, Math.max(1, consensusScore)),
                topAcrossSorts: sortsHit >= 3
            });
        }

        ranked.sort((a, b) => {
            if (b.sortHits !== a.sortHits) return b.sortHits - a.sortHits;
            if (b.consensusScore !== a.consensusScore) return b.consensusScore - a.consensusScore;
            return averageRank(a.sortRanks) - averageRank(b.sortRanks);
        });
        return ranked;
    }

    g.NHP_TeepublicTripleSortRank = {
        SORTS,
        TOP_N,
        POPULAR_WEIGHT,
        rankTeepublicTripleSortConsensus,
        buildRankIndex,
        averageRank
    };
})(typeof globalThis !== 'undefined' ? globalThis : self);
