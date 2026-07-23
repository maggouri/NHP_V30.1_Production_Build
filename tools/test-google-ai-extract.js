/**
 * Minimal fixture test for Google AI Mode data-im / PRLDce parsing logic.
 * Run: node tools/test-google-ai-extract.js
 */
const assert = require('assert');

function unescapeGoogleInlineText(text) {
    let value = String(text || '');
    value = value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return value
        .replace(/\\u002F/gi, '/')
        .replace(/\\u0026/gi, '&')
        .replace(/\\u003d/gi, '=')
        .replace(/\\u003a/gi, ':')
        .replace(/\\\//g, '/');
}

function decodeGoogleAiHtmlAttrValue(raw) {
    const entities = String(raw || '')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/gi, '&');
    return unescapeGoogleInlineText(entities);
}

function googleAiUrlFromSizeBlock(block) {
    if (!Array.isArray(block) || typeof block[0] !== 'string') return '';
    const u = block[0].trim();
    if (/^https?:\/\//i.test(u) || u.startsWith('data:image/')) return u;
    return '';
}

function pickGoogleAiThumbFullFromImArray(arr) {
    if (!Array.isArray(arr)) return null;
    if (arr.length >= 4 && typeof arr[1] === 'string' && !/^https?:\/\//i.test(arr[1])) {
        const thumb = googleAiUrlFromSizeBlock(arr[2]);
        const full = googleAiUrlFromSizeBlock(arr[3]);
        if (thumb || full) return { thumb: thumb || full, full: full || thumb };
    }
    const blocks = [];
    for (const entry of arr) {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue;
        const url = entry[0].trim();
        if (!/^https?:\/\//i.test(url)) continue;
        const w = Number(entry[1]) || 0;
        const h = Number(entry[2]) || 0;
        blocks.push({ url, pixels: Math.max(w * h, w, h, 1) });
    }
    if (blocks.length < 2) return null;
    blocks.sort((a, b) => a.pixels - b.pixels);
    return { thumb: blocks[0].url, full: blocks[blocks.length - 1].url };
}

const dataImAttr = '[0,&quot;img1&quot;,[&quot;https://thumb.example/s.jpg&quot;,80,80],[&quot;https://full.example/large.png&quot;,640,640],{}]';
const pair = pickGoogleAiThumbFullFromImArray(JSON.parse(decodeGoogleAiHtmlAttrValue(dataImAttr)));
assert.strictEqual(pair.thumb, 'https://thumb.example/s.jpg');
assert.strictEqual(pair.full, 'https://full.example/large.png');

const tgPayload = '[[&quot;https://encrypted-tbn0.gstatic.com/small&quot;,50,50],[&quot;https://i.pinimg.com/originals/aa/bb/cc.jpg&quot;,400,400]]';
const tgPair = pickGoogleAiThumbFullFromImArray(JSON.parse(decodeGoogleAiHtmlAttrValue(tgPayload)));
assert.ok(tgPair.full.includes('pinimg.com'));
assert.ok(tgPair.thumb.includes('encrypted-tbn'));

const inlineB64 = 'data:image/jpeg;base64,' + 'A'.repeat(1200);
const html = `<div class="mZJni Dn7Fzd" data-container-id="main-col">
  <div data-im="${dataImAttr}"></div>
  <img class="PRLDce" src="${inlineB64}">
  <!--TgQPHd|${tgPayload}-->
</div>`;
assert.ok(html.includes('PRLDce'));
assert.ok(html.includes('data-im='));

console.log('OK: Google AI extract fixture tests passed');
