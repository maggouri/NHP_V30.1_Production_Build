/**
 * NHP AI RemBG Engine — Niche Hunter Pro owned background removal.
 * No third-party rembg product branding or remote vendor URLs.
 *
 * Engine ids:
 *   nhp-edge-v1  — dominant-border solid BG detect → global color-key (default) or flood;
 *                  soft alpha + despill; adaptive tolerance by source quality
 *   nhp-isnet    — reserved for future on-device neural model (not bundled yet)
 *
 * Works in extension service worker (OffscreenCanvas) and page contexts.
 */
(function (root) {
  'use strict';

  const ENGINE_ID = 'nhp-edge-v1';
  const DEFAULT_TOLERANCE = 42;
  const DEFAULT_FEATHER = 2;
  /** Default: track bg color everywhere (global). Use mode:'flood' to only clear edge-connected bg. */
  const DEFAULT_MODE = 'global';
  /** Abort auto-detect when border consensus is weaker than this (0–1). */
  const DEFAULT_MIN_CONFIDENCE = 0.55;
  /** Quantization bits for dominant-color bins (8 → 32 levels per channel). */
  const DOMINANT_SHIFT = 3;

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function colorDistSq(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return (dr * dr) + (dg * dg) + (db * db);
  }

  /**
   * Infer source quality from data-URL mime / hint.
   * PNG → tighter tolerance; JPEG / webp / unknown compressed → looser.
   * @param {string} [dataUrl]
   * @param {string} [mimeHint]
   * @returns {'png'|'jpeg'|'other'}
   */
  function inferSourceQuality(dataUrl, mimeHint) {
    const hint = String(mimeHint || '').toLowerCase();
    const head = String(dataUrl || '').slice(0, 64).toLowerCase();
    if (hint.includes('png') || head.startsWith('data:image/png')) return 'png';
    if (hint.includes('jpeg') || hint.includes('jpg') || head.startsWith('data:image/jpeg')) return 'jpeg';
    if (hint.includes('webp') || head.startsWith('data:image/webp')) return 'jpeg';
    return 'other';
  }

  /**
   * Adapt base tolerance by compression artifacts.
   * @param {number} baseTolerance
   * @param {'png'|'jpeg'|'other'} quality
   */
  function adaptTolerance(baseTolerance, quality) {
    const base = clamp(Number(baseTolerance) || DEFAULT_TOLERANCE, 4, 120);
    if (quality === 'png') return clamp(Math.round(base * 0.72), 4, 90);
    if (quality === 'jpeg') return clamp(Math.round(base * 1.35), 10, 120);
    return clamp(Math.round(base * 1.1), 6, 110);
  }

  /**
   * Sample four borders + corners; return dominant solid BG color + confidence.
   * Confidence = share of border samples in the winning quantized bin (0–1).
   * @returns {{ r: number, g: number, b: number, confidence: number, sampleCount: number }}
   */
  function detectSolidBackground(data, width, height) {
    if (!width || !height) {
      return { r: 255, g: 255, b: 255, confidence: 0, sampleCount: 0 };
    }

    const step = Math.max(1, Math.floor(Math.min(width, height) / 256));
    /** @type {Map<number, { rSum: number, gSum: number, bSum: number, count: number }>} */
    const bins = new Map();
    let sampleCount = 0;

    const push = (x, y) => {
      const xi = clamp(x | 0, 0, width - 1);
      const yi = clamp(y | 0, 0, height - 1);
      const i = (yi * width + xi) * 4;
      if (data[i + 3] < 8) return;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> DOMINANT_SHIFT) << 16) | ((g >> DOMINANT_SHIFT) << 8) | (b >> DOMINANT_SHIFT);
      let bin = bins.get(key);
      if (!bin) {
        bin = { rSum: 0, gSum: 0, bSum: 0, count: 0 };
        bins.set(key, bin);
      }
      bin.rSum += r;
      bin.gSum += g;
      bin.bSum += b;
      bin.count += 1;
      sampleCount += 1;
    };

    // Full borders (strided for large images)
    for (let x = 0; x < width; x += step) {
      push(x, 0);
      push(x, height - 1);
    }
    for (let y = step; y < height - step; y += step) {
      push(0, y);
      push(width - 1, y);
    }

    // Dense corner clusters (JPEG edges often noisier than mid-border)
    const cornerOffsets = [0, 1, 2, 3, 4, 6, 8];
    for (let n = 0; n < cornerOffsets.length; n += 1) {
      const o = cornerOffsets[n];
      push(o, o);
      push(width - 1 - o, o);
      push(o, height - 1 - o);
      push(width - 1 - o, height - 1 - o);
    }

    if (!sampleCount) {
      return { r: 255, g: 255, b: 255, confidence: 0, sampleCount: 0 };
    }

    let best = null;
    for (const bin of bins.values()) {
      if (!best || bin.count > best.count) best = bin;
    }

    const r = Math.round(best.rSum / best.count);
    const g = Math.round(best.gSum / best.count);
    const b = Math.round(best.bSum / best.count);
    const confidence = best.count / sampleCount;

    // Corner agreement boosts/penalizes confidence slightly
    const corners = [
      [2, 2],
      [width - 3, 2],
      [2, height - 3],
      [width - 3, height - 3]
    ];
    let cornerHits = 0;
    let cornerValid = 0;
    const agreeTolSq = 28 * 28;
    for (let c = 0; c < corners.length; c += 1) {
      const cx = corners[c][0];
      const cy = corners[c][1];
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
      const i = (cy * width + cx) * 4;
      if (data[i + 3] < 8) continue;
      cornerValid += 1;
      if (colorDistSq(data[i], data[i + 1], data[i + 2], r, g, b) <= agreeTolSq) {
        cornerHits += 1;
      }
    }
    let adjusted = confidence;
    if (cornerValid >= 3) {
      const cornerRatio = cornerHits / cornerValid;
      adjusted = clamp(confidence * 0.85 + cornerRatio * 0.15, 0, 1);
      if (cornerRatio < 0.5) adjusted = Math.min(adjusted, confidence * 0.75);
    }

    return { r, g, b, confidence: adjusted, sampleCount };
  }

  /** @deprecated Prefer detectSolidBackground — kept for callers expecting a simple average. */
  function sampleBorderAverage(data, width, height) {
    const det = detectSolidBackground(data, width, height);
    return { r: det.r, g: det.g, b: det.b };
  }

  /**
   * Soft global color key: remove every matching pixel (including enclosed letter
   * interiors O/P/D/A/…) with distance-based alpha, not flood-fill.
   * @returns {Uint8Array} removedMask (1 = fully/near-bg)
   */
  function applyGlobalColorKey(imageData, targetR, targetG, targetB, tolerance) {
    const { data, width, height } = imageData;
    const hardTol = clamp(tolerance * 0.72, 2, tolerance);
    const softTol = clamp(tolerance * 1.15, hardTol + 1, 140);
    const hardSq = hardTol * hardTol;
    const softSq = softTol * softTol;
    const removedMask = new Uint8Array(width * height);

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      if (data[i + 3] < 8) {
        removedMask[p] = 1;
        continue;
      }
      const distSq = colorDistSq(data[i], data[i + 1], data[i + 2], targetR, targetG, targetB);
      if (distSq <= hardSq) {
        data[i + 3] = 0;
        removedMask[p] = 1;
        continue;
      }
      if (distSq <= softSq) {
        const dist = Math.sqrt(distSq);
        const t = clamp((dist - hardTol) / (softTol - hardTol + 0.001), 0, 1);
        // Preserve anti-aliased edges: partial alpha instead of hard cut
        data[i + 3] = Math.round(data[i + 3] * t);
        if (t < 0.35) removedMask[p] = 1;
        // Mild despill while alpha still soft
        despillTowardForeground(data, i, targetR, targetG, targetB, 1 - t);
      }
    }
    return removedMask;
  }

  /**
   * Pull fringe RGB away from the detected background (halo / color spill).
   */
  function despillTowardForeground(data, i, br, bg, bb, strength) {
    const s = clamp(strength, 0, 1) * 0.55;
    if (s < 0.02) return;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Move each channel away from bg toward the pixel's own deviation
    data[i] = clamp(Math.round(r + (r - br) * s), 0, 255);
    data[i + 1] = clamp(Math.round(g + (g - bg) * s), 0, 255);
    data[i + 2] = clamp(Math.round(b + (b - bb) * s), 0, 255);
  }

  /**
   * Second-pass despill on remaining opaque pixels that sit next to removed BG.
   */
  function removeColorSpill(imageData, removedMask, targetR, targetG, targetB, radius) {
    const { data, width, height } = imageData;
    const r = clamp(radius | 0, 1, 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        const i = idx * 4;
        if (data[i + 3] < 16 || removedMask[idx]) continue;
        let near = false;
        for (let dy = -r; dy <= r && !near; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (removedMask[ny * width + nx]) {
              near = true;
              break;
            }
          }
        }
        if (!near) continue;
        const distSq = colorDistSq(data[i], data[i + 1], data[i + 2], targetR, targetG, targetB);
        const spill = clamp(1 - (Math.sqrt(distSq) / 80), 0, 1);
        if (spill > 0.05) despillTowardForeground(data, i, targetR, targetG, targetB, spill);
      }
    }
  }

  /**
   * Border-seeded flood fill: only removes background connected to the frame.
   */
  function applyBorderFlood(imageData, targetR, targetG, targetB, tolerance) {
    const { data, width, height } = imageData;
    const tolSq = tolerance * tolerance;
    const visited = new Uint8Array(width * height);
    const stack = [];

    const trySeed = (x, y) => {
      const idx = y * width + x;
      if (visited[idx]) return;
      const i = idx * 4;
      if (data[i + 3] < 8) {
        visited[idx] = 1;
        return;
      }
      if (colorDistSq(data[i], data[i + 1], data[i + 2], targetR, targetG, targetB) <= tolSq) {
        visited[idx] = 1;
        stack.push(idx);
      }
    };

    for (let x = 0; x < width; x += 1) {
      trySeed(x, 0);
      trySeed(x, height - 1);
    }
    for (let y = 1; y < height - 1; y += 1) {
      trySeed(0, y);
      trySeed(width - 1, y);
    }

    while (stack.length) {
      const idx = stack.pop();
      const i = idx * 4;
      data[i + 3] = 0;

      const x = idx % width;
      const y = (idx / width) | 0;
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ];
      for (let n = 0; n < neighbors.length; n += 1) {
        const nx = neighbors[n][0];
        const ny = neighbors[n][1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (visited[nIdx]) continue;
        visited[nIdx] = 1;
        const ni = nIdx * 4;
        if (data[ni + 3] < 8) continue;
        if (colorDistSq(data[ni], data[ni + 1], data[ni + 2], targetR, targetG, targetB) <= tolSq) {
          stack.push(nIdx);
        }
      }
    }

    return visited;
  }

  /** Soften hard cut edges by lowering alpha near removed background. */
  function featherAlpha(imageData, removedMask, radius) {
    if (!radius || radius < 1) return;
    const { data, width, height } = imageData;
    const r = clamp(radius | 0, 1, 6);
    const next = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        const i = idx * 4;
        if (data[i + 3] === 0) continue;
        let nearRemoved = false;
        for (let dy = -r; dy <= r && !nearRemoved; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (removedMask[ny * width + nx]) {
              nearRemoved = true;
              break;
            }
          }
        }
        if (!nearRemoved) continue;
        let minDist = r + 1;
        for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (!removedMask[ny * width + nx]) continue;
            const d = Math.sqrt((dx * dx) + (dy * dy));
            if (d < minDist) minDist = d;
          }
        }
        if (minDist > r) continue;
        const factor = clamp(minDist / (r + 0.001), 0.15, 1);
        next[i + 3] = Math.round(data[i + 3] * factor);
      }
    }
    data.set(next);
  }

  /**
   * Core pixel pipeline. Throws if auto-detect confidence is below minConfidence
   * (unless manualColorHex is provided or abortOnLowConfidence === false).
   */
  function processImageData(imageData, options = {}) {
    const quality = options.quality || 'other';
    const baseTol = Number(options.tolerance) || DEFAULT_TOLERANCE;
    const tolerance = options.skipAdaptTolerance
      ? clamp(baseTol, 4, 120)
      : adaptTolerance(baseTol, quality);
    const feather = clamp(Number(options.feather) || DEFAULT_FEATHER, 0, 6);
    const mode = String(options.mode || DEFAULT_MODE).toLowerCase() === 'flood' ? 'flood' : 'global';
    const minConfidence = clamp(
      options.minConfidence != null ? Number(options.minConfidence) : DEFAULT_MIN_CONFIDENCE,
      0.15,
      0.95
    );
    const abortOnLowConfidence = options.abortOnLowConfidence === true;

    let targetR;
    let targetG;
    let targetB;
    let confidence = 1;
    let sampleCount = 0;
    let detection = null;

    if (options.manualColorHex && /^#[0-9a-fA-F]{6}$/.test(options.manualColorHex)) {
      const hex = options.manualColorHex;
      targetR = parseInt(hex.slice(1, 3), 16);
      targetG = parseInt(hex.slice(3, 5), 16);
      targetB = parseInt(hex.slice(5, 7), 16);
    } else {
      detection = detectSolidBackground(imageData.data, imageData.width, imageData.height);
      targetR = detection.r;
      targetG = detection.g;
      targetB = detection.b;
      confidence = detection.confidence;
      sampleCount = detection.sampleCount;
      if (abortOnLowConfidence && confidence < minConfidence) {
        const err = new Error(
          `Low background confidence (${(confidence * 100).toFixed(0)}% < ${(minConfidence * 100).toFixed(0)}%) — aborted`
        );
        err.code = 'LOW_BG_CONFIDENCE';
        err.meta = { confidence, minConfidence, bgColor: { r: targetR, g: targetG, b: targetB } };
        throw err;
      }
    }

    // global = all matching pixels (enclosed letter holes); flood = edge-connected only
    let removedMask;
    if (mode === 'flood') {
      removedMask = applyBorderFlood(imageData, targetR, targetG, targetB, tolerance);
    } else {
      removedMask = applyGlobalColorKey(imageData, targetR, targetG, targetB, tolerance);
    }
    const { data, width, height } = imageData;
    for (let i = 0; i < width * height; i += 1) {
      if (data[i * 4 + 3] === 0) removedMask[i] = 1;
    }
    removeColorSpill(imageData, removedMask, targetR, targetG, targetB, 2);
    featherAlpha(imageData, removedMask, feather);

    return {
      engine: ENGINE_ID,
      mode,
      bgColor: { r: targetR, g: targetG, b: targetB },
      tolerance,
      feather,
      confidence,
      sampleCount,
      quality,
      detection
    };
  }

  function dataUrlToBlob(dataUrl) {
    // Avoid fetch(data:) — extension CSP connect-src blocks data: scheme.
    const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(dataUrl);
    if (!match) {
      throw new Error('Expected base64 data URL');
    }
    const mime = match[1] || 'image/png';
    const binary = atob(match[2]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function decodeDataUrlToImageData(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') {
      throw new Error('Missing image dataURL');
    }
    const blob = dataUrlToBlob(dataUrl);
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('OffscreenCanvas 2D unavailable');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return {
      canvas,
      ctx,
      imageData: ctx.getImageData(0, 0, canvas.width, canvas.height)
    };
  }

  async function encodePngDataUrl(canvas) {
    if (typeof canvas.convertToBlob === 'function') {
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return `data:image/png;base64,${btoa(binary)}`;
    }
    return canvas.toDataURL('image/png');
  }

  /**
   * @param {string} dataUrl
   * @param {{
   *   tolerance?: number,
   *   feather?: number,
   *   mode?: 'global'|'flood',
   *   manualColorHex?: string,
   *   mimeHint?: string,
   *   minConfidence?: number,
   *   abortOnLowConfidence?: boolean,
   *   skipAdaptTolerance?: boolean
   * }} [options]
   * @returns {Promise<{ success: true, dataURL: string, engine: string, meta: object }>}
   */
  async function removeBackgroundFromDataUrl(dataUrl, options = {}) {
    const quality = inferSourceQuality(dataUrl, options.mimeHint);
    const decoded = await decodeDataUrlToImageData(dataUrl);
    const meta = processImageData(decoded.imageData, { ...options, quality });
    decoded.ctx.putImageData(decoded.imageData, 0, 0);
    const out = await encodePngDataUrl(decoded.canvas);
    return {
      success: true,
      dataURL: out,
      engine: meta.engine,
      meta
    };
  }

  const api = {
    ENGINE_ID,
    DEFAULT_MIN_CONFIDENCE,
    detectSolidBackground,
    sampleBorderAverage,
    adaptTolerance,
    inferSourceQuality,
    processImageData,
    removeBackgroundFromDataUrl
  };

  root.NhpAiRembg = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
