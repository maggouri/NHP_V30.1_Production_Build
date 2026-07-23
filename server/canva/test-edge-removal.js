'use strict';

/**
 * Quick verification for Canva edge-connected background removal.
 * Usage: node server/canva/test-edge-removal.js [path/to/image.png]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
    safeEnsureTransparentPng,
    pngHasAlpha,
    pngIsFullyOpaque
} = require('./canva-export');

function countTransparentPixels(buf) {
    return sharp(buf)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
        .then(({ data, info }) => {
            let transparent = 0;
            let edgeTransparent = 0;
            const { width: w, height: h, channels } = info;
            for (let y = 0; y < h; y += 1) {
                for (let x = 0; x < w; x += 1) {
                    const a = data[(y * w + x) * channels + 3];
                    if (a < 250) {
                        transparent += 1;
                        const onEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
                        if (onEdge) edgeTransparent += 1;
                    }
                }
            }
            return { transparent, edgeTransparent, total: w * h, width: w, height: h };
        });
}

async function buildSyntheticBlackCanvas() {
    const size = 500;
    const circle = await sharp({
        create: {
            width: 180,
            height: 180,
            channels: 4,
            background: { r: 220, g: 40, b: 40, alpha: 1 }
        }
    }).png().toBuffer();
    return sharp({
        create: {
            width: size,
            height: size,
            channels: 3,
            background: { r: 0, g: 0, b: 0 }
        }
    })
        .composite([{ input: circle, gravity: 'centre' }])
        .png()
        .toBuffer();
}

async function buildSynthetic5000BlackCanvas() {
    const size = 5000;
    const circle = await sharp({
        create: {
            width: 800,
            height: 800,
            channels: 4,
            background: { r: 255, g: 200, b: 0, alpha: 1 }
        }
    }).png().toBuffer();
    return sharp({
        create: {
            width: size,
            height: size,
            channels: 3,
            background: { r: 0, g: 0, b: 0 }
        }
    })
        .composite([{ input: circle, gravity: 'centre' }])
        .png()
        .toBuffer();
}

async function runCase(label, inputBuf, options = {}) {
    const before = await countTransparentPixels(inputBuf);
    const log = (msg) => console.log(`  [${label}] ${msg}`);
    const result = await safeEnsureTransparentPng(inputBuf, { log, ...options });
    const after = await countTransparentPixels(result.buffer);
    const ok = after.edgeTransparent > 0 || after.transparent > before.transparent;
    console.log(`\n=== ${label} ===`);
    console.log(`  size: ${before.width}×${before.height}`);
    console.log(`  pngHasAlpha: ${pngHasAlpha(inputBuf)}`);
    console.log(`  pngIsFullyOpaque: ${await pngIsFullyOpaque(inputBuf)}`);
    console.log(`  bgRemovedLocally: ${result.bgRemovedLocally}`);
    console.log(`  transparent pixels: ${before.transparent} → ${after.transparent}`);
    console.log(`  edge transparent: ${after.edgeTransparent}`);
    console.log(`  PASS: ${ok ? 'yes' : 'NO'}`);
    return ok;
}

async function main() {
    const argPath = process.argv[2];
    let allOk = true;

    allOk = (await runCase('synthetic 500×500 black canvas', await buildSyntheticBlackCanvas())) && allOk;

    console.log('\n--- 5000×5000 (prior 20M pixel skip repro) ---');
    allOk = (await runCase('synthetic 5000×5000 black canvas', await buildSynthetic5000BlackCanvas())) && allOk;

    if (argPath && fs.existsSync(argPath)) {
        const buf = fs.readFileSync(argPath);
        allOk = (await runCase(`file ${path.basename(argPath)}`, buf, { forceEdgeRemoval: true })) && allOk;
    } else if (argPath) {
        console.warn(`\nFile not found: ${argPath}`);
    }

    process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
