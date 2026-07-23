/**
 * Watermark Engine Module
 * Main orchestrator for watermark removal processing.
 * Handles asset loading, size detection, and processing coordination.
 */

import { calculateAlphaMap } from './alpha-map.js';
import { removeWatermark } from './blend-modes.js';

// Watermark configuration based on image size
const WATERMARK_CONFIGS = {
  small: {
    size: 48,
    margin: 32,
    asset: 'Peel Banana/assets/bg_48.png',
    minDimension: 0
  },
  large: {
    size: 96,
    margin: 64,
    asset: 'Peel Banana/assets/bg_96.png',
    minDimension: 1024
  }
};

export class WatermarkEngine {
  constructor() {
    this.alphaMaps = new Map(); // Cache computed alpha maps
    this.bgImages = new Map();  // Cache loaded background images
  }

  /**
   * Factory method for async initialization
   * @returns {Promise<WatermarkEngine>}
   */
  static async create() {
    const engine = new WatermarkEngine();
    await engine.loadAssets();
    return engine;
  }

  /**
   * Load watermark reference assets
   */
  async loadAssets() {
    const loadImage = async (path) => {
      const url = chrome.runtime.getURL(path);
      const response = await fetch(url);
      const blob = await response.blob();
      return createImageBitmap(blob);
    };

    this.bgImages.set(48, await loadImage(WATERMARK_CONFIGS.small.asset));
    this.bgImages.set(96, await loadImage(WATERMARK_CONFIGS.large.asset));
  }

  /**
   * Get or compute alpha map for given size
   * @param {number} size - Watermark size (48 or 96)
   * @returns {Float32Array}
   */
  getAlphaMap(size) {
    if (!this.alphaMaps.has(size)) {
      const bgImage = this.bgImages.get(size);

      // Use OffscreenCanvas for service worker compatibility
      const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(size, size)
        : document.createElement('canvas');

      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }

      const ctx = canvas.getContext('2d');
      ctx.drawImage(bgImage, 0, 0);
      const imageData = ctx.getImageData(0, 0, size, size);
      this.alphaMaps.set(size, calculateAlphaMap(imageData));
    }
    return this.alphaMaps.get(size);
  }

  /**
   * Determine watermark configuration based on image dimensions
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @returns {Object} Watermark config
   */
  getWatermarkConfig(width, height) {
    if (width > WATERMARK_CONFIGS.large.minDimension &&
      height > WATERMARK_CONFIGS.large.minDimension) {
      return WATERMARK_CONFIGS.large;
    }
    return WATERMARK_CONFIGS.small;
  }

  /**
   * Calculate watermark position (bottom-right corner)
   * @param {number} imageWidth
   * @param {number} imageHeight
   * @param {Object} config
   * @returns {Object} Position {x, y, width, height}
   */
  getWatermarkPosition(imageWidth, imageHeight, config) {
    return {
      x: imageWidth - config.size - config.margin,
      y: imageHeight - config.size - config.margin,
      width: config.size,
      height: config.size
    };
  }

  /**
   * Main entry point - process image data in place
   * @param {ImageData} imageData - Image data to process
   * @returns {Object} Processing result with metadata
   */
  async processImage(imageData) {
    const { width, height } = imageData;

    // Minimum size check
    if (width < 100 || height < 100) {
      throw new Error('Image too small to contain a watermark');
    }

    const config = this.getWatermarkConfig(width, height);
    const position = this.getWatermarkPosition(width, height, config);

    // Validate watermark region is within bounds
    if (position.x < 0 || position.y < 0) {
      throw new Error('Image dimensions insufficient for watermark removal');
    }

    const alphaMap = this.getAlphaMap(config.size);
    removeWatermark(imageData, alphaMap, position);

    return {
      processed: true,
      watermarkSize: config.size,
      position
    };
  }
}
