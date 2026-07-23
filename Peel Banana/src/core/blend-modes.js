/**
 * Blend Modes Module
 * Implements the reverse alpha blending algorithm for watermark removal.
 *
 * Gemini applies watermarks using standard alpha compositing:
 *   watermarked = α × logo + (1 - α) × original
 *
 * We reverse this to recover the original:
 *   original = (watermarked - α × logo) / (1 - α)
 *
 * Since the logo is white (255), this simplifies to:
 *   original = (watermarked - α × 255) / (1 - α)
 */

const ALPHA_THRESHOLD = 0.002;  // Ignore near-zero alpha (noise)
const MAX_ALPHA = 0.99;          // Prevent division by near-zero
const LOGO_VALUE = 255;          // Watermark is white

/**
 * Remove watermark from image data using reverse alpha blending.
 * Modifies imageData in-place.
 *
 * @param {ImageData} imageData - The image data to modify
 * @param {Float32Array} alphaMap - Pre-calculated alpha values for watermark region
 * @param {Object} position - {x, y, width, height} of watermark region
 */
export function removeWatermark(imageData, alphaMap, position) {
  const { x, y, width, height } = position;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const imgIdx = ((y + row) * imageData.width + (x + col)) * 4;
      const alphaIdx = row * width + col;

      let alpha = alphaMap[alphaIdx];

      // Skip pixels with negligible watermark contribution
      if (alpha < ALPHA_THRESHOLD) {
        continue;
      }

      // Cap alpha to prevent division by near-zero
      alpha = Math.min(alpha, MAX_ALPHA);
      const oneMinusAlpha = 1.0 - alpha;

      // Process RGB channels (skip alpha channel at index 3)
      for (let c = 0; c < 3; c++) {
        const watermarked = imageData.data[imgIdx + c];
        const original = (watermarked - alpha * LOGO_VALUE) / oneMinusAlpha;
        imageData.data[imgIdx + c] = Math.max(0, Math.min(255, Math.round(original)));
      }
    }
  }
}
