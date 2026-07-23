/**
 * APPAREL_DESIGN_SYSTEM_PROMPT — merged with user prompt on every Generate request.
 * UTF-8 safe. Do not minify or strip Arabic comments if added later.
 */
'use strict';

const {
    pickDefaultImageModel,
    resolveEnvImageModel,
    filterImageModelCandidates,
    sanitizeImageModelChoice,
    normalizeAiProvider,
    pickImageModelByProvider,
    filterImageModelsByProvider
} = require('../cliproxy-image-models');

/** Keep in sync with prompt_bag_image_prompts.js (NHP_TEXT_PRESERVATION_RULE). */
const TEXT_PRESERVATION_RULE = `TEXT / LETTERING (mandatory when the reference printable graphic shows readable words, names, numbers, or slogans): Preserve ALL such text in every output — same spelling and similar size/placement as the reference. Render words clearly and legibly on the design. Do not omit lettering, replace words with abstract shapes, or invent different spellings. Stylistic redraw is allowed; readable text content must remain. If the reference has no visible words, do not add text unless the user requests it.`;

const APPAREL_DESIGN_SYSTEM_PROMPT = `You are an elite print-on-demand apparel graphic designer for T-shirt and hoodie markets.

Primary goal:
Create exactly the requested number of distinct, print-ready apparel graphics suitable for DTG/screen print upload (TeePublic, Redbubble, Amazon Merch style).

Reference handling:
- If a reference image is provided and it is a shirt mockup, flat garment, product photo, or model wearing apparel: extract ONLY the printed logo, text, symbols, mascot, graphic marks, and color mood from the garment.
- Do NOT redraw the shirt, model, mannequin, fabric folds, watermark, product photo setup, or original background.
- If the reference is already standalone printable artwork, preserve the core theme and improve clarity for print.
- When the printable graphic includes readable words or lettering, preserve that text in outputs (same spelling, legible) — do not strip names, team words, or slogans.

Character / pose rules:
- If the printable graphic contains a person or character, you may vary pose or action across outputs when it improves the design.
- If there is no person or character in the printable graphic, do not invent body poses.

Output rules (mandatory):
- Every final design must be a standalone apparel graphic on a solid black background (#000000).
- High contrast, readable silhouette, centered composition, no mockup, no product photo frame.
- Do not add watermarks, URLs, or caption labels outside the design. When the printable graphic or user direction includes words/lettering, preserve that text in outputs.
- Avoid trademarked characters, sports team marks, celebrity likeness, or copyrighted IP unless user confirms rights.

Variation rules:
- Each output in a batch must be visibly different in composition, styling, or rendering — not near-identical copies.
- NEVER return the reference image unchanged, pixel-identical, or as a passthrough — always redraw the printable graphic as a new illustration.
- Keep the same core niche/theme across the batch unless the user asks otherwise.

Commercial quality:
- Vector-friendly edges, clean shapes, bold readable details at thumbnail size.
- Suitable for dark and light garment printing (design sits on black canvas).

When the user specifies a style mode, apply that style strongly while respecting all rules above.

Respond only with the image outputs requested by the API; do not return explanatory prose in the image itself.`;

