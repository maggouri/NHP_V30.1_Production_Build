#!/usr/bin/env node
'use strict';

const { exec, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const PORTABLE_CONFIG_FILENAME = 'portable.config.json';

let inputBuffer = Buffer.alloc(0);

function readPortableConfig() {
  const candidates = [
    path.join(PROJECT_DIR, PORTABLE_CONFIG_FILENAME),
    path.join(path.dirname(PROJECT_DIR), PORTABLE_CONFIG_FILENAME),
    path.join(PROJECT_DIR, '..', 'NHP_DATA', PORTABLE_CONFIG_FILENAME),
    path.join(path.dirname(path.dirname(PROJECT_DIR)), 'NHP_DATA', PORTABLE_CONFIG_FILENAME)
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, 'utf8'));
      }
    } catch (_) { /* try next */ }
  }
  return null;
}

function resolveConfiguredDataRoot(projectDir, config) {
  const rawRoot = String(config?.dataRoot || '').trim();
  if (rawRoot) {
    const resolved = path.resolve(projectDir, rawRoot);
    if (fs.existsSync(resolved)) return resolved;
  }
  return '';
}

function findSiblingDataRoot(projectDir) {
  let current = path.resolve(projectDir);
  for (let depth = 0; depth < 8; depth += 1) {
    const parent = path.dirname(current);
    const sibling = path.join(parent, 'NHP_DATA');
    if (fs.existsSync(sibling)) return sibling;
    if (parent === current) break;
    current = parent;
  }
  return path.join(path.dirname(projectDir), 'NHP_DATA');
}

function resolveDataRoot(projectDir) {
  const config = readPortableConfig();
  const configured = resolveConfiguredDataRoot(projectDir, config);
  if (configured) return configured;
  return findSiblingDataRoot(projectDir);
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
    exec(`${ps} "${escaped}"`, { windowsHide: true, timeout: 30000 }, (error, stdout, stderr) => {
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

function findNodeExePath() {
  const config = readPortableConfig();
  const configured = String(config?.nodePath || config?.nodeExe || '').trim();
  const candidates = [];
  if (configured) candidates.push(path.resolve(PROJECT_DIR, configured));
  candidates.push(
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'node.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs', 'node.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'node', 'node.exe')
  );
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return path.resolve(candidate);
  }
  return '';
}

function findChromeExePath() {
  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return path.resolve(candidate);
  }
  return '';
}

function readNodeVersion(nodeExe) {
  if (!nodeExe) return null;
  try {
    return String(execFileSync(nodeExe, ['--version'], { encoding: 'utf8', windowsHide: true })).trim();
  } catch (_) {
    return null;
  }
}

function detectPrerequisites() {
  const nodeExe = findNodeExePath();
  const chromeExe = findChromeExePath();
  return {
    success: true,
    node: {
      found: !!nodeExe,
      version: readNodeVersion(nodeExe),
      path: nodeExe || null,
      source: nodeExe ? 'filesystem' : null
    },
    chrome: {
      found: !!chromeExe,
      path: chromeExe || null,
      source: chromeExe ? 'filesystem' : null
    }
  };
}

async function handleMessage(message) {
  const action = String(message && message.action ? message.action : '');
  if (action === 'ping') {
    const dataRoot = resolveDataRoot(PROJECT_DIR);
    return {
      success: true,
      projectDir: PROJECT_DIR,
      dataRoot,
      hasManifest: fs.existsSync(path.join(PROJECT_DIR, 'manifest.json')),
      hasPackage: fs.existsSync(path.join(PROJECT_DIR, 'package.json'))
    };
  }
  if (action === 'detect_prerequisites') {
    return detectPrerequisites();
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
