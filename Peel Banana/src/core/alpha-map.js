/**
 * Alpha Map Calculation Module
 * Extracts alpha channel values from watermark reference images.
 *
 * The watermark reference images (bg_48.png, bg_96.png) are captured on a
 * solid black background. The white watermark pixels reveal the alpha values.
 */

/**
 * Calculate alpha map from a background capture image.
 * @param {ImageData} bgCaptureImageData - Image data from watermark reference
 * @returns {Float32Array} - Alpha values normalized to [0, 1]
 */
export function calculateAlphaMap(bgCaptureImageData) {
  const { width, height, data } = bgCaptureImageData;
  const alphaMap = new Float32Array(width * height);

  for (let i = 0; i < alphaMap.length; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // Use max channel value to determine alpha
    // The watermark is white on black, so brighter = more opaque
    const maxChannel = Math.max(r, g, b);
    alphaMap[i] = maxChannel / 255.0;
  }

  return alphaMap;
}