const STYLE_MODE_HINTS = Object.freeze({
    auto: '',
    vintage: 'Style: Vintage Distressed — weathered texture, heritage sports vibe, classic mascot energy.',
    doodle: 'Style: Hand-drawn Doodle — playful sketch lines, informal ink feel, charming imperfections.',
    retro: 'Style: 70s Retro Groovy — warm palette, funky curves, sunshine positivity.',
    meme: 'Style: Meme Graphic / Sarcastic — bold text-friendly layout, internet humor tone.',
    minimal: 'Style: Line Art Minimalism — clean outlines, negative space, elegant simplicity.',
    varsity: 'Style: Bold Varsity / Collegiate — block letters, athletic stripes, mascot power.',
    cottagecore: 'Style: Cottagecore — mushrooms, cozy nature, soft storybook mood.',
    grunge: 'Style: 90s Grunge / Y2K — gritty texture, edgy attitude, chaotic energy.',
    kawaii: 'Style: Cute Kawaii Chibi — round shapes, adorable expressions, soft colors on black.',
    neon: 'Style: 80s Neon Synthwave — glowing accents, retro-futuristic outlines.',
    gothic: 'Style: Gothic / Witchy — ornate dark fantasy, moons, occult motifs (original only).',
    comic: 'Style: Comic / Pop Art — halftone, bold outlines, dynamic action framing.',
    pixel: 'Style: Pixel Art — retro gaming grid, limited palette, crisp pixels.',
    watercolor: 'Style: Watercolor Splatter — painterly washes with controlled splatter accents.',
    embroidery: 'Style: Embroidery — stitched thread texture, raised needlework look, craft apparel graphic.',
    hand_drawn: 'Style: Hand Drawn — organic sketch lines, human touch, authentic ink feel.',
    naive_art: 'Style: Naive Art — childlike simplicity, folk charm, bold flat shapes.',
    chaotic_meme: 'Style: Chaotic Meme — layered internet chaos, absurd humor, collage energy.',
    bold_typography: 'Style: Bold Typography — type-driven design, impactful letterforms, text as hero.',
    minimal_text: 'Style: Minimal Text — sparse words, clean layout, subtle messaging.',
    cowboy_western: 'Style: Cowboy Western — rodeo, desert, vintage frontier motifs.',
    britpop: 'Style: Britpop — 90s UK pop culture, mod targets, oasis-era graphic vibe.',
    food_art: 'Style: Food Art — appetizing illustrations, culinary whimsy, playful food mascots.',
    fishcore: 'Style: Fishcore — aquatic life, fishing culture, oceanic niche aesthetic.',
    tulip_floral: 'Style: Tulip Floral — botanical tulips, spring blooms, elegant floral arrangement.',
    folk_art: 'Style: Folk Art — traditional patterns, heritage motifs, handcrafted feel.',
    patchwork: 'Style: Patchwork — quilted segments, mixed textures, sewn-together panels.',
    sticker_bomb: 'Style: Sticker Bomb — layered stickers, streetwear collage, maximalist stack.',
    mascot_cartoon: 'Style: Mascot Cartoon — friendly character logo, sports/club mascot energy.',
    sport_varsity: 'Style: Sport Varsity — athletic lettering, team spirit, collegiate badge.',
    faded_pastel: 'Style: Faded Pastel — soft washed colors, dreamy vintage tint on black.',
    outdoor_nature: 'Style: Outdoor Nature — mountains, hiking, wilderness adventure graphic.',
    ai_surreal: 'Style: AI Surreal — dreamlike fusion, impossible forms, surreal digital art.',
    retro_futurism: 'Style: Retro Futurism — vintage sci-fi, atom age, optimistic future pulp.'
});

function getStyleHint(styleMode) {
    const raw = String(styleMode || 'auto').trim();
    const key = raw.toLowerCase();
    if (!key || key === 'auto') return '';
    if (STYLE_MODE_HINTS[key]) return STYLE_MODE_HINTS[key];
    if (raw.startsWith('c:')) {
        let label = '';
        try {
            label = decodeURIComponent(raw.slice(2)).trim();
        } catch (_) {
            label = raw.slice(2).replace(/_/g, ' ').trim();
        }
        return label ? `Style: ${label} — apply this aesthetic strongly for print-ready apparel graphic.` : '';
    }
    return `Style: ${raw} — apply this aesthetic strongly for print-ready apparel graphic.`;
}

function resolveEffectiveStyleList(styleList) {
    if (!Array.isArray(styleList) || !styleList.length) return APPAREL_STYLE_LIST;
    const cleaned = styleList
        .map((s) => String(s || '').trim())
        .filter(Boolean);
    return cleaned.length ? Object.freeze([...new Set(cleaned)]) : APPAREL_STYLE_LIST;
}

