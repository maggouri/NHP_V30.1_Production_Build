// ══════════════════════════════════════════════════════
//  ████████  IMAGE PROCESSING UTILS  ████████
// ══════════════════════════════════════════════════════

export const StudioWatermarkEngine = {
    alphaMaps: new Map(),
    bgImages: new Map(),
    configs: {
        small: { size: 48, margin: 32, asset: 'Peel Banana/assets/bg_48.png' },
        large: { size: 96, margin: 64, asset: 'Peel Banana/assets/bg_96.png' }
    },
    async init() {
        if (this.bgImages.size > 0) return;
        const loadImage = (path) => new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
                const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
                res(ctx.getImageData(0, 0, img.width, img.height));
            };
            img.onerror = rej;
            img.src = chrome.runtime.getURL(path);
        });
        try {
            this.bgImages.set(48, await loadImage(this.configs.small.asset));
            this.bgImages.set(96, await loadImage(this.configs.large.asset));
        } catch (e) { console.error("Watermark assets failed:", e); }
    },
    getAlphaMap(size) {
        if (!this.alphaMaps.has(size)) {
            const data = this.bgImages.get(size);
            if (!data) return null;
            const alpha = new Float32Array(size * size);
            for (let i = 0; i < alpha.length; i++) alpha[i] = Math.max(data.data[i * 4], data.data[i * 4 + 1], data.data[i * 4 + 2]) / 255;
            this.alphaMaps.set(size, alpha);
        }
        return this.alphaMaps.get(size);
    }
};

export async function studioRemoveAIMarks(dataURL) {
    await StudioWatermarkEngine.init();
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            const id = ctx.getImageData(0, 0, c.width, c.height);
            const config = (img.width > 1024 && img.height > 1024) ? StudioWatermarkEngine.configs.large : StudioWatermarkEngine.configs.small;
            const alphaMap = StudioWatermarkEngine.getAlphaMap(config.size);
            if (alphaMap) {
                const x = img.width - config.size - config.margin, y = img.height - config.size - config.margin;
                if (x >= 0 && y >= 0) {
                    const d = id.data;
                    for (let r = 0; r < config.size; r++) {
                        for (let col = 0; col < config.size; col++) {
                            const i = ((y + r) * img.width + (x + col)) * 4;
                            let a = Math.min(alphaMap[r * config.size + col], 0.99);
                            if (a < 0.002) continue;
                            for (let j = 0; j < 3; j++) d[i + j] = Math.max(0, Math.min(255, Math.round((d[i + j] - a * 255) / (1 - a))));
                        }
                    }
                    ctx.putImageData(id, 0, 0);
                }
            }
            resolve(c.toDataURL('image/png'));
        };
        img.src = dataURL;
    });
}

export async function studioRemoveBgWithAI(dataURL, apiKey) {
    const base64 = dataURL.split(',')[1];
    const mimeType = dataURL.split(';')[0].split(':')[1] || 'image/png';
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Return ONLY JSON: {"bg_color":"#RRGGBB","tolerance":30}. Identify the dominant background color of this image.' }, { inlineData: { mimeType: mimeType, data: base64 } }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 100 } })
        });
        if (!response.ok) throw new Error('API error');
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const match = text.match(/\{[^}]+\}/);
        const parsed = match ? JSON.parse(match[0]) : {};
        const bg = parsed.bg_color || '#FFFFFF';
        const tol = parsed.tolerance || 30;
        const r = parseInt(bg.slice(1, 3), 16), g = parseInt(bg.slice(3, 5), 16), b = parseInt(bg.slice(5, 7), 16);
        return studioFloodFillRemove(dataURL, r, g, b, tol);
    } catch (e) { return studioRemoveBgLocal(dataURL); }
}

export async function studioRemoveBgLocal(dataURL) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
            const id = ctx.getImageData(0, 0, c.width, c.height); const data = id.data;
            const corners = [[0, 0], [img.width - 1, 0], [0, img.height - 1], [img.width - 1, img.height - 1]];
            let br = 0, bg = 0, bb = 0;
            corners.forEach(([x, y]) => { const i = (y * img.width + x) * 4; br += data[i]; bg += data[i + 1]; bb += data[i + 2]; });
            br = Math.round(br / 4); bg = Math.round(bg / 4); bb = Math.round(bb / 4);
            const visited = new Uint8Array(img.width * img.height);
            function fill(sx, sy) {
                const stack = [[sx, sy]];
                while (stack.length) { const [x, y] = stack.pop(); if (x < 0 || x >= img.width || y < 0 || y >= img.height) continue; const idx = y * img.width + x; if (visited[idx]) continue; const pi = idx * 4; if (data[pi + 3] === 0) { visited[idx] = 1; continue; } const dr = data[pi] - br, dg = data[pi + 1] - bg, db = data[pi + 2] - bb; if (Math.sqrt(dr * dr + dg * dg + db * db) > 35) continue; visited[idx] = 1; data[pi + 3] = 0; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
            }
            corners.forEach(([x, y]) => fill(x, y));
            ctx.putImageData(id, 0, 0); resolve(c.toDataURL('image/png'));
        }; img.src = dataURL;
    });
}

export function studioFloodFillRemove(dataURL, tr, tg, tb, tolerance) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
            const id = ctx.getImageData(0, 0, c.width, c.height); const data = id.data;
            const visited = new Uint8Array(img.width * img.height);
            function fill(sx, sy) {
                const stack = [[sx, sy]];
                while (stack.length) { const [x, y] = stack.pop(); if (x < 0 || x >= img.width || y < 0 || y >= img.height) continue; const idx = y * img.width + x; if (visited[idx]) continue; const pi = idx * 4; if (data[pi + 3] === 0) { visited[idx] = 1; continue; } const dr = data[pi] - tr, dg = data[pi + 1] - tg, db = data[pi + 2] - tb; if (Math.sqrt(dr * dr + dg * dg + db * db) > tolerance) continue; visited[idx] = 1; data[pi + 3] = 0; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
            }
            [[0, 0], [img.width - 1, 0], [0, img.height - 1], [img.width - 1, img.height - 1]].forEach(([x, y]) => fill(x, y));
            ctx.putImageData(id, 0, 0); resolve(c.toDataURL('image/png'));
        }; img.src = dataURL;
    });
}
