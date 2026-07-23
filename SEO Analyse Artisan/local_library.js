// المكتبة المحلية الداخلية الخاصة بـ SEO Analyse Artisan (بدون إنترنت/AI)
// هذه المكتبة تستبدل احتياج الذكاء الاصطناعي من خلال خوارزميات وقواعد بيانات صغيرة مدمجة (Local Engine)

window.SaaLocalEngine = {

    // 1. صانع الأوامر المحلي (Prompt Generator)
    generatePrompt: (niche) => {
        const styles = ["Highly detailed flat vector illustration", "Pop-art style graphic", "Clean minimalist line art", "Retro vintage badge style", "Dynamic typography blending with illustration"];
        const lighting = ["vibrant contrasting colors", "dark mode contrast", "neon retro color palette", "soft pastel tones", "bold solid colors"];
        const comp = ["central composition", "clean flat edges", "isolated on a black background", "transparent background friendly"];

        const s = styles[Math.floor(Math.random() * styles.length)];
        const l = lighting[Math.floor(Math.random() * lighting.length)];
        const c = comp[Math.floor(Math.random() * comp.length)];

        return `T-shirt design featuring the niche/theme "${niche}". Style: ${s}. Colors: ${l}. Layout: ${c}. Perfect for Print on Demand merchandise context, no messy borders.`;
    },

    // 2. فحص رادار الملكية (Trademark Local Regex Scanner)
    radarScan: (titles) => {
        // Red = Famous Brands, Pop Culture, Movies, Games (High Risk)
        const redList = ['disney', 'marvel', 'star wars', 'harry potter', 'nike', 'adidas', 'apple', 'mickey', 'batman', 'superman', 'nintendo', 'pokemon', 'netflix', 'gucci', 'porsche', 'ferrari', 'jordan', 'supreme', 'gucci', 'prada', 'pixar'];

        // Orange = Alert words, seasonal, broad claims, quotes, or semi-brand like (Medium Risk)
        const orangeList = ['love', 'funny', 'retro', 'vintage', 'usa', 'new york', 'viral', 'trending', 'parody', 'quote', 'trump', 'biden', 'election', 'meme', 'movie', 'film', 'music', 'band', 'tour'];

        const results = [];
        titles.forEach(t => {
            const lower = t.toLowerCase();
            let risk = "green"; // Default safe

            if (redList.some(r => lower.includes(r) || lower === r)) {
                risk = "red";
            } else if (orangeList.some(o => lower.includes(o) || lower.split(" ").includes(o))) {
                risk = "orange";
            }

            results.push({ title: t, risk: risk });
        });

        return results;
    },

    // 3. مقسم المجموعات المحلي (NLP Keyword Clustering)
    generateCollectionPlan: (designs, existingAlbums, options = {}) => {
        const stopWords = new Set(['and', 'or', 'the', 'a', 'in', 'of', 'for', 'to', 'with', 'on', 'at', 'by', 'design', 'classic', 'shirt', 't-shirt', 'tshirt', 'tee', 'graphic', 'art', 'vector', 'vintage', 'funny', 'cute', 'retro', 'pin', 'pins', 'board', 'boards']);
        const maxGroups = Number.isFinite(options.maxGroups) ? options.maxGroups : 8;
        const minGroupSize = Number.isFinite(options.minGroupSize) ? options.minGroupSize : 2;
        const suffix = String(options.collectionSuffix || ' Collection');
        const fallbackLabel = String(options.fallbackLabel || 'Misc & Trending');

        // Count word frequencies
        const wordFrequencies = {};
        const designMap = {};
        const normalizedExisting = (existingAlbums || []).map(e => String(e || '').toLowerCase().trim()).filter(Boolean);

        designs.forEach(d => {
            const words = String(d || '').toLowerCase().replace(/[^a-z0-9\s-]/gi, '').split(/\s+/);
            const validWords = words.filter(w => w.length > 3 && !stopWords.has(w));

            // Unique words per title
            [...new Set(validWords)].forEach(w => {
                wordFrequencies[w] = (wordFrequencies[w] || 0) + 1;
                if (!designMap[w]) designMap[w] = [];
                designMap[w].push(d);
            });
        });

        // Sort by occurrence length
        const sortedWords = Object.keys(wordFrequencies).sort((a, b) => wordFrequencies[b] - wordFrequencies[a]);

        const plan = [];
        const usedDesigns = new Set();

        for (const word of sortedWords) {
            if (normalizedExisting.some(existing => existing === word || existing.includes(word))) continue;

            const groupDesigns = designMap[word].filter(d => !usedDesigns.has(d));

            if (groupDesigns.length >= minGroupSize) {
                const albumName = word.charAt(0).toUpperCase() + word.slice(1) + suffix;
                plan.push({
                    albumName: albumName,
                    normalizedName: word,
                    matchCount: groupDesigns.length,
                    designs: groupDesigns
                });
                groupDesigns.forEach(ud => usedDesigns.add(ud));
            }

            if (plan.length >= maxGroups) break; // Maximum auto groups per run to avoid huge queues
        }

        // Remaining unallocated
        const remaining = designs.filter(d => !usedDesigns.has(d));
        if (remaining.length > 0) {
            plan.push({
                albumName: `${fallbackLabel} ${Math.floor(Math.random() * 100)}`,
                normalizedName: 'misc',
                matchCount: remaining.length,
                designs: remaining
            });
        }

        return plan;
    },

    // 4. توافق خلفي مع محرك الألبومات القديم
    generateAlbumPlan: (designs, existingAlbums) => {
        return window.SaaLocalEngine.generateCollectionPlan(designs, existingAlbums, {
            collectionSuffix: ' Collection',
            fallbackLabel: 'Misc & Trending',
            maxGroups: 8,
            minGroupSize: 2
        });
    }
};
