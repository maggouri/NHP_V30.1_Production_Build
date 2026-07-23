'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const {
    parseLibraryDesignId,
    ensureLibraryDesignSplitsOnDisk,
    resolveLibraryDesignFilePath,
    listSplitFilesFromMeta,
    resolveLibraryFileOnDisk
} = require('./library-design-files');

async function makeCompositeBuffer() {
    const w = 200;
    const h = 200;
    const colors = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 255, b: 0 }
    ];
    const parts = [];
    for (let i = 0; i < 4; i += 1) {
        const x = (i % 2) * 100;
        const y = Math.floor(i / 2) * 100;
        parts.push({
            input: await sharp({
                create: { width: 100, height: 100, channels: 3, background: colors[i] }
            }).png().toBuffer(),
            left: x,
            top: y
        });
    }
    return sharp({
        create: { width: w, height: h, channels: 3, background: { r: 0, g: 0, b: 0 } }
    }).composite(parts).png().toBuffer();
}

async function run() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nhp-lib-test-'));
    const libDir = path.join(tmp, 'lib_test123');
    fs.mkdirSync(libDir);
    const compositeBuf = await makeCompositeBuffer();
    fs.writeFileSync(path.join(libDir, 'composite.png'), compositeBuf);

    const parsed = parseLibraryDesignId('lib_test123__d2');
    assert.strictEqual(parsed.isDesign, true);
    assert.strictEqual(parsed.fileName, 'design_2.png');

    const splits = listSplitFilesFromMeta(null, libDir);
    assert.strictEqual(splits.length, 4);
    assert.strictEqual(splits[1].name, 'design_2.png');

    const before = resolveLibraryFileOnDisk(libDir, 'design_2.png', { designIndex: 2 });
    assert.strictEqual(before.filePath, null);
    assert.strictEqual(before.needsSplit, true);

    await ensureLibraryDesignSplitsOnDisk(libDir);
    assert.ok(fs.existsSync(path.join(libDir, 'design_2.png')));

    const resolved = await resolveLibraryDesignFilePath(libDir, 'lib_test123__d2');
    assert.ok(resolved.filePath.endsWith('design_2.png'));
    assert.notStrictEqual(resolved.fileName, 'composite.png');

    const meta = await sharp(resolved.filePath).metadata();
    assert.strictEqual(meta.width, 100);
    assert.strictEqual(meta.height, 100);

    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('library-design-files tests OK');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