function injectStyleListIntoTemplate(template, styleList) {
    const list = resolveEffectiveStyleList(styleList);
    const joined = list.join(', ');
    const base = String(template || '').trim() || AUTO_IMAGE_PROMPT_TEMPLATE;
    if (!joined) return base;
    return base.replace(
        /choose the best 4 matching styles from this list: [^.]+\./i,
        `choose the best 4 matching styles from this list: ${joined}.`
    ).replace(
        /Choose \d+ distinct styles from: [^—]+/i,
        (m) => m.replace(/from: [^—]+/, `from: ${joined} `)
    );
}

/** Client override for APPAREL_DESIGN_SYSTEM_PROMPT (empty → built-in default). */
function resolveSystemPrompt(customSystemPrompt) {
    const custom = String(customSystemPrompt || '').trim();
    return custom || APPAREL_DESIGN_SYSTEM_PROMPT;
}

/** Composite 2x2 grid — one API image with 4 quadrants (UTF-8 safe). */
const COMPOSITE_GRID_LAYOUT_RULE = `Output ONE single image containing exactly 4 distinct print-ready apparel graphic variations arranged in a clean 2x2 grid on solid black background (#000000). Each quadrant (top-left, top-right, bottom-left, bottom-right) must show one unique design variation with clear separation — no overlapping panels, no text labels between cells, no mockups.`;

/** Appended to each single-variation image request (reference / edits). */
const NO_PIXEL_COPY_RULE = `CRITICAL FOR THIS OUTPUT: Do NOT return the reference image unchanged or pixel-identical. Redraw the printable graphic as a NEW illustration on solid black (#000000). The result must differ visibly from the input in style, linework, texture, or composition — except preserve all reference lettering/wording with the same spelling (text may be redrawn stylistically but must stay readable and correct).`;

const podStyles2026 = Object.freeze([
    'Embroidery', 'Hand Drawn', 'Naive Art', 'Chaotic Meme', 'Bold Typography',
    'Minimal Text', 'Cowboy Western', 'Britpop', 'Food Art', 'Fishcore',
    'Tulip Floral', 'Folk Art', 'Patchwork', 'Sticker Bomb', 'Mascot Cartoon',
    'Sport Varsity', 'Faded Pastel', 'Outdoor Nature', 'AI Surreal', 'Retro Futurism'
]);

const APPAREL_STYLE_LIST = Object.freeze([
    'Vintage Distressed', '70s Retro Groovy', 'Meme Graphic / Sarcastic', 'Line Art Minimalism',
    'Bold Varsity / Collegiate', 'Cottagecore Aesthetic', '90s Grunge / Y2K', 'Cute Kawaii Chibi',
    '80s Neon Synthwave', 'Dark Academia', 'Watercolor Splatter', 'Ukiyo-e Japanese', 'Sumi-e Zen',
    'Gothic / Witchy', 'Cartoon Tattoo Style', 'Comic / Pop Art', 'Psychedelic Trippy', 'Pixel Art',
    'Glitch Art', 'Cyberpunk / Futuristic',
    ...podStyles2026
]);

/** Exact generation template when a reference image is uploaded (UTF-8 safe). */
const AUTO_IMAGE_PROMPT_TEMPLATE = `${COMPOSITE_GRID_LAYOUT_RULE} Base all four variations only on the printable design visible in the reference. If the reference is a shirt mockup, flat garment photo, product photo, or model wearing apparel, extract only the printed logo/text/symbols/color mood from the garment and do not redraw the shirt, model, mannequin, fabric folds, product photo, watermark, or original background. CRITICAL: Do NOT copy or return the reference image pixel-for-pixel — you must redraw the printable graphic as new illustrations in the assigned styles. ${TEXT_PRESERVATION_RULE} Analyze the design subject and mood, then choose the best 4 matching styles from this list: ${APPAREL_STYLE_LIST.join(', ')}. Use one selected style per quadrant. If the extracted printable graphic contains a person or character, create 4 different pose/action variations for that character only, one per quadrant, such as standing, sitting, leaning, walking, jumping, crouching, dancing, running, or dynamic action. If the printable graphic has no person or character, do not invent a body pose. Preserve the core theme, keep high contrast, strong readable silhouette, and centered apparel composition in each quadrant. Return only the single composite grid image.`;

