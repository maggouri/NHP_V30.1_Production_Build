/**
 * 🧠 NHP Local Intelligence Engine v2.0
 * Specialized for TeePublic & POD Marketplaces.
 * Rule: NICHE-FIRST ARchitecture.
 */

window.LocalSEO = {
    // 🎨 Dynamic Aesthetic Themes
    themes: {
        vintage: ["Retro Vintage 70s 80s Style", "Distressed Classic Heritage Art", "Old School Aesthetic Graphic"],
        modern: ["Modern Minimalist Vector Art", "Clean Contemporary Urban Design", "Sleek Bold Typography Concept"],
        artistic: ["Hand-Drawn Illustration Art", "Vibrant Pop Art Explosion", "Surreal Creative Artistic Vision"],
        funny: ["Humorous Sarcastic Quote Design", "Witty Funny Parody Illustration", "Joking Comical Statement Graphic"]
    },

    // ⚡ Power Words for SEO
    powerWords: ["Premium", "Exclusive", "Trending", "Viral", "Aesthetic", "Official", "Original", "Limited Edition", "Fan Art", "Essential"],

    // 🛡️ Basic Trademark/Risk Scanner (Local Intelligence)
    riskPatterns: [
        /\bdisney\b/i, /\bnike\b/i, /\badidas\b/i, /\bmarvel\b/i, /\bdc comics\b/i,
        /\bstar wars\b/i, /\bpokemon\b/i, /\bnetflix\b/i, /\bapple\b/i, /\bgucci\b/i
    ],

    /**
     * Intelligent Generator
     * @param {string} niche - The core niche from user
     */
    generate: function (niche, seed = 0) {
        if (!niche) return null;
        const n = niche.trim();
        const nCap = n.toUpperCase();
        const nTitle = n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        // 🧠 Determine Theme via "Intelligence" + Entropy Seed
        let selectedTheme = "vintage";
        if (n.match(/funny|joke|lol|humor/i)) selectedTheme = "funny";
        else if (n.match(/minimal|clean|modern/i)) selectedTheme = "modern";
        else if (n.match(/paint|draw|color|art/i)) selectedTheme = "artistic";

        // Use seed to guarantee different random choices for each item in a batch
        const themeList = this.themes[selectedTheme];
        const themeSuffix = themeList[(seed + Math.floor(Math.random() * 5)) % themeList.length];
        const powerIdx = (seed + Math.floor(Math.random() * 5)) % this.powerWords.length;

        // 1. 🏆 TITLE: [NICHE] + [THEME] + [POWER WORD]
        const title = `${nTitle} - ${themeSuffix} (${this.powerWords[powerIdx]})`;

        // 2. 📝 DESCRIPTION: [NICHE] start + Semantic Flow (Seed-based template selection)
        const descTemplates = [
            `${nTitle} lovers, this one is for you! A ${themeSuffix.toLowerCase()} that perfectly captures the spirit of ${n}. Designed for fans who want a premium and unique aesthetic look.`,
            `${nTitle} design featuring high-quality details and a professional finish. Ideal for gifting or adding a touch of ${n} style to your collection.`,
            `${nTitle} artistic expression at its best. This ${this.powerWords[powerIdx]} piece is crafted for those who appreciate the true culture of ${n}.`
        ];
        const description = descTemplates[(seed + Math.floor(Math.random() * 5)) % descTemplates.length];

        // 3. 🏷️ MAIN TAG
        let main_tag = n.toLowerCase();
        if (main_tag.length > 38) main_tag = main_tag.substring(0, 38).trim();

        // 4. 🏷️ TAGS (15 total) - Strict Rule Implementation
        let tagsSet = new Set();

        // RULE: FIRST TAG IS NICHE
        tagsSet.add(n.toLowerCase());

        // RULE: CORE NICHE TAG ONLY (REDBUBBLE INTEGRATION WILL COMPLETE THE REST)
        // This avoids the cluttered repetition the user complained about in the image.
        tagsSet.add(selectedTheme);
        tagsSet.add(this.powerWords[powerIdx].toLowerCase());

        // General POD Power Tags
        const podTags = [
            "aesthetic", "graphic", "illustration", "gift for him", "gift for her",
            "trending art", "minimalist", "streetwear", "urban style", "classic",
            "vintage style", "retro design", "pop culture", "cool artwork", "creative design",
            "unique graphic", "apparel design", "trendy tee", "custom art", "novelty"
        ];
        for (const pt of podTags) {
            if (tagsSet.size >= 15) break;
            tagsSet.add(pt);
        }

        // Final result with "Risk Intelligence"
        const isRisky = this.riskPatterns.some(pattern => pattern.test(n));

        return {
            title: title,
            main_tag: main_tag,
            description: description,
            tags: Array.from(tagsSet).slice(0, 15),
            score: isRisky ? "45" : "98",
            risk: isRisky ? "High (TM Warning)" : "Low",
            theme: selectedTheme
        };
    },

    /**
     * AI PROMPT GENERATOR (Bonus Local Intelligence)
     * For Midjourney/DALL-E users
     */
    generatePrompt: function (niche) {
        return `${niche} premium t-shirt design, professional graphic illustration, vector art style, high contrast, clean lines, isolated on white background, 8k resolution, trending on dribbble --v 6.0`;
    },

    /**
     * NLP KEYWORD CLUSTERER (Simple logic for Bulk Planning)
     */
    clusterKeywords: function (niches) {
        // Intelligence to group niches locally for better album planning
        return niches.reduce((acc, n) => {
            const words = n.toLowerCase().split(' ');
            const category = words.length > 0 ? words[0] : 'general';
            if (!acc[category]) acc[category] = [];
            acc[category].push(n);
            return acc;
        }, {});
    }
};
