import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root = path.resolve(import.meta.dirname,'..');
function run(args) {
    const result = spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});
    if (result.status !== 0) process.exit(result.status || 1);
}
for (const name of fs.readdirSync(path.join(root,'js')).filter(n=>n.endsWith('.js'))) run(['--check','js/'+name]);
for (const name of fs.readdirSync(path.join(root,'tools')).filter(n=>/^test.*\.mjs$|^audit-.*\.mjs$/.test(n)).sort()) run(['tools/'+name]);
console.log('All JavaScript syntax, DOM regressions and content audits passed.');
