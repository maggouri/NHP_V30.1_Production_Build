#!/usr/bin/env node
/**
 * Audit design library index vs on-disk files.
 * Usage:
 *   node scripts/audit-library-integrity.js
 *   node scripts/audit-library-integrity.js --fix
 *   node scripts/audit-library-integrity.js --json
 *   node scripts/audit-library-integrity.js --id lib_1782715791994_qkq6kf
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
    auditLibraryIntegrity,
    repairLibraryIndexFromDisk,
    formatAuditTable
} = require('../server/library-integrity-audit');
const { reconcileLibraryIndexFromDisk } = require('../server/generate-api');

const ROOT = path.resolve(__dirname, '..');
const LIBRARY_DIR = path.join(ROOT, 'generated_designs', 'library');
const INDEX_PATH = path.join(LIBRARY_DIR, 'index.json');

function readMeta(libDir) {
    const metaPath = path.join(libDir, 'meta.json');
    try {
        if (!fs.existsSync(metaPath)) return null;
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (_) {
        return null;
    }
}

function readIndex() {
    try {
        if (!fs.existsSync(INDEX_PATH)) return [];
        const parsed = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function writeIndex(entries) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(entries.slice(0, 500), null, 2), 'utf8');
}

function parseArgs(argv) {
    const out = { fix: false, json: false, id: '' };
    for (let i = 2; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--fix') out.fix = true;
        else if (a === '--json') out.json = true;
        else if (a === '--id' && argv[i + 1]) {
            out.id = String(argv[++i]).trim();
        }
    }
    return out;
}

function main() {
    const args = parseArgs(process.argv);
    if (!fs.existsSync(LIBRARY_DIR)) {
        console.error('مجلد المكتبة غير موجود:', LIBRARY_DIR);
        process.exit(1);
    }

    let index = readIndex();
    let repairResult = null;

    if (args.fix) {
        const reconciled = reconcileLibraryIndexFromDisk(LIBRARY_DIR, index, readMeta);
        const repaired = repairLibraryIndexFromDisk(LIBRARY_DIR, reconciled, readMeta);
        index = repaired.index;
        writeIndex(index);
        repairResult = {
            reconciledCount: reconciled.length,
            repairedEntries: repaired.repaired,
            metaUpdated: repaired.metaUpdated
        };
        console.log(`تم الإصلاح: ${repaired.repaired.length} مدخل، meta محدّث لـ ${repaired.metaUpdated.length} مجلد`);
    }

    let report = auditLibraryIntegrity(LIBRARY_DIR, { index, readMetaFn: readMeta });

    if (args.id) {
        const needle = args.id.replace(/__d\d+$/i, '');
        report = {
            ...report,
            issues: report.issues.filter((i) =>
                i.id === args.id
                || i.id.startsWith(`${needle}__d`)
                || i.storageId === needle
            ),
            brokenIds: report.brokenIds.filter((id) =>
                id === args.id || id.startsWith(`${needle}__d`)
            )
        };
        report.brokenCount = report.brokenIds.length;
        report.issueCount = report.issues.length;
    }

    if (repairResult) report.repair = repairResult;

    if (args.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(formatAuditTable(report));
        if (args.id && report.issues.length) {
            console.log('تفاصيل:', JSON.stringify(report.issues, null, 2));
        }
    }

    process.exit(report.brokenCount > 0 ? 2 : 0);
}

main();
