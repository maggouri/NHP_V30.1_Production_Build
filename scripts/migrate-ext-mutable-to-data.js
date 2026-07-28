'use strict';

/**
 * Migrate mutable runtime dirs from Extension App Root → portable Data root.
 *
 * Usage:
 *   node scripts/migrate-ext-mutable-to-data.js --dry-run
 *   node scripts/migrate-ext-mutable-to-data.js --execute
 *
 * Rules:
 * - Never overwrite newer Data files (Ext-newer wins via copy if newer)
 * - Do not delete Ext origin until verified (execute moves via copy+verify+remove)
 * - Relative manifest + rollback list written under Data/.migration
 * - Does not touch Chrome-loaded code; stop servers first if profiles are locked
 */

const fs = require('fs');
const path = require('path');
const { getPortablePaths } = require('../utils/nhp-portable-paths');

const MUTABLE_DIRS = [
    'server_profiles',
    'server_profiles_creaty',
    'server_profiles_creaty_preview',
    'server_profiles_pinterest',
    'profile_backups',
    'profile_backups_pinterest',
    'profile_browser_locks',
    'temp_uploads',
    'temp_uploads_ai_bridge',
    'temp_uploads_pinterest',
    'metadata_store',
    'server_logs',
    'generated_designs',
    'NHP_DATA' // nested mistake
];

const SOURCE_POLLUTION = [
    'CLIProxyAPI-main',
    'CLIProxyAPI_render_fix',
    'screeeeenvme'
];

function parseArgs(argv) {
    const dryRun = !argv.includes('--execute');
    const moveSource = argv.includes('--move-source-pollution');
    return { dryRun, moveSource };
}

function dirSizeBytes(dir) {
    if (!fs.existsSync(dir)) return { bytes: 0, files: 0 };
    let bytes = 0;
    let files = 0;
    const stack = [dir];
    while (stack.length) {
        const cur = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(cur, { withFileTypes: true });
        } catch (_) {
            continue;
        }
        for (const ent of entries) {
            const full = path.join(cur, ent.name);
            if (ent.isDirectory()) stack.push(full);
            else if (ent.isFile()) {
                files += 1;
                try {
                    bytes += fs.statSync(full).size;
                } catch (_) { /* ignore */ }
            }
        }
    }
    return { bytes, files };
}

function ensureDir(p) {
    fs.mkdirSync(p, { recursive: true });
}

function copyFileNewerWins(src, dest, dryRun, actions) {
    ensureDir(path.dirname(dest));
    if (!fs.existsSync(dest)) {
        actions.push({ op: 'copy-new', src, dest });
        if (!dryRun) {
            try {
                fs.copyFileSync(src, dest);
            } catch (err) {
                actions.push({ op: 'copy-skipped-locked', src, dest, code: err.code, message: String(err.message || err) });
            }
        }
        return;
    }
    let sStat;
    let dStat;
    try {
        sStat = fs.statSync(src);
        dStat = fs.statSync(dest);
    } catch (_) {
        return;
    }
    if (sStat.mtimeMs > dStat.mtimeMs) {
        actions.push({ op: 'copy-newer', src, dest, srcMtime: sStat.mtimeMs, destMtime: dStat.mtimeMs });
        if (!dryRun) {
            try {
                fs.copyFileSync(src, dest);
            } catch (err) {
                actions.push({ op: 'copy-skipped-locked', src, dest, code: err.code, message: String(err.message || err) });
            }
        }
    } else {
        actions.push({ op: 'skip-older-or-same', src, dest });
    }
}

function mergeTree(srcDir, destDir, dryRun, actions) {
    if (!fs.existsSync(srcDir)) return;
    const stack = [['', srcDir]];
    while (stack.length) {
        const [rel, cur] = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(cur, { withFileTypes: true });
        } catch (_) {
            continue;
        }
        for (const ent of entries) {
            const childRel = rel ? path.join(rel, ent.name) : ent.name;
            const from = path.join(srcDir, childRel);
            const to = path.join(destDir, childRel);
            if (ent.isDirectory()) {
                if (!dryRun) ensureDir(to);
                stack.push([childRel, from]);
            } else if (ent.isFile()) {
                copyFileNewerWins(from, to, dryRun, actions);
            }
        }
    }
}

function removeTree(dir, dryRun, actions) {
    if (!fs.existsSync(dir)) return;
    const locked = actions.filter((a) => a.op === 'copy-skipped-locked' && String(a.src || '').startsWith(dir));
    if (locked.length) {
        actions.push({ op: 'keep-origin-locked-files', path: dir, lockedCount: locked.length });
        return;
    }
    actions.push({ op: 'remove-origin', path: dir });
    if (!dryRun) {
        try {
            fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
        } catch (err) {
            actions.push({ op: 'remove-origin-failed', path: dir, code: err.code, message: String(err.message || err) });
        }
    }
}