const VISION_ANALYSIS_SYSTEM_PROMPT = `You analyze reference images for print-on-demand apparel graphic generation.
Respond with ONLY valid JSON (no markdown fences), UTF-8 safe, keys:
{
  "subject": "short description of printable subject",
  "mood": "color/mood keywords",
  "referenceType": "mockup|flat_garment|product_photo|model_wearing|standalone_art|unknown",
  "hasCharacter": boolean,
  "extractedText": "exact visible words/numbers on the print (verbatim spelling) or empty string if none",
  "colorMood": "palette keywords",
  "recommendedStyles": ["exactly 4 strings from the allowed style list"],
  "recommendedPoses": ["up to 4 pose words — only if hasCharacter is true, else []"]
}
Pick recommendedStyles only from: ${APPAREL_STYLE_LIST.join(', ')}.
If hasCharacter is false, recommendedPoses must be [].`;

const VISION_ANALYSIS_USER_TEXT = `Analyze this reference for apparel print extraction. Detect mockup vs flat printable art, any character/person in the PRINT only, transcribe any visible words/numbers on the print exactly into extractedText, mood, and recommend the best 4 styles (and 4 poses if a character exists in the printable graphic).`;

function chooseVisionModel() {
    const env = String(process.env.CLIPROXY_VISION_MODEL || '').trim();
    if (env) return env;
    return 'gpt-4o';
}

function parseVisionAnalysis(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
        const parsed = JSON.parse(jsonMatch[0]);
        const styles = Array.isArray(parsed.recommendedStyles)
            ? parsed.recommendedStyles.filter((s) => APPAREL_STYLE_LIST.includes(s)).slice(0, 4)
            : [];
        while (styles.length < 4) {
            styles.push(APPAREL_STYLE_LIST[styles.length % APPAREL_STYLE_LIST.length]);
        }
        parsed.recommendedStyles = styles;
        parsed.recommendedPoses = parsed.hasCharacter && Array.isArray(parsed.recommendedPoses)
            ? parsed.recommendedPoses.slice(0, 4)
            : [];
        return parsed;
    } catch (_) {
        return null;
    }
}

function formatVisionAnalysisBlock(vision, count = 4) {
    if (!vision) return '';
    const n = Math.max(1, Math.min(10, Number(count) || 4));
    const lines = [
        `Subject: ${vision.subject || 'see reference'}`,
        `Mood: ${vision.mood || 'neutral'}`,
        `Reference type: ${vision.referenceType || 'unknown'} (extract printable only)`,
        `Character in printable graphic: ${vision.hasCharacter ? 'yes' : 'no'}`,
        vision.extractedText ? `Text on print (preserve exactly in outputs): ${vision.extractedText}` : '',
        vision.colorMood ? `Color mood: ${vision.colorMood}` : ''
    ].filter(Boolean);
    for (let i = 0; i < n; i++) {
        const style = vision.recommendedStyles?.[i] || vision.recommendedStyles?.[0] || APPAREL_STYLE_LIST[0];
        if (vision.hasCharacter && vision.recommendedPoses?.length) {
            const pose = vision.recommendedPoses[i] || vision.recommendedPoses[0] || 'dynamic action';
            lines.push(`Design ${i + 1}: style "${style}", character pose: ${pose}`);
        } else {
            lines.push(`Design ${i + 1}: style "${style}"`);
        }
    }
    return lines.join('\n');
}

/**
 * Build image-to-image prompt: fixed template + vision analysis + optional user text.
 */
function buildVariationSpecs(vision = null, count = 4, styleMode = 'auto') {
    const n = Math.max(1, Math.min(10, Number(count) || 4));
    const globalHint = getStyleHint(styleMode);
    const specs = [];
    for (let i = 0; i < n; i++) {
        const style = vision?.recommendedStyles?.[i]
            || APPAREL_STYLE_LIST[i % APPAREL_STYLE_LIST.length];
        const pose = vision?.hasCharacter && vision?.recommendedPoses?.length
            ? (vision.recommendedPoses[i] || vision.recommendedPoses[0] || 'dynamic action')
            : null;
        specs.push({ index: i + 1, style, pose, globalHint });
    }
    return specs;
}

