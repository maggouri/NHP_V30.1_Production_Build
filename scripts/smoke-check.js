#!/usr/bin/env node
/**
 * NHP production smoke checks — run before Chrome reload / release.
 * Usage: node scripts/smoke-check.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
let warnings = 0;

function fail(msg) {
    console.error('FAIL:', msg);
    failures += 1;
}

function warn(msg) {
    console.warn('WARN:', msg);
    warnings += 1;
}

function pass(msg) {
    console.log('OK:', msg);
}

function readUtf8(relPath) {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

// 1) manifest.json valid JSON + required keys
try {
    const manifest = JSON.parse(readUtf8('manifest.json'));
    if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
    if (!manifest.background?.service_worker) fail('background.service_worker missing');
    if (!Array.isArray(manifest.permissions)) fail('permissions must be array');
    if (!Array.isArray(manifest.host_permissions)) fail('host_permissions must be array');
    if (manifest.host_permissions.includes('<all_urls>')) {
        warn('host_permissions still contains <all_urls>');
    }
    pass('manifest.json is valid JSON with required MV3 fields');
} catch (e) {
    fail(`manifest.json parse error: ${e.message}`);
}

// 2) node --check on service worker + imported modules
const jsTargets = [
    'background.js',
    'background/prompt-bag-handlers.js',
    'background/seo-gemini-helpers.js',
    'background/uspto-handlers.js',
    'background/uspto-queue-persistence.js',
    'utils/cli-proxy-retry.js',
    'utils/nhp-runtime-config.js'
];
for (const rel of jsTargets) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
        fail(`missing file: ${rel}`);
        continue;
    }
    try {
        execSync(`node --check "${abs}"`, { stdio: 'pipe' });
        pass(`syntax OK: ${rel}`);
    } catch (e) {
        fail(`syntax error in ${rel}`);
    }
}

// 3) grep for hardcoded nhp_ API key patterns (lowercase nhp_ + long token only)
const SCAN_ROOTS = ['background', 'modules', 'utils', 'logic'];
const ROOT_FILES = ['background.js', 'popup.js', 'content_script.js', 'gemini-content.js', 'launcher.js', 'prompt_bag.js'];
const SKIP_DIR_NAMES = new Set(['server_profiles', 'server_profiles_pinterest', 'node_modules', '_archive_bak', '.git']);
/** Matches CLI-style keys like nhp_95Tm... — not NHP_functionName */
const KEY_PATTERN = /['"]nhp_[a-z0-9]{20,}['"]/g;

function walkJsFiles(dir, out = new Set()) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIR_NAMES.has(entry.name)) continue;
            walkJsFiles(full, out);
        } else if (/\.js$/i.test(entry.name)) {
            out.add(full);
        }
    }
    return out;
}

const scanned = new Set();
for (const rel of ROOT_FILES) scanned.add(path.join(ROOT, rel));
for (const relDir of SCAN_ROOTS) walkJsFiles(path.join(ROOT, relDir), scanned);

let keyHits = [];
for (const file of scanned) {
    if (!fs.existsSync(file)) continue;
    const rel = path.relative(ROOT, file);
    if (rel.startsWith('tools' + path.sep)) continue;
    if (/test[-_]/i.test(path.basename(file))) continue;
    const text = fs.readFileSync(file, 'utf8');
    const matches = text.match(KEY_PATTERN);
    if (matches) {
        keyHits.push({ rel, matches: [...new Set(matches)] });
    }
}

if (keyHits.length) {
    for (const hit of keyHits) {
        fail(`hardcoded nhp_ key pattern in ${hit.rel}: ${hit.matches.join(', ')}`);
    }
} else {
    pass('no hardcoded nhp_* API key patterns in production JS/JSON');
}

// 4) importScripts modules referenced by background.js exist
try {
    const bg = readUtf8('background.js');
    const imports = [...bg.matchAll(/importScripts\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
    for (const rel of imports) {
        const abs = path.join(ROOT, rel.replace(/\//g, path.sep));
        if (!fs.existsSync(abs)) fail(`importScripts target missing: ${rel}`);
        else pass(`importScripts target exists: ${rel}`);
    }
} catch (e) {
    fail(`background importScripts scan failed: ${e.message}`);
}

console.log('');
console.log(`Smoke check complete: ${failures} failure(s), ${warnings} warning(s)`);
process.exit(failures > 0 ? 1 : 0);
