/**
 * NHP AI RemBG Engine — Niche Hunter Pro owned background removal.
 * No third-party rembg product branding or remote vendor URLs.
 *
 * Engine ids:
 *   nhp-edge-v1  — sample edge bg color, then global color-key (default) or flood; soft alpha feather
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

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function colorDistSq(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return (dr * dr) + (dg * dg) + (db * db);
  }

  function sampleBorderAverage(data, width, height) {
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;
    const push = (x, y) => {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 8) return;
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
      count += 1;
    };
    for (let x = 0; x < width; x += 1) {
      push(x, 0);
      push(x, height - 1);
    }
    for (let y = 1; y < height - 1; y += 1) {
      push(0, y);
      push(width - 1, y);
    }
    if (!count) return { r: 255, g: 255, b: 255 };
    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count)
    };
  }

  /**
   * Global color key: remove every pixel matching the tracked background color
   * (same idea as TeeMaster "السحر الشامل") — including bg pockets inside glitch gaps.
   */
  function applyGlobalColorKey(imageData, targetR, targetG, targetB, tolerance) {
    const { data, width, height } = imageData;
    const tolSq = tolerance * tolerance;
    const removedMask = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      if (data[i + 3] < 8) {
        removedMask[p] = 1;
        continue;
      }
      if (colorDistSq(data[i], data[i + 1], data[i + 2], targetR, targetG, targetB) <= tolSq) {
        data[i + 3] = 0;
        removedMask[p] = 1;
      }
    }
    return removedMask;
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

  function processImageData(imageData, options = {}) {
    const tolerance = clamp(Number(options.tolerance) || DEFAULT_TOLERANCE, 4, 120);
    const feather = clamp(Number(options.feather) || DEFAULT_FEATHER, 0, 6);
    const mode = String(options.mode || DEFAULT_MODE).toLowerCase() === 'flood' ? 'flood' : 'global';
    let targetR;
    let targetG;
    let targetB;
    if (options.manualColorHex && /^#[0-9a-fA-F]{6}$/.test(options.manualColorHex)) {
      const hex = options.manualColorHex;
      targetR = parseInt(hex.slice(1, 3), 16);
      targetG = parseInt(hex.slice(3, 5), 16);
      targetB = parseInt(hex.slice(5, 7), 16);
    } else {
      const avg = sampleBorderAverage(imageData.data, imageData.width, imageData.height);
      targetR = avg.r;
      targetG = avg.g;
      targetB = avg.b;
    }

    // global = Magic Wand contiguous-off (all matching pixels); flood = edge-connected only
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
    featherAlpha(imageData, removedMask, feather);

    return {
      engine: ENGINE_ID,
      mode,
      bgColor: { r: targetR, g: targetG, b: targetB },
      tolerance,
      feather
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
   * @param {{ tolerance?: number, feather?: number, mode?: 'global'|'flood', manualColorHex?: string }} [options]
   * @returns {Promise<{ success: true, dataURL: string, engine: string, meta: object }>}
   */
  async function removeBackgroundFromDataUrl(dataUrl, options = {}) {
    const decoded = await decodeDataUrlToImageData(dataUrl);
    const meta = processImageData(decoded.imageData, options);
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
    processImageData,
    removeBackgroundFromDataUrl
  };

  root.NhpAiRembg = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
