/**
 * Sync extension-only files from Production_Build → NHP EMAILCORE.
 * Servers (creaty-server.js, ghost-server.js, ai-bridge-server.js) stay in Production_Build.
 */
const fs = require('fs');
const path = require('path');

const PB = path.resolve(__dirname, '..');
const EC = process.env.NHP_EMAILCORE_DIR || path.resolve(PB, '../01_EmailCore');

const COPY_LIST = [
  'modules/creaty/creaty.js',
  'modules/creaty/creaty.html',
  'modules/creaty/creaty.css',
  'modules/creaty/creaty-dashboard.js',
  'creaty-ai-supervisor-bridge.js',
  'creaty-field-watch-overlay.js',
  'offscreen.js',
  'launcher.html',
  'niche_commander.html',
  'startup-script-templates.json',
  'logic/api-connector.js',
  'SEO Analyse Artisan/background.js',
  'modules/admin/admin.html',
  'modules/admin/admin.js',
  'modules/autopilot/autopilot.css',
  'modules/autopilot/autopilot.html',
  'modules/autopilot/autopilot.js',
  'modules/generate/generate.css',
  'modules/generate/generate.html',
  'modules/generate/generate.js',
  'modules/studio/studio.js',
];

function copyFile(rel) {
  const src = path.join(PB, rel);
  const dst = path.join(EC, rel);
  if (!fs.existsSync(src)) {
    console.warn('SKIP missing:', rel);
    return false;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log('COPIED:', rel);
  return true;
}

function extractBlock(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) return '';
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) return text.slice(start);
  return text.slice(start, end);
}

function mergeBackground() {
  const pbBg = fs.readFileSync(path.join(PB, 'background.js'), 'utf8');
  const ecBg = fs.readFileSync(path.join(EC, 'background.js'), 'utf8');

  const fastProbe = extractBlock(
    ecBg,
    '// Fast EmailCore bridge ack',
    '\n\ntry {\n    importScripts(\'peel_banana_engine.js\');'
  );

  const ecOnlyImports = [
    "importScripts('emailcore-account-utils.js');",
    "importScripts('utils/ap-account-activation.js');",
    "importScripts('emailcore-teepublic-pipeline.js');",
    "importScripts('emailcore-handlers.js');",
    "importScripts('creaty-ai-classify.js');",
    "importScripts('creaty-store-generator.js');",
    "importScripts('creaty-account-archive.js');",
    "importScripts('creaty-handlers.js');",
  ];

  let merged = pbBg;

  if (fastProbe) {
    merged = merged.replace(
      /\/\*\*\n \* background\.js/,
      `/**\n * background.js`
    );
    merged = merged.replace(
      '/**\n * background.js — Niche Hunter Pro v9.0',
      `/**\n * background.js — EmailCore Lite (merged from Production_Build)`
    );
    merged = merged.replace(
      'try {\n    importScripts(\'peel_banana_engine.js\');',
      `${fastProbe}\n\ntry {\n    importScripts('peel_banana_engine.js');`
    );
  }

  const promptBagEnd = "console.error('Failed to import background/prompt-bag-handlers.js', e);\n}";
  const ecImportBlock = ecOnlyImports.map((line) => {
    const file = line.match(/importScripts\('([^']+)'\)/)[1];
    return `try {\n    ${line}\n} catch (e) {\n    console.error('Failed to import ${file}', e);\n}`;
  }).join('\n');

  if (!merged.includes("importScripts('emailcore-handlers.js')")) {
    merged = merged.replace(
      promptBagEnd,
      `${promptBagEnd}\n${ecImportBlock}`
    );
  }

  const creatyHandlerReg = extractBlock(
    ecBg,
    "if (typeof self.__creatyHandleMessage !== 'function')",
    "try {\n    importScripts('modules/radar/teepublic-extract-shared.js');"
  );
  if (creatyHandlerReg && !merged.includes('__creatyHandleMessage')) {
    merged = merged.replace(
      "try {\n    importScripts('modules/radar/teepublic-extract-shared.js');",
      `${creatyHandlerReg}try {\n    importScripts('modules/radar/teepublic-extract-shared.js');`
    );
  }

  const ecTail = extractBlock(
    ecBg,
    "try {\n    importScripts('creaty-upload-scheduler.js');",
    ''
  );
  if (ecTail && !merged.includes("importScripts('creaty-upload-scheduler.js')")) {
    merged = merged.trimEnd() + '\n\n' + ecTail;
  }

  fs.writeFileSync(path.join(EC, 'background.js'), merged, 'utf8');
  console.log('MERGED: background.js');
}

function patchCreatyExports() {
  const p = path.join(EC, 'modules/creaty/creaty.js');
  let text = fs.readFileSync(p, 'utf8');
  if (!text.includes('NHP_activateCreatyPanel')) {
    text += `\nexport function NHP_activateCreatyPanel() {\n    activateCreatyDashboard();\n}\n`;
    fs.writeFileSync(p, text, 'utf8');
    console.log('PATCHED: modules/creaty/creaty.js (NHP_activateCreatyPanel alias)');
  }
}

function bumpManifestVersion() {
  const manifestPath = path.join(EC, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.name = 'EmailCore Lite';
  const parts = String(manifest.version || '30.1.25').split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  manifest.version = parts.join('.');
  if (!manifest.content_scripts.some((cs) => (cs.js || []).includes('creaty-field-watch-overlay.js'))) {
    const teepublicBlock = manifest.content_scripts.find((cs) =>
      (cs.js || []).includes('content_script.js')
    );
    if (teepublicBlock && !(teepublicBlock.js || []).includes('creaty-field-watch-overlay.js')) {
      teepublicBlock.js.push('creaty-field-watch-overlay.js');
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('UPDATED: manifest.json →', manifest.name, manifest.version);
  return manifest;
}

/** Production_Build IS the user's Chrome extension — never strip its manifest. */
function stripProductionManifest() {
  console.log('SKIP: Production_Build/manifest.json kept intact (extension + servers folder)');
}

function createExtensionIdPlaceholder() {
  const p = path.join(EC, 'emailcore_extension_id.txt');
  const text = `# ضع هنا معرّف إضافة EmailCore Lite بعد إعادة التحميل من chrome://extensions
# Extension ID appears under the extension name on chrome://extensions (Developer mode ON)
# Example: abcdefghijklmnopqrstuvwxyzabcd
PLACEHOLDER_RELOAD_EXTENSION_THEN_PASTE_ID_HERE
`;
  fs.writeFileSync(p, text, 'utf8');
  console.log('CREATED: emailcore_extension_id.txt (placeholder)');
}

const copied = [];
for (const rel of COPY_LIST) {
  if (copyFile(rel)) copied.push(rel);
}
mergeBackground();
patchCreatyExports();
const manifest = bumpManifestVersion();
stripProductionManifest();
createExtensionIdPlaceholder();

const reportPath = path.join(EC, 'SYNC_REPORT.json');
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      syncedAt: new Date().toISOString(),
      source: PB,
      target: EC,
      copied,
      merged: ['background.js'],
      manifest: { name: manifest.name, version: manifest.version },
    },
    null,
    2
  ) + '\n',
  'utf8'
);
console.log('DONE. Report:', reportPath);
