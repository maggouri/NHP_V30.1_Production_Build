'use strict';

/**
 * Portable path regression tests (no Chrome required).
 * Run: node scripts/tests/portable-paths-regression.test.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
    getPortablePaths,
    getExtensionRoot,
    getDataRoot,
    getSourceRoot,
    resolveWritableDataPath
} = require('../../utils/nhp-portable-paths');

function mkTempLayout(label) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `nhp-portable-${label}-`));
    const ext = path.join(root, 'Extension Pack');
    const data = path.join(root, 'NHP_DATA');
    const source = path.join(root, 'NHP_SOURCE');
    fs.mkdirSync(ext, { recursive: true });
    fs.mkdirSync(data, { recursive: true });
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(ext, 'manifest.json'), '{}');
    fs.writeFileSync(path.join(ext, 'package.json'), '{"name":"t"}');
    fs.writeFileSync(path.join(ext, 'ghost-server.js'), '//');
    fs.writeFileSync(path.join(ext, 'portable.config.json'), JSON.stringify({
        appRoot: '.',
        dataRoot: '../NHP_DATA',
        paths: { server_profiles: 'server_profiles', server_logs: 'server_logs' }
    }, null, 2));
    fs.writeFileSync(path.join(ext, 'nhp-portable.json'), JSON.stringify({
        version: 1,
        folders: { extension: '.', data: '../NHP_DATA', source: '../NHP_SOURCE' }
    }, null, 2));
    fs.writeFileSync(path.join(ext, '.nhp-portable-root'), 'ok\n');
    return { root, ext, data, source };
}

function run() {
    const results = [];

    // 1) Basic resolve independent of cwd
    {
        const layout = mkTempLayout('basic');
        const prev = process.cwd();
        process.chdir(os.tmpdir());
        const p = getPortablePaths({ appRootHint: layout.ext, forceReload: true });
        assert.strictEqual(path.resolve(p.appRoot), path.resolve(layout.ext));
        assert.strictEqual(path.resolve(p.dataRoot), path.resolve(layout.data));
        assert.strictEqual(path.resolve(p.sourceRoot), path.resolve(layout.source));
        assert.strictEqual(getExtensionRoot({ appRootHint: layout.ext, forceReload: true }), p.appRoot);
        assert.strictEqual(getDataRoot({ appRootHint: layout.ext, forceReload: true }), p.dataRoot);
        assert.strictEqual(getSourceRoot({ appRootHint: layout.ext, forceReload: true }), p.sourceRoot);
        process.chdir(prev);
        results.push('cwd-independence OK');
        fs.rmSync(layout.root, { recursive: true, force: true });
    }

    // 2) Spaces in path
    {
        const layout = mkTempLayout('spaces path');
        const p = getPortablePaths({ appRootHint: layout.ext, forceReload: true });
        const profiles = p.getProfilesDir();
        assert.strictEqual(path.resolve(profiles), path.resolve(layout.data, 'server_profiles'));
        assert.strictEqual(path.resolve(p.dataRoot), path.resolve(layout.data));
        results.push('spaces-path OK');
        fs.rmSync(layout.root, { recursive: true, force: true });
    }

    // 3) Non-Latin path
    {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nhp-عربي-'));
        const ext = path.join(root, 'إضافة');
        const data = path.join(root, 'NHP_DATA');
        fs.mkdirSync(ext, { recursive: true });
        fs.mkdirSync(data, { recursive: true });
        fs.writeFileSync(path.join(ext, 'manifest.json'), '{}');
        fs.writeFileSync(path.join(ext, 'package.json'), '{}');
        fs.writeFileSync(path.join(ext, 'portable.config.json'), JSON.stringify({ dataRoot: '../NHP_DATA' }));
        const p = getPortablePaths({ appRootHint: ext, forceReload: true });
        assert.strictEqual(path.resolve(p.dataRoot), path.resolve(data));
        results.push('non-latin-path OK');
        fs.rmSync(root, { recursive: true, force: true });
    }

    // 4) resolveWritableDataPath rejects .. and Ext writes
    {
        const layout = mkTempLayout('guard');
        const p = getPortablePaths({ appRootHint: layout.ext, forceReload: true });
        const ok = resolveWritableDataPath('server_logs/test.log', { appRootHint: layout.ext, forceReload: true });
        assert.ok(ok.startsWith(path.resolve(layout.data)));
        let threw = false;
        try {
            resolveWritableDataPath('../Extension Pack/evil.txt', { appRootHint: layout.ext, forceReload: true });
        } catch (_) {
            threw = true;
        }
        assert.ok(threw, 'expected reject for ..');
        threw = false;
        try {
            p.assertNotExtensionWrite(path.join(layout.ext, 'server_profiles'));
        } catch (_) {
            threw = true;
        }
        assert.ok(threw, 'expected reject Ext write');
        results.push('write-guard OK');
        fs.rmSync(layout.root, { recursive: true, force: true });
    }

    // 5) Live desktop layout smoke (if present)
    {
        const live = path.resolve(__dirname, '..', '..');
        if (fs.existsSync(path.join(live, 'manifest.json')) && fs.existsSync(path.join(live, 'portable.config.json'))) {
            const p = getPortablePaths({ appRootHint: live, forceReload: true });
            assert.ok(p.dataRoot);
            assert.notStrictEqual(path.resolve(p.dataRoot).toLowerCase(), path.resolve(p.appRoot).toLowerCase());
            const profiles = p.getProfilesDir();
            assert.ok(path.resolve(profiles).toLowerCase().startsWith(path.resolve(p.dataRoot).toLowerCase()));
            results.push(`live-layout OK data=${p.dataRoot}`);
        } else {
            results.push('live-layout SKIP');
        }
    }

    console.log(results.join('\n'));
    console.log('PASS portable-paths-regression');
}

run();
