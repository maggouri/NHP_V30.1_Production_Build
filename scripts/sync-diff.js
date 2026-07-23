const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const pb = path.resolve(__dirname, '..');
const ec = process.env.NHP_EMAILCORE_DIR || path.resolve(pb, '../01_EmailCore');
const skipDirs = new Set(['node_modules', 'server', 'backups', '.git']);
const skipFiles = new Set(['creaty-server.js', 'creaty-server-orchestrator.js']);

function walk(root, rel = '') {
  const out = [];
  const dir = path.join(root, rel);
  for (const name of fs.readdirSync(dir)) {
    const r = rel ? `${rel}/${name}` : name;
    const full = path.join(root, r);
    if (fs.statSync(full).isDirectory()) {
      if (skipDirs.has(name)) continue;
      out.push(...walk(root, r));
    } else if (/\.(js|json|html|css)$/.test(name) && !skipFiles.has(name)) {
      out.push(r.replace(/\\/g, '/'));
    }
  }
  return out;
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

const pbFiles = walk(pb).sort();
const ecSet = new Set(walk(ec));
const diff = [];
const onlyPb = [];
const onlyEc = [];

for (const f of pbFiles) {
  const a = path.join(pb, f);
  const b = path.join(ec, f);
  if (!fs.existsSync(b)) {
    onlyPb.push(f);
    continue;
  }
  if (md5(a) !== md5(b)) diff.push(f);
}

for (const f of [...ecSet].sort()) {
  if (!fs.existsSync(path.join(pb, f))) onlyEc.push(f);
}

console.log(`DIFF (${diff.length})`);
diff.forEach((x) => console.log(`  ${x}`));
console.log(`ONLY_PB (${onlyPb.length})`);
onlyPb.forEach((x) => console.log(`  ${x}`));
console.log(`ONLY_EC (${onlyEc.length})`);
onlyEc.forEach((x) => console.log(`  ${x}`));
