/**
 * Shared templates for NHP_Start_All_Servers (.bat / .sh).
 * Used by ai-bridge-server HTTP routes and kept in sync with extension background fallback.
 */
const fs = require('fs');
const path = require('path');

let cached = null;

function loadTemplates() {
    if (cached) return cached;
    const p = path.join(__dirname, 'startup-script-templates.json');
    cached = JSON.parse(fs.readFileSync(p, 'utf8'));
    return cached;
}

function normalizeRootForShell(rootDir, format) {
    const r = String(rootDir || '').trim();
    if (!r) return r;
    return format === 'sh' ? r.replace(/\\/g, '/') : r;
}

function loadBatTemplateBody() {
    const templatePath = path.join(__dirname, 'NHP_Start_All_Servers.cmd.template');
    if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, 'utf8');
    }
    const templates = loadTemplates();
    return templates.bat;
}

function buildStartupScript(rootDir, format) {
    const fmt = format === 'sh' ? 'sh' : 'bat';
    const templates = loadTemplates();
    const body = fmt === 'sh' ? templates.sh : loadBatTemplateBody();
    if (!body) throw new Error(`Missing ${fmt} template`);
    const sub = normalizeRootForShell(rootDir, fmt);
    return body.replace(/__NHP_ROOT__/g, sub);
}

module.exports = {
    buildStartupScript,
    loadTemplates
};
