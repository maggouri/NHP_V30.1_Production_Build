#!/usr/bin/env node
'use strict';

/**
 * EP-302A migration utility (offline):
 * - Seeds domain registry from NHP_MAILBOX_ALLOWED_DOMAINS (env or --env flag)
 * - Writes server_logs/mailbox-lifecycle-domains.json under target root
 *
 * Usage:
 *   node scripts/migrations/ep302a-migrate-domain-registry.js [--root <dir>] [--env "a.com,b.com"] [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const {
    buildStoreFromEnvDomains,
    getRegistryStorePath,
    saveRegistryStore,
    validateDomainRegistryStore,
    listAllDomains,
} = require('../../logic/domain-registry-model.js');

function parseArgs(argv) {
    const options = {
        rootDir: process.cwd(),
        envDomains: '',
        dryRun: false,
    };

    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--root') {
            options.rootDir = path.resolve(process.cwd(), argv[i + 1] || '');
            i += 1;
        } else if (arg === '--env') {
            options.envDomains = String(argv[i + 1] || '');
            i += 1;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    }
    return options;
}

function printHelp() {
    console.log(`Usage: node scripts/migrations/ep302a-migrate-domain-registry.js [options]

Options:
  --root <dir>   Target project root (default: cwd)
  --env <list>   Comma-separated domains (default: process.env.NHP_MAILBOX_ALLOWED_DOMAINS)
  --dry-run      Validate and print summary without writing file
  --help         Show this help
`);
}

function main() {
    const options = parseArgs(process.argv);
    if (options.help) {
        printHelp();
        process.exit(0);
    }

    const env = { ...process.env };
    if (options.envDomains) env.NHP_MAILBOX_ALLOWED_DOMAINS = options.envDomains;

    const store = buildStoreFromEnvDomains(env, { markVerified: true, markEnabled: true });
    const check = validateDomainRegistryStore(store);
    if (!check.ok) {
        console.error('Registry validation failed:');
        console.error(check.errors.join('\n'));
        process.exit(1);
    }

    const domains = listAllDomains(store);
    const targetPath = getRegistryStorePath(options.rootDir);
    console.log(`Target registry: ${targetPath}`);
    console.log(`Domains to migrate: ${domains.length}`);
    domains.forEach((row) => {
        console.log(`  - ${row.name} (${row.status}, verified=${row.isVerified})`);
    });

    if (options.dryRun) {
        console.log('Dry run complete — no file written.');
        return;
    }

    if (fs.existsSync(targetPath)) {
        const backupPath = `${targetPath}.bak-${Date.now()}`;
        fs.copyFileSync(targetPath, backupPath);
        console.log(`Existing registry backed up to: ${backupPath}`);
    }

    saveRegistryStore(options.rootDir, store);
    console.log('Migration complete.');
}

main();
