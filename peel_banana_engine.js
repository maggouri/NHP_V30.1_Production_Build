/**
 * Consolidated Peel Banana Engine for Niche Hunter Pro
 * Handles local watermark removal from Gemini generated images.
 */
console.log('🍌 Peel Banana Engine: Loaded');

const WATERMARK_CONFIGS = {
    small: { key: 'small', size: 48, margin: 32, asset: 'assets/bg_48.png', minDimension: 0 },
    large: { key: 'large', size: 96, margin: 64, asset: 'assets/bg_96.png', minDimension: 1000 }
};

const SEARCH_OFFSETS = [0, -16, 16, -8, 8, -24, 24];
const LOGO_VALUE = 255;
const EPSILON = 1e-4;

const PASS_PRESETS = {
    normal: {
        alphaThreshold: 0.0015,
        alphaStrength: 1.0,
        maxAlpha: 0.992,
        maskAlphaThreshold: 0.12,
        whiteLumaThreshold: 172,
        saturationThreshold: 72,
        smoothRadius: 1,
        smoothIterations: 1
    },
    strong: {
        alphaThreshold: 0.001,
        alphaStrength: 1.2,
        maxAlpha: 0.996,
        maskAlphaThreshold: 0.08,
        whiteLumaThreshold: 152,
        saturationThreshold: 96,
        smoothRadius: 2,
        smoothIterations: 2
    }
};

class PeelBananaEngine {
    constructor() {
        this.alphaMaps = new Map();
        this.bgBitmaps = new Map();
    }

    async loadAssets() {
        const loadImage = async (path) => {
            try {
                const url = chrome.runtime.getURL(path);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();
                return await createImageBitmap(blob);
            } catch (e) {
                console.error(`[Peel Engine] Error loading asset ${path}:`, e);
                throw new Error(`تعذر تحميل الملف المساعد (${path}): ${e.message}`);
            }
        };

        if (!this.bgBitmaps.has(48)) this.bgBitmaps.set(48, await loadImage(WATERMARK_CONFIGS.small.asset));
        if (!this.bgBitmaps.has(96)) this.bgBitmaps.set(96, await loadImage(WATERMARK_CONFIGS.large.asset));
    }