function buildVariationPromptSuffix(spec = {}) {
    const idx = spec.index || 1;
    const parts = [
        `\n\n--- Variation ${idx} (single output) ---`,
        `Apply ONLY this style for this image: "${spec.style || APPAREL_STYLE_LIST[0]}".`,
        spec.pose ? `Character pose for this image: ${spec.pose}.` : 'Do not invent character poses unless a person/character exists in the printable graphic.',
        spec.globalHint ? `Style mode note: ${spec.globalHint}` : '',
        `\n${NO_PIXEL_COPY_RULE}`
    ];
    return parts.filter(Boolean).join('');
}

function buildAutoImageGenerationPrompt({
    vision = null,
    userPrompt = '',
    count = 4,
    styleMode = 'auto',
    systemPrompt = '',
    autoImageTemplate = '',
    styleList = null
} = {}) {
    const n = Math.max(1, Math.min(10, Number(count) || 4));
    const templateRaw = injectStyleListIntoTemplate(
        String(autoImageTemplate || '').trim() || AUTO_IMAGE_PROMPT_TEMPLATE,
        styleList
    );
    const template = n === 4
        ? templateRaw
        : templateRaw.replace(
            /exactly 4 distinct/gi,
            `exactly ${n} distinct`
        ).replace(/2x2 grid/gi, n <= 2 ? '1x2 grid' : '2x2 grid');
    const user = String(userPrompt || '').trim();
    const styleHint = getStyleHint(styleMode);
    const customSys = String(systemPrompt || '').trim();
    const globalRules = customSys
        ? `Global design instructions (mandatory):\n${customSys}\n\n`
        : '';
    const analysisBlock = vision
        ? formatVisionAnalysisBlock(vision, n)
        : 'Analyze the printable design visible in the attached reference image and select the best matching styles and poses from the rules above.';

    const textRule = vision?.extractedText
        ? `\n\n${TEXT_PRESERVATION_RULE}\nMandatory lettering from reference: "${String(vision.extractedText).trim()}".`
        : `\n\n${TEXT_PRESERVATION_RULE}`;

    const parts = [
        globalRules,
        template,
        textRule,
        '\n\n---\nReference analysis:\n',
        analysisBlock,
        styleHint ? `\n\nStyle mode override:\n${styleHint}` : '',
        user ? `\n\nAdditional user direction:\n${user}` : ''
    ];
    return parts.filter(Boolean).join('').trim();
}

function buildFinalGeneratePrompt(userPrompt = '', styleMode = 'auto', count = 4, opts = {}) {
    const n = Math.max(1, Math.min(10, Number(count) || 4));
    const user = String(userPrompt || '').trim();
    const styleHint = getStyleHint(styleMode);
    const systemBlock = resolveSystemPrompt(opts.systemPrompt);
    const styleNames = resolveEffectiveStyleList(opts.styleList);
    const layoutRule = n === 4
        ? COMPOSITE_GRID_LAYOUT_RULE
        : `${COMPOSITE_GRID_LAYOUT_RULE.replace('exactly 4', `exactly ${n}`).replace('2x2', n <= 2 ? '1x2' : '2x2')}`;
    const parts = [
        systemBlock,
        `\n${layoutRule}`,
        `\nChoose ${n} distinct styles from: ${styleNames.join(', ')} — one style per quadrant/cell.`,
        styleHint ? `\n${styleHint}` : '',
        user ? `\n\nUser creative direction:\n${user}` : ''
    ];
    return parts.filter(Boolean).join('\n').trim();
}

/**
 * Model router — maps quality + mode to CLIProxy OpenAI-compatible image model.
 */
