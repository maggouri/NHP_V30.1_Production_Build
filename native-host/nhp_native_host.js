#!/usr/bin/env node

'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

let inputBuffer = Buffer.alloc(0);
let portableApi = null;
let setupCore = null;

function normalizeWinPath(value) {
  return String(value || '').trim().replace(/\//g, '\\').replace(/\\+$/, '');
}

function resolveProjectPaths() {
  const nativeHostDir = __dirname;
  const projectDir = normalizeWinPath(path.dirname(nativeHostDir));

  try {
    const { getPortablePaths } = require(path.join(projectDir, 'utils', 'nhp-portable-paths'));
    portableApi = getPortablePaths({ appRootHint: projectDir });
    portableApi.ensureDataRoot();
    return {
      projectDir: normalizeWinPath(portableApi.appRoot),
      dataRoot: normalizeWinPath(portableApi.dataRoot)
    };
  } catch (_) {
    let dataRoot = normalizeWinPath(path.join(path.dirname(projectDir), 'NHP_DATA'));
    try {
      const configPath = path.join(projectDir, 'portable.config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const relDataRoot = String(config?.dataRoot || '').trim();
        if (relDataRoot) {
          dataRoot = normalizeWinPath(path.resolve(projectDir, relDataRoot));
        }
      }
    } catch (_) { /* use sibling NHP_DATA default */ }
    try {
      if (!fs.existsSync(dataRoot)) fs.mkdirSync(dataRoot, { recursive: true });
    } catch (_) { /* ignore */ }
    return { projectDir, dataRoot };
  }
}

function loadSetupCore(projectDir) {
  if (setupCore) return setupCore;
  setupCore = require(path.join(projectDir, 'utils', 'nhp-setup-core'));
  return setupCore;
}

function writeNativeMessage(payload) {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]));
}

function runPowerShell(command) {
  return new Promise((resolve) => {
    const ps = 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command';
    const escaped = String(command || '').replace(/"/g, '\\"');
    exec(`${ps} "${escaped}"`, { windowsHide: true, timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: error.message,
          code: typeof error.code === 'number' ? error.code : null,
          stdout: String(stdout || ''),
          stderr: String(stderr || '')
        });
        return;
      }
      resolve({
        success: true,
        stdout: String(stdout || ''),
        stderr: String(stderr || '')
      });
    });
  });
}

async function handleSetupAction(action, message) {
  const resolved = resolveProjectPaths();
  const overrideDir = normalizeWinPath(message.projectDir || message.appRoot || '');
  const projectDir = resolveSetupAppRoot({
    appRootHint: resolved.projectDir,
    projectDir: overrideDir
  });
  const core = loadSetupCore(projectDir);
  const extensionId = String(message.extensionId || message.extension_id || '').trim();
  const setupOptions = { appRootHint: projectDir, projectDir };

  if (action === 'setup_status') {
    return core.getSetupStatus(setupOptions);
  }

  if (action === 'setup_init_data') {
    return core.initNhpData(setupOptions);
  }

  if (action === 'setup_register_native') {
    return core.registerNativeMessaging(extensionId, setupOptions);
  }

  if (action === 'setup_run_launcher') {
    const launcher = String(message.launcher || message.script || '').trim();
    const args = Array.isArray(message.args) ? message.args.map(String) : [];
    return core.runWhitelistedLauncher(projectDir, launcher, args, {
      timeout: Number(message.timeout) || 300000
    });
  }

  if (action === 'setup_first_run') {
    return core.firstRunBootstrap(extensionId, setupOptions);
  }

  if (action === 'setup_launcher_files') {
    return {
      success: true,
      files: core.getLauncherFilesMeta(projectDir)
    };
  }

  if (action === 'setup_append_log') {
    return core.appendSetupLog(String(message.message || ''), setupOptions);
  }

  return {
    success: false,
    error: `Unsupported setup action: ${action}`
  };
}

function findAppRootFromCandidate(candidate) {
  let dir = normalizeWinPath(candidate);
  if (!dir) return '';
  for (let depth = 0; depth < 8; depth += 1) {
    if (fs.existsSync(path.join(dir, 'manifest.json')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '';
}

function resolveSetupAppRoot(options = {}) {
  const override = normalizeWinPath(options.projectDir || options.appRoot || '');
  const hint = normalizeWinPath(options.appRootHint || override);
  const candidates = [override, hint].filter(Boolean);
  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const resolved = findAppRootFromCandidate(candidate);
    if (resolved) return resolved;
  }
  return hint || override || normalizeWinPath(path.dirname(__dirname));
}

async function handleMessage(message) {
  const action = String(message && message.action ? message.action : '');

  if (action === 'ping') {
    const { projectDir, dataRoot } = resolveProjectPaths();
    return {
      success: true,
      host: 'com.nhp.server_launcher',
      projectDir,
      dataRoot,
      hasManifest: fs.existsSync(path.join(projectDir, 'manifest.json')),
      hasPackage: fs.existsSync(path.join(projectDir, 'package.json'))
    };
  }

  if (action.startsWith('setup_')) {
    try {
      return await handleSetupAction(action, message || {});
    } catch (error) {
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  }

  if (action !== 'execute_command') {
    return {
      success: false,
      error: `Unsupported action: ${action || 'unknown'}`
    };
  }

  const command = String(message.command || '').trim();
  if (!command) {
    return {
      success: false,
      error: 'Missing command'
    };
  }

  return runPowerShell(command);
}

function processInputBuffer() {
  while (inputBuffer.length >= 4) {
    const messageLength = inputBuffer.readUInt32LE(0);
    if (inputBuffer.length < 4 + messageLength) break;

    const jsonBody = inputBuffer.slice(4, 4 + messageLength).toString('utf8');
    inputBuffer = inputBuffer.slice(4 + messageLength);

    let message;
    try {
      message = JSON.parse(jsonBody);
    } catch (error) {
      writeNativeMessage({ success: false, error: `Invalid JSON: ${error.message}` });
      continue;
    }

    handleMessage(message)
      .then(writeNativeMessage)
      .catch((error) => writeNativeMessage({ success: false, error: error.message || String(error) }));
  }
}

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  processInputBuffer();
});

process.stdin.on('error', () => {
  process.exit(1);
});
