/**
 * TeeMaster Engine v2.0 - Background Service Worker Edition
 * Handles high-performance image processing (AI Analysis, BG Removal, 5K Upscaling)
 * Uses OffscreenCanvas for Chrome Extension Service Worker compatibility.
 */

class TeeMasterEngine {
    constructor() {
        console.log('🚀 TeeMaster Engine: Initialized');
    }

    async processTeeMaster(payload) {
        const { dataURL, geminiKey, useAiBg, manualColor, removalMode, aiTolerance, baseTolerance } = payload;

        try {
            // 1. Load Image
            const blob = await this.dataURLToBlob(dataURL);
            const bitmap = await createImageBitmap(blob);
            const { width: originalWidth, height: originalHeight } = bitmap;

            // 2. Gemini AI Analysis (Optional)
            let aiData = null;
            if (useAiBg && geminiKey && geminiKey.trim() !== '') {
                try {
                    aiData = await this.getGeminiAnalysis(bitmap, geminiKey.trim());
                    console.log('🧠 Gemini Analysis:', aiData);
                } catch (aiErr) {
                    console.warn('[TME] Gemini AI failed:', aiErr);
                }
            }

            // 3. Initial Crop (Handle watermarks if AI detected any)
            const cropRatio = aiData && aiData.watermarkCropPercentage ? (aiData.watermarkCropPercentage / 100) : 0;
            const cropWidth = originalWidth;
            const cropHeight = Math.max(1, originalHeight - (originalHeight * cropRatio));

            const cropCanvas = new OffscreenCanvas(cropWidth, cropHeight);
            const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
            cropCtx.drawImage(bitmap, 0, 0, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            // 4. Background Color Detection
            let bgR, bgG, bgB;
            if (manualColor && manualColor.startsWith('#')) {
                bgR = parseInt(manualColor.substring(1, 3), 16);
                bgG = parseInt(manualColor.substring(3, 5), 16);
                bgB = parseInt(manualColor.substring(5, 7), 16);
            } else if (aiData && aiData.backgroundColorRGB) {
                [bgR, bgG, bgB] = aiData.backgroundColorRGB;
            } else {
                [bgR, bgG, bgB] = this.getSmartBackgroundColor(cropCtx, cropWidth, cropHeight);
            }

            // 5. Final Upscale (5000x5000)
            const targetSize = 5000;
            const finalCanvas = new OffscreenCanvas(targetSize, targetSize);
            const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });

            // Initialize with the background color (to prepare for removal)
            finalCtx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
            finalCtx.fillRect(0, 0, targetSize, targetSize);

            finalCtx.imageSmoothingEnabled = true;
            finalCtx.imageSmoothingQuality = 'high';

            const scale = Math.min(targetSize / cropWidth, targetSize / cropHeight);
            const sw = cropWidth * scale, sh = cropHeight * scale;
            const ox = (targetSize - sw) / 2, oy = (targetSize - sh) / 2;

            finalCtx.drawImage(cropCanvas, 0, 0, cropWidth, cropHeight, ox, oy, sw, sh);

            // 6. Background Removal
            let tolerance = parseInt(baseTolerance || 30);
            if (aiData && aiData.recommendedTolerance !== undefined && aiTolerance) {
                tolerance = aiData.recommendedTolerance;
            }

            const imgData = finalCtx.getImageData(0, 0, targetSize, targetSize);
            let shouldFlood = (removalMode === 'flood');
            if (removalMode === 'auto') shouldFlood = aiData ? aiData.useFloodFill : true;

            if (shouldFlood) {
                this.removeBackgroundFloodFill(imgData, targetSize, targetSize, bgR, bgG, bgB, tolerance);
            } else {
                this.removeBackgroundGlobal(imgData, bgR, bgG, bgB, tolerance);
            }

            finalCtx.putImageData(imgData, 0, 0);

            // 7. Success - Convert back to DataURL with safety size check under 20MB
            let finalBlob = await finalCanvas.convertToBlob({ type: 'image/png' });
            const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

            if (finalBlob.size > MAX_SIZE) {
                console.log(`[TME] Warning: Generated image size (${Math.round(finalBlob.size / 1024 / 1024)}MB) exceeds 20MB. Optimizing resolution...`);
                let optimizedSize = 4800;
                while (finalBlob.size > MAX_SIZE && optimizedSize >= 4000) {
                    console.log(`[TME] Scaling down to ${optimizedSize}x${optimizedSize} to reduce size...`);
                    const optCanvas = new OffscreenCanvas(optimizedSize, optimizedSize);
                    const optCtx = optCanvas.getContext('2d', { willReadFrequently: true });
                    optCtx.imageSmoothingEnabled = true;
                    optCtx.imageSmoothingQuality = 'high';
                    optCtx.drawImage(finalCanvas, 0, 0, targetSize, targetSize, 0, 0, optimizedSize, optimizedSize);
                    finalBlob = await optCanvas.convertToBlob({ type: 'image/png' });
                    optimizedSize -= 400;
                }
                console.log(`[TME] Optimization finished. Final image size: ${Math.round(finalBlob.size / 1024 / 1024)}MB`);
            }

            return await this.blobToDataURL(finalBlob);

        } catch (err) {
            console.error('[TME] Critical Error:', err);
            throw err;
        }
    }

    async getGeminiAnalysis(bitmap, key) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

        // Downscale for AI to save bandwidth
        const base64Content = (await this.getDownscaledBase64(bitmap)).split(',')[1];

        const payload = {
            contents: [{
                parts: [
                    {
                        text: `أنت خبير مصمم جرافيك POD. قم بتحليل هذه الصورة وأعد كائن JSON بهذه المفاتيح حصراً:
                        - "backgroundColorRGB": مصفوفة [R, G, B] للخلفية المراد إزالتها.
                        - "recommendedTolerance": رقم (0-255).
                        - "watermarkCropPercentage": نسبة القص من الأسفل (0 إن لم يوجد علامة مائية).
                        - "useFloodFill": boolean (true إذا كان لون الخلفية موجوداً داخل التصميم أيضاً).
                        لا تخرج سوى الـ JSON.`
                    },
                    { inline_data: { mime_type: 'image/jpeg', data: base64Content } }
                ]
            }]
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`Gemini API Error: ${res.status}`);

        const data = await res.json();
        let text = data.candidates[0].content.parts[0].text.trim();
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    }

    async getDownscaledBase64(bitmap) {
        const max = 512;
        let w = bitmap.width, h = bitmap.height;
        if (w > max || h > max) {
            if (w > h) { h = Math.round((h * max) / w); w = max; }
            else { w = Math.round((w * max) / h); h = max; }
        }
        const c = new OffscreenCanvas(w, h);
        const ctx = c.getContext('2d');
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(bitmap, 0, 0, w, h);
        const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
        return await this.blobToDataURL(blob);
    }

    getSmartBackgroundColor(ctx, width, height) {
        const m = 10;
        const corners = [
            ctx.getImageData(m, m, 1, 1).data,
            ctx.getImageData(width - m, m, 1, 1).data,
            ctx.getImageData(m, height - m, 1, 1).data,
            ctx.getImageData(width - m, height - m, 1, 1).data
        ];

        let r = 0, g = 0, b = 0, valid = 0;
        corners.forEach(c => {
            if (c[3] > 0) {
                r += c[0]; g += c[1]; b += c[2];
                valid++;
            }
        });

        if (valid === 0) return [255, 255, 255];
        return [Math.round(r / valid), Math.round(g / valid), Math.round(b / valid)];
    }

    removeBackgroundFloodFill(imgData, width, height, tr, tg, tb, tol) {
        const data = imgData.data;
        const stack = new Int32Array(width * height);
        let ptr = 0;
        const visited = new Uint8Array(width * height);

        const push = (x, y) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return;
            const i = y * width + x;
            if (visited[i]) return;
            const p = i * 4;
            if (data[p + 3] === 0) { visited[i] = 1; stack[ptr++] = i; return; }
            const dist = Math.sqrt((data[p] - tr) ** 2 + (data[p + 1] - tg) ** 2 + (data[p + 2] - tb) ** 2);
            if (dist <= tol) { visited[i] = 1; data[p + 3] = 0; stack[ptr++] = i; }
        };

        // Edge seeds
        for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
        for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }

        while (ptr > 0) {
            const i = stack[--ptr];
            const x = i % width, y = (i / width) | 0;
            push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
        }
    }

    removeBackgroundGlobal(imgData, tr, tg, tb, tol) {
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const dist = Math.sqrt((d[i] - tr) ** 2 + (d[i + 1] - tg) ** 2 + (d[i + 2] - tb) ** 2);
            if (dist <= tol) d[i + 3] = 0;
        }
    }

    // --- Helpers ---

    async dataURLToBlob(dataURL) {
        if (dataURL.startsWith('data:')) {
            const parts = dataURL.split(',');
            const mime = parts[0].match(/:(.*?);/)[1];
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            return new Blob([u8arr], { type: mime });
        }
        const res = await fetch(dataURL);
        return await res.blob();
    }

    async blobToDataURL(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }
}

const tmEngine = new TeeMasterEngine();
