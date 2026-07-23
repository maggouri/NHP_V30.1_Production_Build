/**
 * Paths for Node servers in Windows/local mode.
 */
const fs = require('fs');
const path = require('path');

function isWslRuntime() { return false; }

function resolveChromeExecutable() {
    const fromEnv = String(process.env.NHP_CHROME_PATH || '').trim();
    if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

    const candidates = [];
    candidates.push(
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    );

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) return candidate;
    }
    return candidates[0] || 'chrome';
}

function resolveChromeUserDataDir() {
    const fromEnv = String(process.env.NHP_AI_CHROME_USER_DATA_DIR || '').trim();
    if (fromEnv) return fromEnv;

    return path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
}

function resolveListenHost() {
    const fromEnv = String(process.env.NHP_LISTEN_HOST || '').trim();
    if (fromEnv) return fromEnv;
    return '127.0.0.1';
}

function resolveExtraNodeModulePaths(rootDir) {
    const paths = [path.join(rootDir, 'node_modules')];
    const extra = String(process.env.NHP_EXTRA_NODE_PATHS || '')
        .split(path.delimiter)
        .map((p) => p.trim())
        .filter(Boolean);
    for (const dir of extra) {
        if (fs.existsSync(dir)) paths.push(dir);
    }
    return paths.filter((dir, index, arr) => arr.indexOf(dir) === index);
}

function applyExtraNodeModulePaths(rootDir) {
    const dirs = resolveExtraNodeModulePaths(rootDir);
    if (!dirs.length) return dirs;
    process.env.NODE_PATH = [process.env.NODE_PATH, ...dirs].filter(Boolean).join(path.delimiter);
    require('module')._initPaths();
    return dirs;
}

module.exports = {
    isWslRuntime,
    resolveChromeExecutable,
    resolveChromeUserDataDir,
    resolveListenHost,
    resolveExtraNodeModulePaths,
    applyExtraNodeModulePaths
};