function chooseModel({ quality = 'balanced', mode = 'text-to-image', aiProvider = 'auto', availableModels = null } = {}) {
    const q = String(quality || 'balanced').trim().toLowerCase();
    const envFastRaw = String(process.env.CLIPROXY_FAST_MODEL || '').trim();
    const envBalancedRaw = String(process.env.CLIPROXY_IMAGE_MODEL || '').trim();
    const envPremiumRaw = String(process.env.CLIPROXY_PREMIUM_MODEL || '').trim();
    const available = Array.isArray(availableModels) ? availableModels : [];
    const provider = normalizeAiProvider(aiProvider);
    const envFast = resolveEnvImageModel(envFastRaw, available);
    const envBalanced = resolveEnvImageModel(envBalancedRaw, available);
    const envPremium = resolveEnvImageModel(envPremiumRaw, available);

    if (provider !== 'auto') {
        return sanitizeImageModelChoice(pickImageModelByProvider(provider, available), available);
    }

    if (q === 'fast') {
        const fast = envFast || envBalanced;
        return sanitizeImageModelChoice(
            fast || pickDefaultImageModel(available),
            available
        );
    }
    if (q === 'premium') {
        if (envPremium) return sanitizeImageModelChoice(envPremium, available);
        if (envBalanced) return sanitizeImageModelChoice(envBalanced, available);
        const qualityPick = available.find((m) => /grok-imagine-image-quality/i.test(m))
            || available.find((m) => /gpt-image-2/i.test(m));
        if (qualityPick) return qualityPick;
        return pickDefaultImageModel(available);
    }
    if (envBalanced) return sanitizeImageModelChoice(envBalanced, available);
    return pickDefaultImageModel(available);
}

/** Primary + optional CLIPROXY_IMAGE_FALLBACK (e.g. gemini-3.1-flash-image on /v1/images). */
function chooseImageModelCandidates({ quality = 'balanced', mode = 'text-to-image', aiProvider = 'auto', availableModels = null } = {}) {
    const available = Array.isArray(availableModels) ? availableModels : [];
    const provider = normalizeAiProvider(aiProvider);
    const primary = chooseModel({ quality, mode, aiProvider, availableModels: available });
    if (provider !== 'auto') {
        return filterImageModelsByProvider(provider, [primary], available);
    }
    const altRaw = String(process.env.CLIPROXY_IMAGE_FALLBACK || '').trim();
    const alt = resolveEnvImageModel(altRaw, available) || altRaw;
    const out = [primary];
    if (alt && alt !== primary) out.push(sanitizeImageModelChoice(alt, available));
    else if (available.length > 1) {
        const next = available.find((m) => m !== primary && !/dall-e-/i.test(m));
        if (next && !out.includes(next)) out.push(next);
    }
    return filterImageModelCandidates(out, available);
}

function chooseImageSize(quality = 'balanced') {
    const q = String(quality || 'balanced').trim().toLowerCase();
    if (q === 'fast') return '1024x1024';
    if (q === 'premium') return '1536x1024';
    return '1024x1024';
}

function resolveGenerateEndpoint(mode, hasImage) {
    const m = String(mode || '').trim().toLowerCase();
    if (m === 'text-to-image' || (!hasImage && m !== 'image-to-image')) {
        return '/images/generations';
    }
    return '/images/edits';
}

module.exports = {
    APPAREL_DESIGN_SYSTEM_PROMPT,
    TEXT_PRESERVATION_RULE,
    COMPOSITE_GRID_LAYOUT_RULE,
    AUTO_IMAGE_PROMPT_TEMPLATE,
    NO_PIXEL_COPY_RULE,
    APPAREL_STYLE_LIST,
    podStyles2026,
    buildVariationSpecs,
    buildVariationPromptSuffix,
    VISION_ANALYSIS_SYSTEM_PROMPT,
    VISION_ANALYSIS_USER_TEXT,
    STYLE_MODE_HINTS,
    getStyleHint,
    resolveEffectiveStyleList,
    injectStyleListIntoTemplate,
    resolveSystemPrompt,
    buildFinalGeneratePrompt,
    buildAutoImageGenerationPrompt,
    chooseVisionModel,
    parseVisionAnalysis,
    formatVisionAnalysisBlock,
    chooseModel,
    chooseImageModelCandidates,
    chooseImageSize,
    resolveGenerateEndpoint
};
