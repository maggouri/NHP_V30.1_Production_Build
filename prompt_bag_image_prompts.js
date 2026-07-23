/**

 * Shared image+prompt payloads for Prompt Bag -> Gemini / ChatGPT / Generate.

 * Loaded via importScripts (background) or <script> (prompt bag UI).

 * Keep NHP_TEXT_PRESERVATION_RULE in sync with server/prompts/apparelDesignSystemPrompt.js

 */

const NHP_TEXT_PRESERVATION_RULE = 'TEXT / LETTERING (mandatory when the reference printable graphic shows readable words, names, numbers, or slogans): Preserve ALL such text in every output — same spelling and similar size/placement as the reference. Render words clearly and legibly on the design. Do not omit lettering, replace words with abstract shapes, or invent different spellings. Stylistic redraw is allowed; readable text content must remain. If the reference has no visible words, do not add text unless the user requests it.';



function appendNhpTextPreservationRule(prompt) {

    const p = String(prompt || '').trim();

    if (!p) return NHP_TEXT_PRESERVATION_RULE;

    if (/TEXT \/ LETTERING \(mandatory/i.test(p)) return p;

    return `${p} ${NHP_TEXT_PRESERVATION_RULE}`;

}



const PROMPT_BAG_DEFAULT_IMAGE_PROMPT =

    'Generate exactly 4 distinct print-ready apparel graphics from the visible printable design only. Use a solid black background (#000000). Output final designs only.';



/** Shared strict apparel prompt for Prompt Bag -> Gemini & ChatGPT. */

const PROMPT_BAG_ARTISAN_IMAGE_PROMPT = appendNhpTextPreservationRule(`Generate exactly 4 distinct print-ready apparel graphics based only on the printable design visible in the reference.



If the reference is a shirt mockup, flat garment photo, product photo, or model wearing apparel:

- Extract only the printed logo, text, symbols, mascot, graphic marks, and color mood from the garment.

- Do not redraw the shirt, model, mannequin, fabric folds, product photo setup, watermark, or original background.

- Do not change the mockup pose because the mockup is not the target.



If the extracted printable graphic contains a person or character, create 4 different pose/action variations for that character only, one per design, such as standing, sitting, leaning, walking, jumping, crouching, dancing, running, or dynamic action. If the printable graphic has no person or character, do not invent a body pose.



Analyze the design subject and mood, then choose the best 4 matching styles from this list: Vintage Distressed, 70s Retro Groovy, Meme Graphic / Sarcastic, Line Art Minimalism, Bold Varsity / Collegiate, Cottagecore Aesthetic, 90s Grunge / Y2K, Cute Kawaii Chibi, 80s Neon Synthwave, Dark Academia, Watercolor Splatter, Ukiyo-e Japanese, Sumi-e Zen, Gothic / Witchy, Cartoon Tattoo Style, Comic / Pop Art, Psychedelic Trippy, Pixel Art, Glitch Art, Cyberpunk / Futuristic. Use one selected style per design variation.



Preserve the core theme. Keep the result high contrast, readable, centered, and optimized for print.



Place every final design on a solid black background (#000000). Output final designs only.`);



const PROMPT_BAG_CHATGPT_IMAGE_PROMPT = PROMPT_BAG_ARTISAN_IMAGE_PROMPT;



function isArtisanStudioImageTargetUrl(targetUrl) {

    const url = String(targetUrl || '').toLowerCase();

    return url.includes('chatgpt.com') || url.includes('gemini.google.com');

}



/** @deprecated Use isArtisanStudioImageTargetUrl */

function isChatGptImageTargetUrl(targetUrl) {

    return isArtisanStudioImageTargetUrl(targetUrl);

}



function resolvePromptBagImagePrompt(targetUrl, explicitPrompt) {

    if (typeof explicitPrompt === 'string' && explicitPrompt.trim()) {

        return appendNhpTextPreservationRule(explicitPrompt.trim());

    }

    if (isArtisanStudioImageTargetUrl(targetUrl)) {

        return PROMPT_BAG_ARTISAN_IMAGE_PROMPT;

    }

    return appendNhpTextPreservationRule(PROMPT_BAG_DEFAULT_IMAGE_PROMPT);

}



if (typeof globalThis !== 'undefined') {

    globalThis.NHP_TEXT_PRESERVATION_RULE = NHP_TEXT_PRESERVATION_RULE;

    globalThis.appendNhpTextPreservationRule = appendNhpTextPreservationRule;

    globalThis.PROMPT_BAG_DEFAULT_IMAGE_PROMPT = PROMPT_BAG_DEFAULT_IMAGE_PROMPT;

    globalThis.PROMPT_BAG_ARTISAN_IMAGE_PROMPT = PROMPT_BAG_ARTISAN_IMAGE_PROMPT;

    globalThis.PROMPT_BAG_CHATGPT_IMAGE_PROMPT = PROMPT_BAG_CHATGPT_IMAGE_PROMPT;

    globalThis.isArtisanStudioImageTargetUrl = isArtisanStudioImageTargetUrl;

    globalThis.isChatGptImageTargetUrl = isChatGptImageTargetUrl;

    globalThis.resolvePromptBagImagePrompt = resolvePromptBagImagePrompt;

}


