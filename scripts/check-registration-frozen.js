#!/usr/bin/env node
/**
 * Verify Registration & Activation frozen files match manifest checksums.
 * Exits 1 if protected content changed without REGISTRATION_UNLOCK_KEY=693400.
 *
 * Usage:
 *   node scripts/check-registration-frozen.js
 *   node scripts/check-registration-frozen.js --write-baseline
 *   REGISTRATION_UNLOCK_KEY=693400 node scripts/check-registration-frozen.js --write-baseline
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'modules', 'creaty', 'REGISTRATION_ACTIVATION_FROZEN.manifest.json');
const UNLOCK_KEY = '693400';
const writeBaseline = process.argv.includes('--write-baseline');
const unlocked = String(process.env.REGISTRATION_UNLOCK_KEY || '').trim() === UNLOCK_KEY;

function readUtf8(relPath) {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function extractContent(relPath, ranges) {
    const text = readUtf8(relPath);
    if (!ranges || !ranges.length) return text;
    const lines = text.split(/\r?\n/);
    const chunks = [];
    for (const [start, end] of ranges) {
        const slice = lines.slice(Math.max(1, start) - 1, end);
        chunks.push(slice.join('\n'));
    }
    return chunks.join('\n');
}

function sha256(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function fail(msg) {
    console.error('REGISTRATION_FROZEN FAIL:', msg);
    process.exit(1);
}

function pass(msg) {
    console.log('REGISTRATION_FROZEN OK:', msg);
}

if (!fs.existsSync(MANIFEST_PATH)) {
    fail(`manifest missing: ${path.relative(ROOT, MANIFEST_PATH)}`);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
let mismatches = 0;

for (const entry of entries) {
    const relPath = String(entry.path || '').replace(/\\/g, '/');
    if (!relPath) continue;
    const fullPath = path.join(ROOT, relPath);
    if (!fs.existsSync(fullPath)) {
        fail(`missing frozen file: ${relPath}`);
    }

    const content = extractContent(relPath, entry.ranges);
    const digest = sha256(content);
    const label = entry.ranges?.length
        ? `${relPath} [${entry.ranges.map((r) => `${r[0]}-${r[1]}`).join(', ')}]`
        : relPath;

    if (writeBaseline) {
        entry.sha256 = digest;
        continue;
    }

    if (!entry.sha256) {
        fail(`${label} has no sha256 baseline — run with --write-baseline`);
    }

    if (entry.sha256 !== digest) {
        mismatches += 1;
        console.error(`  changed: ${label}`);
        console.error(`    expected: ${entry.sha256}`);
        console.error(`    actual:   ${digest}`);
    } else {
        pass(label);
    }
}

if (writeBaseline) {
    manifest.updatedAt = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Wrote baseline checksums to ${path.relative(ROOT, MANIFEST_PATH)}`);
    process.exit(0);
}

if (mismatches > 0) {
  if (unlocked) {
    console.warn(`REGISTRATION_FROZEN WARN: ${mismatches} mismatch(es) but REGISTRATION_UNLOCK_KEY=${UNLOCK_KEY} is set.`);
    console.warn('Run: node scripts/check-registration-frozen.js --write-baseline');
    process.exit(0);
  }
  fail(`${mismatches} frozen section(s) changed without REGISTRATION_UNLOCK_KEY=${UNLOCK_KEY}`);
}

pass(`all ${entries.length} frozen entries match baseline`);