function main() {
    const { dryRun, moveSource } = parseArgs(process.argv.slice(2));
    const appRoot = path.resolve(__dirname, '..');
    const portable = getPortablePaths({ appRootHint: appRoot, forceReload: true, ensure: true });
    const dataRoot = portable.dataRoot;
    const sourceRoot = portable.sourceRoot;

    console.log(JSON.stringify({
        mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
        appRoot,
        dataRoot,
        sourceRoot
    }, null, 2));

    if (path.resolve(dataRoot).toLowerCase() === path.resolve(appRoot).toLowerCase()) {
        throw new Error('DATA_ROOT equals APP_ROOT — aborting');
    }

    const beforeExt = dirSizeBytes(appRoot);
    const plan = [];
    const actions = [];
    const rollback = [];

    for (const name of MUTABLE_DIRS) {
        const src = path.join(appRoot, name);
        if (!fs.existsSync(src)) continue;
        const dest = name === 'NHP_DATA' ? dataRoot : path.join(dataRoot, name);
        const srcSize = dirSizeBytes(src);
        const destSize = dirSizeBytes(dest);
        plan.push({
            name,
            src,
            dest,
            srcMB: +(srcSize.bytes / 1048576).toFixed(1),
            srcFiles: srcSize.files,
            destMB: +(destSize.bytes / 1048576).toFixed(1),
            destFiles: destSize.files
        });
        portable.assertNotExtensionWrite(dest === dataRoot ? path.join(dataRoot, '.migration') : dest);
        mergeTree(src, dest, dryRun, actions);
        // Only remove origin after merge when execute
        if (!dryRun) {
            // Verify dest exists
            if (!fs.existsSync(dest) && srcSize.files > 0) {
                throw new Error(`Merge failed for ${name}: dest missing`);
            }
            rollback.push({ restoreFrom: dest, restoreTo: src, note: 'manual if needed' });
            removeTree(src, dryRun, actions);
        } else {
            actions.push({ op: 'would-remove-origin-after-verify', path: src });
        }
    }

    if (moveSource) {
        ensureDir(sourceRoot);
        for (const name of SOURCE_POLLUTION) {
            const src = path.join(appRoot, name);
            if (!fs.existsSync(src)) continue;
            const dest = path.join(sourceRoot, name);
            const srcSize = dirSizeBytes(src);
            plan.push({
                name: `SOURCE:${name}`,
                src,
                dest,
                srcMB: +(srcSize.bytes / 1048576).toFixed(1),
                srcFiles: srcSize.files,
                destMB: +(dirSizeBytes(dest).bytes / 1048576).toFixed(1)
            });
            if (!dryRun) {
                if (fs.existsSync(dest)) {
                    mergeTree(src, dest, false, actions);
                    removeTree(src, false, actions);
                } else {
                    actions.push({ op: 'move-source', src, dest });
                    fs.renameSync(src, dest);
                }
            } else {
                actions.push({ op: 'would-move-source', src, dest });
            }
        }
    }

    const afterExt = dryRun ? null : dirSizeBytes(appRoot);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const migDir = path.join(dataRoot, '.migration');
    ensureDir(migDir);
    const manifest = {
        stamp,
        mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
        beforeExtMB: +(beforeExt.bytes / 1048576).toFixed(1),
        afterExtMB: afterExt ? +(afterExt.bytes / 1048576).toFixed(1) : null,
        plan,
        actionCount: actions.length,
        rollback,
        relativeLayout: {
            extension: '.',
            data: path.relative(appRoot, dataRoot),
            source: path.relative(appRoot, sourceRoot)
        }
    };
    const manifestPath = path.join(migDir, `ext-mutable-migrate-${stamp}.json`);
    // Manifest under Data is OK; keep a slim summary without every skip action
    const slimActions = actions.filter((a) => a.op !== 'skip-older-or-same');
    fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, actions: slimActions }, null, 2), 'utf8');

    console.log('\n=== PLAN ===');
    console.table(plan.map((p) => ({
        name: p.name,
        srcMB: p.srcMB,
        destMB: p.destMB,
        srcFiles: p.srcFiles
    })));
    console.log(`Actions (non-skip): ${slimActions.length}`);
    console.log(`Manifest: ${manifestPath}`);
    console.log(`Ext before: ${manifest.beforeExtMB} MB`);
    if (manifest.afterExtMB != null) console.log(`Ext after: ${manifest.afterExtMB} MB`);
    if (dryRun) {
        console.log('\nDry-run only. Re-run with --execute after stopping servers.');
        console.log('Optional: --move-source-pollution to relocate CLIProxyAPI-* / screeeeenvme → NHP_SOURCE');
    }
}

main();