    getAlphaMap(size) {
        if (!this.alphaMaps.has(size)) {
            const bgBitmap = this.bgBitmaps.get(size);
            const canvas = new OffscreenCanvas(size, size);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bgBitmap, 0, 0);
            const imageData = ctx.getImageData(0, 0, size, size);

            const alphaMap = new Float32Array(size * size);
            for (let i = 0; i < alphaMap.length; i++) {
                const idx = i * 4;
                const maxChannel = Math.max(imageData.data[idx], imageData.data[idx + 1], imageData.data[idx + 2]);
                alphaMap[i] = maxChannel / 255.0;
            }
            this.alphaMaps.set(size, alphaMap);
        }
        return this.alphaMaps.get(size);
    }

    getWatermarkConfigs(width, height) {
        if (width >= WATERMARK_CONFIGS.large.minDimension && height >= WATERMARK_CONFIGS.large.minDimension) {
            return [WATERMARK_CONFIGS.large, WATERMARK_CONFIGS.small];
        }
        return [WATERMARK_CONFIGS.small];
    }

    getCandidatePositions(width, height, config) {
        const positions = [];
        const baseX = width - config.size - config.margin;
        const baseY = height - config.size - config.margin;
        for (const dx of SEARCH_OFFSETS) {
            for (const dy of SEARCH_OFFSETS) {
                const x = baseX + dx;
                const y = baseY + dy;
                if (x < 0 || y < 0 || x + config.size > width || y + config.size > height) continue;
                positions.push({ x, y });
            }
        }
        return positions;
    }

    static getLuma(r, g, b) {
        return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    }

    static getSaturation(r, g, b) {
        return Math.max(r, g, b) - Math.min(r, g, b);
    }

    scoreCandidate(imageData, width, alphaMap, size, posX, posY) {
        let score = 0;
        let weight = 0;
        const data = imageData.data;
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const alpha = alphaMap[row * size + col];
                if (alpha < 0.04) continue;
                const idx = ((posY + row) * width + (posX + col)) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const luma = PeelBananaEngine.getLuma(r, g, b);
                const sat = PeelBananaEngine.getSaturation(r, g, b);
                score += alpha * ((luma / 255) - ((sat / 255) * 0.55));
                weight += alpha;
            }
        }
        if (weight < 1e-6) return 0;
        return score / weight;
    }

    selectBestCandidate(imageData, width, height) {
        const configs = this.getWatermarkConfigs(width, height);
        let best = null;
        for (const config of configs) {
            const alphaMap = this.getAlphaMap(config.size);
            if (!alphaMap) continue;
            const candidates = this.getCandidatePositions(width, height, config);
            for (const candidate of candidates) {
                const score = this.scoreCandidate(imageData, width, alphaMap, config.size, candidate.x, candidate.y);
                if (!best || score > best.score) {
                    best = { config, posX: candidate.x, posY: candidate.y, alphaMap, score };
                }
            }
        }
        return best;
    }

    analyzeResidualSignal(imageData, width, candidate, preset) {
        const { config, posX, posY, alphaMap } = candidate;
        const size = config.size;
        const data = imageData.data;
        let weightedSignal = 0;
        let weight = 0;
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const alpha = alphaMap[row * size + col];
                if (alpha < preset.maskAlphaThreshold) continue;
                const idx = ((posY + row) * width + (posX + col)) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const luma = PeelBananaEngine.getLuma(r, g, b);
                const sat = PeelBananaEngine.getSaturation(r, g, b);
                weightedSignal += alpha * ((luma / 255) - ((sat / 255) * 0.45));
                weight += alpha;
            }
        }
        if (weight < 1e-6) return 0;
        return weightedSignal / weight;
    }

    applyPass(imageData, width, height, candidate, preset) {
        const { config, posX, posY, alphaMap } = candidate;
        const { size } = config;
        const data = imageData.data;
        const mask = new Uint8Array(size * size);
        let maskCount = 0;

        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const imgIdx = ((posY + row) * width + (posX + col)) * 4;
                const alphaIdx = row * size + col;
                const baseAlpha = alphaMap[alphaIdx];

                if (baseAlpha < preset.alphaThreshold) continue;

                const effectiveAlpha = Math.min(preset.maxAlpha, baseAlpha * preset.alphaStrength);
                const denom = Math.max(EPSILON, 1 - effectiveAlpha);

                for (let c = 0; c < 3; c++) {
                    const watermarked = data[imgIdx + c];
                    const recovered = (watermarked - (effectiveAlpha * LOGO_VALUE)) / denom;
                    data[imgIdx + c] = Math.max(0, Math.min(255, Math.round(recovered)));
                }

                const r = data[imgIdx];
                const g = data[imgIdx + 1];
                const b = data[imgIdx + 2];
                const luma = PeelBananaEngine.getLuma(r, g, b);
                const sat = PeelBananaEngine.getSaturation(r, g, b);
                if (
                    baseAlpha >= preset.maskAlphaThreshold &&
                    luma >= preset.whiteLumaThreshold &&
                    sat <= preset.saturationThreshold
                ) {
                    mask[alphaIdx] = 1;
                    maskCount++;
                }
            }
        }

        if (maskCount && preset.smoothIterations > 0) {
            this.smoothMaskedRegion(data, width, height, posX, posY, size, mask, preset.smoothRadius, preset.smoothIterations);
        }
    }

    smoothMaskedRegion(data, width, height, posX, posY, size, mask, radius, iterations) {
        if (radius < 1) return;
        const stride = width * 4;
        for (let iter = 0; iter < iterations; iter++) {
            const snapshot = new Uint8ClampedArray(data);
            for (let row = 0; row < size; row++) {
                for (let col = 0; col < size; col++) {
                    const localIdx = row * size + col;
                    if (!mask[localIdx]) continue;
                    const gx = posX + col;
                    const gy = posY + row;
                    if (gx <= 0 || gy <= 0 || gx >= width - 1 || gy >= height - 1) continue;
                    let rAcc = 0;
                    let gAcc = 0;
                    let bAcc = 0;
                    let count = 0;
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = gx + dx;
                            const ny = gy + dy;
                            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                            const localNx = nx - posX;
                            const localNy = ny - posY;
                            if (
                                localNx >= 0 && localNy >= 0 &&
                                localNx < size && localNy < size &&
                                mask[(localNy * size) + localNx]
                            ) {
                                continue;
                            }
                            const idx = (ny * stride) + (nx * 4);
                            rAcc += snapshot[idx];
                            gAcc += snapshot[idx + 1];
                            bAcc += snapshot[idx + 2];
                            count++;
                        }
                    }
                    if (count > 0) {
                        const idx = ((gy * width) + gx) * 4;
                        data[idx] = Math.round(rAcc / count);
                        data[idx + 1] = Math.round(gAcc / count);
                        data[idx + 2] = Math.round(bAcc / count);
                    }
                }
            }
        }
    }

    async processPeel(dataURL) {
        try {
            // 1. Load image
            if (!dataURL) throw new Error('بيانات الصورة فارغة (Empty Image Data)');

            let blob;
            if (dataURL.startsWith('data:')) {
                // Manual conversion to avoid potential fetch issues with long data URLs in SW
                const parts = dataURL.split(',');
                const mime = parts[0].match(/:(.*?);/)[1];
                const bstr = atob(parts[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) u8arr[n] = bstr.charCodeAt(n);
                blob = new Blob([u8arr], { type: mime });
            } else {
                const response = await fetch(dataURL).catch(e => { throw new Error('فشل جلب الصورة (Fetch Failed)'); });
                if (!response.ok) throw new Error('فشل استجابة الشبكة لجلب الصورة (Network Error)');
                blob = await response.blob();
            }

            const bitmap = await createImageBitmap(blob).catch(e => { throw new Error('فشل فك تشفير الصورة (Decode Failed)'); });
            const { width, height } = bitmap;

            // 2. Setup Canvas
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            const imageData = ctx.getImageData(0, 0, width, height);

            // 3. Process with candidate detection + deterministic strong fallback.
            try {
                await this.loadAssets();
            } catch (assetErr) {
                console.error('[Peel Engine] Asset Load Error:', assetErr);
                throw new Error('فشل تحميل الملفات المساعدة (Assets Error: ' + assetErr.message + ')');
            }

            const candidate = this.selectBestCandidate(imageData, width, height);
            if (!candidate) {
                console.warn('[Peel Engine] No valid watermark candidate, returning source image.');
            } else {
                const beforeSignal = this.analyzeResidualSignal(imageData, width, candidate, PASS_PRESETS.normal);
                this.applyPass(imageData, width, height, candidate, PASS_PRESETS.normal);
                const afterSignal = this.analyzeResidualSignal(imageData, width, candidate, PASS_PRESETS.normal);
                const improvement = beforeSignal > EPSILON ? ((beforeSignal - afterSignal) / beforeSignal) : 0;

                // If residual remains high, run one stronger deterministic cleanup pass.
                if (afterSignal > 0.34 || improvement < 0.18) {
                    this.applyPass(imageData, width, height, candidate, PASS_PRESETS.strong);
                }
            }

            // 4. Return as DataURL
            ctx.putImageData(imageData, 0, 0);
            const finalBlob = await canvas.convertToBlob({ type: 'image/png' });
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('فشل تحويل الصورة النهائية (Final Conversion Failed)'));
                reader.readAsDataURL(finalBlob);
            });
        } catch (fatal) {
            console.error('[Peel Engine Error]', fatal);
            throw fatal;
        }
    }
}

// Global instance for reuse
const peelEngine = new PeelBananaEngine();
