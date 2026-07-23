#!/usr/bin/env node
'use strict';

/**
 * EP-301A migration utility (offline):
 * - Input: JSON array of legacy mailbox/session rows
 * - Output: JSON array using mailbox lifecycle schema v2
 *
 * Usage:
 *   node scripts/migrations/ep301a-migrate-mailbox-lifecycle.js input.json output.json
 */
const fs = require('fs');
const path = require('path');
const {
    normalizeLegacyMailboxRecord,
    validateMailboxLifecycleRecord,
} = require('../../logic/mailbox-lifecycle-model.js');

function readJson(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(text);
}

function writeJson(filePath, payload) {
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function main() {
    const inputPath = process.argv[2];
    const outputPath = process.argv[3];
    if (!inputPath || !outputPath) {
        console.error('Usage: node scripts/migrations/ep301a-migrate-mailbox-lifecycle.js <input.json> <output.json>');
        process.exit(1);
    }

    const absIn = path.resolve(process.cwd(), inputPath);
    const absOut = path.resolve(process.cwd(), outputPath);
    const source = readJson(absIn);
    const rows = Array.isArray(source) ? source : [];
    const migrated = [];
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
        const normalized = normalizeLegacyMailboxRecord(rows[i]);
        const result = validateMailboxLifecycleRecord(normalized);
        if (!result.ok) {
            errors.push({ index: i, errors: result.errors });
            continue;
        }
        migrated.push(normalized);
    }

    writeJson(absOut, migrated);
    console.log(`Migrated rows: ${migrated.length}`);
    console.log(`Rejected rows: ${errors.length}`);
    if (errors.length) {
        console.log(JSON.stringify(errors, null, 2));
    }
}

main();
