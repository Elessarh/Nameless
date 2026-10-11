import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root = path.resolve(import.meta.dirname,'..');
const options = process.argv.slice(2);
if (options.some(option => option !== '--skip-browser')) {
    console.error('Usage: node tools/run-tests.mjs [--skip-browser]');
    process.exit(2);
}
const skipBrowser = options.includes('--skip-browser');
// CI runs the complete suite by default. Local CUA recipes may explicitly
// replace this browser-only fixture while retaining every other verification.
const browserTests = new Set(['test-phase3-items-layout.mjs']);
const skipped = [];
function run(args) {
    const result = spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});
    if (result.status !== 0) process.exit(result.status || 1);
}
for (const name of fs.readdirSync(path.join(root,'js')).filter(n=>n.endsWith('.js'))) run(['--check','js/'+name]);
for (const name of fs.readdirSync(path.join(root,'tools')).filter(n=>/^test.*\.mjs$|^audit-.*\.mjs$/.test(n)).sort()) {
    if (skipBrowser && browserTests.has(name)) {
        skipped.push(name);
        console.log('Explicit browser skip (--skip-browser): '+name);
        continue;
    }
    run(['tools/'+name]);
}
console.log('All executed JavaScript syntax, DOM regressions and content audits passed.');
if (skipped.length) console.log(skipped.length+' native browser test explicitly skipped; validate its layout separately.');
